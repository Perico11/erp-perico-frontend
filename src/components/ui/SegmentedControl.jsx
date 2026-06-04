/**
 * SegmentedControl — toggle horizontal compacto tipo iOS/Apple.
 *
 * Uso:
 *   <SegmentedControl
 *     value={presentacion}
 *     onChange={setPresentacion}
 *     options={[
 *       { value: 'cubeta', label: '19L' },
 *       { value: 'galon', label: 'Galón' },
 *       { value: 'litro', label: 'Litro' },
 *       { value: 'tote', label: 'Tote' },
 *     ]}
 *     color="brand"  // brand | success | warning | danger | info
 *   />
 *
 *   <SegmentedControl
 *     value={tier}
 *     onChange={setTier}
 *     options={[{value:'menudeo',label:'Menudeo'},{value:'mayoreo',label:'Mayoreo'}]}
 *     color="success"
 *   />
 */

const COLORS = {
  brand:   { bg: 'var(--lp-brand-600)',   activeText: '#fff' },
  success: { bg: 'var(--lp-success-600)', activeText: '#fff' },
  warning: { bg: 'var(--lp-warning-600)', activeText: '#fff' },
  danger:  { bg: 'var(--lp-danger-600)',  activeText: '#fff' },
  info:    { bg: 'var(--lp-info-600)',    activeText: '#fff' },
};

const S = {
  wrap: {
    display: 'flex',                         /* flex (no inline-flex) → respeta ancho del padre */
    background: 'var(--lp-bg-sunken)',
    borderRadius: 999,
    padding: 3,
    border: '1px solid var(--lp-border-subtle)',
    fontFamily: 'var(--lp-font-sans)',
    maxWidth: '100%',                        /* nunca desbordar el padre */
    overflowX: 'auto',                       /* permite scroll cuando hay muchas opciones */
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  btn: (active, palette) => ({
    padding: '6px 14px', fontSize: 12,
    fontWeight: active ? 700 : 500,
    color: active ? palette.activeText : 'var(--lp-text-secondary)',
    background: active ? palette.bg : 'transparent',
    border: 'none', borderRadius: 999,
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background .12s, color .12s',
    whiteSpace: 'nowrap',
    flexShrink: 0,                           /* NO encogerse — cada botón mantiene su ancho natural */
    minHeight: 30,
  }),
};

export default function SegmentedControl({ value, onChange, options = [], color = 'brand', style }) {
  const palette = COLORS[color] || COLORS.brand;
  return (
    <div style={{ ...S.wrap, ...style }} className="segmented-scroll">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={S.btn(value === o.value, palette)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
