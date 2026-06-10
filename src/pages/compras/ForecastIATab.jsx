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
import useIsDesktop from '../../hooks/useIsDesktop';
import { PRESENTACIONES } from './presentaciones';

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
          <div style={S.sectionTitle}>Consumo histórico (producción × fórmula) · kg/mes</div>
          {(data.consumoHistorico || []).some(m => m.consumo > 0) ? (
            <>
              <Sparkline data={data.consumoHistorico} color="var(--lp-brand-600)" />
              <table style={{ width: '100%', marginTop: 8, fontSize: 11, fontFamily: 'var(--lp-font-mono)' }}>
                <thead><tr>{data.consumoHistorico.map(m => <th key={m.periodo} style={{ textAlign: 'right', padding: 2, fontWeight: 400, color: 'var(--lp-text-tertiary)' }}>{m.periodo.slice(-2)}</th>)}</tr></thead>
                <tbody><tr>{data.consumoHistorico.map(m => <td key={m.periodo} style={{ textAlign: 'right', padding: 2 }}>{fmtN(m.consumo, 0)}</td>)}</tr></tbody>
              </table>
            </>
          ) : <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)' }}>Sin consumo de producción registrado en el periodo.</div>}
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>Compras históricas (proveedor) · kg/mes</div>
          {(data.comprasHistorico || []).some(m => m.kg > 0) ? (
            <>
              <Sparkline data={(data.comprasHistorico || []).map(m => ({ periodo: m.periodo, consumo: m.kg }))} color="var(--lp-info-600)" />
              <table style={{ width: '100%', marginTop: 8, fontSize: 11, fontFamily: 'var(--lp-font-mono)' }}>
                <thead><tr>{data.comprasHistorico.map(m => <th key={m.periodo} style={{ textAlign: 'right', padding: 2, fontWeight: 400, color: 'var(--lp-text-tertiary)' }}>{m.periodo.slice(-2)}</th>)}</tr></thead>
                <tbody><tr>{data.comprasHistorico.map(m => <td key={m.periodo} style={{ textAlign: 'right', padding: 2 }}>{fmtN(m.kg, 0)}</td>)}</tr></tbody>
              </table>
              <div style={{ fontSize: 11, color: 'var(--lp-text-secondary)', marginTop: 8, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <span>Comprado 12 m: <strong style={{ fontFamily: 'var(--lp-font-mono)' }}>{fmtN(data.comprasTotal12m, 0)} kg</strong></span>
                {data.ultimaCompra && (
                  <span style={{ color: 'var(--lp-text-tertiary)' }}>
                    Última: {data.ultimaCompra.periodo} · {fmtN(data.ultimaCompra.kg, 0)} kg{data.ultimaCompra.proveedor ? ` · ${data.ultimaCompra.proveedor}` : ''}{data.ultimaCompra.costo_unitario != null ? ` · ${data.ultimaCompra.costo_unitario} ${data.ultimaCompra.moneda || ''}/kg` : ''}
                  </span>
                )}
              </div>
            </>
          ) : <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)' }}>Sin compras registradas en el periodo.</div>}
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

/* ── Modal de confirmación de OCs bulk — KILOS y PRESENTACIÓN editables por MP ── */
const _mBtn = { width: 30, height: 34, flex: '0 0 auto', border: 'none', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', cursor: 'pointer', fontSize: 16, fontWeight: 700, lineHeight: 1 };
const _mInput = { width: 56, border: 'none', textAlign: 'center', fontFamily: 'var(--lp-font-mono)', fontSize: 12.5, fontWeight: 600, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', outline: 'none' };
const _mSelect = { flex: '0 0 auto', height: 34, maxWidth: 150, padding: '0 8px', borderRadius: 8, border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', fontSize: 12, fontFamily: 'var(--lp-font-sans)' };

function BulkOCModal({ items, onConfirm, onClose, loading }) {
  /* Estado editable por MP: cantidad + presentación, partiendo de la sugerencia. */
  const [rows, setRows] = useState(() => items.map(it => ({
    mp: it.mp,
    proveedor: it.proveedor || 'POR ASIGNAR',
    costoKg: Number(it.costoKg) || 0,
    cantidad: Math.round(Number(it.cantidadSugerida) || 0),
    presentacion: '',
  })));
  const [notas, setNotas] = useState('');

  const setCant = (mp, v) => setRows(rs => rs.map(r => r.mp === mp ? { ...r, cantidad: Math.max(0, Math.round(Number(v) || 0)) } : r));
  const bump = (mp, d) => setRows(rs => rs.map(r => r.mp === mp ? { ...r, cantidad: Math.max(0, r.cantidad + d) } : r));
  const setPres = (mp, v) => setRows(rs => rs.map(r => r.mp === mp ? { ...r, presentacion: v } : r));

  const porProveedor = useMemo(() => {
    const g = {};
    rows.forEach(r => { (g[r.proveedor] = g[r.proveedor] || []).push(r); });
    return g;
  }, [rows]);

  const totalKg = rows.reduce((s, r) => s + r.cantidad, 0);
  const totalMonto = rows.reduce((s, r) => s + r.cantidad * r.costoKg, 0);
  const nProv = Object.keys(porProveedor).length;

  return (
    <div style={S.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modalBox}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Confirmar generación de OCs</div>
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginBottom: 14 }}>
          Se crearán <strong>{nProv}</strong> OC(s) — una por proveedor — con <strong>{rows.length}</strong> MP(s). {fmtN(totalKg, 0)} kg · {fmt$(totalMonto)}. Ajusta los kilos y elige la presentación si lo necesitas.
        </div>

        <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 12 }}>
          {Object.entries(porProveedor).map(([prov, ms]) => (
            <div key={prov} style={{ marginBottom: 10, border: '1px solid var(--lp-border-subtle)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{prov} ({ms.length} MP{ms.length > 1 ? 's' : ''})</div>
              {ms.map(r => (
                <div key={r.mp} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px dashed var(--lp-border-subtle)', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.mp}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }}>{r.costoKg > 0 ? fmt$(r.cantidad * r.costoKg) : 'sin costo'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--lp-border-default)', borderRadius: 8, overflow: 'hidden' }}>
                      <button type="button" onClick={() => bump(r.mp, -10)} style={{ ..._mBtn, borderRight: '1px solid var(--lp-border-subtle)' }} aria-label="menos">−</button>
                      <input type="number" value={r.cantidad} min="0" step="10" onChange={e => setCant(r.mp, e.target.value)} style={_mInput} />
                      <button type="button" onClick={() => bump(r.mp, 10)} style={{ ..._mBtn, borderLeft: '1px solid var(--lp-border-subtle)', color: 'var(--lp-brand-600)' }} aria-label="más">+</button>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginLeft: 4 }}>kg</span>
                  </div>
                  <select value={r.presentacion} onChange={e => setPres(r.mp, e.target.value)} style={_mSelect}>
                    {PRESENTACIONES.map(p => <option key={p.v} value={p.v}>{p.lbl}</option>)}
                  </select>
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
          <button style={S.btnPrimary} onClick={() => onConfirm(notas, rows.filter(r => r.cantidad > 0))} disabled={loading || totalKg <= 0}>
            {loading ? 'Creando…' : `Crear ${nProv} OC(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */
/* Mini gráfico de barras: CONSUMO MENSUAL de los últimos 12 meses.
   Rotulado (título + escala + meses) para que la card sea interpretable de un vistazo. */
const _MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const _mesAbr = (periodo) => _MESES_ABR[Number((periodo || '').slice(-2)) - 1] || '';

function BarsMini({ data, accent }) {
  const rows = data || [];
  const vals = rows.map(d => Number(d.consumo) || 0);
  if (rows.length === 0) return null;
  const total = vals.reduce((s, v) => s + v, 0);
  const max = Math.max(...vals, 1);
  const brand = accent || 'var(--lp-brand-600)';

  /* Cabecera común: dice EXACTAMENTE qué se está graficando. */
  const Header = ({ right }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', marginBottom: 6 }}>
      <span>Consumo mensual · 12 m</span>
      {right && <span style={{ fontFamily: 'var(--lp-font-mono)', textTransform: 'none', letterSpacing: 0 }}>{right}</span>}
    </div>
  );

  /* Sin consumo en todo el periodo → no dibujar barras falsas. */
  if (total <= 0) {
    return (
      <div style={{ margin: '12px 0 14px' }}>
        <Header />
        <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--lp-text-tertiary)', background: 'var(--lp-bg-sunken)', borderRadius: 8, border: '1px dashed var(--lp-border-subtle)' }}>
          Sin consumo registrado en 12 meses
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: '12px 0 14px' }}>
      <Header right={`pico ${Math.round(max).toLocaleString('es-MX')} kg`} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
        {vals.map((v, i) => {
          const last = i === vals.length - 1;
          const cero = v <= 0;
          return (
            <div key={i} title={`${_mesAbr(rows[i]?.periodo)}: ${Math.round(v).toLocaleString('es-MX')} kg`}
              style={{
                flex: 1, minHeight: 2, borderRadius: 3,
                height: cero ? '3%' : `${Math.max(12, (v / max) * 100)}%`,
                background: cero ? 'var(--lp-border-subtle)' : (last ? brand : `color-mix(in srgb, ${brand} 30%, transparent)`),
              }} />
          );
        })}
      </div>
      {/* Eje X: primer y último mes del rango + leyenda del mes destacado. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--lp-text-tertiary)', marginTop: 5, fontFamily: 'var(--lp-font-mono)' }}>
        <span>{_mesAbr(rows[0]?.periodo)}</span>
        <span style={{ color: 'var(--lp-text-secondary)', fontWeight: 600 }}>{_mesAbr(rows[rows.length - 1]?.periodo)} · más reciente</span>
      </div>
    </div>
  );
}

export default function ForecastIATab() {
  const { user } = useAuth();
  const toast = useToast();
  const isDesktop = useIsDesktop();
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

  const handleCrearBulk = async (notas, rows) => {
    setCreandoBulk(true);
    try {
      /* rows viene del modal con cantidad + presentación editadas; fallback a la sugerencia. */
      const fuente = (Array.isArray(rows) && rows.length) ? rows : seleccionadas;
      const items = fuente.map(s => ({
        mp: s.mp,
        cantidad: s.cantidad != null ? s.cantidad : s.cantidadSugerida,
        proveedor: s.proveedor,
        presentacion: s.presentacion || '',
      }));
      const r = await api.generarOCsBulkForecast(items, notas);
      toast.success(`✓ ${r.total} OC(s) creadas correctamente`, { duration: 5000 });
      setMostrarBulk(false);
      setSeleccion({});
      cargar();
    } catch (e) {
      toast.error('Error al crear OCs: ' + (e?.data?.error || e.message));
    } finally { setCreandoBulk(false); }
  };

  /* errbox del mockup: mensaje + Reintentar (recarga el forecast) */
  if (err) return (
    <div style={{ background: 'color-mix(in srgb, var(--lp-danger-600) 9%, var(--lp-bg-raised))', border: '1px solid color-mix(in srgb, var(--lp-danger-600) 26%, transparent)', color: 'var(--lp-danger-600)', borderRadius: 14, padding: '14px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 11 }}
      data-id="pronostico.state.error" data-rol="compras,admin">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
      <span style={{ flex: 1, minWidth: 160 }}>No se pudo calcular el forecast ({err}).</span>
      <button type="button" data-id="pronostico.btn.reintentar" data-rol="compras,admin" onClick={cargar}
        style={{ height: 34, padding: '0 14px', borderRadius: 10, border: '1px solid var(--lp-border-subtle)', background: 'transparent', color: 'var(--lp-text-secondary)', fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
        Reintentar
      </button>
    </div>
  );

  const k = datos.kpis || {};
  /* Carrito = MPs marcadas (seleccionadas). Una OC por proveedor (BulkOCModal agrupa). */
  const sugeridasCount = filtradas.filter(f => f.sugerir).length;
  const totalKgSel = seleccionadas.reduce((s, x) => s + (Number(x.cantidadSugerida) || 0), 0);
  const totalMontoSel = seleccionadas.reduce((s, x) => s + (Number(x.montoEstimado) || 0), 0);
  const provCountSel = new Set(seleccionadas.map(x => x.proveedor || 'POR ASIGNAR')).size;

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

      {/* ── Toolbar: buscar · recalcular · seleccionar todas (al carrito) ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input style={{ ...S.search, maxWidth: 280 }} type="text" placeholder="Buscar materia prima…" value={search} onChange={e => setSearch(e.target.value)} />
        <button style={S.btnGhost} onClick={cargar}>↻ Recalcular</button>
        <div style={{ flex: 1 }} />
        {puedeCrearOCs && sugeridasCount > 0 && (
          <button style={S.btnGhost} onClick={toggleSelAll}>
            {seleccionadas.length === sugeridasCount ? 'Quitar todas' : `Seleccionar todas (${sugeridasCount})`}
          </button>
        )}
      </div>

      {/* ── MATERIAS PRIMAS POR REABASTECER — cards 1:1 mockup ── */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '2px 0 10px' }}>Materias primas por reabastecer</div>
      {loading ? (
        /* skeleton del mockup (skel + pulse) mientras corre el forecast */
        <div data-id="pronostico.state.cargando">
          <style>{`
            @keyframes lpFcPulse { 50% { opacity: .5; } }
            .lp-fc-skel { animation: lpFcPulse 1.3s cubic-bezier(.22,1,.36,1) infinite; }
            @media (prefers-reduced-motion: reduce) { .lp-fc-skel { animation: none; } }
          `}</style>
          <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)', marginBottom: 10 }}>Generando pronóstico…</div>
          {[0, 1, 2].map(i => (
            <div key={i} className="lp-fc-skel" style={{ background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, padding: 15, marginBottom: 11 }}>
              <div style={{ height: 11, borderRadius: 6, background: 'var(--lp-bg-sunken)', marginBottom: 9, width: '40%' }} />
              <div style={{ height: 11, borderRadius: 6, background: 'var(--lp-bg-sunken)', marginBottom: 9 }} />
              <div style={{ height: 11, borderRadius: 6, background: 'var(--lp-bg-sunken)', width: '60%' }} />
            </div>
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--lp-text-tertiary)', fontSize: 13.5, lineHeight: 1.5 }}>
          {search
            ? 'Sin resultados para tu búsqueda.'
            : <>Sin sugerencias de compra ahora.<br />El forecast no detecta materias primas por reabastecer.</>}
        </div>
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

                {(f.comprasTotal12m > 0 || f.ultimaCompra) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, margin: '-2px 0 12px', paddingTop: 9, borderTop: '1px solid var(--lp-border-subtle)' }}>
                    <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10, color: 'var(--lp-text-tertiary)' }}>Compras 12 m</span>
                    <span style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-secondary)' }}>
                      {fmtN(f.comprasTotal12m, 0)} kg{f.ultimaCompra ? ` · últ. ${_mesAbr(f.ultimaCompra.periodo)}` : ''}
                    </span>
                  </div>
                )}

                {puedeCrearOCs && f.sugerir && (() => {
                  const enOrden = !!seleccion[f.mp];
                  return (
                    <button data-id="forecast.btn.agregar-oc" data-rol="compras,admin" onClick={() => toggleSel(f.mp)}
                      style={{ width: '100%', minHeight: 46, borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        border: enOrden ? '1.5px solid var(--lp-brand-600)' : 'none',
                        background: enOrden ? 'color-mix(in srgb, var(--lp-brand-600) 12%, transparent)' : 'var(--lp-brand-600)',
                        color: enOrden ? 'var(--lp-brand-700)' : '#fff' }}>
                      {enOrden ? (
                        <><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> En la orden</>
                      ) : (
                        <><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg> Agregar a la orden</>
                      )}
                    </button>
                  );
                })()}
                <button data-id="forecast.btn.ver-detalle" onClick={() => setDetalleMP(f.mp)}
                  style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--lp-text-tertiary)', padding: 4 }}>
                  Ver detalle del cálculo
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Carrito flotante: varias MP → OC(s) (una por proveedor) ── */}
      {puedeCrearOCs && seleccionadas.length > 0 && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: 45, bottom: isDesktop ? 22 : 'calc(74px + env(safe-area-inset-bottom, 0px))', width: 'auto', maxWidth: 'calc(100vw - 24px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', boxShadow: '0 12px 34px rgba(0,0,0,.20)', borderRadius: 999, padding: '8px 8px 8px 16px' }}>
            <span style={{ width: 30, height: 30, flex: '0 0 auto', borderRadius: 999, background: 'var(--lp-brand-600)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 13 }}>{seleccionadas.length}</span>
            <div style={{ lineHeight: 1.25, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{seleccionadas.length === 1 ? 'materia en la orden' : 'materias en la orden'}</div>
              <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {fmtN(totalKgSel, 0)} kg · {fmt$(totalMontoSel)} · {provCountSel === 1 ? '1 OC' : `${provCountSel} OC`}
              </div>
            </div>
            <button onClick={() => setSeleccion({})} title="Vaciar" style={{ ...S.btnGhost, flex: '0 0 auto', height: 40, padding: '0 12px' }}>Vaciar</button>
            <button onClick={() => setMostrarBulk(true)} style={{ ...S.btnPrimary, flex: '0 0 auto', height: 40, padding: '0 18px', whiteSpace: 'nowrap' }}>Crear OC</button>
          </div>
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
