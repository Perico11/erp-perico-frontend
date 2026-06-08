/* ════════════════════════════════════════════════════════════════════════════
   ForecastIATab — Sugerencias automáticas de compra con IA

   Combina:
     • Demanda proyectada (WMA × estacional × YoY)
     • Lead time real por proveedor (Fase 4)
     • Safety stock 95% nivel de servicio
     • Stock + OCs en tránsito
     → Sugerencia de cantidad a comprar + prioridad
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';

const S = {
  section: { background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 14 },
  kpi: (accent) => ({ background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', borderTop: '2px solid ' + accent, borderRadius: 'var(--lp-radius)', padding: '12px 14px', minHeight: 80 }),
  kpiLabel: { fontSize: 10, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' },
  kpiVal: { fontSize: 20, fontWeight: 800, marginTop: 3, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  kpiSub: { fontSize: 10, color: 'var(--lp-text-tertiary)', marginTop: 3 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 10px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--lp-border-subtle)' },
  tdNum: { padding: '8px 10px', borderBottom: '1px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-mono)', textAlign: 'right' },
  btnPrimary: { padding: '10px 16px', fontSize: 12, fontWeight: 700, borderRadius: 'var(--lp-radius-sm)', border: 'none', background: 'var(--lp-brand-600)', color: '#fff', cursor: 'pointer' },
  btnGhost: { padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 'var(--lp-radius-sm)', border: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', cursor: 'pointer', color: 'var(--lp-text-primary)' },
  badge: (bg, fg) => ({ display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '.04em' }),
  search: { flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 'var(--lp-radius-sm)', border: '1.5px solid var(--lp-border-subtle)', fontSize: 13, background: 'var(--lp-bg-raised)', boxSizing: 'border-box' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(26,24,21,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalBox: { background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)', padding: 20, maxWidth: 720, width: '100%', maxHeight: '85vh', overflowY: 'auto', border: '1.5px solid var(--lp-border-subtle)' },
};

const PRIORIDAD_COLORS = {
  critical: { bg: 'var(--lp-danger-100)',  fg: 'var(--lp-danger-700)',  accent: 'var(--lp-danger-600)',  label: 'Crítica' },
  high:     { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-700)', accent: 'var(--lp-warning-600)', label: 'Alta' },
  medium:   { bg: 'color-mix(in srgb, var(--lp-info-600) 12%, transparent)', fg: 'var(--lp-info-600)', accent: 'var(--lp-info-600)', label: 'Media' },
  low:      { bg: 'var(--lp-bg-sunken)',   fg: 'var(--lp-text-tertiary)', accent: 'var(--lp-border-subtle)', label: 'Baja' },
};

const fmt$ = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const fmtN = (n, d = 0) => n != null ? Number(n).toFixed(d) : '—';

/* Sparkline SVG inline pequeño 12 meses */
function Sparkline({ data, color = '#7C3AED' }) {
  const valid = data.map(d => Number(d.consumo) || 0);
  const max = Math.max(...valid, 1);
  const W = 100, H = 22, pad = 1;
  const step = (W - pad * 2) / (valid.length - 1 || 1);
  const path = valid.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (H - pad * 2) * (1 - v / max);
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 100, height: 22, display: 'block' }}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
      {valid.map((v, i) => {
        const x = pad + i * step;
        const y = pad + (H - pad * 2) * (1 - v / max);
        return <circle key={i} cx={x} cy={y} r={i === valid.length - 1 ? 2 : 1} fill={color} />;
      })}
    </svg>
  );
}

/* ── Modal de detalle de una MP ─────────────────────────────────────────── */
function DetalleModal({ mp, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getForecastSugerencia(mp)
      .then(r => setData(r.data))
      .catch(e => alert(e.message))
      .finally(() => setLoading(false));
  }, [mp]);

  if (loading) return (
    <div style={S.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modalBox}>Cargando…</div>
    </div>
  );
  if (!data) return null;

  const col = PRIORIDAD_COLORS[data.prioridad] || PRIORIDAD_COLORS.low;
  return (
    <div style={S.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modalBox}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{data.mp}</h2>
          <span style={S.badge(col.bg, col.fg)}>{col.label}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginBottom: 14 }}>
          {data.proveedor || 'Sin proveedor'} · {data.categoria || 'Sin categoría'}
        </div>

        <div style={{ background: 'var(--lp-brand-50)', border: '1px solid var(--lp-brand-200)', borderRadius: 6, padding: 12, marginBottom: 14, fontSize: 12 }}>
          <strong>Diagnóstico:</strong> {data.razon}
        </div>

        <div style={S.kpiGrid}>
          <div style={S.kpi('#7C3AED')}>
            <div style={S.kpiLabel}>Stock actual</div>
            <div style={S.kpiVal}>{fmtN(data.stockActual, 1)} kg</div>
            <div style={S.kpiSub}>Mín: {data.minActual} kg</div>
          </div>
          <div style={S.kpi('#0F6E56')}>
            <div style={S.kpiLabel}>En tránsito</div>
            <div style={S.kpiVal}>{fmtN(data.enTransito, 0)} kg</div>
          </div>
          <div style={S.kpi(data.diasHastaStockout < data.leadTime.dias ? 'var(--lp-danger-600)' : 'var(--lp-success-600)')}>
            <div style={S.kpiLabel}>Días hasta stockout</div>
            <div style={S.kpiVal}>{data.diasHastaStockout}</div>
            <div style={S.kpiSub}>Lead: {data.leadTime.dias}d ({data.leadTime.fuente})</div>
          </div>
          <div style={S.kpi('#D97706')}>
            <div style={S.kpiLabel}>Consumo proy/mes</div>
            <div style={S.kpiVal}>{fmtN(data.demandaMensualProyectada, 0)}</div>
            <div style={S.kpiSub}>{fmtN(data.consumoDiario, 1)} kg/día</div>
          </div>
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>Consumo histórico 12 meses</div>
          <Sparkline data={data.consumoHistorico} />
          <table style={{ width: '100%', marginTop: 8, fontSize: 11, fontFamily: 'var(--lp-font-mono)' }}>
            <thead><tr>{data.consumoHistorico.map(m => <th key={m.periodo} style={{ textAlign: 'right', padding: 2, fontWeight: 400, color: 'var(--lp-text-tertiary)' }}>{m.periodo.slice(-2)}</th>)}</tr></thead>
            <tbody><tr>{data.consumoHistorico.map(m => <td key={m.periodo} style={{ textAlign: 'right', padding: 2 }}>{fmtN(m.consumo, 0)}</td>)}</tr></tbody>
          </table>
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>Parámetros del modelo</div>
          <table style={S.table}>
            <tbody>
              <tr><td style={S.td}>Promedio últimos 3 meses</td><td style={S.tdNum}>{fmtN(data.promedio3m, 1)} kg</td></tr>
              <tr><td style={S.td}>Promedio 12 meses</td><td style={S.tdNum}>{fmtN(data.promedio12m, 1)} kg</td></tr>
              <tr><td style={S.td}>Factor estacional aplicado</td><td style={S.tdNum}>×{data.factorEstacional}</td></tr>
              <tr><td style={S.td}>Lead time</td><td style={S.tdNum}>{data.leadTime.dias} d ({data.leadTime.fuente}, {data.leadTime.muestras} muestras)</td></tr>
              <tr><td style={S.td}>Coef. variación de demanda</td><td style={S.tdNum}>{(data.cv * 100).toFixed(0)}%</td></tr>
              <tr><td style={S.td}>Safety stock (95% nivel)</td><td style={S.tdNum}>{fmtN(data.safetyStock, 0)} kg</td></tr>
              <tr><td style={S.td}>Punto de reorden (ROP)</td><td style={S.tdNum}>{fmtN(data.rop, 0)} kg</td></tr>
              <tr><td style={S.td}>Stock proyectado</td><td style={S.tdNum}>{fmtN(data.stockProyectado, 0)} kg</td></tr>
              <tr style={{ background: 'var(--lp-brand-50)' }}>
                <td style={{ ...S.td, fontWeight: 700 }}>Cantidad sugerida</td>
                <td style={{ ...S.tdNum, fontWeight: 700, color: 'var(--lp-brand-700)' }}>{fmtN(data.cantidadSugerida, 0)} kg · {fmt$(data.montoEstimado)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button style={S.btnPrimary} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal de confirmación de OCs bulk ──────────────────────────────────── */
function BulkOCModal({ items, onConfirm, onClose, loading }) {
  /* Agrupar por proveedor para preview */
  const porProveedor = useMemo(() => {
    const grupos = {};
    items.forEach(it => {
      const p = it.proveedor || 'POR ASIGNAR';
      if (!grupos[p]) grupos[p] = [];
      grupos[p].push(it);
    });
    return grupos;
  }, [items]);

  const totalKg = items.reduce((s, x) => s + x.cantidadSugerida, 0);
  const totalMonto = items.reduce((s, x) => s + x.montoEstimado, 0);
  const [notas, setNotas] = useState('');

  return (
    <div style={S.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modalBox}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Confirmar generación de OCs</div>
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginBottom: 14 }}>
          Se crearán <strong>{Object.keys(porProveedor).length}</strong> OC(s) — una por proveedor — con <strong>{items.length}</strong> MP(s) en total. {fmtN(totalKg, 0)} kg · {fmt$(totalMonto)}
        </div>

        <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
          {Object.entries(porProveedor).map(([prov, ms]) => (
            <div key={prov} style={{ marginBottom: 10, border: '1px solid var(--lp-border-subtle)', borderRadius: 6, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{prov} ({ms.length} MPs)</div>
              {ms.map(m => (
                <div key={m.mp} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0' }}>
                  <span>{m.mp}</span>
                  <span style={{ fontFamily: 'var(--lp-font-mono)' }}>{m.cantidadSugerida} kg · {fmt$(m.montoEstimado)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-secondary)', display: 'block', marginBottom: 4 }}>Notas (opcional)</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Ej: Lote de compra mes de mayo, ya validado con proveedores..."
            style={{ width: '100%', minHeight: 60, padding: 10, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.btnGhost} onClick={onClose} disabled={loading}>Cancelar</button>
          <button style={S.btnPrimary} onClick={() => onConfirm(notas)} disabled={loading}>
            {loading ? 'Creando…' : `Crear ${Object.keys(porProveedor).length} OC(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */
/* Mini gráfico de barras (12 meses, último mes destacado) — para la card de sugerencia. */
function BarsMini({ data, accent }) {
  const vals = (data || []).map(d => Number(d.consumo) || 0);
  if (vals.length === 0) return null;
  const max = Math.max(...vals, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 42, margin: '12px 0 14px' }}>
      {vals.map((v, i) => {
        const last = i === vals.length - 1;
        return <div key={i} title={`${(data[i]?.periodo || '').slice(-2)}: ${Math.round(v)}`}
          style={{ flex: 1, minHeight: 4, height: `${Math.max(10, (v / max) * 100)}%`, borderRadius: 3,
            background: last ? (accent || 'var(--lp-brand-600)') : 'color-mix(in srgb, var(--lp-brand-600) 20%, transparent)' }} />;
      })}
    </div>
  );
}

export default function ForecastIATab() {
  const { user } = useAuth();
  const toast = useToast();
  const puedeCrearOCs = ['admin', 'compras'].includes(user?.rol);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [datos, setDatos] = useState({ kpis: {}, filas: [] });
  const [filtros, setFiltros] = useState({ proveedor: '', prioridad: '', soloSugeridas: '1' });
  const [search, setSearch] = useState('');
  const [seleccion, setSeleccion] = useState({}); /* mp → true */
  const [detalleMP, setDetalleMP] = useState(null);
  const [mostrarBulk, setMostrarBulk] = useState(false);
  const [creandoBulk, setCreandoBulk] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true); setErr('');
    api.getForecastSugerencias(filtros)
      .then(r => setDatos(r.data || { kpis: {}, filas: [] }))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [filtros]);
  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = useMemo(() => {
    if (!search) return datos.filas;
    const q = search.toLowerCase();
    return datos.filas.filter(f => f.mp.toLowerCase().includes(q));
  }, [datos.filas, search]);

  const seleccionadas = useMemo(
    () => filtradas.filter(f => seleccion[f.mp] && f.sugerir),
    [filtradas, seleccion]
  );

  const toggleSel = (mp) => setSeleccion(s => ({ ...s, [mp]: !s[mp] }));
  const toggleSelAll = () => {
    if (seleccionadas.length === filtradas.filter(f => f.sugerir).length) setSeleccion({});
    else {
      const nuevo = {};
      filtradas.filter(f => f.sugerir).forEach(f => { nuevo[f.mp] = true; });
      setSeleccion(nuevo);
    }
  };

  const handleCrearBulk = async (notas) => {
    setCreandoBulk(true);
    try {
      const items = seleccionadas.map(s => ({ mp: s.mp, cantidad: s.cantidadSugerida, proveedor: s.proveedor }));
      const r = await api.generarOCsBulkForecast(items, notas);
      toast.success(`✓ ${r.total} OC(s) creadas correctamente`, { duration: 5000 });
      setMostrarBulk(false);
      setSeleccion({});
      cargar();
    } catch (e) {
      toast.error('Error al crear OCs: ' + (e?.data?.error || e.message));
    } finally { setCreandoBulk(false); }
  };

  /* Generar UNA OC desde la card (mockup) — cae en Compras · Por aprobar. */
  const handleGenerarUna = async (f) => {
    if (!puedeCrearOCs || !f.sugerir) return;
    try {
      await api.generarOCsBulkForecast([{ mp: f.mp, cantidad: f.cantidadSugerida, proveedor: f.proveedor }], 'Generada desde Forecast IA');
      toast.success(`OC de ${f.mp} creada → Compras · Por aprobar`, { duration: 5000 });
      cargar();
    } catch (e) {
      toast.error('Error al generar OC: ' + (e?.data?.error || e.message));
    }
  };

  /* "Generar todas las sugeridas" — selecciona todas y abre el modal bulk. */
  const handleGenerarTodas = () => {
    const all = {};
    filtradas.filter(f => f.sugerir).forEach(f => { all[f.mp] = true; });
    setSeleccion(all);
    setMostrarBulk(true);
  };

  if (err) return <div style={{ background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 6, fontSize: 12 }}>{err}</div>;

  const k = datos.kpis || {};

  return (
    <>
      {/* ── FORECAST IA · RESUMEN — KPIs 1:1 mockup ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '2px 0 10px' }}>Forecast IA · Resumen</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { dot: 'var(--lp-danger-600)', label: 'Críticas', value: k.criticas || 0, sub: 'requieren OC hoy', danger: (k.criticas || 0) > 0 },
          { dot: 'var(--lp-warning-600)', label: 'Alta prioridad', value: k.altas || 0, sub: 'esta semana' },
          { dot: 'var(--lp-info-600)', label: 'MP en lista', value: k.totalMPsAnalizadas || 0, sub: 'analizadas' },
          { dot: 'var(--lp-brand-600)', label: 'Inversión sugerida', value: fmt$(k.montoEstimadoTotal), sub: 'próximos 30 días' },
        ].map((kpi, i) => (
          <div key={i} style={{ background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, padding: '13px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: kpi.dot }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--lp-text-tertiary)' }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: kpi.danger ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar mínima: buscar · recalcular · generar todas ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input style={{ ...S.search, maxWidth: 280 }} type="text" placeholder="Buscar materia prima…" value={search} onChange={e => setSearch(e.target.value)} />
        <button style={S.btnGhost} onClick={cargar}>↻ Recalcular</button>
        <div style={{ flex: 1 }} />
        {puedeCrearOCs && filtradas.filter(f => f.sugerir).length > 0 && (
          <button style={S.btnPrimary} onClick={handleGenerarTodas}>Generar todas ({filtradas.filter(f => f.sugerir).length})</button>
        )}
      </div>

      {/* ── MATERIAS PRIMAS POR REABASTECER — cards 1:1 mockup ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '2px 0 10px' }}>Materias primas por reabastecer</div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--lp-text-tertiary)', fontSize: 13 }}>Calculando sugerencias…</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--lp-text-tertiary)', fontSize: 13 }}>Sin sugerencias de compra. Tu inventario está bien cubierto.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, alignItems: 'start' }}>
          {filtradas.map(f => {
            const col = PRIORIDAD_COLORS[f.prioridad] || PRIORIDAD_COLORS.low;
            const sinCobertura = f.diasHastaStockout < (f.leadTime?.dias || 0);
            const sinStock = (f.stockActual || 0) <= 0;
            return (
              <div key={f.mp} data-id="forecast.card.mp" style={{ position: 'relative', overflow: 'hidden', background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-lg)', padding: '16px 17px', opacity: f.sugerir ? 1 : 0.6 }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: col.accent }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>{f.mp}</div>
                    <div style={{ fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 2, fontFamily: 'var(--lp-font-mono)' }}>
                      {f.sugerir ? `${fmtN(f.cantidadSugerida, 0)} kg sugeridos` : 'Cubierto'}
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', background: `color-mix(in srgb, ${col.accent} 14%, transparent)`, color: col.accent }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: col.accent }} />{col.label}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 22, marginTop: 12 }}>
                  {[
                    { v: `${fmtN(f.stockActual, 0)} kg`, l: 'Stock', danger: sinStock },
                    { v: f.diasHastaStockout < 999 ? `${f.diasHastaStockout} d` : '—', l: 'Cobertura', danger: sinCobertura },
                    { v: fmtN(f.demandaMensualProyectada, 0), l: 'Consumo/mes' },
                  ].map((st, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: st.danger ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)' }}>{st.v}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', marginTop: 2 }}>{st.l}</div>
                    </div>
                  ))}
                </div>

                <BarsMini data={f.consumoHistorico} accent={col.accent} />

                {puedeCrearOCs && f.sugerir && (
                  <button data-id="forecast.btn.generar-oc" data-rol="compras,admin" onClick={() => handleGenerarUna(f)}
                    style={{ width: '100%', minHeight: 46, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 14, fontWeight: 600, background: 'var(--lp-brand-600)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    + Generar OC
                  </button>
                )}
                <button data-id="forecast.btn.ver-detalle" onClick={() => setDetalleMP(f.mp)}
                  style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--lp-text-tertiary)', padding: 4 }}>
                  Ver detalle del cálculo
                </button>
              </div>
            );
          })}
        </div>
      )}

      {detalleMP && <DetalleModal mp={detalleMP} onClose={() => setDetalleMP(null)} />}
      {mostrarBulk && (
        <BulkOCModal items={seleccionadas} onConfirm={handleCrearBulk}
          onClose={() => setMostrarBulk(false)} loading={creandoBulk} />
      )}
    </>
  );
}
