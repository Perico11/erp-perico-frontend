import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PT_MEDIDAS, ptMedidaDef, medidaACubetas, etiquetaMedida } from '../../utils/ptMedidas';
import { useSearchParams, useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData, useSearch } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import { EliminarMPModal, SustituirMPModal, MPActionsMenu } from './MPActions';
import AgregarPTModal from './AgregarPTModal';
import CostosMPPanel from '../admin/CostosMPPanel';
import MaestroMPInline from './MaestroMPInline';
import HelpHint from '../../components/HelpHint';
import PageTabs from '../../components/ui/PageTabs';
import ImportExportPrint from '../../components/ui/ImportExportPrint';
import CanonicoCard from './CanonicoCard';
import useConfirm from '../../hooks/useConfirm';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

/* ── Category config — matches maestro_mp.json categories exactly.
   Iconos abreviados estilo "tag" de 2 letras (sin emojis para consistencia
   con el Light Premium design system). */
const MP_CATEGORIES = {
  'Resinas y Ligantes':       { icon: 'RE', bg: 'var(--lp-brand-100)',  fg: 'var(--lp-brand-700)' },
  'Pigmentos y Colorantes':   { icon: 'PG', bg: '#FDE68A',              fg: '#92400E' },
  'Cargas Minerales':         { icon: 'CM', bg: 'var(--lp-bg-sunken)',  fg: 'var(--lp-text-secondary)' },
  'Aditivos y Dispersantes':  { icon: 'AD', bg: '#DBEAFE',              fg: '#1E40AF' },
  'Solventes y Coalescentes': { icon: 'SV', bg: '#D1FAE5',              fg: '#065F46' },
  'Conservadores y Biocidas': { icon: 'CB', bg: '#FCE7F3',              fg: '#9D174D' },
  'Efectos Especiales':       { icon: 'FX', bg: 'var(--lp-qc-50)',              fg: 'var(--lp-qc-700)' },
};

/* ── Inline styles (LP design system) ── */
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
    fontFamily: 'var(--lp-font-sans)', marginBottom: -2, transition: 'all .15s', flexShrink: 0,
  }),
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10, marginBottom: 16,
  },
  kpi: (accent, active, clickable) => ({
    background: active ? accent.replace('600', '100').replace('var(--lp-', 'var(--lp-').replace(')', '-100)') : 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius-sm)',
    border: active ? `2px solid ${accent}` : '1.5px solid var(--lp-border-subtle)',
    padding: '14px 16px', borderTop: active ? 'none' : `3px solid ${accent}`,
    textAlign: 'center', cursor: clickable ? 'pointer' : 'default',
    transition: 'all .15s',
  }),
  kpiLabel: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    color: 'var(--lp-text-tertiary)', letterSpacing: '.05em',
  },
  kpiValue: {
    fontSize: 24, fontWeight: 700, fontFamily: 'var(--lp-font-mono)',
    color: 'var(--lp-text-primary)', marginTop: 4,
  },
  kpiHint: {
    fontSize: 11, color: 'var(--lp-brand-600)', fontWeight: 600, marginTop: 4,
  },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap',
  },
  search: {
    flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  sectionHeader: (bg, fg) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
    background: bg || 'var(--lp-bg-sunken)', color: fg || 'var(--lp-text-secondary)',
    fontSize: 12, fontWeight: 700, borderRadius: '10px 10px 0 0',
    textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  section: {
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 10,
    overflow: 'hidden', marginBottom: 12,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
    borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 13,
  },
  rowName: {
    flex: 1, fontWeight: 600, color: 'var(--lp-text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  /* Fila de envases/tapas: contenido empacado a la IZQUIERDA (el nombre no se
     come todo el ancho), valores en columnas alineadas, espacio libre a la
     derecha. jun 2026 — pedido dueño ("recargado a la derecha"). */
  envRow: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px',
    borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 13, flexWrap: 'wrap',
  },
  envName: {
    flex: '0 1 220px', minWidth: 130, fontWeight: 600, color: 'var(--lp-text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  rowQty: (color) => ({
    fontWeight: 700, fontFamily: 'var(--lp-font-mono)', fontSize: 14,
    color: color || 'var(--lp-text-primary)', minWidth: 50, textAlign: 'right',
  }),
  rowUnit: { fontSize: 11, color: 'var(--lp-text-tertiary)', minWidth: 28 },
  badge: (type) => {
    const map = {
      ok:   { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-600)' },
      warn: { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
      err:  { bg: 'var(--lp-danger-100)',  fg: 'var(--lp-danger-600)' },
      info: { bg: 'var(--lp-brand-100)',   fg: 'var(--lp-brand-700)' },
    };
    const c = map[type] || map.info;
    return {
      display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 600,
      borderRadius: 6, background: c.bg, color: c.fg,
    };
  },
  provSub: { fontSize: 11, color: 'var(--lp-text-tertiary)', fontWeight: 400, marginTop: 1 },
  /* ── Mockup v2: card row con barra de severidad (Inventarios.html) ── */
  catLabel: {
    fontSize: 11.5, color: 'var(--lp-text-tertiary)', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '.04em', margin: '8px 2px 8px',
    display: 'flex', alignItems: 'center', gap: 7,
  },
  catTag: (bg, fg) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: 6, background: bg, color: fg,
    fontSize: 9, fontWeight: 800, flexShrink: 0,
  }),
  cardRow: {
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
    borderRadius: 14, padding: '13px 15px', marginBottom: 9,
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 },
  cardName: { flex: 1, fontSize: 14.5, fontWeight: 600, color: 'var(--lp-text-primary)', minWidth: 0 },
  estBadge: (c) => ({
    fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
    background: `color-mix(in srgb, ${c} 15%, transparent)`, color: c, whiteSpace: 'nowrap',
  }),
  pencilBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-tertiary)',
    padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0,
  },
  sevBar: { height: 6, borderRadius: 999, background: 'var(--lp-bg-sunken)', overflow: 'hidden', margin: '8px 0 7px' },
  sevFill: (pct, c) => ({ width: `${pct}%`, height: '100%', borderRadius: 999, background: c }),
  cardNums: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 },
  numEx: (c) => ({ fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: c || 'var(--lp-text-primary)' }),
  numMin: { color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' },
  /* ── Card móvil 1:1 ERP Móvil.html (sin barra, sin lápiz, sin menú) ── */
  mCard: (clickable) => ({
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
    borderRadius: 16, padding: '14px 16px', marginBottom: 10,
    cursor: clickable ? 'pointer' : 'default',
  }),
  mTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  mName: { fontSize: 14.5, fontWeight: 600, color: 'var(--lp-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mNums: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 },
  mQty: (crit) => ({ fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: crit ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)' }),
  mMin: { fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)' },
  chip: (on) => ({
    height: 36, padding: '0 14px', borderRadius: 10, cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: 600,
    border: on ? '1px solid color-mix(in srgb, var(--lp-brand-600) 30%, transparent)' : '1px solid var(--lp-border-subtle)',
    background: on ? 'color-mix(in srgb, var(--lp-brand-600) 14%, transparent)' : 'var(--lp-bg-sunken)',
    color: on ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)',
  }),
  /* ── Mockup v2: encabezado + toolbar + pills + tabla escritorio + sheet ── */
  h1: { fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--lp-text-primary)' },
  psub: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3, marginBottom: 16 },
  toolbarRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  /* Buscador prominente (mockup Inventarios.html): 48px, radio 14, borde acento
     al enfocar y botón limpiar (X) cuando hay texto. */
  searchBox: (focused) => ({
    display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200, maxWidth: 440,
    height: 48, padding: '0 14px', borderRadius: 14, background: 'var(--lp-bg-raised)',
    border: focused ? '1.5px solid var(--lp-brand-600)' : '1.5px solid var(--lp-border-subtle)',
    color: 'var(--lp-text-tertiary)', transition: 'border-color .2s',
  }),
  searchInput: {
    flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none',
    fontFamily: 'var(--lp-font-sans)', fontSize: 15, color: 'var(--lp-text-primary)',
  },
  searchClr: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-tertiary)',
    padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0,
  },
  /* Segmented MP/PT (mockup .seg/.segb): contenedor tile + pills, activo = acento */
  segWrap: { display: 'flex', gap: 3, background: 'var(--lp-bg-sunken)', borderRadius: 999, padding: 3 },
  segBtn: (on) => ({
    padding: '7px 14px', minHeight: 36, borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: on ? 600 : 500,
    background: on ? 'var(--lp-brand-600)' : 'transparent',
    color: on ? '#fff' : 'var(--lp-text-secondary)', whiteSpace: 'nowrap',
  }),
  countLbl: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', margin: '2px 2px 8px' },
  pillGroup: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  pill: (on) => ({
    fontSize: 12.5, fontWeight: 600, padding: '8px 15px', borderRadius: 999, cursor: 'pointer',
    border: 'none', fontFamily: 'var(--lp-font-sans)', minHeight: 36,
    background: on ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)',
    color: on ? '#fff' : 'var(--lp-text-secondary)',
  }),
  subRow: { display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 14px', flexWrap: 'wrap' },
  /* Cluster de acciones de la sub-fila: a la derecha en escritorio */
  actionsCluster: (desktop) => ({
    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
    marginLeft: desktop ? 'auto' : 0,
  }),
  tablewrap: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
    color: 'var(--lp-text-tertiary)', padding: '12px 16px', borderBottom: '1px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-sunken)', whiteSpace: 'nowrap',
  },
  td: { padding: '12px 16px', borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 13.5, color: 'var(--lp-text-primary)' },
  tdMono: { fontFamily: 'var(--lp-font-mono)', fontWeight: 600 },
  btnGhost: {
    height: 36, padding: '0 15px', borderRadius: 10, border: '1px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', fontFamily: 'var(--lp-font-sans)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  /* sheet "Ajustar existencia" */
  sheetOverlay: (desktop) => ({
    position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 1200,
    display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', padding: desktop ? 16 : 0,
  }),
  sheet: (desktop) => ({
    background: 'var(--lp-bg-base)', width: '100%', maxWidth: 460,
    borderRadius: desktop ? 20 : '24px 24px 0 0', padding: '20px 20px 26px',
    boxShadow: '0 -8px 40px rgba(0,0,0,.22)',
  }),
  shH: { fontSize: 18, fontWeight: 600, color: 'var(--lp-text-primary)' },
  shS: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2, marginBottom: 16 },
  bigsis: { textAlign: 'center', padding: 12, borderRadius: 14, background: 'var(--lp-bg-sunken)', marginBottom: 14 },
  bigK: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--lp-text-tertiary)' },
  bigV: { fontFamily: 'var(--lp-font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--lp-text-primary)', marginTop: 3 },
  flbl: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', margin: '0 2px 6px' },
  finQty: {
    width: '100%', height: 54, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-mono)', fontSize: 22,
    fontWeight: 700, color: 'var(--lp-text-primary)', outline: 'none', textAlign: 'center', boxSizing: 'border-box',
  },
  finTxt: {
    width: '100%', height: 48, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-sans)', fontSize: 15,
    color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box',
  },
  shActs: { display: 'flex', gap: 10, marginTop: 18 },
  act2: (primary) => ({
    flex: 1, height: 50, borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    fontSize: 14.5, fontWeight: 600,
    border: primary ? 'none' : '1px solid var(--lp-border-subtle)',
    background: primary ? 'var(--lp-brand-600)' : 'transparent',
    color: primary ? '#fff' : 'var(--lp-text-secondary)',
  }),
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0', fontSize: 13 },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
  editInput: {
    width: 70, padding: '4px 8px', borderRadius: 6, fontSize: 13,
    border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-mono)',
    textAlign: 'right', background: 'var(--lp-bg-raised)', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  saveBtn: {
    padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 11,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-brand-600)', color: '#fff',
  },
  savingMsg: {
    fontSize: 11, color: 'var(--lp-brand-600)', fontWeight: 500, padding: '8px 14px',
  },
  /* ── Modal ── */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    /* z 1100 > 1000 del bottom-nav fijo (.bottom-nav-mobile): sin esto el nav se
       pinta encima del footer del modal en móvil y tapa los botones (jun 2026). */
    zIndex: 1100, padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)', width: '100%', maxWidth: 420,
    maxHeight: '90vh', overflow: 'auto',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--lp-border-subtle)',
  },
  modalTitle: { fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)' },
  modalClose: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-sans)',
  },
  modalBody: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 4, display: 'block' },
  fieldInput: {
    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13,
    border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', outline: 'none', color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  fieldSelect: {
    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13,
    border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  modalFooter: {
    display: 'flex', gap: 8, justifyContent: 'flex-end',
    padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)',
  },
  btnPrimary: {
    padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 13,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-brand-600)', color: '#fff', minHeight: 44,
  },
  btnSecondary: {
    padding: '10px 20px', borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', minHeight: 44,
  },
  /* Mockup: "+ Recepción MP" como chip acentuado (tile bg + texto/borde acento),
     no botón sólido. minHeight 44 se conserva (touch ≥44px > los 36px del mockup). */
  btnAdd: {
    padding: '8px 14px', borderRadius: 10, fontSize: 12.5,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    border: '1px solid color-mix(in srgb, var(--lp-brand-600) 30%, transparent)',
    background: 'var(--lp-bg-sunken)', color: 'var(--lp-brand-700)',
    whiteSpace: 'nowrap', minHeight: 44,
  },
  toast: (type) => ({
    position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 1001,
    background: type === 'ok' ? 'var(--lp-success-600)' : 'var(--lp-danger-600)', color: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,.15)',
  }),
};

/* ── Modal Recepción MP ── */
function RecepcionModal({ mpList, onClose, onSuccess }) {
  const [mp, setMp] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const filteredMPs = useMemo(() => {
    if (!search) return mpList;
    const q = search.toLowerCase();
    return mpList.filter(m => m.toLowerCase().includes(q));
  }, [mpList, search]);

  const handleSubmit = async () => {
    if (!mp) return setError('Selecciona una materia prima');
    const qty = parseFloat(cantidad);
    if (!qty || qty <= 0) return setError('Cantidad debe ser mayor a 0');
    setSaving(true);
    setError('');
    try {
      await api.recepcionMP(mp, qty, proveedor || undefined, nota || undefined);
      onSuccess(mp, qty);
    } catch (e) {
      setError(e.message || 'Error al registrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <span style={S.modalTitle}>Recepción de Materia Prima</span>
          <button style={S.modalClose} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          {/* MP selector with search */}
          <div>
            <label style={S.fieldLabel}>Materia Prima *</label>
            <input
              ref={inputRef}
              type="text" style={S.fieldInput}
              placeholder="Buscar MP..." value={mp || search}
              onChange={e => { setSearch(e.target.value); setMp(''); }}
            />
            {search && !mp && filteredMPs.length > 0 && (
              <div style={{
                maxHeight: 150, overflowY: 'auto', border: '1.5px solid var(--lp-border-subtle)',
                borderRadius: 8, marginTop: 4, background: 'var(--lp-bg-raised)',
              }}>
                {filteredMPs.slice(0, 15).map(m => (
                  <div key={m} onClick={() => { setMp(m); setSearch(''); }}
                    style={{
                      padding: '8px 14px', fontSize: 12, cursor: 'pointer',
                      borderBottom: '1px solid var(--lp-border-subtle)',
                      color: 'var(--lp-text-primary)', fontWeight: 500,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-bg-sunken)'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >{m}</div>
                ))}
              </div>
            )}
            {mp && (
              <div style={{
                marginTop: 4, padding: '6px 12px', borderRadius: 6, fontSize: 12,
                fontWeight: 600, background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)',
                display: 'inline-flex', gap: 6, alignItems: 'center',
              }}>
                {mp}
                <span style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => { setMp(''); setSearch(''); }}>✕</span>
              </div>
            )}
          </div>

          {/* Cantidad */}
          <div>
            <label style={S.fieldLabel}>Cantidad (kg) *</label>
            <input type="number" inputMode="decimal" step="0.1" min="0" style={S.fieldInput}
              placeholder="Ej: 25.0" value={cantidad}
              onChange={e => setCantidad(e.target.value)} />
          </div>

          {/* Proveedor (opcional) */}
          <div>
            <label style={S.fieldLabel}>Proveedor (opcional)</label>
            <input type="text" style={S.fieldInput}
              placeholder="Nombre del proveedor" value={proveedor}
              onChange={e => setProveedor(e.target.value)} />
          </div>

          {/* Nota (opcional) */}
          <div>
            <label style={S.fieldLabel}>Nota (opcional)</label>
            <input type="text" style={S.fieldInput}
              placeholder="Factura, OC, comentario..." value={nota}
              onChange={e => setNota(e.target.value)} />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--lp-danger-600)', fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnPrimary} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar Recepción'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── MP Row component (with optional editing) ── */
/* AD1 (jun 2026): resalta coincidencias del buscador en un texto */
function resaltar(texto, query) {
  if (!query) return texto;
  const t = String(texto);
  const idx = t.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return texto;
  return (
    <>
      {t.slice(0, idx)}
      {/* Mockup hl(): acento al 30% + color heredado (funciona claro/oscuro) */}
      <mark style={{ background: 'color-mix(in srgb, var(--lp-brand-600) 30%, transparent)', color: 'inherit', borderRadius: 3, padding: '0 1px' }}>
        {t.slice(idx, idx + query.length)}
      </mark>
      {t.slice(idx + query.length)}
    </>
  );
}

/* Lápiz de "editar" del mockup — afordancia visual; el click lo maneja la card */
function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--lp-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

/* Barra de severidad del mockup: pct = existencia/mínimo, clamp 4–100 */
function barPctOf(qty, min) {
  return Math.max(4, Math.min(100, min > 0 ? (qty / min) * 100 : 100));
}

function MPRow({ item, canEdit, canContar, onAdjust, onContar, query }) {
  const { mp, inv, pct, maestro } = item;
  const qty = inv.qty || 0;
  const sev = sevOf(qty, pct);
  const prov = maestro?.proveedor?.principal;
  const clickable = canEdit || canContar;
  return (
    <div style={S.mCard(clickable)} data-id="inventario.row.item" data-rol="admin,tecnico,compras,almacen,inventario"
      role={clickable ? 'button' : undefined} onClick={() => { if (canEdit) onAdjust(item); else if (canContar && onContar) onContar(); }}>
      <div style={S.mTop}>
        <span style={S.mName}>
          {resaltar(mp, query)}
          {prov && <span style={{ ...S.provSub, fontWeight: 400 }}> · {prov}</span>}
        </span>
        <EstadoBadge qty={qty} pct={pct} />
        {canEdit && <PencilIcon />}
      </div>
      <div style={S.sevBar}><div style={S.sevFill(barPctOf(qty, inv.min || 0), sev.color)} /></div>
      <div style={S.mNums}>
        <span style={S.mQty(sev.key === 'critico')}>{qty.toLocaleString('es-MX', { maximumFractionDigits: 1 })} kg</span>
        <span style={S.mMin}>mín {(inv.min || 0).toLocaleString('es-MX')} kg</span>
        {canContar && !canEdit && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--lp-brand-700)' }}>Contar →</span>}
      </div>
    </div>
  );
}

/* ── PT Row component (with optional editing + CTA "Pedir reposición") ── */
/* PT_MEDIDAS / ptMedidaDef / medidaACubetas / etiquetaMedida → módulo compartido
   ../../utils/ptMedidas (también lo usa Pedidos). */

/* Badge con la MEDIDA real del PT (ej. "2 totes", "327 cubetas"). Tote (granel,
   sin envasar) en ámbar; el resto (envasado) en verde. El cubeta-equivalente va
   en el tooltip — el conteo base sigue en cubetas. */
function PTMedidaBadge({ medida, medidaQty, qty }) {
  const m = ptMedidaDef(medida);
  if (!m) return null;
  const c = medida === 'tote' ? 'var(--lp-warning-600)' : 'var(--lp-brand-600)';
  return (
    <span title={`= ${(Number(qty) || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 })} cubetas-equivalente`}
      style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 7px', borderRadius: 999,
        fontSize: 10.5, fontWeight: 600, fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap',
        color: c, background: `color-mix(in srgb, ${c} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 30%, transparent)` }}>
      {etiquetaMedida(medida, medidaQty)}
    </span>
  );
}

/* Badge "en tránsito: N" — material en camino de Fábrica → Terán por una OT
   surtida y aún no recibida. Solo se pinta cuando transito>0. Naranja (igual
   semántica de "en movimiento" que el tote granel). jun 2026. */
function TransitoBadge({ transito, unidad }) {
  const n = Number(transito) || 0;
  if (n <= 0) return null;
  const c = 'var(--lp-warning-600)';
  return (
    <span title="En tránsito por una orden de transferencia (surtida, falta recibir en Terán)"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 18, padding: '0 8px', borderRadius: 999,
        fontSize: 10.5, fontWeight: 600, fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap',
        color: c, background: `color-mix(in srgb, ${c} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 30%, transparent)` }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      en tránsito: {n.toLocaleString('es-MX', { maximumFractionDigits: 1 })}{unidad ? ' ' + unidad : ''}
    </span>
  );
}

function PTRow({ item, canEdit, canContar, onAdjust, onContar, query, unidad, onTransferir }) {
  const { nombre, inv, pct } = item;
  /* PT vista "Total": item.displayQty = Fábrica + Terán. Env/MP no lo traen → qty real. */
  const qty = item.displayQty != null ? item.displayQty : (inv.qty || 0);
  const u = item.unidad || unidad || 'cub'; /* envases = 'pz', PT = 'cub' */
  const sev = sevOf(qty, pct);
  const clickable = canEdit || canContar;
  return (
    <div style={S.mCard(clickable)} data-id="inventario.row.item" data-rol="admin,tecnico,compras,almacen,inventario"
      role={clickable ? 'button' : undefined} onClick={() => { if (canEdit) onAdjust(item); else if (canContar && onContar) onContar(); }}>
      <div style={S.mTop}>
        <span style={S.mName}>{resaltar(nombre, query)}</span>
        <EstadoBadge qty={qty} pct={pct} />
        {canEdit && <PencilIcon />}
      </div>
      <div style={S.sevBar}><div style={S.sevFill(barPctOf(qty, inv.min || 0), sev.color)} /></div>
      <div style={S.mNums}>
        <span style={S.mQty(sev.key === 'critico')}>{qty.toLocaleString('es-MX', { maximumFractionDigits: 1 })} {u}</span>
        <span style={S.mMin}>mín {(inv.min || 0).toLocaleString('es-MX')} {u}</span>
        {inv.sku && <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }}>{inv.sku}</span>}
        {!item._env && inv.medida && <PTMedidaBadge medida={inv.medida} medidaQty={inv.medidaQty} qty={qty} />}
        {/* Desglose Fábrica/Terán cuando hay stock en Terán (vista Total, jun 2026) */}
        {(Number(item.teranQty) || 0) > 0 && (
          <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>Fáb {Math.round(item.fabQty)} · Terán {Math.round(item.teranQty)}</span>
        )}
        {/* OT (jun 2026): stock en camino Fábrica→Terán. Visible en cualquier sub-vista. */}
        <TransitoBadge transito={item.transito} unidad={u} />
        {canContar && !canEdit && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--lp-brand-700)' }}>Contar →</span>}
      </div>
      {/* Sprint Y2 (jun 2026): transferir envase/tapa de Fábrica → Terán (espeja el
          botón de PT Fábrica). Solo se pasa onTransferir en la sub-vista 'fabrica'. */}
      {onTransferir && (
        <button type="button" data-id="inventario.btn.transferir-env" data-rol="admin,almacen,inventario"
          onClick={(e) => { e.stopPropagation(); onTransferir(); }}
          style={{ ...S.btnGhost, marginTop: 10, width: '100%', color: 'var(--lp-brand-700)', borderColor: 'color-mix(in srgb, var(--lp-brand-600) 45%, transparent)' }}>
          → Terán
        </button>
      )}
    </div>
  );
}

/* ── Envases Tab (with editing) ── */
function EnvasesTab({ envases, canEdit, onReload }) {
  if (!envases) return <div style={S.empty}>Cargando envases...</div>;
  const cats = envases.categorias || {};
  const tapas = envases.tapas || {};

  const handleSaveEnvase = async (catKey, subKey, newStock, newMin) => {
    /* El backend espera el campo `subcategoria` (no `subKey`). Mandamos ambos por compatibilidad. */
    await api.post('/api/envases/stock', {
      categoria: catKey,
      subcategoria: subKey,
      subKey, /* compat */
      stock: Number(newStock) || 0,
      min: Number(newMin) || 0,
    });
    if (onReload) onReload();
  };

  const handleSaveTapa = async (tapaKey, newStock, newMin) => {
    /* Backend valida `typeof stock === 'number'`. Garantizamos números, no strings. */
    await api.post('/api/envases/tapa/stock', {
      key: tapaKey,
      stock: Number(newStock) || 0,
      min: Number(newMin) || 0,
    });
    if (onReload) onReload();
  };

  return (
    <>
      {Object.entries(cats).map(([catName, cat]) => (
        <div key={catName} style={S.section}>
          <div style={S.sectionHeader('var(--lp-brand-100)', 'var(--lp-brand-700)')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/></svg>
            {catName}
          </div>
          {Object.entries(cat.subcategorias || {}).map(([subKey, sub]) => (
            <EnvaseRow key={subKey} subKey={subKey} sub={sub} catKey={catName}
              canEdit={canEdit} onSave={handleSaveEnvase} />
          ))}
        </div>
      ))}
      {Object.keys(tapas).length > 0 && (
        <div style={S.section}>
          <div style={S.sectionHeader('var(--lp-qc-50)', 'var(--lp-qc-700)')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>
            Tapas
          </div>
          {Object.entries(tapas).map(([tapaKey, tapa]) => (
            <TapaRow key={tapaKey} tapaKey={tapaKey} tapa={tapa}
              canEdit={canEdit} onSave={handleSaveTapa} />
          ))}
        </div>
      )}
    </>
  );
}

/* Existencia + Mínimo VISIBLES + botón Ajustar — paridad con MP/PT (jun 2026,
   pedido dueño: Envases no mostraba el mínimo ni un botón claro de ajuste). */
const _lblMini = { fontSize: 9.5, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700, lineHeight: 1.2 };
function StockMinView({ qty, min, unidad, qtyColor, badgeType, badgeText, canEdit, onAjustar }) {
  return (
    <>
      <div style={{ textAlign: 'right', minWidth: 60 }}>
        <div style={_lblMini}>Exist.</div>
        <div style={S.rowQty(qtyColor)}>{qty}<span style={{ fontSize: 10, color: 'var(--lp-text-tertiary)', fontWeight: 400, marginLeft: 3 }}>{unidad}</span></div>
      </div>
      <div style={{ textAlign: 'right', minWidth: 44 }}>
        <div style={_lblMini}>Mín.</div>
        <div style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 13, fontWeight: 600, color: min > 0 ? 'var(--lp-text-secondary)' : 'var(--lp-text-tertiary)' }}>{min > 0 ? min : '—'}</div>
      </div>
      <span style={S.badge(badgeType)}>{badgeText}</span>
      {canEdit && (
        <button onClick={onAjustar} title="Ajustar existencia y mínimo"
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--lp-brand-600)', background: 'transparent', color: 'var(--lp-brand-700)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap' }}>
          Ajustar
        </button>
      )}
    </>
  );
}
function StockMinEdit({ editStock, setEditStock, editMin, setEditMin, saving, onSave, onCancel }) {
  return (
    <>
      <label style={{ ..._lblMini, display: 'inline-block' }}>Exist.
        <input type="number" inputMode="decimal" min="0" style={{ ...S.editInput, display: 'block', marginTop: 2 }} value={editStock}
          onChange={e => setEditStock(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onSave(); }} autoFocus />
      </label>
      <label style={{ ..._lblMini, display: 'inline-block' }}>Mín.
        <input type="number" inputMode="decimal" min="0" style={{ ...S.editInput, width: 55, display: 'block', marginTop: 2 }} value={editMin}
          onChange={e => setEditMin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onSave(); }} />
      </label>
      <button style={S.saveBtn} onClick={onSave} disabled={saving}>{saving ? '...' : '✓'}</button>
      <button style={{ ...S.saveBtn, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' }} onClick={onCancel}>✕</button>
    </>
  );
}

function EnvaseRow({ subKey, sub, catKey, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [editStock, setEditStock] = useState(sub.stock || 0);
  const [editMin, setEditMin] = useState(sub.min || 0);
  const [saving, setSaving] = useState(false);
  const qty = sub.stock || 0;
  const min = sub.min || 0;
  const badgeType = qty <= 0 ? 'err' : (min > 0 && qty < min) ? 'warn' : 'ok';
  const badgeText = qty <= 0 ? 'Agotado' : (min > 0 && qty < min) ? 'Bajo' : 'OK';
  const qtyColor = badgeType === 'err' ? 'var(--lp-danger-600)' : badgeType === 'warn' ? 'var(--lp-warning-600)' : 'var(--lp-text-primary)';

  const startEdit = () => { setEditStock(qty); setEditMin(min); setEditing(true); };
  const handleSave = async () => {
    setSaving(true);
    try { await onSave(catKey, subKey, parseInt(editStock) || 0, parseInt(editMin) || 0); setEditing(false); }
    catch (e) { alert('No se pudo guardar: ' + (e?.data?.error || e?.message || 'error')); }
    finally { setSaving(false); }
  };

  return (
    <div style={S.envRow}>
      <div style={S.envName}>
        {sub.nombre || subKey}
        {sub.marca && <div style={S.provSub}>{sub.marca}</div>}
      </div>
      {editing ? (
        <StockMinEdit editStock={editStock} setEditStock={setEditStock} editMin={editMin} setEditMin={setEditMin}
          saving={saving} onSave={handleSave} onCancel={() => setEditing(false)} />
      ) : (
        <StockMinView qty={qty} min={min} unidad={sub.unidad || 'pz'} qtyColor={qtyColor}
          badgeType={badgeType} badgeText={badgeText} canEdit={canEdit} onAjustar={startEdit} />
      )}
    </div>
  );
}

function TapaRow({ tapaKey, tapa, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [editStock, setEditStock] = useState(tapa.stock || 0);
  const [editMin, setEditMin] = useState(tapa.min || 0);
  const [saving, setSaving] = useState(false);
  const qty = tapa.stock || 0;
  const min = tapa.min || 0;
  const badgeType = qty <= 0 ? 'err' : (min > 0 && qty < min) ? 'warn' : 'ok';
  const badgeText = qty <= 0 ? 'Agotado' : (min > 0 && qty < min) ? 'Bajo' : 'OK';
  const qtyColor = badgeType === 'err' ? 'var(--lp-danger-600)' : badgeType === 'warn' ? 'var(--lp-warning-600)' : 'var(--lp-text-primary)';

  const startEdit = () => { setEditStock(qty); setEditMin(min); setEditing(true); };
  const handleSave = async () => {
    setSaving(true);
    try { await onSave(tapaKey, parseInt(editStock) || 0, parseInt(editMin) || 0); setEditing(false); }
    catch (e) { alert('No se pudo guardar: ' + (e?.data?.error || e?.message || 'error')); }
    finally { setSaving(false); }
  };

  return (
    <div style={S.envRow}>
      <div style={{ ...S.envName, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: tapa.color || '#ccc', flexShrink: 0, border: '1px solid var(--lp-border-subtle)' }} />
        {tapa.nombre || tapaKey}
      </div>
      {editing ? (
        <StockMinEdit editStock={editStock} setEditStock={setEditStock} editMin={editMin} setEditMin={setEditMin}
          saving={saving} onSave={handleSave} onCancel={() => setEditing(false)} />
      ) : (
        <StockMinView qty={qty} min={min} unidad="pz" qtyColor={qtyColor}
          badgeType={badgeType} badgeText={badgeText} canEdit={canEdit} onAjustar={startEdit} />
      )}
    </div>
  );
}

/* Severidad canónica: Crítico (agotado) · Bajo · OK */
function sevOf(qty, pct) {
  if (qty <= 0) return { key: 'critico', color: 'var(--lp-danger-600)', label: 'Crítico' };
  if (pct <= 100) return { key: 'bajo', color: 'var(--lp-warning-600)', label: 'Bajo' };
  return { key: 'ok', color: 'var(--lp-success-600)', label: 'OK' };
}

/* Mockup .est: pill compacta SIN punto — solo texto coloreado sobre tinte 15% */
function EstadoBadge({ qty, pct }) {
  const s = sevOf(qty, pct);
  return <span style={S.estBadge(s.color)}>{s.label}</span>;
}

/* ── Sheet "Ajustar existencia" (mockup) — usado por tabla y cards ──
   Conserva el candado: el onSave del padre pasa por ajustarConCandado. */
function AjusteSheet({ item, isDesktop, canEditMin = false, modoPropuesta = false, puedeRenombrarMP = false, onClose, onSave, onEliminar, onSustituir, onPedir }) {
  const [qty, setQty] = useState(String(item.qty ?? 0));
  const [min, setMin] = useState(String(item.min ?? 0));
  const [motivo, setMotivo] = useState('');
  /* Catálogo editable: nombre (PT y MP) + SKU (solo PT). Estos campos NO tocan
     stock: se guardan directo con auditoría.
       · PT  → /api/inventario/pt-meta (nombre + SKU; admin/inventario).
       · MP  → /api/mp/renombrar (rename CANÓNICO, propaga a inventario,
               maestro_mp, fórmulas, compras, costos y proveedores). Solo admin
               (alto impacto), por eso se gatea con `puedeRenombrarMP`. */
  const esPT = item.tipo === 'pt';
  const esMP = item.tipo === 'mp';
  const mostrarNombre = esPT || (esMP && puedeRenombrarMP);
  const [nombreEdit, setNombreEdit] = useState(item.nombre || '');
  const [skuEdit, setSkuEdit] = useState(item.sku || '');
  /* PT: medida en que se captura (tote/cubeta/galón/litro/atomizador) + cantidad
     en esa medida. La existencia base en cubetas se DERIVA de medida × cantidad. */
  const [medidaEdit, setMedidaEdit] = useState(item.medida || (item.tipo === 'pt' ? 'cubeta' : ''));
  const [cantMedida, setCantMedida] = useState(String(item.medidaQty != null ? item.medidaQty : (item.qty ?? 0)));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 120); return () => clearTimeout(t); }, []);

  const qtyNum = parseFloat(qty);                  /* MP/Env: cantidad directa */
  const cantMedidaNum = parseFloat(cantMedida);    /* PT: cantidad en la medida */
  const minNum = parseFloat(min);
  const esEnv = item.tipo === 'env';
  /* PT: la existencia base (cubetas) se DERIVA de medida × cantidad. */
  const qtyEfectiva = esPT
    ? medidaACubetas(medidaEdit, isNaN(cantMedidaNum) ? 0 : cantMedidaNum)
    : qtyNum;
  const qtyValida = esPT
    ? (cantMedida !== '' && !isNaN(cantMedidaNum) && cantMedidaNum >= 0 && !!medidaEdit)
    : (qty !== '' && !isNaN(qtyNum) && qtyNum >= 0);
  const stockChanged = (qtyValida && qtyEfectiva !== (item.qty ?? 0))
    || (canEditMin && min !== '' && !isNaN(minNum) && minNum !== (item.min ?? 0));
  const nombreChanged = mostrarNombre && nombreEdit.trim() !== '' && nombreEdit.trim() !== (item.nombre || '');
  const skuChanged = esPT && skuEdit.trim() !== String(item.sku || '');
  /* medida cambió: distinta medida, o distinta cantidad-en-medida vs lo guardado. */
  const medidaChanged = esPT && (medidaEdit !== (item.medida || 'cubeta')
    || (!isNaN(cantMedidaNum) && cantMedidaNum !== (item.medidaQty != null ? item.medidaQty : (item.qty ?? 0))));
  const metaChanged = nombreChanged || skuChanged || medidaChanged;

  const minValido = !canEditMin || (min !== '' && !isNaN(minNum) && minNum >= 0);
  /* El motivo solo es obligatorio cuando se mueve STOCK (MP/PT con candado).
     Envases no usan candado → no exigen motivo. */
  const puedeGuardar = stockChanged
    ? ((esEnv || motivo.trim().length >= 3) && qtyValida && minValido)
    : (metaChanged && qtyValida && minValido);

  const handleSave = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    try {
      /* 3er arg = nuevo mínimo (solo si el rol puede editarlo; si no, se conserva el actual).
         4to arg = metadatos de catálogo (solo PT) + flags de qué cambió. */
      await onSave(
        qtyValida ? qtyEfectiva : (item.qty ?? 0),
        motivo.trim(),
        canEditMin ? minNum : (item.min ?? 0),
        {
          stockChanged,
          metaChanged,
          nuevoNombre: nombreChanged ? nombreEdit.trim() : undefined,
          sku: skuChanged ? skuEdit.trim() : undefined,
          medida: (esPT && medidaChanged) ? (medidaEdit || '') : undefined,
          medidaQty: (esPT && medidaChanged) ? (isNaN(cantMedidaNum) ? 0 : cantMedidaNum) : undefined,
        }
      );
      onClose();
    } catch { /* el handler ya avisó; mantener abierto para reintentar */ }
    finally { setSaving(false); }
  };

  return (
    <div style={S.sheetOverlay(isDesktop)} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.sheet(isDesktop)} onClick={e => e.stopPropagation()}>
        <div style={S.shH}>Ajustar existencia</div>
        <div style={S.shS}>{item.nombre}{canEditMin ? '' : ` · mín ${(item.min ?? 0).toLocaleString('es-MX')} ${item.unidad}`}</div>
        <div style={S.bigsis}>
          <div style={S.bigK}>Existencia actual</div>
          <div style={S.bigV}>
            {esPT && item.medida
              ? <>{etiquetaMedida(item.medida, item.medidaQty)} <span style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', fontWeight: 500 }}>· {(item.qty ?? 0).toLocaleString('es-MX')} cub</span></>
              : <>{(item.qty ?? 0).toLocaleString('es-MX')} {item.unidad}</>}
          </div>
        </div>
        {/* Catálogo: nombre (PT y MP) + SKU (solo PT). Aplican directo con
            auditoría — no son stock.
              · PT: el backend bloquea renombrar PTs ligados a fórmula (la
                existencia se partiría) y SKUs duplicados.
              · MP: el rename es CANÓNICO (un solo nombre en todos los JSON) y
                solo lo ve el admin (mostrarNombre lo gatea). */}
        {mostrarNombre && (
          <>
            <label style={S.flbl}>{esPT ? 'Nombre del producto' : 'Nombre de la materia prima'}</label>
            <input style={S.finTxt} type="text" maxLength={200}
              value={nombreEdit} onChange={e => setNombreEdit(e.target.value)} />
            {esPT && (
              <>
                <label style={{ ...S.flbl, marginTop: 12 }}>SKU</label>
                <input style={S.finTxt} type="text" maxLength={64} placeholder="Ej. PT-BM4-CUB"
                  value={skuEdit} onChange={e => setSkuEdit(e.target.value)} />
              </>
            )}
            {nombreChanged && esMP && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--lp-text-tertiary)' }}>
                Al renombrar, el nombre nuevo se aplica en todo el sistema (inventario,
                fórmulas, compras y costos). No requiere código.
              </div>
            )}
            {metaChanged && esPT && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--lp-text-tertiary)' }}>
                Nombre/SKU se guardan al instante con auditoría (no requieren código).
              </div>
            )}
          </>
        )}
        {esPT ? (
          <>
            {/* Medida en que está el producto (como en envases) + cantidad en esa
                medida. La existencia en cubetas se calcula sola. */}
            <label style={{ ...S.flbl, marginTop: 12 }}>Medida</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PT_MEDIDAS.map(m => {
                const on = medidaEdit === m.key;
                return (
                  <button key={m.key} type="button" onClick={() => setMedidaEdit(m.key)}
                    style={{ height: 36, padding: '0 12px', borderRadius: 999, cursor: 'pointer',
                      fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: on ? 600 : 500,
                      border: on ? '1px solid transparent' : '1px solid var(--lp-border-subtle)',
                      background: on ? 'color-mix(in srgb, var(--lp-brand-600) 14%, transparent)' : 'var(--lp-bg-raised)',
                      color: on ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)', whiteSpace: 'nowrap' }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
            <label style={{ ...S.flbl, marginTop: 12 }}>Cantidad ({ptMedidaDef(medidaEdit)?.label || 'unidades'})</label>
            <input ref={inputRef} style={S.finQty} type="number" inputMode="decimal" step="1" min="0"
              value={cantMedida} onChange={e => setCantMedida(e.target.value)} />
            {medidaEdit !== 'cubeta' && qtyValida && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
                = <strong>{qtyEfectiva.toLocaleString('es-MX', { maximumFractionDigits: 1 })}</strong> cubetas-equivalente
              </div>
            )}
          </>
        ) : (
          <>
            <label style={{ ...S.flbl, marginTop: mostrarNombre ? 12 : 0 }}>Nueva cantidad</label>
            <input ref={inputRef} style={S.finQty} type="number" inputMode="decimal" step="0.1" min="0"
              value={qty} onChange={e => setQty(e.target.value)} />
          </>
        )}
        {canEditMin && (
          <>
            <label style={{ ...S.flbl, marginTop: 12 }}>Mínimo ({item.unidad})</label>
            <input style={S.finQty} type="number" inputMode="decimal" step="1" min="0"
              value={min} onChange={e => setMin(e.target.value)} />
          </>
        )}
        {!esEnv && (<>
        <label style={{ ...S.flbl, marginTop: 12 }}>Motivo del ajuste{stockChanged ? '' : ' (solo si mueves stock)'}</label>
        <input style={S.finTxt} type="text" maxLength={120} placeholder="Ej. Conteo físico, merma, corrección"
          value={motivo} onChange={e => setMotivo(e.target.value)} />
        </>)}
        {modoPropuesta && stockChanged && (
          <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--lp-warning-600) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--lp-warning-600) 30%, transparent)', fontSize: 12, color: 'var(--lp-warning-700)' }}>
            El cambio de <strong>stock</strong> quedará <strong>pendiente</strong> hasta que el admin lo apruebe.
            {metaChanged ? ' El nombre/SKU sí se aplica al instante.' : ''}
          </div>
        )}
        <div style={S.shActs}>
          <button style={S.act2(false)} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.act2(true), opacity: puedeGuardar && !saving ? 1 : 0.5 }}
            disabled={!puedeGuardar || saving} onClick={handleSave}>
            {saving
              ? (modoPropuesta && stockChanged ? 'Enviando…' : 'Guardando…')
              : (modoPropuesta && stockChanged ? 'Enviar a aprobación' : 'Guardar')}
          </button>
        </div>

        {/* Acciones secundarias: Pedir (PT) · Sustituir/Eliminar (MP, admin) */}
        {(onPedir || onSustituir || onEliminar) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--lp-border-subtle)', flexWrap: 'wrap' }}>
            {onPedir && (
              <button type="button" data-id="inventario.btn.pedir-pt" data-rol="admin,almacen,tecnico" onClick={onPedir}
                style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid color-mix(in srgb, var(--lp-brand-600) 40%, transparent)', background: 'transparent', color: 'var(--lp-brand-700)', fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Pedir reposición
              </button>
            )}
            {onSustituir && (
              <button type="button" data-id="inventario.btn.sustituir-mp" data-rol="admin" onClick={onSustituir}
                style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid var(--lp-border-subtle)', background: 'transparent', color: 'var(--lp-text-secondary)', fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Sustituir
              </button>
            )}
            {onEliminar && (
              <button type="button" data-id="inventario.btn.eliminar-mp" data-rol="admin" onClick={onEliminar}
                style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid color-mix(in srgb, var(--lp-danger-600) 40%, transparent)', background: 'transparent', color: 'var(--lp-danger-600)', fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tabla de inventario (escritorio) ── */
function InvTable({ items, tipo, unidad, canEdit, canDelete, canContar, mpsDisponibles, onAdjust, onAction, onPedir, canPedir, onContar, query, onTransferir }) {
  /* La columna "Acción" solo se muestra si el rol tiene ALGUNA acción posible en
     esta tabla. Antes el header "Acción" se pintaba siempre y dejaba celdas vacías
     para roles sin acciones (p.ej. inventario/Burgos: sin editarInventario) → columna
     fantasma. Ahora: si no hay acción, no se pinta la columna.
     onTransferir (envases en sub-vista Fábrica): añade el botón "→ Terán" por fila. */
  const showActionCol = canEdit || canContar || !!onTransferir || (tipo === 'mp' ? canDelete : canPedir);
  return (
    <div style={S.tablewrap}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>{tipo === 'mp' ? 'Material' : 'Producto'}</th>
            {/* Paquete MOCKUP 8 (propuesta A): gauge de nivel de stock con
                marcador del mínimo en línea */}
            <th style={{ ...S.th, width: 170 }}>Nivel de stock</th>
            <th style={{ ...S.th, textAlign: 'right' }}>Existencia</th>
            <th style={{ ...S.th, textAlign: 'right' }}>Mínimo</th>
            <th style={S.th}>Estado</th>
            {showActionCol && <th style={{ ...S.th, textAlign: 'right' }}>Acción</th>}
          </tr>
        </thead>
        <tbody>
          {items.map(it => {
            const nombre = tipo === 'mp' ? it.mp : it.nombre;
            /* PT vista "Total": it.displayQty = Fábrica + Terán. MP/Env no lo traen → qty real. */
            const qty = it.displayQty != null ? it.displayQty : (it.inv.qty || 0);
            const min = it.inv.min || 0;
            const sev = sevOf(qty, it.pct);
            const prov = tipo === 'mp' ? it.maestro?.proveedor?.principal : null;
            const lowPT = tipo === 'pt' && (qty <= 0 || it.pct <= 100);
            return (
              <tr key={nombre} data-id="inventario.row.item" data-rol="admin,tecnico,compras,almacen,inventario">
                <td style={S.td}>
                  <span style={{ fontWeight: 600 }}>{resaltar(nombre, query)}</span>
                  {prov && <span style={{ ...S.provSub, marginLeft: 8, display: 'inline' }}>· {prov}</span>}
                  {tipo === 'pt' && it.inv.sku && (
                    <span style={{ ...S.provSub, marginLeft: 8, display: 'inline', fontFamily: 'var(--lp-font-mono)' }}>· {it.inv.sku}</span>
                  )}
                  {tipo === 'pt' && it.inv.medida && (
                    <span style={{ marginLeft: 8, display: 'inline-flex', verticalAlign: 'middle' }}>
                      <PTMedidaBadge medida={it.inv.medida} medidaQty={it.inv.medidaQty} qty={qty} />
                    </span>
                  )}
                  {/* Desglose Fábrica/Terán cuando hay stock en Terán (vista Total, jun 2026) */}
                  {tipo === 'pt' && (Number(it.teranQty) || 0) > 0 && (
                    <span style={{ ...S.provSub, marginLeft: 8, display: 'inline' }}>· Fáb {Math.round(it.fabQty)} · Terán {Math.round(it.teranQty)}</span>
                  )}
                </td>
                <td style={S.td}>
                  <StockGauge qty={qty} min={min} color={sev.color} />
                </td>
                <td style={{ ...S.td, ...S.tdMono, textAlign: 'right', color: sev.key === 'critico' ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span>{qty.toLocaleString('es-MX', { maximumFractionDigits: 1 })} {unidad}</span>
                    {/* OT (jun 2026): stock en camino Fábrica→Terán. */}
                    {(Number(it.transito) || 0) > 0 && <TransitoBadge transito={it.transito} unidad={unidad} />}
                  </div>
                </td>
                <td style={{ ...S.td, ...S.tdMono, textAlign: 'right', color: 'var(--lp-text-tertiary)' }}>
                  {min.toLocaleString('es-MX')} {unidad}
                </td>
                <td style={S.td}><EstadoBadge qty={qty} pct={it.pct} /></td>
                {showActionCol && (
                <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {lowPT && canPedir && (
                    <button type="button" data-id="inventario.btn.pedir-pt" data-rol="admin,almacen,tecnico"
                      onClick={() => onPedir(nombre)}
                      style={{ ...S.btnGhost, marginRight: 8, color: 'var(--lp-brand-700)', borderColor: 'color-mix(in srgb, var(--lp-brand-600) 40%, transparent)' }}>
                      + Pedir
                    </button>
                  )}
                  {canEdit && (
                    <button type="button" data-id="inventario.btn.ajustar" data-rol="admin,tecnico,almacen,compras"
                      style={S.btnGhost} onClick={() => onAdjust(it)}>Ajustar</button>
                  )}
                  {/* Sprint Y2 (jun 2026): transferir envase/tapa de Fábrica → Terán (espeja
                      el botón de PT Fábrica). Solo en la sub-vista 'fabrica' de Envases. */}
                  {onTransferir && (
                    <button type="button" data-id="inventario.btn.transferir-env" data-rol="admin,almacen,inventario"
                      onClick={() => onTransferir(it)} title="Transferir piezas de este envase del stock de Fábrica al de Terán"
                      style={{ ...S.btnGhost, marginLeft: 8, color: 'var(--lp-brand-700)', borderColor: 'color-mix(in srgb, var(--lp-brand-600) 45%, transparent)' }}>
                      → Terán
                    </button>
                  )}
                  {/* Burgos (rol inventario): su acción es CONTAR (conteo físico), no editar.
                      Lleva a /conteo. Solo cuando no puede editar directo (evita duplicar para admin). */}
                  {canContar && !canEdit && (
                    <button type="button" data-id="inventario.btn.contar" data-rol="inventario,admin"
                      onClick={() => onContar && onContar()}
                      style={{ ...S.btnGhost, color: 'var(--lp-brand-700)', borderColor: 'color-mix(in srgb, var(--lp-brand-600) 40%, transparent)' }}>
                      Contar
                    </button>
                  )}
                  {tipo === 'mp' && canDelete && (
                    <span style={{ marginLeft: 8, display: 'inline-flex', verticalAlign: 'middle' }}>
                      <MPActionsMenu mp={nombre} mpsDisponibles={mpsDisponibles} canEdit={canDelete} onAction={onAction} />
                    </span>
                  )}
                </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Chips de filtro por severidad (Todos · Crítico · Bajo) — mockup .fchip:
   activo = tinte 16% del color + borde transparente; inactivo = borde hairline. */
function FilterChips({ activeFilter, onPick }) {
  const FILTS = [['todos', 'Todos', 'var(--lp-brand-600)'], ['sin', 'Crítico', 'var(--lp-danger-600)'], ['bajo', 'Bajo', 'var(--lp-warning-600)']];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {FILTS.map(([k, l, c]) => {
        const on = activeFilter === k;
        return (
          <button key={k} type="button" onClick={() => onPick(k)}
            style={{
              height: 34, padding: '0 11px', borderRadius: 999, cursor: 'pointer',
              fontFamily: 'var(--lp-font-sans)', fontSize: 11.5, fontWeight: on ? 600 : 500,
              border: on ? '1px solid transparent' : '1px solid var(--lp-border-subtle)',
              background: on ? `color-mix(in srgb, ${c} 16%, transparent)` : 'var(--lp-bg-raised)',
              color: on ? c : 'var(--lp-text-secondary)', whiteSpace: 'nowrap',
            }}>{l}</button>
        );
      })}
    </div>
  );
}

/* ════════ Paquete MOCKUP 8 — Inventarios v8 ════════════════════════════
   Móvil decluttered: la fila de chips se sustituye por UN botón de filtros
   (mfilt) que abre la hoja "Vista y filtros"; las acciones (Recepción MP /
   Agregar PT / Importar-Exportar-Imprimir) se mueven al FAB → hoja
   "Acciones"; los filtros activos se muestran como chips removibles.
   Escritorio: KPIs con riel + banda de atención de críticos + gauge de
   nivel de stock por fila en la tabla. */

/* Botón de filtros móvil (mockup .mfilt) con dot cuando hay filtros activos */
function MFiltBtn({ active, onClick }) {
  return (
    <button type="button" aria-label="Vista y filtros" onClick={onClick}
      style={{
        width: 48, height: 48, flexShrink: 0, borderRadius: 14, position: 'relative',
        background: 'var(--lp-bg-raised)', border: `1.5px solid ${active ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: active ? 'var(--lp-brand-600)' : 'var(--lp-text-secondary)', cursor: 'pointer',
      }}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
      {active && <span style={{ position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: '50%', background: 'var(--lp-brand-600)', border: '2px solid var(--lp-bg-raised)' }} />}
    </button>
  );
}

/* Chips de filtros ACTIVOS removibles (mockup .actchip) — móvil */
function ActiveChips({ chips }) {
  if (!chips.length) return null;
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', margin: '2px 2px 8px' }}>
      {chips.map(ch => (
        <span key={ch.key} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 6px 0 11px',
          borderRadius: 999, fontSize: 12, fontWeight: 600,
          background: 'color-mix(in srgb, var(--lp-brand-600) 11%, transparent)', color: 'var(--lp-brand-700)',
          border: '1px solid color-mix(in srgb, var(--lp-brand-600) 26%, transparent)',
        }}>
          {ch.label}
          <button type="button" aria-label={`Quitar ${ch.label}`} onClick={ch.clear}
            style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'color-mix(in srgb, var(--lp-brand-600) 18%, transparent)', color: 'inherit', padding: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </span>
      ))}
    </div>
  );
}

/* Hoja "Vista y filtros" móvil (mockup .vsheet): Estado / Vista / Almacén PT */
function VistaFiltrosSheet({ activeTab, activeFilter, onFilter, mpSubtab, onMpSubtab, ptSubtab, onPtSubtab, onClose }) {
  const opt = (on) => ({
    height: 44, padding: '0 16px', borderRadius: 13, cursor: 'pointer',
    border: on ? '1.5px solid transparent' : '1.5px solid var(--lp-border-subtle)',
    background: on ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)', color: on ? '#fff' : 'var(--lp-text-primary)',
    fontFamily: 'var(--lp-font-sans)', fontSize: 14, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  });
  const grp = { marginBottom: 18 };
  const lbl = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', margin: '0 2px 9px' };
  const row = { display: 'flex', gap: 8, flexWrap: 'wrap' };
  const FILTS = [['todos', 'Todos', null], ['sin', 'Crítico', 'var(--lp-danger-600)'], ['bajo', 'Bajo', 'var(--lp-warning-600)']];
  return (
    <div style={S.sheetOverlay(false)} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.sheet(false)} onClick={e => e.stopPropagation()}>
        <div style={S.shH}>Vista y filtros</div>
        <div style={S.shS}>Ajusta qué ves del inventario.</div>
        <div style={grp}>
          <div style={lbl}>Estado</div>
          <div style={row}>
            {FILTS.map(([k, l, c]) => (
              <button key={k} type="button" style={opt(activeFilter === k)} onClick={() => onFilter(k)}>
                {c && <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeFilter === k ? '#fff' : c }} />}{l}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'mp' && (
          <div style={grp}>
            <div style={lbl}>Vista</div>
            <div style={row}>
              {[['stock', 'Stock'], ['costos', 'Costos'], ['maestro', 'Maestro']].map(([k, l]) => (
                <button key={k} type="button" style={opt(mpSubtab === k)} onClick={() => onMpSubtab(k)}>{l}</button>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'pt' && (
          <div style={grp}>
            <div style={lbl}>Almacén</div>
            <div style={row}>
              {[['total', 'Total'], ['fabrica', 'Fábrica'], ['teran', 'Terán']].map(([k, l]) => (
                <button key={k} type="button" style={opt(ptSubtab === k)} onClick={() => onPtSubtab(k)}>{l}</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', marginTop: 4 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, height: 50, borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 14.5, fontWeight: 600, background: 'var(--lp-brand-600)', color: '#fff' }}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

/* Hoja "Acciones" móvil (mockup .asheet, la abre el FAB) — acciones REALES */
function AccionesSheet({ rows, importExportNode, onClose }) {
  return (
    <div style={S.sheetOverlay(false)} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.sheet(false)} onClick={e => e.stopPropagation()}>
        <div style={S.shH}>Acciones</div>
        <div style={S.shS}>Operaciones sobre el inventario.</div>
        <div>
          {rows.map(r => (
            <button key={r.key} type="button" onClick={() => { onClose(); r.onClick(); }}
              data-id={r.dataId} data-rol={r.dataRol}
              style={{
                display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '14px 6px',
                border: 'none', borderBottom: '1px solid var(--lp-border-subtle)', background: 'none',
                cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 15, fontWeight: 500,
                color: 'var(--lp-text-primary)', textAlign: 'left',
              }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--lp-bg-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-brand-600)', flexShrink: 0 }}>{r.icon}</span>
              <span style={{ flex: 1 }}>{r.label}<div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', fontWeight: 400, marginTop: 1 }}>{r.desc}</div></span>
            </button>
          ))}
          {importExportNode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 6px' }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--lp-bg-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-brand-600)', flexShrink: 0 }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </span>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--lp-text-primary)' }}>
                Importar / Exportar / Imprimir
                <div style={{ marginTop: 6 }}>{importExportNode}</div>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* KPIs de escritorio (mockup .kpis, propuesta A "Centro de control") */
function KpisInventario({ items, tipo, unidad }) {
  const crit = items.filter(i => (i.inv.qty || 0) <= 0);
  const bajo = items.filter(i => (i.inv.qty || 0) > 0 && i.pct <= 100);
  /* Valor estimado SOLO con costo real (maestro.costo.costoKg en MP);
     sin dato → '—' (no se inventan precios). */
  let valor = null;
  if (tipo === 'mp') {
    let suma = 0, con = 0;
    items.forEach(i => {
      const ck = Number(i.maestro?.costo?.costoKg);
      if (ck > 0) { suma += (i.inv.qty || 0) * ck; con++; }
    });
    if (con > 0) valor = suma;
  }
  const money = (n) => n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : '$' + Math.round(n).toLocaleString('es-MX');
  const noun = tipo === 'env' ? 'envases' : tipo === 'pt' ? 'productos' : 'materia prima';
  const K = [
    ['SKUs activos', String(items.length), noun, 'var(--lp-brand-600)', 'var(--lp-text-primary)'],
    ['En crítico', String(crit.length), 'Reabastecer ya', 'var(--lp-danger-600)', 'var(--lp-danger-600)'],
    ['Stock bajo', String(bajo.length), 'Por debajo del mínimo', 'var(--lp-warning-600)', 'var(--lp-warning-600)'],
    ['Valor estimado', valor != null ? money(valor) : '—', valor != null ? `Inventario ${tipo.toUpperCase()}` : 'Sin costo unitario', 'var(--lp-info-600)', 'var(--lp-text-primary)'],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
      {K.map(([l, v, s, c, vc]) => (
        <div key={l} style={{ background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 16, padding: '15px 17px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: c }} />
          <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)' }}>{l}</div>
          <div style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 26, fontWeight: 700, letterSpacing: '-.01em', marginTop: 7, color: vc }}>{v}</div>
          <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 3 }}>{s}</div>
        </div>
      ))}
    </div>
  );
}

/* Banda de atención de críticos (mockup .att) — escritorio, MP/Envases */
function BandaAtencion({ criticos, unidad, canOC, onGenerarOC }) {
  if (!criticos.length) return null;
  const c0 = criticos[0];
  const nombre0 = c0.mp || c0.nombre;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, borderRadius: 14, padding: '13px 16px', marginBottom: 16,
      background: 'color-mix(in srgb, var(--lp-danger-600) 7%, var(--lp-bg-raised))',
      border: '1px solid color-mix(in srgb, var(--lp-danger-600) 28%, transparent)',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--lp-danger-600) 14%, transparent)', color: 'var(--lp-danger-600)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lp-text-primary)' }}>
          {criticos.length} material{criticos.length > 1 ? 'es' : ''} en crítico requiere{criticos.length > 1 ? 'n' : ''} atención
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 1 }}>
          {nombre0} en {(c0.inv.qty || 0).toLocaleString('es-MX')} {unidad} · revisa OCs pendientes con Compras
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700, padding: '6px 11px', borderRadius: 9, background: 'color-mix(in srgb, var(--lp-danger-600) 12%, transparent)', color: 'var(--lp-danger-600)', whiteSpace: 'nowrap' }}>
          {nombre0} · {(c0.inv.qty || 0).toLocaleString('es-MX')} {unidad}
        </span>
        {canOC && (
          <button type="button" data-id="inventario.btn.generar-oc" data-rol="compras,admin" onClick={onGenerarOC}
            style={{ height: 40, padding: '0 14px', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 600, background: 'var(--lp-brand-600)', color: '#fff', whiteSpace: 'nowrap' }}>
            Generar OC
          </button>
        )}
      </div>
    </div>
  );
}

/* Gauge de nivel de stock por fila (mockup .gauge) — tabla de escritorio */
function StockGauge({ qty, min, color }) {
  const max = Math.max(qty, min) * 1.25 || 1;
  const fillPct = Math.max(2, Math.min(100, (qty / max) * 100));
  const minPct = Math.min(100, (min / max) * 100);
  return (
    <div style={{ width: 150 }}>
      <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'var(--lp-bg-sunken)' }}>
        <div style={{ height: '100%', borderRadius: 99, width: fillPct + '%', background: color }} />
        <div style={{ position: 'absolute', top: -3, width: 2, height: 14, borderRadius: 2, background: 'var(--lp-text-secondary)', opacity: .55, left: minPct + '%' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: 'var(--lp-font-mono)', fontSize: 11 }}>
        <span style={{ color }}>{(qty || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</span>
        <span style={{ color: 'var(--lp-text-tertiary)' }}>mín {(min || 0).toLocaleString('es-MX')}</span>
      </div>
    </div>
  );
}

/* ================================================================ */
/* MAIN COMPONENT                                                    */
/* ── Modal de revisión de importación Excel (paso 2: confirmar) ──────────── */
function ImportPreviewModal({ data, onClose, onConfirmed, modoPropuesta = false }) {
  const [saving, setSaving] = useState(false);
  const esPT = data.tipo === 'pt';
  const unidad = esPT ? 'cub' : 'kg';
  const preview = data.preview || {};
  const r = preview.resumen || {};
  const validos = preview.validos || [];
  const errores = preview.errores || [];

  const confirmar = async () => {
    setSaving(true);
    try {
      const res = await api.confirmarImport(data.importId);
      onConfirmed(res?.cambios ?? res?.n ?? validos.length, res?.pendiente === true);
    } catch (e) {
      alert('No se pudo aplicar la importación: ' + (e?.data?.error || e?.message || 'error'));
      setSaving(false);
    }
  };

  const ov = { position: 'fixed', inset: 0, background: 'rgba(26,24,21,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const box = { background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius-lg)', border: '1px solid var(--lp-border-subtle)', width: '100%', maxWidth: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column' };
  const chip = (c, bg) => ({ display: 'inline-flex', alignItems: 'baseline', gap: 5, padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: bg, color: c });
  const th = { textAlign: 'left', padding: '6px 8px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', position: 'sticky', top: 0, background: 'var(--lp-bg-sunken)' };
  const td = { padding: '6px 8px', fontSize: 12, borderTop: '1px solid var(--lp-border-subtle)' };

  return (
    <div style={ov} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 18px 10px' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Revisar importación · {esPT ? 'Producto terminado' : 'Materia prima'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 3 }}>
            {r.hoja ? `Hoja "${r.hoja}" · columnas detectadas: ${r.columnas?.nombre} / ${r.columnas?.qty}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <span style={chip('var(--lp-brand-700)', 'color-mix(in srgb,var(--lp-brand-600) 14%,transparent)')}>{r.validos || 0} a aplicar</span>
            {r.nuevos > 0 && <span style={chip('var(--lp-info-600)', 'color-mix(in srgb,var(--lp-info-600) 14%,transparent)')}>{r.nuevos} nuevos</span>}
            {r.actualizados > 0 && <span style={chip('var(--lp-text-secondary)', 'var(--lp-bg-sunken)')}>{r.actualizados} actualizados</span>}
            {r.sinCambio > 0 && <span style={chip('var(--lp-text-tertiary)', 'var(--lp-bg-sunken)')}>{r.sinCambio} sin cambio</span>}
            {r.errores > 0 && <span style={chip('var(--lp-danger-600)', 'color-mix(in srgb,var(--lp-danger-600) 14%,transparent)')}>{r.errores} con error</span>}
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 18px', flex: 1 }}>
          {validos.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>{esPT ? 'Producto' : 'Materia prima'}</th>
                <th style={{ ...th, textAlign: 'right' }}>Antes</th>
                <th style={{ ...th, textAlign: 'right' }}>Nuevo</th>
                <th style={th}></th>
              </tr></thead>
              <tbody>
                {validos.map((v, i) => (
                  <tr key={i}>
                    <td style={td}>{v.mp}{v.original ? <span style={{ color: 'var(--lp-text-tertiary)' }}> · {v.original}</span> : ''}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)' }}>{v.qtyAnterior != null ? v.qtyAnterior.toLocaleString('es-MX') : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700 }}>{v.qtyNuevo.toLocaleString('es-MX')} {unidad}</td>
                    <td style={td}>{v.esNuevo ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--lp-info-600)' }}>NUEVO</span> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {errores.length > 0 && (
            <div style={{ marginTop: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-danger-600)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Filas con error (se omitirán)</div>
              {errores.slice(0, 30).map((e, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'var(--lp-text-secondary)', padding: '2px 0' }}>Fila {e.fila}: <strong>{e.nombre || '—'}</strong> — {e.error} ({e.valor})</div>
              ))}
            </div>
          )}
          {validos.length === 0 && errores.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--lp-text-tertiary)', fontSize: 13 }}>No hay cambios para aplicar (todo coincide con el inventario actual).</div>
          )}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={{ height: 44, padding: '0 16px', borderRadius: 'var(--lp-radius-md)', border: '1px solid var(--lp-border-default)', background: 'transparent', color: 'var(--lp-text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>Cancelar</button>
          <button onClick={confirmar} disabled={saving || validos.length === 0} style={{ height: 44, padding: '0 20px', borderRadius: 'var(--lp-radius-md)', border: 'none', background: 'var(--lp-brand-600)', color: '#fff', cursor: (saving || validos.length === 0) ? 'default' : 'pointer', fontWeight: 700, fontSize: 13.5, opacity: (saving || validos.length === 0) ? .6 : 1 }}>
            {saving ? (modoPropuesta ? 'Enviando…' : 'Aplicando…') : (modoPropuesta ? `Enviar a aprobación (${validos.length})` : `Confirmar e importar (${validos.length})`)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal del admin: aprobar / rechazar ajustes propuestos ─────────────── */
function AprobarAjustesModal({ pendientes, onClose, onResolved }) {
  const [busyId, setBusyId] = useState(null);
  const [confirm, ConfirmEl] = useConfirm();
  const fmtFecha = (iso) => { try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  const aprobar = async (id) => {
    setBusyId(id);
    try { await api.aprobarAjuste(id); onResolved(); }
    catch (e) { alert('No se pudo aprobar: ' + (e?.data?.error || e?.message || 'error')); setBusyId(null); }
  };
  const rechazar = async (id) => {
    /* useConfirm en vez de window.prompt: en iOS PWA standalone el prompt nativo
       se descarta en silencio → el admin creía que rechazó sin hacerlo. */
    const m = await confirm('¿Rechazar este ajuste? No se aplicará al inventario.', {
      title: 'Rechazar ajuste', confirmText: 'Rechazar', danger: true,
      prompt: { label: 'Motivo (opcional)', placeholder: 'Ej: no procede, error de captura…', rows: 2 },
    });
    if (m === null) return; /* canceló (useConfirm con prompt devuelve null al cerrar) */
    setBusyId(id);
    try { await api.rechazarAjuste(id, m || ''); onResolved(); }
    catch (e) { alert('No se pudo rechazar: ' + (e?.data?.error || e?.message || 'error')); setBusyId(null); }
  };
  const ov = { position: 'fixed', inset: 0, background: 'rgba(26,24,21,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const box = { background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius-lg)', border: '1px solid var(--lp-border-subtle)', width: '100%', maxWidth: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column' };
  const lbl = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', fontWeight: 600 };
  return (
    <div style={ov} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 18px 8px' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Ajustes por aprobar</div>
          <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 3 }}>Cambios propuestos por inventario. Al aprobar se aplican y quedan auditados.</div>
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 18px', flex: 1 }}>
          {pendientes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--lp-text-tertiary)', fontSize: 13 }}>No hay propuestas pendientes.</div>
          ) : pendientes.map(p => {
            const esImport = p.tipo === 'import_mp' || p.tipo === 'import_pt';
            const u = (p.tipo === 'mp' || p.tipo === 'import_mp') ? 'kg' : 'cub';
            const qChg = Number(p.qtyActual) !== Number(p.qtyPropuesto);
            const mChg = Number(p.minActual) !== Number(p.minPropuesto);
            const items = p.items || [];
            return (
              <div key={p.id} style={{ border: '1px solid var(--lp-border-subtle)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: esImport ? 'color-mix(in srgb,var(--lp-info-600) 14%,transparent)' : 'var(--lp-bg-sunken)', color: esImport ? 'var(--lp-info-600)' : 'var(--lp-text-secondary)' }}>{esImport ? ('IMPORT ' + (p.tipo === 'import_mp' ? 'MP' : 'PT')) : p.tipo.toUpperCase()}</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{p.nombre}</span>
                </div>
                {esImport ? (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 6 }}>{items.length} ítems{p.archivo ? ` · ${p.archivo}` : ''}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)', background: 'var(--lp-bg-sunken)', borderRadius: 8, padding: '6px 8px', maxHeight: 96, overflowY: 'auto' }}>
                      {items.slice(0, 6).map((it, i) => (
                        <div key={i}>{it.nombre}: <span style={{ opacity: .7 }}>{it.qtyAnterior != null ? Number(it.qtyAnterior).toLocaleString('es-MX') : '—'}</span> → {Number(it.qtyNuevo).toLocaleString('es-MX')} {u}</div>
                      ))}
                      {items.length > 6 && <div>+{items.length - 6} más…</div>}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 8 }}>
                      {qChg && <div><div style={lbl}>Existencia</div><div style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 14 }}><span style={{ color: 'var(--lp-text-tertiary)' }}>{Number(p.qtyActual).toLocaleString('es-MX')}</span> → <strong>{Number(p.qtyPropuesto).toLocaleString('es-MX')} {u}</strong></div></div>}
                      {mChg && <div><div style={lbl}>Mínimo</div><div style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 14 }}><span style={{ color: 'var(--lp-text-tertiary)' }}>{Number(p.minActual).toLocaleString('es-MX')}</span> → <strong>{Number(p.minPropuesto).toLocaleString('es-MX')} {u}</strong></div></div>}
                      {!qChg && !mChg && <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)' }}>Sin cambios numéricos.</div>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 10 }}>“{p.motivo}” · <span style={{ color: 'var(--lp-text-tertiary)' }}>{p.propuestoPor} · {fmtFecha(p.fechaPropuesta)}</span></div>
                  </>
                )}
                {esImport && <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', marginBottom: 10 }}>{p.propuestoPor} · {fmtFecha(p.fechaPropuesta)}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => rechazar(p.id)} disabled={busyId === p.id} style={{ height: 40, padding: '0 14px', borderRadius: 'var(--lp-radius-md)', border: '1px solid color-mix(in srgb,var(--lp-danger-600) 30%,transparent)', background: 'transparent', color: 'var(--lp-danger-600)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Rechazar</button>
                  <button onClick={() => aprobar(p.id)} disabled={busyId === p.id} style={{ height: 40, padding: '0 18px', borderRadius: 'var(--lp-radius-md)', border: 'none', background: 'var(--lp-brand-600)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>{busyId === p.id ? '…' : 'Aprobar'}</button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 42, padding: '0 18px', borderRadius: 'var(--lp-radius-md)', border: '1px solid var(--lp-border-default)', background: 'transparent', color: 'var(--lp-text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>Cerrar</button>
        </div>
      </div>
      {ConfirmEl}
    </div>
  );
}

/* ================================================================ */
export default function InventarioPage() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  /* CTA "Pedir reposición" para PT bajo/agotado — visible para roles que pueden
     crear pedidos (Josué/almacen, Enrique/tecnico, admin). */
  const canPedirPT = can('crearPedidos') || (user && ['admin','almacen','tecnico'].includes(user.rol));
  const handlePedirPT = (nombre) => {
    /* Navegar a PedidosPage con el producto prellenado en query string */
    navigate(`/pedidos?nuevo=${encodeURIComponent(nombre)}`);
  };
  /* Acción del rol inventario (Burgos): ir a Conteo físico (su flujo de ajuste). */
  const handleContar = () => navigate('/conteo');

  /* ── OT (jun 2026): "Transferir a Terán" ya NO mueve stock al instante.
     Ahora CREA una solicitud de Orden de Transferencia (OT): navega a la
     pantalla de OT con el ítem precargado vía `?nueva=<encoded>`. La OT pasa
     por dos escaneos (surtir en Fábrica → recibir en Terán) y es auditable.

     CONTRATO de `?nueva=`: JSON URL-encoded con la línea canónica que la OT
     espera (mismos campos que routes/transferencias.js `_validarLineaEntrada`):
       PT     → { tipo:'pt',     producto, nombre, unidad:'cub' }
       envase → { tipo:'envase', catKey, subKey, nombre, unidad:'pz' }
       tapa   → { tipo:'tapa',   tapaKey, nombre, unidad:'pz' }
     La pantalla de OT (TransferenciasPage) lee este query y pre-abre el sheet
     "Nueva OT" con esa línea. Mantenemos los modales instantáneos
     (TransferirPTTeranModal / TransferirEnvaseTeranModal) montados pero el
     flujo NORMAL del botón es la OT. */
  const irASolicitudOT = useCallback((linea) => {
    navigate('/transferencias?nueva=' + encodeURIComponent(JSON.stringify(linea)));
  }, [navigate]);
  /* Construye la línea OT desde un item PT (por nombre) o desde un item de
     envItems (trae item._env). */
  const otLineaDePT = (nombre) => ({ tipo: 'pt', producto: nombre, nombre, unidad: 'cub' });
  const otLineaDeEnv = (item) => {
    const e = item?._env || {};
    if (e.tipo === 'tapa') return { tipo: 'tapa', tapaKey: e.tapaKey, nombre: item.nombre, unidad: 'pz' };
    return { tipo: 'envase', catKey: e.catKey, subKey: e.subKey, nombre: item.nombre, unidad: 'pz' };
  };
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'mp');
  const [mpSubtab, setMpSubtab] = useState(searchParams.get('mp') || 'stock'); /* stock | fabrica | teran | costos | maestro */
  /* Sprint X (jun 2026, pedido dueño): modal "Agregar MP a almacén". { ubicacion } */
  const [agregarMpUbic, setAgregarMpUbic] = useState(null);
  /* Sprint X: modal "Agregar PT a almacén" (fábrica = qty / Terán = pool manual). { ubicacion } */
  const [agregarPtUbic, setAgregarPtUbic] = useState(null);
  /* Parte B (jun 2026): transferencia manual PT Fábrica→Terán. { producto } */
  const [transferirPt, setTransferirPt] = useState(null);
  const [reenvasarTeran, setReenvasarTeran] = useState(null); /* { producto, scalar } */
  /* Sprint Y2 (jun 2026): transferencia manual de ENVASE/TAPA Fábrica→Terán.
     Guarda el item completo de envItems (trae item._env para el contrato del backend). */
  const [transferirEnv, setTransferirEnv] = useState(null);
  /* W3 (jun 2026): sub-vista para PT por ubicación. 'total' usa inv.pt agregado;
     'fabrica' y 'teran' usan /api/inventario/pt-por-ubicacion (desde trazabilidad). */
  const [ptSubtab, setPtSubtab] = useState(searchParams.get('pt') || 'total');
  /* Sprint Y2 (jun 2026): sub-vista de Envases (espeja ptSubtab). 'total' = stock+teran,
     'fabrica' = stock, 'teran' = teran. Cambia el qty MOSTRADO y habilita el botón
     "Transferir a Terán" (solo en 'fabrica'). */
  const [envSubtab, setEnvSubtab] = useState('total');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('filter') || 'todos');
  /* Sync URL → estado: si navegas a /inventario?tab=pt&pt=fabrica (p.ej. desde el
     asistente) estando YA en Inventario, react-router NO remonta y el useState
     inicial no se vuelve a leer; este efecto aplica la pestaña y sub-pestaña del
     query. Setear al mismo valor es no-op (no provoca loop). */
  useEffect(() => {
    const tab = searchParams.get('tab'); if (tab) setActiveTab(tab);
    const mp = searchParams.get('mp'); if (mp) setMpSubtab(mp);
    const pt = searchParams.get('pt'); if (pt) setPtSubtab(pt);
  }, [searchParams]);
  /* Paquete MOCKUP 8 — hojas móviles "Vista y filtros" (mfilt) y "Acciones" (FAB) */
  const [vSheetOpen, setVSheetOpen] = useState(false);
  const [aSheetOpen, setASheetOpen] = useState(false);
  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [showRecepcion, setShowRecepcion] = useState(false);
  const [showAgregarPT, setShowAgregarPT] = useState(false);
  const [showAgregarEnv, setShowAgregarEnv] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [confirm, ConfirmEl] = useConfirm();
  const [eliminarMP, setEliminarMP] = useState(null);
  const [sustituirMP, setSustituirMP] = useState(null);
  /* AG2 (jun 2026): escritorio = tabla, móvil = cards. Sheet "Ajustar existencia" compartido. */
  const isDesktop = useIsDesktop();
  const [ajusteItem, setAjusteItem] = useState(null);
  /* Importación Excel en 2 pasos: el backend devuelve {importId, preview}; aquí se revisa
     y se confirma. { importId, preview, tipo:'mp'|'pt' } */
  const [importPreview, setImportPreview] = useState(null);
  /* Cola de aprobación: el rol inventario propone, el admin aprueba. */
  const [showAprobar, setShowAprobar] = useState(false);
  /* Mockup: borde acento del buscador al enfocar (inline styles no tienen :focus-within) */
  const [searchFocus, setSearchFocus] = useState(false);

  /* Fetch data */
  const { data: invData, loading: invLoading, reload: reloadInv } = useApiData(() => api.getInventario(), [], 8000);
  const { data: maestroData } = useApiData(() => api.getMaestroMP(), [], 15000);
  const { data: envData, reload: reloadEnv } = useApiData(() => api.getEnvases(), [], 15000);
  /* W3: stock PT desglosado por ubicación física (desde trazabilidad) */
  const { data: ptUbiData, reload: reloadPtUbi } = useApiData(() => api.getPTPorUbicacion(), [], 15000);
  /* Sprint X: stock MP desglosado por almacén (fábrica/Terán) — inv.mp[X].ubic */
  const { data: mpUbiData, reload: reloadMpUbi } = useApiData(() => api.getMPPorUbicacion(), [], 15000);
  /* Cola de aprobación de ajustes (propuestas pendientes). */
  const { data: pendData, reload: reloadPendientes } = useApiData(() => api.getAjustesPendientes(), null, 25000);
  const pendientes = pendData?.pendientes || [];

  /* FIX jun 2026 (K1): InventarioPage solo polleaba cada 8s. Cualquier
     movimiento (recepción MP, ajuste por conteo, descuento por producción)
     tardaba hasta 8s en aparecer. Realtime cierra el gap. */
  useRealtimeSync({
    onInventario:   () => { reloadInv(); reloadPtUbi(); reloadMpUbi(); reloadPendientes(); },
    onEnvases:      () => reloadEnv(),
    onPrecios:      () => reloadInv(),
    onTrazabilidad: () => reloadPtUbi(), /* W3: sublotes mueven ubicación → refrescar tabla */
  });

  const inventory = invData?.data || {};
  const maestro = maestroData?.data || maestroData || null;

  /* Permissions */
  const canEditMP = can('editarInventario');
  /* Transferir PT a Terán: Josué (almacen) + admin + inventario (espeja el backend). */
  const canTransferirPT = !!user && ['admin', 'almacen', 'inventario'].includes(user.rol);
  /* Reenvasar en Terán: tote/granel → cubetas/galones (espeja gate backend). */
  const canReenvasar = !!user && ['admin', 'almacen', 'tecnico'].includes(user.rol);
  /* Transferir ENVASE/TAPA a Terán: mismo gate que PT (admin/almacen/inventario),
     espeja el backend POST /api/envases/transferir-teran. Sprint Y2 (jun 2026). */
  const canTransferirEnv = !!user && ['admin', 'almacen', 'inventario'].includes(user.rol);
  /* Alineado con el backend (POST /api/envases/stock|tapa/stock): admin / compras
     / inventario. Antes mostraba el botón a técnico (editarInventario) que luego
     recibía 403 al guardar. */
  const canEditEnvases = ['admin', 'compras', 'inventario'].includes(user?.rol);
  /* §8 (handoff verde): eliminar/sustituir MP es exclusivo del permiso `eliminarMP`
     (admin por defecto) — NO de cualquiera con editarInventario. */
  const canDeleteMP = can('eliminarMP');
  /* §8: +Recepción MP gateado por permiso `recibirMP` (almacen/compras/admin). */
  const canRecibirMP = can('recibirMP');
  /* Conteo físico (rol inventario/Burgos): su acción real en la columna Acción. */
  const canContar = can('conteoFisico');
  /* Editar mínimos (política de reorden) — permiso propio, separado de editarInventario. */
  const canEditMinimos = can('editarMinimos');
  /* El rol inventario (Burgos) y demás NO-admin PROPONEN cambios → quedan pendientes
     de aprobación del admin. El admin (Emmanuel) aplica directo con su candado. */
  const esProponente = !!user && user.rol !== 'admin' && (canEditMP || canEditMinimos);
  const esAdmin = user?.rol === 'admin';

  /* Lista de MPs disponibles para el datalist de sustituir */
  const mpsDisponibles = useMemo(
    () => Object.keys(inventory.mp || {}).sort(),
    [inventory.mp]
  );

  const handleMPAction = useCallback((action, mp) => {
    if (action === 'eliminar') setEliminarMP(mp);
    else if (action === 'sustituir') setSustituirMP(mp);
  }, []);

  /* Role-based tab visibility.
     W3: PT visible para Josué (almacen) — necesita ver lo que tiene Fábrica
     para pedir producto terminado. Solo recolector queda sin PT. */
  const rol = user?.rol || '';
  const hideMP = rol === 'almacen' || rol === 'recolector';
  const hidePT = rol === 'recolector';

  const tabs = useMemo(() => {
    const t = [];
    if (!hideMP) t.push({ id: 'mp', label: 'Materia Prima' });
    if (!hidePT) t.push({ id: 'pt', label: 'Producto Terminado' });
    t.push({ id: 'env', label: 'Envases' });
    return t;
  }, [hideMP, hidePT]);

  /* Sync tab from URL params */
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    const urlFilter = searchParams.get('filter');
    if (urlTab && tabs.some(t => t.id === urlTab)) setActiveTab(urlTab);
    if (urlFilter) setActiveFilter(urlFilter);
  }, [searchParams, tabs]);

  /* Default to first available tab */
  useEffect(() => {
    const ids = tabs.map(t => t.id);
    if (!ids.includes(activeTab)) setActiveTab(ids[0] || 'mp');
  }, [tabs, activeTab]);

  /* ── Build MP items ── */
  const mpItems = useMemo(() => {
    if (activeTab !== 'mp') return [];
    const items = [];
    const mpInv = inventory.mp || {};

    if (maestro?.mps) {
      Object.entries(maestro.mps).forEach(([mp, d]) => {
        if (d.estado === 'eliminado') return;
        if (d.estado === 'oculto') return;
        let qty = d.stock?.qty || 0;
        let min = d.stock?.min || 0;
        const live = mpInv[mp];
        if (live) { qty = live.qty || 0; min = live.min || 0; }
        const pct = min > 0 ? Math.round((qty / min) * 100) : 999;
        items.push({ mp, inv: { qty, min }, pct, maestro: d });
      });
    } else {
      Object.entries(mpInv).forEach(([mp, inv]) => {
        const pct = inv.min > 0 ? Math.round((inv.qty / inv.min) * 100) : 999;
        items.push({ mp, inv, pct, maestro: null });
      });
    }
    items.sort((a, b) => a.mp.localeCompare(b.mp));
    return items;
  }, [activeTab, inventory.mp, maestro]);

  /* ── Build PT items ── */
  const ptItems = useMemo(() => {
    if (activeTab !== 'pt') return [];
    const ptInv = inventory.pt || {};
    return Object.entries(ptInv)
      .map(([nombre, inv]) => {
        /* Vista "Total" = Fábrica (qty) + Terán (teran). Antes mostraba solo qty
           (Fábrica) pese a que el hint promete "Suma fábrica + Terán" (fix jun 2026). */
        const fabQty = Number(inv.qty) || 0;
        const teranQty = Number(inv.teran) || 0;
        const totalQty = fabQty + teranQty;
        const pct = inv.min > 0 ? Math.round((totalQty / inv.min) * 100) : 999;
        /* OT (jun 2026): expone `transito` al nivel del item (igual que envItems)
           para que PTRow/InvTable pinten el badge "en tránsito: N". El inv.pt del
           backend OT lleva { qty, transito, teran, min }. */
        return { nombre, inv, pct, transito: Number(inv.transito) || 0, teranQty, fabQty, displayQty: totalQty };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [activeTab, inventory.pt]);

  /* ── Filter by KPI click ── */
  const filterFn = useCallback((items, getQty, getPct) => {
    if (activeFilter === 'todos') return items;
    return items.filter(it => {
      const qty = getQty(it);
      const pct = getPct(it);
      if (activeFilter === 'sin') return qty <= 0;
      if (activeFilter === 'bajo') return qty > 0 && pct <= 100;
      if (activeFilter === 'ok') return qty > 0 && pct > 100;
      return true;
    });
  }, [activeFilter]);

  /* ── Filter by search + KPI filter ── */
  const filteredMP = useMemo(() => {
    let items = filterFn(mpItems, it => it.inv.qty || 0, it => it.pct);
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      items = items.filter(it => it.mp.toLowerCase().includes(q));
    }
    return items;
  }, [mpItems, debouncedQuery, filterFn]);

  const filteredPT = useMemo(() => {
    let items = filterFn(ptItems, it => (it.displayQty != null ? it.displayQty : (it.inv.qty || 0)), it => it.pct);
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      /* También por SKU (catálogo PT, jun 2026) — Burgos busca por etiqueta */
      items = items.filter(it => it.nombre.toLowerCase().includes(q)
        || String(it.inv.sku || '').toLowerCase().includes(q));
    }
    return items;
  }, [ptItems, debouncedQuery, filterFn]);

  /* ── Group MP by category ── */
  const mpGrouped = useMemo(() => {
    const groups = {};
    const uncategorized = [];
    filteredMP.forEach(item => {
      const cat = item.maestro?.categoria;
      if (cat && MP_CATEGORIES[cat]) {
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
      } else {
        uncategorized.push(item);
      }
    });
    return { groups, uncategorized };
  }, [filteredMP]);

  /* ── Build Envases items (aplana categorías→subcategorías + tapas) en el mismo
     shape que MP/PT para reusar InvTable/PTRow/AjusteSheet. Sprint Y jun 2026. ── */
  const ENV_GRUPOS = ['Litro', 'Galón', 'Cubeta', 'Otros', 'Tapas'];
  const envItems = useMemo(() => {
    if (activeTab !== 'env') return [];
    const data = envData?.data || envData || {};
    const cats = data.categorias || {};
    const tapas = data.tapas || {};
    const out = [];
    /* qty MOSTRADO según la sub-vista: Terán→teran, Fábrica→stock, Total→stock+teran+transito.
       `stock` (Fábrica), `teran` (Terán) y `transito` (en camino vía OT) son campos
       independientes del envases.json; teran/transito son opcionales (default 0 si
       ausentes). En Total se incluye el tránsito (las OTs surtidas que aún no se
       reciben) para que el conteo NO "desaparezca" mientras viaja. El min se conserva. */
    const qtyView = (stock, teran, transito) => envSubtab === 'teran' ? teran : envSubtab === 'fabrica' ? stock : stock + teran + transito;
    Object.entries(cats).forEach(([catName, cat]) => {
      Object.entries(cat.subcategorias || {}).forEach(([subKey, sub]) => {
        const fabrica = Number(sub.stock) || 0, teran = Number(sub.teran) || 0, transito = Number(sub.transito) || 0, min = Number(sub.min) || 0;
        const qty = qtyView(fabrica, teran, transito);
        out.push({
          nombre: sub.nombre || subKey, inv: { qty, min }, teran, transito,
          pct: min > 0 ? Math.round((qty / min) * 100) : 999,
          grupo: catName, unidad: sub.unidad || 'pz', marca: sub.marca || null,
          _env: { tipo: 'envase', catKey: catName, subKey, fabrica, teran, transito },
        });
      });
    });
    Object.entries(tapas).forEach(([tapaKey, tapa]) => {
      const fabrica = Number(tapa.stock) || 0, teran = Number(tapa.teran) || 0, transito = Number(tapa.transito) || 0, min = Number(tapa.min) || 0;
      const qty = qtyView(fabrica, teran, transito);
      out.push({
        nombre: tapa.nombre || tapaKey, inv: { qty, min }, teran, transito,
        pct: min > 0 ? Math.round((qty / min) * 100) : 999,
        grupo: 'Tapas', unidad: 'pz', color: tapa.color || null,
        _env: { tipo: 'tapa', tapaKey, fabrica, teran, transito },
      });
    });
    return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [activeTab, envData, envSubtab]);

  const filteredEnv = useMemo(() => {
    let items = filterFn(envItems, it => it.inv.qty || 0, it => it.pct);
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      items = items.filter(it => it.nombre.toLowerCase().includes(q) || (it.marca || '').toLowerCase().includes(q));
    }
    return items;
  }, [envItems, debouncedQuery, filterFn]);

  /* Agrupa por categoría de envase (Litro, Galón, Cubeta, Otros, Tapas) — paridad
     con la división por categoría de MP. */
  const envGrouped = useMemo(() => {
    const groups = {};
    filteredEnv.forEach(it => { (groups[it.grupo] = groups[it.grupo] || []).push(it); });
    const orden = [...ENV_GRUPOS.filter(g => groups[g]), ...Object.keys(groups).filter(g => !ENV_GRUPOS.includes(g))];
    return orden.map(g => ({ cat: g, items: groups[g] }));
  }, [filteredEnv]);

  /* ── KPI computation ── */
  const mpKpi = useMemo(() => {
    const total = mpItems.length;
    let ok = 0, bajo = 0, sin = 0;
    mpItems.forEach(it => {
      if ((it.inv.qty || 0) <= 0) sin++;
      else if (it.pct <= 100) bajo++;
      else ok++;
    });
    return { total, ok, bajo, sin };
  }, [mpItems]);

  const ptKpi = useMemo(() => {
    const total = ptItems.length;
    let ok = 0, bajo = 0, sin = 0;
    ptItems.forEach(it => {
      if ((it.inv.qty || 0) <= 0) sin++;
      else if (it.pct <= 100) bajo++;
      else ok++;
    });
    return { total, ok, bajo, sin };
  }, [ptItems]);

  /* ── Save handlers ──
     Usamos el endpoint individual `/api/inventario/ajuste-mp` que permite
     admin + rol inventario (Burgos). Más seguro que el overwrite completo
     que es solo admin. Cada llamada solo toca esa MP y deja audit. */
  /* Helper SIMPLIFICADO: un solo modal con UN campo de código.
     El backend prueba el código como TOTP primero, después como código admin.
     Si pasa cualquiera, autoriza. Si no, rechaza con 403 (no saca sesión). */
  const ajustarConCandado = useCallback(async (apiFn, etiqueta) => {
    try {
      await apiFn();
      reloadInv();
      return;
    } catch (e) {
      const errCodigo = e?.data?.codigo;
      if (errCodigo !== 'AJUSTE_BLOQUEADO_NECESITA_CANDADO') {
        const msg = e?.data?.error || e?.message || 'No se pudo guardar';
        alert('Error al guardar ' + etiqueta + ': ' + msg);
        throw e;
      }

      /* Pedir código de autorización (puede ser TOTP de tu app o código universal admin) */
      const codigo = await confirm(
        `Vas a modificar el stock de "${etiqueta}". Ingresa tu código de Google Authenticator (6 dígitos) O el código universal del admin para autorizar y registrar la modificación.`,
        {
          title: 'Autorizar modificación de stock',
          confirmText: 'Confirmar',
          danger: false,
          prompt: {
            label: 'Código de autorización',
            placeholder: 'Tu TOTP o código admin',
            required: true, minLength: 4, maxLength: 12,
            rows: 1, numeric: true, password: true,
          },
        }
      );
      if (!codigo) { throw e; }

      try {
        await apiFn(codigo);
        reloadInv();
        setToastMsg('Stock modificado y registrado en auditoría');
        setTimeout(() => setToastMsg(''), 4000);
      } catch (e2) {
        const errMsg = e2?.data?.error || e2?.message || 'Error desconocido';
        alert('No se pudo guardar: ' + errMsg);
        throw e2;
      }
    }
  }, [reloadInv, confirm]);

  const handleSaveMP = useCallback(async (mp, newQty, newMin, motivo) => {
    /* AD1 (jun 2026): el motivo lo captura el usuario en el panel "Ajustar
       existencia" y se manda al backend para auditoría (antes era hardcodeado).
       Recibe el código del modal (TOTP o admin); el backend lo prueba contra ambos. */
    await ajustarConCandado(
      (codigo) => api.ajusteMP(mp, newQty, newMin, motivo || 'Ajuste manual de inventario',
        codigo ? { codigoAutorizacion: codigo } : {}),
      mp
    );
  }, [ajustarConCandado]);

  /* Sprint X: asignar/agregar MP a un almacén (fábrica|Terán). Pasa por el MISMO
     candado que handleSaveMP (ajustarConCandado pide el código si el backend lo exige). */
  const handleSaveMPUbic = useCallback(async (mp, ubicacion, qty, modo, motivo) => {
    await ajustarConCandado(
      (codigo) => api.setMPUbicacion(mp, ubicacion, qty, modo, motivo || `MP a ${ubicacion}`,
        codigo ? { codigoAutorizacion: codigo } : {}),
      mp
    );
    reloadMpUbi();
  }, [ajustarConCandado, reloadMpUbi]);

  /* Sprint X: PT por almacén. Fábrica = qty (stock de producción); Terán = pool
     manual aparte. agregar/fijar via candado. Eliminar (solo Terán) = fijar 0. */
  const handleSavePTUbic = useCallback(async (producto, ubicacion, qty, modo, motivo) => {
    await ajustarConCandado(
      (codigo) => api.setPTUbicacion(producto, ubicacion, qty, modo, motivo || `PT en ${ubicacion}`,
        codigo ? { codigoAutorizacion: codigo } : {}),
      producto
    );
    reloadPtUbi();
  }, [ajustarConCandado, reloadPtUbi]);

  const handleEliminarPTTeran = useCallback(async (producto) => {
    const ok = await confirm(`¿Quitar "${producto}" del almacén Terán? Esto solo elimina el registro manual de Terán; no afecta el stock total ni los lotes rastreados.`, {
      title: 'Eliminar PT de Terán', confirmText: 'Eliminar', danger: true,
    });
    if (!ok) return;
    await handleSavePTUbic(producto, 'teran', 0, 'fijar', 'Eliminado de Terán');
    setToastMsg(`${producto} quitado de Terán`);
    reloadInv();
    setTimeout(() => setToastMsg(''), 4000);
  }, [confirm, handleSavePTUbic, reloadInv]);

  /* Ajuste inline PT — pasa por ajustarConCandado: backend exige sesión de conteo
     activa, código TOTP propio o código universal del admin. */
  const handleSavePT = useCallback(async (nombre, newQty, newMin, motivo) => {
    const minActual = newMin != null ? newMin : inventory?.pt?.[nombre]?.min;
    await ajustarConCandado(
      (codigo) => api.ajustePT(
        nombre, newQty,
        minActual,
        motivo || 'Ajuste manual de PT',
        codigo ? { codigoAutorizacion: codigo } : {}
      ),
      nombre
    );
  }, [inventory, ajustarConCandado]);

  /* ── Abrir sheet "Ajustar existencia" (tabla escritorio + cards móvil) ── */
  const handleAdjustMP = useCallback((item) => {
    setAjusteItem({ tipo: 'mp', nombre: item.mp, qty: item.inv.qty || 0, min: item.inv.min || 0, unidad: 'kg' });
  }, []);
  const handleAdjustPT = useCallback((item) => {
    setAjusteItem({ tipo: 'pt', nombre: item.nombre, qty: item.inv.qty || 0, min: item.inv.min || 0, unidad: 'cub', sku: item.inv.sku || '', medida: item.inv.medida || '', medidaQty: item.inv.medidaQty != null ? item.inv.medidaQty : null });
  }, []);
  /* Envases (Sprint Y jun 2026): mismo sheet "Ajustar existencia" que MP/PT.
     Sin candado ni propuesta — guarda directo a /api/envases/stock|tapa/stock. */
  const handleAdjustEnv = useCallback((item) => {
    setAjusteItem({ tipo: 'env', nombre: item.nombre, qty: item.inv.qty || 0, min: item.inv.min || 0, unidad: item.unidad || 'pz', _env: item._env });
  }, []);
  const handleSaveEnv = useCallback(async (ref, qty, min) => {
    try {
      if (ref.tipo === 'tapa') {
        await api.post('/api/envases/tapa/stock', { key: ref.tapaKey, stock: Number(qty) || 0, min: Number(min) || 0 });
      } else {
        await api.post('/api/envases/stock', { categoria: ref.catKey, subcategoria: ref.subKey, subKey: ref.subKey, stock: Number(qty) || 0, min: Number(min) || 0 });
      }
      reloadEnv();
      setToastMsg('Envase actualizado'); setTimeout(() => setToastMsg(''), 3000);
    } catch (e) {
      alert('No se pudo guardar: ' + (e?.data?.error || e?.message || 'error'));
      throw e;
    }
  }, [reloadEnv]);
  /* El guardado del sheet pasa por handleSaveMP/PT → ajustarConCandado (candado intacto).
     extras (solo PT): {stockChanged, metaChanged, nuevoNombre?, sku?} — el catálogo
     (nombre/SKU) se aplica PRIMERO y directo vía pt-meta (sin candado: no es stock);
     el ajuste de stock posterior apunta al nombre YA renombrado (también la
     propuesta de Burgos — si no, el admin la aprobaría sobre la clave vieja y
     recrearía el PT con el nombre anterior). */
  const handleAjusteSave = useCallback(async (newQty, motivo, newMin, extras = {}) => {
    if (!ajusteItem) return;
    /* Envases: guardado directo (sin candado ni propuesta). */
    if (ajusteItem.tipo === 'env') {
      await handleSaveEnv(ajusteItem._env, newQty, newMin != null ? newMin : ajusteItem.min);
      return;
    }
    let nombreEfectivo = ajusteItem.nombre;
    if (ajusteItem.tipo === 'pt' && extras.metaChanged) {
      try {
        const r = await api.ptMeta(ajusteItem.nombre, { sku: extras.sku, nuevoNombre: extras.nuevoNombre, medida: extras.medida, medidaQty: extras.medidaQty });
        if (r?.producto) nombreEfectivo = r.producto;
      } catch (e) {
        const msg = e?.data?.error || e?.message || 'No se pudo actualizar nombre/SKU';
        alert(msg);
        throw e; /* mantener el sheet abierto para corregir */
      }
      if (!extras.stockChanged) {
        setToastMsg('Catálogo actualizado (nombre/SKU)');
        setTimeout(() => setToastMsg(''), 4000);
        reloadInv();
        return;
      }
    }
    /* Rename CANÓNICO de MP (solo admin): propaga el nombre a inventario,
       maestro_mp, fórmulas, compras, costos y proveedores. Se aplica ANTES del
       ajuste de stock para que el ajuste apunte al nombre ya renombrado. */
    if (ajusteItem.tipo === 'mp' && extras.metaChanged && extras.nuevoNombre) {
      try {
        await api.renombrarMP(ajusteItem.nombre, extras.nuevoNombre);
        nombreEfectivo = extras.nuevoNombre;
      } catch (e) {
        const msg = e?.data?.error || e?.message || 'No se pudo renombrar la materia prima';
        alert(msg);
        throw e; /* mantener el sheet abierto para corregir */
      }
      if (!extras.stockChanged) {
        setToastMsg('Materia prima renombrada en todo el sistema');
        setTimeout(() => setToastMsg(''), 4000);
        reloadInv();
        return;
      }
    }
    const minFinal = newMin != null ? newMin : ajusteItem.min;
    /* Proponente (Burgos/no-admin): NO aplica — crea una propuesta pendiente de aprobación. */
    if (esProponente) {
      await api.proponerAjuste(ajusteItem.tipo, nombreEfectivo, newQty, minFinal, motivo);
      setToastMsg(extras.metaChanged
        ? 'Catálogo aplicado · cambio de stock pendiente de aprobación del admin'
        : 'Cambio enviado · pendiente de aprobación del admin');
      setTimeout(() => setToastMsg(''), 4500);
      reloadPendientes();
      if (extras.metaChanged) reloadInv();
      return;
    }
    if (ajusteItem.tipo === 'mp') await handleSaveMP(nombreEfectivo, newQty, minFinal, motivo);
    else await handleSavePT(nombreEfectivo, newQty, minFinal, motivo);
  }, [ajusteItem, esProponente, handleSaveMP, handleSavePT, handleSaveEnv, reloadPendientes, reloadInv]);

  /* ── KPI click handler ── */
  const handleKpiClick = (filter) => {
    const newFilter = activeFilter === filter ? 'todos' : filter;
    setActiveFilter(newFilter);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (newFilter === 'todos') p.delete('filter');
      else p.set('filter', newFilter);
      return p;
    }, { replace: true });
  };

  /* ── Tab change ── */
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setActiveFilter('todos');
    setQuery('');
    setSearchParams({ tab: tabId }, { replace: true });
  };

  if (invLoading) {
    return (
      <>
        <TopBar title="Inventarios" />
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Inventarios" />
      <div style={S.wrap}>
        <div style={S.h1}>Inventario</div>
        <div style={S.psub}>Materia prima y producto terminado</div>

        {/* Banner cola de aprobación */}
        {pendientes.length > 0 && esAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '8px 0 4px', padding: '11px 14px', borderRadius: 12, background: 'color-mix(in srgb, var(--lp-warning-600) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--lp-warning-600) 30%, transparent)' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--lp-warning-700)' }}>
              {pendientes.length} {pendientes.length === 1 ? 'ajuste propuesto' : 'ajustes propuestos'} por aprobar
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowAprobar(true)} style={{ height: 38, padding: '0 16px', borderRadius: 'var(--lp-radius-md)', border: 'none', background: 'var(--lp-warning-600)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Revisar</button>
          </div>
        )}
        {pendientes.length > 0 && esProponente && (
          <div style={{ margin: '8px 0 4px', padding: '10px 14px', borderRadius: 12, background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)', fontSize: 13, color: 'var(--lp-text-secondary)' }}>
            Tienes <strong>{pendientes.length}</strong> {pendientes.length === 1 ? 'cambio' : 'cambios'} esperando aprobación del admin.
          </div>
        )}

        {/* P2: inventario inicial canónico (congelar base + delta) — solo admin */}
        {esAdmin && <CanonicoCard />}

        {/* Toolbar (mockup): fila buscador prominente + fila segmented MP/PT con
            chips de severidad a la derecha. En móvil se apilan igual que el mockup. */}
        <div style={{ ...S.toolbarRow, ...(isDesktop ? {} : { flexDirection: 'column', alignItems: 'stretch' }) }}>
          <div style={{ ...S.searchBox(searchFocus), ...(isDesktop ? {} : { maxWidth: '100%' }) }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input style={S.searchInput} type="text" placeholder="Buscar material…" value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)} />
            {query && (
              <button type="button" style={S.searchClr} aria-label="Limpiar búsqueda" onClick={() => setQuery('')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: '1 1 auto' }}>
            <div style={S.segWrap}>
              {tabs.map(t => (
                <button key={t.id} type="button" data-id={`inventario.tab.${t.id}`} style={S.segBtn(activeTab === t.id)} onClick={() => handleTabChange(t.id)}>
                  {t.id === 'mp' ? 'MP' : t.id === 'pt' ? 'PT' : 'Envases'}
                </button>
              ))}
            </div>
            {/* Paquete MOCKUP 8: en escritorio los chips siguen inline; en
                móvil se decluttera — UN botón de filtros abre la hoja. */}
            {((activeTab === 'mp' && mpSubtab === 'stock') || (activeTab === 'pt' && ptSubtab === 'total') || activeTab === 'env') && isDesktop && (
              <div style={{ marginLeft: 'auto' }}>
                <FilterChips activeFilter={activeFilter} onPick={handleKpiClick} />
              </div>
            )}
            {!isDesktop && (
              <div style={{ marginLeft: 'auto' }}>
                <MFiltBtn
                  active={activeFilter !== 'todos' || (activeTab === 'mp' && mpSubtab !== 'stock') || (activeTab === 'pt' && ptSubtab !== 'total')}
                  onClick={() => setVSheetOpen(true)} />
              </div>
            )}
          </div>
        </div>

        {/* Chips activos removibles (móvil, mockup .actchip) */}
        {!isDesktop && (
          <ActiveChips chips={[
            ...(activeFilter !== 'todos' ? [{ key: 'estado', label: activeFilter === 'sin' ? 'Crítico' : activeFilter === 'bajo' ? 'Bajo' : 'OK', clear: () => handleKpiClick(activeFilter) }] : []),
            ...(activeTab === 'mp' && mpSubtab !== 'stock' ? [{ key: 'vista', label: mpSubtab === 'costos' ? 'Costos' : mpSubtab === 'maestro' ? 'Maestro' : mpSubtab === 'fabrica' ? 'Fábrica' : 'Terán', clear: () => setMpSubtab('stock') }] : []),
            ...(activeTab === 'pt' && ptSubtab !== 'total' ? [{ key: 'almacen', label: ptSubtab === 'fabrica' ? 'Fábrica' : 'Terán', clear: () => setPtSubtab('total') }] : []),
          ]} />
        )}

        {/* Botón "Acciones" — fila propia a la derecha en MÓVIL (reemplaza el FAB
            flotante; en escritorio las acciones siguen inline). Patrón consistente
            con Órdenes/OC MP — reporte dueño jun 2026. */}
        {!isDesktop && (activeTab === 'mp' || activeTab === 'pt') && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
            <button
              data-id="inventario.btn.acciones"
              data-rol="admin,compras,inventario,almacen,tecnico"
              style={{ height: 44, padding: '0 16px', borderRadius: 999, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--lp-brand-600)', color: '#fff' }}
              onClick={() => setASheetOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg> Acciones
            </button>
          </div>
        )}

        {/* KPIs + banda de atención (escritorio, mockup propuesta A) */}
        {isDesktop && ((activeTab === 'mp' && mpSubtab === 'stock') || (activeTab === 'pt' && ptSubtab === 'total') || activeTab === 'env') && (() => {
          const kpiItems = activeTab === 'mp' ? mpItems : activeTab === 'pt' ? ptItems : envItems;
          const unidad = activeTab === 'mp' ? 'kg' : activeTab === 'pt' ? 'cub' : 'pz';
          const criticos = kpiItems.filter(i => (i.inv.qty || 0) <= 0);
          return (
            <>
              <KpisInventario items={kpiItems} tipo={activeTab} unidad={unidad} />
              {activeTab === 'mp' && (
                <BandaAtencion criticos={criticos} unidad={unidad}
                  canOC={user?.rol === 'admin' || user?.rol === 'compras'}
                  onGenerarOC={() => navigate('/pronostico')} />
              )}
            </>
          );
        })()}

        {/* ════════ TAB: MATERIA PRIMA ════════ */}
        {activeTab === 'mp' && (
          <>
            <div style={S.subRow}>
              <div style={S.pillGroup}>
                {[
                  { id: 'stock', label: 'Stock', hint: 'Total de cada MP (suma de almacenes)' },
                  { id: 'fabrica', label: 'Fábrica', hint: 'MP físicamente en planta' },
                  { id: 'teran', label: 'Terán', hint: 'MP físicamente en almacén Terán' },
                  { id: 'costos', label: 'Costos' },
                  { id: 'maestro', label: 'Maestro' },
                ].map(t => (
                  <button key={t.id} type="button" title={t.hint} data-id={`inventario.subtab.${t.id}`} data-rol="admin,compras,inventario,almacen,tecnico"
                    style={S.chip(t.id === mpSubtab)} onClick={() => setMpSubtab(t.id)}>{t.label}</button>
                ))}
              </div>
              {mpSubtab === 'stock' && (
                <div style={S.actionsCluster(isDesktop)}>
                  {/* Paquete MOCKUP 8: en móvil esta acción vive en el FAB → hoja Acciones */}
                  {canRecibirMP && isDesktop && (
                    <button style={S.btnAdd} data-id="inventario.btn.recepcion-mp" data-rol="almacen,compras,admin" onClick={() => setShowRecepcion(true)}>+ Recepción MP</button>
                  )}
                  {isDesktop && (
                    <ImportExportPrint
                      exportUrl={() => api.urlExportInv('mp', activeFilter)}
                      printUrl={() => api.urlPrintInv('mp', activeFilter)}
                      importEndpoint={canEditMP ? (api.urlImportInv && api.urlImportInv()) : null}
                      onImported={(data) => { if (data && data.importId) setImportPreview({ ...data, tipo: 'mp' }); else reloadInv(); }}
                      permisos={{ import: canEditMP }}
                    />
                  )}
                </div>
              )}
            </div>

            {mpSubtab === 'costos' && <CostosMPPanel />}
            {mpSubtab === 'maestro' && <MaestroMPInline />}
            {(mpSubtab === 'fabrica' || mpSubtab === 'teran') && (
              <MPUbicacionView
                ubicacion={mpSubtab}
                data={mpUbiData}
                query={query}
                onQuery={setQuery}
                canEdit={canEditMP}
                onAgregar={() => setAgregarMpUbic({ ubicacion: mpSubtab })}
                onFijar={(mp, nuevoQty) => handleSaveMPUbic(mp, mpSubtab, nuevoQty, 'fijar', `Conteo físico ${mpSubtab}`)}
              />
            )}
            {mpSubtab === 'stock' && (
              <>
            {/* Lista de stock MP — tabla (escritorio) / cards (móvil) */}
            {filteredMP.length === 0 ? (
              <div style={S.empty}>
                {debouncedQuery ? `Sin resultados para "${debouncedQuery}"` : activeFilter !== 'todos' ? 'Sin materias primas en este filtro' : 'Sin materias primas registradas'}
              </div>
            ) : (
              <div style={S.countLbl}>{filteredMP.length} de {mpItems.length} materias primas</div>
            )}
            {/* DIVISIÓN POR CATEGORÍA (restaurada jun 2026 — se perdió en el rediseño
                AG3): MP agrupadas por categoría química del maestro, cada sección con
                su encabezado. Datos de item.maestro.categoria (fuente: maestro_mp.json). */}
            {filteredMP.length > 0 && (() => {
              const secciones = [
                ...Object.keys(MP_CATEGORIES)
                  .filter(c => mpGrouped.groups[c] && mpGrouped.groups[c].length)
                  .map(c => ({ cat: c, items: mpGrouped.groups[c], meta: MP_CATEGORIES[c] })),
                ...(mpGrouped.uncategorized.length ? [{ cat: 'Sin Categoría', items: mpGrouped.uncategorized, meta: null }] : []),
              ];
              return secciones.map(sec => (
                <div key={sec.cat} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, fontSize: 10, fontWeight: 800, letterSpacing: '.02em', background: sec.meta ? sec.meta.bg : 'var(--lp-bg-sunken)', color: sec.meta ? sec.meta.fg : 'var(--lp-text-tertiary)' }}>{sec.meta ? sec.meta.icon : '—'}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)' }}>{sec.cat}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lp-text-tertiary)' }}>· {sec.items.length}</span>
                  </div>
                  {isDesktop ? (
                    <InvTable items={sec.items} tipo="mp" unidad="kg" canEdit={canEditMP} canDelete={canDeleteMP}
                      canContar={canContar} onContar={handleContar}
                      mpsDisponibles={mpsDisponibles} onAdjust={handleAdjustMP} onAction={handleMPAction} query={debouncedQuery} />
                  ) : (
                    <div>
                      {sec.items.map(item => (
                        <MPRow key={item.mp} item={item} canEdit={canEditMP} canContar={canContar} onAdjust={handleAdjustMP} onContar={handleContar} query={debouncedQuery} />
                      ))}
                    </div>
                  )}
                </div>
              ));
            })()}
              </>
            )}
          </>
        )}

        {/* ════════ TAB: PRODUCTO TERMINADO ════════ */}
        {activeTab === 'pt' && (
          <>
            <div style={S.subRow}>
              <div style={S.pillGroup}>
                {[
                  { id: 'total', label: 'Total', hint: 'Suma fábrica + Terán' },
                  { id: 'fabrica', label: 'Fábrica', hint: 'Lo que tiene Enrique aquí' },
                  { id: 'teran', label: 'Terán', hint: 'Lo que tiene Josué allá' },
                ].map(p => (
                  <button key={p.id} type="button" title={p.hint}
                    data-id={`inventario.ptview.${p.id}`} data-rol="admin,almacen,inventario"
                    style={S.chip(p.id === ptSubtab)} onClick={() => setPtSubtab(p.id)}>{p.label}</button>
                ))}
              </div>
              {ptSubtab === 'total' && (
                <div style={S.actionsCluster(isDesktop)}>
                  {/* Paquete MOCKUP 8: en móvil esta acción vive en el FAB → hoja Acciones */}
                  {canEditMP && isDesktop && (
                    <button style={S.btnAdd} onClick={() => setShowAgregarPT(true)} title="Agregar inventario inicial de producto terminado">+ Agregar PT</button>
                  )}
                  {isDesktop && <ImportExportPrint
                    exportUrl={() => api.urlExportInv('pt', activeFilter)}
                    printUrl={() => api.urlPrintInv('pt', activeFilter)}
                    importEndpoint={canEditMP ? api.urlImportInvPT() : null}
                    onImported={(data) => { if (data && data.importId) setImportPreview({ ...data, tipo: 'pt' }); else reloadInv(); }}
                    permisos={{ import: canEditMP }}
                  />}
                </div>
              )}
            </div>

            {/* Vista TOTAL — agregado inv.pt: tabla (escritorio) / cards (móvil) */}
            {ptSubtab === 'total' && (
              filteredPT.length === 0 ? (
                <div style={S.empty}>
                  {debouncedQuery ? `Sin resultados para "${debouncedQuery}"` : activeFilter !== 'todos' ? 'Sin productos en este filtro' : 'Sin productos terminados'}
                </div>
              ) : (
                <>
                  <div style={S.countLbl}>{filteredPT.length} de {ptItems.length} productos terminados</div>
                  {isDesktop ? (
                    <InvTable items={filteredPT} tipo="pt" unidad="cub" canEdit={canEditMP}
                      canContar={canContar} onContar={handleContar}
                      onAdjust={handleAdjustPT} onPedir={handlePedirPT} canPedir={canPedirPT} query={debouncedQuery} />
                  ) : (
                    <div>
                      {filteredPT.map(item => (
                        <PTRow key={item.nombre} item={item} canEdit={canEditMP} canContar={canContar} onAdjust={handleAdjustPT} onContar={handleContar} query={debouncedQuery} />
                      ))}
                    </div>
                  )}
                </>
              )
            )}

            {/* Vista FÁBRICA o TERÁN — desde /api/inventario/pt-por-ubicacion */}
            {(ptSubtab === 'fabrica' || ptSubtab === 'teran') && (
              <PTUbicacionView
                ubicacion={ptSubtab}
                data={ptUbiData?.data || ptUbiData}
                query={query}
                onQuery={setQuery}
                canPedir={canPedirPT}
                onPedir={handlePedirPT}
                canEdit={canEditMP}
                onAgregar={(ubic) => setAgregarPtUbic({ ubicacion: ubic })}
                onEliminarTeran={handleEliminarPTTeran}
                onTransferir={canTransferirPT ? (producto) => irASolicitudOT(otLineaDePT(producto)) : undefined}
                onReenvasar={canReenvasar ? (producto, scalar) => setReenvasarTeran({ producto, scalar }) : undefined}
              />
            )}
          </>
        )}

        {/* ════════ TAB: ENVASES (misma estructura que MP/PT — Sprint Y) ════════ */}
        {activeTab === 'env' && (
          <>
            <div style={S.subRow}>
              {/* Sub-vistas Fábrica/Terán (espeja las pills de PT). 'fabrica' habilita
                  el botón "Transferir a Terán" por fila/card. Sprint Y2 (jun 2026). */}
              <div style={S.pillGroup}>
                {[
                  { id: 'total', label: 'Total', hint: 'Suma fábrica + Terán' },
                  { id: 'fabrica', label: 'Fábrica', hint: 'Envases/tapas en planta de fábrica' },
                  { id: 'teran', label: 'Terán', hint: 'Envases/tapas ya repartidos a Terán' },
                ].map(p => (
                  <button key={p.id} type="button" title={p.hint}
                    data-id={`inventario.envview.${p.id}`} data-rol="admin,almacen,inventario"
                    style={S.chip(p.id === envSubtab)} onClick={() => setEnvSubtab(p.id)}>{p.label}</button>
                ))}
              </div>
              <div style={S.actionsCluster(isDesktop)}>
                {canEditEnvases && isDesktop && (
                  <button style={S.btnAdd} onClick={() => setShowAgregarEnv(true)} title="Agregar una presentación de envase nueva">+ Agregar envase</button>
                )}
                {isDesktop && (
                  <ImportExportPrint
                    exportUrl={() => api.urlExportInv('envases', activeFilter)}
                    printUrl={() => api.urlPrintInv('envases', activeFilter)}
                    importEndpoint={canEditEnvases ? api.urlImportEnvases() : null}
                    onImported={(data) => {
                      reloadEnv();
                      const n = (data && data.aplicados) || 0;
                      const errs = (data && data.errores && data.errores.length) || 0;
                      setToastMsg(`Importados ${n} envase(s)` + (errs ? ` · ${errs} con error` : ''));
                      setTimeout(() => setToastMsg(''), 5000);
                    }}
                    permisos={{ import: canEditEnvases }}
                  />
                )}
              </div>
            </div>
            {filteredEnv.length === 0 ? (
              <div style={S.empty}>
                {debouncedQuery ? `Sin resultados para "${debouncedQuery}"` : activeFilter !== 'todos' ? 'Sin envases en este filtro' : 'Sin envases registrados'}
              </div>
            ) : (
              <div style={S.countLbl}>{filteredEnv.length} de {envItems.length} envases</div>
            )}
            {filteredEnv.length > 0 && envGrouped.map(sec => (
              <div key={sec.cat} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 8px' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)' }}>{sec.cat}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lp-text-tertiary)' }}>· {sec.items.length}</span>
                </div>
                {isDesktop ? (
                  <InvTable items={sec.items} tipo="pt" unidad="pz" canEdit={canEditEnvases}
                    onAdjust={handleAdjustEnv} canPedir={false} query={debouncedQuery}
                    onTransferir={(envSubtab === 'fabrica' && canTransferirEnv) ? (item) => irASolicitudOT(otLineaDeEnv(item)) : undefined} />
                ) : (
                  <div>
                    {sec.items.map(item => (
                      <PTRow key={item._env.tipo + '-' + (item._env.subKey || item._env.tapaKey)}
                        item={item} canEdit={canEditEnvases} onAdjust={handleAdjustEnv} query={debouncedQuery}
                        onTransferir={(envSubtab === 'fabrica' && canTransferirEnv) ? () => irASolicitudOT(otLineaDeEnv(item)) : undefined} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Modal de confirmación con PIN (override candado de ajuste) */}
      {ConfirmEl}

      {/* ── Agregar PT (inventario inicial) Modal ── */}
      {showAgregarPT && (
        <AgregarPTModal
          onClose={() => setShowAgregarPT(false)}
          onSaved={() => {
            setToastMsg('Inventario PT actualizado');
            reloadInv();
            setTimeout(() => setToastMsg(''), 4000);
          }}
        />
      )}

      {/* ── Agregar Envase (presentación nueva) Modal — Sprint Y ── */}
      {showAgregarEnv && (
        <AgregarEnvaseModal
          categorias={Object.keys((envData?.data || envData || {}).categorias || {})}
          onClose={() => setShowAgregarEnv(false)}
          onSaved={(msg) => {
            setShowAgregarEnv(false);
            setToastMsg(msg || 'Envase agregado');
            reloadEnv();
            setTimeout(() => setToastMsg(''), 4000);
          }}
        />
      )}

      {/* ── Recepción MP Modal ── */}
      {showRecepcion && (
        <RecepcionModal
          mpList={mpItems.map(it => it.mp)}
          onClose={() => setShowRecepcion(false)}
          onSuccess={(msg) => {
            setShowRecepcion(false);
            setToastMsg(msg);
            reloadInv();
            setTimeout(() => setToastMsg(''), 4000);
          }}
        />
      )}

      {/* ── Sprint X: Agregar MP a almacén (fábrica/Terán) Modal ── */}
      {agregarMpUbic && (
        <AgregarMPUbicacionModal
          ubicacion={agregarMpUbic.ubicacion}
          mpList={mpItems.map(it => it.mp)}
          onClose={() => setAgregarMpUbic(null)}
          onSubmit={async (mp, qty) => {
            await handleSaveMPUbic(mp, agregarMpUbic.ubicacion, qty, 'agregar', `Alta de MP en ${agregarMpUbic.ubicacion}`);
            setAgregarMpUbic(null);
            setToastMsg(`${mp}: +${qty} kg en ${agregarMpUbic.ubicacion === 'fabrica' ? 'Fábrica' : 'Terán'}`);
            reloadInv();
            setTimeout(() => setToastMsg(''), 4000);
          }}
        />
      )}

      {/* ── Sprint X: Agregar PT a almacén (fábrica = qty / Terán = pool manual) Modal ── */}
      {agregarPtUbic && (
        <AgregarPTUbicacionModal
          ubicacion={agregarPtUbic.ubicacion}
          ptList={ptItems.map(it => it.nombre)}
          onClose={() => setAgregarPtUbic(null)}
          onSubmit={async (producto, qty) => {
            await handleSavePTUbic(producto, agregarPtUbic.ubicacion, qty, 'agregar', `Alta de PT en ${agregarPtUbic.ubicacion}`);
            setAgregarPtUbic(null);
            setToastMsg(`${producto}: +${qty} cub en ${agregarPtUbic.ubicacion === 'fabrica' ? 'Fábrica' : 'Terán'}`);
            reloadInv();
            setTimeout(() => setToastMsg(''), 4000);
          }}
        />
      )}

      {/* ── Parte B: Transferir PT Fábrica → Terán (Josué) ── */}
      {transferirPt && (
        <TransferirPTTeranModal
          producto={transferirPt.producto}
          isDesktop={isDesktop}
          onClose={() => setTransferirPt(null)}
          onDone={(r) => {
            setTransferirPt(null);
            setToastMsg(`${r.producto}: ${r.transferido} cub → Terán (Fábrica ${r.fabrica} · Terán ${r.teran})`);
            reloadInv();
            reloadPtUbi();
            setTimeout(() => setToastMsg(''), 4500);
          }}
        />
      )}

      {/* ── Reenvasar PT en Terán (tote/granel → cubetas/galones) ── */}
      {reenvasarTeran && (
        <ReenvasarTeranModal
          producto={reenvasarTeran.producto}
          scalar={reenvasarTeran.scalar}
          envData={envData?.data || envData}
          isDesktop={isDesktop}
          onClose={() => setReenvasarTeran(null)}
          onDone={(r) => {
            setReenvasarTeran(null);
            setToastMsg(`${r.producto} reenvasado en Terán`);
            reloadInv();
            reloadPtUbi();
            reloadEnv();
            setTimeout(() => setToastMsg(''), 4500);
          }}
        />
      )}

      {/* ── Sprint Y2: Transferir Envase/Tapa Fábrica → Terán (Josué) ── */}
      {transferirEnv && (
        <TransferirEnvaseTeranModal
          item={transferirEnv}
          isDesktop={isDesktop}
          onClose={() => setTransferirEnv(null)}
          onDone={(r) => {
            setTransferirEnv(null);
            setToastMsg(`${r.item}: ${r.transferido} ${r.unidad || 'pz'} → Terán (Fábrica ${r.fabrica} · Terán ${r.teran})`);
            reloadEnv();
            setTimeout(() => setToastMsg(''), 4500);
          }}
        />
      )}

      {/* ── Paquete MOCKUP 8: hojas móviles (el FAB se reemplazó por el botón
          fijo "Acciones" de arriba, debajo de las tabs — consistencia jun 2026) ── */}
      {vSheetOpen && (
        <VistaFiltrosSheet
          activeTab={activeTab}
          activeFilter={activeFilter} onFilter={(k) => handleKpiClick(k === activeFilter ? activeFilter : k)}
          mpSubtab={mpSubtab} onMpSubtab={setMpSubtab}
          ptSubtab={ptSubtab} onPtSubtab={setPtSubtab}
          onClose={() => setVSheetOpen(false)}
        />
      )}
      {aSheetOpen && (
        <AccionesSheet
          onClose={() => setASheetOpen(false)}
          rows={[
            ...(activeTab === 'mp' && canRecibirMP ? [{
              key: 'recepcion', label: 'Recepción MP', desc: 'Captura entrada de materia prima',
              dataId: 'inventario.btn.recepcion-mp', dataRol: 'almacen,compras,admin',
              onClick: () => setShowRecepcion(true),
              icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96 12 12.01l8.73-5.05" /></svg>,
            }] : []),
            ...(activeTab === 'pt' && canEditMP ? [{
              key: 'agregarpt', label: 'Agregar PT', desc: 'Inventario inicial de producto terminado',
              dataId: 'inventario.btn.agregar-pt', dataRol: 'admin',
              onClick: () => setShowAgregarPT(true),
              icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>,
            }] : []),
          ]}
          importExportNode={(
            <ImportExportPrint
              exportUrl={() => api.urlExportInv(activeTab === 'pt' ? 'pt' : 'mp', activeFilter)}
              printUrl={() => api.urlPrintInv(activeTab === 'pt' ? 'pt' : 'mp', activeFilter)}
              importEndpoint={canEditMP ? (activeTab === 'pt' ? api.urlImportInvPT() : (api.urlImportInv && api.urlImportInv())) : null}
              onImported={(data) => { setASheetOpen(false); if (data && data.importId) setImportPreview({ ...data, tipo: activeTab === 'pt' ? 'pt' : 'mp' }); else reloadInv(); }}
              permisos={{ import: canEditMP }}
            />
          )}
        />
      )}

      {eliminarMP && (
        <EliminarMPModal
          mp={eliminarMP}
          onClose={() => setEliminarMP(null)}
          onSaved={() => {
            setToastMsg('MP eliminada: ' + eliminarMP);
            setEliminarMP(null);
            reloadInv();
            setTimeout(() => setToastMsg(''), 4000);
          }}
        />
      )}
      {sustituirMP && (
        <SustituirMPModal
          mp={sustituirMP}
          mpsDisponibles={mpsDisponibles}
          onClose={() => setSustituirMP(null)}
          onSaved={() => {
            setToastMsg('MP sustituida: ' + sustituirMP);
            setSustituirMP(null);
            reloadInv();
            setTimeout(() => setToastMsg(''), 4000);
          }}
        />
      )}

      {/* ── Sheet "Ajustar existencia" (tabla escritorio + cards móvil) ── */}
      {ajusteItem && (
        <AjusteSheet
          item={ajusteItem}
          isDesktop={isDesktop}
          canEditMin={ajusteItem.tipo === 'env' ? true : canEditMinimos}
          modoPropuesta={ajusteItem.tipo === 'env' ? false : esProponente}
          puedeRenombrarMP={esAdmin}
          onClose={() => setAjusteItem(null)}
          onSave={handleAjusteSave}
          onPedir={ajusteItem.tipo === 'pt' && canPedirPT && (ajusteItem.qty <= 0 || (ajusteItem.min > 0 && ajusteItem.qty <= ajusteItem.min))
            ? () => { const n = ajusteItem.nombre; setAjusteItem(null); handlePedirPT(n); } : null}
          onSustituir={ajusteItem.tipo === 'mp' && canDeleteMP
            ? () => { const n = ajusteItem.nombre; setAjusteItem(null); setSustituirMP(n); } : null}
          onEliminar={ajusteItem.tipo === 'mp' && canDeleteMP
            ? () => { const n = ajusteItem.nombre; setAjusteItem(null); setEliminarMP(n); } : null}
        />
      )}

      {/* Cola de aprobación (admin) */}
      {showAprobar && (
        <AprobarAjustesModal
          pendientes={pendientes}
          onClose={() => setShowAprobar(false)}
          onResolved={() => { reloadPendientes(); reloadInv(); }}
        />
      )}

      {/* Revisión de importación Excel (paso 2) — MP o PT */}
      {importPreview && (
        <ImportPreviewModal
          data={importPreview}
          modoPropuesta={esProponente}
          onClose={() => setImportPreview(null)}
          onConfirmed={(n, pendiente) => {
            const t = importPreview.tipo === 'pt' ? 'PT' : 'MP';
            setImportPreview(null);
            reloadInv();
            reloadPendientes();
            setToastMsg(pendiente ? `Importación enviada a aprobación · ${n} ${t}` : `Importación aplicada · ${n} ${t} actualizados`);
            setTimeout(() => setToastMsg(''), 4500);
          }}
        />
      )}

      {/* ── Toast notification ── */}
      {toastMsg && (
        <div style={S.toast('ok')}>
          <span style={{ marginRight: 8 }}>✓</span>
          {toastMsg}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Componente PTUbicacionView — Sprint W3 (jun 2026)
   Desglose de Producto Terminado físicamente en fábrica o en Terán.
   Datos vienen de /api/inventario/pt-por-ubicacion calculado server-side
   desde trazabilidad.json (fuente de verdad para ubicación física).
   ═══════════════════════════════════════════════════════════════════ */
/* Parte B (jun 2026, pedido dueño): modal de transferencia PT Fábrica→Terán.
   Mueve cubetas de inv.pt[X].qty a inv.pt[X].teran (no cambia el total). */
function TransferirPTTeranModal({ producto, isDesktop, onClose, onDone }) {
  const [cant, setCant] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 120); return () => clearTimeout(t); }, []);
  const n = parseInt(cant, 10);
  const valido = !isNaN(n) && n > 0;
  const submit = async () => {
    if (!valido || saving) return;
    setSaving(true); setErr('');
    try { const r = await api.transferirPTaTeran(producto, n); onDone(r); }
    catch (e) { setErr(e?.data?.error || e.message || 'No se pudo transferir'); setSaving(false); }
  };
  return (
    <div style={S.sheetOverlay(isDesktop)} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.sheet(isDesktop)} onClick={e => e.stopPropagation()}>
        <div style={S.shH}>Transferir a Terán</div>
        <div style={S.shS}>{producto}</div>
        <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', margin: '8px 0 14px', lineHeight: 1.5 }}>
          Mueve cubetas del stock de <strong>Fábrica</strong> al de <strong>Terán</strong>. No cambia el total — solo dónde está el producto.
        </div>
        <label style={S.flbl}>Cubetas a transferir</label>
        <input ref={inputRef} style={S.finQty} type="number" inputMode="numeric" step="1" min="1"
          value={cant} onChange={e => setCant(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
        {err && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--lp-danger-700)', fontWeight: 600 }}>{err}</div>}
        <div style={S.shActs}>
          <button style={S.act2(false)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...S.act2(true), opacity: valido && !saving ? 1 : 0.5 }} disabled={!valido || saving} onClick={submit}>
            {saving ? 'Transfiriendo…' : 'Transferir a Terán'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Sprint Y2 (jun 2026, pedido dueño): modal de transferencia de ENVASE/TAPA
   Fábrica→Terán. ESPEJO de TransferirPTTeranModal: mueve N piezas de `stock`
   (Fábrica) a `teran` (Terán) en envases.json — no cambia el total.
   item._env = { tipo:'envase', catKey, subKey, fabrica, teran } | { tipo:'tapa', tapaKey, fabrica, teran }. */
function TransferirEnvaseTeranModal({ item, isDesktop, onClose, onDone }) {
  const [cant, setCant] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 120); return () => clearTimeout(t); }, []);
  const disponible = Number(item?._env?.fabrica) || 0; /* lo que hay en Fábrica para mover */
  const unidad = item?.unidad || 'pz';
  const n = parseInt(cant, 10);
  const valido = !isNaN(n) && n > 0 && n <= disponible;
  const submit = async () => {
    if (!valido || saving) return;
    setSaving(true); setErr('');
    try { const r = await api.transferirEnvaseATeran(item._env, n); onDone(r); }
    catch (e) { setErr(e?.data?.error || e.message || 'No se pudo transferir'); setSaving(false); }
  };
  return (
    <div style={S.sheetOverlay(isDesktop)} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.sheet(isDesktop)} onClick={e => e.stopPropagation()}>
        <div style={S.shH}>Transferir a Terán</div>
        <div style={S.shS}>{item?.nombre}</div>
        <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', margin: '8px 0 14px', lineHeight: 1.5 }}>
          Mueve piezas del stock de <strong>Fábrica</strong> al de <strong>Terán</strong>. No cambia el total — solo dónde están los envases. Disponible en Fábrica: <strong>{disponible.toLocaleString('es-MX')} {unidad}</strong>.
        </div>
        <label style={S.flbl}>Piezas a transferir</label>
        <input ref={inputRef} style={S.finQty} type="number" inputMode="numeric" step="1" min="1" max={disponible}
          value={cant} onChange={e => setCant(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
        {err && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--lp-danger-700)', fontWeight: 600 }}>{err}</div>}
        <div style={S.shActs}>
          <button style={S.act2(false)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...S.act2(true), opacity: valido && !saving ? 1 : 0.5 }} disabled={!valido || saving} onClick={submit}>
            {saving ? 'Transfiriendo…' : 'Transferir a Terán'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Reenvasar PT del pool de Terán: convierte tote/granel en cubetas/galones,
   consumiendo envases vacíos + tapas del pool de TERÁN. Espeja el backend
   POST /api/inventario/pt/reenvasar-teran (el cub-equiv total se conserva). */
const REENV_ML = { tote: 988000, cubeta: 19000, galon: 3785, litro: 946, atomizador750: 750 };
const reenvCubEq = (p, n) => p === 'granel' ? (Number(n) || 0) : (REENV_ML[p] ? (Number(n) || 0) * (REENV_ML[p] / 19000) : 0);
const REENV_TIPO_LBL = { tote: 'Tote', cubeta: 'Cubeta', galon: 'Galón', litro: 'Litro', atomizador750: 'Atomizador', granel: 'Granel' };
const REENV_TIPO_CAT = { cubeta: 'cubeta', galon: 'galon', litro: 'litro', atomizador750: 'otros' };

function ReenvasarTeranModal({ producto, scalar, envData, isDesktop, onClose, onDone }) {
  const origenes = Object.entries(scalar || {}).filter(([p, n]) => reenvCubEq(p, n) > 0.001).map(([p]) => p);
  const [origen, setOrigen] = useState(origenes[0] || 'tote');
  const destinoOpts = ['cubeta', 'galon', 'litro', 'atomizador750'].filter(t => t !== origen);
  const [destinoTipo, setDestinoTipo] = useState(destinoOpts[0] || 'cubeta');
  const [qty, setQty] = useState('');
  const [subKey, setSubKey] = useState('');
  const [tapaKey, setTapaKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const cats = envData?.categorias || {};
  const tapas = envData?.tapas || {};
  const catKey = REENV_TIPO_CAT[destinoTipo];
  const subs = Object.entries(cats[catKey]?.subcategorias || {});
  const usaTapa = !!cats[catKey]?.usa_tapa;
  const tapaList = Object.entries(tapas);

  const n = parseInt(qty, 10);
  const dispCub = reenvCubEq(origen, scalar?.[origen] || 0) + (origen !== 'granel' ? (Number(scalar?.granel) || 0) : 0);
  const producedCub = !isNaN(n) && n > 0 ? reenvCubEq(destinoTipo, n) : 0;
  const valido = !isNaN(n) && n > 0 && producedCub <= dispCub + 0.01;
  const restante = Math.max(0, dispCub - producedCub);

  const submit = async () => {
    if (!valido || saving) return;
    setSaving(true); setErr('');
    try {
      const destinos = [{ tipo: destinoTipo, qty: n, subKey: subKey || null, tapaKey: usaTapa ? (tapaKey || null) : null }];
      const r = await api.reenvasarPTTeran(producto, origen, destinos);
      onDone(r);
    } catch (e) { setErr(e?.data?.error || e.message || 'No se pudo reenvasar'); setSaving(false); }
  };

  const selStyle = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--lp-border-subtle)', fontSize: 13, background: 'var(--lp-bg-base)', color: 'var(--lp-text-primary)' };

  return (
    <div style={S.sheetOverlay(isDesktop)} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.sheet(isDesktop)} onClick={e => e.stopPropagation()}>
        <div style={S.shH}>Reenvasar en Terán</div>
        <div style={S.shS}>{producto}</div>
        <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', margin: '8px 0 14px', lineHeight: 1.5 }}>
          Convierte un <strong>tote</strong> (o granel) en cubetas/galones. No cambia el total de pintura — solo su forma. Consume envases vacíos del stock de <strong>Terán</strong>; lo que sobra de un tote abierto queda <strong>a granel</strong>.
        </div>

        <label style={S.flbl}>Origen</label>
        <select style={selStyle} value={origen} onChange={e => setOrigen(e.target.value)}>
          {origenes.map(p => (
            <option key={p} value={p}>{REENV_TIPO_LBL[p] || p} — {p === 'granel' ? `${Math.round(scalar[p])} cub` : `${scalar[p]} (${Math.round(reenvCubEq(p, scalar[p]))} cub)`} disp.</option>
          ))}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 10, marginTop: 12 }}>
          <div>
            <label style={S.flbl}>Convertir a</label>
            <select style={selStyle} value={destinoTipo} onChange={e => { setDestinoTipo(e.target.value); setSubKey(''); setTapaKey(''); }}>
              {destinoOpts.map(t => <option key={t} value={t}>{REENV_TIPO_LBL[t]}</option>)}
            </select>
          </div>
          <div>
            <label style={S.flbl}>Cantidad</label>
            <input style={S.finQty} type="number" inputMode="numeric" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
          </div>
        </div>

        <label style={{ ...S.flbl, marginTop: 12 }}>Envase a usar (de Terán)</label>
        <select style={selStyle} value={subKey} onChange={e => setSubKey(e.target.value)}>
          <option value="">— sin descontar envase —</option>
          {subs.map(([sk, sub]) => <option key={sk} value={sk}>{sub.nombre} (Terán: {Math.round(Number(sub.teran) || 0)})</option>)}
        </select>
        {usaTapa && (
          <>
            <label style={{ ...S.flbl, marginTop: 12 }}>Tapa (de Terán)</label>
            <select style={selStyle} value={tapaKey} onChange={e => setTapaKey(e.target.value)}>
              <option value="">— sin tapa —</option>
              {tapaList.map(([tk, t]) => <option key={tk} value={tk}>{t.nombre} (Terán: {Math.round(Number(t.teran) || 0)})</option>)}
            </select>
          </>
        )}

        <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--lp-bg-sunken)', borderRadius: 8, fontSize: 12.5, color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
          Disponible en <strong>{REENV_TIPO_LBL[origen] || origen}</strong>: <strong>{Math.round(dispCub)} cub-equiv</strong><br />
          Producirás: <strong>{n > 0 ? n : 0} {(REENV_TIPO_LBL[destinoTipo] || '').toLowerCase()}</strong> = {producedCub ? (producedCub < 10 ? producedCub.toFixed(2) : Math.round(producedCub)) : 0} cub-equiv<br />
          {valido && <>Quedará a granel: <strong>~{Math.round(restante)} cub</strong></>}
        </div>

        {err && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--lp-danger-700)', fontWeight: 600 }}>{err}</div>}
        <div style={S.shActs}>
          <button style={S.act2(false)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...S.act2(true), opacity: valido && !saving ? 1 : 0.5 }} disabled={!valido || saving} onClick={submit}>
            {saving ? 'Reenvasando…' : 'Reenvasar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PTUbicacionView({ ubicacion, data, query, onQuery, canPedir, onPedir, canEdit, onAgregar, onEliminarTeran, onTransferir, onReenvasar }) {
  const bucket = data?.[ubicacion] || {};
  const productos = Object.entries(bucket)
    .filter(([nombre]) => {
      if (!query) return true;
      return nombre.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  /* Totales agregados */
  const totales = productos.reduce((acc, [, d]) => {
    acc.tote   += d.tote   || 0;
    acc.cubeta += d.cubeta || 0;
    acc.galon  += d.galon  || 0;
    acc.litro  += d.litro  || 0;
    acc.atm    += d.atm    || 0;
    acc.granel += d.granel || 0;
    return acc;
  }, { tote: 0, cubeta: 0, galon: 0, litro: 0, atm: 0, granel: 0 });

  const esFabrica = ubicacion === 'fabrica';
  /* Grid: Producto · TOTE · Cub · Gal · Lt · ATM · Granel · Acción */
  const gridCols = 'minmax(170px, 2fr) 60px 60px 60px 56px 56px 72px 132px';
  /* ¿Hay algo reenvasable en el pool ESCALAR de este renglón? (tote/granel/…) */
  const reenvasable = (d) => !esFabrica && !!onReenvasar && d.teranPresScalar
    && Object.entries(d.teranPresScalar).some(([p, n]) => (Number(n) || 0) > 0 && p !== 'litro' && p !== 'atomizador750');
  const acentColor = esFabrica ? 'var(--lp-warning-600)' : 'var(--lp-brand-600)';
  const acentBg    = esFabrica ? 'var(--lp-warning-100)' : 'var(--lp-brand-100)';

  return (
    <>
      {/* Mini KPIs del totalizado */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 10, marginBottom: 14,
      }}>
        {[
          { label: 'Productos', v: productos.length },
          { label: 'TOTEs',     v: totales.tote },
          { label: 'Cubetas',   v: totales.cubeta },
          { label: 'Galones',   v: totales.galon },
          { label: 'Litros',    v: totales.litro },
          { label: 'ATM',       v: totales.atm },
          ...(!esFabrica ? [{ label: 'Granel (cub)', v: Math.round(totales.granel) }] : []),
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--lp-bg-raised)',
            border: '1.5px solid var(--lp-border-subtle)',
            borderTop: `3px solid ${acentColor}`,
            borderRadius: 'var(--lp-radius-sm)',
            padding: '12px 14px', textAlign: 'center',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              color: 'var(--lp-text-tertiary)', letterSpacing: '.05em',
            }}>{k.label}</div>
            <div style={{
              fontSize: 22, fontWeight: 700, fontFamily: 'var(--lp-font-mono)',
              color: 'var(--lp-text-primary)', marginTop: 4,
            }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Nota explicativa según ubicación */}
      <div style={{
        padding: '10px 14px', background: acentBg, borderRadius: 8,
        fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 14,
        lineHeight: 1.5,
      }}>
        {esFabrica
          ? 'Stock físicamente en planta de fábrica — sublotes envasados que aún no han sido recogidos por Luis para llevar a Terán. También incluye PT histórico cargado manualmente o de producciones previas a la trazabilidad por lote (marcado con etiqueta "sin lote").'
          : 'Stock físicamente en almacén Terán — sublotes que ya fueron entregados por Luis y recibidos por Josué.'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder={`Buscar en ${esFabrica ? 'fábrica' : 'Terán'}…`}
          value={query}
          onChange={e => onQuery(e.target.value)}
          style={{
            flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10,
            border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
            fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
          }}
        />
        {canEdit && onAgregar && (
          <button onClick={() => onAgregar(ubicacion)} style={{ padding: '10px 16px', borderRadius: 10, border: `1.5px solid ${acentColor}`, background: acentBg, color: acentColor, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap', minWidth: 'max-content' }}>
            + Agregar a {esFabrica ? 'Fábrica' : 'Terán'}
          </button>
        )}
      </div>

      {productos.length === 0 ? (
        <div style={{
          padding: '40px 20px', textAlign: 'center',
          color: 'var(--lp-text-tertiary)', fontSize: 14,
        }}>
          {query
            ? `Sin resultados en ${esFabrica ? 'fábrica' : 'Terán'} para "${query}"`
            : `Sin producto terminado en ${esFabrica ? 'fábrica' : 'Terán'}.`}
        </div>
      ) : (
        <div style={{
          background: 'var(--lp-bg-raised)',
          border: '1.5px solid var(--lp-border-subtle)',
          borderRadius: 'var(--lp-radius-md)', overflow: 'hidden',
        }}>
          {/* Header de tabla */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: gridCols,
            padding: '10px 14px',
            background: 'var(--lp-bg-sunken)',
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            color: 'var(--lp-text-tertiary)', letterSpacing: '.05em',
            borderBottom: '1px solid var(--lp-border-subtle)',
          }}>
            <span>Producto</span>
            <span style={{ textAlign: 'right' }}>TOTE</span>
            <span style={{ textAlign: 'right' }}>Cub</span>
            <span style={{ textAlign: 'right' }}>Gal</span>
            <span style={{ textAlign: 'right' }}>Lt</span>
            <span style={{ textAlign: 'right' }}>ATM</span>
            <span style={{ textAlign: 'right' }} title="Volumen suelto en cub-equiv (tote abierto al reenvasar)">Granel</span>
            <span style={{ textAlign: 'right' }}>Acción</span>
          </div>
          {/* Filas */}
          {productos.map(([nombre, d]) => {
            const tieneResidual = (d.residual || 0) > 0;
            const todoResidual = tieneResidual && (d.sublotes || 0) === 0;
            return (
              <div key={nombre} style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                padding: '12px 14px',
                borderBottom: '1px solid var(--lp-border-subtle)',
                fontSize: 13, alignItems: 'center',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--lp-text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {nombre}
                  {tieneResidual && (
                    <span
                      title={todoResidual
                        ? 'Stock cargado manualmente o de producciones previas a la trazabilidad — no se puede mover a Terán por el flujo de sublotes/QR.'
                        : `${Math.round(d.residual)} cub sin lote (cargado manual / pre-trazabilidad). El resto sí está trackeado.`}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)',
                        border: '1px solid var(--lp-border-subtle)',
                        textTransform: 'uppercase', letterSpacing: '.04em',
                      }}
                    >
                      {todoResidual ? 'sin lote' : `+${Math.round(d.residual)} sin lote`}
                    </span>
                  )}
                  {/* Sprint X: porción agregada a mano en Terán (eliminable) */}
                  {!esFabrica && (Number(d.manual) || 0) > 0 && (
                    <span
                      title={`${Math.round(d.manual)} cub registradas a mano en Terán`}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)',
                        border: '1px solid var(--lp-brand-600)',
                        textTransform: 'uppercase', letterSpacing: '.04em',
                      }}
                    >+{Math.round(d.manual)} manual</span>
                  )}
                </span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontSize: 19, fontWeight: 600, color: (d.tote || 0)   > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>{d.tote   || 0}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontSize: 19, fontWeight: 600, color: (d.cubeta || 0) > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>{d.cubeta || 0}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontSize: 19, fontWeight: 600, color: (d.galon || 0)  > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>{d.galon  || 0}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontSize: 19, fontWeight: 600, color: (d.litro || 0)  > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>{d.litro  || 0}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontSize: 19, fontWeight: 600, color: (d.atm || 0)    > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>{d.atm    || 0}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontSize: 16, fontWeight: 600, color: (d.granel || 0) > 0 ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)' }} title={(d.granel || 0) > 0 ? `${Math.round(d.granel)} cub-equiv a granel (tote abierto)` : ''}>{(d.granel || 0) > 0 ? Math.round(d.granel) : 0}</span>
                <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {canPedir && (
                    <button
                      onClick={() => onPedir(nombre)}
                      title={esFabrica
                        ? 'Pedir producción para reponer en fábrica'
                        : 'Pedir reposición a fábrica'}
                      style={{ ...S.btnGhost, minWidth: 96, color: acentColor, borderColor: `color-mix(in srgb, ${acentColor} 45%, transparent)` }}
                    >Pedir</button>
                  )}
                  {/* Parte B (jun 2026): Josué transfiere PT de Fábrica → Terán (mueve inv.pt qty→teran). */}
                  {esFabrica && onTransferir && (
                    <button
                      onClick={() => onTransferir(nombre)}
                      title="Transferir cubetas de este PT del stock de Fábrica al de Terán"
                      style={{ ...S.btnGhost, minWidth: 96, color: 'var(--lp-brand-700)', borderColor: 'color-mix(in srgb, var(--lp-brand-600) 45%, transparent)' }}
                    >→ Terán</button>
                  )}
                  {/* Reenvasar en Terán: tote/granel → cubetas/galones (descuenta envases de Terán). */}
                  {reenvasable(d) && (
                    <button
                      onClick={() => onReenvasar(nombre, d.teranPresScalar)}
                      title="Reenvasar: convertir tote/granel en cubetas o galones (consume envases de Terán)"
                      style={{ ...S.btnGhost, minWidth: 96, color: 'var(--lp-brand-700)', borderColor: 'color-mix(in srgb, var(--lp-brand-600) 45%, transparent)' }}
                    >Reenvasar</button>
                  )}
                  {/* Sprint X: eliminar el registro MANUAL de Terán (no toca lotes rastreados) */}
                  {!esFabrica && canEdit && onEliminarTeran && (Number(d.manual) || 0) > 0 && (
                    <button
                      onClick={() => onEliminarTeran(nombre)}
                      title={`Quitar de Terán (${Math.round(d.manual)} cub manual). No afecta lotes rastreados ni el stock total.`}
                      style={{ ...S.btnGhost, minWidth: 96, color: 'var(--lp-danger-600)', borderColor: 'color-mix(in srgb, var(--lp-danger-600) 45%, transparent)' }}
                    >Eliminar</button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {data?.timestamp && (
        <div style={{
          marginTop: 12, fontSize: 11, color: 'var(--lp-text-tertiary)',
          textAlign: 'right',
        }}>
          Actualizado: {new Date(data.timestamp).toLocaleTimeString('es-MX')}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Componente MPUbicacionView — Sprint X (jun 2026, pedido dueño)
   Desglose de MATERIA PRIMA por almacén (fábrica o Terán). Datos de
   /api/inventario/mp-por-ubicacion (inv.mp[X].ubic). Burgos ve qué MP
   hay en cada almacén y puede AGREGAR o AJUSTAR (con candado).
   ═══════════════════════════════════════════════════════════════════ */
function MPUbicacionView({ ubicacion, data, query, onQuery, canEdit, onAgregar, onFijar }) {
  const bucket = data?.[ubicacion] || {};
  const productos = Object.entries(bucket)
    .filter(([nombre]) => !query || nombre.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const totalKg = productos.reduce((s, [, d]) => s + (Number(d.qty) || 0), 0);
  const bajoMin = productos.filter(([, d]) => (Number(d.min) || 0) > 0 && (Number(d.qty) || 0) <= (Number(d.min) || 0)).length;
  const conStock = productos.filter(([, d]) => (Number(d.qty) || 0) > 0).length;

  const esFabrica = ubicacion === 'fabrica';
  const acentColor = esFabrica ? 'var(--lp-warning-600)' : 'var(--lp-brand-600)';
  const acentBg    = esFabrica ? 'var(--lp-warning-100)' : 'var(--lp-brand-100)';

  /* KPIs: Fábrica muestra "Bajo mínimo" (stock de producción / reorden);
     Terán es un pool aparte → solo cuenta y kg. */
  const kpis = esFabrica
    ? [
        { label: 'Materias primas', v: productos.length },
        { label: 'Con existencia', v: conStock },
        { label: 'Kg en fábrica', v: Math.round(totalKg).toLocaleString('es-MX') },
        { label: 'Bajo mínimo', v: bajoMin },
      ]
    : [
        { label: 'MP en Terán', v: productos.length },
        { label: 'Kg en Terán', v: Math.round(totalKg).toLocaleString('es-MX') },
      ];

  return (
    <>
      {/* Mini KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
            borderTop: `3px solid ${acentColor}`, borderRadius: 'var(--lp-radius-sm)',
            padding: '12px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-tertiary)', letterSpacing: '.05em' }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', marginTop: 4 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Nota explicativa */}
      <div style={{ padding: '10px 14px', background: acentBg, borderRadius: 8, fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
        {esFabrica
          ? 'Stock de PRODUCCIÓN: la materia prima que Enrique descuenta al fabricar. Es la misma que ves en la pestaña Stock. Forecast y MRP usan estas cantidades.'
          : 'Almacén APARTE. La MP que guardes en Terán NO se usa para producir y NUNCA se descuenta por producción. Solo aparece aquí lo que tú agregues explícitamente.'}
      </div>

      {/* Toolbar: buscador + Agregar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder={`Buscar MP en ${esFabrica ? 'fábrica' : 'Terán'}…`}
          value={query}
          onChange={e => onQuery(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--lp-border-subtle)', fontSize: 13, fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none' }}
        />
        {canEdit && (
          <button onClick={onAgregar} style={{ padding: '10px 16px', borderRadius: 10, border: `1.5px solid ${acentColor}`, background: acentBg, color: acentColor, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap', minWidth: 'max-content' }}>
            + Agregar MP a {esFabrica ? 'Fábrica' : 'Terán'}
          </button>
        )}
      </div>

      {productos.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--lp-text-tertiary)', fontSize: 14, lineHeight: 1.6 }}>
          {query
            ? `Sin resultados en ${esFabrica ? 'fábrica' : 'Terán'} para "${query}"`
            : esFabrica
              ? 'Sin materia prima en fábrica.'
              : 'Terán está vacío. Usa "+ Agregar MP a Terán" para registrar lo que guardes allá — no se descuenta por producción.'}
        </div>
      ) : (
        <div style={{ background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-md)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) 110px 90px 120px', padding: '10px 14px', background: 'var(--lp-bg-sunken)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-tertiary)', letterSpacing: '.05em', borderBottom: '1px solid var(--lp-border-subtle)' }}>
            <span>Materia prima</span>
            <span style={{ textAlign: 'right' }}>Kg aquí</span>
            <span style={{ textAlign: 'right' }}>Mínimo</span>
            <span style={{ textAlign: 'right' }}>Acción</span>
          </div>
          {productos.map(([nombre, d]) => (
            <MPUbicRow key={nombre} mp={nombre} qty={Number(d.qty) || 0} min={Number(d.min) || 0}
              esTeran={!esFabrica} canEdit={canEdit} onFijar={onFijar} acentColor={acentColor} />
          ))}
        </div>
      )}

      {data?.timestamp && (
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--lp-text-tertiary)', textAlign: 'right' }}>
          Actualizado: {new Date(data.timestamp).toLocaleTimeString('es-MX')}
        </div>
      )}
    </>
  );
}

/* Fila editable de MP por almacén: "Ajustar" abre un input inline; al guardar
   pasa por onFijar → handleSaveMPUbic → candado. */
function MPUbicRow({ mp, qty, min, esTeran, canEdit, onFijar, acentColor }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(qty));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setVal(String(qty)); }, [qty]);
  const low = min > 0 && qty <= min;

  const guardar = async () => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) return;
    setSaving(true);
    try { await onFijar(mp, n); setEditing(false); }
    catch { /* el wrapper ya alertó / canceló */ }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) 110px 90px 120px', padding: '12px 14px', borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 13, alignItems: 'center' }}>
      <span style={{ fontWeight: 600, color: 'var(--lp-text-primary)' }}>{mp}</span>
      {editing ? (
        <input type="number" inputMode="decimal" step="0.1" min="0" value={val} autoFocus
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') { setVal(String(qty)); setEditing(false); } }}
          style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', padding: '6px 8px', borderRadius: 6, border: `1.5px solid ${acentColor}`, fontSize: 13, width: '100%', outline: 'none' }} />
      ) : (
        <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: low ? 'var(--lp-danger-600)' : qty > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>{qty.toLocaleString('es-MX')}</span>
      )}
      <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)' }}>{min > 0 ? min.toLocaleString('es-MX') : '—'}</span>
      <span style={{ textAlign: 'right' }}>
        {canEdit && (editing ? (
          <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={guardar} disabled={saving} title="Guardar (candado)" style={{ padding: '5px 9px', borderRadius: 6, border: `1px solid ${acentColor}`, background: acentColor, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? '…' : '✓'}</button>
            <button onClick={() => { setVal(String(qty)); setEditing(false); }} title="Cancelar" style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid var(--lp-border-subtle)', background: 'transparent', color: 'var(--lp-text-secondary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕</button>
          </span>
        ) : (
          <button onClick={() => setEditing(true)} title={esTeran ? 'Fijar el stock de Terán (conteo físico) — no afecta producción' : 'Fijar el stock de producción en fábrica (conteo físico)'} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${acentColor}`, background: 'transparent', color: acentColor, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)' }}>Ajustar</button>
        ))}
      </span>
    </div>
  );
}

/* ── Detección de nombres parecidos (anti-typo, jun 2026, pedido dueño) ──
   Al dar de alta MP/PT nuevos, si hay nombres similares en el catálogo se le
   pregunta al usuario si es realmente nueva o se refiere a una existente mal
   escrita. Normaliza (minúsculas, sin acentos ni puntuación) y combina
   igualdad-normalizada + distancia de edición + subcadena. */
function _normNombre(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function _lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
function nombresSimilares(nombre, lista, max = 5) {
  const n = _normNombre(nombre);
  if (!n) return [];
  const nns = n.replace(/ /g, '');
  const out = [];
  for (const item of (lista || [])) {
    const e = _normNombre(item);
    if (!e || item === nombre) continue; /* idéntico exacto ya existe, no es "parecido" */
    const ens = e.replace(/ /g, '');
    let score = null;
    if (e === n) score = 0;                                         /* misma palabra, distinto formato */
    else {
      const dist = _lev(nns, ens);
      const thr = Math.max(2, Math.floor(Math.max(nns.length, ens.length) * 0.2));
      if (dist <= thr) score = dist;
      else if (nns.length >= 4 && (ens.includes(nns) || nns.includes(ens))) score = thr + 1;
    }
    if (score != null) out.push({ item, score });
  }
  return out.sort((a, b) => a.score - b.score).slice(0, max).map(x => x.item);
}

/* Bloque de confirmación inline "¿es nueva o una existente parecida?" */
function ConfirmNuevaBox({ nombre, similares, tipo, onUsarExistente, onEsNueva, onCancelar }) {
  return (
    <div style={{ marginTop: 6, border: '1.5px solid var(--lp-warning-600)', background: 'var(--lp-warning-100)', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--lp-text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
        Hay {tipo === 'mp' ? 'materias primas' : 'productos'} con nombre parecido a “{nombre}”. ¿Es {tipo === 'mp' ? 'una MP nueva' : 'un producto nuevo'} o te refieres a una de estas?
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {similares.map(s => (
          <button key={s} type="button" onClick={() => onUsarExistente(s)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)' }}>
            {s}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={onEsNueva}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--lp-brand-600)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)' }}>
          Sí, es {tipo === 'mp' ? 'nueva' : 'nuevo'}
        </button>
        <button type="button" onClick={onCancelar}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)', background: 'transparent', color: 'var(--lp-text-secondary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ── Modal "Agregar MP a almacén" (fábrica/Terán) — Sprint X ──
   Suma una cantidad al almacén elegido (modo 'agregar'). El total de la MP sube. */
function AgregarMPUbicacionModal({ ubicacion, mpList, onClose, onSubmit }) {
  useBodyScrollLock();
  const [mp, setMp] = useState('');
  const [search, setSearch] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmNueva, setConfirmNueva] = useState(null); /* { nombre, similares } */
  const [confirmadoNuevo, setConfirmadoNuevo] = useState(''); /* nombre ya confirmado como nuevo */
  const inputRef = useRef(null);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const esFabrica = ubicacion === 'fabrica';
  const filtered = useMemo(() => {
    if (!search) return mpList;
    const q = search.toLowerCase();
    return mpList.filter(m => m.toLowerCase().includes(q));
  }, [mpList, search]);
  /* ¿El texto escrito NO coincide con ninguna MP existente? → ofrecer crearla. */
  const qTrim = search.trim();
  const hayExacta = !!qTrim && mpList.some(m => m.toLowerCase() === qTrim.toLowerCase());
  const puedeCrear = !!qTrim && !hayExacta;
  const mpEsNueva = !!mp && !mpList.some(m => m.toLowerCase() === mp.toLowerCase());

  /* Al pedir crear: si hay nombres parecidos, confirmar; si no, crear directo. */
  const pedirCrear = (nombre) => {
    const sim = nombresSimilares(nombre, mpList);
    if (sim.length === 0) { setMp(nombre); setSearch(''); setConfirmadoNuevo(nombre); }
    else setConfirmNueva({ nombre, similares: sim });
  };

  const handleSubmit = async () => {
    const elegido = (mp || search.trim());
    if (!elegido) return setError('Escribe o selecciona una materia prima');
    /* Red de seguridad: aunque entren por el botón Agregar sin pasar por
       "+ Crear nueva", si es una MP NUEVA con nombres parecidos y no se ha
       confirmado, preguntar antes de crear (pedido dueño). */
    const existe = mpList.some(m => m.toLowerCase() === elegido.toLowerCase());
    if (!existe && elegido !== confirmadoNuevo) {
      const sim = nombresSimilares(elegido, mpList);
      if (sim.length > 0) { setConfirmNueva({ nombre: elegido, similares: sim }); return; }
    }
    const qty = parseFloat(cantidad);
    if (!qty || qty <= 0) return setError('La cantidad debe ser mayor a 0');
    setSaving(true); setError('');
    try { await onSubmit(elegido, qty); }
    catch (e) { setError(e?.data?.error || e?.message || 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <span style={S.modalTitle}>Agregar MP a {esFabrica ? 'Fábrica' : 'Terán'}</span>
          <button style={S.modalClose} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          <div style={{ padding: '8px 12px', background: esFabrica ? 'var(--lp-warning-100)' : 'var(--lp-brand-100)', borderRadius: 8, fontSize: 12, color: 'var(--lp-text-secondary)', lineHeight: 1.5 }}>
            Suma esta cantidad al almacén <b>{esFabrica ? 'Fábrica' : 'Terán'}</b>. El total de la MP sube en consecuencia. Si la materia prima no existe, escríbela y la das de alta. No pide código (solo suma stock).
          </div>
          <div>
            <label style={S.fieldLabel}>Materia Prima *</label>
            <input ref={inputRef} type="text" style={S.fieldInput} placeholder="Buscar o escribir nueva MP..."
              value={mp || search} onChange={e => { setSearch(e.target.value); setMp(''); }} />
            {search && !mp && !confirmNueva && (filtered.length > 0 || puedeCrear) && (
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, marginTop: 4, background: 'var(--lp-bg-raised)' }}>
                {filtered.slice(0, 12).map(m => (
                  <div key={m} onClick={() => { setMp(m); setSearch(''); }}
                    style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--lp-border-subtle)', color: 'var(--lp-text-primary)', fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-bg-sunken)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{m}</div>
                ))}
                {puedeCrear && (
                  <div onClick={() => pedirCrear(qTrim)}
                    style={{ padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', color: 'var(--lp-brand-700)', fontWeight: 700, background: 'var(--lp-brand-50)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-brand-100)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--lp-brand-50)'}>
                    + Crear nueva materia prima: “{qTrim}”
                  </div>
                )}
              </div>
            )}
            {confirmNueva && (
              <ConfirmNuevaBox
                nombre={confirmNueva.nombre} similares={confirmNueva.similares} tipo="mp"
                onUsarExistente={(s) => { setMp(s); setSearch(''); setConfirmadoNuevo(''); setConfirmNueva(null); }}
                onEsNueva={() => { setMp(confirmNueva.nombre); setConfirmadoNuevo(confirmNueva.nombre); setSearch(''); setConfirmNueva(null); }}
                onCancelar={() => setConfirmNueva(null)}
              />
            )}
            {mp && (
              <div style={{ marginTop: 4, padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: mpEsNueva ? 'var(--lp-success-100)' : 'var(--lp-brand-100)', color: mpEsNueva ? 'var(--lp-success-700)' : 'var(--lp-brand-700)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {mpEsNueva ? `Nueva: ${mp}` : mp}
                <span style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => { setMp(''); setSearch(''); }}>✕</span>
              </div>
            )}
          </div>
          <div>
            <label style={S.fieldLabel}>Cantidad a agregar (kg) *</label>
            <input type="number" inputMode="decimal" step="0.1" min="0" style={S.fieldInput}
              placeholder="Ej: 25.0" value={cantidad} onChange={e => setCantidad(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} />
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--lp-danger-600)', fontWeight: 600 }}>{error}</div>}
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnPrimary} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : `Agregar a ${esFabrica ? 'Fábrica' : 'Terán'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal "Agregar PT a almacén" (fábrica = stock de producción / Terán = pool
   manual) — Sprint X. En cubetas, modo 'agregar'. ── */
function AgregarPTUbicacionModal({ ubicacion, ptList, onClose, onSubmit }) {
  useBodyScrollLock();
  const esFabrica = ubicacion === 'fabrica';
  const [prod, setProd] = useState('');
  const [search, setSearch] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [medida, setMedida] = useState('cubeta'); /* tote/cubeta/galón/litro/atomizador */
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmNueva, setConfirmNueva] = useState(null);
  const [confirmadoNuevo, setConfirmadoNuevo] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const filtered = useMemo(() => {
    if (!search) return ptList;
    const q = search.toLowerCase();
    return ptList.filter(m => m.toLowerCase().includes(q));
  }, [ptList, search]);
  const qTrim = search.trim();
  const hayExacta = !!qTrim && ptList.some(m => m.toLowerCase() === qTrim.toLowerCase());
  const puedeCrear = !!qTrim && !hayExacta;
  const prodEsNuevo = !!prod && !ptList.some(m => m.toLowerCase() === prod.toLowerCase());

  const pedirCrear = (nombre) => {
    const sim = nombresSimilares(nombre, ptList);
    if (sim.length === 0) { setProd(nombre); setSearch(''); setConfirmadoNuevo(nombre); }
    else setConfirmNueva({ nombre, similares: sim });
  };

  const handleSubmit = async () => {
    const elegido = prod || search.trim();
    if (!elegido) return setError('Selecciona o escribe un producto');
    const existe = ptList.some(m => m.toLowerCase() === elegido.toLowerCase());
    if (!existe && elegido !== confirmadoNuevo) {
      const sim = nombresSimilares(elegido, ptList);
      if (sim.length > 0) { setConfirmNueva({ nombre: elegido, similares: sim }); return; }
    }
    const cantNum = parseFloat(cantidad);
    if (!cantNum || cantNum <= 0) return setError('La cantidad debe ser mayor a 0');
    const qty = medidaACubetas(medida, cantNum); /* cubeta-equivalente para el stock base */
    setSaving(true); setError('');
    try {
      await onSubmit(elegido, qty);
      /* Guarda la medida real (ej. "2 totes") como metadato — no rompe si falla. */
      try { await api.ptMeta(elegido, { medida, medidaQty: cantNum }); } catch (_) {}
    }
    catch (e) { setError(e?.data?.error || e?.message || 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <span style={S.modalTitle}>Agregar PT a {esFabrica ? 'Fábrica' : 'Terán'}</span>
          <button style={S.modalClose} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          <div style={{ padding: '8px 12px', background: esFabrica ? 'var(--lp-warning-100)' : 'var(--lp-brand-100)', borderRadius: 8, fontSize: 12, color: 'var(--lp-text-secondary)', lineHeight: 1.5 }}>
            {esFabrica
              ? <>Suma cubetas al stock de <b>producción en fábrica</b> (qty). Es el stock que se vende y descuenta al fabricar. No pide código (solo suma stock).</>
              : <>Registra producto terminado físicamente en <b>Terán</b> (en cubetas) que no llegó por el flujo de lotes/QR. No afecta el stock total ni la producción. No pide código (solo suma stock).</>}
          </div>
          <div>
            <label style={S.fieldLabel}>Producto *</label>
            <input ref={inputRef} type="text" style={S.fieldInput} placeholder="Buscar o escribir nuevo producto..."
              value={prod || search} onChange={e => { setSearch(e.target.value); setProd(''); }} />
            {search && !prod && !confirmNueva && (filtered.length > 0 || puedeCrear) && (
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, marginTop: 4, background: 'var(--lp-bg-raised)' }}>
                {filtered.slice(0, 12).map(m => (
                  <div key={m} onClick={() => { setProd(m); setSearch(''); }}
                    style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--lp-border-subtle)', color: 'var(--lp-text-primary)', fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-bg-sunken)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{m}</div>
                ))}
                {puedeCrear && (
                  <div onClick={() => pedirCrear(qTrim)}
                    style={{ padding: '9px 14px', fontSize: 12.5, cursor: 'pointer', color: 'var(--lp-brand-700)', fontWeight: 700, background: 'var(--lp-brand-50)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--lp-brand-100)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--lp-brand-50)'}>
                    + Crear nuevo producto: “{qTrim}”
                  </div>
                )}
              </div>
            )}
            {confirmNueva && (
              <ConfirmNuevaBox
                nombre={confirmNueva.nombre} similares={confirmNueva.similares} tipo="pt"
                onUsarExistente={(s) => { setProd(s); setSearch(''); setConfirmadoNuevo(''); setConfirmNueva(null); }}
                onEsNueva={() => { setProd(confirmNueva.nombre); setConfirmadoNuevo(confirmNueva.nombre); setSearch(''); setConfirmNueva(null); }}
                onCancelar={() => setConfirmNueva(null)}
              />
            )}
            {prod && (
              <div style={{ marginTop: 4, padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: prodEsNuevo ? 'var(--lp-success-100)' : 'var(--lp-brand-100)', color: prodEsNuevo ? 'var(--lp-success-700)' : 'var(--lp-brand-700)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {prodEsNuevo ? `Nuevo: ${prod}` : prod}
                <span style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => { setProd(''); setSearch(''); }}>✕</span>
              </div>
            )}
          </div>
          <div>
            <label style={S.fieldLabel}>Medida *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {PT_MEDIDAS.map(m => {
                const on = medida === m.key;
                return (
                  <button key={m.key} type="button" onClick={() => setMedida(m.key)}
                    style={{ height: 34, padding: '0 11px', borderRadius: 999, cursor: 'pointer',
                      fontFamily: 'var(--lp-font-sans)', fontSize: 12, fontWeight: on ? 600 : 500,
                      border: on ? '1px solid transparent' : '1px solid var(--lp-border-subtle)',
                      background: on ? 'color-mix(in srgb, var(--lp-brand-600) 14%, transparent)' : 'var(--lp-bg-raised)',
                      color: on ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)', whiteSpace: 'nowrap' }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
            <label style={S.fieldLabel}>Cantidad ({ptMedidaDef(medida)?.label || 'unidades'}) *</label>
            <input type="number" inputMode="decimal" step="1" min="0" style={S.fieldInput}
              placeholder="Ej: 12" value={cantidad} onChange={e => setCantidad(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} />
            {medida !== 'cubeta' && cantidad && parseFloat(cantidad) > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
                = <strong>{medidaACubetas(medida, parseFloat(cantidad)).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</strong> cubetas-equivalente
              </div>
            )}
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--lp-danger-600)', fontWeight: 600 }}>{error}</div>}
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnPrimary} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : `Agregar a ${esFabrica ? 'Fábrica' : 'Terán'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal "Agregar envase" (presentación nueva) — Sprint Y jun 2026.
   Crea una subcategoría en /api/envases/subcategoria y, si hay stock inicial,
   lo fija con /api/envases/stock. Ventana emergente igual que MP/PT. ── */
function AgregarEnvaseModal({ categorias, onClose, onSaved }) {
  useBodyScrollLock();
  const [categoria, setCategoria] = useState(categorias[0] || '');
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [min, setMin] = useState('');
  const [stock, setStock] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  const handleSubmit = async () => {
    const nom = nombre.trim();
    if (!categoria) return setError('Selecciona una categoría');
    if (!nom) return setError('Escribe el nombre del envase');
    setSaving(true); setError('');
    try {
      const id = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || ('env-' + nom.length);
      await api.post('/api/envases/subcategoria', { categoria, id, nombre: nom, marca: marca.trim() || undefined, min: Number(min) || 0 });
      const stk = Number(stock) || 0;
      if (stk > 0 || Number(min) > 0) {
        await api.post('/api/envases/stock', { categoria, subcategoria: id, subKey: id, stock: stk, min: Number(min) || 0 });
      }
      onSaved(`${nom} agregado a ${categoria}`);
    } catch (e) {
      setError(e?.data?.error || e?.message || 'No se pudo agregar');
    } finally { setSaving(false); }
  };

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <span style={S.modalTitle}>Agregar envase</span>
          <button style={S.modalClose} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          <div>
            <label style={S.fieldLabel}>Categoría *</label>
            <select style={S.fieldInput} value={categoria} onChange={e => setCategoria(e.target.value)}>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={S.fieldLabel}>Nombre / presentación *</label>
            <input ref={inputRef} type="text" style={S.fieldInput} placeholder="Ej. 19L Estándar" maxLength={120}
              value={nombre} onChange={e => setNombre(e.target.value)} />
          </div>
          <div>
            <label style={S.fieldLabel}>Marca (opcional)</label>
            <input type="text" style={S.fieldInput} placeholder="Ej. Premium" maxLength={80}
              value={marca} onChange={e => setMarca(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={S.fieldLabel}>Existencia inicial (pz)</label>
              <input type="number" inputMode="decimal" min="0" style={S.fieldInput} placeholder="0"
                value={stock} onChange={e => setStock(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.fieldLabel}>Mínimo (pz)</label>
              <input type="number" inputMode="decimal" min="0" style={S.fieldInput} placeholder="0"
                value={min} onChange={e => setMin(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} />
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--lp-danger-600)', fontWeight: 600 }}>{error}</div>}
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnPrimary} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : 'Agregar envase'}
          </button>
        </div>
      </div>
    </div>
  );
}
