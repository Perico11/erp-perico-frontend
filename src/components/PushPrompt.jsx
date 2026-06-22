import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import { requestPushPermission, getPushPermission, setPushSettings, setCurrentRol } from '../utils/pushNotifications';
import { pushSupported, subscribeToPush, isSubscribed } from '../utils/webPush';

/* PushPrompt — al iniciar sesión, ofrece activar las notificaciones del teléfono
   (Web Push real: llegan aunque la app esté cerrada). Pedido dueño jun 2026.

   - Si el permiso ya está 'granted' → suscribe en silencio (no molesta).
   - Si está 'default' → muestra un banner suave; el botón dispara el permiso
     dentro del gesto del usuario (requisito de iOS/Android).
   - 'denied' o no soportado → no muestra nada. */
const DISMISS_KEY = 'pp_push_prompt_dismissed';

export default function PushPrompt() {
  let auth = null;
  try { auth = useAuth(); } catch { /* fuera de provider (tests) */ }
  const user = auth?.user || null;
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  /* MÓVIL: mientras el banner está arriba, congela el scroll del FONDO (html+body+#root)
     y publica --pp-vvh para que la card siga al viewport visible. Mismo fix canónico
     que ui/Modal.jsx. */
  useBodyScrollLock(show);

  useEffect(() => {
    if (!user || !pushSupported()) { setShow(false); return; }
    if (user.rol) setCurrentRol(user.rol);
    const perm = getPushPermission();

    if (perm === 'granted') {
      /* Ya concedido: asegurar la suscripción de este dispositivo en silencio. */
      isSubscribed().then(sub => { if (!sub) subscribeToPush().catch(() => {}); });
      setShow(false);
      return;
    }
    if (perm !== 'default') { setShow(false); return; } /* denied / unsupported */

    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === '1'; } catch {}
    if (!dismissed) {
      /* pequeño delay para no chocar con el render inicial del login→home */
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
  }, [user]);

  const activar = async () => {
    setBusy(true);
    try {
      const r = await requestPushPermission();
      if (r === 'granted') {
        setPushSettings({ enabled: true });
        const sub = await subscribeToPush();
        if (!sub.ok) alert('No se pudieron activar las notificaciones:\n\n' + (sub.error || ''));
      } else if (r === 'denied') {
        alert('Bloqueaste las notificaciones. Para activarlas, permite "Notificaciones" para este sitio en los ajustes del navegador.');
      }
    } catch {}
    setBusy(false);
    setShow(false);
    try { window.dispatchEvent(new Event('pp-push-permission')); } catch {}
  };

  const ahoraNo = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={S.wrap} role="dialog" aria-label="Activar notificaciones">
      <div style={S.card}>
        <div style={S.iconBox}>
          {/* campana SVG line — sin emojis (design system) */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--lp-brand-600)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.title}>Activa las notificaciones</div>
          <div style={S.sub}>
            Recibe avisos de tu trabajo en este teléfono, aunque tengas la app cerrada.
          </div>
          <div style={S.actions}>
            <button style={S.btnPrimary} onClick={activar} disabled={busy}>
              {busy ? 'Activando…' : 'Activar'}
            </button>
            <button style={S.btnGhost} onClick={ahoraNo} disabled={busy}>Ahora no</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  wrap: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1200,
    display: 'flex', justifyContent: 'center',
    padding: 'calc(12px + env(safe-area-inset-bottom, 0px)) 12px 12px',
    pointerEvents: 'none',
  },
  card: {
    pointerEvents: 'auto',
    display: 'flex', gap: 12, alignItems: 'flex-start',
    width: '100%', maxWidth: 440,
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 16, padding: 14,
    boxShadow: '0 10px 36px rgba(20,36,31,.18)',
    fontFamily: 'var(--lp-font-sans)',
    /* MÓVIL (viewport bajo / landscape): si la card excede el alto visible, scrollea
       internamente en vez de salirse de pantalla. --pp-vvh sigue al viewport visible
       (lo publica useBodyScrollLock); 24px = padding vertical del wrap. */
    maxHeight: 'calc(var(--pp-vvh, 100dvh) - 24px)',
    overflowY: 'auto',
  },
  iconBox: {
    flexShrink: 0, width: 40, height: 40, borderRadius: 10,
    background: 'var(--lp-brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)' },
  sub: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 3, lineHeight: 1.45 },
  actions: { display: 'flex', gap: 8, marginTop: 12 },
  btnPrimary: {
    background: 'var(--lp-brand-600)', color: '#fff', border: 'none',
    borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', minHeight: 40, fontFamily: 'inherit',
  },
  btnGhost: {
    background: 'transparent', color: 'var(--lp-text-secondary)',
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 10,
    padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    minHeight: 40, fontFamily: 'inherit',
  },
};
