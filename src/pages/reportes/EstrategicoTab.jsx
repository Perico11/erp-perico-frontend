/* ════════════════════════════════════════════════════════════════════════════
   EstrategicoTab — Fase 4 del sistema de control continuo de inventarios.

   Contenido:
     • Comparativa anual con gráficas SVG (valor + IRA + cobertura)
     • Lead times por proveedor (cumplimiento de promesas)
     • Curva ABC dinámica trimestral con cambios de clase
     • Costo de oportunidad por stockout
     • Botón "Imprimir reporte ejecutivo PDF"
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const S = {
  section: { background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 10px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--lp-border-subtle)' },
  tdNum: { padding: '8px 10px', borderBottom: '1px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-mono)', textAlign: 'right' },
  btnPrimary: { padding: '10px 16px', fontSize: 12, fontWeight: 700, borderRadius: 'var(--lp-radius-sm)', border: 'none', background: 'var(--lp-brand-600)', color: '#fff', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnGhost: { padding: '8px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--lp-radius-sm)', border: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', cursor: 'pointer', color: 'var(--lp-text-primary)' },
  badge: (bg, fg) => ({ display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '.04em' }),
  loading: { textAlign: 'center', padding: 30, color: 'var(--lp-text-tertiary)', fontSize: 12 },
};

const fmt$ = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const fmtN = (n, d = 1) => n != null ? Number(n).toFixed(d) : '—';
const fmtPct = (n) => n != null ? Number(n).toFixed(1) + '%' : '—';
const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/* ── Íconos SVG line (reemplazan emojis 🖨️ ⚠ ✓ ⬆ ⬇). stroke="currentColor". ── */
const SVG_BASE = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  style: { flexShrink: 0, verticalAlign: 'middle' },
};
function IconPrinter({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...SVG_BASE}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </svg>
  );
}
function IconWarning({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...SVG_BASE}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
function IconCheck({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...SVG_BASE}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IconArrowUp({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...SVG_BASE}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}
function IconArrowDown({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...SVG_BASE}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

/* ── SVG: Line chart simple para series mensuales ──────────────────────── */
function LineChart({ series, labels, color = 'var(--lp-qc-600)', height = 120, formatter = (v) => v, suffix = '' }) {
  const valid = series.map(v => v == null ? null : Number(v));
  const nums = valid.filter(v => v != null);
  if (nums.length < 2) {
    return <div style={{ padding: 20, fontSize: 11, color: 'var(--lp-text-tertiary)', textAlign: 'center' }}>Se necesitan al menos 2 meses con datos para la gráfica.</div>;
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const pad = (max - min) * 0.1 || max * 0.1 || 1;
  const W = 600, H = height, padX = 36, padY = 18;
  const innerW = W - padX * 2, innerH = H - padY * 2;
  const step = innerW / (series.length - 1);
  const yFor = (v) => padY + innerH - ((v - (min - pad)) / ((max + pad) - (min - pad))) * innerH;

  /* Construye path solo con valores válidos */
  let pathD = '';
  valid.forEach((v, i) => {
    if (v == null) return;
    const x = padX + i * step;
    const y = yFor(v);
    pathD += (pathD ? ' L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Grid horizontal */}
      {[0, 0.25, 0.5, 0.75, 1].map(p => {
        const y = padY + innerH * p;
        const val = (max + pad) - p * ((max + pad) - (min - pad));
        return (
          <g key={p}>
            <line x1={padX} y1={y} x2={W - padX + 6} y2={y} stroke="#E5E7EB" strokeDasharray={p === 1 ? '0' : '3,3'} />
            <text x={padX - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#9CA3AF" fontFamily="monospace">
              {formatter(val)}{suffix}
            </text>
          </g>
        );
      })}
      {/* Path */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
      {/* Puntos */}
      {valid.map((v, i) => {
        if (v == null) return null;
        const x = padX + i * step;
        const y = yFor(v);
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
      {/* Labels eje X */}
      {labels.map((l, i) => {
        if (i % 2 !== 0 && labels.length > 6) return null; /* esparcir si son muchos */
        const x = padX + i * step;
        return <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="#6B7280" fontFamily="monospace">{l}</text>;
      })}
    </svg>
  );
}

function BarChart({ series, labels, color = '#0F6E56', height = 100, formatter = (v) => v, suffix = '' }) {
  const valid = series.map(v => v == null ? 0 : Number(v));
  const max = Math.max(...valid, 1);
  const W = 600, H = height, padX = 36, padY = 12;
  const innerW = W - padX * 2, innerH = H - padY * 2;
  const barW = innerW / series.length * 0.7;
  const stepX = innerW / series.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {valid.map((v, i) => {
        const x = padX + i * stepX + (stepX - barW) / 2;
        const h = (v / max) * innerH;
        const y = padY + innerH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} fill={color} rx="2" />
            {v > 0 && <text x={x + barW / 2} y={y - 2} textAnchor="middle" fontSize="9" fill="#6B7280" fontFamily="monospace">
              {formatter(v)}{suffix}
            </text>}
            <text x={x + barW / 2} y={H - 2} textAnchor="middle" fontSize="9" fill="#6B7280" fontFamily="monospace">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function EstrategicoTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [q, setQ] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [anual, setAnual] = useState(null);
  const [leads, setLeads] = useState(null);
  const [abc, setAbc] = useState(null);
  const [stockout, setStockout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const cargar = useCallback(() => {
    setLoading(true); setErr('');
    Promise.all([
      api.getComparativaAnual(year).catch(e => { console.error(e); return null; }),
      api.getLeadTimes(180).catch(e => { console.error(e); return null; }),
      api.getCurvaABCDinamica(year, q).catch(e => { console.error(e); return null; }),
      api.getCostoStockout().catch(e => { console.error(e); return null; }),
    ]).then(([a, l, abcd, so]) => {
      setAnual(a?.data || null);
      setLeads(l?.data || null);
      setAbc(abcd?.data || null);
      setStockout(so?.data || null);
    }).catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [year, q]);
  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <div style={S.loading}>Cargando análisis estratégico…</div>;
  if (err) return <div style={{ background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 6, fontSize: 12 }}>{err}</div>;

  return (
    <>
      {/* ── Selector + PDF ejecutivo ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Año:</label>
        <input type="number" inputMode="decimal" value={year} onChange={e => setYear(parseInt(e.target.value) || year)}
          style={{ padding: '8px 12px', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-sm)', width: 100, fontSize: 13, fontFamily: 'var(--lp-font-mono)' }} />
        <label style={{ fontSize: 12, fontWeight: 600 }}>Trimestre:</label>
        <select value={q} onChange={e => setQ(parseInt(e.target.value))}
          style={{ padding: '8px 12px', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-sm)', fontSize: 13 }}>
          <option value={1}>Q1 (Ene-Mar)</option>
          <option value={2}>Q2 (Abr-Jun)</option>
          <option value={3}>Q3 (Jul-Sep)</option>
          <option value={4}>Q4 (Oct-Dic)</option>
        </select>
        <div style={{ flex: 1 }} />
        <a href={api.urlPDFEjecutivo(year, q)} target="_blank" rel="noopener noreferrer" style={S.btnPrimary}>
          <IconPrinter /> Reporte ejecutivo PDF (Q{q}/{year})
        </a>
      </div>

      {/* ═══════════ Comparativa anual con SVG ═══════════ */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Comparativa anual {year}</div>
        {!anual || anual.agregado.mesesCerrados === 0 ? (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
            Sin snapshots cerrados en {year}. Cierra al menos un mes para empezar a ver tendencias.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16 }}>
              <KPISmall label="Meses cerrados" value={anual.agregado.mesesCerrados + '/12'} />
              <KPISmall label="IRA promedio" value={fmtPct(anual.agregado.iraPromedio)} color={anual.agregado.iraPromedio >= 95 ? '#0F6E56' : '#D97706'} />
              <KPISmall label="Cobertura prom" value={fmtPct(anual.agregado.coberturaPromedio)} />
              <KPISmall label="Δ Valor año" value={fmt$(anual.agregado.valorFinal - anual.agregado.valorInicial)} color={anual.agregado.valorFinal >= anual.agregado.valorInicial ? '#0F6E56' : '#B91C1C'} />
              <KPISmall label="Entradas año" value={fmtN(anual.agregado.entradasTotal, 0) + ' kg'} />
              <KPISmall label="Salidas año" value={fmtN(anual.agregado.salidasTotal, 0) + ' kg'} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 6 }}>Valor inventario MP (mensual)</div>
              <LineChart series={anual.series.valor} labels={MESES_ES} color="var(--lp-qc-600)"
                formatter={v => '$' + Math.round(v / 1000) + 'k'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 6 }}>IRA mensual %</div>
                <LineChart series={anual.series.ira} labels={MESES_ES} color="#0F6E56" suffix="%" height={100} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 6 }}>Cobertura mensual %</div>
                <BarChart series={anual.series.cobertura} labels={MESES_ES} color="var(--lp-brand-600)" suffix="%" height={100} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══════════ Lead times por proveedor ═══════════ */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Lead times reales — últimos 180 días</div>
        {!leads || leads.filas.length === 0 ? (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
            Sin datos suficientes. Se necesita cruce OC ↔ recepción del mismo MP en el horizonte.
          </div>
        ) : (
          <>
            {leads.proveedores?.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 6 }}>Cumplimiento por proveedor</div>
                <table style={{ ...S.table, marginBottom: 14 }}>
                  <thead><tr>
                    <th style={S.th}>Proveedor</th>
                    <th style={S.th}>MPs</th>
                    <th style={S.th}>Eventos</th>
                    <th style={S.th}>Lead promedio</th>
                    <th style={S.th}>Cumplimiento</th>
                  </tr></thead>
                  <tbody>
                    {leads.proveedores.map(p => (
                      <tr key={p.proveedor}>
                        <td style={S.td}><strong>{p.proveedor}</strong></td>
                        <td style={S.tdNum}>{p.mps}</td>
                        <td style={S.tdNum}>{p.eventos}</td>
                        <td style={S.tdNum}>{p.leadPromedio} días</td>
                        <td style={S.tdNum}>
                          {p.cumplimientoPromedio != null
                            ? <span style={S.badge(
                                p.cumplimientoPromedio >= 90 ? 'var(--lp-success-100)' : p.cumplimientoPromedio >= 70 ? 'var(--lp-warning-100)' : 'var(--lp-danger-100)',
                                p.cumplimientoPromedio >= 90 ? 'var(--lp-success-700)' : p.cumplimientoPromedio >= 70 ? 'var(--lp-warning-700)' : 'var(--lp-danger-700)'
                              )}>{fmtPct(p.cumplimientoPromedio)}</span>
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 6 }}>Top MPs con mayor desfase (real vs teórico)</div>
            <div className="table-scroll"><table style={S.table}>
              <thead><tr>
                <th style={S.th}>MP</th>
                <th style={S.th}>Proveedor</th>
                <th style={S.th}>Teórico</th>
                <th style={S.th}>Promedio real</th>
                <th style={S.th}>Mediana</th>
                <th style={S.th}>P90</th>
                <th style={S.th}>Cumple</th>
                <th style={S.th}>Eventos</th>
              </tr></thead>
              <tbody>
                {leads.filas.slice(0, 15).map(f => (
                  <tr key={f.mp}>
                    <td style={S.td}><strong>{f.mp}</strong>{f.alerta && <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--lp-danger-700)' }}><IconWarning size={11} /> {f.alerta}</div>}</td>
                    <td style={S.td}>{f.proveedor || '—'}</td>
                    <td style={S.tdNum}>{f.teorico ? f.teorico + 'd' : '—'}</td>
                    <td style={S.tdNum}>{f.promedio}d</td>
                    <td style={S.tdNum}>{f.mediana}d</td>
                    <td style={S.tdNum}>{f.p90}d</td>
                    <td style={S.tdNum}>{fmtPct(f.cumplimientoPct)}</td>
                    <td style={S.tdNum}>{f.eventos}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </>
        )}
      </div>

      {/* ═══════════ Curva ABC dinámica ═══════════ */}
      <div style={S.section}>
        <div style={S.sectionTitle}>
          <span>Curva ABC dinámica · Q{q}/{year} (basada en valor consumido)</span>
        </div>
        {!abc || abc.totalMPs === 0 ? (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
            Sin consumo registrado en el trimestre.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              <KPISmall label="Clase A" value={abc.conteo.A + ' MPs'} sub={fmt$(abc.valorPorClase.A)} color="#B91C1C" />
              <KPISmall label="Clase B" value={abc.conteo.B + ' MPs'} sub={fmt$(abc.valorPorClase.B)} color="#D97706" />
              <KPISmall label="Clase C" value={abc.conteo.C + ' MPs'} sub={fmt$(abc.valorPorClase.C)} color="#0F6E56" />
            </div>

            {abc.cambiosDeClase.length > 0 && (
              <div style={{ background: 'var(--lp-warning-50)', border: '1px solid var(--lp-warning-200)', padding: 10, borderRadius: 6, marginBottom: 14, fontSize: 12 }}>
                <strong>{abc.cambiosDeClase.length} MP(s) cambiaron de clase</strong> vs {abc.trimestreAnterior.y}-Q{abc.trimestreAnterior.q}:
                {' '}{abc.cambiosDeClase.slice(0, 5).map(c => (
                  <span key={c.mp} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginRight: 12 }}>
                    {c.mp}: {c.de}→{c.a} {c.cambio === 'subio' ? <IconArrowUp /> : <IconArrowDown />}
                  </span>
                ))}
              </div>
            )}

            <div className="table-scroll"><table style={S.table}>
              <thead><tr>
                <th style={S.th}>MP</th>
                <th style={S.th}>Clase actual</th>
                <th style={S.th}>Clase Q anterior</th>
                <th style={S.th}>Kg consumidos</th>
                <th style={S.th}>Valor consumido</th>
                <th style={S.th}>% acumulado</th>
              </tr></thead>
              <tbody>
                {abc.filas.slice(0, 25).map(f => (
                  <tr key={f.mp}>
                    <td style={S.td}><strong>{f.mp}</strong></td>
                    <td style={S.td}>
                      <span style={S.badge(
                        f.clase === 'A' ? 'var(--lp-danger-100)' : f.clase === 'B' ? 'var(--lp-warning-100)' : 'var(--lp-success-100)',
                        f.clase === 'A' ? 'var(--lp-danger-700)' : f.clase === 'B' ? 'var(--lp-warning-700)' : 'var(--lp-success-700)'
                      )}>{f.clase}</span>
                    </td>
                    <td style={S.td}>
                      {f.claseAnterior
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>{f.claseAnterior} {f.cambio === 'subio' ? <IconArrowUp /> : f.cambio === 'bajo' ? <IconArrowDown /> : null}</span>
                        : '—'}
                    </td>
                    <td style={S.tdNum}>{fmtN(f.kgConsumidos, 0)}</td>
                    <td style={S.tdNum}>{fmt$(f.valorConsumido)}</td>
                    <td style={S.tdNum}>{fmtPct(f.pctAcumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {abc.filas.length > 25 && (
              <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                Mostrando 25 de {abc.filas.length}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════════ Costo de oportunidad por stockout ═══════════ */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Costo de oportunidad por stockout — mes en curso</div>
        {!stockout || stockout.totalMPsConStockout === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 20, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
            <span style={{ color: 'var(--lp-success-600)' }}><IconCheck /></span> Sin stockouts en el mes en curso. Excelente disponibilidad de MP.
          </div>
        ) : (
          <>
            <div style={{ background: 'var(--lp-danger-50)', border: '1px solid var(--lp-danger-200)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
              <strong>{stockout.totalMPsConStockout} MP(s)</strong> sin stock en algún momento del mes ·
              Pérdida estimada de producción: <strong>{fmt$(stockout.costoOportunidadTotal)}</strong> ·
              {' '}<strong>{fmtN(stockout.kgPerdidosTotal, 0)} kg</strong> dejaron de consumirse
            </div>
            <div className="table-scroll"><table style={S.table}>
              <thead><tr>
                <th style={S.th}>MP</th>
                <th style={S.th}>Días sin stock</th>
                <th style={S.th}>Consumo/día</th>
                <th style={S.th}>Kg perdidos</th>
                <th style={S.th}>Cub perdidas</th>
                <th style={S.th}>Costo oportunidad</th>
                <th style={S.th}>Fórmulas afectadas</th>
              </tr></thead>
              <tbody>
                {stockout.filas.slice(0, 20).map(f => (
                  <tr key={f.mp}>
                    <td style={S.td}><strong>{f.mp}</strong></td>
                    <td style={S.tdNum}>
                      <span style={S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)')}>{f.diasSinStock}d</span>
                    </td>
                    <td style={S.tdNum}>{fmtN(f.consumoDiarioPromedio, 1)}</td>
                    <td style={S.tdNum}>{fmtN(f.kgPerdidos, 0)}</td>
                    <td style={S.tdNum}>{f.cubetasPerdidas}</td>
                    <td style={S.tdNum}><strong>{fmt$(f.costoOportunidad)}</strong></td>
                    <td style={S.tdNum}>{f.formulasAfectadas}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </>
        )}
      </div>
    </>
  );
}

function KPISmall({ label, value, sub, color = 'var(--lp-text-primary)' }) {
  return (
    <div style={{ background: 'var(--lp-bg-sunken)', borderRadius: 6, padding: '10px 12px', borderTop: '2px solid ' + color }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color, fontFamily: 'var(--lp-font-mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
