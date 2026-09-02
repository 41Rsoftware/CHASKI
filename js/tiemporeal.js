// ===== CHASKI · Módulo Tiempo Real =====
// Clima: Open-Meteo · Sismos: USGS · Presupuesto: /api/consultar (proxy)
// Todo gratuito, sin claves. El clima y sismos van directo del navegador (CORS abierto).

const COORD = { lat: -11.2461, lon: -74.5469 }; // Río Negro, Satipo

function haceCuanto(ms) {
    const min = Math.floor((Date.now() - ms) / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return 'hace ' + min + ' min';
    const h = Math.floor(min / 60);
    if (h < 24) return 'hace ' + h + ' h';
    return 'hace ' + Math.floor(h / 24) + ' d';
}

function descripcionClima(codigo) {
    if (codigo === 0) return '☀️ Despejado';
    if (codigo <= 2) return '🌤️ Parcialmente nublado';
    if (codigo === 3) return '☁️ Nublado';
    if (codigo >= 45 && codigo <= 48) return '🌫️ Neblina';
    if ((codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return '🌧️ Lluvia';
    if (codigo >= 95) return '⛈️ Tormenta';
    return '🌤️ Variable';
}

// ---------- CLIMA ----------
async function cargarClima() {
    const caja = document.getElementById('trClima');
    if (!caja) return;
    try {
        const r = await fetch(
            'https://api.open-meteo.com/v1/forecast?latitude=' + COORD.lat +
            '&longitude=' + COORD.lon +
            '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m' +
            '&timezone=America%2FLima'
        );
        const d = await r.json();
        const c = d.current;

        caja.innerHTML = `
      <span class="tr-temp">${Math.round(c.temperature_2m)}°C</span>
      <span class="tr-desc">${descripcionClima(c.weather_code)}</span>
      <div class="tr-detalles">
        <span>💧 ${c.relative_humidity_2m}%</span>
        <span>🌧️ ${c.precipitation} mm</span>
        <span>💨 ${Math.round(c.wind_speed_10m)} km/h</span>
      </div>
      <small class="tr-prov">Open-Meteo · ${haceCuanto(Date.parse(d.current.time + ':00Z')) || 'actualizado'}</small>`;
    } catch {
        caja.innerHTML = '<p class="tr-error">Clima no disponible sin conexión</p>';
    }
}

// ---------- SISMOS ----------
async function cargarSismos() {
    const lista = document.getElementById('trSismos');
    if (!lista) return;
    lista.innerHTML = '<li class="tr-error">Consultando USGS…</li>';
    try {
        const r = await fetch(
            'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
            '&latitude=' + COORD.lat + '&longitude=' + COORD.lon +
            '&maxradiuskm=700&limit=6&orderby=time'
        );
        const d = await r.json();
        lista.innerHTML = '';

        if (!d.features.length) {
            lista.innerHTML = '<li class="tr-error">Sin sismos registrados cerca. ✅</li>';
            return;
        }

        d.features.forEach(f => {
            const mag = f.properties.mag ?? 0;
            const li = document.createElement('li');
            li.className = 'sismo';
            li.innerHTML =
                '<span class="sismo-mag ' + (mag >= 5 ? 'mag-alta' : mag >= 4 ? 'mag-media' : 'mag-baja') + '">' +
                mag.toFixed(1) + '</span>' +
                '<span class="sismo-lugar">' + (f.properties.place || 'Perú') + '</span>' +
                '<span class="sismo-tiempo">' + haceCuanto(f.properties.time) + '</span>';
            lista.appendChild(li);
        });
    } catch {
        lista.innerHTML = '<li class="tr-error">USGS no disponible sin conexión</li>';
    }
}

// ---------- PRESUPUESTO (proxy con respaldo) ----------
async function cargarPresupuesto() {
    const caja = document.getElementById('trMef');
    if (!caja) return;
    try {
        const r = await fetch('/api/consultar', { cache: 'no-store' });
        const d = await r.json();

        if (d.fuente === 'live' && d.datos?.datasets?.length) {
            caja.innerHTML = `
        <span class="chip chip-ok">🟢 EN VIVO</span>
        <p class="tr-linea">Portal Nacional de Datos Abiertos:</p>
        ${d.datos.datasets.map(x =>
                '<a class="tr-enlace" href="' + x.url + '" target="_blank" rel="noopener">↗ ' + x.titulo + '</a>'
            ).join('')}`;
        } else if (d.fuente === 'live' && d.datos?.filas) {
            caja.innerHTML = '<span class="chip chip-ok">🟢 EN VIVO</span><p class="tr-linea">Datos presupuestales del MEF recibidos.</p>';
        } else {
            const fecha = MUNI ? MUNI.notaDatos : 'datos de ejemplo';
            const pimTxt = MUNI?.pim ? 'S/ ' + MUNI.pim.toLocaleString('es-PE') : 'Pendiente';
            const ejecTxt = (MUNI?.ejecutado !== null && MUNI?.ejecutado !== undefined) ? 'S/ ' + MUNI.ejecutado.toLocaleString('es-PE') : 'Pendiente';
            caja.innerHTML = `
        <span class="chip chip-pend">📍 SIN CONFIRMAR</span>
        <p class="tr-linea">PIM: ${pimTxt}</p>
        <p class="tr-linea">Devengado: ${ejecTxt}</p>
        <small class="tr-prov">${fecha}</small>`;
        }
    } catch {
        caja.innerHTML = '<p class="tr-error">Sin conexión con el servidor</p>';
    }
}

// ---------- Arranque ----------
document.addEventListener('DOMContentLoaded', () => {
    cargarClima();
    cargarSismos();
    cargarPresupuesto();
    setInterval(cargarClima, 10 * 60 * 1000);   // refresca clima cada 10 min
    setInterval(cargarSismos, 5 * 60 * 1000);   // sismos cada 5 min
});