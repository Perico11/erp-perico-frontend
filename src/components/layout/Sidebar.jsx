import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import useConfirm from '../../hooks/useConfirm';
import humanizeError from '../../utils/humanizeError';
import CountBadge from '../ui/CountBadge';
import ThemeToggle from '../ui/ThemeToggle';
import { usePedidosNotif } from '../../context/PedidosNotifContext';

const icons = {
  dashboard:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  formulas:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  inventario:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>,
  ordenes:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>,
  produccion:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  stockFabrica: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  recoleccion:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  recepcion:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><polyline points="7 12 12 14 17 12"/></svg>,
  compras:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  trazabilidad: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  admin:        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  cycleCount:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
  laboratorio:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 11-4 0"/><path d="M8 17h8"/></svg>,
  devoluciones: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  pedidos:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 14h6"/></svg>,
  reportes:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-6"/></svg>,
  pronostico:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  sat:          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>,
  posAliases:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
};

/* Sprint F (jun 2026): campo `roles` opcional para restringir adicionalmente
   por rol explícito. Soluciona los casos donde `perm` no es lo suficientemente
   granular y se mostraban items que la ruta App.jsx luego rechazaba (parpadeo
   a Dashboard sin explicación). El filtro final es: can(perm) AND (roles.length===0 OR roles.includes(rol)). */
const NAV_ITEMS = [
  { key: 'dashboard',    label: 'Inicio',       path: '/',              icon: icons.dashboard,    perm: 'dashboard' },
  /* Candado dueño (jun 2026): Enrique (tecnico) NO tiene la pestaña Fórmulas.
     Ve la fórmula SOLO al producir (la carga vía API dentro de /produccion). El
     permiso `formulas` sigue activo para él (producción lo necesita), por eso se
     oculta la pestaña con `roles` y no quitando el permiso. compras ya queda
     fuera por perm (formulas:false). */
  { key: 'formulas',     label: 'Fórmulas',     path: '/formulas',      icon: icons.formulas,     perm: 'formulas',    roles: ['admin','compras'] },
  { key: 'inventario',   label: 'Inventario',   path: '/inventario',    icon: icons.inventario,   perm: 'inventario' },
  { key: 'pedidos',      label: 'Pedidos',      path: '/pedidos',       icon: icons.pedidos,      perm: 'ordenes',     roles: ['admin','almacen','tecnico'] },
  /* "Flujo" retirado del menú (jun 2026, censo duplicados — decisión owner):
     Pedidos absorbe el ciclo completo (misma card, mismas acciones). La ruta
     /flujo queda viva como respaldo. */
  /* Órdenes: solo admin/tecnico — la tab "Almacén Terán" (lo único de Josué
     aquí) se eliminó por duplicar Pedidos. */
  { key: 'ordenes',      label: 'Órdenes',      path: '/ordenes',       icon: icons.ordenes,      perm: 'ordenes',     roles: ['admin','tecnico'] },
  { key: 'produccion',   label: 'Producción',   path: '/produccion',    icon: icons.produccion,   perm: 'produccion' },
  /* Stock Fábrica restringido a admin/almacén (jun 2026, decisión owner): para
     Enrique (técnico) era redundante — el stock vive en Inventarios ▸ PT ▸
     Fábrica y el ENVASAR ya está en Producción ▸ En envasado. Josué conserva la
     pantalla para reenvasar totes y transferir a Terán (lo único que solo vive
     aquí). Mismo patrón roles[] que "Recepción Terán". */
  { key: 'stockFabrica', label: 'Stock Fábrica',path: '/stock-fabrica', icon: icons.stockFabrica, perm: 'stockFabrica', roles: ['admin','almacen'] },
  { key: 'recoleccion',  label: 'Recolección',  path: '/recoleccion',   icon: icons.recoleccion,  perm: 'recoleccion' },
  /* FIX jun 2026 (censo menú): la pantalla PRINCIPAL de Josué no existía en el
     sidebar — solo se llegaba por card del Dashboard o el sheet móvil (roto). */
  { key: 'recepcion',    label: 'Recepción Terán', path: '/almacen',    icon: icons.recepcion,    perm: 'stockFabrica', roles: ['admin','almacen'] },
  { key: 'compras',      label: 'Compras',      path: '/compras',       icon: icons.compras,      perm: 'compras' },
  /* Capa Pronóstico (§9): inteligencia de compras separada. */
  { key: 'pronostico',   label: 'Pronóstico',   path: '/pronostico',    icon: icons.pronostico,   perm: 'compras',     roles: ['admin','compras'] },
  { key: 'trazabilidad', label: 'Trazabilidad', path: '/trazabilidad',  icon: icons.trazabilidad, perm: 'trazabilidad' },
  { key: 'cycleCount',   label: 'Conteo',       path: '/conteo',        icon: icons.cycleCount,   perm: 'cycleCount' },
  /* Reportes: la ruta solo permite admin/inventario/compras. ANTES perm='inventario'
     incluía a tecnico → parpadeo. Ahora restringido por roles[]. */
  { key: 'reportes',     label: 'Reportes',     path: '/reportes',      icon: icons.reportes,     perm: 'inventario',  roles: ['admin','inventario','compras'] },
  { key: 'laboratorio',  label: 'Laboratorio',  path: '/laboratorio',   icon: icons.laboratorio,  perm: 'laboratorio' },
  /* Devoluciones PT (cliente→fábrica): técnico/almacén/admin. Capa 3 (jun 2026)
     separó la devolución de MP (compras→proveedor) en su propia entrada, así que
     este item ya NO se muestra a compras (Arely usa "Devol. a proveedor"). */
  { key: 'devoluciones', label: 'Devoluciones', path: '/devoluciones',  icon: icons.devoluciones, perm: 'devoluciones', roles: ['admin','tecnico','almacen'] },
  /* Devoluciones de MP a proveedor (Capa 3, Arely / compras). */
  { key: 'devolucionesMp', label: 'Devol. a proveedor', path: '/devoluciones-mp', icon: icons.devoluciones, perm: 'devoluciones', roles: ['admin','compras'] },
  /* Capa Pronóstico (§9): SAT/CFDI y POS Aliases salen a pantalla propia (compras+admin). */
  { key: 'sat',          label: 'SAT / CFDI',   path: '/sat',           icon: icons.sat,          perm: 'compras',     roles: ['admin','compras'] },
  { key: 'posAliases',   label: 'POS Aliases',  path: '/pos-aliases',   icon: icons.posAliases,   perm: 'compras',     roles: ['admin','compras'] },
  { key: 'admin',        label: 'Admin',        path: '/admin',         icon: icons.admin,        perm: 'admin' },
];

const S = {
  aside: { display: 'flex', flexDirection: 'column', width: 240, height: '100vh', background: 'var(--lp-bg-raised)', borderRight: '1.5px solid var(--lp-border-subtle)', position: 'fixed', left: 0, top: 0, zIndex: 40, fontFamily: 'var(--lp-font-sans)' },
  brand: { padding: '16px 16px 14px', borderBottom: '1px solid var(--lp-border-subtle)', display: 'flex', alignItems: 'center', gap: 10 },
  brandLogo: { width: 30, height: 30, objectFit: 'contain', flexShrink: 0 },
  brandName: { fontSize: 15, fontWeight: 700, color: 'var(--lp-brand-700)', letterSpacing: '-0.02em' },
  brandSub: { fontSize: 11, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 },
  nav: { flex: 1, overflowY: 'auto', padding: '10px 8px' },
  link: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 'var(--lp-radius-sm)', fontSize: 14, fontWeight: 500, color: 'var(--lp-text-secondary)', textDecoration: 'none', transition: 'all .15s', marginBottom: 3 },
  linkActive: { background: 'var(--lp-brand-50)', color: 'var(--lp-brand-700)', fontWeight: 600 },
  footer: { padding: '12px 12px', borderTop: '1px solid var(--lp-border-subtle)' },
  footerWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'var(--lp-brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-brand-700)', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  footerName: { fontSize: 12, fontWeight: 600, color: 'var(--lp-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  footerRol: { fontSize: 11, color: 'var(--lp-text-tertiary)', textTransform: 'capitalize' },
  logoutBtn: { background: 'none', border: 'none', padding: 6, borderRadius: 'var(--lp-radius-sm)', cursor: 'pointer', color: 'var(--lp-text-tertiary)', display: 'flex', alignItems: 'center' },
  iconBtn: { background: 'none', border: 'none', padding: 6, borderRadius: 'var(--lp-radius-sm)', cursor: 'pointer', color: 'var(--lp-text-tertiary)', display: 'flex', alignItems: 'center' },
  avatarMenu: {
    position: 'absolute', bottom: 60, left: 12, right: 12,
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    boxShadow: '0 4px 16px rgba(26,24,21,.08)',
    padding: 6, zIndex: 50,
  },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '8px 10px', fontSize: 13, color: 'var(--lp-text-primary)',
    cursor: 'pointer', borderRadius: 'var(--lp-radius-sm)',
    background: 'none', border: 'none', width: '100%', textAlign: 'left',
    fontFamily: 'inherit',
  },
};

export default function Sidebar() {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, ConfirmEl] = useConfirm();
  /* FIX jun 2026 (Sprint P): badge rojo con # pendientes en el ítem "Pedidos".
     count se mantiene en context global PedidosNotifContext que solo se activa
     para rol 'tecnico'; para otros roles devuelve 0 y CountBadge no renderiza. */
  const pedidosNotif = usePedidosNotif();
  const items = NAV_ITEMS.filter(i =>
    can(i.perm) && (!Array.isArray(i.roles) || i.roles.length === 0 || i.roles.includes(user?.rol))
  );

  /* Sprint G-9: handler de cambio de PIN propio.
     Flujo en 2 pasos: pide PIN actual → pide PIN nuevo → confirma con backend.
     Si el backend acepta, las demás sesiones se cierran (la nuestra sigue
     con el mismo token porque no rotó). */
  const handleCambiarPin = async () => {
    setMenuOpen(false);
    const pinActual = await confirm(
      'Ingresa tu PIN actual para confirmar tu identidad.',
      {
        title: 'Cambiar PIN — paso 1 de 2',
        confirmText: 'Continuar',
        prompt: { label: 'PIN actual', placeholder: '••••', required: true,
                  minLength: 4, maxLength: 4, rows: 1, numeric: true, password: true },
      }
    );
    if (!pinActual) return;
    const pinNuevo = await confirm(
      'Ingresa tu nuevo PIN de 4 dígitos. Debe ser diferente al actual. Las demás sesiones se cerrarán por seguridad.',
      {
        title: 'Cambiar PIN — paso 2 de 2',
        confirmText: 'Guardar nuevo PIN',
        danger: false,
        prompt: { label: 'PIN nuevo', placeholder: '••••', required: true,
                  minLength: 4, maxLength: 4, rows: 1, numeric: true, password: true },
      }
    );
    if (!pinNuevo) return;
    try {
      const r = await api.cambiarPinPropio(pinActual, pinNuevo);
      if (r?.ok) {
        alert(`PIN cambiado. ${r.sesionesCerradas || 0} sesiones cerradas en otros dispositivos.`);
      } else {
        alert('No se pudo cambiar: ' + humanizeError(r));
      }
    } catch (e) {
      alert(humanizeError(e));
    }
  };

  return (
    <aside style={S.aside} className="sidebar-desktop">
      {ConfirmEl}
      <div style={S.brand}>
        <img src="/logos/logo-perico-green.svg" alt="" style={S.brandLogo} />
        <div style={{ minWidth: 0 }}>
          <div style={S.brandName}>Pinturas El Perico</div>
          <div style={S.brandSub}>ERP Producción</div>
        </div>
      </div>
      <nav style={S.nav}>
        {items.map(item => {
          /* FIX P: badge count solo para item 'pedidos'. S.link ya tiene
             position: relative para anclar el CountBadge absolute. */
          const isPedidos = item.key === 'pedidos';
          const count = isPedidos ? pedidosNotif.count : 0;
          return (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === '/'}
              style={({ isActive }) => ({ ...S.link, ...(isActive ? S.linkActive : {}), position: 'relative' })}
            >
              {item.icon}
              <span>{item.label}</span>
              {isPedidos && count > 0 && <CountBadge count={count} variant="sidebar" />}
            </NavLink>
          );
        })}
      </nav>
      <div style={{ ...S.footer, position: 'relative' }}>
        {menuOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
              onClick={() => setMenuOpen(false)}
            />
            <div style={S.avatarMenu}>
              <button
                style={S.menuItem}
                onClick={handleCambiarPin}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--lp-brand-50)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Cambiar PIN
              </button>
              <button
                style={{ ...S.menuItem, color: 'var(--lp-danger-600)' }}
                onClick={() => { setMenuOpen(false); logout(); }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--lp-danger-100)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Cerrar sesión
              </button>
            </div>
          </>
        )}
        {/* Fila: avatar/menú (flex:1) + toggle de tema. HANDOFF jun 2026:
            en escritorio el TopBar derecho se oculta, así que el toggle de
            modo claro/oscuro vive aquí en el footer del sidebar. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            style={{ ...S.footerWrap, background: 'none', border: 'none', padding: 0, flex: 1, minWidth: 0, cursor: 'pointer', textAlign: 'left' }}
            onClick={() => setMenuOpen(o => !o)}
            title="Menú de usuario"
          >
            <div style={S.avatar}>{user?.nombre?.charAt(0) || '?'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.footerName}>{user?.nombre || 'Usuario'}</div>
              <div style={S.footerRol}>{user?.rol || ''}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--lp-text-tertiary)', transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} aria-hidden="true">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <ThemeToggle style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, padding: 0, borderRadius: 'var(--lp-radius-sm)', flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
}

export { NAV_ITEMS };
