// ===== CHASKI · Fuentes públicas (datos curados en el repo) =====
let TRAMITES = [];
let OBRAS = [];
let DOCS = [];
let MUNI = null;

async function cargarDatosPublicos() {
    try {
        const [rT, rO, rD, rM] = await Promise.all([
            fetch('data/tramites.json'),
            fetch('data/obras.json'),
            fetch('data/documentos.json'),
            fetch('data/municipalidad.json')
        ]);
        TRAMITES = await rT.json();
        OBRAS = await rO.json();
        DOCS = await rD.json();
        MUNI = await rM.json();
    } catch (error) {
        console.warn('No se pudieron cargar las fuentes públicas:', error);
    }
}

const PALABRAS_VACIAS = new Set([
    'de', 'la', 'el', 'en', 'para', 'con', 'que', 'los', 'las', 'un', 'una', 'del', 'al', 'es', 'por',
    'como', 'hacer', 'necesito', 'quiero', 'sobre', 'cual', 'cuales', 'donde', 'cuanto', 'mas',
    'muy', 'sus', 'porfa', 'gracias', 'buenos', 'dias', 'tardes', 'chaski'
]);

function normalizar(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buscarTramites(consulta, maximo = 3) {
    if (!consulta) return [];
    const palabras = normalizar(consulta)
        .split(/[^a-z0-9]+/)
        .filter(p => p.length > 2 && !PALABRAS_VACIAS.has(p));
    if (palabras.length === 0) return [];

    const puntuados = TRAMITES
        .map(t => {
            const texto = normalizar(t.nombre + ' ' + (t.palabrasClave || []).join(' '));
            return { tramite: t, puntos: palabras.reduce((s, p) => s + (texto.includes(p) ? 1 : 0), 0) };
        })
        .filter(x => x.puntos > 0)
        .sort((a, b) => b.puntos - a.puntos);

    return puntuados.slice(0, maximo).map(x => x.tramite);
}

function tramitesComoContexto(lista) {
    if (!lista.length) return '';
    return 'TRÁMITES OFICIALES ENCONTRADOS (fuente: TUPA de la M.D. Río Negro — recomendar verificar vigencia en la municipalidad):\n' +
        lista.map(t =>
            `- ${t.nombre}: requisitos: ${(t.requisitos || []).join('; ')}. ` +
            `Costo: ${t.costo}. Plazo: ${t.plazo}. Área: ${t.area || 'no especificada'}.`
        ).join('\n');
}

// ----- Riesgo de obras (el módulo estrella) -----
function riesgoObra(obra) {
    const hoy = new Date();
    const inicio = new Date(obra.inicio);
    const meses = Math.max(0, (hoy - inicio) / (1000 * 60 * 60 * 24 * 30));
    const esperado = Math.min(100, (meses / obra.plazoMeses) * 100);
    const brecha = esperado - obra.avanceFisico;
    if (brecha > 15) return 'alto';
    if (brecha > 5) return 'medio';
    return 'bajo';
}

// Resumen municipal que Chaski "ve" en cada consulta
function situacionMunicipal() {
    if (!MUNI) return '';
    const lineas = [];
    if (MUNI.pim && MUNI.ejecutado !== null && MUNI.ejecutado !== undefined) {
        const pct = Math.round((MUNI.ejecutado / MUNI.pim) * 100);
        lineas.push(`SITUACIÓN MUNICIPAL: PIM ${MUNI.anioFiscal}: S/ ${MUNI.pim.toLocaleString('es-PE')}. Devengado: S/ ${MUNI.ejecutado.toLocaleString('es-PE')} (${pct}%).`);
    } else {
        lineas.push(`SITUACIÓN MUNICIPAL: el PIM y el devengado ${MUNI.anioFiscal} todavía no están cargados (pendientes de consultar en el MEF). No inventes esta cifra.`);
    }
    OBRAS.filter(o => o.estado === 'en-ejecucion').forEach(o => {
        lineas.push(`- Obra${o._ejemplo ? ' (EJEMPLO, no real)' : ''} "${o.nombre}": avance físico ${o.avanceFisico}%, presupuestal ${o.avancePresupuestal}%, riesgo ${riesgoObra(o)}.`);
    });
    return lineas.join('\n');
}