/* ═══════════════════════════════════════════════════════════════════
   SERVICE WORKER — KILL SWITCH v2 (sin loop de reload)
   ═══════════════════════════════════════════════════════════════════
   Este SW NO cachea nada. Su único trabajo es:
   1. Borrar TODOS los caches anteriores (rotos por deploys previos)
   2. Desregistrarse a sí mismo

   NO hace `client.navigate()` — eso causaba un loop infinito de refresh
   porque main.jsx vuelve a registrar el SW en cada load → SW vuelve a
   activarse → recarga la tab → loop.

   Ahora el cleanup es silencioso. La siguiente navegación del usuario
   (o cualquier fetch posterior) ya va sin SW interceptando, porque
   `unregister()` ya corrió. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Borrar TODOS los caches que existan
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));

      // 2. Tomar control de las tabs abiertas
      await self.clients.claim();

      // 3. Desregistrarse a sí mismo
      await self.registration.unregister();

      // 4. NO recargar tabs — eso causaba loop infinito.
      //    El usuario verá la página actual normal. La próxima vez que
      //    visite, ya no habrá SW activo.
    })()
  );
});

// NO interceptar ningún fetch — todo va directo a red
self.addEventListener('fetch', () => {
  // dejar pasar al navegador (no llamamos a event.respondWith)
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
