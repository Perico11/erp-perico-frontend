import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import UsuariosPanel from '../pages/admin/UsuariosPanel';

vi.mock('../services/api', () => ({
  default: {
    getUsuarios: vi.fn(() => Promise.resolve({
      ok: true,
      data: [
        { id: 'emm', nombre: 'Emmanuel', apellido: 'Glez', rol: 'admin' },
        { id: 'enr', nombre: 'Enrique', apellido: '', rol: 'tecnico' },
        { id: 'are', nombre: 'Arely', apellido: '', rol: 'compras' },
      ],
      roles: ['admin', 'tecnico', 'compras', 'almacen', 'inventario', 'recolector'],
    })),
    getPermisosRoles: vi.fn(() => Promise.resolve({
      ok: true,
      data: { admin: { admin: true }, tecnico: { dashboard: true } },
      disponibles: ['admin', 'dashboard', 'compras'],
      rolesValidos: ['admin', 'tecnico', 'compras', 'almacen', 'inventario', 'recolector'],
    })),
    crearUsuario: vi.fn(() => Promise.resolve({ ok: true })),
    editarUsuario: vi.fn(() => Promise.resolve({ ok: true })),
    cambiarPin: vi.fn(() => Promise.resolve({ ok: true })),
    eliminarUsuario: vi.fn(() => Promise.resolve({ ok: true })),
    setPermisosRol: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    can: (perm) => ['crearUsuarios', 'editarPermisos'].includes(perm),
    recargarPermisos: vi.fn(),
    permisosRoles: { admin: { admin: true }, tecnico: { dashboard: true } },
  }),
}));

describe('UsuariosPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza KPIs y lista de usuarios', async () => {
    render(<MemoryRouter><UsuariosPanel /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Total usuarios')).toBeInTheDocument();
    });
    expect(screen.getByText('Emmanuel Glez')).toBeInTheDocument();
    expect(screen.getByText('Enrique')).toBeInTheDocument();
    expect(screen.getByText('Arely')).toBeInTheDocument();
  });

  it('muestra botón "+ Crear usuario" si tiene permiso crearUsuarios', async () => {
    render(<MemoryRouter><UsuariosPanel /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('+ Crear usuario')).toBeInTheDocument();
    });
  });

  it('filtra usuarios por búsqueda', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><UsuariosPanel /></MemoryRouter>);
    await waitFor(() => screen.getByText('Emmanuel Glez'));

    const input = screen.getByPlaceholderText(/Buscar/i);
    await user.type(input, 'enrique');

    await waitFor(() => {
      expect(screen.getByText('Enrique')).toBeInTheDocument();
      expect(screen.queryByText('Emmanuel Glez')).not.toBeInTheDocument();
    });
  });

  it('botón Eliminar NO aparece para admin', async () => {
    render(<MemoryRouter><UsuariosPanel /></MemoryRouter>);
    await waitFor(() => screen.getByText('Emmanuel Glez'));

    /* Admin Emmanuel no debe tener botón Eliminar (regla del backend) */
    const adminRow = screen.getByText('Emmanuel Glez').closest('div').parentElement;
    expect(adminRow).not.toHaveTextContent('Eliminar');
  });

  it('muestra sección "Permisos por rol" si tiene editarPermisos', async () => {
    render(<MemoryRouter><UsuariosPanel /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Permisos por rol')).toBeInTheDocument();
    });
  });
});
