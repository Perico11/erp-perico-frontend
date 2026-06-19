import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useConfirm from '../../hooks/useConfirm';
import useIsDesktop from '../../hooks/useIsDesktop';
import HelpHint from '../../components/HelpHint';
import Cronometro from '../../components/Cronometro';
import NDAModal, { ndaYaAceptado } from '../../components/NDAModal';
import NuevoPedidoModal from './NuevoPedidoModal';
import PedidoLoteActions from '../../components/PedidoLoteActions';
import { EnvasadoModal, ReenvasadoModal, SubloteQRPrintModal } from '../stock-fabrica/StockFabricaPage';
import PruebaBadge from '../../components/ui/PruebaBadge';
import Fab from '../../components/ui/Fab';
/* Lenguaje visual del checkpoint (handoff Claude Design jun 2026) */
import { ETAPAS_PEDIDO, CK_COLOR, CkCheck, injectCkCSS } from '../../components/pipeline/Checkpoint';
import {
  ESTADO_PEDIDO_LABEL as ESTADO_LABEL,
  ESTADO_PEDIDO_COLOR as ESTADO_COLOR,
} from '../../lib/estados';
import { etiquetaMedidaReal } from '../../utils/ptMedidas';

/* ═══════════════════════════════════════════════════════════════════════
   PedidosPage — reskin "Claude Design" verde (jun 2026).

   Diseño 1:1 según los mockups del paquete entrega_v2:
     · ESCRITORIO (ERP Escritorio.html · SCREENS.pedidos): pills de filtro
       Activos/Pruebas/Historial + "+ Nuevo pedido" → grid g3 de cards anchas
       con folio, badge, mini-timeline y botón de acción por estado.
     · MÓVIL (ERP Móvil.html · S.pedidos): mismas pills + cards apiladas limpias.
     · STANDALONE (Pedidos.html · §7): "Eliminar pedido" SOLO admin; roles en
       Aceptar y producir / Iniciar / Rechazar / QC (data-id + data-rol).

   Tokens 100% var(--lp-*) (verde). Sin emojis → SVG line. mono para folios
   y cantidades. Botones nunca 100% width en escritorio. Touch ≥44px.

   LÓGICA INTACTA: todos los handlers, endpoints /api/pedidos/*, useRealtimeSync,
   useConfirm (NDA/confirm), esPrueba inmutable, PedidoLoteActions, el patrón
   "cerrar modal antes de await" del NDA, etc. Solo cambia la capa visual + el
   cableo de data-id → handler.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Iconos line (sin emojis) ─────────────────────────────────────────── */
const Icon = {
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  play: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  x: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  trash: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  ),
  flask: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.3h12.4a1.5 1.5 0 0 0 1.3-2.3L14 9.5V3" />
      <path d="M7 15h10" />
    </svg>
  ),
};

const S = {
  wrap: { padding: '0 20px 100px' },

  /* Toolbar: pills de filtro (izq) + "+ Nuevo pedido" (der) */
  toolbar: {
    display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16,
  },
  pillRow: { display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 },
  /* Tabs pill del mockup Pedidos.html: inactiva TRANSPARENTE (sin borde),
     activa rellena verde. Conteo vivo "Label · N". */
  pill: (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    minHeight: 36, padding: '0 15px',
    borderRadius: 999,
    border: 'none',
    background: active ? 'var(--lp-brand-600)' : 'transparent',
    color: active ? '#fff' : 'var(--lp-text-secondary)',
    fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap', transition: 'background .15s, color .15s',
  }),
  pillCount: (active) => ({
    fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700,
    color: active ? '#fff' : 'var(--lp-text-tertiary)',
  }),
  newBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    minHeight: 44, padding: '0 18px',
    background: 'var(--lp-brand-600)', color: '#fff',
    border: '1.5px solid var(--lp-brand-600)', borderRadius: 999,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    whiteSpace: 'nowrap', flexShrink: 0,
  },

  /* Subtítulo bajo el título (tsub del mockup Pedidos.html) — conteo vivo
     por pestaña ("4 activos · esperan tu acción"). El TopBar compartido no
     tiene prop subtitle (pendiente conocido), así que vive aquí en la page. */
  tsub: { fontSize: 12.5, color: 'var(--lp-text-secondary)', margin: '-2px 2px 12px' },

  /* ── Embudo de KPIs (HANDOFF §5 Pedidos): Pendientes→Producción→QC→
     Envasando→Camino→Entregados, contadores EN VIVO de la data real ── */
  funnel: {
    display: 'flex', alignItems: 'center',
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
    borderRadius: 18, padding: '12px 10px', marginBottom: 14,
    overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
  },
  funnelStage: { flex: '1 0 auto', minWidth: 74, textAlign: 'center', padding: '0 4px' },
  funnelVal: (color) => ({
    fontSize: 20, fontWeight: 700, fontFamily: 'var(--lp-font-mono)',
    color, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums',
  }),
  funnelLabel: {
    fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
    color: 'var(--lp-text-tertiary)', marginTop: 3, whiteSpace: 'nowrap',
  },
  funnelSep: { display: 'flex', alignItems: 'center', color: 'var(--lp-border-strong)', flex: '0 0 auto' },

  /* Card de pedido (mockup Pedidos.html + HANDOFF §4: superficie raised,
     borde HAIRLINE 1px, radio 18, RIEL de color a la izquierda por urgencia.
     Estructura: header → mini-timeline → cuerpo → acciones.) */
  pedidoCard: (estado, esPrueba) => ({
    position: 'relative', overflow: 'hidden',
    background: esPrueba ? 'var(--lp-warning-50)' : 'var(--lp-bg-raised)',
    border: '1px solid var(--lp-border-subtle)',
    borderRadius: 18,
    padding: '15px 16px 15px 19px', /* +3px izq para que el riel no pise el contenido */
    display: 'flex', flexDirection: 'column', gap: 12,
  }),
  /* Riel izquierdo 3px — color por URGENCIA (ver urgenciaPedido) */
  pedidoRail: (color) => ({
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color,
  }),
  pedidoHeader: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pedidoBody: { display: 'flex', flexDirection: 'column', gap: 4 },
  /* Acciones: primarias se reparten el ancho (flex), las destructivas quedan
     compactas como en el mockup (btn-danger sin flex). */
  pedidoActions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  pedidoId: { fontSize: 12, fontWeight: 600, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' },
  pedidoTitle: { fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--lp-text-primary)' },
  pedidoMeta: { fontSize: 12, color: 'var(--lp-text-secondary)', lineHeight: 1.5, marginTop: 2 },
  cantidad: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-text-secondary)' },
  /* Badge de estado tintado como el mockup. FIX visual: el tint anterior
     concatenaba alfa hex ('1f') sobre valores var(--lp-*) → color inválido
     (el badge quedaba SIN fondo). color-mix sí funciona con custom props. */
  estadoBadge: (estado) => {
    const c = ESTADO_COLOR[estado] || 'var(--lp-text-tertiary)';
    return {
      display: 'inline-flex', alignItems: 'center', padding: '3px 9px', fontSize: 11, fontWeight: 700,
      background: `color-mix(in srgb, ${c} 13%, transparent)`,
      color: c,
      borderRadius: 999, whiteSpace: 'nowrap',
    };
  },
  /* Botones de acción de la card (mockup: primary relleno verde flex:1;
     ghost transparente hairline; danger OUTLINE transparente con borde
     danger al 30% — ya no relleno). minHeight 44 = touch target (regla
     global, prima sobre los 42px del mockup). */
  btn: (kind = 'primary') => ({
    minHeight: 44, padding: '0 16px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    borderRadius: 11,
    flex: kind === 'danger' ? '0 0 auto' : '1 1 130px',
    background: kind === 'primary' ? 'var(--lp-brand-600)'
              : kind === 'warning' ? 'var(--lp-warning-600)'
              :                      'transparent',
    color: (kind === 'primary' || kind === 'warning') ? '#fff'
         : kind === 'danger' ? 'var(--lp-danger-600)'
         :                     'var(--lp-text-secondary)',
    border: kind === 'primary' ? '1.5px solid var(--lp-brand-600)'
          : kind === 'warning' ? '1.5px solid var(--lp-warning-600)'
          : kind === 'danger'  ? '1px solid color-mix(in srgb, var(--lp-danger-600) 30%, transparent)'
          :                      '1px solid var(--lp-border-subtle)',
    transition: 'transform .1s',
  }),

  empty: { textAlign: 'center', padding: '50px 0', color: 'var(--lp-text-tertiary)', fontSize: 13 },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 10, fontSize: 12, marginBottom: 12 },

  /* ── Mini pipeline horizontal por card ─────────────────────────────── */
  pipelineWrap: {
    display: 'flex', alignItems: 'center', gap: 0,
    padding: '6px 2px 2px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
  },
  /* (jun 2026, handoff Claude Design) Los nodos del checkpoint usan el
     lenguaje compartido de components/pipeline/Checkpoint.jsx (clases ck*):
     icono por fase, done=✓ relleno, current con halo+pulso. Aquí solo queda
     el layout propio de esta card (columna nodo+label y conector alineado). */
  pipelineStep: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, flex: '0 0 auto', minWidth: 56,
  },
  pipelineDotBox: {
    height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  pipelineLabel: (estado) => ({
    fontSize: 8.5, fontWeight: estado === 'current' ? 700 : 500,
    color: estado === 'current' ? 'var(--lp-text-primary)'
         : estado === 'done'    ? 'var(--lp-text-secondary)'
         : 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '.03em', textAlign: 'center', whiteSpace: 'nowrap',
  }),
  pipelineLine: (done) => ({
    flex: 1, height: 3, borderRadius: 99,
    background: done ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)',
    minWidth: 10, marginBottom: 16, /* sube el conector al centro del dot (label debajo) */
    transition: 'background .35s cubic-bezier(.22,1,.36,1)',
  }),
};

/* Fases canónicas del pipeline de un pedido — espejo del backend.
   Cada fase agrupa varios estados internos (ej: aceptado + en_proceso
   son ambos "Aceptado"). Si el pedido está en cancelado/rechazado,
   no renderizamos el pipeline (no aplica). */
const PIPELINE_FASES = [
  /* `ck` = key de la etapa equivalente en ETAPAS_PEDIDO (Checkpoint.jsx) —
     de ahí salen el icono y el color de fase del lenguaje compartido. */
  { key: 'pendiente',  label: 'Pedido',     estados: ['pendiente'], ck: 'pedido' },
  { key: 'aceptado',   label: 'Aceptado',   estados: ['aceptado', 'en_proceso'], ck: 'aceptado' },
  { key: 'produccion', label: 'Producción', estados: ['en_produccion', 'producido', 'qc_hold', 'qc_aprobado'], ck: 'en_produccion' },
  { key: 'envasado',   label: 'Envasado',   estados: ['en_envasado', 'envasado'], ck: 'en_envasado' },
  { key: 'camino',     label: 'En camino',  estados: ['en_recoleccion', 'en_camino'], ck: 'en_camino' },
  /* jun 2026 (regla owner): en_almacen = recibido en Terán pero con TOTE por
     reenvasar — el pedido sigue ACTIVO. Fase propia para que se vea que falta. */
  { key: 'teran',      label: 'En Terán',   estados: ['en_almacen'], ck: 'en_almacen' },
  { key: 'entregado',  label: 'Entregado',  estados: ['entregado'], ck: 'entregado' },
];

/* Devuelve el índice de fase actual del pedido (0..5) o -1 si no aplica */
function _idxFasePedido(estado) {
  const e = (estado || '').toLowerCase();
  for (let i = 0; i < PIPELINE_FASES.length; i++) {
    if (PIPELINE_FASES[i].estados.includes(e)) return i;
  }
  return -1;
}

/* Componente PipelinePedido — mini timeline horizontal por card.
   FIX jun 2026 (feedback owner): cuando el pipeline no cabe (móvil / card
   estrecha), el contenedor scrollea lateral y se AUTO-CENTRA en el checkpoint
   actual al avanzar — antes el último paso quedaba cortado sin pista visual. */
function PipelinePedido({ estado }) {
  const idx = _idxFasePedido(estado);
  const wrapRef = useRef(null);
  useEffect(() => { injectCkCSS(); }, []);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || idx < 0) return;
    if (wrap.scrollWidth <= wrap.clientWidth + 4) return; /* cabe completo */
    const el = wrap.querySelector('[data-current="1"]');
    if (!el) return;
    const elRect = el.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const target = wrap.scrollLeft + (elRect.left - wrapRect.left) - (wrap.clientWidth / 2) + (elRect.width / 2);
    try { wrap.scrollTo({ left: Math.max(0, target), behavior: 'smooth' }); }
    catch { wrap.scrollLeft = Math.max(0, target); }
  }, [idx, estado]);
  if (idx < 0) return null; /* cancelado/rechazado/eliminado: ocultar */
  /* (jun 2026, handoff Claude Design) Nodos con el lenguaje ck compartido:
     icono por fase con su color (solicitud=info, fabricación=verde,
     logística=ámbar, cierre=verde oscuro), done=✓ relleno, current grande
     con halo+pulso. esPrueba ya se distingue por el badge de la card. */
  const nodos = [];
  PIPELINE_FASES.forEach((fase, i) => {
    const st = i < idx ? 'done' : i === idx ? 'current' : 'pending';
    const etapa = ETAPAS_PEDIDO.find(e => e.key === fase.ck) || ETAPAS_PEDIDO[0];
    const cc = CK_COLOR[etapa.color];
    const Icon = etapa.Icon;
    nodos.push(
      <div key={'s_' + fase.key} data-current={st === 'current' ? '1' : undefined} style={S.pipelineStep}>
        <div style={S.pipelineDotBox}>
          <div className={`cknode ${st}`} style={{ '--cc': cc }}>
            <div className="ckdot">{st === 'done' ? <CkCheck /> : <Icon />}</div>
          </div>
        </div>
        <div style={S.pipelineLabel(st)}>{fase.label}</div>
      </div>
    );
    if (i < PIPELINE_FASES.length - 1) {
      nodos.push(
        <div key={'l_' + fase.key} style={S.pipelineLine(i < idx)} />
      );
    }
  });
  return <div ref={wrapRef} style={S.pipelineWrap}>{nodos}</div>;
}

/* X3 (jun 2026): ESTADO_COLOR y ESTADO_LABEL vienen de lib/estados.js. */

/* ── Urgencia visual del pedido → color del riel izquierdo de la card
   (HANDOFF §4: "riel de color a la izquierda para urgencia").
   danger    = bloqueado / terminal negativo (qc_hold, rechazado, cancelado)
   warning   = espera ACCIÓN humana (aceptar, QC, envasar, recolectar,
               reenvasar TOTE en Terán) — también toda PRUEBA (ámbar global)
   brand     = fluyendo (alguien ya lo está trabajando)
   brand-700 = entregado (cerrado OK) ── */
function urgenciaPedido(p) {
  if (p?.esPrueba) return 'var(--lp-warning-600)';
  const e = (p?.estado || '').toLowerCase();
  if (['qc_hold', 'rechazado', 'cancelado'].includes(e)) return 'var(--lp-danger-600)';
  if (['pendiente', 'producido', 'qc_aprobado', 'envasado', 'en_recoleccion', 'en_almacen'].includes(e)) return 'var(--lp-warning-600)';
  if (e === 'entregado') return 'var(--lp-brand-700)';
  return 'var(--lp-brand-600)'; /* aceptado, en_proceso, en_produccion, en_envasado, en_camino */
}

/* Fecha relativa corta del mockup ("hace 1 h", "ayer 17:55", "2 jun").
   El datetime completo va en title= para no perder precisión. */
function fmtRel(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const hoy = new Date();
    const hm = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoy.toDateString()) {
      const min = Math.floor((hoy.getTime() - d.getTime()) / 60000);
      if (min < 1) return 'ahora';
      if (min < 60) return `hace ${min} min`;
      const h = Math.floor(min / 60);
      if (h < 6) return `hace ${h} h`;
      return `hoy ${hm}`;
    }
    const ayer = new Date(hoy.getTime() - 86400000);
    if (d.toDateString() === ayer.toDateString()) return `ayer ${hm}`;
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

/* ── Embudo de KPIs (mockup Pedidos.html / HANDOFF §5): contadores EN VIVO
   del ciclo completo. Cada etapa agrupa estados reales del backend; los
   colores reutilizan las fases del lenguaje ck (Checkpoint.jsx) para que el
   embudo y el checkpoint de cada card hablen el mismo idioma.
   Excluye pruebas y rechazados/cancelados (no son flujo operativo);
   "Entregados" usa el MISMO conteo que la pestaña Historial (pedidos
   entregados + órdenes internas terminadas) para que ambos cuadren. ── */
const EMBUDO_ETAPAS = [
  { key: 'pendientes', label: 'Pendientes', color: CK_COLOR.info,   estados: ['pendiente', 'aceptado', 'en_proceso'] },
  { key: 'produccion', label: 'Producción', color: CK_COLOR.brand,  estados: ['en_produccion'] },
  { key: 'qc',         label: 'QC',         color: CK_COLOR.purple, estados: ['producido', 'qc_hold'] },
  { key: 'envasando',  label: 'Envasando',  color: CK_COLOR.brand,  estados: ['qc_aprobado', 'en_envasado', 'envasado'] },
  { key: 'camino',     label: 'Camino',     color: CK_COLOR.amber,  estados: ['en_recoleccion', 'en_camino', 'en_almacen'] },
  { key: 'entregados', label: 'Entregados', color: CK_COLOR.brandd, estados: ['entregado'] },
];

function EmbudoPedidos({ pedidosActivos, totalEntregados }) {
  const nodos = [];
  EMBUDO_ETAPAS.forEach((et, i) => {
    const n = et.key === 'entregados'
      ? totalEntregados
      : pedidosActivos.filter(p => et.estados.includes((p.estado || '').toLowerCase())).length;
    nodos.push(
      <div key={et.key} style={S.funnelStage} title={`Estados: ${et.estados.join(', ')}`}>
        <div style={S.funnelVal(et.color)}>{n}</div>
        <div style={S.funnelLabel}>{et.label}</div>
      </div>
    );
    if (i < EMBUDO_ETAPAS.length - 1) {
      nodos.push(
        <div key={'sep_' + et.key} style={S.funnelSep} aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </div>
      );
    }
  });
  return <div style={S.funnel} role="group" aria-label="Embudo de pedidos">{nodos}</div>;
}

export default function PedidosPage() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('activos');
  const [showNuevo, setShowNuevo] = useState(false);
  /* Prefill desde otra pantalla (Inventario → "Pedir reposición" ?nuevo=BLANCO MATE) */
  const [prefillProducto, setPrefillProducto] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [confirm, ConfirmEl] = useConfirm();
  /* NDA gate — pendingProd guarda el pedido a iniciar mientras el usuario lee el NDA */
  const [pendingProd, setPendingProd] = useState(null);
  /* FIX jun 2026 (auditoría M2): "Ir al pedido" desde Órdenes navega con ?focus=
     — antes PedidosPage lo ignoraba (aterrizaba sin contexto). Ahora resalta y
     hace scroll a esa card. */
  const [focusId, setFocusId] = useState(null);

  /* Si la URL trae ?nuevo=NombreProducto, abrir modal; ?focus=ID → resaltar card */
  useEffect(() => {
    const nuevo = searchParams.get('nuevo');
    const focus = searchParams.get('focus');
    if (nuevo) {
      setPrefillProducto(nuevo);
      setShowNuevo(true);
    }
    if (focus) setFocusId(focus);
    if (nuevo || focus) {
      /* Limpiar el query param para que un refresh no vuelva a disparar. */
      const params = new URLSearchParams(searchParams);
      params.delete('nuevo'); params.delete('focus');
      setSearchParams(params, { replace: true });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const { data, loading, reload } = useApiData(() => api.getPedidos(), [], 8000);

  /* Scroll + realce a la card enfocada (?focus=) cuando llegue la data */
  useEffect(() => {
    if (!focusId || loading) return;
    const el = document.getElementById('ped-' + focusId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const t = setTimeout(() => setFocusId(null), 2600);
      return () => clearTimeout(t);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [focusId, loading, data]);
  /* Trazabilidad: para resolver el lote asociado a cada pedido y mostrar las
     acciones de state machine directamente en la card. Polling lento — el WS
     trae los cambios en tiempo real. */
  const { data: trazData, reload: reloadTraz } = useApiData(() => api.getTrazabilidad(), [], 30000);
  const lotes = useMemo(() => {
    const arr = trazData?.data || trazData || [];
    return Array.isArray(arr) ? arr : [];
  }, [trazData]);

  /* Órdenes: para incluir las ÓRDENES INTERNAS terminadas (sin pedido fuente)
     en el Historial. Una orden interna ("origen: interna") nunca crea pedido,
     así que sin esto el trabajo completado por orden directa quedaba invisible
     en Pedidos. Polling lento — el historial no es time-critical. */
  const { data: ordData, reload: reloadOrd } = useApiData(() => api.getOrdenes(), [], 30000);

  /* FIX jun 2026 (feedback owner): "Re-envasar TOTE" abre el modal EMERGENTE
     aquí mismo (como el envasado de fábrica), ya no navega a otra página.
     jun 2026 (decisión owner): "Envasar" también abre el EnvasadoModal EN
     SITIO con un solo click — antes navegaba a /stock-fabrica y obligaba a
     volver a pulsar "Envasar" allá (doble click). */
  const { data: envData } = useApiData(() => api.getEnvases(), null, 30000);
  const envases = envData?.data || envData || null;
  const [envasarModal, setEnvasarModal] = useState(null);     /* lote */
  const [reenvasarModal, setReenvasarModal] = useState(null); /* lote */
  const [printQR, setPrintQR] = useState(null);

  /* Realtime: refrescar cuando hay cambios */
  useRealtimeSync({
    onPedidos: () => reload(),
    onOrdenes: () => { reload(); reloadOrd(); },
    onTrazabilidad: () => { reload(); reloadTraz(); reloadOrd(); },
  });

  const pedidos = useMemo(() => {
    const arr = Array.isArray(data) ? data : (data?.data || []);
    /* CRÍTICO: filtrar pedidos marcados como eliminados (estado='eliminado'
       o flag eliminado=true). El backend marca soft-delete para auditoría,
       pero el frontend NO debe mostrarlos en ninguna lista. Sin este filtro
       parecía que "el botón Cancelar no funcionaba" porque el pedido
       seguía visible aunque ya estaba eliminado en JSON. */
    return arr.filter(p => p && p.id && !p.eliminado && p.estado !== 'eliminado');
  }, [data]);

  /* Estados terminales = histórico */
  const TERMINALES = ['entregado', 'rechazado', 'cancelado'];
  /* Activos REALES (sin pruebas, sin terminales) */
  const activos    = pedidos.filter(p => !TERMINALES.includes(p.estado) && !p.esPrueba);
  /* Pruebas activas separadas */
  const pruebas    = pedidos.filter(p => !TERMINALES.includes(p.estado) && p.esPrueba);
  /* Rechazados / cancelados separados del histórico normal */
  const rechazados = pedidos.filter(p => p.estado === 'rechazado' || p.estado === 'cancelado');

  /* Órdenes INTERNAS terminadas (entregadas, sin pedido) → entradas equivalentes
     a un pedido completado, mapeadas a la forma de pedido para reusar la card.
     `_esOrdenInterna` marca la entrada para ocultar acciones que no aplican a
     una orden (eliminar pedido). El id se conserva = o.id para que
     PedidoLoteActions resuelva el lote por ordenId; `_folio` muestra el código
     legible (OP-…). */
  const ordenesInternasHist = useMemo(() => {
    const arr = ordData?.data || ordData || [];
    return (Array.isArray(arr) ? arr : [])
      .filter(o => o && !o.eliminado
        && (o.origen === 'interna' || !o.pedidoId)
        && o.estado === 'entregado'
        && !o.esPrueba)
      .map(o => ({
        ...o,
        _esOrdenInterna: true,
        _folio: o.codigo || o.id,
        producto: o.producto || o.formula,
        cantidad: o.cantidad,
        estado: o.estado,
        esPrueba: !!o.esPrueba,
        fecha: o.fecha || o.fechaCreacion || o.fechaRequerida,
        creadoPor: o.usuario,
      }));
  }, [ordData]);

  /* Historial = entregados (operación completada exitosa): pedidos + órdenes internas */
  const historial  = [
    ...pedidos.filter(p => p.estado === 'entregado' && !p.esPrueba),
    ...ordenesInternasHist,
  ];

  /* (jun 2026, mockup Pedidos.html: la fila de KPIs regresa como EMBUDO —
     <EmbudoPedidos> computa los contadores en vivo de activos+historial) */
  const canCrear = can('crearPedidos') || can('admin') || user?.rol === 'almacen';
  const canAceptar = can('admin') || user?.rol === 'tecnico';

  /* Sprint C: aceptar pedido AHORA crea orden atómicamente vía endpoint
     /api/pedidos/aceptar-y-producir. Antes hacía upsertPedido ciego, lo cual:
     (a) pisaba el estado si otro usuario lo había cambiado entre fetch y click,
     (b) dejaba el pedido sin orden vinculada (huérfano hasta que técnico la
         creara manualmente desde otra pantalla, frecuentemente sin pedidoId). */
  const handleAceptar = async (p) => {
    setErr(''); setBusyId(p.id);
    try {
      const r = await api.aceptarYProducir(p.id, { lanzarProduccion: false });
      if (!r?.ok) throw new Error(r?.error || 'No se pudo aceptar');
      reload();
    } catch (e) {
      setErr(e?.data?.error || e.message);
    } finally {
      setBusyId('');
    }
  };

  /* Cancelar pedido — UN solo botón unificado.
     - Admin: motivo + PIN → llama /api/pedidos/eliminar (cascada orden, revierte MP)
     - Otros roles autorizados (técnico) en pedidos no producidos: solo motivo,
       cambia estado a rechazado (sin PIN porque no hay MP que revertir aún)
     Se muestra siempre que el pedido NO esté en estado terminal. */
  const handleCancelar = async (p) => {
    setErr('');
    const esAdmin = user?.rol === 'admin';
    const yaProdujo = ['en_produccion','producido','qc_hold','qc_aprobado','en_envasado','envasado','en_recoleccion','en_camino','en_almacen'].includes(p.estado);

    /* Paso 1: motivo (común) */
    const motivo = await confirm(
      esAdmin
        ? `Vas a cancelar el pedido ${p.id} de ${p.producto}. ${yaProdujo ? 'Como ya entró a producción, se revertirán las materias primas consumidas. ' : ''}Indica el motivo para auditoría.`
        : `Vas a cancelar el pedido ${p.id} de ${p.producto}. Indica el motivo para dejar registro.`,
      {
        title: esAdmin ? 'Cancelar pedido — paso 1 de 2' : 'Cancelar pedido',
        confirmText: esAdmin ? 'Continuar' : 'Cancelar pedido',
        danger: true,
        prompt: {
          label: 'Motivo',
          placeholder: 'Ej: Pedido duplicado, error de captura, cliente canceló...',
          required: true,
          minLength: 5,
          rows: 3,
        },
      }
    );
    if (!motivo) return;

    /* Paso 2: PIN (solo admin) */
    let pin = null;
    if (esAdmin) {
      pin = await confirm(
        `Para confirmar, ingresa tu PIN (${user?.nombre}).`,
        {
          title: 'Cancelar pedido — paso 2 de 2',
          confirmText: 'Confirmar cancelación',
          danger: true,
          prompt: {
            label: 'PIN',
            placeholder: '0000',
            required: true,
            minLength: 4, maxLength: 6,
            rows: 1, numeric: true, password: true,
          },
        }
      );
      if (!pin) return;
    }

    setBusyId(p.id);
    try {
      if (esAdmin) {
        const r = await api.eliminarPedido(p.id, user?.nombre, pin, motivo);
        const msg = `Pedido ${p.id} cancelado` +
          (r?.revirtioMP ? ' · MP revertida' : '') +
          (r?.ordenInfo ? ' · orden ' + r.ordenInfo.codigo + ' también' : '');
        console.log('[CANCELAR]', msg);
        setErr(''); /* limpiar errores previos */
      } else {
        /* FIX jun 2026 (auditoría): endpoint dedicado — valida el estado
           server-side y CANCELA la orden vinculada. El upsert anterior dejaba
           la orden huérfana viva (producible) y podía pisar campos con caché. */
        await api.rechazarPedido(p.id, motivo);
      }
      reload();
    } catch (e) {
      console.error('[CANCELAR] error:', e);
      setErr('No se pudo cancelar: ' + (e?.data?.error || e.message || 'error desconocido'));
    } finally {
      setBusyId('');
    }
  };

  /* §7 Eliminar pedido — SOLO admin (data-rol="admin").
     Distinto de Cancelar/Rechazar: borrado definitivo (soft-delete con
     auditoría) que también cae en cascada sobre la orden vinculada y revierte
     las materias primas si el pedido ya había entrado a producción. Pide
     motivo + PIN del admin, igual que la ruta admin de handleCancelar pero
     etiquetado explícitamente como "Eliminar" para coincidir con el mockup. */
  const handleEliminar = async (p) => {
    setErr('');
    const yaProdujo = ['en_produccion','producido','qc_hold','qc_aprobado','en_envasado','envasado','en_recoleccion','en_camino','en_almacen'].includes(p.estado);

    const motivo = await confirm(
      `Vas a ELIMINAR el pedido ${p.id} de ${p.producto}. ${yaProdujo ? 'Como ya entró a producción, se revertirán las materias primas consumidas. ' : ''}Esta acción queda registrada para auditoría. Indica el motivo.`,
      {
        title: 'Eliminar pedido — paso 1 de 2',
        confirmText: 'Continuar',
        danger: true,
        prompt: {
          label: 'Motivo',
          placeholder: 'Ej: Pedido duplicado, captura errónea...',
          required: true,
          minLength: 5,
          rows: 3,
        },
      }
    );
    if (!motivo) return;

    const pin = await confirm(
      `Para confirmar la eliminación, ingresa tu PIN (${user?.nombre}).`,
      {
        title: 'Eliminar pedido — paso 2 de 2',
        confirmText: 'Eliminar definitivamente',
        danger: true,
        prompt: {
          label: 'PIN',
          placeholder: '0000',
          required: true,
          minLength: 4, maxLength: 6,
          rows: 1, numeric: true, password: true,
        },
      }
    );
    if (!pin) return;

    setBusyId(p.id);
    try {
      const r = await api.eliminarPedido(p.id, user?.nombre, pin, motivo);
      const msg = `Pedido ${p.id} eliminado` +
        (r?.revirtioMP ? ' · MP revertida' : '') +
        (r?.ordenInfo ? ' · orden ' + r.ordenInfo.codigo + ' también' : '');
      console.log('[ELIMINAR]', msg);
      setErr('');
      reload();
    } catch (e) {
      console.error('[ELIMINAR] error:', e);
      setErr('No se pudo eliminar: ' + (e?.data?.error || e.message || 'error desconocido'));
    } finally {
      setBusyId('');
    }
  };

  /* Sprint C: arrancar producción usa endpoint canónico que CREA orden
     (si no existe) + avanza pedido a en_produccion + setea fechaInicio.
     Antes hacía upsertPedido ciego sin crear orden formal — los lotes
     producidos así NO aparecían en KPI "En Proceso" de Órdenes/Fábrica
     y se descuadraba la reportería. */
  const arrancarProduccion = async (p) => {
    if (!p) return;
    setBusyId(p.id);
    try {
      /* ndaAceptado: arrancarProduccion solo se invoca tras pasar el NDAModal
         (handleNDAAccept) o con bypass admin — el server lo exige (Pre#3). */
      const r = await api.aceptarYProducir(p.id, { lanzarProduccion: true, ndaAceptado: true });
      if (!r?.ok) throw new Error(r?.error || 'No se pudo iniciar producción');
      reload();
      /* ?continuar=<id>: aterrizar en Producción con el WIZARD del lote ya
         abierto, en vez de soltar a Enrique en la lista a buscar el card que
         "saltó" de sub-pestaña al cambiar de estado. ProduccionPage matchea por
         id o pedidoId y abre prodModal directo. */
      navigate('/produccion?continuar=' + encodeURIComponent(p.id));
    } catch (e) {
      setErr(e?.data?.error || e.message);
    } finally {
      setBusyId('');
    }
  };

  /* Iniciar producción: muestra NDA al técnico/admin antes de arrancar.
     Bypass: Emmanuel (id='admin') es el propietario y arranca sin modal.
     FIX jun 2026 (reparación censo): VALIDAR STOCK MP antes de lanzar — el
     widget de validación vivía en el panel eliminado de Órdenes; sin esto se
     podía producir sin MP (el descuento hace clamp a 0 silencioso). */
  const handleIniciarProduccion = async (p) => {
    setErr('');
    try {
      setBusyId(p.id);
      const v = await api.validarStock(p.producto, p.cantidad);
      if (v && v.suficiente === false) {
        const falt = (v.faltantes || []).slice(0, 4)
          .map(f => `${f.mp} (faltan ${Number(f.faltanteKg || 0).toFixed(1)} kg)`).join(' · ');
        setErr(`Stock MP insuficiente para producir ${p.producto} ×${p.cantidad}: ${falt}${(v.faltantes || []).length > 4 ? ' …' : ''}. Recibe MP o ajusta inventario antes de iniciar.`);
        return;
      }
    } catch (e) {
      /* Si la validación falla (red/endpoint), NO bloquear el flujo. */
    } finally {
      setBusyId('');
    }
    /* NDA: el propietario (admin) o quien YA aceptó dentro de la vigencia de 7
       días arranca directo — sin re-mostrar el aviso. Antes solo se exceptuaba
       a admin, así que el técnico re-consentía el NDA en CADA pantalla/acción
       (Pedidos → Producción → Órdenes) aunque lo hubiera aceptado segundos
       antes. Misma key 'produccion' que el resto del pipeline. */
    if ((user && user.id === 'admin') || ndaYaAceptado(user, 'produccion')) {
      arrancarProduccion(p);
      return;
    }
    setPendingProd(p);  /* dispara el modal NDA (solo si no hay vigencia vigente) */
  };

  /* Callback cuando el usuario acepta el NDA.
     OJO (Bug-NDA): cerramos el modal (setPendingProd null) ANTES del await
     para que no quede colgado mientras la producción arranca. No reordenar. */
  const handleNDAAccept = async () => {
    const p = pendingProd;
    setPendingProd(null);
    await arrancarProduccion(p);
  };

  const handleNDAReject = () => {
    setPendingProd(null);
    setErr('NDA rechazado — la producción NO se inició.');
  };

  const lista = tab === 'pruebas'    ? pruebas
              : tab === 'rechazados' ? rechazados
              : tab === 'historial'  ? historial
              :                        activos;
  /* Ordenar por fecha desc */
  const listaOrdenada = [...lista].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  /* Pills de filtro — Activos / Pruebas (si hay) / Rechazados (si hay) / Historial */
  const FILTROS = [
    { value: 'activos',    label: 'Activos',    count: activos.length,    flask: false },
    /* Pruebas SIEMPRE visible (sub-tab estándar), aunque no haya pedidos de prueba. */
    { value: 'pruebas',    label: 'Pruebas',    count: pruebas.length,    flask: true },
    ...(rechazados.length > 0 ? [{ value: 'rechazados', label: 'Rechazados', count: rechazados.length, flask: false }] : []),
    { value: 'historial',  label: 'Historial',  count: historial.length,  flask: false },
  ];

  return (
    <div>
      <TopBar
        title="Pedidos"
        action={canCrear && isDesktop ? (
          /* Paquete MOCKUP 8 (lp-createbtn): en móvil el botón inline se
             oculta — lo cubre el FAB flotante de abajo. */
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999, border: 'none', background: 'var(--lp-brand-600)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', minHeight: 40, whiteSpace: 'nowrap' }}
            data-id="pedidos.btn.nuevo"
            data-rol="almacen,admin,tecnico"
            onClick={() => setShowNuevo(true)}
          >
            {Icon.plus}Nuevo
          </button>
        ) : null}
      />
      {/* FAB móvil (paquete MOCKUP 8) — misma acción que "+ Nuevo" */}
      {canCrear && (
        <Fab label="Nuevo pedido" dataId="pedidos.fab.nuevo" dataRol="almacen,admin,tecnico"
          onClick={() => setShowNuevo(true)} />
      )}
      <div style={S.wrap}>
        {err && <div style={S.err}>{err}</div>}

        {/* Subtítulo vivo por pestaña (tsub del mockup) */}
        <div style={S.tsub}>
          {tab === 'activos' ? `${activos.length} activos · esperan tu acción`
            : tab === 'pruebas' ? `${pruebas.length} en modo prueba`
            : tab === 'rechazados' ? `${rechazados.length} rechazados o cancelados`
            : `${historial.length} entregados`}
        </div>

        {/* Embudo de KPIs en vivo (mockup/HANDOFF §5) */}
        <EmbudoPedidos pedidosActivos={activos} totalEntregados={historial.length} />

        {/* Filtros (el botón "Nuevo" vive en el TopBar, estilo limpio) */}
        <div style={S.toolbar}>
          <div style={S.pillRow} role="tablist" aria-label="Filtro de pedidos">
            {FILTROS.map(f => {
              const active = tab === f.value;
              return (
                <button
                  key={f.value}
                  role="tab"
                  aria-selected={active}
                  style={S.pill(active)}
                  onClick={() => setTab(f.value)}
                >
                  {f.flask && Icon.flask}
                  {f.label}
                  <span style={S.pillCount(active)}>· {f.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista — escritorio: grid g3 (cards anchas). móvil: cards apiladas. */}
        {loading && pedidos.length === 0 ? (
          <div style={S.empty}>Cargando pedidos…</div>
        ) : listaOrdenada.length === 0 ? (
          <div style={S.empty}>
            {tab === 'activos' ? 'No hay pedidos activos. ' + (canCrear ? 'Toca "+ Nuevo pedido" para crear uno.' : 'Espera a que almacén cree uno.') : 'Sin pedidos en este filtro.'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            /* FIX jun 2026 (feedback owner): 340px cortaba el último paso del
               pipeline en desktop. 460px = caben las 7 fases (incl. En Terán). */
            gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(460px, 1fr))' : '1fr',
            gap: 12,
          }}>
          {listaOrdenada.map(p => {
            /* FIX jun 2026 (auditoría #5): la pestaña PRUEBAS tiene los mismos
               botones de ciclo — la regla del owner es que las pruebas se
               comportan IDÉNTICAS al flujo real. Antes solo 'activos' los
               mostraba y un pedido de prueba no se podía aceptar/iniciar. */
            const tabOperable = tab === 'activos' || tab === 'pruebas';
            const mostrarAceptar = tabOperable && p.estado === 'pendiente' && canAceptar;
            const mostrarIniciar = tabOperable && p.estado === 'aceptado' && canAceptar;
            const mostrarIrProduccion = tabOperable && p.estado === 'en_produccion' && canAceptar;
            /* Cancelar disponible siempre que el pedido no esté en estado terminal.
               Admin puede cancelar cualquier pedido (cascada orden + reversa MP).
               Técnico solo pedidos pendientes/aceptados (no producidos aún). */
            const esTerminal = TERMINALES.includes(p.estado);
            const puedeAdminCancelar = user?.rol === 'admin' && !esTerminal;
            const puedeTecnicoCancelar = canAceptar && !puedeAdminCancelar && ['pendiente', 'aceptado'].includes(p.estado);
            const mostrarCancelar = (puedeAdminCancelar || puedeTecnicoCancelar) && tabOperable;
            /* §7: Eliminar = SOLO admin. No se renderiza para otros roles.
               Disponible en cualquier filtro mientras el pedido no esté ya
               eliminado (los terminales sí pueden eliminarse del histórico). */
            const esAdmin = user?.rol === 'admin';
            /* Las órdenes internas mostradas en el Historial NO son pedidos:
               el botón "Eliminar pedido" no aplica (rompería contra un id de
               orden). Se oculta para esas entradas. */
            const mostrarEliminar = esAdmin && !p._esOrdenInterna;
            const tieneAcciones = mostrarAceptar || mostrarIniciar || mostrarIrProduccion || mostrarCancelar || mostrarEliminar;
            return (
              <div key={p.id} id={'ped-' + p.id} style={{ ...S.pedidoCard(p.estado, p.esPrueba), ...(p.id === focusId ? { outline: '2px solid var(--lp-brand-600)', outlineOffset: 2, boxShadow: '0 0 0 4px color-mix(in srgb, var(--lp-brand-600) 18%, transparent)' } : {}) }}>
                {/* Riel izquierdo de urgencia (mockup/HANDOFF §4) */}
                <span aria-hidden="true" style={S.pedidoRail(urgenciaPedido(p))} />
                {/* Header: folio + badge estado + prueba + cronómetro */}
                <div style={S.pedidoHeader}>
                  <span style={S.pedidoId}>{p._folio || p.id}</span>
                  <span style={S.estadoBadge(p.estado)}>{ESTADO_LABEL[p.estado] || p.estado}</span>
                  {p._esOrdenInterna && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-tertiary)', letterSpacing: '.04em', textTransform: 'uppercase' }}>Interna</span>
                  )}
                  {p.esPrueba && <PruebaBadge size="sm" />}
                  {p.estado === 'en_produccion' && p.fechaInicioProduccion && (
                    <span style={{ marginLeft: 'auto' }}>
                      <Cronometro desde={p.fechaInicioProduccion} />
                    </span>
                  )}
                </div>

                {/* Mini-pipeline horizontal del estado del pedido. Ayuda visual
                    rápida — el operario ve la fase de un vistazo. Mockup: las
                    cards ENTREGADAS (historial) van compactas, sin timeline. */}
                {p.estado !== 'entregado' && (
                  <PipelinePedido estado={p.estado} esPrueba={p.esPrueba} />
                )}

                {/* Cuerpo: título + metadata (mockup: título = producto;
                    "52 cubetas · solicitó Josué · hace 1 h" en la meta).
                    Extras que el mockup omite y se CONSERVAN: lote, creadoPor,
                    quién inició producción. */}
                <div style={S.pedidoBody}>
                  <div style={S.pedidoTitle}>{p.producto}</div>
                  <div style={S.pedidoMeta}>
                    <span style={S.cantidad}>{etiquetaMedidaReal(p.medida, p.medidaQty, p.cantidad) || `${p.cantidad} cubetas`}</span>
                    {p.solicitante && <> · solicitó <strong>{p.solicitante}</strong></>}
                    {p.fecha && <span title={new Date(p.fecha).toLocaleString('es-MX')}> · {fmtRel(p.fecha)}</span>}
                    {p.lote && <> · Lote <code style={{ fontFamily: 'var(--lp-font-mono)' }}>{p.lote}</code></>}
                    {p.creadoPor && p.creadoPor !== p.solicitante && <> · por {p.creadoPor}</>}
                    {p.estado === 'en_produccion' && p.produccionIniciadaPor && (
                      <> · Producción por <strong>{p.produccionIniciadaPor}</strong></>
                    )}
                  </div>
                </div>

                {/* Footer: acciones del pedido por estado. data-id/data-rol del
                    mockup cableados a los handlers reales. */}
                {tieneAcciones && (
                  <div style={S.pedidoActions}>
                    {mostrarAceptar && (
                      <button
                        style={S.btn('primary')}
                        data-id="pedidos.btn.aceptar-producir"
                        data-rol="tecnico,admin"
                        disabled={busyId === p.id}
                        onClick={() => handleAceptar(p)}
                      >
                        {busyId === p.id ? '…' : <>{Icon.check} Aceptar y producir</>}
                      </button>
                    )}
                    {mostrarIniciar && (
                      <button
                        style={S.btn('primary')}
                        data-id="pedidos.btn.iniciar-produccion"
                        data-rol="tecnico,admin"
                        disabled={busyId === p.id}
                        onClick={() => handleIniciarProduccion(p)}
                        title="Arranca el cronómetro y abre la pantalla de producción"
                      >
                        {busyId === p.id ? '…' : <>{Icon.play} Iniciar producción</>}
                      </button>
                    )}
                    {mostrarIrProduccion && (
                      /* mockup: en_produccion lleva botón GHOST (la acción
                         fuerte ya ocurrió; esto solo navega al wizard) */
                      <button
                        style={S.btn('ghost')}
                        data-id="pedidos.btn.ir-produccion"
                        data-rol="tecnico,admin"
                        onClick={() => navigate('/produccion')}
                        title="Ir a Producción para completar el lote"
                      >
                        Ir a Producción {Icon.arrow}
                      </button>
                    )}
                    {/* Cancelar / Rechazar UNIFICADO. Admin: motivo + PIN +
                        reversa MP. Técnico: solo motivo → rechazado. */}
                    {mostrarCancelar && (
                      <button
                        style={S.btn('danger')}
                        data-id={user?.rol === 'admin' ? 'pedidos.btn.cancelar' : 'pedidos.btn.rechazar'}
                        data-rol="tecnico,admin"
                        disabled={busyId === p.id}
                        onClick={() => handleCancelar(p)}
                        title={user?.rol === 'admin'
                          ? 'Cancelar pedido (pide motivo + PIN; revierte MP si aplica)'
                          : 'Rechazar pedido (pide motivo)'}
                      >
                        {busyId === p.id ? '…' : <>{Icon.x} {user?.rol === 'admin' ? 'Cancelar' : 'Rechazar'}</>}
                      </button>
                    )}
                    {/* §7: Eliminar pedido — SOLO admin (data-rol="admin"). */}
                    {mostrarEliminar && (
                      <button
                        style={S.btn('danger')}
                        data-id="pedidos.btn.eliminar"
                        data-rol="admin"
                        disabled={busyId === p.id}
                        onClick={() => handleEliminar(p)}
                        title="Eliminar pedido definitivamente (solo admin; pide motivo + PIN)"
                      >
                        {busyId === p.id ? '…' : <>{Icon.trash} Eliminar</>}
                      </button>
                    )}
                  </div>
                )}

                {/* Panel de acciones del LOTE asociado — punto único de control.
                    Aparece solo cuando ya hay lote en trazabilidad. Muestra
                    QC (data-id="pedidos.btn.registrar-qc"), marcar envasado, etc.,
                    según el estado y rol. No se renderiza si el lote no existe. */}
                <PedidoLoteActions
                  pedido={p}
                  lotes={lotes}
                  userRol={user?.rol}
                  userName={user?.nombre || '?'}
                  onSuccess={() => {
                    reload();
                    reloadTraz();
                    /* ack visual mínimo — limpiar error previo */
                    setErr('');
                  }}
                  onError={(msg) => setErr(msg)}
                  onEnvasarInline={(l) => setEnvasarModal(l)}
                  onReenvasarInline={(tote, lote) => setReenvasarModal({ lote, toteCod: tote?.cod })}
                  onPrintQR={(s, l) => setPrintQR({ lote: l, sublotes: [s], tipo: s.tipo, q: s.qty, isTote: s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1 })}
                />
              </div>
            );
          })}
          </div>
        )}
      </div>

      {showNuevo && (
        <NuevoPedidoModal
          prefillProducto={prefillProducto}
          onClose={() => { setShowNuevo(false); setPrefillProducto(null); }}
          onCreated={() => { setShowNuevo(false); setPrefillProducto(null); reload(); }}
        />
      )}

      {/* Envasado inline — mismo modal canónico de Stock Fábrica; abre con UN
          solo click desde la card (antes navegaba a /stock-fabrica y había que
          volver a pulsar "Envasar" allá). Imprime QR del sublote al terminar. */}
      {envasarModal && (
        <EnvasadoModal
          lote={envasarModal}
          envases={envases}
          userName={user?.nombre || '?'}
          onClose={() => setEnvasarModal(null)}
          onSuccess={(payload) => {
            setEnvasarModal(null);
            reload(); reloadTraz(); reloadOrd();
            const s = payload?.sublotes?.[0];
            if (s?.qrPayload || s?.cod) setPrintQR(payload);
          }}
        />
      )}

      {/* Re-envasado de TOTE inline (modal emergente, como el envasado de fábrica) */}
      {reenvasarModal && (
        <ReenvasadoModal
          lote={reenvasarModal.lote || reenvasarModal}
          toteInicial={reenvasarModal.toteCod}
          envases={envases}
          userName={user?.nombre || '?'}
          onClose={() => setReenvasarModal(null)}
          onSuccess={(payload) => {
            setReenvasarModal(null);
            reload(); reloadTraz();
            const s = payload?.sublotes?.[0];
            if (s?.qrPayload || s?.cod) setPrintQR(payload);
          }}
        />
      )}
      {printQR && <SubloteQRPrintModal payload={printQR} onClose={() => setPrintQR(null)} />}

      {/* Aviso NDA antes de iniciar producción — fórmula = secreto industrial */}
      {pendingProd && (
        <NDAModal
          user={user}
          context="produccion"
          productoNombre={pendingProd.producto}
          onAccept={handleNDAAccept}
          onReject={handleNDAReject}
        />
      )}
      {ConfirmEl}
    </div>
  );
}
