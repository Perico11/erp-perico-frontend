import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import ThemeToggle from '../ui/ThemeToggle';
import useIsDesktop from '../../hooks/useIsDesktop';

const S = {
  bar: {
    position: 'sticky', top: 0, zIndex: 30,
    /* AG24: topbar limpio. Fondo = mismo que el contenido (bg-base) para que en
       escritorio se funda con la página (como el mockup). El borde inferior solo
       se aplica en móvil (en render) para separar de la barra sticky. */
    background: 'var(--lp-bg-base)',
    /* Respeta el notch / Dynamic Island en iOS: el padding-top SOLO empuja
       hacia abajo el contenido. El contenido vive en el .inner con altura
       fija de 56px que NUNCA se monta sobre el notch. */
    paddingTop: 'env(safe-area-inset-top, 0)',
    fontFamily: 'var(--lp-font-sans)',
    boxSizing: 'border-box',
  },
  inner: {
    height: 56,
    padding: '0 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxSizing: 'border-box',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  brandSep: { width: 1, height: 22, background: 'var(--lp-border-subtle)' },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  right: { display: 'flex', alignItems: 'center', gap: 8 },
  name: { fontSize: 12, fontWeight: 500, color: 'var(--lp-text-secondary)' },
  /* Sprint F-1 (jun 2026): touch target ≥44×44 px. Enrique con guantes de
     nitrilo manchados de pigmento fallaba al primer toque sobre el botón
     anterior (~34px). El padding 12 + minWidth/Height 44 cumple guía
     Apple/Material sin agrandar el ícono. */
  btn: { background: 'none', border: 'none', padding: 12, minWidth: 44, minHeight: 44, borderRadius: 'var(--lp-radius-sm)', cursor: 'pointer', color: 'var(--lp-text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  /* AG24: botón circular del mockup (luna / campana). 44px = touch target. */
  iconCircle: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', padding: 0, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', color: 'var(--lp-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge: {
    position: 'absolute', top: 6, right: 6,
    minWidth: 16, height: 16, padding: '0 4px',
    background: 'var(--lp-danger-600)', color: '#fff',
    borderRadius: 8, fontSize: 11, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1.5px solid var(--lp-bg-base)',
    fontFamily: 'var(--lp-font-mono)',
  },
};

export default function TopBar({ title, action }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  /* En Inicio el cuerpo del Dashboard ya muestra "Hola, {nombre} · fecha", así que
     aquí NO repetimos el saludo (evita el doble "Hola Emmanuel"). En el resto de
     pantallas sí, porque su cuerpo no saluda. */
  const enInicio = location.pathname === '/';
  const isDesktop = useIsDesktop();
  const [count, setCount] = useState(0);
  /* Branding configurable desde Admin → Apariencia. Se actualiza vía evento custom. */
  const [branding, setBranding] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/branding').then(r => r.json()).then(d => {
      if (!cancelled && d?.data) setBranding(d.data);
    }).catch(() => {});
    const onUpdate = (e) => { if (e?.detail) setBranding(e.detail); };
    window.addEventListener('branding-updated', onUpdate);
    return () => { cancelled = true; window.removeEventListener('branding-updated', onUpdate); };
  }, []);

  /* Cargar contador de alertas activas */
  const cargarCount = () => {
    api.getNotificaciones().then(r => {
      const arr = Array.isArray(r) ? r : (r?.data || []);
      const k = (Array.isArray(arr) ? null : arr.resumen) || (r?.resumen);
      if (k && typeof k.noLeidas === 'number') {
        setCount(k.noLeidas); /* badge = no leídas (baja al marcar leídas) */
      } else if (k && typeof k.criticas === 'number') {
        setCount((k.criticas || 0) + (k.medias || 0));
      } else if (Array.isArray(arr)) {
        setCount(arr.length);
      }
    }).catch(() => {});
  };
  useEffect(() => {
    cargarCount();
    const t = setInterval(cargarCount, 60000);
    return () => clearInterval(t);
  }, []);

  /* Refrescar cuando hay eventos relevantes */
  useRealtimeSync({
    onInventario: () => cargarCount(),
    onOc: () => cargarCount(),
    onTrazabilidad: () => cargarCount(),
    /* FIX (audit): el badge también debe refrescar al finalizar conteo, crear
       devolución (MP/PT) o mover una OT — antes esos pendientes tardaban hasta 60s
       (solo escuchaba inventario/oc/trazabilidad). */
    onCycleCount: () => cargarCount(),
    onDevolucion: () => cargarCount(),
    onTransferencias: () => cargarCount(),
  });

  /* Logos desde branding configurable. HANDOFF jun 2026: default = logo
     monocromático verde en TODAS las pantallas. El branding override sigue
     funcionando si el admin sube uno propio. */
  const logoIcon = branding?.logoIcon || '/logos/logo-perico-green.svg';

  /* Saludo del Design System: "Hola {nombre} · N pendientes" (1:1 mockup). */
  const firstName = (user?.nombre || '').split(' ')[0] || (user?.nombre || '');
  const pendText = count > 0 ? `${count} ${count === 1 ? 'pendiente' : 'pendientes'}` : 'Todo al día';

  return (
    <header style={{ ...S.bar, ...(isDesktop ? {} : { borderBottom: '1px solid var(--lp-border-subtle)' }) }}>
      <div style={S.inner}>
        {/* IZQUIERDA: solo en MÓVIL (no hay sidebar) → perico + título de pantalla.
            En escritorio el perico ya vive en el sidebar; repetirlo aquí encima del
            saludo era redundante, así que el topbar de escritorio queda vacío a la izq. */}
        <div style={S.brand}>
          {!isDesktop ? (
            <>
              <img src={logoIcon} alt="Pinturas El Perico" height={34} style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
              <span style={S.brandSep} aria-hidden="true" />
              <h1 style={S.title}>{title}</h1>
            </>
          ) : !enInicio ? (
            /* Escritorio: TÍTULO de la pantalla (estilo limpio, sin saludo).
               En Inicio se omite porque el cuerpo del Dashboard ya saluda. */
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--lp-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{title}</h1>
          ) : null}
        </div>
        {/* DERECHA: solo tema + notificaciones (circulares), como el mockup.
            El nombre y el logout salen en escritorio (logout vive en el menú del
            avatar del sidebar). En móvil se conserva el botón salir (no hay sidebar). */}
        <div style={S.right}>
          {action}
          <ThemeToggle style={S.iconCircle} />
          <button
            onClick={() => navigate('/notificaciones')}
            style={S.iconCircle}
            title="Notificaciones"
            aria-label={count > 0 ? `Notificaciones, ${count} sin leer` : 'Notificaciones'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {count > 0 && (
              <span style={S.badge}>{count > 99 ? '99+' : count}</span>
            )}
          </button>
          {!isDesktop && (
            <button onClick={logout} style={S.iconCircle} title="Salir" aria-label="Cerrar sesión">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
