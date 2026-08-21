/* ════════════════════════════════════════════════════════════════════════════
   CatalogoCompraTab — Catálogo de materias primas dentro de Compras.
   Muestra TODAS las MPs activas con su estado Crítico / Medio / OK (stock vs
   mínimo), proveedor y precio base/kg editable inline (admin/compras).

   P1 auditoría 20-jul-2026: el CARRITO "genera OCs" se retiró — duplicaba
   endpoint por endpoint a Pronóstico ▸ Sugerencias (mismo getForecastSugerencias
   + mismo generar-oc-bulk) y era la 5.ª puerta de "crear OC". Las OCs se
   generan en Pronóstico (Sugerencias / MRP) o con "Nueva OC" manual. Este tab
   queda como CONSULTA + mantenimiento de precios del catálogo.
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

const fmtN = (n, d = 0) => (n != null && !isNaN(n)) ? Number(n).toFixed(d) : '—';
const tint = c => `color-mix(in srgb, ${c} 14%, transparent)`;

/* Celda "Precio base/kg" editable inline (admin/compras). Click → input →
   guarda vía /api/mp/precio-base → propaga a costos de fórmulas y PT. El flete
   ($5/kg) NO está aquí: vive como línea "Envío" en el costo de PT. */
function PrecioBaseCell({ f, canEdit, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const base = Number(f.costoBase) || 0;

  const start = () => { if (!canEdit || saving) return; setVal(base ? String(base) : ''); setEditing(true); };
  const save = async () => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0 || n === base) { setEditing(false); return; }
    setSaving(true);
    try { await api.setPrecioBaseMP(f.mp, n); onSaved && onSaved(); }
    catch (e) { alert('No se pudo guardar el precio: ' + (e?.data?.error || e.message || 'error')); }
    finally { setSaving(false); setEditing(false); }
  };

  return (
    <div>
      {editing ? (
        <input
          autoFocus type="number" step="0.01" min="0" inputMode="decimal"
          value={val} disabled={saving}
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') setEditing(false); }}
          style={{ width: 86, fontSize: 14, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', padding: '2px 6px', border: '1.5px solid var(--lp-brand-600)', borderRadius: 6, outline: 'none' }}
        />
      ) : (
        <div
          onClick={start}
          title={canEdit ? 'Click para editar el precio base' : undefined}
          style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', cursor: canEdit ? 'pointer' : 'default', borderBottom: canEdit ? '1px dashed color-mix(in srgb, var(--lp-brand-600) 50%, transparent)' : 'none', display: 'inline-block', lineHeight: 1.3 }}
        >
          {base > 0 ? `$${fmtN(base, 2)}` : '—'}
        </div>
      )}
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
        Precio base/kg{canEdit ? ' ✎' : ''}
      </div>
    </div>
  );
}

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

export default function CatalogoCompraTab({ isDesktop = false, onIrAPronostico }) {
  const { user } = useAuth();
  const puedeEditar = ['admin', 'compras'].includes(user?.rol);

  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todas');

  const cargar = useCallback(() => {
    setLoading(true); setErr('');
    api.getForecastSugerencias({ soloSugeridas: '0' })
      .then(r => setFilas((r.data && r.data.filas) || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  /* Realtime (T3 jul 2026): canal 'costos' (admin+compras) — otro usuario
     edita precio base/kg y este catálogo refresca el costo al instante. */
  useRealtimeSync({ onCostos: () => cargar() });

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

  if (err) return <div style={{ background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 12, borderRadius: 8, fontSize: 13 }}>{err}</div>;

  const inputBase = { height: 42, padding: '0 14px', borderRadius: 'var(--lp-radius-md)', background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', outline: 'none', fontFamily: 'var(--lp-font-sans)', fontSize: 14, color: 'var(--lp-text-primary)', boxSizing: 'border-box' };

  return (
    <div style={{ paddingBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '2px 0 4px' }}>Catálogo de materias primas</div>
      <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)', marginBottom: 12 }}>
        Consulta stock, estado y precio base/kg de todas las MPs.{' '}
        Para comprar: genera las OCs en <strong>Pronóstico ▸ Sugerencias</strong> (o con "Nueva OC").
        {onIrAPronostico && (
          <button onClick={onIrAPronostico} style={{ marginLeft: 8, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--lp-brand-600)', background: 'transparent', color: 'var(--lp-brand-700)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Ir a Pronóstico →
          </button>
        )}
      </div>

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

      {loading ? (
        <div style={{ textAlign: 'center', padding: 36, color: 'var(--lp-text-tertiary)', fontSize: 13 }}>Cargando catálogo…</div>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 44, color: 'var(--lp-text-tertiary)', fontSize: 13 }}>Sin materias primas para este filtro.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fill,minmax(330px,1fr))' : '1fr', gap: 12, alignItems: 'start' }}>
          {visibles.map(f => {
            const st = STATUS[f._st];
            const sinStock = (Number(f.stockActual) || 0) <= 0;
            return (
              <div key={f.mp} data-id="catalogo.card.mp" style={{ position: 'relative', overflow: 'hidden', background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-lg)', padding: '14px 15px' }}>
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

                <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                  {[
                    { v: `${fmtN(f.stockActual, 0)} kg`, l: 'Stock', danger: sinStock },
                    { v: `${fmtN(f.minActual, 0)} kg`, l: 'Mínimo' },
                  ].map((s, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: s.danger ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)' }}>{s.v}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', marginTop: 2 }}>{s.l}</div>
                    </div>
                  ))}
                  <PrecioBaseCell f={f} canEdit={puedeEditar} onSaved={cargar} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
