/**
 * API Service — wrapper centralizado para todas las llamadas al backend.
 * Maneja token de sesión, errores, y reintentos básicos.
 *
 * BASE URL dinámica para soportar despliegue bajo subruta (ej. pinturaselperico.com/sistema):
 * - En dev (puerto 5173): rutas relativas → Vite proxy las redirige a localhost:3000
 * - En producción bajo /sistema: las rutas /api se vuelven /sistema/api automáticamente
 *   gracias a import.meta.env.BASE_URL que Vite inyecta según el `base` del build.
 */
const API_BASE = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
      /* BASE_URL viene como "/sistema/" o "/" — lo dejamos sin trailing slash para concatenar */
      const b = import.meta.env.BASE_URL.replace(/\/$/, '');
      return b; /* "" para root, "/sistema" para subruta */
    }
  } catch {}
  return '';
})();

/* Construye la URL final: API_BASE + path. Path debe empezar con /api/... */
function buildUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return API_BASE + path;
}

/* ── Sesión persistente con ventana de inactividad (jun 2026, pedido dueño) ──
   El token vive en sessionStorage (se borra al cerrar la PWA). Para no pedir
   login tan seguido, lo respaldamos en localStorage con un vencimiento: si
   reabres DENTRO de la ventana, la sesión se restaura sin pedir nada; si ya
   pasó, se limpia → vuelves a entrar con tu PIN (el usuario ya queda recordado).
   La ventana es por ROL: el técnico (Enrique) la usa prolongadamente → 2 h;
   los demás → 30 min. Mientras la app está abierta, touchSession() desliza el
   vencimiento, así nunca se cierra en pleno uso. */
const TOKEN_KEY = 'pp_token';
const PERSIST_KEY = 'pp_session';
export const SESSION_WINDOWS = { tecnico: 2 * 60 * 60 * 1000, default: 30 * 60 * 1000 };
export function windowForRole(rol) { return SESSION_WINDOWS[rol] || SESSION_WINDOWS.default; }

function _readPersist() {
  try { return JSON.parse(localStorage.getItem(PERSIST_KEY) || 'null'); } catch { return null; }
}
function _writePersist(p) {
  try { localStorage.setItem(PERSIST_KEY, JSON.stringify(p)); } catch {}
}
/* Restaura el token al cargar el módulo (antes de que React u otros lo lean). */
function _restoreToken() {
  try {
    const live = sessionStorage.getItem(TOKEN_KEY) || '';
    if (live) return live;                       /* sesión viva (app abierta) */
    const p = _readPersist();
    if (p && p.token && p.until && Date.now() <= p.until) {
      try { sessionStorage.setItem(TOKEN_KEY, p.token); } catch {} /* reabrió a tiempo */
      return p.token;
    }
    if (p) { try { localStorage.removeItem(PERSIST_KEY); } catch {} } /* venció → limpiar */
    return '';
  } catch { return ''; }
}
let _token = _restoreToken();

export function setToken(t, windowMs) {
  _token = t || '';
  if (t) {
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch {}
    const win = windowMs || (_readPersist() && _readPersist().window) || SESSION_WINDOWS.default;
    _writePersist({ token: t, window: win, until: Date.now() + win });
  } else {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
  }
}

export function getToken() { return _token; }

export function clearToken() {
  _token = '';
  try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
  try { localStorage.removeItem(PERSIST_KEY); } catch {}
}

/* Desliza el vencimiento hacia adelante mientras la app está en uso. */
export function touchSession() {
  const p = _readPersist();
  if (!p || !p.token) return;
  p.until = Date.now() + (p.window || SESSION_WINDOWS.default);
  _writePersist(p);
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (_token) headers['x-session-token'] = _token;

  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  const res = await fetch(buildUrl(path), opts);
  const data = await res.json();

  if (!res.ok) {
    /* 401 = sesión inválida → forzar re-login. EXCEPTO si el endpoint
       devuelve un código de error específico que indica que el 401 viene
       de validación AD-HOC de PIN (no de la sesión) — en ese caso lanzamos
       el error normalmente para que la UI lo muestre sin cerrar sesión.
       Los endpoints bien diseñados deben devolver 403 para esos casos
       (ver /api/ordenes/eliminar y /api/pedidos/eliminar), pero este guard
       protege contra los que todavía devuelvan 401 por PIN inválido. */
    const esLoginEndpoint = path === '/api/login' || path === '/api/session';
    /* Errores AD-HOC (PIN, TOTP, código admin incorrecto) NO deben sacar al
       usuario al login. Solo 401 por sesión real expirada/inválida cierra. */
    const errMsg = (data?.error || '').toLowerCase();
    const errCodigo = (data?.codigo || '');
    const esValidacionAdHoc = errMsg.includes('pin') ||
                              errMsg.includes('totp') ||
                              errMsg.includes('código') ||
                              errMsg.includes('codigo') ||
                              ['TOTP_FAIL', 'PIN_INCORRECTO', 'CODIGO_ADMIN_FAIL'].includes(errCodigo);
    if (res.status === 401 && !esLoginEndpoint && !esValidacionAdHoc) {
      clearToken();
      window.location.href = API_BASE + '/login';
      return;
    }
    /* FIX jun 2026 (O1): si vienen `detalles` de validación zod, anexarlos
       al mensaje para que el usuario sepa QUÉ campo está mal en vez de un
       "Datos inválidos" opaco. */
    let mensaje = data.error || data.msg || `HTTP ${res.status}`;
    if (Array.isArray(data.detalles) && data.detalles.length > 0) {
      mensaje += ' — ' + data.detalles.slice(0, 3).join(' · ');
    }
    const err = new Error(mensaje);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const api = {
  get:  (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),

  /* ── Auth ── */
  login: (nombre, pin) => request('POST', '/api/login', { nombre, pin }),
  logout: () => request('POST', '/api/logout').catch(() => {}),
  validate: () => request('GET', '/api/session'),

  /* ── Inventario ── */
  getInventario: () => request('GET', '/api/inventario'),
  getPTPorUbicacion: () => request('GET', '/api/inventario/pt-por-ubicacion'),
  getMPPorUbicacion: () => request('GET', '/api/inventario/mp-por-ubicacion'),
  /* Asignar/agregar existencia de una MP a un almacén (fábrica|teran) con candado.
     modo: 'agregar' (suma al almacén, sube total) | 'fijar' (fija el valor del almacén). */
  setMPUbicacion: (mp, ubicacion, qty, modo, nota, opts = {}) =>
    request('POST', '/api/inventario/mp/ubicacion', {
      mp, ubicacion, qty, modo, nota,
      codigoAutorizacion: opts.codigoAutorizacion,
    }),
  /* PT en Terán (pool manual, en cubetas). modo 'agregar'|'fijar' (fijar 0 = eliminar). */
  setPTUbicacion: (producto, ubicacion, qty, modo, nota, opts = {}) =>
    request('POST', '/api/inventario/pt/ubicacion', {
      producto, ubicacion, qty, modo, nota,
      codigoAutorizacion: opts.codigoAutorizacion,
    }),
  /* Transferencia manual de PT Fábrica→Terán (Josué): mueve N cubetas de
     inv.pt[X].qty a inv.pt[X].teran (no cambia el total). */
  transferirPTaTeran: (producto, cantidad, nota) =>
    request('POST', '/api/inventario/pt/transferir-teran', { producto, cantidad, nota }),
  /* Reenvasar PT del pool de Terán: convierte `origen` (tote/granel) en `destinos`
     [{tipo,qty,subKey,tapaKey}] consumiendo envases de Terán. No cambia el total. */
  reenvasarPTTeran: (producto, origen, destinos, nota) =>
    request('POST', '/api/inventario/pt/reenvasar-teran', { producto, origen, destinos, nota }),
  /* Transferencia de envase/tapa Fábrica→Terán (Josué): mueve N piezas de stock
     (Fábrica) a teran. ref = { tipo:'envase', catKey, subKey } | { tipo:'tapa', tapaKey }. */
  transferirEnvaseATeran: (ref, cantidad, nota) =>
    request('POST', '/api/envases/transferir-teran', { ...ref, cantidad, nota }),
  /* ── Órdenes de Transferencia (OT) — flujo formal Fábrica↔Terán con escaneo ── */
  crearOT: (lineas, nota) => request('POST', '/api/transferencias/crear', { lineas, nota }),
  getOTs: (estado) => request('GET', '/api/transferencias' + (estado ? '?estado=' + encodeURIComponent(estado) : '')),
  escanearOT: (otId, accion) => request('POST', '/api/transferencias/scan', { otId, accion }),
  /* Ajuste individual de UNA MP (qty + min). Permitido para admin e inventario.
     Más seguro que el overwrite completo de POST /api/inventario que es solo admin. */
  /* Ajuste individual de MP (qty + min) con candado: necesita sesión de conteo
     o codigoTOTP de Google Authenticator (override admin). */
  ajusteMP: (mp, qty, min, nota, opts = {}) =>
    request('POST', '/api/inventario/ajuste-mp', {
      mp, qty, min, nota,
      sesionConteoFolio: opts.sesionConteoFolio,
      codigoAutorizacion: opts.codigoAutorizacion,
    }),
  /* Flujo de aprobación: el rol inventario PROPONE; el admin aprueba/rechaza. */
  proponerAjuste: (tipo, nombre, qty, min, motivo) => request('POST', '/api/inventario/ajuste-propuesta', { tipo, nombre, qty, min, motivo }),
  getAjustesPendientes: () => request('GET', '/api/inventario/ajustes-pendientes'),
  aprobarAjuste: (id) => request('POST', '/api/inventario/ajuste-aprobar', { id }),
  rechazarAjuste: (id, motivo) => request('POST', '/api/inventario/ajuste-rechazar', { id, motivo }),
  /* Fuente única de verdad para KPIs de stock. Devuelve listas pre-filtradas. */
  getInventarioStats: () => request('GET', '/api/inventario/stats'),
  /* URLs para descargar/imprimir — se usan en window.open o <a href> */
  urlImportInv: () => API_BASE + '/api/importar/inventario',
  /* Importar existencias de PRODUCTO TERMINADO (flujo 2 pasos: preview → confirmar). */
  urlImportInvPT: () => API_BASE + '/api/importar/inventario-pt',
  /* Importar existencias/mínimos de ENVASES (aplica directo, sin preview). */
  urlImportEnvases: () => API_BASE + '/api/importar/envases',
  /* Paso 2 de la importación: aplica los cambios del preview (por importId). */
  confirmarImport: (importId) => request('POST', '/api/importar/confirmar', { importId }),

  /* ── Causas raíz de varianza ── */
  getCausasVarianza: () => request('GET', '/api/reportes/causas'),
  postCausaVarianza: (body) => request('POST', '/api/reportes/causas', body),
  /* Análisis avanzado */
  getCausasPareto: (desde, hasta) => request('GET', '/api/reportes/causas-pareto'
    + (desde || hasta ? '?' + new URLSearchParams({ desde: desde || '', hasta: hasta || '' }).toString() : '')),
  getRotacionFamilia: (periodo) => request('GET', '/api/reportes/rotacion-familia' + (periodo ? '?periodo=' + periodo : '')),
  getStockMuerto: (dias) => request('GET', '/api/reportes/stock-muerto?dias=' + (dias || 90)),
  getCalendarioConteos: () => request('GET', '/api/reportes/calendario-conteos'),
  getCronStatus: () => request('GET', '/api/reportes/cron/status'),
  /* Fase 4 — análisis estratégico */
  getLeadTimes: (dias) => request('GET', '/api/reportes/lead-times?dias=' + (dias || 365)),
  getCurvaABCDinamica: (year, q) => request('GET', '/api/reportes/curva-abc-dinamica?year=' + year + '&q=' + q),
  getCostoStockout: (periodo) => request('GET', '/api/reportes/costo-stockout' + (periodo ? '?periodo=' + periodo : '')),
  getComparativaAnual: (year) => request('GET', '/api/reportes/comparativa-anual?year=' + year),
  urlPDFEjecutivo: (year, q) => API_BASE + '/api/reportes/trimestral/' + year + '/' + q + '/pdf-ejecutivo' + (_token ? '?token=' + encodeURIComponent(_token) : ''),

  /* ── Forecast IA ── */
  getForecastSugerencias: (filtros = {}) => {
    const q = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v) q.append(k, v); });
    const qs = q.toString();
    return request('GET', '/api/forecast/sugerencias-compra' + (qs ? '?' + qs : ''));
  },
  getForecastSugerencia: (mp) => request('GET', '/api/forecast/sugerencia/' + encodeURIComponent(mp)),
  generarOCsBulkForecast: (items, notas) => request('POST', '/api/forecast/generar-oc-bulk', { items, notas }),

  /* ── Reportes / cierre mensual ── */
  getSnapshotsList: () => request('GET', '/api/reportes/snapshots'),
  getSnapshotPreview: () => request('GET', '/api/reportes/preview-actual'),
  getSnapshot: (periodo) => request('GET', '/api/reportes/snapshot/' + encodeURIComponent(periodo)),
  getHistoricoMensual: (n) => request('GET', '/api/reportes/historico?n=' + (n || 12)),
  getReporteTrimestral: (year, q) => request('GET', '/api/reportes/trimestral/' + year + '/' + q),
  cerrarMes: (periodo, confirmSobreescribir) =>
    request('POST', '/api/reportes/cerrar-mes', { periodo, confirmSobreescribir }),
  urlExportSnapshot: (periodo) => API_BASE + '/api/reportes/snapshot/' + encodeURIComponent(periodo) + '/export-xlsx' + (_token ? '?token=' + encodeURIComponent(_token) : ''),
  urlExportInv: (categoria, filter) => API_BASE + '/api/inventario/export-xlsx?categoria=' + encodeURIComponent(categoria || 'mp') + '&filter=' + encodeURIComponent(filter || 'todos') + (_token ? '&token=' + encodeURIComponent(_token) : ''),
  urlPrintInv: (categoria, filter) => API_BASE + '/api/inventario/hoja-impresion?categoria=' + encodeURIComponent(categoria || 'mp') + '&filter=' + encodeURIComponent(filter || 'todos') + (_token ? '&token=' + encodeURIComponent(_token) : ''),
  urlExportCycleCount: (sesionId) => API_BASE + '/api/cycle-count/' + encodeURIComponent(sesionId) + '/export-xlsx' + (_token ? '?token=' + encodeURIComponent(_token) : ''),
  urlPrintCycleCount: (sesionId) => API_BASE + '/api/cycle-count/' + encodeURIComponent(sesionId) + '/hoja-impresion' + (_token ? '?token=' + encodeURIComponent(_token) : ''),
  getMaestroMP: () => request('GET', '/api/maestro-mp'),
  /* Editar el PRECIO BASE (sin flete) de una MP desde el catálogo de compras.
     Propaga a costos_mp.json + maestro y, vía paso 1, al costo de fórmulas/PT. */
  setPrecioBaseMP: (mp, precioBase) =>
    request('POST', '/api/mp/precio-base', { mp, precioBase }),
  /* OCs / Solicitudes de compra MP.
     FIX jun 2026: getOrdenesCompra ahora lee del archivo canónico que Arely
     usa (/api/compras/oc → compras_oc.json) en lugar del archivo paralelo
     /api/ordenes-compra que NADIE más miraba. Las solicitudes de Enrique ahora
     SÍ aparecen en su tab "Mis solicitudes" porque ese archivo es el mismo
     que ve Arely. */
  getOrdenesCompra: () => request('GET', '/api/compras/oc'),
  solicitudMP: ({ mps, prioridad, notas, proveedorSugerido }) =>
    request('POST', '/api/ordenes-compra/solicitud', { mps, prioridad, notas, proveedorSugerido }),
  getEnvases: () => request('GET', '/api/envases'),
  recepcionMP: (mp, cantidad, proveedor, nota, factura) =>
    request('POST', '/api/inventario/recepcion-mp', { mp, cantidad, proveedor, nota, factura }),
  /* Inventario INICIAL PT (baseline): para producto terminado que YA estaba
     en almacén antes de empezar a usar el ERP. No es producción ni recepción
     de lote — es carga inicial / corrección manual. Admite individual o masivo. */
  ptInicial: ({ producto, cantidad, min, nota, items }) =>
    request('POST', '/api/inventario/pt-inicial', items ? { items, nota } : { producto, cantidad, min, nota }),
  /* Ajuste inline de UN producto terminado (qty + min) con audit.
     CANDADO REFORZADO: backend exige sesionConteoFolio o codigoTOTP de
     Google Authenticator (override admin). PIN ya no aplica para override. */
  ajustePT: (producto, qty, min, nota, opts = {}) =>
    request('POST', '/api/inventario/ajuste-pt', {
      producto, qty, min, nota,
      sesionConteoFolio: opts.sesionConteoFolio,
      codigoAutorizacion: opts.codigoAutorizacion,
    }),
  /* Metadatos de catálogo de un PT (nombre / SKU) — no toca stock, no exige
     candado. El backend bloquea renombrar PTs ligados a fórmula y SKUs
     duplicados (decisión owner jun 2026: Burgos edita nombre + SKU). */
  ptMeta: (producto, { sku, nuevoNombre, medida, medidaQty } = {}) =>
    request('POST', '/api/inventario/pt-meta', { producto, sku, nuevoNombre, medida, medidaQty }),

  /* Asistente con IA (Claude). El bot flotante manda el texto libre del usuario
     y el backend reenvía a la Messages API con la key del servidor. */
  asistenteChat: (mensaje, historial = [], destinos = [], pantalla = '') =>
    request('POST', '/api/asistente/chat', { mensaje, historial, destinos, pantalla }),

  /* Renombrar una materia prima de forma CANÓNICA: el backend propaga el
     nombre nuevo a inventario, maestro_mp, fórmulas, compras, costos y
     proveedores (un solo nombre canónico). Solo admin — operación de alto
     impacto (toca todos los JSON). No toca stock ni exige candado. */
  renombrarMP: (nombreViejo, nombreNuevo) =>
    request('POST', '/api/mp/renombrar', { nombreViejo, nombreNuevo }),

  /* ── Estado TOTP del usuario actual (read-only, no genera secret) ── */
  getTOTPStatus: () => request('GET', '/api/totp/status'),

  /* ── Inventario CANÓNICO (fuente de verdad protegida por TOTP) ── */
  getCanonico: () => request('GET', '/api/inventario/canonico'),
  getCanonicoDelta: () => request('GET', '/api/inventario/canonico/delta'),
  crearCanonico: (codigoTOTP, motivo) =>
    request('POST', '/api/inventario/canonico/crear', { codigoTOTP, motivo }),
  modificarCanonico: (codigoTOTP, motivo, cambios) =>
    request('POST', '/api/inventario/canonico/modificar', { codigoTOTP, motivo, cambios }),

  /* ── Órdenes ── */
  getOrdenes: () => request('GET', '/api/ordenes'),
  getPedidos: () => request('GET', '/api/pedidos'),
  upsertPedido: (pedido) => request('POST', '/api/pedidos/upsert', pedido),
  /* X2 (jun 2026): deletePedido eliminado — backend retorna 410. Usar eliminarPedido. */
  /* Eliminar pedido (admin con motivo + PIN). Revierte MP si tiene orden vinculada
     que ya produjo. Marca pedido y orden como eliminado para auditoría. */
  eliminarPedido: (pedidoId, nombre, pin, motivo) =>
    request('POST', '/api/pedidos/eliminar', { pedidoId, nombre, pin, motivo }),
  upsertOrden: (orden) => request('POST', '/api/ordenes/upsert', orden),
  eliminarOrden: (ordenId, nombre, pin, motivo) =>
    request('POST', '/api/ordenes/eliminar', { ordenId, nombre, pin, motivo }),
  getFormulasSummary: () => request('GET', '/api/formulas/summary'),

  /* ── Producción / Trazabilidad ── */
  getTrazabilidad: () => request('GET', '/api/trazabilidad'),
  /* X2 (jun 2026): upsertTrazabilidad eliminado — backend retorna 410 sin header
     x-trazabilidad-overwrite-confirm:SI. Usar crearLote o api.transicionLote/Sublote. */
  /* Crear UN lote nuevo — server asigna código canónico LP-YYYYMMDD-NNN
     dentro del mutex, evitando colisiones del antiguo Math.random*999. */
  crearLote: (lote) => request('POST', '/api/trazabilidad/lote', { lote }),

  /* Sprint G-9: cambiar el PIN propio (self-service, sin admin).
     Requiere conocer el PIN actual. Tras el cambio se cierran las demás
     sesiones del usuario, manteniendo solo la actual. */
  cambiarPinPropio: (pinActual, pinNuevo) =>
    request('POST', '/api/usuarios/cambiar-pin-propio', { pinActual, pinNuevo }),

  /* Validar disponibilidad de MP antes de aceptar/lanzar orden.
     Devuelve {ok, suficiente, faltantes:[{mp, requeridoKg, libreKg, faltanteKg, leadTimeDias}]}. */
  validarStock: (formula, cantidad, excluirOrden) => {
    const qs = new URLSearchParams({
      formula: String(formula),
      cantidad: String(cantidad),
      ...(excluirOrden ? { excluirOrden } : {}),
    }).toString();
    return request('GET', `/api/ordenes/validar-stock?${qs}`);
  },

  /* Aceptar pedido + crear orden vinculada en UNA operación atómica.
     Reemplaza el flujo paralelo (aceptar pedido por un lado + crear orden suelta
     por otro) que generaba pedidos huérfanos y órdenes sin pedidoId.
     Idempotente: si el pedido ya tiene ordenId, devuelve la orden existente. */
  aceptarYProducir: (pedidoId, opts = {}) =>
    request('POST', '/api/pedidos/aceptar-y-producir', {
      pedidoId,
      lanzarProduccion: !!opts.lanzarProduccion,
      /* jun 2026: el server exige NDA aceptado para LANZAR producción
         (no-admin). El caller lo manda tras pasar el NDAModal. */
      ndaAceptado: !!opts.ndaAceptado,
    }),
  /* Rechazar pedido (técnico): endpoint dedicado que valida estado server-side
     y CANCELA la orden vinculada (jun 2026 — antes el upsert dejaba la orden
     huérfana producible). */
  rechazarPedido: (pedidoId, motivo) =>
    request('POST', '/api/pedidos/rechazar', { pedidoId, motivo }),
  getProduccionHistorial: () => request('GET', '/api/produccion-historial'),
  getQC: () => request('GET', '/api/qc'),
  /* saveQC = legacy overwrite (admin only). NO USAR — usar transicionLote('aprobarQC') */
  saveQC: (data) => request('POST', '/api/qc', data),
  registrarQC: (record) => request('POST', '/api/qc/registrar', record),
  /* Rangos QC por producto — para mostrar al técnico cuáles son los valores
     esperados al lado de cada input y marcar verde/rojo automático. */
  getQCSpecs: () => request('GET', '/api/qc/specs'),
  validarQC: (formulaId, mediciones) =>
    request('POST', '/api/qc/validar', { formulaId, mediciones }),

  /* ── State machine: transiciones unificadas de lote/sublote ────────── */
  /* Mueve un lote (pre-envasado) entre estados con validación server-side.
     accion: aceptarPedido, rechazarPedido, iniciarProduccion, finalizarProduccion,
             aprobarQC, rechazarQC, reabrirProduccion, marcarEnvasado, cancelarLote */
  transicionLote: (loteId, accion, payload) =>
    request('POST', '/api/lotes/transicion', { loteId, accion, payload }),
  /* Mueve un sublote (post-envasado) entre estados.
     accion: marcarRecoleccion, escanearRecoger, escanearRecibirTeran,
             reenvasarTote, cancelarSublote */
  transicionSublote: (subloteCod, accion, payload) =>
    request('POST', '/api/sublotes/transicion', { subloteCod, accion, payload }),
  /* Scanner de QR — el cliente solo manda el payload escaneado y la acción
     pretendida; el server resuelve sublote y valida que matchee. */
  escanearSublote: (qrPayloadOCod, accion) => {
    const isUrl = typeof qrPayloadOCod === 'string' && qrPayloadOCod.startsWith('http');
    return request('POST', '/api/sublotes/scan',
      isUrl ? { qrPayload: qrPayloadOCod, accion }
            : { scanCod: qrPayloadOCod, accion });
  },
  /* Qué puede hacer el usuario actual con un sublote (usado para mostrar/ocultar botones) */
  getAccionesSublote: (cod) =>
    request('GET', '/api/sublotes/acciones?cod=' + encodeURIComponent(cod)),
  /* Aplicar una acción a TODOS los sublotes elegibles de un lote en una sola
     operación atómica. Caso: Luis/Josué escaneó el QR del LOTE completo.
     FIX jun 2026 (auditoría D1): el guard anti-"robo de lote" del backend exige
     scanCod/qrPayload del QR físico para escanearRecoger/RecibirTeran — sin
     reenviarlo, el bulk respondía 400 SIEMPRE y "tomar todo el lote" nunca
     funcionó. El caller pasa el código que escaneó. */
  escanearLoteBulk: ({ loteId, codigoLote, accion, scanCod, qrPayload }) =>
    request('POST', '/api/sublotes/scan-bulk', { loteId, codigoLote, accion, scanCod, qrPayload }),
  getFormulaOrden: (ordenId) => request('POST', '/api/formulas/orden', { ordenId }),
  registrarProduccion: (body) => request('POST', '/api/inventario/produccion', body),

  /* ── Producción flujo paso-a-paso (motor migrado del SPA legacy) ── */
  getProduccionSteps: (producto, lotes, litPerUnit) =>
    request('POST', '/api/produccion/steps', { producto, lotes: lotes || 1, litPerUnit: litPerUnit || 19 }),
  getProduccionCheckpoint: (ordenId) =>
    request('GET', '/api/produccion/checkpoint?ordenId=' + encodeURIComponent(ordenId)),
  saveProduccionCheckpoint: (ordenId, state, usuario) =>
    request('POST', '/api/produccion/checkpoint', { ordenId, state, usuario }),
  clearProduccionCheckpoint: (ordenId) =>
    request('DELETE', '/api/produccion/checkpoint?ordenId=' + encodeURIComponent(ordenId)),

  /* ── Envasado ── */
  registrarEnvasado: (loteId, sublotes) => request('POST', '/api/envasado/registrar', { loteId, sublotes }),
  cerrarLote: (loteId) => request('POST', '/api/envasado/cerrar-lote', { loteId }),
  transferirSublotes: (loteId, subloteCods) => request('POST', '/api/envasado/transferir', { loteId, subloteCods }),
  /* DEPRECATED — usar transicionSublote(toteCod, 'reenvasarTote', { nuevosSublotes, litrosConsumidos }).
     Se mantiene SOLO para compat con código legacy externo; el frontend nuevo usa la state machine. */
  reenvasar: (loteId, toteCod, sublotes) => request('POST', '/api/envasado/reenvasar', { loteId, toteCod, sublotes }),

  /* ── Fórmulas ── */
  getFormulas: () => request('GET', '/api/formulas/todas'),
  updateFormula: (formulaId, ingredientes, tecnico) =>
    request('POST', '/api/formulas/update-formula', { formulaId, ingredientes, tecnico }),
  renameFormula: (oldName, newName) =>
    request('POST', '/api/formulas/rename-react', { oldName, newName }),

  /* ── Compras ── */
  getForecast: () => request('GET', '/api/compras/forecast-avanzado'),
  getMRP: () => request('GET', '/api/compras/mrp'),
  getOCs: () => request('GET', '/api/compras/oc'),
  createOC: (data) => request('POST', '/api/compras/oc', data),
  editOC: (data) => request('POST', '/api/compras/oc/editar', data),
  recibirOC: (id, items, firma, recibidoPor, qcMP) =>
    request('POST', '/api/compras/oc/recibir', { id, items, firma, recibidoPor, qcMP }),
  eliminarOC: (id, motivo, codigo) =>
    request('POST', '/api/compras/oc/eliminar', { id, motivo, codigo }),
  /* AC1/AC2 (jun 2026): aprobar OC con forma de pago + comprobante, y registrar pago */
  aprobarOC: (data) => request('POST', '/api/compras/oc/aprobar', data),
  registrarPagoOC: (data) => request('POST', '/api/compras/oc/registrar-pago', data),

  /* ── Reports ── */
  getReportProduction: (year) => request('GET', `/api/reports/production-monthly?year=${year}`),
  getReportProfitability: () => request('GET', '/api/reports/profitability'),
  getReportValuation: () => request('GET', '/api/reports/inventory-valuation'),

  /* ── Notificaciones ── */
  getNotificaciones: () => request('GET', '/api/notificaciones'),

  /* ── Usuarios (admin) ── */
  getUsuarios: () => request('GET', '/api/usuarios'),
  crearUsuario: (id, nombre, apellido, pin, rol) =>
    request('POST', '/api/usuarios/crear', { id, nombre, apellido, pin, rol }),
  editarUsuario: (userId, nombre, apellido, rol) =>
    request('POST', '/api/usuarios/editar', { userId, nombre, apellido, rol }),
  cambiarPin: (userId, newPin) =>
    request('POST', '/api/usuarios/pin', { userId, newPin }),
  eliminarUsuario: (userId) =>
    request('POST', '/api/usuarios/eliminar', { userId }),
  desbloquearUsuario: (userId) =>
    request('POST', '/api/usuarios/desbloquear', { userId }),

  /* ── Permisos por rol ── */
  getPermisosRoles: () => request('GET', '/api/permisos/roles'),
  getMisPermisos:   () => request('GET', '/api/permisos/me'),

  /* Fix #7 — Predicción operativa de compras por MP individual (3-6 meses) */
  getPrediccionPedidos: (meses, margen) =>
    request('GET', '/api/compras/prediccion-pedidos?meses=' + (meses || 3) + '&margen=' + (margen || 1.15)),

  /* Pruebas — eliminar individual o limpiar todo (admin only) */
  eliminarLotePrueba: (codigoLote) =>
    request('POST', '/api/trazabilidad/eliminar-prueba', { codigoLote }),
  limpiarTodasLasPruebas: () =>
    request('POST', '/api/pruebas/limpiar', {}),

  /* POS Aliases — gestión de mapeo POS → fórmulas (Fix Sistema de aliases) */
  getPosAliases: (filtro) => request('GET', '/api/pos/aliases' + (filtro ? '?filtro=' + filtro : '')),
  getPosAliasesStats: () => request('GET', '/api/pos/aliases/stats'),
  asignarPosAlias: (body) => request('POST', '/api/pos/aliases/asignar', body),
  setPermisosRol: (rol, permisos) =>
    request('POST', '/api/permisos/roles', { rol, permisos }),

  /* ── Maestro MP (estado/sustituir/eliminar) ── */
  setMaestroMPEstado: (mp, estado) =>
    request('POST', '/api/maestro-mp/estado', { mp, estado }),
  setMaestroMPCampo: (mp, campo, valor) =>
    request('POST', '/api/maestro-mp', { mp, campo, valor }),
  eliminarMP: (mp, forzar) =>
    request('POST', '/api/mp/eliminar', { mp, forzar }),
  sustituirMP: (mpOriginal, mpSustituta) =>
    request('POST', '/api/mp/sustituir', { mpOriginal, mpSustituta }),
  checkMPFormulas: (mp) =>
    request('GET', '/api/mp/check-formulas/' + encodeURIComponent(mp)),

  /* ── Cycle Count ── */
  getCycleCounts: () => request('GET', '/api/cycle-count'),
  cycleCountIniciar: (categoria, tipo, pin) =>
    request('POST', '/api/cycle-count/iniciar', { categoria, tipo, pin }),
  cycleCountRegistrar: (sesionId, itemKey, stockFisico) =>
    request('POST', '/api/cycle-count/registrar', { sesionId, itemKey, stockFisico }),
  cycleCountAgregarItem: (sesionId, nombre, stockFisico, unidad) =>
    request('POST', '/api/cycle-count/agregar-item', { sesionId, nombre, stockFisico, unidad }),
  cycleCountFinalizar: (sesionId, pin) =>
    request('POST', '/api/cycle-count/finalizar', { sesionId, pin }),
  cycleCountAprobar: (sesionId, causasPorItem) =>
    request('POST', '/api/cycle-count/aprobar', { sesionId, causasPorItem }),

  /* ── Sesiones log ── */
  getSesionesLog: () => request('GET', '/api/sesiones-log'),

  /* ── Precios venta + Márgenes ── */
  getPreciosVenta: () => request('GET', '/api/precios-venta'),
  setPrecioVenta: (formula, precioCubeta, precioGalon, precioLitro) =>
    request('POST', '/api/precios-venta', { formula, precioCubeta, precioGalon, precioLitro }),
  /* Versión flexible: acepta cualquier subset {precioCubeta, precioTote, precioCubetaMayoreo, ...} */
  setPrecios: (formula, fields) =>
    request('POST', '/api/precios-venta', { formula, ...fields }),
  getMargenes: () => request('GET', '/api/reports/margenes'),
  getCostosPTConfig: () => request('GET', '/api/costos-pt-config'),
  setCostosPTConfig: (data) => request('POST', '/api/costos-pt-config', data),

  /* ── Devoluciones + Nota de crédito ── */
  getDevoluciones: () => request('GET', '/api/devoluciones'),
  registrarDevolucion: (cliente, producto, cantidad, presentacion, motivo, montoDevuelto, codigoLote, ajustarInventario) =>
    request('POST', '/api/devoluciones', {
      cliente, producto, cantidad, presentacion, motivo, montoDevuelto, codigoLote, ajustarInventario,
    }),
  /* FIX jun 2026 (K7): emisor de reembolso/NC, cierra el ciclo de devolución. */
  emitirReembolso: (devolucionId, folioNC, monto, nota) =>
    request('POST', '/api/devoluciones/' + encodeURIComponent(devolucionId) + '/reembolsar',
      { folioNC, monto, nota }),
  /* FIX jun 2026 (L2): Enrique (técnico/admin) decide qué hacer con la
     devolución recibida en fábrica: regresar al stock, reprocesar, o descartar. */
  recibirDevolucion: (devolucionId, recibidoPor, firma, qrEscaneado) =>
    request('POST', '/api/devoluciones/recibir', { devolucionId, recibidoPor, firma, qrEscaneado }),
  disponerDevolucion: (devolucionId, disposicion, nota) =>
    request('POST', '/api/devoluciones/disposicion', { devolucionId, disposicion, nota }),

  /* ── Devoluciones de MP → proveedor (Capa 3, Arely) ── */
  getDevolucionesMP: () => request('GET', '/api/devoluciones/mp'),
  crearDevolucionMP: (data) => request('POST', '/api/devoluciones/mp/crear', data),
  cerrarDevolucionMP: (data) => request('POST', '/api/devoluciones/mp/cerrar', data),
  comprobanteDevolucionMPUrl: (id) =>
    '/api/devoluciones/mp/' + encodeURIComponent(id) + '/comprobante',

  /* ── SAT / CFDI ── */
  satParse: (xmlText) => request('POST', '/api/sat/parse', { xmlText }),
  satRegistrar: (cfdi, ocId) => request('POST', '/api/sat/registrar', { cfdi, ocId }),
  getFacturasSAT: () => request('GET', '/api/sat/facturas'),

  /* ── Predicción IA ── */
  getForecastAI: (h = 3) => request('GET', '/api/forecast/ai?h=' + h),

  /* ── Dashboard ejecutivo ── */
  getDashboardExec: () => request('GET', '/api/dashboard/exec'),

  /* ── Laboratorio ── */
  getLabMaterias: () => request('GET', '/api/lab/materias'),
  saveLabMateria: (mp) => request('POST', '/api/lab/materias', mp),
  deleteLabMateria: (id) => request('POST', '/api/lab/materias/eliminar', { id }),
  getLabPruebas: () => request('GET', '/api/lab/pruebas'),
  saveLabPrueba: (prueba) => request('POST', '/api/lab/pruebas', prueba),
  deleteLabPrueba: (id) => request('POST', '/api/lab/pruebas/eliminar', { id }),
  saveLabQC: (pruebaId, qc) => request('POST', '/api/lab/pruebas/qc', { pruebaId, qc }),
};

export default api;
