/* Envasar en FÁBRICA — modal del botón por producto (2-sep-2026, dueño).
   "En Fábrica los productos en stock deben tener la opción de envasar; este
   producto aparece como 7 cubetas pero ya está transformado a envase de .750."
   Estos tests anclan que:
     · el origen sale del desglose REAL de Fábrica ("Otras piezas" abarca las
       capturas viejas con tipo fuera de tabla, como el ASTRA-LAST);
     · el envase se elige del stock de FÁBRICA y es obligatorio;
     · el payload viaja completo: producto, origen, destino con subKey. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: {
    reenvasarPTFabrica: vi.fn(() => Promise.resolve({ ok: true, producto: 'ASTRA-LAST', espejo: { hijos: [] } })),
    getVaciadores: vi.fn(() => Promise.resolve({ ok: true, data: [] })),
    getUsuarios: vi.fn(() => Promise.resolve({ ok: true, data: [] })),
  },
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));

import api from '../services/api';
import { ReenvasarFabricaModal } from '../pages/inventario/InventarioPage';

/* El ASTRA-LAST tal como lo pinta pt-por-ubicacion: 173 piezas de tipo
   desconocido ("otros") con sus litros reales. */
const DESGLOSE = { cubeta: 0, galon: 0, litro: 0, tote: 0, atm: 0, otros: 173, totalLitros: 129.75, sublotes: 1, residual: 0, manual: 0 };
const ENVDATA = {
  categorias: {
    otros: {
      nombre: 'Otros',
      subcategorias: { 'atm750-gen': { nombre: 'Atomizador 750 Generico', capacidad_ml: 750, stock: 200, teran: 0 } },
    },
  },
  tapas: {},
};

const abrir = async (onDone = () => {}) => {
  await act(async () => {
    render(<ReenvasarFabricaModal producto="ASTRA-LAST" desglose={DESGLOSE} envData={ENVDATA} isDesktop onClose={() => {}} onDone={onDone} />);
  });
};

describe('Envasar en Fábrica · modal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el origen sale del desglose real: "Otras piezas — 173 piezas"', async () => {
    await abrir();
    const sel = document.querySelector('[data-id="inventario.sel.origen-fab"]');
    expect(sel).toBeTruthy();
    const textos = [...sel.querySelectorAll('option')].map(o => o.textContent);
    expect(textos.some(t => t.includes('Otras piezas') && t.includes('173'))).toBe(true);
    expect(textos.some(t => t.includes('Cubetas'))).toBe(false);
  });

  it('manda el payload completo con el envase de Fábrica: otros → 173 atomizadores', async () => {
    const onDone = vi.fn();
    await abrir(onDone);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Atomizador/ })); });
    await act(async () => {
      fireEvent.change(document.querySelector('[data-id="inventario.sel.envase-fab"]'), { target: { value: 'atm750-gen' } });
    });
    await act(async () => {
      fireEvent.change(document.querySelector('[data-id="inventario.qty-fab"]'), { target: { value: '173' } });
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Envasar$/ })); });

    await waitFor(() => expect(api.reenvasarPTFabrica).toHaveBeenCalledTimes(1));
    const [producto, origen, destinos] = api.reenvasarPTFabrica.mock.calls[0];
    expect(producto).toBe('ASTRA-LAST');
    expect(origen).toBe('otros');
    expect(destinos).toEqual([{ tipo: 'atomizador750', qty: 173, subKey: 'atm750-gen', tapaKey: null }]);
    expect(onDone).toHaveBeenCalled();
  });

  it('sin envase elegido no envasa: el botón exige subKey', async () => {
    await abrir();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Atomizador/ })); });
    await act(async () => {
      fireEvent.change(document.querySelector('[data-id="inventario.qty-fab"]'), { target: { value: '10' } });
    });
    const btn = screen.getByRole('button', { name: /^Envasar$/ });
    expect(btn).toBeDisabled();
    expect(api.reenvasarPTFabrica).not.toHaveBeenCalled();
  });
});
