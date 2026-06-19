import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CountBadge from '../ui/CountBadge';
import { usePedidosNotif } from '../../context/PedidosNotifContext';

/* ════════════════════════════════════════════════════════════════════════════
   BottomNav móvil — patrón "sheet con grid completo" (Opción B)

   • 4 tabs fijos abajo: Inicio + 2 adaptativos por rol + Menú
   • El botón "Menú" abre un sheet desde abajo con TODAS las pantallas
     organizadas por sección (Producción / Inventario / Compras / Otros)
   • Animación nativa iOS/Android (transform translateY con easing)
   • Filtrado por permisos: solo aparece lo que el rol puede ver
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Iconos line-style minimalistas (matchean sidebar) ─────────────────── */
const ICONS = {
  inicio: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  produccion: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18"/><path d="M5 21v-12l5 4v-4l5 4h4"/>
      <path d="M19 21v-8l-1.436 -9.574a.5 .5 0 0 0 -.495 -.426h-1.145a.5 .5 0 0 0 -.494 .418l-1.43 9.582"/>
      <path d="M9 17h1"/><path d="M14 17h1"/>
    </svg>
  ),
  inventario: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  compras: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  ),
  menu: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  /* sub-icons (usados en el grid del sheet) */
  dashboard:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  ordenes:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>,
  pedidos:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"/><rect x="9" y="2" width="6" height="4" rx="1"/></svg>,
  produccionSub:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4 1.65 1.65 0 0014 21H10a2 2 0 01-2-2v-.09A1.65 1.65 0 007 18.4"/></svg>,
  stockFabrica: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>,
  conteo:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 14l2 2 4-4"/></svg>,
  inv:          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
  devol:        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  compr:        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
  recol:        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  /* FIX jun 2026 (K8): icono para "Recepción Terán" — la pantalla
     principal de Josué que faltaba en bottom nav. */
  recepcion:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><polyline points="7 12 12 14 17 12"/></svg>,
  traz:         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  formulas:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 11-4 0"/></svg>,
  lab:          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 2v6l-4 7a5 5 0 0 0 4 8h6a5 5 0 0 0 4-8l-4-7V2"/><path d="M9 2h6"/></svg>,
  admin:        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  reportes:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-6"/></svg>,
  pronostico:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  sat:          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>,
  posAliases:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  notif:        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  cerrar:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

/* ── Catálogo COMPLETO de pantallas para el sheet (agrupadas por sección).
   Sprint F (jun 2026):
   - Campo `roles` opcional para restricción adicional por rol explícito
     (ej. Reportes que la ruta solo admite admin/inventario/compras pero `perm:'inventario'`
     incluía a tecnico → tile parpadeaba al click).
   - Devoluciones: nuevo permiso `devoluciones` dado a admin/tecnico/almacen/compras
     (antes perm='admin' lo ocultaba a tecnico que la ruta sí permitía).
   - Agregado tile "Calidad QC" como shortcut directo a /produccion?tab=calidad
     (antes Enrique tenía que entrar a Producción y dar otro tap). */
const SECCIONES = [
  {
    titulo: 'Producción',
    items: [
      /* "Flujo" retirado (jun 2026): Pedidos absorbe el ciclo completo. */
      { path: '/pedidos',                 label: 'Pedidos',       icon: ICONS.pedidos,       perm: 'ordenes',     roles: ['admin','almacen','tecnico'] },
      { path: '/ordenes',                 label: 'Órdenes',       icon: ICONS.ordenes,       perm: 'ordenes',     roles: ['admin','tecnico'] },
      { path: '/produccion',              label: 'Lanzar lote',   icon: ICONS.produccionSub, perm: 'produccion' },
      { path: '/produccion?tab=calidad',  label: 'Calidad QC',    icon: ICONS.lab,           perm: 'produccion' },
      /* Stock Fábrica: solo admin/almacén (jun 2026). Para Enrique era redundante
         (stock = Inventarios ▸ PT ▸ Fábrica; envasar = Producción ▸ En envasado).
         Josué la conserva para reenvasar + transferir a Terán. */
      { path: '/stock-fabrica',           label: 'Stock fábrica', icon: ICONS.stockFabrica,  perm: 'stockFabrica', roles: ['admin','almacen'] },
      /* FIX jun 2026 (K8): pantalla principal de Josué (escanear QR para
         recibir PT en Terán) faltaba en sheet. Solo se llegaba por KPI
         del Dashboard o URL directa. */
      /* FIX jun 2026 (censo menú): la ruta real es /almacen — el tile apuntaba a
         /almacen-recepcion (inexistente) y caía al Dashboard. Y la ruta solo
         admite admin/almacen (se quita tecnico del tile). */
      { path: '/almacen',                 label: 'Recepción',     icon: ICONS.recepcion,     perm: 'stockFabrica', roles: ['admin','almacen'] },
    ],
  },
  {
    titulo: 'Inventario',
    items: [
      { path: '/inventario',   label: 'Stock MP',     icon: ICONS.inv,      perm: 'inventario' },
      { path: '/conteo',       label: 'Conteo',       icon: ICONS.conteo,   perm: 'cycleCount' },
      { path: '/devoluciones', label: 'Devoluciones', icon: ICONS.devol,    perm: 'devoluciones', roles: ['admin','tecnico','almacen'] },
      { path: '/reportes',     label: 'Reportes',     icon: ICONS.reportes, perm: 'inventario', roles: ['admin','inventario','compras'] },
    ],
  },
  {
    titulo: 'Compras y trazabilidad',
    items: [
      { path: '/compras',      label: 'Compras',      icon: ICONS.compr, perm: 'compras' },
      { path: '/pronostico',   label: 'Pronóstico',   icon: ICONS.pronostico, perm: 'compras', roles: ['admin','compras'] },
      { path: '/devoluciones-mp', label: 'Devol. proveedor', icon: ICONS.devol, perm: 'devoluciones', roles: ['admin','compras'] },
      { path: '/sat',          label: 'SAT / CFDI',   icon: ICONS.sat,        perm: 'compras', roles: ['admin','compras'] },
      { path: '/pos-aliases',  label: 'POS Aliases',  icon: ICONS.posAliases, perm: 'compras', roles: ['admin','compras'] },
      { path: '/recoleccion',  label: 'Recolección',  icon: ICONS.recol, perm: 'recoleccion' },
      { path: '/trazabilidad', label: 'Trazabilidad', icon: ICONS.traz,  perm: 'trazabilidad' },
    ],
  },
  {
    titulo: 'Otros',
    items: [
      /* Enrique (tecnico) NO ve la pestaña Fórmulas — solo la fórmula al producir
         (carga vía API en /produccion). Se oculta con `roles`, no quitando el
         permiso (producción lo necesita). compras ya queda fuera por perm. */
      { path: '/formulas',       label: 'Fórmulas',      icon: ICONS.formulas, perm: 'formulas', roles: ['admin','compras'] },
      { path: '/laboratorio',    label: 'Laboratorio',   icon: ICONS.lab,      perm: 'laboratorio' },
      { path: '/notificaciones', label: 'Notificaciones',icon: ICONS.notif,    perm: 'dashboard' },
      { path: '/admin',          label: 'Admin',         icon: ICONS.admin,    perm: 'admin' },
    ],
  },
];

/* ── Tabs adaptativos por rol (siempre Inicio + Menú; 2 del medio según rol) ── */
function tabsParaRol(rol, can) {
  const inicio = { path: '/', label: 'Inicio', icon: ICONS.inicio };
  const tabs = {
    admin:      [inicio, { path: '/pedidos',    label: 'Pedidos',    icon: ICONS.pedidos    }, { path: '/inventario', label: 'Inventario', icon: ICONS.inventario }],
    tecnico:    [inicio, { path: '/pedidos',    label: 'Pedidos',    icon: ICONS.pedidos    }, { path: '/produccion', label: 'Producción', icon: ICONS.produccionSub }],
    compras:    [inicio, { path: '/compras',    label: 'Compras',    icon: ICONS.compras    }, { path: '/inventario', label: 'Inventario', icon: ICONS.inventario }],
    /* jun 2026 (censo menú): Flujo retirado — Josué opera Recepción (su pantalla
       principal) + Pedidos (despachar); Luis opera Recolección + consulta Trazabilidad. */
    almacen:    [inicio, { path: '/almacen',    label: 'Recepción',  icon: ICONS.recepcion  }, { path: '/pedidos', label: 'Pedidos', icon: ICONS.pedidos }],
    recolector: [inicio, { path: '/recoleccion', label: 'Recolección', icon: ICONS.recol    }, { path: '/trazabilidad', label: 'Trazab.', icon: ICONS.traz }],
    inventario: [inicio, { path: '/inventario', label: 'Stock MP',   icon: ICONS.inventario }, { path: '/conteo', label: 'Conteo', icon: ICONS.conteo }],
  };
  return tabs[rol] || tabs.admin;
}

/* ════════════════════════════════════════════════════════════════════════════
   Componente principal
   ════════════════════════════════════════════════════════════════════════════ */
export default function BottomNav() {
  const { can, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  /* Sprint P: badge en tab/tile "Pedidos" */
  const pedidosNotif = usePedidosNotif();

  /* Cerrar sheet al navegar */
  useEffect(() => { setSheetOpen(false); }, [location.pathname]);

  /* Cerrar con Escape */
  useEffect(() => {
    if (!sheetOpen) return;
    const h = (e) => { if (e.key === 'Escape') setSheetOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sheetOpen]);

  /* Tabs principales según rol — filtrados por permisos */
  const tabsRol = useMemo(() => {
    const base = tabsParaRol(user?.rol, can);
    /* Inicio siempre. Los demás se filtran si no tiene permiso de esa pantalla.
       Si filtra dejándolo con <3 tabs, completamos con destinos del rol. */
    const inicio = base[0];
    const conPermiso = base.slice(1).filter(t => {
      const perm = permisoDePath(t.path);
      return !perm || can(perm);
    });
    return [inicio, ...conPermiso].slice(0, 3);
  }, [user?.rol, can]);

  /* Items del sheet — TODAS las pantallas a las que el rol tiene acceso */
  const seccionesPermitidas = useMemo(() => {
    return SECCIONES.map(sec => ({
      ...sec,
      items: sec.items.filter(it =>
        (!it.perm || can(it.perm)) &&
        (!Array.isArray(it.roles) || it.roles.length === 0 || it.roles.includes(user?.rol))
      ),
    })).filter(sec => sec.items.length > 0);
  }, [can]);

  /* Sprint F-5: matchear tiles con query string (ej. /produccion?tab=calidad).
     Si el path del tile tiene ?, comparamos pathname Y el tab del query.
     Sin esto, los tiles con query string no quedan marcados activos cuando el
     usuario está en esa pantalla. */
  const isActive = useCallback((path) => {
    if (path === '/') return location.pathname === '/';
    const [tilePath, tileQS] = path.split('?');
    if (location.pathname !== tilePath && !location.pathname.startsWith(tilePath + '/')) return false;
    if (!tileQS) return true; /* path sin query string → match por pathname */
    /* Compara cada parámetro del tile con el de la URL actual */
    const tileParams = new URLSearchParams(tileQS);
    for (const [k, v] of tileParams.entries()) {
      if (location.search && new URLSearchParams(location.search).get(k) === v) return true;
    }
    return false;
  }, [location.pathname, location.search]);

  const handleNav = (path) => {
    setSheetOpen(false);
    navigate(path);
  };

  return (
    <>
      <nav style={S.nav} className="bottom-nav-mobile safe-bottom">
        <div style={S.row}>
          {tabsRol.map(t => {
            /* Sprint P: badge solo en tab "Pedidos" si el rol técnico tiene pendientes */
            const esPedidos = t.path === '/pedidos';
            const count = esPedidos ? pedidosNotif.count : 0;
            return (
              <button
                key={'tab-' + t.path}
                type="button"
                style={{ ...S.btn(isActive(t.path)), position: 'relative' }}
                onClick={() => handleNav(t.path)}
                aria-label={t.label + (count > 0 ? ` (${count} pendientes)` : '')}
              >
                {isActive(t.path) && <span style={S.activeIndicator} />}
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  {t.icon}
                  {count > 0 && <CountBadge count={count} variant="mobile" />}
                </span>
                <span style={S.label}>{t.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            style={S.btn(sheetOpen)}
            onClick={() => setSheetOpen(o => !o)}
            aria-label="Abrir menú completo"
            aria-expanded={sheetOpen}
          >
            {sheetOpen && <span style={S.activeIndicator} />}
            <span>{ICONS.menu}</span>
            <span style={S.label}>Menú</span>
          </button>
        </div>
      </nav>

      {/* Sheet maestro con grid de TODAS las pantallas */}
      <div
        style={{
          ...S.overlay,
          opacity: sheetOpen ? 1 : 0,
          pointerEvents: sheetOpen ? 'auto' : 'none',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setSheetOpen(false); }}
        aria-hidden={!sheetOpen}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú completo"
          style={{
            ...S.sheet,
            transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
          }}
        >
          <div style={S.handle} />
          <div style={S.sheetHeader}>
            <span style={S.sheetTitle}>Menú de navegación</span>
            <button type="button" onClick={() => setSheetOpen(false)} style={S.closeBtn} aria-label="Cerrar">
              {ICONS.cerrar}
            </button>
          </div>
          <div style={S.sheetScroll}>
            {seccionesPermitidas.map(sec => (
              <div key={sec.titulo} style={{ marginBottom: 14 }}>
                <div style={S.secTitle}>{sec.titulo}</div>
                <div style={S.grid}>
                  {sec.items.map(it => {
                    const esPedidos = it.path === '/pedidos';
                    const count = esPedidos ? pedidosNotif.count : 0;
                    return (
                      <button
                        key={'tile-' + it.path}
                        type="button"
                        style={{ ...S.tile(isActive(it.path)), position: 'relative' }}
                        onClick={() => handleNav(it.path)}
                      >
                        <span style={{ position: 'relative', display: 'inline-block' }}>
                          {it.icon}
                          {count > 0 && <CountBadge count={count} variant="mobile" />}
                        </span>
                        <span style={S.tileLabel}>{it.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Mapa simple path → perm (para filtrar tabs sin redeclarar) ───────── */
function permisoDePath(path) {
  for (const sec of SECCIONES) {
    const it = sec.items.find(x => x.path === path);
    if (it) return it.perm;
  }
  return null;
}

/* ── Estilos (inline para mantener consistencia con resto del proyecto) ─ */
const S = {
  nav: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
    fontFamily: 'var(--lp-font-sans)',
  },
  row: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', width: '100%',
  },
  btn: (active) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '8px 4px 6px', fontSize: 11, fontWeight: active ? 700 : 500,
    color: active ? 'var(--lp-brand-600)' : 'var(--lp-text-tertiary)',
    background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', position: 'relative',
    transition: 'color .15s', width: '100%', minHeight: 56,
  }),
  activeIndicator: {
    position: 'absolute', top: 0, left: '25%', right: '25%',
    height: 2.5, background: 'var(--lp-brand-600)', borderRadius: '0 0 2px 2px',
  },
  label: {
    marginTop: 3, maxWidth: 76, overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  /* ── Sheet ── */
  overlay: {
    position: 'fixed', inset: 0, zIndex: 50,
    background: 'rgba(26, 24, 21, 0.5)',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    transition: 'opacity .25s ease-out',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
  },
  sheet: {
    background: 'var(--lp-bg-raised)',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: '10px 14px 0',
    boxShadow: '0 -6px 20px rgba(0,0,0,0.18)',
    transition: 'transform .32s cubic-bezier(0.32, 0.72, 0, 1)',
    /* Limitar altura para que NUNCA tape el bottom nav. Calculamos:
       100vh - bottom-nav (~64px) - safe-area = altura máxima utilizable. */
    maxHeight: 'calc(100vh - 80px - env(safe-area-inset-top, 0px))',
    display: 'flex', flexDirection: 'column',
    /* margen inferior = altura aproximada del bottom nav fijo */
    marginBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
  },
  handle: {
    width: 38, height: 4, background: 'var(--lp-border-strong)',
    borderRadius: 3, margin: '0 auto 8px',
  },
  sheetHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '4px 6px 10px',
    borderBottom: '1px solid var(--lp-border-subtle)',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)',
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--lp-text-tertiary)', padding: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 'var(--lp-radius-sm)',
  },
  sheetScroll: {
    overflowY: 'auto', flex: 1,
    /* El sheet ahora tiene marginBottom que reserva el espacio del bottom nav,
       así que solo necesitamos un padding pequeño para respirar al final. */
    paddingBottom: 16,
  },
  secTitle: {
    fontSize: 10, fontWeight: 700, color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.6px',
    padding: '8px 6px 6px',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
  },
  tile: (active) => ({
    padding: '14px 6px',
    borderRadius: 'var(--lp-radius)',
    background: active ? 'var(--lp-brand-50)' : 'var(--lp-bg-sunken)',
    border: '1.5px solid ' + (active ? 'var(--lp-brand-600)' : 'transparent'),
    color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-primary)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 6, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background .15s, border-color .15s',
    minHeight: 76,
  }),
  tileLabel: {
    fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: 1.25,
    maxWidth: '100%',
  },
};
