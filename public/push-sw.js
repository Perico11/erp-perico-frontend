/* push-sw.js — Service Worker SOLO para Web Push (jun 2026).

   ⚠️ NO es el viejo sw.js (kill-switch / caché) que causó el loop de reloads.
   Este SW NO cachea, NO intercepta fetch y NO hace client.navigate() en bucle.
   Su único trabajo: recibir 'push' del servidor y mostrar la notificación —
   funciona aunque la app esté cerrada. Idempotente y silencioso. */

self.addEventListener('install', (event) => {
  self.skipWaiting(); /* activar de inmediato, sin esperar a cerrar pestañas */
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/* Llega un push del servidor → mostrar la notificación en la barra del teléfono. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    try { data = { title: 'Pinturas El Perico', body: event.data ? event.data.text() : '' }; } catch (_) {}
  }
  const title = data.title || 'Pinturas El Perico';
  const options = {
    body: data.body || '',
    tag: data.tag || 'pp-erp',          /* mismo tag = reemplaza, no apila */
    renotify: true,
    icon: '/logos/logo-perico-green.svg',
    badge: '/favicon.ico',
    data: { url: data.url || '/' },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* Tocar la notificación → enfocar la app si está abierta, o abrirla en la ruta. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        /* Si ya hay una ventana de la app abierta, enfocarla y navegar dentro. */
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) { try { client.navigate(url); } catch (e) {} }
          return;
        }
      }
      /* Si no hay ninguna abierta, abrir una nueva. */
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
