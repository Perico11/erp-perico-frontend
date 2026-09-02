/* Envasado en Fábrica — presentación ATOMIZADOR 750 ML (2-sep-2026, dueño).
   Caso ASTRA-LAST: "la fórmula son 7 cubetas pero se envasan en atomizador de
   750 ml". Antes se capturaba por "Otros" y el tipo quedaba fuera de la tabla
   de medidas. Estos tests anclan que:
     · la tarjeta Atomizador existe y hace la cuenta con 0.75 L por pieza;
     · el envase se toma de la categoría "otros" (convención del reenvase);
     · el payload viaja con tipo 'atomizador750' y los litros exactos. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: {
    registrarEnvasado: vi.fn(() => Promise.resolve({ ok: true })),
    getVaciadores: vi.fn(() => Promise.resolve({ ok: true, data: [] })),
    getUsuarios: vi.fn(() => Promise.resolve({ ok: true, data: [] })),
  },
}));
vi.mock('../hooks/useBodyScrollLock', () => ({ default: () => {} }));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));

import api from '../services/api';
import { EnvasadoModal } from '../pages/stock-fabrica/StockFabricaPage';

const LOTE = {
  id: 'L-ATM-1', codigo: 'LP-2026-9001', codigoLote: 'LP-2026-9001',
  producto: 'ASTRA-LAST', estado: 'qc_aprobado', litrosTotal: 133, sublotes: [],
};
/* El envase del atomizador vive en la categoría "otros" de envases.json. */
const ENVASES = {
  categorias: {
    otros: {
      nombre: 'Otros',
      subcategorias: { 'atm750-gen': { nombre: 'Atomizador 750 Generico', capacidad_ml: 750, stock: 200 } },
    },
  },
  tapas: {}, tapa_default: {},
};

const abrir = async () => {
  await act(async () => {
    render(<EnvasadoModal lote={LOTE} envases={ENVASES} userName="Enrique" onClose={() => {}} onSuccess={() => {}} />);
  });
};

describe('Envasado · Atomizador 750 ml', () => {
  beforeEach(() => vi.clearAllMocks());

  it('la tarjeta Atomizador existe y al elegirla la cuenta es 0.75 L por pieza', async () => {
    await abrir();
    const btn = screen.getByRole('button', { name: /Atomizador/ });
    await act(async () => { fireEvent.click(btn); });
    const qty = document.querySelector('input[inputmode="numeric"], input[type="number"]');
    await act(async () => { fireEvent.change(qty, { target: { value: '177' } }); });
    await waitFor(() => expect(screen.getByText(/177 atomizadores de 0.75 L/)).toBeInTheDocument());
  });

  it('manda tipo atomizador750 con el envase de la categoría "otros" y los litros exactos', async () => {
    await abrir();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Atomizador/ })); });
    const qty = document.querySelector('input[inputmode="numeric"], input[type="number"]');
    await act(async () => { fireEvent.change(qty, { target: { value: '177' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generar sublotes/ })); });

    await waitFor(() => expect(api.registrarEnvasado).toHaveBeenCalledTimes(1));
    const [loteId, sublotes] = api.registrarEnvasado.mock.calls[0];
    expect(loteId).toBe('L-ATM-1');
    const s = sublotes[0];
    expect(s.tipo).toBe('atomizador750');
    expect(s.claseSublote).toBe('envasado_final');
    expect(s.qty).toBe(177);
    expect(s.lit).toBeCloseTo(132.75, 2);
    expect(s.subKey).toBe('atm750-gen');
  });
});
