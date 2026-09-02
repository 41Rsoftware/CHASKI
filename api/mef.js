// /api/mef.js — Scraper del Portal de Transparencia Económica (MEF)
// v2: mapea columnas por el TEXTO del encabezado (Código único, SNIP,
// Proyecto, Costo del proyecto, PIM, Devengado, Avance %, Devengado
// acumulado) en vez de adivinar por tamaño de monto. También detecta
// paginación y la fecha oficial de "Última actualización" del MEF.
// Modo diagnóstico: /api/mef?debug=1
export const config = { runtime: 'edge' };
const URL_MEF = 'https://ofi5.mef.gob.pe/proyectos_pte/forms/UnidadEjecutora.aspx?tipo=2&IdUE=301096&IdUEBase=301096&periodoBase=2026';
const TTL = 12 * 60 * 60 * 1000; // 12 horas

let cache = { ts: 0, datos: null };

// ----- utilidades de parseo -----

function limpiarTexto(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

// Igual que limpiarTexto pero además quita TODAS las etiquetas — para
// buscar frases sueltas en el texto plano de la página (pie de página,
// paginación), no dentro de celdas de tabla.
function textoPlano(html) {
    return limpiarTexto(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function aNumero(texto) {
    if (!texto) return null;
    // "S/ 1,234,567.89" → 1234567.89 | "12.5%" → ignora % | vacío → null
    const limpio = texto.replace(/S\/\s*/i, '').replace(/%/g, '').replace(/[^\d.,-]/g, '');
    if (!limpio) return null;
    const n = parseFloat(limpio.replace(/,/g, ''));
    return isNaN(n) ? null : n;
}

function extraerTablas(html) {
    const tablas = [];
    const reTabla = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let m;
    while ((m = reTabla.exec(html)) !== null) {
        const filas = [];
        const reFila = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let f;
        while ((f = reFila.exec(m[1])) !== null) {
            const celdas = [];
            const reCelda = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
            let c;
            while ((c = reCelda.exec(f[1])) !== null) {
                celdas.push(limpiarTexto(c[1]));
            }
            if (celdas.some(x => x !== '')) filas.push(celdas);
        }
        if (filas.length > 1) tablas.push(filas); // tabla con encabezado + datos
    }
    return tablas;
}

// ----- identificación de la tabla real (por encabezado, no por tamaño) -----

// La tabla del MEF trae DOS filas de encabezado (arriba "2026" con colspan,
// abajo las columnas individuales). Buscamos la fila que de verdad tiene
// los nombres de columna — la que menciona PROYECTO/NOMBRE y PIM juntos.
function encontrarFilaEncabezado(tabla) {
    for (let i = 0; i < Math.min(4, tabla.length); i++) {
        const texto = tabla[i].map(x => x.toUpperCase()).join(' | ');
        if (/PROYECTO|NOMBRE/.test(texto) && /\bPIM\b/.test(texto)) return i;
    }
    return -1;
}

function mapearColumnas(encabezado) {
    const cols = {};
    encabezado.forEach((texto, idx) => {
        const t = texto.toUpperCase();
        if (cols.codigo === undefined && /(C[OÓ]DIGO\s*)?[UÚ]NICO/.test(t) && !/SNIP/.test(t)) cols.codigo = idx;
        else if (cols.snip === undefined && /SNIP/.test(t)) cols.snip = idx;
        else if (cols.proyecto === undefined && /PROYECTO|NOMBRE/.test(t)) cols.proyecto = idx;
        else if (cols.costo === undefined && /COSTO/.test(t)) cols.costo = idx;
        else if (cols.devengadoAcumulado === undefined && /DEVENG/.test(t) && /ACUMUL/.test(t)) cols.devengadoAcumulado = idx;
        else if (cols.devengado === undefined && /DEVENG/.test(t)) cols.devengado = idx;
        else if (cols.avance === undefined && /AVANCE/.test(t)) cols.avance = idx;
        else if (cols.pim === undefined && /\bPIM\b/.test(t) && !/COSTO/.test(t)) cols.pim = idx;
    });
    return cols;
}

function buscarTablaProyectos(tablas) {
    for (const tabla of tablas) {
        const iEnc = encontrarFilaEncabezado(tabla);
        if (iEnc === -1) continue;

        const cols = mapearColumnas(tabla[iEnc]);
        // sin columna de proyecto o de PIM identificada, esta tabla no sirve
        if (cols.proyecto === undefined || cols.pim === undefined) continue;

        const filas = [];
        for (let i = iEnc + 1; i < tabla.length; i++) {
            const c = tabla[i];
            const nombre = c[cols.proyecto];
            // filas vacías o la fila de cajas de filtro (sin texto) se descartan
            if (!nombre || aNumero(nombre) !== null) continue;

            const fila = {
                codigo: cols.codigo !== undefined ? (c[cols.codigo] || null) : null,
                snip: cols.snip !== undefined ? (c[cols.snip] || null) : null,
                proyecto: nombre,
                costo: cols.costo !== undefined ? aNumero(c[cols.costo]) : null,
                pim: aNumero(c[cols.pim]),
                devengado: cols.devengado !== undefined ? aNumero(c[cols.devengado]) : null,
                avance: cols.avance !== undefined ? aNumero(c[cols.avance]) : null,
                devengadoAcumulado: cols.devengadoAcumulado !== undefined ? aNumero(c[cols.devengadoAcumulado]) : null
            };

            if (fila.pim === null) continue; // sin PIM no sirve para la tabla
            filas.push(fila);
        }

        if (filas.length > 0) return filas;
    }
    return null;
}

// ----- paginación y fecha oficial -----

function detectarPaginacion(html) {
    const plano = textoPlano(html);
    const mPagina = plano.match(/P[aá]gina\s*(\d+)\s*de\s*(\d+)/i);
    const mTotal = plano.match(/Mostrando\s*\d+\s*-\s*\d+\s*de\s*(\d+)/i);
    return {
        pagina: mPagina ? Number(mPagina[1]) : 1,
        paginasTotales: mPagina ? Number(mPagina[2]) : null,
        totalRegistros: mTotal ? Number(mTotal[1]) : null
    };
}

function detectarFechaOficial(html) {
    const plano = textoPlano(html);
    const m = plano.match(/[UÚ]ltima actualizaci[oó]n:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    return m ? m[1] : null;
}

// ----- handler -----

export default async function handler(request) {
    if (request.method !== 'GET') {
        return Response.json({ error: 'Método no permitido' }, { status: 405 });
    }

    const params = new URL(request.url).searchParams;
    const debug = params.get('debug') === '1';

    if (!debug && cache.datos && Date.now() - cache.ts < TTL) {
        return Response.json({ ...cache.datos, cache: true });
    }

    try {
        const r = await fetch(URL_MEF, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            },
            signal: AbortSignal.timeout(12000)
        });

        const html = await r.text();

        // ----- MODO DIAGNÓSTICO: mira esto primero -----
        if (debug) {
            const tablas = extraerTablas(html);
            return Response.json({
                ok: true,
                httpStatus: r.status,
                htmlBytes: html.length,
                tablasEncontradas: tablas.length,
                filaEncabezadoDetectada: tablas.map(t => encontrarFilaEncabezado(t)),
                paginacion: detectarPaginacion(html),
                fechaOficialDetectada: detectarFechaOficial(html),
                // primeras 6 filas de cada tabla, para identificar cuál es la buena
                muestraTablas: tablas.slice(0, 5).map(t => t.slice(0, 6))
            });
        }

        const tablas = extraerTablas(html);
        const filas = buscarTablaProyectos(tablas);

        if (!filas) {
            return Response.json({
                fuente: 'local',
                motivo: 'La página del MEF no expone una tabla de proyectos legible en el HTML inicial (probable render por JS/postback). Revisa /api/mef?debug=1.',
                actualizado: new Date().toISOString()
            });
        }

        const { pagina, paginasTotales, totalRegistros } = detectarPaginacion(html);
        const fechaOficial = detectarFechaOficial(html);

        const salida = {
            fuente: 'live',
            unidadEjecutora: 'UE 301096 · Municipalidad Distrital de Río Negro',
            periodo: 2026,
            url: URL_MEF,
            actualizado: fechaOficial || new Date().toISOString(),
            pagina,
            paginasTotales,
            totalRegistros,
            soloPrimeraPagina: !!(paginasTotales && paginasTotales > 1),
            totalPim: filas.reduce((s, f) => s + (f.pim || 0), 0),
            totalDevengado: filas.reduce((s, f) => s + (f.devengado || 0), 0),
            filas
        };

        cache = { ts: Date.now(), datos: salida };
        return Response.json(salida);

    } catch (error) {
        return Response.json({
            fuente: 'local',
            motivo: 'Sin conexión con el MEF: ' + error.message,
            actualizado: new Date().toISOString()
        });
    }
}
