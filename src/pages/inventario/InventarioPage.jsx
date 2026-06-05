import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData, useSearch } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { EliminarMPModal, SustituirMPModal, MPActionsMenu } from './MPActions';
import AgregarPTModal from './AgregarPTModal';
import CostosMPPanel from '../admin/CostosMPPanel';
import MaestroMPInline from './MaestroMPInline';
import HelpHint from '../../components/HelpHint';
import PageTabs from '../../components/ui/PageTabs';
import ImportExportPrint from '../../components/ui/ImportExportPrint';
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
  chip: (on) => ({
    height: 36, padding: '0 14px', borderRadius: 10, cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: 600,
    border: on ? '1px solid color-mix(in srgb, var(--lp-brand-600) 30%, transparent)' : '1px solid var(--lp-border-subtle)',
    background: on ? 'color-mix(in srgb, var(--lp-brand-600) 14%, transparent)' : 'var(--lp-bg-sunken)',
    color: on ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)',
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
  btnAdd: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-success-600)', color: '#fff', whiteSpace: 'nowrap', minHeight: 44,
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
      <mark style={{ background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)', borderRadius: 3, padding: '0 1px' }}>
        {t.slice(idx, idx + query.length)}
      </mark>
      {t.slice(idx + query.length)}
    </>
  );
}

function MPRow({ item, canEdit, canDelete, mpsDisponibles, onSave, onAction, query }) {
  const { mp, inv, pct, maestro } = item;
  const [editing, setEditing] = useState(false);
  const [editQty, setEditQty] = useState(inv.qty || 0);
  const [editMin, setEditMin] = useState(inv.min || 0);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const qty = inv.qty || 0;
  const badgeType = qty <= 0 ? 'err' : pct <= 100 ? 'warn' : 'ok';
  const badgeText = qty <= 0 ? 'Agotado' : pct <= 100 ? 'Bajo' : 'OK';
  const qtyColor = qty <= 0 ? 'var(--lp-danger-600)' : pct <= 100 ? 'var(--lp-warning-600)' : 'var(--lp-success-600)';
  const prov = maestro?.proveedor?.principal;

  /* AD1: motivo obligatorio (≥3 chars) para auditoría del ajuste */
  const puedeGuardar = motivo.trim().length >= 3;

  const handleSave = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    try {
      await onSave(mp, parseFloat(editQty) || 0, parseFloat(editMin) || 0, motivo.trim());
      setEditing(false);
      setMotivo('');
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    /* AD1: panel de "Ajustar existencia" — cantidad, mínimo y MOTIVO obligatorio */
    return (
      <div style={{ ...S.row, flexDirection: 'column', alignItems: 'stretch', gap: 8, background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)', padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)' }}>Ajustar existencia · {mp}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 11, color: 'var(--lp-text-secondary)' }}>Cantidad
            <input type="number" step="0.1" min="0" style={{ ...S.editInput, marginLeft: 6 }} value={editQty} onChange={e => setEditQty(e.target.value)} autoFocus />
          </label>
          <label style={{ fontSize: 11, color: 'var(--lp-text-secondary)' }}>Mínimo
            <input type="number" step="0.1" min="0" style={{ ...S.editInput, width: 60, marginLeft: 6 }} value={editMin} onChange={e => setEditMin(e.target.value)} />
          </label>
        </div>
        <input
          type="text"
          style={{ ...S.editInput, width: '100%', boxSizing: 'border-box' }}
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Motivo del ajuste (obligatorio) — ej: merma, conteo físico, corrección"
          maxLength={120}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={{ ...S.saveBtn, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', border: '1px solid var(--lp-border-subtle)' }} onClick={() => { setEditing(false); setMotivo(''); }}>Cancelar</button>
          <button style={{ ...S.saveBtn, opacity: puedeGuardar && !saving ? 1 : 0.5 }} onClick={handleSave} disabled={!puedeGuardar || saving}>
            {saving ? 'Guardando…' : 'Guardar ajuste'}
          </button>
        </div>
      </div>
    );
  }

  /* Severidad mockup: Crítico (agotado) · Bajo · OK */
  const sevColor = badgeType === 'err' ? 'var(--lp-danger-600)' : badgeType === 'warn' ? 'var(--lp-warning-600)' : 'var(--lp-success-600)';
  const sevLabel = badgeType === 'err' ? 'Crítico' : badgeType === 'warn' ? 'Bajo' : 'OK';
  const barPct = Math.max(4, Math.min(100, (inv.min || 0) > 0 ? (qty / inv.min * 100) : 100));
  const openEdit = () => { setEditQty(qty); setEditMin(inv.min || 0); setMotivo(''); setEditing(true); };

  return (
    <div style={S.cardRow} data-id="inventario.row.item" data-rol="admin,tecnico,compras,almacen,inventario">
      <div style={S.cardTop}>
        <span style={S.cardName}>
          {resaltar(mp, query)}
          {prov && <span style={{ ...S.provSub, marginLeft: 6 }}>· {prov}</span>}
        </span>
        <span style={S.estBadge(sevColor)}>{sevLabel}</span>
        {canEdit && (
          <button type="button" style={S.pencilBtn} onClick={openEdit} aria-label="Ajustar existencia" title="Ajustar existencia">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </button>
        )}
        {canDelete && (
          <MPActionsMenu mp={mp} mpsDisponibles={mpsDisponibles} canEdit={canDelete} onAction={onAction} />
        )}
      </div>
      <div style={S.sevBar}><div style={S.sevFill(barPct, sevColor)} /></div>
      <div style={S.cardNums}>
        <span
          style={{ ...S.numEx(badgeType === 'err' ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)'), ...(canEdit ? { cursor: 'pointer' } : {}) }}
          onClick={() => { if (canEdit) openEdit(); }}
          title={canEdit ? 'Ajustar existencia' : ''}
        >{qty.toLocaleString('es-MX', { maximumFractionDigits: 1 })} kg</span>
        <span style={S.numMin}>mín {(inv.min || 0).toLocaleString('es-MX')} kg</span>
      </div>
    </div>
  );
}

/* ── PT Row component (with optional editing + CTA "Pedir reposición") ── */
function PTRow({ item, canEdit, canPedir, onSave, onPedir, query }) {
  const { nombre, inv, pct } = item;
  const [editing, setEditing] = useState(false);
  const [editQty, setEditQty] = useState(inv.qty || 0);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const qty = inv.qty || 0;
  const badgeType = qty <= 0 ? 'err' : pct <= 100 ? 'warn' : 'ok';
  const badgeText = qty <= 0 ? 'Agotado' : pct <= 100 ? 'Bajo' : 'OK';
  const qtyColor = qty <= 0 ? 'var(--lp-danger-600)' : pct <= 100 ? 'var(--lp-warning-600)' : 'var(--lp-success-600)';
  /* Mostrar CTA solo si stock bajo o agotado y el usuario puede crear pedidos */
  const mostrarCTAPedir = canPedir && (qty <= 0 || pct <= 100);
  const puedeGuardar = motivo.trim().length >= 3;

  const handleSave = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    try {
      /* parseFloat para decimales (PT puede ser 0.5 cubetas en pruebas).
         AD1: pasa el motivo capturado para auditoría. Si el handler lanza
         error (rol no permitido, validación server), NO cerramos el editor. */
      await onSave(nombre, parseFloat(editQty) || 0, motivo.trim());
      setEditing(false);
      setMotivo('');
    } catch (e) {
      /* Mantener editor abierto para reintentar. El alert ya lo mostró el handler. */
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div style={{ ...S.row, flexDirection: 'column', alignItems: 'stretch', gap: 8, background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)', padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)' }}>Ajustar existencia · {nombre}</div>
        <label style={{ fontSize: 11, color: 'var(--lp-text-secondary)' }}>Cantidad (cubetas)
          <input type="number" inputMode="decimal" min="0" step="0.1" style={{ ...S.editInput, marginLeft: 6 }} value={editQty} onChange={e => setEditQty(e.target.value)} autoFocus />
        </label>
        <input type="text" style={{ ...S.editInput, width: '100%', boxSizing: 'border-box' }} value={motivo} onChange={e => setMotivo(e.target.value)}
          placeholder="Motivo del ajuste (obligatorio) — ej: merma, conteo físico, corrección" maxLength={120} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={{ ...S.saveBtn, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', border: '1px solid var(--lp-border-subtle)' }} onClick={() => { setEditing(false); setMotivo(''); }}>Cancelar</button>
          <button style={{ ...S.saveBtn, opacity: puedeGuardar && !saving ? 1 : 0.5 }} onClick={handleSave} disabled={!puedeGuardar || saving}>{saving ? 'Guardando…' : 'Guardar ajuste'}</button>
        </div>
      </div>
    );
  }

  const sevColor = badgeType === 'err' ? 'var(--lp-danger-600)' : badgeType === 'warn' ? 'var(--lp-warning-600)' : 'var(--lp-success-600)';
  const sevLabel = badgeType === 'err' ? 'Crítico' : badgeType === 'warn' ? 'Bajo' : 'OK';
  const barPct = Math.max(4, Math.min(100, (inv.min || 0) > 0 ? (qty / inv.min * 100) : 100));
  const openEdit = () => { setEditQty(qty); setMotivo(''); setEditing(true); };

  return (
    <div style={S.cardRow} data-id="inventario.row.item" data-rol="admin,tecnico,compras,almacen,inventario">
      <div style={S.cardTop}>
        <span style={S.cardName}>{resaltar(nombre, query)}</span>
        <span style={S.estBadge(sevColor)}>{sevLabel}</span>
        {canEdit && (
          <button type="button" style={S.pencilBtn} onClick={openEdit} aria-label="Ajustar existencia" title="Ajustar existencia">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </button>
        )}
      </div>
      <div style={S.sevBar}><div style={S.sevFill(barPct, sevColor)} /></div>
      <div style={S.cardNums}>
        <span
          style={{ ...S.numEx(badgeType === 'err' ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)'), ...(canEdit ? { cursor: 'pointer' } : {}) }}
          onClick={() => { if (canEdit) openEdit(); }}
          title={canEdit ? 'Ajustar existencia' : ''}
        >{qty.toLocaleString('es-MX', { maximumFractionDigits: 1 })} cub</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={S.numMin}>mín {(inv.min || 0).toLocaleString('es-MX')} cub</span>
          {mostrarCTAPedir && (
            <button
              type="button"
              data-id="inventario.btn.pedir-pt" data-rol="admin,almacen,tecnico"
              onClick={() => onPedir(nombre)}
              title={`Levantar pedido de reposición de ${nombre}`}
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                border: 'none', cursor: 'pointer', background: 'var(--lp-brand-600)',
                color: '#fff', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap', minHeight: 32,
              }}
            >+ Pedir</button>
          )}
        </span>
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

/* ================================================================ */
/* MAIN COMPONENT                                                    */
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

  /* Fetch data */
  const { data: invData, loading: invLoading, reload: reloadInv } = useApiData(() => api.getInventario(), [], 8000);
  const { data: maestroData } = useApiData(() => api.getMaestroMP(), [], 15000);
  const { data: envData, reload: reloadEnv } = useApiData(() => api.getEnvases(), [], 15000);
  /* W3: stock PT desglosado por ubicación física (desde trazabilidad) */
  const { data: ptUbiData, reload: reloadPtUbi } = useApiData(() => api.getPTPorUbicacion(), [], 15000);

  /* FIX jun 2026 (K1): InventarioPage solo polleaba cada 8s. Cualquier
     movimiento (recepción MP, ajuste por conteo, descuento por producción)
     tardaba hasta 8s en aparecer. Realtime cierra el gap. */
  useRealtimeSync({
    onInventario:   () => { reloadInv(); reloadPtUbi(); },
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
      items = items.filter(it => it.nombre.toLowerCase().includes(q));
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
  const handleSavePT = useCallback(async (nombre, newQty, motivo) => {
    const minActual = inventory?.pt?.[nombre]?.min;
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
        {/* Sub-nav tabs */}
        <PageTabs
          tabs={tabs.map(t => ({ ...t, style: (active) => S.tab(active) }))}
          activeTab={activeTab}
          onChange={handleTabChange}
          style={S.tabs}
        />

        {/* ════════ TAB: MATERIA PRIMA — sub-tabs (Stock / Costos / Maestro) ════════ */}
        {activeTab === 'mp' && (
          <>
            <div style={{ display: 'flex', gap: 6, margin: '2px 0 14px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {[
                { id: 'stock', label: 'Stock' },
                { id: 'costos', label: 'Costos' },
                { id: 'maestro', label: 'Maestro' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  data-id={`inventario.subtab.${t.id}`}
                  data-rol="admin,compras,inventario,almacen,tecnico"
                  style={S.chip(t.id === mpSubtab)}
                  onClick={() => setMpSubtab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {mpSubtab === 'costos' && (
              <>
                <HelpHint id="inv-mp-costos" title="Editar costos de materias primas">
                  Filtra por <strong>Sin costo</strong> para ver las MPs que faltan precio. Teclea precio base + flete y presiona Enter para guardar. El costo se aplica al instante a cada fórmula que la use.
                </HelpHint>
                <CostosMPPanel />
              </>
            )}
            {mpSubtab === 'maestro' && <MaestroMPInline />}
            {mpSubtab === 'stock' && (
              <>
                <HelpHint id="inv-mp-stock" title="Inventario de materias primas">
                  KPIs clickeables filtran la lista. Botón <strong>+ Recepción</strong> registra entrada de MP de proveedor. Click en cualquier MP para editar stock o eliminar/sustituir.
                </HelpHint>
            {/* Clickable KPIs */}
            <div style={S.kpiGrid}>
              <div style={S.kpi('var(--lp-brand-600)', activeFilter === 'todos', true)}
                onClick={() => handleKpiClick('todos')}>
                <div style={S.kpiLabel}>Total MPs</div>
                <div style={S.kpiValue}>{mpKpi.total}</div>
                {activeFilter === 'todos' && <div style={S.kpiHint}>Mostrando todas</div>}
              </div>
              <div style={S.kpi('var(--lp-success-600)', activeFilter === 'ok', true)}
                onClick={() => handleKpiClick('ok')}>
                <div style={S.kpiLabel}>Stock OK</div>
                <div style={S.kpiValue}>{mpKpi.ok}</div>
                {activeFilter === 'ok' && <div style={S.kpiHint}>Filtro activo</div>}
              </div>
              <div style={S.kpi('var(--lp-warning-600)', activeFilter === 'bajo', true)}
                onClick={() => handleKpiClick('bajo')}>
                <div style={S.kpiLabel}>Stock Bajo</div>
                <div style={S.kpiValue}>{mpKpi.bajo}</div>
                {activeFilter === 'bajo' && <div style={S.kpiHint}>Filtro activo</div>}
              </div>
              <div style={S.kpi('var(--lp-danger-600)', activeFilter === 'sin', true)}
                onClick={() => handleKpiClick('sin')}>
                <div style={S.kpiLabel}>Sin Stock</div>
                <div style={S.kpiValue}>{mpKpi.sin}</div>
                {activeFilter === 'sin' && <div style={S.kpiHint}>Filtro activo</div>}
              </div>
            </div>

            {/* Active filter indicator */}
            {activeFilter !== 'todos' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                padding: '8px 14px', background: 'var(--lp-brand-50)', borderRadius: 8,
                fontSize: 12, color: 'var(--lp-brand-700)', fontWeight: 600,
              }}>
                Filtrando: {activeFilter === 'ok' ? 'Stock OK' : activeFilter === 'bajo' ? 'Stock Bajo' : 'Sin Stock'}
                ({filteredMP.length} de {mpItems.length})
                <button
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--lp-brand-600)', fontWeight: 600, fontSize: 12, fontFamily: 'var(--lp-font-sans)' }}
                  onClick={() => handleKpiClick('todos')}
                >✕ Limpiar</button>
              </div>
            )}

            <div style={S.toolbar}>
              <input type="text" style={S.search} placeholder="Buscar materia prima..."
                value={query} onChange={e => setQuery(e.target.value)} />
              {canRecibirMP && (
                <button
                  style={S.btnAdd}
                  data-id="inventario.btn.recepcion-mp" data-rol="almacen,compras,admin"
                  onClick={() => setShowRecepcion(true)}
                >+ Recepción MP</button>
              )}
              <ImportExportPrint
                exportUrl={() => api.urlExportInv('mp', activeFilter)}
                printUrl={() => api.urlPrintInv('mp', activeFilter)}
                importEndpoint={canEditMP ? (api.urlImportInv && api.urlImportInv()) : null}
                onImported={() => reloadInv()}
                permisos={{ import: canEditMP }}
              />
            </div>

            {/* Agrupado por categoría — etiqueta + cards (estilo mockup) */}
            {Object.keys(MP_CATEGORIES).map(catName => {
              const items = mpGrouped.groups[catName];
              if (!items?.length) return null;
              const cfg = MP_CATEGORIES[catName];
              return (
                <div key={catName}>
                  <div style={S.catLabel}>
                    <span style={S.catTag(cfg.bg, cfg.fg)}>{cfg.icon}</span>
                    {catName} · {items.length}
                  </div>
                  {items.map(item => (
                    <MPRow
                      key={item.mp}
                      item={item}
                      canEdit={canEditMP}
                      canDelete={canDeleteMP}
                      mpsDisponibles={mpsDisponibles}
                      onSave={handleSaveMP}
                      onAction={handleMPAction}
                      query={debouncedQuery}
                    />
                  ))}
                </div>
              );
            })}

            {mpGrouped.uncategorized.length > 0 && (
              <div>
                <div style={S.catLabel}>
                  <span style={S.catTag('var(--lp-bg-sunken)', 'var(--lp-text-secondary)')}>··</span>
                  Otros · {mpGrouped.uncategorized.length}
                </div>
                {mpGrouped.uncategorized.map(item => (
                  <MPRow key={item.mp} item={item} canEdit={canEditMP} canDelete={canDeleteMP}
                    mpsDisponibles={mpsDisponibles} onSave={handleSaveMP} onAction={handleMPAction} query={debouncedQuery} />
                ))}
              </div>
            )}

            {filteredMP.length === 0 && (
              <div style={S.empty}>
                {debouncedQuery ? `Sin resultados para "${debouncedQuery}"` :
                  activeFilter !== 'todos' ? 'Sin materias primas en esta categoría' :
                  'Sin materias primas registradas'}
              </div>
            )}
              </>
            )}
          </>
        )}

        {/* ════════ TAB: PRODUCTO TERMINADO ════════ */}
        {activeTab === 'pt' && (
          <>
            {/* W3 (jun 2026) — Pills de sub-vista por ubicación física.
                Total: usa el agregado de inv.pt (igual que antes).
                Fábrica: solo sublotes con ub=fabrica (lo que Enrique tiene aquí).
                Terán:   solo sublotes con ub=teran (lo que Josué tiene allá). */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {[
                { id: 'total',   label: 'Total combinado', hint: 'Suma fábrica + Terán' },
                { id: 'fabrica', label: 'Stock Fábrica',    hint: 'Lo que tiene Enrique aquí' },
                { id: 'teran',   label: 'Stock Terán',      hint: 'Lo que tiene Josué allá' },
              ].map(p => (
                <button
                  key={p.id}
                  data-id={`inventario.ptview.${p.id}`} data-rol="admin,almacen,inventario"
                  onClick={() => setPtSubtab(p.id)}
                  title={p.hint}
                  style={{
                    padding: '8px 14px', minHeight: 36, borderRadius: 999,
                    border: ptSubtab === p.id ? '1.5px solid var(--lp-brand-600)' : '1.5px solid var(--lp-border-subtle)',
                    background: ptSubtab === p.id ? 'var(--lp-brand-50)' : 'var(--lp-bg-raised)',
                    color: ptSubtab === p.id ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)',
                    fontWeight: ptSubtab === p.id ? 700 : 500,
                    fontSize: 13, cursor: 'pointer',
                    fontFamily: 'var(--lp-font-sans)',
                  }}
                >{p.label}</button>
              ))}
            </div>

            {/* Vista TOTAL — mantiene comportamiento original con inv.pt */}
            {ptSubtab === 'total' && (<>
              <div style={S.kpiGrid}>
                <div style={S.kpi('var(--lp-brand-600)', activeFilter === 'todos', true)}
                  onClick={() => handleKpiClick('todos')}>
                  <div style={S.kpiLabel}>Total PT</div>
                  <div style={S.kpiValue}>{ptKpi.total}</div>
                  {activeFilter === 'todos' && <div style={S.kpiHint}>Mostrando todos</div>}
                </div>
                <div style={S.kpi('var(--lp-success-600)', activeFilter === 'ok', true)}
                  onClick={() => handleKpiClick('ok')}>
                  <div style={S.kpiLabel}>Stock OK</div>
                  <div style={S.kpiValue}>{ptKpi.ok}</div>
                  {activeFilter === 'ok' && <div style={S.kpiHint}>Filtro activo</div>}
                </div>
                <div style={S.kpi('var(--lp-warning-600)', activeFilter === 'bajo', true)}
                  onClick={() => handleKpiClick('bajo')}>
                  <div style={S.kpiLabel}>Stock Bajo</div>
                  <div style={S.kpiValue}>{ptKpi.bajo}</div>
                  {activeFilter === 'bajo' && <div style={S.kpiHint}>Filtro activo</div>}
                </div>
                <div style={S.kpi('var(--lp-danger-600)', activeFilter === 'sin', true)}
                  onClick={() => handleKpiClick('sin')}>
                  <div style={S.kpiLabel}>Sin Stock</div>
                  <div style={S.kpiValue}>{ptKpi.sin}</div>
                  {activeFilter === 'sin' && <div style={S.kpiHint}>Filtro activo</div>}
                </div>
              </div>

              {activeFilter !== 'todos' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                  padding: '8px 14px', background: 'var(--lp-brand-50)', borderRadius: 8,
                  fontSize: 12, color: 'var(--lp-brand-700)', fontWeight: 600,
                }}>
                  Filtrando: {activeFilter === 'ok' ? 'Stock OK' : activeFilter === 'bajo' ? 'Stock Bajo' : 'Sin Stock'}
                  ({filteredPT.length} de {ptItems.length})
                  <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--lp-brand-600)', fontWeight: 600, fontSize: 12, fontFamily: 'var(--lp-font-sans)' }}
                    onClick={() => handleKpiClick('todos')}>✕ Limpiar</button>
                </div>
              )}

              <div style={S.toolbar}>
                <input type="text" style={S.search} placeholder="Buscar producto terminado..."
                  value={query} onChange={e => setQuery(e.target.value)} />
                {canEditMP && (
                  <button
                    style={S.btnAdd}
                    onClick={() => setShowAgregarPT(true)}
                    title="Agregar inventario inicial de producto terminado (individual o masivo)"
                  >+ Agregar PT</button>
                )}
                <ImportExportPrint
                  exportUrl={() => api.urlExportInv('pt', activeFilter)}
                  printUrl={() => api.urlPrintInv('pt', activeFilter)}
                  permisos={{ import: false }}
                />
              </div>

              <div style={S.catLabel}>Producto terminado (agregado) · {filteredPT.length}</div>
              {filteredPT.map(item => (
                <PTRow
                  key={item.nombre}
                  item={item}
                  canEdit={canEditMP}
                  canPedir={canPedirPT}
                  onSave={handleSavePT}
                  onPedir={handlePedirPT}
                  query={debouncedQuery}
                />
              ))}

              {filteredPT.length === 0 && (
                <div style={S.empty}>
                  {debouncedQuery ? `Sin resultados para "${debouncedQuery}"` :
                    activeFilter !== 'todos' ? 'Sin productos en esta categoría' :
                    'Sin productos terminados'}
                </div>
              )}
            </>)}

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
