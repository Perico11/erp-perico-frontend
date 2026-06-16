/**
 * NotificacionPushBanner — ERP Pinturas El Perico
 * Banner estilo iOS que baja en la parte superior cuando llega un evento
 * mientras el usuario está dentro de la app (primer plano). Diseño del
 * "MOCKUP NOTIFICACIONES" (jun 2026). Se monta una sola vez (PushBannerHost)
 * y se alimenta del evento global `pp-push-received`.
 *
 * Componente controlado:
 *   <NotificacionPushBanner
 *     visible titulo="Resina baja" subtitulo="Para recolectar"
 *     area="Inventario" color="var(--lp-danger-600)"
 *     onDismiss={...} onClick={...} />
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// ── Path del logo (servido estático por nginx en /assets) ───────────────────
const LOGO_PATH = '/assets/logo-perico.svg';

// ── Duración auto-dismiss en ms ───────────────────────────────────────────────
const AUTO_DISMISS_MS = 4500;

// ── Estilos ──────────────────────────────────────────────────────────────────
const bannerStyle = (visible) => ({
  position: 'fixed',
  top: visible ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : -140,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 2000,
  width: 'min(360px, calc(100vw - 32px))',
  background: 'rgba(24,24,26,0.88)',
  backdropFilter: 'blur(28px) saturate(1.4)',
  WebkitBackdropFilter: 'blur(28px) saturate(1.4)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 18,
  padding: '11px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  cursor: 'pointer',
  transition: 'top 0.38s cubic-bezier(.22,1,.36,1)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  userSelect: 'none',
  WebkitUserSelect: 'none',
  pointerEvents: visible ? 'auto' : 'none',
});

const iconStyle = {
  width: 40,
  height: 40,
  borderRadius: 10,
  background: '#1D9E75',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 7,
};

const imgStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  filter: 'brightness(0) invert(1)',
};

const contentStyle = {
  flex: 1,
  minWidth: 0,
  display: 'grid',
  gridTemplateAreas: '"title ago" "sub sub" "area area"',
  gridTemplateColumns: '1fr auto',
  rowGap: 2,
};

export default function NotificacionPushBanner({
  visible = false,
  titulo = '',
  subtitulo = '',
  area = '',
  color = 'var(--lp-brand-600)',
  onDismiss,
  onClick,
}) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(() => onDismiss?.(), AUTO_DISMISS_MS);
    }
    return () => clearTimeout(timerRef.current);
  }, [visible, onDismiss]);

  const handleClick = () => {
    clearTimeout(timerRef.current);
    onClick?.();
    onDismiss?.();
  };

  return createPortal(
    <div
      style={bannerStyle(visible)}
      role="alert"
      aria-live="polite"
      aria-hidden={!visible}
      onClick={handleClick}
    >
      <div style={iconStyle}>
        <img src={LOGO_PATH} alt="ERP Perico" style={imgStyle} />
      </div>
      <div style={contentStyle}>
        <div style={{
          gridArea: 'title',
          fontSize: 13,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.95)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          paddingRight: 4,
        }}>
          {titulo}
        </div>
        <div style={{
          gridArea: 'ago',
          fontSize: 11,
          color: 'rgba(255,255,255,0.42)',
          whiteSpace: 'nowrap',
        }}>
          ahora
        </div>
        {subtitulo && (
          <div style={{
            gridArea: 'sub',
            fontSize: 11.5,
            color: 'rgba(255,255,255,0.60)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {subtitulo}
          </div>
        )}
        <div style={{
          gridArea: 'area',
          fontSize: 11,
          fontWeight: 600,
          color,
          letterSpacing: '0.02em',
          textTransform: 'capitalize',
        }}>
          {area}
        </div>
      </div>
    </div>,
    document.body,
  );
}
