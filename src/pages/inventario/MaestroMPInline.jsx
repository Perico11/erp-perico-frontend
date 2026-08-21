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
  catBtn: { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--lp-text-tertiary)', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 2 },
  catBtnEmpty: { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--lp-warning-600)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline dotted', textUnderlineOffset: 2 },
  catInput: { fontSize: 11, padding: '2px 6px', border: '1px solid var(--lp-border-default)', borderRadius: 4, fontFamily: 'inherit', maxWidth: 170, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)' },
  catSave: { border: 'none', background: 'var(--lp-brand-600)', color: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 11, padding: '2px 7px', lineHeight: 1.4 },
  catCancel: { border: '1px solid var(--lp-border-default)', background: 'transparent', color: 'var(--lp-text-secondary)', borderRadius: 4, cursor: 'pointer', fontSize: 11, padding: '2px 7px', lineHeight: 1.4 },
  hint: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 12, textAlign: 'center', lineHeight: 1.5 },
  empty: { textAlign: 'center', padding: 24, color: 'var(--lp-text-tertiary)', fontSize: 13 },
  loading: { textAlign: 'center', padding: 32, color: 'var(--lp-text-tertiary)' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 6, fontSize: 12 },
};

const sinCat = (c) => !c || /sin\s*categor[ií]a/i.test(String(c));

/* canDelete = permiso `eliminarMP` (admin) → menú Sustituir/Eliminar.
   canEditCat = admin/compras → editar la categoría inline (POST /api/maestro-mp).
   onAction(action, mp) abre los modales del padre. query = búsqueda de la barra superior;
   con búsqueda se listan TODAS las MP que coinciden (cualquier estado); sin búsqueda,
   Top 20 activas por uso. reloadSignal: el padre lo incrementa tras sustituir/eliminar. */
export default function MaestroMPInline({ query = '', canDelete = false, canEditCat = false, mpsDisponibles = [], onAction, reloadSignal = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editCat, setEditCat] = useState(null); /* nombre de MP en edición de categoría */
  const [catVal, setCatVal] = useState('');
  const [savingCat, setSavingCat] = useState(false);
  /* Reasignación de proveedor (admin/compras) */
  const [editProv, setEditProv] = useState(null);
  const [provVal, setProvVal] = useState('');
  const [provLead, setProvLead] = useState('');
  const [savingProv, setSavingProv] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [avisoProv, setAvisoProv] = useState('');

  useEffect(() => {
    setLoading(true); setErr('');
    api.getMaestroMP()
      .then(r => setData(r.data || r))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [reloadSignal]);

  /* Catálogo de proveedores para el datalist — evita crear duplicados por una
     letra ("NRW  CHEMIE" vs "NRW CHEMIE"). Opcional: si falla, se puede teclear. */
  useEffect(() => {
    if (!canEditCat) return;
    api.getProveedores().then(r => setProveedores(r.data || r || [])).catch(() => {});
  }, [canEditCat]);
  if (loading) return <div style={S.loading}>Cargando maestro MP...</div>;
  if (err && !data) return <div style={S.err}>{err}</div>;
  const mps = data?.mps || {};
  const list = Object.entries(mps);
  const activos = list.filter(([, m]) => m.estado === 'activo').length;
  const ocultos = list.filter(([, m]) => m.estado === 'oculto').length;
  const eliminados = list.filter(([, m]) => m.estado === 'eliminado').length;

  /* categorías existentes (para el datalist) */
  const categorias = [...new Set(list.map(([, m]) => m.categoria).filter(c => !sinCat(c)))].sort();

  const startEdit = (nombre, actual) => { setEditCat(nombre); setCatVal(sinCat(actual) ? '' : String(actual)); setErr(''); };
  const saveCat = async (nombre) => {
    const v = catVal.trim();
    if (!v) { setEditCat(null); return; }
    setSavingCat(true);
    try {
      await api.setMaestroMPCampo(nombre, 'categoria', v);
      setData(d => ({ ...d, mps: { ...d.mps, [nombre]: { ...d.mps[nombre], categoria: v } } }));
      setEditCat(null);
    } catch (e) { setErr('No se pudo guardar la categoría: ' + (e?.message || 'error')); }
    finally { setSavingCat(false); }
  };

  const startEditProv = (nombre, m) => {
    setEditProv(nombre);
    setProvVal(m?.proveedor?.principal || '');
    setProvLead(m?.proveedor?.lead_time_dias != null ? String(m.proveedor.lead_time_dias) : '');
    setErr(''); setAvisoProv('');
  };
  const saveProv = async (nombre) => {
    const v = provVal.trim();
    if (!v) { setEditProv(null); return; }
    setSavingProv(true); setAvisoProv('');
    try {
      const lead = provLead.trim() === '' ? undefined : Number(provLead);
      const r = await api.reasignarProveedorMP(nombre, v, lead);
      setData(d => ({
        ...d,
        mps: { ...d.mps, [nombre]: { ...d.mps[nombre], proveedor: { ...(d.mps[nombre].proveedor || {}), principal: v, todos: [v], ...(r?.leadTime != null ? { lead_time_dias: r.leadTime } : {}) } } },
      }));
      if (r?.proveedorNuevo) {
        setAvisoProv(`"${v}" se dio de alta como proveedor nuevo. Confirma su lead time y actualiza el precio en Compras ▸ Catálogo.`);
        api.getProveedores().then(x => setProveedores(x.data || x || [])).catch(() => {});
      }
      setEditProv(null);
    } catch (e) { setErr('No se pudo reasignar el proveedor: ' + (e?.message || 'error')); }
    finally { setSavingProv(false); }
  };

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
      <datalist id="maestro-cats">{categorias.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="maestro-provs">
        {proveedores.map(p => <option key={p.nombre} value={p.nombre}>{p.mps} MP{p.mps === 1 ? '' : 's'}</option>)}
      </datalist>
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
      {err && <div style={{ ...S.err, marginBottom: 10 }}>{err}</div>}
      {avisoProv && (
        <div style={{ background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)', padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ flex: 1 }}>{avisoProv}</span>
          <button onClick={() => setAvisoProv('')} style={{ ...S.catCancel, flexShrink: 0 }}>✕</button>
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {q ? `Resultados de "${query}" (${visibles.length})` : 'Top 20 activas por uso en formulas'}
      </div>
      <div style={S.list}>
        {visibles.length === 0 && <div style={S.empty}>Sin coincidencias para "{query}".</div>}
        {visibles.map(([nombre, m]) => {
          const eb = estadoInfo(m.estado);
          const editando = editCat === nombre;
          const editandoProv = editProv === nombre;
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
                  {editando ? (
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                      <input
                        list="maestro-cats" autoFocus value={catVal} disabled={savingCat}
                        onChange={e => setCatVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCat(nombre); if (e.key === 'Escape') setEditCat(null); }}
                        placeholder="Categoría…" style={S.catInput}
                      />
                      <button onMouseDown={e => { e.preventDefault(); saveCat(nombre); }} disabled={savingCat} style={S.catSave} title="Guardar">{savingCat ? '…' : '✓'}</button>
                      <button onMouseDown={e => { e.preventDefault(); setEditCat(null); }} disabled={savingCat} style={S.catCancel} title="Cancelar">✕</button>
                    </span>
                  ) : (
                    <>
                      {canEditCat ? (
                        <button onClick={() => startEdit(nombre, m.categoria)} style={sinCat(m.categoria) ? S.catBtnEmpty : S.catBtn} title="Editar categoría">
                          {m.categoria || 'sin categoría'}<span style={{ opacity: .55, marginLeft: 3 }}>✎</span>
                        </button>
                      ) : (m.categoria || 'sin categoria')}
                      {m.stock?.qty != null && ' · stock ' + m.stock.qty}
                    </>
                  )}
                </div>
                {/* Proveedor — reasignable por admin/compras. Renglón propio para
                    que el nombre largo del proveedor no empuje a la categoría. */}
                <div style={S.meta}>
                  {editandoProv ? (
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        list="maestro-provs" autoFocus value={provVal} disabled={savingProv}
                        onChange={e => setProvVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveProv(nombre); if (e.key === 'Escape') setEditProv(null); }}
                        placeholder="Proveedor…" style={{ ...S.catInput, maxWidth: 240 }}
                      />
                      <input
                        type="number" min="0" value={provLead} disabled={savingProv}
                        onChange={e => setProvLead(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveProv(nombre); if (e.key === 'Escape') setEditProv(null); }}
                        placeholder="días" title="Lead time en días (lo usa el MRP)" style={{ ...S.catInput, maxWidth: 62 }}
                      />
                      <button onMouseDown={e => { e.preventDefault(); saveProv(nombre); }} disabled={savingProv} style={S.catSave} title="Guardar">{savingProv ? '…' : '✓'}</button>
                      <button onMouseDown={e => { e.preventDefault(); setEditProv(null); }} disabled={savingProv} style={S.catCancel} title="Cancelar">✕</button>
                    </span>
                  ) : canEditCat ? (
                    <button onClick={() => startEditProv(nombre, m)} style={m.proveedor?.principal ? S.catBtn : S.catBtnEmpty} title="Reasignar proveedor">
                      {m.proveedor?.principal || 'sin proveedor'}
                      {m.proveedor?.lead_time_dias != null && ` · ${m.proveedor.lead_time_dias} d`}
                      <span style={{ opacity: .55, marginLeft: 3 }}>✎</span>
                    </button>
                  ) : (m.proveedor?.principal || 'sin proveedor')}
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
          {canEditCat && ' La categoría y el proveedor se editan con el lápiz ✎. Reasignar el proveedor afecta SOLO a esa materia prima.'}
        </div>
      )}
    </div>
  );
}
