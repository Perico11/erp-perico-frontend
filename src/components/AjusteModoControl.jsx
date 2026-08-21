/* AjusteModoControl — patrón ÚNICO de ajuste de inventario (ago 2026, pedido dueño).
   Todo panel que ajusta existencias (Inventarios MP/PT/Envases, MP por almacén,
   Editar color americano) usa este selector Fijar/Sumar/Restar + vista previa
   "antes → después", para que NUNCA quede la duda de si el número capturado
   sustituye el total o se suma a lo que hay.

   El contrato de guardado NO cambia: el consumidor calcula el TOTAL FINAL con
   calcularTotalAjuste() y manda ese número al endpoint de siempre (fijar/set). */

export const MODOS_AJUSTE = [
  { key: 'fijar', label: 'Fijar total' },
  { key: 'sumar', label: 'Sumar' },
  { key: 'restar', label: 'Restar' },
];

/* total final resultante (clamp a 0). valor NaN/null → null (input vacío). */
export function calcularTotalAjuste(modo, actual, valor) {
  const v = Number(valor);
  if (valor === '' || valor == null || isNaN(v)) return null;
  const base = Number(actual) || 0;
  const total = modo === 'sumar' ? base + v : modo === 'restar' ? base - v : v;
  return Math.max(0, Math.round(total * 1000) / 1000);
}

export function etiquetaCampoAjuste(modo, unidad) {
  const u = unidad ? ` (${unidad})` : '';
  if (modo === 'sumar') return `Cantidad a sumar${u}`;
  if (modo === 'restar') return `Cantidad a restar${u}`;
  return `Nuevo total${u}`;
}

/* Nota de auditoría para el motivo: "Sumó 20 kg (300 → 320)". null si es fijar. */
export function notaModoAjuste(modo, actual, valor, total, unidad) {
  if (modo !== 'sumar' && modo !== 'restar') return null;
  const u = unidad ? ` ${unidad}` : '';
  return `${modo === 'sumar' ? 'Sumó' : 'Restó'} ${_fmt(valor)}${u} (${_fmt(actual)} → ${_fmt(total)})`;
}

const _fmt = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 3 });

const ICONOS = {
  fijar: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M5 9h14M5 15h14" />
    </svg>
  ),
  sumar: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  restar: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  ),
};

/* Control segmentado. compact=true reduce alto (filas inline).
   soloFijar=true deshabilita Sumar/Restar (ej. PT cuando se cambió la medida). */
export function ModoAjusteSelector({ modo, onModo, compact = false, soloFijar = false, dataIdBase = 'ajuste.modo' }) {
  return (
    <div role="tablist" aria-label="Tipo de ajuste" style={{
      display: 'flex', gap: 4, background: 'var(--lp-bg-raised)',
      borderRadius: compact ? 9 : 11, padding: 3,
    }}>
      {MODOS_AJUSTE.map(m => {
        const on = modo === m.key;
        const disabled = soloFijar && m.key !== 'fijar';
        return (
          <button key={m.key} type="button" role="tab" aria-selected={on} disabled={disabled}
            data-id={`${dataIdBase}.${m.key}`}
            onClick={() => !disabled && onModo(m.key)}
            style={{
              flex: 1, minHeight: compact ? 30 : 38, border: 'none',
              borderRadius: compact ? 7 : 8, cursor: disabled ? 'default' : 'pointer',
              background: on ? 'var(--lp-bg-base)' : 'transparent',
              color: on ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)',
              boxShadow: on ? '0 1px 4px rgba(26,24,21,.14)' : 'none',
              fontFamily: 'var(--lp-font-sans)', fontSize: compact ? 11.5 : 12.5,
              fontWeight: 600, opacity: disabled ? 0.4 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              whiteSpace: 'nowrap',
            }}>
            {ICONOS[m.key]}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/* Vista previa "101.3 → 121.3 cub" + chip de delta. nuevo=null → hint vacío.
   extra: nodo opcional bajo la línea (ej. "= 104 cubetas-equivalente"). */
export function AjustePreview({ actual, nuevo, unidad = '', decimales = 1, compact = false, extra = null }) {
  const fmt = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: decimales });
  if (nuevo == null) {
    return (
      <div style={{
        marginTop: compact ? 8 : 12, padding: compact ? '7px 11px' : '10px 14px', borderRadius: 11,
        background: 'var(--lp-bg-raised)', fontSize: compact ? 11.5 : 12.5,
        color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-sans)',
      }}>
        Escribe una cantidad para ver el resultado
      </div>
    );
  }
  const delta = (Number(nuevo) || 0) - (Number(actual) || 0);
  const sinCambio = Math.abs(delta) < 0.001;
  const chip = {
    fontSize: compact ? 10.5 : 12, fontWeight: 700, borderRadius: 999,
    padding: compact ? '2px 8px' : '3px 10px', fontFamily: 'var(--lp-font-mono)', flex: 'none',
    color: sinCambio ? 'var(--lp-text-tertiary)' : delta > 0 ? 'var(--lp-brand-700)' : 'var(--lp-danger-600)',
    background: sinCambio ? 'var(--lp-bg-base)'
      : delta > 0 ? 'color-mix(in srgb, var(--lp-brand-600) 16%, transparent)'
        : 'color-mix(in srgb, var(--lp-danger-600) 12%, transparent)',
  };
  return (
    <div style={{
      marginTop: compact ? 8 : 12, padding: compact ? '7px 11px' : '10px 14px', borderRadius: 11,
      background: 'color-mix(in srgb, var(--lp-brand-600) 9%, transparent)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        fontFamily: 'var(--lp-font-mono)', fontVariantNumeric: 'tabular-nums',
        fontSize: compact ? 12.5 : 14, fontWeight: 600,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ color: 'var(--lp-text-tertiary)' }}>{fmt(actual)}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--lp-text-tertiary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <span style={{ color: 'var(--lp-brand-700)', fontSize: compact ? 13.5 : 15.5 }}>
            {fmt(nuevo)}{unidad ? ` ${unidad}` : ''}
          </span>
        </span>
        <span style={chip}>{sinCambio ? 'sin cambio' : `${delta > 0 ? '+' : ''}${fmt(delta)}`}</span>
      </div>
      {extra}
    </div>
  );
}
