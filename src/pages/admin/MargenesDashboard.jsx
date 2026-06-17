import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import HelpHint from '../../components/HelpHint';
import SegmentedControl from '../../components/ui/SegmentedControl';

const S = {
  panel: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    padding: 16,
  },
  metric: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: (accent) => ({
    background: 'var(--lp-bg-sunken)',
    borderRadius: 'var(--lp-radius-sm)',
    padding: 14,
    textAlign: 'center',
    borderTop: accent ? `3px solid ${accent}` : 'none',
  }),
  metricVal: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--lp-text-primary)',
    fontFamily: 'var(--lp-font-mono)',
  },
  metricLabel: {
    fontSize: 11,
    color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    marginTop: 4,
    fontWeight: 600,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  search: {
    flex: 1,
    minWidth: 200,
    padding: '10px 14px',
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 13,
    fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)',
    color: 'var(--lp-text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontWeight: 700,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    color: 'var(--lp-text-secondary)',
    borderBottom: '1.5px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-sunken)',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '0.5px solid var(--lp-border-subtle)',
    fontFamily: 'var(--lp-font-mono)',
  },
  tdName: {
    padding: '10px 12px',
    borderBottom: '0.5px solid var(--lp-border-subtle)',
    fontWeight: 600,
    fontFamily: 'var(--lp-font-sans)',
  },
  inputPrecio: {
    width: 90,
    padding: '6px 8px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12,
    fontFamily: 'var(--lp-font-mono)',
    textAlign: 'right',
    background: 'var(--lp-bg-raised)',
    boxSizing: 'border-box',
  },
  badge: (bg, fg) => ({
    display: 'inline-flex',
    padding: '2px 8px',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 4,
    background: bg,
    color: fg,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    fontFamily: 'var(--lp-font-sans)',
  }),
  loading: {
    textAlign: 'center',
    padding: '32px 0',
    fontSize: 13,
    color: 'var(--lp-text-tertiary)',
  },
  err: {
    background: 'var(--lp-danger-100)',
    color: 'var(--lp-danger-700)',
    padding: 10,
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12,
    marginBottom: 12,
  },
  hint: {
    fontSize: 11,
    color: 'var(--lp-text-tertiary)',
    marginTop: 14,
    lineHeight: 1.6,
    padding: '10px 12px',
    background: 'var(--lp-info-50)',
    borderRadius: 'var(--lp-radius-sm)',
  },
};

const fmt$ = (n) => {
  if (n == null || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const margenColor = (pct, abs) => {
  if (pct == null) return 'var(--lp-text-tertiary)';
  if (abs < 0) return 'var(--lp-danger-600)';
  if (pct < 15) return 'var(--lp-warning-600)';
  if (pct < 30) return 'var(--lp-text-primary)';
  return 'var(--lp-success-600)';
};

const margenBg = (pct, abs) => {
  if (pct == null) return 'var(--lp-bg-sunken)';
  if (abs < 0) return 'var(--lp-danger-50)';
  if (pct < 15) return 'var(--lp-warning-50)';
  if (pct < 30) return 'var(--lp-bg-sunken)';
  return 'var(--lp-success-50)';
};

function PrecioInput({ valor, onSave, canEdit }) {
  const [v, setV] = useState(String(valor || ''));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setV(String(valor || '')); }, [valor]);
  const guardar = async () => {
    const num = parseFloat(v);
    if (isNaN(num) || num < 0) return;
    if (num === valor) return;
    setSaving(true);
    try { await onSave(num); } finally { setSaving(false); }
  };
  if (!canEdit) {
    return (
      <span style={{ fontFamily: 'var(--lp-font-mono)', color: valor > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>
        {valor > 0 ? fmt$(valor) : '—'}
      </span>
    );
  }
  return (
    <input
      style={S.inputPrecio}
      type="number"
      min="0"
      step="0.01"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
      placeholder="—"
      disabled={saving}
    />
  );
}

/* Breakdown expandible — muestra paso a paso de dónde sale cada peso */
function BreakdownRow({ producto: p }) {
  const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ss = {
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 },
    section: { background: 'var(--lp-bg-raised)', padding: 12, borderRadius: 8, border: '1px solid var(--lp-border-subtle)' },
    title: { fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 },
    row: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: 'var(--lp-text-primary)' },
    rowSub: { display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 11, color: 'var(--lp-text-secondary)' },
    total: { display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)', borderTop: '1.5px solid var(--lp-border-subtle)', marginTop: 6 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
    td: { padding: '3px 6px', borderBottom: '1px solid var(--lp-border-subtle)' },
    tdR: { padding: '3px 6px', textAlign: 'right', borderBottom: '1px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-mono)' },
    swatch: (color) => ({ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, border: '1px solid rgba(0,0,0,.15)', marginRight: 5, verticalAlign: 'middle' }),
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--lp-text-primary)' }}>
        Desglose de costo: {p.nombre}
      </div>

      <div style={ss.grid}>
        {/* === Costo MP detallado === */}
        <div style={ss.section}>
          <div style={ss.title}>1. Costo MP por cubeta (kg × $/kg)</div>
          <table style={ss.table}>
            <tbody>
              {(p.desgloseMP || []).slice(0, 12).map((d, i) => (
                <tr key={i}>
                  <td style={ss.td}>
                    {d.mp}
                    {d.sinCosto && <span style={{ color: 'var(--lp-danger-600)', marginLeft: 4, fontSize: 11 }}>(sin costo)</span>}
                  </td>
                  <td style={ss.tdR}>{d.kg.toFixed(3)} kg</td>
                  <td style={ss.tdR}>× ${d.costoKg.toFixed(2)}</td>
                  <td style={{ ...ss.tdR, fontWeight: 700 }}>{fmt(d.subtotal)}</td>
                </tr>
              ))}
              {(p.desgloseMP || []).length > 12 && (
                <tr><td colSpan={4} style={{ ...ss.td, color: 'var(--lp-text-tertiary)', fontStyle: 'italic' }}>
                  + {p.desgloseMP.length - 12} ingredientes más…
                </td></tr>
              )}
            </tbody>
          </table>
          <div style={ss.total}>
            <span>Σ Costo MP</span>
            <span>{fmt(p.costoMP)}</span>
          </div>
        </div>

        {/* === Auxiliares === */}
        <div style={ss.section}>
          <div style={ss.title}>2. Costos auxiliares (cubeta 19L)</div>
          <div style={ss.row}>
            <span>Envío {`($5/kg · ${p.kgEnvio || 0} kg sin agua)`}</span>
            <span>{fmt(p.costoEnvio || 0)}</span>
          </div>
          <div style={ss.row}>
            <span>Envase {p.marca && p.marca !== 'DEFAULT' ? `(${p.marca})` : ''}</span>
            <span>{fmt(p.costoEnvase)}</span>
          </div>
          <div style={ss.row}>
            <span>
              Tapa
              {p.tapa?.color && <span style={ss.swatch(p.tapa.color)}></span>}
              {p.tapa?.label && <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}> {p.tapa.label}</span>}
            </span>
            <span>{fmt(p.costoTapa || 0)}</span>
          </div>
          <div style={ss.row}>
            <span>Mano de obra</span>
            <span>{fmt(p.costoManoObra)}</span>
          </div>
          <div style={ss.row}>
            <span>Merma (1.5% sobre MP)</span>
            <span>{fmt(p.costoMerma)}</span>
          </div>
          <div style={ss.total}>
            <span>Σ Auxiliares</span>
            <span>{fmt((p.costoEnvio || 0) + (p.costoEnvase || 0) + (p.costoTapa || 0) + (p.costoManoObra || 0) + (p.costoMerma || 0))}</span>
          </div>
        </div>

        {/* === Total + presentaciones === */}
        <div style={ss.section}>
          <div style={ss.title}>3. Total por presentación</div>
          {p.porPresentacion && Object.entries(p.porPresentacion).map(([key, pr]) => (
            <div key={key} style={ss.row}>
              <span>{pr.label}</span>
              <span style={{ fontWeight: 700 }}>{fmt(pr.costoTotal)}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: 8, background: 'var(--lp-bg-sunken)', borderRadius: 6 }}>
            <div style={ss.rowSub}><span>Precio venta cubeta</span><span>{fmt(p.precioVenta)}</span></div>
            {p.precioGalon > 0 && <div style={ss.rowSub}><span>Precio galón</span><span>{fmt(p.precioGalon)}</span></div>}
            {p.precioLitro > 0 && <div style={ss.rowSub}><span>Precio litro</span><span>{fmt(p.precioLitro)}</span></div>}
            <div style={{ ...ss.total, color: p.margenAbs >= 0 ? 'var(--lp-success-700)' : 'var(--lp-danger-700)', borderTopColor: 'var(--lp-border-strong)' }}>
              <span>Margen / cubeta</span>
              <span>{fmt(p.margenAbs)} {p.margenPct != null && `(${p.margenPct}%)`}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
        Para editar costos auxiliares (envases por marca, tapas, MO), ve a <strong>Admin → Costos Auxiliares</strong>.
        Para editar costos MP, ve a <strong>Admin → Costos MP</strong>.
      </div>
    </div>
  );
}

export default function MargenesDashboard() {
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('con_precio');
  const [sortBy, setSortBy] = useState('margenMensual');
  const [expandedRow, setExpandedRow] = useState(null);
  const [presentacion, setPresentacion] = useState('cubeta'); /* cubeta | galon | litro | tote */
  const [tier, setTier] = useState('menudeo'); /* menudeo | mayoreo */

  const canEditPrecios = can('editarPrecios') || can('configuracion');

  const cargar = useCallback(() => {
    setLoading(true);
    api.getMargenes()
      .then(r => setData(r))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleSavePrecio = useCallback(async (formula, nuevoPrecio) => {
    try {
      await api.setPrecioVenta(formula, nuevoPrecio, null, null);
      cargar();
    } catch (e) {
      setErr(e.message);
    }
  }, [cargar]);

  /* Versión flexible: guarda cualquier campo {precioCubeta, precioTote, precioCubetaMayoreo,...} */
  const handleSavePrecioField = useCallback(async (formula, field, valor) => {
    try {
      await api.setPrecios(formula, { [field]: valor });
      cargar();
    } catch (e) {
      setErr(e.message);
    }
  }, [cargar]);

  /* Mapea (presentación, tier) → nombre del campo en el producto y precio guardado */
  const getActiveFields = (p, pres, t) => {
    const cap = pres.charAt(0).toUpperCase() + pres.slice(1);
    /* Para mayoreo cubeta usamos abreviado: precioCubetaMayoreo, margenAbsCubMay */
    const sufMay = t === 'mayoreo';
    /* Mapping limpio */
    const presetCosto = p?.porPresentacion?.[pres]?.costoTotal || 0;
    let precioField, precioVal, margenAbsVal, margenPctVal;
    if (!sufMay) {
      const map = {
        cubeta: ['precioCubeta', 'precioVenta', 'margenAbs', 'margenPct'],
        galon:  ['precioGalon', 'precioGalon', 'margenAbsGalon', 'margenPctGalon'],
        litro:  ['precioLitro', 'precioLitro', 'margenAbsLitro', 'margenPctLitro'],
        tote:   ['precioTote', 'precioTote', 'margenAbsTote', 'margenPctTote'],
      };
      const m = map[pres] || map.cubeta;
      precioField = m[0];
      precioVal = p?.[m[1]] || 0;
      margenAbsVal = p?.[m[2]] || 0;
      margenPctVal = p?.[m[3]];
    } else {
      const map = {
        cubeta: ['precioCubetaMayoreo', 'precioCubetaMayoreo', 'margenAbsCubMay', 'margenPctCubMay'],
        galon:  ['precioGalonMayoreo', 'precioGalonMayoreo', 'margenAbsGalMay', 'margenPctGalMay'],
        litro:  ['precioLitroMayoreo', 'precioLitroMayoreo', 'margenAbsLitMay', 'margenPctLitMay'],
        tote:   ['precioToteMayoreo', 'precioToteMayoreo', 'margenAbsToteMay', 'margenPctToteMay'],
      };
      const m = map[pres] || map.cubeta;
      precioField = m[0];
      precioVal = p?.[m[1]] || 0;
      margenAbsVal = p?.[m[2]] || 0;
      margenPctVal = p?.[m[3]];
    }
    return { precioField, precioVal, margenAbsVal, margenPctVal, costoTotal: presetCosto };
  };

  const productos = useMemo(() => {
    if (!data?.productos) return [];
    let arr = [...data.productos];
    /* Filtros aplicados sobre el precio + margen del tier+presentación activos */
    const getF = (p) => getActiveFields(p, presentacion, tier);
    if (filter === 'rentables') arr = arr.filter(p => { const f = getF(p); return f.precioVal > 0 && f.margenPctVal >= 30; });
    else if (filter === 'medio') arr = arr.filter(p => { const f = getF(p); return f.precioVal > 0 && f.margenPctVal >= 15 && f.margenPctVal < 30; });
    else if (filter === 'bajos') arr = arr.filter(p => { const f = getF(p); return f.precioVal > 0 && f.margenPctVal < 15 && f.margenAbsVal >= 0; });
    else if (filter === 'no_rentables') arr = arr.filter(p => { const f = getF(p); return f.precioVal > 0 && f.margenAbsVal < 0; });
    else if (filter === 'sin_precio') arr = arr.filter(p => { const f = getF(p); return f.precioVal === 0 && !p.descontinuada; });
    else if (filter === 'con_precio') arr = arr.filter(p => getF(p).precioVal > 0);
    else if (filter === 'activos') arr = arr.filter(p => !p.descontinuada);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(p => p.nombre.toLowerCase().includes(q));
    }
    if (sortBy === 'margenMensual') arr.sort((a, b) => (b.margenMensual || 0) - (a.margenMensual || 0));
    else if (sortBy === 'margenPct') arr.sort((a, b) => (b.margenPct || -999) - (a.margenPct || -999));
    else if (sortBy === 'costo') arr.sort((a, b) => b.costoTotal - a.costoTotal);
    else if (sortBy === 'produccion') arr.sort((a, b) => b.prodMensual - a.prodMensual);
    else if (sortBy === 'nombre') arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return arr;
  }, [data, filter, search, sortBy]);

  if (loading) return <div style={S.loading}>Cargando dashboard de márgenes...</div>;
  if (err) return <div style={S.err}>{err}</div>;
  if (!data) return null;

  const k = data.kpis;
  const aux = data.costosAuxiliares;

  return (
    <div>
      <HelpHint id="margenes-precios" title="Cómo cargar precios y leer márgenes">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><strong>Click en el input PRECIO VENTA</strong> de una fila, teclea el precio en MXN y presiona <kbd>Tab</kbd> o <kbd>Enter</kbd> para guardar.</li>
          <li>Cambia <strong>Presentación</strong> (Cubeta / Galón / Litro / Tote) para cargar precios distintos por unidad.</li>
          <li>Cambia <strong>Tier</strong> a Mayoreo para precios de volumen (tarima, distribuidor).</li>
          <li><strong>Click en una fila</strong> expande el desglose paso a paso del costo.</li>
        </ul>
      </HelpHint>

      {/* KPIs */}
      <div style={S.metric}>
        <div style={S.metricCard('var(--lp-brand-600)')}>
          <div style={S.metricVal}>{k.totalProductos}</div>
          <div style={S.metricLabel}>Productos totales</div>
        </div>
        <div style={S.metricCard('var(--lp-success-600)')}>
          <div style={S.metricVal}>{k.conPrecio}</div>
          <div style={S.metricLabel}>Con precio venta</div>
        </div>
        <div style={S.metricCard('var(--lp-warning-600)')}>
          <div style={{ ...S.metricVal, color: 'var(--lp-warning-700)' }}>{k.sinPrecio}</div>
          <div style={S.metricLabel}>Sin precio venta</div>
        </div>
        <div style={S.metricCard('var(--lp-danger-600)')}>
          <div style={{ ...S.metricVal, color: 'var(--lp-danger-600)' }}>{k.productosNoRentables}</div>
          <div style={S.metricLabel}>No rentables</div>
        </div>
        <div style={S.metricCard('var(--lp-brand-600)')}>
          <div style={S.metricVal}>{k.margenPromedio}%</div>
          <div style={S.metricLabel}>Margen promedio</div>
        </div>
        <div style={S.metricCard('var(--lp-success-600)')}>
          <div style={{ ...S.metricVal, fontSize: 18 }}>{fmt$(k.margenTotalMensual)}</div>
          <div style={S.metricLabel}>Margen mensual</div>
        </div>
      </div>

      {/* CTA prominente para cargar precios pendientes */}
      {k.sinPrecio > 0 && filter === 'con_precio' && (
        <div style={{
          background: 'var(--lp-warning-50)',
          border: '1.5px solid var(--lp-warning-300)',
          borderRadius: 'var(--lp-radius)',
          padding: '14px 18px',
          marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--lp-warning-700)', marginBottom: 2 }}>
              {k.sinPrecio} producto{k.sinPrecio === 1 ? '' : 's'} sin precio cargado
            </div>
            <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)' }}>
              Sin precio no se calcula margen ni utilidad. Click para verlos y cargarles precio.
            </div>
          </div>
          <button
            style={{
              background: 'var(--lp-warning-600)', color: '#fff', border: 'none',
              padding: '10px 18px', borderRadius: 'var(--lp-radius-sm)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
            onClick={() => setFilter('sin_precio')}
          >
            Cargar precios pendientes &rarr;
          </button>
        </div>
      )}

      <div style={S.panel}>
        <div style={S.toolbar}>
          <input
            style={S.search}
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* ════════ TOOLBAR COMPACTA UNIFICADA ════════
            Segmented controls + dropdown — diseño limpio y mobile-friendly.
            Reemplaza 3 bloques separados (filtros pills + presentación banner + tier banner + indicador). */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          marginBottom: 14,
        }}>
          <SegmentedControl
            value={presentacion}
            onChange={setPresentacion}
            color="brand"
            options={[
              { value: 'cubeta', label: '19L' },
              { value: 'galon',  label: 'Galón' },
              { value: 'litro',  label: 'Litro' },
              { value: 'tote',   label: 'Tote' },
            ]}
          />

          <SegmentedControl
            value={tier}
            onChange={setTier}
            color="success"
            options={[
              { value: 'menudeo', label: 'Menudeo' },
              { value: 'mayoreo', label: 'Mayoreo' },
            ]}
          />

          {/* Dropdown: Filtro */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: 12, fontWeight: 500,
              border: '1px solid var(--lp-border-subtle)',
              borderRadius: 999,
              background: 'var(--lp-bg-base)',
              color: 'var(--lp-text-primary)',
              fontFamily: 'inherit',
              cursor: 'pointer',
              outline: 'none',
              minHeight: 34,
            }}
          >
            <option value="con_precio">Con precio</option>
            <option value="sin_precio">Sin precio</option>
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="rentables">Rentables (≥30%)</option>
            <option value="medio">Medio (15-30%)</option>
            <option value="bajos">Bajos (&lt;15%)</option>
            <option value="no_rentables">No rentables</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th} onClick={() => setSortBy('nombre')} role="button">Producto</th>
                <th style={{ ...S.th, textAlign: 'right' }} onClick={() => setSortBy('costo')} role="button">Costo</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Precio {tier === 'mayoreo' ? 'mayoreo' : 'venta'}</th>
                <th style={{ ...S.th, textAlign: 'right' }} onClick={() => setSortBy('margenPct')} role="button">Margen</th>
                <th style={{ ...S.th, textAlign: 'right' }} onClick={() => setSortBy('produccion')} role="button">Cub/mes</th>
                <th style={{ ...S.th, textAlign: 'right' }} onClick={() => setSortBy('margenMensual')} role="button">Margen mes</th>
              </tr>
            </thead>
            <tbody>
              {productos.length === 0 && (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-tertiary)', padding: 24 }}>
                  Sin productos que coincidan
                </td></tr>
              )}
              {productos.map(p => {
                /* ── Datos según presentación + tier seleccionados ── */
                const fields = getActiveFields(p, presentacion, tier);
                const costoActivo = fields.costoTotal || 0;
                const precioActivo = fields.precioVal || 0;
                const margenAbsActivo = fields.margenAbsVal || 0;
                const margenPctActivo = fields.margenPctVal;
                const precioField = fields.precioField;

                /* Producción mensual: solo cubeta tiene este dato. Para otras presentaciones
                   estimamos: galón = cub × 5 (5 galones por cubeta), litro = cub × 19, tote = cub / 51 */
                const factorProd = presentacion === 'cubeta' ? 1 :
                                   presentacion === 'galon' ? 5 :
                                   presentacion === 'litro' ? 19 :
                                   presentacion === 'tote' ? (1/51) : 1;
                const prodPresentacion = Math.round((p.prodMensual || 0) * factorProd);
                const margenMensualActivo = margenAbsActivo * prodPresentacion;

                const noRentable = precioActivo > 0 && margenAbsActivo < 0;
                const sinPrecio = precioActivo === 0;
                const expanded = expandedRow === p.nombre;

                /* Etiqueta dinámica de unidad para "Cub/mes" */
                const unidadLabel = presentacion === 'cubeta' ? 'cub' :
                                    presentacion === 'galon' ? 'gal' :
                                    presentacion === 'litro' ? 'L' :
                                    'tote';

                return (
                  <Fragment key={p.nombre}>
                  <tr style={{
                    background: noRentable ? margenBg(margenPctActivo, margenAbsActivo) : 'transparent',
                    cursor: 'pointer',
                  }} onClick={() => setExpandedRow(expanded ? null : p.nombre)}>
                    <td style={S.tdName}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          display: 'inline-block', transition: 'transform .15s',
                          transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
                          color: 'var(--lp-text-tertiary)',
                        }}>▸</span>
                        <span>{p.nombre}</span>
                        {p.marca && p.marca !== 'DEFAULT' && <span style={S.badge('var(--lp-info-50)', 'var(--lp-info-600)')}>{p.marca}</span>}
                        {p.descontinuada && <span style={S.badge('var(--lp-bg-sunken)', 'var(--lp-text-tertiary)')}>desc.</span>}
                        {!p.completo && <span style={S.badge('var(--lp-warning-100)', 'var(--lp-warning-700)')} title={p.mpsSinCosto.join(', ')}>{p.mpsSinCosto.length} MP s/costo</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', fontWeight: 400, marginTop: 2 }}>
                        MP {fmt$(p.costoMP)} · Envío {fmt$(p.costoEnvio || 0)} · Envase {fmt$(p.costoEnvase)} · Tapa {fmt$(p.costoTapa || 0)} · MO {fmt$(p.costoManoObra)} · Merma {fmt$(p.costoMerma)}
                      </div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{fmt$(costoActivo)}</td>
                    <td style={{ ...S.td, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <PrecioInput
                        valor={precioActivo}
                        onSave={(v) => handleSavePrecioField(p.nombre, precioField, v)}
                        canEdit={canEditPrecios}
                      />
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      {sinPrecio ? (
                        <span style={{ color: 'var(--lp-text-tertiary)' }}>—</span>
                      ) : (
                        <div>
                          <div style={{ color: margenColor(margenPctActivo, margenAbsActivo), fontWeight: 700 }}>
                            {margenPctActivo != null ? margenPctActivo + '%' : '—'}
                          </div>
                          <div style={{ fontSize: 11, color: margenColor(margenPctActivo, margenAbsActivo), opacity: 0.7 }}>
                            {fmt$(margenAbsActivo)}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', color: prodPresentacion > 0 ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)' }}>
                      {prodPresentacion > 0 ? `${prodPresentacion} ${unidadLabel}` : '—'}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: margenColor(margenPctActivo, margenAbsActivo) }}>
                      {precioActivo > 0 && prodPresentacion > 0 ? fmt$(margenMensualActivo) : '—'}
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--lp-bg-sunken)', padding: 14, borderBottom: '1.5px solid var(--lp-border-subtle)' }}>
                        <BreakdownRow producto={p} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={S.hint}>
          <strong>Cómo se calcula el margen:</strong> precio venta − (costo MP + envase ${aux.envase} + tapa ${aux.tapa} + mano obra ${aux.manoObra} + merma {(aux.pctMerma * 100).toFixed(1)}%).
          Costos auxiliares son estimados industria; si quieres editarlos por producto, dímelo.
          Precio mensual estimado = producción promedio últimos 6 meses × precio venta.
          {canEditPrecios && ' Click en cualquier precio para editarlo (Enter o salir del campo guarda).'}
        </div>
      </div>
    </div>
  );
}
