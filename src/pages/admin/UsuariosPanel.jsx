import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const S = {
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 200, padding: '10px 14px',
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 13, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    outline: 'none', boxSizing: 'border-box',
  },
  btnPrimary: {
    padding: '10px 16px', fontSize: 12, fontWeight: 700,
    borderRadius: 'var(--lp-radius-sm)', border: 'none',
    background: 'var(--lp-brand-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  },
  btnGhost: {
    padding: '8px 14px', fontSize: 11, fontWeight: 600,
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-raised)', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)',
  },
  btnDanger: {
    padding: '8px 14px', fontSize: 11, fontWeight: 600,
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-danger-500)',
    background: 'var(--lp-danger-50)', color: 'var(--lp-danger-700)',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
  },
  metric: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12, marginBottom: 16,
  },
  metricCard: {
    background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
    padding: 14, textAlign: 'center',
  },
  metricVal: {
    fontSize: 24, fontWeight: 800,
    color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)',
  },
  metricLabel: {
    fontSize: 11, color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, fontWeight: 600,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'grid', gridTemplateColumns: '40px 1fr auto auto', gap: 12, alignItems: 'center',
    padding: '10px 12px', background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
  },
  avatar: (color) => ({
    width: 40, height: 40, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: color, color: '#fff', fontSize: 14, fontWeight: 700,
  }),
  info: { minWidth: 0 },
  name: { fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)' },
  meta: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 },
  badge: (bg, fg) => ({
    display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700,
    borderRadius: 4, background: bg, color: fg,
    textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  loading: { textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
  err: {
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    padding: 10, borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 12,
  },
  /* Modal */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(26,24,21,.5)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)', padding: 0,
    maxWidth: 560, width: '100%', maxHeight: '92vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  modalHeader: {
    padding: '14px 18px', borderBottom: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)' },
  modalClose: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: 22, color: 'var(--lp-text-tertiary)', padding: 4, lineHeight: 1,
  },
  modalBody: { padding: 16, overflowY: 'auto', flex: 1 },
  modalFooter: {
    padding: '12px 16px', borderTop: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', gap: 8, justifyContent: 'flex-end',
  },
  field: { marginBottom: 14 },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--lp-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6,
  },
  input: {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 13, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 13, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    boxSizing: 'border-box',
  },
  errInline: {
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    padding: '8px 10px', borderRadius: 'var(--lp-radius-sm)', fontSize: 11, marginBottom: 10,
  },
};

const ROL_BADGES = {
  admin:      { bg: 'var(--lp-brand-100)',   fg: 'var(--lp-brand-700)',   avatar: 'var(--lp-brand-600)' },
  compras:    { bg: 'var(--lp-info-50)',     fg: 'var(--lp-info-600)',    avatar: 'var(--lp-info-600)' },
  almacen:    { bg: 'var(--lp-success-50)',  fg: 'var(--lp-success-700)', avatar: 'var(--lp-success-600)' },
  inventario: { bg: 'var(--lp-success-50)',  fg: 'var(--lp-success-700)', avatar: 'var(--lp-success-500)' },
  tecnico:    { bg: 'var(--lp-warning-50)',  fg: 'var(--lp-warning-700)', avatar: 'var(--lp-warning-600)' },
  recolector: { bg: 'var(--lp-bg-sunken)',   fg: 'var(--lp-text-secondary)', avatar: 'var(--lp-text-secondary)' },
};
const rolStyle = (rol) => ROL_BADGES[rol] || { bg: 'var(--lp-bg-sunken)', fg: 'var(--lp-text-secondary)', avatar: 'var(--lp-text-secondary)' };

/* ────────── MODAL: CREAR / EDITAR USUARIO ────────── */
function UserFormModal({ user, roles, onClose, onSaved }) {
  const isEdit = !!user;
  const [id, setId] = useState(user?.id || '');
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [apellido, setApellido] = useState(user?.apellido || '');
  const [pin, setPin] = useState('');
  const [rol, setRol] = useState(user?.rol || (roles[0] || 'tecnico'));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const guardar = async () => {
    setErr('');
    if (!isEdit) {
      if (!/^[a-z0-9_-]{2,20}$/.test(id)) return setErr('ID: 2-20 caracteres alfanuméricos minúsculas');
      if (!/^[0-9]{4}$/.test(pin)) return setErr('PIN: 4 dígitos numéricos');
      if (!nombre.trim()) return setErr('Nombre requerido');
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.editarUsuario(user.id, nombre.trim(), apellido.trim(), rol);
      } else {
        await api.crearUsuario(id, nombre.trim(), apellido.trim(), pin, rol);
      }
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <div style={S.modalTitle}>{isEdit ? 'Editar usuario' : 'Crear usuario'}</div>
          <button style={S.modalClose} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.modalBody}>
          {err && <div style={S.errInline}>{err}</div>}
          <div style={S.field}>
            <label style={S.label}>ID (login)</label>
            <input
              style={{ ...S.input, opacity: isEdit ? 0.5 : 1 }}
              value={id}
              onChange={(e) => setId(e.target.value.toLowerCase())}
              disabled={isEdit}
              placeholder="ej: enrique"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={S.field}>
              <label style={S.label}>Nombre</label>
              <input style={S.input} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Apellido</label>
              <input style={S.input} value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
          </div>
          <div style={S.field}>
            <label style={S.label}>Rol</label>
            <select style={S.select} value={rol} onChange={(e) => setRol(e.target.value)}>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {!isEdit && (
            <div style={S.field}>
              <label style={S.label}>PIN inicial (4 dígitos)</label>
              <input
                style={S.input} type="password" maxLength={4}
                value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
              />
            </div>
          )}
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnGhost} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btnPrimary} onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear usuario')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────── MODAL: CAMBIAR PIN ────────── */
function PinModal({ user, onClose, onSaved }) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const guardar = async () => {
    setErr('');
    if (!/^[0-9]{4}$/.test(pin)) return setErr('PIN: 4 dígitos numéricos');
    if (pin !== pin2) return setErr('Los PINs no coinciden');
    setSaving(true);
    try {
      await api.cambiarPin(user.id, pin);
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e.message || 'Error al cambiar PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: 400 }}>
        <div style={S.modalHeader}>
          <div style={S.modalTitle}>Cambiar PIN · {user.nombre}</div>
          <button style={S.modalClose} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.modalBody}>
          {err && <div style={S.errInline}>{err}</div>}
          <div style={S.field}>
            <label style={S.label}>Nuevo PIN</label>
            <input
              style={S.input} type="password" maxLength={4}
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="0000" autoFocus
            />
          </div>
          <div style={S.field}>
            <label style={S.label}>Confirmar PIN</label>
            <input
              style={S.input} type="password" maxLength={4}
              value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
            />
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnGhost} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btnPrimary} onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : 'Cambiar PIN'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────── MODAL: PERMISOS GRANULARES POR ROL ────────── */
function PermisosRolModal({ rol, permisosActuales, disponibles, onClose, onSaved }) {
  const [perms, setPerms] = useState({ ...(permisosActuales || {}) });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const grupos = useMemo(() => ({
    'Pantallas': ['dashboard', 'formulas', 'inventario', 'ordenes', 'produccion', 'envasado', 'stockFabrica', 'recoleccion', 'compras', 'trazabilidad', 'admin', 'cycleCount', 'reports'],
    'Acciones inventario': ['editarInventario', 'editarMinimos', 'recibirMP', 'conteoFisico', 'eliminarMP'],
    'Acciones fórmulas y costos': ['editarFormulas', 'editarPrecios', 'editarEnvases'],
    'Acciones operación': ['registrarQC', 'crearPedidos', 'imprimirEtiquetas'],
    'Configuración y admin': ['configuracion', 'crearUsuarios', 'editarPermisos'],
  }), []);

  const toggle = (p) => setPerms(prev => ({ ...prev, [p]: !prev[p] }));

  const guardar = async () => {
    setErr('');
    setSaving(true);
    try {
      await api.setPermisosRol(rol, perms);
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const totalActivos = Object.values(perms).filter(Boolean).length;
  const totalDisponibles = (disponibles || []).length;

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: 640 }}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>Permisos del rol · {rol}</div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
              {totalActivos} de {totalDisponibles} activos
            </div>
          </div>
          <button style={S.modalClose} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.modalBody}>
          {err && <div style={S.errInline}>{err}</div>}
          {Object.entries(grupos).map(([grupo, lista]) => (
            <div key={grupo} style={{ marginBottom: 16 }}>
              <div style={{ ...S.label, marginBottom: 8 }}>{grupo}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {lista.filter(p => disponibles.includes(p)).map(p => (
                  <label key={p} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px',
                    background: perms[p] ? 'var(--lp-brand-50)' : 'var(--lp-bg-sunken)',
                    border: '1.5px solid ' + (perms[p] ? 'var(--lp-brand-200)' : 'transparent'),
                    borderRadius: 'var(--lp-radius-sm)',
                    cursor: 'pointer', fontSize: 12,
                  }}>
                    <input
                      type="checkbox"
                      checked={!!perms[p]}
                      onChange={() => toggle(p)}
                      style={{ accentColor: 'var(--lp-brand-600)', width: 14, height: 14 }}
                    />
                    <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11 }}>{p}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {rol === 'admin' && (
            <div style={{
              padding: '8px 10px', background: 'var(--lp-warning-50)',
              borderRadius: 'var(--lp-radius-sm)', fontSize: 11, color: 'var(--lp-warning-700)',
            }}>
              El rol admin no puede perder el permiso "admin" (auto-lock).
            </div>
          )}
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnGhost} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btnPrimary} onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar permisos'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────── MODAL: CONFIRMAR ELIMINAR ────────── */
function ConfirmDelete({ user, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const eliminar = async () => {
    setSaving(true);
    setErr('');
    try {
      await api.eliminarUsuario(user.id);
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e.message || 'Error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: 400 }}>
        <div style={S.modalHeader}>
          <div style={S.modalTitle}>Eliminar usuario</div>
          <button style={S.modalClose} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.modalBody}>
          {err && <div style={S.errInline}>{err}</div>}
          <div style={{
            padding: 10, background: 'var(--lp-danger-100)',
            borderRadius: 'var(--lp-radius-sm)', fontSize: 12,
            color: 'var(--lp-danger-700)', lineHeight: 1.6,
          }}>
            ¿Eliminar a <strong>{user.nombre}</strong> ({user.id})? Esta acción es irreversible.
            Las sesiones activas se cerrarán.
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnGhost} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btnDanger} onClick={eliminar} disabled={saving}>
            {saving ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────── PANEL PRINCIPAL ────────── */
export default function UsuariosPanel() {
  const { can, recargarPermisos, permisosRoles } = useAuth();
  const [list, setList] = useState([]);
  const [roles, setRoles] = useState(['admin', 'tecnico', 'compras', 'almacen', 'recolector', 'inventario']);
  const [permisosDisponibles, setPermisosDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filterRol, setFilterRol] = useState('todos');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [pinUser, setPinUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [editPermsRol, setEditPermsRol] = useState(null);

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getUsuarios(),
      api.getPermisosRoles(),
    ])
      .then(([uRes, pRes]) => {
        const arr = Array.isArray(uRes) ? uRes : (uRes.data || []);
        setList(arr);
        if (uRes.roles && Array.isArray(uRes.roles)) setRoles(uRes.roles);
        if (pRes.disponibles) setPermisosDisponibles(pRes.disponibles);
        if (pRes.rolesValidos) setRoles(pRes.rolesValidos);
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleSaved = () => {
    cargar();
    recargarPermisos();
  };

  const filtrados = useMemo(() => {
    let arr = [...list];
    if (filterRol !== 'todos') arr = arr.filter(u => u.rol === filterRol);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(u =>
        (u.nombre || '').toLowerCase().includes(q) ||
        (u.id || '').toLowerCase().includes(q) ||
        (u.rol || '').toLowerCase().includes(q),
      );
    }
    return arr.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [list, filterRol, search]);

  if (loading) return <div style={S.loading}>Cargando usuarios...</div>;

  return (
    <div>
      {err && <div style={S.err}>{err}</div>}

      <div style={S.metric}>
        <div style={S.metricCard}>
          <div style={S.metricVal}>{list.length}</div>
          <div style={S.metricLabel}>Total usuarios</div>
        </div>
        <div style={S.metricCard}>
          <div style={S.metricVal}>{list.filter(u => u.rol === 'admin').length}</div>
          <div style={S.metricLabel}>Administradores</div>
        </div>
        <div style={S.metricCard}>
          <div style={S.metricVal}>{roles.length}</div>
          <div style={S.metricLabel}>Roles definidos</div>
        </div>
      </div>

      <div style={S.toolbar}>
        <input
          style={S.search}
          type="text"
          placeholder="Buscar por nombre, ID o rol..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={{ ...S.select, maxWidth: 180, padding: '8px 12px' }}
          value={filterRol}
          onChange={(e) => setFilterRol(e.target.value)}
        >
          <option value="todos">Todos los roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {can('crearUsuarios') && (
          <button style={S.btnPrimary} onClick={() => setShowCreate(true)}>
            + Crear usuario
          </button>
        )}
      </div>

      <div style={S.list}>
        {filtrados.map(u => {
          const rs = rolStyle(u.rol);
          return (
            <div key={u.id} style={S.row}>
              <div style={S.avatar(rs.avatar)}>
                {(u.nombre || '?').charAt(0).toUpperCase()}
              </div>
              <div style={S.info}>
                <div style={S.name}>
                  {u.nombre} {u.apellido}
                </div>
                <div style={S.meta}>ID: {u.id}</div>
              </div>
              <span style={S.badge(rs.bg, rs.fg)}>{u.rol}</span>
              <div style={S.actions}>
                <button style={S.btnGhost} onClick={() => setEditUser(u)}>Editar</button>
                <button style={S.btnGhost} onClick={() => setPinUser(u)}>PIN</button>
                {u.rol !== 'admin' && (
                  <button style={S.btnDanger} onClick={() => setDeleteUser(u)}>Eliminar</button>
                )}
              </div>
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div style={S.loading}>Sin usuarios que coincidan</div>
        )}
      </div>

      {can('editarPermisos') && (
        <div style={{ marginTop: 24 }}>
          <div style={{ ...S.label, marginBottom: 8 }}>Permisos por rol</div>
          <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginBottom: 10, lineHeight: 1.6 }}>
            Edita qué pantallas y acciones tiene cada rol. Si das más permisos, los usuarios de ese rol verán más botones al refrescar.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {roles.map(r => {
              const rs = rolStyle(r);
              const totalPerms = Object.values(permisosRoles[r] || {}).filter(Boolean).length;
              return (
                <button
                  key={r}
                  style={{
                    ...S.btnGhost,
                    textAlign: 'left',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 4,
                  }}
                  onClick={() => setEditPermsRol(r)}
                >
                  <span style={{ ...S.badge(rs.bg, rs.fg) }}>{r}</span>
                  <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                    {totalPerms} permisos activos
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showCreate && (
        <UserFormModal roles={roles} onClose={() => setShowCreate(false)} onSaved={handleSaved} />
      )}
      {editUser && (
        <UserFormModal user={editUser} roles={roles} onClose={() => setEditUser(null)} onSaved={handleSaved} />
      )}
      {pinUser && (
        <PinModal user={pinUser} onClose={() => setPinUser(null)} onSaved={handleSaved} />
      )}
      {deleteUser && (
        <ConfirmDelete user={deleteUser} onClose={() => setDeleteUser(null)} onSaved={handleSaved} />
      )}
      {editPermsRol && (
        <PermisosRolModal
          rol={editPermsRol}
          permisosActuales={permisosRoles[editPermsRol] || {}}
          disponibles={permisosDisponibles}
          onClose={() => setEditPermsRol(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
