// ===== CHASKI · Calendario =====
// (la navegación entre vistas la maneja app.js — aquí solo el calendario)
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const NOMBRES_TIPO = {
    obra: '🏗️ Obra', reunion: '👥 Reunión', tramite: '📄 Trámite',
    recordatorio: '⏰ Recordatorio', otro: '📌 Otro'
};

let vistaActual = new Date();
let diaSeleccionado = aISOLocal(new Date());

function aISOLocal(d) {
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function fechaBonita(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return d + ' de ' + MESES[m - 1] + ' de ' + y;
}

// días de la semana (se pinta una sola vez)
document.getElementById('diasSemana').innerHTML = DIAS
    .map(d => `<span>${d}</span>`).join('');

async function pintarCalendario() {
    const y = vistaActual.getFullYear();
    const m = vistaActual.getMonth();
    document.getElementById('tituloMes').textContent = MESES[m] + ' ' + y;

    const primerDia = new Date(y, m, 1);
    const ultimoDia = new Date(y, m + 1, 0);
    const hoyISO = aISOLocal(new Date());

    // eventos del mes → conteo por fecha
    const eventosMes = await eventosEntre(aISOLocal(primerDia), aISOLocal(ultimoDia));
    const conteo = {};
    eventosMes.forEach(ev => { conteo[ev.fecha] = (conteo[ev.fecha] || 0) + 1; });

    const cuadricula = document.getElementById('cuadriculaDias');
    cuadricula.innerHTML = '';

    // hueco para que la semana empiece en lunes
    const hueco = (primerDia.getDay() + 6) % 7;
    for (let i = 0; i < hueco; i++) cuadricula.appendChild(document.createElement('span'));

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
        const iso = aISOLocal(new Date(y, m, d));
        const celda = document.createElement('button');
        celda.type = 'button';
        celda.className = 'dia';
        celda.textContent = d;
        if (iso === hoyISO) celda.classList.add('hoy');
        if (iso === diaSeleccionado) celda.classList.add('seleccionado');
        if (conteo[iso]) celda.classList.add('con-eventos');

        celda.addEventListener('click', () => {
            diaSeleccionado = iso;
            pintarCalendario();
            pintarDia();
        });
        cuadricula.appendChild(celda);
    }
}

async function pintarDia() {
    document.getElementById('tituloDia').textContent = fechaBonita(diaSeleccionado);

    const lista = document.getElementById('listaEventos');
    lista.innerHTML = '';
    const eventos = await eventosDe(diaSeleccionado);

    if (eventos.length === 0) {
        const vacio = document.createElement('li');
        vacio.className = 'evento-vacio';
        vacio.textContent = 'Sin eventos este día.';
        lista.appendChild(vacio);
        return;
    }

    eventos.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'));

    eventos.forEach(ev => {
        const li = document.createElement('li');
        li.className = 'evento tipo-' + ev.tipo;

        const info = document.createElement('div');
        info.className = 'evento-info';
        const titulo = document.createElement('strong');
        titulo.textContent = (ev.hora ? ev.hora + ' · ' : '') + ev.titulo;
        const meta = document.createElement('small');
        meta.textContent = (NOMBRES_TIPO[ev.tipo] || ev.tipo) + (ev.notas ? ' — ' + ev.notas : '');
        info.append(titulo, meta);

        const btnBorrar = document.createElement('button');
        btnBorrar.className = 'btn-borrar';
        btnBorrar.textContent = '🗑';
        btnBorrar.title = 'Eliminar evento';
        btnBorrar.addEventListener('click', async () => {
            await eliminarEvento(ev.id);
            pintarCalendario();
            pintarDia();
        });

        li.append(info, btnBorrar);
        lista.appendChild(li);
    });
}

// ----- Modal: nuevo evento -----
const modal = document.getElementById('modalEvento');

document.getElementById('btnNuevoEvento').addEventListener('click', () => {
    document.getElementById('evFecha').value = diaSeleccionado;
    modal.showModal();
});

document.getElementById('btnCancelarEvento').addEventListener('click', () => modal.close());

document.getElementById('formEvento').addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarEvento({
        titulo: document.getElementById('evTitulo').value.trim(),
        fecha: document.getElementById('evFecha').value,
        hora: document.getElementById('evHora').value || '',
        tipo: document.getElementById('evTipo').value,
        notas: document.getElementById('evNotas').value.trim()
    });
    modal.close();
    e.target.reset();
    document.getElementById('evFecha').value = diaSeleccionado;
    pintarCalendario();
    pintarDia();
});

// ----- Navegación de meses -----
document.getElementById('mesAnterior').addEventListener('click', () => {
    vistaActual = new Date(vistaActual.getFullYear(), vistaActual.getMonth() - 1, 1);
    pintarCalendario();
});
document.getElementById('mesSiguiente').addEventListener('click', () => {
    vistaActual = new Date(vistaActual.getFullYear(), vistaActual.getMonth() + 1, 1);
    pintarCalendario();
});

// Inicializar
pintarCalendario();
pintarDia();