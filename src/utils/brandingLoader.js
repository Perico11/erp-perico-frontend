/**
 * Branding Loader — aplica los tokens CSS personalizados al :root.
 *
 * Se llama una vez al iniciar la app (desde main.jsx).
 * Lee /api/branding y aplica los overrides como CSS custom properties.
 * También escucha cambios en tiempo real via window event 'branding-updated'.
 */

const STORAGE_KEY = 'pp_branding_cache';

function applyBranding(data) {
  if (!data || typeof data !== 'object') return;
  const root = document.documentElement;
  if (data.brandColor)     root.style.setProperty('--lp-brand-600', data.brandColor);
  if (data.brandColorDark) root.style.setProperty('--lp-brand-700', data.brandColorDark);
  if (data.fontFamily) {
    /* Permitir nombre simple ("DM Sans") o stack ("DM Sans, sans-serif") */
    const stack = data.fontFamily.includes(',')
      ? data.fontFamily
      : `'${data.fontFamily}', system-ui, -apple-system, sans-serif`;
    root.style.setProperty('--lp-font-sans', stack);
  }
  if (data.fontSizeBase) root.style.fontSize = `${data.fontSizeBase}px`;
  if (data.radiusBase !== undefined) {
    root.style.setProperty('--lp-radius', `${data.radiusBase + 4}px`);
    root.style.setProperty('--lp-radius-sm', `${Math.max(2, data.radiusBase - 2)}px`);
    root.style.setProperty('--lp-radius-md', `${data.radiusBase + 2}px`);
    root.style.setProperty('--lp-radius-lg', `${data.radiusBase + 6}px`);
  }
  /* Guardar cache para que en próximos arranques no haya flash de defaults */
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
}

/* Aplicar de inmediato lo que esté en cache (evita FOUC mientras llega del server) */
export function loadCachedBranding() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) applyBranding(JSON.parse(raw));
  } catch(e) {}
}

/* Cargar desde el servidor y aplicar — llamar después del login o al boot */
export async function loadBrandingFromServer() {
  try {
    const res = await fetch('/api/branding', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.data) applyBranding(data.data);
  } catch(e) {
    /* offline / server down — usamos cache local */
  }
}

/* Escuchar evento personalizado para refrescar (admin actualiza tokens) */
if (typeof window !== 'undefined') {
  window.addEventListener('branding-updated', (e) => {
    if (e?.detail) applyBranding(e.detail);
    else loadBrandingFromServer();
  });
}
