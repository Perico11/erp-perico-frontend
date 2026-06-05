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

/* === Service Worker: CLEANUP MODE (sin registrar nuevo SW) ===
   ⚠️  BUG ANTERIOR: registrábamos sw.js en cada load → SW se activaba
       → SW hacía client.navigate() para recargar → al recargar volvíamos
       a registrar sw.js → loop infinito de refresh.

   ARREGLO: NO registramos ningún SW nuevo. Solo desregistramos los SW
   que pudieron quedar instalados de deploys anteriores, y limpiamos
   sus caches. Esta operación es idempotente y silenciosa (sin reload).

   Si un usuario tiene un SW viejo activo del deploy previo, este código
   lo elimina UNA vez y queda limpio para siempre. La página actual sigue
   funcionando con su SW viejo hasta el siguiente reload manual, después
   del cual ya no habrá SW. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    /* Desregistrar TODOS los SW de nuestro origen */
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        reg.unregister().catch(() => {});
      });
    }).catch(() => {});

    /* Limpiar TODOS los caches del navegador para nuestro origen */
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k).catch(() => {}));
      }).catch(() => {});
    }
  });
}
