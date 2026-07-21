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
/* "Por entregar" = producto YA terminado en ruta de entrega, aún NO entregado.
   Complemento de ESTADO_PEDIDO_PENDIENTE ("por preparar"): cubre de envasado
   (listo) hasta en_almacen (recibido en Terán pero pedido sin cerrar). */
export const ESTADO_PEDIDO_POR_ENTREGAR = ['envasado','en_recoleccion','en_camino','en_almacen'];
/* "Fuera de fábrica" (regla dueño jul 2026): Luis ya lo recogió (en_camino) o ya
   está en Terán (en_almacen — tote por reenvasar, asunto de Josué). El trabajo del
   TÉCNICO termina en la recolección → estos estados salen de su vista activa y el
   pedido reaparece SOLO en Historial al quedar 'entregado'. */
export const ESTADO_PEDIDO_FUERA_FABRICA = ['en_camino','en_almacen'];
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

/* ── Buckets POR PANTALLA (migración jul 2026 — fuente única) ──────────────
   Listas que vivían hardcodeadas en cada pantalla. Se migran AQUÍ tal cual
   (comportamiento idéntico); las diferencias entre pantallas son comportamiento
   real decidido en su momento — NO unificar sin decisión del dueño. */

/* MisLotesPipeline (dashboard, rol recolector): lo listo para recoger o en ruta.
   Incluye 'en_proceso' (roll-up tras recolección parcial — fix K10). */
export const ESTADO_LOTE_VISTA_RECOLECTOR = [...ESTADO_LOTE_RECOLECCION, ...ESTADO_LOTE_EN_CAMINO, ...ESTADO_LOTE_EN_PROCESO];

/* RecoleccionPage (sub-pestaña "En proceso"): lotes en fabricación aún sin envasar. */
export const ESTADO_LOTE_EN_FABRICACION = ['producido', 'qc_aprobado', 'qc_hold'];

/* RecoleccionPage (sub-pestaña "En proceso"): órdenes produciéndose que aún no
   crearon lote (recién arrancadas). Subconjunto de ESTADO_ORDEN_PENDIENTE. */
export const ESTADO_ORDEN_PRODUCIENDO = ['en_proceso', 'en_produccion'];

/* AlmacenRecepcionPage: fallback legacy — un sublote SIN estado propio cuenta
   como "en camino" si su lote padre ya salió de fábrica. */
export const ESTADO_LOTE_EN_RUTA_LEGACY = ['en_camino', 'en_recoleccion'];

/* TrazabilidadPage: la pill de filtro "Envasado" agrupa parcial y terminado. */
export const ESTADO_LOTE_FILTRO_ENVASADO = ['en_envasado', 'envasado'];

/* StockFabricaPage (tab "En Fábrica"): lote visible en fábrica. La variante
   CON_PROCESO añade 'en_proceso' (legacy/compat) y la usa SOLO el tab de
   activos reales; el tab de pruebas usa la base (comportamiento histórico). */
export const ESTADO_LOTE_EN_FABRICA = ['producido', 'qc_aprobado', 'en_envasado', 'envasado'];
export const ESTADO_LOTE_EN_FABRICA_CON_PROCESO = [...ESTADO_LOTE_EN_FABRICA, 'en_proceso'];

/* StockFabricaPage (tab "Transferidos"): lote que ya salió de fábrica.
   La variante O_ENTREGADO la usa el auto-cambio de tab vía ?lote=. */
export const ESTADO_LOTE_TRANSFERIDO = ['en_recoleccion', 'en_camino', 'en_almacen', 'reenvasado'];
export const ESTADO_LOTE_TRANSFERIDO_O_ENTREGADO = [...ESTADO_LOTE_TRANSFERIDO, 'entregado'];

/* StockFabricaPage: botón "Enviar a recolectar" — 'en_proceso' incluido para
   no perder el botón tras un despacho parcial (auditoría #8). */
export const ESTADO_LOTE_DESPACHABLE = ['envasado', 'en_proceso'];

/* FlujoPage: pedidos/órdenes activos que AÚN no crearon lote (pre-lote). */
export const ESTADO_FUENTE_SIN_LOTE = ['pendiente', 'aceptado', 'en_produccion'];

/* MisActivosTab (producción): lotes internos (sin pedido) que se OCULTAN de la
   vista activa. OJO: NO incluye 'rechazado' — comportamiento histórico distinto
   del filtro de pedidos (que usa ESTADO_PEDIDO_TERMINAL). */
export const ESTADO_LOTE_INTERNO_OCULTO = ['entregado', 'cancelado'];

/* ProduccionPage (tab producción): lotes post-producción que AÚN no completan
   su envasado — la card vive ahí hasta llegar a 'envasado'. (AUDIT 15-jul-2026) */
export const ESTADO_LOTE_POST_PRODUCCION = ['producido', 'qc_hold', 'qc_aprobado', 'en_envasado'];

/* InventarioPage (lote por PT, vistas Fábrica/Terán): estados que OCULTAN el
   lote (ciclo cerrado) y estados header-only que lo ubican en Terán.
   (AUDIT 15-jul-2026 — antes listas locales en la página) */
export const ESTADO_LOTE_OCULTO_INVENTARIO = ['entregado', 'cancelado', 'rechazado', 'eliminado'];
export const ESTADO_LOTE_UBICACION_TERAN = ['en_stock_teran', 'recibido_teran', 'reenvasado', 'en_almacen'];

/* Helpers explicit (más legible que .includes y permite cambiar la lógica) */
export const esPedidoPendiente = e => ESTADO_PEDIDO_PENDIENTE.includes(String(e || '').toLowerCase());
export const esOrdenPendiente  = e => ESTADO_ORDEN_PENDIENTE.includes(String(e || '').toLowerCase());
export const esLoteActivo      = e => ESTADO_LOTE_ACTIVO.includes(String(e || '').toLowerCase());
export const esLoteTerminal    = e => ESTADO_LOTE_TERMINAL.includes(String(e || '').toLowerCase());

/* ── Normalización de estados FANTASMA / variantes → canónico ──────────────
   FIX jun 2026 (deriva de buckets): la causa raíz de la familia de bugs donde
   un ítem "se cae" entre pestañas = cada pantalla re-implementa su filtro y
   algunas usan variantes que otras NO reconocen. Aquí se normalizan a UN estado
   canónico, en un solo lugar. Casos reales/vistos:
     · 'entregada' (con -a, timeline de OrdenesPage) → 'entregado'
     · 'en_stock_teran' (sublote recibido en Terán)  → 'en_almacen'
   NOTA: 'en_proceso' es un estado REAL (orden en producción) → NO se aliasa.
   'terminada'/'completado' son etiquetas de UI/ledger, no estados de pedido. */
const ESTADO_ALIAS = { entregada: 'entregado', en_stock_teran: 'en_almacen' };
export const normEstado = e => {
  const s = String(e || '').toLowerCase();
  return ESTADO_ALIAS[s] || s;
};

/* ── Buckets de PEDIDO (Activos / Pruebas / Rechazados / Historial) ────────
   Fuente ÚNICA del bucketeo que vivía inline en PedidosPage (y derivaba). Todas
   las predicate usan normEstado, así la variante 'entregada' ya no se pierde.
   bucketPedido devuelve el bucket o null (entregado-prueba = invisible, idéntico
   al comportamiento histórico). El "Historial = lo que produje" del técnico se
   suma aparte en PedidosPage desde el ledger (no es estado de pedido). */
export const esPedidoTerminal  = e => ESTADO_PEDIDO_TERMINAL.includes(normEstado(e));
export const esPedidoRechazado = e => { const n = normEstado(e); return n === 'rechazado' || n === 'cancelado'; };
/* Pedido "por entregar": usa normEstado → atrapa variantes (en_stock_teran → en_almacen). */
export const esPedidoPorEntregar = e => ESTADO_PEDIDO_POR_ENTREGAR.includes(normEstado(e));
export const esPedidoFueraDeFabrica = e => ESTADO_PEDIDO_FUERA_FABRICA.includes(normEstado(e));
export const esPedidoHistorial = p => normEstado(p && p.estado) === 'entregado' && !(p && p.esPrueba);
export function bucketPedido(p) {
  if (!p) return null;
  if (esPedidoRechazado(p.estado)) return 'rechazados';
  if (esPedidoTerminal(p.estado)) return esPedidoHistorial(p) ? 'historial' : null; /* entregado-prueba: invisible */
  return p.esPrueba ? 'pruebas' : 'activos';
}

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
  producido:       'Producido',
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
  producido:       'var(--lp-info-600)',
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
