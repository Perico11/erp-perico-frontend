import { useState } from 'react';
import api from '../../services/api';
import useConfirm from '../../hooks/useConfirm';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const S = {
  toolbar: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  search: {
    flex: 1, minWidth: 200, padding: '9px 14px', fontSize: 13, border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)', background: 'var(--lp-bg-base)', fontFamily: 'inherit',
    outline: 'none', color: 'var(--lp-text-primary)',
  },
  btn: {
    padding: '9px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 'var(--lp-radius-sm)',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  btnPrimary: { background: 'var(--lp-brand-600)', color: '#fff' },
  card: {
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 10,
  },
  cardName: { fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 4 },
  badge: (color) => ({
    display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 8px',
    borderRadius: 10, background: color === 'blue' ? 'var(--lp-info-50)' : color === 'green' ? 'var(--lp-success-50)' : 'var(--lp-bg-sunken)',
    color: color === 'blue' ? 'var(--lp-info-600)' : color === 'green' ? 'var(--lp-success-700)' : 'var(--lp-text-secondary)',
    marginRight: 6,
  }),
  meta: { fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 8 },
  field: { fontSize: 12, color: 'var(--lp-text-secondary)' },
  fieldVal: { fontWeight: 600, color: 'var(--lp-text-primary)' },
  empty: { textAlign: 'center', padding: 40, color: 'var(--lp-text-tertiary)', fontSize: 14 },
  /* Modal */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)', width: '100%',
    maxWidth: 520, maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)', overflowY: 'auto', padding: 24,
    boxShadow: '0 8px 32px rgba(0,0,0,.12)',
  },
  modalTitle: { fontSize: 17, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 16 },
  formGroup: { marginBottom: 14 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 4 },
  input: {
    width: '100%', padding: '8px 12px', fontSize: 13, border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)', fontFamily: 'inherit', background: 'var(--lp-bg-base)',
    boxSizing: 'border-box', outline: 'none',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
};

function MPCard({ mp, isLab, onEdit, onDelete }) {
  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={S.cardName}>{mp.nombre}</div>
          <div>
            {isLab && <span style={S.badge('blue')}>Lab</span>}
            {mp.tipo && <span style={S.badge('green')}>{mp.tipo}</span>}
            {mp.proveedor && <span style={{ fontSize: 12, color: 'var(--lp-text-tertiary)' }}>{mp.proveedor}</span>}
          </div>
        </div>
        {isLab && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onEdit(mp)} style={{ ...S.btn, padding: '5px 10px', fontSize: 11, background: 'var(--lp-bg-base)', border: '1px solid var(--lp-border-subtle)', color: 'var(--lp-text-secondary)' }}>
              Editar
            </button>
            <button onClick={() => onDelete(mp)} style={{ ...S.btn, padding: '5px 10px', fontSize: 11, background: 'var(--lp-danger-50)', color: 'var(--lp-danger-600)', border: 'none' }}>
              Eliminar
            </button>
          </div>
        )}
      </div>
      <div style={S.grid}>
        {mp.densidad != null && <div style={S.field}>Densidad: <span style={S.fieldVal}>{mp.densidad} g/mL</span></div>}
        {mp.solidos != null && <div style={S.field}>Solidos: <span style={S.fieldVal}>{mp.solidos}%</span></div>}
        {mp.viscosidad != null && <div style={S.field}>Viscosidad: <span style={S.fieldVal}>{mp.viscosidad} cP</span></div>}
        {mp.ph != null && <div style={S.field}>pH: <span style={S.fieldVal}>{mp.ph}</span></div>}
        {mp.costoKg != null && <div style={S.field}>Costo: <span style={S.fieldVal}>${mp.costoKg}/kg</span></div>}
      </div>
      {mp.notas && <div style={S.meta}>{mp.notas}</div>}
    </div>
  );
}

const EMPTY_MP = { nombre: '', proveedor: '', tipo: 'otro', densidad: '', solidos: '', viscosidad: '', ph: '', costoKg: '', notas: '' };

function MPModal({ mp, onClose, onSave }) {
  const [form, setForm] = useState(mp ? { ...mp, densidad: mp.densidad ?? '', solidos: mp.solidos ?? '', viscosidad: mp.viscosidad ?? '', ph: mp.ph ?? '', costoKg: mp.costoKg ?? '' } : { ...EMPTY_MP });
  const [saving, setSaving] = useState(false);

  /* MÓVIL: bloquea el scroll del FONDO mientras el modal está montado y publica
     --pp-vvh (alto visible real, sigue al teclado) que S.modal usa en su maxHeight
     para que el contenido SIEMPRE tenga overflow interno scrolleable. MPModal solo
     se monta cuando está abierto (showModal && ...), así que pasamos true. */
  useBodyScrollLock(true);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre.trim()) return alert('Nombre requerido');
    setSaving(true);
    try {
      await onSave({
        ...form,
        id: mp?.id || undefined,
        densidad: form.densidad !== '' ? Number(form.densidad) : null,
        solidos: form.solidos !== '' ? Number(form.solidos) : null,
        viscosidad: form.viscosidad !== '' ? Number(form.viscosidad) : null,
        ph: form.ph !== '' ? Number(form.ph) : null,
        costoKg: form.costoKg !== '' ? Number(form.costoKg) : null,
      });
      onClose();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>{mp ? 'Editar MP de Lab' : 'Nueva MP de Laboratorio'}</div>

        <div style={S.formGroup}>
          <label style={S.label}>Nombre *</label>
          <input style={S.input} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: RESINA EXPERIMENTAL X" />
        </div>

        <div style={S.row2}>
          <div style={S.formGroup}>
            <label style={S.label}>Proveedor</label>
            <input style={S.input} value={form.proveedor} onChange={e => set('proveedor', e.target.value)} />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Tipo</label>
            <select style={S.input} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="resina">Resina</option>
              <option value="pigmento">Pigmento</option>
              <option value="carga">Carga</option>
              <option value="aditivo">Aditivo</option>
              <option value="solvente">Solvente</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        <div style={S.row2}>
          <div style={S.formGroup}>
            <label style={S.label}>Densidad (g/mL)</label>
            <input style={S.input} type="number" inputMode="decimal" step="0.01" value={form.densidad} onChange={e => set('densidad', e.target.value)} />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Solidos (%)</label>
            <input style={S.input} type="number" inputMode="decimal" step="0.1" value={form.solidos} onChange={e => set('solidos', e.target.value)} />
          </div>
        </div>

        <div style={S.row2}>
          <div style={S.formGroup}>
            <label style={S.label}>Viscosidad (cP)</label>
            <input style={S.input} type="number" inputMode="numeric" step="1" value={form.viscosidad} onChange={e => set('viscosidad', e.target.value)} />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>pH</label>
            <input style={S.input} type="number" inputMode="decimal" step="0.1" value={form.ph} onChange={e => set('ph', e.target.value)} />
          </div>
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Costo ($/kg)</label>
          <input style={S.input} type="number" inputMode="decimal" step="0.01" value={form.costoKg} onChange={e => set('costoKg', e.target.value)} />
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Notas</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={form.notas} onChange={e => set('notas', e.target.value)} />
        </div>

        <div style={S.actions}>
          <button style={{ ...S.btn, background: 'var(--lp-bg-base)', border: '1.5px solid var(--lp-border-subtle)', color: 'var(--lp-text-secondary)' }} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.btn, ...S.btnPrimary, opacity: saving ? .6 : 1 }} disabled={saving} onClick={handleSave}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MateriasTab({ maestro, labMPs, loading, reload }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMP, setEditMP] = useState(null);
  const [filter, setFilter] = useState('all'); // all | lab | maestro
  const [confirmFn, ConfirmEl] = useConfirm();

  const handleSave = async (mp) => {
    await api.saveLabMateria(mp);
    reload();
  };

  const handleDelete = async (mp) => {
    const ok = await confirmFn(`¿Eliminar "${mp.nombre}" del laboratorio? Esta acción no se puede deshacer.`, {
      title: 'Eliminar materia prima',
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    await api.deleteLabMateria(mp.id);
    reload();
  };

  const q = search.toLowerCase();
  const filteredMaestro = filter !== 'lab' ? maestro.filter(m => !q || m.nombre.toLowerCase().includes(q)) : [];
  const filteredLab = filter !== 'maestro' ? labMPs.filter(m => !q || m.nombre.toLowerCase().includes(q)) : [];

  if (loading) {
    return <div style={S.empty}><div className="lp-spinner" /></div>;
  }

  return (
    <>
      <div style={S.toolbar}>
        <input style={S.search} placeholder="Buscar materia prima..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ k: 'all', l: 'Todas' }, { k: 'maestro', l: 'Maestro' }, { k: 'lab', l: 'Lab' }].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              ...S.btn, padding: '6px 14px', fontSize: 12,
              background: filter === f.k ? 'var(--lp-brand-100)' : 'var(--lp-bg-base)',
              color: filter === f.k ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)',
              border: '1px solid ' + (filter === f.k ? 'var(--lp-brand-200)' : 'var(--lp-border-subtle)'),
            }}>
              {f.l}
            </button>
          ))}
        </div>
        <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => { setEditMP(null); setShowModal(true); }}>
          + Nueva MP
        </button>
      </div>

      {filteredLab.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, marginTop: 8 }}>
            Materias de Laboratorio ({filteredLab.length})
          </div>
          {filteredLab.map(mp => (
            <MPCard key={mp.id} mp={mp} isLab onEdit={(m) => { setEditMP(m); setShowModal(true); }} onDelete={handleDelete} />
          ))}
        </>
      )}

      {filteredMaestro.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, marginTop: 16 }}>
            Maestro de MPs ({filteredMaestro.length})
          </div>
          {filteredMaestro.map(mp => (
            <MPCard key={mp.nombre} mp={mp} isLab={false} onEdit={() => {}} onDelete={() => {}} />
          ))}
        </>
      )}

      {filteredLab.length === 0 && filteredMaestro.length === 0 && (
        <div style={S.empty}>No se encontraron materias primas{search ? ` para "${search}"` : ''}</div>
      )}

      {showModal && (
        <MPModal
          mp={editMP}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
      {ConfirmEl}
    </>
  );
}
