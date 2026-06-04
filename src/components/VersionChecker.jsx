import { useEffect, useState, useRef } from 'react';

/**
 * VersionChecker — detecta cuándo hay una versión nueva del frontend en el
 * servidor y muestra un banner pidiendo al usuario que recargue.
 *
 * Evita el incidente del 11-mayo-2026 donde los usuarios quedaron con caché
 * vieja después de un deploy y veían pantalla blanca. Ahora reciben aviso.
 *
 * Cómo funciona:
 * 1. Al montar lee el hash actual del bundle (extraído del propio bundle URL)
 * 2. Cada 5 minutos hace fetch a /api/version
 * 3. Si el hash del servidor difiere del local → muestra banner
 * 4. Click en "Actualizar" → window.location.reload(true)
 */

/* Extrae el hash del bundle principal cargado actualmente.
   Busca el <script src="/assets/index-XXX.js"> en el DOM. */
function getCurrentBundleHash() {
  try {
    const scripts = document.querySelectorAll('script[src]');
    for (const s of scripts) {
      const src = s.getAttribute('src') || '';
      const m = src.match(/\/assets\/index-([A-Za-z0-9_-]+)\.js/);
      if (m) return m[1];
    }
  } catch (e) {}
  return null;
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000; /* 5 minutos */

export default function VersionChecker() {
  const [nuevaVersion, setNuevaVersion] = useState(false);
  const myHashRef = useRef(getCurrentBundleHash());

  useEffect(() => {
    /* Si no detectamos hash local (Vite dev mode, sin assets), no chequear */
    if (!myHashRef.current) return;

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data && data.hash && data.hash !== myHashRef.current) {
          setNuevaVersion(true);
        }
      } catch (e) {
        /* offline o server down, no es problema */
      }
    };

    /* No chequear inmediatamente — el usuario acaba de cargar la versión nueva.
       Esperar el primer intervalo. */
    const timer = setInterval(check, CHECK_INTERVAL_MS);

    /* También chequear cuando la pestaña vuelve a foco (usuario regresa) */
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!nuevaVersion) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
        color: '#fff',
        padding: '10px 16px',
        borderRadius: 14,
        boxShadow: '0 6px 24px rgba(124,58,237,.35), 0 2px 8px rgba(0,0,0,.12)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--lp-font-sans)',
        fontSize: 13,
        fontWeight: 600,
        zIndex: 9999,
        width: 'max-content',
        maxWidth: '92vw',
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(8px)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
      </svg>
      Nueva actualización disponible
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: 'rgba(255,255,255,.95)',
          color: '#5B21B6',
          border: 'none',
          padding: '5px 14px',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
          flexShrink: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,.1)',
        }}
      >
        Recargar
      </button>
    </div>
  );
}
