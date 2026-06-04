/**
 * ButtonPill — botón estilo iOS pill (cápsula).
 *
 * Cápsula totalmente redondeada, padding generoso. Variantes:
 *  - primary:    azul brand sólido, texto blanco
 *  - secondary:  tinted azul 10%, texto azul
 *  - danger:     tinted rojo 10%, texto rojo
 *  - dangerSolid: rojo brand sólido, texto blanco
 *  - ghost:      transparente, texto azul
 *
 * Tamaños: 'md' (default, 13px 22px), 'lg' (15px 24px), 'sm' (10px 16px)
 *
 * Uso:
 *   <ButtonPill variant="primary" onClick={crear}>Crear pedido</ButtonPill>
 *   <ButtonPill variant="danger">Eliminar</ButtonPill>
 *   <ButtonPill variant="ghost" size="sm">Cancelar</ButtonPill>
 *
 * Props extra:
 *   - icon:    JSX opcional al inicio
 *   - fullWidth: si true, width 100%
 *   - disabled
 *   - loading: muestra spinner mini
 */

const VARIANTS = {
  primary: {
    bg: 'var(--lp-brand-600)',
    color: '#fff',
    hover: 'var(--lp-brand-700)',
  },
  secondary: {
    bg: 'rgba(24,95,165,0.1)',
    color: 'var(--lp-brand-700)',
    hover: 'rgba(24,95,165,0.18)',
  },
  danger: {
    bg: 'rgba(220,38,38,0.1)',
    color: 'var(--lp-danger-600)',
    hover: 'rgba(220,38,38,0.18)',
  },
  dangerSolid: {
    bg: 'var(--lp-danger-600)',
    color: '#fff',
    hover: 'var(--lp-danger-700)',
  },
  ghost: {
    bg: 'transparent',
    color: 'var(--lp-brand-700)',
    hover: 'rgba(24,95,165,0.08)',
  },
};

const SIZES = {
  sm: { padding: '8px 14px', fontSize: 13, gap: 6, minHeight: 36 },
  md: { padding: '11px 20px', fontSize: 14, gap: 8, minHeight: 44 },
  lg: { padding: '14px 24px', fontSize: 15, gap: 9, minHeight: 50 },
};

export default function ButtonPill({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  children,
  type = 'button',
  style,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: v.bg,
        color: v.color,
        border: 'none',
        borderRadius: 'var(--lp-radius-pill)',
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 600,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--lp-font-sans)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        minHeight: s.minHeight,
        width: fullWidth ? '100%' : 'auto',
        opacity: disabled ? 0.5 : 1,
        transition: 'background .12s, transform .08s',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled && !loading) e.currentTarget.style.background = v.hover; }}
      onMouseLeave={(e) => { if (!disabled && !loading) e.currentTarget.style.background = v.bg; }}
      onMouseDown={(e) => { if (!disabled && !loading) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >
      {loading && (
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '2px solid currentColor', borderTopColor: 'transparent',
          animation: 'spin 0.6s linear infinite',
          flexShrink: 0,
        }} />
      )}
      {!loading && icon}
      {children && <span>{children}</span>}
    </button>
  );
}
