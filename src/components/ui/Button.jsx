/* Button — primitiva del Design System verde.
   REESCRITO (jun 2026): antes usaba clases Tailwind SIN prefijo `lp-`
   (`bg-brand-600`, `text-text-primary`…) que NO existen en el @theme de
   index.css (solo define `--color-lp-*`) → no compilaban → el botón salía
   SIN color de marca. Visible en producción vía Modal.jsx (todos los
   diálogos de confirmación). Ahora estilos inline con tokens `var(--lp-*)`
   que auto-adaptan a claro/oscuro. */
import { useState } from 'react';

const SIZES = {
  sm: { padding: '6px 12px', fontSize: 12 },
  md: { padding: '8px 16px', fontSize: 14 },
  lg: { padding: '10px 20px', fontSize: 16 },
};

const VARIANTS = {
  primary: {
    base: { background: 'var(--lp-brand-600)', color: '#fff', border: '1px solid transparent' },
    hover: { background: 'var(--lp-brand-700)' },
  },
  secondary: {
    base: { background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', border: '1px solid var(--lp-border-default)' },
    hover: { background: 'var(--lp-bg-sunken)' },
  },
  danger: {
    base: { background: 'var(--lp-danger-600)', color: '#fff', border: '1px solid transparent' },
    hover: { background: 'var(--lp-danger-700)' },
  },
  ghost: {
    base: { background: 'transparent', color: 'var(--lp-text-secondary)', border: '1px solid transparent' },
    hover: { background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-primary)' },
  },
};

export default function Button({ variant = 'primary', size = 'md', className = '', style, children, disabled, ...props }) {
  const [hover, setHover] = useState(false);
  const v = VARIANTS[variant] || VARIANTS.primary;
  const sz = SIZES[size] || SIZES.md;
  const composed = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'var(--lp-font-sans)', fontWeight: 600,
    borderRadius: 'var(--lp-radius-sm)',
    minHeight: 44, boxSizing: 'border-box',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background 0.15s, color 0.15s',
    ...sz,
    ...v.base,
    ...(hover && !disabled ? v.hover : null),
    ...style,
  };
  return (
    <button
      className={className}
      style={composed}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...props}
    >
      {children}
    </button>
  );
}
