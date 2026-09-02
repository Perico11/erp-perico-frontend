/* Entregas — la TIENDA DESTINO se elige, no se escribe (ago 2026).
   Con texto libre, la misma sucursal capturada distinto ("PALACO"/"palaco")
   quedaba como dos tiendas y partía el historial. Estos tests anclan que el
   control es un select del catálogo y que dar de alta una sucursal es un acto
   aparte que no admite duplicados. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/api', () => ({
  default: {
    getStkAmericano: vi.fn(() => Promise.resolve({ data: { colores: [] } })),
    getPTPorUbicacion: vi.fn(() => Promise.resolve({ teran: {} })),
    getEnvases: vi.fn(() => Promise.resolve({ ok: true, data: { categorias: {}, tapas: {} } })),
    crearSucursal: vi.fn(() => Promise.resolve({ ok: true, tienda: { nombre: 'CENTRO' } })),
    corregirTiendaEntrega: vi.fn(() => Promise.resolve({ ok: true, entrega: { tienda: 'YUGOSLAVIA' } })),
    editarEntrega: vi.fn(() => Promise.resolve({ ok: true, entrega: { folio: 'ENT-20260807-001', tienda: 'PALACO', lineas: [] } })),
    crearEntrega: vi.fn(() => Promise.resolve({ ok: true, entrega: {} })),
  },
}));
vi.mock('../hooks/useBodyScrollLock', () => ({ default: () => {} }));

import api from '../services/api';
import { NuevaEntregaSheet, NuevaSucursalSheet, CorregirTiendaSheet } from '../pages/entregas/EntregasPage';

const TIENDAS = ['AMERICAS', 'PALACO', 'YUGOSLAVIA'];

describe('Tienda destino', () => {
  beforeEach(() => vi.clearAllMocks());

  it('es un select del catálogo, sin campo de texto libre', async () => {
    await act(async () => { render(<NuevaEntregaSheet isDesktop tiendasPrev={TIENDAS} onClose={() => {}} onDone={() => {}} />); });
    const sel = document.querySelector('[data-id="entregas.select.tienda"]');
    expect(sel).toBeTruthy();
    expect(sel.tagName).toBe('SELECT');
    TIENDAS.forEach(t => expect(screen.getByRole('option', { name: t })).toBeInTheDocument());
    expect(document.querySelector('[data-id="entregas.input.tienda"]')).toBeNull();
    expect(document.querySelector('datalist')).toBeNull();
  });

  it('sin sucursales dadas de alta, explica cómo agregarlas en vez de dejar escribir', async () => {
    await act(async () => { render(<NuevaEntregaSheet isDesktop tiendasPrev={[]} onClose={() => {}} onDone={() => {}} />); });
    expect(document.querySelector('[data-id="entregas.select.tienda"]')).toBeNull();
    expect(screen.getByText(/Agregar sucursal/)).toBeInTheDocument();
  });
});

describe('Agregar sucursal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('da de alta la sucursal y la devuelve al llamador', async () => {
    const onDone = vi.fn();
    render(<NuevaSucursalSheet isDesktop tiendas={TIENDAS} onClose={() => {}} onDone={onDone} />);
    await userEvent.type(screen.getByPlaceholderText('Ej: PALACO'), '  Centro  ');
    await userEvent.click(screen.getByRole('button', { name: /Guardar sucursal/ }));
    expect(api.crearSucursal).toHaveBeenCalledWith('Centro');
    expect(onDone).toHaveBeenCalledWith('CENTRO');
  });

  it('no deja guardar una que ya existe aunque cambie la caja', async () => {
    render(<NuevaSucursalSheet isDesktop tiendas={TIENDAS} onClose={() => {}} onDone={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText('Ej: PALACO'), 'palaco');
    expect(screen.getByText(/ya está dada de alta/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar sucursal/ })).toBeDisabled();
    expect(api.crearSucursal).not.toHaveBeenCalled();
  });

  it('exige un nombre antes de habilitar el guardado', () => {
    render(<NuevaSucursalSheet isDesktop tiendas={TIENDAS} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByRole('button', { name: /Guardar sucursal/ })).toBeDisabled();
  });
});

describe('Corregir la sucursal de una entrega', () => {
  const ENTREGA = { id: 'e1', folio: 'ENT-20260807-001', tienda: 'PALACO', lineas: [] };
  beforeEach(() => vi.clearAllMocks());

  it('arranca en la sucursal actual y no deja guardar hasta cambiarla', () => {
    render(<CorregirTiendaSheet isDesktop entrega={ENTREGA} tiendas={TIENDAS} onClose={() => {}} onDone={() => {}} />);
    const sel = document.querySelector('[data-id="entregas.select.corregir-tienda"]');
    expect(sel.value).toBe('PALACO');
    expect(screen.getByRole('button', { name: /Corregir sucursal/ })).toBeDisabled();
  });

  it('corrige el destino y avisa que no mueve inventario', async () => {
    const onDone = vi.fn();
    render(<CorregirTiendaSheet isDesktop entrega={ENTREGA} tiendas={TIENDAS} onClose={() => {}} onDone={onDone} />);
    expect(screen.getByText(/no mueve inventario/)).toBeInTheDocument();
    await userEvent.selectOptions(document.querySelector('[data-id="entregas.select.corregir-tienda"]'), 'YUGOSLAVIA');
    await userEvent.click(screen.getByRole('button', { name: /Corregir sucursal/ }));
    expect(api.corregirTiendaEntrega).toHaveBeenCalledWith('e1', 'YUGOSLAVIA');
    expect(onDone).toHaveBeenCalledWith('YUGOSLAVIA');
  });

  it('la sucursal actual sigue en la lista aunque ya no esté en el catálogo', () => {
    render(<CorregirTiendaSheet isDesktop entrega={{ ...ENTREGA, tienda: 'TIENDA VIEJA' }} tiendas={TIENDAS} onClose={() => {}} onDone={() => {}} />);
    expect(document.querySelector('[data-id="entregas.select.corregir-tienda"]').value).toBe('TIENDA VIEJA');
  });
});

/* ── Editar una entrega ya registrada ──────────────────────────────────────
   La hoja de "Nueva entrega" es la misma en modo edición: llega precargada con
   lo que se entregó y guarda contra el endpoint que rehace el movimiento. */
describe('Editar entrega', () => {
  const ENTREGA = {
    id: 'e1', folio: 'ENT-20260807-001', tienda: 'PALACO',
    lineas: [
      { fuente: 'pt', producto: 'BLANCO MATE 4.0', presentacion: 'cubeta', cantidad: 4 },
      { fuente: 'americano', almacen: '1', producto: 'Best Beige', presentacion: 'cubeta', cantidad: 2 },
    ],
  };
  beforeEach(() => vi.clearAllMocks());

  it('llega precargada con lo entregado y con la sucursal puesta', async () => {
    await act(async () => { render(<NuevaEntregaSheet isDesktop tiendasPrev={TIENDAS} entrega={ENTREGA} onClose={() => {}} onDone={() => {}} />); });
    expect(screen.getByText(/Editar entrega · ENT-20260807-001/)).toBeInTheDocument();
    expect(document.querySelector('[data-id="entregas.select.tienda"]').value).toBe('PALACO');
    expect(screen.getByText('BLANCO MATE 4.0')).toBeInTheDocument();
    expect(screen.getByText('Best Beige')).toBeInTheDocument();
    expect(screen.getByText(/Se entregará · 6 unidades/)).toBeInTheDocument();
  });

  it('avisa que rehace el movimiento y guarda contra el endpoint de edición', async () => {
    const onDone = vi.fn();
    await act(async () => { render(<NuevaEntregaSheet isDesktop tiendasPrev={TIENDAS} entrega={ENTREGA} onClose={() => {}} onDone={onDone} />); });
    expect(screen.getByText(/rehace el movimiento/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    expect(api.editarEntrega).toHaveBeenCalledTimes(1);
    const [id, payload] = api.editarEntrega.mock.calls[0];
    expect(id).toBe('e1');
    expect(payload.tienda).toBe('PALACO');
    expect(payload.lineas).toHaveLength(2);
    expect(payload.lineas.find(l => l.fuente === 'pt').cantidad).toBe(4);
    expect(api.crearEntrega).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('quitar una línea deja la entrega con el resto', async () => {
    await act(async () => { render(<NuevaEntregaSheet isDesktop tiendasPrev={TIENDAS} entrega={ENTREGA} onClose={() => {}} onDone={() => {}} />); });
    await userEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[0]);
    await userEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    expect(api.editarEntrega.mock.calls[0][1].lineas).toHaveLength(1);
  });
});
