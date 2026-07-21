import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { PedidosNotifProvider } from './context/PedidosNotifContext';
import AppLayout from './components/layout/AppLayout';
import VersionChecker from './components/VersionChecker';
import PushPrompt from './components/PushPrompt';
import PushBannerHost from './components/PushBannerHost';
import AsistenteFlotante from './components/AsistenteFlotante';
import ErrorBoundary from './components/ErrorBoundary';

/* Login y Dashboard cargan inmediatos (críticos para arranque) */
import LoginPage from './pages/login/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';

/* Las demás páginas se cargan bajo demanda → bundle inicial mucho más pequeño */
const InventarioPage      = lazy(() => import('./pages/inventario/InventarioPage'));
const OrdenesPage         = lazy(() => import('./pages/ordenes/OrdenesPage'));
const FormulasPage        = lazy(() => import('./pages/formulas/FormulasPage'));
const ProduccionPage      = lazy(() => import('./pages/produccion/ProduccionPage'));
const TrazabilidadPage    = lazy(() => import('./pages/trazabilidad/TrazabilidadPage'));
const ComprasPage         = lazy(() => import('./pages/compras/ComprasPage'));
const RecoleccionPage     = lazy(() => import('./pages/recoleccion/RecoleccionPage'));
const AdminPage           = lazy(() => import('./pages/admin/AdminPage'));
const CycleCountPage      = lazy(() => import('./pages/cycle-count/CycleCountPage'));
/* P2 (21-jul-2026): "Almacén" fusiona Stock Fábrica + Recepción Terán en una
   pantalla con 2 vistas (?vista=fabrica|recepcion). Los componentes originales
   se montan COMPLETOS adentro — cero acciones perdidas. /stock-fabrica
   redirige preservando el query (?tab interno de fábrica sigue vivo). */
const AlmacenPage         = lazy(() => import('./pages/almacen/AlmacenPage'));
const FlujoPage           = lazy(() => import('./pages/flujo/FlujoPage'));
const NotificacionesPage  = lazy(() => import('./pages/notificaciones/NotificacionesPage'));
const DevolucionesPage    = lazy(() => import('./pages/devoluciones/DevolucionesPage'));
const DevolucionesMPPage  = lazy(() => import('./pages/devoluciones-mp/DevolucionesMPPage'));
const EntregasPage        = lazy(() => import('./pages/entregas/EntregasPage'));
const PedidosPage         = lazy(() => import('./pages/pedidos/PedidosPage'));
const TransferenciasPage  = lazy(() => import('./pages/transferencias/TransferenciasPage'));
const IngresosPage        = lazy(() => import('./pages/ingresos/IngresosPage'));
/* StkAmericanoPage retirada del router (dueño 16-jul): el americano vive en
   Inventarios > Americano Terán / Alm. 2; las rutas viejas redirigen abajo. */
const LaboratorioPage     = lazy(() => import('./pages/laboratorio/LaboratorioPage'));
const ReportesPage        = lazy(() => import('./pages/reportes/ReportesPage'));
const SeguridadPage       = lazy(() => import('./pages/seguridad/SeguridadPage'));
/* Capa Pronóstico (§9): inteligencia de compras separada de la ejecución de OC */
const PronosticoPage      = lazy(() => import('./pages/pronostico/PronosticoPage'));
const SATPage             = lazy(() => import('./pages/sat/SATPage'));
const PosAliasesPage      = lazy(() => import('./pages/pos-aliases/PosAliasesPage'));

/* Fallback mientras carga la página solicitada */
function PageLoader() {
  return (
    <div style={{
      minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="lp-spinner" />
    </div>
  );
}

/** Ruta protegida: redirige a /login si no hay sesión */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--lp-bg-base)',
      }}>
        <div className="lp-spinner" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

/** Ruta con restricción de rol: redirige a / si el rol no está permitido */
function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />;
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

/** Redirect /stock-fabrica → /almacen?vista=fabrica PRESERVANDO el query
   (el ?tab= interno de Stock Fábrica y ?lote= siguen funcionando). */
function StockFabricaRedirect() {
  const next = new URLSearchParams(window.location.search);
  next.set('vista', 'fabrica');
  return <Navigate to={`/almacen?${next.toString()}`} replace />;
}

/** Ruta pública: redirige a / si ya hay sesión */
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

/** Catch-all inteligente para URLs desconocidas (404 dentro del SPA).
   Si el usuario teclea https://sistema.pinturaselperico.com/cualquier-cosa
   y la ruta no existe, NO mostramos pantalla de error: redirigimos
   directamente al login (si no hay sesión) o al dashboard (si la hay).
   Sin saltos intermedios visibles. */
function SmartFallback() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--lp-bg-base)',
      }}>
        <div className="lp-spinner" />
      </div>
    );
  }
  return <Navigate to={user ? '/' : '/login'} replace />;
}

/* Basename detectado en runtime para soportar despliegue bajo subruta (/sistema).
   Vite genera assets relativos al `base` configurado, pero React Router necesita
   saber el prefijo para que las rutas internas funcionen. */
const BASENAME = (() => {
  if (typeof window === 'undefined') return '/';
  /* 1) Vite expone import.meta.env.BASE_URL = el "base" usado al hacer build */
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
      const b = import.meta.env.BASE_URL.replace(/\/$/, '');
      if (b && b !== '') return b;
    }
  } catch {}
  return '/';
})();

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          {/* Sprint P (jun 2026): cola de pedidos pendientes + modal central
              para el técnico. Provider montado a este nivel para que tanto
              el Sidebar/BottomNav (badge) como el AppLayout (modal manager)
              consuman el mismo estado. Solo se activa para rol 'tecnico'. */}
          <PedidosNotifProvider>
          {/* Avisa cuando hay un deploy nuevo (evita pantalla blanca por caché vieja) */}
          <VersionChecker />
          {/* Ofrece activar notificaciones del teléfono al iniciar sesión (Web Push) */}
          <PushPrompt />
          {/* Banner in-app estilo iOS cuando llega un evento con la app abierta */}
          <PushBannerHost />
          {/* Asistente flotante: vive en todas las pantallas, busca y navega */}
          <AsistenteFlotante />
          <Routes>
            {/* Login */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

            {/* App protegida */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              {/* Fórmulas: Enrique (tecnico) excluido — ve la fórmula solo al producir.
                  La pestaña ya se oculta en Sidebar/BottomNav; aquí se cierra el acceso por URL directa.
                  AUDIT 15-jul-2026: 'compras' también fuera — su permiso formulas es
                  false (K11: IP del laboratorio) y el backend le responde 403: entrar
                  por URL directa solo le daba una pantalla de errores. */}
              <Route path="formulas"       element={<RoleRoute roles={['admin']}><ErrorBoundary><FormulasPage /></ErrorBoundary></RoleRoute>} />
              <Route path="inventario"     element={<RoleRoute roles={['admin','tecnico','compras','almacen','inventario']}><ErrorBoundary><InventarioPage /></ErrorBoundary></RoleRoute>} />
              {/* STK AMERICANO (jul 2026): vive en Inventarios > Americano Terán / Alm. 2
                  (decisión dueño 16-jul). Las rutas viejas siguen vivas como redirect
                  para links/QRs/hábitos guardados. */}
              <Route path="stk-americano"  element={<Navigate to="/inventario?tab=stkAmericano" replace />} />
              <Route path="stk-americano-2" element={<Navigate to="/inventario?tab=stkAmericano2" replace />} />
              <Route path="ordenes"        element={<RoleRoute roles={['admin','tecnico']}><ErrorBoundary><OrdenesPage /></ErrorBoundary></RoleRoute>} />
              <Route path="pedidos"        element={<RoleRoute roles={['admin','almacen','tecnico']}><ErrorBoundary><PedidosPage /></ErrorBoundary></RoleRoute>} />
              <Route path="transferencias" element={<RoleRoute roles={['admin','almacen','inventario','tecnico']}><ErrorBoundary><TransferenciasPage /></ErrorBoundary></RoleRoute>} />
              <Route path="ingresos"       element={<RoleRoute roles={['admin','tecnico','almacen']}><ErrorBoundary><IngresosPage /></ErrorBoundary></RoleRoute>} />
              <Route path="flujo"          element={<RoleRoute roles={['admin','tecnico','almacen','recolector']}><ErrorBoundary><FlujoPage /></ErrorBoundary></RoleRoute>} />
              <Route path="produccion"     element={<RoleRoute roles={['admin','tecnico']}><ErrorBoundary><ProduccionPage /></ErrorBoundary></RoleRoute>} />
              {/* P2 (21-jul-2026): ruta vieja → vista "En fábrica" de Almacén */}
              <Route path="stock-fabrica"  element={<StockFabricaRedirect />} />
              <Route path="recoleccion"    element={<RoleRoute roles={['admin','recolector','almacen']}><ErrorBoundary><RecoleccionPage /></ErrorBoundary></RoleRoute>} />
              <Route path="compras"        element={<RoleRoute roles={['admin','compras']}><ErrorBoundary><ComprasPage /></ErrorBoundary></RoleRoute>} />
              <Route path="pronostico"     element={<RoleRoute roles={['admin','compras']}><ErrorBoundary><PronosticoPage /></ErrorBoundary></RoleRoute>} />
              <Route path="sat"            element={<RoleRoute roles={['admin','compras']}><ErrorBoundary><SATPage /></ErrorBoundary></RoleRoute>} />
              <Route path="pos-aliases"    element={<RoleRoute roles={['admin','compras']}><ErrorBoundary><PosAliasesPage /></ErrorBoundary></RoleRoute>} />
              {/* P2 (21-jul-2026): 'compras' fuera — el nav nunca se la mostró
                  (perm trazabilidad no incluye compras); era pantalla fantasma
                  accesible solo por URL. Alinear ruta ↔ menú. */}
              <Route path="trazabilidad"   element={<RoleRoute roles={['admin','tecnico','almacen','recolector','inventario']}><ErrorBoundary><TrazabilidadPage /></ErrorBoundary></RoleRoute>} />
              <Route path="conteo"         element={<RoleRoute roles={['admin','inventario']}><ErrorBoundary><CycleCountPage /></ErrorBoundary></RoleRoute>} />
              {/* P2 (21-jul-2026): pantalla fusionada — tecnico entra (solo ve
                  la vista fábrica; el gate por vista vive en AlmacenPage). */}
              <Route path="almacen"        element={<RoleRoute roles={['admin','tecnico','almacen']}><ErrorBoundary><AlmacenPage /></ErrorBoundary></RoleRoute>} />
              <Route path="notificaciones" element={<Suspense fallback={<PageLoader />}><ErrorBoundary><NotificacionesPage /></ErrorBoundary></Suspense>} />
              <Route path="laboratorio"    element={<RoleRoute roles={['admin','tecnico']}><ErrorBoundary><LaboratorioPage /></ErrorBoundary></RoleRoute>} />
              <Route path="devoluciones"   element={<RoleRoute roles={['admin','compras','almacen','tecnico']}><ErrorBoundary><DevolucionesPage /></ErrorBoundary></RoleRoute>} />
              <Route path="devoluciones-mp" element={<RoleRoute roles={['admin','compras']}><ErrorBoundary><DevolucionesMPPage /></ErrorBoundary></RoleRoute>} />
              <Route path="entregas"       element={<RoleRoute roles={['admin','almacen']}><ErrorBoundary><EntregasPage /></ErrorBoundary></RoleRoute>} />
              <Route path="reportes"       element={<RoleRoute roles={['admin','inventario','compras']}><ErrorBoundary><ReportesPage /></ErrorBoundary></RoleRoute>} />
              <Route path="admin"          element={<RoleRoute roles={['admin']}><ErrorBoundary><AdminPage /></ErrorBoundary></RoleRoute>} />
              <Route path="seguridad"      element={<RoleRoute roles={['admin','tecnico','inventario','almacen']}><ErrorBoundary><SeguridadPage /></ErrorBoundary></RoleRoute>} />
            </Route>

            {/* Catch-all: URL no existe → login si no hay sesión, dashboard si sí */}
            <Route path="*" element={<SmartFallback />} />
          </Routes>
          </PedidosNotifProvider>
        </ToastProvider>
      </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
