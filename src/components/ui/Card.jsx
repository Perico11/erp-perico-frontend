/* Card — primitiva del Design System verde.
   REESCRITO (jun 2026): antes usaba clases Tailwind sin prefijo `lp-`
   (`bg-raised`, `border-t-${accent}`…) que no compilaban (y la interpolación
   dinámica `border-t-${accent}` Tailwind ni siquiera la detecta para purga).
   Ahora estilos inline con tokens `var(--lp-*)`. */
import { useState } from 'react';

/* accent puede venir como nombre de token ('brand-600') o color CSS directo. */
function resolveAccent(accent) {
  if (!accent) return null;
  if (accent.startsWith('#') || accent.startsWith('var(') || accent.startsWith('rgb')) return accent;
  return `var(--lp-${accent})`;
}

export default function Card({ accent, className = '', style, children, onClick, ...props }) {
  const [hover, setHover] = useState(false);
  const ac = resolveAccent(accent);
  const composed = {
    background: 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius-lg)',
    border: '1px solid var(--lp-border-subtle)',
    overflow: 'hidden',
    ...(ac ? { borderTop: `3px solid ${ac}` } : null),
    ...(onClick ? { cursor: 'pointer', boxShadow: hover ? 'var(--lp-shadow-md)' : 'none', transition: 'box-shadow 0.15s' } : null),
    ...style,
  };
  return (
    <div
      className={className}
      style={composed}
      onClick={onClick}
      onMouseEnter={onClick ? () => setHover(true) : undefined}
      onMouseLeave={onClick ? () => setHover(false) : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', style }) {
  return (
    <div className={className} style={{ padding: '12px 16px', borderBottom: '1px solid var(--lp-border-subtle)', ...style }}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '', style }) {
  return <div className={className} style={{ padding: '16px', ...style }}>{children}</div>;
}

export function KPICard({ label, value, sub, accent = 'brand-600', icon }) {
  return (
    <Card accent={accent}>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--lp-text-tertiary)' }}>{label}</span>
          {icon && <span style={{ color: 'var(--lp-text-tertiary)' }}>{icon}</span>}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)' }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 4 }}>{sub}</div>}
      </div>
    </Card>
  );
}
