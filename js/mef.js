// ===== CHASKI · Tabla de ejecución presupuestal (fuente MEF) =====
// Orden: 1) intenta /api/mef (EN VIVO) → 2) si falla, cae a
// data/presupuesto_mef.json (LOCAL). Muestra código único y SNIP de cada
// proyecto (auditable: cualquiera puede verificarlo en el PTE del MEF) y
// avisa si el MEF pagina los resultados y solo se cargó la primera página.

let PRESU_MEF = null;
let MEF_ES_LIVE = false;

async function cargarPresupuestoMEF() {
    try {
        const r = await fetch('/api/mef', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        const d = await r.json();
        if (d.fuente === 'live' && Array.isArray(d.filas) && d.filas.length) {
            PRESU_MEF = d;
            MEF_ES_LIVE = true;
            pintarTablaMEF();
            return;
        }
    } catch {
        // sin conexión con /api/mef (normal si esto corre fuera de Vercel)
    }

    try {
        const r = await fetch('data/presupuesto_mef.json');
        PRESU_MEF = await r.json();
        MEF_ES_LIVE = false;
    } catch {
        PRESU_MEF = null;
    }
    pintarTablaMEF();
}

function formatearSolesTabla(n) {
    if (n === null || n === undefined) return '—';
    return 'S/ ' + n.toLocaleString('es-PE');
}

// Evita que un texto que venga del MEF (o de un JSON mal cargado) se
// interprete como HTML al ponerlo en innerHTML.
function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

function chipEjecucion(pct) {
    if (pct >= 90) return '<span class="chip chip-ok">✔ Culminado</span>';
    if (pct >= 50) return '<span class="chip chip-bajo">En marcha</span>';
    if (pct >= 25) return '<span class="chip chip-medio">⚠ Lenta</span>';
    return '<span class="chip chip-alto">🚨 Crítica</span>';
}

function pintarTablaMEF() {
    const cont = document.getElementById('bloqueMef');
    if (!cont) return;

    if (!PRESU_MEF || !PRESU_MEF.filas || !PRESU_MEF.filas.length) {
        cont.innerHTML = '<p class="tr-error">Todavía no hay tabla presupuestal cargada (ni en vivo ni local). ' +
            'Corre <code>/api/mef?debug=1</code> y revisa qué encontró, o completa <code>data/presupuesto_mef.json</code> a mano.</p>';
        return;
    }

    const filas = PRESU_MEF.filas;
    const totalPim = PRESU_MEF.totalPim ?? filas.reduce((s, f) => s + (f.pim || 0), 0);
    const totalDev = PRESU_MEF.totalDevengado ?? filas.reduce((s, f) => s + (f.devengado || 0), 0);
    const pctTotal = totalPim ? Math.round((totalDev / totalPim) * 100) : 0;

    const filasHTML = filas.map(f => {
        const pct = f.pim ? Math.round(((f.devengado || 0) / f.pim) * 100) : 0;
        const color = pct < 25 ? 'critica' : pct < 50 ? 'lenta' : '';
        const codigoTxt = [f.codigo, f.snip].filter(Boolean).map(escaparHTML).join(' · ') || '—';
        return `
      <tr>
        <td class="celda-codigo"><small>${codigoTxt}</small></td>
        <td class="celda-proyecto">${escaparHTML(f.proyecto)}</td>
        <td class="celda-num">${formatearSolesTabla(f.pim)}</td>
        <td class="celda-num">${formatearSolesTabla(f.devengado)}</td>
        <td class="celda-pct">
          <div class="pct-barra"><span class="${color}" style="width:${pct}%"></span></div>
          <span class="pct-texto">${pct}%</span>
        </td>
        <td>${chipEjecucion(pct)}</td>
      </tr>`;
    }).join('');

    const badge = MEF_ES_LIVE
        ? '<span class="chip chip-ok">🟢 EN VIVO</span>'
        : '<span class="chip chip-pend">📍 LOCAL</span>';

    const avisoPaginacion = PRESU_MEF.soloPrimeraPagina
        ? `<p class="aviso-ejemplo">Mostrando solo la página ${PRESU_MEF.pagina || 1} de ${PRESU_MEF.paginasTotales} del MEF
           (${PRESU_MEF.totalRegistros || '?'} proyectos en total). El total de abajo es solo de esta página, no del distrito completo.</p>`
        : '';

    cont.innerHTML = `
    <div class="mef-head">
      <div>
        <h3>💰 Ejecución presupuestal por proyecto ${badge}</h3>
        <small>${escaparHTML(PRESU_MEF.unidadEjecutora)} · Periodo ${escaparHTML(String(PRESU_MEF.periodo))}</small>
      </div>
      ${PRESU_MEF.url ? `<a class="tr-enlace" href="${PRESU_MEF.url}" target="_blank" rel="noopener">↗ Verificar en el MEF</a>` : ''}
    </div>
    ${avisoPaginacion}
    <div class="tabla-scroll">
      <table class="tabla-mef">
        <thead>
          <tr>
            <th>Código · SNIP</th>
            <th>Proyecto de inversión</th>
            <th class="celda-num">PIM</th>
            <th class="celda-num">Devengado</th>
            <th>Ejecución</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>${filasHTML}</tbody>
        <tfoot>
          <tr>
            <td colspan="2"><strong>TOTAL${PRESU_MEF.soloPrimeraPagina ? ' (esta página)' : ''}</strong></td>
            <td class="celda-num"><strong>${formatearSolesTabla(totalPim)}</strong></td>
            <td class="celda-num"><strong>${formatearSolesTabla(totalDev)}</strong></td>
            <td class="celda-pct"><strong>${pctTotal}%</strong></td>
            <td>${chipEjecucion(pctTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <small class="tr-prov">Actualizado (fecha oficial del MEF): ${escaparHTML(PRESU_MEF.actualizado || '—')}${PRESU_MEF.motivo ? ' · ' + escaparHTML(PRESU_MEF.motivo) : ''}</small>`;
}

document.addEventListener('DOMContentLoaded', cargarPresupuestoMEF);