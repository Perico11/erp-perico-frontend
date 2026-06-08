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
import KPICard from '../../components/ui/KPICard';

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
          <div style={{ marginBottom:8, color:'var(--lp-warning-600)', display:'flex', justifyContent:'center' }}><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
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
        <div style={{ marginBottom:12, color:'var(--lp-danger-600)', display:'flex', justifyContent:'center' }}><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
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
        <KPICard accent="var(--lp-danger-600)" label="Críticos" value={kpis.criticos} valueColor={kpis.criticos > 0 ? 'var(--lp-danger-600)' : undefined} />
        <KPICard accent="var(--lp-warning-600)" label="Urgentes" value={kpis.urgentes} />
        <KPICard accent="var(--lp-brand-600)" label="Pronto" value={kpis.pronto} />
        <KPICard accent="var(--lp-success-600)" label="Total MPs" value={kpis.total} />
        <KPICard accent="var(--lp-text-tertiary)" label="Déficit kg" value={Math.round(kpis.kgDeficit).toLocaleString()} />
        <KPICard accent="var(--lp-brand-700)" label={`Proy. ${meses}m kg`} value={Math.round(kpis.kgTotalProyectado).toLocaleString()} />
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
          <div style={{ marginBottom:12, color:'var(--lp-brand-600)', display:'flex', justifyContent:'center' }}><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
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
          <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Déficit</span>
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
