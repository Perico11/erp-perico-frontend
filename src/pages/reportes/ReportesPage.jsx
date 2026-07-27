/* ════════════════════════════════════════════════════════════════════════════
   ReportesPage — Control continuo de inventarios · reskin verde "Claude Design"

   Responsive (useIsDesktop):
     • Escritorio → header h1/psub, KPIs g4, gráficas SVG anchas, las 6
       sub-secciones como segmented tabs scrollable.
     • Móvil → header compacto, KPIs g2, las 6 sub-secciones via BOTTOM-SHEET
       (selector con grid, no 6 tabs apretadas). Default = Cierre (resumen).

   Sub-secciones (§9 conservadas íntegras, con su contenido real):
     1. Cierre mensual   — preview del mes + cerrar mes (admin)
     2. Histórico        — tabla de cierres mensuales + export Excel
     3. Trimestral       — agregado Q vs Q anterior
     4. Análisis avanzado— Pareto causas + rotación familia + stock muerto
     5. Estratégico      — comparativa anual SVG + lead times + ABC + stockout
     6. Catálogo causas  — CRUD de causas raíz (admin)

   Reskin VISUAL: tokens var(--lp-*) verde, sin emojis (SVG line), cifras mono,
   touch ≥44px, botones nunca 100% width en escritorio. Lógica intacta:
   endpoints /api/reports/*, snapshot/IRA/ABC, SVG charts existentes,
   Import/Export gateado compras/admin.
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import HelpHint from '../../components/HelpHint';
import useConfirm from '../../hooks/useConfirm';
import useIsDesktop from '../../hooks/useIsDesktop';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import CausasManager from './CausasManager';
import EstrategicoTab from './EstrategicoTab';

/* ── Paleta de gráficas — todo vía token verde (sin hex sueltos) ──
   Acentos secundarios mapeados a tokens existentes del DS verde. */
const CHART = {
  brand:  'var(--lp-brand-600)',   // verde marca (serie principal)
  brand2: 'var(--lp-brand-300)',   // verde claro (barras no-último mes)
  info:   'var(--lp-info-600)',    // azul (margen / cobertura)
  amber:  'var(--lp-warning-600)', // ámbar (salidas / devoluciones)
  danger: 'var(--lp-danger-600)',  // rojo (críticas / causa #1)
  success:'var(--lp-success-600)', // verde ok
};

const S = {
  /* layout */
  wrap: { padding: '0 20px 100px' },
  wrapDesk: { padding: '0 24px 60px', maxWidth: 1180 },
  h1: { fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--lp-text-primary)' },
  psub: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3, marginBottom: 16 },

  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 12 },
  loading: { textAlign: 'center', padding: 40, color: 'var(--lp-text-tertiary)', fontSize: 13 },

  /* KPI grid — g2 móvil / g4 escritorio */
  kpiGrid: (desktop) => ({
    display: 'grid',
    gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(190px, 1fr))' : '1fr 1fr',
    gap: 10, marginBottom: 18,
  }),
  kpi: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, padding: '13px 14px', fontFamily: 'var(--lp-font-sans)', minHeight: 78 },
  kdot: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  dot: (c) => ({ width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: c, display: 'inline-block' }),
  kpiLabel: { fontSize: 11, fontWeight: 600, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.03em' },
  kpiVal: { fontSize: 21, fontWeight: 700, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)', display: 'flex', alignItems: 'baseline', gap: 6 },
  kpiSub: { fontSize: 11, color: 'var(--lp-text-secondary)', marginTop: 4 },

  /* secciones / paneles / tablas */
  section: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 16, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '10px 12px', background: 'var(--lp-bg-sunken)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--lp-text-tertiary)', borderBottom: '1px solid var(--lp-border-subtle)', whiteSpace: 'nowrap', fontWeight: 700 },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)' },
  tdNum: { padding: '10px 12px', borderBottom: '1px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-mono)', textAlign: 'right', fontWeight: 600, color: 'var(--lp-text-primary)' },

  /* botones (auto-width en escritorio, ≥44 touch) */
  btnPrimary: { padding: '12px 18px', minHeight: 44, fontSize: 13.5, fontWeight: 600, borderRadius: 12, border: 'none', background: 'var(--lp-brand-600)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', display: 'inline-flex', alignItems: 'center', gap: 8 },
  btnGhost: { padding: '0 14px', minHeight: 44, fontSize: 13, fontWeight: 600, borderRadius: 12, border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' },
  btnGhostSm: { padding: '0 12px', minHeight: 36, fontSize: 12.5, fontWeight: 600, borderRadius: 10, border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', textDecoration: 'none' },

  badge: (bg, fg) => ({ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', fontSize: 10.5, fontWeight: 700, borderRadius: 999, background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '.03em' }),
  alertBox: { background: 'var(--lp-warning-50)', border: '1px solid var(--lp-warning-100)', color: 'var(--lp-warning-700)', padding: '11px 13px', borderRadius: 12, fontSize: 12.5, marginBottom: 12 },

  /* form controls */
  field: { padding: '0 12px', height: 44, border: '1px solid var(--lp-border-subtle)', borderRadius: 12, fontSize: 14, fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box' },
  fieldMono: { padding: '0 12px', height: 44, border: '1px solid var(--lp-border-subtle)', borderRadius: 12, width: 110, fontSize: 14, fontFamily: 'var(--lp-font-mono)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box' },
  lbl: { fontSize: 12.5, fontWeight: 600, color: 'var(--lp-text-secondary)' },

  /* selector de periodo (mockup Reportes.html): Este mes · Trimestre · Año */
  perWrap: { display: 'flex', gap: 4, marginBottom: 10 },
  perBtn: (on, grow) => ({
    flex: grow ? 1 : '0 0 auto', padding: '8px 16px', minHeight: 40, borderRadius: 999,
    border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    fontSize: 12.5, fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
    background: on ? 'var(--lp-brand-600)' : 'transparent',
    color: on ? '#fff' : 'var(--lp-text-secondary)', transition: 'all .15s',
  }),

  /* segmented (sub-secciones escritorio) */
  segWrap: { display: 'flex', gap: 6, padding: 4, background: 'var(--lp-bg-sunken)', borderRadius: 999, marginBottom: 18, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' },
  seg: (on) => ({
    flex: '0 0 auto', padding: '9px 16px', minHeight: 40, borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: on ? 600 : 500,
    background: on ? 'var(--lp-brand-600)' : 'transparent',
    color: on ? '#fff' : 'var(--lp-text-secondary)', whiteSpace: 'nowrap', transition: 'all .15s',
  }),

  /* selector móvil (abre bottom-sheet) */
  secSelector: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    width: '100%', height: 48, padding: '0 16px', marginBottom: 16,
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
    borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
  },
  secSelLabel: { fontSize: 14.5, fontWeight: 600, color: 'var(--lp-text-primary)' },
  secSelHint: { fontSize: 11, fontWeight: 600, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' },

  /* bottom-sheet */
  sheetOverlay: { position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 1200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet: { background: 'var(--lp-bg-base)', width: '100%', maxWidth: 460, borderRadius: '24px 24px 0 0', padding: '8px 18px calc(22px + env(safe-area-inset-bottom))', boxShadow: '0 -8px 40px rgba(0,0,0,.22)', maxHeight: 'calc(var(--pp-vvh, 100dvh) - 24px)', overflowY: 'auto' },
  sheetGrab: { width: 40, height: 4, borderRadius: 999, background: 'var(--lp-border-strong)', margin: '8px auto 14px' },
  sheetTitle: { fontSize: 12, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 2px 12px' },
  sheetGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  sheetItem: (on) => ({
    display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 14px', minHeight: 88,
    borderRadius: 16, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--lp-font-sans)',
    border: on ? '1.5px solid var(--lp-brand-600)' : '1px solid var(--lp-border-subtle)',
    background: on ? 'color-mix(in srgb, var(--lp-brand-600) 10%, transparent)' : 'var(--lp-bg-raised)',
  }),
  sheetItemLabel: (on) => ({ fontSize: 14, fontWeight: 600, color: on ? 'var(--lp-brand-700)' : 'var(--lp-text-primary)' }),
  sheetItemSub: { fontSize: 11, color: 'var(--lp-text-tertiary)', lineHeight: 1.35 },

  empty: { padding: 20, fontSize: 12.5, color: 'var(--lp-text-tertiary)' },
};

/* ── SVG icon helper (line, currentColor) ── */
const Icon = ({ d, size = 18, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const IC = {
  check: 'M20 6 9 17l-5-5',
  refresh: ['M21 12a9 9 0 1 1-3-6.7', 'M21 3v6h-6'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z'],
  back: 'M19 12H5M12 19l-7-7 7-7',
  chevron: 'M9 18l6-6-6-6',
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

/* KPI card reusable (mockup: dot + label + valor mono + trend + sub) */
function KPI({ label, value, sub, accent = CHART.brand, trend, trendUp }) {
  return (
    <div style={S.kpi}>
      <div style={S.kdot}>
        <span style={S.dot(accent)} />
        <span style={S.kpiLabel}>{label}</span>
      </div>
      <div style={S.kpiVal}>
        {value}
        {trend != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: trendUp ? CHART.success : CHART.danger }}>{trend}</span>
        )}
      </div>
      {sub != null && <div style={S.kpiSub}>{sub}</div>}
    </div>
  );
}

/* ── Tab: Cierre mensual ─────────────────────────────────────────────────── */
function CierreMensualTab({ esAdmin, confirm, isDesktop, puedeExport, onExport }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState('');
  /* Mockup: "Producción · últimos 6 meses" (barras) + "Top productos del mes".
     Datos REALES de /api/reports/production-monthly (endpoint solo-admin →
     solo se consulta como admin; para inventario/compras los paneles no aplican).
     Se piden año actual + anterior para cubrir los 6 meses cruzando enero. */
  const [prod, setProd] = useState(null);

  const cargar = useCallback(() => {
    setLoading(true); setErr('');
    api.getSnapshotPreview()
      .then(r => setPreview(r.data))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!esAdmin || typeof api.getReportProduction !== 'function') return;
    const Y = new Date().getFullYear();
    Promise.all([
      api.getReportProduction(Y).catch(() => null),
      api.getReportProduction(Y - 1).catch(() => null),
    ]).then(([a, b]) => {
      const meses = { ...(b?.meses || {}), ...(a?.meses || {}) };
      const keys = Object.keys(meses).filter(k => /^\d{4}-\d{2}$/.test(k)).sort();
      if (!keys.length) return;
      const last6 = keys.slice(-6);
      const serie = last6.map(k => ({
        k,
        label: MESES_ES[parseInt(k.split('-')[1], 10) - 1] || k,
        total: Math.round(meses[k]?.total || 0),
      }));
      const lastK = last6[last6.length - 1];
      const top = Object.entries(meses[lastK]?.detalle || {})
        .sort((x, y) => y[1] - x[1]).slice(0, 5);
      setProd({ serie, top, mesLabel: periodoLabel(lastK) });
    });
  }, [esAdmin]);

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
      await api.cerrarMes(mesAnterior, false);
      cargar();
    } catch (e) {
      if (e?.data?.existe) {
        const ok2 = await confirm(
          `Ya existe snapshot para ${periodoLabel(mesAnterior)}. ¿Sobreescribir? (Solo recomendado si el cierre anterior tuvo datos incorrectos.)`,
          { danger: true, confirmText: 'Sobreescribir' }
        );
        if (ok2) {
          try {
            await api.cerrarMes(mesAnterior, true);
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

      <div style={S.kpiGrid(isDesktop)}>
        <KPI label="Valor inventario MP" accent={CHART.info} value={fmt$(k.valorMP)} sub={`${k.mpsTotales} MPs · ${k.ptsTotales} PTs`} />
        <KPI label="IRA Global" accent={k.iraGlobal != null && k.iraGlobal >= 95 ? CHART.success : CHART.amber} value={fmtPct(k.iraGlobal)} sub="Meta ≥95%" />
        <KPI label="Cobertura mes" accent={k.coberturaMes >= 30 ? CHART.success : CHART.amber} value={fmtPct(k.coberturaMes)} sub={`${k.mpsContadasEnMes} de ${k.mpsTotales} contadas`} />
        <KPI label="Stock crítico" accent={k.mpsCriticas > 0 ? CHART.danger : 'var(--lp-border-strong)'} value={k.mpsCriticas} sub="MPs sin existencia" />
        <KPI label="Stock bajo" accent={k.mpsBajas > 0 ? CHART.amber : 'var(--lp-border-strong)'} value={k.mpsBajas} sub="Bajo el mínimo" />
        <KPI label="Ajustes netos" accent={CHART.brand} value={fmtN(k.ajustesNetos, 1)} sub="kg neto del periodo" />
        <KPI label="Entradas mes" accent={CHART.brand} value={fmtN(k.entradasMes, 0)} sub="kg recibidos" />
        <KPI label="Salidas mes" accent={CHART.amber} value={fmtN(k.salidasMes, 0)} sub="kg consumidos" />
      </div>

      {/* FIX (audit): para non-admin el desglose de producción se OMITE (endpoint
          solo-admin) — antes desaparecía sin explicación ("vacío en silencio"). */}
      {!esAdmin && (
        <div style={{ ...S.section, fontSize: 12, color: 'var(--lp-text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
          El <b>desglose de producción mensual</b> y el <b>cierre de mes</b> son exclusivos de administración.
          Tienes acceso completo a <b>Histórico</b>, <b>Trimestral</b>, <b>Análisis</b> y <b>Estratégico</b>.
        </div>
      )}

      {/* ── Producción · últimos 6 meses (mockup: barras, último mes acento) ── */}
      {prod && prod.serie.length > 0 && (() => {
        const max = Math.max(...prod.serie.map(s => s.total), 1);
        const prom = Math.round(prod.serie.reduce((a, s) => a + s.total, 0) / prod.serie.length);
        const best = prod.serie.reduce((a, s) => (s.total > a.total ? s : a), prod.serie[0]);
        return (
          <div style={S.section}>
            <div style={S.sectionTitle}>Producción · últimos 6 meses</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
              {prod.serie.map((s, i) => {
                const last = i === prod.serie.length - 1;
                return (
                  <div key={s.k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0, height: '100%', justifyContent: 'flex-end' }}>
                    <div title={`${s.label}: ${s.total.toLocaleString('es-MX')} cub`}
                      style={{
                        width: '100%', height: Math.max(3, (s.total / max) * 96), borderRadius: '5px 5px 0 0',
                        background: last ? CHART.brand : 'color-mix(in srgb, var(--lp-brand-600) 30%, var(--lp-bg-sunken))',
                      }} />
                    <div style={{ fontSize: 9.5, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)' }}>{s.label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--lp-border-subtle)', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, color: 'var(--lp-text-secondary)' }}>
                Promedio <b style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)' }}>{prom.toLocaleString('es-MX')} cub</b>
              </div>
              <div style={{ fontSize: 11, color: 'var(--lp-text-secondary)' }}>
                Mejor mes <b style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)' }}>{best.total.toLocaleString('es-MX')} ({best.label})</b>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Top productos del mes (mockup: ranking con barra proporcional) ── */}
      {prod && prod.top.length > 0 && (() => {
        const maxT = prod.top[0][1] || 1;
        const colors = [CHART.brand, CHART.info, CHART.amber, 'var(--lp-brand-300)', 'var(--lp-text-tertiary)'];
        return (
          <div style={S.section}>
            <div style={S.sectionTitle}>Top productos · {prod.mesLabel}</div>
            {prod.top.map(([n, v], i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', fontSize: 10, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--lp-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</div>
                  <div style={{ height: 6, borderRadius: 999, background: 'var(--lp-bg-sunken)', overflow: 'hidden', marginTop: 5 }}>
                    <div style={{ width: ((v / maxT) * 100) + '%', height: '100%', borderRadius: 999, background: colors[i] || colors[colors.length - 1] }} />
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--lp-text-primary)', minWidth: 48, textAlign: 'right' }}>{Math.round(v).toLocaleString('es-MX')}</span>
              </div>
            ))}
          </div>
        );
      })()}

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

      {/* Mockup: "Descargar reporte (PDF)" — usa el PDF ejecutivo trimestral REAL
          (routes/reportes.js · pdf-ejecutivo, HTML A4 imprimible). Full-width solo
          en móvil; en escritorio ancho auto (regla de botones del DS). */}
      <div style={{ display: 'flex', justifyContent: isDesktop ? 'flex-end' : 'stretch', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <a href={api.urlPDFEjecutivo(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) + 1)}
          target="_blank" rel="noopener noreferrer" data-id="reportes.btn.pdf-ejecutivo"
          style={{ ...S.btnGhost, textDecoration: 'none', ...(isDesktop ? { marginRight: 'auto' } : { flex: '1 1 100%', justifyContent: 'center' }) }}>
          <Icon d={IC.download} size={16} /> Descargar reporte (PDF)
        </a>
        {/* Exportar Excel del mes en curso — antes era un botón GLOBAL arriba de
            todas las pestañas (confundía en Histórico/Análisis); vive aquí donde
            aplica. Histórico conserva su Excel por renglón. */}
        {puedeExport && (
          <button data-id="reportes.btn.exportar" style={S.btnGhost} onClick={onExport}>
            <Icon d={IC.download} size={16} /> Exportar Excel
          </button>
        )}
        {esAdmin && (
          <>
            <button style={S.btnGhost} onClick={cargar}>
              <Icon d={IC.refresh} size={16} /> Refrescar
            </button>
            <button style={{ ...S.btnPrimary, opacity: closing ? 0.6 : 1, flex: isDesktop ? '0 0 auto' : 1, justifyContent: 'center' }} onClick={handleCerrar} disabled={closing}>
              <Icon d={IC.check} size={16} /> {closing ? 'Cerrando…' : 'Cerrar mes anterior'}
            </button>
          </>
        )}
      </div>
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
          Aún no hay snapshots cerrados. Cierra el primer mes desde "Cierre mensual" para comenzar a construir el histórico.
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
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button style={S.btnGhostSm} onClick={() => onSelectPeriodo?.(f.periodo)}>
                      <Icon d={IC.eye} size={14} /> Ver
                    </button>
                    <a href={api.urlExportSnapshot(f.periodo)} style={S.btnGhostSm}>
                      <Icon d={IC.download} size={14} /> Excel
                    </a>
                  </div>
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
function DetalleSnapshot({ periodo, onClose, isDesktop }) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--lp-text-primary)' }}>Snapshot {periodoLabel(snap.periodo)}</h2>
        {snap.cerradoPor && <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>cerrado</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <a href={api.urlExportSnapshot(snap.periodo)} style={S.btnGhostSm}>
            <Icon d={IC.download} size={14} /> Excel
          </a>
          <button style={S.btnGhostSm} onClick={onClose}>
            <Icon d={IC.back} size={14} /> Volver
          </button>
        </span>
      </div>

      <div style={S.kpiGrid(isDesktop)}>
        <KPI label="Valor MP" accent={CHART.info} value={fmt$(k.valorMP)} />
        <KPI label="IRA Global" accent={CHART.success} value={fmtPct(k.iraGlobal)} />
        <KPI label="Cobertura" accent={CHART.brand} value={fmtPct(k.coberturaMes)} />
        <KPI label="Críticas" accent={CHART.danger} value={k.mpsCriticas} />
        <KPI label="Bajas" accent={CHART.amber} value={k.mpsBajas} />
        <KPI label="Rotación" accent={CHART.brand} value={fmtN(k.rotacion, 2)} />
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
function TrimestralTab({ isDesktop }) {
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

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={S.lbl}>Año:</label>
        <input type="number" inputMode="numeric" value={year} onChange={e => setYear(parseInt(e.target.value) || year)} style={S.fieldMono} />
        <label style={S.lbl}>Trimestre:</label>
        <select value={q} onChange={e => setQ(parseInt(e.target.value))} style={{ ...S.field, height: 44, width: 'auto' }}>
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
          <div style={S.kpiGrid(isDesktop)}>
            <KPI label="Valor inicial Q" accent={CHART.info} value={fmt$(data.agregado.valorInicial)} />
            <KPI label="Valor final Q" accent={CHART.info} value={fmt$(data.agregado.valorFinal)}
              sub={data.agregado.deltaPct != null && (
                <span style={{ color: data.agregado.deltaPct >= 0 ? CHART.success : CHART.danger, fontWeight: 700 }}>
                  {data.agregado.deltaPct >= 0 ? '↑' : '↓'} {Math.abs(data.agregado.deltaPct)}%
                </span>
              )} />
            <KPI label="Entradas trimestre" accent={CHART.brand} value={fmtN(data.agregado.entradasTotal, 0)} sub="kg recibidos" />
            <KPI label="Salidas trimestre" accent={CHART.amber} value={fmtN(data.agregado.salidasTotal, 0)} sub="kg consumidos" />
            <KPI label="IRA promedio Q" accent={data.agregado.iraPromedio >= 95 ? CHART.success : CHART.amber} value={fmtPct(data.agregado.iraPromedio)}
              sub={data.comparativa.tendenciaIRA != null && (
                <span style={{ color: data.comparativa.tendenciaIRA >= 0 ? CHART.success : CHART.danger, fontWeight: 700 }}>
                  {data.comparativa.tendenciaIRA >= 0 ? '↑' : '↓'} {Math.abs(data.comparativa.tendenciaIRA)}pp vs {data.comparativa.qAnterior}
                </span>
              )} />
            <KPI label="Cobertura prom" accent={CHART.brand} value={fmtPct(data.agregado.coberturaPromedio)} />
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

/* ── Tab: Análisis avanzado (Pareto + rotación + stock muerto + causas) ── */
function AnalisisAvanzadoTab({ esAdmin }) {
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
        <div style={{ ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>Pareto de causas raíz (últimos 90 días)</span>
          {pareto && <span style={{ fontWeight: 400, color: 'var(--lp-text-tertiary)', textTransform: 'none', letterSpacing: 0 }}>
            {pareto.totalVarianzas} varianzas · Δ absoluto {fmtN(pareto.totalAjusteAbsoluto, 1)} kg
          </span>}
        </div>
        {!pareto || pareto.filas.length === 0 ? (
          <div style={S.empty}>
            Sin varianzas aprobadas con causa raíz en el periodo. Aprueba sesiones de conteo con causas asignadas para empezar a construir este análisis.
          </div>
        ) : (
          <div className="table-scroll"><table style={S.table}>
            <thead><tr>
              <th style={S.th}>Causa</th>
              <th style={S.th}>Eventos</th>
              <th style={S.th}>% del total</th>
              <th style={S.th}>Acumulado %</th>
              <th style={{ ...S.th, minWidth: 200 }}>Distribución</th>
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
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ background: 'var(--lp-bg-sunken)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                      <div style={{
                        width: ((f.count / maxParetoCount) * 100) + '%',
                        height: '100%', borderRadius: 999,
                        background: i === 0 ? CHART.danger : i < 3 ? CHART.amber : CHART.brand,
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
          <div style={S.empty}>Sin movimientos en el mes en curso.</div>
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
        <div style={{ ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span>Stock muerto — MPs sin movimiento</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            <label style={{ color: 'var(--lp-text-secondary)' }}>Umbral:</label>
            <select value={diasMuerto} onChange={e => setDiasMuerto(parseInt(e.target.value))}
              style={{ ...S.field, height: 40, width: 'auto', fontSize: 12.5 }}>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
              <option value={180}>180 días</option>
              <option value={360}>360 días (1 año)</option>
            </select>
          </div>
        </div>

        {!stockMuerto || stockMuerto.filas.length === 0 ? (
          <div style={S.empty}>
            Sin MPs muertas en el umbral seleccionado. Buen control de rotación.
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

      {/* ═══════════ Catálogo de causas raíz (admin) ═══════════
          Jul 2026: dejó de ser pestaña propia — el catálogo alimenta el Pareto
          de arriba, así que vive junto a él. Componente completo, sin recortes. */}
      {esAdmin && <CausasManager />}
    </>
  );
}

/* ── Tab: Operación (jul 2026, pedido del dueño) ─────────────────────────────
   Los 4 datos operativos juntos: qué se PRODUJO, qué se ENVIÓ a Terán, qué
   queda en FÁBRICA sin enviar, y qué MP está PIDIENDO compras (Arely).
   Un solo endpoint (/api/reports/operacion, solo admin). KPIs accionables:
   cada sección tiene link directo a su pantalla de trabajo. */
function OperacionTab({ isDesktop }) {
  const navigate = useNavigate();
  const [dias, setDias] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true); setErr('');
    api.getReporteOperacion(dias)
      .then(r => setData(r.data))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [dias]);

  /* KPIs accionables (regla del dueño): cada sección enlaza a su pantalla. */
  const SecHead = ({ children, to, label }) => (
    <div style={{ ...S.sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <span>{children}</span>
      {to && (
        <button type="button" style={{ ...S.btnGhostSm, textTransform: 'none', letterSpacing: 0 }}
          onClick={() => navigate(to)}>
          {label || 'Ver pantalla'} <Icon d={IC.chevron} size={13} />
        </button>
      )}
    </div>
  );

  if (loading && !data) return <div style={S.loading}>Cargando reporte operativo…</div>;
  if (err) return <div style={S.err}>{err}</div>;
  if (!data) return <div style={S.loading}>Sin datos</div>;

  const { produccion, enviosTeran, stockFabrica, comprasMP } = data;
  const TOP = 12;
  const OC_BADGE = {
    por_aprobar: ['var(--lp-warning-100)', 'var(--lp-warning-700)'],
    pendiente: ['var(--lp-warning-100)', 'var(--lp-warning-700)'],
    pendiente_aprobacion: ['var(--lp-warning-100)', 'var(--lp-warning-700)'],
    solicitud: ['var(--lp-warning-100)', 'var(--lp-warning-700)'],
    aprobada: ['var(--lp-info-100)', 'var(--lp-info-700)'],
    recibida: ['var(--lp-success-100)', 'var(--lp-success-700)'],
    cancelada: ['var(--lp-bg-sunken)', 'var(--lp-text-tertiary)'],
  };
  const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—';

  return (
    <>
      <HelpHint id="reportes-operacion" title="Vista operativa">
        Resumen del flujo físico completo del periodo: lo <strong>producido</strong> en fábrica, lo <strong>enviado a Terán</strong> (todas las vías: recolección, OT y transfer directo), el <strong>stock que sigue en fábrica</strong> sin enviar, y las <strong>órdenes de compra de MP</strong> que compras tiene en curso.
      </HelpHint>

      {/* Selector de periodo — controla producción, envíos y OCs del periodo.
          El stock en fábrica es foto ACTUAL (no depende del periodo). */}
      <div style={S.perWrap}>
        {[7, 30, 90].map(d => (
          <button key={d} type="button" style={S.perBtn(d === dias, !isDesktop)}
            data-id={`reportes.operacion.dias.${d}`} data-rol="admin"
            onClick={() => setDias(d)}>Últimos {d} días</button>
        ))}
      </div>

      <div style={S.kpiGrid(isDesktop)}>
        <KPI label="Producido" accent={CHART.brand} value={produccion.totalCubetas.toLocaleString('es-MX')}
          sub={`cubetas · ${produccion.totalLotes} lotes · ${produccion.totalLitros.toLocaleString('es-MX')} L`} />
        <KPI label="Enviado a Terán" accent={CHART.info} value={enviosTeran.totalCubetas.toLocaleString('es-MX')}
          sub={`cubetas · ${enviosTeran.totalEnvios} envíos`} />
        <KPI label="En fábrica sin enviar" accent={stockFabrica.totalFabrica > 0 ? CHART.amber : 'var(--lp-border-strong)'}
          value={stockFabrica.totalFabrica.toLocaleString('es-MX')}
          sub={`cub ahora · ${stockFabrica.totalTransito.toLocaleString('es-MX')} en tránsito`} />
        <KPI label="OCs de MP abiertas" accent={comprasMP.abiertas.porAprobar > 0 ? CHART.amber : CHART.success}
          value={comprasMP.abiertas.total}
          sub={`${comprasMP.abiertas.porAprobar} por aprobar · ${comprasMP.abiertas.kgPorLlegar.toLocaleString('es-MX')} kg por llegar`} />
      </div>

      {/* ═══ 1. Producción del periodo ═══ */}
      <div style={S.section}>
        <SecHead to="/trazabilidad" label="Trazabilidad">Producción · últimos {dias} días</SecHead>
        {produccion.porProducto.length === 0 ? (
          <div style={S.empty}>Sin lotes producidos en el periodo.</div>
        ) : (
          <div className="table-scroll"><table style={S.table}>
            <thead><tr>
              <th style={S.th}>Producto</th>
              <th style={S.th}>Lotes</th>
              <th style={S.th}>Cubetas</th>
              <th style={S.th}>Litros</th>
            </tr></thead>
            <tbody>
              {produccion.porProducto.slice(0, TOP).map(p => (
                <tr key={p.producto}>
                  <td style={S.td}><strong>{p.producto}</strong></td>
                  <td style={S.tdNum}>{p.lotes}</td>
                  <td style={S.tdNum}>{p.cubetas.toLocaleString('es-MX')}</td>
                  <td style={S.tdNum}>{p.litros.toLocaleString('es-MX')}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {produccion.porProducto.length > TOP && (
          <div style={{ padding: '10px 0 0', fontSize: 11, color: 'var(--lp-text-tertiary)', textAlign: 'center' }}>
            Mostrando {TOP} de {produccion.porProducto.length} productos
          </div>
        )}
      </div>

      {/* ═══ 2. Enviado a Terán ═══ */}
      <div style={S.section}>
        <SecHead to="/transferencias" label="Transferencias">Enviado a Terán · últimos {dias} días</SecHead>
        {(enviosTeran.enTransito.ots > 0 || enviosTeran.porSurtir.ots > 0) && (
          <div style={S.alertBox}>
            {enviosTeran.enTransito.ots > 0 && (
              <div><strong>{enviosTeran.enTransito.cubetas.toLocaleString('es-MX')} cub en tránsito</strong> ({enviosTeran.enTransito.ots} OT surtidas sin recibir: {enviosTeran.enTransito.folios.join(', ')})</div>
            )}
            {enviosTeran.porSurtir.ots > 0 && (
              <div>{enviosTeran.porSurtir.cubetas.toLocaleString('es-MX')} cub solicitadas por surtir ({enviosTeran.porSurtir.ots} OT: {enviosTeran.porSurtir.folios.join(', ')})</div>
            )}
          </div>
        )}
        {enviosTeran.porProducto.length === 0 ? (
          <div style={S.empty}>Sin envíos a Terán en el periodo.</div>
        ) : (
          <div className="table-scroll"><table style={S.table}>
            <thead><tr>
              <th style={S.th}>Producto</th>
              <th style={S.th}>Cubetas enviadas</th>
              <th style={S.th}>Envíos</th>
            </tr></thead>
            <tbody>
              {enviosTeran.porProducto.slice(0, TOP).map(p => (
                <tr key={p.producto}>
                  <td style={S.td}><strong>{p.producto}</strong></td>
                  <td style={S.tdNum}>{p.cubetas.toLocaleString('es-MX')}</td>
                  <td style={S.tdNum}>{p.envios}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {enviosTeran.porProducto.length > TOP && (
          <div style={{ padding: '10px 0 0', fontSize: 11, color: 'var(--lp-text-tertiary)', textAlign: 'center' }}>
            Mostrando {TOP} de {enviosTeran.porProducto.length} productos
          </div>
        )}
      </div>

      {/* ═══ 3. Stock en fábrica sin enviar (foto actual) ═══ */}
      <div style={S.section}>
        <SecHead to="/almacen?vista=fabrica" label="Almacén">Stock en fábrica sin enviar · ahora</SecHead>
        {stockFabrica.productos.length === 0 ? (
          <div style={S.empty}>Fábrica sin PT pendiente de enviar. Todo está en Terán.</div>
        ) : (
          <div className="table-scroll"><table style={S.table}>
            <thead><tr>
              <th style={S.th}>Producto</th>
              <th style={S.th}>Fábrica</th>
              <th style={S.th}>Tránsito</th>
              <th style={S.th}>Terán</th>
            </tr></thead>
            <tbody>
              {stockFabrica.productos.slice(0, TOP).map(p => (
                <tr key={p.producto}>
                  <td style={S.td}><strong>{p.producto}</strong></td>
                  <td style={S.tdNum}>
                    {p.fabrica > 0
                      ? <span style={S.badge('var(--lp-warning-100)', 'var(--lp-warning-700)')}>{p.fabrica.toLocaleString('es-MX')}</span>
                      : p.fabrica.toLocaleString('es-MX')}
                  </td>
                  <td style={S.tdNum}>{p.transito.toLocaleString('es-MX')}</td>
                  <td style={S.tdNum}>{p.teran.toLocaleString('es-MX')}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {stockFabrica.productos.length > TOP && (
          <div style={{ padding: '10px 0 0', fontSize: 11, color: 'var(--lp-text-tertiary)', textAlign: 'center' }}>
            Mostrando {TOP} de {stockFabrica.productos.length} productos con stock en fábrica
          </div>
        )}
      </div>

      {/* ═══ 4. Compras de MP (Arely) ═══ */}
      <div style={S.section}>
        <SecHead to="/compras" label="Compras">Compras de MP · últimos {dias} días</SecHead>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, color: 'var(--lp-text-secondary)' }}>
          <span><b style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)' }}>{comprasMP.periodo.creadas}</b> OCs creadas</span>
          <span><b style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)' }}>{comprasMP.periodo.kgPedidos.toLocaleString('es-MX')}</b> kg pedidos</span>
          <span><b style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)' }}>{comprasMP.periodo.recibidas}</b> recibidas</span>
          {comprasMP.periodo.urgentes > 0 && (
            <span style={S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)')}>{comprasMP.periodo.urgentes} urgentes</span>
          )}
        </div>
        {comprasMP.porMP.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.03em', margin: '4px 0 6px' }}>MPs más pedidas del periodo</div>
            <div className="table-scroll"><table style={{ ...S.table, marginBottom: 14 }}>
              <thead><tr>
                <th style={S.th}>Materia prima</th>
                <th style={S.th}>kg pedidos</th>
                <th style={S.th}>OCs</th>
              </tr></thead>
              <tbody>
                {comprasMP.porMP.slice(0, 10).map(m => (
                  <tr key={m.mp}>
                    <td style={S.td}><strong>{m.mp}</strong></td>
                    <td style={S.tdNum}>{m.kg.toLocaleString('es-MX')}</td>
                    <td style={S.tdNum}>{m.ocs}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </>
        )}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.03em', margin: '4px 0 6px' }}>Últimas órdenes de compra</div>
        {comprasMP.recientes.length === 0 ? (
          <div style={S.empty}>Sin órdenes de compra registradas.</div>
        ) : (
          <div className="table-scroll"><table style={S.table}>
            <thead><tr>
              <th style={S.th}>OC</th>
              <th style={S.th}>Proveedor</th>
              <th style={S.th}>MPs</th>
              <th style={S.th}>kg</th>
              <th style={S.th}>Estado</th>
              <th style={S.th}>Creada</th>
            </tr></thead>
            <tbody>
              {comprasMP.recientes.map(o => {
                const [bg, fg] = OC_BADGE[o.estado] || ['var(--lp-bg-sunken)', 'var(--lp-text-secondary)'];
                return (
                  <tr key={o.codigo}>
                    <td style={S.td}><strong>{o.codigo}</strong>{o.prioridad === 'urgente' && <span style={{ ...S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)'), marginLeft: 6 }}>urgente</span>}</td>
                    <td style={S.td}>{o.proveedor}</td>
                    <td style={S.td}>{o.mps.join(', ') || '—'}</td>
                    <td style={S.tdNum}>{o.kg.toLocaleString('es-MX')}</td>
                    <td style={S.td}><span style={S.badge(bg, fg)}>{String(o.estado).replace(/_/g, ' ')}</span></td>
                    <td style={S.tdNum}>{fmtFecha(o.fechaCreacion)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

/* ── Definición de sub-secciones ─────────────────────────────────────────────
   Jul 2026 (simplificación dueño): "Operación" NUEVA (default admin) con los 4
   datos operativos; "Causas" dejó de ser pestaña — el catálogo vive dentro de
   Análisis (mismo componente, cero funciones perdidas). */
const SECCIONES = [
  { id: 'operacion',   label: 'Operación',    full: 'Operación',         sub: 'Producción · Terán · stock · compras MP', adminOnly: true },
  { id: 'cierre',      label: 'Cierre',       full: 'Cierre mensual',    sub: 'Preview del mes + cerrar mes' },
  { id: 'historico',   label: 'Histórico',    full: 'Histórico mensual', sub: 'Serie de cierres anteriores' },
  { id: 'trimestral',  label: 'Trimestral',   full: 'Trimestral',        sub: 'Agregado Q vs Q anterior' },
  { id: 'analisis',    label: 'Análisis',     full: 'Análisis avanzado', sub: 'Pareto · rotación · stock muerto · causas' },
  { id: 'estrategico', label: 'Estratégico',  full: 'Estratégico',       sub: 'Anual · lead times · ABC' },
];

/* ── Bottom-sheet de secciones (móvil) ───────────────────────────────────── */
function SeccionesSheet({ active, secciones = SECCIONES, onPick, onClose }) {
  /* MÓVIL: este sheet sólo se monta cuando está abierto (ver render gateado con
     !isDesktop && sheetOpen). Bloquea el scroll del FONDO y publica --pp-vvh para
     que el contenedor tenga overflow interno scrolleable (mismo fix que Modal.jsx). */
  useBodyScrollLock(true);
  return (
    <div style={S.sheetOverlay}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.sheetGrab} />
        <div style={S.sheetTitle}>Secciones de reportes</div>
        <div style={S.sheetGrid}>
          {secciones.map(sec => {
            const on = sec.id === active;
            return (
              <button key={sec.id} style={S.sheetItem(on)} onClick={() => onPick(sec.id)}>
                <span style={S.sheetItemLabel(on)}>{sec.full}</span>
                <span style={S.sheetItemSub}>{sec.sub}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Componente principal ────────────────────────────────────────────────── */
export default function ReportesPage() {
  const { user } = useAuth();
  const [confirm, ConfirmEl] = useConfirm();
  const isDesktop = useIsDesktop();
  const [searchParams] = useSearchParams();
  const esAdmin = user?.rol === 'admin';
  const puedeImportExport = esAdmin || user?.rol === 'compras';

  /* Jul 2026 (simplificación dueño): "Operación" solo admin (el endpoint es
     solo-admin) y es su pestaña default. El selector "Este mes · Trimestre ·
     Año" se ELIMINÓ: duplicaba las pestañas (navegaban a lo mismo). */
  const seccionesVisibles = SECCIONES.filter(s => !s.adminOnly || esAdmin);
  const defaultTab = esAdmin ? 'operacion' : 'cierre';

  /* Deep-link a sub-pestaña vía ?tab= (p.ej. el asistente abre /reportes?tab=trimestral).
     'causas' (pestaña retirada) mapea a 'analisis', donde vive ahora el catálogo. */
  const resolveTab = (t) => {
    if (t === 'causas') return 'analisis';
    return (t && seccionesVisibles.some(s => s.id === t)) ? t : null;
  };
  const [activeTab, setActiveTab] = useState(() => resolveTab(searchParams.get('tab')) || defaultTab);
  /* Sync URL → estado: si navegas a /reportes?tab=... estando YA en Reportes,
     react-router NO remonta y el useState inicial no se relee. Setear al mismo
     valor es no-op (no provoca loop). */
  useEffect(() => {
    const t = resolveTab(searchParams.get('tab'));
    if (t) setActiveTab(t);
  }, [searchParams]);
  const [detallePeriodo, setDetallePeriodo] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeSec = seccionesVisibles.find(s => s.id === activeTab) || seccionesVisibles[0];

  const selectTab = (id) => { setActiveTab(id); setDetallePeriodo(null); };

  /* Subtítulo dinámico por sección */
  const now = new Date();
  const TRIM_TXT = ['ene–mar', 'abr–jun', 'jul–sep', 'oct–dic'];
  const subPeriodo = activeTab === 'operacion'
    ? 'Producción · envíos a Terán · stock en fábrica · compras MP'
    : activeTab === 'cierre'
      ? `Resumen de ${now.toLocaleDateString('es-MX', { month: 'long' })} ${now.getFullYear()}`
      : activeTab === 'trimestral'
        ? `Trimestre ${TRIM_TXT[Math.floor(now.getMonth() / 3)]} ${now.getFullYear()}`
        : activeTab === 'estrategico'
          ? `Acumulado ${now.getFullYear()}`
          : activeSec.full;

  /* Export gateado compras/admin (data-id reportes.btn.exportar). Vive DENTRO
     de la pestaña Cierre (exporta el snapshot del mes en curso — ahí es donde
     tiene sentido; Histórico ya tiene su Excel por renglón). */
  const handleExport = () => {
    const d = new Date();
    const per = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    window.location.href = api.urlExportSnapshot(per);
  };

  return (
    <div>
      <TopBar title="Reportes" />
      <div style={{ ...S.wrap, ...(isDesktop ? S.wrapDesk : {}) }}>
        <div style={S.h1}>Reportes</div>
        <div style={S.psub}>
          {detallePeriodo ? 'Detalle de snapshot' : subPeriodo}
        </div>

        {/* Selector de secciones: segmented escritorio / botón→bottom-sheet móvil */}
        {isDesktop ? (
          <div style={S.segWrap}>
            {seccionesVisibles.map(sec => (
              <button key={sec.id} style={S.seg(sec.id === activeTab && !detallePeriodo)} onClick={() => selectTab(sec.id)}
                data-id={`reportes.sec.${sec.id}`} data-rol="admin,inventario,compras">
                {sec.label}
              </button>
            ))}
          </div>
        ) : (
          <button style={S.secSelector} onClick={() => setSheetOpen(true)}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={S.secSelHint}>Sección</span>
              <span style={S.secSelLabel}>{activeSec.full}</span>
            </span>
            <Icon d={IC.chevron} size={20} />
          </button>
        )}

        {detallePeriodo ? (
          <DetalleSnapshot periodo={detallePeriodo} onClose={() => setDetallePeriodo(null)} isDesktop={isDesktop} />
        ) : (
          <>
            {activeTab === 'operacion' && esAdmin && <OperacionTab isDesktop={isDesktop} />}
            {activeTab === 'cierre' && <CierreMensualTab esAdmin={esAdmin} confirm={confirm} isDesktop={isDesktop} puedeExport={puedeImportExport} onExport={handleExport} />}
            {activeTab === 'historico' && <HistoricoTab onSelectPeriodo={setDetallePeriodo} />}
            {activeTab === 'trimestral' && <TrimestralTab isDesktop={isDesktop} />}
            {activeTab === 'analisis' && <AnalisisAvanzadoTab esAdmin={esAdmin} />}
            {activeTab === 'estrategico' && <EstrategicoTab />}
          </>
        )}
      </div>

      {!isDesktop && sheetOpen && (
        <SeccionesSheet
          active={activeTab}
          secciones={seccionesVisibles}
          onPick={(id) => { selectTab(id); setSheetOpen(false); }}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {ConfirmEl}
    </div>
  );
}
