/* Fab — botón flotante de acción primaria (paquete MOCKUP 8, lp-responsive):
   SOLO móvil (en escritorio el botón de crear vive inline en la toolbar y el
   FAB no se renderiza). 56px, circular, verde de marca, sombra tintada,
   anclado abajo-derecha ENCIMA del BottomNav (bottom 90). El icono por
   default es el "+" (crear); admite children para otros usos.
   Dark: icono casi-negro sobre mint (mockup .dark .lp-fab{color:#0E1413}). */
import { useEffect } from 'react';
import useIsDesktop from '../../hooks/useIsDesktop';

const FAB_CSS = `
  .lp-fab{ position:fixed; right:18px; bottom:90px; width:56px; height:56px; border-radius:50%;
    background:var(--lp-brand-600); color:#fff; border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center; z-index:45;
    box-shadow:0 14px 30px -8px color-mix(in srgb, var(--lp-brand-600) 60%, transparent);
    transition:transform .1s cubic-bezier(.22,1,.36,1); }
  [data-theme="dark"] .lp-fab, .dark .lp-fab{ color:#0E1413; }
  .lp-fab:active{ transform:scale(.94); }
  .lp-fab svg{ width:26px; height:26px; }
  @media (prefers-reduced-motion:reduce){ .lp-fab{ transition:none !important; } }
`;
function injectFabCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lp-fab-css')) return;
  const st = document.createElement('style');
  st.id = 'lp-fab-css';
  st.textContent = FAB_CSS;
  document.head.appendChild(st);
}

export default function Fab({ onClick, label = 'Crear', children, dataId, dataRol }) {
  const isDesktop = useIsDesktop();
  useEffect(() => { injectFabCSS(); }, []);
  if (isDesktop) return null;
  return (
    <button type="button" className="lp-fab" aria-label={label} title={label}
      data-id={dataId} data-rol={dataRol} onClick={onClick}>
      {children || (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
    </button>
  );
}
