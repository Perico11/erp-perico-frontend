import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import ProduccionFlow from '../produccion/ProduccionFlow';
import RecibirOCModal from '../compras/components/RecibirOCModal';
import NDAModal, { ndaYaAceptado } from '../../components/NDAModal';
import useConfirm from '../../hooks/useConfirm';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import PruebaBadge from '../../components/ui/PruebaBadge';
import Fab from '../../components/ui/Fab';
import { ESTADO_ORDEN_LABEL } from '../../lib/estados';

/* ── Iconos line (sin emojis) — verde Claude Design ──────────────────────
   Reskin jun 2026: todos los glyph emoji (✕ ✓ → 🧪 ✅ 📋 📦 ●) reemplazados
   por SVG line stroke="currentColor" para heredar el color del contexto. */
const Icon = {
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  play: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  x: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  trash: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  empty: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 15l2 2 4-4" />
    </svg>
  ),
};
/* (La bolita de fase del mockup vive en S.phaseDot — div inline, sin glyph) */

/* ── Badge maps ──
   X3 (jun 2026): labels canónicos vienen de lib/estados.js (espejo backend).
   Antes había estados ficticios como 'terminada'/'entregada' que el backend
   NUNCA emite — se quedaban "stuck" en órdenes reales por mismatch silencioso.
   La clase visual (`cls`) sigue local porque el theme de OC mapea a colores
   distintos según familia (warn/info/purple/ok/neutral/err). */
const ESTADO_CLS = {
  pendiente:     'warn',
  aceptado:      'info',
  en_proceso:    'info',
  en_produccion: 'info',
  qc_hold:       'err',
  qc_aprobado:   'purple',
  en_envasado:   'purple',
  envasado:      'ok',
  en_recoleccion:'info',
  en_camino:     'info',
  en_almacen:    'ok',
  entregado:     'ok',
  rechazado:     'err',
  cancelado:     'neutral',
  eliminado:     'err',
};
const ESTADO_BADGE = Object.keys(ESTADO_CLS).reduce((acc, k) => {
  acc[k] = { cls: ESTADO_CLS[k], label: ESTADO_ORDEN_LABEL[k] || (k === 'eliminado' ? 'Eliminada' : k) };
  return acc;
}, {});
const PRIO_BADGE = {
  urgente: { cls: 'err',  label: 'URGENTE' },
  alta:    { cls: 'warn', label: 'ALTA' },
  normal:  { cls: 'ok',   label: 'NORMAL' },
};

/* ── Mockup Órdenes.html (jun 2026): color SÓLIDO por estado ──
   Alimenta el riel izquierdo de la card, el badge de estado (fondo sólido,
   texto blanco/ink según tema — clase .ordx-est) y el dot de cada fase.
   Paleta del mockup: pendiente=ámbar, en proceso=verde acc, QC=morado,
   terminada=verde, entregada=verde. Extensión a estados reales que el
   mockup no trae (transporte=info azul, qc_hold=danger por semántica de
   retención, cancelado=gris). Tokens dark-aware (granel-600 flip a lila). */
const ESTADO_SOLID = {
  pendiente:      'var(--lp-warning-600)',
  aceptado:       'var(--lp-warning-600)',
  en_proceso:     'var(--lp-brand-600)',
  en_produccion:  'var(--lp-brand-600)',
  produccion:     'var(--lp-brand-600)',
  producido:      'var(--lp-granel-600)',
  qc_hold:        'var(--lp-danger-600)',
  qc_aprobado:    'var(--lp-granel-600)',
  en_envasado:    'var(--lp-brand-600)',
  envasado:       'var(--lp-brand-600)',
  en_recoleccion: 'var(--lp-info-600)',
  en_camino:      'var(--lp-info-600)',
  en_almacen:     'var(--lp-success-600)',
  entregado:      'var(--lp-success-600)',
  cancelado:      'var(--lp-text-secondary)',
  rechazado:      'var(--lp-danger-600)',
  eliminado:      'var(--lp-danger-600)',
};
const estadoSolid = (o) =>
  ESTADO_SOLID[o.eliminado ? 'eliminado' : o.estado] || 'var(--lp-text-tertiary)';

/* Prioridad estilo mockup: pill tint 14% + texto del color. Solo se muestra
   ALTA (ámbar) y URGENTE (rojo) — NORMAL se omite como en el mockup. */
const PRIO_TINT = {
  urgente: 'var(--lp-danger-600)',
  alta:    'var(--lp-warning-600)',
  baja:    'var(--lp-info-600)',
};
const tint = (c, p) => `color-mix(in srgb, ${c} ${p}%, transparent)`;

/* Fecha corta del mockup ("06-04") desde ISO o YYYY-MM-DD. */
const fmtFechaCorta = (f) => {
  if (!f) return '';
  const s = String(f);
  return s.length >= 10 ? s.slice(5, 10) : s;
};

/* ── Estado transitions allowed per current estado ──
   X3b (jun 2026): SOLO estados canónicos. Las transiciones manuales aplican a
   las fases tempranas (pendiente↔en_proceso, cancelar, reactivar). Los estados
   mid/late del flujo (en_produccion, qc_hold, envasado, en_recoleccion…) los
   maneja la state machine del LOTE por roll-up — aquí NO se ofrecen botones
   manuales para esos (evita pisar el flujo). Antes había claves legacy
   (produccion/qc/terminada/entregada) muertas y 'cancelada' (con 'a') que NO
   es canónico → corrompía el estado (badge caía a "Pendiente", escapaba al
   filtro de Canceladas). Canónico = 'cancelado'. */
const TRANSITIONS = {
  pendiente:  ['en_proceso', 'cancelado'],
  en_proceso: ['pendiente', 'cancelado'],
  cancelado:  ['pendiente'],
};

/* ── Inline styles (LP design system) ── */
const S = {
  wrap: { padding: '0 20px 100px' },
  /* Header row local (la TopBar compartida no trae subtítulo ni slot de
     acciones): seg pill izquierda + botón Nueva pill derecha. */
  headRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, flexWrap: 'wrap', marginBottom: 6,
  },
  /* Subtítulo del mockup (.tsub): "N órdenes de fábrica en curso" */
  tsub: { fontSize: 12.5, color: 'var(--lp-text-secondary)', margin: '0 2px 12px' },
  /* Tabs segmentadas pill del mockup (.seg): Fábrica | OC Materia prima */
  seg: {
    display: 'inline-flex', alignSelf: 'flex-start', gap: 3, padding: 3,
    borderRadius: 999, background: 'var(--lp-bg-sunken)',
  },
  segBtn: (active) => ({
    padding: '8px 15px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 12.5,
    fontWeight: active ? 600 : 500,
    background: active ? 'var(--lp-bg-raised)' : 'transparent',
    color: active ? 'var(--lp-text-primary)' : 'var(--lp-text-secondary)',
    boxShadow: active ? '0 1px 2px rgba(20,30,25,.1)' : 'none',
    whiteSpace: 'nowrap', flexShrink: 0, minHeight: 34,
    transition: 'background .15s, color .15s',
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
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  /* Botón "Nueva" pill del mockup (.newbtn) — color de texto via .ordx-btn-primary */
  btnNew: {
    height: 44, padding: '0 16px', borderRadius: 999, border: 'none', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6,
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
  /* ── Card de orden (mockup .ocard): riel de color izquierdo, radio 18 ──
     Modo prueba (sin mockup — función real): fondo ámbar suave conservado. */
  ocard: (isPrueba) => ({
    position: 'relative', overflow: 'hidden',
    background: isPrueba ? 'var(--lp-warning-50)' : 'var(--lp-bg-raised)',
    border: '1px solid ' + (isPrueba ? 'var(--lp-warning-100)' : 'var(--lp-border-subtle)'),
    borderRadius: 18, padding: '15px 17px 15px 19px',
  }),
  ocardBar: (color) => ({
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color,
  }),
  otop: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap',
  },
  folio: {
    fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700,
    color: 'var(--lp-brand-600)',
  },
  estSolid: (color) => ({
    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
    background: color, display: 'inline-flex', alignItems: 'center',
  }),
  prioPill: (color) => ({
    fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
    letterSpacing: '.04em', background: tint(color, 14), color,
    display: 'inline-flex', alignItems: 'center',
  }),
  ofecha: {
    marginLeft: 'auto', fontFamily: 'var(--lp-font-mono)', fontSize: 11,
    color: 'var(--lp-text-tertiary)',
  },
  otitle: {
    fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em',
    color: 'var(--lp-text-primary)',
  },
  ometa: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2 },
  ometaB: {
    fontFamily: 'var(--lp-font-mono)', fontWeight: 600, color: 'var(--lp-brand-600)',
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5,
  },
  metaSub: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 3 },
  badge: (type) => {
    const map = {
      ok:      { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-600)' },
      warn:    { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
      err:     { bg: 'var(--lp-danger-100)',  fg: 'var(--lp-danger-600)' },
      info:    { bg: 'var(--lp-brand-100)',   fg: 'var(--lp-brand-700)' },
      neutral: { bg: 'var(--lp-bg-sunken)',   fg: 'var(--lp-text-tertiary)' },
      purple:  { bg: 'var(--lp-qc-50)',               fg: 'var(--lp-qc-600)' },
    };
    const c = map[type] || map.neutral;
    return {
      display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 600,
      borderRadius: 6, background: c.bg, color: c.fg, marginRight: 4,
    };
  },
  /* Chip QC del mockup (.qcbox): tint verde 8% + texto acento */
  qcbox: {
    fontSize: 11.5, padding: '8px 12px', borderRadius: 11,
    background: tint('var(--lp-brand-600)', 8), color: 'var(--lp-brand-600)',
    marginBottom: 12,
  },
  /* Acciones de card (mockup .oacts/.btn): altura 40, radio 11 */
  oacts: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btn: {
    height: 40, padding: '0 15px', borderRadius: 11, border: 'none',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 13,
    fontWeight: 600, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: 7,
  },
  btnGhost: {
    background: 'transparent', border: '1px solid var(--lp-border-subtle)',
    color: 'var(--lp-text-secondary)',
  },
  btnGhostDanger: {
    background: 'transparent',
    border: '1px solid ' + tint('var(--lp-danger-600)', 35),
    color: 'var(--lp-danger-600)',
  },
  /* Encabezado de fase (mockup .phase-h): dot + título + contador mono + sub */
  phaseH: {
    display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 2px 10px',
    flexWrap: 'wrap',
  },
  phaseDot: (color) => ({
    width: 8, height: 8, borderRadius: 999, flexShrink: 0, alignSelf: 'center',
    background: color,
  }),
  phaseT: {
    fontSize: 13.5, fontWeight: 600, color: 'var(--lp-text-primary)',
    letterSpacing: '-.01em',
  },
  phaseN: {
    fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700,
    color: 'var(--lp-text-tertiary)',
  },
  phaseS: { fontSize: 11.5, color: 'var(--lp-text-tertiary)' },
  /* Mini-pipeline del mockup (.tl): 5 puntos con labels */
  tl: { display: 'flex', alignItems: 'center', margin: '13px 0 12px' },
  tlStep: (last) => ({
    display: 'flex', alignItems: 'center', flex: last ? '0 0 auto' : 1,
  }),
  tlCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  tdot: (on, cur) => ({
    width: 10, height: 10, borderRadius: '50%',
    background: on ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)',
    boxShadow: cur ? `0 0 0 3px ${tint('var(--lp-brand-600)', 22)}` : 'none',
  }),
  tlabel: (on, cur) => ({
    fontSize: 9, whiteSpace: 'nowrap',
    color: on ? 'var(--lp-brand-600)' : 'var(--lp-text-tertiary)',
    fontWeight: cur ? 700 : 500,
  }),
  tline: (done) => ({
    flex: 1, height: 2, margin: '0 3px', marginBottom: 14,
    background: done ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)',
  }),
  empty: {
    textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0',
  },
  /* Empty state del mockup (.empty .dash): caja punteada radio 18 */
  emptyDash: {
    border: '1px dashed var(--lp-border-default)', borderRadius: 18,
    padding: '34px 22px', textAlign: 'center', fontSize: 13, lineHeight: 1.5,
    color: 'var(--lp-text-tertiary)',
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
    /* FIX jun 2026 v3 (scroll móvil): 100vh en teléfono es MÁS ALTO que lo
       visible (barra del navegador/teclado) → el sheet "cabía" sin overflow,
       no había nada que scrollear y el tope quedaba cortado. --pp-vvh = altura
       visible REAL (visualViewport, la setea useBodyScrollLock; sigue al
       teclado en iOS); fallback 100dvh. */
    maxHeight: 'calc(var(--pp-vvh, 100dvh) - 60px - env(safe-area-inset-bottom, 0px))',
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
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    boxSizing: 'border-box', marginBottom: 12,
  },
  fieldSelect: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
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

/* Overlay/modal responsive: centrado en escritorio, bottom-sheet radio
   24px en móvil (mockup .sheet / patrón del design system verde). */
function useSheetStyles() {
  const isDesktop = useIsDesktop();
  /* FIX jun 2026 (reporte dueño): en móvil el sheet no scrolleaba — el gesto se
     fugaba al body de atrás. Lock del body mientras el sheet esté montado +
     overscroll-behavior:contain para cortar el encadenamiento del scroll. */
  useBodyScrollLock();
  const scrollFix = { overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' };
  return {
    isDesktop,
    overlay: isDesktop ? S.overlay : { ...S.overlay, alignItems: 'flex-end', padding: 0 },
    modal: isDesktop
      ? { ...S.modal, ...scrollFix }
      : { ...S.modal, ...scrollFix, maxWidth: '100%', borderRadius: '24px 24px 0 0' },
  };
}

/* ── Timeline (mockup Órdenes.html .tl) ──
   5 pasos con label bajo cada punto: Pendiente → Producción → QC →
   Terminada → Entregada. Construido con divs inline propios de esta
   pantalla — NO usa components/pipeline/Checkpoint.jsx (es de otra
   pantalla). Punto actual lleva anillo tint 22%. */
const STEPS = [
  ['pendiente', 'Pendiente'],
  ['produccion', 'Producción'],
  ['qc', 'QC'],
  ['terminada', 'Terminada'],
  ['entregada', 'Entregada'],
];
/* Mapa estado canónico de orden → índice de paso. Los estados mid-flow del
   lote (en_produccion, qc_hold, en_envasado, en_camino…) caen en su paso para
   que el pipeline NO se vea atascado al inicio mientras el lote avanza.
   X3b jun 2026. Solo estados que el backend emite — no inventar. */
const ESTADO_STEP_IDX = {
  pendiente: 0, aceptado: 0,
  en_proceso: 1, en_produccion: 1, produccion: 1,
  producido: 2, qc_hold: 2, qc_aprobado: 2,
  en_envasado: 3, envasado: 3, en_recoleccion: 3, en_camino: 3, terminada: 3,
  en_almacen: 4, entregado: 4, entregada: 4,
};

function Timeline({ estado }) {
  const idx = ESTADO_STEP_IDX[estado] ?? 0;
  return (
    <div style={S.tl}>
      {STEPS.map(([key, label], i) => {
        const on = i <= idx;
        const cur = i === idx;
        return (
          <div key={key} style={S.tlStep(i === STEPS.length - 1)}>
            <div style={S.tlCol}>
              <div style={S.tdot(on, cur)} />
              <div style={S.tlabel(on, cur)}>{label}</div>
            </div>
            {i < STEPS.length - 1 && <div style={S.tline(i < idx)} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Nueva Orden Modal ──
   Sprint C (auditoría 2026-06): si recibe `pedidoOrigen`, prefilla y bloquea
   producto/cantidad/esPrueba al valor del pedido, y usa el endpoint canónico
   /api/pedidos/aceptar-y-producir que crea pedido↔orden atómicamente.
   Sin pedidoOrigen: flujo legacy "orden interna" (solo admin debería usarlo). */
function NuevaOrdenModal({ formulas, ordenes, userName, onClose, onSuccess, pedidoOrigen }) {
  const { user } = useAuth();
  const sheet = useSheetStyles();
  const tienePedido = !!pedidoOrigen;
  const [formula, setFormula] = useState(pedidoOrigen?.producto || '');
  const [cantidad, setCantidad] = useState(pedidoOrigen ? String(pedidoOrigen.cantidad || '') : '');
  const [prioridad, setPrioridad] = useState(pedidoOrigen?.prioridad || 'normal');
  const [fechaReq, setFechaReq] = useState('');
  const [notas, setNotas] = useState('');
  const [esPrueba, setEsPrueba] = useState(!!pedidoOrigen?.esPrueba);
  /* Destino de la producción (SOLO órdenes internas, feature dueño jun 2026):
     'fabrica' = se queda en stock fábrica (default — reposición normal).
     'teran'   = emergencia: Josué no levantó pedido pero falta stock en Terán;
                 al envasar, el MISMO Enrique puede mandarla a recolección. */
  const [destino, setDestino] = useState('fabrica');
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
        /* ndaAceptado: el server lo exige al LANZAR producción (Pre#3). Aquí no
           hay NDAModal inline — usamos la vigencia guardada (7 días) del NDA de
           producción; admin bypass. Si no está vigente, el server responde
           NDA_REQUERIDO y el técnico inicia desde la card (que sí muestra el NDA). */
        const ndaOk = (user && user.id === 'admin') || ndaYaAceptado(user, 'produccion');
        const r = await api.aceptarYProducir(pedidoOrigen.id, { lanzarProduccion: lanzarAhora, ndaAceptado: ndaOk });
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
        destino, /* 'fabrica' | 'teran' — a dónde va la producción al envasar */
        fechaCreacion: now.toISOString().substring(0, 10),
        fechaRequerida: fechaReq || '',
        notas: notas || '',
        usuario: userName || '?',
        historial: [{
          estado: 'pendiente',
          fecha: now.toISOString(),
          usuario: userName || '?',
          nota: (esPrueba ? '[PRUEBA] ' : '') + '[INTERNA] Orden creada sin pedido fuente'
            + (destino === 'teran' ? ' — DESTINO TERÁN (emergencia)' : ' — se queda en stock fábrica'),
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
    <div style={sheet.overlay} onClick={onClose}>
      <div style={sheet.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)' }}>
              {tienePedido ? 'Crear Orden desde Pedido' : 'Nueva Orden Interna'}
            </div>
            {tienePedido && (
              <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                Pedido {pedidoOrigen.codigo || pedidoOrigen.id} · {pedidoOrigen.solicitante || pedidoOrigen.almacen || 'Almacén'}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-tertiary)', display: 'inline-flex', minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }} aria-label="Cerrar">{Icon.close}</button>
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
                  marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <PruebaBadge size="sm" /> Heredado del pedido. No descuenta inventario.
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
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {Icon.x} {stockCheck.error}
                    </div>
                  )}
                  {!stockCheck.loading && stockCheck.suficiente === true && (
                    <div style={{
                      padding: 10, background: 'var(--lp-success-100)',
                      color: 'var(--lp-success-700)', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {Icon.check} Stock de MP suficiente ({stockCheck.ingredientes?.length || 0} ingredientes verificados)
                    </div>
                  )}
                  {!stockCheck.loading && stockCheck.suficiente === false && (
                    <div style={{
                      padding: 10, background: 'var(--lp-danger-100)',
                      border: '1.5px solid var(--lp-danger-600)', borderRadius: 8,
                      fontSize: 12,
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--lp-danger-700)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {Icon.x} Faltan {stockCheck.faltantes.length} MP{stockCheck.faltantes.length > 1 ? 's' : ''} para producir esta cantidad
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
              borderRadius: 8, marginTop: -8, marginBottom: 12, background: 'var(--lp-bg-raised)',
            }}>
              {filteredFormulas.slice(0, 20).map(f => (
                <div
                  key={f.nombre}
                  style={{
                    padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                    borderBottom: '1px solid var(--lp-border-subtle)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-brand-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
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
            <div style={{ fontSize: 11, color: 'var(--lp-success-600)', fontWeight: 600, marginTop: -8, marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {Icon.check} {formula}
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

          {/* Destino — SOLO órdenes internas (feature dueño jun 2026): emergencia
              donde el técnico nota faltante en Terán sin pedido de Almacén. */}
          {!tienePedido && (
            <>
              <label style={S.fieldLabel}>Destino de la producción</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[['fabrica', 'Se queda en stock fábrica'], ['teran', 'Transferir a Terán (emergencia)']].map(([k, l]) => (
                  <button key={k} type="button" data-id={`ordenes.btn.destino-${k}`} data-rol="tecnico,admin"
                    onClick={() => setDestino(k)}
                    style={{
                      flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
                      fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: 600,
                      border: destino === k ? 'none' : '1px solid var(--lp-border-default)',
                      background: destino === k
                        ? (k === 'teran' ? 'var(--lp-warning-600)' : 'var(--lp-brand-600)')
                        : 'var(--lp-bg-raised)',
                      color: destino === k ? '#fff' : 'var(--lp-text-secondary)',
                    }}>
                    {l}
                  </button>
                ))}
              </div>
              {destino === 'teran' && (
                <div style={{ fontSize: 11.5, color: 'var(--lp-warning-700)', background: 'var(--lp-warning-50)', borderRadius: 10, padding: '8px 11px', marginBottom: 10 }}>
                  Emergencia: al terminar el envasado, tú mismo podrás mandarla a recolección (Luis la lleva a Terán) sin esperar a Almacén.
                </div>
              )}
            </>
          )}

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

/* ── Order Card (mockup Órdenes.html .ocard) ──
   Riel de color por fase, folio mono verde, badge sólido de estado, badge
   de prioridad tint (solo ALTA/URGENTE), fecha corta derecha, producto
   grande, "N cubetas · desde pedido PD-XXX" (link) u "orden interna",
   mini-pipeline de 5 puntos y chip QC cuando hay lecturas reales.
   FIX jun 2026 (L13): onIrPedido destructurado como prop (antes era no-op).
   Props nuevas reskin: pedidoCodigo (folio del pedido fuente), qcLote
   (lecturas QC reales del lote vía trazabilidad), onVerProduccion,
   onAprobarQC. */
function OrdenCard({ orden, canManage, canDelete, onChangeStatus, onDelete, onProducir, onIrPedido, onVerProduccion, onAprobarQC, pedidoCodigo, qcLote }) {
  const o = orden;
  const est = ESTADO_BADGE[o.eliminado ? 'eliminado' : o.estado] || ESTADO_BADGE.pendiente;
  const solid = estadoSolid(o);
  const prioTint = o.prioridad !== 'normal' ? PRIO_TINT[o.prioridad] : null;
  const isPrueba = o.esPrueba === true;
  const transitions = TRANSITIONS[o.estado] || [];
  /* QC real: la orden casi nunca trae qcResultados propio — las lecturas
     viven en el LOTE (trazabilidad). qcLote llega resuelto por ordenId/
     pedidoId desde la página. Sin lecturas reales NO hay chip (no simular). */
  const qc = (o.qcResultados && typeof o.qcResultados === 'object' ? o.qcResultados : null) || qcLote || null;
  const hasQC = !!qc && ['brillo', 'viscosidad', 'ph', 'densidad', 'finura'].some(
    k => qc[k] != null && qc[k] !== ''
  );
  const qcParts = hasQC ? [
    qc.brillo != null && qc.brillo !== '' ? `Brillo ${qc.brillo}` : null,
    qc.viscosidad != null && qc.viscosidad !== '' ? `Visc ${qc.viscosidad} KU` : null,
    qc.ph != null && qc.ph !== '' ? `pH ${qc.ph}` : null,
    qc.densidad != null && qc.densidad !== '' ? `Dens ${qc.densidad}` : null,
    qc.finura != null && qc.finura !== '' ? `Finura ${qc.finura}` : null,
  ].filter(Boolean) : [];

  return (
    <div style={S.ocard(isPrueba)}>
      <div style={S.ocardBar(solid)} />
      <div style={S.otop}>
        <span style={S.folio}>{o.codigo}</span>
        {isPrueba && <PruebaBadge size="sm" />}
        <span className="ordx-est" style={S.estSolid(solid)}>{est.label}</span>
        {prioTint && (
          <span style={S.prioPill(prioTint)}>
            {(PRIO_BADGE[o.prioridad] || { label: o.prioridad }).label}
          </span>
        )}
        <span style={S.ofecha} title={o.fechaCreacion || ''}>{fmtFechaCorta(o.fechaCreacion)}</span>
      </div>
      <div style={S.otitle}>{o.formula || o.producto}</div>
      <div style={S.ometa}>
        {o.cantidad} cubetas{o.litPerUnit && Number(o.litPerUnit) !== 19 ? ` × ${o.litPerUnit}L` : ''} ·{' '}
        {o.pedidoId ? (
          <>
            desde pedido{' '}
            {onIrPedido ? (
              <button
                type="button"
                style={S.ometaB}
                onClick={() => onIrPedido(o)}
                title="Abrir el pedido fuente"
              >
                {pedidoCodigo || o.pedidoId}
              </button>
            ) : (
              <b style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 600, color: 'var(--lp-brand-600)' }}>
                {pedidoCodigo || o.pedidoId}
              </b>
            )}
          </>
        ) : 'orden interna'}
      </div>
      {/* Notas / fecha requerida — el mockup no las trae; se conservan en
         línea secundaria para no perder información operativa. */}
      {(o.notas || o.fechaRequerida) && (
        <div style={S.metaSub}>
          {o.notas || ''}
          {o.notas && o.fechaRequerida ? ' · ' : ''}
          {o.fechaRequerida ? `Requerida: ${o.fechaRequerida}` : ''}
        </div>
      )}
      {!o.eliminado && o.estado !== 'cancelado' && o.estado !== 'rechazado' && <Timeline estado={o.estado} />}
      {/* Chip QC (mockup .qcbox) — solo con lecturas reales */}
      {hasQC && (
        <div style={S.qcbox}>
          <b style={{ fontWeight: 700 }}>QC registrado:</b> {qcParts.join(' · ')}
        </div>
      )}
      {/* Actions */}
      {canManage && !o.eliminado && (
        <div style={S.oacts}>
          {/* Iniciar producción — SOLO órdenes internas pendientes (decisión
             owner: las que vienen de pedido se inician desde /pedidos). */}
          {onProducir && o.estado === 'pendiente' && !o.pedidoId && (
            <button
              className="ordx-btn-primary"
              style={S.btn}
              data-id="ordenes.btn.iniciar-produccion"
              data-rol="tecnico,admin"
              onClick={() => onProducir(o)}
              title="Abre el flujo guiado paso-a-paso con cronómetro por materia prima"
            >
              {Icon.play} Iniciar producción
            </button>
          )}
          {/* Aprobar QC — fase QC esperando aprobación (mockup). Lleva a la
             pantalla Producción › Calidad donde vive la aprobación real. */}
          {onAprobarQC && (o.estado === 'producido' || o.estado === 'qc_hold') && (
            <button
              className="ordx-btn-primary"
              style={S.btn}
              data-id="ordenes.btn.aprobar-qc"
              data-rol="tecnico,admin"
              onClick={() => onAprobarQC(o)}
              title="Revisar y aprobar QC en Producción › Calidad"
            >
              {Icon.check} Aprobar QC
            </button>
          )}
          {/* Ver producción — órdenes en curso (mockup). Interna → abre el
             flujo paso-a-paso; de pedido → pantalla Producción. */}
          {onVerProduccion && (o.estado === 'en_proceso' || o.estado === 'en_produccion' || o.estado === 'produccion') && (
            <button
              style={{ ...S.btn, ...S.btnGhost }}
              data-id="ordenes.btn.ver-produccion"
              data-rol="tecnico,admin"
              onClick={() => onVerProduccion(o)}
            >
              Ver producción {Icon.arrow}
            </button>
          )}
          {/* Ir al pedido — toda orden con pedido fuente (mockup: si desde) */}
          {onIrPedido && o.pedidoId && (
            <button
              style={{ ...S.btn, ...S.btnGhost }}
              data-id="ordenes.btn.ir-pedido"
              data-rol="tecnico,admin"
              onClick={() => onIrPedido(o)}
              title="Esta orden viene de un pedido. Inicia producción desde la pantalla Pedidos."
            >
              Ir al pedido {Icon.arrow}
            </button>
          )}
          {/* Transiciones manuales (pendiente↔en_proceso, cancelar, reactivar)
             — el mockup las omite; se conservan como botones ghost. */}
          {transitions.map(nextState => {
            const info = ESTADO_BADGE[nextState] || {};
            const isCancel = nextState === 'cancelado';
            return (
              <button
                key={nextState}
                style={{ ...S.btn, ...(isCancel ? S.btnGhostDanger : S.btnGhost) }}
                data-id={isCancel ? 'ordenes.btn.cancelar' : 'ordenes.btn.cambiar-estado'}
                data-rol="admin,tecnico"
                onClick={() => onChangeStatus(o, nextState)}
              >
                {isCancel ? Icon.x : Icon.arrow} {info.label || nextState}
              </button>
            );
          })}
          {canDelete && (
            <button
              style={{ ...S.btn, ...S.btnGhostDanger }}
              data-id="ordenes.btn.eliminar"
              data-rol="admin"
              onClick={() => onDelete(o)}
            >
              {Icon.trash} Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Collapsible Group (historial) ── */
function OrderGroup({ label, badgeCls, orders, canManage, canDelete, onChangeStatus, onDelete, onProducir, onIrPedido, getPedidoCodigo, getQcLote }) {
  const [open, setOpen] = useState(false);
  if (!orders?.length) return null;

  return (
    <div style={S.group}>
      <div style={S.groupHeader} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex', color: 'var(--lp-text-secondary)', transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
          <span style={S.badge(badgeCls)}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lp-brand-600)' }}>
            {orders.length} orden{orders.length > 1 ? 'es' : ''}
          </span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '10px 12px', display: 'grid', gap: 10 }}>
          {orders.map(o => (
            <OrdenCard key={o.id} orden={o} canManage={canManage} canDelete={canDelete}
              onChangeStatus={onChangeStatus} onDelete={onDelete} onProducir={onProducir}
              onIrPedido={onIrPedido}
              pedidoCodigo={getPedidoCodigo ? getPedidoCodigo(o) : ''}
              qcLote={getQcLote ? getQcLote(o) : null} />
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
  const { user } = useAuth(); /* `can` no se usa en esta pantalla (gating por rol) */
  /* FIX jun 2026 (K9): faltaba useNavigate. Las refs `navigate('/pedidos...')`
     en líneas 1156, 1172, 1585 tiraban ReferenceError al click — botón
     "→ Ir al pedido" estaba muerto desde Sprint H. */
  const navigate = useNavigate();
  /* Reskin verde: layout responsive. Escritorio → fases en grid ancho con
     label + dot de color (grpPhase del mockup). Móvil → cards limpias apiladas
     (S.ordenes del mockup móvil). */
  const isDesktop = useIsDesktop();
  const rol = user?.rol || '';
  const userName = user?.nombre || '?';
  const [mainTab, setMainTab] = useState('ordenes');
  const [subTab, setSubTab] = useState('activas');
  const [searchQ, setSearchQ] = useState('');

  /* Data */
  const { data: ordData, loading, reload: reloadOrd } = useApiData(() => api.getOrdenes(), [], 5000);
  const { data: pedData, reload: reloadPed } = useApiData(() => api.getPedidos(), [], 5000);
  /* Reskin mockup jun 2026: lecturas QC reales. Las órdenes NO traen
     qcResultados — vive en el LOTE (trazabilidad.json, match por ordenId o
     pedidoId). Sin esto el chip "QC registrado: ..." del mockup jamás
     aparecería. Polling 0 → solo push WS + reload manual. */
  const { data: trazaData, reload: reloadTraza } = useApiData(() => api.getTrazabilidad(), [], 0);

  /* FIX jun 2026 (K1): polling 5s era costoso y aún así dejaba cambios
     invisibles 2-3s. Realtime cierra el gap. */
  useRealtimeSync({
    onOrdenes:     () => reloadOrd(),
    onPedidos:     () => reloadPed(),
    onTrazabilidad:() => { reloadOrd(); reloadTraza(); },
    onQc:          () => reloadTraza(), /* QC registrado/aprobado → chip al instante */
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
  /* FIX jun 2026 (reskin, bug preexistente): handleDelete usaba `confirm`
     SIN instanciar useConfirm en esta función — resolvía al window.confirm
     global, que ignora las opciones y devuelve boolean → el flujo de PIN
     mandaba `pin=true` al API y la eliminación fallaba siempre. Se instancia
     el hook aquí (ConfirmEl se monta al final del JSX). */
  const [confirm, ConfirmEl] = useConfirm();

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

  /* Folio del pedido fuente para "desde pedido PD-XXX" (mockup ometa).
     La orden guarda pedidoId — el código legible vive en el pedido. */
  const pedidoCodigoById = useMemo(() => {
    const m = {};
    pedidos.forEach(p => { if (p && p.id) m[p.id] = p.codigo || p.id; });
    return m;
  }, [pedidos]);

  /* Lecturas QC del LOTE indexadas por ordenId y pedidoId (algunos lotes
     viejos traen ordenId vacío pero sí pedidoId). Solo lecturas reales. */
  const qcPorOrden = useMemo(() => {
    const arr = trazaData?.data || (Array.isArray(trazaData) ? trazaData : []);
    const map = {};
    (Array.isArray(arr) ? arr : []).forEach(l => {
      if (!l || l.eliminado) return;
      const qc = l.qcResultados;
      if (!qc || typeof qc !== 'object') return;
      const tiene = ['brillo', 'viscosidad', 'ph', 'densidad', 'finura']
        .some(k => qc[k] != null && qc[k] !== '');
      if (!tiene) return;
      if (l.ordenId) map['id:' + l.ordenId] = qc;
      if (l.pedidoId) map['ped:' + l.pedidoId] = qc;
    });
    return map;
  }, [trazaData]);

  /* Helpers que se pasan a cards/grupos (computed, no capturados) */
  const getPedidoCodigo = useCallback(
    (o) => (o && o.pedidoId ? (pedidoCodigoById[o.pedidoId] || o.pedidoId) : ''),
    [pedidoCodigoById]
  );
  const getQcLote = useCallback(
    (o) => {
      if (!o) return null;
      return qcPorOrden['id:' + o.id] || (o.pedidoId ? qcPorOrden['ped:' + o.pedidoId] : null) || null;
    },
    [qcPorOrden]
  );

  /* Tabs based on role */
  /* FIX jun 2026 (censo duplicados, decisión owner): se elimina la tab
     "Almacén Terán" — era una lista SOLO-LECTURA de pedidos + un modal de
     crear pedido duplicado que redirigía a /pedidos. Todo eso vive en Pedidos. */
  const mainTabs = useMemo(() => {
    const t = [];
    if (rol === 'admin' || rol === 'tecnico') t.push({ id: 'ordenes', label: 'Fábrica' });
    /* compras quitado (jun 2026, censo): la ruta /ordenes nunca admitió a Arely
       — la condición era código muerto; sus OCs viven en /compras. */
    if (rol === 'admin' || rol === 'tecnico') t.push({ id: 'compras', label: 'OC Materia prima' });
    if (t.length === 0) t.push({ id: 'ordenes', label: 'Fábrica' });
    return t;
  }, [rol]);

  /* Can manage estado/transiciones (admin + técnico) */
  const canManage = rol === 'admin' || rol === 'tecnico';
  /* Solo admin puede ELIMINAR órdenes (revierte MP, requiere PIN) */
  const canDelete = rol === 'admin';

  /* Active orders REALES (sin pruebas, sin canceladas/entregadas) */
  const activas = useMemo(() =>
    ordenes.filter(o => !o.eliminado && o.estado !== 'entregado' && o.estado !== 'cancelado' && o.estado !== 'rechazado' && !o.esPrueba)
      .sort((a, b) => {
        const p = { urgente: 0, alta: 1, normal: 2 };
        return (p[a.prioridad] || 2) - (p[b.prioridad] || 2);
      }),
    [ordenes]
  );

  /* Órdenes de PRUEBA — separadas de la vista activa */
  const pruebasActivas = useMemo(() =>
    ordenes.filter(o => !o.eliminado && o.estado !== 'entregado' && o.estado !== 'cancelado' && o.estado !== 'rechazado' && o.esPrueba)
      .sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || '')),
    [ordenes]
  );

  /* Órdenes CANCELADAS o eliminadas */
  const canceladas = useMemo(() =>
    ordenes.filter(o => o.eliminado || o.estado === 'cancelado' || o.estado === 'rechazado')
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
    /* X3b: estados canónicos. Antes 'terminada/entregada/cancelada' (legacy) NO
       casaban con el estado real → órdenes entregadas/canceladas no aparecían en
       NINGÚN grupo del historial. Catch-all completo del flujo. */
    const statusOrder = ['pendiente', 'en_proceso', 'en_produccion', 'qc_hold', 'qc_aprobado',
      'en_envasado', 'envasado', 'en_recoleccion', 'en_camino', 'en_almacen', 'entregado',
      'rechazado', 'cancelado', 'eliminado'];
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

  /* KPI tiles del page viejo eliminados (reskin mockup jun 2026): los
     contadores por fase se computan en vivo al agrupar (phase-n). */

  /* `pedidosPend` eliminado (dead code): alimentaba el panel "Pedidos de
     Almacén" que se quitó en el censo de duplicados (jun 2026) — los
     pedidos se gestionan SOLO en /pedidos. */

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
    /* NDA: admin (propietario) o vigencia de 7 días ya aceptada → arranca
       directo. Evita re-consentir el NDA al producir desde la card cuando ya se
       aceptó al aceptar el pedido (misma key 'produccion'). */
    if ((user && user.id === 'admin') || ndaYaAceptado(user, 'produccion')) {
      arrancarOrden(orden);
      return;
    }
    setPendingNDA(orden);
  }, [user, arrancarOrden]);

  /* "Ver producción →" (mockup, fase en proceso): orden interna → abre el
     flujo paso-a-paso (mismo handler real de producir, retoma donde iba);
     orden de pedido → la producción se monitorea en /produccion. */
  const handleVerProduccion = useCallback((orden) => {
    if (!orden?.pedidoId) { handleProducir(orden); return; }
    navigate('/produccion');
  }, [handleProducir, navigate]);

  /* "Aprobar QC" (mockup, fase QC): la aprobación real vive en
     Producción › Calidad (deep-link ?tab=calidad ya soportado). */
  const handleAprobarQC = useCallback(() => {
    navigate('/produccion?tab=calidad');
  }, [navigate]);

  /* "Ir al pedido →" — resalta la card fuente vía ?focus= (M2) */
  const handleIrPedido = useCallback((orden) => {
    navigate('/pedidos' + (orden?.pedidoId ? '?focus=' + encodeURIComponent(orden.pedidoId) : ''));
  }, [navigate]);

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
      confirmLabel: `Cambiar a ${label}`,
      danger: nextState === 'cancelado',
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
      {/* Texto de badges sólidos / botones primary flipea a tinta en modo
         oscuro (mockup: .dark .est y .dark .btn-primary). Los estilos inline
         no pueden usar [data-theme] — por eso este <style> scoped ordx-. */}
      <style>{`
        .ordx-est{color:#fff;}
        [data-theme="dark"] .ordx-est,.dark .ordx-est{color:#0E1413;}
        .ordx-btn-primary{background:var(--lp-brand-600);color:#fff;border:none;}
        [data-theme="dark"] .ordx-btn-primary,.dark .ordx-btn-primary{color:#0E1413;}
        .ordx-btn-primary:active{transform:scale(.97);}
      `}</style>
      <div style={S.wrap}>
        {/* Seg pill Fábrica | OC Materia prima (mockup .seg) + Nueva (mockup
           .newbtn — la TopBar compartida no trae slot de acciones). */}
        <div style={S.headRow}>
          <div style={S.seg}>
            {mainTabs.map(t => (
              <button key={t.id} style={S.segBtn(t.id === mainTab)} onClick={() => setMainTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          {/* Paquete MOCKUP 8 (lp-createbtn): inline solo en escritorio —
              en móvil lo cubre el FAB flotante. */}
          {mainTab === 'ordenes' && canManage && isDesktop && (
            <button
              className="ordx-btn-primary"
              style={S.btnNew}
              data-id="ordenes.btn.nueva"
              data-rol="admin,tecnico"
              onClick={() => setShowNewModal(true)}
            >
              {Icon.plus} Nueva orden
            </button>
          )}
        </div>
        {/* FAB móvil (paquete MOCKUP 8) — misma acción que "Nueva orden" */}
        {mainTab === 'ordenes' && canManage && (
          <Fab label="Nueva orden" dataId="ordenes.fab.nueva" dataRol="admin,tecnico"
            onClick={() => setShowNewModal(true)} />
        )}

        {/* Subtítulo en vivo (mockup .tsub) */}
        <div style={S.tsub}>
          {mainTab === 'ordenes'
            ? `${activas.length} ${activas.length === 1 ? 'orden' : 'órdenes'} de fábrica en curso`
            : 'Solicitudes a Compras'}
        </div>

        {/* ════════ FÁBRICA TAB ════════ */}
        {mainTab === 'ordenes' && (
          <>
            {/* Panel "Pedidos de Almacén" eliminado (jun 2026, censo duplicados):
               duplicaba el Aceptar/Iniciar de Pedidos — los pedidos se gestionan
               SOLO en /pedidos. Esta pantalla queda para órdenes internas y OC MP. */}

            {/* Sub-tabs + toolbar — separa pruebas y canceladas para no contaminar la vista */}
            <div style={S.subTabs}>
              {[
                { id: 'activas',     label: `Activas (${activas.length})` },
                ...(pruebasActivas.length > 0 ? [{ id: 'pruebas', label: `Pruebas (${pruebasActivas.length})` }] : []),
                ...(canceladas.length > 0     ? [{ id: 'canceladas', label: `Canceladas (${canceladas.length})` }] : []),
                { id: 'todas',       label: 'Historial' },
              ].map(t => (
                <button key={t.id} style={S.subTab(t.id === subTab)} onClick={() => setSubTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {subTab === 'activas' && (
              <>
                {/* Búsqueda — el mockup no la trae; se conserva (función real) */}
                <div style={S.toolbar}>
                  <input type="text" style={S.search} placeholder="Buscar orden..."
                    value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                </div>

                {/* KPI tiles eliminados (reskin mockup jun 2026): los
                   contadores viven EN VIVO en el encabezado de cada fase
                   (.phase-n) — misma información sin duplicar UI. */}

                {filteredActivas.length === 0 ? (
                  <div style={S.empty}>
                    <div style={S.emptyDash}>
                      {searchQ
                        ? <>Sin resultados — no se encontró "{searchQ}".</>
                        : <>Sin órdenes activas. Respira tranquilo.</>}
                    </div>
                  </div>
                ) : (() => {
                  /* Z3 (jun 2026): agrupar activas por fase. Reskin mockup
                     Órdenes.html: encabezado de fase = dot color + título +
                     contador mono + "· subtítulo" (computed en vivo).
                     Fases del mockup ("Por iniciar / En proceso / En control
                     de calidad") + extensión a los estados reales tardíos
                     que el mockup demo no trae (envasado/transporte, almacén).
                     Nota: en_proceso pasa a "En proceso" (el mockup lo define
                     como 'Producción en curso' y arrancarOrden lo setea justo
                     al iniciar producción — antes caía en 'Pendientes'). */
                  const FASES = [
                    { key: 'por_iniciar', titulo: 'Por iniciar',            sub: 'Esperando arranque',    color: 'var(--lp-warning-600)', estados: ['pendiente', 'aceptado'] },
                    { key: 'en_proceso',  titulo: 'En proceso',             sub: 'Producción en curso',   color: 'var(--lp-brand-600)',   estados: ['en_proceso', 'en_produccion', 'produccion'] },
                    { key: 'qc',          titulo: 'En control de calidad',  sub: 'Esperando aprobación',  color: 'var(--lp-granel-600)',  estados: ['producido', 'qc_hold', 'qc_aprobado', 'qc'] },
                    { key: 'envasado',    titulo: 'Envasado y transporte',  sub: 'Rumbo a almacén',       color: 'var(--lp-info-600)',    estados: ['en_envasado', 'envasado', 'en_recoleccion', 'en_camino'] },
                    { key: 'almacen',     titulo: 'En almacén',             sub: 'Recibidas en Terán',    color: 'var(--lp-success-600)', estados: ['en_almacen', 'terminada', 'entregada'] },
                  ];
                  /* Grid responsive: escritorio = cards anchas en grilla;
                     móvil = una columna (cards apiladas, mockup phone). */
                  const gridFase = {
                    display: 'grid',
                    gridTemplateColumns: isDesktop
                      ? 'repeat(auto-fill, minmax(360px, 1fr))'
                      : '1fr',
                    gap: 12,
                  };
                  const PhaseHeader = ({ titulo, sub, color, count }) => (
                    <div style={S.phaseH}>
                      <span style={S.phaseDot(color)} />
                      <span style={S.phaseT}>{titulo}</span>
                      <span style={S.phaseN}>{count}</span>
                      <span style={S.phaseS}>· {sub}</span>
                    </div>
                  );
                  const cardProps = {
                    canManage, canDelete,
                    onChangeStatus: handleChangeStatus, onDelete: handleDelete,
                    onProducir: handleProducir, onIrPedido: handleIrPedido,
                    onVerProduccion: handleVerProduccion, onAprobarQC: handleAprobarQC,
                  };
                  const porFase = {};
                  FASES.forEach(f => { porFase[f.key] = []; });
                  const otras = [];
                  filteredActivas.forEach(o => {
                    const est = (o.estado || '').toLowerCase();
                    const fase = FASES.find(f => f.estados.includes(est));
                    if (fase) porFase[fase.key].push(o);
                    else otras.push(o);
                  });
                  return (
                    <>
                      {FASES.filter(f => porFase[f.key].length > 0).map(f => (
                        <div key={f.key} style={{ marginBottom: 20 }}>
                          <PhaseHeader titulo={f.titulo} sub={f.sub} color={f.color} count={porFase[f.key].length} />
                          <div style={gridFase}>
                            {porFase[f.key].map(o => (
                              <OrdenCard key={o.id} orden={o} {...cardProps}
                                pedidoCodigo={getPedidoCodigo(o)} qcLote={getQcLote(o)} />
                            ))}
                          </div>
                        </div>
                      ))}
                      {otras.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <PhaseHeader titulo="Otros estados" sub="Fuera del flujo estándar" color="var(--lp-border-strong)" count={otras.length} />
                          <div style={gridFase}>
                            {otras.map(o => (
                              <OrdenCard key={o.id} orden={o} {...cardProps}
                                pedidoCodigo={getPedidoCodigo(o)} qcLote={getQcLote(o)} />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {subTab === 'pruebas' && (
              pruebasActivas.length === 0 ? (
                <div style={S.empty}><div style={S.emptyDash}>Sin órdenes de prueba activas.</div></div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(360px, 1fr))' : '1fr', gap:12 }}>
                  {pruebasActivas.map(o => (
                    <OrdenCard key={o.id} orden={o} canManage={canManage} canDelete={canDelete}
                      onChangeStatus={handleChangeStatus} onDelete={handleDelete}
                      onProducir={handleProducir} onIrPedido={handleIrPedido}
                      onVerProduccion={handleVerProduccion} onAprobarQC={handleAprobarQC}
                      pedidoCodigo={getPedidoCodigo(o)} qcLote={getQcLote(o)} />
                  ))}
                </div>
              )
            )}

            {subTab === 'canceladas' && (
              canceladas.length === 0 ? (
                <div style={S.empty}><div style={S.emptyDash}>Sin órdenes canceladas.</div></div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(360px, 1fr))' : '1fr', gap:12 }}>
                  {canceladas.map(o => (
                    <OrdenCard key={o.id} orden={o} canManage={canManage} canDelete={canDelete}
                      onChangeStatus={handleChangeStatus} onDelete={handleDelete}
                      pedidoCodigo={getPedidoCodigo(o)} qcLote={getQcLote(o)} />
                  ))}
                </div>
              )
            )}

            {subTab === 'todas' && (
              historialGroups.length === 0 ? (
                <div style={S.empty}><div style={S.emptyDash}>Sin órdenes registradas.</div></div>
              ) : (
                historialGroups.map(g => (
                  <OrderGroup key={g.status} label={g.label} badgeCls={g.badgeCls}
                    orders={g.orders} canManage={canManage} canDelete={canDelete}
                    onChangeStatus={handleChangeStatus} onDelete={handleDelete}
                    getPedidoCodigo={getPedidoCodigo} getQcLote={getQcLote} />
                ))
              )
            )}
          </>
        )}

        {/* Tab "Almacén Terán" eliminada (jun 2026, censo duplicados) — vive en /pedidos. */}

        {/* ════════ OC MP TAB ════════ */}
        {mainTab === 'compras' && (
          <OCMPTab rol={rol} userName={userName} showToast={showToast} isDesktop={isDesktop} />
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
                /* FIX jun 2026 (censo Pre#4): sin esto el lote nacía sin pedidoId
                   y el pedido fuente quedaba atascado en 'aceptado' para siempre. */
                pedidoId: prodFlowItem.pedidoId || '',
                litPerUnit: prodFlowItem.litPerUnit,
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

      {/* ── Confirm con prompt (motivo + PIN de eliminación) ── */}
      {ConfirmEl}

      {/* ── Toast ── */}
      {toastMsg && (
        <div style={{ ...S.toast, display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon.check}
          {toastMsg}
        </div>
      )}
    </>
  );
}

/* PedidosTab + NuevoPedidoModal local eliminados (jun 2026, censo duplicados):
   la tab Almacén Terán era solo-lectura y su modal duplicaba pages/pedidos/NuevoPedidoModal
   (hasta redirigía a /pedidos al crear). Todo vive en /pedidos. */

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
/* Color sólido por familia visual (riel + badge sólido de la card OC) */
const OC_CLS_SOLID = {
  ok:      'var(--lp-success-600)',
  warn:    'var(--lp-warning-600)',
  err:     'var(--lp-danger-600)',
  info:    'var(--lp-info-600)',
  neutral: 'var(--lp-text-secondary)',
  purple:  'var(--lp-granel-600)',
};
const OC_PRIO_TINT = {
  urgente: 'var(--lp-danger-600)',
  alta:    'var(--lp-warning-600)',
  baja:    'var(--lp-info-600)',
};

function OCMPTab({ rol, userName, showToast, isDesktop }) {
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
  /* Recibir MP: admin y técnico (espeja el backend /api/compras/oc/recibir =
     "Solo Enrique o Admin"). El botón vive DENTRO del card de OC activa, abajo. */
  const canRecibir = rol === 'admin' || rol === 'tecnico';

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

      {/* Toolbar + Nueva Solicitud → Arely (compras) */}
      {canSolicitar && (
        <div style={{ ...S.toolbar, justifyContent: 'flex-end' }}>
          <button
            className="ordx-btn-primary"
            style={S.btnNew}
            data-id="ordenes.btn.nueva-solicitud-oc"
            data-rol="admin,tecnico,compras"
            onClick={() => setShowNew(true)}
          >
            {Icon.plus} Nueva Solicitud
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
          {/* Empty state del mockup (tab OC Materia prima) */}
          <div style={S.emptyDash}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 6 }}>
              {filter === 'mias' ? 'No tienes solicitudes propias' : 'Sin OCs en este filtro'}
            </div>
            Solicitudes de OC de materia prima → Compras (Arely).
            <br />Aquí pides insumos que falten para producir.
            {canSolicitar && (
              <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 8 }}>
                Pulsa "Nueva Solicitud" para pedir MP a compras.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(360px, 1fr))' : '1fr', gap: 12 }}>
          {filtered.map(oc => <OCCard key={oc.id} oc={oc} canRecibir={canRecibir} onRefresh={reload} />)}
        </div>
      )}

      {showNew && (
        <SolicitudMPModal
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

function OCCard({ oc, canRecibir = false, onRefresh }) {
  const [showRecibir, setShowRecibir] = useState(false);
  const estado = OC_ESTADO_BADGE[oc.estado] || { cls: 'neutral', label: oc.estado || '-' };
  const solid = OC_CLS_SOLID[estado.cls] || OC_CLS_SOLID.neutral;

  /* "Recibir MP" vive aquí dentro (pedido dueño): se puede recibir una OC
     APROBADA con destino Fábrica aunque no esté pagada (crédito). Se excluye
     Terán (la recibe Josué) y lo ya recibido/eliminado. */
  const destinoFabrica = (oc.almacenDestino || 'Fabrica') !== 'Teran';
  const recibible = canRecibir && !!oc.aprobada && destinoFabrica
    && oc.estado !== 'recibida' && oc.estado !== 'eliminada' && !oc.eliminada;

  /* Hint de crédito (e5): días para vencer / vencido — informativo. */
  const creditoSinPagar = oc.pago === 'credito' && !oc.pagada;
  let credito = null;
  if (creditoSinPagar && oc.fechaVencimiento) {
    const v = new Date(String(oc.fechaVencimiento).slice(0, 10) + 'T00:00:00');
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const d = Math.round((v - hoy) / 86400000);
    if (!isNaN(d)) {
      credito = d < 0
        ? { txt: `Crédito vencido hace ${Math.abs(d)}d`, bg: 'var(--lp-danger-100)', fg: 'var(--lp-danger-700)' }
        : d <= 5
          ? { txt: `Crédito vence en ${d}d`, bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-700)' }
          : { txt: `Crédito · vence ${String(oc.fechaVencimiento).slice(0, 10)}`, bg: 'var(--lp-brand-100)', fg: 'var(--lp-brand-700)' };
    }
  }
  const prioTint = oc.prioridad && oc.prioridad !== 'normal' ? OC_PRIO_TINT[oc.prioridad] : null;
  const fecha = oc.fechaCreacion ? new Date(oc.fechaCreacion).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }) : '-';
  const itemsCount = Array.isArray(oc.items) ? oc.items.length : 0;
  const totalKg = Array.isArray(oc.items) ? oc.items.reduce((s, i) => s + (Number(i.kg) || 0), 0) : 0;
  return (
    <div style={S.ocard(false)}>
      <div style={S.ocardBar(solid)} />
      <div style={S.otop}>
        <span style={S.folio}>{oc.codigo || oc.id}</span>
        <span className="ordx-est" style={S.estSolid(solid)}>{estado.label}</span>
        {prioTint && (
          <span style={S.prioPill(prioTint)}>
            {(OC_PRIO_BADGE[oc.prioridad] || { label: oc.prioridad }).label}
          </span>
        )}
        <span style={S.ofecha} title={oc.fechaCreacion || ''}>{fecha}</span>
      </div>
      <div style={S.otitle}>{oc.proveedor || 'POR ASIGNAR'}</div>
      <div style={S.ometa}>
        {oc.creadoPor || '?'} · {itemsCount} MP{itemsCount !== 1 ? 's' : ''} · {totalKg.toFixed(0)} kg total
      </div>

      {/* Lista de items */}
      {Array.isArray(oc.items) && oc.items.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 4, borderTop: '1px solid var(--lp-border-subtle)' }}>
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
          marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--lp-border-subtle)',
          fontSize: 11, color: 'var(--lp-text-secondary)', fontStyle: 'italic',
        }}>
          "{oc.notas}"
        </div>
      )}

      {/* Footer: hint de crédito + botón "Recibir MP" (Enrique/admin). El botón
          no depende del pago: se recibe a crédito sin liquidar. */}
      {(recibible || credito) && (
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--lp-border-subtle)',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          {credito && (
            <span style={{
              display: 'inline-flex', padding: '3px 9px', fontSize: 10.5, fontWeight: 700,
              borderRadius: 6, background: credito.bg, color: credito.fg,
            }}>{credito.txt}</span>
          )}
          {recibible && (
            <button
              type="button"
              data-id="ordenes.btn.recibir-mp"
              data-rol="admin,tecnico"
              onClick={() => setShowRecibir(true)}
              title="Recibir la materia prima de esta OC en Fábrica"
              style={{
                marginLeft: 'auto', minHeight: 40, padding: '9px 16px', borderRadius: 10,
                border: 'none', background: 'var(--lp-brand-600)', color: '#fff',
                fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Recibir MP
            </button>
          )}
        </div>
      )}

      {showRecibir && (
        <RecibirOCModal
          oc={oc}
          onClose={() => setShowRecibir(false)}
          onSaved={() => { setShowRecibir(false); onRefresh && onRefresh(); }}
        />
      )}
    </div>
  );
}

/* userName no se usa: el backend toma el solicitante de la sesión */
function SolicitudMPModal({ onClose, onSuccess }) {
  const sheet = useSheetStyles();
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
    <div style={sheet.overlay} onClick={onClose}>
      <div style={{ ...sheet.modal, ...(sheet.isDesktop ? { maxWidth: 560 } : {}) }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)' }}>
              Nueva Solicitud de MP
            </div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
              Compras (Arely) recibirá una notificación
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--lp-text-tertiary)', padding: 0,
            display: 'inline-flex', minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center',
          }}>{Icon.close}</button>
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
                  ...S.btnSecondary, minHeight: 44, padding: '8px 12px',
                  opacity: items.length === 1 ? 0.4 : 1,
                  cursor: items.length === 1 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Quitar MP"
                title="Quitar"
              >{Icon.x}</button>
            </div>
          ))}
          <button type="button" onClick={addItem} style={{
            ...S.btnSecondary, fontSize: 12, padding: '6px 12px', minHeight: 44,
            marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {Icon.plus} Agregar otra MP
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
