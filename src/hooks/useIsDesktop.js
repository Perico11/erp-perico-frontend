import { useState, useEffect } from 'react';

/**
 * useIsDesktop — responsive del rediseño verde.
 *
 * El paquete de Claude Design trae diseños SEPARADOS:
 *   · escritorio (ERP Escritorio.html) → tablas / grids anchos
 *   · móvil (ERP Móvil.html)           → cards limpias, bottom-sheets
 *
 * Cada pantalla debe renderizar el layout correcto según el ancho de ventana.
 * Breakpoint por defecto: 880px (sidebar 244 + contenido cómodo para tabla).
 */
export default function useIsDesktop(bp = 880) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= bp : true
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(min-width:${bp}px)`);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange);
    };
  }, [bp]);
  return isDesktop;
}
