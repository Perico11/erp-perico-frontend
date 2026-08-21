/* ═══════════════════════════════════════════════════════════════════════
   ChatNotifContext — badge global de mensajes de chat sin leer (jul 2026).

   Mantiene el total de no-leídos (todos los canales) para pintar el badge
   en Sidebar/BottomNav de TODOS los roles. Fuentes:
   - Carga inicial + polling suave (60 s) de /api/chat/resumen
   - Bump inmediato al llegar el evento WS 'chat' (mensaje nuevo)

   ChatPage usa `refresh()` tras marcar leído para bajar el badge al instante.
   Patrón calcado de PedidosNotifContext (shape vacío fuera del provider).
   ═══════════════════════════════════════════════════════════════════════ */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

const Ctx = createContext(null);

export function ChatNotifProvider({ children }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) { setCount(0); return; }
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const r = await api.getChatResumen();
      setCount(Number(r?.totalNoLeidos) || 0);
    } catch {
      /* sin red / backend viejo: badge en silencio */
    } finally {
      refreshingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  /* Mensaje nuevo por WS → recalcular (el resumen ya descuenta los propios). */
  useRealtimeSync({ onChat: () => refresh() });

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChatNotif() {
  const ctx = useContext(Ctx);
  if (!ctx) return { count: 0, refresh: async () => {} };
  return ctx;
}
