const CACHE_NAME = 'sitoc-epcc-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './app.js',
  './styles.css',
  './icon.svg'
];

// Instalar el Service Worker y guardar los archivos en la caché interna
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('📦 Caché del sistema SITOC activada con éxito');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activar y limpiar cachés antiguas si las hay
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('🧹 Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de Red: Intentar ir a internet, si falla, usar la copia de la caché
self.addEventListener('fetch', event => {
    // 1. Si la petición va a n8n, la ignoramos y dejamos que el navegador 
    // la maneje normalmente (sin pasar por el Service Worker)
    if (event.request.url.includes('n8n.cloud')) {
        return; // Esto permite que la petición salga a internet libremente
    }
    
    // 2. Si el usuario busca index.html o la raíz — Network First, fallback a caché
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(function () {
                return caches.match('./index.html');
            })
        );
        return;
    }

    // 3. Estrategia Stale-While-Revalidate para assets estáticos
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            var fetchPromise = fetch(event.request).then(function (response) {
                return caches.open(CACHE_NAME).then(function (cache) {
                    if (event.request.url.startsWith(self.location.origin)) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                });
            }).catch(function () {
                return cached;
            });
            return cached || fetchPromise;
        })
    );
});