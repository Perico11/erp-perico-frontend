/* ════════════════════════════════════════════════════════════════════════════
   CatalogoCompraTab — "Tienda" de compra dentro de Compras.
   Muestra TODAS las materias primas activas (no solo las urgentes) con su estado
   Crítico / Medio / OK (stock vs mínimo). Permite filtrar, ajustar cantidad por
   MP y agregarlas a un carrito → genera la(s) OC (una por proveedor) que caen en
   Compras ▸ Por aprobar. Reusa el endpoint forecast (todas las MP) + bulk-OC.
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { PRESENTACIONES } from './presentaciones';

const fmt$ = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const fmtN = (n, d = 0) => (n != null && !isNaN(n)) ? Number(n).toFixed(d) : '—';
const tint = c => `color-mix(in srgb, ${c} 14%, transparent)`;

const STATUS = {
  critico: { label: 'Crítico', c: 'var(--lp-danger-600)' },
  medio:   { label: 'Medio',   c: 'var(--lp-warning-600)' },
  ok:      { label: 'OK',      c: 'var(--lp-brand-600)' },
};
const FILTROS = [['todas', 'Todas'], ['critico', 'Crítico'], ['medio', 'Medio'], ['ok', 'OK']];

/* Estado por stock vs mínimo (3 niveles, como pidió el dueño). */
function statusOf(f) {
  const stock = Number(f.stockActual) || 0, min = Number(f.minActual) || 0;
  if (min <= 0) return stock <= 0 ? 'critico' : 'ok';
  const r = stock / min;
  if (stock <= 0 || r < 0.5) return 'critico';
  if (r < 1) return 'medio';
  return 'ok';
}
/* Cantidad sugerida inicial editable. Si el forecast sugiere algo, úsalo; si no
   (MP en OK), proponer reponer a ~2× mínimo o 1 mes de consumo (mín 10, redondeo 10). */
function defaultQty(f) {
  if (Number(f.cantidadSugerida) > 0) return Math.round(Number(f.cantidadSugerida));
  const min = Number(f.minActual) || 0, stock = Number(f.stockActual) || 0, dem = Number(f.demandaMensualProyectada) || 0;
  const q = Math.max(min * 2 - stock, dem, min, 10);
  return Math.max(10, Math.ceil(q / 10) * 10);
}

function Stepper({ value, onChange, accent }) {
  const btn = { width: 34, height: 38, flex: '0 0 auto', border: '1px solid var(--lp-border-default)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 'var(--lp-radius-md)', overflow: 'hidden', border: '1px solid var(--lp-border-default)' }}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 10))} style={{ ...btn, borderWidth: 0, borderRight: '1px solid var(--lp-border-subtle)' }} aria-label="menos">−</button>
      <input type="number" value={value} min="0" step="10" onChange={e => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        style={{ width: 64, border: 'none', textAlign: 'center', fontFamily: 'var(--lp-font-mono)', fontSize: 13.5, fontWeight: 600, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', outline: 'none', MozAppearance: 'textfield' }} />
      <button type="button" onClick={() => onChange(value + 10)} style={{ ...btn, borderWidth: 0, borderLeft: '1px solid var(--lp-border-subtle)', color: accent || 'var(--lp-brand-600)' }} aria-label="más">+</button>
    </div>
  );
}

/* ── Hoja de revisión del carrito → crear OC(s) ─────────────────────────── */
function CartSheet({ cart, getQty, setQty, getPres, setPres, removeMp, onClose, onConfirm, creating }) {
  const [notas, setNotas] = useState('');
  const porProv = useMemo(() => {
    const g = {};
    cart.forEach(f => { const p = f.proveedor || 'POR ASIGNAR'; (g[p] = g[p] || []).push(f); });
    return g;
  }, [cart]);
  const totalKg = cart.reduce((s, f) => s + getQty(f.mp), 0);
  const totalMonto = cart.reduce((s, f) => s + getQty(f.mp) * (Number(f.costoKg) || 0), 0);
  const nProv = Object.keys(porProv).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,21,.55)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--lp-bg-raised)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--lp-border-subtle)', borderBottom: 'none' }}>
        <div style={{ padding: '18px 20px 10px' }}>
          <div style={{ width: 38, height: 4, borderRadius: 99, background: 'var(--lp-border-strong)', margin: '0 auto 14px' }} />
          <div style={{ fontSize: 17, fontWeight: 700 }}>Tu orden de compra</div>
          <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)', marginTop: 3 }}>
            {cart.length} {cart.length === 1 ? 'materia' : 'materias'} · se {nProv === 1 ? 'creará 1 OC' : `crearán ${nProv} OC (una por proveedor)`}
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 20px', flex: 1 }}>
          {Object.entries(porProv).map(([prov, items]) => (
            <div key={prov} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '6px 0 6px' }}>{prov} · {items.length}</div>
              {items.map(f => (
                <div key={f.mp} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 0', borderBottom: '1px dashed var(--lp-border-subtle)', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.mp}</div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }}>{Number(f.costoKg) > 0 ? `${fmt$(getQty(f.mp) * f.costoKg)} · $${fmtN(f.costoKg, 2)}/kg` : 'sin costo'}</div>
                  </div>
                  <Stepper value={getQty(f.mp)} onChange={v => setQty(f.mp, v)} />
                  <select value={getPres(f.mp)} onChange={e => setPres(f.mp, e.target.value)} title="Presentación del envase"
                    style={{ flex: '0 0 auto', height: 38, maxWidth: 150, padding: '0 8px', borderRadius: 8, border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', fontSize: 12, fontFamily: 'var(--lp-font-sans)' }}>
                    {PRESENTACIONES.map(p => <option key={p.v} value={p.v}>{p.lbl}</option>)}
                  </select>
                  <button onClick={() => removeMp(f.mp)} title="Quitar" style={{ flex: '0 0 auto', width: 32, height: 32, borderRadius: 8, border: '1px solid color-mix(in srgb,var(--lp-danger-600) 30%,transparent)', background: 'transparent', color: 'var(--lp-danger-600)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          ))}
          <div style={{ margin: '10px 0 4px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 5 }}>Notas (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows="2" placeholder="Ej: compra preventiva de temporada alta…"
              style={{ width: '100%', padding: 10, border: '1px solid var(--lp-border-subtle)', borderRadius: 10, fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)' }} />
          </div>
        </div>
        <div style={{ padding: '12px 20px calc(16px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--lp-font-mono)' }}>{fmt$(totalMonto)}</div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }}>{fmtN(totalKg, 0)} kg · {nProv} {nProv === 1 ? 'OC' : 'OC'}</div>
          </div>
          <button onClick={onClose} style={{ height: 46, padding: '0 16px', borderRadius: 'var(--lp-radius-md)', border: '1px solid var(--lp-border-default)', background: 'transparent', color: 'var(--lp-text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>Seguir</button>
          <button onClick={() => onConfirm(notas)} disabled={creating || cart.length === 0}
            style={{ height: 46, padding: '0 22px', borderRadius: 'var(--lp-radius-md)', border: 'none', background: 'var(--lp-brand-600)', color: '#fff', cursor: creating ? 'default' : 'pointer', fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', opacity: creating ? .7 : 1 }}>
            {creating ? 'Creando…' : (nProv === 1 ? 'Crear OC' : `Crear ${nProv} OC`)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CatalogoCompraTab({ isDesktop = false, onCreated }) {
  const { user } = useAuth();
  const toast = useToast();
  const puedeCrear = ['admin', 'compras'].includes(user?.rol);

  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [sel, setSel] = useState({});   /* { mp: true } */
  const [qtys, setQtys] = useState({}); /* { mp: number } */
  const [pres, setPres] = useState({}); /* { mp: presentacion } */
  const [showCart, setShowCart] = useState(false);
  const [creating, setCreating] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true); setErr('');
    api.getForecastSugerencias({ soloSugeridas: '0' })
      .then(r => {
        const fs = (r.data && r.data.filas) || [];
        setFilas(fs);
        setQtys(prev => { const n = { ...prev }; fs.forEach(f => { if (n[f.mp] == null) n[f.mp] = defaultQty(f); }); return n; });
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const conStatus = useMemo(() => filas.map(f => ({ ...f, _st: statusOf(f) })), [filas]);
  const counts = useMemo(() => {
    const c = { todas: conStatus.length, critico: 0, medio: 0, ok: 0 };
    conStatus.forEach(f => { c[f._st]++; });
    return c;
  }, [conStatus]);

  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ord = { critico: 0, medio: 1, ok: 2 };
    return conStatus
      .filter(f => filtro === 'todas' || f._st === filtro)
      .filter(f => !q || f.mp.toLowerCase().includes(q) || (f.proveedor || '').toLowerCase().includes(q))
      .sort((a, b) => (ord[a._st] - ord[b._st]) || a.mp.localeCompare(b.mp));
  }, [conStatus, filtro, search]);

  const getQty = (mp) => Number(qtys[mp]) || 0;
  const setQty = (mp, v) => setQtys(s => ({ ...s, [mp]: Math.max(0, Math.round(Number(v) || 0)) }));
  const getPres = (mp) => pres[mp] || '';
  const setPresMp = (mp, v) => setPres(s => ({ ...s, [mp]: v }));
  const toggle = (mp) => setSel(s => ({ ...s, [mp]: !s[mp] }));
  const removeMp = (mp) => setSel(s => { const n = { ...s }; delete n[mp]; return n; });

  const cart = useMemo(() => conStatus.filter(f => sel[f.mp]), [conStatus, sel]);
  const totalKg = cart.reduce((s, f) => s + getQty(f.mp), 0);
  const totalMonto = cart.reduce((s, f) => s + getQty(f.mp) * (Number(f.costoKg) || 0), 0);
  const provCount = new Set(cart.map(f => f.proveedor || 'POR ASIGNAR')).size;

  const addAllVisibles = () => setSel(s => { const n = { ...s }; visibles.forEach(f => { n[f.mp] = true; }); return n; });

  const handleCrear = async (notas) => {
    setCreating(true);
    try {
      const items = cart.map(f => ({ mp: f.mp, cantidad: getQty(f.mp), proveedor: f.proveedor, presentacion: getPres(f.mp) })).filter(i => i.cantidad > 0);
      if (!items.length) { toast.error('Agrega cantidades válidas'); setCreating(false); return; }
      const r = await api.generarOCsBulkForecast(items, notas || 'Generada desde Catálogo de compra');
      toast.success(`✓ ${r.total} OC(s) creada(s) → Compras · Por aprobar`, { duration: 5000 });
      setSel({}); setShowCart(false);
      if (onCreated) onCreated();
    } catch (e) {
      toast.error('Error al crear OC: ' + (e?.data?.error || e.message));
    } finally { setCreating(false); }
  };

  if (err) return <div style={{ background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 12, borderRadius: 8, fontSize: 13 }}>{err}</div>;

  const inputBase = { height: 42, padding: '0 14px', borderRadius: 'var(--lp-radius-md)', background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', outline: 'none', fontFamily: 'var(--lp-font-sans)', fontSize: 14, color: 'var(--lp-text-primary)', boxSizing: 'border-box' };

  return (
    <div style={{ paddingBottom: cart.length > 0 ? 96 : 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '2px 0 4px' }}>Catálogo de compra</div>
      <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)', marginBottom: 12 }}>Arma tu orden: agrega las materias primas que quieras —urgentes o no— y genera la(s) OC.</div>

      {/* Filtros + buscador */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTROS.map(([k, l]) => {
            const active = filtro === k;
            const c = k === 'todas' ? 'var(--lp-text-primary)' : STATUS[k].c;
            return (
              <button key={k} onClick={() => setFiltro(k)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: active ? 700 : 500,
                border: active ? `1.5px solid ${c}` : '1px solid var(--lp-border-subtle)',
                background: active ? tint(c) : 'var(--lp-bg-raised)', color: active ? c : 'var(--lp-text-secondary)',
              }}>
                {k !== 'todas' && <span style={{ width: 7, height: 7, borderRadius: 999, background: STATUS[k].c }} />}
                {l} · {counts[k] || 0}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <input style={{ ...inputBase, maxWidth: isDesktop ? 300 : '100%', width: isDesktop ? undefined : '100%' }} placeholder="Buscar materia prima o proveedor…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {puedeCrear && visibles.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={addAllVisibles} style={{ height: 36, padding: '0 14px', borderRadius: 'var(--lp-radius-md)', border: '1px solid var(--lp-border-default)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 12.5 }}>
            + Agregar todas las visibles ({visibles.length})
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 36, color: 'var(--lp-text-tertiary)', fontSize: 13 }}>Cargando catálogo…</div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 44, color: 'var(--lp-text-tertiary)', fontSize: 13 }}>Sin materias primas para este filtro.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fill,minmax(330px,1fr))' : '1fr', gap: 12, alignItems: 'start' }}>
          {visibles.map(f => {
            const st = STATUS[f._st];
            const enOrden = !!sel[f.mp];
            const sinStock = (Number(f.stockActual) || 0) <= 0;
            return (
              <div key={f.mp} data-id="catalogo.card.mp" style={{ position: 'relative', overflow: 'hidden', background: 'var(--lp-bg-raised)', border: enOrden ? '1.5px solid var(--lp-brand-600)' : '1px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-lg)', padding: '14px 15px' }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: st.c }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em' }}>{f.mp}</div>
                    <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.proveedor || 'Sin proveedor'}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', background: tint(st.c), color: st.c }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: st.c }} />{st.label}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 20, margin: '12px 0 14px' }}>
                  {[
                    { v: `${fmtN(f.stockActual, 0)} kg`, l: 'Stock', danger: sinStock },
                    { v: `${fmtN(f.minActual, 0)} kg`, l: 'Mínimo' },
                    { v: Number(f.costoKg) > 0 ? `$${fmtN(f.costoKg, 2)}` : '—', l: 'Precio/kg' },
                  ].map((s, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: s.danger ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)' }}>{s.v}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', marginTop: 2 }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {puedeCrear && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Stepper value={getQty(f.mp)} onChange={v => setQty(f.mp, v)} accent={st.c} />
                    <button onClick={() => toggle(f.mp)} style={{
                      flex: 1, minHeight: 42, borderRadius: 'var(--lp-radius-md)', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 13.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      border: enOrden ? '1.5px solid var(--lp-brand-600)' : 'none',
                      background: enOrden ? 'color-mix(in srgb, var(--lp-brand-600) 12%, transparent)' : 'var(--lp-brand-600)',
                      color: enOrden ? 'var(--lp-brand-700)' : '#fff',
                    }}>
                      {enOrden ? (
                        <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> En la orden</>
                      ) : (
                        <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg> Agregar</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Carrito flotante */}
      {puedeCrear && cart.length > 0 && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: 45, bottom: isDesktop ? 22 : 'calc(74px + env(safe-area-inset-bottom,0px))', width: 'auto', maxWidth: 'calc(100vw - 24px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', boxShadow: '0 12px 34px rgba(0,0,0,.20)', borderRadius: 999, padding: '8px 8px 8px 16px' }}>
            <span style={{ width: 30, height: 30, flex: '0 0 auto', borderRadius: 999, background: 'var(--lp-brand-600)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 13 }}>{cart.length}</span>
            <div style={{ lineHeight: 1.25, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>en la orden</div>
              <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtN(totalKg, 0)} kg · {fmt$(totalMonto)} · {provCount} {provCount === 1 ? 'OC' : 'OC'}</div>
            </div>
            <button onClick={() => setSel({})} title="Vaciar" style={{ flex: '0 0 auto', height: 40, padding: '0 12px', borderRadius: 'var(--lp-radius-md)', border: '1px solid var(--lp-border-default)', background: 'transparent', color: 'var(--lp-text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 12.5 }}>Vaciar</button>
            <button onClick={() => setShowCart(true)} style={{ flex: '0 0 auto', height: 40, padding: '0 18px', borderRadius: 'var(--lp-radius-md)', border: 'none', background: 'var(--lp-brand-600)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap' }}>Ver orden</button>
          </div>
        </div>
      )}

      {showCart && (
        <CartSheet cart={cart} getQty={getQty} setQty={setQty} getPres={getPres} setPres={setPresMp} removeMp={removeMp}
          onClose={() => setShowCart(false)} onConfirm={handleCrear} creating={creating} />
      )}
    </div>
  );
}
