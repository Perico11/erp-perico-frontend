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

  it('métodos GET mandan paths correctos', async () => {
    /* Los wrappers v2 (getMPv2/getFormulasV2 → /api/mp/v2, /api/formulas/v2)
       eran del SPA legacy (static/modules/formulas_v2.js). El cliente React
       consolidó MP/fórmulas en el maestro: getMaestroMP → /api/maestro-mp y
       getFormulas → /api/formulas/todas. Verificamos esos paths canónicos. */
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    await api.getMaestroMP();
    expect(global.fetch).toHaveBeenCalledWith('/api/maestro-mp', expect.anything());
    await api.getFormulas();
    expect(global.fetch).toHaveBeenCalledWith('/api/formulas/todas', expect.anything());
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
