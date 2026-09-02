// ===== CHASKI · Panel de gestión y vistas de datos =====

function formatearSoles(n) {
    if (!n && n !== 0) return '—';
    if (n >= 1e6) return 'S/ ' + (n / 1e6).toFixed(1).replace('.', ',') + ' M';
    if (n >= 1e3) return 'S/ ' + (n / 1e3).toFixed(0) + ' mil';
    return 'S/ ' + n;
}

function aISOLocalPanel(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const ETIQUETA_ESTADO = { 'en-ejecucion': 'En ejecución', 'culminada': 'Culminada', 'en-licitacion': 'En licitación', 'paralizada': 'Paralizada' };
const ETIQUETA_DOC = { verificado: '✔ Verificado', pendiente: '⏳ Pendiente de revisión' };

// ---------- PANEL ----------
async function pintarPanel() {
    if (!MUNI) return;

    const presupuestoListo = MUNI.pim && MUNI.ejecutado !== null && MUNI.ejecutado !== undefined;
    const pctEjec = presupuestoListo ? Math.round((MUNI.ejecutado / MUNI.pim) * 100) : null;

    // Agenda próximos 7 días
    const hoy = new Date();
    const en7 = new Date(); en7.setDate(en7.getDate() + 7);
    const proximos = await eventosEntre(aISOLocalPanel(hoy), aISOLocalPanel(en7));

    const enEjecucion = OBRAS.filter(o => o.estado === 'en-ejecucion');
    const alertas = enEjecucion
        .map(o => ({ obra: o, riesgo: riesgoObra(o) }))
        .filter(x => x.riesgo !== 'bajo')
        .sort((a, b) => (b.riesgo === 'alto') - (a.riesgo === 'alto'));

    // ---- Tarjetas de estadísticas ----
    const stats = [
        { etiqueta: 'PIM ' + MUNI.anioFiscal, valor: formatearSoles(MUNI.pim), sub: 'Presupuesto institucional' },
        presupuestoListo
            ? { etiqueta: 'Ejecutado', valor: pctEjec + '%', sub: formatearSoles(MUNI.ejecutado), barra: pctEjec }
            : { etiqueta: 'Ejecutado', valor: 'Pendiente', sub: 'consultar en MEF', vista: 'vistaFuentes' },
        { etiqueta: 'Obras', valor: OBRAS.length, sub: enEjecucion.length + ' en ejecución', vista: 'vistaObras' },
        { etiqueta: 'Trámites', valor: TRAMITES.length, sub: 'registrados en el TUPA', vista: 'vistaTramites' },
        { etiqueta: 'Agenda', valor: proximos.length, sub: 'eventos próximos 7 días', vista: 'vistaAgenda' },
        { etiqueta: 'Alertas', valor: alertas.length, sub: 'obras en riesgo', vista: 'vistaObras', alerta: true }
    ];

    const contStats = document.getElementById('statsPanel');
    contStats.innerHTML = '';
    stats.forEach(s => {
        const card = document.createElement(s.vista ? 'button' : 'div');
        card.className = 'stat' + (s.alerta && s.valor > 0 ? ' stat-alerta' : '');
        if (s.vista) { card.type = 'button'; card.dataset.vista = s.vista; }
        card.append(Object.assign(document.createElement('span'), { className: 'stat-etiqueta', textContent: s.etiqueta }));
        card.append(Object.assign(document.createElement('strong'), { className: 'stat-valor', textContent: String(s.valor) }));
        if (s.barra !== undefined) {
            const barra = document.createElement('div');
            barra.className = 'stat-barra';
            const relleno = document.createElement('span');
            relleno.style.width = s.barra + '%';
            if (s.barra < 40) relleno.classList.add('baja');
            barra.appendChild(relleno);
            card.appendChild(barra);
        }
        card.append(Object.assign(document.createElement('small'), { textContent: s.sub }));
        contStats.appendChild(card);
    });

    // ---- Cabecera de entidad ----
    document.getElementById('entidadNombre').textContent = MUNI.nombre;
    document.getElementById('entidadUbicacion').textContent = MUNI.ubigeo;
    document.getElementById('entidadAlcalde').textContent = 'Alcalde: ' + MUNI.alcalde;

    // ---- Lista: agenda próxima ----
    const listaAgenda = document.getElementById('panelAgenda');
    listaAgenda.innerHTML = '';
    if (proximos.length === 0) {
        listaAgenda.append(Object.assign(document.createElement('li'), { className: 'vacio', textContent: 'Sin eventos en los próximos 7 días.' }));
    } else {
        proximos.slice(0, 5).forEach(ev => {
            const li = document.createElement('li');
            li.append(Object.assign(document.createElement('strong'), { textContent: (ev.hora ? ev.hora + ' · ' : '') + ev.titulo }));
            li.append(Object.assign(document.createElement('small'), { textContent: ev.fecha }));
            listaAgenda.appendChild(li);
        });
    }

    // ---- Lista: obras en riesgo ----
    const listaAlertas = document.getElementById('panelAlertas');
    listaAlertas.innerHTML = '';
    if (alertas.length === 0) {
        listaAlertas.append(Object.assign(document.createElement('li'), { className: 'vacio', textContent: 'Sin obras en riesgo. ✅' }));
    } else {
        alertas.slice(0, 4).forEach(a => {
            const li = document.createElement('li');
            li.className = 'alerta-item riesgo-' + a.riesgo;
            li.append(Object.assign(document.createElement('span'), { className: 'chip chip-' + a.riesgo, textContent: a.riesgo === 'alto' ? 'RIESGO ALTO' : 'RIESGO MEDIO' }));
            li.append(Object.assign(document.createElement('span'), { textContent: a.obra.nombre + ' — avance ' + a.obra.avanceFisico + '%' }));
            listaAlertas.appendChild(li);
        });
    }

    // ---- Información municipal ----
    const info = document.getElementById('panelInfo');
    info.innerHTML = '';
    const filas = [
        ['Dirección', MUNI.contacto.direccion], ['Teléfono', MUNI.contacto.telefono],
        ['Correo', MUNI.contacto.correo], ['Portal', MUNI.contacto.web]
    ];
    filas.forEach(([k, v]) => {
        const div = document.createElement('div');
        div.className = 'info-fila';
        div.append(Object.assign(document.createElement('dt'), { textContent: k }));
        div.append(Object.assign(document.createElement('dd'), { textContent: v }));
        info.appendChild(div);
    });

    // ---- Documentos (resumen) ----
    const docs = document.getElementById('panelDocs');
    docs.innerHTML = '';
    DOCS.slice(0, 4).forEach(d => docs.appendChild(filaDocumento(d)));

    // ---- Badge de alertas en el sidebar ----
    const badge = document.getElementById('badgeAlertas');
    badge.textContent = alertas.length;
    badge.style.display = alertas.length > 0 ? '' : 'none';
}

function filaDocumento(d) {
    const fila = document.createElement('div');
    fila.className = 'doc-fila';
    const izq = document.createElement('div');
    if (d.url) {
        const enlace = document.createElement('a');
        enlace.href = d.url; enlace.target = '_blank'; enlace.rel = 'noopener';
        enlace.className = 'tr-enlace-inline';
        enlace.textContent = d.nombre + ' ↗';
        izq.appendChild(enlace);
    } else {
        izq.append(Object.assign(document.createElement('strong'), { textContent: d.nombre }));
    }
    izq.append(Object.assign(document.createElement('small'), { textContent: d.tipo }));
    fila.appendChild(izq);
    fila.append(Object.assign(document.createElement('span'), { className: 'chip ' + (d.estado === 'verificado' ? 'chip-ok' : 'chip-pend'), textContent: ETIQUETA_DOC[d.estado] || d.estado }));
    return fila;
}

// ---------- OBRAS ----------
function pintarObras() {
    const cont = document.getElementById('listaObras');
    cont.innerHTML = '';
    OBRAS.forEach(o => {
        const riesgo = o.estado === 'en-ejecucion' ? riesgoObra(o) : 'bajo';
        const card = document.createElement('article');
        card.className = 'obra';

        const cab = document.createElement('header');
        cab.append(Object.assign(document.createElement('h3'), { textContent: o.nombre }));
        const chips = document.createElement('div');
        chips.className = 'obra-chips';
        chips.append(Object.assign(document.createElement('span'), { className: 'chip chip-neutro', textContent: ETIQUETA_ESTADO[o.estado] || o.estado }));
        if (o.estado === 'en-ejecucion') {
            chips.append(Object.assign(document.createElement('span'), { className: 'chip chip-' + riesgo, textContent: 'Riesgo ' + riesgo }));
        }
        cab.appendChild(chips);
        card.appendChild(cab);

        const meta = document.createElement('p');
        meta.className = 'obra-meta';
        meta.textContent = formatearSoles(o.monto) + ' · ' + o.area + ' · inicio ' + o.inicio + ' · plazo ' + o.plazoMeses + ' meses';
        card.appendChild(meta);

        card.appendChild(barraProgreso('Avance físico', o.avanceFisico));
        card.appendChild(barraProgreso('Avance presupuestal', o.avancePresupuestal));

        cont.appendChild(card);
    });
}

function barraProgreso(etiqueta, valor) {
    const wrap = document.createElement('div');
    wrap.className = 'progreso';
    const head = document.createElement('div');
    head.className = 'progreso-head';
    head.append(Object.assign(document.createElement('span'), { textContent: etiqueta }));
    head.append(Object.assign(document.createElement('span'), { textContent: valor + '%' }));
    wrap.appendChild(head);
    const pista = document.createElement('div');
    pista.className = 'progreso-pista';
    const relleno = document.createElement('span');
    relleno.style.width = valor + '%';
    if (valor < 40) relleno.classList.add('baja');
    pista.appendChild(relleno);
    wrap.appendChild(pista);
    return wrap;
}

// ---------- TRÁMITES ----------
function pintarTramites() {
    const cont = document.getElementById('listaTramites');
    cont.innerHTML = '';
    TRAMITES.forEach(t => {
        const card = document.createElement('article');
        card.className = 'tramite';
        card.append(Object.assign(document.createElement('h3'), { textContent: t.nombre }));

        const chips = document.createElement('div');
        chips.className = 'obra-chips';
        chips.append(Object.assign(document.createElement('span'), { className: 'chip chip-neutro', textContent: '⏱ ' + t.plazo }));
        chips.append(Object.assign(document.createElement('span'), { className: 'chip chip-neutro', textContent: '🏛 ' + t.area }));
        card.appendChild(chips);

        const req = document.createElement('ul');
        req.className = 'requisitos';
        (t.requisitos || []).forEach(r => req.append(Object.assign(document.createElement('li'), { textContent: r })));
        card.appendChild(req);

        const pie = document.createElement('p');
        pie.className = 'obra-meta';
        if (t.fuenteURL) {
            pie.innerHTML = 'Costo: ' + t.costo + ' · Fuente: <a class="tr-enlace-inline" href="' + t.fuenteURL + '" target="_blank" rel="noopener">' + t.fuente + '</a>';
        } else {
            pie.textContent = 'Costo: ' + t.costo + ' · Fuente: ' + t.fuente;
        }
        card.appendChild(pie);

        cont.appendChild(card);
    });
}

// ---------- DOCUMENTOS ----------
function pintarDocumentos() {
    const cont = document.getElementById('listaDocumentos');
    cont.innerHTML = '';
    DOCS.forEach(d => cont.appendChild(filaDocumento(d)));
}

// ---------- FUENTES DE DATOS ----------
function pintarFuentes() {
    if (!MUNI) return;

    const t = MUNI.transparencia || {};
    const contactos = document.getElementById('fuentesContactos');
    if (contactos) {
        contactos.innerHTML = '';
        const filas = [
            ['Alcalde', MUNI.alcalde],
            ['Responsable Portal de Transparencia', t.responsablePortal + ' — ' + t.correoPortal + ' — ' + t.telefonoPortal],
            ['Responsable de acceso a la información', t.responsableAccesoInformacion + ' — ' + t.correoAccesoInformacion + ' — ' + t.telefonoAccesoInformacion]
        ];
        filas.forEach(([k, v]) => {
            const div = document.createElement('div');
            div.className = 'info-fila';
            div.append(Object.assign(document.createElement('dt'), { textContent: k }));
            div.append(Object.assign(document.createElement('dd'), { textContent: v }));
            contactos.appendChild(div);
        });
        const nota = document.createElement('p');
        nota.className = 'obra-meta';
        nota.textContent = 'Fuente: ' + (t.fuente || 'Portal de Transparencia Estándar');
        contactos.appendChild(nota);
    }

    const lista = document.getElementById('listaFuentes');
    if (lista && MUNI.fuentes) {
        const etiquetas = {
            mefUnidadEjecutora: 'MEF — Unidad ejecutora (Río Negro)',
            mefConsultaAmigable: 'MEF — Consulta Amigable',
            tupa2026: 'TUPA 2026 — Texto Único de Procedimientos',
            portalTransparencia: 'Portal de Transparencia — enlaces',
            presupuestoTransparencia: 'Portal de Transparencia — presupuesto',
            proyectosInfobras: 'Portal de Transparencia — proyectos / Infobras',
            datosAbiertosMEF: 'Plataforma Nacional de Datos Abiertos'
        };
        lista.innerHTML = '';
        Object.entries(MUNI.fuentes).forEach(([clave, url]) => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = url; a.target = '_blank'; a.rel = 'noopener';
            a.textContent = (etiquetas[clave] || clave) + ' ↗';
            li.appendChild(a);
            lista.appendChild(li);
        });
    }
}

// ---------- Inicio (tras cargar todo) ----------
document.addEventListener('DOMContentLoaded', async () => {
    await cargarDatosPublicos();
    pintarPanel();
    pintarObras();
    pintarTramites();
    pintarDocumentos();
    pintarFuentes();
});