/* ═══════════════════════════════════════════════════════════════════════
   AmericanoBadge — STK AMERICANO (jul 2026).

   Chip para señalar que un tote/producto es STOCK AMERICANO (PT importado de
   EE.UU.). Espeja el patrón de PruebaBadge (ícono SVG line, tokens de tema,
   sin emoji) pero en azul (--lp-info-*) para distinguirlo del verde de marca
   y del ámbar de prueba.

   Uso:  <AmericanoBadge />            // chip estándar
         <AmericanoBadge size="sm" />  // compacto
   ═══════════════════════════════════════════════════════════════════════ */

export function esAmericano(item) {
  return !!(item && item.origen === 'americano');
}

/* Ícono line de contenedor de carga (importación) — hereda currentColor. */
function IconoContenedor({ size = 14 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ flexShrink: 0 }}
    >
      <rect x="2" y="7" width="20" height="12" rx="1" />
      <path d="M6 7v12M10 7v12M14 7v12M18 7v12" />
    </svg>
  );
}

const ESTILOS_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: 'color-mix(in srgb, var(--lp-info-600) 14%, transparent)',
  color: 'var(--lp-info-700, var(--lp-info-600))',
  border: '1px solid color-mix(in srgb, var(--lp-info-600) 40%, transparent)',
  borderRadius: 12,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  fontFamily: 'var(--lp-font-sans)',
  letterSpacing: '.02em',
  flexShrink: 0,
};

const SIZES = {
  sm: { padding: '1px 6px',  fontSize: 9,  textTransform: 'uppercase' },
  md: { padding: '2px 8px',  fontSize: 10, textTransform: 'uppercase' },
  lg: { padding: '4px 12px', fontSize: 12, textTransform: 'uppercase' },
};

export default function AmericanoBadge({ size = 'md', inline = false, label = 'Americano' }) {
  if (inline) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--lp-info-700, var(--lp-info-600))', fontWeight: 700, fontSize: 'inherit' }}>
        <IconoContenedor size={size === 'sm' ? 11 : 13} />
        {label}
      </span>
    );
  }
  return (
    <span style={{ ...ESTILOS_BASE, ...SIZES[size] }} aria-label="Stock americano — producto importado de EE.UU.">
      <IconoContenedor size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} />
      {label}
    </span>
  );
}
