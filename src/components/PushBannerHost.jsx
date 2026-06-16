/**
 * PushBannerHost — ERP Pinturas El Perico
 * Monta UNA sola vez el NotificacionPushBanner (mockup jun 2026) y lo alimenta
 * del evento global `window.dispatchEvent('pp-push-received', { detail })`.
 *
 * El dispatcher es utils/pushNotifications.js → showPush(): cuando llega un
 * evento RELEVANTE y la pestaña está en primer plano, en lugar de la
 * notificación del SO (que no se vería) emite este banner in-app.
 *
 * detail esperado: { titulo, mensaje, area, color, onClick? }
 *   onClick (opcional) = navegación ya resuelta por la capa de push.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import NotificacionPushBanner from './NotificacionPushBanner';

export default function PushBannerHost() {
  /* Banner siempre montado (controlado): `visible` togglea, el contenido se
     conserva durante la animación de salida para que no parpadee. */
  const [state, setState] = useState({
    visible: false, titulo: '', subtitulo: '', area: '', color: 'var(--lp-brand-600)',
  });
  const onClickRef = useRef(null);
  const hideTimer = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      const d = (e && e.detail) || {};
      onClickRef.current = typeof d.onClick === 'function' ? d.onClick : null;
      clearTimeout(hideTimer.current);
      setState({
        visible: true,
        titulo: d.titulo || '',
        subtitulo: d.mensaje || d.subtitulo || '',
        area: d.area || '',
        color: d.color || 'var(--lp-brand-600)',
      });
    };
    window.addEventListener('pp-push-received', handler);
    return () => { window.removeEventListener('pp-push-received', handler); clearTimeout(hideTimer.current); };
  }, []);

  const dismiss = useCallback(() => {
    setState(s => ({ ...s, visible: false }));
  }, []);

  const handleClick = useCallback(() => {
    const fn = onClickRef.current;
    onClickRef.current = null;
    dismiss();
    if (fn) { try { fn(); } catch { /* navegación falló — el banner igual se cierra */ } }
  }, [dismiss]);

  return (
    <NotificacionPushBanner
      visible={state.visible}
      titulo={state.titulo}
      subtitulo={state.subtitulo}
      area={state.area}
      color={state.color}
      onDismiss={dismiss}
      onClick={handleClick}
    />
  );
}
