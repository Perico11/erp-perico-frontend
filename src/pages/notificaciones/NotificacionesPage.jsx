import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import PageTabs from '../../components/ui/PageTabs';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import PushSettings from '../../components/PushSettings';
import SegmentedControl from '../../components/ui/SegmentedControl';

const S = {
  wrap: { padding: '0 20px 100px' },
  metric: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12, marginBottom: 16,
  },
  metricCard: (accent) => ({
    background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
    padding: 14, textAlign: 'center',
    borderTop: accent ? `3px solid ${accent}` : 'none',
  }),
  metricVal: { fontSize: 24, fontWeight: 800, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  metricLabel: { fontSize: 11, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, fontWeight: 600 },
  toolbar: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  toolbarScroll: { width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 },
  card: (sev) => ({
    background: sev === 'critica' ? 'var(--lp-danger-50)' : sev === 'media' ? 'var(--lp-warning-50)' : 'var(--lp-bg-raised)',
    border: '1.5px solid ' + (sev === 'critica' ? 'var(--lp-danger-500)' : sev === 'media' ? 'var(--lp-warning-500)' : 'var(--lp-border-subtle)'),
    borderRadius: 'var(--lp-radius-sm)', padding: 14, marginBottom: 8,
  }),
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' },
  badge: (bg, fg) => ({
    display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700,
    borderRadius: 4, background: bg, color: fg,
    textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  loading: { textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
};

const SEV_BADGE = {
  critica: { bg: 'var(--lp-danger-600)', fg: '#fff', label: 'crítica' },
  media: { bg: 'var(--lp-warning-600)', fg: '#fff', label: 'media' },
  baja: { bg: 'var(--lp-bg-sunken)', fg: 'var(--lp-text-secondary)', label: 'baja' },
};
const AREA_BADGE = {
  inventario: { bg: 'var(--lp-success-50)', fg: 'var(--lp-success-700)' },
  compras:    { bg: 'var(--lp-info-50)',    fg: 'var(--lp-info-600)' },
  costos:     { bg: 'var(--lp-warning-50)', fg: 'var(--lp-warning-700)' },
  produccion: { bg: 'var(--lp-brand-50)', fg: 'var(--lp-brand-700)' },
};

/* Mapa de área → ruta destino al click. Hace que las cards sean clickeables y
   manden al usuario al lugar correcto. */
const AREA_ROUTE = {
  inventario: '/inventario',
  compras:    '/compras',
  costos:     '/admin',
  produccion: '/produccion?tab=calidad',
};

/* Humaniza strings tecnicos del backend para no exponer claves crudas o nombres
   de archivo al usuario final. */
const TECH_LABELS = {
  eliminacion_mp: 'Eliminación de materia prima',
  sustitucion_mp: 'Sustitución de materia prima',
  renombramiento_mp: 'Cambio de nombre de MP',
  recepcion_mp: 'Recepción de materia prima',
  stock_bajo: 'Stock bajo',
  stock_critico: 'Stock crítico',
  oc_vencida: 'OC vencida',
  oc_pendiente: 'OC pendiente',
  qc_hold: 'QC en espera',
  costo_faltante: 'Costo no definido',
  conteo_varianza: 'Varianza en conteo',
  conteo_pendiente_aprobacion: 'Conteo por aprobar',
  devolucion_mp_pendiente: 'Devolución a proveedor',
  rendimiento_bajo: 'Rendimiento bajo',
  lote_en_camino: 'Lote en camino',
  devolucion: 'Devolución registrada',
};
const FILE_LABELS = {
  inventario: 'Inventario',
  formulas: 'Fórmulas',
  ordenes: 'Órdenes',
  pedidos: 'Pedidos',
  pedidos_almacen: 'Pedidos',
  trazabilidad: 'Trazabilidad',
  produccion_historial: 'Historial producción',
  movimientos_inv: 'Movimientos de inventario',
  compras_historial: 'Historial compras',
  compras_oc: 'Órdenes de compra',
  costos_mp: 'Costos de MP',
  maestro_mp: 'Catálogo de MP',
  envases: 'Envases',
  usuarios: 'Usuarios',
  devoluciones: 'Devoluciones',
};
function humanizar(txt) {
  if (txt == null) return '';
  let s = String(txt);
  /* 1. Si una linea termina solo con "<algo>.json" → reemplazar por nombre humano */
  s = s.replace(/\b([a-z_]+)\.json\b/gi, (_, w) => {
    const k = w.toLowerCase();
    return FILE_LABELS[k] || w.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  });
  /* 2. Reemplazar claves tecnicas conocidas */
  for (const [k, v] of Object.entries(TECH_LABELS)) {
    const re = new RegExp('\\b' + k + '\\b', 'gi');
    s = s.replace(re, v);
  }
  /* 3. Convertir cualquier snake_case sobrante en palabras Capitalizadas separadas */
  s = s.replace(/\b([a-z]+)(_[a-z]+)+\b/g, (m) =>
    m.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  );
  /* 4. Reemplazar ":  " (dos puntos seguidos de espacio) por " — " para mejor legibilidad */
  s = s.replace(/:\s+/g, ' — ');
  return s;
}

export default function NotificacionesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('alertas'); /* alertas | configuracion */
  const [filterSev, setFilterSev] = useState('todas');
  const [filterArea, setFilterArea] = useState('todas');
  const { data, loading, reload } = useApiData(() => api.getNotificaciones(), null, 30000);

  /* Realtime: recargar cuando hay cambios de inventario, OC o trazabilidad (QC) */
  useRealtimeSync({
    onInventario: () => reload(),
    onOc: () => reload(),
    onTrazabilidad: () => reload(),
    /* Conteo finalizado/aprobado → refrescar la bandeja del admin al instante
       (el pendiente de aprobación aparece/desaparece sin esperar el polling). */
    onCycleCount: () => reload(),
    /* Devolución MP creada/cerrada → refrescar pendientes de Arely/admin. */
    onDevolucion: () => reload(),
  });

  /* Click en card → navega a la pantalla relevante. Prioridad: ruta explícita
     que mande el backend (ej. conteo pendiente → '/conteo' para aprobar), luego
     el mapa por área, y como último recurso el home. */
  const handleCardClick = (notif) => {
    const ruta = notif.ruta || AREA_ROUTE[notif.area];
    if (ruta) navigate(ruta);
    else navigate('/');
  };

  const notifs = useMemo(() => {
    const arr = Array.isArray(data) ? data : (data?.data || []);
    let res = [...arr];
    if (filterSev !== 'todas') res = res.filter(n => n.severidad === filterSev);
    if (filterArea !== 'todas') res = res.filter(n => n.area === filterArea);
    return res;
  }, [data, filterSev, filterArea]);

  const k = (data && data.resumen) || { total: 0, criticas: 0, medias: 0, bajas: 0 };

  return (
    <div>
      <TopBar title="Alertas y Notificaciones" />
      <div style={S.wrap}>
        {/* Tabs Alertas / Configuración */}
        <PageTabs
          tabs={[
            { id: 'alertas', label: 'Alertas activas', style: (a) => ({
              padding: '10px 16px', fontSize: 13, fontWeight: a ? 700 : 500,
              color: a ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: a ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'var(--lp-font-sans)', marginBottom: -1.5, flexShrink: 0,
            }) },
            { id: 'configuracion', label: 'Configurar push', style: (a) => ({
              padding: '10px 16px', fontSize: 13, fontWeight: a ? 700 : 500,
              color: a ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: a ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'var(--lp-font-sans)', marginBottom: -1.5, flexShrink: 0,
            }) },
          ]}
          activeTab={tab}
          onChange={setTab}
          style={{
            display: 'flex', gap: 0,
            borderBottom: '1.5px solid var(--lp-border-subtle)',
            marginBottom: 16,
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}
        />

        {tab === 'configuracion' && <PushSettings />}

        {tab === 'alertas' && <>
        <div style={S.metric}>
          <div style={S.metricCard('var(--lp-brand-600)')}>
            <div style={S.metricVal}>{k.total}</div>
            <div style={S.metricLabel}>Total</div>
          </div>
          <div style={S.metricCard('var(--lp-danger-600)')}>
            <div style={{ ...S.metricVal, color: 'var(--lp-danger-600)' }}>{k.criticas}</div>
            <div style={S.metricLabel}>Críticas</div>
          </div>
          <div style={S.metricCard('var(--lp-warning-600)')}>
            <div style={{ ...S.metricVal, color: 'var(--lp-warning-700)' }}>{k.medias}</div>
            <div style={S.metricLabel}>Medias</div>
          </div>
          <div style={S.metricCard('var(--lp-text-tertiary)')}>
            <div style={{ ...S.metricVal, color: 'var(--lp-text-tertiary)' }}>{k.bajas}</div>
            <div style={S.metricLabel}>Bajas</div>
          </div>
        </div>

        <div style={S.toolbar}>
          <div style={S.toolbarScroll}>
            <SegmentedControl
              value={filterSev}
              onChange={setFilterSev}
              options={[
                { value: 'todas', label: 'Todas' },
                { value: 'critica', label: 'Críticas' },
                { value: 'media', label: 'Medias' },
                { value: 'baja', label: 'Bajas' },
              ]}
              color="brand"
            />
          </div>
          <div style={S.toolbarScroll}>
            <SegmentedControl
              value={filterArea}
              onChange={setFilterArea}
              options={[
                { value: 'todas', label: 'Todas áreas' },
                { value: 'inventario', label: 'Inventario' },
                { value: 'compras', label: 'Compras' },
                { value: 'costos', label: 'Costos' },
              ]}
              color="brand"
            />
          </div>
        </div>

        {loading ? (
          <div style={S.loading}>Cargando alertas...</div>
        ) : notifs.length === 0 ? (
          <div style={S.loading}>Sin alertas para los filtros actuales — todo en orden</div>
        ) : (
          notifs.map(n => {
            const sb = SEV_BADGE[n.severidad] || SEV_BADGE.baja;
            const ab = AREA_BADGE[n.area] || { bg: 'var(--lp-bg-sunken)', fg: 'var(--lp-text-secondary)' };
            /* Prioriza la ruta propia de la notif (ej: devolucion_mp_pendiente →
               /devoluciones-mp) sobre el mapa por área — igual que handleCardClick.
               Antes solo miraba AREA_ROUTE[area] → notifs con ruta propia (o área
               sin entrada en el mapa) quedaban no-clickeables o mal ruteadas. */
            const ruta = n.ruta || AREA_ROUTE[n.area];
            const clickeable = !!ruta;
            return (
              <div
                key={n.id}
                role={clickeable ? 'button' : undefined}
                tabIndex={clickeable ? 0 : undefined}
                onClick={clickeable ? () => handleCardClick(n) : undefined}
                onKeyDown={clickeable ? (e) => { if (e.key === 'Enter') handleCardClick(n); } : undefined}
                style={{
                  ...S.card(n.severidad),
                  cursor: clickeable ? 'pointer' : 'default',
                  transition: 'transform .12s ease, box-shadow .12s ease',
                }}
                onMouseEnter={clickeable ? (e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.06)'; } : undefined}
                onMouseLeave={clickeable ? (e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; } : undefined}
                title={clickeable ? 'Click para ir a ' + ruta : undefined}
              >
                <div style={S.cardHeader}>
                  <span style={S.badge(sb.bg, sb.fg)}>{sb.label}</span>
                  <span style={S.badge(ab.bg, ab.fg)}>{n.area || 'general'}</span>
                  <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginLeft: 'auto' }}>
                    {(n.fecha || '').slice(0, 10)}
                  </span>
                  {clickeable && (
                    <span style={{ fontSize: 14, color: 'var(--lp-text-tertiary)', marginLeft: 4 }} aria-hidden="true">→</span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{humanizar(n.titulo)}</div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', lineHeight: 1.5 }}>
                  {humanizar(n.mensaje)}
                </div>
              </div>
            );
          })
        )}
        </>}
      </div>
    </div>
  );
}
