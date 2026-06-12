/* ════════════════════════════════════════════════════════════════════════════
   CausasManager — CRUD del catálogo de causas raíz (solo admin)
   Las causas inactivas se ocultan del selector al aprobar pero se preservan
   en histórico (soft delete con eliminado:true).
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const TIPOS = [
  { v: 'operativa', label: 'Operativa', color: '#0F6E56' },
  { v: 'humana',    label: 'Humana',    color: '#D97706' },
  { v: 'seguridad', label: 'Seguridad', color: 'var(--lp-danger-600)' },
  { v: 'datos',     label: 'Datos',     color: 'var(--lp-qc-600)' },
  { v: 'otro',      label: 'Otro',      color: 'var(--lp-text-tertiary)' },
];

const S = {
  section: { background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 10px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--lp-border-subtle)' },
  btnPrimary: { padding: '8px 14px', fontSize: 12, fontWeight: 700, borderRadius: 'var(--lp-radius-sm)', border: 'none', background: 'var(--lp-brand-600)', color: '#fff', cursor: 'pointer' },
  btnGhost: { padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 'var(--lp-radius-sm)', border: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', cursor: 'pointer', color: 'var(--lp-text-primary)' },
  btnDanger: { padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 'var(--lp-radius-sm)', border: 'none', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', cursor: 'pointer' },
  badge: (bg, fg) => ({ display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '.04em' }),
  modal: { position: 'fixed', inset: 0, background: 'rgba(26,24,21,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalBox: { background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)', padding: 20, maxWidth: 520, width: '100%', border: '1.5px solid var(--lp-border-subtle)' },
  input: { width: '100%', padding: '10px 14px', borderRadius: 'var(--lp-radius-sm)', border: '1.5px solid var(--lp-border-subtle)', fontSize: 13, fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', boxSizing: 'border-box', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-secondary)', marginBottom: 4, display: 'block' },
};

function EditModal({ causa, onSave, onClose, loading }) {
  const editar = !!causa?.id;
  const [nombre, setNombre] = useState(causa?.nombre || '');
  const [descripcion, setDescripcion] = useState(causa?.descripcion || '');
  const [tipo, setTipo] = useState(causa?.tipo || 'operativa');
  const [err, setErr] = useState('');

  const guardar = async () => {
    if (!nombre.trim()) { setErr('Nombre requerido'); return; }
    setErr('');
    try { await onSave({ nombre: nombre.trim(), descripcion: descripcion.trim(), tipo }); }
    catch (e) { setErr(e?.data?.error || e.message); }
  };

  return (
    <div style={S.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modalBox}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
          {editar ? 'Editar causa' : 'Nueva causa raíz'}
        </div>
        <div>
          <label style={S.label}>Nombre</label>
          <input style={S.input} value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Derrame en mezclado" autoFocus />
        </div>
        <div>
          <label style={S.label}>Tipo</label>
          <select style={S.input} value={tipo} onChange={e => setTipo(e.target.value)}>
            {TIPOS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Descripción (opcional)</label>
          <textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' }}
            value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="Describe cuándo aplica esta causa..." />
        </div>
        {err && <div style={{ background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.btnGhost} onClick={onClose} disabled={loading}>Cancelar</button>
          <button style={S.btnPrimary} onClick={guardar} disabled={loading}>
            {loading ? 'Guardando…' : (editar ? 'Guardar cambios' : 'Crear causa')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CausasManager() {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const [causas, setCausas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null); /* null | {id?:...} */
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true); setErr('');
    api.getCausasVarianza()
      .then(r => setCausas(r.data?.causas || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const handleGuardar = async (datos) => {
    setBusy(true);
    try {
      if (editing?.id) {
        await api.postCausaVarianza({ accion: 'editar', causaId: editing.id, causa: datos });
      } else {
        await api.postCausaVarianza({ accion: 'crear', causa: datos });
      }
      setEditing(null);
      cargar();
    } finally { setBusy(false); }
  };

  const handleToggle = async (c) => {
    try {
      await api.postCausaVarianza({ accion: c.activo ? 'desactivar' : 'activar', causaId: c.id });
      cargar();
    } catch (e) { alert(e?.data?.error || e.message); }
  };

  const handleEliminar = async (c) => {
    if (!confirm(`¿Eliminar la causa "${c.nombre}"? Las varianzas históricas con esta causa se preservan; solo se oculta del selector futuro.`)) return;
    try {
      await api.postCausaVarianza({ accion: 'eliminar', causaId: c.id });
      cargar();
    } catch (e) { alert(e?.data?.error || e.message); }
  };

  const activas = causas.filter(c => c.activo && !c.eliminado);
  const inactivas = causas.filter(c => !c.activo || c.eliminado);
  const tipoCol = (tipo) => TIPOS.find(t => t.v === tipo)?.color || 'var(--lp-text-tertiary)';

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--lp-text-tertiary)' }}>Cargando catálogo…</div>;
  if (err) return <div style={{ background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 6, fontSize: 12 }}>{err}</div>;

  return (
    <>
      <div style={{ ...S.section }}>
        <div style={S.sectionTitle}>
          <span>Causas raíz activas ({activas.length})</span>
          {esAdmin && (
            <button style={S.btnPrimary} onClick={() => setEditing({})}>+ Nueva causa</button>
          )}
        </div>
        <div className="table-scroll"><table style={S.table}>
          <thead><tr>
            <th style={S.th}>Nombre</th>
            <th style={S.th}>Tipo</th>
            <th style={S.th}>Descripción</th>
            <th style={S.th}>ID</th>
            {esAdmin && <th style={S.th}>Acciones</th>}
          </tr></thead>
          <tbody>
            {activas.map(c => (
              <tr key={c.id}>
                <td style={S.td}><strong>{c.nombre}</strong></td>
                <td style={S.td}>
                  <span style={S.badge('var(--lp-bg-sunken)', tipoCol(c.tipo))}>{c.tipo}</span>
                </td>
                <td style={{ ...S.td, color: 'var(--lp-text-tertiary)', fontSize: 11 }}>{c.descripcion || '—'}</td>
                <td style={{ ...S.td, fontFamily: 'var(--lp-font-mono)', fontSize: 11, color: 'var(--lp-text-tertiary)' }}>{c.id}</td>
                {esAdmin && (
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={S.btnGhost} onClick={() => setEditing(c)}>Editar</button>
                      <button style={S.btnGhost} onClick={() => handleToggle(c)}>Desactivar</button>
                      <button style={S.btnDanger} onClick={() => handleEliminar(c)}>Eliminar</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {inactivas.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>
            <span>Causas inactivas ({inactivas.length})</span>
          </div>
          <div className="table-scroll"><table style={S.table}>
            <thead><tr>
              <th style={S.th}>Nombre</th>
              <th style={S.th}>Tipo</th>
              <th style={S.th}>Estado</th>
              {esAdmin && <th style={S.th}>Acciones</th>}
            </tr></thead>
            <tbody>
              {inactivas.map(c => (
                <tr key={c.id} style={{ opacity: 0.6 }}>
                  <td style={S.td}>{c.nombre}</td>
                  <td style={S.td}>{c.tipo}</td>
                  <td style={S.td}>
                    {c.eliminado
                      ? <span style={S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)')}>eliminada</span>
                      : <span style={S.badge('var(--lp-bg-sunken)', 'var(--lp-text-tertiary)')}>desactivada</span>}
                  </td>
                  {esAdmin && (
                    <td style={S.td}>
                      <button style={S.btnGhost} onClick={() => handleToggle(c)}>Reactivar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {editing !== null && (
        <EditModal causa={editing} onSave={handleGuardar} onClose={() => setEditing(null)} loading={busy} />
      )}
    </>
  );
}
