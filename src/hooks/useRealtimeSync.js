import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dispatchPushFromEvent, getCurrentRol } from '../utils/pushNotifications';

/**
 * Hook de sincronización en tiempo real con WebSocket del backend.
 *
 * Uso:
 *   useRealtimeSync({
 *     onTrazabilidad: () => reloadLotes(),
 *     onInventario: () => reloadInv(),
 *     onPermisos: () => recargarPermisos(),
 *   });
 *
 * Eventos disponibles (canal backend → handler):
 *   trazabilidad, inventario, ordenes, pedidos, oc, precios, permisos,
 *   usuarios, envasado, costos, sat, lab, formulas, devolucion, cycle-count,
 *   transferencias, inventario-canonico, ...
 * El mapeo es GENÉRICO: cualquier evento se despacha a on<CamelCase>. Los
 * nombres kebab se camelizan: 'cycle-count' → onCycleCount,
 * 'inventario-canonico' → onInventarioCanonico.
 *
 * ── UNA SOLA CONEXIÓN POR PESTAÑA (auditoría 26-jul-2026) ──────────────────
 * Antes cada invocación del hook abría su PROPIO WebSocket. Con AuthContext,
 * AppLayout, TopBar, los contextos de notificaciones y la página activa, una
 * pestaña normal mantenía 8 sockets a la vez: 8 autenticaciones, 8 copias de
 * cada evento y 8 pings cada 30 s. Con 6 usuarios y varias pestañas el
 * servidor sostenía decenas de conexiones para un puñado de personas.
 *
 * Peor que el desperdicio: `dispatchPushFromEvent` corría una vez POR SOCKET,
 * así que un solo evento disparaba hasta 8 notificaciones push idénticas.
 *
 * Ahora la conexión vive a nivel de módulo y los hooks se SUSCRIBEN. La firma
 * y el valor de retorno no cambian — los 37 lugares que lo usan siguen igual.
 */

/* ── Conexión compartida (una por pestaña) ─────────────────────────────── */
const suscriptores = new Set();   /* { handlersRef, setConnected } */
let socket = null;
let socketToken = null;           /* token con el que se abrió (para detectar cambio de sesión) */
let conectado = false;
let intentos = 0;
let timerReconexion = null;
let timerCierre = null;
let pingTimer = null;
let pongTimeout = null;
let navigateActual = null;        /* el último navigate disponible, para el push */
let tokenRechazado = null;        /* token que el servidor rechazó: no reintentar con él */
let abiertoDesde = 0;             /* para no reiniciar el backoff con conexiones que mueren al instante */

const tokenActual = () => sessionStorage.getItem('pp_token') || '';

function marcarConectado(v) {
  conectado = v;
  suscriptores.forEach(s => { try { s.setConnected(v); } catch { /* desmontado */ } });
}

function limpiarTimersPing() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
}

function cerrarSocket() {
  limpiarTimersPing();
  if (timerReconexion) { clearTimeout(timerReconexion); timerReconexion = null; }
  if (socket) {
    const s = socket;
    socket = null;          /* antes de close(), para que onclose no reconecte */
    socketToken = null;
    try { s.close(); } catch { /* ya cerrado */ }
  }
  marcarConectado(false);
}

function despachar(msg) {
  const evento = msg.evento;
  if (!evento) return;

  /* kebab-case → camelCase: 'cycle-count' → onCycleCount */
  const camel = evento.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const nombre = 'on' + camel.charAt(0).toUpperCase() + camel.slice(1);

  /* Cada suscriptor en su propio try/catch: si uno falla (componente a medio
     desmontar, bug en un handler), los demás siguen recibiendo eventos. */
  suscriptores.forEach(sub => {
    const handlers = (sub.handlersRef && sub.handlersRef.current) || {};
    try {
      if (typeof handlers[nombre] === 'function') handlers[nombre](msg.payload, msg);
    } catch (e) {
      console.warn('[WS] handler ' + nombre + ' falló:', e?.message);
    }
    try {
      if (typeof handlers.onAny === 'function') handlers.onAny(msg);
    } catch (e) {
      console.warn('[WS] onAny falló:', e?.message);
    }
  });

  /* Push del navegador: UNA vez por evento, no una por suscriptor. Este es el
     motivo por el que antes llegaban notificaciones duplicadas.
     El rol NO se puede tomar de useAuth (AuthContext importa este módulo →
     ciclo de imports); viene de la capa de push vía sessionStorage. */
  try {
    dispatchPushFromEvent(evento, msg.payload, navigateActual, getCurrentRol());
  } catch { /* una notificación fallida no debe romper el sync */ }
}

function programarReconexion() {
  if (timerReconexion || suscriptores.size === 0) return;
  /* Sin sesión válida no tiene sentido reintentar: el servidor va a cerrar la
     conexión igual. Se espera a que aparezca un token distinto (login). */
  if (tokenRechazado !== null && tokenRechazado === tokenActual()) return;
  const delay = Math.min(30000, 1000 * Math.pow(1.5, intentos));
  intentos += 1;
  timerReconexion = setTimeout(() => {
    timerReconexion = null;
    abrirSocket();
  }, delay);
}

function abrirSocket() {
  if (socket || suscriptores.size === 0) return;

  const token = tokenActual();
  /* Ya sabemos que este token (o su ausencia) no sirve: no gastar conexiones. */
  if (tokenRechazado !== null && tokenRechazado === token) return;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  /* H15: el token va en la query para autenticar el WS. Sin él, el servidor
     cierra la conexión a los 5 segundos. */
  const url = `${proto}://${window.location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  let ws;
  try {
    ws = new WebSocket(url);
  } catch {
    programarReconexion();
    return;
  }
  socket = ws;
  socketToken = token;

  ws.onopen = () => {
    if (socket !== ws) { try { ws.close(); } catch { /* reemplazado */ } return; }
    /* OJO: NO reiniciar el backoff aquí. El servidor acepta la conexión y
       recién a los 5 s la cierra con 4401 si no llegó token. Reiniciar en
       `onopen` hacía que el backoff nunca creciera: la página de login quedaba
       reconectando cada ~6 s para siempre. Medido en producción el 26-jul-2026:
       168 conexiones sin autenticar en 3 minutos. El backoff se reinicia abajo,
       solo si la conexión sobrevivió lo suficiente para ser real. */
    abiertoDesde = Date.now();
    marcarConectado(true);
    limpiarTimersPing();
    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ tipo: 'ping' })); } catch { /* se cerró */ }
        pongTimeout = setTimeout(() => { try { ws.close(); } catch { /* ya */ } }, 5000);
      }
    }, 30000);
  };

  ws.onmessage = (evt) => {
    if (socket !== ws) return;
    try {
      const msg = JSON.parse(evt.data);
      if (msg.tipo === 'pong') {
        if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
        return;
      }
      /* El servidor avisa explícitamente cuando la sesión no sirve. Anotarlo
         evita el bucle de reconexión: reintentar sin token da exactamente el
         mismo resultado. Se vuelve a intentar cuando cambie el token. */
      if (msg.evento === 'auth_required' || msg.evento === 'auth_failed') {
        tokenRechazado = socketToken;
        return;
      }
      /* Mensaje real del servidor ⇒ la conexión sirve: token aceptado. */
      if (tokenRechazado !== null) tokenRechazado = null;
      despachar(msg);
    } catch { /* mensaje malformado: ignorar */ }
  };

  ws.onclose = (evt) => {
    if (socket !== ws) return;   /* cierre de un socket ya reemplazado */
    limpiarTimersPing();
    /* El backoff se reinicia SOLO si la conexión duró lo bastante para ser una
       sesión de verdad. Una que muere a los 5 s es un rechazo disfrazado. */
    if (abiertoDesde && Date.now() - abiertoDesde > 10000) intentos = 0;
    abiertoDesde = 0;
    /* 4401 = el servidor rechazó la sesión. Reintentar con el mismo token es
       inútil; se espera al login. */
    if (evt && evt.code === 4401) tokenRechazado = socketToken;
    socket = null;
    socketToken = null;
    marcarConectado(false);
    programarReconexion();
  };

  ws.onerror = () => { try { ws.close(); } catch { /* ya cerrado */ } };
}

/* Si el token cambió (login, cambio de usuario), la conexión abierta está
   autenticada como quien ya no es: hay que rehacerla. */
function reconectarSiCambioSesion() {
  if (socket && socketToken !== tokenActual()) {
    cerrarSocket();
    intentos = 0;
    tokenRechazado = null;
    abrirSocket();
  }
}

/* Vigilante de sesión. Hace falta porque el efecto del hook solo corre al
   montar: cuando alguien inicia sesión, los componentes ya están montados y no
   hay nada que dispare la conexión — sobre todo si se dejó de reintentar por
   token rechazado (la pantalla de login es justo ese caso). Cada 3 s comprueba
   si el token cambió; no abre nada por su cuenta si no hay suscriptores. */
let vigilanteSesion = null;
function iniciarVigilanteSesion() {
  if (vigilanteSesion) return;
  vigilanteSesion = setInterval(() => {
    if (suscriptores.size === 0) return;
    const t = tokenActual();
    if (socket) { reconectarSiCambioSesion(); return; }
    /* Sin socket: reintentar solo si el token ya no es el que fue rechazado. */
    if (tokenRechazado === null || tokenRechazado !== t) {
      tokenRechazado = null;
      intentos = 0;
      abrirSocket();
    }
  }, 3000);
}

export function useRealtimeSync(handlers = {}) {
  const handlersRef = useRef(handlers);
  const [connected, setConnected] = useState(conectado);

  /* Llamada INCONDICIONAL a propósito. Antes iba en un try/catch "por si el
     hook se usa fuera del Router", pero eso viola las reglas de los hooks: el
     orden de llamada debe ser idéntico en cada render, y de ese orden depende
     todo el estado del componente. Además el miedo era infundado — en App.jsx
     el AuthProvider está DENTRO del BrowserRouter, así que todo lo que usa este
     hook vive bajo el Router.

     Al quitar el try/catch tronaron 3 archivos de test que montaban AuthProvider
     y páginas SIN Router — configuración que no existe en la app. Se envolvieron
     en MemoryRouter: el try/catch les permitía probar un escenario irreal. */
  const navigate = useNavigate();

  /* Mantener handlers actualizados sin re-suscribir. */
  useEffect(() => { handlersRef.current = handlers; });
  useEffect(() => { if (navigate) navigateActual = navigate; }, [navigate]);

  useEffect(() => {
    const sub = { handlersRef, setConnected };
    suscriptores.add(sub);

    /* Al entrar un suscriptor se cancela un cierre pendiente: cambiar de
       pantalla desmonta una página y monta otra, y sin esta gracia la conexión
       se cerraría y reabriría en cada navegación. */
    if (timerCierre) { clearTimeout(timerCierre); timerCierre = null; }

    if (!socket) abrirSocket();
    else reconectarSiCambioSesion();
    iniciarVigilanteSesion();

    setConnected(conectado);

    return () => {
      suscriptores.delete(sub);
      /* Último suscriptor fuera: cerrar, pero con margen para no cortar la
         conexión en una transición de ruta normal. */
      if (suscriptores.size === 0 && !timerCierre) {
        timerCierre = setTimeout(() => {
          timerCierre = null;
          if (suscriptores.size === 0) cerrarSocket();
        }, 3000);
      }
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  return { connected };
}

/* Solo para pruebas/diagnóstico: cuántos sockets hay realmente abiertos. */
export function _debugRealtime() {
  return { suscriptores: suscriptores.size, socketAbierto: !!socket, conectado, tokenRechazado };
}

/* Solo para pruebas: el estado vive a nivel de módulo (esa es justamente la
   razón de que haya una sola conexión), así que sin esto un test arrastra el
   `tokenRechazado` del anterior y el siguiente no abre nada. */
export function _resetRealtime() {
  suscriptores.clear();
  cerrarSocket();
  if (timerCierre) { clearTimeout(timerCierre); timerCierre = null; }
  if (vigilanteSesion) { clearInterval(vigilanteSesion); vigilanteSesion = null; }
  tokenRechazado = null;
  abiertoDesde = 0;
  intentos = 0;
}
