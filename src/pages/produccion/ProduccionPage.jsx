import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import Cronometro from '../../components/Cronometro';
import ProduccionFlow from './ProduccionFlow';
import humanizeError from '../../utils/humanizeError'; /* AUDIT UX 16-jul (U4) */
import { etiquetaMedidaReal } from '../../utils/ptMedidas';
import { ESTADO_PEDIDO_LABEL, ESTADO_PEDIDO_COLOR, normEstado, ESTADO_LOTE_POST_PRODUCCION } from '../../lib/estados';
import LoteDetalleModal from './LoteDetalleModal';
import NDAModal, { ndaYaAceptado } from '../../components/NDAModal';
import PageTabs from '../../components/ui/PageTabs';
/* DECISIÓN OWNER jun 2026: al terminar la producción, la card del lote NO se
   va de esta pantalla — permanece aquí (QC → envasado) hasta envasarse por
   completo; después sigue su ciclo en Pedidos. Card canónica + modal inline. */
import PedidoLoteActions from '../../components/PedidoLoteActions';
import { EnvasadoModal, ReenvasadoModal, SubloteQRPrintModal } from '../stock-fabrica/StockFabricaPage';

/* ═══════════════════════════════════════════════════════════════════ */
/* ICONOS — line SVG (sin emojis). Diseño verde Claude Design.         */
/* ═══════════════════════════════════════════════════════════════════ */
const Ico = ({ d, size = 18, fill = 'none', sw = 2, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const IcoClose   = (p) => <Ico {...p} d="M18 6L6 18M6 6l12 12" />;
const IcoCheck   = (p) => <Ico {...p} d="M20 6L9 17l-5-5" />;
const IcoX       = (p) => <Ico {...p} d="M18 6L6 18M6 6l12 12" />;
const IcoFlask   = (p) => <Ico {...p} d={['M9 3h6', 'M10 3v6.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-8.5V3', 'M7.5 14h9']} />;
const IcoPlay    = (p) => <Ico {...p} fill="currentColor" sw={0} d="M7 5l12 7-12 7z" />;
const IcoEye     = (p) => <Ico {...p} d={['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z']} />;
const IcoBeaker  = (p) => <Ico {...p} d={['M10 2v6.6L4.8 17A2 2 0 0 0 6.5 20h11a2 2 0 0 0 1.7-3L14 8.6V2', 'M9 2h6']} />;
const IcoGear    = (p) => <Ico {...p} size={p.size || 40} sw={1.6} d={['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z']} />;
const IcoCheckCircle = (p) => <Ico {...p} size={p.size || 40} sw={1.7} d={['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3']} />;
const IcoChart   = (p) => <Ico {...p} size={p.size || 40} sw={1.6} d={['M3 3v18h18', 'M7 14l4-4 3 3 5-6']} />;

/* QC accent — morado universal (no es color de marca, es estado QC) */
const QC = 'var(--lp-qc-600)';

/* CSS inyectado una vez — focus verde de inputs QC (mockup .qci:focus).
   Mismo selector que en ProduccionFlow; regla idempotente. */
const PAGE_CSS = `
  .lp-qci:focus{ border-color: var(--lp-brand-600) !important; box-shadow: var(--lp-focus-ring); }
`;
function injectPageCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lp-prodpage-css')) return;
  const st = document.createElement('style');
  st.id = 'lp-prodpage-css';
  st.textContent = PAGE_CSS;
  document.head.appendChild(st);
}

/* ── Badge helper ── */
const B = (bg, fg) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', fontSize: 10.5, fontWeight: 600,
  borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap',
});

const S = {
  wrap: { padding: '0 20px 100px' },
  tabs: {
    display: 'flex', gap: 0, borderBottom: '2px solid var(--lp-border-subtle)',
    marginBottom: 16, overflowX: 'auto',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
  },
  tab: (active) => ({
    padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
    borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
    background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: 'var(--lp-font-sans)', marginBottom: -2, flexShrink: 0,
  }),
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10, marginBottom: 16,
  },
  kpi: (accent) => ({
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    border: '1px solid var(--lp-border-subtle)', padding: '14px 16px',
    borderTop: `3px solid ${accent}`,
  }),
  kpiLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)' },
  kpiValue: { fontSize: 24, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', marginTop: 4 },

  /* ── Desplegable de lotes del periodo (KPI Lotes Hoy/Mes clickeable) ── */
  lotesPanel: {
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', marginBottom: 16, overflow: 'hidden',
  },
  lotesPanelHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', borderBottom: '1px solid var(--lp-border-subtle)',
    fontSize: 12.5, fontWeight: 700, color: 'var(--lp-text-secondary)',
    background: 'var(--lp-bg-base)',
  },
  lotesPanelClose: {
    border: 'none', background: 'transparent', cursor: 'pointer',
    color: 'var(--lp-text-tertiary)', fontSize: 12, fontWeight: 600, font: 'inherit',
  },
  loteRow: {
    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
    padding: '11px 14px', background: 'transparent',
    border: 'none', borderBottom: '1px solid var(--lp-border-subtle)',
    cursor: 'pointer', textAlign: 'left', font: 'inherit',
  },
  loteCod: { fontSize: 13, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  loteProd: { fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  loteEstado: { fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' },
  loteFecha: { fontSize: 11, color: 'var(--lp-text-tertiary)', whiteSpace: 'nowrap' },
  loteChevron: { fontSize: 18, color: 'var(--lp-text-tertiary)', lineHeight: 1 },
  loteBadgePrueba: { fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)' },

  /* ── Cards móvil — mockup .lcard/.ltitle/.lmeta ── */
  card: (highlight) => ({
    background: highlight ? 'var(--lp-brand-50)' : 'var(--lp-bg-raised)',
    border: highlight ? '1.5px solid var(--lp-brand-200)' : '1px solid var(--lp-border-subtle)',
    borderRadius: 18, padding: '15px 16px', marginBottom: 10,
  }),
  cardTitle: { fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--lp-text-primary)', marginBottom: 3, lineHeight: 1.25 },
  cardMeta: { fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 4 },
  cardActions: { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' },

  /* ── Tabla escritorio (estilo SCREENS.produccion) ── */
  tablewrap: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
    color: 'var(--lp-text-tertiary)', padding: '12px 16px', borderBottom: '1px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-sunken)', whiteSpace: 'nowrap',
  },
  thR: { textAlign: 'right' },
  td: { padding: '13px 16px', borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 13.5, color: 'var(--lp-text-primary)', verticalAlign: 'middle' },
  tdR: { textAlign: 'right' },
  tdMono: { fontFamily: 'var(--lp-font-mono)', fontWeight: 600 },
  folio: { fontFamily: 'var(--lp-font-mono)', fontWeight: 600, color: 'var(--lp-brand-600)', fontSize: 12 },
  noteCard: {
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14,
    padding: '14px 16px', marginTop: 14, color: 'var(--lp-text-secondary)', fontSize: 13, lineHeight: 1.55,
    display: 'flex', gap: 10, alignItems: 'flex-start',
  },

  /* ── Botones ── */
  btnBase: {
    padding: '0 16px', minHeight: 44, borderRadius: 12, border: 'none', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '60px 20px' },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },

  /* ── Modal ── */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius-lg)',
    width: '100%', maxWidth: 520,
    maxHeight: 'calc(var(--pp-vvh, 100dvh) - 80px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))',
    overflow: 'auto',
    boxShadow: '0 8px 40px rgba(0,0,0,.22)',
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
  iconBtn: {
    width: 36, height: 36, borderRadius: 999, background: 'var(--lp-bg-sunken)',
    border: '1px solid var(--lp-border-subtle)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', color: 'var(--lp-text-tertiary)', flexShrink: 0,
  },
  fieldLabel: {
    fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)',
    marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '.04em',
  },
  fieldInput: {
    width: '100%', padding: '11px 12px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 14,
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    outline: 'none', boxSizing: 'border-box', marginBottom: 12,
  },
  /* Toast invertido (mockup .toast: bg texto / texto fondo) */
  toast: {
    position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
    padding: '12px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 1001,
    background: 'var(--lp-text-primary)', color: 'var(--lp-bg-base)',
    boxShadow: '0 8px 28px rgba(0,0,0,.20)', display: 'inline-flex', alignItems: 'center', gap: 8,
  },
  ingTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 },
  ingTh: {
    textAlign: 'left', padding: '8px 10px', fontWeight: 700, fontSize: 11,
    textTransform: 'uppercase', color: 'var(--lp-text-tertiary)',
    borderBottom: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-sunken)',
  },
  ingTd: {
    padding: '8px 10px', borderBottom: '1px solid var(--lp-border-subtle)',
    fontFamily: 'var(--lp-font-mono)', fontSize: 12, color: 'var(--lp-text-primary)',
  },
  infoBox: { padding: 14, background: 'var(--lp-bg-sunken)', borderRadius: 12, marginBottom: 16 },
};

/* botones por variante — width auto en escritorio, fluido en card móvil
   (acción dominante de card móvil = 46px como el .lbtn del mockup) */
const btn = (variant, fullWidth) => {
  const base = { ...S.btnBase, ...(fullWidth ? { width: '100%', minHeight: 46 } : { width: 'auto' }) };
  switch (variant) {
    case 'primary': return { ...base, background: 'var(--lp-brand-600)', color: '#fff' };
    case 'success': return { ...base, background: 'var(--lp-success-600)', color: '#fff' };
    case 'warning': return { ...base, background: 'var(--lp-warning-600)', color: '#fff' };
    case 'danger':  return { ...base, background: 'var(--lp-danger-600)', color: '#fff' };
    case 'ghost':   return { ...base, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', border: '1px solid var(--lp-border-subtle)' };
    default:        return { ...base, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' };
  }
};

/* badge de estado para tabla escritorio: punto de color + texto */
const EstadoBadge = ({ color, label }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600,
    padding: '4px 10px', borderRadius: 999,
    background: `color-mix(in srgb, ${color} 14%, transparent)`, color,
  }}>
    <span style={{ width: 7, height: 7, borderRadius: 999, background: color, flexShrink: 0 }} />
    {label}
  </span>
);

/* ═══════════════════════════════════════════════════════════════════ */
/* QC MODAL — Registrar resultados de calidad (UNIVERSAL)            */
/* §9.1: los campos de QC vienen del backend; este modal es universal */
/* (no por fórmula). Reskin verde, lógica intacta.                    */
/* ═══════════════════════════════════════════════════════════════════ */

/* Rangos QC default — ESPEJO de routes/produccion.js:241-243 (paso "QC
   Pre-Envasado" del wizard). Son el FALLBACK cuando /api/produccion/steps no
   responde en este contexto (rol sin acceso a la receta por NDA, fórmula sin
   pasos generables): el aviso de fuera-de-rango nunca debe quedarse mudo,
   porque este modal es el que LIBERA lotes en qc_hold. Brillo no tiene rango
   default en el backend → sin validación. Si el backend cambia sus rangos,
   actualizar aquí también. */
const QC_RANGOS_DEFAULT = {
  viscosidad: { min: 80, max: 120, rango: '80-120', unidad: 'KU' },
  ph:         { min: 7.5, max: 9.5, rango: '7.5-9.5', unidad: '' },
  densidad:   { min: 1.10, max: 1.50, rango: '1.10-1.50', unidad: 'g/mL' },
};

/* export con nombre: solo para poder testear el modal aislado (QCModalRangos.test) */
export function QCModal({ orden, lotes, qcRecords, userName, onClose, onSuccess }) {
  const [viscosidad, setViscosidad] = useState('');
  const [ph, setPh] = useState('');
  const [brillo, setBrillo] = useState('');
  const [densidad, setDensidad] = useState('');
  const [notas, setNotas] = useState('');
  /* Justificación obligatoria cuando se aprueba con lecturas fuera de rango:
     el override humano se permite (aviso, NO bloqueo duro) pero queda auditado
     dentro de qcResultados del lote y del ledger qc_records. */
  const [notaFuera, setNotaFuera] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* MÓVIL: bloquear el scroll del fondo mientras el modal QC está abierto y
     publicar --pp-vvh para que el cuerpo del modal scrollee internamente (sin
     scroll-chaining al fondo). Este componente solo se monta cuando está
     abierto, por eso `true`. Mismo patrón canónico que src/components/ui/Modal.jsx. */
  useBodyScrollLock(true);

  /* Resolve the lote behind the orden — could be embedded as orden.loteRef
     (when qcItems built the row from a lote without orden), or we resolve
     it from the lotes array by ordenId/codigo. The state machine operates
     on lote.id; this lookup ensures the dispatch goes to the right entity. */
  const lote = useMemo(() => {
    if (orden?.loteRef) return orden.loteRef;
    if (!Array.isArray(lotes)) return null;
    return lotes.find(l => l && (
      (l.ordenId && l.ordenId === orden?.id) ||
      (l.ordenCodigo && orden?.codigo && l.ordenCodigo === orden.codigo) ||
      (l.id === orden?.id)
    )) || null;
  }, [orden, lotes]);

  /* Rangos por fórmula — la MISMA fuente que el wizard (FIX ago 2026): el
     paso "QC Pre-Envasado" de /api/produccion/steps trae min/max por prueba.
     Antes este modal aceptaba 130 KU sin aviso mientras el wizard mandaba a
     qc_hold lo mismo. Si la receta no está disponible para esta sesión (403
     del NDA — el endpoint es solo admin/tecnico) o la fórmula no genera
     pasos, se quedan los defaults de arriba. */
  const [rangos, setRangos] = useState(QC_RANGOS_DEFAULT);
  const productoQc = orden?.formula || orden?.producto || lote?.producto || lote?.nombre || '';
  useEffect(() => {
    if (!productoQc) return;
    let cancel = false;
    (async () => {
      try {
        const r = await api.getProduccionSteps(productoQc, 1, 19);
        if (cancel || !r?.ok || !Array.isArray(r.steps)) return;
        const next = { ...QC_RANGOS_DEFAULT };
        let hallado = false;
        for (const s of r.steps) {
          if (!s || s.type !== 'qc') continue;
          for (const p of (s.pruebas || [])) {
            if (p && p.id && (p.min != null || p.max != null)) {
              next[p.id] = { min: p.min, max: p.max, rango: p.rango, unidad: p.unidad };
              hallado = true;
            }
          }
        }
        if (hallado && !cancel) setRangos(next);
      } catch { /* sin acceso a la receta → defaults */ }
    })();
    return () => { cancel = true; };
  }, [productoQc]);

  /* Campos QC universales — `rid` es el id canónico de la prueba en el paso
     QC del backend (routes/produccion.js), para casar rango y lectura previa. */
  const qcFields = [
    { key: 'visc', rid: 'viscosidad', label: 'Viscosidad (KU)', step: '0.1', ph: 'Ej: 85', value: viscosidad, set: setViscosidad },
    { key: 'ph',   rid: 'ph',         label: 'pH',              step: '0.1', ph: 'Ej: 8.5', value: ph,         set: setPh },
    { key: 'bri',  rid: 'brillo',     label: 'Brillo (GU)',     step: '0.1', ph: 'Ej: 20', value: brillo,     set: setBrillo },
    { key: 'den',  rid: 'densidad',   label: 'Densidad (g/mL)', step: '0.01', ph: 'Ej: 1.32', value: densidad, set: setDensidad },
  ];

  const fueraDeRango = (rid, val) => {
    const r = rangos[rid];
    if (!r || val === '' || val == null) return false;
    const num = parseFloat(val);
    if (isNaN(num)) return false;
    return (r.min != null && num < r.min) || (r.max != null && num > r.max);
  };
  const camposFuera = qcFields.filter(f => fueraDeRango(f.rid, f.value));
  const hayFuera = camposFuera.length > 0;
  const notaFueraOk = notaFuera.trim().length >= 5;

  /* Lecturas que el lote YA trae (wizard de producción / QC previos) — solo
     mostrar, sin fetch nuevo: Enrique no re-captura a ciegas lo ya medido en
     planta. server.js guarda el merge en lote.qcResultados (base qcReadings). */
  const lecturasPrevias = lote?.qcResultados || lote?.qcReadings || orden?.qcResultados || null;

  const buildQcPayload = (resultado) => ({
    viscosidad: viscosidad ? parseFloat(viscosidad) : null,
    ph: ph ? parseFloat(ph) : null,
    brillo: brillo ? parseFloat(brillo) : null,
    densidad: densidad ? parseFloat(densidad) : null,
    notas: notas || '',
    /* la justificación viaja DENTRO del objeto qc que ya viaja — server.js la
       mergea a lote.qcResultados sin cambiar el shape de la transición */
    ...(hayFuera && notaFuera.trim() ? { notaFueraDeRango: notaFuera.trim() } : {}),
    resultado,
    fecha: new Date().toISOString(),
    usuario: userName,
  });

  const buildQcRecord = (resultado) => ({
    id: Date.now().toString(36),
    ordenId: orden?.id,
    ordenCodigo: orden?.codigo,
    loteId: lote?.id,
    codigoLote: lote?.codigoLote || lote?.codigo,
    producto: orden?.formula || lote?.producto || lote?.nombre,
    resultado,
    viscosidad: viscosidad ? parseFloat(viscosidad) : null,
    ph: ph ? parseFloat(ph) : null,
    brillo: brillo ? parseFloat(brillo) : null,
    densidad: densidad ? parseFloat(densidad) : null,
    notas: notas || '',
    ...(hayFuera && notaFuera.trim() ? { notaFueraDeRango: notaFuera.trim() } : {}),
    fecha: new Date().toISOString(),
    usuario: userName,
  });

  const handleApprove = async () => {
    /* Override humano permitido, pero NUNCA silencioso: aprobar con lecturas
       fuera de rango exige justificación (el botón ya viene deshabilitado;
       este guard cubre el enter/submit programático). */
    if (hayFuera && !notaFueraOk) {
      return setError('Hay lecturas fuera de rango: escribe la justificación (mínimo 5 caracteres) para aprobar.');
    }
    setSaving(true);
    setError('');
    try {
      /* PRIMARY: usar state machine si tenemos lote — dispatcha aprobarQC
         que valida estado actual ('producido' o 'qc_hold'), aplica QC bajo
         mutex, propaga estado del pedido y broadcast WebSocket por rol. */
      if (lote?.id) {
        await api.transicionLote(lote.id, 'aprobarQC', {
          qc: buildQcPayload('aprobado'),
          usuario: userName,
        });
      } else if (orden?.id) {
        /* FALLBACK: si no hay lote (orden sin trazabilidad aún) mantener el
           upsert sobre la orden directo. Igual registramos QC.
           FIX jun 2026 (auditoría M4): estado CANÓNICO 'qc_aprobado' — antes
           escribía 'terminada', que no existe en FLUJO_ESTADOS y dejaba la
           orden huérfana (ningún badge/timeline la mapeaba). */
        await api.upsertOrden({
          ...orden,
          estado: 'qc_aprobado',
          qcResultados: { ...buildQcPayload('aprobado'), aprobado: true },
          historial: [
            ...(orden.historial || []),
            { estado: 'qc_aprobado', fecha: new Date().toISOString(), usuario: userName, nota: 'QC aprobado' },
          ],
        });
      }
      /* Ledger inmutable de QC (independiente del state machine) */
      try { await api.registrarQC(buildQcRecord('aprobado')); } catch {}
      onSuccess(`QC aprobado: ${orden?.formula || lote?.producto}`);
    } catch (err) {
      setError(humanizeError(err)); /* AUDIT UX 16-jul (U4) */
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!notas.trim()) return setError('Describe el motivo del rechazo en Notas');
    setSaving(true);
    setError('');
    try {
      if (lote?.id) {
        await api.transicionLote(lote.id, 'rechazarQC', {
          qc: buildQcPayload('rechazado'),
          /* nota Y motivo — el guard del backend lee nota (auditoría D1). */
          nota: notas,
          motivo: notas,
          usuario: userName,
        });
      } else if (orden?.id) {
        /* FIX jun 2026 (auditoría M4): 'qc_hold' canónico (la SM manda QC
           rechazado a hold; reabrir producción es el paso explícito después). */
        await api.upsertOrden({
          ...orden,
          estado: 'qc_hold',
          qcResultados: { ...buildQcPayload('rechazado'), aprobado: false },
          historial: [
            ...(orden.historial || []),
            { estado: 'qc_hold', fecha: new Date().toISOString(), usuario: userName, nota: `QC rechazado: ${notas}` },
          ],
        });
      }
      try { await api.registrarQC(buildQcRecord('rechazado')); } catch {}
      onSuccess(`QC rechazado: ${orden?.formula || lote?.producto} → vuelve a producción`);
    } catch (err) {
      setError(humanizeError(err)); /* AUDIT UX 16-jul (U4) */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Control de calidad</span>
          <button onClick={onClose} style={S.iconBtn} aria-label="Cerrar"><IcoClose size={17} /></button>
        </div>
        <div style={S.modalBody}>
          {error && (
            <div style={{ padding: '9px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={S.infoBox}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' }}>{orden.codigo}</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{orden.formula || orden.producto}</div>
            <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2 }}>
              <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 600 }}>{orden.cantidad}</span> cubetas
            </div>
          </div>

          {/* Grid QC 2 col — mockup .qcgrid/.qcf/.qci: tile suave, input mono
             con focus verde (.lp-qci). Bajo cada campo: el rango exigido (el
             mismo del wizard) + la lectura que el wizard ya dejó en el lote. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {qcFields.map(f => {
              const r = rangos[f.rid];
              const fuera = fueraDeRango(f.rid, f.value);
              const lecturaWizard = lecturasPrevias && lecturasPrevias[f.rid] != null && lecturasPrevias[f.rid] !== ''
                ? lecturasPrevias[f.rid] : null;
              return (
                <div key={f.key} style={{ padding: 12, borderRadius: 14, background: 'var(--lp-bg-sunken)' }}>
                  <label style={{ ...S.fieldLabel, marginBottom: 0 }}>{f.label}</label>
                  <input
                    className="lp-qci"
                    style={{
                      width: '100%', height: 42, marginTop: 6, padding: '0 10px', borderRadius: 10,
                      /* ámbar = aviso (no bloqueo): la lectura salió del rango */
                      border: fuera ? '1.5px solid var(--lp-warning-600)' : '1.5px solid var(--lp-border-subtle)',
                      background: 'var(--lp-bg-raised)',
                      color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)', fontSize: 16,
                      outline: 'none', boxSizing: 'border-box',
                    }}
                    type="number" inputMode="decimal"
                    step={f.step} placeholder={f.ph} value={f.value} onChange={e => f.set(e.target.value)} />
                  {r?.rango && (
                    <div style={{
                      fontSize: 11, marginTop: 5, fontFamily: 'var(--lp-font-mono)',
                      fontWeight: fuera ? 700 : 500,
                      color: fuera ? 'var(--lp-warning-700)' : 'var(--lp-text-secondary)',
                    }}>
                      {fuera ? 'Fuera de rango — ' : ''}Rango: {r.rango}{r.unidad ? ` ${r.unidad}` : ''}
                    </div>
                  )}
                  {lecturaWizard != null && (
                    <div style={{ fontSize: 11, marginTop: 3, color: 'var(--lp-text-secondary)' }}>
                      Wizard: <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 600 }}>{String(lecturaWizard)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Aprobar con lecturas fuera de rango = decisión humana AUDITADA:
             la justificación es obligatoria (≥5 chars) y viaja en el payload
             de la transición (qc.notaFueraDeRango). */}
          {hayFuera && (
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: 'var(--lp-warning-50)', border: '1px solid var(--lp-warning-100)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-warning-700)', marginBottom: 6 }}>
                Fuera de rango: {camposFuera.map(f => f.label).join(', ')}
              </div>
              <label style={S.fieldLabel} htmlFor="qc-nota-fuera">Justificación para aprobar (obligatoria)</label>
              <textarea
                id="qc-nota-fuera"
                style={{
                  width: '100%', minHeight: 64, marginTop: 4, padding: '8px 10px', borderRadius: 10,
                  border: '1.5px solid var(--lp-warning-600)', background: 'var(--lp-bg-raised)',
                  color: 'var(--lp-text-primary)', fontFamily: 'inherit', fontSize: 13,
                  outline: 'none', boxSizing: 'border-box', resize: 'vertical',
                }}
                placeholder="Por qué se aprueba con lecturas fuera de rango (mínimo 5 caracteres)..."
                value={notaFuera} onChange={e => setNotaFuera(e.target.value)} />
            </div>
          )}

          <label style={S.fieldLabel}>Notas / Observaciones</label>
          <input style={S.fieldInput} placeholder="Observaciones del QC..."
            value={notas} onChange={e => setNotas(e.target.value)} />
        </div>
        <div style={S.modalFooter}>
          <button style={btn('ghost')} onClick={onClose}>Cancelar</button>
          <button style={btn('danger')} disabled={saving} onClick={handleReject}>
            <IcoX size={15} /> Rechazar
          </button>
          {/* deshabilitado mientras haya fuera-de-rango sin justificar — el
             handler repite el guard por si llega un submit programático */}
          <button style={btn('success')} disabled={saving || (hayFuera && !notaFueraOk)} onClick={handleApprove}>
            {saving ? 'Guardando...' : <><IcoCheck size={15} /> Aprobar QC</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                         */
/* ═══════════════════════════════════════════════════════════════════ */
export default function ProduccionPage() {
  const { user, can } = useAuth();
  const userName = user?.nombre || '?';
  const isDesktop = useIsDesktop();
  /* Leer ?tab=calidad de la URL para que redirección desde alertas funcione.
     Permite que push notifs o notificacionesPage envíen al usuario directo
     a la tab Calidad QC. */
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  /* FIX jun 2026 (censo duplicados, decisión owner): se eliminan "Mis activos"
     (lista que solo navegaba — duplicaba las cards de Pedidos) y "Reportes"
     (placeholder con KPI roto). Quedan: Lanzar lote (default) · Calidad QC.
     Deep links ?tab=calidad siguen funcionando; ?tab=activos/reportes caen al default. */
  const initialTab = searchParams.get('tab') === 'calidad' ? 'calidad' : 'produccion';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [verLotes, setVerLotes] = useState(null); /* null | 'hoy' | 'mes' — KPI Lotes desplegable */
  const [detalleLote, setDetalleLote] = useState(null); /* lote para el modal de detalle/trazabilidad inline */
  /* Limpiar el query param después de leerlo para que un F5 no vuelva al mismo tab forzado.
     FIX jun 2026 (M1): no borrar `continuar` hasta que el efecto de auto-abrir
     wizard lo haya consumido (depende de productibles que cargan async). */
  useEffect(() => {
    if (searchParams.get('tab') && !searchParams.get('continuar')) {
      const params = new URLSearchParams(searchParams);
      params.delete('tab');
      setSearchParams(params, { replace: true });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);
  /* FIX jun 2026 (auditoría D8): deep-link ?tab= VIVO — si la página ya está
     montada (tile "Calidad QC" del menú, cards del dashboard), el initialTab
     no se re-evalúa; este efecto cambia la tab al vuelo. */
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'calidad') setActiveTab('calidad');
    else if (t === 'produccion') setActiveTab('produccion');
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [searchParams]);
  const [toastMsg, setToastMsg] = useState('');
  const [prodModal, setProdModal] = useState(null);  // orden/pedido a producir paso-a-paso
  const [qcModal, setQcModal] = useState(null);      // orden a QC
  const [pendingNDA, setPendingNDA] = useState(null); // item esperando aceptación NDA

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 5000);
  }, []);

  /* CSS de paridad mockup (focus verde inputs QC) — una sola vez */
  useEffect(() => { injectPageCSS(); }, []);

  /* MÓVIL: el wizard de producción (prodModal) se renderiza inline en esta
     página como overlay fixed; bloquear el scroll del fondo y publicar --pp-vvh
     mientras está abierto para que su cuerpo scrollee internamente. Mismo patrón
     canónico que src/components/ui/Modal.jsx (QCModal lo hace por su cuenta). */
  useBodyScrollLock(!!prodModal);

  /* Emmanuel (id='admin') es el propietario de las fórmulas — bypass del NDA.
     Para cualquier otro usuario se muestra el modal NDA antes de arrancar. */
  const handleStartProduccion = useCallback((it) => {
    /* NDA: admin (propietario) o vigencia de 7 días ya aceptada → sin modal.
       Antes solo admin se exceptuaba, forzando re-consentir aquí aunque el
       técnico ya hubiera aceptado en Pedidos/Órdenes (misma key 'produccion'). */
    if ((user && user.id === 'admin') || ndaYaAceptado(user, 'produccion')) {
      /* Bypass NDA: ejecutar la lógica de arranque directamente */
      (async () => {
        if (it._tipo === 'pedido' && it.estado === 'aceptado') {
          try {
            await api.upsertPedido({
              ...it._raw,
              estado: 'en_produccion',
              fechaInicioProduccion: new Date().toISOString(),
              produccionIniciadaPor: userName,
            });
            reloadPed();
          } catch (e) { showToast('No se pudo iniciar: ' + humanizeError(e)); /* AUDIT UX 16-jul (U4) */ }
        } else {
          setProdModal(it);
        }
      })();
      return;
    }
    setPendingNDA(it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userName]);

  const { data: ordData, loading, reload: reloadOrd } = useApiData(() => api.getOrdenes(), [], 5000);
  const { data: pedData, reload: reloadPed } = useApiData(() => api.getPedidos(), [], 5000);
  const { data: trazData, reload: reloadTraz } = useApiData(() => api.getTrazabilidad(), [], 8000);
  const { data: qcData } = useApiData(() => api.getQC(), [], 10000);
  /* Catálogo de envases para el modal de envasado inline (sección En envasado) */
  const { data: envData } = useApiData(() => api.getEnvases(), null, 30000);
  const envases = envData?.data || envData || null;
  const [envasarModal, setEnvasarModal] = useState(null); /* lote */
  /* Reenvasar TOTE → presentaciones finales. Enrique reenvasa en fábrica; su
     única entrada era Stock Fábrica (ahora oculta al técnico), así que se trae
     el modal canónico aquí inline (igual que FlujoPage). */
  const [reenvasarModal, setReenvasarModal] = useState(null); /* lote con TOTE activo */
  const [printQR, setPrintQR] = useState(null);

  /* Realtime: refrescar todas las fuentes ante cambios */
  useRealtimeSync({
    onOrdenes: () => reloadOrd(),
    onPedidos: () => reloadPed(),
    onTrazabilidad: () => reloadTraz(),
  });

  const ordenes = useMemo(() => {
    const arr = ordData?.data || (Array.isArray(ordData) ? ordData : []);
    /* Filtrar órdenes con soft-delete del admin/script. */
    return (Array.isArray(arr) ? arr : []).filter(o => o && !o.eliminado);
  }, [ordData]);

  const pedidos = useMemo(() => {
    const arr = Array.isArray(pedData) ? pedData : (pedData?.data || []);
    /* Filtrar pedidos con soft-delete (estado='eliminado' o flag eliminado). */
    return (Array.isArray(arr) ? arr : []).filter(p => p && !p.eliminado && p.estado !== 'eliminado');
  }, [pedData]);

  const lotes = useMemo(() => {
    const arr = trazData?.data || [];
    /* Filtrar lotes con soft-delete. El backend los mantiene para auditoría
       pero el frontend no debe mostrarlos en producción/QC. */
    return (Array.isArray(arr) ? arr : []).filter(l => l && !l.eliminado);
  }, [trazData]);

  const qcRecords = useMemo(() => {
    const arr = qcData?.data || [];
    return Array.isArray(arr) ? arr : [];
  }, [qcData]);

  /* FIX jun 2026 (auditoría D7): INCLUIR pruebas — la regla del owner es que
     las pruebas se comportan IDÉNTICAS al flujo real. Antes el filtro
     `!esPrueba` las excluía y `enPrueba` se calculaba sin renderizarse jamás
     → el wizard de una producción de prueba era INACCESIBLE desde /produccion.
     El badge 🧪 en la card/wizard las hace inconfundibles. */
  const enProceso = useMemo(() =>
    ordenes.filter(o => !o.eliminado && o.estado === 'en_proceso' && o.fechaInicioProduccion)
      .sort((a, b) => {
        const p = { urgente: 0, alta: 1, normal: 2 };
        return (p[a.prioridad] || 2) - (p[b.prioridad] || 2);
      }),
    [ordenes]
  );

  /* Pedidos en producción activa (reales y prueba) */
  const pedidosListos = useMemo(() =>
    pedidos.filter(p => p && p.estado === 'en_produccion' && p.fechaInicioProduccion)
      .sort((a, b) => (a.fechaInicioProduccion || a.fecha || '').localeCompare(b.fechaInicioProduccion || b.fecha || '')),
    [pedidos]
  );

  /* DECISIÓN OWNER jun 2026 ("al terminar un lote de producción, ahí mismo debe
     quedar la card hasta terminar envasado"): lotes post-producción que aún NO
     completan su envasado viven en ESTA pantalla. Al llegar a 'envasado' la
     card se suelta y el ciclo continúa visible en Pedidos. */
  const lotesEnEnvasado = useMemo(() => {
    /* AUDIT 15-jul-2026: bucket desde lib/estados (fuente única, anti-drift). */
    return lotes
      .filter(l => ESTADO_LOTE_POST_PRODUCCION.includes(l.estado))
      .map(l => ({
        lote: l,
        /* PedidoLoteActions resuelve el lote desde su pedido u orden fuente */
        fuente: (l.pedidoId && pedidos.find(p => p.id === l.pedidoId))
          || (l.ordenId && ordenes.find(o => o && !o.eliminado && o.id === l.ordenId))
          || null,
      }))
      .filter(x => x.fuente);
  }, [lotes, pedidos, ordenes]);

  /* Lista unificada de items productibles, normalizada para el modal */
  const productibles = useMemo(() => {
    const fromOrden = enProceso.map(o => ({
      _tipo: 'orden',
      _raw: o,
      id: o.id,
      codigo: o.codigo,
      formula: o.formula || o.producto,
      cantidad: o.cantidad,
      medida: o.medida,
      medidaQty: o.medidaQty,
      esPrueba: !!o.esPrueba,
      prioridad: o.prioridad,
      estado: o.estado,
      fechaInicioProduccion: o.fechaInicioProduccion,
      fechaCreacion: o.fechaCreacion,
      notas: o.notas,
      pedidoId: o.pedidoId || '',
    }));
    const fromPedido = pedidosListos.map(p => ({
      _tipo: 'pedido',
      _raw: p,
      id: p.id,
      codigo: p.id,
      formula: p.producto,
      cantidad: p.cantidad,
      medida: p.medida,
      medidaQty: p.medidaQty,
      esPrueba: !!p.esPrueba,
      prioridad: p.prioridad || 'normal',
      estado: p.estado,
      fechaInicioProduccion: p.fechaInicioProduccion,
      fechaCreacion: p.fecha,
      notas: p.solicitante ? `Solicitante: ${p.solicitante}` : '',
      pedidoId: p.id,
    }));
    /* Pedidos primero (cronómetro corriendo arriba), luego órdenes.
       FIX jun 2026 (censo Pre#2): DEDUPE — un pedido lanzado con
       aceptar-y-producir genera pedido 'en_produccion' Y orden 'en_proceso';
       ambos cumplían los filtros y el MISMO batch salía dos veces ("Pedido X"
       y "Orden OP-X") invitando a producirlo doble. La orden se omite si su
       pedido fuente ya está en la lista (el server además rechaza 409). */
    const pedidoIds = new Set(fromPedido.map(p => p.id));
    const fromOrdenDedup = fromOrden.filter(o => !o.pedidoId || !pedidoIds.has(o.pedidoId));
    return [...fromPedido, ...fromOrdenDedup];
  }, [enProceso, pedidosListos]);

  /* FIX jun 2026 (M1): si la URL trae `?continuar=<id>`, abrir el wizard del
     pedido/orden directamente. Antes "Continuar wizard" desde MisActivosTab
     solo cambiaba la tab y Enrique tenía que volver a clickear su lote. */
  useEffect(() => {
    const continuarId = searchParams.get('continuar');
    if (!continuarId || prodModal || productibles.length === 0) return;
    const item = productibles.find(p => p.id === continuarId || p.pedidoId === continuarId);
    if (item) {
      setProdModal(item);
      /* Consumido — limpiar query para que F5 no vuelva a forzar */
      const params = new URLSearchParams(searchParams);
      params.delete('continuar');
      params.delete('tab');
      setSearchParams(params, { replace: true });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [productibles, searchParams]);

  /* QC items — BUG FIX: antes filtraba por o.estado === 'qc' (string que NO existe).
     Los estados canónicos tras producción son 'producido' (pendiente de QC),
     'qc_hold' (retenido) y 'qc_aprobado' (aprobado, ya envasable).
     Incluimos también lotes desde trazabilidad para que aparezcan aunque la orden
     ya esté como 'terminada'. */
  const qcItems = useMemo(() => {
    const ordItems = ordenes.filter(o => !o.eliminado && (o.estado === 'producido' || o.estado === 'qc_hold'));
    /* Agregar lotes pendientes de QC que no estén ya en ordItems */
    const ordIds = new Set(ordItems.map(o => o.id));
    const loteItems = (lotes || [])
      .filter(l => l && (l.estado === 'producido' || l.estado === 'qc_hold'))
      .filter(l => !ordIds.has(l.ordenId))
      .map(l => ({
        id: l.id,
        codigo: l.codigoLote || l.codigo,
        producto: l.producto || l.nombre,
        cantidad: l.cantidad,
        estado: l.estado,
        fecha: l.fecha,
        esPrueba: !!l.esPrueba,
        loteRef: l, /* referencia al lote para acciones QC */
      }));
    return [...ordItems, ...loteItems];
  }, [ordenes, lotes]);

  /* Stats */
  const stats = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const mes = hoy.slice(0, 7);
    /* Listas, no solo conteos: los KPI "Lotes Hoy/Mes" son desplegables — el
       usuario quiere VER cuáles lotes son y abrir su historial, no un número
       muerto. Orden: más reciente primero. */
    const porFechaDesc = (a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''));
    const lotesHoyList = lotes.filter(l => l.fecha?.startsWith(hoy)).sort(porFechaDesc);
    const lotesMesList = lotes.filter(l => l.fecha?.startsWith(mes)).sort(porFechaDesc);
    const total = ordenes.filter(o => !o.eliminado).length;
    const qcAprobados = qcRecords.filter(r => r.resultado === 'aprobado').length;
    const qcRechazados = qcRecords.filter(r => r.resultado === 'rechazado').length;
    /* `completadas` eliminado (auditoría): usaba estados legacy 'terminada'/'entregada'
       que el flujo canónico ya no emite → siempre daba 0 y no se renderiza. */
    return { lotesHoy: lotesHoyList.length, lotesMes: lotesMesList.length, lotesHoyList, lotesMesList, total, qcAprobados, qcRechazados };
  }, [lotes, ordenes, qcRecords]);

  /* Sprint H (jun 2026, decisión owner): nuevo tab "Mis activos" como vista
     unificada. Antes el pedido "saltaba" entre tabs según su estado (Lanzar
     lote → Calidad QC → Reportes) y Enrique perdía el hilo. Ahora "Mis activos"
     muestra TODOS sus pedidos/lotes activos en una sola tabla con su pipeline
     visual, sin importar el estado actual. */
  const tabs = [
    { id: 'produccion', label: 'Lanzar lote' },
    { id: 'calidad',    label: 'Calidad QC' },
  ];

  if (loading) {
    return (
      <>
        <TopBar title="Producción" />
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  /* ── helpers de presentación ── */
  const estadoTabla = (it) => {
    if (it._tipo === 'pedido' && it.estado === 'en_produccion') return { color: 'var(--lp-warning-600)', label: 'En curso' };
    if (it.estado === 'aceptado') return { color: 'var(--lp-success-600)', label: 'Listo' };
    return { color: 'var(--lp-info-600)', label: 'En proceso' };
  };
  const accionLabel = (it) => (it._tipo === 'pedido' && it.estado === 'aceptado') ? 'Iniciar' : 'Producir';

  /* botón de acción de una fila/card de producción */
  const renderProdAction = (it, full) => {
    if (!can('produccion')) return <span style={{ color: 'var(--lp-text-tertiary)', fontSize: 12 }}>—</span>;
    const isAceptado = it._tipo === 'pedido' && it.estado === 'aceptado';
    return (
      <button
        style={btn(isAceptado ? 'warning' : 'success', full)}
        onClick={() => handleStartProduccion(it)}
      >
        <IcoPlay size={14} /> {isAceptado ? 'Iniciar producción' : 'Producir'}
      </button>
    );
  };

  return (
    <>
      <TopBar title="Producción" />
      <div style={S.wrap}>
        <PageTabs
          tabs={tabs.map(t => ({ ...t, style: (active) => S.tab(active) }))}
          activeTab={activeTab}
          onChange={setActiveTab}
          style={S.tabs}
        />

        {/* "Mis activos" eliminada (jun 2026, censo duplicados): era una lista
           que solo NAVEGABA a otras pantallas — las cards de Pedidos ya muestran
           el pipeline completo con acciones inline. */}

        {/* ════════ PRODUCCIÓN TAB (Lanzar lote) ════════ */}
        {activeTab === 'produccion' && (
          <>
            <div style={S.kpiGrid}>
              <div style={S.kpi('var(--lp-warning-600)')}>
                <div style={S.kpiLabel}>Listos / En curso</div>
                <div style={S.kpiValue}>{productibles.length}</div>
              </div>
              <div style={S.kpi(QC)}>
                <div style={S.kpiLabel}>En QC</div>
                <div style={S.kpiValue}>{qcItems.length}</div>
              </div>
              {/* Lotes Hoy/Mes: KPIs CLICKEABLES → despliegan la lista de esos lotes
                  (antes eran números muertos: no se veía cuáles ni se abría su historial). */}
              {[
                { key: 'hoy', accent: 'var(--lp-success-600)', label: 'Lotes Hoy', n: stats.lotesHoy },
                { key: 'mes', accent: 'var(--lp-brand-600)',   label: 'Lotes Mes', n: stats.lotesMes },
              ].map(({ key, accent, label, n }) => {
                const on = verLotes === key;
                const dis = n === 0;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={dis}
                    onClick={() => setVerLotes(on ? null : key)}
                    style={{
                      ...S.kpi(accent), textAlign: 'left', font: 'inherit',
                      cursor: dis ? 'default' : 'pointer', opacity: dis ? 0.7 : 1,
                      boxShadow: on ? `0 0 0 1.5px ${accent}` : 'none',
                    }}
                    title={dis ? 'Sin lotes en este periodo' : (on ? 'Ocultar' : 'Ver cuáles son')}
                  >
                    <div style={{ ...S.kpiLabel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span>{label}</span>
                      {!dis && <span style={{ fontSize: 10, color: accent }}>{on ? '▲ ocultar' : '▼ ver'}</span>}
                    </div>
                    <div style={S.kpiValue}>{n}</div>
                  </button>
                );
              })}
            </div>

            {/* Desplegable de lotes del periodo — cada fila abre su historial en
                Trazabilidad (?q=código). Visible aun con "Sin producción activa". */}
            {verLotes && (
              <div style={S.lotesPanel}>
                <div style={S.lotesPanelHead}>
                  <span>{verLotes === 'hoy' ? 'Lotes de hoy' : 'Lotes de este mes'} · {(verLotes === 'hoy' ? stats.lotesHoyList : stats.lotesMesList).length}</span>
                  <button type="button" style={S.lotesPanelClose} onClick={() => setVerLotes(null)}>Cerrar ✕</button>
                </div>
                {(verLotes === 'hoy' ? stats.lotesHoyList : stats.lotesMesList).map(l => {
                  const cod = l.codigoLote || l.codigo || l.id; /* codigoLote = lo que indexa el filtro de Trazabilidad */
                  const est = normEstado(l.estado);
                  const fch = l.fecha ? new Date(l.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <button
                      key={l.id || cod}
                      type="button"
                      style={S.loteRow}
                      onClick={() => setDetalleLote(l)}
                      title="Ver detalle y trazabilidad del lote"
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={S.loteCod}>{cod}{l.esPrueba && <span style={S.loteBadgePrueba}>🧪 prueba</span>}</div>
                        <div style={S.loteProd}>{l.producto || l.nombre || '—'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ ...S.loteEstado, background: (ESTADO_PEDIDO_COLOR[est] || 'var(--lp-text-tertiary)') + '22', color: ESTADO_PEDIDO_COLOR[est] || 'var(--lp-text-secondary)' }}>
                          {ESTADO_PEDIDO_LABEL[est] || est || '—'}
                        </span>
                        <span style={S.loteFecha}>{fch}</span>
                        <span style={S.loteChevron}>›</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {productibles.length === 0 ? (
              <div style={S.empty}>
                <div style={{ color: 'var(--lp-text-tertiary)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IcoGear /></div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>Sin producción activa</div>
                <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)', marginTop: 6, lineHeight: 1.6 }}>
                  Aquí solo aparecen lotes con el cronómetro ya iniciado.<br />
                  Para arrancar uno: ve a <strong>Pedidos</strong> u <strong>Órdenes</strong> y presiona <strong>Producir</strong>.
                </div>
              </div>
            ) : isDesktop ? (
              /* ── ESCRITORIO: tabla Orden / Producto / Cantidad / Estado / Acción ── */
              <>
                <div style={S.tablewrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Orden</th>
                        <th style={S.th}>Producto</th>
                        <th style={{ ...S.th, ...S.thR }}>Cantidad</th>
                        <th style={S.th}>Estado</th>
                        <th style={{ ...S.th, ...S.thR }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productibles.map(it => {
                        const est = estadoTabla(it);
                        const enCurso = it._tipo === 'pedido' && it.estado === 'en_produccion' && it.fechaInicioProduccion;
                        return (
                          <tr key={it._tipo + ':' + it.id}>
                            <td style={S.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={S.folio}>{it.codigo}</span>
                                {it._tipo === 'pedido' && <span style={B('var(--lp-brand-100)', 'var(--lp-brand-700)')}>Pedido</span>}
                                {it.prioridad === 'urgente' && <span style={B('var(--lp-danger-100)', 'var(--lp-danger-600)')}>URGENTE</span>}
                                {it.prioridad === 'alta' && <span style={B('var(--lp-warning-100)', 'var(--lp-warning-600)')}>ALTA</span>}
                                {it.esPrueba && <span style={B('var(--lp-warning-100)', 'var(--lp-warning-600)')}><IcoFlask size={11} /> PRUEBA</span>}
                              </div>
                            </td>
                            <td style={S.td}>
                              <div style={{ fontWeight: 600 }}>{it.formula}</div>
                              {(it.notas || enCurso) && (
                                <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  {it.notas && <span>{it.notas}</span>}
                                  {enCurso && <Cronometro desde={it.fechaInicioProduccion} />}
                                </div>
                              )}
                            </td>
                            <td style={{ ...S.td, ...S.tdR, ...S.tdMono }}>{etiquetaMedidaReal(it.medida, it.medidaQty, it.cantidad) || `${it.cantidad} cub`}</td>
                            <td style={S.td}><EstadoBadge color={est.color} label={est.label} /></td>
                            <td style={{ ...S.td, ...S.tdR }}>{renderProdAction(it, false)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={S.noteCard}>
                  <span style={{ color: 'var(--lp-brand-600)', flexShrink: 0, marginTop: 1 }}><IcoBeaker size={18} /></span>
                  <span>Cada fórmula tiene su <strong style={{ color: 'var(--lp-text-primary)' }}>propio proceso y apartados de QC</strong> (orden de materias primas, tiempos y mediciones distintas por producto). El paso a paso se abre en el asistente.</span>
                </div>
              </>
            ) : (
              /* ── MÓVIL: cards limpias, una acción dominante por estado ── */
              <>
                {productibles.map(it => {
                  const enCurso = it._tipo === 'pedido' && it.estado === 'en_produccion' && it.fechaInicioProduccion;
                  const est = estadoTabla(it);
                  return (
                    <div key={it._tipo + ':' + it.id} style={S.card(enCurso)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
                        <span style={S.folio}>{it.codigo}</span>
                        <EstadoBadge color={est.color} label={est.label} />
                        {it.prioridad === 'urgente' && <span style={B('var(--lp-danger-100)', 'var(--lp-danger-600)')}>URGENTE</span>}
                        {it.prioridad === 'alta' && <span style={B('var(--lp-warning-100)', 'var(--lp-warning-600)')}>ALTA</span>}
                        {it.esPrueba && <span style={B('var(--lp-warning-100)', 'var(--lp-warning-600)')}><IcoFlask size={11} /> PRUEBA</span>}
                      </div>
                      <div style={S.cardTitle}>{it.formula}</div>
                      <div style={S.cardMeta}>
                        {etiquetaMedidaReal(it.medida, it.medidaQty, it.cantidad)
                          || <><span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 600 }}>{it.cantidad}</span> cubetas</>}
                        {it.fechaCreacion && ` · ${it.fechaCreacion}`}
                        {it.notas && ` · ${it.notas}`}
                      </div>
                      {enCurso && (
                        <div style={{ marginTop: 2, fontSize: 12 }}><Cronometro desde={it.fechaInicioProduccion} /></div>
                      )}
                      <div style={S.cardActions}>
                        {renderProdAction(it, true)}
                      </div>
                    </div>
                  );
                })}
                <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
                  Cada fórmula tiene su propio proceso y QC. El paso a paso se abre en el asistente.
                </div>
              </>
            )}

            {/* ── EN ENVASADO (decisión owner): la card del lote permanece AQUÍ
                  desde que termina producción hasta envasarse por completo —
                  "sigue en producción, luego pasa a Pedidos". Card canónica con
                  QC inline + Envasar (modal emergente). ── */}
            {lotesEnEnvasado.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                  En envasado ({lotesEnEnvasado.length})
                </div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', marginBottom: 12 }}>
                  El lote sigue en producción hasta envasarse por completo — después continúa su ciclo en Pedidos.
                </div>
                <div style={isDesktop ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 12, alignItems: 'start' } : undefined}>
                  {lotesEnEnvasado.map(({ lote, fuente }) => (
                    <div key={lote.id} style={{ background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 14, padding: 14, marginBottom: isDesktop ? 0 : 12 }}>
                      <PedidoLoteActions
                        pedido={fuente}
                        lotes={lotes}
                        userRol={user?.rol || ''}
                        userName={userName}
                        onSuccess={(msg) => { showToast(msg || 'Listo'); reloadTraz(); reloadPed(); reloadOrd(); }}
                        onError={(msg) => showToast('Error: ' + msg)}
                        onEnvasarInline={(l) => setEnvasarModal(l)}
                        onReenvasarInline={(tote, l) => setReenvasarModal({ lote: l, toteCod: tote?.cod })}
                        onPrintQR={(s, l) => setPrintQR({ lote: l, sublotes: [s], tipo: s.tipo, q: s.qty, isTote: s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1 })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════ CALIDAD TAB (QC universal) ════════ */}
        {activeTab === 'calidad' && (
          <>
            <div style={S.kpiGrid}>
              <div style={S.kpi(QC)}>
                <div style={S.kpiLabel}>En QC</div>
                <div style={S.kpiValue}>{qcItems.length}</div>
              </div>
              <div style={S.kpi('var(--lp-success-600)')}>
                <div style={S.kpiLabel}>Aprobados</div>
                <div style={S.kpiValue}>{stats.qcAprobados}</div>
              </div>
              <div style={S.kpi('var(--lp-danger-600)')}>
                <div style={S.kpiLabel}>Rechazados</div>
                <div style={S.kpiValue}>{stats.qcRechazados}</div>
              </div>
            </div>

            {qcItems.length === 0 ? (
              <div style={S.empty}>
                <div style={{ color: 'var(--lp-success-600)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IcoCheckCircle /></div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>Sin productos en control de calidad</div>
                <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)', marginTop: 6 }}>
                  Los productos aparecen aquí después de completar producción.
                </div>
              </div>
            ) : isDesktop ? (
              /* ── ESCRITORIO: tabla QC ── */
              <div style={S.tablewrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Lote / Orden</th>
                      <th style={S.th}>Producto</th>
                      <th style={{ ...S.th, ...S.thR }}>Cantidad</th>
                      <th style={S.th}>Estado</th>
                      <th style={{ ...S.th, ...S.thR }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qcItems.map(o => (
                      <tr key={o.id}>
                        <td style={S.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={S.folio}>{o.codigo}</span>
                            {o.esPrueba && <span style={B('var(--lp-warning-100)', 'var(--lp-warning-600)')}><IcoFlask size={11} /> PRUEBA</span>}
                          </div>
                        </td>
                        <td style={{ ...S.td, fontWeight: 600 }}>
                          {o.formula || o.producto}
                          {o.qcResultados && (
                            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 3, fontFamily: 'var(--lp-font-mono)' }}>
                              {o.qcResultados.viscosidad != null && `Visc ${o.qcResultados.viscosidad}`}
                              {o.qcResultados.ph != null && ` · pH ${o.qcResultados.ph}`}
                              {o.qcResultados.brillo != null && ` · Brillo ${o.qcResultados.brillo}`}
                            </div>
                          )}
                        </td>
                        <td style={{ ...S.td, ...S.tdR, ...S.tdMono }}>{o.cantidad} cub</td>
                        <td style={S.td}><EstadoBadge color={QC} label="QC pendiente" /></td>
                        <td style={{ ...S.td, ...S.tdR }}>
                          {can('registrarQC')
                            ? <button style={{ ...btn('primary', false), background: QC }} onClick={() => setQcModal(o)}><IcoBeaker size={14} /> Registrar QC</button>
                            : <span style={{ color: 'var(--lp-text-tertiary)', fontSize: 12 }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ── MÓVIL: cards QC ── */
              qcItems.map(o => (
                <div key={o.id} style={S.card(true)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
                    <span style={S.folio}>{o.codigo}</span>
                    <EstadoBadge color={QC} label="QC pendiente" />
                    {o.esPrueba && <span style={B('var(--lp-warning-100)', 'var(--lp-warning-600)')}><IcoFlask size={11} /> PRUEBA</span>}
                  </div>
                  <div style={S.cardTitle}>{o.formula || o.producto}</div>
                  <div style={S.cardMeta}>
                    <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 600 }}>{o.cantidad}</span> cubetas
                    {o.fechaCreacion && ` · ${o.fechaCreacion}`}
                  </div>
                  {o.qcResultados && (
                    <div style={{ fontSize: 11, marginTop: 8, padding: '8px 12px', background: 'var(--lp-bg-sunken)', borderRadius: 10, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-secondary)' }}>
                      <strong style={{ fontFamily: 'var(--lp-font-sans)' }}>Último QC:</strong>
                      {o.qcResultados.viscosidad != null && ` Visc ${o.qcResultados.viscosidad}`}
                      {o.qcResultados.ph != null && ` · pH ${o.qcResultados.ph}`}
                      {o.qcResultados.brillo != null && ` · Brillo ${o.qcResultados.brillo}`}
                      {o.qcResultados.notas && ` · ${o.qcResultados.notas}`}
                    </div>
                  )}
                  {can('registrarQC') && (
                    <div style={S.cardActions}>
                      <button style={{ ...btn('primary', true), background: QC }} onClick={() => setQcModal(o)}>
                        <IcoBeaker size={15} /> Registrar QC
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Recent QC records */}
            {qcRecords.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 10 }}>
                  Historial QC reciente
                </div>
                {qcRecords.slice(-10).reverse().map(r => {
                  const ok = r.resultado === 'aprobado';
                  return (
                    <div key={r.id} style={{
                      padding: '10px 14px', borderRadius: 12, marginBottom: 6,
                      border: '1px solid var(--lp-border-subtle)',
                      background: ok ? 'var(--lp-success-50)' : 'var(--lp-danger-50)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{r.producto}</span>
                        <span style={B(
                          ok ? 'var(--lp-success-100)' : 'var(--lp-danger-100)',
                          ok ? 'var(--lp-success-600)' : 'var(--lp-danger-600)',
                        )}>
                          {ok ? <><IcoCheck size={12} /> Aprobado</> : <><IcoX size={12} /> Rechazado</>}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4, fontFamily: 'var(--lp-font-mono)' }}>
                        {r.ordenCodigo} · {new Date(r.fecha).toLocaleDateString('es-MX')}
                        {r.viscosidad != null && ` · Visc ${r.viscosidad}`}
                        {r.ph != null && ` · pH ${r.ph}`}
                        {r.notas && ` · ${r.notas}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* "Reportes" eliminada (jun 2026, censo duplicados): placeholder
           "próximamente" con KPI "Completadas" roto (filtraba estados legacy
           'terminada'/'entregada' que ya nadie emite → siempre 0). */}
      </div>

      {/* ── NDA gate antes de iniciar producción ── */}
      {pendingNDA && (
        <NDAModal
          user={user}
          context="produccion"
          productoNombre={pendingNDA.formula || pendingNDA.producto || ''}
          onAccept={async () => {
            const it = pendingNDA;
            setPendingNDA(null);
            /* Si es un pedido aceptado y aún no tiene fechaInicioProduccion → arrancar cronómetro */
            if (it._tipo === 'pedido' && it.estado === 'aceptado') {
              try {
                await api.upsertPedido({
                  ...it._raw,
                  estado: 'en_produccion',
                  fechaInicioProduccion: new Date().toISOString(),
                  produccionIniciadaPor: userName,
                });
                reloadPed();
              } catch (e) { showToast('No se pudo iniciar: ' + humanizeError(e)); /* AUDIT UX 16-jul (U4) */ }
            } else {
              /* Para órdenes y pedidos ya en producción, abrir directo el flujo paso-a-paso */
              setProdModal(it);
            }
          }}
          onReject={() => {
            setPendingNDA(null);
            showToast('NDA rechazado — la producción NO se inició.');
          }}
        />
      )}

      {/* ── Modals ── */}
      {prodModal && (
        <div style={S.overlay} onClick={() => setProdModal(null)}>
          <div style={{
            ...S.modal, maxWidth: 720, width: '100%',
          }} onClick={e => e.stopPropagation()}>
            <ProduccionFlow
              item={prodModal}
              userName={userName}
              onClose={() => setProdModal(null)}
              onSuccess={(msg) => {
                setProdModal(null);
                reloadOrd(); reloadPed(); reloadTraz();
                showToast(msg);
              }}
            />
          </div>
        </div>
      )}
      {qcModal && (
        <QCModal
          orden={qcModal}
          lotes={lotes}
          qcRecords={qcRecords}
          userName={userName}
          onClose={() => setQcModal(null)}
          onSuccess={(msg) => {
            setQcModal(null);
            reloadOrd();
            /* También refrescar trazabilidad: la transición de lote cambia
               lote.estado y dispara WS, pero forzamos aquí por si la pestaña
               se quedó sin recibir el evento (offline, filtro de rol, etc) */
            reloadTraz();
            showToast(msg);
          }}
        />
      )}

      {/* ── Envasado inline (sección En envasado) — mismo modal canónico de
            Stock Fábrica; imprime QR del sublote al terminar. ── */}
      {envasarModal && (
        <EnvasadoModal
          lote={envasarModal} envases={envases} userName={userName}
          onClose={() => setEnvasarModal(null)}
          onSuccess={(payload) => {
            setEnvasarModal(null); reloadTraz(); reloadPed(); reloadOrd();
            showToast(`Envasado: ${payload?.q ?? ''} ${payload?.tipo || ''}`.trim());
            const s = payload?.sublotes?.[0];
            if (s?.qrPayload || s?.cod) setPrintQR(payload);
          }}
        />
      )}
      {/* ── Reenvasado inline: TOTE → presentaciones finales (mismo modal
            canónico de Stock Fábrica). Sin esto el botón "Reenvasar" de
            PedidoLoteActions caía a navigate('/stock-fabrica'), oculto al técnico. ── */}
      {reenvasarModal && (
        <ReenvasadoModal
          lote={reenvasarModal.lote || reenvasarModal} toteInicial={reenvasarModal.toteCod}
          envases={envases} userName={userName}
          onClose={() => setReenvasarModal(null)}
          onSuccess={(payload) => {
            setReenvasarModal(null); reloadTraz(); reloadPed(); reloadOrd();
            showToast(`Re-envasado: ${payload?.q ?? ''} ${payload?.tipo || ''}`.trim());
            const s = payload?.sublotes?.[0];
            if (s?.qrPayload || s?.cod) setPrintQR(payload);
          }}
        />
      )}
      {printQR && <SubloteQRPrintModal payload={printQR} onClose={() => setPrintQR(null)} />}

      {/* ── Detalle de lote (trazabilidad + tiempo) inline, sin salir de la pantalla ── */}
      {detalleLote && (
        <LoteDetalleModal
          lote={detalleLote}
          onClose={() => setDetalleLote(null)}
          onVerTrazabilidad={() => {
            const c = detalleLote.codigoLote || detalleLote.codigo || detalleLote.id;
            setDetalleLote(null);
            navigate(`/trazabilidad?q=${encodeURIComponent(c)}`);
          }}
        />
      )}

      {/* ── Toast ── */}
      {toastMsg && <div style={S.toast}><IcoCheck size={16} />{toastMsg}</div>}
    </>
  );
}
