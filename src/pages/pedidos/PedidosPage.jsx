import { useState, useMemo, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useConfirm from '../../hooks/useConfirm';
import CorregirCantidadModal from '../../components/CorregirCantidadModal';
import useIsDesktop from '../../hooks/useIsDesktop';
import Cronometro from '../../components/Cronometro';
import NDAModal, { ndaYaAceptado } from '../../components/NDAModal';
import NuevoPedidoModal from './NuevoPedidoModal';
import PedidoLoteActions from '../../components/PedidoLoteActions';
import { EnvasadoModal, ReenvasadoModal, SubloteQRPrintModal } from '../stock-fabrica/StockFabricaPage';
import PruebaBadge from '../../components/ui/PruebaBadge';
/* Lenguaje visual del checkpoint (handoff Claude Design jun 2026) */
import { CK_COLOR } from '../../components/pipeline/Checkpoint';
import {
  ESTADO_PEDIDO_LABEL as ESTADO_LABEL,
  ESTADO_PEDIDO_COLOR as ESTADO_COLOR,
  bucketPedido, esPedidoTerminal, normEstado, esPedidoFueraDeFabrica,
} from '../../lib/estados';
import { etiquetaMedidaReal } from '../../utils/ptMedidas';
import humanizeError from '../../utils/humanizeError'; /* AUDIT UX 16-jul (U4) */

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

/* ═══════════════════════════════════════════════════════════════════════
   Diseño "glass forest" de la card de pedido (handoff Card Progreso Pedido,
   jun 2026). PC = barra de 7 segmentos + numeral (1b); móvil = línea de tiempo
   vertical (1c). Colores hardcodeados del handoff (tema claro forest); la
   LÓGICA (estado→fase, acciones, permisos) queda intacta.
   ═══════════════════════════════════════════════════════════════════════ */
const FOREST = '#0f7a5a';
const F_TXT = '#16201c';
const F_TXT2 = '#5a6b63';
const F_TENUE = '#9aa8a2';

/* Iconos por paso, tamaño explícito (paths EXACTOS del mockup). El orden
   coincide con PIPELINE_FASES: 0 Pedido · 1 Aceptado · 2 Producción ·
   3 Envasado · 4 En camino · 5 En Terán · 6 Entregado. */
function PasoIcon({ idx, size = 16, color = 'currentColor' }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  switch (idx) {
    case 0: return (<svg {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>);
    case 1: return (<svg {...p}><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-4.5"/></svg>);
    case 2: return (<svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
    case 3: return (<svg {...p}><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>);
    case 4: return (<svg {...p}><path d="M1 3h13v11H1z"/><path d="M14 7h4l3 3v4h-7V7z"/><circle cx="5.5" cy="17.5" r="2.2"/><circle cx="17.5" cy="17.5" r="2.2"/></svg>);
    case 5: return (<svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>);
    default: return (<svg {...p}><path d="M20 6 9 17l-5-5"/></svg>);
  }
}

/* ProgresoPedido — barra de 7 segmentos + iconos (desktop 1b) o línea de
   tiempo vertical (móvil 1c). Reusa _idxFasePedido + PIPELINE_FASES (misma
   lógica estado→fase que antes). idx<0 (cancelado/rechazado) → no renderiza. */
function ProgresoPedido({ estado, isDesktop }) {
  const idx = _idxFasePedido(estado);
  if (idx < 0) return null;
  const total = PIPELINE_FASES.length;

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: FOREST, fontWeight: 500 }}>Paso {idx + 1} de {total} · {PIPELINE_FASES[idx].label}</span>
          <span style={{ color: F_TENUE }}>{PIPELINE_FASES[total - 1].label}</span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {PIPELINE_FASES.map((f, i) => (
            <div key={f.key} style={{ flex: 1, height: 7, borderRadius: 99, background: i <= idx ? FOREST : 'rgba(0,0,0,.10)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {PIPELINE_FASES.map((f, i) => (
            <div key={f.key} style={{ width: 30, display: 'flex', justifyContent: 'center' }} title={f.label}>
              <PasoIcon idx={i} size={16} color={i < idx ? FOREST : i === idx ? F_TXT : F_TENUE} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* Móvil 1c — línea de tiempo vertical (línea guía + nodo + etiqueta + "en curso") */
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 16 }}>
      <div style={{ position: 'absolute', left: 18, top: 32, bottom: 14, width: 2, background: 'rgba(0,0,0,.10)' }} />
      {PIPELINE_FASES.map((f, i) => {
        const st = i < idx ? 'done' : i === idx ? 'current' : 'pending';
        const nodeStyle = st === 'current'
          ? { background: FOREST, color: '#fff', border: 'none', boxShadow: '0 0 0 5px rgba(15,122,90,.15)' }
          : st === 'done'
            ? { background: 'color-mix(in srgb, ' + FOREST + ' 14%, transparent)', color: FOREST, border: 'none' }
            : { background: '#fff', color: F_TENUE, border: '1px solid rgba(0,0,0,.08)' };
        return (
          <div key={f.key} style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '5px 0' }}>
            <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...nodeStyle }}>
              <PasoIcon idx={i} size={17} color="currentColor" />
            </div>
            <span style={{ fontSize: 14, color: st === 'pending' ? F_TENUE : F_TXT, fontWeight: st === 'current' ? 500 : 400 }}>{f.label}</span>
            {st === 'current' && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: FOREST, background: 'rgba(15,122,90,.10)', borderRadius: 99, padding: '2px 10px' }}>en curso</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Estado del pedido → color del badge en la paleta forest del handoff
   (pendiente = ÁMBAR como el mockup; el token compartido de lib/estados deja el
   badge gris/apagado). En-flujo = verde, espera-acción = ámbar, bloqueado =
   rojo, cerrado = verde oscuro. fg = texto/etiqueta, dot = punto; el fondo es un
   tinte claro del dot. Espeja la decisión de OrdenesPage (pendiente=ámbar). */
const ESTADO_BADGE = {
  pendiente:      { fg: '#9a6a13', dot: '#B6791D' },
  aceptado:       { fg: '#0f7a5a', dot: '#0f7a5a' },
  en_proceso:     { fg: '#0f7a5a', dot: '#0f7a5a' },
  en_produccion:  { fg: '#0f7a5a', dot: '#0f7a5a' },
  producido:      { fg: '#9a6a13', dot: '#B6791D' },
  qc_hold:        { fg: '#b3261e', dot: '#b3261e' },
  qc_aprobado:    { fg: '#9a6a13', dot: '#B6791D' },
  en_envasado:    { fg: '#0f7a5a', dot: '#0f7a5a' },
  envasado:       { fg: '#9a6a13', dot: '#B6791D' },
  en_recoleccion: { fg: '#9a6a13', dot: '#B6791D' },
  en_camino:      { fg: '#0f7a5a', dot: '#0f7a5a' },
  en_almacen:     { fg: '#9a6a13', dot: '#B6791D' },
  entregado:      { fg: '#0f6e56', dot: '#0f6e56' },
  rechazado:      { fg: '#b3261e', dot: '#b3261e' },
  cancelado:      { fg: '#b3261e', dot: '#b3261e' },
};
const _estadoBadge = (estado) => ESTADO_BADGE[(estado || '').toLowerCase()] || { fg: '#5a6b63', dot: '#9aa8a2' };

/* Estilos "glass forest" de la card de pedido (hardcodeados del handoff). */
const C = {
  card: (isDesktop, esPrueba, focus) => ({
    position: 'relative',
    background: esPrueba ? 'rgba(182,121,29,.06)' : (isDesktop ? '#fff' : 'rgba(250,253,252,0.72)'),
    ...(isDesktop ? {} : { backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)' }),
    border: esPrueba ? '1px solid rgba(182,121,29,.30)' : (isDesktop ? '1px solid rgba(0,0,0,.06)' : '1px solid rgba(255,255,255,0.55)'),
    borderRadius: 24,
    boxShadow: isDesktop ? '0 10px 30px rgba(0,0,0,.07)' : '0 18px 50px rgba(80,140,110,.18)',
    padding: '22px 24px',
    display: 'flex', flexDirection: 'column', gap: 16,
    fontFamily: 'var(--lp-font-sans)',
    ...(focus ? { outline: '2px solid ' + FOREST, outlineOffset: 2, boxShadow: '0 0 0 4px rgba(15,122,90,.18)' } : {}),
  }),
  head: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  folio: { fontSize: 13, fontWeight: 500, color: FOREST, letterSpacing: '.02em' },
  headRight: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  internaBadge: { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(0,0,0,.05)', color: F_TXT2, letterSpacing: '.04em', textTransform: 'uppercase' },
  estadoBadge: (estado) => {
    const m = _estadoBadge(estado);
    return { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: m.fg, background: `color-mix(in srgb, ${m.dot} 15%, transparent)`, borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap' };
  },
  estadoDot: (estado) => ({ width: 7, height: 7, borderRadius: '50%', background: _estadoBadge(estado).dot, display: 'inline-block', flexShrink: 0 }),
  title: { fontSize: 21, fontWeight: 500, letterSpacing: '-.01em', color: F_TXT, lineHeight: 1.15 },
  meta: { fontSize: 13, color: F_TXT2, marginTop: 5, lineHeight: 1.5 },
  metaB: { color: F_TXT, fontWeight: 500 },
  numeral: { textAlign: 'center', background: 'rgba(15,122,90,.08)', borderRadius: 16, padding: '10px 16px', flexShrink: 0 },
  numeralNum: { fontSize: 26, fontWeight: 500, color: FOREST, lineHeight: 1 },
  numeralUnit: { fontSize: 10, color: F_TXT2, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 3 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 16 },
  btn: (kind = 'primary') => ({
    minHeight: 44, padding: '0 16px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    borderRadius: 99,
    flex: kind === 'danger' ? '0 0 auto' : '1 1 130px',
    background: kind === 'primary' ? FOREST : kind === 'danger' ? 'rgba(179,38,30,.05)' : '#fff',
    color: kind === 'primary' ? '#fff' : kind === 'danger' ? '#b3261e' : F_TXT,
    border: kind === 'primary' ? 'none' : kind === 'danger' ? '1px solid rgba(179,38,30,.18)' : '1px solid rgba(0,0,0,.08)',
    boxShadow: kind === 'primary' ? '0 6px 16px rgba(15,122,90,.28)' : kind === 'ghost' ? '0 1px 2px rgba(0,0,0,.04)' : 'none',
  }),
};

/* X3 (jun 2026): ESTADO_COLOR y ESTADO_LABEL vienen de lib/estados.js. */

/* (jun 2026) El riel de urgencia se retiró con el rediseño de la card (handoff
   Card Progreso Pedido): el estado se comunica con el badge + la barra/timeline
   de progreso. La lógica de acciones por estado+rol queda intacta. */

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
  /* Deep-link a sub-pestaña vía ?tab= (el asistente/bot puede abrir
     /pedidos?tab=rechazados). Reusa la MISMA instancia searchParams que ?nuevo/?focus.
     Validado; valor inválido cae a 'activos'. */
  const TABS_VALIDOS = ['activos', 'pruebas', 'rechazados', 'historial'];
  const [tab, setTab] = useState(() => {
    const t = searchParams.get('tab');
    return (t && TABS_VALIDOS.includes(t)) ? t : 'activos';
  });
  const [showNuevo, setShowNuevo] = useState(false);
  /* Prefill desde otra pantalla (Inventario → "Pedir reposición" ?nuevo=BLANCO MATE) */
  const [prefillProducto, setPrefillProducto] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [corregirModal, setCorregirModal] = useState(null); /* pedido cuya cantidad se corrige */
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

  /* Sync URL → pestaña vía ?tab=: si navegas a /pedidos?tab=... estando YA en
     Pedidos, react-router NO remonta y el useState inicial no se relee. NO se
     limpia el param (a diferencia de ?nuevo/?focus) para que el deep-link sea
     estable. Setear al mismo valor es no-op. */
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TABS_VALIDOS.includes(t)) setTab(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [searchParams]);

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
    const base = arr.filter(p => p && p.id && !p.eliminado && p.estado !== 'eliminado');
    /* Regla dueño (jul 2026): el trabajo del TÉCNICO termina en la recolección.
       Un pedido que Luis ya recogió (en_camino) o que está en Terán con tote por
       reenvasar (en_almacen — asunto de Josué) sale de la vista de Enrique; le
       reaparece SOLO en Historial cuando queda 'entregado'. Filtrar AQUÍ (la
       fuente) mantiene chips/embudo/conteos consistentes sin re-filtros. */
    return user?.rol === 'tecnico' ? base.filter(p => !esPedidoFueraDeFabrica(p.estado)) : base;
  }, [data, user?.rol]);

  /* Buckets desde la fuente ÚNICA lib/estados.js (antes inline → derivaba; un
     pedido en 'en_almacen' o variante 'entregada' se caía entre pestañas). */
  const activos    = pedidos.filter(p => bucketPedido(p) === 'activos');
  const pruebas    = pedidos.filter(p => bucketPedido(p) === 'pruebas');
  const rechazados = pedidos.filter(p => bucketPedido(p) === 'rechazados');

  /* Órdenes INTERNAS (origen 'interna', sin pedido) ya TERMINADAS = "lo que produje".
     Modelo (dueño jun 2026): una orden interna es FINAL al producirse+envasarse
     ('envasado') — pasa a STOCK FÁBRICA, disponible para transferencia vía OT; NO va
     por el flujo de recolección→Terán de un pedido. Por eso "terminado" para una
     interna = 'envasado' en adelante (NO exige 'entregado'). Se muestra con su ESTADO
     REAL — antes (ledger) se forzaba a 'producido' y NO concordaba con Órdenes.
     El técnico ve las SUYAS; admin todas; otros roles ninguna.
     `_esOrdenInterna` oculta acciones de pedido; el id = o.id resuelve el lote por
     ordenId en PedidoLoteActions; `_folio` muestra el código legible (OP-…). */
  const ordenesInternasHist = useMemo(() => {
    const arr = ordData?.data || ordData || [];
    const rol = user?.rol;
    if (rol !== 'admin' && rol !== 'tecnico') return [];
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
    const yo = norm(user?.nombre);
    /* Una interna terminó su producción al llegar a 'envasado'; los estados de
       entrega posteriores (si se transfirió por OT) también cuentan como terminado. */
    const FINAL_INTERNA = ['envasado', 'en_recoleccion', 'en_camino', 'en_almacen', 'entregado'];
    return (Array.isArray(arr) ? arr : [])
      .filter(o => o && !o.eliminado
        && (o.origen === 'interna' || !o.pedidoId)
        && FINAL_INTERNA.includes(normEstado(o.estado))
        && !o.esPrueba
        && (rol === 'admin' || norm(o.usuario || o.creadoPor) === yo))
      .map(o => ({
        ...o,
        _esOrdenInterna: true,
        _folio: o.codigo || o.id,
        producto: o.producto || o.formula,
        cantidad: o.cantidad,
        estado: o.estado,          /* ESTADO REAL → concuerda con Órdenes */
        esPrueba: !!o.esPrueba,
        fecha: o.fecha || o.fechaCreacion || o.fechaRequerida,
        creadoPor: o.usuario,
      }));
  }, [ordData, user]);


  /* Historial = operación completada: pedidos entregados + órdenes internas
     terminadas (producidas+envasadas, ya en stock fábrica). */
  const historial  = [
    ...pedidos.filter(p => bucketPedido(p) === 'historial'),
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
      setErr(humanizeError(e)); /* AUDIT UX 16-jul (U4) */
    } finally {
      setBusyId('');
    }
  };

  /* Cancelar pedido — rechazo SUAVE unificado (21-jul-2026): motivo obligatorio,
     sin PIN, sin borrar — /api/pedidos/rechazar valida el estado server-side y
     cancela la orden vinculada. Vale para admin y técnico por igual, SOLO en
     pendiente/aceptado (aún sin MP consumida). Para pedidos ya producidos o
     para el borrado definitivo está handleEliminar (admin, motivo + PIN,
     reversa de MP). Antes el Cancelar de admin llamaba al MISMO endpoint
     destructivo que Eliminar — dos botones, un efecto. */
  const handleCancelar = async (p) => {
    setErr('');
    const motivo = await confirm(
      `Vas a cancelar el pedido ${p.id} de ${p.producto}. Indica el motivo para dejar registro.`,
      {
        title: 'Cancelar pedido',
        confirmText: 'Cancelar pedido',
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

    setBusyId(p.id);
    try {
      /* FIX jun 2026 (auditoría): endpoint dedicado — valida el estado
         server-side y CANCELA la orden vinculada. El upsert anterior dejaba
         la orden huérfana viva (producible) y podía pisar campos con caché. */
      await api.rechazarPedido(p.id, motivo);
      reload();
    } catch (e) {
      console.error('[CANCELAR] error:', e);
      setErr('No se pudo cancelar: ' + humanizeError(e)); /* AUDIT UX 16-jul (U4) */
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
      setErr('No se pudo eliminar: ' + humanizeError(e)); /* AUDIT UX 16-jul (U4) */
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
      setErr(humanizeError(e)); /* AUDIT UX 16-jul (U4) */
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
      /* excluirPedido=p.id: la orden de ESTE pedido ya reserva su MP; sin esto la
         validación la contaba doble y daba "MP insuficiente" con stock de sobra. */
      const v = await api.validarStock(p.producto, p.cantidad, undefined, p.id);
      if (v && v.suficiente === false) {
        const falt = (v.faltantes || []).slice(0, 4)
          .map(f => `${f.mp} (faltan ${Number(f.faltanteKg || 0).toFixed(1)} kg)`).join(' · ');
        setErr(`Stock MP insuficiente para producir ${p.producto} ×${p.cantidad}: ${falt}${(v.faltantes || []).length > 4 ? ' …' : ''}. Recibe MP o ajusta inventario antes de iniciar.`);
        return;
      }
    } catch {
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
        action={null}
      />
      <div style={S.wrap}>
        {err && <div style={S.err}>{err}</div>}

        {/* Subtítulo vivo por pestaña (tsub del mockup) */}
        <div style={S.tsub}>
          {tab === 'activos' ? `${activos.length} activos · esperan tu acción`
            : tab === 'pruebas' ? `${pruebas.length} en modo prueba`
            : tab === 'rechazados' ? `${rechazados.length} rechazados o cancelados`
            : `${historial.length} en historial`}
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

        {canCrear && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
            <button
              data-id="pedidos.btn.nuevo"
              data-rol="almacen,admin,tecnico"
              style={{ height: 44, padding: '0 16px', borderRadius: 999, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--lp-brand-600)', color: '#fff' }}
              onClick={() => setShowNuevo(true)}
            >
              {Icon.plus} Nuevo pedido
            </button>
          </div>
        )}

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
            /* CORREGIR CANTIDAD (25-ago-2026, reporte del dueño). El botón nació en
               la cola de Producción, pero esa cola solo lista pedidos que YA
               arrancaron: un pedido en 'pendiente' o 'aceptado' —justo cuando
               conviene corregirlo— no lo tenía en ninguna parte. Aquí sí, que es
               ANTES de producir. A partir de 'producido' el server lo rechaza
               (la MP ya se descontó), así que no se ofrece. */
            const mostrarCorregir = tabOperable && user?.rol === 'admin' && !p.eliminado
              && ['pendiente', 'aceptado', 'en_produccion'].includes(p.estado);
            /* LIMPIEZA 21-jul-2026 (auditoría: "dos verbos, un efecto"): antes el
               Cancelar de admin llamaba al MISMO /api/pedidos/eliminar que el botón
               Eliminar de al lado. Ahora los verbos se distinguen de verdad:
               · Cancelar = rechazo SUAVE (motivo, sin PIN, sin borrar) — solo en
                 pendiente/aceptado, para admin y técnico por igual.
               · Eliminar = destructivo (motivo + PIN, cascada orden + reversa MP)
                 — solo admin, cubre también los estados ya producidos. */
            const esTerminal = esPedidoTerminal(p.estado);
            const puedeCancelarSuave = (user?.rol === 'admin' || canAceptar) && !esTerminal && ['pendiente', 'aceptado'].includes(p.estado);
            const mostrarCancelar = puedeCancelarSuave && tabOperable;
            /* §7: Eliminar = SOLO admin. No se renderiza para otros roles.
               Disponible en cualquier filtro mientras el pedido no esté ya
               eliminado (los terminales sí pueden eliminarse del histórico). */
            const esAdmin = user?.rol === 'admin';
            /* Las órdenes internas mostradas en el Historial NO son pedidos:
               el botón "Eliminar pedido" no aplica (rompería contra un id de
               orden). Se oculta para esas entradas. */
            const mostrarEliminar = esAdmin && !p._esOrdenInterna;
            const tieneAcciones = mostrarCorregir || mostrarAceptar || mostrarIniciar || mostrarIrProduccion || mostrarCancelar || mostrarEliminar;

            /* Cantidad → número + unidad para el numeral (desktop). */
            const qtyTxt = etiquetaMedidaReal(p.medida, p.medidaQty, p.cantidad) || `${p.cantidad} cubetas`;
            const _sp = qtyTxt.indexOf(' ');
            const qNum = _sp < 0 ? qtyTxt : qtyTxt.slice(0, _sp);
            const qUnit = _sp < 0 ? '' : qtyTxt.slice(_sp + 1);
            /* Meta SIN la cantidad (solicitó · fecha · lote · por · producción).
               Se CONSERVAN todos los extras que el mockup omite. */
            const metaParts = [];
            if (p.solicitante) metaParts.push(<>solicitó <b style={C.metaB}>{p.solicitante}</b></>);
            if (p.fecha) metaParts.push(<span title={new Date(p.fecha).toLocaleString('es-MX')}>{fmtRel(p.fecha)}</span>);
            if (p.lote) metaParts.push(<>Lote <code style={{ fontFamily: 'var(--lp-font-mono)' }}>{p.lote}</code></>);
            if (p.creadoPor && p.creadoPor !== p.solicitante) metaParts.push(<>por {p.creadoPor}</>);
            if (p.estado === 'en_produccion' && p.produccionIniciadaPor) metaParts.push(<>Producción por <b style={C.metaB}>{p.produccionIniciadaPor}</b></>);
            const metaJoined = metaParts.map((m, i) => <Fragment key={i}>{i > 0 ? ' · ' : ''}{m}</Fragment>);
            const mostrarProgreso = p.estado !== 'entregado' && !p._esOrdenInterna;

            return (
              <div key={p.id} id={'ped-' + p.id} style={C.card(isDesktop, p.esPrueba, p.id === focusId)}>
                {/* Header: folio + (interna · prueba · cronómetro · estado) */}
                <div style={C.head}>
                  <span style={C.folio}>{p._folio || p.id}</span>
                  <div style={C.headRight}>
                    {p._esOrdenInterna && <span style={C.internaBadge}>Interna</span>}
                    {p.esPrueba && <PruebaBadge size="sm" />}
                    {p.estado === 'en_produccion' && p.fechaInicioProduccion && (
                      <Cronometro desde={p.fechaInicioProduccion} />
                    )}
                    <span style={C.estadoBadge(p.estado)}>
                      <i style={C.estadoDot(p.estado)} />{ESTADO_LABEL[p.estado] || p.estado}
                    </span>
                  </div>
                </div>

                {/* Cuerpo: título + meta. Desktop añade el numeral (cantidad) a la
                    derecha; móvil lleva la cantidad inline en la meta. */}
                {isDesktop ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={C.title}>{p.producto}</div>
                      {metaParts.length > 0 && <div style={C.meta}>{metaJoined}</div>}
                    </div>
                    <div style={C.numeral}>
                      <div style={C.numeralNum}>{qNum}</div>
                      {qUnit && <div style={C.numeralUnit}>{qUnit}</div>}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={C.title}>{p.producto}</div>
                    <div style={C.meta}>
                      <b style={C.metaB}>{qtyTxt}</b>
                      {metaParts.length > 0 && ' · '}
                      {metaJoined}
                    </div>
                  </div>
                )}

                {/* Progreso del pedido — barra+iconos (desktop) / timeline (móvil).
                    Oculto en entregado (historial compacto) y en órdenes internas. */}
                {mostrarProgreso && <ProgresoPedido estado={p.estado} isDesktop={isDesktop} />}

                {/* Footer: acciones del pedido por estado. data-id/data-rol del
                    mockup cableados a los handlers reales. */}
                {tieneAcciones && (
                  <div style={C.actions}>
                    {mostrarCorregir && (
                      <button
                        style={C.btn('ghost')}
                        data-id="pedidos.btn.corregir-cantidad"
                        data-rol="admin"
                        disabled={busyId === p.id}
                        onClick={() => setCorregirModal(p)}
                        title="Corregir cuántos totes/cubetas se van a producir"
                      >
                        Corregir cantidad
                      </button>
                    )}
                    {mostrarAceptar && (
                      <button
                        style={C.btn('primary')}
                        data-id="pedidos.btn.aceptar-producir"
                        data-rol="tecnico,admin"
                        disabled={busyId === p.id}
                        onClick={() => handleAceptar(p)}
                        title="Acepta el pedido y le crea su orden. Para arrancar, después usa «Iniciar producción»."
                      >
                        {/* Decía "Aceptar y producir" y NO produce: handleAceptar
                            manda lanzarProduccion:false a propósito, porque arrancar
                            exige validar stock de MP y aceptar el NDA — y eso vive en
                            "Iniciar producción". El dueño aceptó BLANCO SG V3 el
                            25-ago y no entendía por qué no llegaba a la cola: la
                            etiqueta prometía un paso que el handler no da. */}
                        {busyId === p.id ? '…' : <>{Icon.check} Aceptar</>}
                      </button>
                    )}
                    {mostrarIniciar && (
                      <button
                        style={C.btn('primary')}
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
                        style={C.btn('ghost')}
                        data-id="pedidos.btn.ir-produccion"
                        data-rol="tecnico,admin"
                        onClick={() => navigate('/produccion')}
                        title="Ir a Producción para completar el lote"
                      >
                        Ir a Producción {Icon.arrow}
                      </button>
                    )}
                    {/* Cancelar = rechazo SUAVE (motivo, sin PIN, sin borrar).
                        El borrado definitivo con reversa de MP es Eliminar. */}
                    {mostrarCancelar && (
                      <button
                        style={C.btn('danger')}
                        data-id="pedidos.btn.cancelar"
                        data-rol="tecnico,admin"
                        disabled={busyId === p.id}
                        onClick={() => handleCancelar(p)}
                        title="Cancelar pedido (pide motivo; queda como rechazado, sin borrar)"
                      >
                        {busyId === p.id ? '…' : <>{Icon.x} Cancelar</>}
                      </button>
                    )}
                    {/* §7: Eliminar pedido — SOLO admin (data-rol="admin"). */}
                    {mostrarEliminar && (
                      <button
                        style={C.btn('danger')}
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
          pedidos={pedidos} /* AUDIT UX 16-jul (U18): datalist de solicitantes recientes */
          onClose={() => { setShowNuevo(false); setPrefillProducto(null); }}
          /* fuePrueba (28-jul-2026): los pedidos prueba viven en la pestaña
             "Pruebas", NO en Activos — el dueño creó una prueba, la lista que
             miraba no cambió y reportó "no funcionó". Al crear pruebas ahora
             brincamos a esa pestaña para que VEA lo que acaba de crear. */
          onCreated={(fuePrueba) => {
            setShowNuevo(false); setPrefillProducto(null); reload();
            if (fuePrueba) setTab('pruebas');
          }}
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
      {corregirModal && (
        <CorregirCantidadModal
          pedido={corregirModal}
          onClose={() => setCorregirModal(null)}
          onSaved={() => { setCorregirModal(null); reload(); reloadOrd(); }}
        />
      )}
      {ConfirmEl}
    </div>
  );
}
