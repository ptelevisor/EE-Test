// ============================================================
//  SERVICE WORKER COMPLETO - Envíos Extra Simulator
//  Versión: 2.0 - PWA Instalable
// ============================================================

const CACHE_NAME = 'envios-extra-v2';
const OFFLINE_URL = 'index.html';

// ========== RECURSOS A CACHEAR ==========
const urlsToCache = [
    './',
    'index.html',
    'manifest.json',
    'icon-192.png',
    'icon-512.png'
];

// ========== INSTALAR ==========
self.addEventListener('install', function(event) {
    console.log('[Service Worker] Instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('[Service Worker] Cacheando recursos');
                return cache.addAll(urlsToCache);
            })
            .then(function() {
                console.log('[Service Worker] Instalación completada');
                return self.skipWaiting();
            })
            .catch(function(error) {
                console.error('[Service Worker] Error en instalación:', error);
            })
    );
});

// ========== ACTIVAR ==========
self.addEventListener('activate', function(event) {
    console.log('[Service Worker] Activando...');
    
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Eliminando cache antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            console.log('[Service Worker] Activación completada');
            // Tomar control de todas las pestañas abiertas
            return self.clients.claim();
        })
    );
});

// ========== INTERCEPTAR SOLICITUDES ==========
self.addEventListener('fetch', function(event) {
    // Solo interceptar solicitudes GET
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Si está en cache, devolverlo
                if (response) {
                    console.log('[Service Worker] Cache hit:', event.request.url);
                    return response;
                }

                // Si no está en cache, buscar en red
                console.log('[Service Worker] Cache miss:', event.request.url);
                return fetch(event.request)
                    .then(function(networkResponse) {
                        // Verificar que sea una respuesta válida
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // Clonar la respuesta para cachear
                        const responseToCache = networkResponse.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch(function(error) {
                        console.error('[Service Worker] Error en fetch:', error);
                        // Si falla la red, intentar mostrar la página offline
                        return caches.match(OFFLINE_URL);
                    });
            })
    );
});

// ========== MANEJAR NOTIFICACIONES PUSH ==========
self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push recibido:', event);
    
    let title = '📦 Envíos Extra';
    let options = {
        body: 'Hay nuevos recorridos disponibles para ti',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'open',
                title: 'Abrir aplicación'
            },
            {
                action: 'dismiss',
                title: 'Descartar'
            }
        ]
    };

    // Si el push tiene datos personalizados
    if (event.data) {
        try {
            const pushData = event.data.json();
            if (pushData.title) title = pushData.title;
            if (pushData.body) options.body = pushData.body;
            if (pushData.icon) options.icon = pushData.icon;
        } catch (e) {
            // Si no es JSON, usar texto plano
            options.body = event.data.text() || options.body;
        }
    }

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ========== MANEJAR CLICK EN NOTIFICACIONES ==========
self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] Click en notificación:', event);
    
    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    // Abrir la aplicación
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function(windowClients) {
            // Si ya hay una ventana abierta, enfocarla
            for (let client of windowClients) {
                if (client.url === '/' || client.url.includes('index.html')) {
                    return client.focus();
                }
            }
            // Si no, abrir nueva
            return clients.openWindow('index.html?tasker=true');
        })
    );
});

// ========== MANEJAR MENSAJES ==========
self.addEventListener('message', function(event) {
    console.log('[Service Worker] Mensaje recibido:', event.data);
    
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(
            event.data.title || '📦 Envíos Extra',
            {
                body: event.data.body || 'Nueva notificación',
                icon: 'icon-192.png',
                badge: 'icon-192.png',
                vibrate: [200, 100, 200],
                data: event.data.data || {}
            }
        );
    }
});

// ========== PERIODIC SYNC (opcional) ==========
self.addEventListener('periodicsync', function(event) {
    console.log('[Service Worker] Sync periódico:', event.tag);
    
    if (event.tag === 'update-jobs') {
        event.waitUntil(
            // Aquí podrías actualizar los trabajos en segundo plano
            fetch('/api/jobs')
                .then(response => response.json())
                .then(data => {
                    console.log('[Service Worker] Trabajos actualizados:', data);
                })
                .catch(error => {
                    console.error('[Service Worker] Error al actualizar:', error);
                })
        );
    }
});

// ========== BACKGROUND SYNC ==========
self.addEventListener('sync', function(event) {
    console.log('[Service Worker] Sync:', event.tag);
    
    if (event.tag === 'sync-jobs') {
        event.waitUntil(
            // Sincronizar datos pendientes
            syncPendingData()
        );
    }
});

// Función para sincronizar datos pendientes
function syncPendingData() {
    return new Promise(function(resolve, reject) {
        // Aquí iría la lógica de sincronización
        console.log('[Service Worker] Sincronizando datos...');
        resolve();
    });
}

// ========== MANEJO DE ERRORES ==========
self.addEventListener('error', function(event) {
    console.error('[Service Worker] Error:', event.message);
});

// ========== LOG DE ESTADO ==========
console.log('[Service Worker] Cargado correctamente');
console.log(`[Service Worker] Cache: ${CACHE_NAME}`);
console.log('[Service Worker] Recursos cacheados:', urlsToCache);