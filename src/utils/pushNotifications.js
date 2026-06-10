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
  devolucion: true,              // Devolución registrada
  loteEnCamino: true,            // Lote escaneado por Luis
  qcHold: true,                  // Lote retenido en QC
  conteoVarianza: true,          // Cycle count con varianza > 5%
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

/**
 * Mostrar notificación push.
 * Respeta settings: enabled, soloEnSegundoPlano, y filtro por tipo de evento.
 *
 * @param {Object} opts
 * @param {string} opts.tipo  — clave del setting (stockCritico, ocVencida, etc.)
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} [opts.tag] — agrupa notifs del mismo tema
 * @param {Function} [opts.onClick] — callback al hacer click
 */
export function showPush({ tipo, title, body, tag, onClick }) {
  if (!('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;

  const settings = getPushSettings();
  if (!settings.enabled) return null;
  if (tipo && settings[tipo] === false) return null;
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
 */
export async function checkAlertasYNotificar(navigate) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const settings = getPushSettings();
  if (!settings.enabled) return;

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
        onClick: () => navigate && navigate(ruta),
      });
    }
    saveSeen(seen);
  } catch { /* sin red, sin push */ }
}

/* FIX jun 2026 (Sprint L - L6/L7): obtener rol del usuario actual desde
   sessionStorage. Antes el switch asumía rol admin y mandaba todos los
   onClick a /admin o /compras — roles sin permiso obtenían 403 al hacer
   click. Ahora cada push resuelve su ruta según el rol activo. */
function _getCurrentRol() {
  try {
    const userStr = sessionStorage.getItem('pp_user');
    if (!userStr) return null;
    const u = JSON.parse(userStr);
    return u && u.rol ? String(u.rol) : null;
  } catch { return null; }
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
 */
export function dispatchPushFromEvent(evento, payload, navigate) {
  if (!evento) return;

  /* L6: normalizar kebab → camelCase. Eventos namespaced ('lote.X', 'sublote.X')
     mantienen el prefijo para granularidad. */
  let canal = evento;
  if (!canal.includes('.')) {
    canal = canal.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }
  const rol = _getCurrentRol();

  switch (canal) {
    case 'inventario': {
      checkAlertasYNotificar(navigate);
      if (payload && payload.stockCritico) {
        showPush({
          tipo: 'stockCritico',
          title: 'Stock crítico',
          body: `${payload.mp || 'Una MP'} se quedó sin existencia`,
          tag: 'stock-critico-' + (payload.mp || 'gen'),
          onClick: () => navigate && navigate('/inventario'),
        });
      }
      break;
    }
    case 'oc': {
      checkAlertasYNotificar(navigate);
      /* FIX L8: antes solo notificaba si payload.vencida. Cualquier OC
         editada/creada/recibida debe mostrar push a Arely. */
      const ev = payload && payload.evento;
      if (ev === 'solicitud_nueva' || ev === 'creada') {
        showPush({
          tipo: 'ocNueva',
          title: 'Nueva solicitud de OC',
          body: `${payload.solicitante || 'Técnico'} solicitó ${payload.mp || 'materias primas'}`,
          tag: 'oc-nueva-' + (payload.ocId || payload.id || Date.now()),
          onClick: () => navigate && navigate('/compras'),
        });
      } else if (ev === 'editada' || ev === 'aprobada') {
        showPush({
          tipo: 'ocEditada',
          title: 'OC actualizada',
          body: `${payload.codigo || 'OC'} · ${payload.editadoPor || payload.aprobadoPor || 'compras'}`,
          tag: 'oc-edit-' + (payload.ocId || Date.now()),
          /* L7: técnico va a /ordenes (suya), compras/admin a /compras */
          onClick: () => navigate && navigate(rol === 'tecnico' ? '/ordenes' : '/compras'),
        });
      } else if (ev === 'recibida') {
        showPush({
          tipo: 'ocRecibida',
          title: 'OC recibida',
          body: `${payload.codigo || 'OC'} · MP ya en inventario`,
          tag: 'oc-rec-' + (payload.ocId || Date.now()),
          onClick: () => navigate && navigate(rol === 'tecnico' ? '/inventario' : '/compras'),
        });
      } else if (payload && payload.vencida) {
        showPush({
          tipo: 'ocVencida',
          title: 'OC vencida',
          body: `OC ${payload.codigo || ''} pasó fecha de entrega`,
          tag: 'oc-vencida-' + (payload.id || 'gen'),
          onClick: () => navigate && navigate('/compras'),
        });
      }
      break;
    }
    case 'devolucion': {
      /* FIX L10: push diferenciado por evento — reembolso pendiente es la
         señal accionable para Arely; nueva devolución es para Enrique. */
      const ev = payload && payload.evento;
      /* L7: ruta dinámica. /admin solo es para admin; los demás usan /devoluciones. */
      const ruta = rol === 'admin' ? '/devoluciones' : '/devoluciones';
      if (payload && payload.requiereReembolso) {
        showPush({
          tipo: 'devolucionReembolso',
          title: 'Reembolso pendiente',
          body: `Cliente ${payload.cliente || ''}: emitir NC por $${payload.montoDevuelto || 0}`,
          tag: 'dev-reemb-' + (payload.id || Date.now()),
          onClick: () => navigate && navigate(ruta),
        });
      } else if (ev === 'reembolso_emitido') {
        showPush({
          tipo: 'devolucionCerrada',
          title: 'Reembolso emitido',
          body: `${payload.reembolsoFolio || 'NC'} · $${payload.reembolsoMonto || 0}`,
          tag: 'dev-cerrada-' + (payload.id || Date.now()),
          onClick: () => navigate && navigate(ruta),
        });
      } else {
        showPush({
          tipo: 'devolucion',
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
          title: 'Lote en camino',
          body: `${payload?.codigoLote || 'Lote'} → ${payload?.destino || 'Almacén'}`,
          tag: 'lote-' + (payload?.codigoLote || 'gen'),
          /* L7: Josué (almacen) usa /almacen (Recepción Terán), los demás /trazabilidad.
             FIX jun 2026: la ruta es /almacen — /almacen-recepcion no existe. */
          onClick: () => navigate && navigate(rol === 'almacen' ? '/almacen' : '/trazabilidad'),
        });
      }
      if (payload?.estado === 'qc_hold') {
        showPush({
          tipo: 'qcHold',
          title: 'Lote retenido en QC',
          body: `${payload?.codigoLote || 'Lote'} requiere revisión`,
          tag: 'qc-hold-' + (payload?.codigoLote || 'gen'),
          onClick: () => navigate && navigate('/produccion?tab=calidad'),
        });
      }
      if (payload?.estado === 'producido' || payload?.estado === 'envasado') {
        showPush({
          tipo: 'loteListo',
          title: 'Lote listo en fábrica',
          body: `${payload?.codigoLote || 'Lote'} de ${payload?.producto || 'producto'} terminado · listo para almacén`,
          tag: 'lote-listo-' + (payload?.codigoLote || Date.now()),
          /* L7: Luis (recolector) va a /recoleccion, Josué a /almacen (Recepción).
             FIX jun 2026: la ruta es /almacen — /almacen-recepcion no existe. */
          onClick: () => navigate && navigate(
            rol === 'recolector' ? '/recoleccion' :
            (rol === 'almacen' ? '/almacen' : '/stock-fabrica')
          ),
        });
      }
      /* FIX L9: case para sublote.escanearRecibirTeran — Enrique se entera
         cuando Josué recibe físicamente en Terán (cierre del ciclo). */
      if (payload?.evento === 'sublote.escanearRecibirTeran' || canal === 'sublote.escanearRecibirTeran') {
        showPush({
          tipo: 'subloteRecibido',
          title: 'Sublote recibido en Terán',
          body: `${payload?.subloteCod || 'Sublote'} entregado · ciclo cerrado`,
          tag: 'sub-rec-' + (payload?.subloteCod || Date.now()),
          onClick: () => navigate && navigate(rol === 'tecnico' ? '/produccion' : '/trazabilidad'),
        });
      }
      break;
    }
    case 'pedidos': {
      if (payload?.evento === 'nuevo' || payload?.estado === 'pendiente') {
        const p = payload?.pedido || payload || {};
        showPush({
          tipo: 'pedidoNuevo',
          title: 'Nuevo pedido recibido',
          body: `${p.solicitante || 'Almacén'} pidió ${p.cantidad || ''} ${p.producto || 'producto'}`,
          tag: 'pedido-' + (p.id || Date.now()),
          onClick: () => navigate && navigate('/pedidos'),
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
          title: 'Conteo con varianza alta',
          body: `${payload.item || 'Item'}: ${payload.varianzaPct || 0}% de diferencia`,
          tag: 'conteo-' + (payload.sesionId || 'gen'),
          onClick: () => navigate && navigate('/conteo'),
        });
      } else if (ev === 'aprobado' || ev === 'finalizado') {
        showPush({
          tipo: 'conteoAprobado',
          title: ev === 'aprobado' ? 'Conteo aprobado' : 'Conteo finalizado',
          body: payload.sesionId ? `Sesión ${payload.sesionId}` : 'Tu sesión fue procesada',
          tag: 'conteo-' + (payload.sesionId || Date.now()),
          onClick: () => navigate && navigate('/conteo'),
        });
      }
      break;
    }
    /* FIX L11: usuario afectado por cambio de PIN ve el push */
    case 'usuarios': {
      if (payload && payload.evento === 'pin_cambiado') {
        showPush({
          tipo: 'pinCambiado',
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
