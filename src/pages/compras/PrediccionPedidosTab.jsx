/* ═══════════════════════════════════════════════════════════════════
   PrediccionPedidosTab — Vista operativa para Arely (compras)
   Fix #7 — Reemplaza el "PERIYOY agregado" del dashboard por una tabla
   accionable: qué MP pedir, cuánto, cuándo, a qué proveedor.
   Respeta LP design system del BRIEF_IDENTIDAD.md.
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useMemo } from 'react';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import SegmentedControl from '../../components/ui/SegmentedControl';

const PRIORIDAD_INFO = {
  critico: { label: 'Crítico',  bg: 'var(--lp-danger-100)',   fg: 'var(--lp-danger-700)',  border: 'var(--lp-danger-500)' },
  urgente: { label: 'Urgente',  bg: 'var(--lp-warning-100)',  fg: 'var(--lp-warning-700)', border: 'var(--lp-warning-500)' },
  pronto:  { label: 'Pronto',   bg: 'var(--lp-brand-100)',    fg: 'var(--lp-brand-700)',   border: 'var(--lp-brand-500)' },
  ok:      { label: 'OK',       bg: 'var(--lp-success-100)',  fg: 'var(--lp-success-700)', border: 'var(--lp-success-500)' },
};

const S = {
  wrap: { padding: '0 0 80px' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:16 },
  title: { fontSize:18, fontWeight:800, color:'var(--lp-text-primary)' },
  meta: { fontSize:12, color:'var(--lp-text-tertiary)', marginTop:2 },

  kpiGrid: {
    display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))',
    gap:10, marginBottom:16,
  },
  kpi: (accent) => ({
    background:'var(--lp-bg-raised)', border:'1.5px solid var(--lp-border-subtle)',
    borderTop:`3px solid ${accent}`, borderRadius:'var(--lp-radius-sm, 6px)',
    padding:'14px 16px', textAlign:'center',
  }),
  kpiLabel: { fontSize:11, fontWeight:700, color:'var(--lp-text-tertiary)', textTransform:'uppercase', letterSpacing:'.06em' },
  kpiValue: { fontSize:24, fontWeight:800, fontFamily:'var(--lp-font-mono)', color:'var(--lp-text-primary)', marginTop:4 },

  toolbar: { display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' },
  search: {
    flex:1, minWidth:200, padding:'10px 14px', borderRadius:8,
    border:'1.5px solid var(--lp-border-subtle)', fontSize:13,
    fontFamily:'var(--lp-font-sans)', background:'var(--lp-bg-raised)', boxSizing:'border-box',
  },

  cardGrid: {
    display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(360px, 1fr))',
    gap:12,
  },
  card: (prioridad) => {
    const c = PRIORIDAD_INFO[prioridad] || PRIORIDAD_INFO.ok;
    return {
      background:'var(--lp-bg-raised)',
      border:'1.5px solid var(--lp-border-subtle)',
      borderLeft:`4px solid ${c.border}`,
      borderRadius:'var(--lp-radius, 10px)',
      padding:14,
    };
  },
  cardHead: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:8 },
  mpName: { fontSize:14, fontWeight:700, color:'var(--lp-text-primary)' },
  proveedor: { fontSize:11, color:'var(--lp-text-tertiary)', marginTop:2 },
  badge: (kind) => {
    const c = PRIORIDAD_INFO[kind] || PRIORIDAD_INFO.ok;
    return {
      display:'inline-flex', padding:'3px 8px', fontSize:10, fontWeight:700,
      background: c.bg, color: c.fg, borderRadius:6,
      textTransform:'uppercase', letterSpacing:'.04em',
    };
  },

  row: { display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', color:'var(--lp-text-secondary)' },
  rowVal: { fontFamily:'var(--lp-font-mono)', fontWeight:600, color:'var(--lp-text-primary)' },
  highlight: (deficit) => ({ color: deficit > 0 ? 'var(--lp-danger-600)' : 'var(--lp-success-600)' }),

  forecastBars: { display:'flex', gap:4, marginTop:10, height:40, alignItems:'flex-end' },
  forecastBar: (pct, color) => ({
    flex:1, height: Math.max(4, pct) + '%',
    background: color, borderRadius:'3px 3px 0 0',
    position:'relative',
  }),
  forecastLabel: { fontSize:11, color:'var(--lp-text-tertiary)', marginTop:2, textAlign:'center', fontFamily:'var(--lp-font-mono)' },

  actions: { display:'flex', gap:6, marginTop:10, flexWrap:'wrap' },
  btnOC: {
    padding:'7px 14px', fontSize:12, fontWeight:700, borderRadius:8,
    background:'var(--lp-brand-600)', color:'#fff', border:'none', cursor:'pointer',
    fontFamily:'inherit',
  },
  btnGhost: {
    padding:'7px 14px', fontSize:12, fontWeight:600, borderRadius:8,
    background:'var(--lp-bg-raised)', color:'var(--lp-text-secondary)',
    border:'1.5px solid var(--lp-border-subtle)', cursor:'pointer', fontFamily:'inherit',
  },

  alerta: {
    marginTop:8, padding:'6px 10px', fontSize:11, color:'var(--lp-warning-700)',
    background:'var(--lp-warning-100)', border:'1px solid var(--lp-warning-500)',
    borderRadius:6, lineHeight:1.4,
  },

  empty: { textAlign:'center', padding:'60px 20px', color:'var(--lp-text-tertiary)' },
};

export default function PrediccionPedidosTab({ onCreateOC }) {
  const [meses, setMeses] = useState(3);
  const [margen, setMargen] = useState(1.15);
  const [filtro, setFiltro] = useState('todos');
  const [search, setSearch] = useState('');

  const [errorBackend, setErrorBackend] = useState(null);
  const { data, loading } = useApiData(
    async () => {
      try {
        const r = await api.getPrediccionPedidos(meses, margen);
        setErrorBackend(null);
        return r;
      } catch (e) {
        const msg = e?.message || String(e);
        const is404 = msg.includes('404') || msg.includes('Not Found') || msg.includes('Endpoint no encontrado');
        setErrorBackend(is404 ? 'endpoint-no-existe' : msg);
        return null;
      }
    },
    [meses, margen],
    60000,
  );

  const predicciones = useMemo(() => {
    const arr = data?.predicciones || [];
    let lista = arr;
    if (filtro !== 'todos') lista = lista.filter(p => p.prioridad === filtro);
    if (search.trim()) {
      const q = search.toLowerCase();
      lista = lista.filter(p =>
        p.mp.toLowerCase().includes(q) ||
        (p.proveedor || '').toLowerCase().includes(q)
      );
    }
    return lista;
  }, [data, filtro, search]);

  const kpis = data?.kpis || { total:0, criticos:0, urgentes:0, pronto:0, kgDeficit:0, kgTotalProyectado:0 };
  const meta = data?.meta || {};

  if (loading && !data && !errorBackend) {
    return <div style={S.empty}><div className="lp-spinner" /><div style={{marginTop:14}}>Calculando predicción…</div></div>;
  }

  /* Backend viejo: el endpoint /api/compras/prediccion-pedidos aún no existe.
     Mensaje accionable en vez de pantalla en blanco. */
  if (errorBackend === 'endpoint-no-existe') {
    return (
      <div style={{ padding:24 }}>
        <div style={{
          background:'var(--lp-warning-50, #FFFBEB)',
          border:'2px solid var(--lp-warning-500)',
          borderRadius:'var(--lp-radius)',
          padding:20, maxWidth:560, margin:'40px auto', textAlign:'center',
        }}>
          <div style={{ fontSize:36, marginBottom:8 }}>⚠</div>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:8, color:'var(--lp-warning-700)' }}>
            Server desactualizado
          </div>
          <div style={{ fontSize:13, color:'var(--lp-text-secondary)', lineHeight:1.6, marginBottom:14 }}>
            La predicción de pedidos por MP individual está lista en el código,
            pero el backend que está corriendo aún no tiene este endpoint.
            <br/><br/>
            <strong>Para activarla:</strong>
          </div>
          <ol style={{ textAlign:'left', fontSize:13, color:'var(--lp-text-primary)', lineHeight:1.8, paddingLeft:24, margin:'0 0 14px' }}>
            <li>Cierra todas las ventanas del backend (puerto 3000)</li>
            <li>Doble click en <code style={{ background:'var(--lp-bg-sunken)', padding:'2px 6px', borderRadius:4 }}>reiniciar.bat</code> en la carpeta del proyecto</li>
            <li>Espera 5 segundos y haz hard refresh (Ctrl+Shift+R)</li>
          </ol>
          <button
            style={{
              padding:'10px 20px', borderRadius:8,
              background:'var(--lp-brand-600)', color:'#fff', border:'none',
              fontSize:13, fontWeight:700, cursor:'pointer',
            }}
            onClick={() => window.location.reload()}
          >
            Recargar pantalla
          </button>
        </div>
      </div>
    );
  }

  if (errorBackend) {
    return (
      <div style={S.empty}>
        <div style={{ fontSize:48, marginBottom:12 }}>⚠</div>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--lp-danger-600)' }}>Error: {errorBackend}</div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      {/* HEADER */}
      <div style={S.header}>
        <div>
          <div style={S.title}>Predicción de pedidos próximos {meses} meses</div>
          <div style={S.meta}>
            {meta.totalMPsAnalizadas || 0} MPs analizadas · {meta.mesesHistoricos?.length || 0} meses de historia · margen seguridad {Math.round((margen-1)*100)}%
          </div>
        </div>
        <SegmentedControl
          value={String(meses)}
          onChange={(v) => setMeses(parseInt(v))}
          color="brand"
          options={[
            { value: '3', label: '3 meses' },
            { value: '6', label: '6 meses' },
            { value: '12', label: '12 meses' },
          ]}
        />
      </div>

      {/* KPIs OPERATIVOS */}
      <div style={S.kpiGrid}>
        <div style={S.kpi('var(--lp-danger-600)')}>
          <div style={S.kpiLabel}>Críticos</div>
          <div style={{...S.kpiValue, color: kpis.criticos > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)'}}>{kpis.criticos}</div>
        </div>
        <div style={S.kpi('var(--lp-warning-600)')}>
          <div style={S.kpiLabel}>Urgentes</div>
          <div style={S.kpiValue}>{kpis.urgentes}</div>
        </div>
        <div style={S.kpi('var(--lp-brand-600)')}>
          <div style={S.kpiLabel}>Pronto</div>
          <div style={S.kpiValue}>{kpis.pronto}</div>
        </div>
        <div style={S.kpi('var(--lp-success-600)')}>
          <div style={S.kpiLabel}>Total MPs</div>
          <div style={S.kpiValue}>{kpis.total}</div>
        </div>
        <div style={S.kpi('var(--lp-text-tertiary)')}>
          <div style={S.kpiLabel}>Déficit kg</div>
          <div style={S.kpiValue}>{Math.round(kpis.kgDeficit).toLocaleString()}</div>
        </div>
        <div style={S.kpi('var(--lp-brand-700)')}>
          <div style={S.kpiLabel}>Proy. {meses}m kg</div>
          <div style={S.kpiValue}>{Math.round(kpis.kgTotalProyectado).toLocaleString()}</div>
        </div>
      </div>

      {/* TOOLBAR: Filtro + Búsqueda */}
      <div style={S.toolbar}>
        <input
          type="search" placeholder="Buscar MP o proveedor…"
          style={S.search}
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <SegmentedControl
          value={filtro}
          onChange={setFiltro}
          color="brand"
          options={[
            { value:'todos',   label:`Todos (${kpis.total})` },
            { value:'critico', label:`Crítico (${kpis.criticos})` },
            { value:'urgente', label:`Urgente (${kpis.urgentes})` },
            { value:'pronto',  label:`Pronto (${kpis.pronto})` },
          ]}
        />
      </div>

      {/* TARJETAS POR MP — grid responsivo */}
      {predicciones.length === 0 ? (
        <div style={S.empty}>
          <div style={{fontSize:48, marginBottom:12}}>✓</div>
          <div style={{fontSize:14, fontWeight:600, color:'var(--lp-text-secondary)'}}>
            {search || filtro !== 'todos' ? 'Sin resultados con esos filtros' : 'No hay MPs que requieran pedido pronto'}
          </div>
        </div>
      ) : (
        <div style={S.cardGrid}>
          {predicciones.map(p => (
            <MPCard key={p.mp} p={p} onCreateOC={onCreateOC} />
          ))}
        </div>
      )}
    </div>
  );
}

function MPCard({ p, onCreateOC }) {
  const maxForecast = Math.max(...p.forecast, 1);
  const promedio = p.consumoPromedioMensual;

  return (
    <div style={S.card(p.prioridad)}>
      {/* Header */}
      <div style={S.cardHead}>
        <div style={{flex:1, minWidth:0}}>
          <div style={S.mpName}>{p.mp}</div>
          <div style={S.proveedor}>{p.proveedor} · LT {p.leadTimeDias}d</div>
        </div>
        <span style={S.badge(p.prioridad)}>{PRIORIDAD_INFO[p.prioridad]?.label}</span>
      </div>

      {/* Datos clave */}
      <div style={S.row}><span>Stock actual</span><span style={S.rowVal}>{p.stockActual.toLocaleString()} kg</span></div>
      <div style={S.row}><span>OC en tránsito</span><span style={S.rowVal}>{p.enTransito.toLocaleString()} kg</span></div>
      <div style={S.row}><span>Días de stock</span><span style={S.rowVal}>{p.diasStock < 9999 ? `${p.diasStock}d` : '—'}</span></div>
      <div style={S.row}>
        <span>Consumo /mes histórico</span>
        <span style={S.rowVal}>{Math.round(promedio).toLocaleString()} ±{p.cvPct}%</span>
      </div>
      <div style={{...S.row, fontWeight:700, marginTop:6, paddingTop:6, borderTop:'1px solid var(--lp-border-subtle)'}}>
        <span>Proyectado {p.forecast.length}m</span>
        <span style={{...S.rowVal, ...S.highlight(p.deficit)}}>
          {Math.round(p.totalPredicho).toLocaleString()} kg
        </span>
      </div>
      {p.deficit > 0 && (
        <div style={{...S.row, color:'var(--lp-danger-600)', fontWeight:700}}>
          <span>⚠ Déficit</span>
          <span style={S.rowVal}>{Math.round(p.deficit).toLocaleString()} kg</span>
        </div>
      )}

      {/* Mini bar chart de forecast */}
      <div style={S.forecastBars}>
        {p.forecast.map((v, i) => {
          const pct = (v / maxForecast) * 100;
          const c = PRIORIDAD_INFO[p.prioridad].border;
          return <div key={i} style={S.forecastBar(pct, c)} title={`${p.forecastMeses[i]}: ${Math.round(v)} kg`} />;
        })}
      </div>
      <div style={{display:'flex', justifyContent:'space-between', marginTop:2}}>
        {p.forecastMeses.map((m, i) => (
          <span key={i} style={S.forecastLabel}>{m.slice(5)}</span>
        ))}
      </div>

      {/* Alerta dinámica */}
      {p.alerta && (
        <div style={S.alerta}>
          <strong>Alerta IA:</strong> próximo mes proyecta {p.alerta.tipo === 'aumento' ? '+' : '−'}{p.alerta.pct}%
          {' '}sobre promedio (umbral natural ±{p.alerta.umbralPct}%).
        </div>
      )}

      {/* Sugerencia operativa */}
      {p.cantidadSugerida > 0 ? (
        <div style={{ marginTop:10, padding:'8px 10px', background:'var(--lp-brand-50)', borderRadius:8, fontSize:11, color:'var(--lp-brand-700)' }}>
          Pedir <strong>{Math.round(p.cantidadSugerida).toLocaleString()} kg</strong>
          {p.diasParaPedir === 0 ? ' AHORA' : ` antes de ${p.fechaPedidoOptima}`}
        </div>
      ) : (
        <div style={{ marginTop:10, padding:'8px 10px', background:'var(--lp-success-50, var(--lp-bg-sunken))', borderRadius:8, fontSize:11, color:'var(--lp-success-700)' }}>
          Stock suficiente para los próximos {p.forecast.length} meses
        </div>
      )}

      {/* Acciones */}
      <div style={S.actions}>
        {p.cantidadSugerida > 0 && onCreateOC && (
          <button style={S.btnOC} onClick={() => onCreateOC(p)}>
            Crear OC
          </button>
        )}
      </div>
    </div>
  );
}
