import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import ProduccionFlow from '../produccion/ProduccionFlow';
import NDAModal from '../../components/NDAModal';
import useConfirm from '../../hooks/useConfirm';

/* ── Badge maps ── */
const ESTADO_BADGE = {
  pendiente:  { cls: 'warn',   label: 'Pendiente' },
  en_proceso: { cls: 'info',   label: 'En Proceso' },
  produccion: { cls: 'info',   label: 'Producción' },
  qc:         { cls: 'purple', label: 'QC' },
  terminada:  { cls: 'ok',     label: 'Terminada' },
  entregada:  { cls: 'ok',     label: 'Entregada' },
  cancelada:  { cls: 'neutral',label: 'Cancelada' },
  eliminado:  { cls: 'err',    label: 'Eliminada' },
};
const PRIO_BADGE = {
  urgente: { cls: 'err',  label: 'URGENTE' },
  alta:    { cls: 'warn', label: 'ALTA' },
  normal:  { cls: 'ok',   label: 'NORMAL' },
};

/* ── Estado transitions allowed per current estado ── */
const TRANSITIONS = {
  pendiente:  ['en_proceso', 'cancelada'],
  en_proceso: ['pendiente', 'cancelada'],
  produccion: ['en_proceso', 'cancelada'],
  qc:         ['en_proceso'],
  terminada:  ['entregada'],
  entregada:  [],
  cancelada:  ['pendiente'],
};

/* ── Inline styles (LP design system) ── */
const S = {
  wrap: { padding: '0 20px 100px' },
  mainTabs: {
    display: 'flex', gap: 0, borderBottom: '2px solid var(--lp-border-subtle)',
    marginBottom: 16, overflowX: 'auto',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
  },
  mainTab: (active) => ({
    padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
    borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
    background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: 'var(--lp-font-sans)', marginBottom: -2, flexShrink: 0,
  }),
  subTabs: {
    display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
  },
  subTab: (active) => ({
    padding: '7px 16px', fontSize: 12, fontWeight: active ? 600 : 500,
    color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
    background: active ? 'var(--lp-brand-50)' : 'transparent',
    borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    whiteSpace: 'nowrap', flexShrink: 0,
  }),
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap',
  },
  search: {
    flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: '#fff', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  btnNew: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-brand-600)', color: '#fff', whiteSpace: 'nowrap', minHeight: 44,
  },
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10, marginBottom: 16,
  },
  kpi: (bg) => ({
    background: bg, borderRadius: 10, padding: 14, textAlign: 'center',
  }),
  kpiLabel: (fg) => ({
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: fg,
  }),
  kpiValue: (fg) => ({
    fontSize: 24, fontWeight: 700, color: fg,
  }),
  card: (isPrueba) => ({
    /* Modo prueba: card naranja claro SIN borde discontinuo (estilo más limpio
       solicitado por usuario). Solo el background marca la diferencia visual. */
    background: isPrueba ? 'var(--lp-warning-50)' : 'var(--lp-bg-raised)',
    border: '1.5px solid ' + (isPrueba ? 'var(--lp-warning-200)' : 'var(--lp-border-subtle)'),
    borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 10,
  }),
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 8, marginBottom: 8,
  },
  cardCode: {
    fontWeight: 700, fontSize: 12, color: 'var(--lp-brand-600)',
    fontFamily: 'var(--lp-font-mono)',
  },
  cardTitle: {
    fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 10,
  },
  badge: (type) => {
    const map = {
      ok:      { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-600)' },
      warn:    { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
      err:     { bg: 'var(--lp-danger-100)',  fg: 'var(--lp-danger-600)' },
      info:    { bg: 'var(--lp-brand-100)',   fg: 'var(--lp-brand-700)' },
      neutral: { bg: 'var(--lp-bg-sunken)',   fg: 'var(--lp-text-tertiary)' },
      purple:  { bg: '#EDE9FE',               fg: '#7C3AED' },
    };
    const c = map[type] || map.neutral;
    return {
      display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 600,
      borderRadius: 6, background: c.bg, color: c.fg, marginRight: 4,
    };
  },
  cardActions: {
    display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap',
  },
  actionBtn: (bg, fg) => ({
    padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
    border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: bg, color: fg, minHeight: 36,
  }),
  timeline: {
    display: 'flex', alignItems: 'center', gap: 0, margin: '10px 0',
    overflowX: 'auto', fontSize: 11,
  },
  timelineDot: (done) => ({
    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
    background: done ? 'var(--lp-success-600)' : 'var(--lp-border-subtle)',
    border: done ? 'none' : '2px solid var(--lp-border-strong)',
  }),
  timelineLine: (done) => ({
    height: 2, flex: 1, minWidth: 16,
    background: done ? 'var(--lp-success-600)' : 'var(--lp-border-subtle)',
  }),
  timelineLabel: {
    fontSize: 11, color: 'var(--lp-text-tertiary)', textAlign: 'center',
    whiteSpace: 'nowrap', marginTop: 2,
  },
  empty: {
    textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0',
  },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
  groupHeader: {
    cursor: 'pointer', background: 'var(--lp-bg-sunken)', padding: '12px 16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    userSelect: 'none', borderBottom: '1px solid var(--lp-border-subtle)',
  },
  group: {
    border: '1px solid var(--lp-border-subtle)', borderRadius: 10,
    overflow: 'hidden', marginBottom: 12,
  },
  /* Modal */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    width: '100%', maxWidth: 440,
    /* Reservamos espacio para bottom-nav (~64px) y notch. */
    maxHeight: 'calc(100vh - 80px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,.18)',
  },
  modalHeader: {
    padding: '16px 20px', borderBottom: '1px solid var(--lp-border-subtle)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  modalBody: { padding: '16px 20px' },
  modalFooter: {
    padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)',
    display: 'flex', justifyContent: 'flex-end', gap: 8,
  },
  fieldLabel: {
    fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)',
    marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '.04em',
  },
  fieldInput: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: '#fff', outline: 'none',
    boxSizing: 'border-box', marginBottom: 12,
  },
  fieldSelect: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: '#fff', outline: 'none',
    boxSizing: 'border-box', marginBottom: 12, appearance: 'auto',
  },
  btnPrimary: {
    padding: '10px 20px', borderRadius: 8, border: 'none', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-brand-600)', color: '#fff', minHeight: 44,
  },
  btnSecondary: {
    padding: '10px 20px', borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', minHeight: 44,
  },
  btnDanger: {
    padding: '10px 20px', borderRadius: 8, border: 'none', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-danger-600)', color: '#fff', minHeight: 44,
  },
  toast: {
    position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 1001,
    background: 'var(--lp-success-600)', color: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,.15)',
  },
};

/* ── Timeline ── */
const STEPS = ['pendiente', 'en_proceso', 'qc', 'terminada', 'entregada'];
const STEP_LABELS = { pendiente: 'Pendiente', en_proceso: 'Producción', qc: 'QC', terminada: 'Terminada', entregada: 'Entregada' };

function Timeline({ estado }) {
  const idx = STEPS.indexOf(estado);
  return (
    <div style={S.timeline}>
      {STEPS.map((step, i) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 0, flex: i < STEPS.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={S.timelineDot(i <= idx)} />
            <div style={S.timelineLabel}>{STEP_LABELS[step]}</div>
          </div>
          {i < STEPS.length - 1 && <div style={S.timelineLine(i < idx)} />}
        </div>
      ))}
    </div>
  );
}

/* ── Nueva Orden Modal ──
   Sprint C (auditoría 2026-06): si recibe `pedidoOrigen`, prefilla y bloquea
   producto/cantidad/esPrueba al valor del pedido, y usa el endpoint canónico
   /api/pedidos/aceptar-y-producir que crea pedido↔orden atómicamente.
   Sin pedidoOrigen: flujo legacy "orden interna" (solo admin debería usarlo). */
function NuevaOrdenModal({ formulas, ordenes, userName, onClose, onSuccess, pedidoOrigen }) {
  const tienePedido = !!pedidoOrigen;
  const [formula, setFormula] = useState(pedidoOrigen?.producto || '');
  const [cantidad, setCantidad] = useState(pedidoOrigen ? String(pedidoOrigen.cantidad || '') : '');
  const [prioridad, setPrioridad] = useState(pedidoOrigen?.prioridad || 'normal');
  const [fechaReq, setFechaReq] = useState('');
  const [notas, setNotas] = useState('');
  const [esPrueba, setEsPrueba] = useState(!!pedidoOrigen?.esPrueba);
  const [lanzarAhora, setLanzarAhora] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(pedidoOrigen?.producto || '');
  /* Sprint D (C7+R1): validación de stock MP antes de aceptar/lanzar.
     stockCheck: { loading, suficiente, ingredientes, faltantes, error } | null */
  const [stockCheck, setStockCheck] = useState(null);
  const [confirm, ConfirmEl] = useConfirm();

  /* Llamar validar-stock cuando hay (producto, cantidad) y no es prueba */
  useEffect(() => {
    const prod = pedidoOrigen?.producto || formula;
    const qty = Number(pedidoOrigen?.cantidad || cantidad);
    if (!prod || !(qty > 0)) { setStockCheck(null); return; }
    if (esPrueba || pedidoOrigen?.esPrueba) { setStockCheck({ skipped: true }); return; }
    let alive = true;
    setStockCheck({ loading: true });
    api.validarStock(prod, qty).then(r => {
      if (!alive) return;
      if (r?.ok) {
        setStockCheck({
          loading: false,
          suficiente: r.suficiente,
          ingredientes: r.ingredientes || [],
          faltantes: r.faltantes || [],
          proveedorSugerido: r.proveedorSugerido,
        });
      } else {
        setStockCheck({ loading: false, error: r?.error || 'No se pudo validar stock' });
      }
    }).catch(e => {
      if (!alive) return;
      setStockCheck({ loading: false, error: e?.data?.error || e.message });
    });
    return () => { alive = false; };
  }, [pedidoOrigen, formula, cantidad, esPrueba]);

  const filteredFormulas = useMemo(() => {
    if (!search) return formulas;
    const q = search.toLowerCase();
    return formulas.filter(f => f.nombre.toLowerCase().includes(q));
  }, [formulas, search]);

  const handleSubmit = async () => {
    /* CAMINO A: pedido origen presente — usar endpoint atómico canónico.
       Producto/cantidad/esPrueba están bloqueados al valor del pedido. */
    if (tienePedido) {
      setError(''); setSaving(true);
      try {
        const r = await api.aceptarYProducir(pedidoOrigen.id, { lanzarProduccion: lanzarAhora });
        if (!r?.ok) throw new Error(r?.error || 'No se pudo crear orden');
        const codigoMsg = r.orden?.codigo || '?';
        onSuccess(r.reusado
          ? `Orden ${codigoMsg} ya existía — vinculada al pedido`
          : `Orden ${codigoMsg} creada y vinculada al pedido ${pedidoOrigen.codigo || pedidoOrigen.id}` + (lanzarAhora ? ' — producción iniciada' : ''));
      } catch (err) {
        setError(err?.data?.error || err.message || 'Error al crear orden desde pedido');
      } finally { setSaving(false); }
      return;
    }
    /* CAMINO B: orden interna sin pedido (excepción — solo admin debería usar) */
    if (!formula) return setError('Selecciona una fórmula');
    const qty = parseInt(cantidad);
    if (!qty || qty < 1) return setError('Cantidad debe ser ≥ 1');
    setError('');
    setSaving(true);
    try {
      const now = new Date();
      const codigo = 'OP-' + now.getFullYear().toString().slice(2)
        + String(now.getMonth() + 1).padStart(2, '0')
        + String(now.getDate()).padStart(2, '0')
        + '-' + String((ordenes?.length || 0) + 1).padStart(3, '0');
      const orden = {
        id: Date.now().toString(36),
        codigo,
        formula,
        producto: formula,
        cantidad: qty,
        prioridad,
        estado: 'pendiente',
        esPrueba,
        origen: 'interna', /* marca explícita: sin pedido fuente */
        fechaCreacion: now.toISOString().substring(0, 10),
        fechaRequerida: fechaReq || '',
        notas: notas || '',
        usuario: userName || '?',
        historial: [{
          estado: 'pendiente',
          fecha: now.toISOString(),
          usuario: userName || '?',
          nota: (esPrueba ? '[PRUEBA] ' : '') + '[INTERNA] Orden creada sin pedido fuente',
        }],
      };
      await api.upsertOrden(orden);
      onSuccess(`Orden interna ${codigo} creada`);
    } catch (err) {
      setError(err.message || 'Error al crear orden');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {tienePedido ? 'Crear Orden desde Pedido' : 'Nueva Orden Interna'}
            </div>
            {tienePedido && (
              <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                Pedido {pedidoOrigen.codigo || pedidoOrigen.id} · {pedidoOrigen.solicitante || pedidoOrigen.almacen || 'Almacén'}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--lp-text-tertiary)' }} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}

          {tienePedido ? (
            /* CAMPOS BLOQUEADOS del pedido — son fuente de verdad */
            <>
              <label style={S.fieldLabel}>Producto (del pedido)</label>
              <div style={{
                ...S.fieldInput, background: 'var(--lp-bg-base)',
                color: 'var(--lp-text-primary)', fontWeight: 600,
                display: 'flex', alignItems: 'center', marginBottom: 12,
              }}>
                {pedidoOrigen.producto}
              </div>
              <label style={S.fieldLabel}>Cantidad (del pedido)</label>
              <div style={{
                ...S.fieldInput, background: 'var(--lp-bg-base)',
                color: 'var(--lp-text-primary)', fontWeight: 600,
                display: 'flex', alignItems: 'center', marginBottom: 12,
              }}>
                {pedidoOrigen.cantidad} {pedidoOrigen.litPerUnit ? `× ${pedidoOrigen.litPerUnit}L` : 'cubetas'}
              </div>
              {pedidoOrigen.esPrueba && (
                <div style={{
                  padding: '10px 12px', background: 'var(--lp-warning-100)',
                  border: '1.5px solid var(--lp-warning-600)', borderRadius: 8,
                  fontSize: 12, color: 'var(--lp-warning-700)', fontWeight: 600,
                  marginBottom: 12,
                }}>
                  🧪 PRUEBA — heredado del pedido. No descuenta inventario.
                </div>
              )}
              {/* Widget de validación de stock — solo aparece si NO es prueba */}
              {stockCheck && !stockCheck.skipped && (
                <div style={{ marginBottom: 12 }}>
                  {stockCheck.loading && (
                    <div style={{
                      padding: 10, background: 'var(--lp-bg-base)',
                      borderRadius: 8, fontSize: 12, color: 'var(--lp-text-secondary)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <div className="lp-spinner" style={{ width: 14, height: 14 }} />
                      Verificando stock de MP…
                    </div>
                  )}
                  {!stockCheck.loading && stockCheck.error && (
                    <div style={{
                      padding: 10, background: 'var(--lp-warning-100)',
                      color: 'var(--lp-warning-700)', borderRadius: 8, fontSize: 12,
                    }}>
                      ⚠ {stockCheck.error}
                    </div>
                  )}
                  {!stockCheck.loading && stockCheck.suficiente === true && (
                    <div style={{
                      padding: 10, background: 'var(--lp-success-100)',
                      color: 'var(--lp-success-700)', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    }}>
                      ✓ Stock de MP suficiente ({stockCheck.ingredientes?.length || 0} ingredientes verificados)
                    </div>
                  )}
                  {!stockCheck.loading && stockCheck.suficiente === false && (
                    <div style={{
                      padding: 10, background: 'var(--lp-danger-100)',
                      border: '1.5px solid var(--lp-danger-600)', borderRadius: 8,
                      fontSize: 12,
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--lp-danger-700)', marginBottom: 6 }}>
                        ⚠ Faltan {stockCheck.faltantes.length} MP{stockCheck.faltantes.length > 1 ? 's' : ''} para producir esta cantidad
                      </div>
                      {stockCheck.faltantes.slice(0, 6).map(f => (
                        <div key={f.mp} style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '4px 0', borderTop: '1px solid var(--lp-danger-200, rgba(220,38,38,0.2))',
                          color: 'var(--lp-danger-700)',
                        }}>
                          <span style={{ fontWeight: 600 }}>{f.mp}</span>
                          <span>
                            faltan <strong>{f.faltanteKg.toFixed(1)} kg</strong>
                            {f.leadTimeDias ? ` · lead time ${f.leadTimeDias}d` : ''}
                          </span>
                        </div>
                      ))}
                      {stockCheck.faltantes.length > 6 && (
                        <div style={{ fontSize: 10, color: 'var(--lp-danger-600)', marginTop: 4 }}>
                          ...y {stockCheck.faltantes.length - 6} más
                        </div>
                      )}
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--lp-text-secondary)' }}>
                        Puedes crear la orden de todos modos, pero NO podrás producir sin solucionar el faltante.
                        Crea una solicitud OC a Compras desde Órdenes → OC MP.
                      </div>
                    </div>
                  )}
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={lanzarAhora}
                  disabled={stockCheck && stockCheck.suficiente === false && !pedidoOrigen?.esPrueba}
                  onChange={e => setLanzarAhora(e.target.checked)}
                />
                <span style={{ fontSize: 13, color: 'var(--lp-text-primary)' }}>
                  Iniciar producción inmediatamente
                  {stockCheck && stockCheck.suficiente === false && !pedidoOrigen?.esPrueba && (
                    <span style={{ fontSize: 11, color: 'var(--lp-danger-600)', marginLeft: 6, fontWeight: 600 }}>
                      (bloqueado: stock insuficiente)
                    </span>
                  )}
                </span>
              </label>
              <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: -8, marginBottom: 8 }}>
                Si NO marcas, la orden queda en estado "pendiente" para iniciarla después desde la card.
              </div>
            </>
          ) : (
            /* CAMPOS EDITABLES (orden interna) */
            <>
          <label style={S.fieldLabel}>Fórmula / Producto *</label>
          <input
            style={S.fieldInput}
            placeholder="Buscar fórmula..."
            value={search}
            onChange={e => { setSearch(e.target.value); setFormula(''); }}
          />
          {search && !formula && filteredFormulas.length > 0 && (
            <div style={{
              maxHeight: 180, overflowY: 'auto', border: '1.5px solid var(--lp-border-subtle)',
              borderRadius: 8, marginTop: -8, marginBottom: 12, background: '#fff',
            }}>
              {filteredFormulas.slice(0, 20).map(f => (
                <div
                  key={f.nombre}
                  style={{
                    padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                    borderBottom: '1px solid var(--lp-border-subtle)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-brand-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  onClick={() => { setFormula(f.nombre); setSearch(f.nombre); }}
                >
                  {f.nombre}
                  <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginLeft: 8 }}>
                    {f.acabado_texto || ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          {formula && (
            <div style={{ fontSize: 11, color: 'var(--lp-success-600)', fontWeight: 600, marginTop: -8, marginBottom: 12 }}>
              ✓ {formula}
            </div>
          )}

          <label style={S.fieldLabel}>Cantidad (cubetas 19L) *</label>
          <input style={S.fieldInput} type="number" inputMode="decimal" min="1" placeholder="Ej: 52"
            value={cantidad} onChange={e => setCantidad(e.target.value)} />

          <label style={S.fieldLabel}>Prioridad</label>
          <select style={S.fieldSelect} value={prioridad} onChange={e => setPrioridad(e.target.value)}>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>

          <label style={S.fieldLabel}>Fecha requerida</label>
          <input style={S.fieldInput} type="date" value={fechaReq} onChange={e => setFechaReq(e.target.value)} />

          <label style={S.fieldLabel}>Notas</label>
          <input style={S.fieldInput} placeholder="Notas opcionales..." value={notas} onChange={e => setNotas(e.target.value)} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" id="chk-prueba" checked={esPrueba}
              onChange={async e => {
                const wantsCheck = e.target.checked;
                if (wantsCheck) {
                  const ok = await confirm('Modo prueba: no se descontará inventario. ¿Continuar?', { confirmText: 'Activar prueba' });
                  if (!ok) { setEsPrueba(false); return; }
                  setEsPrueba(true);
                } else {
                  setEsPrueba(false);
                }
              }}
            />
            <label htmlFor="chk-prueba" style={{ fontSize: 12, color: 'var(--lp-text-secondary)' }}>
              Modo prueba (no descuenta inventario)
            </label>
          </div>
            </>
          )}
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnPrimary} disabled={saving} onClick={handleSubmit}>
            {saving
              ? 'Guardando...'
              : (tienePedido
                  ? (lanzarAhora ? 'Crear orden e iniciar' : 'Crear orden')
                  : 'Crear Orden')}
          </button>
        </div>
      </div>
      {ConfirmEl}
    </div>
  );
}

/* ── Confirm Modal (for status change / delete) ── */
function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={{ ...S.modal, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        </div>
        <div style={S.modalBody}>
          <p style={{ fontSize: 13, color: 'var(--lp-text-secondary)', margin: 0 }}>{message}</p>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onCancel}>Cancelar</button>
          <button style={danger ? S.btnDanger : S.btnPrimary} onClick={onConfirm}>
            {confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Order Card with actions ── */
/* FIX jun 2026 (L13): destructurar onIrPedido como prop. Antes el JSX
   `onClick={() => onIrPedido && onIrPedido(o)}` siempre referenciaba un
   `onIrPedido` indefinido (no estaba en el destructuring), por short-circuit
   no fallaba pero el botón era no-op silencioso. Regresión de K9. */
function OrdenCard({ orden, canManage, canDelete, onChangeStatus, onDelete, onProducir, onIrPedido }) {
  const o = orden;
  const est = ESTADO_BADGE[o.eliminado ? 'eliminado' : o.estado] || ESTADO_BADGE.pendiente;
  const prio = PRIO_BADGE[o.prioridad] || PRIO_BADGE.normal;
  const isPrueba = o.esPrueba === true;
  const transitions = TRANSITIONS[o.estado] || [];

  return (
    <div style={S.card(isPrueba)}>
      <div style={S.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={S.cardCode}>{o.codigo}</span>
          {isPrueba && <span style={S.badge('warn')}>🧪 PRUEBA</span>}
          <span style={S.badge(est.cls)}>{est.label}</span>
          <span style={S.badge(prio.cls)}>{prio.label}</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>{o.fechaCreacion}</span>
      </div>
      <div style={S.cardTitle}>{o.formula || o.producto}</div>
      <div style={S.cardMeta}>
        {o.cantidad} cubetas 19L
        {o.notas ? ` · ${o.notas}` : ''}
        {o.fechaRequerida ? ` · Requerida: ${o.fechaRequerida}` : ''}
      </div>
      {!o.eliminado && o.estado !== 'cancelada' && <Timeline estado={o.estado} />}
      {/* QC summary — solo se renderiza si hay al menos UN valor */}
      {o.qcResultados && (
        o.qcResultados.brillo != null ||
        o.qcResultados.viscosidad != null ||
        o.qcResultados.ph != null ||
        o.qcResultados.densidad != null ||
        o.qcResultados.notas
      ) && (
        <div style={{
          fontSize: 11, padding: '8px 12px', background: 'var(--lp-brand-50)',
          borderRadius: 8, marginTop: 8, color: 'var(--lp-brand-700)',
        }}>
          <strong>QC:</strong>
          {o.qcResultados.brillo != null && ` Brillo ${o.qcResultados.brillo}`}
          {o.qcResultados.viscosidad != null && ` · Visc ${o.qcResultados.viscosidad} KU`}
          {o.qcResultados.ph != null && ` · pH ${o.qcResultados.ph}`}
          {o.qcResultados.densidad != null && ` · Dens ${o.qcResultados.densidad}`}
          {o.qcResultados.notas && ` · ${o.qcResultados.notas}`}
        </div>
      )}
      {/* Actions */}
      {canManage && !o.eliminado && (
        <div style={S.cardActions}>
          {/* FIX jun 2026 (decisión owner): el botón "Iniciar producción" vive
             ÚNICAMENTE en /pedidos. Aquí, si la orden viene de un pedido,
             solo navegamos al pedido. Si es orden interna (sin pedidoId),
             se mantiene el botón "Producir" en planta. */}
          {onProducir && (o.estado === 'pendiente' || o.estado === 'en_proceso') && !o.pedidoId && (
            <button
              style={{
                ...S.actionBtn('var(--lp-success-600)', '#fff'),
                fontWeight: 700, padding: '8px 14px',
              }}
              onClick={() => onProducir(o)}
              title="Abre el flujo guiado paso-a-paso con cronómetro por materia prima"
            >
              Iniciar producción
            </button>
          )}
          {onProducir && o.pedidoId && (o.estado === 'pendiente' || o.estado === 'en_proceso') && (
            <button
              style={S.actionBtn('var(--lp-brand-100)', 'var(--lp-brand-700)')}
              onClick={() => onIrPedido && onIrPedido(o)}
              title="Esta orden viene de un pedido. Inicia producción desde la pantalla Pedidos."
            >
              → Ir al pedido
            </button>
          )}
          {transitions.map(nextState => {
            const info = ESTADO_BADGE[nextState] || {};
            return (
              <button
                key={nextState}
                style={S.actionBtn(
                  nextState === 'cancelada' ? 'var(--lp-danger-100)' : 'var(--lp-brand-100)',
                  nextState === 'cancelada' ? 'var(--lp-danger-600)' : 'var(--lp-brand-700)',
                )}
                onClick={() => onChangeStatus(o, nextState)}
              >
                → {info.label || nextState}
              </button>
            );
          })}
          {canDelete && (
            <button
              style={S.actionBtn('var(--lp-danger-100)', 'var(--lp-danger-600)')}
              onClick={() => onDelete(o)}
            >
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Collapsible Group ── */
function OrderGroup({ label, badgeCls, orders, canManage, canDelete, onChangeStatus, onDelete, onProducir, onIrPedido }) {
  const [open, setOpen] = useState(false);
  if (!orders?.length) return null;

  return (
    <div style={S.group}>
      <div style={S.groupHeader} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--lp-text-secondary)', transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          <span style={S.badge(badgeCls)}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lp-brand-600)' }}>
            {orders.length} orden{orders.length > 1 ? 'es' : ''}
          </span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '8px 12px' }}>
          {orders.map(o => (
            <OrdenCard key={o.id} orden={o} canManage={canManage} canDelete={canDelete}
              onChangeStatus={onChangeStatus} onDelete={onDelete} onProducir={onProducir}
              onIrPedido={onIrPedido} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                          */
/* ════════════════════════════════════════════════════════════════════ */
export default function OrdenesPage() {
  const { user, can } = useAuth();
  /* FIX jun 2026 (K9): faltaba useNavigate. Las refs `navigate('/pedidos...')`
     en líneas 1156, 1172, 1585 tiraban ReferenceError al click — botón
     "→ Ir al pedido" estaba muerto desde Sprint H. */
  const navigate = useNavigate();
  const rol = user?.rol || '';
  const userName = user?.nombre || '?';
  const [mainTab, setMainTab] = useState('ordenes');
  const [subTab, setSubTab] = useState('activas');
  const [searchQ, setSearchQ] = useState('');

  /* Data */
  const { data: ordData, loading, reload: reloadOrd } = useApiData(() => api.getOrdenes(), [], 5000);
  const { data: pedData, reload: reloadPed } = useApiData(() => api.getPedidos(), [], 5000);

  /* FIX jun 2026 (K1): polling 5s era costoso y aún así dejaba cambios
     invisibles 2-3s. Realtime cierra el gap. */
  useRealtimeSync({
    onOrdenes:     () => reloadOrd(),
    onPedidos:     () => reloadPed(),
    onTrazabilidad:() => reloadOrd(),
    onOc:          () => reloadOrd(), /* solicitudes OC MP creadas desde aquí */
  });

  /* Formulas for new order modal */
  const [formulas, setFormulas] = useState([]);
  useEffect(() => {
    api.getFormulasSummary().then(r => {
      setFormulas(r?.data?.summary || r?.summary || []);
    }).catch(() => {});
  }, []);

  /* State */
  const [showNewModal, setShowNewModal] = useState(false);
  /* Sprint C: cuando se abre el modal desde un pedido específico, este state
     guarda el pedido fuente para que el modal prefille y use el endpoint atómico
     /api/pedidos/aceptar-y-producir en lugar del path "orden interna". */
  const [pedidoOrigenModal, setPedidoOrigenModal] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { title, message, confirmLabel, danger, action }
  const [toastMsg, setToastMsg] = useState('');
  const [prodFlowItem, setProdFlowItem] = useState(null); // orden a producir paso-a-paso
  const [pendingNDA, setPendingNDA] = useState(null);     // orden esperando aceptación NDA

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  }, []);

  const ordenes = useMemo(() => {
    const arr = ordData?.data || (Array.isArray(ordData) ? ordData : []);
    return Array.isArray(arr) ? arr : [];
  }, [ordData]);

  const pedidos = useMemo(() => {
    const arr = pedData?.data || (Array.isArray(pedData) ? pedData : []);
    if (!Array.isArray(arr)) return [];
    /* Filtrar pedidos marcados como eliminados (soft-delete del backend). */
    return arr.filter(p => p && !p.eliminado && p.estado !== 'eliminado');
  }, [pedData]);

  /* Tabs based on role */
  const mainTabs = useMemo(() => {
    const t = [];
    if (rol === 'admin' || rol === 'tecnico') t.push({ id: 'ordenes', label: 'Fábrica' });
    if (rol === 'admin' || rol === 'almacen') t.push({ id: 'pedidos', label: 'Almacén Terán' });
    if (rol === 'admin' || rol === 'compras' || rol === 'tecnico') t.push({ id: 'compras', label: 'OC MP' });
    if (t.length === 0) t.push({ id: 'ordenes', label: 'Fábrica' });
    return t;
  }, [rol]);

  /* Can manage estado/transiciones (admin + técnico) */
  const canManage = rol === 'admin' || rol === 'tecnico';
  /* Solo admin puede ELIMINAR órdenes (revierte MP, requiere PIN) */
  const canDelete = rol === 'admin';

  /* Active orders REALES (sin pruebas, sin canceladas/entregadas) */
  const activas = useMemo(() =>
    ordenes.filter(o => !o.eliminado && o.estado !== 'entregada' && o.estado !== 'cancelada' && !o.esPrueba)
      .sort((a, b) => {
        const p = { urgente: 0, alta: 1, normal: 2 };
        return (p[a.prioridad] || 2) - (p[b.prioridad] || 2);
      }),
    [ordenes]
  );

  /* Órdenes de PRUEBA — separadas de la vista activa */
  const pruebasActivas = useMemo(() =>
    ordenes.filter(o => !o.eliminado && o.estado !== 'entregada' && o.estado !== 'cancelada' && o.esPrueba)
      .sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || '')),
    [ordenes]
  );

  /* Órdenes CANCELADAS o eliminadas */
  const canceladas = useMemo(() =>
    ordenes.filter(o => o.eliminado || o.estado === 'cancelada')
      .sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || '')),
    [ordenes]
  );

  /* Filtered active orders by search */
  const filteredActivas = useMemo(() => {
    if (!searchQ) return activas;
    const q = searchQ.toLowerCase();
    return activas.filter(o =>
      (o.formula || '').toLowerCase().includes(q) ||
      (o.codigo || '').toLowerCase().includes(q) ||
      (o.notas || '').toLowerCase().includes(q)
    );
  }, [activas, searchQ]);

  /* Historial grouped by status */
  const historialGroups = useMemo(() => {
    const statusOrder = ['en_proceso', 'qc', 'pendiente', 'terminada', 'entregada', 'cancelada', 'eliminado'];
    const groups = {};
    ordenes.forEach(o => {
      const st = o.eliminado ? 'eliminado' : (o.estado || 'pendiente');
      if (!groups[st]) groups[st] = [];
      groups[st].push(o);
    });
    return statusOrder
      .filter(st => groups[st]?.length)
      .map(st => ({
        status: st,
        label: ESTADO_BADGE[st]?.label || st,
        badgeCls: ESTADO_BADGE[st]?.cls || 'neutral',
        orders: (groups[st] || []).sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || '')),
      }));
  }, [ordenes]);

  /* KPIs */
  const kpis = useMemo(() => {
    const pend = activas.filter(o => o.estado === 'pendiente').length;
    const proc = activas.filter(o => o.estado === 'en_proceso' || o.estado === 'produccion').length;
    const qc = activas.filter(o => o.estado === 'qc').length;
    const urg = activas.filter(o => o.prioridad === 'urgente').length;
    return { pend, proc, qc, urg };
  }, [activas]);

  /* Pedidos almacén pendientes.
     FIX jun 2026 (L12): filtrar también `eliminado:true` para que admin
     cancelando un pedido no deje fantasma en el sidebar de Enrique con
     botón "→ Crear Orden" activo (regresión C-R2). */
  const pedidosPend = useMemo(() =>
    pedidos.filter(p => p.origen === 'almacen' && !p.eliminado && (p.estado === 'pendiente' || p.estado === 'aceptado')),
    [pedidos]
  );

  /* ── Handlers ── */
  /* Lógica real de arranque, reutilizable para flujo NDA y bypass de propietario */
  const arrancarOrden = useCallback(async (orden) => {
    if (!orden) return;
    try {
      const ahora = new Date().toISOString();
      const updated = {
        ...orden,
        estado: orden.estado === 'pendiente' ? 'en_proceso' : orden.estado,
        fechaInicioProduccion: orden.fechaInicioProduccion || ahora,
        produccionIniciadaPor: orden.produccionIniciadaPor || userName,
        historial: [
          ...(orden.historial || []),
          ...(orden.fechaInicioProduccion ? [] : [
            { estado: 'en_proceso', fecha: ahora, usuario: userName,
              nota: 'Producción iniciada — cronómetro arrancado' },
          ]),
        ],
      };
      await api.upsertOrden(updated);
      reloadOrd();
      setProdFlowItem(updated);
    } catch (e) {
      showToast('Error al iniciar producción: ' + (e.message || 'desconocido'));
    }
  }, [userName, reloadOrd, showToast]);

  /* Producir: muestra NDA. Bypass: Emmanuel (id='admin') arranca directo. */
  const handleProducir = useCallback((orden) => {
    if (user && user.id === 'admin') {
      arrancarOrden(orden);
      return;
    }
    setPendingNDA(orden);
  }, [user, arrancarOrden]);

  /* Cuando acepta el NDA → ejecutar el inicio real */
  const handleNDAAccept = useCallback(async () => {
    const orden = pendingNDA;
    setPendingNDA(null);
    await arrancarOrden(orden);
  }, [pendingNDA, arrancarOrden]);

  const handleNDAReject = useCallback(() => {
    setPendingNDA(null);
    showToast('NDA rechazado — la producción NO se inició.');
  }, [showToast]);

  const handleChangeStatus = useCallback((orden, nextState) => {
    const label = ESTADO_BADGE[nextState]?.label || nextState;
    setConfirmAction({
      title: 'Cambiar estado',
      message: `¿Cambiar "${orden.codigo}" de ${ESTADO_BADGE[orden.estado]?.label || orden.estado} a ${label}?`,
      confirmLabel: `→ ${label}`,
      danger: nextState === 'cancelada',
      action: async () => {
        const updated = {
          ...orden,
          estado: nextState,
          historial: [
            ...(orden.historial || []),
            { estado: nextState, fecha: new Date().toISOString(), usuario: userName, nota: `Estado cambiado a ${label}` },
          ],
        };
        await api.upsertOrden(updated);
        reloadOrd();
        showToast(`${orden.codigo} → ${label}`);
      },
    });
  }, [userName, reloadOrd, showToast]);

  const handleDelete = useCallback(async (orden) => {
    /* Refactor: en vez de setConfirmAction + window.prompt nativo (no funciona
       bien en PWA móvil porque el prompt nativo está bloqueado en standalone),
       usamos directamente useConfirm con prompt para el PIN. Esto da un modal
       consistente con el design system y un input que SÍ se ve en cualquier
       dispositivo. */
    const motivo = await confirm(
      `Vas a eliminar la orden "${orden.codigo}" (${orden.formula}). Se revertirán los descuentos de materia prima si aplica. Indica el motivo para el registro de auditoría.`,
      {
        title: 'Eliminar orden — paso 1 de 2',
        confirmText: 'Continuar',
        danger: true,
        prompt: {
          label: 'Motivo de eliminación',
          placeholder: 'Ej: Error de captura, orden duplicada, cancelación del cliente...',
          required: true,
          minLength: 5,
          rows: 3,
        },
      }
    );
    if (!motivo) return;

    const pin = await confirm(
      `Para confirmar la eliminación, ingresa tu PIN (${userName}).`,
      {
        title: 'Eliminar orden — paso 2 de 2',
        confirmText: 'Eliminar definitivamente',
        danger: true,
        prompt: {
          label: 'PIN',
          placeholder: '0000',
          required: true,
          minLength: 4,
          maxLength: 6,
          rows: 1,
          numeric: true,
          password: true,
        },
      }
    );
    if (!pin) {
      showToast('Eliminación cancelada (sin PIN)');
      return;
    }

    try {
      await api.eliminarOrden(orden.id, userName, pin, motivo);
      reloadOrd();
      showToast(`${orden.codigo} eliminada`);
    } catch (e) {
      showToast('Error: ' + (e?.data?.error || e.message || 'No se pudo eliminar'));
    }
  }, [userName, reloadOrd, showToast, confirm]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction?.action) return;
    try {
      await confirmAction.action();
    } catch (err) {
      showToast('Error: ' + (err.message || 'Operación fallida'));
    }
    setConfirmAction(null);
  }, [confirmAction, showToast]);

  if (loading) {
    return (
      <>
        <TopBar title="Órdenes" />
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Órdenes" />
      <div style={S.wrap}>
        {/* Main tabs */}
        <div style={S.mainTabs}>
          {mainTabs.map(t => (
            <button key={t.id} style={S.mainTab(t.id === mainTab)} onClick={() => setMainTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════ FÁBRICA TAB ════════ */}
        {mainTab === 'ordenes' && (
          <>
            {/* Pedidos de almacén pending */}
            {pedidosPend.length > 0 && (rol === 'admin' || rol === 'tecnico') && (
              <div style={{
                background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
                border: '1.5px solid var(--lp-border-subtle)', padding: 16, marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 10 }}>
                  Pedidos de Almacén ({pedidosPend.length})
                </div>
                {pedidosPend.map(ped => {
                  const yaTieneOrden = !!ped.ordenId;
                  return (
                  <div key={ped.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8, padding: '8px 0', borderBottom: '1px solid var(--lp-border-subtle)',
                    ...(ped.esPrueba ? { background: 'var(--lp-warning-100)', padding: '8px', borderRadius: 4, borderLeft: '3px solid var(--lp-warning-600)' } : {}),
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>
                      {ped.producto} <span style={{ fontSize: 11, color: 'var(--lp-text-secondary)', fontWeight: 400 }}>x{ped.cantidad}</span>
                      {ped.esPrueba && <span style={S.badge('warn')}>PRUEBA</span>}
                      {ped.codigo && <span style={{ fontSize: 10, color: 'var(--lp-text-tertiary)', marginLeft: 6 }}>{ped.codigo}</span>}
                    </div>
                    <span style={S.badge(ped.estado === 'aceptado' ? 'ok' : 'warn')}>
                      {ped.estado === 'aceptado' ? 'En cola' : 'Pendiente'}
                    </span>
                    {/* Sprint C: botón "→ Crear Orden" — abre modal con pedido prefilled.
                       Si ya tiene ordenId, lo indica (idempotencia). */}
                    {canManage && !yaTieneOrden && (
                      <button
                        style={{ ...S.btnNew, padding: '6px 10px', fontSize: 11, minHeight: 36 }}
                        onClick={() => { setPedidoOrigenModal(ped); setShowNewModal(true); }}
                        title="Crear orden vinculada a este pedido"
                      >→ Crear Orden</button>
                    )}
                    {yaTieneOrden && (
                      <span style={{ fontSize: 10, color: 'var(--lp-success-700)', fontWeight: 600 }}>
                        ✓ Orden creada
                      </span>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            {/* Sub-tabs + toolbar — separa pruebas y canceladas para no contaminar la vista */}
            <div style={S.subTabs}>
              {[
                { id: 'activas',     label: `Activas (${activas.length})` },
                ...(pruebasActivas.length > 0 ? [{ id: 'pruebas', label: `🧪 Pruebas (${pruebasActivas.length})` }] : []),
                ...(canceladas.length > 0     ? [{ id: 'canceladas', label: `✕ Canceladas (${canceladas.length})` }] : []),
                { id: 'todas',       label: 'Historial' },
              ].map(t => (
                <button key={t.id} style={S.subTab(t.id === subTab)} onClick={() => setSubTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {subTab === 'activas' && (
              <>
                {/* Toolbar: search + new order button */}
                <div style={S.toolbar}>
                  <input type="text" style={S.search} placeholder="Buscar orden..."
                    value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                  {canManage && (
                    <button style={S.btnNew} onClick={() => setShowNewModal(true)}>
                      + Nueva Orden
                    </button>
                  )}
                </div>

                {/* KPIs */}
                <div style={S.kpiGrid}>
                  <div style={S.kpi('var(--lp-brand-100)')}>
                    <div style={S.kpiLabel('var(--lp-brand-700)')}>Pendientes</div>
                    <div style={S.kpiValue('var(--lp-brand-700)')}>{kpis.pend}</div>
                  </div>
                  <div style={S.kpi('var(--lp-warning-100)')}>
                    <div style={S.kpiLabel('var(--lp-warning-600)')}>En Proceso</div>
                    <div style={S.kpiValue('var(--lp-warning-600)')}>{kpis.proc}</div>
                  </div>
                  <div style={S.kpi('#EDE9FE')}>
                    <div style={S.kpiLabel('#7C3AED')}>QC</div>
                    <div style={S.kpiValue('#7C3AED')}>{kpis.qc}</div>
                  </div>
                  {kpis.urg > 0 && (
                    <div style={S.kpi('var(--lp-danger-100)')}>
                      <div style={S.kpiLabel('var(--lp-danger-600)')}>Urgentes</div>
                      <div style={S.kpiValue('var(--lp-danger-600)')}>{kpis.urg}</div>
                    </div>
                  )}
                </div>

                {filteredActivas.length === 0 ? (
                  <div style={{ ...S.empty, padding: '60px 20px' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 8 }}>
                      {searchQ ? 'Sin resultados' : 'Sin órdenes activas'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
                      {searchQ ? `No se encontró "${searchQ}"` : 'Crea una nueva orden para comenzar.'}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                    gap: 12,
                  }}>
                  {filteredActivas.map(o => (
                    <OrdenCard key={o.id} orden={o} canManage={canManage} canDelete={canDelete}
                      onChangeStatus={handleChangeStatus} onDelete={handleDelete}
                      onProducir={handleProducir}
                      onIrPedido={(ord) => navigate('/pedidos' + (ord.pedidoId ? '?focus=' + encodeURIComponent(ord.pedidoId) : ''))} />
                  ))}
                  </div>
                )}
              </>
            )}

            {subTab === 'pruebas' && (
              pruebasActivas.length === 0 ? (
                <div style={S.empty}>Sin órdenes de prueba activas.</div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:12 }}>
                  {pruebasActivas.map(o => (
                    <OrdenCard key={o.id} orden={o} canManage={canManage} canDelete={canDelete}
                      onChangeStatus={handleChangeStatus} onDelete={handleDelete}
                      onProducir={handleProducir}
                      onIrPedido={(ord) => navigate('/pedidos' + (ord.pedidoId ? '?focus=' + encodeURIComponent(ord.pedidoId) : ''))} />
                  ))}
                </div>
              )
            )}

            {subTab === 'canceladas' && (
              canceladas.length === 0 ? (
                <div style={S.empty}>Sin órdenes canceladas.</div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))', gap:12 }}>
                  {canceladas.map(o => (
                    <OrdenCard key={o.id} orden={o} canManage={canManage} canDelete={canDelete}
                      onChangeStatus={handleChangeStatus} onDelete={handleDelete} />
                  ))}
                </div>
              )
            )}

            {subTab === 'todas' && (
              historialGroups.length === 0 ? (
                <div style={S.empty}>Sin órdenes registradas.</div>
              ) : (
                historialGroups.map(g => (
                  <OrderGroup key={g.status} label={g.label} badgeCls={g.badgeCls}
                    orders={g.orders} canManage={canManage} canDelete={canDelete}
                    onChangeStatus={handleChangeStatus} onDelete={handleDelete} />
                ))
              )
            )}
          </>
        )}

        {/* ════════ ALMACÉN TERÁN TAB ════════ */}
        {mainTab === 'pedidos' && (
          <PedidosTab pedidos={pedidos} rol={rol} userName={userName}
            formulas={formulas} onReload={reloadPed} showToast={showToast} navigate={navigate} />
        )}

        {/* ════════ OC MP TAB ════════ */}
        {mainTab === 'compras' && (
          <OCMPTab rol={rol} userName={userName} showToast={showToast} />
        )}
      </div>

      {/* ── Nueva Orden Modal ── */}
      {showNewModal && (
        <NuevaOrdenModal
          formulas={formulas}
          ordenes={ordenes}
          userName={userName}
          pedidoOrigen={pedidoOrigenModal}
          onClose={() => { setShowNewModal(false); setPedidoOrigenModal(null); }}
          onSuccess={(msg) => {
            setShowNewModal(false);
            setPedidoOrigenModal(null);
            reloadOrd();
            reloadPed();
            showToast(msg);
            /* Activa la sub-tab de Activas para que el usuario vea su orden */
            setSubTab('activas');
            setMainTab('ordenes');
          }}
        />
      )}

      {/* ── Confirm Modal ── */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          danger={confirmAction.danger}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* NDA gate antes del flujo de producción */}
      {pendingNDA && (
        <NDAModal
          user={user}
          context="produccion"
          productoNombre={pendingNDA.formula || pendingNDA.producto}
          onAccept={handleNDAAccept}
          onReject={handleNDAReject}
        />
      )}

      {/* ── ProduccionFlow modal (paso-a-paso desde Órdenes) ── */}
      {prodFlowItem && (
        <div style={S.overlay} onClick={() => setProdFlowItem(null)}>
          <div style={{ ...S.modal, maxWidth: 720, width: '100%' }} onClick={e => e.stopPropagation()}>
            <ProduccionFlow
              item={{
                _tipo: 'orden',
                _raw: prodFlowItem,
                id: prodFlowItem.id,
                codigo: prodFlowItem.codigo,
                formula: prodFlowItem.formula,
                cantidad: prodFlowItem.cantidad,
                esPrueba: prodFlowItem.esPrueba,
                fechaInicioProduccion: prodFlowItem.fechaInicioProduccion,
              }}
              userName={userName}
              onClose={() => setProdFlowItem(null)}
              onSuccess={(msg) => {
                setProdFlowItem(null);
                reloadOrd();
                showToast(msg);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toastMsg && (
        <div style={S.toast}>
          <span style={{ marginRight: 8 }}>✓</span>
          {toastMsg}
        </div>
      )}
    </>
  );
}

/* ── Pedidos Tab (Almacén Terán) ── */
const PED_ESTADO = {
  pendiente:    { cls: 'warn',    label: 'Pendiente' },
  aceptado:     { cls: 'info',    label: 'Aceptado' },
  en_produccion:{ cls: 'info',    label: 'En Producción' },
  producido:    { cls: 'purple',  label: 'Producido' },
  en_recoleccion:{ cls: 'warn',   label: 'En Recolección' },
  en_camino:    { cls: 'info',    label: 'En Camino' },
  en_almacen:   { cls: 'ok',      label: 'En Almacén' },
  entregado:    { cls: 'ok',      label: 'Entregado' },
  rechazado:    { cls: 'err',     label: 'Rechazado' },
  cancelado:    { cls: 'neutral', label: 'Cancelado' },
};

function NuevoPedidoModal({ formulas, userName, onClose, onSuccess }) {
  const [producto, setProducto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [nota, setNota] = useState('');
  const [esPrueba, setEsPrueba] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [confirm, ConfirmEl] = useConfirm();

  const filtered = useMemo(() => {
    if (!search) return formulas;
    const q = search.toLowerCase();
    return formulas.filter(f => f.nombre.toLowerCase().includes(q));
  }, [formulas, search]);

  const handleSubmit = async () => {
    if (!producto) return setError('Selecciona un producto');
    const qty = parseInt(cantidad);
    if (!qty || qty < 1) return setError('Cantidad debe ser ≥ 1');
    setError('');
    setSaving(true);
    try {
      const pedido = {
        id: 'PED-' + Date.now(),
        producto,
        cantidad: qty,
        nota: nota || '',
        estado: 'pendiente',
        origen: 'almacen',
        esPrueba: !!esPrueba,
        fecha: new Date().toISOString().substring(0, 10),
        solicitante: userName || 'Almacén',
        historial: [{
          estado: 'pendiente',
          fecha: new Date().toISOString(),
          usuario: userName || '?',
          nota: (esPrueba ? '[PRUEBA] ' : '') + 'Pedido creado',
        }],
      };
      await api.upsertPedido(pedido);
      onSuccess(`Pedido enviado: ${producto} x${qty}`);
    } catch (err) {
      setError(err.message || 'Error al crear pedido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Nuevo Pedido a Fábrica</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--lp-text-tertiary)' }} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <label style={S.fieldLabel}>Producto *</label>
          <input
            style={S.fieldInput}
            placeholder="Buscar producto..."
            value={search}
            onChange={e => { setSearch(e.target.value); setProducto(''); }}
          />
          {search && !producto && filtered.length > 0 && (
            <div style={{
              maxHeight: 180, overflowY: 'auto', border: '1.5px solid var(--lp-border-subtle)',
              borderRadius: 8, marginTop: -8, marginBottom: 12, background: '#fff',
            }}>
              {filtered.slice(0, 20).map(f => (
                <div
                  key={f.nombre}
                  style={{
                    padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                    borderBottom: '1px solid var(--lp-border-subtle)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-brand-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  onClick={() => { setProducto(f.nombre); setSearch(f.nombre); }}
                >
                  {f.nombre}
                </div>
              ))}
            </div>
          )}
          {producto && (
            <div style={{ fontSize: 11, color: 'var(--lp-success-600)', fontWeight: 600, marginTop: -8, marginBottom: 12 }}>
              ✓ {producto}
            </div>
          )}

          <label style={S.fieldLabel}>Cantidad (cubetas) *</label>
          <input style={S.fieldInput} type="number" inputMode="decimal" min="1" placeholder="Ej: 30"
            value={cantidad} onChange={e => setCantidad(e.target.value)} />

          <label style={S.fieldLabel}>Notas (opcional)</label>
          <input style={S.fieldInput} placeholder="Ej: Urgente, para cliente X"
            value={nota} onChange={e => setNota(e.target.value)} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" id="chk-ped-prueba" checked={esPrueba}
              onChange={async e => {
                const wantsCheck = e.target.checked;
                if (wantsCheck) {
                  const ok = await confirm('Modo prueba: no se descontará inventario. ¿Continuar?', { confirmText: 'Activar prueba' });
                  if (!ok) { setEsPrueba(false); return; }
                  setEsPrueba(true);
                } else {
                  setEsPrueba(false);
                }
              }}
            />
            <label htmlFor="chk-ped-prueba" style={{ fontSize: 12, color: 'var(--lp-text-secondary)' }}>
              Modo prueba (no descuenta inventario)
            </label>
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnPrimary} disabled={saving} onClick={handleSubmit}>
            {saving ? 'Enviando...' : 'Enviar Pedido'}
          </button>
        </div>
      </div>
      {ConfirmEl}
    </div>
  );
}

function PedidosTab({ pedidos, rol, userName, formulas, onReload, showToast, navigate }) {
  const [showNew, setShowNew] = useState(false);
  const [subTab, setSubTab] = useState('activos');
  const [searchQ, setSearchQ] = useState('');
  const canCreate = rol === 'admin' || rol === 'almacen';

  const almacenPedidos = useMemo(() =>
    pedidos.filter(p => p.origen === 'almacen')
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    [pedidos]
  );

  const activos = useMemo(() =>
    almacenPedidos.filter(p =>
      p.estado !== 'entregado' && p.estado !== 'cancelado' && p.estado !== 'rechazado'
    ),
    [almacenPedidos]
  );

  const historial = useMemo(() =>
    almacenPedidos.filter(p =>
      p.estado === 'entregado' || p.estado === 'cancelado' || p.estado === 'rechazado'
    ),
    [almacenPedidos]
  );

  const filtered = useMemo(() => {
    const list = subTab === 'activos' ? activos : historial;
    if (!searchQ) return list;
    const q = searchQ.toLowerCase();
    return list.filter(p =>
      (p.producto || '').toLowerCase().includes(q) ||
      (p.nota || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q)
    );
  }, [subTab, activos, historial, searchQ]);

  /* KPIs */
  const kpis = useMemo(() => ({
    pendientes: activos.filter(p => p.estado === 'pendiente').length,
    aceptados: activos.filter(p => p.estado === 'aceptado' || p.estado === 'en_produccion').length,
    enCamino: activos.filter(p => p.estado === 'en_recoleccion' || p.estado === 'en_camino').length,
    total: activos.length,
  }), [activos]);

  return (
    <>
      {/* Sub-tabs */}
      <div style={S.subTabs}>
        {[{ id: 'activos', label: 'Activos' }, { id: 'historial', label: 'Historial' }].map(t => (
          <button key={t.id} style={S.subTab(t.id === subTab)} onClick={() => setSubTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input type="text" style={S.search} placeholder="Buscar pedido..."
          value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        {canCreate && (
          <button style={S.btnNew} onClick={() => setShowNew(true)}>
            + Nuevo Pedido
          </button>
        )}
      </div>

      {/* KPIs */}
      {subTab === 'activos' && (
        <div style={S.kpiGrid}>
          <div style={S.kpi('var(--lp-warning-100)')}>
            <div style={S.kpiLabel('var(--lp-warning-600)')}>Pendientes</div>
            <div style={S.kpiValue('var(--lp-warning-600)')}>{kpis.pendientes}</div>
          </div>
          <div style={S.kpi('var(--lp-brand-100)')}>
            <div style={S.kpiLabel('var(--lp-brand-700)')}>En Producción</div>
            <div style={S.kpiValue('var(--lp-brand-700)')}>{kpis.aceptados}</div>
          </div>
          <div style={S.kpi('#EDE9FE')}>
            <div style={S.kpiLabel('#7C3AED')}>En Camino</div>
            <div style={S.kpiValue('#7C3AED')}>{kpis.enCamino}</div>
          </div>
          <div style={S.kpi('var(--lp-success-100)')}>
            <div style={S.kpiLabel('var(--lp-success-600)')}>Total Activos</div>
            <div style={S.kpiValue('var(--lp-success-600)')}>{kpis.total}</div>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ ...S.empty, padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{subTab === 'activos' ? '📋' : '📦'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 8 }}>
            {searchQ ? 'Sin resultados' : subTab === 'activos' ? 'Sin pedidos activos' : 'Sin historial'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
            {searchQ ? `No se encontró "${searchQ}"` : subTab === 'activos' ? 'Crea un pedido para solicitar producción.' : ''}
          </div>
        </div>
      ) : (
        filtered.map(p => {
          const est = PED_ESTADO[p.estado] || { cls: 'neutral', label: p.estado };
          const isPrueba = p.esPrueba === true;
          return (
            <div key={p.id} style={S.card(isPrueba)}>
              <div style={S.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={S.cardCode}>{p.id}</span>
                  {isPrueba && <span style={S.badge('warn')}>🧪 PRUEBA</span>}
                  <span style={S.badge(est.cls)}>{est.label}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>{p.fecha}</span>
              </div>
              <div style={S.cardTitle}>{p.producto}</div>
              <div style={S.cardMeta}>
                {p.cantidad} cubetas
                {p.nota ? ` · ${p.nota}` : ''}
                {p.solicitante ? ` · Solicitante: ${p.solicitante}` : ''}
              </div>
            </div>
          );
        })
      )}

      {/* Modal nuevo pedido — al crear se redirige a /pedidos para que el técnico
          (Enrique) lo vea inmediatamente y pueda Aceptar + Iniciar producción. */}
      {showNew && (
        <NuevoPedidoModal
          formulas={formulas}
          userName={userName}
          onClose={() => setShowNew(false)}
          onSuccess={(msg) => {
            setShowNew(false);
            onReload();
            showToast(msg + ' — abriendo Pedidos…');
            /* Llevar al usuario donde el pedido es accionable */
            setTimeout(() => navigate('/pedidos'), 600);
          }}
        />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   OC MP TAB — Órdenes de Compra de Materia Prima
   - Lista de OCs/solicitudes con badges por estado
   - Botón "Nueva Solicitud" para admin/tecnico/compras
   - Modal permite agregar 1+ MPs con kg, prioridad, notas y proveedor sugerido
   - Al guardar, llama /api/ordenes-compra/solicitud → backend hace broadcast
     WebSocket evento 'oc' tipo 'solicitud_nueva' → Arely recibe push
   ════════════════════════════════════════════════════════════════════════ */
const OC_ESTADO_BADGE = {
  pendiente_aprobacion: { cls: 'warn',    label: 'Pendiente Aprobación' },
  pendiente:            { cls: 'warn',    label: 'Pendiente' },
  aprobada:             { cls: 'info',    label: 'Aprobada' },
  enviada:              { cls: 'info',    label: 'Enviada' },
  recibida_parcial:     { cls: 'warn',    label: 'Recibida Parcial' },
  recibida:             { cls: 'ok',      label: 'Recibida' },
  eliminada:            { cls: 'err',     label: 'Eliminada' },
  rechazada:            { cls: 'err',     label: 'Rechazada' },
};
const OC_PRIO_BADGE = {
  urgente: { cls: 'err',  label: 'URGENTE' },
  alta:    { cls: 'warn', label: 'ALTA' },
  normal:  { cls: 'ok',   label: 'NORMAL' },
  baja:    { cls: 'neutral', label: 'BAJA' },
};

function OCMPTab({ rol, userName, showToast }) {
  const [ocs, setOcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState('activas'); /* activas | mias | historial */

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.getOrdenesCompra();
      const arr = r?.data || (Array.isArray(r) ? r : []);
      setOcs(Array.isArray(arr) ? arr : []);
    } catch (e) {
      showToast('Error al cargar OCs: ' + (e?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  /* Filtros */
  const filtered = useMemo(() => {
    if (!Array.isArray(ocs)) return [];
    let list = ocs.filter(o => o && !o.eliminada && o.estado !== 'eliminada');
    if (filter === 'mias') {
      list = list.filter(o => o.creadoPor === userName);
    } else if (filter === 'historial') {
      list = ocs.filter(o => o); /* todo, incluye eliminadas */
    } else {
      /* activas: lo que necesita atención */
      list = list.filter(o => ['pendiente_aprobacion','pendiente','aprobada','enviada','recibida_parcial'].includes(o.estado));
    }
    /* Más recientes primero */
    return list.sort((a, b) => {
      const fa = new Date(a.fechaCreacion || 0).getTime();
      const fb = new Date(b.fechaCreacion || 0).getTime();
      return fb - fa;
    });
  }, [ocs, filter, userName]);

  /* KPIs */
  const kpis = useMemo(() => {
    const activas = ocs.filter(o => o && !o.eliminada && ['pendiente_aprobacion','pendiente','aprobada','enviada'].includes(o.estado));
    return {
      pend: ocs.filter(o => o.estado === 'pendiente_aprobacion').length,
      activas: activas.length,
      urgentes: activas.filter(o => o.prioridad === 'urgente').length,
      mias: ocs.filter(o => o.creadoPor === userName && !o.eliminada).length,
    };
  }, [ocs, userName]);

  /* Permisos */
  const canSolicitar = rol === 'admin' || rol === 'tecnico' || rol === 'compras';

  return (
    <>
      {/* Filtros */}
      <div style={S.subTabs}>
        {[
          { id: 'activas',    label: `Activas (${kpis.activas})` },
          { id: 'mias',       label: `Mis solicitudes (${kpis.mias})` },
          { id: 'historial',  label: 'Historial' },
        ].map(t => (
          <button key={t.id} style={S.subTab(t.id === filter)} onClick={() => setFilter(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar + Nueva Solicitud */}
      {canSolicitar && (
        <div style={{ ...S.toolbar, justifyContent: 'flex-end' }}>
          <button style={S.btnNew} onClick={() => setShowNew(true)}>
            + Nueva Solicitud
          </button>
        </div>
      )}

      {/* KPIs */}
      <div style={S.kpiGrid}>
        <div style={S.kpi('var(--lp-warning-100)')}>
          <div style={S.kpiLabel('var(--lp-warning-600)')}>Pendientes aprobación</div>
          <div style={S.kpiValue('var(--lp-warning-600)')}>{kpis.pend}</div>
        </div>
        <div style={S.kpi('var(--lp-brand-100)')}>
          <div style={S.kpiLabel('var(--lp-brand-700)')}>Activas</div>
          <div style={S.kpiValue('var(--lp-brand-700)')}>{kpis.activas}</div>
        </div>
        {kpis.urgentes > 0 && (
          <div style={S.kpi('var(--lp-danger-100)')}>
            <div style={S.kpiLabel('var(--lp-danger-600)')}>Urgentes</div>
            <div style={S.kpiValue('var(--lp-danger-600)')}>{kpis.urgentes}</div>
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={S.spinner}><div className="lp-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>
            {filter === 'mias' ? 'No tienes solicitudes propias' : 'Sin OCs en este filtro'}
          </div>
          {canSolicitar && (
            <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 8 }}>
              Pulsa "Nueva Solicitud" para pedir MP a compras.
            </div>
          )}
        </div>
      ) : (
        filtered.map(oc => <OCCard key={oc.id} oc={oc} />)
      )}

      {showNew && (
        <SolicitudMPModal
          userName={userName}
          onClose={() => setShowNew(false)}
          onSuccess={(oc) => {
            setShowNew(false);
            reload();
            showToast(`Solicitud ${oc.codigo} enviada a compras`);
            setFilter('mias');
          }}
        />
      )}
    </>
  );
}

function OCCard({ oc }) {
  const estado = OC_ESTADO_BADGE[oc.estado] || { cls: 'neutral', label: oc.estado || '-' };
  const prio = OC_PRIO_BADGE[oc.prioridad] || { cls: 'neutral', label: oc.prioridad || '-' };
  const fecha = oc.fechaCreacion ? new Date(oc.fechaCreacion).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }) : '-';
  const itemsCount = Array.isArray(oc.items) ? oc.items.length : 0;
  const totalKg = Array.isArray(oc.items) ? oc.items.reduce((s, i) => s + (Number(i.kg) || 0), 0) : 0;
  return (
    <div style={S.card(false)}>
      <div style={S.cardHeader}>
        <div>
          <div style={S.cardCode}>{oc.codigo || oc.id}</div>
          <div style={S.cardTitle}>{oc.proveedor || 'POR ASIGNAR'}</div>
          <div style={S.cardMeta}>
            {fecha} · {oc.creadoPor || '?'} · {itemsCount} MP{itemsCount !== 1 ? 's' : ''} · {totalKg.toFixed(0)} kg total
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <span style={S.badge(estado.cls)}>{estado.label}</span>
          <span style={S.badge(prio.cls)}>{prio.label}</span>
        </div>
      </div>

      {/* Lista de items */}
      {Array.isArray(oc.items) && oc.items.length > 0 && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--lp-border-subtle)' }}>
          {oc.items.map((it, idx) => (
            <div key={idx} style={{
              display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              borderBottom: idx < oc.items.length - 1 ? '1px solid var(--lp-border-subtle)' : 'none',
              fontSize: 12,
            }}>
              <span style={{ color: 'var(--lp-text-primary)', fontWeight: 500 }}>{it.mp}</span>
              <span style={{ color: 'var(--lp-text-secondary)' }}>
                {Number(it.kg).toFixed(0)} kg
                {it.presentacion ? ` · ${it.presentacion}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {oc.notas && (
        <div style={{
          padding: '8px 14px', borderTop: '1px solid var(--lp-border-subtle)',
          fontSize: 11, color: 'var(--lp-text-secondary)', fontStyle: 'italic',
        }}>
          "{oc.notas}"
        </div>
      )}
    </div>
  );
}

function SolicitudMPModal({ userName, onClose, onSuccess }) {
  const [mpsDisponibles, setMpsDisponibles] = useState([]);
  const [items, setItems] = useState([{ mp: '', kg: '', presentacion: '' }]);
  const [prioridad, setPrioridad] = useState('normal');
  const [notas, setNotas] = useState('');
  const [proveedorSugerido, setProveedorSugerido] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  /* Cargar lista de MPs disponibles para autocomplete */
  useEffect(() => {
    let alive = true;
    api.getMaestroMP().then(r => {
      if (!alive) return;
      const mps = r?.mps || r?.data?.mps || {};
      const lista = Object.keys(mps)
        .filter(k => {
          const m = mps[k] || {};
          return m.estado !== 'eliminado';
        })
        .sort((a, b) => a.localeCompare(b));
      setMpsDisponibles(lista);
    }).catch(() => {
      /* Si falla maestro, usar fallback de inventario */
      api.getInventario().then(r => {
        if (!alive) return;
        const mps = r?.mp || r?.data?.mp || {};
        setMpsDisponibles(Object.keys(mps).sort((a, b) => a.localeCompare(b)));
      }).catch(() => {});
    });
    return () => { alive = false; };
  }, []);

  const updateItem = (idx, patch) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const addItem = () => setItems(prev => [...prev, { mp: '', kg: '', presentacion: '' }]);
  const removeItem = (idx) => setItems(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    setError('');
    /* Validar */
    const itemsLimpios = items
      .map(it => ({ mp: (it.mp || '').trim(), kg: Number(it.kg), presentacion: (it.presentacion || '').trim() }))
      .filter(it => it.mp && it.kg > 0);
    if (itemsLimpios.length === 0) {
      setError('Agrega al menos una MP con cantidad > 0');
      return;
    }
    setSaving(true);
    try {
      const r = await api.solicitudMP({
        mps: itemsLimpios,
        prioridad,
        notas: notas.trim() || undefined,
        proveedorSugerido: proveedorSugerido.trim() || undefined,
      });
      if (r?.ok && r?.oc) {
        onSuccess(r.oc);
      } else {
        setError(r?.error || 'No se pudo crear la solicitud');
      }
    } catch (e) {
      setError(e?.data?.error || e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)' }}>
              Nueva Solicitud de MP
            </div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
              Compras (Arely) recibirá una notificación
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
            color: 'var(--lp-text-tertiary)', lineHeight: 1, padding: 0,
          }}>×</button>
        </div>

        <div style={S.modalBody}>
          {/* Datalist global compartido por todos los selects */}
          <datalist id="mp-disponibles-list">
            {mpsDisponibles.map(m => <option key={m} value={m} />)}
          </datalist>

          {/* Items */}
          <label style={S.fieldLabel}>Materias Primas</label>
          {items.map((it, idx) => (
            <div key={idx} style={{
              display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 6,
              alignItems: 'start', marginBottom: 8,
            }}>
              <input
                type="text"
                list="mp-disponibles-list"
                style={{ ...S.fieldInput, marginBottom: 0 }}
                placeholder="Nombre de MP"
                value={it.mp}
                onChange={e => updateItem(idx, { mp: e.target.value })}
              />
              <input
                type="number"
                inputMode="decimal"
                style={{ ...S.fieldInput, marginBottom: 0 }}
                placeholder="kg"
                min="0"
                step="0.1"
                value={it.kg}
                onChange={e => updateItem(idx, { kg: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
                style={{
                  ...S.btnSecondary, minHeight: 38, padding: '8px 12px',
                  opacity: items.length === 1 ? 0.4 : 1,
                  cursor: items.length === 1 ? 'not-allowed' : 'pointer',
                }}
                title="Quitar"
              >×</button>
            </div>
          ))}
          <button type="button" onClick={addItem} style={{
            ...S.btnSecondary, fontSize: 12, padding: '6px 12px', minHeight: 36,
            marginBottom: 14,
          }}>
            + Agregar otra MP
          </button>

          <label style={S.fieldLabel}>Prioridad</label>
          <select style={S.fieldSelect} value={prioridad} onChange={e => setPrioridad(e.target.value)}>
            <option value="baja">Baja</option>
            <option value="normal">Normal</option>
            <option value="urgente">Urgente</option>
          </select>

          <label style={S.fieldLabel}>Proveedor sugerido (opcional)</label>
          <input
            type="text"
            style={S.fieldInput}
            placeholder="Si conoces el proveedor preferido"
            value={proveedorSugerido}
            onChange={e => setProveedorSugerido(e.target.value)}
          />

          <label style={S.fieldLabel}>Notas / motivo (opcional)</label>
          <textarea
            style={{ ...S.fieldInput, minHeight: 60, resize: 'vertical', fontFamily: 'var(--lp-font-sans)' }}
            placeholder="Ej: urge para terminar orden #1234"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            maxLength={500}
          />

          {error && (
            <div style={{
              padding: 10, background: 'var(--lp-danger-100)',
              color: 'var(--lp-danger-700)', borderRadius: 8, fontSize: 12,
              marginTop: 8,
            }}>{error}</div>
          )}
        </div>

        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button style={S.btnPrimary} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar a compras'}
          </button>
        </div>
      </div>
    </div>
  );
}
