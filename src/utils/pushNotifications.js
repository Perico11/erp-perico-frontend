/**
 * Push Notifications utility — usa Notification API nativa del navegador.
 *
 * Maneja:
 *  - Pedir permiso al usuario (una sola vez, persiste la respuesta)
 *  - Settings por usuario en localStorage (qué eventos quiere notificar)
 *  - Filtro: solo notifica si la pestaña NO está visible (evita spam)
 *  - Helpers para eventos críticos del ERP
 */

const SETTINGS_KEY = 'pp_push_settings';

const DEFAULT_SETTINGS = {
  enabled: false,                // master switch
  stockCritico: true,            // MP sin existencia
  ocVencida: true,               // OC pasada fecha entrega
  ocNueva: true,                 // Técnico solicitó OC (a compras)
  devolucion: true,              // Devolución registrada
  loteEnCamino: true,            // Lote escaneado por Luis
  qcHold: true,                  // Lote retenido en QC
  conteoVarianza: true,          // Cycle count con varianza > 5% (aprueba admin)
  conteoAprobado: true,          // Conteo aprobado/finalizado (a Burgos)
  pedidoNuevo: true,             // Almacén creó nuevo pedido (a técnico)
  loteListo: true,               // Lote producido/envasado listo para recolección (a almacén)
  soloEnSegundoPlano: true,      // Solo cuando pestaña no está visible
};

export function getPushSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function setPushSettings(patch) {
  const cur = getPushSettings();
  const next = { ...cur, ...patch };
  /* M11 FIX: localStorage puede throw QuotaExceededError en iOS Safari
     privado o si el storage está lleno. NO debe romper toda la app. */
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('[pushNotifications] No se pudo guardar settings:', e?.message);
  }
  return next;
}

/* Estado del permiso del navegador: 'default' | 'granted' | 'denied' | 'unsupported' */
export function getPushPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestPushPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return 'denied';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   FILTRO POR PIPELINE (ROL) — decisión owner jun 2026: "todos los usuarios
   pueden activar push en su dispositivo, pero solo reciben notificaciones
   que involucren SU pipeline".

   TIPOS_POR_ROL — espejo de TIPO_ROLES_PERMITIDOS de server.js
   (GET /api/notificaciones) — mantener sincronizado. Claves snake_case =
   tipos de notificación del backend. Admin SIEMPRE pasa (igual que el
   backend, que para admin ni siquiera aplica el filtro).
   ═══════════════════════════════════════════════════════════════════════ */
export const TIPOS_POR_ROL = {
  stock_bajo:        ['admin', 'compras', 'almacen'],
  oc_vencida:        ['admin', 'compras'],
  oc_proxima_vencer: ['admin', 'compras'],
  oc_credito_vencido:    ['admin', 'compras'],
  oc_credito_por_vencer: ['admin', 'compras'],
  oc_sin_proveedor:  ['admin', 'compras'],
  discrepancia_oc:   ['admin', 'compras', 'tecnico'],
  mp_sin_costo:      ['admin', 'compras'],
  alerta_mp:         ['admin', 'compras', 'tecnico'],
  qc_hold:           ['admin', 'tecnico'],
  qc_pendiente:      ['admin', 'tecnico'],
  caducidad_vencida: ['admin', 'almacen', 'compras'],
  caducidad_proxima: ['admin', 'almacen', 'compras'],
  conteo_pendiente_aprobacion: ['admin'], /* solo admin aprueba ajustes de conteo */
  devolucion_mp_pendiente: ['admin', 'compras'], /* Arely gestiona NC/reembolso */
  rendimiento_bajo:  ['admin'],
};

/* Tipos de push del frontend (camelCase = claves de pp_push_settings) → roles.
   Donde existe equivalente backend se REUSA la lista del espejo de arriba; los
   tipos que solo existen como evento WS directo llevan lista propia según el
   pipeline de cada rol:
     pedido (almacén) → orden/producción/QC/envasado (técnico) → recolección
     (Luis) → recepción Terán (Josué) · compras/OC (Arely) · conteo (Burgos). */
export const PUSH_TIPO_ROLES = {
  stockCritico:        TIPOS_POR_ROL.stock_bajo,
  ocVencida:           TIPOS_POR_ROL.oc_vencida,
  ocNueva:             ['admin', 'compras'],            /* técnico solicita → Arely aprueba */
  ocEditada:           ['admin', 'compras', 'tecnico'], /* el solicitante ve su OC aprobada/editada */
  ocRecibida:          ['admin', 'compras', 'tecnico'], /* MP llegó: cierre de Arely + aviso a Enrique */
  devolucion:          ['admin', 'compras', 'almacen', 'tecnico'], /* espejo del filtro WS 'devolucion' de _broadcast */
  devolucionReembolso: ['admin', 'compras'],            /* NC/reembolso lo gestiona Arely */
  devolucionCerrada:   ['admin', 'compras'],
  loteEnCamino:        ['admin', 'almacen'],            /* Josué se prepara para recibir en Terán */
  loteListo:           ['admin', 'almacen', 'recolector'], /* listo para solicitar/hacer recolección */
  subloteRecibido:     ['admin', 'tecnico'],            /* Enrique ve el ciclo cerrado (L9) */
  pedidoNuevo:         ['admin', 'tecnico'],            /* almacén pide → técnico prepara */
  qcHold:              TIPOS_POR_ROL.qc_hold,
  conteoVarianza:      TIPOS_POR_ROL.conteo_pendiente_aprobacion,
  conteoAprobado:      ['admin', 'inventario'],         /* Burgos ve su conteo procesado */
  /* pinCambiado: sin lista — es personal, el backend ya targetea al afectado */
};

/**
 * ¿El rol puede recibir push de este tipo? Acepta tipo camelCase (frontend)
 * o snake_case (backend).
 *  - admin pasa siempre (igual que el backend).
 *  - tipo sin lista → no restringido.
 *  - rol desconocido (null) → fail-open: el server ya filtra la fuente del
 *    polling por rol y _broadcast filtra los canales WS sensibles; bloquear
 *    aquí dejaría sin push a sesiones donde el rol aún no resolvió.
 */
export function rolPuedeRecibir(tipo, rol) {
  if (!tipo) return true;
  if (rol === 'admin') return true;
  const lista = PUSH_TIPO_ROLES[tipo] || TIPOS_POR_ROL[tipo];
  if (!lista) return true;
  if (!rol) return true;
  return lista.includes(rol);
}

/* Espejo de los RoleRoute de App.jsx — mantener sincronizado. Solo las rutas
   a las que navegan los pushes. Ruta sin entrada = abierta a todos los
   autenticados ('/', '/notificaciones'). */
const RUTA_ROLES = {
  '/inventario':      ['admin', 'tecnico', 'compras', 'almacen', 'inventario'],
  '/ordenes':         ['admin', 'tecnico'],
  '/pedidos':         ['admin', 'almacen', 'tecnico'],
  '/produccion':      ['admin', 'tecnico'],
  '/stock-fabrica':   ['admin', 'tecnico', 'almacen'],
  '/recoleccion':     ['admin', 'recolector', 'almacen'],
  '/compras':         ['admin', 'compras'],
  '/trazabilidad':    ['admin', 'tecnico', 'almacen', 'compras', 'recolector', 'inventario'],
  '/conteo':          ['admin', 'inventario'],
  '/almacen':         ['admin', 'almacen'],
  '/devoluciones':    ['admin', 'compras', 'almacen', 'tecnico'],
  '/devoluciones-mp': ['admin', 'compras'],
};

/**
 * Backlog conocido (jun 2026): pushes (qcHold/stockCritico/…) navegaban a
 * pantallas que el rol no puede abrir → RoleRoute rebotaba a '/'. Degradamos
 * AQUÍ a '/' para evitar el rebote. Con rol desconocido se respeta la ruta
 * (RoleRoute sigue siendo la red de seguridad).
 */
export function rutaParaRol(ruta, rol) {
  if (!ruta) return '/';
  if (!rol || rol === 'admin') return ruta;
  const base = String(ruta).split('?')[0];
  const lista = RUTA_ROLES[base];
  if (lista && !lista.includes(rol)) return '/';
  return ruta;
}

/* ═══════════════════════════════════════════════════════════════════════
   ROL DEL USUARIO ACTUAL (para el gate y las rutas por rol).

   FIX jun 2026 — BUG LATENTE corregido de raíz: 'pp_user' se LEÍA aquí desde
   Sprint L (L6/L7) pero NADIE lo escribía (la sesión vive solo en memoria de
   AuthContext) → _getCurrentRol siempre devolvía null y las rutas por rol de
   L7 jamás aplicaron. No podemos usar useAuth en la capa de dispatch:
   AuthContext importa useRealtimeSync (ciclo de imports) y este módulo no es
   React. Ahora:
     1) setCurrentRol(rol) lo persiste en sessionStorage — lo llama
        PushSettings en cuanto monta con sesión (write-through desde useAuth).
     2) Si falta, se auto-resuelve UNA vez en background vía GET /api/session
        (mismo endpoint que valida AuthContext al boot).
   Se guarda con una marca del token para invalidarlo si cambia el usuario en
   la misma pestaña (re-login) — sin esto el gate usaría el rol del usuario
   anterior. */
function _tokenMarca() {
  try { return (sessionStorage.getItem('pp_token') || '').slice(0, 12); }
  catch { return ''; }
}

export function setCurrentRol(rol) {
  if (!rol) return;
  try {
    sessionStorage.setItem('pp_user', JSON.stringify({ rol: String(rol), _tok: _tokenMarca() }));
  } catch { /* storage lleno/privado — el resolver async seguirá intentando */ }
}

let _rolResolviendo = false;
function _resolverRolAsync() {
  if (_rolResolviendo) return;
  if (typeof fetch !== 'function') return;
  let token = '';
  try { token = sessionStorage.getItem('pp_token') || ''; } catch {}
  if (!token) return; /* sin sesión no hay rol que resolver */
  _rolResolviendo = true;
  try {
    const p = fetch('/api/session', { headers: { 'x-session-token': token } });
    if (!p || typeof p.then !== 'function') { _rolResolviendo = false; return; }
    p.then(r => (r && r.ok ? r.json() : null))
      .then(d => { if (d && d.user && d.user.rol) setCurrentRol(d.user.rol); })
      .catch(() => {})
      .finally(() => { _rolResolviendo = false; });
  } catch { _rolResolviendo = false; }
}

function _getCurrentRol() {
  try {
    const userStr = sessionStorage.getItem('pp_user');
    if (userStr) {
      const u = JSON.parse(userStr);
      /* Si el token cambió (re-login en la misma pestaña) el rol guardado es
         de OTRO usuario → descartarlo y re-resolver. Entradas sin _tok
         (escritor legacy) se aceptan. */
      if (u && u.rol && (!u._tok || u._tok === _tokenMarca())) return String(u.rol);
    }
  } catch { /* JSON corrupto → re-resolver abajo */ }
  _resolverRolAsync();
  return null;
}

/* Versión pública para callers (useRealtimeSync) que pasan el rol a
   dispatchPushFromEvent sin depender de AuthContext (ciclo de imports). */
export function getCurrentRol() { return _getCurrentRol(); }

/**
 * Mostrar notificación push.
 * Respeta settings: enabled, soloEnSegundoPlano, filtro por tipo de evento
 * y GATE POR ROL (pipeline del usuario).
 *
 * @param {Object} opts
 * @param {string} opts.tipo  — clave del setting (stockCritico, ocVencida, etc.)
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} [opts.tag] — agrupa notifs del mismo tema
 * @param {Function} [opts.onClick] — callback al hacer click
 * @param {string} [opts.rol] — rol del usuario; si se omite se resuelve de sesión
 * @param {boolean} [opts.skipRolGate] — SOLO para fuentes ya filtradas por rol
 *   en el server (polling de /api/notificaciones)
 */
export function showPush({ tipo, title, body, tag, onClick, rol, skipRolGate }) {
  if (!('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;
  /* Si el Web Push real está activo en este dispositivo, el servidor manda las
     notificaciones (funcionan con la app cerrada). Suprimimos el push de primer
     plano para no mostrar la misma notificación dos veces. */
  try { if (sessionStorage.getItem('pp_webpush_active') === '1') return null; } catch {}

  const settings = getPushSettings();
  if (!settings.enabled) return null;
  if (tipo && settings[tipo] === false) return null;

  /* GATE POR PIPELINE (decisión owner jun 2026): aunque el toggle esté
     activo, si el tipo tiene lista de roles y el rol del usuario no está,
     NO se muestra el push. */
  if (!skipRolGate) {
    const rolEfectivo = (rol !== undefined && rol !== null) ? rol : _getCurrentRol();
    if (!rolPuedeRecibir(tipo, rolEfectivo)) return null;
  }

  if (settings.soloEnSegundoPlano && document.visibilityState === 'visible') return null;

  try {
    const notif = new Notification(title, {
      body,
      tag: tag || tipo || 'pp-erp',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      silent: false,
      requireInteraction: false,
    });
    notif.onclick = (e) => {
      e.preventDefault();
      try { window.focus(); } catch {}
      try { notif.close(); } catch {}
      if (typeof onClick === 'function') onClick();
    };
    /* Auto-cerrar tras 8s */
    setTimeout(() => { try { notif.close(); } catch {} }, 8000);
    return notif;
  } catch {
    return null;
  }
}

/* Set de claves de alerta ya notificadas (para evitar repetir) */
const SEEN_KEY = 'pp_push_seen';
function getSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveSeen(set) {
  /* Limitar a 200 alertas más recientes para no crecer indefinido */
  const arr = Array.from(set).slice(-200);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch (e) {
    /* M11 FIX: localStorage puede fallar — no debe romper notifs */
    console.warn('[pushNotifications] No se pudo guardar seen:', e?.message);
  }
}

/**
 * Después de recibir un evento de inventario/oc, consulta /api/notificaciones
 * para detectar alertas críticas nuevas y empujarlas como push.
 * Usa "seen" en localStorage para no repetir la misma alerta.
 *
 * NOTA gate por rol: GET /api/notificaciones YA llega filtrado por rol desde
 * el server (TIPO_ROLES_PERMITIDOS en server.js) — todo lo que entra aquí es
 * del pipeline del usuario. Por eso los showPush van con skipRolGate:true:
 * re-gatear por el tipo camelCase bloquearía MAL la rama genérica (reusa el
 * tipo 'stockCritico' para cualquier alerta de severidad alta, p. ej. una
 * alerta_mp que el server SÍ autorizó para técnico).
 */
export async function checkAlertasYNotificar(navigate, rol) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const settings = getPushSettings();
  if (!settings.enabled) return;
  /* Rol para degradar rutas prohibidas a '/' (no para gatear: ver NOTA) */
  const rolUsuario = (rol !== undefined && rol !== null) ? rol : _getCurrentRol();

  try {
    const r = await fetch('/api/notificaciones', {
      headers: { 'x-session-token': sessionStorage.getItem('pp_token') || '' },
    });
    if (!r.ok) return;
    const data = await r.json();
    const alertas = data.notificaciones || data.data || data || [];
    if (!Array.isArray(alertas)) return;

    const seen = getSeen();
    for (const a of alertas) {
      const id = a.id || (a.tipo + ':' + (a.item || a.codigo || a.mp || JSON.stringify(a).slice(0, 60)));
      if (seen.has(id)) continue;
      seen.add(id);

      let tipo = null, title = null, body = null, ruta = '/notificaciones';

      if (a.tipo === 'stock_critico' || a.severidad === 'critico') {
        tipo = 'stockCritico';
        title = 'Stock crítico';
        body = `${a.mp || a.item || 'MP'} sin existencia`;
        ruta = '/inventario';
      } else if (a.tipo === 'oc_vencida') {
        tipo = 'ocVencida';
        title = 'OC vencida';
        body = `OC ${a.codigo || a.id || ''} pasó la fecha de entrega`;
        ruta = '/compras';
      } else if (a.tipo === 'qc_hold' || a.tipo === 'qc_pendiente') {
        tipo = a.tipo === 'qc_hold' ? 'qcHold' : 'loteListo';
        title = a.tipo === 'qc_hold' ? 'Lote retenido en QC' : 'QC pendiente';
        body = a.mensaje || `${a.codigoLote || 'Lote'} requiere revisión`;
        ruta = '/produccion?tab=calidad';
      } else if (a.tipo === 'mp_sin_costo') {
        /* Menos crítica: solo notificar si la severidad lo amerita */
        continue;
      } else if (a.severidad === 'alta' || a.severidad === 'critico') {
        tipo = 'stockCritico';
        title = a.titulo || 'Alerta crítica';
        body = a.mensaje || a.descripcion || 'Revisa notificaciones';
        ruta = '/notificaciones';
      } else {
        continue;
      }

      showPush({
        tipo, title, body, tag: id,
        skipRolGate: true, /* el server ya filtró por rol (ver NOTA arriba) */
        onClick: () => navigate && navigate(rutaParaRol(ruta, rolUsuario)),
      });
    }
    saveSeen(seen);
  } catch { /* sin red, sin push */ }
}

/**
 * Despacha una notificación a partir de un payload de WebSocket.
 * El backend manda eventos como inventario/oc/devolucion/trazabilidad/cycle-count.
 * Aquí decidimos cuáles son "críticos" y los empujamos al usuario.
 *
 * FIX jun 2026 (L6): normalizar evento a camelCase ANTES del switch.
 * Antes 'cycle-count' (kebab del backend) jamás matcheaba 'cycleCount' (case
 * camelCase). Push completamente muerto para Burgos y admin. Ahora se
 * normaliza igual que en useRealtimeSync.
 *
 * GATE POR ROL (jun 2026): cada evento WS se mapea a un tipo de push
 * (PUSH_TIPO_ROLES) y showPush lo gatea con `rol`. El rol llega como 4º
 * parámetro desde el caller (useRealtimeSync → getCurrentRol()); si falta,
 * se resuelve aquí de la sesión.
 */
export function dispatchPushFromEvent(evento, payload, navigate, rolUsuario) {
  if (!evento) return;

  /* L6: normalizar kebab → camelCase. Eventos namespaced ('lote.X', 'sublote.X')
     mantienen el prefijo para granularidad. */
  let canal = evento;
  if (!canal.includes('.')) {
    canal = canal.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }
  const rol = (rolUsuario !== undefined && rolUsuario !== null) ? rolUsuario : _getCurrentRol();

  switch (canal) {
    case 'inventario': {
      checkAlertasYNotificar(navigate, rol);
      if (payload && payload.stockCritico) {
        showPush({
          tipo: 'stockCritico',
          rol,
          title: 'Stock crítico',
          body: `${payload.mp || 'Una MP'} se quedó sin existencia`,
          tag: 'stock-critico-' + (payload.mp || 'gen'),
          onClick: () => navigate && navigate(rutaParaRol('/inventario', rol)),
        });
      }
      break;
    }
    case 'oc': {
      checkAlertasYNotificar(navigate, rol);
      /* FIX L8: antes solo notificaba si payload.vencida. Cualquier OC
         editada/creada/recibida debe mostrar push a Arely. */
      const ev = payload && payload.evento;
      if (ev === 'solicitud_nueva' || ev === 'creada') {
        showPush({
          tipo: 'ocNueva',
          rol,
          title: 'Nueva solicitud de OC',
          body: `${payload.solicitante || 'Técnico'} solicitó ${payload.mp || 'materias primas'}`,
          tag: 'oc-nueva-' + (payload.ocId || payload.id || Date.now()),
          onClick: () => navigate && navigate(rutaParaRol('/compras', rol)),
        });
      } else if (ev === 'editada' || ev === 'aprobada') {
        showPush({
          tipo: 'ocEditada',
          rol,
          title: 'OC actualizada',
          body: `${payload.codigo || 'OC'} · ${payload.editadoPor || payload.aprobadoPor || 'compras'}`,
          tag: 'oc-edit-' + (payload.ocId || Date.now()),
          /* L7: técnico va a /ordenes (suya), compras/admin a /compras */
          onClick: () => navigate && navigate(rutaParaRol(rol === 'tecnico' ? '/ordenes' : '/compras', rol)),
        });
      } else if (ev === 'recibida') {
        showPush({
          tipo: 'ocRecibida',
          rol,
          title: 'OC recibida',
          body: `${payload.codigo || 'OC'} · MP ya en inventario`,
          tag: 'oc-rec-' + (payload.ocId || Date.now()),
          onClick: () => navigate && navigate(rutaParaRol(rol === 'tecnico' ? '/inventario' : '/compras', rol)),
        });
      } else if (payload && payload.vencida) {
        showPush({
          tipo: 'ocVencida',
          rol,
          title: 'OC vencida',
          body: `OC ${payload.codigo || ''} pasó fecha de entrega`,
          tag: 'oc-vencida-' + (payload.id || 'gen'),
          onClick: () => navigate && navigate(rutaParaRol('/compras', rol)),
        });
      }
      break;
    }
    case 'devolucion': {
      /* FIX L10: push diferenciado por evento — reembolso pendiente es la
         señal accionable para Arely; nueva devolución es para Enrique. */
      const ev = payload && payload.evento;
      /* L7 + gate: /devoluciones está permitida a admin/compras/almacen/tecnico;
         rutaParaRol degrada a '/' cualquier otro rol. */
      const ruta = rutaParaRol('/devoluciones', rol);
      if (payload && payload.requiereReembolso) {
        showPush({
          tipo: 'devolucionReembolso',
          rol,
          title: 'Reembolso pendiente',
          body: `Cliente ${payload.cliente || ''}: emitir NC por $${payload.montoDevuelto || 0}`,
          tag: 'dev-reemb-' + (payload.id || Date.now()),
          onClick: () => navigate && navigate(ruta),
        });
      } else if (ev === 'reembolso_emitido') {
        showPush({
          tipo: 'devolucionCerrada',
          rol,
          title: 'Reembolso emitido',
          body: `${payload.reembolsoFolio || 'NC'} · $${payload.reembolsoMonto || 0}`,
          tag: 'dev-cerrada-' + (payload.id || Date.now()),
          onClick: () => navigate && navigate(ruta),
        });
      } else {
        showPush({
          tipo: 'devolucion',
          rol,
          title: 'Devolución registrada',
          body: `${payload?.cliente || 'Cliente'}: ${payload?.producto || ''} (${payload?.cantidad || 0})`,
          tag: 'devolucion-' + (payload?.id || Date.now()),
          onClick: () => navigate && navigate(ruta),
        });
      }
      break;
    }
    case 'trazabilidad': {
      if (payload?.estado === 'en_camino') {
        showPush({
          tipo: 'loteEnCamino',
          rol,
          title: 'Lote en camino',
          body: `${payload?.codigoLote || 'Lote'} → ${payload?.destino || 'Almacén'}`,
          tag: 'lote-' + (payload?.codigoLote || 'gen'),
          /* L7: Josué (almacen) usa /almacen (Recepción Terán), los demás /trazabilidad.
             FIX jun 2026: la ruta es /almacen — /almacen-recepcion no existe. */
          onClick: () => navigate && navigate(rutaParaRol(rol === 'almacen' ? '/almacen' : '/trazabilidad', rol)),
        });
      }
      if (payload?.estado === 'qc_hold') {
        showPush({
          tipo: 'qcHold',
          rol,
          title: 'Lote retenido en QC',
          body: `${payload?.codigoLote || 'Lote'} requiere revisión`,
          tag: 'qc-hold-' + (payload?.codigoLote || 'gen'),
          /* Backlog: /produccion es solo admin/tecnico — otros roles degradan a '/' */
          onClick: () => navigate && navigate(rutaParaRol('/produccion?tab=calidad', rol)),
        });
      }
      if (payload?.estado === 'producido' || payload?.estado === 'envasado') {
        showPush({
          tipo: 'loteListo',
          rol,
          title: 'Lote listo en fábrica',
          body: `${payload?.codigoLote || 'Lote'} de ${payload?.producto || 'producto'} terminado · listo para almacén`,
          tag: 'lote-listo-' + (payload?.codigoLote || Date.now()),
          /* L7: Luis (recolector) va a /recoleccion, Josué a /almacen (Recepción).
             FIX jun 2026: la ruta es /almacen — /almacen-recepcion no existe. */
          onClick: () => navigate && navigate(rutaParaRol(
            rol === 'recolector' ? '/recoleccion' :
            (rol === 'almacen' ? '/almacen' : '/stock-fabrica'), rol
          )),
        });
      }
      /* FIX L9: case para sublote.escanearRecibirTeran — Enrique se entera
         cuando Josué recibe físicamente en Terán (cierre del ciclo). */
      if (payload?.evento === 'sublote.escanearRecibirTeran' || canal === 'sublote.escanearRecibirTeran') {
        showPush({
          tipo: 'subloteRecibido',
          rol,
          title: 'Sublote recibido en Terán',
          body: `${payload?.subloteCod || 'Sublote'} entregado · ciclo cerrado`,
          tag: 'sub-rec-' + (payload?.subloteCod || Date.now()),
          onClick: () => navigate && navigate(rutaParaRol(rol === 'tecnico' ? '/produccion' : '/trazabilidad', rol)),
        });
      }
      break;
    }
    case 'pedidos': {
      if (payload?.evento === 'nuevo' || payload?.estado === 'pendiente') {
        const p = payload?.pedido || payload || {};
        showPush({
          tipo: 'pedidoNuevo',
          rol,
          title: 'Nuevo pedido recibido',
          body: `${p.solicitante || 'Almacén'} pidió ${p.cantidad || ''} ${p.producto || 'producto'}`,
          tag: 'pedido-' + (p.id || Date.now()),
          onClick: () => navigate && navigate(rutaParaRol('/pedidos', rol)),
        });
      }
      break;
    }
    case 'cycleCount': {
      /* FIX L6: ahora SÍ matchea — antes el backend emitía 'cycle-count' y
         este case 'cycleCount' nunca disparaba. Burgos no recibía push de
         aprobación, admin no recibía de varianza alta. */
      const ev = payload && payload.evento;
      if (payload && payload.varianzaAlta) {
        showPush({
          tipo: 'conteoVarianza',
          rol,
          title: 'Conteo con varianza alta',
          body: `${payload.item || 'Item'}: ${payload.varianzaPct || 0}% de diferencia`,
          tag: 'conteo-' + (payload.sesionId || 'gen'),
          onClick: () => navigate && navigate(rutaParaRol('/conteo', rol)),
        });
      } else if (ev === 'aprobado' || ev === 'finalizado') {
        showPush({
          tipo: 'conteoAprobado',
          rol,
          title: ev === 'aprobado' ? 'Conteo aprobado' : 'Conteo finalizado',
          body: payload.sesionId ? `Sesión ${payload.sesionId}` : 'Tu sesión fue procesada',
          tag: 'conteo-' + (payload.sesionId || Date.now()),
          onClick: () => navigate && navigate(rutaParaRol('/conteo', rol)),
        });
      }
      break;
    }
    /* FIX L11: usuario afectado por cambio de PIN ve el push */
    case 'usuarios': {
      if (payload && payload.evento === 'pin_cambiado') {
        showPush({
          tipo: 'pinCambiado',
          rol,
          title: 'PIN cambiado',
          body: payload.sesionesCerradas > 0
            ? `Tu PIN se actualizó · ${payload.sesionesCerradas} otra(s) sesión(es) cerradas`
            : 'Tu PIN se actualizó correctamente',
          tag: 'pin-' + Date.now(),
          onClick: () => navigate && navigate('/'),
        });
      }
      break;
    }
    default:
      /* Sin notificación para otros eventos */
      break;
  }
}
