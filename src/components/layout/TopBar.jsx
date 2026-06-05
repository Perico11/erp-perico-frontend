import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import Logo from '../Logo';
import ThemeToggle from '../ui/ThemeToggle';

const S = {
  bar: {
    position: 'sticky', top: 0, zIndex: 30,
    /* Fondo opaco para que en iOS el área del notch / Dynamic Island
       siempre tenga color sólido y nada se vea POR DEBAJO.
       HANDOFF jun 2026: usa token raised para flipear en modo oscuro
       (antes #FAFAF8 hardcodeado no respondía al toggle). */
    background: 'var(--lp-bg-raised)',
    borderBottom: '1px solid var(--lp-border-subtle)',
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
  badge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, padding: '0 4px',
    background: 'var(--lp-danger-600)', color: '#fff',
    borderRadius: 8, fontSize: 11, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1.5px solid var(--lp-bg-base)',
    fontFamily: 'var(--lp-font-mono)',
  },
};

export default function TopBar({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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
      if (k && typeof k.criticas === 'number') {
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
  });

  /* Logos desde branding configurable. HANDOFF jun 2026: default = logo
     monocromático verde en TODAS las pantallas. El branding override sigue
     funcionando si el admin sube uno propio. */
  const logoMain = branding?.logoMain || '/logos/logo-perico-green.svg';
  const logoIcon = branding?.logoIcon || '/logos/logo-perico-green.svg';

  return (
    <header style={S.bar}>
      <div style={S.inner}>
        <div style={S.brand}>
          {/* Desktop: logo horizontal · Móvil: icono. Branding override aplica vía src directo. */}
          <img src={logoMain} alt="" height={36} className="topbar-logo-desktop" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          <img src={logoIcon} alt="" width={32} height={32} className="topbar-logo-mobile" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span style={S.brandSep} aria-hidden="true" />
          <h1 style={S.title}>{title}</h1>
        </div>
        <div style={S.right} className="topbar-right-mobile">
          <ThemeToggle style={S.btn} />
          <button
            onClick={() => navigate('/notificaciones')}
            style={S.btn}
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
          <span style={S.name}>{user?.nombre}</span>
          <button onClick={logout} style={S.btn} title="Salir" aria-label="Cerrar sesión">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
