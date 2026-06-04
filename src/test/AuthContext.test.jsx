import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

vi.mock('../services/api', () => ({
  default: {
    login: vi.fn(),
    logout: vi.fn(() => Promise.resolve()),
    validate: vi.fn(),
    getPermisosRoles: vi.fn(() => Promise.resolve({
      ok: true,
      data: {
        admin: { admin: true, dashboard: true, editarPermisos: true },
        tecnico: { dashboard: true, produccion: true, registrarQC: true },
      },
    })),
  },
  setToken: vi.fn(),
  clearToken: vi.fn(),
  getToken: vi.fn(() => null),
}));

function TestComponent() {
  const { user, can, loading } = useAuth();
  if (loading) return <div>loading</div>;
  if (!user) return <div>no-user</div>;
  return (
    <div>
      <span data-testid="rol">{user.rol}</span>
      <span data-testid="can-admin">{can('admin') ? 'yes' : 'no'}</span>
      <span data-testid="can-prod">{can('produccion') ? 'yes' : 'no'}</span>
      <span data-testid="can-edit-permisos">{can('editarPermisos') ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inicialmente sin user retorna no-user', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByText('no-user')).toBeInTheDocument();
    });
  });

  it('can() retorna false sin usuario', () => {
    let capturedCan;
    function Capture() {
      const { can } = useAuth();
      capturedCan = can;
      return null;
    }
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>
    );
    expect(capturedCan('admin')).toBe(false);
    expect(capturedCan('produccion')).toBe(false);
  });
});
