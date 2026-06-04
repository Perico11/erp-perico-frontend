/* ════════════════════════════════════════════════════════════════════════════
   ReportesPage — Control continuo de inventarios

   Sub-tabs:
     • Cierre mensual: preview del mes actual + botón "Cerrar mes" (admin)
     • Histórico mensual: tabla de los últimos 12 meses con KPIs principales
     • Detalle snapshot: drill-down de un mes específico (al click en histórico)
     • Trimestral: comparativa Q vs Q anterior
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageTabs from '../../components/ui/PageTabs';
import HelpHint from '../../components/HelpHint';
import useConfirm from '../../hooks/useConfirm';
import CausasManager from './CausasManager';
import EstrategicoTab from './EstrategicoTab';

const S = {
  wrap: { padding: '0 20px 100px' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 12 },
  loading: { textAlign: 'center', padding: 40, color: 'var(--lp-text-tertiary)' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 18 },
  kpi: (accent) => ({
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderTop: '2px solid ' + accent, borderRadius: 'var(--lp-radius)', padding: '12px 14px',
    fontFamily: 'var(--lp-font-sans)', minHeight: 80,
  }),
  kpiLabel: { fontSize: 10, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' },
  kpiVal: { fontSize: 20, fontWeight: 800, marginTop: 3, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  kpiSub: { fontSize: 10, color: 'var(--lp-text-tertiary)', marginTop: 4 },
  section: { background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 10px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)', borderBottom: '1.5px solid var(--lp-border-subtle)' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-sans)' },
  tdNum: { padding: '8px 10px', borderBottom: '1px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-mono)', textAlign: 'right' },
  btnPrimary: { padding: '10px 18px', fontSize: 13, fontWeight: 700, borderRadius: 'var(--lp-radius-sm)', border: 'none', background: 'var(--lp-brand-600)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)' },
  btnSuccess: { padding: '10px 18px', fontSize: 13, fontWeight: 700, borderRadius: 'var(--lp-radius-sm)', border: 'none', background: 'var(--lp-success-600)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)' },
  btnGhost: { padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--lp-radius-sm)', border: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)' },
  badge: (bg, fg) => ({ display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '.04em' }),
  alertBox: { background: 'var(--lp-warning-100)', border: '1px solid var(--lp-warning-300)', color: 'var(--lp-warning-700)', padding: '10px 12px', borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 12 },
};

const fmt$ = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const fmtN = (n, d = 1) => n != null ? Number(n).toFixed(d) : '—';
const fmtPct = (n) => n != null ? Number(n).toFixed(1) + '%' : '—';

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function periodoLabel(p) {
  if (!p) return '';
  const [Y, M] = p.split('-').map(Number);
  return MESES_ES[M - 1] + ' ' + Y;
}

/* ── Tab: Cierre mensual ─────────────────────────────────────────────────── */
function CierreMensualTab({ esAdmin, confirm, onCierre }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState('');

  const cargar = useCallback(() => {
    setLoading(true); setErr('');
    api.getSnapshotPreview()
      .then(r => setPreview(r.data))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const handleCerrar = async () => {
    if (!preview) return;
    /* Default: cierra mes ANTERIOR al actual. El preview es del mes en curso. */
    const d = new Date();
    d.setDate(1); d.setMonth(d.getMonth() - 1);
    const mesAnterior = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const ok = await confirm(
      `¿Cerrar el mes ${periodoLabel(mesAnterior)}? Esto genera un snapshot inmutable usado para auditoría y reportes trimestrales. No se puede modificar después sin sobreescritura explícita.`,
      { confirmText: 'Cerrar mes' }
    );
    if (!ok) return;
    setClosing(true); setErr('');
    try {
      const r = await api.cerrarMes(mesAnterior, false);
      onCierre?.(r.snapshot);
      cargar();
    } catch (e) {
      if (e?.data?.existe) {
        const ok2 = await confirm(
          `Ya existe snapshot para ${periodoLabel(mesAnterior)}. ¿Sobreescribir? (Solo recomendado si el cierre anterior tuvo datos incorrectos.)`,
          { danger: true, confirmText: 'Sobreescribir' }
        );
        if (ok2) {
          try {
            const r2 = await api.cerrarMes(mesAnterior, true);
            onCierre?.(r2.snapshot);
            cargar();
          } catch (e2) { setErr(e2.message); }
        }
      } else {
        setErr(e.message);
      }
    } finally { setClosing(false); }
  };

  if (loading) return <div style={S.loading}>Cargando preview del mes en curso…</div>;
  if (err) return <div style={S.err}>{err}</div>;
  if (!preview) return <div style={S.loading}>Sin datos</div>;

  const k = preview.kpis;
  return (
    <>
      <HelpHint id="reportes-cierre" title="Cierre mensual">
        Esto es lo que se vería si cerraras el mes ahora mismo. Al cerrar, el snapshot queda <strong>inmutable</strong> y se usa para auditoría, reportes trimestrales y comparativas año contra año. Recomendado: cerrar el día 1 de cada mes el periodo anterior.
      </HelpHint>

      {preview.alertas?.length > 0 && (
        <div style={S.alertBox}>
          <strong>Alertas del periodo:</strong>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {preview.alertas.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      <div style={S.kpiGrid}>
        <div style={S.kpi('#7C3AED')}>
          <div style={S.kpiLabel}>Valor inventario MP</div>
          <div style={S.kpiVal}>{fmt$(k.valorMP)}</div>
          <div style={S.kpiSub}>{k.mpsTotales} MPs · {k.ptsTotales} PTs</div>
        </div>
        <div style={S.kpi(k.iraGlobal != null && k.iraGlobal >= 95 ? 'var(--lp-success-600)' : 'var(--lp-warning-600)')}>
          <div style={S.kpiLabel}>IRA Global</div>
          <div style={S.kpiVal}>{fmtPct(k.iraGlobal)}</div>
          <div style={S.kpiSub}>Meta ≥95%</div>
        </div>
        <div style={S.kpi(k.coberturaMes >= 30 ? 'var(--lp-success-600)' : 'var(--lp-warning-600)')}>
          <div style={S.kpiLabel}>Cobertura mes</div>
          <div style={S.kpiVal}>{fmtPct(k.coberturaMes)}</div>
          <div style={S.kpiSub}>{k.mpsContadasEnMes} de {k.mpsTotales} contadas</div>
        </div>
        <div style={S.kpi(k.mpsCriticas > 0 ? 'var(--lp-danger-600)' : 'var(--lp-border-subtle)')}>
          <div style={S.kpiLabel}>Stock crítico</div>
          <div style={S.kpiVal}>{k.mpsCriticas}</div>
          <div style={S.kpiSub}>MPs sin existencia</div>
        </div>
        <div style={S.kpi(k.mpsBajas > 0 ? 'var(--lp-warning-600)' : 'var(--lp-border-subtle)')}>
          <div style={S.kpiLabel}>Stock bajo</div>
          <div style={S.kpiVal}>{k.mpsBajas}</div>
          <div style={S.kpiSub}>Bajo el mínimo</div>
        </div>
        <div style={S.kpi('#0F6E56')}>
          <div style={S.kpiLabel}>Ajustes netos</div>
          <div style={S.kpiVal}>{fmtN(k.ajustesNetos, 1)}</div>
          <div style={S.kpiSub}>kg neto del periodo</div>
        </div>
        <div style={S.kpi('#0F6E56')}>
          <div style={S.kpiLabel}>Entradas mes</div>
          <div style={S.kpiVal}>{fmtN(k.entradasMes, 0)}</div>
          <div style={S.kpiSub}>kg recibidos</div>
        </div>
        <div style={S.kpi('#D97706')}>
          <div style={S.kpiLabel}>Salidas mes</div>
          <div style={S.kpiVal}>{fmtN(k.salidasMes, 0)}</div>
          <div style={S.kpiSub}>kg consumidos</div>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>IRA por clase ABC</div>
        <div className="table-scroll"><table style={S.table}>
          <thead><tr>
            <th style={S.th}>Clase</th>
            <th style={S.th}>Items contados</th>
            <th style={S.th}>OK</th>
            <th style={S.th}>IRA</th>
            <th style={S.th}>Tolerancia</th>
          </tr></thead>
          <tbody>
            {['A', 'B', 'C'].map(c => {
              const cls = preview.kpis['iraClase' + c];
              return (
                <tr key={c}>
                  <td style={S.td}><strong>Clase {c}</strong></td>
                  <td style={S.tdNum}>—</td>
                  <td style={S.tdNum}>—</td>
                  <td style={S.tdNum}>{fmtPct(cls)}</td>
                  <td style={S.tdNum}>±{c === 'A' ? '2' : c === 'B' ? '5' : '10'}%</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>

      {esAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={S.btnGhost} onClick={cargar}>Refrescar</button>
          <button style={S.btnPrimary} onClick={handleCerrar} disabled={closing}>
            {closing ? 'Cerrando…' : '✓ Cerrar mes anterior'}
          </button>
        </div>
      )}
    </>
  );
}

/* ── Tab: Histórico mensual ──────────────────────────────────────────────── */
function HistoricoTab({ onSelectPeriodo }) {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.getHistoricoMensual(12)
      .then(r => setFilas(r.data || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={S.loading}>Cargando histórico…</div>;
  if (err) return <div style={S.err}>{err}</div>;
  if (filas.length === 0) {
    return (
      <div style={S.section}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--lp-text-secondary)' }}>
          Aún no hay snapshots cerrados. Cierra el primer mes desde el tab "Cierre mensual" para comenzar a construir el histórico.
        </p>
      </div>
    );
  }

  return (
    <>
      <HelpHint id="reportes-historico" title="Histórico mensual de inventarios">
        Cada renglón es el cierre de un mes. Los snapshots son inmutables — sirven como evidencia auditable de cómo estaba el inventario al cierre de cada periodo.
      </HelpHint>

      <div style={S.section}>
        <div className="table-scroll"><table style={S.table}>
          <thead><tr>
            <th style={S.th}>Periodo</th>
            <th style={S.th}>Valor MP</th>
            <th style={S.th}>MPs</th>
            <th style={S.th}>Críticas</th>
            <th style={S.th}>Bajas</th>
            <th style={S.th}>IRA Global</th>
            <th style={S.th}>Cobertura</th>
            <th style={S.th}>Entradas</th>
            <th style={S.th}>Salidas</th>
            <th style={S.th}>Ajustes</th>
            <th style={S.th}>Cerrado por</th>
            <th style={S.th}>Acción</th>
          </tr></thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.periodo}>
                <td style={S.td}><strong>{periodoLabel(f.periodo)}</strong></td>
                <td style={S.tdNum}>{fmt$(f.kpis.valorMP)}</td>
                <td style={S.tdNum}>{f.kpis.mpsTotales}</td>
                <td style={S.tdNum}>
                  {f.kpis.mpsCriticas > 0
                    ? <span style={S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)')}>{f.kpis.mpsCriticas}</span>
                    : f.kpis.mpsCriticas}
                </td>
                <td style={S.tdNum}>
                  {f.kpis.mpsBajas > 0
                    ? <span style={S.badge('var(--lp-warning-100)', 'var(--lp-warning-700)')}>{f.kpis.mpsBajas}</span>
                    : f.kpis.mpsBajas}
                </td>
                <td style={S.tdNum}>
                  {f.kpis.iraGlobal != null && f.kpis.iraGlobal >= 95
                    ? <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>{fmtPct(f.kpis.iraGlobal)}</span>
                    : fmtPct(f.kpis.iraGlobal)}
                </td>
                <td style={S.tdNum}>{fmtPct(f.kpis.coberturaMes)}</td>
                <td style={S.tdNum}>{fmtN(f.kpis.entradasMes, 0)}</td>
                <td style={S.tdNum}>{fmtN(f.kpis.salidasMes, 0)}</td>
                <td style={S.tdNum}>{fmtN(f.kpis.ajustesNetos, 1)}</td>
                <td style={S.td}>{f.cerradoPor || '—'}</td>
                <td style={S.td}>
                  <button style={S.btnGhost} onClick={() => onSelectPeriodo?.(f.periodo)}>Ver</button>
                  <a href={api.urlExportSnapshot(f.periodo)} style={{ ...S.btnGhost, marginLeft: 6, textDecoration: 'none', display: 'inline-block' }}>↓ Excel</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </>
  );
}

/* ── Tab: Detalle snapshot ────────────────────────────────────────────────── */
function DetalleSnapshot({ periodo, onClose }) {
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!periodo) return;
    setLoading(true);
    api.getSnapshot(periodo)
      .then(r => setSnap(r.data))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [periodo]);

  if (loading) return <div style={S.loading}>Cargando snapshot {periodoLabel(periodo)}…</div>;
  if (err) return <div style={S.err}>{err}</div>;
  if (!snap) return null;
  const k = snap.kpis;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Snapshot {periodoLabel(snap.periodo)}</h2>
        {snap.cerradoPor && <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>cerrado</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <a href={api.urlExportSnapshot(snap.periodo)} style={{ ...S.btnGhost, textDecoration: 'none' }}>↓ Excel</a>
          <button style={S.btnGhost} onClick={onClose}>← Volver</button>
        </span>
      </div>

      <div style={S.kpiGrid}>
        <div style={S.kpi('#7C3AED')}><div style={S.kpiLabel}>Valor MP</div><div style={S.kpiVal}>{fmt$(k.valorMP)}</div></div>
        <div style={S.kpi('var(--lp-success-600)')}><div style={S.kpiLabel}>IRA Global</div><div style={S.kpiVal}>{fmtPct(k.iraGlobal)}</div></div>
        <div style={S.kpi('var(--lp-brand-600)')}><div style={S.kpiLabel}>Cobertura</div><div style={S.kpiVal}>{fmtPct(k.coberturaMes)}</div></div>
        <div style={S.kpi('var(--lp-danger-600)')}><div style={S.kpiLabel}>Críticas</div><div style={S.kpiVal}>{k.mpsCriticas}</div></div>
        <div style={S.kpi('var(--lp-warning-600)')}><div style={S.kpiLabel}>Bajas</div><div style={S.kpiVal}>{k.mpsBajas}</div></div>
        <div style={S.kpi('#0F6E56')}><div style={S.kpiLabel}>Rotación</div><div style={S.kpiVal}>{fmtN(k.rotacion, 2)}</div></div>
      </div>

      {snap.varianzasFlagged?.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Varianzas detectadas ({snap.varianzasFlagged.length})</div>
          <div className="table-scroll"><table style={S.table}>
            <thead><tr>
              <th style={S.th}>MP</th><th style={S.th}>Clase</th>
              <th style={S.th}>Sistema</th><th style={S.th}>Físico</th>
              <th style={S.th}>Δ</th><th style={S.th}>%</th>
            </tr></thead>
            <tbody>
              {snap.varianzasFlagged.slice(0, 20).map((v, i) => (
                <tr key={i}>
                  <td style={S.td}>{v.mp}</td>
                  <td style={S.td}>{v.clase}</td>
                  <td style={S.tdNum}>{v.stockSistema}</td>
                  <td style={S.tdNum}>{v.stockFisico}</td>
                  <td style={S.tdNum}>{v.varianza > 0 ? '+' : ''}{v.varianza}</td>
                  <td style={S.tdNum}>{fmtPct(v.pctVarianza)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </>
  );
}

/* ── Tab: Trimestral ─────────────────────────────────────────────────────── */
function TrimestralTab() {
  const now = new Date();
  const qActual = Math.floor(now.getMonth() / 3) + 1;
  const [year, setYear] = useState(now.getFullYear());
  const [q, setQ] = useState(qActual);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const cargar = useCallback(() => {
    setLoading(true); setErr('');
    api.getReporteTrimestral(year, q)
      .then(r => setData(r.data))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [year, q]);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <>
      <HelpHint id="reportes-trimestral" title="Reporte trimestral">
        Agregado de 3 meses con comparativa contra el trimestre anterior. Útil para juntas con dirección y para decisiones estratégicas (cambios de mínimos, discontinuación de MPs, renegociación con proveedores).
      </HelpHint>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
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
      </div>

      {loading && <div style={S.loading}>Calculando…</div>}
      {err && <div style={S.err}>{err}</div>}
      {data && (
        <>
          <div style={S.kpiGrid}>
            <div style={S.kpi('#7C3AED')}>
              <div style={S.kpiLabel}>Valor inicial Q</div>
              <div style={S.kpiVal}>{fmt$(data.agregado.valorInicial)}</div>
            </div>
            <div style={S.kpi('#7C3AED')}>
              <div style={S.kpiLabel}>Valor final Q</div>
              <div style={S.kpiVal}>{fmt$(data.agregado.valorFinal)}</div>
              <div style={S.kpiSub}>
                {data.agregado.deltaPct != null && (
                  <span style={{ color: data.agregado.deltaPct >= 0 ? 'var(--lp-success-700)' : 'var(--lp-danger-700)' }}>
                    {data.agregado.deltaPct >= 0 ? '↑' : '↓'} {Math.abs(data.agregado.deltaPct)}%
                  </span>
                )}
              </div>
            </div>
            <div style={S.kpi('#0F6E56')}>
              <div style={S.kpiLabel}>Entradas trimestre</div>
              <div style={S.kpiVal}>{fmtN(data.agregado.entradasTotal, 0)}</div>
              <div style={S.kpiSub}>kg recibidos</div>
            </div>
            <div style={S.kpi('#D97706')}>
              <div style={S.kpiLabel}>Salidas trimestre</div>
              <div style={S.kpiVal}>{fmtN(data.agregado.salidasTotal, 0)}</div>
              <div style={S.kpiSub}>kg consumidos</div>
            </div>
            <div style={S.kpi(data.agregado.iraPromedio >= 95 ? 'var(--lp-success-600)' : 'var(--lp-warning-600)')}>
              <div style={S.kpiLabel}>IRA promedio Q</div>
              <div style={S.kpiVal}>{fmtPct(data.agregado.iraPromedio)}</div>
              <div style={S.kpiSub}>
                {data.comparativa.tendenciaIRA != null && (
                  <span style={{ color: data.comparativa.tendenciaIRA >= 0 ? 'var(--lp-success-700)' : 'var(--lp-danger-700)' }}>
                    {data.comparativa.tendenciaIRA >= 0 ? '↑' : '↓'} {Math.abs(data.comparativa.tendenciaIRA)}pp vs {data.comparativa.qAnterior}
                  </span>
                )}
              </div>
            </div>
            <div style={S.kpi('var(--lp-brand-600)')}>
              <div style={S.kpiLabel}>Cobertura prom</div>
              <div style={S.kpiVal}>{fmtPct(data.agregado.coberturaPromedio)}</div>
            </div>
          </div>

          <div style={S.section}>
            <div style={S.sectionTitle}>Snapshots del trimestre</div>
            <div className="table-scroll"><table style={S.table}>
              <thead><tr>
                <th style={S.th}>Mes</th><th style={S.th}>Estado</th>
                <th style={S.th}>Valor MP</th><th style={S.th}>IRA</th>
                <th style={S.th}>Cobertura</th><th style={S.th}>Críticas</th>
              </tr></thead>
              <tbody>
                {data.periodos.map((p, i) => {
                  const s = data.snapshots[i];
                  return (
                    <tr key={p}>
                      <td style={S.td}><strong>{periodoLabel(p)}</strong></td>
                      <td style={S.td}>
                        {s
                          ? <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>cerrado</span>
                          : <span style={S.badge('var(--lp-bg-sunken)', 'var(--lp-text-tertiary)')}>sin cerrar</span>}
                      </td>
                      <td style={S.tdNum}>{s ? fmt$(s.kpis.valorMP) : '—'}</td>
                      <td style={S.tdNum}>{s ? fmtPct(s.kpis.iraGlobal) : '—'}</td>
                      <td style={S.tdNum}>{s ? fmtPct(s.kpis.coberturaMes) : '—'}</td>
                      <td style={S.tdNum}>{s ? s.kpis.mpsCriticas : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </>
  );
}

/* ── Tab: Análisis avanzado (Pareto + rotación + stock muerto) ─────────── */
function AnalisisAvanzadoTab() {
  const [pareto, setPareto] = useState(null);
  const [rotacion, setRotacion] = useState(null);
  const [stockMuerto, setStockMuerto] = useState(null);
  const [diasMuerto, setDiasMuerto] = useState(90);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const cargar = useCallback(() => {
    setLoading(true); setErr('');
    Promise.all([
      api.getCausasPareto().catch(e => { console.error(e); return null; }),
      api.getRotacionFamilia().catch(e => { console.error(e); return null; }),
      api.getStockMuerto(diasMuerto).catch(e => { console.error(e); return null; }),
    ]).then(([p, r, sm]) => {
      setPareto(p?.data || null);
      setRotacion(r?.data || null);
      setStockMuerto(sm?.data || null);
    }).catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [diasMuerto]);
  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <div style={S.loading}>Cargando análisis…</div>;
  if (err) return <div style={S.err}>{err}</div>;

  /* Color por salud rotación */
  const colorRot = (s) => s === 'sana' ? 'var(--lp-success-700)' : s === 'media' ? 'var(--lp-warning-700)' : 'var(--lp-danger-700)';
  const bgRot = (s) => s === 'sana' ? 'var(--lp-success-100)' : s === 'media' ? 'var(--lp-warning-100)' : 'var(--lp-danger-100)';

  /* Barra Pareto inline */
  const maxParetoCount = pareto?.filas?.length > 0 ? Math.max(...pareto.filas.map(f => f.count)) : 1;

  return (
    <>
      <HelpHint id="reportes-analisis" title="Análisis avanzado">
        Esto te dice <strong>por qué</strong> tu inventario se desvía y <strong>dónde</strong> tienes dinero parado. El Pareto identifica las causas dominantes (regla 80/20). La rotación por familia detecta categorías sobrestockeadas. El stock muerto lista MPs candidatas a discontinuar.
      </HelpHint>

      {/* ═══════════ Pareto de causas raíz ═══════════ */}
      <div style={S.section}>
        <div style={{ ...S.sectionTitle, display: 'flex', justifyContent: 'space-between' }}>
          <span>Pareto de causas raíz (últimos 90 días)</span>
          {pareto && <span style={{ fontWeight: 400, color: 'var(--lp-text-tertiary)', textTransform: 'none', letterSpacing: 0 }}>
            {pareto.totalVarianzas} varianzas · Δ absoluto {fmtN(pareto.totalAjusteAbsoluto, 1)} kg
          </span>}
        </div>
        {!pareto || pareto.filas.length === 0 ? (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
            Sin varianzas aprobadas con causa raíz en el periodo. Aprueba sesiones de conteo con causas asignadas para empezar a construir este análisis.
          </div>
        ) : (
          <div className="table-scroll"><table style={S.table}>
            <thead><tr>
              <th style={S.th}>Causa</th>
              <th style={S.th}>Eventos</th>
              <th style={S.th}>% del total</th>
              <th style={S.th}>Acumulado %</th>
              <th style={S.th} style={{ ...S.th, minWidth: 200 }}>Distribución</th>
              <th style={S.th}>Δ absoluto kg</th>
            </tr></thead>
            <tbody>
              {pareto.filas.map((f, i) => (
                <tr key={f.causaId}>
                  <td style={S.td}>
                    <strong>{f.causa}</strong>
                    {i === 0 && <span style={{ ...S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)'), marginLeft: 6 }}>causa #1</span>}
                  </td>
                  <td style={S.tdNum}>{f.count}</td>
                  <td style={S.tdNum}>{f.countPct}%</td>
                  <td style={S.tdNum}>{f.acumuladoPct}%</td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ background: 'var(--lp-bg-sunken)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                      <div style={{
                        width: ((f.count / maxParetoCount) * 100) + '%',
                        height: '100%',
                        background: i === 0 ? 'var(--lp-danger-600)' : i < 3 ? 'var(--lp-warning-600)' : 'var(--lp-brand-600)',
                      }} />
                    </div>
                  </td>
                  <td style={S.tdNum}>{fmtN(f.deltaAbsoluto, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* ═══════════ Rotación por familia ═══════════ */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Rotación por familia (mes en curso)</div>
        {!rotacion || rotacion.filas.length === 0 ? (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
            Sin movimientos en el mes en curso.
          </div>
        ) : (
          <div className="table-scroll"><table style={S.table}>
            <thead><tr>
              <th style={S.th}>Categoría</th>
              <th style={S.th}>MPs</th>
              <th style={S.th}>Entradas kg</th>
              <th style={S.th}>Salidas kg</th>
              <th style={S.th}>Ajustes kg</th>
              <th style={S.th}>Valor inventario</th>
              <th style={S.th}>Salud rotación</th>
            </tr></thead>
            <tbody>
              {rotacion.filas.map(f => (
                <tr key={f.categoria}>
                  <td style={S.td}><strong>{f.categoria}</strong></td>
                  <td style={S.tdNum}>{f.mpsCount}</td>
                  <td style={S.tdNum}>{fmtN(f.entradasKg, 0)}</td>
                  <td style={S.tdNum}>{fmtN(f.salidasKg, 0)}</td>
                  <td style={S.tdNum}>{fmtN(f.ajustesKg, 1)}</td>
                  <td style={S.tdNum}>{fmt$(f.valorPromedio)}</td>
                  <td style={S.td}>
                    <span style={S.badge(bgRot(f.saludRotacion), colorRot(f.saludRotacion))}>
                      {f.saludRotacion}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* ═══════════ Stock muerto ═══════════ */}
      <div style={S.section}>
        <div style={{ ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Stock muerto — MPs sin movimiento</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            <label style={{ color: 'var(--lp-text-secondary)' }}>Umbral:</label>
            <select value={diasMuerto} onChange={e => setDiasMuerto(parseInt(e.target.value))}
              style={{ padding: '6px 10px', fontSize: 12, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-sm)' }}>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
              <option value={180}>180 días</option>
              <option value={360}>360 días (1 año)</option>
            </select>
          </div>
        </div>

        {!stockMuerto || stockMuerto.filas.length === 0 ? (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
            ✓ Sin MPs muertas en el umbral seleccionado. Buen control de rotación.
          </div>
        ) : (
          <>
            <div style={S.alertBox}>
              <strong>{stockMuerto.totalCandidatas} MPs</strong> sin movimiento por <strong>{stockMuerto.umbralDias}+ días</strong> · valor total {fmt$(stockMuerto.valorTotal)} parado.
              Considera discontinuar las que no estén en fórmulas activas.
            </div>
            <div className="table-scroll"><table style={S.table}>
              <thead><tr>
                <th style={S.th}>MP</th>
                <th style={S.th}>Categoría</th>
                <th style={S.th}>Proveedor</th>
                <th style={S.th}>Stock</th>
                <th style={S.th}>Valor parado</th>
                <th style={S.th}>Días sin mov</th>
                <th style={S.th}>Fórmulas</th>
              </tr></thead>
              <tbody>
                {stockMuerto.filas.slice(0, 30).map(f => (
                  <tr key={f.mp}>
                    <td style={S.td}><strong>{f.mp}</strong></td>
                    <td style={S.td}>{f.categoria || '—'}</td>
                    <td style={S.td}>{f.proveedor || '—'}</td>
                    <td style={S.tdNum}>{fmtN(f.qty, 1)} kg</td>
                    <td style={S.tdNum}>{fmt$(f.valor)}</td>
                    <td style={S.tdNum}>
                      <span style={S.badge(
                        f.diasSinMovimiento > 180 ? 'var(--lp-danger-100)' : 'var(--lp-warning-100)',
                        f.diasSinMovimiento > 180 ? 'var(--lp-danger-700)' : 'var(--lp-warning-700)'
                      )}>{f.diasSinMovimiento}d</span>
                    </td>
                    <td style={S.tdNum}>
                      {f.enFormulas === 0
                        ? <span style={S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)')}>Sin uso</span>
                        : f.enFormulas + ' fórmula(s)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {stockMuerto.filas.length > 30 && (
              <div style={{ padding: '10px 0', fontSize: 11, color: 'var(--lp-text-tertiary)', textAlign: 'center' }}>
                Mostrando 30 de {stockMuerto.filas.length} — exporta para ver todas
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ── Componente principal ────────────────────────────────────────────────── */
export default function ReportesPage() {
  const { user } = useAuth();
  const [confirm, ConfirmEl] = useConfirm();
  const [activeTab, setActiveTab] = useState('cierre');
  const [detallePeriodo, setDetallePeriodo] = useState(null);
  const esAdmin = user?.rol === 'admin';

  return (
    <div>
      <TopBar title="Reportes de inventario" />
      <div style={S.wrap}>
        <PageTabs
          tabs={[
            { id: 'cierre', label: 'Cierre mensual', style: (active) => ({
              padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--lp-font-sans)', marginBottom: -2,
            }) },
            { id: 'historico', label: 'Histórico mensual', style: (active) => ({
              padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--lp-font-sans)', marginBottom: -2,
            }) },
            { id: 'trimestral', label: 'Trimestral', style: (active) => ({
              padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--lp-font-sans)', marginBottom: -2,
            }) },
            { id: 'analisis', label: 'Análisis avanzado', style: (active) => ({
              padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--lp-font-sans)', marginBottom: -2,
            }) },
            { id: 'estrategico', label: 'Estratégico', style: (active) => ({
              padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--lp-font-sans)', marginBottom: -2,
            }) },
            { id: 'causas', label: 'Catálogo causas', style: (active) => ({
              padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--lp-font-sans)', marginBottom: -2,
            }) },
          ]}
          activeTab={activeTab}
          onChange={(t) => { setActiveTab(t); setDetallePeriodo(null); }}
          style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--lp-border-subtle)', marginBottom: 16, overflowX: 'auto' }}
        />

        {detallePeriodo ? (
          <DetalleSnapshot periodo={detallePeriodo} onClose={() => setDetallePeriodo(null)} />
        ) : (
          <>
            {activeTab === 'cierre' && <CierreMensualTab esAdmin={esAdmin} confirm={confirm} />}
            {activeTab === 'historico' && <HistoricoTab onSelectPeriodo={setDetallePeriodo} />}
            {activeTab === 'trimestral' && <TrimestralTab />}
            {activeTab === 'analisis' && <AnalisisAvanzadoTab />}
            {activeTab === 'estrategico' && <EstrategicoTab />}
            {activeTab === 'causas' && <CausasManager />}
          </>
        )}
      </div>
      {ConfirmEl}
    </div>
  );
}
