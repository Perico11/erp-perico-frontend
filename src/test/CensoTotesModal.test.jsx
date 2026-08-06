/* CensoTotesModal (5-ago) — le pone folio al granel que ya está en piso.
   Cubre lo que el usuario toca: la sugerencia inicial, el candado del descuadre
   (un ajuste de inventario no puede pasar sin confirmación explícita) y el
   payload que sale hacia el backend. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CensoTotesModal from '../pages/stk-americano/CensoTotesModal';

vi.mock('../services/api', () => ({
  default: { censarTotesAmericano: vi.fn(() => Promise.resolve({ ok: true, lotes: ['USA-0002', 'USA-0003'], declarado: 1099.81, dif: 0 })) },
}));
vi.mock('../hooks/useBodyScrollLock', () => ({ default: () => {} }));

import api from '../services/api';

const COLOR = { key: 'BEST BEIGE', nombre: 'Best Beige', totesLitros: 1099.81, granelSinLote: 1099.81, totes: [], lotes: [] };

const litrosInputs = () => screen.getAllByPlaceholderText('litros');
const btnRegistrar = () => screen.getByRole('button', { name: /Registrar \d+ tote/ });

describe('CensoTotesModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sugiere partir el granel en totes llenos + el resto', () => {
    render(<CensoTotesModal color={COLOR} onClose={() => {}} />);
    const inputs = litrosInputs();
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue(1000);
    expect(inputs[1]).toHaveValue(99.81);
    expect(screen.getByText(/Cuadra con el sistema/)).toBeInTheDocument();
  });

  it('envía un tote por fila, con el lote del fabricante', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CensoTotesModal color={COLOR} almacen="1" onClose={() => {}} onSaved={onSaved} />);
    await user.type(screen.getAllByPlaceholderText('lote del fabricante (opcional)')[0], 'BB-4471-A');
    await user.click(btnRegistrar());
    await waitFor(() => expect(api.censarTotesAmericano).toHaveBeenCalled());
    expect(api.censarTotesAmericano.mock.calls[0][0]).toMatchObject({
      almacen: '1', key: 'BEST BEIGE',
      totes: [{ litros: 1000, loteProveedor: 'BB-4471-A' }, { litros: 99.81 }],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('un descuadre exige confirmación explícita antes de poder guardar', async () => {
    const user = userEvent.setup();
    render(<CensoTotesModal color={COLOR} onClose={() => {}} />);
    /* Josué encuentra 900 L en el primer tote, no 1000 → faltan 100 L */
    await user.clear(litrosInputs()[0]);
    await user.type(litrosInputs()[0], '900');

    expect(screen.getByText(/sobran\/faltan/)).toBeInTheDocument();
    expect(btnRegistrar()).toBeDisabled();

    await user.click(screen.getByRole('checkbox'));
    expect(btnRegistrar()).toBeEnabled();
    await user.click(btnRegistrar());
    await waitFor(() => expect(api.censarTotesAmericano).toHaveBeenCalled());
    expect(api.censarTotesAmericano.mock.calls[0][0].confirmarAjuste).toBe(true);
  });

  it('un tote de más de 1000 L se rechaza en la propia pantalla', async () => {
    const user = userEvent.setup();
    render(<CensoTotesModal color={COLOR} onClose={() => {}} />);
    await user.clear(litrosInputs()[0]);
    await user.type(litrosInputs()[0], '1500');
    expect(screen.getByText(/no puede tener más de/)).toBeInTheDocument();
    expect(btnRegistrar()).toBeDisabled();
    expect(api.censarTotesAmericano).not.toHaveBeenCalled();
  });

  it('se pueden agregar y quitar totes (son piezas físicas, no un total)', async () => {
    const user = userEvent.setup();
    render(<CensoTotesModal color={COLOR} onClose={() => {}} />);
    await user.click(screen.getByText('+ Agregar otro tote'));
    expect(litrosInputs()).toHaveLength(3);
    await user.click(screen.getByLabelText('Quitar tote 3'));
    expect(litrosInputs()).toHaveLength(2);
  });
});
