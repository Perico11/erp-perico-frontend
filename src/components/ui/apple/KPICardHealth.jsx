/**
 * KPICardHealth — KPI card estilo Apple Health.
 *
 * Card con fondo tinted por categoría + icono outline en círculo tinted del
 * mismo tono + valor 26px + sub gris. El color comunica la categoría
 * (azul=inventario, ámbar=producción, verde=calidad, etc.).
 *
 * Uso:
 *   <KPICardHealth
 *     category="inventario"
 *     icon={<svg>...</svg>}
 *     label="Inventario"
 *     value={1247}
 *     sub="kg en bodega"
 *     onClick={() => navigate('/inventario')}
 *   />
 *
 * Props:
 *   - category: 'inventario' | 'produccion' | 'compras' | 'alertas' | 'calidad' | 'admin' | 'neutro'
 *   - icon:     JSX/SVG outline 14px (recomendado stroke-width 2.5)
 *   - label:    texto pequeño arriba (color = categoría)
 *   - value:    número grande (texto primario)
 *   - sub:      texto descriptivo gris debajo (opcional)
 *   - onClick:  hace la card clickable
 *
 * Para grids responsivos, envolver en KPIGrid (del KPICard original).
 */

const CATEGORIES = {
  inventario: { bg: 'var(--lp-cat-inventario-bg)', fg: 'var(--lp-cat-inventario-fg)', tint: 'var(--lp-cat-inventario-tint)' },
  produccion: { bg: 'var(--lp-cat-produccion-bg)', fg: 'var(--lp-cat-produccion-fg)', tint: 'var(--lp-cat-produccion-tint)' },
  compras:    { bg: 'var(--lp-cat-compras-bg)',    fg: 'var(--lp-cat-compras-fg)',    tint: 'var(--lp-cat-compras-tint)' },
  alertas:    { bg: 'var(--lp-cat-alertas-bg)',    fg: 'var(--lp-cat-alertas-fg)',    tint: 'var(--lp-cat-alertas-tint)' },
  calidad:    { bg: 'var(--lp-cat-calidad-bg)',    fg: 'var(--lp-cat-calidad-fg)',    tint: 'var(--lp-cat-calidad-tint)' },
  admin:      { bg: 'var(--lp-cat-admin-bg)',      fg: 'var(--lp-cat-admin-fg)',      tint: 'var(--lp-cat-admin-tint)' },
  neutro:     { bg: 'var(--lp-cat-neutro-bg)',     fg: 'var(--lp-cat-neutro-fg)',     tint: 'var(--lp-cat-neutro-tint)' },
};

export default function KPICardHealth({
  category = 'neutro',
  icon,
  label,
  value,
  sub,
  onClick,
  style,
}) {
  const cat = CATEGORIES[category] || CATEGORIES.neutro;
  const clickable = typeof onClick === 'function';
  const Wrap = clickable ? 'button' : 'div';

  const cardStyle = {
    background: cat.bg,
    borderRadius: 'var(--lp-radius-lg)',
    padding: '14px 14px 12px',
    border: 'none',
    cursor: clickable ? 'pointer' : 'default',
    textAlign: 'left',
    fontFamily: 'var(--lp-font-sans)',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'transform .12s, box-shadow .12s',
    ...style,
  };

  return (
    <Wrap
      {...(clickable ? { type: 'button', onClick } : {})}
      style={cardStyle}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {icon && (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: cat.tint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cat.fg, flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        {label && (
          <span style={{ fontSize: 11, color: cat.fg, fontWeight: 600 }}>{label}</span>
        )}
      </div>
      <div style={{
        fontSize: 26, fontWeight: 700,
        color: 'var(--lp-text-primary)',
        letterSpacing: '-0.03em', lineHeight: 1,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--lp-text-secondary)', marginTop: 4 }}>{sub}</div>
      )}
    </Wrap>
  );
}
