// /api/consultar — Proxy a fuentes públicas de datos (con caché de 1 h y respaldo)
// El navegador NO puede consultar ciertos portales directamente (CORS): este proxy sí puede.
// Cuando encuentres el dataset presupuestal exacto de gobiernos locales en
// datosabiertos.gob.pe, guarda su URL "Data API" como variable de entorno
// MEF_DATASTORE_URL en Vercel y el presupuesto pasa a ser EN VIVO.

let cache = { ts: 0, datos: null };

async function buscarEnPortales() {
    // 1) Fuente configurada (dataset específico con filtro, si existe)
    const urlDirecta = process.env.MEF_DATASTORE_URL;
    if (urlDirecta) {
        try {
            const r = await fetch(urlDirecta, { signal: AbortSignal.timeout(6000) });
            if (r.ok) {
                const j = await r.json();
                const filas = j?.result?.records;
                if (filas && filas.length) return { filas };
            }
        } catch { /* seguimos al plan B */ }
    }

    // 2) Plan B: buscar datasets que mencionen al distrito en el portal nacional
    try {
        const r = await fetch(
            'https://datosabiertos.gob.pe/api/3/action/package_search?q=' +
            encodeURIComponent('Rio Negro Satipo') + '&rows=3',
            { signal: AbortSignal.timeout(6000) }
        );
        if (r.ok) {
            const j = await r.json();
            const datasets = (j?.result?.results || []).map(p => ({
                titulo: p.title,
                url: 'https://datosabiertos.gob.pe/dataset/' + p.name
            }));
            if (datasets.length) return { datasets };
        }
    } catch { /* sin conexión o caído: respaldo local */ }

    return null;
}

export default async function handler(request) {
    if (request.method !== 'GET') {
        return Response.json({ error: 'Método no permitido' }, { status: 405 });
    }

    if (cache.datos && Date.now() - cache.ts < 3600000) {
        return Response.json({ ...cache.datos, cache: true });
    }

    const hallado = await buscarEnPortales();

    const salida = hallado
        ? { fuente: 'live', actualizado: new Date().toISOString(), datos: hallado }
        : { fuente: 'local', actualizado: new Date().toISOString(), datos: null };

    cache = { ts: Date.now(), datos: salida };
    return Response.json(salida);
}