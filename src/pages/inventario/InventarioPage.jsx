import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  'Efectos Especiales':       { icon: 'FX', bg: '#EDE9FE',              fg: '#5B21B6' },
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
    zIndex: 1000, padding: 16,
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
function PTRow({ item, canEdit, canContar, onAdjust, onContar, query }) {
  const { nombre, inv, pct } = item;
  const qty = inv.qty || 0;
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
        <span style={S.mQty(sev.key === 'critico')}>{qty.toLocaleString('es-MX', { maximumFractionDigits: 1 })} cub</span>
        <span style={S.mMin}>mín {(inv.min || 0).toLocaleString('es-MX')} cub</span>
        {inv.sku && <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }}>{inv.sku}</span>}
        {canContar && !canEdit && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--lp-brand-700)' }}>Contar →</span>}
      </div>
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
          <div style={S.sectionHeader('#EDE9FE', '#5B21B6')}>
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(catKey, subKey, parseInt(editStock) || 0, parseInt(editMin) || 0);
      setEditing(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div style={S.row}>
      <div style={S.rowName}>
        {sub.nombre || subKey}
        {sub.marca && <div style={S.provSub}>{sub.marca}</div>}
      </div>
      {editing ? (
        <>
          <input type="number" inputMode="decimal" min="0" style={S.editInput} value={editStock}
            onChange={e => setEditStock(e.target.value)} autoFocus />
          <input type="number" inputMode="decimal" min="0" style={{ ...S.editInput, width: 55 }} value={editMin}
            onChange={e => setEditMin(e.target.value)} title="Mínimo" />
          <button style={S.saveBtn} onClick={handleSave} disabled={saving}>{saving ? '...' : '✓'}</button>
          <button style={{ ...S.saveBtn, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' }}
            onClick={() => setEditing(false)}>✕</button>
        </>
      ) : (
        <>
          <div style={{ ...S.rowQty(qtyColor), ...(canEdit ? { cursor: 'pointer', textDecoration: 'underline dotted' } : {}) }}
            onClick={() => { if (canEdit) { setEditStock(qty); setEditMin(min); setEditing(true); } }}
            title={canEdit ? 'Click para editar' : ''}>{qty}</div>
          <div style={S.rowUnit}>{sub.unidad || 'pz'}</div>
          <span style={S.badge(badgeType)}>{badgeText}</span>
        </>
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(tapaKey, parseInt(editStock) || 0, parseInt(editMin) || 0);
      setEditing(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div style={S.row}>
      <div style={{ ...S.rowName, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          background: tapa.color || '#ccc', flexShrink: 0,
          border: '1px solid var(--lp-border-subtle)',
        }} />
        {tapa.nombre || tapaKey}
      </div>
      {editing ? (
        <>
          <input type="number" inputMode="decimal" min="0" style={S.editInput} value={editStock}
            onChange={e => setEditStock(e.target.value)} autoFocus />
          <input type="number" inputMode="decimal" min="0" style={{ ...S.editInput, width: 55 }} value={editMin}
            onChange={e => setEditMin(e.target.value)} title="Mínimo" />
          <button style={S.saveBtn} onClick={handleSave} disabled={saving}>{saving ? '...' : '✓'}</button>
          <button style={{ ...S.saveBtn, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' }}
            onClick={() => setEditing(false)}>✕</button>
        </>
      ) : (
        <>
          <div style={{ ...S.rowQty(badgeType === 'err' ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)'),
            ...(canEdit ? { cursor: 'pointer', textDecoration: 'underline dotted' } : {}) }}
            onClick={() => { if (canEdit) { setEditStock(qty); setEditMin(min); setEditing(true); } }}
            title={canEdit ? 'Click para editar' : ''}>{qty}</div>
          <div style={S.rowUnit}>pz</div>
          <span style={S.badge(badgeType)}>
            {qty <= 0 ? 'Agotado' : (min > 0 && qty < min) ? 'Bajo' : 'OK'}
          </span>
        </>
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
function AjusteSheet({ item, isDesktop, canEditMin = false, modoPropuesta = false, onClose, onSave, onEliminar, onSustituir, onPedir }) {
  const [qty, setQty] = useState(String(item.qty ?? 0));
  const [min, setMin] = useState(String(item.min ?? 0));
  const [motivo, setMotivo] = useState('');
  /* Catálogo PT (pedido owner jun 2026): nombre editable + SKU. Solo para PT —
     el rename de MP tiene su propio flujo (/api/mp/renombrar, propaga a todos
     los JSON). Estos campos NO tocan stock: se guardan directo (sin candado ni
     propuesta) vía /api/inventario/pt-meta, con auditoría. */
  const esPT = item.tipo === 'pt';
  const [nombreEdit, setNombreEdit] = useState(item.nombre || '');
  const [skuEdit, setSkuEdit] = useState(item.sku || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 120); return () => clearTimeout(t); }, []);

  const qtyNum = parseFloat(qty);
  const minNum = parseFloat(min);
  const stockChanged = (qty !== '' && !isNaN(qtyNum) && qtyNum !== (item.qty ?? 0))
    || (canEditMin && min !== '' && !isNaN(minNum) && minNum !== (item.min ?? 0));
  const nombreChanged = esPT && nombreEdit.trim() !== '' && nombreEdit.trim() !== (item.nombre || '');
  const skuChanged = esPT && skuEdit.trim() !== String(item.sku || '');
  const metaChanged = nombreChanged || skuChanged;

  const minValido = !canEditMin || (min !== '' && !isNaN(minNum) && minNum >= 0);
  const qtyValida = qty !== '' && !isNaN(qtyNum) && qtyNum >= 0;
  /* El motivo solo es obligatorio cuando se mueve STOCK; un cambio de
     nombre/SKU solo (catálogo) se guarda sin motivo ni candado. */
  const puedeGuardar = stockChanged
    ? (motivo.trim().length >= 3 && qtyValida && minValido)
    : (metaChanged && qtyValida && minValido);

  const handleSave = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    try {
      /* 3er arg = nuevo mínimo (solo si el rol puede editarlo; si no, se conserva el actual).
         4to arg = metadatos de catálogo (solo PT) + flags de qué cambió. */
      await onSave(
        qtyValida ? qtyNum : (item.qty ?? 0),
        motivo.trim(),
        canEditMin ? minNum : (item.min ?? 0),
        {
          stockChanged,
          metaChanged,
          nuevoNombre: nombreChanged ? nombreEdit.trim() : undefined,
          sku: skuChanged ? skuEdit.trim() : undefined,
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
          <div style={S.bigV}>{(item.qty ?? 0).toLocaleString('es-MX')} {item.unidad}</div>
        </div>
        {/* Catálogo PT: nombre + SKU (pedido owner). Aplican directo con
            auditoría — no son stock. El backend bloquea renombrar PTs ligados
            a fórmula (la existencia se partiría) y SKUs duplicados. */}
        {esPT && (
          <>
            <label style={S.flbl}>Nombre del producto</label>
            <input style={S.finTxt} type="text" maxLength={200}
              value={nombreEdit} onChange={e => setNombreEdit(e.target.value)} />
            <label style={{ ...S.flbl, marginTop: 12 }}>SKU</label>
            <input style={S.finTxt} type="text" maxLength={64} placeholder="Ej. PT-BM4-CUB"
              value={skuEdit} onChange={e => setSkuEdit(e.target.value)} />
            {metaChanged && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--lp-text-tertiary)' }}>
                Nombre/SKU se guardan al instante con auditoría (no requieren código).
              </div>
            )}
          </>
        )}
        <label style={{ ...S.flbl, marginTop: esPT ? 12 : 0 }}>Nueva cantidad</label>
        <input ref={inputRef} style={S.finQty} type="number" inputMode="decimal" step="0.1" min="0"
          value={qty} onChange={e => setQty(e.target.value)} />
        {canEditMin && (
          <>
            <label style={{ ...S.flbl, marginTop: 12 }}>Mínimo ({item.unidad})</label>
            <input style={S.finQty} type="number" inputMode="decimal" step="1" min="0"
              value={min} onChange={e => setMin(e.target.value)} />
          </>
        )}
        <label style={{ ...S.flbl, marginTop: 12 }}>Motivo del ajuste{stockChanged ? '' : ' (solo si mueves stock)'}</label>
        <input style={S.finTxt} type="text" maxLength={120} placeholder="Ej. Conteo físico, merma, corrección"
          value={motivo} onChange={e => setMotivo(e.target.value)} />
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
function InvTable({ items, tipo, unidad, canEdit, canDelete, canContar, mpsDisponibles, onAdjust, onAction, onPedir, canPedir, onContar, query }) {
  /* La columna "Acción" solo se muestra si el rol tiene ALGUNA acción posible en
     esta tabla. Antes el header "Acción" se pintaba siempre y dejaba celdas vacías
     para roles sin acciones (p.ej. inventario/Burgos: sin editarInventario) → columna
     fantasma. Ahora: si no hay acción, no se pinta la columna. */
  const showActionCol = canEdit || canContar || (tipo === 'mp' ? canDelete : canPedir);
  return (
    <div style={S.tablewrap}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>{tipo === 'mp' ? 'Material' : 'Producto'}</th>
            <th style={{ ...S.th, textAlign: 'right' }}>Existencia</th>
            <th style={{ ...S.th, textAlign: 'right' }}>Mínimo</th>
            <th style={S.th}>Estado</th>
            {showActionCol && <th style={{ ...S.th, textAlign: 'right' }}>Acción</th>}
          </tr>
        </thead>
        <tbody>
          {items.map(it => {
            const nombre = tipo === 'mp' ? it.mp : it.nombre;
            const qty = it.inv.qty || 0;
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
                </td>
                <td style={{ ...S.td, ...S.tdMono, textAlign: 'right', color: sev.key === 'critico' ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)' }}>
                  {qty.toLocaleString('es-MX', { maximumFractionDigits: 1 })} {unidad}
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
                    <button type="button" style={S.btnGhost} onClick={() => onAdjust(it)}>Ajustar</button>
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
  const fmtFecha = (iso) => { try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  const aprobar = async (id) => {
    setBusyId(id);
    try { await api.aprobarAjuste(id); onResolved(); }
    catch (e) { alert('No se pudo aprobar: ' + (e?.data?.error || e?.message || 'error')); setBusyId(null); }
  };
  const rechazar = async (id) => {
    const m = window.prompt('Motivo del rechazo (opcional):', '');
    if (m === null) return;
    setBusyId(id);
    try { await api.rechazarAjuste(id, m); onResolved(); }
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
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'mp');
  const [mpSubtab, setMpSubtab] = useState(searchParams.get('mp') || 'stock'); /* stock | costos | maestro */
  /* W3 (jun 2026): sub-vista para PT por ubicación. 'total' usa inv.pt agregado;
     'fabrica' y 'teran' usan /api/inventario/pt-por-ubicacion (desde trazabilidad). */
  const [ptSubtab, setPtSubtab] = useState(searchParams.get('pt') || 'total');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('filter') || 'todos');
  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [showRecepcion, setShowRecepcion] = useState(false);
  const [showAgregarPT, setShowAgregarPT] = useState(false);
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
  /* Cola de aprobación de ajustes (propuestas pendientes). */
  const { data: pendData, reload: reloadPendientes } = useApiData(() => api.getAjustesPendientes(), null, 25000);
  const pendientes = pendData?.pendientes || [];

  /* FIX jun 2026 (K1): InventarioPage solo polleaba cada 8s. Cualquier
     movimiento (recepción MP, ajuste por conteo, descuento por producción)
     tardaba hasta 8s en aparecer. Realtime cierra el gap. */
  useRealtimeSync({
    onInventario:   () => { reloadInv(); reloadPtUbi(); reloadPendientes(); },
    onEnvases:      () => reloadEnv(),
    onPrecios:      () => reloadInv(),
    onTrazabilidad: () => reloadPtUbi(), /* W3: sublotes mueven ubicación → refrescar tabla */
  });

  const inventory = invData?.data || {};
  const maestro = maestroData?.data || maestroData || null;

  /* Permissions */
  const canEditMP = can('editarInventario');
  const canEditEnvases = can('editarEnvases') || can('editarInventario');
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
        const pct = inv.min > 0 ? Math.round(((inv.qty || 0) / inv.min) * 100) : 999;
        return { nombre, inv, pct };
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
    let items = filterFn(ptItems, it => it.inv.qty || 0, it => it.pct);
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
    setAjusteItem({ tipo: 'pt', nombre: item.nombre, qty: item.inv.qty || 0, min: item.inv.min || 0, unidad: 'cub', sku: item.inv.sku || '' });
  }, []);
  /* El guardado del sheet pasa por handleSaveMP/PT → ajustarConCandado (candado intacto).
     extras (solo PT): {stockChanged, metaChanged, nuevoNombre?, sku?} — el catálogo
     (nombre/SKU) se aplica PRIMERO y directo vía pt-meta (sin candado: no es stock);
     el ajuste de stock posterior apunta al nombre YA renombrado (también la
     propuesta de Burgos — si no, el admin la aprobaría sobre la clave vieja y
     recrearía el PT con el nombre anterior). */
  const handleAjusteSave = useCallback(async (newQty, motivo, newMin, extras = {}) => {
    if (!ajusteItem) return;
    let nombreEfectivo = ajusteItem.nombre;
    if (ajusteItem.tipo === 'pt' && extras.metaChanged) {
      try {
        const r = await api.ptMeta(ajusteItem.nombre, { sku: extras.sku, nuevoNombre: extras.nuevoNombre });
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
  }, [ajusteItem, esProponente, handleSaveMP, handleSavePT, reloadPendientes, reloadInv]);

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
            {((activeTab === 'mp' && mpSubtab === 'stock') || (activeTab === 'pt' && ptSubtab === 'total')) && (
              <div style={{ marginLeft: 'auto' }}>
                <FilterChips activeFilter={activeFilter} onPick={handleKpiClick} />
              </div>
            )}
          </div>
        </div>

        {/* ════════ TAB: MATERIA PRIMA ════════ */}
        {activeTab === 'mp' && (
          <>
            <div style={S.subRow}>
              <div style={S.pillGroup}>
                {[{ id: 'stock', label: 'Stock' }, { id: 'costos', label: 'Costos' }, { id: 'maestro', label: 'Maestro' }].map(t => (
                  <button key={t.id} type="button" data-id={`inventario.subtab.${t.id}`} data-rol="admin,compras,inventario,almacen,tecnico"
                    style={S.chip(t.id === mpSubtab)} onClick={() => setMpSubtab(t.id)}>{t.label}</button>
                ))}
              </div>
              {mpSubtab === 'stock' && (
                <div style={S.actionsCluster(isDesktop)}>
                  {canRecibirMP && (
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
            {filteredMP.length > 0 && (isDesktop ? (
              <InvTable items={filteredMP} tipo="mp" unidad="kg" canEdit={canEditMP} canDelete={canDeleteMP}
                canContar={canContar} onContar={handleContar}
                mpsDisponibles={mpsDisponibles} onAdjust={handleAdjustMP} onAction={handleMPAction} query={debouncedQuery} />
            ) : (
              <div>
                {filteredMP.map(item => (
                  <MPRow key={item.mp} item={item} canEdit={canEditMP} canContar={canContar} onAdjust={handleAdjustMP} onContar={handleContar} query={debouncedQuery} />
                ))}
              </div>
            ))}
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
                  {canEditMP && (
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
              />
            )}
          </>
        )}

        {/* ════════ TAB: ENVASES ════════ */}
        {activeTab === 'env' && (
          <EnvasesTab
            envases={envData?.data || envData}
            canEdit={canEditEnvases}
            onReload={reloadEnv}
          />
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
          canEditMin={canEditMinimos}
          modoPropuesta={esProponente}
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
function PTUbicacionView({ ubicacion, data, query, onQuery, canPedir, onPedir }) {
  const bucket = data?.[ubicacion] || {};
  const productos = Object.entries(bucket)
    .filter(([nombre]) => {
      if (!query) return true;
      return nombre.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  /* Totales agregados */
  const totales = productos.reduce((acc, [, d]) => {
    acc.cubeta += d.cubeta || 0;
    acc.galon  += d.galon  || 0;
    acc.litro  += d.litro  || 0;
    acc.tote   += d.tote   || 0;
    acc.litros += d.totalLitros || 0;
    return acc;
  }, { cubeta: 0, galon: 0, litro: 0, tote: 0, litros: 0 });

  const esFabrica = ubicacion === 'fabrica';
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
          { label: 'Productos',  v: productos.length },
          { label: 'Cubetas',    v: totales.cubeta },
          { label: 'Galones',    v: totales.galon },
          { label: 'Litros',     v: totales.litro },
          { label: 'TOTEs',      v: totales.tote },
          { label: 'Litros tot', v: Math.round(totales.litros) },
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
            gridTemplateColumns: 'minmax(180px, 2fr) 70px 70px 70px 70px 100px 110px',
            padding: '10px 14px',
            background: 'var(--lp-bg-sunken)',
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            color: 'var(--lp-text-tertiary)', letterSpacing: '.05em',
            borderBottom: '1px solid var(--lp-border-subtle)',
          }}>
            <span>Producto</span>
            <span style={{ textAlign: 'right' }}>Cub</span>
            <span style={{ textAlign: 'right' }}>Gal</span>
            <span style={{ textAlign: 'right' }}>Lt</span>
            <span style={{ textAlign: 'right' }}>TOTE</span>
            <span style={{ textAlign: 'right' }}>Litros</span>
            <span style={{ textAlign: 'right' }}>Acción</span>
          </div>
          {/* Filas */}
          {productos.map(([nombre, d]) => {
            const tieneResidual = (d.residual || 0) > 0;
            const todoResidual = tieneResidual && (d.sublotes || 0) === 0;
            return (
              <div key={nombre} style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 2fr) 70px 70px 70px 70px 100px 110px',
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
                </span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: (d.cubeta || 0) > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>{d.cubeta || 0}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: (d.galon || 0)  > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>{d.galon  || 0}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: (d.litro || 0)  > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>{d.litro  || 0}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: (d.tote || 0)   > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>{d.tote   || 0}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-secondary)' }}>{Math.round(d.totalLitros || 0)}</span>
                <span style={{ textAlign: 'right' }}>
                  {canPedir && (
                    <button
                      onClick={() => onPedir(nombre)}
                      title={esFabrica
                        ? 'Pedir producción para reponer en fábrica'
                        : 'Pedir reposición a fábrica'}
                      style={{
                        padding: '6px 10px', borderRadius: 6,
                        border: `1px solid ${acentColor}`,
                        background: 'transparent',
                        color: acentColor,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'var(--lp-font-sans)',
                      }}
                    >Pedir</button>
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
