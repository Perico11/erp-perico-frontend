/* Entregas — botón "Envases" en Nueva entrega (2-sep-2026, pedido dueño).
   "Agregues envases y lo conectes con inventario de envases, para mandar
   también envases a las tiendas." Estos tests anclan que:
     · el cuarto origen lista los envases (y tapas) CON stock de Terán — las
       entregas salen del CEDIS, el stock de Fábrica no se ofrece;
     · la línea viaja al backend con su key (y tapa:true), presentación pieza;
     · el tope es el stock de Terán del envase, con mensaje claro. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/api', () => ({
  default: {
    getStkAmericano: vi.fn(() => Promise.resolve({ data: { colores: [] } })),
    getPTPorUbicacion: vi.fn(() => Promise.resolve({ teran: {} })),
    getEnvases: vi.fn(() => Promise.resolve({
      ok: true,
      data: {
        categorias: {
          cubetas: {
            nombre: 'Cubetas', capacidad_ml: 19000,
            subcategorias: {
              cub19: { nombre: 'Cubeta 19 L', stock: 50, teran: 30 },
              /* Sólo Fábrica: NO debe ofrecerse — las entregas salen de Terán. */
              cub4: { nombre: 'Cubeta 4 L', stock: 80, teran: 0 },
            },
          },
        },
        tapas: { tapa19: { nombre: 'Tapa 19 L', stock: 40, teran: 12 } },
      },
    })),
    crearEntrega: vi.fn(() => Promise.resolve({ ok: true, entrega: { folio: 'ENT-20260902-001' } })),
    editarEntrega: vi.fn(() => Promise.resolve({ ok: true, entrega: {} })),
  },
}));
vi.mock('../hooks/useBodyScrollLock', () => ({ default: () => {} }));

import api from '../services/api';
import { NuevaEntregaSheet } from '../pages/entregas/EntregasPage';

const TIENDAS = ['PALACO'];

const abrirEnvases = async () => {
  await act(async () => { render(<NuevaEntregaSheet isDesktop tiendasPrev={TIENDAS} onClose={() => {}} onDone={() => {}} />); });
  await userEvent.click(document.querySelector('[data-id="entregas.fuente.envases"]'));
};

describe('Nueva entrega · fuente Envases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el cuarto botón existe y lista sólo envases (y tapas) con stock en Terán', async () => {
    await abrirEnvases();
    const sel = document.querySelector('[data-id="entregas.select.producto"]');
    const textos = [...sel.querySelectorAll('option')].map(o => o.textContent);
    expect(textos.some(t => t.includes('Cubeta 19 L') && t.includes('30'))).toBe(true);
    expect(textos.some(t => t.includes('Tapa 19 L — tapa') && t.includes('12'))).toBe(true);
    expect(textos.some(t => t.includes('Cubeta 4 L'))).toBe(false);
  });

  it('manda la línea con key, presentación pieza y cantidad — y la tapa marcada', async () => {
    await abrirEnvases();
    await userEvent.selectOptions(document.querySelector('[data-id="entregas.select.tienda"]'), 'PALACO');

    await userEvent.selectOptions(document.querySelector('[data-id="entregas.select.producto"]'), 'Cubeta 19 L');
    await userEvent.type(document.querySelector('[data-id="entregas.input.cantidad"]'), '5');
    await userEvent.click(document.querySelector('[data-id="entregas.btn.agregar-linea"]'));

    await userEvent.selectOptions(document.querySelector('[data-id="entregas.select.producto"]'), 'Tapa 19 L — tapa');
    await userEvent.type(document.querySelector('[data-id="entregas.input.cantidad"]'), '5');
    await userEvent.click(document.querySelector('[data-id="entregas.btn.agregar-linea"]'));

    await userEvent.click(document.querySelector('[data-id="entregas.btn.confirmar"]'));
    expect(api.crearEntrega).toHaveBeenCalledTimes(1);
    const { lineas } = api.crearEntrega.mock.calls[0][0];
    expect(lineas).toEqual([
      { fuente: 'envases', key: 'cub19', producto: 'Cubeta 19 L', presentacion: 'pieza', cantidad: 5 },
      { fuente: 'envases', key: 'tapa19', tapa: true, producto: 'Tapa 19 L — tapa', presentacion: 'pieza', cantidad: 5 },
    ]);
  });

  it('el tope es el stock de Terán del envase, con mensaje claro', async () => {
    await abrirEnvases();
    await userEvent.selectOptions(document.querySelector('[data-id="entregas.select.producto"]'), 'Cubeta 19 L');
    await userEvent.type(document.querySelector('[data-id="entregas.input.cantidad"]'), '999');
    await userEvent.click(document.querySelector('[data-id="entregas.btn.agregar-linea"]'));
    expect(screen.getByText(/Solo hay 30 pieza/)).toBeInTheDocument();
    expect(api.crearEntrega).not.toHaveBeenCalled();
  });
});
