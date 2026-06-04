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
    /* Versión texto sin chip — para meta-líneas tipo "código · 🧪 PRUEBA · usuario" */
    return (
      <span style={{ color: 'var(--lp-warning-700)', fontWeight: 700, fontSize: 'inherit' }}>
        🧪 {label}
      </span>
    );
  }
  return (
    <span style={{ ...ESTILOS_BASE, ...SIZES[size] }} aria-label="Registro de prueba — no afecta inventario">
      <span aria-hidden="true">🧪</span>
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
