import { useEffect } from 'react';

/* Bloquea el scroll del BODY mientras un modal/sheet está montado.
   FIX jun 2026 (reporte dueño): en móvil los sheets no scrolleaban — el gesto
   se "fugaba" al fondo y scrolleaba la página de atrás (scroll bleed, clásico
   de iOS Safari). overflow:hidden no basta en iOS: la técnica robusta es
   body position:fixed conservando el scrollY y restaurándolo al cerrar.
   Soporta modales anidados con contador global (el último en cerrar libera).
   Uso: useBodyScrollLock() dentro del componente del modal (o el hook de
   estilos del sheet) — el lock vive mientras el modal esté montado. */
let _locks = 0;
let _scrollY = 0;

export default function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    if (_locks === 0) {
      _scrollY = window.scrollY || 0;
      const b = document.body;
      b.style.position = 'fixed';
      b.style.top = `-${_scrollY}px`;
      b.style.left = '0';
      b.style.right = '0';
      b.style.width = '100%';
      b.style.overflow = 'hidden';
    }
    _locks++;
    return () => {
      _locks--;
      if (_locks <= 0) {
        _locks = 0;
        const b = document.body;
        b.style.position = '';
        b.style.top = '';
        b.style.left = '';
        b.style.right = '';
        b.style.width = '';
        b.style.overflow = '';
        window.scrollTo(0, _scrollY);
      }
    };
  }, [active]);
}
