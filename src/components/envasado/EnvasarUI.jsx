/* ════════════════════════════════════════════════════════════════════════════
   EnvasarUI — bloques COMPARTIDOS de las pantallas de envasado (jul 2026).

   Pedido dueño: "hay más de 2 formas de envasar y todas son distintas entre sí,
   deberían tener un diseño único". Las CUATRO pantallas deciden lo mismo —
   de qué lote sale · en qué se envasa · con qué envase y tapa · quién lo hace ·
   cuánto — y cambiaban solo en apariencia:

     1. Stock Fábrica ▸ Envasar lote
     2. Stock Fábrica ▸ Re-envasar tote
     3. Inventarios   ▸ Envasar en Terán
     4. Americano     ▸ Envasar color

   Aquí viven los bloques visuales; la LÓGICA DE NEGOCIO de cada pantalla se
   queda donde está (cada una descuenta de su bodega y guarda a su manera).
   Así un cambio de diseño se hace UNA vez y las cuatro quedan iguales.

   Orden canónico de secciones (el de las 4):
     De dónde sale → En qué se envasa → Envase → Tapa → Quién envasó → Cuánto
     → Resumen → Acciones
   ════════════════════════════════════════════════════════════════════════════ */
import { useMemo } from 'react';

/* ── Tokens locales (todo sale de var(--lp-*)) ───────────────────────────── */
export const EU = {
  sec: {
    fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
    color: 'var(--lp-text-tertiary)', margin: '15px 0 7px',
  },
  select: {
    width: '100%', minHeight: 44, padding: '0 12px', borderRadius: 11,
    border: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)',
    color: 'var(--lp-text-primary)', fontSize: 13.5, fontFamily: 'var(--lp-font-sans)',
    boxSizing: 'border-box', cursor: 'pointer',
  },
  seg: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  segb: (on, dis) => ({
    flex: 1, minWidth: 80, padding: '9px 10px', borderRadius: 11,
    border: '1.5px solid ' + (on ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'),
    background: on ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)',
    color: on ? '#fff' : 'var(--lp-text-primary)',
    cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.45 : 1,
    display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
    fontSize: 12, fontWeight: 600, fontFamily: 'var(--lp-font-sans)',
  }),
  segSub: { fontSize: 10.5, fontWeight: 500, opacity: 0.72, fontFamily: 'var(--lp-font-mono)' },
  stepper: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 12, padding: '6px 8px',
  },
  sbtn: (dis) => ({
    width: 38, height: 38, borderRadius: 9, flexShrink: 0,
    border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-sunken)',
    color: 'var(--lp-text-secondary)', fontSize: 20, lineHeight: 1,
    cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.35 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  sval: {
    flex: 1, minWidth: 0, textAlign: 'center', border: 'none', background: 'none',
    fontFamily: 'var(--lp-font-mono)', fontSize: 23, fontWeight: 700,
    color: 'var(--lp-text-primary)', outline: 'none',
  },
  hint: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 6, lineHeight: 1.5 },
  resumen: {
    marginTop: 13, background: 'var(--lp-brand-50)', borderRadius: 12,
    padding: '11px 13px', fontSize: 12.5, lineHeight: 1.7, color: 'var(--lp-brand-700)',
  },
  alerta: {
    marginTop: 13, background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    borderRadius: 11, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.55, fontWeight: 500,
  },
  num: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700 },
};

/* ── Etiqueta de sección ─────────────────────────────────────────────────── */
export function Sec({ children, style }) {
  return <div style={{ ...EU.sec, ...(style || {}) }}>{children}</div>;
}

/* ── Encabezado: LOTE primero (identifica la tanda y es lo que hereda el QR) ─ */
export function EnvasarHead({ lote, producto, disponible, extra }) {
  return (
    <>
      <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em' }}>Envasar</div>
      <div style={{ fontSize: 11.5, color: 'var(--lp-text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
        {lote && (
          <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 600, color: 'var(--lp-brand-600)' }}>
            {lote}
          </span>
        )}
        {lote && (producto || disponible) ? ' · ' : ''}
        {producto}
        {disponible ? ` · ${disponible}` : ''}
        {extra}
      </div>
    </>
  );
}

/* ── Pastillas de presentación ───────────────────────────────────────────── */
export function PresPills({ opciones, valor, onChange, dataId }) {
  return (
    <div style={EU.seg}>
      {opciones.map(o => (
        <button
          key={o.id} type="button" disabled={!!o.disabled}
          aria-pressed={o.id === valor}
          onClick={() => !o.disabled && onChange(o.id)}
          style={EU.segb(o.id === valor, !!o.disabled)}
          title={o.title || o.nombre}
          data-id={dataId ? `${dataId}.${o.id}` : undefined}
        >
          {o.nombre}
          {o.sub != null && <span style={EU.segSub}>{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Contador ────────────────────────────────────────────────────────────── */
export function Contador({ valor, onChange, max, min = 0, step = 1, decimal = false, dataId }) {
  const v = Number(valor) || 0;
  const topeOk = Number.isFinite(max);
  const clamp = (x) => {
    let n = decimal ? Number(x) : Math.round(Number(x));
    if (!Number.isFinite(n)) n = min;
    if (topeOk) n = Math.min(max, n);
    return Math.max(min, n);
  };
  return (
    <div style={EU.stepper}>
      <button type="button" aria-label="Menos" style={EU.sbtn(v <= min)} disabled={v <= min}
        onClick={() => onChange(clamp(v - step))}>−</button>
      <input
        style={EU.sval} type="number" inputMode={decimal ? 'decimal' : 'numeric'}
        min={min} max={topeOk ? max : undefined} step={step} value={valor}
        aria-label="Cantidad" data-id={dataId}
        onChange={e => onChange(e.target.value === '' ? '' : clamp(e.target.value))}
      />
      <button type="button" aria-label="Más" style={EU.sbtn(topeOk && v >= max)} disabled={topeOk && v >= max}
        onClick={() => onChange(clamp(v + step))}>+</button>
    </div>
  );
}

/* ── Aviso del tope: cuánto cabe y QUÉ lo limita ─────────────────────────────
   El dato que faltaba en las 4: hoy el operador descubre que no alcanza hasta
   que el guardado truena. `limites` = [{ n, motivo }]; el menor manda. */
export function TopeHint({ limites }) {
  const menor = useMemo(() => {
    const vivos = (limites || []).filter(l => l && Number.isFinite(l.n));
    if (!vivos.length) return null;
    return vivos.reduce((a, b) => (b.n < a.n ? b : a));
  }, [limites]);
  if (!menor) return null;
  return (
    <div style={EU.hint}>
      Máximo <b style={{ fontFamily: 'var(--lp-font-mono)' }}>{Math.max(0, Math.floor(menor.n)).toLocaleString('es-MX')}</b>
      {' '}— lo limita {menor.motivo}.
    </div>
  );
}

/* ── Resumen en vivo / alerta cuando no alcanza ──────────────────────────── */
export function Resumen({ error, children }) {
  if (error) return <div style={EU.alerta}>{error}</div>;
  return <div style={EU.resumen}>{children}</div>;
}

/* ── Desplegable de vaciadores (idéntico en las 4) ───────────────────────── */
export function QuienEnvaso({ vaciadores, valor, onChange, dataId, nota }) {
  return (
    <>
      <Sec>Quién envasó</Sec>
      <select style={EU.select} value={valor} onChange={e => onChange(e.target.value)}
        data-id={dataId} data-rol="tecnico,almacen,admin">
        <option value="">Sin especificar</option>
        {(vaciadores || []).map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
      </select>
      <div style={EU.hint}>
        {(!vaciadores || vaciadores.length === 0)
          ? 'Aún no hay vaciadores dados de alta (Admin ▸ Usuarios ▸ Vaciadores).'
          : (nota || 'Queda grabado en cada sublote de esta tanda.')}
      </div>
    </>
  );
}

/* ── Envase a usar. `opciones` = [{ value, label, disabled }] ────────────── */
export function EnvaseSelect({ etiqueta = 'Envase', opciones, valor, onChange, dataId, vacio, nota }) {
  return (
    <>
      <Sec>{etiqueta}</Sec>
      <select style={EU.select} value={valor} onChange={e => onChange(e.target.value)} data-id={dataId}>
        {vacio && <option value="">{vacio}</option>}
        {(opciones || []).map(o => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      {nota && <div style={EU.hint}>{nota}</div>}
    </>
  );
}

/* ── Tapa: mismo select + bolita del color (el color importa al surtir) ──── */
export function TapaSelect({ opciones, valor, onChange, dataId, vacio, nota }) {
  const sel = (opciones || []).find(o => String(o.value) === String(valor));
  return (
    <>
      <Sec>Tapa</Sec>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
          background: (sel && sel.color) || 'var(--lp-border-strong)',
          border: '1.5px solid var(--lp-border-subtle)',
        }} />
        <select style={{ ...EU.select, flex: 1 }} value={valor} onChange={e => onChange(e.target.value)} data-id={dataId}>
          {vacio && <option value="">{vacio}</option>}
          {(opciones || []).map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>
      </div>
      {nota && <div style={EU.hint}>{nota}</div>}
    </>
  );
}

/* ── Helper: tope + cuello de botella, compartido por las 4 ─────────────────
   litros / porUnidad → cuánto da el líquido; stockEnvase y stockTapa acotan.
   Devuelve { max, limites } listo para <Contador max> y <TopeHint limites>. */
export function calcularTope({ litros, porUnidad, stockEnvase, stockTapa, lugar = 'fábrica' }) {
  const limites = [];
  if (Number.isFinite(litros) && Number.isFinite(porUnidad) && porUnidad > 0) {
    limites.push({ n: Math.floor(litros / porUnidad), motivo: 'la pintura disponible' });
  }
  if (Number.isFinite(stockEnvase)) limites.push({ n: stockEnvase, motivo: `los envases en ${lugar}` });
  if (Number.isFinite(stockTapa)) limites.push({ n: stockTapa, motivo: `las tapas en ${lugar}` });
  const max = limites.length ? Math.max(0, Math.min(...limites.map(l => l.n))) : Infinity;
  return { max, limites };
}
