import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook para mostrar un toast local con cleanup correcto del setTimeout.
 *
 * BUG QUE EVITA (M9):
 * Antes muchas pantallas tenían `setTimeout(() => setToast(''), 4000)` sin
 * guardar el timer ni limpiarlo. Si el usuario hacía varias acciones rápidas:
 *   1. Múltiples timers corriendo simultáneamente
 *   2. Al desmontar el componente, los timers seguían vivos
 *   3. Sus callbacks intentaban setState en componente desmontado → warning React
 *   4. El último timer en disparar "ganaba", a veces ocultaba un toast nuevo
 *
 * Uso:
 *   const [toast, showToast] = useLocalToast();
 *   showToast('Pedido creado', 4000);
 *   {toast && <div>{toast}</div>}
 */
export function useLocalToast(defaultDuration = 4000) {
  const [toast, setToast] = useState('');
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const showToast = useCallback((msg, duration) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(msg || '');
    if (!msg) return;
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) setToast('');
      timerRef.current = null;
    }, duration || defaultDuration);
  }, [defaultDuration]);

  /* Cleanup al desmontar — clave para evitar setState en componente desmontado */
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return [toast, showToast];
}
