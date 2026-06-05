import { useState } from 'react';
import api from '../../../services/api';

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(26, 24, 21, 0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' },
  modal: { background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)', padding: 24, maxWidth: 440, width: '92%' },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--lp-danger-700)', marginBottom: 8 },
  warning: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: '10px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14, lineHeight: 1.5 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--lp-font-sans)', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '10px 12px', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--lp-font-sans)', boxSizing: 'border-box', resize: 'vertical', minHeight: 70 },
  fieldGroup: { marginBottom: 14 },
  buttons: { display: 'flex', gap: 10 },
  btn: { flex: 1, padding: '12px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)' },
  btnDanger: { background: 'var(--lp-danger-600)', color: '#fff' },
  btnGhost: { background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-primary)' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 10 },
  charCount: { fontSize: 11, color: 'var(--lp-text-tertiary)', textAlign: 'right', marginTop: 4 },
};

export default function EliminarOCModal({ oc, onClose, onSaved }) {
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const eliminar = async () => {
    setErr('');
    if (motivo.trim().length < 5) { setErr('Justificación requerida (mínimo 5 caracteres)'); return; }
    if (!pin.trim()) { setErr('PIN de autorización requerido'); return; }
    setSaving(true);
    try {
      await api.eliminarOC(oc.id, motivo.trim(), pin.trim());
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e.message || 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div style={S.modal}>
        <div style={S.title}>Eliminar OC — {oc.codigo}</div>

        <div style={S.warning}>
          Acción irreversible. La OC <strong>{oc.codigo}</strong> de <strong>{oc.proveedor}</strong> ({(oc.items || []).length} items) quedará marcada como eliminada y no aparecerá en MRP. Se conserva el historial para auditoría.
        </div>

        {err && <div style={S.err}>{err}</div>}

        <div style={S.fieldGroup}>
          <label style={S.label}>Motivo (mínimo 5 caracteres)</label>
          <textarea
            style={S.textarea}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Describe por qué se elimina esta OC..."
            maxLength={500}
          />
          <div style={S.charCount}>{motivo.length} / 500</div>
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>PIN de autorización</label>
          <input
            style={S.input}
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Tu PIN"
            autoComplete="off"
          />
        </div>

        <div style={S.buttons}>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...S.btn, ...S.btnDanger }} onClick={eliminar} disabled={saving}>
            {saving ? 'Eliminando...' : 'Confirmar eliminación'}
          </button>
        </div>
      </div>
    </div>
  );
}
