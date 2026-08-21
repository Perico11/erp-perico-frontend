import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generic hook for fetching data with loading/error states.
 * Auto-refreshes on interval (default 60s — el WebSocket ya provee push
 * en tiempo real para inventario/ordenes/pedidos/trazabilidad/etc.).
 *
 * H14 + H16 FIX: usa un requestId monotónico para descartar resultados
 * de fetches obsoletos. Cuando las deps cambian rápido (ej: usuario tipea en
 * un filtro), el último fetch lanzado gana — ya no se aplica el resultado
 * del anterior aunque termine después.
 *
 * H18 FIX: default subido de 10s → 60s. Las pantallas que requieran refresh
 * más agresivo pueden pasar refreshInterval=5000 explícitamente. Pasar 0
 * deshabilita el polling y deja solo el push del WebSocket.
 */
export function useApiData(fetchFn, deps = [], refreshInterval = 60000) {
  /* Protección: deps debe ser un array para useCallback. null/undefined → [] */
  const safeDeps = Array.isArray(deps) ? deps : [];
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const myRequestId = ++requestIdRef.current;
    try {
      const res = await fetchFn();
      /* Descartar si: componente desmontado, O bien si ya se lanzó otro fetch posterior */
      if (!mountedRef.current) return;
      if (myRequestId !== requestIdRef.current) return; /* obsoleto: hay un fetch más reciente */
      setData(res);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      if (myRequestId !== requestIdRef.current) return; /* obsoleto */
      setError(err.message || 'Error');
    } finally {
      /* Sin `return` dentro del finally: un return ahí descarta cualquier
         excepción que estuviera propagándose (p.ej. si el propio catch fallara),
         y el error desaparecería sin rastro. Basta con la condición. */
      if (mountedRef.current && myRequestId === requestIdRef.current) setLoading(false);
    }
  }, safeDeps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    /* Marcar loading al cambiar deps — el resultado del fetch viejo ya no se aplicará */
    setLoading(true);
    load();
    const timer = refreshInterval > 0 ? setInterval(load, refreshInterval) : null;
    return () => {
      mountedRef.current = false;
      if (timer) clearInterval(timer);
      /* Bumpeamos requestId al desmontar — fetches en flight no aplicarán nada */
      requestIdRef.current++;
    };
  }, [load, refreshInterval]);

  return { data, loading, error, reload: load };
}

/**
 * Debounced search value hook.
 */
export function useSearch(delay = 200) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef(null);

  const onChange = useCallback((val) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(val), delay);
  }, [delay]);

  return { query, debouncedQuery, setQuery: onChange };
}
