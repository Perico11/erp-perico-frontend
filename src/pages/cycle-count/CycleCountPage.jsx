import { useState, useEffect, useCallback, useMemo } from 'react';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import SegmentedControl from '../../components/ui/SegmentedControl';
import useConfirm from '../../hooks/useConfirm';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import PageTabs from '../../components/ui/PageTabs';
import ImportExportPrint from '../../components/ui/ImportExportPrint';

const S = {
  wrap: { padding: '0 20px 100px' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 200, padding: '10px 14px',
    borderRadius: 'var(--lp-radius-sm)', border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 13, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    outline: 'none', boxSizing: 'border-box',
  },
  btnPrimary: {
    padding: '10px 16px', fontSize: 12, fontWeight: 700,
    borderRadius: 'var(--lp-radius-sm)', border: 'none',
    background: 'var(--lp-brand-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
  },
  btnGhost: {
    padding: '8px 14px', fontSize: 11, fontWeight: 600,
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-raised)', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)',
  },
  btnSuccess: {
    padding: '8px 14px', fontSize: 11, fontWeight: 700,
    borderRadius: 'var(--lp-radius-sm)',
    border: 'none', background: 'var(--lp-success-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
  },
  btnWarning: {
    padding: '8px 14px', fontSize: 11, fontWeight: 700,
    borderRadius: 'var(--lp-radius-sm)',
    border: 'none', background: 'var(--lp-warning-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
  },
  metric: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12, marginBottom: 16,
  },
  metricCard: {
    background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
    padding: 14, textAlign: 'center',
  },
  metricVal: { fontSize: 24, fontWeight: 800, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  metricLabel: { fontSize: 11, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, fontWeight: 600 },
  card: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    padding: 16, marginBottom: 12,
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  badge: (bg, fg) => ({
    display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700,
    borderRadius: 4, background: bg, color: fg,
    textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  /* itemRow se aplica desktop. En móvil reorganizamos con clase CSS. */
  itemRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 90px 90px 80px 60px',
    gap: 8, alignItems: 'center', padding: '10px 12px',
    borderRadius: 'var(--lp-radius-sm)', fontSize: 12,
  },
  itemRowFlagged: { background: 'var(--lp-danger-50)' },
  itemRowOK: { background: 'var(--lp-bg-sunken)' },
  inputCount: {
    width: '100%', padding: '6px 10px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12, fontFamily: 'var(--lp-font-mono)',
    textAlign: 'right', background: 'var(--lp-bg-raised)',
    boxSizing: 'border-box',
  },
  loading: { textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 12 },
  empty: { textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
};

const CATEGORIAS = [
  { v: 'mp', label: 'Materia Prima' },
  { v: 'pt', label: 'Producto Terminado' },
  { v: 'envases', label: 'Envases / Tapas' },
];
const TIPOS = [
  { v: 'completo', label: 'Completo (todos)' },
  { v: 'aleatorio', label: 'Aleatorio (~30%)' },
];

function StartModal({ onStart, onClose, loading }) {
  const [categoria, setCategoria] = useState('mp');
  const [tipo, setTipo] = useState('completo');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,21,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)', padding: 20, maxWidth: 460, width: '100%', border: '1.5px solid var(--lp-border-subtle)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Iniciar nueva sesión de conteo</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-secondary)', marginBottom: 6 }}>Categoría</div>
          <SegmentedControl
            value={categoria}
            onChange={setCategoria}
            options={CATEGORIAS.map(c => ({ value: c.v, label: c.label }))}
            color="brand"
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-secondary)', marginBottom: 6 }}>Tipo de conteo</div>
          <SegmentedControl
            value={tipo}
            onChange={setTipo}
            options={TIPOS.map(t => ({ value: t.v, label: t.label }))}
            color="brand"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.btnGhost} onClick={onClose} disabled={loading}>Cancelar</button>
          <button style={S.btnPrimary} onClick={() => onStart(categoria, tipo)} disabled={loading}>
            {loading ? 'Iniciando...' : 'Iniciar conteo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CausasRaizModal — bloquea la aprobación hasta que cada item flagged tenga
   una causa raíz asignada. Es el punto de control de calidad del proceso:
   sin causa no aprendemos por qué hay varianza.
   ════════════════════════════════════════════════════════════════════════════ */
function CausasRaizModal({ sesion, onAprobar, onClose, loading }) {
  const [causas, setCausas] = useState([]);
  const [asignaciones, setAsignaciones] = useState({});
  const [err, setErr] = useState('');
  const [loadingCat, setLoadingCat] = useState(true);

  useEffect(() => {
    api.getCausasVarianza()
      .then(r => setCausas((r.data?.causas || []).filter(c => c.activo)))
      .catch(e => setErr('Error catálogo: ' + e.message))
      .finally(() => setLoadingCat(false));
  }, []);

  const flagged = useMemo(
    () => (sesion?.items || []).filter(i => i.flagged && i.stockFisico != null),
    [sesion]
  );
  const todasAsignadas = flagged.every(i => asignaciones[i.key]);

  const handleConfirmar = async () => {
    if (!todasAsignadas) { setErr('Asigna causa a TODOS los items'); return; }
    setErr('');
    try { await onAprobar(asignaciones); }
    catch (e) {
      setErr(e?.data?.error || e.message || 'Error al aprobar');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,21,.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)', padding: 20, maxWidth: 720, width: '100%', maxHeight: '85vh', overflowY: 'auto', border: '1.5px solid var(--lp-border-subtle)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Asignar causa raíz</div>
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginBottom: 14 }}>
          La sesión <strong>{sesion?.id}</strong> tiene <strong>{flagged.length}</strong> item(s) con varianza significativa. Asigna una causa a cada uno antes de aprobar — esto alimenta el análisis Pareto trimestral.
        </div>

        {loadingCat ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--lp-text-tertiary)' }}>Cargando catálogo…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 14 }}>
            <thead><tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>Item</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase' }}>Sistema</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase' }}>Físico</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase' }}>Δ</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase' }}>Causa raíz *</th>
            </tr></thead>
            <tbody>
              {flagged.map(it => (
                <tr key={it.key} style={{ borderBottom: '1px solid var(--lp-border-subtle)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{it.nombre}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--lp-font-mono)', textAlign: 'right' }}>{it.stockSistema}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--lp-font-mono)', textAlign: 'right' }}>{it.stockFisico}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--lp-font-mono)', textAlign: 'right', color: 'var(--lp-danger-600)', fontWeight: 700 }}>
                    {it.varianza > 0 ? '+' : ''}{it.varianza} ({it.pctVarianza?.toFixed(1)}%)
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <select value={asignaciones[it.key] || ''}
                      onChange={e => setAsignaciones(prev => ({ ...prev, [it.key]: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1.5px solid ' + (asignaciones[it.key] ? 'var(--lp-success-300)' : 'var(--lp-danger-300)'), borderRadius: 'var(--lp-radius-sm)', background: 'var(--lp-bg-raised)' }}>
                      <option value="">— Selecciona —</option>
                      {causas.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {err && <div style={{ ...S.err, marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
            {Object.keys(asignaciones).filter(k => asignaciones[k]).length} de {flagged.length} asignadas
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.btnGhost} onClick={onClose} disabled={loading}>Cancelar</button>
            <button style={{ ...S.btnSuccess, opacity: todasAsignadas ? 1 : 0.5, cursor: todasAsignadas ? 'pointer' : 'not-allowed' }}
              onClick={handleConfirmar} disabled={!todasAsignadas || loading}>
              {loading ? 'Aprobando…' : '✓ Aprobar con causas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PendientesTab — Calendario de conteos pendientes (Fase 3)
   Lista MPs según cadencia ABC: vencidos (rojo), esta semana (ámbar), próximos.
   Permite ver de un vistazo qué tocan contar.
   ════════════════════════════════════════════════════════════════════════════ */
function PendientesTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.getCalendarioConteos()
      .then(r => setData(r.data))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={S.loading}>Cargando calendario…</div>;
  if (err) return <div style={S.err}>{err}</div>;
  if (!data) return <div style={S.empty}>Sin datos</div>;

  const fmt$ = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
  const Bloque = ({ titulo, color, badge, items, vacio }) => (
    <div style={{ ...S.card, borderTop: '3px solid ' + color }}>
      <div style={{ ...S.cardHeader, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{titulo}</div>
        <span style={S.badge(color + '22', color)}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '12px 4px', fontSize: 12, color: 'var(--lp-text-tertiary)' }}>{vacio}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              <th style={{ textAlign: 'left', padding: '6px 8px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase' }}>MP</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase' }}>Clase</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase' }}>Stock</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase' }}>Valor</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase' }}>Último conteo</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase' }}>Cadencia</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', background: 'var(--lp-bg-sunken)', fontSize: 10, textTransform: 'uppercase' }}>{badge}</th>
            </tr></thead>
            <tbody>
              {items.slice(0, 50).map(it => (
                <tr key={it.mp} style={{ borderBottom: '1px solid var(--lp-border-subtle)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{it.mp}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <span style={S.badge(
                      it.claseABC === 'A' ? 'var(--lp-danger-100)' : it.claseABC === 'B' ? 'var(--lp-warning-100)' : 'var(--lp-bg-sunken)',
                      it.claseABC === 'A' ? 'var(--lp-danger-700)' : it.claseABC === 'B' ? 'var(--lp-warning-700)' : 'var(--lp-text-secondary)'
                    )}>{it.claseABC}</span>
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{Number(it.qty).toFixed(1)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{fmt$(it.valor)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                    {it.ultimoConteo ? new Date(it.ultimoConteo).toLocaleDateString('es-MX') + ` (${it.diasDesde}d)` : 'Nunca'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontSize: 11 }}>{it.cadenciaDias}d</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color }}>
                    {it.diasParaVencer < 0 ? `+${Math.abs(it.diasParaVencer)}d vencido` : `${it.diasParaVencer}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 50 && (
            <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
              Mostrando 50 de {items.length}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div style={{ background: 'var(--lp-brand-50)', border: '1px solid var(--lp-brand-200)', color: 'var(--lp-brand-700)', padding: '10px 12px', borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 14 }}>
        <strong>Cadencia recomendada:</strong> Clase A cada {data.cadencia.A} días · Clase B cada {data.cadencia.B} días · Clase C cada {data.cadencia.C} días.
      </div>
      <Bloque titulo="Vencidos — atender YA" color="var(--lp-danger-600)" badge="Atrasado"
        items={data.vencidos} vacio="Sin conteos vencidos." />
      <Bloque titulo="Esta semana" color="var(--lp-warning-600)" badge="Vence en"
        items={data.estaSemana} vacio="Sin pendientes esta semana." />
      <Bloque titulo="Próximos" color="var(--lp-success-600)" badge="Vence en"
        items={data.proximos} vacio="Sin próximos en el horizonte." />
    </>
  );
}

function AddMPModal({ onAdd, onClose, loading }) {
  const [nombre, setNombre] = useState('');
  const [stockFisico, setStockFisico] = useState('');
  const [unidad, setUnidad] = useState('kg');
  const [err, setErr] = useState('');

  const guardar = async () => {
    const n = nombre.trim();
    if (!n) { setErr('Ingresa el nombre de la MP'); return; }
    const sf = Number(stockFisico);
    if (stockFisico === '' || isNaN(sf) || sf < 0) { setErr('Stock físico inválido'); return; }
    setErr('');
    try { await onAdd(n, sf, unidad); }
    catch (e) { setErr(e.message || 'Error al agregar'); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,21,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)', padding: 20, maxWidth: 460, width: '100%', border: '1.5px solid var(--lp-border-subtle)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Agregar MP nueva al conteo</div>
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginBottom: 16 }}>
          La MP se creará en el inventario sólo cuando admin apruebe la sesión.
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-secondary)', marginBottom: 6 }}>Nombre</div>
          <input style={S.search} type="text" value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: RESINA ABC-123" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('cc-add-fisico')?.focus(); }} />
          <div style={{ fontSize: 10, color: 'var(--lp-text-tertiary)', marginTop: 4 }}>Se guarda en MAYÚSCULAS</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-secondary)', marginBottom: 6 }}>Stock físico</div>
            <input id="cc-add-fisico" style={{ ...S.search, fontFamily: 'var(--lp-font-mono)', textAlign: 'right' }}
              type="number" min="0" step="0.01"
              value={stockFisico} onChange={(e) => setStockFisico(e.target.value)}
              placeholder="0.00"
              onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-secondary)', marginBottom: 6 }}>Unidad</div>
            <select style={S.search} value={unidad} onChange={(e) => setUnidad(e.target.value)}>
              <option value="kg">kg</option>
              <option value="lt">lt</option>
              <option value="pz">pz</option>
            </select>
          </div>
        </div>

        {err && <div style={{ ...S.err, marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.btnGhost} onClick={onClose} disabled={loading}>Cancelar</button>
          <button style={S.btnPrimary} onClick={guardar} disabled={loading}>
            {loading ? 'Agregando...' : 'Agregar al conteo'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemConteo({ item, sesionId, onRegistrar }) {
  const [val, setVal] = useState(item.stockFisico !== null && item.stockFisico !== undefined ? String(item.stockFisico) : '');
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (val === '') return;
    const num = Number(val);
    if (isNaN(num) || num < 0) return;
    setSaving(true);
    try { await onRegistrar(sesionId, item.key, num); } finally { setSaving(false); }
  };
  const flagged = item.flagged;
  const variancePct = item.pctVarianza;
  /* Diseño REVERTIDO a tabla horizontal compacta (versión original).
     Cada item es UNA fila densa con columnas: Nombre [unidad] · Sistema · Físico · Varianza · %.
     En PC con monitor grande caben muchos items por pantalla. En móvil overflow-x scroll. */
  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0,1fr) auto 80px 110px 90px 65px',
    gap: 10,
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12,
    background: flagged ? 'var(--lp-danger-50)' : 'var(--lp-bg-sunken)',
    border: flagged ? '1px solid var(--lp-danger-200)' : '1px solid transparent',
    minWidth: 0,
  };
  return (
    <div style={rowStyle}>
      {/* Nombre + badge NUEVA inline */}
      <span style={{ fontWeight: 700, color: 'var(--lp-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.nombre}>{item.nombre}</span>
        {item.esNueva && (
          <span style={{ ...S.badge('var(--lp-brand-100)', 'var(--lp-brand-700)'), flexShrink: 0 }}>NUEVA</span>
        )}
      </span>

      {/* Unidad */}
      <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>{item.unidad}</span>

      {/* Sistema */}
      <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-secondary)', fontSize: 13, fontWeight: 600 }}>
        {item.stockSistema}
      </span>

      {/* Físico (input editable) */}
      <input
        style={{ ...S.inputCount, fontSize: 13, padding: '5px 8px', minHeight: 32, textAlign: 'right' }}
        type="number" inputMode="decimal" min="0" step="0.01"
        value={val} onChange={(e) => setVal(e.target.value)}
        onBlur={guardar} onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
        placeholder="—" disabled={saving}
      />

      {/* Varianza */}
      <span style={{
        textAlign: 'right',
        fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 13,
        color: item.varianza == null ? 'var(--lp-text-tertiary)'
          : item.varianza === 0 ? 'var(--lp-success-600)'
          : flagged ? 'var(--lp-danger-600)' : 'var(--lp-warning-600)',
      }}>
        {item.varianza == null ? '—' : (item.varianza > 0 ? '+' : '') + item.varianza.toFixed(2)}
      </span>

      {/* % varianza */}
      <span style={{ textAlign: 'center' }}>
        {variancePct != null ? (
          <span style={S.badge(
            flagged ? 'var(--lp-danger-100)' : variancePct === 0 ? 'var(--lp-success-100)' : 'var(--lp-warning-100)',
            flagged ? 'var(--lp-danger-700)' : variancePct === 0 ? 'var(--lp-success-700)' : 'var(--lp-warning-700)',
          )}>{variancePct.toFixed(1)}%</span>
        ) : <span style={{ color: 'var(--lp-text-tertiary)', fontSize: 11 }}>—</span>}
      </span>
    </div>
  );
}

function SesionActiva({ sesion, onRegistrar, onFinalizar, onAgregarMP }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const items = useMemo(() => {
    let arr = [...(sesion.items || [])];
    if (filter === 'pendientes') arr = arr.filter(i => i.stockFisico === null || i.stockFisico === undefined);
    else if (filter === 'flaggeados') arr = arr.filter(i => i.flagged);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(i => (i.nombre || '').toLowerCase().includes(q));
    }
    return arr;
  }, [sesion.items, filter, search]);

  /* Título legible — antes mostraba el ID interno (ej. "CC-mpek95x5") como
     título principal, lo cual confundía al usuario. Ahora mostramos un texto
     amigable; el ID queda como referencia técnica más pequeña al lado. */
  const tituloAmigable = `Conteo de ${CATEGORIAS.find(c => c.v === sesion.categoria)?.label || sesion.categoria}`;
  const tipoLabel = TIPOS.find(t => t.v === sesion.tipo)?.label || sesion.tipo;

  return (
    <div style={S.card}>
      {/* Header — layout vertical para que en móvil el texto no se aplaste */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)' }}>
            {tituloAmigable}
          </span>
          <span style={S.badge('var(--lp-brand-100)', 'var(--lp-brand-700)')}>activo</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', lineHeight: 1.5 }}>
          {tipoLabel}
          {sesion.folio && (
            <>
              {' · '}
              <span style={{
                fontFamily: 'var(--lp-font-mono)', fontWeight: 700,
                color: 'var(--lp-brand-700)', background: 'var(--lp-brand-100)',
                padding: '1px 8px', borderRadius: 4, fontSize: 11,
              }} title="Folio consecutivo del año — para citar en papel o auditoría">
                {sesion.folio}
              </span>
            </>
          )}
          {' · '}
          <span style={{ fontFamily: 'var(--lp-font-mono)', opacity: 0.55, fontSize: 10 }} title="ID técnico interno">
            {sesion.id}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <ImportExportPrint
          exportUrl={() => api.urlExportCycleCount(sesion.id)}
          printUrl={() => api.urlPrintCycleCount(sesion.id)}
          permisos={{ import: false }}
        />
        <button style={S.btnWarning} onClick={() => onFinalizar(sesion.id)}>Finalizar conteo</button>
      </div>

      <div style={S.metric}>
        <div style={S.metricCard}>
          <div style={S.metricVal}>{sesion.totalItems || 0}</div>
          <div style={S.metricLabel}>Total items</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: 'var(--lp-success-600)' }}>{sesion.contados || 0}</div>
          <div style={S.metricLabel}>Contados</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: 'var(--lp-danger-600)' }}>{sesion.varianzas || 0}</div>
          <div style={S.metricLabel}>Varianzas {'>'}5%</div>
        </div>
      </div>

      <div style={S.toolbar}>
        <input style={S.search} type="text" placeholder="Buscar item..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'pendientes', label: 'Pendientes' },
            { value: 'flaggeados', label: 'Flaggeados' },
          ]}
          color="brand"
        />
        {sesion.categoria === 'mp' && onAgregarMP && (
          <button style={S.btnPrimary} onClick={onAgregarMP} title="Agregar una MP que no está en el inventario">
            + Agregar MP nueva
          </button>
        )}
      </div>

      {/* Lista de items — tabla horizontal compacta (revertido). En PC cabe
          mucho; en celular se hace scroll horizontal si la columna no entra. */}
      <div style={{ marginTop: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {/* Header de columnas */}
        {items.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) auto 80px 110px 90px 65px',
            gap: 10,
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.06em',
            color: 'var(--lp-text-tertiary)',
            borderBottom: '2px solid var(--lp-border-subtle)',
            marginBottom: 6,
            minWidth: 580,
          }}>
            <span>Materia Prima</span>
            <span>U.</span>
            <span style={{ textAlign: 'right' }}>Sistema</span>
            <span style={{ textAlign: 'right' }}>Físico</span>
            <span style={{ textAlign: 'right' }}>Varianza</span>
            <span style={{ textAlign: 'center' }}>%</span>
          </div>
        )}
        {/* Filas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 580 }}>
          {items.map(item => <ItemConteo key={item.key} item={item} sesionId={sesion.id} onRegistrar={onRegistrar} />)}
          {items.length === 0 && <div style={S.empty}>Sin items que coincidan</div>}
        </div>
      </div>
    </div>
  );
}

function HistorialCard({ sesion, onAprobar, canAprobar }) {
  const [expanded, setExpanded] = useState(false);
  const fecha = new Date(sesion.fecha).toLocaleString('es-MX');
  const estadoBadges = {
    activo: { bg: 'var(--lp-brand-100)', fg: 'var(--lp-brand-700)' },
    finalizado: { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-700)' },
    aprobado: { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-700)' },
  };
  const eb = estadoBadges[sesion.estado] || { bg: 'var(--lp-bg-sunken)', fg: 'var(--lp-text-secondary)' };
  const flaggedItems = (sesion.items || []).filter(i => i.flagged);

  return (
    <div style={S.card}>
      {/* Header: layout vertical — primero el ID + fecha, luego badge,
          metadata en línea propia y acciones al final. Evita que el texto
          quede comprimido en columna estrecha al lado de los botones. */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {sesion.folio ? (
            <>
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: 'var(--lp-brand-700)', background: 'var(--lp-brand-100)',
                padding: '2px 10px', borderRadius: 5, fontFamily: 'var(--lp-font-mono)',
              }} title="Folio consecutivo del año">{sesion.folio}</span>
              <span style={{ fontSize: 10, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }}>
                ({sesion.id})
              </span>
            </>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)' }}>{sesion.id}</span>
          )}
          <span style={S.badge(eb.bg, eb.fg)}>{sesion.estado}</span>
          <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginLeft: 'auto' }}>{fecha}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
          {CATEGORIAS.find(c => c.v === sesion.categoria)?.label || sesion.categoria}
          {' · '}{sesion.usuario}
          {' · '}<strong>{sesion.contados}/{sesion.totalItems}</strong> contados
          {sesion.varianzas > 0 && (
            <span style={{ color: 'var(--lp-danger-700)', fontWeight: 600 }}> · {sesion.varianzas} varianzas</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {sesion.estado === 'finalizado' && canAprobar && (
          <button style={S.btnSuccess} onClick={() => onAprobar(sesion.id)}>Aprobar ajuste</button>
        )}
        <ImportExportPrint
          exportUrl={() => api.urlExportCycleCount(sesion.id)}
          printUrl={() => api.urlPrintCycleCount(sesion.id)}
          permisos={{ import: false }}
        />
        <button style={S.btnGhost} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Cerrar' : 'Ver detalle'}
        </button>
      </div>

      {expanded && flaggedItems.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-danger-700)', marginBottom: 6 }}>
            Items con varianza significativa ({flaggedItems.length}):
          </div>
          {flaggedItems.map(item => (
            <div key={item.key} style={{ ...S.itemRow, ...S.itemRowFlagged, marginBottom: 4 }}>
              <div style={{ fontWeight: 600 }}>{item.nombre}</div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{item.stockSistema}</div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{item.stockFisico}</div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-danger-600)', fontWeight: 700 }}>
                {item.varianza > 0 ? '+' : ''}{item.varianza}
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)')}>
                  {item.pctVarianza?.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CycleCountPage() {
  const { can, user } = useAuth();
  const [confirm, ConfirmEl] = useConfirm();
  const [activeTab, setActiveTab] = useState('actual');
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  /* Defense-in-depth: si por alguna razón (cache vieja del menú, link directo
     en historial del browser, push notification cargada antes de re-login)
     un rol sin permiso llega aquí, le bloqueamos la pantalla con un mensaje
     claro. El App.jsx RoleRoute es la primera capa pero confiar solo en
     routing-guards es frágil (cambios de rol mid-sesión, deep links). */
  const ROLES_PERMITIDOS = ['admin', 'inventario'];
  if (user && user.rol && !ROLES_PERMITIDOS.includes(user.rol)) {
    return (
      <div>
        <TopBar title="Conteo Físico" />
        <div style={{
          maxWidth: 480, margin: '40px auto', padding: 24,
          background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
          border: '1.5px solid var(--lp-border-subtle)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Sin acceso</div>
          <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', lineHeight: 1.5 }}>
            Esta pantalla está reservada para usuarios con rol <strong>inventario</strong> o <strong>admin</strong>.
            Tu rol actual es <strong>{user.rol}</strong>.
          </div>
        </div>
      </div>
    );
  }
  const [showStart, setShowStart] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showAddMP, setShowAddMP] = useState(false);
  const [addingMP, setAddingMP] = useState(false);
  const [sesionParaAprobar, setSesionParaAprobar] = useState(null);
  const [aprobandoConCausas, setAprobandoConCausas] = useState(false);
  const [toast, setToast] = useState('');

  const cargar = useCallback(() => {
    setLoading(true);
    api.getCycleCounts()
      .then(r => {
        const arr = Array.isArray(r) ? r : (r.data || []);
        setSesiones(arr);
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /* FIX jun 2026 (K1 + K2): Burgos no veía la aprobación de su sesión en
     realtime — quedaba viendo "finalizado" hasta refresh manual. Ahora con
     el canal 'cycleCount' (con filtro corregido a ['admin','inventario']),
     escucha el evento y recarga. */
  useRealtimeSync({
    onCycleCount: () => cargar(),
    onInventario: () => cargar(), /* si admin ajusta tras aprobación, refrescar */
  });

  const sesionActiva = useMemo(
    () => sesiones.find(s => s.estado === 'activo' && s.usuario === user?.nombre),
    [sesiones, user]
  );
  const historial = useMemo(
    () => [...sesiones].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    [sesiones]
  );

  const handleStart = async (categoria, tipo) => {
    /* CANDADO: PIN del contador al ABRIR la sesión (firma de apertura).
       Igual que el PIN al cerrar — auditoría industrial: quien inicia debe
       firmar. Sin PIN no se puede crear la sesión. */
    const pin = await confirm(
      'Vas a iniciar una sesión de conteo. Esta acción es tu firma como contador — quedará registrado que TÚ abriste estos números. Ingresa tu PIN para confirmar.',
      {
        title: 'Firmar apertura de sesión',
        confirmText: 'Firmar y abrir sesión',
        danger: false,
        prompt: {
          label: 'Tu PIN',
          placeholder: '0000',
          required: true, minLength: 4, maxLength: 6,
          rows: 1, numeric: true, password: true,
        },
      }
    );
    if (!pin) return;
    setStarting(true);
    setErr('');
    try {
      await api.cycleCountIniciar(categoria, tipo, pin);
      setShowStart(false);
      cargar();
    } catch (e) {
      setErr(e?.data?.error || e.message || 'Error al iniciar');
    } finally {
      setStarting(false);
    }
  };

  const handleRegistrar = async (sesionId, itemKey, stockFisico) => {
    try {
      const r = await api.cycleCountRegistrar(sesionId, itemKey, stockFisico);
      setSesiones(prev => prev.map(s => {
        if (s.id !== sesionId) return s;
        const items = s.items.map(i => i.key === itemKey ? r.item : i);
        const contados = items.filter(i => i.stockFisico !== null && i.stockFisico !== undefined).length;
        const varianzas = items.filter(i => i.flagged).length;
        return { ...s, items, contados, varianzas };
      }));
    } catch (e) {
      setToast('Error: ' + e.message);
      setTimeout(() => setToast(''), 3000);
    }
  };

  const handleFinalizar = async (sesionId) => {
    /* CANDADO: PIN del contador como firma digital de cierre de sesión.
       Backend valida el PIN contra usuarios.json y guarda firmadoPor +
       fechaFirma en la sesión. Control estándar de auditoría industrial. */
    const pin = await confirm(
      'Vas a finalizar la sesión de conteo. Esta acción es tu firma como contador — quedará registrado que TÚ cerraste estos números. Ingresa tu PIN para confirmar.',
      {
        title: 'Firmar y finalizar sesión',
        confirmText: 'Firmar y finalizar',
        danger: false,
        prompt: {
          label: 'Tu PIN',
          placeholder: '0000',
          required: true, minLength: 4, maxLength: 6,
          rows: 1, numeric: true, password: true,
        },
      }
    );
    if (!pin) return;
    try {
      await api.cycleCountFinalizar(sesionId, pin);
      cargar();
    } catch (e) {
      setErr(e.message || 'Error al finalizar');
    }
  };

  const handleAgregarMP = async (nombre, stockFisico, unidad) => {
    if (!sesionActiva) throw new Error('Sin sesión activa');
    setAddingMP(true);
    try {
      const r = await api.cycleCountAgregarItem(sesionActiva.id, nombre, stockFisico, unidad);
      setSesiones(prev => prev.map(s => s.id === sesionActiva.id ? r.sesion : s));
      setShowAddMP(false);
    } catch (e) {
      throw e;
    } finally {
      setAddingMP(false);
    }
  };

  const handleAprobar = async (sesionId) => {
    const sesion = sesiones.find(s => s.id === sesionId);
    if (!sesion) return;
    const flagged = (sesion.items || []).filter(i => i.flagged && i.stockFisico != null);

    if (flagged.length === 0) {
      /* Sin varianzas — confirm simple */
      const ok = await confirm('¿Aprobar los ajustes de inventario? Esta acción aplica las diferencias al inventario y es irreversible.', { danger: true, confirmText: 'Aprobar' });
      if (!ok) return;
      try {
        await api.cycleCountAprobar(sesionId, {});
        cargar();
      } catch (e) {
        setErr(e?.data?.error || e.message || 'Error al aprobar');
      }
    } else {
      /* Hay varianzas — abrir modal de causas obligatorio */
      setSesionParaAprobar(sesion);
    }
  };

  const handleAprobarConCausas = async (causasPorItem) => {
    if (!sesionParaAprobar) return;
    setAprobandoConCausas(true);
    try {
      await api.cycleCountAprobar(sesionParaAprobar.id, causasPorItem);
      setSesionParaAprobar(null);
      cargar();
    } catch (e) {
      const msg = e?.data?.error || e.message || 'Error al aprobar';
      throw new Error(msg);
    } finally {
      setAprobandoConCausas(false);
    }
  };

  return (
    <div>
      <TopBar title="Conteo Físico" />
      <div style={S.wrap}>
        <PageTabs
          tabs={[
            { id: 'pendientes', label: 'Mis pendientes', style: (active) => ({
              padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--lp-font-sans)', marginBottom: -2, flexShrink: 0,
            }) },
            { id: 'actual', label: 'Mi conteo actual', style: (active) => ({
              padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--lp-font-sans)', marginBottom: -2, flexShrink: 0,
            }) },
            { id: 'historial', label: 'Historial', style: (active) => ({
              padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--lp-font-sans)', marginBottom: -2, flexShrink: 0,
            }) },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--lp-border-subtle)', marginBottom: 16, overflowX: 'auto' }}
        />

        {err && <div style={S.err}>{err}</div>}
        {toast && <div style={{ ...S.err, background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)' }}>{toast}</div>}

        {activeTab === 'pendientes' && <PendientesTab />}

        {activeTab === 'actual' && (
          <>
            {!sesionActiva && can('conteoFisico') && (
              <div style={{ marginBottom: 16 }}>
                <button style={S.btnPrimary} onClick={() => setShowStart(true)}>
                  + Iniciar nueva sesión de conteo
                </button>
              </div>
            )}

            {loading ? (
              <div style={S.loading}>Cargando...</div>
            ) : sesionActiva ? (
              <SesionActiva sesion={sesionActiva} onRegistrar={handleRegistrar}
                onFinalizar={handleFinalizar}
                onAgregarMP={() => setShowAddMP(true)} />
            ) : (
              <div style={S.empty}>
                Sin sesión activa.
                {can('conteoFisico') && ' Inicia una nueva con el botón de arriba.'}
              </div>
            )}
          </>
        )}

        {activeTab === 'historial' && (
          loading ? <div style={S.loading}>Cargando...</div> :
          historial.length === 0 ? (
            <div style={S.empty}>Sin historial de conteos</div>
          ) : (
            historial.map(s => (
              <HistorialCard key={s.id} sesion={s} onAprobar={handleAprobar}
                canAprobar={can('admin') || user?.rol === 'admin'} />
            ))
          )
        )}

        {showStart && <StartModal onStart={handleStart} onClose={() => setShowStart(false)} loading={starting} />}
        {showAddMP && <AddMPModal onAdd={handleAgregarMP} onClose={() => setShowAddMP(false)} loading={addingMP} />}
        {sesionParaAprobar && (
          <CausasRaizModal
            sesion={sesionParaAprobar}
            onAprobar={handleAprobarConCausas}
            onClose={() => setSesionParaAprobar(null)}
            loading={aprobandoConCausas}
          />
        )}
      </div>
      {ConfirmEl}
    </div>
  );
}
