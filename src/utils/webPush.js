/* utils/webPush.js — suscripción a Web Push real (jun 2026).
   Registra push-sw.js, obtiene la llave VAPID del backend, crea la suscripción
   del navegador y la manda al servidor. Con esto el teléfono recibe la
   notificación AUNQUE la app esté cerrada. */

const SW_URL = '/push-sw.js';

function _token() {
  try { return sessionStorage.getItem('pp_token') || ''; } catch { return ''; }
}

/* VAPID public key (base64url) → Uint8Array que pide PushManager.subscribe */
function _urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

/* Registra el SW de push (idempotente). Devuelve el registration o null. */
export async function registerPushSW() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
    return reg;
  } catch (e) {
    console.warn('[webPush] no se pudo registrar push-sw:', e?.message);
    return null;
  }
}

/* Suscribe el dispositivo y manda la suscripción al backend.
   Requiere que el permiso de notificaciones ya esté 'granted'.
   Devuelve true si quedó suscrito. */
export async function subscribeToPush() {
  if (!pushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  const tok = _token();
  if (!tok) return false;

  try {
    const reg = await registerPushSW();
    if (!reg) return false;
    await navigator.serviceWorker.ready;

    /* ¿Ya está suscrito este dispositivo? Reusar. */
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      /* Llave pública VAPID del backend */
      const r = await fetch('/api/push/vapid-public-key');
      const d = await r.json();
      if (!d?.ok || !d.publicKey) return false;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8Array(d.publicKey),
      });
    }

    /* Mandar la suscripción al servidor (la guarda por usuario/rol) */
    const resp = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': tok },
      body: JSON.stringify({ subscription: sub.toJSON ? sub.toJSON() : sub }),
    });
    const out = await resp.json().catch(() => ({}));
    /* Marca: con web-push activo, el servidor manda las notifs (open + cerrada).
       El push de primer plano (pushNotifications.js) se suprime para no duplicar. */
    if (out.ok) { try { sessionStorage.setItem('pp_webpush_active', '1'); } catch {} }
    return !!out.ok;
  } catch (e) {
    console.warn('[webPush] subscribe falló:', e?.message);
    return false;
  }
}

/* Cancela la suscripción del dispositivo y avisa al backend. */
export async function unsubscribeFromPush() {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    try { sessionStorage.removeItem('pp_webpush_active'); } catch {}
    const tok = _token();
    if (tok) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': tok },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
  } catch (e) { /* silencioso */ }
}

/* Enviar un push de prueba a este usuario (verificación end-to-end). */
export async function sendTestPush() {
  const tok = _token();
  if (!tok) return false;
  try {
    const r = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': tok },
    });
    const d = await r.json().catch(() => ({}));
    return !!d.ok;
  } catch { return false; }
}

/* ¿Este dispositivo ya tiene una suscripción activa? */
export async function isSubscribed() {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}
