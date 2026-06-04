/* ═══════════════════════════════════════════════════════════════════════
   CountBadge — Sprint P (jun 2026).

   Círculo rojo con número, posicionado absolute respecto al padre.
   El padre DEBE tener `position: relative`. Si count<=0 no renderiza.
   - count > 9 muestra "9+"
   - Animación pulse permanente (señal sutil de pending)
   - Variante `mobile` ajusta posición para íconos verticales (bottom nav)
   ═══════════════════════════════════════════════════════════════════════ */

/* Asegura los keyframes globales una sola vez (mismo patrón del modal) */
function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lp-count-badge-css')) return;
  const style = document.createElement('style');
  style.id = 'lp-count-badge-css';
  style.textContent = `
    @keyframes lp-badge-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(220,38,38,.45); }
      70%  { box-shadow: 0 0 0 7px rgba(220,38,38,0); }
      100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
    }
  `;
  document.head.appendChild(style);
}

export default function CountBadge({ count, variant = 'sidebar' }) {
  if (typeof window !== 'undefined') injectKeyframes();
  if (!count || count <= 0) return null;
  const isMobile = variant === 'mobile';
  const label = count > 9 ? '9+' : String(count);
  return (
    <span
      aria-label={`${count} pendiente${count === 1 ? '' : 's'}`}
      style={{
        position: 'absolute',
        top: isMobile ? -4 : 6,
        right: isMobile ? -4 : 10,
        minWidth: 19, height: 19,
        padding: count > 9 ? '0 5px' : 0,
        borderRadius: 99,
        background: 'var(--lp-danger-600)',
        color: '#fff',
        fontSize: 11, fontWeight: 700, lineHeight: 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: '2px solid var(--lp-bg-raised)',
        fontVariantNumeric: 'tabular-nums',
        animation: 'lp-badge-pulse 2s ease-out infinite',
        zIndex: 2, pointerEvents: 'none',
      }}
    >
      {label}
    </span>
  );
}
