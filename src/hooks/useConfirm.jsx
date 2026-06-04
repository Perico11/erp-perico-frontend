import { useState, useCallback } from 'react';
import { ConfirmModal } from '../components/ui/Modal';

/**
 * useConfirm — reemplazo de window.confirm con UI nativa al design system.
 *
 * Uso:
 *   const [confirm, ConfirmEl] = useConfirm();
 *
 *   const handleEliminar = async () => {
 *     const ok = await confirm('¿Eliminar este lote?', { danger: true });
 *     if (!ok) return;
 *     // ... lógica
 *   };
 *
 *   return <>
 *     <button onClick={handleEliminar}>Eliminar</button>
 *     {ConfirmEl}
 *   </>;
 *
 * Opciones:
 *   - title:       título del modal (default: 'Confirmar')
 *   - confirmText: texto del botón confirmar (default: 'Confirmar')
 *   - danger:      true → botón rojo (acción destructiva)
 *
 * Beneficios sobre window.confirm:
 *   - Estilizado con el design system (no el feo modal nativo del navegador)
 *   - Soporta focus trap, aria-modal, screen readers
 *   - Funciona bien en iOS PWA standalone (window.confirm se ve raro ahí)
 *   - Cierra con Escape
 */
export default function useConfirm() {
  const [state, setState] = useState(null);

  /* confirm(message, opts):
       opts.title, opts.confirmText, opts.danger        — confirmación simple (bool)
       opts.prompt = { label, placeholder, required, minLength, rows }
                                                       — pide texto, resuelve con string o null
  */
  const confirm = useCallback((message, opts = {}) =>
    new Promise(resolve => {
      setState({
        message,
        title: opts.title || 'Confirmar',
        confirmText: opts.confirmText || 'Confirmar',
        danger: !!opts.danger,
        prompt: opts.prompt || null,
        resolve,
      });
    }), []);

  const handleClose = () => {
    if (!state) return;
    state.resolve(state.prompt ? null : false);
    setState(null);
  };
  const handleConfirm = (valor) => {
    if (!state) return;
    /* Si es prompt, resolver con el texto; si no, con true */
    state.resolve(state.prompt ? valor : true);
    setState(null);
  };

  const ConfirmEl = state ? (
    <ConfirmModal
      open
      title={state.title}
      message={state.message}
      confirmText={state.confirmText}
      danger={state.danger}
      prompt={state.prompt}
      onClose={handleClose}
      onConfirm={handleConfirm}
    />
  ) : null;

  return [confirm, ConfirmEl];
}
