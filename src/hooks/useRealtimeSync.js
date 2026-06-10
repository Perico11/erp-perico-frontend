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
 * Eventos disponibles:
 *   trazabilidad, inventario, ordenes, pedidos, oc, precios, permisos, usuarios, envasado
 *
 * También maneja reconexión exponencial automática si la conexión se cae.
 */
export function useRealtimeSync(handlers = {}) {
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const handlersRef = useRef(handlers);
  const [connected, setConnected] = useState(false);
  /* useNavigate puede fallar si el hook se usa fuera del Router; lo capturamos defensivamente */
  let navigate = null;
  try { navigate = useNavigate(); } catch {}
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  /* Mantener handlers actualizados sin re-conectar */
  useEffect(() => { handlersRef.current = handlers; });

  useEffect(() => {
    let mounted = true;

    const buildUrl = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      /* H15: pasar token de sesión en query para autenticar el WS.
         Sin token, el servidor cierra la conexión a los 5 segundos. */
      const token = sessionStorage.getItem('pp_token') || '';
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
      return `${proto}://${host}/ws${tokenParam}`;
    };

    function connect() {
      if (!mounted) return;
      const url = buildUrl();
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      let pingTimer = null;
      let pongTimeout = null;

      ws.onopen = () => {
        if (!mounted) { ws.close(); return; }
        reconnectAttemptsRef.current = 0;
        setConnected(true);
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ tipo: 'ping' })); } catch {}
            pongTimeout = setTimeout(() => {
              try { ws.close(); } catch {}
            }, 5000);
          }
        }, 30000);
      };

      ws.onmessage = (evt) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.tipo === 'pong') { if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; } return; }
          const evento = msg.evento;
          if (!evento) return;
          /* H17 FIX: handlersRef puede no haberse actualizado todavía si este
             es el primer mensaje justo después del mount. Defendemos contra
             handlers stale y errores individuales:
             - Si el handler no existe o lanza error, NO rompe el sync.
             - Encapsulamos cada invocación en try/catch propio. */
          const handlers = handlersRef.current || {};
          /* Convierte kebab-case a camelCase: 'cycle-count' → 'CycleCount'.
             Los nombres de canal del backend pueden venir con guion
             (cycle-count, etc.) — el handler en frontend va en camelCase. */
          const camelCase = evento.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          const handlerName = 'on' + camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
          try {
            const handler = handlers[handlerName];
            if (typeof handler === 'function') {
              handler(msg.payload, msg);
            }
          } catch (e) {
            console.warn('[WS] handler ' + handlerName + ' falló:', e?.message);
          }
          /* También un handler genérico onAny */
          try {
            if (typeof handlers.onAny === 'function') {
              handlers.onAny(msg);
            }
          } catch (e) {
            console.warn('[WS] onAny falló:', e?.message);
          }
          /* Push notifications del navegador para eventos críticos.
             GATE POR ROL (decisión owner jun 2026): se pasa el rol del usuario
             para que el dispatch filtre por pipeline (PUSH_TIPO_ROLES). Aquí
             NO podemos usar useAuth — AuthContext importa este hook (ciclo de
             imports) — así que el rol viene de la capa de push: sessionStorage
             'pp_user' (escrito por PushSettings al montar con sesión) con
             auto-resolución vía GET /api/session si falta. */
          try {
            dispatchPushFromEvent(evento, msg.payload, navigateRef.current, getCurrentRol());
          } catch (e) { /* no romper sync por fallo de notif */ }
        } catch (e) {
          /* mensaje malformado, ignorar */
        }
      };

      ws.onclose = () => {
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
        if (!mounted) return;
        setConnected(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        try { ws.close(); } catch (e) {}
      };
    }

    function scheduleReconnect() {
      if (!mounted) return;
      if (reconnectTimerRef.current) return;
      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(30000, 1000 * Math.pow(1.5, attempt));
      reconnectAttemptsRef.current = attempt + 1;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    }

    connect();

    return () => {
      mounted = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) {}
        wsRef.current = null;
      }
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  return { connected };
}
