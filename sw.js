const VERSION = 'chaski-v6';
// en RECURSOS agrega:
'/data/presupuesto_mef.json', '/js/mef.js'

const RECURSOS = [
    '/', '/index.html', '/manifest.json',
    '/css/style.css',
    '/js/app.js', '/js/bd.js', '/js/datos.js', '/js/panel.js', '/js/agendas.js', '/js/chat.js', '/js/tiemporeal.js',
    '/data/tramites.json', '/data/municipalidad.json', '/data/obras.json', '/data/documentos.json',
    '/icons/icon.svg'
];

self.addEventListener('install', (evento) => {
    evento.waitUntil(
        caches.open(VERSION)
            .then((cache) =>
                // tolerante: si un archivo falta (p.ej. logo.png), la instalación sigue
                Promise.all(RECURSOS.map(async (r) => { try { await cache.add(r); } catch (e) { } }))
            )
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (evento) => {
    evento.waitUntil(
        caches.keys()
            .then((claves) =>
                Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c)))
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (evento) => {
    if (evento.request.method !== 'GET') return;

    const url = new URL(evento.request.url);

    // REGLA CRÍTICA: nada de /api/ ni APIs externas se cachea (datos en vivo)
    if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return;

    evento.respondWith(
        fetch(evento.request)
            .then((respuesta) => {
                const copia = respuesta.clone();
                caches.open(VERSION).then((cache) => cache.put(evento.request, copia));
                return respuesta;
            })
            .catch(() => caches.match(evento.request))
    );
});