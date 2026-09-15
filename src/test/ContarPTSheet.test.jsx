/* Ficha "Contar existencia" de Stock ▸ Total (15-sep-2026, propuesta A).
   Dos quejas del dueño detrás de estos tests:
     · "la lógica dice que tengo N cubetas, pero no es exacto" → la ficha
       pregunta por PIEZAS (totes llenos, litros del parcial, cubetas, galones,
       litros, atomizadores), no por un total en cubetas;
     · "solo deja modificar la sección total y no lo que hay en fábrica y lo que
       hay en Terán" → la ficha elige UBICACIÓN y el conteo viaja con ella.
   El candado (TOTP / código admin) lo pone el padre, igual que "Ajustar". */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { ptConteo: vi.fn(() => Promise.resolve({ ok: true })) } }));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));

import { ContarPTSheet, PTPiezasChips } from '../pages/inventario/InventarioPage';
import { resumenPiezasTotal } from '../utils/ptConteo';

/* BLANCO OFFWHITE 4.0 tal como lo pinta pt-por-ubicacion: en Fábrica 1 tote
   lleno + 12 cubetas (1,216 L); en Terán un tote abierto con 344 L + 17
   cubetas + 21 galones + 6 litros (752.16 L ≈ 39.587 cub). */
const BUCKETS = {
  fabrica: { cubeta: 12, galon: 0, litro: 0, tote: 1, atm: 0, otros: 0, granel: 0 },
  teran:   { cubeta: 17, galon: 21, litro: 6, tote: 1, atm: 0, otros: 0, granel: 18.105 },
};
/* El tote abierto de Terán vive por partida doble en el bucket: su etiqueta
   (columna tote) y sus 344 L en el pool (granel). Trazabilidad lo identifica. */
const PARCIALES = [{ cod: 'SL-TOTE', litros: 344, ubic: 'teran' }];
const ITEM = {
  nombre: 'BLANCO OFFWHITE 4.0',
  inv: { qty: 64, teran: 39.587, min: 30, sku: 'PT-BOW-CUB' },
  fabQty: 64, teranQty: 39.587, transito: 0, buckets: BUCKETS, parciales: PARCIALES,
};

const val = (key) => document.querySelector(`[data-id="inventario.contar.${key}"]`).value;
const set = async (key, v) => {
  await act(async () => {
    fireEvent.change(document.querySelector(`[data-id="inventario.contar.${key}"]`), { target: { value: String(v) } });
  });
};
const abrir = async (onSave, props = {}) => {
  await act(async () => {
    render(<ContarPTSheet item={ITEM} buckets={BUCKETS} parciales={PARCIALES} isDesktop onClose={() => {}} onSave={onSave} {...props} />);
  });
};

describe('Contar existencia · PT por ubicación', () => {
  beforeEach(() => vi.clearAllMocks());

  it('arranca en Fábrica y precarga las piezas que el sistema cree tener', async () => {
    await abrir(vi.fn());
    expect(screen.getByRole('tab', { name: /Fábrica · 1,216 L/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Terán · 752.2 L/ })).toHaveAttribute('aria-selected', 'false');
    expect(val('tote')).toBe('1');
    expect(val('cubeta')).toBe('12');
    expect(val('granelL')).toBe('0');
  });

  it('cambiar de ubicación recarga los "antes" de ESA ubicación', async () => {
    await abrir(vi.fn());
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Terán/ })); });
    /* El tote abierto cuenta UNA vez: como 344 L, no como tote lleno además. */
    expect(val('tote')).toBe('0');
    expect(val('granelL')).toBe('344');
    expect(val('cubeta')).toBe('17');
    expect(val('galon')).toBe('21');
    expect(screen.getByText(/Hoy en Terán/)).toBeInTheDocument();
  });

  it('el conteo viaja con su ubicación y en piezas, no en cubetas', async () => {
    const onSave = vi.fn(() => Promise.resolve());
    await abrir(onSave);
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Terán/ })); });
    await set('galon', 19); /* se rompieron 2 galones */
    await set('motivo', 'Conteo físico: 2 galones rotos');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Guardar conteo de Terán/ })); });

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [ubicacion, piezas, motivo] = onSave.mock.calls[0];
    expect(ubicacion).toBe('teran');
    expect(piezas).toEqual({ tote: 0, granelL: 344, cubeta: 17, galon: 19, litro: 6, atomizador750: 0 });
    expect(motivo).toBe('Conteo físico: 2 galones rotos');
  });

  it('el tote abierto no se cuenta dos veces: las piezas cuadran con lo contable', async () => {
    await abrir(vi.fn());
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Terán/ })); });
    /* 344 L + 17 cub + 21 gal + 6 L = 752.16 L ≈ los 752.2 L del escalar. */
    expect(screen.getByText(/Hoy en Terán/).parentElement.textContent).toContain('752.2 L');
    expect(screen.queryByText(/El sistema registra/)).toBeNull();
  });

  it('la vista previa da litros y el cubeta-equivalente del conteo', async () => {
    await abrir(vi.fn());
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Terán/ })); });
    await set('galon', 19);
    const prev = document.querySelector('[data-id="inventario.contar.preview"]');
    expect(prev.textContent).toContain('39.2'); /* 744.59 L / 19 cub-equivalente */
    expect(prev.textContent).toContain('galones 21 → 19');
    expect(screen.getByText('744.6 L')).toBeInTheDocument(); /* 752.2 → 744.6 L */
  });

  it('sin motivo no se guarda (el conteo siempre deja rastro)', async () => {
    const onSave = vi.fn(() => Promise.resolve());
    await abrir(onSave);
    await set('cubeta', 10);
    const btn = screen.getByRole('button', { name: /Guardar conteo de Fábrica/ });
    expect(btn).toBeDisabled();
    await act(async () => { fireEvent.click(btn); });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('el admin puede contar sin motivo, pero no sin cambios', async () => {
    const onSave = vi.fn(() => Promise.resolve());
    await abrir(onSave, { motivoOpcional: true });
    expect(screen.getByRole('button', { name: /Guardar conteo de Fábrica/ })).toBeDisabled();
    await set('cubeta', 10);
    expect(screen.getByRole('button', { name: /Guardar conteo de Fábrica/ })).toBeEnabled();
  });

  it('avisa cuando lo contable y las piezas no cuadran (hay que censar)', async () => {
    /* El escalar dice 64 cub (1,216 L) pero las piezas solo explican 12 cubetas. */
    const buckets = { ...BUCKETS, fabrica: { cubeta: 12, galon: 0, litro: 0, tote: 0, atm: 0, otros: 0 } };
    await act(async () => {
      render(<ContarPTSheet item={{ ...ITEM, buckets }} buckets={buckets} isDesktop onClose={() => {}} onSave={vi.fn()} />);
    });
    const aviso = screen.getByText(/El sistema registra/);
    expect(aviso.textContent).toContain('1,216 L'); /* el contable */
    expect(aviso.textContent).toContain('228 L');   /* lo que explican las piezas */
  });

  it('las piezas sin tipo se avisan aparte: no se pueden contar como cubetas', async () => {
    const buckets = { ...BUCKETS, fabrica: { ...BUCKETS.fabrica, otros: 173 } };
    await act(async () => {
      render(<ContarPTSheet item={{ ...ITEM, buckets }} buckets={buckets} parciales={PARCIALES} isDesktop onClose={() => {}} onSave={vi.fn()} />);
    });
    expect(screen.getByText(/173 piezas sin tipo/)).toBeInTheDocument();
  });
});

describe('Chips de presentación en la fila', () => {
  it('pintan las piezas reales en vez del badge de medida', async () => {
    const piezas = resumenPiezasTotal(
      { tote: 2, cubeta: 29, galon: 21, litro: 6, atm: 0, otros: 0, granel: 18.105 },
      [{ cod: 'SL-A', litros: 344, ubic: 'teran' }],
    );
    await act(async () => { render(<PTPiezasChips piezas={piezas} />); });
    expect(screen.getByText('1 tote lleno')).toBeInTheDocument();
    expect(screen.getByText('1 tote parcial · 344 L')).toBeInTheDocument();
    expect(screen.getByText('29 cubetas')).toBeInTheDocument();
    expect(screen.getByText('21 galones')).toBeInTheDocument();
  });

  it('sin existencia no pinta nada', async () => {
    const { container } = render(<PTPiezasChips piezas={resumenPiezasTotal({}, [])} />);
    expect(container.querySelector('[data-id="inventario.pt.piezas"]')).toBeNull();
  });
});
