import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setToken, clearToken, getToken, windowForRole, touchSession } from '../services/api';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

const AuthContext = createContext(null);

/* ═══════════════════════════════════════════════════════════════════
   Fix #4 — RBAC unificado: el BACKEND es la única fuente de verdad
   de permisos. Estos fallback se usan SOLO mientras /api/permisos/me
   está respondiendo o si falla la red. Cuando el backend responde, sus
   permisos reemplazan a estos.

   IMPORTANTE: admin DEBE tener permisos completos en el fallback para
   que nunca quede bloqueado si la red al server tarda. Backend además
   garantiza que admin recibe todos los permisos disponibles aunque el
   permisos_roles.json esté corrupto.
   ═══════════════════════════════════════════════════════════════════ */
const ROLE_PERMISSIONS_FALLBACK = {
  /* AUDIT 15-jul-2026: sincronizado con PERMISOS_DEFAULT de lib/permisos.js —
     el fallback no conocía `transferencias`/`ingresos`/`altaMP` para NINGÚN rol
     (ni admin): si /api/permisos/me tardaba o fallaba, Transferencias e
     Ingresos desaparecían del nav para todos. Mantener AMBOS archivos a la par. */
  admin: {
    dashboard: true, formulas: true, inventario: true, ordenes: true,
    produccion: true, envasado: true, stockFabrica: true, recoleccion: true, compras: true,
    trazabilidad: true, admin: true, cycleCount: true, reports: true,
    editarInventario: true, editarMinimos: true, editarFormulas: true,
    editarEnvases: true, configuracion: true, editarPrecios: true,
    registrarQC: true, recibirMP: true, crearPedidos: true,
    imprimirEtiquetas: true, conteoFisico: true,
    crearUsuarios: true, editarPermisos: true, eliminarMP: true,
    laboratorio: true, devoluciones: true,
    transferencias: true, ingresos: true, altaMP: true,
  },
  tecnico: {
    dashboard: true, produccion: true, ordenes: true, envasado: true, stockFabrica: true,
    inventario: true, trazabilidad: true, formulas: true,
    editarInventario: true, registrarQC: true, recibirMP: true,
    laboratorio: true, devoluciones: true,
    transferencias: true, ingresos: true, altaMP: true,
  },
  compras: {
    /* FIX jun 2026 (K11): Arely (compras) NO debe ver fórmulas — son
       propiedad intelectual del laboratorio/técnico. Antes formulas:true
       le exponía recetas exactas innecesarias para su trabajo (cotizar,
       pagar, recibir). Si necesita peso/MP de una fórmula para forecast,
       lo ve agregado en MRP sin la composición. */
    dashboard: true, compras: true, inventario: true,
    editarMinimos: true, editarPrecios: true, editarEnvases: true, reports: true,
    devoluciones: true,
    /* FIX jun 2026 (K3-c): Arely es el decisor financiero — autoriza precio,
       fechaPago, asigna proveedor — también cierra el ciclo recibiendo.
       Antes solo admin+tecnico tenían recibirMP → Arely dependía de otro
       para recibir físicamente. */
    recibirMP: true,
    altaMP: true,
  },
  almacen: {
    dashboard: true, ordenes: true, envasado: true, stockFabrica: true, recoleccion: true,
    trazabilidad: true, inventario: true,
    crearPedidos: true, imprimirEtiquetas: true,
    devoluciones: true,
    transferencias: true, ingresos: true,
  },
  recolector: {
    dashboard: true, recoleccion: true, trazabilidad: true,
  },
  inventario: {
    dashboard: true, inventario: true, cycleCount: true,
    /* Decisión del dueño (jun 2026): el rol inventario (Burgos) gestiona el
       inventario — importar, editar mínimos y ajustar existencias. El guardado de
       existencias/mínimos sigue protegido por el candado (TOTP/código admin/conteo).
       (Este es solo el fallback offline; la verdad la da /api/permisos/me.) */
    editarInventario: true,
    editarMinimos: true,
    conteoFisico: true,
    transferencias: true, altaMP: true,
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  /* permisosEfectivos = permisos del rol actual SEGÚN EL BACKEND.
     Inicializa con fallback offline; se reemplaza al login con la respuesta real. */
  const [permisosEfectivos, setPermisosEfectivos] = useState({});
  const [permisosRoles, setPermisosRoles] = useState(ROLE_PERMISSIONS_FALLBACK);
  const [permisosOrigen, setPermisosOrigen] = useState('fallback'); /* 'fallback' | 'backend' */

  const recargarPermisos = useCallback(async () => {
    /* Intenta primero el endpoint personal /me (rápido, sólo lo del usuario).
       Si falla, intenta /roles (compatibilidad). */
    try {
      const me = await api.getMisPermisos();
      if (me?.ok && me.permisos) {
        setPermisosEfectivos(me.permisos);
        setPermisosOrigen('backend');
        /* También guardamos la matriz completa si admin la pide */
        try {
          const all = await api.getPermisosRoles();
          if (all?.ok && all.data) setPermisosRoles(all.data);
        } catch { /* opcional */ }
        return;
      }
    } catch { /* fallback abajo */ }
    /* Fallback: defaults solo para que la UI no se quede congelada */
    setPermisosOrigen('fallback');
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    api.validate()
      .then(res => {
        if (res.ok && res.user) {
          setUser(res.user);
          touchSession(); /* sesión restaurada dentro de la ventana → deslizarla */
          recargarPermisos();
        } else clearToken();
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, [recargarPermisos]);

  /* Mantener viva la sesión mientras la app está abierta: desliza la ventana de
     inactividad. Si vuelves del segundo plano dentro de la ventana, sigue válida;
     si venció estando cerrada, getToken ya devolvió '' y verás el login (solo PIN). */
  useEffect(() => {
    if (!user) return undefined;
    touchSession();
    const onVis = () => { if (document.visibilityState === 'visible') touchSession(); };
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(() => { if (document.visibilityState === 'visible') touchSession(); }, 120000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(id); };
  }, [user]);

  const login = useCallback(async (nombre, pin) => {
    const res = await api.login(nombre, pin);
    if (res.ok && res.token) {
      /* Ventana de sesión por rol: técnico (Enrique) 12 h, resto 30 min. */
      setToken(res.token, windowForRole(res.user?.rol));
      setUser(res.user);
      recargarPermisos();
      return res;
    }
    throw new Error(res.msg || res.error || 'Error de login');
  }, [recargarPermisos]);

  const logout = useCallback(async () => {
    await api.logout();
    clearToken();
    setUser(null);
  }, []);

  /* can() es la única función que el frontend usa para gating de UI.
     Prioriza permisosEfectivos (backend dice qué puede hacer ESTE usuario).
     Si no hay backend response, usa fallback solo para no romper la UI. */
  const can = useCallback((perm) => {
    if (!user) return false;
    /* 1) Prioritizar lo que dijo el backend (verdad absoluta) */
    if (permisosOrigen === 'backend' && Object.keys(permisosEfectivos).length > 0) {
      return !!permisosEfectivos[perm];
    }
    /* 2) Fallback: matriz general por rol (puede haber drift, no confiable) */
    const perms = permisosRoles[user.rol];
    return perms ? !!perms[perm] : false;
  }, [user, permisosEfectivos, permisosRoles, permisosOrigen]);

  /* Realtime: recargar permisos cuando cambian en otro cliente */
  const { connected: wsConnected } = useRealtimeSync({
    onPermisos: () => { recargarPermisos(); },
  });

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, permisosRoles, permisosEfectivos, permisosOrigen, recargarPermisos, wsConnected }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
