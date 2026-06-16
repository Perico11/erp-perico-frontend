import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { loadCachedBranding, loadBrandingFromServer } from './utils/brandingLoader.js'
import { initTheme } from './utils/theme.js'

/* HANDOFF jun 2026: inicializar tema claro/oscuro ANTES del render para
   evitar flash. Lee localStorage 'pp_theme' o cae a prefers-color-scheme. */
initTheme();

/* Aplicar branding cacheado de inmediato (evita flash de defaults) y luego
   refrescar desde el server (puede haber cambios). */
loadCachedBranding();
loadBrandingFromServer();

/* Imprime version del build en consola — verificable con F12 después de cada deploy.
   También expone window.__buildTime para test rápido en la consola. */
const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev';
console.log('%c[ERP Pinturas El Perico] build:', 'color:#5BB748;font-weight:bold', BUILD_TIME);
if (typeof window !== 'undefined') window.__buildTime = BUILD_TIME;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/* === Service Worker: SOLO push-sw.js (Web Push), limpiando el viejo sw.js ===
   Historial: el viejo sw.js (kill-switch/caché) hacía client.navigate() → loop
   infinito de reloads. Por eso se mató. AHORA registramos un SW NUEVO y
   distinto, push-sw.js, que SOLO maneja notificaciones push: no cachea, no
   intercepta fetch, no recarga en bucle. Sirve para que el teléfono reciba
   notificaciones con la app cerrada (jun 2026, pedido dueño).

   - Desregistramos cualquier SW que NO sea push-sw.js (mata el sw.js maldito
     que pudiera quedar de deploys viejos).
   - Limpiamos caches (push-sw no usa cache).
   - Registramos push-sw.js. La suscripción real ocurre después, cuando el
     usuario concede permiso (utils/webPush.js). */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        const sw = reg.active || reg.waiting || reg.installing;
        const url = sw ? sw.scriptURL : '';
        if (!url || url.indexOf('/push-sw.js') === -1) {
          reg.unregister().catch(() => {}); /* viejo sw.js → fuera */
        }
      });
    }).catch(() => {});

    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k).catch(() => {}));
      }).catch(() => {});
    }

    /* Registrar el SW de push (idempotente; no toca el render ni recarga). */
    navigator.serviceWorker.register('/push-sw.js', { scope: '/' }).catch(() => {});
  });
}
