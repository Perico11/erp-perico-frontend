import { useEffect, useState, useRef } from 'react';

/**
 * VersionChecker — detecta cuándo hay una versión nueva del frontend desplegada
 * y ACTUALIZA al usuario automáticamente (no depende de que haga click).
 *
 * Por qué: la app es una SPA. Un usuario que la dejó abierta navega por dentro
 * (routing del cliente) y NUNCA hace una recarga completa, así que jamás baja el
 * bundle nuevo. Resultado: solo quien recarga a mano ve los cambios. Esto causa
 * que "solo Emmanuel" vea el rediseño y el resto siga con la imagen vieja.
 *
 * Cómo funciona ahora:
 * 1. Al montar lee el hash del bundle principal cargado (index-XXX.js del DOM).
 * 2. Chequea /api/version: al inicio, cada 2 min, al volver el foco y al volver
 *    la pestaña a visible (visibilitychange — el evento confiable en móvil).
 * 3. Si el hash del servidor difiere del local → hay deploy nuevo.
 * 4. AUTO-RECARGA en el primer momento SEGURO: cuando la pestaña/app vuelve a
 *    estar visible (el usuario regresó — no está tecleando). Mientras tanto
 *    muestra un banner verde con botón "Actualizar" por si quiere hacerlo ya.
 * 5. Guard anti-loop con sessionStorage: nunca recarga dos veces por el mismo hash.
 */

function getCurrentBundleHash() {
  try {
    const scripts = document.querySelectorAll('script[src]');
    for (const s of scripts) {
      const src = s.getAttribute('src') || '';
      const m = src.match(/\/assets\/index-([A-Za-z0-9_-]+)\.js/);
      if (m) return m[1];
    }
  } catch {}
  return null;
}

const CHECK_INTERVAL_MS = 2 * 60 * 1000; /* 2 minutos */
const RELOADED_KEY = 'pp_reloaded_for_hash';

export default function VersionChecker() {
  const [nuevaVersion, setNuevaVersion] = useState(false);
  const myHashRef = useRef(getCurrentBundleHash());
  const pendingHashRef = useRef(null);

  useEffect(() => {
    /* Sin hash local (Vite dev sin assets hasheados) → no chequear. */
    if (!myHashRef.current) return;

    let cancelled = false;

    /* Recarga UNA sola vez por hash destino (evita loops si una capa de caché
       siguiera devolviendo el bundle viejo tras recargar). */
    const reloadOnce = (hash) => {
      try {
        if (sessionStorage.getItem(RELOADED_KEY) === hash) return false;
        sessionStorage.setItem(RELOADED_KEY, hash);
      } catch {}
      window.location.reload();
      return true;
    };

    const check = async ({ autoReload = false } = {}) => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data && data.hash && data.hash !== myHashRef.current) {
          pendingHashRef.current = data.hash;
          setNuevaVersion(true);
          /* Momento seguro (volvió el foco/visibilidad): recargar solo. */
          if (autoReload && document.visibilityState === 'visible') {
            reloadOnce(data.hash);
          }
        }
      } catch { /* offline / server down: ignorar */ }
    };

    /* Chequeo inmediato: atrapa a quien ya tenía abierta una versión vieja. */
    check({ autoReload: false });

    const timer = setInterval(() => check({ autoReload: true }), CHECK_INTERVAL_MS);

    /* Al volver a foco / visibilidad: re-chequear y auto-recargar si hay deploy. */
    const onFocus = () => check({ autoReload: true });
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      /* Si ya sabíamos de una versión nueva, recargar de inmediato (momento seguro);
         si no, chequear y recargar si aplica. */
      if (pendingHashRef.current) reloadOnce(pendingHashRef.current);
      else check({ autoReload: true });
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!nuevaVersion) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        left: '50%', transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, var(--lp-brand-600) 0%, var(--lp-brand-700) 100%)',
        color: '#fff', padding: '11px 16px', borderRadius: 14,
        boxShadow: '0 8px 28px -8px rgba(22,163,74,.5), 0 2px 8px rgba(0,0,0,.12)',
        display: 'flex', alignItems: 'center', gap: 11,
        fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 600,
        zIndex: 9999, width: 'max-content', maxWidth: '92vw',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
      </svg>
      <span>Nueva versión disponible</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: 'rgba(255,255,255,.96)', color: 'var(--lp-brand-700)', border: 'none',
          padding: '6px 14px', borderRadius: 9, fontWeight: 700, fontSize: 12.5,
          cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, minHeight: 32,
          boxShadow: '0 1px 3px rgba(0,0,0,.1)',
        }}
      >
        Actualizar
      </button>
    </div>
  );
}
