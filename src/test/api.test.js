import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { setToken, clearToken, getToken } from '../services/api';

describe('api service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearToken();
    global.fetch = vi.fn();
  });

  it('setToken/getToken/clearToken funcionan', () => {
    expect(getToken()).toBe('');
    setToken('abc123');
    expect(getToken()).toBe('abc123');
    clearToken();
    expect(getToken()).toBe('');
  });

  it('login envía POST a /api/login con credenciales', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, token: 'tk', user: { id: 'emm', nombre: 'Emmanuel', rol: 'admin' } }),
    });
    const result = await api.login('Emmanuel', '1106');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ nombre: 'Emmanuel', pin: '1106' }),
      })
    );
    expect(result.ok).toBe(true);
    expect(result.user.rol).toBe('admin');
  });

  it('métodos v2 mandan paths correctos', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    await api.getMPv2();
    expect(global.fetch).toHaveBeenCalledWith('/api/mp/v2', expect.anything());
    await api.getFormulasV2();
    expect(global.fetch).toHaveBeenCalledWith('/api/formulas/v2', expect.anything());
  });

  it('createOC manda POST con data', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, id: 'OC-123' }),
    });
    const data = { proveedor: 'NASEDA', items: [{ mp: 'W-5916', kg: 100 }] };
    await api.createOC(data);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/compras/oc',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(data),
      })
    );
  });

  it('endpoint con error tira excepción', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ ok: false, error: 'Sin permisos' }),
    });
    await expect(api.getUsuarios()).rejects.toThrow('Sin permisos');
  });

  it('eliminarMP recibe forzar=true correctamente', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    await api.eliminarMP('W-407', true);
    const call = global.fetch.mock.calls[0];
    expect(call[0]).toBe('/api/mp/eliminar');
    expect(JSON.parse(call[1].body)).toEqual({ mp: 'W-407', forzar: true });
  });
});
