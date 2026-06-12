import { useEffect } from 'react';

/* Bloquea el scroll del FONDO mientras un modal/sheet está montado.
   FIX jun 2026 v2 (reporte dueño: "sigue fallando"): el scroll de la app NO
   vive en el body — vive en #root, porque `#root{overflow-x:hidden}` fuerza
   por spec CSS que overflow-y compute 'auto' (un eje hidden impide visible en
   el otro). El lock v1 congelaba el body (actor equivocado) y el gesto seguía
   scrolleando #root de fondo. v2: overflow:hidden en html + body + #root
   (el scroller real), guardando y restaurando la posición de #root/window.
   Contador global para modales anidados (el último en cerrar libera). */
let _locks = 0;
let _saved = null;

export default function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    if (_locks === 0) {
      _saved = {
        rootTop: root ? root.scrollTop : 0,
        winY: window.scrollY || 0,
        html: html.style.overflow,
        body: body.style.overflow,
        root: root ? root.style.overflow : '',
        rootY: root ? root.style.overflowY : '',
      };
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      if (root) { root.style.overflow = 'hidden'; root.style.overflowY = 'hidden'; }
    }
    _locks++;
    return () => {
      _locks--;
      if (_locks <= 0) {
        _locks = 0;
        if (!_saved) return;
        html.style.overflow = _saved.html || '';
        body.style.overflow = _saved.body || '';
        if (root) {
          root.style.overflow = _saved.root || '';
          root.style.overflowY = _saved.rootY || '';
          root.scrollTop = _saved.rootTop;
        }
        window.scrollTo(0, _saved.winY);
        _saved = null;
      }
    };
  }, [active]);
}
