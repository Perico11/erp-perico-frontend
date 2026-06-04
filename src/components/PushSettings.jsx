import { useEffect, useState } from 'react';
import {
  getPushSettings,
  setPushSettings,
  getPushPermission,
  requestPushPermission,
  showPush,
} from '../utils/pushNotifications';

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

const TIPOS = [
  { key: 'stockCritico',   label: 'Stock crítico',           sub: 'MP sin existencia' },
  { key: 'ocVencida',      label: 'OC vencida',              sub: 'Pasó fecha de entrega' },
  { key: 'devolucion',     label: 'Devoluciones',            sub: 'Cliente devuelve producto' },
  { key: 'loteEnCamino',   label: 'Lote en camino',          sub: 'Luis escaneó para llevar' },
  { key: 'qcHold',         label: 'QC retenido',             sub: 'Lote requiere revisión' },
  { key: 'conteoVarianza', label: 'Conteo con varianza',     sub: 'Diferencia > 5% en cycle count' },
];

export default function PushSettings() {
  const [perm, setPerm] = useState(getPushPermission());
  const [settings, setSettings] = useState(getPushSettings());

  useEffect(() => {
    const onVis = () => setPerm(getPushPermission());
    window.addEventListener('focus', onVis);
    return () => window.removeEventListener('focus', onVis);
  }, []);

  const toggle = (key) => {
    const next = setPushSettings({ [key]: !settings[key] });
    setSettings(next);
  };

  const pedirPermiso = async () => {
    const r = await requestPushPermission();
    setPerm(r);
    if (r === 'granted') {
      const next = setPushSettings({ enabled: true });
      setSettings(next);
    }
  };

  const probar = () => {
    const result = showPush({
      tipo: 'stockCritico',
      title: 'Notificación de prueba',
      body: 'Si ves esto, las notificaciones están funcionando ✓',
      tag: 'test-' + Date.now(),
    });
    if (!result) {
      alert('No se pudo mostrar. Revisa que el permiso esté concedido y "Solo en segundo plano" desactivado para probar con la pestaña visible.');
    }
  };

  const permBadge = () => {
    if (perm === 'unsupported') return <span style={S.badge('err')}>No disponible</span>;
    if (perm === 'denied')      return <span style={S.badge('err')}>Bloqueadas</span>;
    if (perm === 'granted')     return <span style={S.badge('ok')}>Permitidas</span>;
    return <span style={S.badge('warn')}>Sin permiso</span>;
  };

  return (
    <div style={S.card}>
      <div style={S.header}>
        <div style={S.title}>Notificaciones del navegador</div>
        {permBadge()}
      </div>

      <div style={S.desc}>
        Recibe alertas en tu escritorio cuando ocurren eventos críticos del sistema,
        incluso si tienes otra pestaña activa.
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
            Eventos a notificar
          </div>

          {TIPOS.map(t => (
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
