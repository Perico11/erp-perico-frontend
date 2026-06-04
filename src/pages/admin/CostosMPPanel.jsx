import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import SegmentedControl from '../../components/ui/SegmentedControl';

const S = {
  card: {
    background: 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)',
    padding: 16,
    fontFamily: 'var(--lp-font-sans)',
  },
  metric: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: (color) => ({
    background: 'var(--lp-bg-sunken)',
    borderRadius: 'var(--lp-radius-sm)',
    padding: 14, textAlign: 'center',
    borderTop: `3px solid ${color || 'var(--lp-brand-600)'}`,
  }),
  metricVal: { fontSize: 22, fontWeight: 800, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  metricLabel: { fontSize: 11, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, fontWeight: 700 },
  toolbar: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 220,
    padding: '9px 12px',
    fontSize: 13,
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    background: 'var(--lp-bg-base)',
    fontFamily: 'inherit', color: 'var(--lp-text-primary)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '.06em',
    padding: '8px 10px', textAlign: 'left',
    borderBottom: '1.5px solid var(--lp-border-subtle)',
  },
  thR: { textAlign: 'right' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--lp-border-subtle)' },
  tdR: { padding: '8px 10px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' },
  badge: (bg, fg) => ({
    display: 'inline-block', padding: '1px 7px', fontSize: 10, fontWeight: 700,
    background: bg, color: fg, borderRadius: 4, marginLeft: 6,
    textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  input: (warn) => ({
    width: 90, padding: '6px 8px', fontSize: 12,
    border: `1.5px solid ${warn ? 'var(--lp-danger-300)' : 'var(--lp-border-subtle)'}`,
    borderRadius: 6, background: 'var(--lp-bg-base)', textAlign: 'right',
    fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)',
  }),
  saveBtn: (state) => ({
    padding: '5px 10px', fontSize: 11, fontWeight: 700,
    border: 'none', borderRadius: 5, cursor: state === 'saved' ? 'default' : 'pointer',
    background: state === 'saving' ? 'var(--lp-bg-sunken)' :
                state === 'saved'  ? 'var(--lp-success-100)' :
                state === 'err'    ? 'var(--lp-danger-100)' :
                'var(--lp-brand-600)',
    color: state === 'saving' ? 'var(--lp-text-secondary)' :
           state === 'saved'  ? 'var(--lp-success-700)' :
           state === 'err'    ? 'var(--lp-danger-700)' : '#fff',
    minWidth: 60,
  }),
  loading: { textAlign: 'center', padding: 32, color: 'var(--lp-text-tertiary)' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 'var(--lp-radius-sm)', fontSize: 12 },
};

const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CostosMPPanel() {
  const [maestro, setMaestro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todas'); /* todas / sin-costo / activas / con-formulas */
  const [edits, setEdits] = useState({}); /* { nombre: { precio, flete, moneda, savingState } } */

  const cargar = () => {
    setLoading(true);
    api.getMaestroMP()
      .then(r => setMaestro(r.data || r))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(cargar, []);

  const items = useMemo(() => {
    if (!maestro?.mps) return [];
    const arr = Object.entries(maestro.mps).map(([nombre, m]) => ({
      nombre,
      ...m,
      enFormulas: (m.en_formulas || []).length,
      costoKg: m.costo?.costoKg ?? 0,
      costoBase: m.costo?.costoBase ?? 0,
      flete: m.costo?.flete ?? 0,
      moneda: m.costo?.monedaOriginal || 'MXN',
      sinCosto: !(m.costo?.costoKg) || m.costo.costoKg === 0,
    }));
    return arr;
  }, [maestro]);

  const filtered = useMemo(() => {
    return items
      .filter(it => it.estado !== 'eliminado')
      .filter(it => {
        if (filter === 'sin-costo') return it.sinCosto;
        if (filter === 'activas') return it.estado === 'activo';
        if (filter === 'con-formulas') return it.enFormulas > 0;
        return true;
      })
      .filter(it => !search || it.nombre.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        /* Prioriza sin costo + más formulas */
        if (a.sinCosto !== b.sinCosto) return a.sinCosto ? -1 : 1;
        if (a.enFormulas !== b.enFormulas) return b.enFormulas - a.enFormulas;
        return a.nombre.localeCompare(b.nombre);
      });
  }, [items, filter, search]);

  const totals = useMemo(() => {
    const activas = items.filter(i => i.estado === 'activo');
    return {
      total: items.length,
      activas: activas.length,
      sinCosto: activas.filter(i => i.sinCosto).length,
      ocultas: items.filter(i => i.estado === 'oculto').length,
    };
  }, [items]);

  /* Guardar costo de una MP — usa /api/maestro-mp con campo costo */
  const guardar = async (it) => {
    const e = edits[it.nombre] || {};
    const precio = parseFloat(e.precio ?? it.costoBase);
    const fleteV = parseFloat(e.flete ?? it.flete);
    if (isNaN(precio) || precio < 0) return;
    setEdits(p => ({ ...p, [it.nombre]: { ...e, savingState: 'saving' } }));
    try {
      const body = {
        mp: it.nombre,
        campo: 'costo',
        valor: {
          costoBase: precio,
          flete: isNaN(fleteV) ? (it.flete || 0) : fleteV,
          costoKg: precio + (isNaN(fleteV) ? (it.flete || 0) : fleteV),
          monedaOriginal: e.moneda || it.moneda,
          ultimaActualizacion: new Date().toISOString().slice(0, 10),
        },
      };
      const r = await api.post('/api/maestro-mp', body);
      if (r?.ok === false) throw new Error(r.error || 'Error al guardar');
      setEdits(p => ({ ...p, [it.nombre]: { ...e, savingState: 'saved' } }));
      /* Refrescar después de 600ms */
      setTimeout(() => {
        setEdits(p => {
          const np = { ...p };
          delete np[it.nombre];
          return np;
        });
        cargar();
      }, 600);
    } catch (ex) {
      setEdits(p => ({ ...p, [it.nombre]: { ...e, savingState: 'err' } }));
    }
  };

  if (loading) return <div style={S.loading}>Cargando costos…</div>;
  if (err) return <div style={S.err}>{err}</div>;

  return (
    <div style={S.card}>
      <div style={S.metric}>
        <div style={S.metricCard('var(--lp-brand-600)')}>
          <div style={S.metricVal}>{totals.activas}</div>
          <div style={S.metricLabel}>MPs activas</div>
        </div>
        <div style={S.metricCard('var(--lp-danger-600)')}>
          <div style={{ ...S.metricVal, color: totals.sinCosto > 0 ? 'var(--lp-danger-600)' : 'inherit' }}>{totals.sinCosto}</div>
          <div style={S.metricLabel}>Sin costo cargado</div>
        </div>
        <div style={S.metricCard('var(--lp-warning-600)')}>
          <div style={S.metricVal}>{totals.ocultas}</div>
          <div style={S.metricLabel}>Ocultas</div>
        </div>
        <div style={S.metricCard('var(--lp-text-tertiary)')}>
          <div style={S.metricVal}>{totals.total}</div>
          <div style={S.metricLabel}>Total maestro</div>
        </div>
      </div>

      <div style={S.toolbar}>
        <input
          style={S.search}
          placeholder="Buscar MP por nombre…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          color="brand"
          options={[
            { value: 'sin-costo', label: 'Sin costo' },
            { value: 'activas', label: 'Activas' },
            { value: 'con-formulas', label: 'En fórmulas' },
            { value: 'todas', label: 'Todas' },
          ]}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Materia prima</th>
              <th style={{ ...S.th, ...S.thR }}>Stock</th>
              <th style={{ ...S.th, ...S.thR }}>En fórmulas</th>
              <th style={{ ...S.th, ...S.thR }}>Precio base</th>
              <th style={{ ...S.th, ...S.thR }}>Flete</th>
              <th style={{ ...S.th, ...S.thR }}>Total /kg</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(it => {
              const e = edits[it.nombre] || {};
              const precioVal = e.precio !== undefined ? e.precio : (it.costoBase || '');
              const fleteVal = e.flete !== undefined ? e.flete : (it.flete || '');
              const dirty = e.precio !== undefined || e.flete !== undefined;
              const totalKg = (parseFloat(precioVal) || 0) + (parseFloat(fleteVal) || 0);
              return (
                <tr key={it.nombre}>
                  <td style={S.td}>
                    <strong>{it.nombre}</strong>
                    {it.sinCosto && <span style={S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)')}>Sin costo</span>}
                    {it.estado === 'oculto' && <span style={S.badge('var(--lp-warning-100)', 'var(--lp-warning-700)')}>Oculto</span>}
                    <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                      {it.categoria || 'Sin categoría'}
                      {it.proveedor?.principal && ` · ${it.proveedor.principal}`}
                    </div>
                  </td>
                  <td style={S.tdR}>{(it.stock?.qty ?? 0).toLocaleString()}</td>
                  <td style={S.tdR}>{it.enFormulas}</td>
                  <td style={S.tdR}>
                    <input
                      type="number" step="0.01" min="0"
                      style={S.input(it.sinCosto && !dirty)}
                      value={precioVal}
                      placeholder="0.00"
                      onChange={ev => setEdits(p => ({ ...p, [it.nombre]: { ...e, precio: ev.target.value } }))}
                      onKeyDown={ev => { if (ev.key === 'Enter') guardar(it); }}
                    />
                  </td>
                  <td style={S.tdR}>
                    <input
                      type="number" step="0.01" min="0"
                      style={S.input(false)}
                      value={fleteVal}
                      placeholder="0.00"
                      onChange={ev => setEdits(p => ({ ...p, [it.nombre]: { ...e, flete: ev.target.value } }))}
                      onKeyDown={ev => { if (ev.key === 'Enter') guardar(it); }}
                    />
                  </td>
                  <td style={S.tdR}>${fmt(totalKg)}</td>
                  <td style={S.td}>
                    {dirty ? (
                      <button style={S.saveBtn(e.savingState)} onClick={() => guardar(it)}>
                        {e.savingState === 'saving' ? '…' : e.savingState === 'saved' ? '✓' : e.savingState === 'err' ? 'err' : 'Guardar'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: 32 }}>
                Sin resultados con esos filtros.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
