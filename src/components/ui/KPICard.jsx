const base = {
  background: 'var(--lp-bg-raised)',
  borderRadius: 'var(--lp-radius)',
  border: '1.5px solid var(--lp-border-subtle)',
  padding: '11px 13px',
  transition: 'transform .12s, box-shadow .12s, border-color .12s',
  fontFamily: 'var(--lp-font-sans)',
  textAlign: 'left', width: '100%', minHeight: 78,
  display: 'flex', flexDirection: 'column', gap: 2,
};

const labelStyle = {
  fontSize: 11, fontWeight: 700,
  color: 'var(--lp-text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '.05em',
};

const valueStyle = {
  fontSize: 20, fontWeight: 800, marginTop: 2,
  color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)',
  lineHeight: 1.1,
};

const subStyle = {
  fontSize: 11, color: 'var(--lp-text-tertiary)',
  marginTop: 'auto', paddingTop: 3, lineHeight: 1.3,
};

/* KPI unificado — estilo "dot" del Design System verde (dot de color + label +
   valor mono + sub). Reemplaza el viejo borderTop. `accent` = color del dot. */
export default function KPICard({ label, value, sub, accent = 'var(--lp-brand-600)', onClick, valueColor, style, ...rest }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      style={{
        ...base,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onClick={onClick}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: accent, flexShrink: 0 }} />
        <div style={labelStyle}>{label}</div>
      </div>
      <div style={{ ...valueStyle, ...(valueColor ? { color: valueColor } : {}) }}>{value}</div>
      {sub && <div style={subStyle}>{sub}</div>}
    </Tag>
  );
}
