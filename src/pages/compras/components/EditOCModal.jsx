import { useState, useMemo } from 'react';
import api from '../../../services/api';

const PRESENTACIONES = [
  { v: 'cubeta_20', lbl: 'CUBETA / 20 kg' },
  { v: 'cubeta_50', lbl: 'CUBETA / 50 kg' },
  { v: 'saco_25', lbl: 'SACO / 25 kg' },
  { v: 'saco_50', lbl: 'SACO / 50 kg' },
  { v: 'tambor_200', lbl: 'TAMBOR / 200 kg' },
  { v: 'tambor_220', lbl: 'TAMBOR / 220 kg' },
  { v: 'tote_1000', lbl: 'TOTE / 1,000 kg' },
  { v: 'otro', lbl: 'Otro (especificar)' },
];

const PRIORIDADES = [
  { v: 'urgente', lbl: 'Urgente (10-15 días)' },
  { v: 'media', lbl: 'Media (15-20 días)' },
  { v: 'baja', lbl: 'Baja (20-30 días)' },
];

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(26, 24, 21, 0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' },
  modal: { background: '#fff', borderRadius: 'var(--lp-radius)', padding: 24, maxWidth: 640, width: '92%', maxHeight: '92vh', overflowY: 'auto' },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--lp-brand-600)', marginBottom: 16 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--lp-font-sans)', boxSizing: 'border-box' },
  select: { width: '100%', padding: '10px 12px', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, fontSize: 13, background: '#fff', boxSizing: 'border-box' },
  fieldGroup: { marginBottom: 12 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  itemBox: { background: 'var(--lp-bg-sunken)', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 12 },
  itemHeader: { display: 'grid', gridTemplateColumns: '2fr 80px 90px 80px 30px', gap: 8, alignItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', marginBottom: 6 },
  itemRow: { display: 'grid', gridTemplateColumns: '2fr 80px 90px 80px 30px', gap: 8, alignItems: 'center', marginBottom: 6 },
  small: { padding: '6px 8px', fontSize: 11, border: '1px solid var(--lp-border-subtle)', borderRadius: 6, fontFamily: 'var(--lp-font-sans)', boxSizing: 'border-box', width: '100%' },
  delBtn: { background: 'transparent', border: 'none', color: 'var(--lp-danger-600)', cursor: 'pointer', fontSize: 16, padding: 0 },
  addBtn: { width: '100%', padding: '8px', fontSize: 12, fontWeight: 600, border: '1.5px dashed var(--lp-border-subtle)', borderRadius: 8, background: 'transparent', color: 'var(--lp-text-secondary)', cursor: 'pointer', marginTop: 6 },
  buttons: { display: 'flex', gap: 10, marginTop: 14 },
  btn: { flex: 1, padding: '12px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)' },
  btnPrimary: { background: 'var(--lp-brand-600)', color: '#fff' },
  btnGhost: { background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-primary)' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 10 },
};

export default function EditOCModal({ oc, onClose, onSaved }) {
  const [items, setItems] = useState(() =>
    (oc.items || []).map(i => ({
      mp: i.mp || '',
      kg: Number(i.kg) || 0,
      presentacion: i.presentacion || 'saco_25',
      presentacionOtro: i.presentacionOtro || '',
      kg_recibidos: i.kg_recibidos != null ? Number(i.kg_recibidos) : null,
    }))
  );
  const [prioridad, setPrioridad] = useState(oc.prioridad || 'media');
  const [fechaEntrega, setFechaEntrega] = useState(oc.fechaEntregaEstimada || '');
  const [almacen, setAlmacen] = useState(oc.almacenDestino || '');
  const [transportista, setTransportista] = useState(oc.transportista || '');
  const [fleteOverride, setFleteOverride] = useState(
    oc.fleteEstimadoMxn != null ? String(oc.fleteEstimadoMxn) : ''
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const totalKg = useMemo(() => items.reduce((s, i) => s + (Number(i.kg) || 0), 0), [items]);
  const fleteAuto = useMemo(() => Math.round(totalKg * 5 * 100) / 100, [totalKg]);

  const updateItem = (idx, field, value) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const addItem = () => setItems([...items, { mp: '', kg: 0, presentacion: 'saco_25', presentacionOtro: '', kg_recibidos: null }]);
  const usarAuto = () => setFleteOverride(String(fleteAuto));

  const guardar = async () => {
    setErr('');
    const itemsValidos = items.filter(i => i.mp.trim() && Number(i.kg) > 0);
    if (itemsValidos.length === 0) { setErr('Agrega al menos 1 item con MP y kg.'); return; }
    setSaving(true);
    try {
      const payload = {
        id: oc.id,
        items: itemsValidos,
        prioridad,
        fechaEntregaEstimada: fechaEntrega || null,
        almacenDestino: almacen || null,
        transportista: transportista || null,
      };
      if (fleteOverride !== '' && !isNaN(Number(fleteOverride))) {
        payload.fleteEstimadoMxn = Number(fleteOverride);
      }
      await api.editOC(payload);
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div style={S.modal}>
        <div style={S.title}>Editar OC — {oc.codigo}</div>

        {err && <div style={S.err}>{err}</div>}

        <div style={S.fieldGroup}>
          <label style={S.label}>Items ({items.length})</label>
          <div style={S.itemHeader}>
            <span>Materia Prima</span>
            <span style={{ textAlign: 'right' }}>Kg</span>
            <span>Presentación</span>
            <span>Otro</span>
            <span></span>
          </div>
          {items.map((it, idx) => (
            <div key={idx} style={S.itemRow}>
              <input style={S.small} value={it.mp} onChange={(e) => updateItem(idx, 'mp', e.target.value)} placeholder="MP" />
              <input style={{ ...S.small, textAlign: 'right' }} type="number" inputMode="decimal" min="0" step="0.1" value={it.kg} onChange={(e) => updateItem(idx, 'kg', e.target.value)} />
              <select style={S.small} value={it.presentacion} onChange={(e) => updateItem(idx, 'presentacion', e.target.value)}>
                {PRESENTACIONES.map(p => <option key={p.v} value={p.v}>{p.lbl}</option>)}
              </select>
              <input style={S.small} value={it.presentacionOtro || ''} onChange={(e) => updateItem(idx, 'presentacionOtro', e.target.value)} placeholder="..." disabled={it.presentacion !== 'otro'} />
              <button style={S.delBtn} onClick={() => removeItem(idx)} title="Eliminar item" aria-label="Eliminar item">×</button>
            </div>
          ))}
          <button style={S.addBtn} onClick={addItem}>+ agregar item</button>
        </div>

        <div style={S.grid2}>
          <div>
            <label style={S.label}>Prioridad</label>
            <select style={S.select} value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              {PRIORIDADES.map(p => <option key={p.v} value={p.v}>{p.lbl}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Fecha entrega estimada</label>
            <input style={S.input} type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
          </div>
        </div>

        <div style={S.grid2}>
          <div>
            <label style={S.label}>Almacén destino</label>
            <input style={S.input} value={almacen} onChange={(e) => setAlmacen(e.target.value)} placeholder="Fábrica / Terán..." />
          </div>
          <div>
            <label style={S.label}>Transportista</label>
            <input style={S.input} value={transportista} onChange={(e) => setTransportista(e.target.value)} placeholder="Empresa / nombre..." />
          </div>
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Flete estimado (MXN)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input style={{ ...S.input, flex: 1 }} type="number" inputMode="decimal" min="0" step="0.01" value={fleteOverride} onChange={(e) => setFleteOverride(e.target.value)} placeholder={String(fleteAuto)} />
            <button onClick={usarAuto} style={{ padding: '10px 14px', fontSize: 12, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, background: 'transparent', cursor: 'pointer' }}>Auto</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4 }}>
            Auto: ${fleteAuto.toLocaleString('es-MX')} ({totalKg} kg × $5 MXN/kg)
            {fleteOverride !== '' && Number(fleteOverride) !== fleteAuto && ' · override manual activo'}
          </div>
        </div>

        <div style={S.buttons}>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
