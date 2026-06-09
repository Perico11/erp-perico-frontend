/* Badge — primitiva del Design System verde.
   REESCRITO (jun 2026): antes usaba clases Tailwind sin prefijo `lp-`
   (`bg-brand-50`, `text-brand-700`…) que no compilaban → badge sin color.
   Ahora estilos inline con tokens `var(--lp-*)`. */

const VARIANTS = {
  blue:  { bg: 'var(--lp-brand-50)',   fg: 'var(--lp-brand-700)',   bd: 'var(--lp-brand-200)' },
  green: { bg: 'var(--lp-success-50)', fg: 'var(--lp-success-700)', bd: 'var(--lp-success-100)' },
  red:   { bg: 'var(--lp-danger-50)',  fg: 'var(--lp-danger-700)',  bd: 'var(--lp-danger-100)' },
  amber: { bg: 'var(--lp-warning-50)', fg: 'var(--lp-warning-700)', bd: 'var(--lp-warning-100)' },
  gray:  { bg: 'var(--lp-bg-sunken)',  fg: 'var(--lp-text-secondary)', bd: 'var(--lp-border-subtle)' },
};

export default function Badge({ variant = 'blue', children, className = '', style }) {
  const v = VARIANTS[variant] || VARIANTS.blue;
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 8px', fontSize: 11, fontWeight: 600,
        borderRadius: 'var(--lp-radius-sm)',
        fontFamily: 'var(--lp-font-sans)',
        background: v.bg, color: v.fg, border: `1px solid ${v.bd}`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
