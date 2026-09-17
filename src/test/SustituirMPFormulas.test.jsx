/* ════════════════════════════════════════════════════════════════════════════
   "Sustituir materia prima" en Fórmulas (17-sep-2026, pedido dueño: "que si
   tengo TEXANOL poder sustituirlo por otra y se refleje en todas las fórmulas
   que están cargadas con ese material").

   El botón ya existía, pero escondido en Inventarios ▸ MP ▸ Maestro ▸ menú ⋯,
   y allá además da de baja la original. Aquí vive donde se piensa el problema
   y sólo cambia las recetas.

   Lo que se ancla: que la lista de MPs salga de las fórmulas CARGADAS (con en
   cuántas está cada una), que NO se pueda aplicar sin haber visto antes qué
   cambia, que la fusión se enseñe como suma, y que tocar los campos después de
   ver la vista previa la invalide — lo que se vio ya no sería lo que pasa.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent, waitFor } from '@testing-library/react';

const PREVIEW = {
  ok: true, preview: true, mpOriginal: 'TEXANOL', mpSustituta: 'DOWANOL',
  total: 2, fusiones: 1,
  cambios: [
    { formula: 'BLANCO MATE 4.0', antes: 5, yaTenia: 0, despues: 5, fusion: false },
    { formula: 'VERDE CON LAS DOS', antes: 5, yaTenia: 3, despues: 8, fusion: true },
  ],
};

vi.mock('../services/api', () => {
  const declarados = {
    sustituirMpEnFormulas: vi.fn((o, s, aplicar) => Promise.resolve(
      aplicar ? { ok: true, aplicado: true, total: 2, fusiones: 1, cambios: PREVIEW.cambios } : PREVIEW,
    )),
    getInventario: vi.fn(() => Promise.resolve({ ok: true, data: { mp: { DOWANOL: { qty: 12 }, TEXANOL: { qty: 240 }, AGUA: { qty: 900 } } } })),
  };
  const vacio = vi.fn(() => Promise.resolve({ ok: true, data: [] }));
  return { default: new Proxy(declarados, { get: (t, k) => (typeof k !== 'string' || k in t ? t[k] : vacio) }) };
});

import api from '../services/api';
import SustituirMPModal from '../pages/formulas/SustituirMPModal';

/* Los estilos reales de la página son irrelevantes para la conducta. */
const S = new Proxy({}, { get: () => ({}) });
const FORMULAS = {
  'BLANCO MATE 4.0': { ingredientes: [{ nombre: 'AGUA', kg19: 10 }, { nombre: 'TEXANOL', kg19: 5 }] },
  'VERDE CON LAS DOS': { ingredientes: [{ nombre: 'TEXANOL', kg19: 5 }, { nombre: 'DOWANOL', kg19: 3 }] },
  'AZUL SIN TEXANOL': { ingredientes: [{ nombre: 'AGUA', kg19: 1 }] },
};

const abrir = async (props = {}) => {
  await act(async () => {
    render(<SustituirMPModal S={S} formulas={FORMULAS} onClose={() => {}} onDone={() => {}} {...props} />);
  });
  await act(async () => { await Promise.resolve(); });
};
const sel = (id) => document.querySelector(`[data-id="formulas.sustituir.${id}"]`);
const elegir = async (original, sustituta) => {
  await act(async () => { fireEvent.change(sel('original'), { target: { value: original } }); });
  await act(async () => { fireEvent.change(sel('sustituta'), { target: { value: sustituta } }); });
};

describe('Sustituir materia prima en las fórmulas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('la lista sale de las fórmulas cargadas, con en cuántas está cada MP', async () => {
    await abrir();
    const opciones = [...sel('original').querySelectorAll('option')].map(o => o.textContent);
    expect(opciones.some(t => /TEXANOL — en 2 fórmulas/.test(t))).toBe(true);
    expect(opciones.some(t => /DOWANOL — en 1 fórmula$/.test(t))).toBe(true);
    expect(opciones.some(t => /AGUA — en 2 fórmulas/.test(t))).toBe(true);
  });

  it('no se puede aplicar sin ver antes qué cambia', async () => {
    await abrir();
    expect(sel('aplicar')).toBeFalsy();
    await elegir('TEXANOL', 'DOWANOL');
    expect(sel('aplicar')).toBeFalsy();
    expect(sel('ver').disabled).toBe(false);
  });

  it('la vista previa enseña cada fórmula, y la fusión como suma', async () => {
    await abrir();
    await elegir('TEXANOL', 'DOWANOL');
    await act(async () => { fireEvent.click(sel('ver')); });
    await waitFor(() => expect(sel('preview')).toBeTruthy());
    /* se consultó SIN aplicar */
    expect(api.sustituirMpEnFormulas).toHaveBeenCalledWith('TEXANOL', 'DOWANOL', false);
    const filas = [...document.querySelectorAll('[data-id="formulas.sustituir.cambio"]')];
    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toMatch(/BLANCO MATE 4\.0/);
    expect(filas[1].textContent).toMatch(/5 \+ 3 → 8 kg/);
    expect(sel('preview').textContent).toMatch(/1 con renglones que se fusionan/);
  });

  it('aplicar manda aplicar=true y avisa cuántas fórmulas cambiaron', async () => {
    const onDone = vi.fn(); const onClose = vi.fn();
    await abrir({ onDone, onClose });
    await elegir('TEXANOL', 'DOWANOL');
    await act(async () => { fireEvent.click(sel('ver')); });
    await waitFor(() => expect(sel('aplicar')).toBeTruthy());
    expect(sel('aplicar').textContent).toMatch(/Sustituir en 2 fórmulas/);
    await act(async () => { fireEvent.click(sel('aplicar')); });
    expect(api.sustituirMpEnFormulas).toHaveBeenLastCalledWith('TEXANOL', 'DOWANOL', true);
    expect(onDone).toHaveBeenCalledWith(expect.stringMatching(/2 fórmulas actualizadas.*2 con renglones|2 fórmulas actualizadas/));
    expect(onClose).toHaveBeenCalled();
  });

  it('cambiar una MP después de ver la vista previa la invalida', async () => {
    await abrir();
    await elegir('TEXANOL', 'DOWANOL');
    await act(async () => { fireEvent.click(sel('ver')); });
    await waitFor(() => expect(sel('aplicar')).toBeTruthy());
    await act(async () => { fireEvent.change(sel('sustituta'), { target: { value: 'AGUA' } }); });
    expect(sel('preview')).toBeFalsy();
    expect(sel('aplicar')).toBeFalsy();
    expect(sel('ver')).toBeTruthy();
  });

  it('la sustituta se busca en el INVENTARIO: una receta no debe pedir algo que no existe', async () => {
    await abrir();
    await waitFor(() => expect(api.getInventario).toHaveBeenCalled());
    const opts = [...document.querySelectorAll('#mps-sustitutas option')].map(o => o.value);
    expect(opts).toContain('DOWANOL');
    expect(opts).toContain('AGUA');
  });

  it('dice que la original NO se elimina — es lo que la distingue del botón viejo', async () => {
    await abrir();
    expect(document.body.textContent).toMatch(/no se elimina/i);
    expect(document.body.textContent).toMatch(/suman en un solo renglón/i);
  });

  it('si ninguna fórmula la usa, lo dice y no ofrece aplicar', async () => {
    api.sustituirMpEnFormulas.mockResolvedValueOnce({ ok: true, preview: true, mpOriginal: 'AGUA', mpSustituta: 'DOWANOL', total: 0, fusiones: 0, cambios: [] });
    await abrir();
    await elegir('AGUA', 'DOWANOL');
    await act(async () => { fireEvent.click(sel('ver')); });
    await waitFor(() => expect(sel('preview')).toBeTruthy());
    expect(sel('preview').textContent).toMatch(/No hay nada que cambiar/);
    expect(sel('aplicar')).toBeFalsy();
  });

  it('un error del servidor se ve y no cierra la ventana', async () => {
    api.sustituirMpEnFormulas.mockRejectedValueOnce({ data: { error: 'Solo admin' } });
    const onClose = vi.fn();
    await abrir({ onClose });
    await elegir('TEXANOL', 'DOWANOL');
    await act(async () => { fireEvent.click(sel('ver')); });
    await waitFor(() => expect(sel('error')).toBeTruthy());
    expect(sel('error').textContent).toMatch(/Solo admin/);
    expect(onClose).not.toHaveBeenCalled();
  });
});
