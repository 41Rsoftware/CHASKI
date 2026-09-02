// ===== CHASKI · Base de datos local (IndexedDB vía Dexie.js) =====
// Los datos del usuario viven EN su dispositivo. Nada sale a servidores propios.

const bd = new Dexie('ChaskiBD');

bd.version(1).stores({
    // índices: fecha para consultar por día/rango; tipo para filtrar
    eventos: '++id, fecha, tipo',
    // historial de chat en orden
    mensajes: '++id'
});

// ----- Eventos -----
async function guardarEvento(evento) {
    return bd.eventos.add(evento); // {titulo, fecha, hora, tipo, notas}
}

async function eliminarEvento(id) {
    return bd.eventos.delete(id);
}

async function eventosDe(fechaISO) {
    return bd.eventos.where('fecha').equals(fechaISO).toArray();
}

async function eventosEntre(inicioISO, finISO) {
    // las fechas ISO (YYYY-MM-DD) ordenan alfabéticamente = orden cronológico
    return bd.eventos.where('fecha').between(inicioISO, finISO, true, true).toArray();
}

// ----- Chat persistente -----
async function guardarMensaje(mensaje) {
    return bd.mensajes.add({ ...mensaje, fecha: Date.now() });
}

async function cargarMensajes() {
    return bd.mensajes.orderBy('id').toArray();
}