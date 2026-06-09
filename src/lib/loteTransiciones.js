/* ═══════════════════════════════════════════════════════════════════════
   Helper compartido frontend para transiciones de lote/sublote.
   ESPEJO de lib/loteStateMachine.js del backend. Mantener en sync.

   Cada pantalla consulta:
     - getAccionesLote(lote, rol) → lista de acciones disponibles
     - getAccionesSublote(sublote, rol) → lista de acciones disponibles
     - calcularEstadoLote(lote) → estado derivado por roll-up
     - LABELS_ACCION → texto humano para botones
   ═══════════════════════════════════════════════════════════════════════ */

export const TRANSICIONES_LOTE = {
  aceptarPedido:       { desde: ['pendiente'], a: 'aceptado',      roles: ['tecnico','admin'] },
  rechazarPedido:      { desde: ['pendiente','aceptado'], a: 'rechazado', roles: ['tecnico','admin'] },
  iniciarProduccion:   { desde: ['aceptado'], a: 'en_produccion',  roles: ['tecnico','admin'] },
  finalizarProduccion: { desde: ['en_produccion'], a: 'producido', roles: ['tecnico','admin'] },
  aprobarQC:           { desde: ['producido','qc_hold'], a: 'qc_aprobado', roles: ['tecnico','admin'] },
  rechazarQC:          { desde: ['producido'], a: 'qc_hold',       roles: ['tecnico','admin'] },
  reabrirProduccion:   { desde: ['qc_hold'], a: 'en_produccion',   roles: ['tecnico','admin'] },
  /* FIX jun 2026 (K5): sync con backend. Antes faltaba 'producido' en
     `desde` — el backend acepta envasar directo desde producido (QC opcional
     desde fix de jun) pero el frontend no mostraba el botón. */
  /* jun 2026: envasado = Enrique (técnico)/admin. Josué (almacén) NO envasa. */
  registrarEnvasado:   { desde: ['producido','qc_aprobado','en_envasado'], a: 'en_envasado', roles: ['tecnico','admin'] },
  marcarEnvasado:      { desde: ['producido','qc_aprobado','en_envasado'], a: 'envasado', roles: ['tecnico','admin'] },
  cancelarLote:        { desde: ['pendiente','aceptado','en_produccion','producido','qc_hold','en_envasado'], a: 'cancelado', roles: ['admin'] },
};

export const TRANSICIONES_SUBLOTE = {
  marcarRecoleccion:      { desde: ['envasado'], a: 'en_recoleccion', roles: ['almacen','admin'] },
  escanearRecoger:        { desde: ['envasado','en_recoleccion','tote_activo'], a: 'en_camino', roles: ['recolector','admin'] },
  /* FIX jun 2026 (Sprint R): sync con backend — quitamos 'envasado' del
     origen. Josué solo puede recibir cuando Luis ya recogió (en_camino) o
     en caso de TOTE directo. Antes el banner "Recibir aquí" aparecía
     prematuramente y saltaba el paso de Luis. */
  escanearRecibirTeran:   { desde: ['en_camino','tote_activo'], a: '__auto__', roles: ['almacen','admin'] },
  reenvasarTote:          { desde: ['tote_activo'], a: '__same__', roles: ['almacen','tecnico','admin'] },
  cancelarSublote:        { desde: ['envasado','en_recoleccion'], a: 'cancelado', roles: ['admin'] },
};

export const LABELS_ACCION_LOTE = {
  aceptarPedido:       'Aceptar',
  rechazarPedido:      'Rechazar',
  iniciarProduccion:   'Iniciar producción',
  finalizarProduccion: 'Finalizar producción',
  aprobarQC:           'Aprobar QC',
  rechazarQC:          'Rechazar QC',
  reabrirProduccion:   'Reabrir producción',
  registrarEnvasado:   'Registrar envasado parcial',
  marcarEnvasado:      'Marcar envasado',
  cancelarLote:        'Cancelar lote',
};

export const LABELS_ACCION_SUBLOTE = {
  /* FIX jun 2026 (bug Luis): labels más naturales por rol/acción.
     Antes 'Escanear (Luis)' era confuso — Luis no entiende qué dispara.
     'Voy por él' refleja la intención operativa real: tomar el sublote. */
  marcarRecoleccion:    'Marcar listo para recolectar',
  escanearRecoger:      'Voy por él',
  escanearRecibirTeran: 'Confirmar recepción en Terán',
  reenvasarTote:        'Re-envasar TOTE',
  cancelarSublote:      'Anular sublote',
};

export const ESTADO_LOTE_LABEL = {
  pendiente:      'Pendiente',
  aceptado:       'Aceptado',
  rechazado:      'Rechazado',
  en_produccion:  'En producción',
  producido:      'Producido',
  qc_hold:        'QC retenido',
  qc_aprobado:    'QC aprobado',
  en_envasado:    'En envasado',
  envasado:       'Envasado',
  en_proceso:     'En proceso de entrega',
  entregado:      'Entregado',
  cancelado:      'Cancelado',
};

export const ESTADO_SUBLOTE_LABEL = {
  envasado:        'Envasado',
  en_recoleccion:  'En recolección',
  en_camino:       'En camino',
  en_stock_teran:  'En stock Terán',
  tote_activo:     'TOTE activo',
  tote_vaciado:    'TOTE vaciado',
  cancelado:       'Cancelado',
};

export const ESTADO_LOTE_COLOR = {
  pendiente:      '#6B6560',
  aceptado:       'var(--lp-brand-500)',
  rechazado:      'var(--lp-danger-600)',
  en_produccion:  'var(--lp-warning-600)',
  producido:      'var(--lp-info-600)',
  qc_hold:        'var(--lp-danger-500)',
  qc_aprobado:    'var(--lp-success-500)',
  en_envasado:    '#06B6D4',
  envasado:       '#0EA5E9',
  en_proceso:     'var(--lp-warning-500)',
  entregado:      'var(--lp-success-600)',
  cancelado:      'var(--lp-text-tertiary)',
};

export const ESTADO_SUBLOTE_COLOR = {
  envasado:        '#0EA5E9',
  en_recoleccion:  'var(--lp-warning-600)',
  en_camino:       'var(--lp-warning-700)',
  en_stock_teran:  'var(--lp-success-600)',
  tote_activo:     '#7C3AED',
  tote_vaciado:    'var(--lp-text-tertiary)',
  cancelado:       'var(--lp-text-tertiary)',
};

/* Matriz de notificaciones — espejo de NOTIF_TARGETS_POR_EVENTO del backend.
   El InboundAlertManager la usa para decidir si el usuario actual debe ver
   un banner emergente para un evento dado.

   FIX jun 2026 (Sprint U3 — auditoría arquitectónica): sync completo con
   backend loteStateMachine.js:266-289. Antes 6 eventos tenían targets
   distintos (recolector excluido en 5, almacen+recolector excluidos en
   rechazarQC). Esto silenciaba notificaciones que el backend SÍ enviaba
   — Luis perdía momentos del pipeline. La regla canónica del owner es
   que Luis y Josué ven el lote desde aceptarPedido en adelante. */
export const NOTIF_TARGETS_POR_EVENTO = {
  'lote.aceptarPedido':       ['almacen', 'recolector', 'admin'],
  'lote.rechazarPedido':      ['almacen', 'recolector', 'admin'],
  'lote.iniciarProduccion':   ['almacen', 'recolector', 'admin'],
  'lote.finalizarProduccion': ['almacen', 'recolector', 'admin'],
  'lote.aprobarQC':           ['almacen', 'recolector', 'admin'],
  'lote.rechazarQC':          ['tecnico', 'almacen', 'recolector', 'admin'],
  'lote.registrarEnvasado':   ['almacen', 'recolector', 'admin'],
  'lote.marcarEnvasado':      ['recolector', 'almacen', 'admin'],
  'sublote.marcarRecoleccion':    ['recolector', 'almacen', 'admin'],
  'sublote.escanearRecoger':      ['almacen', 'admin'],
  'sublote.escanearRecibirTeran': ['tecnico', 'recolector', 'admin'],
  'sublote.reenvasarTote':        ['tecnico', 'admin'],
};

function _has(arr, x) { return Array.isArray(arr) && arr.includes(x); }

export function getAccionesLote(lote, rol) {
  if (!lote || !rol) return [];
  return Object.keys(TRANSICIONES_LOTE).filter(a => {
    const t = TRANSICIONES_LOTE[a];
    return _has(t.roles, rol) && _has(t.desde, lote.estado);
  });
}

export function getAccionesSublote(sublote, rol) {
  if (!sublote || !rol) return [];
  return Object.keys(TRANSICIONES_SUBLOTE).filter(a => {
    const t = TRANSICIONES_SUBLOTE[a];
    return _has(t.roles, rol) && _has(t.desde, sublote.estado);
  });
}

/* Roll-up del estado del lote desde sus sublotes (espejo del backend) */
export function calcularEstadoLote(lote) {
  if (!lote) return null;
  const pre = ['pendiente','aceptado','rechazado','en_produccion','producido',
               'qc_hold','qc_aprobado','en_envasado','cancelado'];
  if (pre.includes(lote.estado)) return lote.estado;

  const subs = Array.isArray(lote.sublotes) ? lote.sublotes : [];
  if (subs.length === 0) return lote.estado || 'envasado';

  const terminales = ['en_stock_teran','tote_vaciado','cancelado'];
  if (subs.every(s => terminales.includes(s.estado))) return 'entregado';

  /* FIX jun 2026 (L4): sync con backend — TOTE activo en Terán cuenta
     como entregado (Josué ya lo recibió, lo está consumiendo). */
  const todosEntregadosOToteTeran = subs.every(s =>
    terminales.includes(s.estado) ||
    (s.estado === 'tote_activo' && (s.ub || 'fabrica') === 'teran')
  );
  if (todosEntregadosOToteTeran) return 'entregado';

  const hayToteActivoFabrica = subs.some(s =>
    s.estado === 'tote_activo' &&
    Number(s.litrosRestante) > 0 &&
    (s.ub || 'fabrica') === 'fabrica'
  );
  if (hayToteActivoFabrica) return 'en_proceso';

  const enRuta = subs.every(s => ['en_camino','en_stock_teran','tote_vaciado'].includes(s.estado));
  if (enRuta) return 'en_proceso';

  if (subs.every(s => s.estado === 'en_recoleccion')) return 'en_recoleccion';
  /* FIX jun 2026 (sync con backend loteStateMachine.js): un sublote 'envasado'
     suelto NO degrada un lote cuyos otros sublotes ya avanzaron (en camino, en
     Terán, vaciados, TOTE activo en Terán) — evitaba reaparecer en "Voy por él". */
  const haySublotesAvanzados = subs.some(s =>
    ['en_recoleccion','en_camino','en_stock_teran','tote_vaciado'].includes(s.estado) ||
    (s.estado === 'tote_activo' && (s.ub || 'fabrica') === 'teran')
  );
  const algunEnvasado = subs.some(s => s.estado === 'envasado');
  if (algunEnvasado && !haySublotesAvanzados) return 'envasado';
  if (algunEnvasado && haySublotesAvanzados) return 'en_proceso';
  return 'en_proceso';
}
