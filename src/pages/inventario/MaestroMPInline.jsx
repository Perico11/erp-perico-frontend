import { useEffect, useState } from 'react';
import api from '../../services/api';
import { MPActionsMenu } from './MPActions';

const S = {
  panel: { background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius)', padding: 16 },
  metric: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 },
  metricCard: { background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)', padding: 14, textAlign: 'center' },
  metricVal: { fontSize: 24, fontWeight: 800, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  metricLabel: { fontSize: 11, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, fontWeight: 600 },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: { display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 12, alignItems: 'center', padding: '10px 12px', background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)' },
  avatar: (color) => ({ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color, color: '#fff', fontSize: 14, fontWeight: 700 }),
  info: { minWidth: 0 },
  name: { fontSize: 13, fontWeight: 600, color: 'var(--lp-text-primary)' },
  meta: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 },
  badge: { display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' },
  estadoBadge: (color) => ({ display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, background: 'var(--lp-bg-raised)', color, textTransform: 'uppercase', letterSpacing: '.04em' }),
  actions: { display: 'flex', alignItems: 'center', gap: 6 },
  hint: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 12, textAlign: 'center', lineHeight: 1.5 },
  empty: { textAlign: 'center', padding: 24, color: 'var(--lp-text-tertiary)', fontSize: 13 },
  loading: { textAlign: 'center', padding: 32, color: 'var(--lp-text-tertiary)' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 6, fontSize: 12 },
};

/* canDelete = permiso `eliminarMP` (admin). onAction(action, mp) abre los modales
   Sustituir/Eliminar del padre (InventarioPage). query = búsqueda de la barra superior;
   con búsqueda se listan TODAS las MP que coinciden (cualquier estado) para poder
   encontrar la que se va a sustituir; sin búsqueda, Top 20 activas por uso.
   reloadSignal: el padre lo incrementa tras sustituir/eliminar para refrescar. */
export default function MaestroMPInline({ query = '', canDelete = false, mpsDisponibles = [], onAction, reloadSignal = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => {
    setLoading(true); setErr('');
    api.getMaestroMP()
      .then(r => setData(r.data || r))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [reloadSignal]);
  if (loading) return <div style={S.loading}>Cargando maestro MP...</div>;
  if (err) return <div style={S.err}>{err}</div>;
  const mps = data?.mps || {};
  const list = Object.entries(mps);
  const activos = list.filter(([, m]) => m.estado === 'activo').length;
  const ocultos = list.filter(([, m]) => m.estado === 'oculto').length;
  const eliminados = list.filter(([, m]) => m.estado === 'eliminado').length;

  const q = (query || '').trim().toLowerCase();
  const filtradas = (q
    ? list.filter(([nombre, m]) => nombre.toLowerCase().includes(q) || (m.categoria || '').toLowerCase().includes(q))
    : list.filter(([, m]) => m.estado === 'activo')
  ).sort((a, b) => (b[1].en_formulas?.length || 0) - (a[1].en_formulas?.length || 0));
  const visibles = q ? filtradas : filtradas.slice(0, 20);

  const estadoInfo = (estado) => {
    if (estado === 'eliminado') return { txt: 'eliminada', color: 'var(--lp-danger-600)' };
    if (estado === 'oculto') return { txt: 'oculta', color: 'var(--lp-warning-600)' };
    return null;
  };

  return (
    <div style={S.panel}>
      <div style={S.metric}>
        <div style={S.metricCard}>
          <div style={S.metricVal}>{list.length}</div>
          <div style={S.metricLabel}>Total MPs</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: 'var(--lp-success-600)' }}>{activos}</div>
          <div style={S.metricLabel}>Activos</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: 'var(--lp-warning-600)' }}>{ocultos}</div>
          <div style={S.metricLabel}>Ocultos</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: 'var(--lp-danger-600)' }}>{eliminados}</div>
          <div style={S.metricLabel}>Eliminados</div>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {q ? `Resultados de "${query}" (${visibles.length})` : 'Top 20 activas por uso en formulas'}
      </div>
      <div style={S.list}>
        {visibles.length === 0 && <div style={S.empty}>Sin coincidencias para "{query}".</div>}
        {visibles.map(([nombre, m]) => {
          const eb = estadoInfo(m.estado);
          return (
            <div key={nombre} style={S.row}>
              <div style={S.avatar(eb ? eb.color : 'var(--lp-warning-600)')}>{nombre.charAt(0)}</div>
              <div style={S.info}>
                <div style={S.name}>
                  {nombre}
                  {m.sustituidaPor && (
                    <span style={{ fontWeight: 500, color: 'var(--lp-text-tertiary)' }}> → {m.sustituidaPor}</span>
                  )}
                </div>
                <div style={S.meta}>
                  {m.categoria || 'sin categoria'}
                  {m.stock?.qty != null && ' · stock ' + m.stock.qty}
                </div>
              </div>
              <div style={S.actions}>
                {eb && <span style={S.estadoBadge(eb.color)}>{eb.txt}</span>}
                <span style={S.badge}>{(m.en_formulas || []).length} formulas</span>
                {canDelete && onAction && m.estado !== 'eliminado' && (
                  <MPActionsMenu mp={nombre} mpsDisponibles={mpsDisponibles} canEdit={canDelete} onAction={onAction} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!q && (
        <div style={S.hint}>
          {canDelete
            ? 'Busca arriba para encontrar y sustituir/eliminar cualquier materia prima.'
            : 'Busca arriba para encontrar cualquier materia prima.'}
        </div>
      )}
    </div>
  );
}
