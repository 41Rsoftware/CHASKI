// ===== CHASKI · Tabla de ejecución presupuestal (fuente MEF) =====

let PRESU_MEF = null;

async function cargarPresupuestoMEF() {
  try {
    const r = await fetch('data/presupuesto_mef.json');
    PRESU_MEF = await r.json();
  } catch {
    PRESU_MEF = null;
  }
  pintarTablaMEF();
}

function formatearSolesTabla(n) {
  return 'S/ ' + n.toLocaleString('es-PE');
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

  if (!PRESU_MEF) {
    cont.innerHTML = '<p class="tr-error">No se pudo cargar la tabla presupuestal.</p>';
    return;
  }

  const filas = PRESU_MEF.filas;
  const totalPim = filas.reduce((s, f) => s + f.pim, 0);
  const totalDev = filas.reduce((s, f) => s + f.devengado, 0);
  const pctTotal = totalPim ? Math.round((totalDev / totalPim) * 100) : 0;

  const filasHTML = filas.map(f => {
    const pct = f.pim ? Math.round((f.devengado / f.pim) * 100) : 0;
    const color = pct < 25 ? 'critica' : pct < 50 ? 'lenta' : '';
    return `
      <tr>
        <td class="celda-proyecto">${f.proyecto}</td>
        <td class="celda-num">${formatearSolesTabla(f.pim)}</td>
        <td class="celda-num">${formatearSolesTabla(f.devengado)}</td>
        <td class="celda-pct">
          <div class="pct-barra"><span class="${color}" style="width:${pct}%"></span></div>
          <span class="pct-texto">${pct}%</span>
        </td>
        <td>${chipEjecucion(pct)}</td>
      </tr>`;
  }).join('');

  cont.innerHTML = `
    <div class="mef-head">
      <div>
        <h3>💰 Ejecución presupuestal por proyecto</h3>
        <small>${PRESU_MEF.unidadEjecutora} · Periodo ${PRESU_MEF.periodo}</small>
      </div>
      <a class="tr-enlace" href="${PRESU_MEF.url}" target="_blank" rel="noopener">↗ Verificar en el MEF</a>
    </div>
    <div class="tabla-scroll">
      <table class="tabla-mef">
        <thead>
          <tr>
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
            <td><strong>TOTAL</strong></td>
            <td class="celda-num"><strong>${formatearSolesTabla(totalPim)}</strong></td>
            <td class="celda-num"><strong>${formatearSolesTabla(totalDev)}</strong></td>
            <td class="celda-pct"><strong>${pctTotal}%</strong></td>
            <td>${chipEjecucion(pctTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <small class="tr-prov">📍 LOCAL · Actualizado: ${PRESU_MEF.actualizado} · Fuente: ${PRESU_MEF.fuente}</small>`;
}

document.addEventListener('DOMContentLoaded', cargarPresupuestoMEF);