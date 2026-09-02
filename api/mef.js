// /api/mef.js — Scraper del Portal de Transparencia Económica (MEF)
// Visita la página de la UE 301096 (M.D. Río Negro), extrae la tabla
// de proyectos y la devuelve como JSON. Caché: 12 horas.
// Modo diagnóstico: /api/mef?debug=1

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

function aNumero(texto) {
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

// Identifica la tabla de proyectos: encabezado menciona PIM/Devengado/Pto.
// Devuelve filas convertidas a { proyecto, pim, devengado }
function buscarTablaProyectos(tablas) {
  for (const tabla of tablas) {
    const encabezado = tabla[0].map(x => x.toUpperCase()).join(' | ');
    const pareceTabla =
      /PIM/.test(encabezado) ||
      /DEVENG/.test(encabezado) ||
      /P\.?I\.?M/.test(encabezado);

    if (!pareceTabla) continue;

    const filas = [];
    for (let i = 1; i < tabla.length; i++) {
      const c = tabla[i];
      if (c.length < 2) continue;

      // localizar la celda con texto largo (nombre del proyecto)
      const iNombre = c.findIndex(x => x.length > 10 && aNumero(x) === null);
      if (iNombre === -1) continue;

      // localizar las celdas numéricas (PIM suele ser el monto más alto)
      const numeros = c.map(aNumero);
      const conNumero = numeros
        .map((n, idx) => ({ n, idx }))
        .filter(x => x.n !== null && x.n > 0);

      if (conNumero.length === 0) continue;

      // heurística: PIM = número mayor, Devengado = segundo mayor (o el que no sea %)
      conNumero.sort((a, b) => b.n - a.n);
      const pim = conNumero[0].n;
      const dev = conNumero.length > 1 ? conNumero[1].n : 0;

      filas.push({ proyecto: c[iNombre], pim, devengado: Math.min(dev, pim) });
    }

    if (filas.length > 0) return filas;
  }
  return null;
}

// ----- handler -----

export default async function handler(request) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Método no permitido' }, { status: 405 });
  }

  const params = new URL(request.url).searchParams;
  const debug = params.get('debug') === '1';

  // caché (solo para el modo normal)
  if (!debug && cache.datos && Date.now() - cache.ts < TTL) {
    return Response.json(cache.datos);
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
        htmlBytes: html.length,
        tablasEncontradas: tablas.length,
        // primeras 6 filas de cada tabla, para identificar cuál es la buena
        muestraTablas: tablas.slice(0, 5).map(t => t.slice(0, 6))
      });
    }

    const tablas = extraerTablas(html);
    const filas = buscarTablaProyectos(tablas);

    if (!filas) {
      // el MEF respondió pero no hay tabla legible → probablemente postback
      return Response.json({
        fuente: 'local',
        motivo: 'La página del MEF no expone la tabla en el HTML inicial',
        actualizado: new Date().toISOString()
      });
    }

    const totalPim = filas.reduce((s, f) => s + f.pim, 0);
    const totalDev = filas.reduce((s, f) => s + f.devengado, 0);

    const salida = {
      fuente: 'live',
      unidadEjecutora: 'UE 301096 · Municipalidad Distrital de Río Negro',
      periodo: 2026,
      url: URL_MEF,
      actualizado: new Date().toISOString(),
      totalPim,
      totalDevengado: totalDev,
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