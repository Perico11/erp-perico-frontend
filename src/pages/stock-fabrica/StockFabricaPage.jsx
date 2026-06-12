import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import PageTabs from '../../components/ui/PageTabs';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import QRModal from '../../components/QRModal';
import useConfirm from '../../hooks/useConfirm';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { ESTADO_SUBLOTE_LABEL, ESTADO_SUBLOTE_COLOR, ESTADO_LOTE_LABEL } from '../../lib/loteTransiciones';
import PruebaBadge from '../../components/ui/PruebaBadge';
import { qrSvg, qrDataUrl } from '../../lib/qrGenerator';

/* ── Iconos line SVG (sin emojis — DS verde) ───────────────────────── */
const Icon = {
  envasar: (p = {}) => (<svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
  truck: (p = {}) => (<svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>),
  transfer: (p = {}) => (<svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>),
  trash: (p = {}) => (<svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>),
  x: (p = {}) => (<svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  check: (p = {}) => (<svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>),
  qr: (p = {}) => (<svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="14" x2="14" y2="17"/><line x1="17" y1="14" x2="21" y2="14"/><line x1="14" y1="21" x2="21" y2="21"/><line x1="21" y1="17" x2="21" y2="21"/></svg>),
  chevron: (p = {}) => (<svg width={p.s || 14} height={p.s || 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: p.open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><polyline points="9 18 15 12 9 6"/></svg>),
  qcHold: (p = {}) => (<svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>),
};

/* Construye la URL pública del QR de un sublote. Mirror de _generarQRPayload del backend. */
function buildQrUrl(cod) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  let base = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
      base = String(import.meta.env.BASE_URL).replace(/\/$/, '');
    }
  } catch {}
  return `${origin}${base}/qr/${encodeURIComponent(cod)}`;
}

/* ── Helpers ── */
const B = (bg, fg) => ({
  display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 600,
  borderRadius: 6, background: bg, color: fg, marginRight: 4,
});

/* CSS inyectado UNA vez — paridad mockup Stock Fábrica.html:
   - slide-up del bottom-sheet (motion solo transform; reduced-motion ok)
   - texto oscuro de botones de acento en dark (mockup .dark .lbtn{color:#0E1413})
   - input central del stepper de cantidad sin spinners nativos */
const SF_CSS = `
  [data-theme="dark"] .lp-btn-acc, .dark .lp-btn-acc{ color:#0E1413 !important; }
  @keyframes lpSheetIn{ from{ transform:translateY(26px) } to{ transform:none } }
  .lp-qval::-webkit-outer-spin-button, .lp-qval::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }
  .lp-qval{ -moz-appearance:textfield; }
  @media (prefers-reduced-motion:reduce){ .lp-sheet{ animation:none !important } }
`;
function injectSheetCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lp-stockfab-css')) return;
  const st = document.createElement('style');
  st.id = 'lp-stockfab-css';
  st.textContent = SF_CSS;
  document.head.appendChild(st);
}

function litUsed(lote) {
  /* Evitar doble conteo TOTE + hijos: los sublotes finales que salen de un TOTE
     representan los MISMOS litros que el TOTE contenía. Solo contamos:
     - Sublotes finales (no-tote, fase!=1)
     - Para TOTEs: solo los litros YA consumidos (lit - litrosRestante),
       que NO tengan hijos registrados (si tienen hijos, esos ya se cuentan) */
  const subs = lote.sublotes || [];
  let total = 0;
  subs.forEach(s => {
    const lit = Number(s.lit) || 0;
    const isTote = s.tipo === 'tote' || s.fase === 1 || s.claseSublote === 'tote';
    if (!isTote) {
      /* Sublote final — siempre cuenta */
      total += lit;
    } else {
      /* TOTE: solo contar litros que AÚN no tienen hijos finales registrados.
         Si el TOTE tiene litrosRestante, esos litros no están envasados.
         Si tiene hijos (fromTote/esHijoDe), esos litros ya se contaron arriba. */
      const tieneHijos = subs.some(h => h !== s && (h.fromTote === s.cod || h.esHijoDe === s.cod));
      if (!tieneHijos) {
        /* TOTE sin reenvasar — sus litros representan material envasado a granel */
        total += lit;
      }
      /* Si tiene hijos, NO sumamos el TOTE — los hijos ya cubren esos litros */
    }
  });
  return total;
}
function litRest(lote) {
  const total = Number(lote.litrosTotal) || 0;
  return Math.max(0, total - litUsed(lote));
}
function envEstado(lote) {
  const total = Number(lote.litrosTotal) || 0;
  if (total <= 0) return 'listo';
  const used = litUsed(lote);
  if (used <= 0) return 'listo';
  const rest = total - used;
  if (rest < 1 || (rest / total) < 0.005) return 'envasado';
  return 'parcial';
}

/* X3 (jun 2026): labels canónicos importados desde lib/loteTransiciones.js.
   El bg/fg sigue local porque StockFabrica usa paletas suaves (chip pastel)
   distintas a las del badge sólido del state-machine en otros lugares.
   Si el lote tiene un estado fuera del dominio canónico, el .label
   default es el código crudo (debug-friendly). */
const ESTADO_BG_FG = {
  producido:      { bg: 'var(--lp-brand-100)',   fg: 'var(--lp-brand-700)' },
  qc_aprobado:    { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-600)' },
  en_envasado:    { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
  en_proceso:     { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
  envasado:       { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-600)' },
  en_recoleccion: { bg: 'var(--lp-granel-50)',              fg: 'var(--lp-granel-600)' },
  en_camino:      { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
  en_almacen:     { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-600)' },
  reenvasado:     { bg: 'var(--lp-reenvase-50)',              fg: 'var(--lp-reenvase-600)' },
};
const ESTADO_MAP = Object.keys(ESTADO_BG_FG).reduce((acc, k) => {
  acc[k] = { label: ESTADO_LOTE_LABEL[k] || k, ...ESTADO_BG_FG[k] };
  return acc;
}, { reenvasado: { label: 'Re-envasado', ...ESTADO_BG_FG.reenvasado } }); /* reenvasado no está en ESTADO_LOTE_LABEL */

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
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)', padding: '14px 16px',
    borderTop: `3px solid ${accent}`, textAlign: 'center',
  }),
  kpiLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-tertiary)' },
  kpiValue: { fontSize: 24, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', marginTop: 4 },
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  /* Card de lote — mockup .lcard: radio 18, padding 15/16, hairline */
  card: {
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
    borderRadius: 18, padding: '15px 16px', marginBottom: 10,
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    flexWrap: 'wrap', marginBottom: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 8 },
  cardActions: { display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  /* Barra de avance de envasado — mockup .pbar/.pfill: 7px, pill, acento */
  progressWrap: { height: 7, borderRadius: 999, background: 'var(--lp-bg-sunken)', overflow: 'hidden', marginBottom: 0 },
  progressBar: (pct) => ({
    height: '100%', borderRadius: 999, width: `${Math.min(100, pct)}%`,
    background: 'var(--lp-brand-600)',
    transition: 'width .4s cubic-bezier(.22,1,.36,1)',
  }),
  btnPrimary: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-brand-600)', color: '#fff', minHeight: 40,
  },
  btnSuccess: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-success-600)', color: '#fff', minHeight: 40,
  },
  btnSecondary: {
    padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', minHeight: 40,
  },
  btnWarn: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-warning-600)', color: '#fff', minHeight: 40,
  },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0', fontSize: 13 },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
  /* Modal */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto',
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
  /* (jun 2026, paridad mockup) Los estilos del formulario Z8 (stepBar/stepChip/
     presoCard/ticket) se retiraron junto con su markup — el sheet del mockup
     usa secciones tituladas (S.sec) + resumen tintado (S.summary). */
  /* Toast invertido (mockup .toast: bg texto / texto fondo) */
  toast: {
    position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
    padding: '12px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 1001,
    background: 'var(--lp-text-primary)', color: 'var(--lp-bg-base)',
    boxShadow: '0 4px 16px rgba(0,0,0,.15)', display: 'inline-flex', alignItems: 'center',
  },
  sublote: {
    padding: '8px 12px', borderRadius: 8, marginBottom: 4,
    border: '1px solid var(--lp-border-subtle)', fontSize: 12,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  /* ── Tabla escritorio (ERP Escritorio.html · SCREENS.stock) ──────── */
  tablewrap: {
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
    borderRadius: 14, overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', padding: '12px 16px',
    borderBottom: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-sunken)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 16px', borderBottom: '1px solid var(--lp-border-subtle)',
    fontSize: 13.5, color: 'var(--lp-text-primary)', verticalAlign: 'middle',
  },
  tdMono: { fontFamily: 'var(--lp-font-mono)', fontWeight: 600 },
  /* Botón ghost de tabla — tamaño estándar, NUNCA 100% width en escritorio */
  btnGhost: {
    height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  btnTablePrimary: {
    height: 36, padding: '0 14px', borderRadius: 10, border: 'none',
    background: 'var(--lp-brand-600)', color: '#fff',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  rowActions: {
    display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  subRowCell: {
    padding: '0 16px 14px', borderBottom: '1px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-sunken)',
  },

  /* ── Sheet de envasado — mockup Stock Fábrica.html (.overlay/.sheet) ──
     Bottom-sheet radio 26 arriba en móvil; modal centrado en escritorio. */
  sheetOverlay: (desk) => ({
    position: 'fixed', inset: 0, background: 'rgba(10,16,14,.5)', zIndex: 1000,
    display: 'flex', alignItems: desk ? 'center' : 'flex-end', justifyContent: 'center',
    padding: desk ? 16 : 0,
  }),
  sheetBox: (desk) => ({
    background: 'var(--lp-bg-base)', width: '100%',
    maxWidth: desk ? 480 : 'none', maxHeight: desk ? '90vh' : '92vh',
    overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', borderRadius: desk ? 16 : '26px 26px 0 0',
    padding: '20px 20px 26px', boxShadow: '0 8px 32px rgba(0,0,0,.22)',
    animation: 'lpSheetIn .3s cubic-bezier(.22,1,.36,1)',
  }),
  grab: { width: 38, height: 4, borderRadius: 999, background: 'var(--lp-border-default)', margin: '0 auto 14px' },
  shH: { fontSize: 18, fontWeight: 600, color: 'var(--lp-text-primary)', display: 'flex', alignItems: 'center', gap: 8 },
  shS: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2, marginBottom: 6 },
  sec: { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em',
         color: 'var(--lp-text-tertiary)', margin: '18px 2px 9px' },
  /* Presentación — mockup .presgrid/.pres: 2 col, icono en tile + nombre + cap mono */
  presGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 },
  pres: (on, disabled) => ({
    border: '1.5px solid ' + (on ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'),
    background: on ? 'color-mix(in srgb, var(--lp-brand-600) 8%, var(--lp-bg-raised))' : 'var(--lp-bg-raised)',
    borderRadius: 14, padding: 13, cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 11,
    opacity: disabled ? .45 : 1, minHeight: 60,
  }),
  presIc: {
    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'color-mix(in srgb, var(--lp-brand-600) 13%, transparent)', color: 'var(--lp-brand-600)',
  },
  presN: { fontSize: 13.5, fontWeight: 600, color: 'var(--lp-text-primary)', display: 'block' },
  presL: { fontSize: 11, color: 'var(--lp-text-secondary)', fontFamily: 'var(--lp-font-mono)' },
  /* Segmented pills — mockup .seg/.segb (marca / presentación retail) */
  seg: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  segb: (on, disabled) => ({
    padding: '9px 14px', borderRadius: 999, fontFamily: 'inherit', fontSize: 13,
    fontWeight: on ? 600 : 500, cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid ' + (on ? 'transparent' : 'var(--lp-border-subtle)'),
    background: on ? 'var(--lp-text-primary)' : 'var(--lp-bg-raised)',
    color: on ? 'var(--lp-bg-base)' : 'var(--lp-text-secondary)',
    opacity: disabled ? .45 : 1, minHeight: 40,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }),
  /* Stepper de cantidad — mockup .stepper2/.qbtn/.qval/.qhint */
  stepper2: { display: 'flex', alignItems: 'center', gap: 12 },
  qbtn: (disabled) => ({
    width: 44, height: 44, borderRadius: 12, border: '1px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', fontSize: 22,
    cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontFamily: 'inherit', opacity: disabled ? .4 : 1, flexShrink: 0,
  }),
  qval: {
    flex: 1, textAlign: 'center', fontFamily: 'var(--lp-font-mono)', fontSize: 26, fontWeight: 700,
    color: 'var(--lp-text-primary)', border: 'none', background: 'transparent', outline: 'none',
    width: '100%', minWidth: 0, padding: 0,
  },
  qhint: { fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 8, textAlign: 'center' },
  qhintB: { color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)', fontWeight: 700 },
  /* Chip "Auto" de la tapa sugerida por marca — mockup .autochip */
  autochip: {
    fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
    padding: '3px 8px', borderRadius: 999,
    background: 'color-mix(in srgb, var(--lp-info-600) 15%, transparent)', color: 'var(--lp-info-600)',
    flexShrink: 0,
  },
  /* Resumen — mockup .summary: caja tintada de acento */
  summary: {
    marginTop: 18, padding: '14px 16px', borderRadius: 14,
    background: 'color-mix(in srgb, var(--lp-brand-600) 9%, var(--lp-bg-raised))',
    border: '1px solid color-mix(in srgb, var(--lp-brand-600) 22%, transparent)',
  },
  summaryT: { fontSize: 14, fontWeight: 600, color: 'var(--lp-text-primary)' },
  summaryS: { fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 3, fontFamily: 'var(--lp-font-mono)' },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 11.5, marginTop: 6, color: 'var(--lp-text-secondary)',
  },
  /* Acciones del sheet — mockup .sh-acts: Cancelar ghost + primaria flex:1 */
  shActs: { display: 'flex', gap: 10, marginTop: 20 },
  btnSheetGhost: {
    height: 50, borderRadius: 14, border: '1px solid var(--lp-border-subtle)',
    background: 'transparent', color: 'var(--lp-text-secondary)', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600, padding: '0 20px',
    flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  btnSheetPrimary: (disabled) => ({
    height: 50, borderRadius: 14, border: 'none', background: 'var(--lp-brand-600)',
    color: '#fff', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
    fontSize: 14.5, fontWeight: 600, flex: 1, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: 8, opacity: disabled ? .6 : 1,
  }),
};

/* Z8 (jun 2026): metadata de presentaciones con iconos SVG inline.
   Reemplaza el <select> plano por tarjetas visuales touch-friendly. */
const PRESENTACIONES_META = [
  {
    key: 'cubeta', nombre: 'Cubeta', cap: '19 L',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z"/><path d="M4 7h16"/><path d="M9 4h6l1 3H8l1-3Z"/></svg>),
  },
  {
    key: 'galon', nombre: 'Galón', cap: '3.785 L',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3h4v2.5l2.5 1.8A3 3 0 0 1 18 9.7V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9.7a3 3 0 0 1 1.5-2.4L10 5.5V3Z"/><path d="M6 12h12"/></svg>),
  },
  {
    key: 'litro', nombre: 'Litro', cap: '1 L',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h6v3l1 2v13a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7l1-2V2Z"/><path d="M8 11h8"/></svg>),
  },
  {
    key: 'otros', nombre: 'Otros', cap: 'bote/funda',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>),
  },
  {
    key: 'tote', nombre: 'TOTE', cap: 'granel',
    icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="2.6"/><path d="M4 5v14a8 2.6 0 0 0 16 0V5"/><path d="M4 12a8 2.6 0 0 0 16 0"/></svg>),
  },
];

/* ═══════════════════════════════════════════════════════════════════ */
/* ENVASADO MODAL                                                     */
/* ═══════════════════════════════════════════════════════════════════ */
export function EnvasadoModal({ lote, envases, userName, onClose, onSuccess }) {
  useBodyScrollLock(); /* FIX jun 2026: sin scroll-bleed al body en móvil */
  /* REGLA DE NEGOCIO: TOTE indivisible.
     Un TOTE es un contenedor de transporte a granel. Si el lote se envasa en
     TOTE, va TODO el lote en uno o más TOTEs del MISMO tipo — nunca mezclado
     con envases finales (cubeta/galón/litro) en el mismo lote.

     - Si el lote ya tiene sublotes envasados_final → solo permitimos seguir
       envasando en envases finales (TOTE deshabilitado).
     - Si el lote ya tiene sublotes TOTE → solo permitimos crear más TOTEs
       (envases finales deshabilitados).
     - Si el lote NO tiene sublotes todavía → el técnico elige libremente,
       pero al elegir TOTE auto-llenamos la cantidad con los litros restantes
       (porque va TODO el lote o nada). */
  const sublotesActuales = (lote.sublotes || []).filter(s => !s.esMerma);
  /* Detectores explícitos — NO usar negaciones que dan falso positivo con
     sublotes legacy donde claseSublote/fase pueden ser undefined.
     PRESENTACIONES_FINALES = solo las realmente finales. */
  const PRESENTACIONES_FINALES = ['cubeta', 'galon', 'litro'];
  const haySublotesFinales = sublotesActuales.some(s =>
    s.claseSublote === 'envasado_final' ||
    s.fase === 2 ||
    PRESENTACIONES_FINALES.includes(s.tipo)
  );
  const haySublotesTote = sublotesActuales.some(s =>
    s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1
  );
  /* Si ya hay TOTEs, forzar tipo='tote'. Si ya hay finales, default='cubeta'. */
  const tipoInicial = haySublotesTote ? 'tote' : 'cubeta';
  const [tipo, setTipo] = useState(tipoInicial);
  const [marca, setMarca] = useState('');
  const [tapaKey, setTapaKey] = useState('');
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  /* Sheet responsive (mockup): bottom-sheet radio 26 en móvil, modal centrado
     en escritorio. Solo presentación — firma/props/payload intactos. */
  const isDesktop = useIsDesktop();
  useEffect(() => { injectSheetCSS(); }, []);

  const rest = litRest(lote);
  const tapas = envases?.tapas || {};
  const tapaDefault = envases?.tapa_default || {};

  /* Capacidad por tipo — tote usa litros directos, no qty × cap.
     (litPorUnidad/maxUnidades/litTotal se calculan más abajo, después de
     resolver la subcategoría — "otros" usa su capacidad_ml individual.) */
  const isTote = tipo === 'tote';

  /* TOTE indivisible: al cambiar a TOTE, auto-llenar litros con TODO el restante.
     Si el técnico necesita dos TOTEs (lote más grande que un solo contenedor),
     editará el campo, pero la sugerencia inicial es "todo el lote". */
  useEffect(() => {
    if (isTote && rest > 0) {
      setQty(String(Math.floor(rest)));
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [isTote]);

  /* Solo cubeta usa tapa formal. Galón/litro/tote no requieren */
  const usaTapa = tipo === 'cubeta';

  /* Marcas DISPONIBLES para el tipo seleccionado.
     En vez de usar `envases.marcas` (lista plana mezclada), filtramos las
     subcategorias dentro de la categoria activa. Así "Premium" para cubeta
     resuelve a `cubeta-premium`, para galón a `galon-premium`, etc. */
  const subcatList = useMemo(() => {
    if (isTote) return [];
    const cat = envases?.categorias?.[tipo];
    if (!cat?.subcategorias) return [];
    return Object.entries(cat.subcategorias)
      .map(([k, v]) => ({
        key: k,
        nombre: v.nombre,
        marca: v.marca,
        capacidad_ml: v.capacidad_ml || null,
        stock: v.stock || 0,
        min: v.min || 0,
      }))
      .sort((a, b) => (b.stock - a.stock) || a.nombre.localeCompare(b.nombre));
  }, [tipo, isTote, envases]);

  /* FIX jun 2026 (censo H5 — "Otros" inutilizable): las subcats de "otros"
     (bote/funda/tubo) NO tienen marca — el option usaba `marca||nombre` pero la
     resolución buscaba SOLO por marca → subKey siempre null y el submit se
     bloqueaba. Resolución simétrica por el mismo valor del option. */
  const valorSubcat = (s) => s.marca || s.nombre;

  /* Auto-seleccionar primera subcat con stock cuando cambia el tipo */
  useEffect(() => {
    if (isTote) { setMarca(''); return; }
    /* Si la marca actual no coincide con ninguna subcat del nuevo tipo, reset */
    const found = subcatList.find(s => valorSubcat(s) === marca);
    if (!found) {
      const firstWithStock = subcatList.find(s => s.stock > 0);
      setMarca(firstWithStock ? valorSubcat(firstWithStock) : '');
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [tipo]);

  /* subKey real para enviar al backend */
  const subcatActual = subcatList.find(s => valorSubcat(s) === marca);
  const subKey = subcatActual?.key || null;
  const stockEnvase = subcatActual?.stock || 0;
  const stockEnvaseInsuf = !isTote && parseInt(qty) > 0 && stockEnvase < parseInt(qty);

  /* Capacidad: "otros" usa la capacidad_ml individual del item (bote 750ml,
     funda 250ml, etc.) — antes caía al default 19L (censo H5). */
  const capMap = { cubeta: 19, galon: 3.785, litro: 1, tote: 1 };
  const litPorUnidad = (tipo === 'otros' && subcatActual?.capacidad_ml > 0)
    ? +(subcatActual.capacidad_ml / 1000).toFixed(3)
    : (capMap[tipo] || 19);
  const maxUnidades = isTote ? rest : Math.floor(rest / litPorUnidad);
  const litTotal = isTote ? (parseFloat(qty) || 0) : (parseInt(qty) || 0) * litPorUnidad;

  /* Auto-sugerir tapa cuando cambia la marca (si no hay override manual) */
  const tapaSugerida = marca ? tapaDefault[marca] : '';
  /* Si no hay tapa seleccionada, usar la sugerida */
  const tapaEfectiva = tapaKey || tapaSugerida || '';
  const tapaInfo = tapaEfectiva ? tapas[tapaEfectiva] : null;
  const stockTapaInsuf = usaTapa && tapaInfo && (tapaInfo.stock || 0) < (parseInt(qty) || 0);

  const handleSubmit = async () => {
    const q = isTote ? parseFloat(qty) : parseInt(qty);
    if (!q || q < (isTote ? 0.1 : 1)) return setError(isTote ? 'Litros debe ser > 0' : 'Cantidad debe ser >= 1');
    if (litTotal > rest + 0.5) return setError(`Solo quedan ${rest.toFixed(1)} L, estas intentando envasar ${litTotal.toFixed(1)} L`);
    /* TOTE indivisible: bloqueo de mezcla */
    if (isTote && haySublotesFinales) return setError('Este lote ya tiene envases finales — no se puede agregar TOTE');
    if (!isTote && haySublotesTote) return setError('Este lote ya tiene un TOTE activo — los envases finales se generan al re-envasar el TOTE en Terán');
    if (!isTote && !subKey) return setError(`Selecciona una marca de ${tipo} (no hay ${tipo} seleccionado)`);
    if (stockEnvaseInsuf) return setError(`Stock insuficiente de "${subcatActual.nombre}": tienes ${stockEnvase}, necesitas ${q}`);
    if (usaTapa && !tapaEfectiva && Object.keys(tapas).length > 0) return setError('Selecciona una tapa para cubetas');
    if (stockTapaInsuf) return setError(`Stock insuficiente de "${tapaInfo.nombre}": tienes ${tapaInfo.stock}, necesitas ${q}`);
    setSaving(true);
    setError('');
    try {
      const letra = String.fromCharCode(65 + (lote.sublotes || []).length);
      const cod = (lote.codigo || lote.codigoLote || lote.id) + '-' + letra;
      const litExact = +litTotal.toFixed(2);
      /* SUBLOTE v2: aliñado con la state machine canonizada.
         - claseSublote: discriminador 'envasado_final' | 'tote'
         - estado: 'envasado' (final) o 'tote_activo' (granel, mientras le queden litros)
         - litrosOriginal: capacidad total al crearse
         - litrosRestante: solo aplica a TOTE (decrementa al re-envasar);
           en envasado_final queda en 0 (se entrega completo)
         - qrPayload: URL pública /qr/<cod> que apuntará al landing
         - esHijoDe: null (este sublote nace directo del lote, no de un TOTE)
         - historial: trazabilidad granular por sublote */
      const sublote = {
        cod,
        /* Discriminador semántico (sublote.claseSublote — vive aparte del 'tipo' visual) */
        claseSublote: isTote ? 'tote' : 'envasado_final',
        /* Estado inicial canónico: TODO sublote nace en 'envasado' (listo para
           recolectar). El estado 'tote_activo' solo se aplica cuando Josué
           recibe el TOTE en Terán via escanearRecibirTeran (se resuelve auto).
           Antes el TOTE arrancaba en tote_activo y bloqueaba a Luis. */
        estado: 'envasado',
        /* Presentación física (mantener nombre para compat con dashboards viejos) */
        tipo,
        subKey: subKey || undefined,
        env: isTote
          ? `Tote ${q}L`
          : (subcatActual?.nombre || (tipo === 'cubeta' ? '19L Estandar' : tipo === 'galon' ? '3.785L' : '1L')),
        marca: marca || null,
        qty: isTote ? 1 : q,
        lit: litExact,
        litrosOriginal: litExact,
        litrosRestante: isTote ? litExact : 0,
        tapa: usaTapa ? (tapaInfo?.nombre || null) : null,
        tapaKey: usaTapa ? tapaEfectiva : null,
        ub: 'fabrica',
        esMerma: false,
        fase: isTote ? 1 : 2,
        esHijoDe: null,
        qrPayload: buildQrUrl(cod),
        historial: [{
          accion: 'crear',
          estadoNuevo: isTote ? 'tote_activo' : 'envasado',
          ts: new Date().toISOString(),
          usuario: userName || null,
        }],
      };
      /* FIX jun 2026: log explícito del payload para diagnóstico en consola
         si algo falla. El usuario puede abrir DevTools (F12) y ver el JSON
         exacto que se intentó enviar. */
      console.log('[ENVASADO] POST /api/envasado/registrar', { loteId: lote.id, sublote });
      const prevCods = new Set((lote.sublotes || []).map(s => s && s.cod).filter(Boolean));
      const r = await api.registrarEnvasado(lote.id, [sublote]);
      /* FIX jun 2026 (auditoría D4): usar el cod REAL asignado por el server
         para el QR impreso (puede reasignar letra por colisión/concurrencia —
         un QR impreso con cod de cliente stale no escaneaba). */
      const nuevos = (r?.lote?.sublotes || []).filter(s => s && s.cod && !prevCods.has(s.cod));
      onSuccess({ sublotes: nuevos.length > 0 ? nuevos : [sublote], lote: r?.lote || lote, isTote, q, tipo, litTotal });
    } catch (err) {
      /* FIX jun 2026: mostrar error completo + detalles del backend si vienen.
         Antes solo se mostraba "Datos inválidos" sin saber qué campo falló. */
      const baseMsg = err.message || 'Error al envasar';
      const detalles = err?.data?.detalles || err?.data?.errors || [];
      const fullMsg = Array.isArray(detalles) && detalles.length > 0
        ? `${baseMsg}\n\nCampos con problema:\n• ${detalles.slice(0, 5).join('\n• ')}`
        : baseMsg;
      console.error('[ENVASADO] Error:', err, 'data:', err?.data);
      setError(fullMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.sheetOverlay(isDesktop)} onClick={onClose}>
      <div className="lp-sheet" style={S.sheetBox(isDesktop)} onClick={e => e.stopPropagation()}>
        {!isDesktop && <div style={S.grab} />}
        {/* Header del sheet — mockup .sh-h/.sh-s: título + folio mono · producto
            · disponibles. (El step-bar Z8 se retiró: el mockup no lo trae y las
            secciones tituladas lo hacen redundante — ninguna acción se perdió.) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={S.shH}>
              Envasar lote
              {lote.esPrueba && <PruebaBadge size="sm" />}
            </div>
            <div style={S.shS}>
              <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--lp-brand-600)' }}>
                {lote.codigo || lote.codigoLote || lote.id}
              </span>
              {' '}· {lote.producto || lote.nombre} · {rest.toFixed(1)} L disponibles de {(lote.litrosTotal || 0).toFixed(1)} L
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-tertiary)', display: 'flex', padding: 4, flexShrink: 0 }} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div>
          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--lp-danger-100)',
              color: 'var(--lp-danger-600)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 12,
              whiteSpace: 'pre-line', /* respeta \n del mensaje multi-línea */
              lineHeight: 1.5,
              maxHeight: 200, overflowY: 'auto',
            }}>
              {error}
            </div>
          )}

          <div style={S.sec}>Presentación</div>
          {/* Mockup .presgrid/.pres: tarjetas fila (icono en tile + nombre +
             capacidad mono), 2 columnas. Auto-completar marca/tapa sigue igual
             al cambiar de tipo (efecto del setTipo). La regla TOTE-indivisible
             deshabilita las opciones incompatibles según lo ya envasado. */}
          <div style={S.presGrid}>
            {PRESENTACIONES_META.map(p => {
              const disabled = p.key === 'tote' ? haySublotesFinales : haySublotesTote;
              const active = tipo === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTipo(p.key)}
                  style={S.pres(active, disabled)}
                  title={p.key === 'tote' ? 'TOTE / Granel — contenedor para reenvasar en Terán' : `${p.nombre} (${p.cap})`}
                >
                  <span style={S.presIc}>{p.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={S.presN}>{p.nombre}</span>
                    <span style={S.presL}>{p.cap}{['cubeta', 'galon', 'litro'].includes(p.key) ? ' c/u' : ''}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {(haySublotesFinales || haySublotesTote) && (
            <div style={{
              padding: '9px 12px', marginTop: 10,
              background: 'var(--lp-info-50)', color: 'var(--lp-info-600)',
              borderRadius: 10, fontSize: 11, lineHeight: 1.5,
            }}>
              {haySublotesFinales
                ? 'Este lote ya tiene sublotes en envase final. No puedes agregar TOTE — un lote va completo en envases finales o completo en TOTE, no se mezcla.'
                : 'Este lote ya tiene un TOTE activo. Solo puedes seguir envasando en TOTE — los envases finales (cubeta/galón/litro) se generan al re-envasar el TOTE en Terán.'}
            </div>
          )}

          {!isTote && (
            <>
              <div style={S.sec}>
                Marca · {tipo === 'cubeta' ? 'cubeta' : tipo === 'galon' ? 'galón' : tipo === 'litro' ? 'litro' : 'envase'} a usar
              </div>
              {subcatList.length === 0 ? (
                <div style={{ padding: 10, background: 'var(--lp-warning-50)', borderRadius: 8, fontSize: 12, color: 'var(--lp-warning-700)', marginBottom: 12 }}>
                  No hay subcategorías de {tipo} registradas. Pídele a admin que las dé de alta.
                </div>
              ) : (
                /* Mockup .seg/.segb: pills segmentadas (selección oscura).
                   Mismo dominio que el viejo <select>: valorSubcat(s) → subKey. */
                <div style={S.seg}>
                  {subcatList.map(s => {
                    const on = marca === (s.marca || s.nombre);
                    const sinStock = s.stock <= 0;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        disabled={sinStock}
                        onClick={() => setMarca(s.marca || s.nombre)}
                        style={S.segb(on, sinStock)}
                        title={`${s.nombre} — stock ${s.stock}`}
                      >
                        {s.nombre}
                        <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11, opacity: .75 }}>
                          {sinStock ? 'sin stock' : s.stock}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {stockEnvaseInsuf && (
                <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: 'var(--lp-danger-600)' }}>
                  Stock insuficiente de "{subcatActual?.nombre}": tienes {stockEnvase}, pides {parseInt(qty) || 0}.
                </div>
              )}
            </>
          )}

          {usaTapa && Object.keys(tapas).length > 0 && (
            <>
              <div style={S.sec}>Tapa (cubeta requiere tapa)</div>
              {/* La marca AUTOCOMPLETA la tapa (chip "Auto" del mockup) y sigue
                 siendo editable eligiendo otra. Texto libre NO aplica: la tapa
                 debe existir en catálogo para validar y descontar stock. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
                {Object.entries(tapas).map(([k, t]) => {
                  const stock = t.stock || 0;
                  const cantidadActual = parseInt(qty) || 0;
                  const sinStock = stock <= 0;
                  const insuficiente = !sinStock && cantidadActual > 0 && stock < cantidadActual;
                  const isSelected = tapaEfectiva === k;
                  const isDefault = tapaSugerida === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTapaKey(k)}
                      disabled={sinStock}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
                        border: '1.5px solid ' + (isSelected ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'),
                        borderRadius: 12, minHeight: 44,
                        background: isSelected
                          ? 'color-mix(in srgb, var(--lp-brand-600) 8%, var(--lp-bg-raised))'
                          : (sinStock ? 'var(--lp-bg-sunken)' : 'var(--lp-bg-raised)'),
                        cursor: sinStock ? 'not-allowed' : 'pointer',
                        opacity: sinStock ? 0.5 : 1,
                        fontSize: 11, textAlign: 'left',
                        fontFamily: 'var(--lp-font-sans)',
                      }}
                      title={t.nombre + ' — stock: ' + stock}
                    >
                      <span style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: t.color || '#999',
                        border: '1.5px solid var(--lp-border-subtle)',
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--lp-text-primary)' }}>{t.color_nombre || t.nombre}</div>
                        <div style={{
                          fontSize: 11,
                          color: sinStock || insuficiente ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)',
                          fontFamily: 'var(--lp-font-mono)',
                          fontWeight: insuficiente ? 700 : 400,
                        }}>
                          {sinStock ? 'sin stock' : 'stock ' + stock}
                        </div>
                      </div>
                      {isDefault && !tapaKey && (
                        <span style={S.autochip}>Auto</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div style={S.sec}>{isTote ? 'Litros a envasar' : 'Cantidad'}</div>
          {isTote ? (
            /* TOTE = litros directos (regla indivisible: se sugiere todo el lote) */
            <input style={{ ...S.fieldInput, marginBottom: 0, fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 18, textAlign: 'center', height: 48 }}
              type="number" inputMode="decimal"
              min="0.1" step="0.1" max={maxUnidades}
              placeholder={`Ej: ${Math.min(rest, 1000).toFixed(0)}`}
              value={qty} onChange={e => setQty(e.target.value)} />
          ) : (
            /* Mockup .stepper2: − / valor mono 26 / + (el centro sigue siendo
               input editable para teclear directo) */
            <div style={S.stepper2}>
              <button type="button" aria-label="Menos"
                style={S.qbtn(maxUnidades < 1 || (parseInt(qty) || 0) <= 1)}
                disabled={maxUnidades < 1 || (parseInt(qty) || 0) <= 1}
                onClick={() => {
                  const cur = parseInt(qty) || 0;
                  setQty(String(Math.max(1, Math.min(Math.max(1, maxUnidades), cur - 1))));
                }}>−</button>
              <input className="lp-qval" style={S.qval} type="number" inputMode="numeric"
                min="1" step="1" max={maxUnidades}
                placeholder={`Ej: ${Math.min(maxUnidades, 30)}`}
                value={qty} onChange={e => setQty(e.target.value)} />
              <button type="button" aria-label="Más"
                style={S.qbtn(maxUnidades < 1 || (parseInt(qty) || 0) >= maxUnidades)}
                disabled={maxUnidades < 1 || (parseInt(qty) || 0) >= maxUnidades}
                onClick={() => {
                  const cur = parseInt(qty) || 0;
                  setQty(String(Math.max(1, Math.min(Math.max(1, maxUnidades), cur + 1))));
                }}>+</button>
            </div>
          )}
          {/* Cálculo visible: litros usados / restantes / máximo (mockup .qhint) */}
          <div style={S.qhint}>
            Usa <b style={S.qhintB}>{litTotal.toFixed(1)} L</b>
            {' '}· quedan <b style={{ ...S.qhintB, ...((rest - litTotal) < 0 ? { color: 'var(--lp-danger-600)' } : {}) }}>{(rest - litTotal).toFixed(1)} L</b>
            {' '}· máx <b style={S.qhintB}>{isTote ? `${maxUnidades.toFixed(0)} L` : maxUnidades}</b>
          </div>

          {/* Resumen — mockup .summary: "Generarás N <pres> de X L" + folio ·
             marca · litros en mono. Conserva los datos extra del ticket viejo
             (quedará en lote, tapa y tapas restantes) como filas compactas. */}
          {qty && parseFloat(qty) > 0 && (() => {
            const PLURAL = { cubeta: 'cubetas', galon: 'galones', litro: 'litros', otros: 'envases' };
            const n = parseInt(qty) || 0;
            const presNombre = PRESENTACIONES_META.find(p => p.key === tipo)?.nombre || tipo;
            return (
              <div style={S.summary}>
                <div style={S.summaryT}>
                  {isTote
                    ? `Generarás 1 TOTE granel de ${litTotal.toFixed(0)} L`
                    : `Generarás ${n} ${n === 1 ? presNombre.toLowerCase() : (PLURAL[tipo] || presNombre.toLowerCase() + 's')} de ${litPorUnidad} L`}
                </div>
                <div style={S.summaryS}>
                  {(lote.codigo || lote.codigoLote || lote.id)} · {isTote ? 'granel' : (subcatActual?.nombre || marca || 'sin marca')} · {litTotal.toFixed(1)} L
                </div>
                <div style={S.summaryRow}>
                  <span>Quedará en lote</span>
                  <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: (rest - litTotal) < 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)' }}>
                    {Math.max(0, rest - litTotal).toFixed(1)} L
                  </span>
                </div>
                {usaTapa && tapaInfo && (
                  <div style={S.summaryRow}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 11, height: 11, borderRadius: '50%', background: tapaInfo.color || '#999', border: '1px solid var(--lp-border-subtle)' }} />
                      Tapa {tapaInfo.color_nombre || tapaInfo.nombre} · restantes
                    </span>
                    <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: stockTapaInsuf ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)' }}>
                      {Math.max(0, (tapaInfo.stock || 0) - parseInt(qty))}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        {/* Acciones — mockup .sh-acts: Cancelar ghost + "Generar sublotes" primary */}
        <div style={S.shActs}>
          <button style={S.btnSheetGhost} onClick={onClose}>Cancelar</button>
          <button className="lp-btn-acc" style={S.btnSheetPrimary(saving)} disabled={saving} onClick={handleSubmit}>
            {saving ? 'Envasando…' : 'Generar sublotes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* REENVASADO MODAL — re-envasar desde tote (puede tardar días)       */
/* Usa la state machine: transicionSublote(toteCod, 'reenvasarTote')  */
/* El backend crea sublotes hijo con esHijoDe=toteCod y decrementa    */
/* litrosRestante del TOTE. Si el TOTE se vacía pasa a tote_vaciado.  */
/* ═══════════════════════════════════════════════════════════════════ */
export function ReenvasadoModal({ lote, envases, userName, onClose, onSuccess, toteInicial }) {
  useBodyScrollLock(); /* FIX jun 2026: sin scroll-bleed al body en móvil */
  /* toteInicial (jun 2026): preselecciona un TOTE específico — lo usa el buffer
     de Recepción Terán (que reemplazó su modal local por éste, censo dedup). */
  const sublotes = lote.sublotes || [];
  /* TOTEs candidatos = sublotes con estado tote_activo y litrosRestante > 0.
     Compat: viejos sublotes sin estado se infieren por tipo==='tote' */
  const totes = sublotes.filter(s => {
    const esTote = s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1;
    if (!esTote) return false;
    if (s.consumido) return false;
    if (s.estado === 'tote_vaciado' || s.estado === 'cancelado') return false;
    /* Si tiene litrosRestante explícito úsalo; si no, calcula desde hijos */
    if (typeof s.litrosRestante === 'number') return s.litrosRestante > 0.5;
    return true;
  });
  const [selectedTote, setSelectedTote] = useState(
    (toteInicial && totes.some(t => t.cod === toteInicial)) ? toteInicial : (totes[0]?.cod || '')
  );
  const [tipo, setTipo] = useState('cubeta');
  const [marca, setMarca] = useState('');
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  /* Sheet responsive (mockup) — solo presentación, payload/SM intactos */
  const isDesktop = useIsDesktop();
  useEffect(() => { injectSheetCSS(); }, []);

  const marcas = envases?.marcas || [];
  const tote = totes.find(t => t.cod === selectedTote);
  /* litros disponibles: preferir el campo explícito del state machine,
     fallback al cálculo legacy por hijos */
  const litDisponible = (() => {
    if (!tote) return 0;
    if (typeof tote.litrosRestante === 'number') return tote.litrosRestante;
    const litUsed = sublotes
      .filter(s => (s.fromTote === selectedTote || s.esHijoDe === selectedTote) && !s.esMerma)
      .reduce((a, s) => a + (Number(s.lit) || 0), 0);
    return Math.max(0, (Number(tote.lit) || 0) - litUsed);
  })();

  const capMap = { cubeta: 19, galon: 3.785, litro: 1 };
  const litPorUnidad = capMap[tipo] || 19;
  const maxUnidades = Math.floor(litDisponible / litPorUnidad);
  const litTotal = (parseInt(qty) || 0) * litPorUnidad;

  /* FIX jun 2026 (auditoría D6): resolver subKey/tapaKey para que el backend
     VALIDE y DESCUENTE envases/tapas — el reenvase consume envases físicos
     (antes este camino no descontaba nada). Tapa solo para cubeta (default
     por marca, mismo patrón que EnvasadoModal). */
  const subcatReenv = (() => {
    const cat = envases?.categorias?.[tipo];
    if (!cat?.subcategorias) return null;
    const entries = Object.entries(cat.subcategorias).map(([k, v]) => ({ key: k, nombre: v.nombre, marca: v.marca, stock: v.stock || 0 }));
    return entries.find(s => (s.marca || s.nombre) === marca) || null;
  })();
  const tapaKeyReenv = (tipo === 'cubeta' && marca && envases?.tapa_default) ? (envases.tapa_default[marca] || null) : null;

  const handleSubmit = async () => {
    const q = parseInt(qty);
    if (!q || q < 1) return setError('Cantidad debe ser >= 1');
    if (litTotal > litDisponible + 0.5) return setError(`Solo quedan ${litDisponible.toFixed(1)} L en tote`);
    if (!selectedTote) return setError('Selecciona un tote');
    setSaving(true);
    setError('');
    try {
      const letraBase = sublotes.length;
      const cod = (lote.codigo || lote.codigoLote || lote.id) + '-' + String.fromCharCode(65 + letraBase);
      const litExact = +litTotal.toFixed(2);
      /* Para detectar los cods REALES que asigne el server (puede renombrar
         por colisión — el QR impreso debe ser el de la BD, auditoría D4). */
      const prevCods = new Set(sublotes.map(s => s && s.cod).filter(Boolean));
      /* Hijo de TOTE. NOTA (jun 2026): ya NO mandamos `estado` — el backend lo
         deriva de la ubicación física del TOTE (fábrica→'envasado', Terán→
         'en_stock_teran'). Mandar estado desde el cliente causaba la regresión
         Josué→Luis (hijos 'envasado' reaparecían en "Voy por él"). */
      const subloteHijo = {
        cod,
        claseSublote: 'envasado_final',
        tipo,
        env: tipo === 'cubeta' ? '19L Estandar' : tipo === 'galon' ? '3.785L' : '1L',
        marca: marca || null,
        qty: q,
        lit: litExact,
        litrosOriginal: litExact,
        litrosRestante: 0,
        subKey: subcatReenv?.key || null,
        tapaKey: tapaKeyReenv,
        tapa: tapaKeyReenv ? (envases?.tapas?.[tapaKeyReenv]?.nombre || null) : null,
        esMerma: false,
        fase: 2,
        esHijoDe: selectedTote,
        /* Backward compat con dashboards viejos */
        fromTote: selectedTote,
        qrPayload: buildQrUrl(cod),
        historial: [{
          accion: 'reenvasarTote',
          estadoNuevo: 'envasado',
          ts: new Date().toISOString(),
          usuario: userName || null,
          desdeTote: selectedTote,
        }],
      };
      /* Usar la state machine: el backend valida tote_activo + crea hijos + decrementa */
      const r = await api.transicionSublote(selectedTote, 'reenvasarTote', {
        nuevosSublotes: [subloteHijo],
        litrosConsumidos: litExact,
        /* lugar derivado de la ubicación física del TOTE (el server lo re-deriva
           igual, pero dejamos el contrato explícito). */
        lugar: (tote?.ub === 'teran') ? 'teran' : 'fabrica',
      });
      /* FIX jun 2026 (auditoría D4): imprimir el cod REAL del server — puede
         renombrar por colisión; el QR impreso con cod de cliente no escaneaba. */
      const hijosReales = (r?.lote?.sublotes || []).filter(s => s && s.cod && !prevCods.has(s.cod));
      onSuccess({
        sublotes: hijosReales.length > 0 ? hijosReales : [subloteHijo],
        lote: r?.lote || lote,
        isTote: false,
        q,
        tipo,
        litTotal: litExact,
        desdeTote: selectedTote,
      });
    } catch (err) {
      setError(err.message || 'Error al re-envasar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.sheetOverlay(isDesktop)} onClick={onClose}>
      <div className="lp-sheet" style={S.sheetBox(isDesktop)} onClick={e => e.stopPropagation()}>
        {!isDesktop && <div style={S.grab} />}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={S.shH}>Re-envasar desde tote</div>
            <div style={S.shS}>
              <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--lp-granel-600)' }}>
                {lote.codigo || lote.codigoLote || lote.id}
              </span>
              {' '}· {lote.producto || lote.nombre}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-tertiary)', display: 'flex', padding: 4, flexShrink: 0 }} aria-label="Cerrar">{Icon.x({ s: 18 })}</button>
        </div>
        <div>
          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 8, fontSize: 12, fontWeight: 600, margin: '12px 0' }}>
              {error}
            </div>
          )}

          {totes.length > 1 && (
            <>
              <div style={S.sec}>Tote origen</div>
              <select style={S.fieldSelect} value={selectedTote} onChange={e => setSelectedTote(e.target.value)}>
                {totes.map(t => (
                  <option key={t.cod} value={t.cod}>{t.cod} — {t.lit}L</option>
                ))}
              </select>
            </>
          )}

          {tote && (
            <div style={{ padding: '10px 12px', background: 'var(--lp-granel-50)', borderRadius: 12, margin: '12px 0', fontSize: 12, color: 'var(--lp-granel-700)' }}>
              Tote <strong style={{ fontFamily: 'var(--lp-font-mono)' }}>{selectedTote}</strong>
              {' '}· Disponible: <strong style={{ fontFamily: 'var(--lp-font-mono)' }}>{litDisponible.toFixed(1)} L</strong> de {tote.lit}L
            </div>
          )}

          {/* Mockup .seg: presentación retail segmentada (sin TOTE — un tote
             no se re-envasa en otro tote) */}
          <div style={S.sec}>Presentación retail</div>
          <div style={S.seg}>
            {[['cubeta', 'Cubeta 19L'], ['galon', 'Galón 3.785L'], ['litro', 'Litro 1L']].map(([k, lbl]) => (
              <button key={k} type="button" style={S.segb(tipo === k, false)} onClick={() => setTipo(k)}>
                {lbl}
              </button>
            ))}
          </div>

          <div style={S.sec}>Marca (opcional)</div>
          {marcas.length > 0 ? (
            <select style={{ ...S.fieldSelect, marginBottom: 0 }} value={marca} onChange={e => setMarca(e.target.value)}>
              <option value="">— Sin marca —</option>
              {marcas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input style={{ ...S.fieldInput, marginBottom: 0 }} placeholder="Ej: Premium" value={marca} onChange={e => setMarca(e.target.value)} />
          )}

          <div style={S.sec}>Cantidad</div>
          <div style={S.stepper2}>
            <button type="button" aria-label="Menos"
              style={S.qbtn(maxUnidades < 1 || (parseInt(qty) || 0) <= 1)}
              disabled={maxUnidades < 1 || (parseInt(qty) || 0) <= 1}
              onClick={() => {
                const cur = parseInt(qty) || 0;
                setQty(String(Math.max(1, Math.min(Math.max(1, maxUnidades), cur - 1))));
              }}>−</button>
            <input className="lp-qval" style={S.qval} type="number" inputMode="numeric"
              min="1" step="1" max={maxUnidades}
              placeholder={`Ej: ${Math.min(maxUnidades, 20)}`}
              value={qty} onChange={e => setQty(e.target.value)} />
            <button type="button" aria-label="Más"
              style={S.qbtn(maxUnidades < 1 || (parseInt(qty) || 0) >= maxUnidades)}
              disabled={maxUnidades < 1 || (parseInt(qty) || 0) >= maxUnidades}
              onClick={() => {
                const cur = parseInt(qty) || 0;
                setQty(String(Math.max(1, Math.min(Math.max(1, maxUnidades), cur + 1))));
              }}>+</button>
          </div>
          <div style={S.qhint}>
            Usa <b style={S.qhintB}>{litTotal.toFixed(1)} L</b>
            {' '}· quedan en tote <b style={{ ...S.qhintB, ...((litDisponible - litTotal) < 0 ? { color: 'var(--lp-danger-600)' } : {}) }}>{Math.max(0, litDisponible - litTotal).toFixed(1)} L</b>
            {' '}· máx <b style={S.qhintB}>{maxUnidades}</b>
          </div>

          {qty && parseInt(qty) > 0 && (() => {
            const restanteTrasReenv = Math.max(0, litDisponible - litTotal);
            const remanenteMenorUnLitro = restanteTrasReenv > 0.01 && restanteTrasReenv < 1;
            /* DECISIÓN OWNER 10 jun 2026 (revierte la auto-merma): el remanente
               <1L ya NO se merma solo — el TOTE queda activo y el cierre es
               manual con la acción "Vaciar TOTE (merma)" de admin/técnico. */
            if (!remanenteMenorUnLitro && restanteTrasReenv > 0.01) return null;
            return (
              <div style={{ fontSize: 12, padding: '10px 12px', background: 'var(--lp-bg-sunken)', borderRadius: 12, marginTop: 10 }}>
                {remanenteMenorUnLitro && (
                  <div style={{ color: 'var(--lp-warning-700)', fontWeight: 600 }}>
                    Quedarán {restanteTrasReenv.toFixed(2)} L en el TOTE. El lote seguirá
                    activo — ciérralo cuando decidas con "Vaciar TOTE (merma)".
                  </div>
                )}
                {restanteTrasReenv <= 0.01 && (
                  <div style={{ color: 'var(--lp-brand-700)', fontWeight: 600 }}>
                    El TOTE quedará completamente vaciado.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        <div style={S.shActs}>
          <button style={S.btnSheetGhost} onClick={onClose}>Cancelar</button>
          <button className="lp-btn-acc" style={{ ...S.btnSheetPrimary(saving), background: 'var(--lp-reenvase-600)' }} disabled={saving} onClick={handleSubmit}>
            {saving ? 'Re-envasando…' : `Re-envasar ${qty || 0} ${tipo}(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* SUBLOTE QR PRINT MODAL                                             */
/* Aparece automáticamente al crear un sublote (envasado o re-envase).*/
/* Permite imprimir uno o varios tickets con el QR ya generado y      */
/* asignado al sublote — para pegarlo físicamente al envase.           */
/* ═══════════════════════════════════════════════════════════════════ */
export function SubloteQRPrintModal({ payload, onClose }) {
  const { sublotes = [], lote, isTote, q, tipo, litTotal, desdeTote } = payload || {};
  const sublote = sublotes[0];
  const cantidadDefault = sublote ? (isTote ? 1 : Number(sublote.qty) || 1) : 1;
  const [copias, setCopias] = useState(cantidadDefault);
  const [formato, setFormato] = useState(isTote ? '80x50' : '50x40');

  if (!sublote) return null;

  const FMT = [
    { v: '50x40', label: '50×40 mm (rollo térmico)', wMm: 50, hMm: 40, qrMm: 22 },
    { v: '60x40', label: '60×40 mm (rollo térmico)', wMm: 60, hMm: 40, qrMm: 24 },
    { v: '80x50', label: '80×50 mm (rollo térmico)', wMm: 80, hMm: 50, qrMm: 32 },
    { v: '100x70', label: '100×70 mm (rollo grande)', wMm: 100, hMm: 70, qrMm: 42 },
    { v: 'A4-21', label: 'A4 · 21 etiquetas (3×7)', wMm: 70, hMm: 42.3, qrMm: 24, isSheet: true, cols: 3, rows: 7 },
    { v: 'A4-24', label: 'A4 · 24 etiquetas (3×8)', wMm: 70, hMm: 37, qrMm: 22, isSheet: true, cols: 3, rows: 8 },
  ];
  const fmt = FMT.find(f => f.v === formato) || FMT[0];

  const qrUrl = sublote.qrPayload || buildQrUrl(sublote.cod);
  /* QR generado LOCAL — sin depender de quickchart.io u otro servicio externo.
     Esto resuelve el bug de "QR no carga" y permite imprimir offline. */
  const qrUrlPreview = qrDataUrl(qrUrl, { scale: 8, margin: 2, ecLevel: 'M' });
  const qrUrlPrint = qrDataUrl(qrUrl, { scale: 10, margin: 2, ecLevel: 'M' });

  const producto = (lote?.producto || lote?.nombre || '').slice(0, 40);
  const fecha = new Date().toISOString().slice(0, 10);
  const presentacion = sublote.env || tipo || '';
  const marca = sublote.marca || '';

  const imprimir = () => {
    const n = Math.max(1, Math.min(999, parseInt(copias) || 1));
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) { alert('Habilita popups para imprimir'); return; }
    const prodSafe = producto.replace(/</g, '&lt;');
    const marcaSafe = marca.replace(/</g, '&lt;');
    const presSafe = presentacion.replace(/</g, '&lt;');

    let html;
    if (fmt.isSheet) {
      const total = fmt.cols * fmt.rows;
      let labels = '';
      for (let i = 0; i < n; i++) {
        labels += `<div class="cell">
          <img src="${qrUrlPrint}" />
          <div class="info">
            <div class="prod">${prodSafe}</div>
            <div class="pres">${presSafe}${marcaSafe ? ' · ' + marcaSafe : ''}</div>
            <div class="cod">${sublote.cod}</div>
            <div class="meta">${fecha} · ${i + 1}/${n}</div>
          </div>
        </div>`;
        if ((i + 1) % total === 0 && i + 1 < n) labels += '<div class="page-break"></div>';
      }
      html = `<!DOCTYPE html><html><head><title>QR ${sublote.cod} (${n})</title>
        <style>
          @page { size: A4; margin: 5mm; }
          body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
          .grid { display: grid; grid-template-columns: repeat(${fmt.cols}, 1fr); gap: 0; }
          .cell { width: ${fmt.wMm}mm; height: ${fmt.hMm}mm; border: 0.3mm dashed #ccc;
                  box-sizing: border-box; padding: 2mm; display: flex; align-items: center;
                  gap: 2mm; page-break-inside: avoid; }
          .cell img { width: ${fmt.qrMm}mm; height: ${fmt.qrMm}mm; }
          .info { flex: 1; min-width: 0; font-size: 7pt; line-height: 1.25; }
          .prod { font-weight: bold; font-size: 8pt; overflow: hidden;
                  text-overflow: ellipsis; white-space: nowrap; }
          .pres { font-size: 7pt; color: #444; }
          .cod { font-family: monospace; font-weight: bold; font-size: 7pt; margin-top: 1mm; }
          .meta { color: #666; font-size: 6pt; }
          .page-break { break-after: page; flex-basis: 100%; }
          @media print { .cell { border: none; } }
        </style></head><body>
        <div class="grid">${labels}</div>
        <script>setTimeout(() => window.print(), 400);</script>
        </body></html>`;
    } else {
      let labels = '';
      for (let i = 0; i < n; i++) {
        labels += `<div class="ticket">
          <img src="${qrUrlPrint}" />
          <div class="info">
            <div class="prod">${prodSafe}</div>
            <div class="pres">${presSafe}${marcaSafe ? ' · ' + marcaSafe : ''}</div>
            <div class="cod">${sublote.cod}</div>
            <div class="meta">${fecha}${n > 1 ? ' · ' + (i + 1) + '/' + n : ''}</div>
          </div>
        </div>`;
      }
      html = `<!DOCTYPE html><html><head><title>QR ${sublote.cod} (${n})</title>
        <style>
          @page { size: ${fmt.wMm}mm ${fmt.hMm}mm; margin: 0; }
          body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
          .ticket { width: ${fmt.wMm}mm; height: ${fmt.hMm}mm; box-sizing: border-box;
                    padding: 2mm; display: flex; align-items: center; gap: 2mm;
                    page-break-after: always; }
          .ticket:last-child { page-break-after: auto; }
          .ticket img { width: ${fmt.qrMm}mm; height: ${fmt.qrMm}mm; }
          .info { flex: 1; min-width: 0; line-height: 1.3; }
          .prod { font-weight: bold; font-size: 9pt; overflow: hidden;
                  text-overflow: ellipsis; white-space: nowrap; }
          .pres { font-size: 7pt; color: #444; margin: 1mm 0; }
          .cod { font-family: monospace; font-weight: bold; font-size: 8pt; }
          .meta { color: #666; font-size: 6pt; margin-top: 1mm; }
        </style></head><body>
        ${labels}
        <script>setTimeout(() => window.print(), 400);</script>
        </body></html>`;
    }
    w.document.write(html);
    w.document.close();
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ ...S.modalHeader, borderBottom: '3px solid var(--lp-success-500)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>QR del sublote — imprimir</div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
              Pega este QR físicamente en cada envase para trazabilidad
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-tertiary)', display: 'flex', padding: 4 }} aria-label="Cerrar">{Icon.x({ s: 18 })}</button>
        </div>
        <div style={S.modalBody}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
            padding: 16, marginBottom: 16,
          }}>
            <img src={qrUrlPreview} alt={`QR ${sublote.cod}`}
              style={{ width: 180, height: 180, background: 'var(--lp-bg-raised)',
                       border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6 }} />
            <div style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 13, fontWeight: 700,
                          marginTop: 10, textAlign: 'center', wordBreak: 'break-all' }}>
              {sublote.cod}
            </div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4,
                          lineHeight: 1.5, textAlign: 'center' }}>
              {producto}<br/>
              {isTote
                ? <>TOTE granel · <strong>{litTotal?.toFixed(1)} L</strong></>
                : <>{q} × {presentacion} · <strong>{litTotal?.toFixed(1)} L</strong></>
              }
              {desdeTote && <><br/>↳ re-envasado desde tote {desdeTote}</>}
            </div>
          </div>

          <label style={S.fieldLabel}>Cantidad de tickets</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {[1, cantidadDefault, 10, 50].filter((n, i, a) => n > 0 && a.indexOf(n) === i).map(n => (
              <button key={n} type="button"
                style={{
                  padding: '5px 10px', fontSize: 11, fontWeight: 600,
                  borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: copias === n ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)',
                  color: copias === n ? '#fff' : 'var(--lp-text-secondary)',
                  fontFamily: 'var(--lp-font-sans)',
                }}
                onClick={() => setCopias(n)}>
                {n === cantidadDefault && !isTote ? `${n} (todos)` : n}
              </button>
            ))}
          </div>
          <input style={S.fieldInput} type="number" inputMode="decimal" min="1" max="999"
            value={copias}
            onChange={e => setCopias(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))} />

          <label style={S.fieldLabel}>Formato</label>
          <select style={S.fieldSelect} value={formato} onChange={e => setFormato(e.target.value)}>
            <optgroup label="Rollo térmico">
              {FMT.filter(f => !f.isSheet).map(f => <option key={f.v} value={f.v}>{f.label}</option>)}
            </optgroup>
            <optgroup label="Hoja A4">
              {FMT.filter(f => f.isSheet).map(f => <option key={f.v} value={f.v}>{f.label}</option>)}
            </optgroup>
          </select>

          <div style={{
            fontSize: 11, color: 'var(--lp-text-tertiary)', lineHeight: 1.6,
            padding: '8px 10px', background: 'var(--lp-info-50)', borderRadius: 'var(--lp-radius-sm)',
          }}>
            Al escanear cualquier ticket de este sublote, Luis (recolección) o Josué (Terán)
            pueden registrar las transiciones de estado correspondientes. El QR contiene la URL
            <code style={{ marginLeft: 4, fontFamily: 'var(--lp-font-mono)' }}>{qrUrl}</code>.
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Más tarde</button>
          <button style={S.btnPrimary} onClick={imprimir}>
            Imprimir {copias} ticket{copias > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* ACCIONES POR LOTE — descriptor único reutilizado por card y tabla   */
/* §8 gating:                                                          */
/*   · Envasar / Cerrar / Re-envasar = canEnvasar (admin/tecnico/almacen) */
/*   · Enviar a recolectar / Transferir a Terán = canTransfer (almacen,admin) */
/*   · Eliminar prueba = isAdmin                                       */
/* data-id/data-rol mapean a los handlers reales (sin cambiar lógica). */
/* ═══════════════════════════════════════════════════════════════════ */
function buildLoteAcciones(lote, ctx) {
  const { canEnvasar, canTransfer, isAdmin, onEnvasar, onCerrar, onTransferir,
    onReenvasar, onEnviarRecolectar, onIrQC, onReenvasarTote, onEliminarPrueba } = ctx;
  const total = Number(lote.litrosTotal) || 0;
  const rest = Math.max(0, total - litUsed(lote));
  const envSt = envEstado(lote);
  const sublotes = lote.sublotes || [];
  const enFabrica = sublotes.filter(s => s.ub === 'fabrica' && !s.esMerma);
  /* FIX jun 2026 (auditoría D3): solo TOTEs en 'tote_activo' son reenvasables
     — la SM exige desde:['tote_activo']. Un TOTE recién envasado en fábrica
     (estado 'envasado') mostraba el botón y daba 409 SIEMPRE. */
  const totesSinConsumir = sublotes.filter(s =>
    (s.tipo === 'tote' || s.fase === 1 || s.claseSublote === 'tote') &&
    !s.consumido && s.estado === 'tote_activo');
  const haySublotesEnvasados = sublotes.some(s => s.estado === 'envasado' && !s.esMerma);

  const acciones = [];
  /* QC retenido — bloqueante (canEnvasar) */
  if (canEnvasar && lote.estado === 'qc_hold') {
    acciones.push({ key: 'qc-hold', label: 'QC retenido', icon: Icon.qcHold, kind: 'danger',
      dataId: 'stock.btn.qc-hold', dataRol: 'tecnico,almacen,admin',
      title: 'QC retenido — reabrir producción o reaprobar', onClick: () => onIrQC && onIrQC(lote) });
  }
  /* Envasar — acción primaria */
  if (canEnvasar && envSt !== 'envasado' && rest > 0 && lote.estado !== 'qc_hold') {
    acciones.push({ key: 'envasar', label: 'Envasar', icon: Icon.envasar, kind: 'primary',
      dataId: 'stock.btn.envasar', dataRol: 'tecnico,almacen,admin',
      onClick: () => onEnvasar(lote) });
  }
  /* Enviar a recolectar — §8 almacen,admin. FIX jun 2026 (auditoría #8):
     +'en_proceso' para no perder el botón tras un despacho parcial. */
  if (canTransfer && (lote.estado === 'envasado' || lote.estado === 'en_proceso') && haySublotesEnvasados && onEnviarRecolectar) {
    acciones.push({ key: 'recolectar', label: 'Enviar a recolectar', icon: Icon.truck, kind: 'success',
      dataId: 'stock.btn.enviar-recolectar', dataRol: 'almacen,admin',
      title: 'Marcar listos para recolectar — Luis recibe notificación',
      onClick: () => onEnviarRecolectar(lote) });
  }
  /* QC opcional (producido) */
  if (canEnvasar && lote.estado === 'producido') {
    acciones.push({ key: 'qc-opc', label: 'QC (opcional)', icon: null, kind: 'ghost',
      dataId: 'stock.btn.qc-opcional', dataRol: 'tecnico,almacen,admin',
      title: 'QC es opcional. Hacer QC formal antes de envasar (recomendado para auditoría).',
      onClick: () => onIrQC && onIrQC(lote) });
  }
  /* Cerrar con merma (parcial) */
  if (canEnvasar && envSt === 'parcial') {
    acciones.push({ key: 'cerrar', label: 'Cerrar (merma)', icon: null, kind: 'warn',
      dataId: 'stock.btn.cerrar-merma', dataRol: 'tecnico,almacen,admin',
      onClick: () => onCerrar(lote) });
  }
  /* jun 2026 (decisión owner): se ELIMINA "Transferir a Terán". Era un camino
     paralelo que movía el sublote a Terán brincándose el flujo Luis→Josué:
     hacía "desaparecer" el lote de Stock Fábrica sin avisar a dónde iba y
     confundía. El producto llega a Terán SOLO cuando Josué lo RECIBE por
     escaneo (escanearRecibirTeran). El camino canónico es:
       envasado → "Enviar a recolectar" → Luis recoge → Josué escanea/recibe.
     (El endpoint /api/envasado/transferir se conserva por compat, sin botón.) */
  /* Re-envasar TOTE — NO es "envasar inicial": roles SM reenvasarTote =
     almacen/tecnico/admin. Josué (almacen) lo conserva vía canTransfer aunque
     ya no pueda envasar. */
  if ((canEnvasar || canTransfer) && totesSinConsumir.length > 0 && (lote.estado === 'en_almacen' || lote.estado === 'envasado')) {
    acciones.push({ key: 'reenvasar', label: 'Re-envasar tote', icon: null, kind: 'tote',
      dataId: 'stock.btn.reenvasar-tote', dataRol: 'tecnico,almacen,admin',
      onClick: () => onReenvasarTote(lote) });
  }
  /* Eliminar prueba — solo admin y solo si es prueba */
  if (isAdmin && lote.esPrueba && onEliminarPrueba) {
    acciones.push({ key: 'eliminar', label: 'Eliminar prueba', icon: Icon.trash, kind: 'danger',
      dataId: 'stock.btn.eliminar-prueba', dataRol: 'admin',
      title: 'Eliminar permanentemente este lote de prueba',
      onClick: () => onEliminarPrueba(lote) });
  }
  return acciones;
}

/* Estilo del botón de acción según `kind` (móvil 40px / escritorio 36px) */
function accionStyle(kind, compact) {
  const base = compact ? S.btnTablePrimary : S.btnPrimary;
  const ghost = compact ? S.btnGhost : { ...S.btnPrimary, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', border: '1.5px solid var(--lp-border-subtle)' };
  switch (kind) {
    case 'success': return { ...base, background: 'var(--lp-success-600)' };
    case 'warn':    return { ...base, background: 'var(--lp-warning-600)' };
    case 'danger':  return { ...base, background: 'var(--lp-danger-600)' };
    case 'tote':    return { ...base, background: 'var(--lp-reenvase-600)' };
    case 'ghost':   return ghost;
    default:        return base;
  }
}

/* ═══════════════════════════════════════════════════════════════════ */
/* SUBLOTES — lista expandible compartida (card + tabla)              */
/* Conserva estado computado (tote/granel/retail/merma), litros        */
/* restantes en tote, ubicación (fábrica/terán) y botón Anular.        */
/* §8: Anular = almacen,admin (canAnular).                             */
/* ═══════════════════════════════════════════════════════════════════ */
function SublotesList({ lote, sublotes, canAnular, onAnularSublote }) {
  return (
    <div style={{ marginTop: 6 }}>
      {sublotes.map((s, i) => {
        const isTote = s.tipo === 'tote' || s.fase === 1 || s.claseSublote === 'tote';
        const desdeTote = s.fromTote || s.esHijoDe;
        const hijosDelTote = isTote ? sublotes.filter(h => h.fromTote === s.cod || h.esHijoDe === s.cod) : [];
        const litHijos = hijosDelTote.reduce((a, h) => a + (Number(h.lit) || 0), 0);
        const litRestTote = isTote ? Math.max(0, (Number(s.lit) || 0) - litHijos) : 0;
        return (
          <div key={i} style={{
            ...S.sublote,
            background: s.esMerma ? 'var(--lp-danger-50)' : isTote ? 'var(--lp-granel-50)' : s.ub === 'teran' ? 'var(--lp-success-50)' : 'var(--lp-bg-raised)',
            marginLeft: desdeTote ? 16 : 0,
            borderLeft: desdeTote ? '3px solid var(--lp-retail-600)' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {desdeTote && <span style={{ fontSize: 11, color: 'var(--lp-retail-600)' }}>↳</span>}
              <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 600, fontSize: 11 }}>{s.cod}</span>
              {s.esMerma && <span style={B('var(--lp-danger-100)', 'var(--lp-danger-600)')}>MERMA</span>}
              {isTote && <span style={B('var(--lp-granel-50)', 'var(--lp-granel-600)')}>Granel</span>}
              {s.fase === 2 && desdeTote && <span style={B('var(--lp-retail-50)', 'var(--lp-retail-600)')}>Retail</span>}
              {s.consumido && <span style={B('var(--lp-success-50)', 'var(--lp-success-700)')}>Consumido</span>}
            </div>
            <div style={{ fontSize: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600 }}>{isTote ? 'Tote' : `${s.qty} ${s.tipo}`}</span>
                <span style={{ color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }}>{s.lit}L</span>
                {s.marca && <span style={{ color: 'var(--lp-text-tertiary)' }}>{s.marca}</span>}
                <span style={B(
                  s.ub === 'teran' ? 'var(--lp-success-100)' : 'var(--lp-brand-100)',
                  s.ub === 'teran' ? 'var(--lp-success-600)' : 'var(--lp-brand-700)',
                )}>{s.ub === 'teran' ? 'Terán' : 'Fábrica'}</span>
              </div>
              {isTote && hijosDelTote.length > 0 && (
                <div style={{ color: 'var(--lp-text-tertiary)', fontSize: 10, marginTop: 2, textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>
                  {litHijos.toFixed(0)}L reenvasado → {litRestTote.toFixed(0)}L pendiente en tote
                </div>
              )}
              {desdeTote && (
                <div style={{ color: 'var(--lp-retail-600)', fontSize: 10, marginTop: 2, textAlign: 'right' }}>
                  ↳ reenvasado desde tote {desdeTote}
                </div>
              )}
              {s.fecha && (
                <div style={{ color: 'var(--lp-text-tertiary)', fontSize: 10, marginTop: 1, textAlign: 'right' }}>
                  {s.fecha.slice(0, 10)} {s.fecha.slice(11, 16)} · {s.usuario || ''}
                </div>
              )}
              {/* Sprint G-1: Anular sublote mal capturado. §8: almacen,admin.
                 Solo si NO está en Terán, NO es merma, NO cancelado y sin hijos.
                 FIX jun 2026 (auditoría D13): solo estados que la SM acepta
                 (envasado/en_recoleccion) — en_camino mostraba botón → 409. */}
              {onAnularSublote && canAnular && !s.esMerma && !s.cancelado
                && ['envasado', 'en_recoleccion'].includes(s.estado)
                && s.ub !== 'teran' && hijosDelTote.length === 0 && (
                <div style={{ marginTop: 4, textAlign: 'right' }}>
                  <button
                    data-id="stock.btn.anular-sublote" data-rol="almacen,admin"
                    onClick={() => onAnularSublote(lote, s)}
                    style={{
                      padding: '4px 10px', fontSize: 10, fontWeight: 600, minHeight: 28,
                      background: 'transparent', color: 'var(--lp-danger-600)',
                      border: '1px solid var(--lp-danger-300, rgba(220,38,38,0.3))',
                      borderRadius: 6, cursor: 'pointer',
                    }}
                    title="Anular sublote (reponer envase/tapa al stock)"
                  >Anular</button>
                </div>
              )}
              {s.cancelado && (
                <div style={{ color: 'var(--lp-danger-600)', fontSize: 10, marginTop: 2, textAlign: 'right', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  {Icon.x({ s: 10 })} Anulado{s.motivoAnulacion ? ` — ${s.motivoAnulacion}` : ''}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* LOTE CARD (móvil) — card limpia con barra de progreso + sublotes    */
/* ═══════════════════════════════════════════════════════════════════ */
function LoteCard({ lote, canEnvasar, canTransfer, canAnular, isAdmin, onEnvasar, onCerrar, onTransferir, onReenvasar, onEnviarRecolectar, onQR, onEliminarPrueba, onIrQC, onAnularSublote, autoExpand }) {
  const [showSublotes, setShowSublotes] = useState(!!autoExpand);
  const est = ESTADO_MAP[lote.estado] || { label: lote.estado, bg: 'var(--lp-bg-sunken)', fg: 'var(--lp-text-tertiary)' };
  const total = Number(lote.litrosTotal) || 0;
  const used = litUsed(lote);
  const rest = Math.max(0, total - used);
  const pct = total > 0 ? (used / total) * 100 : 0;
  const sublotes = lote.sublotes || [];
  const hasTotes = sublotes.some(s => s.tipo === 'tote' || s.fase === 1);

  const acciones = buildLoteAcciones(lote, {
    canEnvasar, canTransfer, isAdmin, onEnvasar, onCerrar, onTransferir,
    onEnviarRecolectar, onIrQC, onReenvasarTote: onReenvasar, onEliminarPrueba,
  });

  const envSt = envEstado(lote);
  /* Badge 1:1 con el mockup: QC aprobado (info) · Parcial (ámbar) · Envasado (verde). */
  const tintBadge = (c) => ({ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' });
  let badge;
  if (lote.estado === 'qc_hold') badge = { label: 'QC retenido', c: 'var(--lp-danger-600)' };
  else if (envSt === 'envasado') badge = { label: 'Envasado', c: 'var(--lp-success-600)' };
  else if (envSt === 'parcial') badge = { label: 'Parcial', c: 'var(--lp-warning-600)' };
  else badge = { label: lote.estado === 'qc_aprobado' ? 'QC aprobado' : lote.estado === 'producido' ? 'Producido' : (ESTADO_MAP[lote.estado]?.label || 'Listo'), c: 'var(--lp-info-600)' };

  const primary = acciones.find(a => a.kind === 'primary');     /* Envasar */
  const secundarias = acciones.filter(a => a.kind !== 'primary');
  const btnFull = { width: '100%', minHeight: 46, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
  /* Secundarias — mockup: 40px, radio 10, tile suave; Anular transparente en danger */
  const btnSec = (danger) => ({ flex: '1 1 auto', minHeight: 40, padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap', background: danger ? 'transparent' : 'var(--lp-bg-sunken)', border: `1px solid ${danger ? 'color-mix(in srgb, var(--lp-danger-600) 35%, transparent)' : 'var(--lp-border-subtle)'}`, color: danger ? 'var(--lp-danger-600)' : 'var(--lp-text-secondary)' });

  return (
    <div style={{ ...S.card, display: 'flex', flexDirection: 'column' }}>
      {/* header: código + badge (+ 2 fases / prueba) + QR utilitario
          (el QR no viene en el mockup — acción existente, se conserva) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' }}>
          {lote.codigo || lote.codigoLote || lote.id}
        </span>
        <span style={tintBadge(badge.c)}>{badge.label}</span>
        {hasTotes && <span style={tintBadge('var(--lp-info-600)')}>2 fases</span>}
        {lote.esPrueba && <PruebaBadge size="sm" />}
        <button data-id="stock.btn.qr" data-rol="tecnico,almacen,admin" onClick={() => onQR && onQR(lote)} title="Generar QR del lote"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-tertiary)', padding: 4, display: 'inline-flex' }}>
          {Icon.qr({ s: 17 })}
        </button>
      </div>

      {/* nombre + producidos — mockup .ltitle/.lmeta */}
      <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--lp-text-primary)', letterSpacing: '-.01em' }}>{lote.producto || lote.nombre}</div>
      <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2 }}>
        <span style={{ fontFamily: 'var(--lp-font-mono)' }}>{total.toLocaleString('es-MX')} L</span> producidos{lote.ordenCodigo ? ` · ${lote.ordenCodigo}` : ''}
      </div>

      {/* progreso de envasado — mockup .pbar/.pinfo: barra SIEMPRE visible */}
      {total > 0 && (
        <div style={{ margin: '12px 0 2px' }}>
          <div style={S.progressWrap}><div style={S.progressBar(pct)} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--lp-text-secondary)', fontFamily: 'var(--lp-font-mono)', marginTop: 6 }}>
            <span>{used.toLocaleString('es-MX', { maximumFractionDigits: 0 })} L envasados</span>
            <span>{rest.toLocaleString('es-MX', { maximumFractionDigits: 0 })} L restantes</span>
          </div>
        </div>
      )}

      {/* sublotes expandibles (detalle, colapsado) */}
      {sublotes.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button onClick={() => setShowSublotes(!showSublotes)}
            style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--lp-brand-600)', cursor: 'pointer', fontWeight: 600, padding: '4px 0', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {Icon.chevron({ open: showSublotes })} {sublotes.length} sublote(s)
          </button>
          {showSublotes && <SublotesList lote={lote} sublotes={sublotes} canAnular={canAnular} onAnularSublote={onAnularSublote} />}
        </div>
      )}

      {/* acciones: Envasar full-width (o "Lote envasado") + secundarias */}
      <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {primary ? (
          <button className="lp-btn-acc" data-id={primary.dataId} data-rol={primary.dataRol} onClick={primary.onClick} title={primary.title}
            style={{ ...btnFull, background: 'var(--lp-brand-600)', color: '#fff' }}>
            {primary.icon ? primary.icon({ s: 17 }) : null} {primary.label}
          </button>
        ) : envSt === 'envasado' ? (
          <div style={{ ...btnFull, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', cursor: 'default', border: '1px solid var(--lp-border-subtle)' }}>
            {Icon.check({ s: 16 })} Lote envasado
          </div>
        ) : null}
        {secundarias.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {secundarias.map(a => (
              <button key={a.key} data-id={a.dataId} data-rol={a.dataRol} onClick={a.onClick} title={a.title}
                style={btnSec(a.kind === 'danger' || a.kind === 'warn')}>
                {a.icon ? a.icon({ s: 15 }) : null} {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* LOTE TABLE (escritorio) — ERP Escritorio.html · SCREENS.stock       */
/* Columnas: Lote · Producto · Litros · Envasado · Estado · Acción     */
/* Fila expandible con sublotes (mismo SublotesList que móvil).        */
/* ═══════════════════════════════════════════════════════════════════ */
function LoteTableRow({ lote, canEnvasar, canTransfer, canAnular, isAdmin, onEnvasar, onCerrar, onTransferir, onReenvasar, onEnviarRecolectar, onQR, onEliminarPrueba, onIrQC, onAnularSublote, autoExpand }) {
  const [open, setOpen] = useState(!!autoExpand);
  const est = ESTADO_MAP[lote.estado] || { label: lote.estado, bg: 'var(--lp-bg-sunken)', fg: 'var(--lp-text-tertiary)' };
  const total = Number(lote.litrosTotal) || 0;
  const used = litUsed(lote);
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const sublotes = lote.sublotes || [];
  const hasTotes = sublotes.some(s => s.tipo === 'tote' || s.fase === 1);

  const acciones = buildLoteAcciones(lote, {
    canEnvasar, canTransfer, isAdmin, onEnvasar, onCerrar, onTransferir,
    onEnviarRecolectar, onIrQC, onReenvasarTote: onReenvasar, onEliminarPrueba,
  });
  /* Primaria = primera acción; el resto va como ghost al lado */
  return (
    <>
      <tr data-id="stock.row.lote" data-rol="tecnico,almacen,admin">
        <td style={{ ...S.td, ...S.tdMono, color: 'var(--lp-brand-600)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {sublotes.length > 0 ? (
              <button onClick={() => setOpen(!open)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-tertiary)', display: 'flex', padding: 2 }}
                title={`${sublotes.length} sublote(s)`}>
                {Icon.chevron({ open })}
              </button>
            ) : <span style={{ width: 14, display: 'inline-block' }} />}
            <span>{lote.codigo || lote.codigoLote || lote.id}</span>
          </div>
        </td>
        <td style={S.td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{lote.producto || lote.nombre}</span>
            {hasTotes && <span style={B('var(--lp-granel-50)', 'var(--lp-granel-600)')}>2 fases</span>}
            {lote.esPrueba && <PruebaBadge size="sm" />}
          </div>
          {lote.ordenCodigo && <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>{lote.ordenCodigo}</div>}
        </td>
        <td style={{ ...S.td, ...S.tdMono, textAlign: 'right' }}>{total.toLocaleString('es-MX')} L</td>
        <td style={{ ...S.td, textAlign: 'right' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 90 }}>
            <span style={{ ...S.tdMono, fontSize: 13 }}>{pct}%</span>
            <div style={{ ...S.progressWrap, width: 90, marginBottom: 0 }}>
              <div style={S.progressBar(pct)} />
            </div>
          </div>
        </td>
        <td style={S.td}><span style={B(est.bg, est.fg)}>{est.label}</span></td>
        <td style={{ ...S.td, textAlign: 'right' }}>
          <div style={S.rowActions}>
            <button
              data-id="stock.btn.qr" data-rol="tecnico,almacen,admin"
              style={S.btnGhost} onClick={() => onQR && onQR(lote)} title="Generar QR del lote">
              {Icon.qr({ s: 15 })} QR
            </button>
            {acciones.length === 0 && (
              <span style={{ color: 'var(--lp-text-tertiary)', fontSize: 12 }}>—</span>
            )}
            {acciones.map(a => (
              <button
                key={a.key}
                data-id={a.dataId} data-rol={a.dataRol}
                style={a.kind === 'primary' || a.kind === 'success' || a.kind === 'warn' || a.kind === 'danger' || a.kind === 'tote'
                  ? accionStyle(a.kind, true)
                  : S.btnGhost}
                onClick={a.onClick}
                title={a.title}
              >
                {a.icon ? a.icon({ s: 15 }) : null} {a.label}
              </button>
            ))}
          </div>
        </td>
      </tr>
      {open && sublotes.length > 0 && (
        <tr>
          <td />
          <td style={S.subRowCell} colSpan={5}>
            <SublotesList lote={lote} sublotes={sublotes} canAnular={canAnular} onAnularSublote={onAnularSublote} />
          </td>
        </tr>
      )}
    </>
  );
}

function LoteTable(props) {
  const { lotes, highlightLote } = props;
  return (
    <div style={S.tablewrap}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Lote</th>
            <th style={S.th}>Producto</th>
            <th style={{ ...S.th, textAlign: 'right' }}>Litros</th>
            <th style={{ ...S.th, textAlign: 'right' }}>Envasado</th>
            <th style={S.th}>Estado</th>
            <th style={{ ...S.th, textAlign: 'right' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {lotes.map(lote => (
            <LoteTableRow
              key={lote.id}
              lote={lote}
              {...props}
              autoExpand={!!highlightLote && (lote.codigo === highlightLote || lote.codigoLote === highlightLote || lote.id === highlightLote)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                          */
/* ═══════════════════════════════════════════════════════════════════ */
export default function StockFabricaPage() {
  const { user, can } = useAuth();
  const isDesktop = useIsDesktop();
  const [confirm, ConfirmEl] = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightLote = searchParams.get('lote') || '';
  const userName = user?.nombre || '?';
  const rol = user?.rol || '';
  const [activeTab, setActiveTab] = useState('enFabrica');
  const [searchQ, setSearchQ] = useState(highlightLote);
  const [toastMsg, setToastMsg] = useState('');
  const [envasadoModal, setEnvasadoModal] = useState(null);
  const [reenvasadoModal, setReenvasadoModal] = useState(null);
  const [qrLote, setQrLote] = useState(null);
  /* Payload de impresión QR del sublote recién creado — se abre automáticamente
     después de un envasado/re-envasado exitoso para que el operador imprima
     y pegue el QR físicamente en el envase. */
  const [printSubloteQR, setPrintSubloteQR] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 5000);
  }, []);

  /* CSS de paridad mockup (dark de botones acento, sheet, stepper) — una vez */
  useEffect(() => { injectSheetCSS(); }, []);

  const { data: trazData, loading, reload: reloadTraz } = useApiData(() => api.getTrazabilidad(), [], 5000);
  const { data: envData } = useApiData(() => api.getEnvases(), null, 30000);

  /* FIX jun 2026 (K1): cambios de estado de lote (envasado, recogido) deben
     reflejarse al instante para todos los roles que tienen esta pantalla
     abierta (Enrique, Josué, admin). */
  useRealtimeSync({
    onTrazabilidad: () => reloadTraz(),
  });

  const envases = useMemo(() => envData?.data || envData || null, [envData]);

  const allLotes = useMemo(() => {
    const arr = trazData?.data || [];
    return (Array.isArray(arr) ? arr : [])
      .filter(l => l && !l.eliminado)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [trazData]);

  /* Lotes en fábrica REALES (sin pruebas, sin cancelados — vista principal) */
  const enFabricaActivos = useMemo(() =>
    allLotes.filter(l => {
      const e = l.estado;
      /* en_proceso = estado legacy/compat, se trata como en_envasado */
      const enFlujo = e === 'producido' || e === 'qc_aprobado' || e === 'en_envasado' || e === 'envasado' || e === 'en_proceso';
      return enFlujo && !l.esPrueba && !l.cancelado && e !== 'qc_hold';
    }),
    [allLotes]
  );

  /* Lotes en fábrica de PRUEBA */
  const enFabricaPrueba = useMemo(() =>
    allLotes.filter(l => {
      const e = l.estado;
      const enFlujo = e === 'producido' || e === 'qc_aprobado' || e === 'en_envasado' || e === 'envasado';
      return enFlujo && l.esPrueba && !l.cancelado;
    }),
    [allLotes]
  );

  /* Lotes RECHAZADOS o cancelados */
  const enFabricaRechazados = useMemo(() =>
    allLotes.filter(l => l.cancelado || l.estado === 'qc_hold' || l.estado === 'rechazado'),
    [allLotes]
  );

  /* Compat: enFabrica sigue refiriéndose a la lista activa para el resto del código */
  const enFabrica = enFabricaActivos;

  /* FIX jun 2026 (bug "Ver sublotes roto"): si llega ?lote= de un lote que NO
     vive en el tab activo (p.ej. en_almacen → tab Transferidos), auto-cambiar
     al tab correcto. Antes la búsqueda pre-llenada filtraba sobre "En Fábrica"
     y el lote transferido no aparecía → pantalla vacía. */
  useEffect(() => {
    if (!highlightLote) return;
    const l = allLotes.find(x => x && (x.codigo === highlightLote || x.codigoLote === highlightLote || x.id === highlightLote));
    if (!l) return;
    if (l.esPrueba) setActiveTab('pruebas');
    else if (l.cancelado || l.estado === 'qc_hold' || l.estado === 'rechazado') setActiveTab('rechazados');
    else if (['en_recoleccion', 'en_camino', 'en_almacen', 'reenvasado', 'entregado'].includes(l.estado)) setActiveTab('transferidos');
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [highlightLote, allLotes.length]);

  /* Lotes transferidos — también separamos prueba */
  const transferidosActivos = useMemo(() =>
    allLotes.filter(l => ['en_recoleccion', 'en_camino', 'en_almacen', 'reenvasado'].includes(l.estado) && !l.esPrueba),
    [allLotes]
  );
  const transferidosPrueba = useMemo(() =>
    allLotes.filter(l => ['en_recoleccion', 'en_camino', 'en_almacen', 'reenvasado'].includes(l.estado) && l.esPrueba),
    [allLotes]
  );
  const transferidos = transferidosActivos;

  /* Filtered según tab activo */
  const filtered = useMemo(() => {
    let list;
    if (activeTab === 'enFabrica')        list = enFabricaActivos;
    else if (activeTab === 'transferidos') list = transferidosActivos;
    else if (activeTab === 'pruebas')      list = [...enFabricaPrueba, ...transferidosPrueba];
    else if (activeTab === 'rechazados')   list = enFabricaRechazados;
    else                                    list = enFabricaActivos;
    if (!searchQ) return list;
    const q = searchQ.toLowerCase();
    return list.filter(l =>
      (l.producto || l.nombre || '').toLowerCase().includes(q) ||
      (l.codigo || l.codigoLote || '').toLowerCase().includes(q)
    );
  }, [activeTab, enFabricaActivos, transferidosActivos, enFabricaPrueba, transferidosPrueba, enFabricaRechazados, searchQ]);

  /* KPIs */
  const kpis = useMemo(() => ({
    sinEnvasar: enFabrica.filter(l => envEstado(l) === 'listo').length,
    parcial: enFabrica.filter(l => envEstado(l) === 'parcial').length,
    envasados: enFabrica.filter(l => envEstado(l) === 'envasado').length,
    total: enFabrica.length,
  }), [enFabrica]);

  /* jun 2026 (decisión owner): el envasado lo hace ENRIQUE (técnico)/admin.
     Josué (almacén) ya NO envasa — antes `can('envasado')` se lo permitía si
     el permiso estaba activo en su rol, y por eso veía lotes "para envasar" en
     Stock Fábrica apenas entraban a en_envasado. Ahora gateamos también por rol
     para empatar con el state machine (registrarEnvasado/marcarEnvasado =
     tecnico/admin). Josué conserva transferir/recolectar/anular. */
  const canEnvasar = (rol === 'admin' || rol === 'tecnico') && (can('envasado') || can('produccion'));
  /* §8: enviar a recolectar / transferir a Terán / anular sublote = almacen,admin */
  const canTransfer = rol === 'admin' || rol === 'almacen';
  const canAnular = canTransfer;

  const handleCerrar = useCallback(async (lote) => {
    const ok = await confirm(`¿Cerrar lote ${lote.codigo}? Los litros restantes se registrarán como merma.`, { danger: true, confirmText: 'Cerrar lote' });
    if (!ok) return;
    try {
      await api.cerrarLote(lote.id);
      reloadTraz();
      showToast(`Lote ${lote.codigo} cerrado con merma`);
    } catch (err) {
      showToast('Error: ' + (err.message || 'No se pudo cerrar'));
    }
  }, [reloadTraz, showToast, confirm]);

  /* jun 2026: handleTransferir eliminado junto con su botón (ver computeAcciones).
     El producto llega a Terán solo vía recepción por escaneo de Josué. */

  /* FIX jun 2026 (Sprint O - O3): "Enviar a recolectar" como acción primaria
     cuando el lote está envasado. Marca TODOS los sublotes envasados como
     en_recoleccion vía /api/sublotes/scan-bulk con acción marcarRecoleccion.
     Esto dispara push a Luis (NOTIF_TARGETS['sublote.marcarRecoleccion']).
     Antes Josué tenía que ir sublote por sublote desde otra pantalla. */
  const handleEnviarRecolectar = useCallback(async (lote) => {
    const envasados = (lote.sublotes || []).filter(s => s.estado === 'envasado' && !s.esMerma);
    if (envasados.length === 0) return showToast('No hay sublotes envasados para enviar a recolección');

    /* FEFO: un lote CADUCADO no puede salir a recolección. El backend lo bloquea
       (guard en la state machine); aquí damos la UX correcta: si es admin, se le
       pide autorización con nota (override auditado); si no, se le avisa. */
    const caducado = lote.fechaCaducidad && new Date(lote.fechaCaducidad).getTime() < Date.now();
    let overridePayload = {};
    if (caducado) {
      const fecha = String(lote.fechaCaducidad).slice(0, 10);
      if (rol !== 'admin') {
        return showToast(`Lote CADUCADO (venció ${fecha}). No puede salir a recolección — avisa a un administrador.`);
      }
      const nota = await confirm(
        `Este lote está CADUCADO (venció ${fecha}). Despacharlo de todas formas requiere tu autorización y queda en auditoría. Indica el motivo.`,
        { title: 'Forzar despacho de lote caducado', confirmText: 'Forzar con esta nota', danger: true,
          prompt: { label: 'Motivo del override', placeholder: 'Ej: cliente lo acepta, uso no crítico…', required: true, minLength: 5, maxLength: 300, rows: 2 } }
      );
      if (!nota) return;
      overridePayload = { overrideCaducidad: true, notaOverride: nota };
    } else {
      const ok = await confirm(
        `Marcar ${envasados.length} sublote(s) de ${lote.codigoLote || lote.codigo} como "listos para recolectar". Luis recibirá notificación inmediata.`,
        { confirmText: 'Enviar a recolectar', title: 'Enviar a recolectar' }
      );
      if (!ok) return;
    }
    try {
      await api.post('/api/sublotes/scan-bulk', { loteId: lote.id, accion: 'marcarRecoleccion', ...overridePayload });
      reloadTraz();
      showToast(caducado ? `Lote caducado despachado con override — notificado a Luis` : `${envasados.length} sublote(s) listos — notificado a Luis`);
    } catch (err) {
      showToast('Error: ' + (err.message || 'No se pudo enviar a recolectar'));
    }
  }, [reloadTraz, showToast, confirm, rol]);

  /* Sprint G-1: anular sublote mal capturado. El backend repone envase/tapa
     al stock y marca el sublote como cancelado:true para auditoría (no se
     borra para preservar trazabilidad). */
  const handleAnularSublote = useCallback(async (lote, sublote) => {
    const motivo = await confirm(
      `Vas a anular el sublote ${sublote.cod} (${sublote.qty} ${sublote.tipo} ${sublote.marca || ''}). Los envases/tapas regresan al stock. Indica el motivo para auditoría.`,
      {
        title: 'Anular sublote',
        confirmText: 'Anular',
        danger: true,
        prompt: {
          label: 'Motivo (ej: marca equivocada, tapa equivocada)',
          placeholder: 'Motivo de la anulación',
          required: true, minLength: 5, maxLength: 200, rows: 2,
        },
      }
    );
    if (!motivo) return;
    try {
      await api.transicionSublote(sublote.cod, 'cancelarSublote', { nota: motivo, motivo });
      reloadTraz();
      showToast(`Sublote ${sublote.cod} anulado`);
    } catch (err) {
      showToast('Error: ' + (err?.data?.error || err.message || 'No se pudo anular'));
    }
  }, [reloadTraz, showToast, confirm]);

  const handleEliminarPrueba = useCallback(async (lote) => {
    const ok = await confirm(`¿Eliminar permanentemente el lote de prueba ${lote.codigo || lote.codigoLote}?`, { danger: true, confirmText: 'Eliminar' });
    if (!ok) return;
    try {
      await api.eliminarLotePrueba(lote.codigoLote || lote.codigo);
      reloadTraz();
      showToast(`Lote de prueba ${lote.codigo || lote.codigoLote} eliminado`);
    } catch (err) {
      showToast('Error: ' + (err.message || 'No se pudo eliminar'));
    }
  }, [reloadTraz, showToast, confirm]);

  if (loading) {
    return (
      <>
        <TopBar title="Stock Fábrica" />
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Stock Fábrica" />
      <div style={S.wrap}>
        {/* Tabs */}
        <PageTabs
          tabs={[
            { id: 'enFabrica', label: `En Fábrica (${enFabricaActivos.length})`, style: (a) => S.tab(a) },
            { id: 'transferidos', label: `Transferidos (${transferidosActivos.length})`, style: (a) => S.tab(a) },
            ...((enFabricaPrueba.length + transferidosPrueba.length) > 0
              ? [{ id: 'pruebas', label: `Pruebas (${enFabricaPrueba.length + transferidosPrueba.length})`, style: (a) => S.tab(a) }]
              : []),
            ...(enFabricaRechazados.length > 0
              ? [{ id: 'rechazados', label: `Rechazados (${enFabricaRechazados.length})`, style: (a) => S.tab(a) }]
              : []),
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          style={S.tabs}
        />

        {/* Search */}
        <div style={S.toolbar}>
          <input type="text" style={S.search} placeholder="Buscar lote..."
            value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>

        {/* Lotes */}
        {filtered.length === 0 ? (
          <div style={{ ...S.empty, padding: '60px 20px' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--lp-text-disabled)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>
              {searchQ ? 'Sin resultados'
                : activeTab === 'enFabrica' ? 'Sin lotes en fábrica'
                : activeTab === 'transferidos' ? 'Sin lotes transferidos'
                : activeTab === 'pruebas' ? 'Sin lotes de prueba'
                : 'Sin lotes rechazados'}
            </div>
          </div>
        ) : (
          /* MÓVIL 1-col · ESCRITORIO grid 2-col — cards limpias 1:1 con el mockup */
          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 14, alignItems: 'start' }}>
            {filtered.map(lote => (
              <LoteCard
                key={lote.id}
                lote={lote}
                canEnvasar={canEnvasar}
                canTransfer={canTransfer}
                canAnular={canAnular}
                isAdmin={rol === 'admin'}
                autoExpand={!!highlightLote && (lote.codigo === highlightLote || lote.codigoLote === highlightLote || lote.id === highlightLote)}
                onEnvasar={setEnvasadoModal}
                onCerrar={handleCerrar}
                onEnviarRecolectar={handleEnviarRecolectar}
                onReenvasar={setReenvasadoModal}
                onQR={setQrLote}
                onEliminarPrueba={handleEliminarPrueba}
                onAnularSublote={handleAnularSublote}
                onIrQC={() => window.location.assign('/produccion?tab=calidad')}
              />
            ))}
          </div>
        )}
      </div>

      {/* Envasado Modal — al éxito cierra y abre el QR print modal del sublote */}
      {envasadoModal && (
        <EnvasadoModal
          lote={envasadoModal}
          envases={envases}
          userName={userName}
          onClose={() => setEnvasadoModal(null)}
          onSuccess={(payload) => {
            setEnvasadoModal(null);
            reloadTraz();
            const s = payload?.sublotes?.[0];
            const msg = payload?.isTote
              ? `Envasado granel: tote ${payload.litTotal?.toFixed(1)}L de ${payload.lote?.producto || payload.lote?.nombre}`
              : `Envasado: ${payload?.q} ${payload?.tipo}(s) de ${payload?.lote?.producto || payload?.lote?.nombre}`;
            showToast(msg);
            /* Abre print modal solo si tenemos sublote con qrPayload */
            if (s?.qrPayload || s?.cod) setPrintSubloteQR(payload);
          }}
        />
      )}

      {/* Reenvasado Modal — usa state machine transicionSublote(reenvasarTote) */}
      {reenvasadoModal && (
        <ReenvasadoModal
          lote={reenvasadoModal}
          envases={envases}
          userName={userName}
          onClose={() => setReenvasadoModal(null)}
          onSuccess={(payload) => {
            setReenvasadoModal(null);
            reloadTraz();
            const s = payload?.sublotes?.[0];
            const msg = `Re-envasado: ${payload?.q} ${payload?.tipo}(s) desde tote ${payload?.desdeTote}`;
            showToast(msg);
            if (s?.qrPayload || s?.cod) setPrintSubloteQR(payload);
          }}
        />
      )}

      {/* QR de LOTE (legacy, vista completa del lote) */}
      {qrLote && (
        <QRModal lote={qrLote} onClose={() => setQrLote(null)} />
      )}

      {/* QR del SUBLOTE recién creado — para imprimir y pegar al envase */}
      {printSubloteQR && (
        <SubloteQRPrintModal
          payload={printSubloteQR}
          onClose={() => setPrintSubloteQR(null)}
        />
      )}

      {/* Toast */}
      {toastMsg && <div style={S.toast}><span style={{ marginRight: 8, display: 'inline-flex' }}>{Icon.check({ s: 15 })}</span>{toastMsg}</div>}
      {ConfirmEl}
    </>
  );
}
