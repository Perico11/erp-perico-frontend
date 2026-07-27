import { useEffect, useState } from 'react';
import {
  getPushSettings,
  setPushSettings,
  getPushPermission,
  requestPushPermission,
  showPush,
  rolPuedeRecibir,
  setCurrentRol,
} from '../utils/pushNotifications';
import { subscribeToPush, sendTestPush, pushSupported } from '../utils/webPush';
import { useAuthOpcional } from '../context/AuthContext';

const S = {
  card: {
    background: 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)',
    padding: 16,
    fontFamily: 'var(--lp-font-sans)',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)' },
  badge: (color) => ({
    fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 4,
    background: color === 'ok' ? 'var(--lp-success-100)' :
                color === 'warn' ? 'var(--lp-warning-100)' :
                color === 'err' ? 'var(--lp-danger-100)' : 'var(--lp-bg-base)',
    color:      color === 'ok' ? 'var(--lp-success-700)' :
                color === 'warn' ? 'var(--lp-warning-700)' :
                color === 'err' ? 'var(--lp-danger-700)' : 'var(--lp-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  desc: { fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 12, lineHeight: 1.5 },
  btn: (primary) => ({
    background: primary ? 'var(--lp-brand-600)' : 'var(--lp-bg-base)',
    color: primary ? 'white' : 'var(--lp-text-primary)',
    border: '1.5px solid ' + (primary ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'),
    borderRadius: 'var(--lp-radius-sm)',
    padding: '8px 14px',
    fontSize: 12, fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  }),
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 0', borderTop: '1px solid var(--lp-border-subtle)',
  },
  rowLabel: { fontSize: 13, color: 'var(--lp-text-primary)', fontWeight: 500 },
  rowSub: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 },
  toggle: (on) => ({
    width: 36, height: 20, borderRadius: 10,
    background: on ? 'var(--lp-success-600)' : 'var(--lp-border-subtle)',
    position: 'relative', cursor: 'pointer',
    transition: 'background .15s',
  }),
  knob: (on) => ({
    position: 'absolute', top: 2, left: on ? 18 : 2,
    width: 16, height: 16, borderRadius: '50%',
    background: 'white', transition: 'left .15s',
    boxShadow: '0 1px 3px rgba(0,0,0,.2)',
  }),
  actions: { display: 'flex', gap: 8, marginTop: 8 },
};

/* Catálogo completo de toggles (labels humanos en español). Cada usuario ve
   SOLO los tipos de su pipeline — el filtro real es rolPuedeRecibir(), que
   reusa PUSH_TIPO_ROLES/TIPOS_POR_ROL (espejo de server.js). Un técnico no
   ve "OC vencida"; un recolector solo ve "Lote listo en fábrica". */
const TIPOS = [
  { key: 'stockCritico',   label: 'Stock crítico',           sub: 'MP sin existencia o bajo mínimo' },
  { key: 'ocVencida',      label: 'OC vencida',              sub: 'Orden de compra pasó la fecha de entrega' },
  { key: 'ocNueva',        label: 'Solicitudes de OC',       sub: 'Un técnico solicita materia prima' },
  { key: 'devolucion',     label: 'Devoluciones',            sub: 'Cliente devuelve producto' },
  { key: 'pedidoNuevo',    label: 'Pedido nuevo',            sub: 'Almacén pide producto a fábrica' },
  { key: 'qcHold',         label: 'QC retenido',             sub: 'Lote requiere revisión de calidad' },
  { key: 'loteListo',      label: 'Lote listo en fábrica',   sub: 'Producido o envasado, listo para recolección' },
  { key: 'loteEnCamino',   label: 'Lote en camino',          sub: 'Recolección rumbo a Almacén Terán' },
  { key: 'conteoVarianza', label: 'Conteo con varianza',     sub: 'Diferencia > 5% por aprobar' },
  { key: 'conteoAprobado', label: 'Conteo procesado',        sub: 'Tu sesión de conteo fue aprobada o finalizada' },
];

/**
 * Panel de push — funciona para CUALQUIER rol autenticado (decisión owner
 * jun 2026), no solo admin. Montado en /notificaciones (todos) y en la zona
 * admin (AdminPage).
 * @param {boolean} [embedded] — sin chrome de card propio (cuando ya vive
 *   dentro de una card colapsable, ej. NotificacionesPage).
 */
export default function PushSettings({ embedded = false }) {
  const [perm, setPerm] = useState(getPushPermission());
  const [settings, setSettings] = useState(getPushSettings());

  /* Tolerante a montarse fuera del AuthProvider (tests): devuelve null en vez
     de lanzar, y la llamada al hook es incondicional. */
  const auth = useAuthOpcional();
  const rol = auth?.user?.rol || null;

  /* Write-through del rol a sessionStorage: la capa de dispatch
     (useRealtimeSync → dispatchPushFromEvent) corre fuera del AuthContext
     y lee 'pp_user' para el gate por pipeline. */
  useEffect(() => { if (rol) setCurrentRol(rol); }, [rol]);

  useEffect(() => {
    const onVis = () => setPerm(getPushPermission());
    window.addEventListener('focus', onVis);
    return () => window.removeEventListener('focus', onVis);
  }, []);

  /* Solo los toggles del pipeline del rol (admin ve todos) */
  const tiposVisibles = TIPOS.filter(t => rolPuedeRecibir(t.key, rol));

  const toggle = (key) => {
    const next = setPushSettings({ [key]: !settings[key] });
    setSettings(next);
  };

  /* Notification.requestPermission() DENTRO del click (gesto de usuario —
     requisito de los navegadores móviles para mostrar el prompt). */
  const pedirPermiso = async () => {
    const r = await requestPushPermission();
    setPerm(r);
    if (r === 'granted') {
      const next = setPushSettings({ enabled: true });
      setSettings(next);
      /* Suscribir a Web Push real → notificaciones en el teléfono aunque la app
         esté cerrada. Va dentro del mismo gesto del click. */
      const sub = await subscribeToPush();
      if (!sub.ok) alert('Permiso concedido, pero no se pudo suscribir el dispositivo:\n\n' + (sub.error || ''));
    }
    /* Avisar a contenedores (header colapsable de NotificacionesPage) que
       el estado del permiso cambió, para refrescar su badge. */
    try { window.dispatchEvent(new Event('pp-push-permission')); } catch {}
  };

  const probar = async () => {
    /* Flujo robusto: 1) permiso, 2) ASEGURAR que el dispositivo esté suscrito
       (sin esto el server manda el push a 0 dispositivos y no aparece nada),
       3) enviar el push real del servidor y reportar a cuántos llegó. */
    if (!pushSupported()) { alert('Este navegador no soporta notificaciones push.'); return; }

    if (getPushPermission() !== 'granted') {
      const r = await requestPushPermission();
      setPerm(r);
      if (r !== 'granted') { alert('Primero debes permitir las notificaciones.'); return; }
      setPushSettings({ enabled: true });
      setSettings(getPushSettings());
    }

    const sub = await subscribeToPush();
    if (!sub.ok) { alert('No se pudo activar en este dispositivo:\n\n' + (sub.error || '')); return; }

    const res = await sendTestPush();
    if (res.enviadas > 0) {
      alert(`Notificación enviada a ${res.enviadas} dispositivo(s). Debe aparecer en la barra de tu teléfono — prueba bloqueando la pantalla.`);
    } else {
      alert('El dispositivo quedó suscrito, pero el envío no encontró destino. Cierra y vuelve a abrir la app, luego intenta de nuevo.');
    }
  };

  const permBadge = () => {
    if (perm === 'unsupported') return <span style={S.badge('err')}>No disponible</span>;
    if (perm === 'denied')      return <span style={S.badge('err')}>Bloqueadas</span>;
    if (perm === 'granted')     return <span style={S.badge('ok')}>Permitidas</span>;
    return <span style={S.badge('warn')}>Sin permiso</span>;
  };

  return (
    <div style={embedded ? { fontFamily: 'var(--lp-font-sans)' } : S.card}>
      {!embedded && (
        <div style={S.header}>
          <div style={S.title}>Notificaciones del navegador</div>
          {permBadge()}
        </div>
      )}

      <div style={S.desc}>
        Recibe alertas en este dispositivo (escritorio o celular) cuando ocurren
        eventos de tu pipeline, incluso con la app en segundo plano. Solo verás
        los eventos que involucran tu rol.
      </div>

      {perm === 'unsupported' && (
        <div style={{ ...S.desc, color: 'var(--lp-danger-700)' }}>
          Tu navegador no soporta notificaciones push.
        </div>
      )}

      {perm === 'default' && (
        <div style={S.actions}>
          <button style={S.btn(true)} onClick={pedirPermiso}>Activar notificaciones</button>
        </div>
      )}

      {perm === 'denied' && (
        <div style={{ ...S.desc, background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 'var(--lp-radius-sm)' }}>
          El navegador bloqueó las notificaciones. Para reactivarlas, abre el candado en la barra
          de direcciones y permite "Notificaciones" para este sitio.
        </div>
      )}

      {perm === 'granted' && (
        <>
          <div style={S.row}>
            <div>
              <div style={S.rowLabel}>Activar notificaciones</div>
              <div style={S.rowSub}>Master switch — desactiva todo de un golpe</div>
            </div>
            <div
              style={S.toggle(settings.enabled)}
              onClick={() => toggle('enabled')}
              role="switch"
              tabIndex={0}
              aria-checked={settings.enabled}
              aria-label="Activar notificaciones"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle('enabled'); } }}
            >
              <div style={S.knob(settings.enabled)} />
            </div>
          </div>

          <div style={S.row}>
            <div>
              <div style={S.rowLabel}>Solo cuando la pestaña no está visible</div>
              <div style={S.rowSub}>Evita spam mientras usas el ERP activamente</div>
            </div>
            <div
              style={S.toggle(settings.soloEnSegundoPlano)}
              onClick={() => toggle('soloEnSegundoPlano')}
              role="switch"
              tabIndex={0}
              aria-checked={settings.soloEnSegundoPlano}
              aria-label="Solo cuando la pestaña no está visible"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle('soloEnSegundoPlano'); } }}
            >
              <div style={S.knob(settings.soloEnSegundoPlano)} />
            </div>
          </div>

          <div style={{ marginTop: 14, marginBottom: 4, fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Eventos a notificar{rol && rol !== 'admin' ? ' (según tu rol)' : ''}
          </div>

          {tiposVisibles.map(t => (
            <div key={t.key} style={S.row}>
              <div>
                <div style={S.rowLabel}>{t.label}</div>
                <div style={S.rowSub}>{t.sub}</div>
              </div>
              <div
                style={{
                  ...S.toggle(settings[t.key]),
                  opacity: settings.enabled ? 1 : 0.4,
                  pointerEvents: settings.enabled ? 'auto' : 'none',
                }}
                onClick={() => toggle(t.key)}
                role="switch"
                tabIndex={settings.enabled ? 0 : -1}
                aria-checked={!!settings[t.key]}
                aria-label={`Notificación: ${t.label}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(t.key); } }}
              >
                <div style={S.knob(settings[t.key])} />
              </div>
            </div>
          ))}

          <div style={{ ...S.actions, marginTop: 14 }}>
            <button style={S.btn(false)} onClick={probar}>Enviar notificación de prueba</button>
          </div>
        </>
      )}
    </div>
  );
}
