// ===== Registro del Service Worker =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .then(() => console.log('✅ Chaski: SW registrado'))
            .catch((error) => console.error('❌ Error SW:', error));
    });
}

// ===== Botón de instalación =====
let diferido = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    diferido = e;
    const btn = document.getElementById('btnInstalar');
    if (btn) btn.hidden = false;
});
document.getElementById('btnInstalar')?.addEventListener('click', async () => {
    if (!diferido) return;
    diferido.prompt();
    await diferido.userChoice;
    diferido = null;
    document.getElementById('btnInstalar').hidden = true;
});

// ===== Navegación del dashboard =====
const TITULOS = {
    vistaPanel: '📊 Panel de Gestión',
    vistaChat: '💬 Chaski — Asistente IA',
    vistaAgenda: '📅 Agenda Municipal',
    vistaObras: '🏗️ Obras y Presupuesto',
    vistaTramites: '📄 Trámites (TUPA)',
    vistaDocumentos: '📁 Documentos',
    vistaFuentes: '🌐 Fuentes de datos'
};

function mostrarVista(id) {
    document.querySelectorAll('.vista').forEach(v => { v.hidden = v.id !== id; });
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('activa', l.dataset.vista === id));
    document.getElementById('tituloVista').textContent = TITULOS[id] || 'Chaski';
}

document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-vista]');
    if (el) mostrarVista(el.dataset.vista);
});