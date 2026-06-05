/* ═══════════════════════════════════════════════════════════════════════
   theme.js — gestión de modo claro/oscuro (HANDOFF jun 2026)

   El tema se persiste en localStorage bajo 'pp_theme' ('light' | 'dark').
   Se aplica como atributo data-theme en <html> (también clase .dark por
   compatibilidad con selectores existentes). initTheme() debe llamarse
   ANTES del primer render (en main.jsx) para evitar flash de tema.

   Si el usuario nunca eligió, respetamos prefers-color-scheme del sistema.
   ═══════════════════════════════════════════════════════════════════════ */

const KEY = 'pp_theme';

export function getStoredTheme() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* localStorage bloqueado */ }
  return null;
}

export function getSystemTheme() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  } catch { return 'light'; }
}

export function getActiveTheme() {
  return getStoredTheme() || getSystemTheme();
}

/* Aplica el tema al documento. No persiste (eso lo hace setTheme). */
export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;
  root.setAttribute('data-theme', t);
  root.classList.toggle('dark', t === 'dark');
  /* meta theme-color para la barra del navegador móvil */
  try {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', t === 'dark' ? '#0E1413' : '#F6F7F4');
  } catch { /* no-op */ }
}

/* Persiste y aplica. Devuelve el tema aplicado. */
export function setTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  try { localStorage.setItem(KEY, t); } catch { /* no-op */ }
  applyTheme(t);
  /* Notificar a otros tabs y a los listeners del mismo tab */
  try { window.dispatchEvent(new CustomEvent('pp-theme-change', { detail: t })); } catch { /* no-op */ }
  return t;
}

export function toggleTheme() {
  const next = getActiveTheme() === 'dark' ? 'light' : 'dark';
  return setTheme(next);
}

/* Llamar UNA vez al boot, antes del render. */
export function initTheme() {
  applyTheme(getActiveTheme());
  /* Sincronizar entre pestañas: si otro tab cambia el tema, reflejarlo */
  try {
    window.addEventListener('storage', (e) => {
      if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        applyTheme(e.newValue);
        try { window.dispatchEvent(new CustomEvent('pp-theme-change', { detail: e.newValue })); } catch { /* no-op */ }
      }
    });
  } catch { /* no-op */ }
}
