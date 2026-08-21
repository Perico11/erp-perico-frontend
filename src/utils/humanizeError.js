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
  /* AUDIT UX 16-jul (U4): el login manda error:'credentials'/'blocked' como token
     pelón — sin esto el operario veía literalmente "credentials" en pantalla. */
  credentials:          'PIN incorrecto. Verifica el usuario y el PIN e intenta de nuevo.',
  blocked:              'Cuenta bloqueada por intentos fallidos. Pide al admin desbloquearla.',
};

/* AUDIT UX 16-jul (U4): errores NUEVOS de julio (OTs comprometidas, 409 de la
   state machine de OT, ingresos) traducidos al idioma del operario. Se evalúan
   ANTES del passthrough del mensaje del backend porque esos textos, aunque
   "informativos", traen jerga (OT, estado, MB) que confunde en planta. */
const PATRONES_JULIO = [
  /* server.js: "…pero N están comprometidas por OTs pendientes de surtir…" */
  { re: /comprometid[oa]s? por OTs?\b/i,
    msg: 'Ese stock está apartado por una solicitud de transferencia pendiente. Súrtela o cancélala primero.' },
  /* lib/transferenciaStateMachine.js: "La OT está en estado 'x' y no puede…" (409) */
  { re: /La OT está en estado/i,
    msg: 'Esta transferencia ya avanzó en otro teléfono — la pantalla se va a refrescar.' },
  /* routes/ingresos.js: "La factura excede 4 MB (reduce la foto)" */
  { re: /factura excede 4\s*MB/i,
    msg: 'La foto de la factura pesa más de 4 MB. Tómala de nuevo con menos resolución e intenta otra vez.' },
  /* routes/transferencias.js: "…N ya comprometidos por otras solicitudes…" */
  { re: /comprometid[oa]s? por otras solicitudes/i,
    msg: 'Ese stock está apartado por otra solicitud de transferencia pendiente. Súrtela o cancélala primero.' },
  /* MPs de gasto local (AGUA): salen de la llave, no se compran ni bloquean */
  { re: /gasto local/i,
    msg: 'Esa materia prima es de gasto local (como el AGUA): se consigue aquí mismo, no se pide a proveedor ni bloquea la producción.' },
];

/* routes/ingresos.js: "MP no existe en inventario: X (agrégala en el Maestro
   primero)" — conservamos el NOMBRE de la MP (útil cuando hay varias líneas). */
const RE_MP_NO_EXISTE = /MP no existe en inventario:\s*(.+?)\s*\(/i;

function _matchPatronJulio(msg) {
  const raw = String(msg || '');
  if (!raw) return null;
  const mp = RE_MP_NO_EXISTE.exec(raw);
  if (mp) return `"${mp[1]}" no está dada de alta en el inventario. Pide al admin agregarla al Maestro de MP y vuelve a intentar.`;
  const hit = PATRONES_JULIO.find(p => p.re.test(raw));
  return hit ? hit.msg : null;
}

/* Mapa de HTTP status → mensaje genérico de respaldo */
const HTTP_FALLBACK = {
  400: 'Datos inválidos: revisa los campos del formulario.',
  /* AUDIT UX 16-jul (U4): 401/409 en palabras del operario */
  401: 'Tu sesión expiró — vuelve a entrar.',
  403: 'No tienes permiso para esta acción.',
  404: 'No se encontró el recurso (probablemente fue eliminado). Refresca la pantalla.',
  409: 'La información cambió en otro dispositivo. Refresca e intenta de nuevo.',
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
    /* AUDIT UX 16-jul (U4): en palabras del operario en planta */
    return 'Sin conexión. Revisa la señal e intenta de nuevo.';
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
  let   errMsg  = data.error || data.msg || e.message;
  const status  = e?.status || data.status;

  /* AUDIT UX 16-jul (U4): errMsg puede llegar como objeto (payload anidado) —
     coercerlo aquí garantiza no mostrar jamás "[object Object]" en pantalla. */
  if (errMsg != null && typeof errMsg !== 'string') {
    errMsg = (typeof errMsg.message === 'string' && errMsg.message) || '';
  }
  if (errMsg === '[object Object]') errMsg = '';

  /* 1. Código específico del backend (prioridad máxima).
     hasOwnProperty: un "código" hostil tipo 'constructor' no debe resolver
     contra Object.prototype (devolvería una función, no un mensaje). */
  const _porCodigo = (k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(CODIGOS_BACKEND, k)) ? CODIGOS_BACKEND[k] : null;
  const msgCodigo = _porCodigo(codigo);
  if (msgCodigo) return msgCodigo;
  /* AUDIT UX 16-jul (U4): el login manda el token en data.error ('credentials',
     'blocked'), no en data.codigo — match exacto contra el mismo mapa. */
  const msgToken = _porCodigo(errMsg);
  if (msgToken) return msgToken;

  /* AUDIT UX 16-jul (U4): "ERR-XXX-N: texto" → mostrar solo el texto (el código
     no le dice nada al operario). Un "ERR-XXX" pelón sin texto queda vacío y
     cae a los fallbacks de abajo — nunca se muestra el código solo. */
  if (errMsg && /^ERR-[A-Z0-9]+(-[A-Z0-9]+)*\s*:?/i.test(errMsg)) {
    errMsg = errMsg.replace(/^ERR-[A-Z0-9]+(-[A-Z0-9]+)*\s*:?\s*/i, '').trim();
  }

  /* 1.5 AUDIT UX 16-jul (U4): patrones de los errores de julio — van ANTES
     del passthrough (2) porque esos mensajes pasan el filtro "informativo"
     pero traen jerga técnica que el operario no entiende. */
  const porJulio = _matchPatronJulio(errMsg);
  if (porJulio) return porJulio;

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

  /* 5. Último recurso — AUDIT UX 16-jul (U4): jamás "[object Object]" ni códigos pelones */
  return (typeof errMsg === 'string' && errMsg.trim())
    ? `Error: ${errMsg}`
    : 'No se pudo completar la operación. Reintenta o avisa a Emmanuel.';
}
