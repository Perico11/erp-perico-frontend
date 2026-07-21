import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import PushSettings from '../../components/PushSettings';
import { getPushPermission } from '../../utils/pushNotifications';
import SegmentedControl from '../../components/ui/SegmentedControl';
import NotificacionCard from './NotificacionCard';

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
  /* Las cards de alerta las renderiza ahora NotificacionCard (diseño mockup);
     los estilos inline de card/header/badge se retiraron al migrar. */
  loading: { textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
  /* Card colapsable de push (decisión owner jun 2026: push para TODOS los roles) */
  pushCard: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  pushHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px', minHeight: 48,
    cursor: 'pointer', userSelect: 'none',
    fontFamily: 'var(--lp-font-sans)',
  },
  pushTitle: { fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)', flex: 1, minWidth: 0 },
  pushBadge: (perm) => ({
    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, flexShrink: 0,
    textTransform: 'uppercase', letterSpacing: '.04em',
    background: perm === 'granted' ? 'var(--lp-success-100)' :
                perm === 'denied' ? 'var(--lp-danger-100)' :
                perm === 'unsupported' ? 'var(--lp-bg-sunken)' : 'var(--lp-warning-100)',
    color:      perm === 'granted' ? 'var(--lp-success-700)' :
                perm === 'denied' ? 'var(--lp-danger-700)' :
                perm === 'unsupported' ? 'var(--lp-text-secondary)' : 'var(--lp-warning-700)',
  }),
};

/* Etiqueta del estado del permiso de push en el navegador:
   activado / bloqueado por el navegador / no soportado / sin activar */
const PUSH_PERM_LABEL = {
  granted: 'Activadas',
  denied: 'Bloqueadas',
  unsupported: 'No soportado',
  default: 'Sin activar',
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
  ot_pendiente_surtir: 'Transferencia por surtir',
  ot_pendiente_recibir: 'Transferencia por recibir',
  recoleccion_envejecida: 'Recolección atorada',
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
  /* Sección colapsable "Notificaciones push en este dispositivo" — visible
     para TODOS los roles (esta pantalla no tiene RoleRoute). Cerrada por
     default para no empujar las alertas hacia abajo. */
  const [pushOpen, setPushOpen] = useState(false);
  const [pushPerm, setPushPerm] = useState(getPushPermission());
  const [filterSev, setFilterSev] = useState('todas');
  const [filterArea, setFilterArea] = useState('todas');
  const [verLeidas, setVerLeidas] = useState(false);
  const { data, loading, reload } = useApiData(() => api.getNotificaciones(), null, 30000);

  /* Refrescar el badge del permiso: al volver el foco (pudo cambiar en
     ajustes del navegador) y cuando PushSettings lo pide tras "Activar"
     (evento 'pp-push-permission'). */
  useEffect(() => {
    const sync = () => setPushPerm(getPushPermission());
    window.addEventListener('focus', sync);
    window.addEventListener('pp-push-permission', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('pp-push-permission', sync);
    };
  }, []);

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
  /* Marcar 1+ notifs como leídas y refrescar la bandeja. */
  const marcarLeidas = (items) => {
    if (!items || !items.length) return;
    api.marcarNotificacionesLeidas(items).then(() => reload()).catch(() => {});
  };

  const handleCardClick = (notif) => {
    /* Al click se marca leída (sale de la bandeja) + navega a su pantalla. */
    if (notif && !notif.leida) {
      api.marcarNotificacionesLeidas([{ id: notif.id, hash: notif._hash }]).catch(() => {});
    }
    const ruta = notif.ruta || AREA_ROUTE[notif.area];
    if (ruta) navigate(ruta);
    else navigate('/');
  };

  const notifs = useMemo(() => {
    const arr = Array.isArray(data) ? data : (data?.data || []);
    let res = [...arr];
    if (!verLeidas) res = res.filter(n => !n.leida); /* leídas ocultas salvo toggle */
    if (filterSev !== 'todas') res = res.filter(n => n.severidad === filterSev);
    if (filterArea !== 'todas') res = res.filter(n => n.area === filterArea);
    return res;
  }, [data, filterSev, filterArea, verLeidas]);

  /* Para los botones del final: cuántas hay sin leer / leídas (sobre el total real). */
  const todasRaw = Array.isArray(data) ? data : (data?.data || []);
  const sinLeer = todasRaw.filter(n => !n.leida);
  const nLeidas = todasRaw.length - sinLeer.length;

  const k = (data && data.resumen) || { total: 0, criticas: 0, medias: 0, bajas: 0 };

  return (
    <div>
      <TopBar title="Alertas y Notificaciones" />
      <div style={S.wrap}>
        {/* DECISIÓN OWNER (jun 2026): push para TODOS los roles — cada quien
            activa en su dispositivo y solo recibe eventos de su pipeline
            (gate por rol en utils/pushNotifications.js). Card colapsable en
            vez de tab para que conviva con las alertas sin ocultarlas. */}
        <div style={S.pushCard}>
          <div
            style={S.pushHeader}
            role="button"
            tabIndex={0}
            aria-expanded={pushOpen}
            aria-label="Notificaciones push en este dispositivo"
            onClick={() => setPushOpen(o => !o)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPushOpen(o => !o); } }}
          >
            {/* Campana (SVG line, sin emojis) */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lp-brand-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span style={S.pushTitle}>Notificaciones push en este dispositivo</span>
            <span style={S.pushBadge(pushPerm)}>{PUSH_PERM_LABEL[pushPerm] || PUSH_PERM_LABEL.default}</span>
            {/* Chevron */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lp-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, transform: pushOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          {pushOpen && (
            <div style={{ padding: '0 14px 14px' }}>
              <PushSettings embedded />
            </div>
          )}
        </div>

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
          <div style={S.loading}>{verLeidas ? 'Sin notificaciones.' : 'Sin alertas pendientes — todo al día'}</div>
        ) : (
          /* Card del mockup jun 2026 (NotificacionCard): ícono-app del perico +
             título + tiempo relativo + área con color semántico. La ruta de
             click la resuelve handleCardClick (ruta propia → mapa por área).
             Las leídas (cuando se muestran con el toggle) van atenuadas. */
          notifs.map(n => (
            <div key={n.id} style={n.leida ? { opacity: 0.5 } : undefined}>
              <NotificacionCard notif={n} onClick={handleCardClick} humanizar={humanizar} />
            </div>
          ))
        )}

        {/* Acciones al final: "Leer todas" + ver/ocultar leídas */}
        {!loading && (sinLeer.length > 0 || nLeidas > 0) && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {sinLeer.length > 0 && (
              <button
                onClick={() => marcarLeidas(sinLeer.map(n => ({ id: n.id, hash: n._hash })))}
                style={{ height: 40, padding: '0 18px', borderRadius: 999, border: 'none', background: 'var(--lp-brand-600)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
                Leer todas ({sinLeer.length})
              </button>
            )}
            {nLeidas > 0 && (
              <button
                onClick={() => setVerLeidas(v => !v)}
                style={{ height: 40, padding: '0 16px', borderRadius: 999, border: '1px solid var(--lp-border)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {verLeidas ? 'Ocultar leídas' : `Ver leídas (${nLeidas})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
