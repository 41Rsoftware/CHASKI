// ===== CHASKI · Chat (cliente) =====
// Envía el mensaje a /api/chat (el backend protegido que guarda la clave de
// Groq). Si ese backend todavía no está desplegado en Vercel, lo avisa con
// honestidad en vez de inventar una respuesta como si fuera la IA real.

const contenedorMensajes = document.getElementById('mensajes');
const formChat = document.getElementById('formChat');
const campoTexto = document.getElementById('texto');
let historialChat = [];

function pintarMensajeChat(texto, rol) {
    const div = document.createElement('div');
    div.className = 'burbuja ' + (rol === 'usuario' ? 'usuario' : rol === 'error' ? 'error' : 'chaski');
    div.textContent = texto;
    contenedorMensajes.appendChild(div);
    contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
}

async function cargarHistorialChat() {
    const guardados = await cargarMensajes();
    guardados.forEach(m => pintarMensajeChat(m.texto, m.rol));
    if (!guardados.length) {
        pintarMensajeChat('Hola, soy Chaski. Pregúnteme sobre una obra, un trámite del TUPA o la agenda — reviso los datos reales que tenga cargados antes de responder.', 'bot');
    }
    historialChat = guardados.map(m => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto }));
}

formChat.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = campoTexto.value.trim();
    if (!texto) return;

    pintarMensajeChat(texto, 'usuario');
    await guardarMensaje({ rol: 'usuario', texto });
    historialChat.push({ role: 'user', content: texto });
    campoTexto.value = '';

    const btn = document.getElementById('btnEnviar');
    btn.disabled = true;

    // Contexto real: la situación municipal + los trámites que calzan con la pregunta
    const contexto = [
        typeof situacionMunicipal === 'function' ? situacionMunicipal() : '',
        typeof buscarTramites === 'function' ? tramitesComoContexto(buscarTramites(texto)) : ''
    ].filter(Boolean).join('\n\n');

    try {
        const r = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensajes: historialChat, contexto })
        });
        const d = await r.json();

        if (!r.ok) throw new Error(d.error || 'Error del servidor');

        pintarMensajeChat(d.respuesta, 'bot');
        await guardarMensaje({ rol: 'bot', texto: d.respuesta });
        historialChat.push({ role: 'assistant', content: d.respuesta });

    } catch (error) {
        const aviso = 'Todavía no estoy conectado al modelo (esto pasa si el sitio corre sin desplegar en Vercel, o falta la variable GROQ_API_KEY). Mientras tanto, puede revisar los datos directamente en las vistas de Obras, Trámites y Fuentes de datos.';
        pintarMensajeChat(aviso, 'error');
        await guardarMensaje({ rol: 'bot', texto: aviso });
    } finally {
        btn.disabled = false;
    }
});

document.addEventListener('DOMContentLoaded', cargarHistorialChat);
