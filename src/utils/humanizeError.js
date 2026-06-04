/* Sprint G-3 (jun 2026): mapea errores del backend a mensajes accionables.
   Antes los catch hacían `setErr(e.message)` exponiendo "Failed to fetch",
   "Internal Server Error" o "HTTP 500" sin contexto operativo. Enrique en
   planta veía esos mensajes y perdía 5 min reseteando la app sin entender qué
   pasaba.

   Este helper inspecciona el error (status HTTP + códigos custom del backend)
   y devuelve un mensaje en español orientado a acción.

   USO:
     import humanizeError from '../utils/humanizeError';
     try { ... } catch (e) { setErr(humanizeError(e)); }
*/

/* Mapa de códigos de error específicos del backend → mensaje claro */
const CODIGOS_BACKEND = {
  CODIGO_INCORRECTO:    'Código incorrecto. Verifica tu Google Authenticator o pide el código universal al admin.',
  PIN_INCORRECTO:       'PIN incorrecto. Verifica e intenta de nuevo.',
  TOTP_FAIL:            'Código TOTP inválido. Espera al siguiente (cambia cada 30s).',
  CODIGO_ADMIN_FAIL:    'Código admin incorrecto.',
  ORDEN_NO_EXISTE:      'La orden ya no existe (probablemente fue eliminada). Refresca la pantalla.',
  ORDEN_ELIMINADA:      'La orden fue eliminada. No puedes operar sobre ella.',
  PEDIDO_NO_EXISTE:     'El pedido ya no existe. Refresca la pantalla.',
  PEDIDO_ELIMINADO:     'El pedido fue eliminado.',
  MP_NO_EXISTE:         'La materia prima no existe en el catálogo. Pídeselo a compras antes de operar.',
  FORMULA_NO_EXISTE:    'La fórmula no existe. Verifica el nombre o créala primero.',
  SESION_NO_ENCONTRADA: 'La sesión de conteo no existe o fue cerrada. Inicia una nueva.',
  SESION_NO_ACTIVA:     'La sesión de conteo ya no está activa.',
  SESION_AJENA:         'Esa sesión de conteo la abrió otro usuario, no puedes operar en ella.',
  ITEM_FUERA_DE_SCOPE:  'Este item no está en el scope de tu sesión de conteo. Agrégalo a la sesión o usa código admin.',
  AJUSTE_BLOQUEADO_NECESITA_CANDADO: 'Necesitas autorización: sesión de conteo activa o código admin/TOTP.',
  PERMISO_DENEGADO:     'No tienes permiso para esta acción. Pide al admin habilitártelo.',
  ESTADO_INVALIDO:      'El estado actual no permite esta acción. Refresca la pantalla.',
  RATE_LIMIT:           'Estás haciendo demasiadas operaciones por hora. Espera unos minutos.',
};

/* Mapa de HTTP status → mensaje genérico de respaldo */
const HTTP_FALLBACK = {
  400: 'Datos inválidos: revisa los campos del formulario.',
  401: 'Tu sesión expiró. Ingresa tu PIN otra vez.',
  403: 'No tienes permiso para esta acción.',
  404: 'No se encontró el recurso (probablemente fue eliminado). Refresca la pantalla.',
  409: 'La información cambió mientras editabas. Refresca y reintenta.',
  413: 'El archivo o datos son demasiado grandes.',
  429: 'Estás haciendo demasiadas operaciones. Espera unos segundos.',
  500: 'Error interno del servidor. Avisa a Emmanuel con captura de pantalla.',
  502: 'El servidor está reiniciando. Espera 30 segundos y reintenta.',
  503: 'Servidor en mantenimiento. Vuelve en unos minutos.',
  504: 'El servidor tardó demasiado. Verifica tu conexión y reintenta.',
};

/* Patrones en e.message → mensaje claro (último recurso, frágil) */
function _matchPatron(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return 'Sin conexión a internet. Verifica tu WiFi o datos móviles.';
  }
  if (m.includes('timeout') || m.includes('aborted')) {
    return 'La solicitud tardó demasiado. Verifica tu conexión y reintenta.';
  }
  return null;
}

export default function humanizeError(e) {
  if (!e) return 'Error desconocido.';
  /* Si el error trae payload del backend (data.codigo o data.error) → preferir esos */
  const data    = e?.data || {};
  const codigo  = data.codigo || e.codigo;
  const errMsg  = data.error || data.msg || e.message;
  const status  = e?.status || data.status;

  /* 1. Código específico del backend (prioridad máxima) */
  if (codigo && CODIGOS_BACKEND[codigo]) return CODIGOS_BACKEND[codigo];

  /* 2. Mensaje específico del backend si parece informativo */
  if (errMsg && typeof errMsg === 'string' && errMsg.length > 0 && errMsg.length < 200
      && !/(internal server error|http \d|failed)/i.test(errMsg)) {
    return errMsg;
  }

  /* 3. Patrones conocidos en el mensaje crudo */
  const porPatron = _matchPatron(errMsg);
  if (porPatron) return porPatron;

  /* 4. HTTP status fallback */
  if (status && HTTP_FALLBACK[status]) return HTTP_FALLBACK[status];

  /* 5. Último recurso */
  return errMsg ? `Error: ${errMsg}` : 'No se pudo completar la operación. Reintenta o avisa a Emmanuel.';
}
