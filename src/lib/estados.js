/* ═══════════════════════════════════════════════════════════════════════
   FIX jun 2026 (Sprint K - K4): fuente única de verdad de estados.

   Antes los arrays de estados (PEND_*, ACTIVOS_*, PIPELINE_*) estaban
   hardcoded en cada pantalla con valores DESALINEADOS — el caso más grave:
   DashboardPage usaba ['nuevo','en_preparacion'] mientras el resto del
   sistema usa 'pendiente' → KPI "pedidos pendientes" SIEMPRE marcaba 0
   aunque hubiera 20 reales.

   Espejo de los estados reales que escribe el backend en pedidos_almacen.json
   y ordenes.json (verificado contra _crearPedidoAlmacen y handlers de
   ordenes en server.js).
   ═══════════════════════════════════════════════════════════════════════ */

/* ── PEDIDOS — flujo Josué → Enrique → producción → entrega ── */
export const ESTADO_PEDIDO_PENDIENTE = ['pendiente'];
export const ESTADO_PEDIDO_EN_FLUJO = ['pendiente','aceptado','en_proceso','en_produccion','qc_hold','qc_aprobado','en_envasado'];
export const ESTADO_PEDIDO_LISTO_RECOGER = ['envasado','en_recoleccion'];
export const ESTADO_PEDIDO_TERMINAL = ['entregado','cancelado','rechazado'];

/* ── ORDENES — espejo del pedido a nivel orden técnico ── */
export const ESTADO_ORDEN_PENDIENTE = ['pendiente','aceptado','en_proceso','en_produccion'];
export const ESTADO_ORDEN_TERMINAL = ['entregado','cancelado','rechazado','eliminado'];

/* ── LOTES — del estado machine (lib/loteStateMachine.js) ── */
export const ESTADO_LOTE_PRE_QC = ['producido'];
export const ESTADO_LOTE_QC = ['qc_hold'];
export const ESTADO_LOTE_POST_QC = ['qc_aprobado'];
export const ESTADO_LOTE_ENVASANDO = ['qc_aprobado','en_envasado'];
export const ESTADO_LOTE_RECOLECCION = ['envasado','en_recoleccion'];
export const ESTADO_LOTE_EN_CAMINO = ['en_camino'];
export const ESTADO_LOTE_EN_PROCESO = ['en_proceso']; /* roll-up tras recolección parcial */
/* "Lotes activos en flujo" — excluye terminales y eliminados, incluye TODO lo intermedio */
export const ESTADO_LOTE_ACTIVO = [
  'pendiente','aceptado','en_produccion','producido','qc_hold','qc_aprobado',
  'en_envasado','envasado','en_recoleccion','en_camino','en_proceso',
];
export const ESTADO_LOTE_TERMINAL = ['entregado','cancelado','rechazado'];

/* Helpers explicit (más legible que .includes y permite cambiar la lógica) */
export const esPedidoPendiente = e => ESTADO_PEDIDO_PENDIENTE.includes(String(e || '').toLowerCase());
export const esOrdenPendiente  = e => ESTADO_ORDEN_PENDIENTE.includes(String(e || '').toLowerCase());
export const esLoteActivo      = e => ESTADO_LOTE_ACTIVO.includes(String(e || '').toLowerCase());
export const esLoteTerminal    = e => ESTADO_LOTE_TERMINAL.includes(String(e || '').toLowerCase());
