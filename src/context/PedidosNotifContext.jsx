/* ═══════════════════════════════════════════════════════════════════════
   PedidosNotifContext — Sprint P (jun 2026).

   Estado global de notificaciones de pedidos para el técnico (Enrique).

   Responsabilidades:
   - Carga inicial de pedidos pendientes via /api/pedidos
   - Suscribe al canal WS 'pedidos' para detectar nuevos en realtime
   - Mantiene una cola local + Set de "vistos" (en cola) en sessionStorage
   - Expone: count (sin vistos), peek (cabeza de la cola para el modal),
     accept, reject, markSeen (En cola), refresh, allPending

   Solo se activa para rol 'tecnico'. Otros roles obtienen count=0 sin coste.
   ═══════════════════════════════════════════════════════════════════════ */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

const Ctx = createContext(null);
const STORAGE_KEY = 'pp_pedidos_vistos_v1';

/* FIX jun 2026 (Sprint U1): cambiar sessionStorage→localStorage para que
   "En cola" persista cross-tab. Antes Enrique con 2 tabs marcaba "En cola"
   en una y la otra seguía mostrando el modal del mismo pedido (cada tab
   tenía su propia sessionStorage). Con localStorage + 'storage' listener,
   las tabs convergen instantáneamente. */
function loadVistos() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveVistos(set) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); } catch {}
}

export function PedidosNotifProvider({ children }) {
  const { user } = useAuth();
  const activo = user?.rol === 'tecnico'; /* solo el técnico recibe modal */

  const [pendientes, setPendientes] = useState([]);
  const [vistos, setVistos] = useState(() => loadVistos());
  const refreshingRef = useRef(false);

  /* Fetch pedidos pendientes — los que el técnico debe atender */
  const refresh = useCallback(async () => {
    if (!activo) { setPendientes([]); return; }
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const r = await api.getPedidos();
      const list = Array.isArray(r) ? r : (r.data || []);
      const pend = list.filter(p =>
        p && !p.eliminado && p.estado === 'pendiente'
      );
      /* Ordenar por fecha asc (más viejo primero — el técnico debería atenderlos en orden) */
      pend.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      setPendientes(pend);
      /* Mezclar "vistos / en cola" PERSISTENTES del servidor (cross-dispositivo) con
         los locales — así un pedido puesto "en cola" en otro equipo no re-abre el
         modal aquí. El servidor ya poda los que dejaron de estar pendientes. */
      try {
        const rv = await api.getPedidosVistos();
        const sids = (rv && Array.isArray(rv.ids)) ? rv.ids : [];
        if (sids.length) {
          setVistos(prev => {
            const next = new Set(prev);
            let add = false;
            sids.forEach(id => { if (!next.has(id)) { next.add(id); add = true; } });
            if (add) saveVistos(next);
            return next;
          });
        }
      } catch {}
    } catch (e) {
      console.warn('[PedidosNotif] refresh falló:', e?.message);
    } finally {
      refreshingRef.current = false;
    }
  }, [activo]);

  useEffect(() => { refresh(); }, [refresh]);

  /* FIX jun 2026 (U1): si OTRA tab del mismo dominio cambia los vistos,
     sincronizamos nuestra Set local. El evento 'storage' solo se dispara
     en OTRAS tabs (no en la que escribió), perfecto para cross-tab sync. */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const next = new Set(JSON.parse(e.newValue || '[]'));
        setVistos(next);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /* Realtime: cualquier cambio en pedidos refresca la lista. */
  useRealtimeSync({
    onPedidos: () => { if (activo) refresh(); },
    onOrdenes: () => { if (activo) refresh(); }, /* aceptar-y-producir cambia ambos */
  });

  /* Cola "no vista": el modal solo aparece para pedidos pendientes que NO
     están en `vistos`. Si Enrique pulsa "En cola", el pedido sigue en
     pendientes pero deja de abrirse en modal. */
  const noVistos = useMemo(
    () => pendientes.filter(p => !vistos.has(p.id) && !vistos.has(p.codigo)),
    [pendientes, vistos]
  );

  /* `count`: número de pedidos pendientes (sin importar vistos). El badge
     refleja TODO el backlog real — la regla del handoff:
     "decrementa con Aceptar/Rechazar, NO cambia con En cola". */
  const count = pendientes.length;
  /* Cabeza de la cola NO vista para alimentar el modal */
  const peek = noVistos[0] || null;

  const accept = useCallback(async (pedido) => {
    if (!pedido) return;
    try {
      await api.aceptarYProducir(pedido.id, { lanzarProduccion: false });
      /* Limpiar vistos del que aceptamos */
      setVistos(prev => {
        const next = new Set(prev);
        next.delete(pedido.id); next.delete(pedido.codigo);
        saveVistos(next); return next;
      });
      await refresh();
    } catch (e) {
      console.warn('[PedidosNotif] accept falló:', e?.message);
      throw e;
    }
  }, [refresh]);

  const reject = useCallback(async (pedido, motivo = '') => {
    if (!pedido) return;
    try {
      await api.post('/api/pedidos/rechazar', { pedidoId: pedido.id, motivo });
      setVistos(prev => {
        const next = new Set(prev);
        next.delete(pedido.id); next.delete(pedido.codigo);
        saveVistos(next); return next;
      });
      await refresh();
    } catch (e) {
      console.warn('[PedidosNotif] reject falló:', e?.message);
      throw e;
    }
  }, [refresh]);

  const markSeen = useCallback((pedido) => {
    if (!pedido) return;
    setVistos(prev => {
      const next = new Set(prev);
      if (pedido.id) next.add(pedido.id);
      if (pedido.codigo) next.add(pedido.codigo);
      saveVistos(next); return next;
    });
    /* Persistir "en cola" en el servidor (cross-dispositivo): así NO reaparece en
       otro equipo ni al reiniciar sesión — antes solo vivía en localStorage. */
    if (pedido.id) api.marcarPedidosVistos([pedido.id]).catch(() => {});
  }, []);

  /* Si un pedido visto ya no está en pendientes (fue resuelto en otro lado),
     limpiar para no acumular cruft en sessionStorage. */
  useEffect(() => {
    if (vistos.size === 0) return;
    const idsVivos = new Set();
    pendientes.forEach(p => {
      if (p.id) idsVivos.add(p.id);
      if (p.codigo) idsVivos.add(p.codigo);
    });
    let cambio = false;
    const next = new Set();
    vistos.forEach(v => {
      if (idsVivos.has(v)) next.add(v);
      else cambio = true;
    });
    if (cambio) { setVistos(next); saveVistos(next); }
  }, [pendientes, vistos]);

  const value = useMemo(() => ({
    activo, count, peek, accept, reject, markSeen, refresh,
    allPending: pendientes, noVistos,
  }), [activo, count, peek, accept, reject, markSeen, refresh, pendientes, noVistos]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePedidosNotif() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    /* Defensa: si alguien usa el hook fuera del provider, devolver shape vacío
       para que componentes opcionales (badge) no rompan. */
    return { activo: false, count: 0, peek: null, allPending: [], noVistos: [],
             accept: async () => {}, reject: async () => {}, markSeen: () => {}, refresh: async () => {} };
  }
  return ctx;
}
