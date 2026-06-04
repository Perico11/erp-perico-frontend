import { useState } from 'react';
import api from '../../services/api';
import NuevaPruebaModal from './NuevaPruebaModal';
import QCResultModal from './QCResultModal';
import useConfirm from '../../hooks/useConfirm';

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
    transition: 'border-color .15s',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardName: { fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 2 },
  badge: (bg, color) => ({
    display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 9px',
    borderRadius: 10, background: bg, color, marginRight: 6, textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  meta: { fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 4 },
  statsRow: { display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' },
  stat: { fontSize: 12, color: 'var(--lp-text-secondary)' },
  statVal: { fontWeight: 700, color: 'var(--lp-text-primary)', fontSize: 14 },
  actions: { display: 'flex', gap: 6 },
  empty: { textAlign: 'center', padding: 40, color: 'var(--lp-text-tertiary)', fontSize: 14 },
  ingList: { marginTop: 10, fontSize: 12, color: 'var(--lp-text-secondary)' },
  ingItem: { display: 'flex', gap: 8, padding: '3px 0', borderBottom: '1px solid var(--lp-border-subtle)' },
  pasosSection: { marginTop: 10 },
  paso: { fontSize: 12, color: 'var(--lp-text-secondary)', padding: '3px 0', display: 'flex', gap: 6 },
  pasoNum: { fontWeight: 700, color: 'var(--lp-brand-600)', minWidth: 18 },
  qcSection: { marginTop: 12, padding: 12, background: 'var(--lp-bg-base)', borderRadius: 'var(--lp-radius-sm)', border: '1px solid var(--lp-border-subtle)' },
  qcTitle: { fontSize: 12, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 6 },
};

const ESTADO_COLORS = {
  borrador: { bg: '#F3F4F6', color: '#374151' },
  en_proceso: { bg: '#DBEAFE', color: '#1D4ED8' },
  qc_pendiente: { bg: '#FEF3C7', color: '#92400E' },
  aprobado: { bg: '#D1FAE5', color: '#065F46' },
  rechazado: { bg: '#FEE2E2', color: '#991B1B' },
};

function PruebaCard({ prueba, onEdit, onDelete, onQC }) {
  const [expanded, setExpanded] = useState(false);
  const ec = ESTADO_COLORS[prueba.estado] || ESTADO_COLORS.borrador;
  const ings = prueba.ingredientes || [];
  const pasos = prueba.pasos || [];
  const qc = prueba.qc;

  return (
    <div style={{ ...S.card, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
      <div style={S.cardHeader}>
        <div style={{ flex: 1 }}>
          <div style={S.cardName}>{prueba.nombre}</div>
          <div>
            <span style={S.badge(ec.bg, ec.color)}>{(prueba.estado || 'borrador').replace('_', ' ')}</span>
            {ings.length > 0 && <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>{ings.length} ingredientes</span>}
          </div>
          <div style={S.meta}>
            {prueba.responsable} &middot; {prueba.fecha}
            {prueba.notas && <span> &middot; {prueba.notas}</span>}
          </div>
        </div>
        <div style={S.actions} onClick={e => e.stopPropagation()}>
          <button onClick={() => onQC(prueba)} style={{ ...S.btn, padding: '5px 10px', fontSize: 11, background: '#FEF3C7', color: '#92400E', border: 'none' }} title="Registrar QC">
            QC
          </button>
          <button onClick={() => onEdit(prueba)} style={{ ...S.btn, padding: '5px 10px', fontSize: 11, background: 'var(--lp-bg-base)', border: '1px solid var(--lp-border-subtle)', color: 'var(--lp-text-secondary)' }}>
            Editar
          </button>
          <button onClick={() => onDelete(prueba)} style={{ ...S.btn, padding: '5px 10px', fontSize: 11, background: '#FEE2E2', color: '#DC2626', border: 'none' }}>
            Eliminar
          </button>
        </div>
      </div>

      <div style={S.statsRow}>
        {prueba.pesoTotal > 0 && (
          <div style={S.stat}>Peso total: <span style={S.statVal}>{Number(prueba.pesoTotal).toFixed(2)} kg</span></div>
        )}
        {prueba.costoTotal > 0 && (
          <div style={S.stat}>Costo: <span style={S.statVal}>${Number(prueba.costoTotal).toFixed(2)}</span></div>
        )}
        {prueba.solidosPonderado > 0 && (
          <div style={S.stat}>Solidos pond.: <span style={S.statVal}>{Number(prueba.solidosPonderado).toFixed(1)}%</span></div>
        )}
        {prueba.densidadTeorica > 0 && (
          <div style={S.stat}>Densidad teo.: <span style={S.statVal}>{Number(prueba.densidadTeorica).toFixed(3)}</span></div>
        )}
      </div>

      {expanded && (
        <>
          {ings.length > 0 && (
            <div style={S.ingList}>
              <div style={{ fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 4 }}>Ingredientes:</div>
              {ings.map((ing, i) => (
                <div key={i} style={S.ingItem}>
                  <span style={{ flex: 1 }}>{ing.nombre}</span>
                  <span style={{ fontWeight: 600, minWidth: 60, textAlign: 'right' }}>{ing.cantidad} {ing.unidad || 'kg'}</span>
                  <span style={{ minWidth: 40, textAlign: 'right', color: 'var(--lp-text-tertiary)' }}>{ing.porcentaje ? ing.porcentaje + '%' : ''}</span>
                </div>
              ))}
            </div>
          )}

          {pasos.length > 0 && (
            <div style={S.pasosSection}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--lp-text-primary)', marginBottom: 4 }}>Proceso:</div>
              {pasos.map((p, i) => (
                <div key={i} style={S.paso}>
                  <span style={S.pasoNum}>{i + 1}.</span>
                  <span>{p.descripcion}</span>
                  {p.tiempo && <span style={{ color: 'var(--lp-text-tertiary)' }}>({p.tiempo})</span>}
                </div>
              ))}
            </div>
          )}

          {qc && (
            <div style={S.qcSection}>
              <div style={S.qcTitle}>Resultados QC</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
                {qc.viscosidad != null && <span>Viscosidad: <b>{qc.viscosidad} cP</b></span>}
                {qc.ph != null && <span>pH: <b>{qc.ph}</b></span>}
                {qc.densidad != null && <span>Densidad: <b>{qc.densidad}</b></span>}
                {qc.brillo != null && <span>Brillo: <b>{qc.brillo}</b></span>}
                {qc.cubrimiento && <span>Cubrimiento: <b>{qc.cubrimiento}</b></span>}
                {qc.estado && <span>Veredicto: <b style={{ color: qc.estado === 'aprobado' ? '#065F46' : '#991B1B' }}>{qc.estado.toUpperCase()}</b></span>}
              </div>
              {qc.observaciones && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>{qc.observaciones}</div>}
              {qc.imagenBase64 && (
                <div style={{ marginTop: 8 }}>
                  <img src={qc.imagenBase64} alt="QC" style={{ maxWidth: 200, maxHeight: 150, borderRadius: 6, border: '1px solid var(--lp-border-subtle)' }} />
                </div>
              )}
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                {qc.registradoPor} &middot; {qc.fecha ? new Date(qc.fecha).toLocaleString() : ''}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PruebasTab({ pruebas, loading, maestro, labMPs, reload, reloadMaterias }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editPrueba, setEditPrueba] = useState(null);
  const [showQC, setShowQC] = useState(null);
  const [filterEstado, setFilterEstado] = useState('all');
  const [confirmFn, ConfirmEl] = useConfirm();

  const handleSave = async (prueba) => {
    await api.saveLabPrueba(prueba);
    reload();
  };

  const handleDelete = async (prueba) => {
    const ok = await confirmFn(`¿Eliminar la prueba "${prueba.nombre}"? Esta acción no se puede deshacer.`, {
      title: 'Eliminar prueba',
      confirmText: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    await api.deleteLabPrueba(prueba.id);
    reload();
  };

  const handleQCSave = async (pruebaId, qc) => {
    await api.saveLabQC(pruebaId, qc);
    reload();
  };

  const q = search.toLowerCase();
  let filtered = pruebas.filter(p =>
    (!q || p.nombre.toLowerCase().includes(q) || (p.responsable || '').toLowerCase().includes(q)) &&
    (filterEstado === 'all' || p.estado === filterEstado)
  );
  // Más recientes primero
  filtered.sort((a, b) => (b.actualizadoEn || b.creadoEn || '').localeCompare(a.actualizadoEn || a.creadoEn || ''));

  if (loading) {
    return <div style={S.empty}><div className="lp-spinner" /></div>;
  }

  return (
    <>
      <div style={S.toolbar}>
        <input style={S.search} placeholder="Buscar prueba..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { k: 'all', l: 'Todas' },
            { k: 'borrador', l: 'Borrador' },
            { k: 'en_proceso', l: 'En proceso' },
            { k: 'aprobado', l: 'Aprobado' },
            { k: 'rechazado', l: 'Rechazado' },
          ].map(f => (
            <button key={f.k} onClick={() => setFilterEstado(f.k)} style={{
              ...S.btn, padding: '6px 12px', fontSize: 11,
              background: filterEstado === f.k ? 'var(--lp-brand-100)' : 'var(--lp-bg-base)',
              color: filterEstado === f.k ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)',
              border: '1px solid ' + (filterEstado === f.k ? 'var(--lp-brand-200)' : 'var(--lp-border-subtle)'),
            }}>
              {f.l}
            </button>
          ))}
        </div>
        <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => { setEditPrueba(null); setShowModal(true); }}>
          + Nueva Prueba
        </button>
      </div>

      {filtered.length === 0 && (
        <div style={S.empty}>
          {pruebas.length === 0 ? 'No hay pruebas registradas. Crea la primera.' : 'No hay pruebas que coincidan con el filtro.'}
        </div>
      )}

      {filtered.map(p => (
        <PruebaCard
          key={p.id}
          prueba={p}
          onEdit={(pr) => { setEditPrueba(pr); setShowModal(true); }}
          onDelete={handleDelete}
          onQC={(pr) => setShowQC(pr)}
        />
      ))}

      {showModal && (
        <NuevaPruebaModal
          prueba={editPrueba}
          maestro={maestro}
          labMPs={labMPs}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          onNewMP={async (mp) => { await api.saveLabMateria(mp); reloadMaterias(); }}
        />
      )}

      {showQC && (
        <QCResultModal
          prueba={showQC}
          onClose={() => setShowQC(null)}
          onSave={handleQCSave}
        />
      )}
      {ConfirmEl}
    </>
  );
}
