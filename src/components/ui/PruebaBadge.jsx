/* ═══════════════════════════════════════════════════════════════════════
   PruebaBadge — Sprint N (jun 2026).

   Badge canónico para señalar que un pedido/orden/lote/sublote/devolución
   está en modo PRUEBA. Antes había 14 implementaciones distintas con drift
   visual (con/sin emoji, distintos colores, distinta posición). Este
   componente unifica:

   Uso:
     <PruebaBadge />              // chip estándar
     <PruebaBadge inline />       // versión compacta para meta-líneas
     <PruebaBadge size="sm" />    // chip más pequeño

   Conviene combinar con el helper `esPrueba(item)` exportado de este mismo
   archivo: cualquier objeto con esPrueba===true (incluyendo lote, sublote,
   pedido, orden, devolución) lo retorna como verdadero.
   ═══════════════════════════════════════════════════════════════════════ */

export function esPrueba(item) {
  return !!(item && item.esPrueba);
}

/* Ícono SVG line de matraz Erlenmeyer (reemplaza el emoji 🧪).
   stroke="currentColor" → hereda el color del contenedor (tokens --lp-warning-*). */
function IconoMatraz({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M9 3h6" />
      <path d="M10 3v6.5L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9.5V3" />
      <path d="M7 15h10" />
    </svg>
  );
}

const ESTILOS_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: 'var(--lp-warning-100)',
  color: 'var(--lp-warning-800)',
  border: '1px solid var(--lp-warning-500)',
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

export default function PruebaBadge({ size = 'md', inline = false, label = 'PRUEBA' }) {
  if (inline) {
    /* Versión texto sin chip — para meta-líneas tipo "código · PRUEBA · usuario" */
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--lp-warning-700)', fontWeight: 700, fontSize: 'inherit' }}>
        <IconoMatraz size={size === 'sm' ? 11 : 13} />
        {label}
      </span>
    );
  }
  return (
    <span style={{ ...ESTILOS_BASE, ...SIZES[size] }} aria-label="Registro de prueba — no afecta inventario">
      <IconoMatraz size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} />
      {label}
    </span>
  );
}

/* Helper de estilo de CARD para resaltar el bloque entero cuando es prueba.
   Devuelve un objeto de estilos parcial; se combina con `style={{...base, ...pruebaCardStyle(item)}}` */
export function pruebaCardStyle(item) {
  if (!esPrueba(item)) return {};
  return {
    background: 'var(--lp-warning-50)',
    borderLeft: '4px solid var(--lp-warning-600)',
  };
}
