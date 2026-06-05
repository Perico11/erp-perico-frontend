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

/* ════════════════════════════════════════════════════════════════════
   FIX jun 2026 (Sprint X3): labels + colors canónicos de PEDIDO y ORDEN.

   Antes vivían DUPLICADOS en PedidosPage.jsx (líneas 69-92), OrdenesPage.jsx
   (líneas 13-22) y DashboardPage.jsx — cada uno con shape distinto y a
   veces con estados que el backend NO emite (ej: OrdenesPage usaba
   'terminada'/'entregada' en lugar de 'entregado'). Centralizando aquí
   los consumers convergen al espejo del backend.

   Los labels y colores de LOTE y SUBLOTE viven en lib/loteTransiciones.js
   (complementario, no migrar). El re-export al final permite importar
   todo desde un solo lugar sin romper el contrato de loteTransiciones.js.
   ════════════════════════════════════════════════════════════════════ */

export const ESTADO_PEDIDO_LABEL = {
  pendiente:       'Pendiente',
  aceptado:        'Aceptado',
  en_proceso:      'En proceso',
  en_produccion:   'En producción',
  qc_hold:         'QC retenido',
  qc_aprobado:     'QC aprobado',
  en_envasado:     'En envasado',
  envasado:        'Envasado',
  en_recoleccion:  'En recolección',
  en_camino:       'En camino',
  en_almacen:      'En almacén',
  entregado:       'Entregado',
  rechazado:       'Rechazado',
  cancelado:       'Cancelado',
};

export const ESTADO_PEDIDO_COLOR = {
  pendiente:       '#6B6560',
  aceptado:        'var(--lp-brand-500)',
  en_proceso:      'var(--lp-warning-500)',
  en_produccion:   'var(--lp-warning-600)',
  qc_hold:         'var(--lp-danger-500)',
  qc_aprobado:     'var(--lp-success-500)',
  en_envasado:     '#06B6D4',
  envasado:        '#0EA5E9',
  en_recoleccion:  'var(--lp-warning-600)',
  en_camino:       'var(--lp-warning-700)',
  en_almacen:      'var(--lp-success-500)',
  entregado:       'var(--lp-success-600)',
  rechazado:       'var(--lp-danger-600)',
  cancelado:       'var(--lp-text-tertiary)',
};

/* ORDEN: usa el mismo dominio de estados que PEDIDO, pero exporto alias
   nominales para que el código del consumer sea legible. Si en algún
   momento el dominio de orden diverge del de pedido, basta editarlos
   acá sin tocar consumers. */
export const ESTADO_ORDEN_LABEL = ESTADO_PEDIDO_LABEL;
export const ESTADO_ORDEN_COLOR = ESTADO_PEDIDO_COLOR;
