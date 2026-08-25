/* ════════════════════════════════════════════════════════════════════════════
   EL NÚMERO QUE NO SE PODÍA CORREGIR (25-ago-2026).

   El dueño mandó producir BLANCO OFFWHITE por 2 totes cuando era 1. El ERP
   dejaba crear, aceptar, rechazar y eliminar un pedido — no corregir su
   cantidad. Se arreglaba editando el JSON del VPS a mano.

   Lo que estas pruebas cuidan es que la captura no repita el enredo que causó
   el problema: confundir TOTES con CUBETAS. El modal muestra la equivalencia y
   las bachas que salen, para que "1" se lea como "1 tote = 52 cubetas" y no
   como "1 cubeta".
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CorregirCantidadModal from '../components/CorregirCantidadModal';

vi.mock('../services/api', () => ({
  default: { corregirCantidadPedido: vi.fn() },
}));
import api from '../services/api';

const PEDIDO = {
  id: 'PA-MT0KCLN9', codigo: 'PA-MT0KCLN9', formula: 'BLANCO OFFWHITE',
  medida: 'tote', medidaQty: 2, cantidad: 104, estado: 'en_produccion',
};

beforeEach(() => {
  vi.clearAllMocks();
  api.corregirCantidadPedido.mockResolvedValue({ ok: true });
});

const montar = (extra = {}) => {
  const onSaved = vi.fn(), onClose = vi.fn();
  render(<CorregirCantidadModal pedido={{ ...PEDIDO, ...extra }} onClose={onClose} onSaved={onSaved} />);
  return { onSaved, onClose };
};

describe('Corregir cantidad', () => {
  it('arranca con la cantidad actual y dice a cuántas cubetas equivale', () => {
    montar();
    expect(screen.getByLabelText(/Cuántos totes/)).toHaveValue(2);
    expect(screen.getByText(/Antes: 2 totes = 104 cubetas/)).toBeInTheDocument();
  });

  it('al escribir 1 muestra "1 tote = 52 cubetas" — totes no son cubetas', async () => {
    const u = userEvent.setup();
    montar();
    const input = screen.getByLabelText(/Cuántos totes/);
    await u.clear(input);
    await u.type(input, '1');

    await waitFor(() => {
      expect(screen.getByText(/1 tote/)).toBeInTheDocument();
      expect(screen.getByText(/52 cubetas/)).toBeInTheDocument();
    });
  });

  it('avisa cuántas bachas salen (2 totes = 2 mezclas)', () => {
    montar();
    expect(screen.getByText(/2 bachas/)).toBeInTheDocument();
  });

  it('no deja guardar sin motivo: el cambio tiene que quedar explicado', async () => {
    const u = userEvent.setup();
    montar();
    const boton = screen.getByRole('button', { name: 'Corregir' });
    expect(boton).toBeDisabled();

    await u.type(screen.getByLabelText(/Motivo/), 'ups');
    expect(boton).toBeDisabled();
    expect(screen.getByText(/Al menos 5 caracteres/)).toBeInTheDocument();

    await u.type(screen.getByLabelText(/Motivo/), ' fueron 2 y era 1');
    await waitFor(() => expect(boton).toBeEnabled());
  });

  it('manda la cantidad EN SU MEDIDA (1 tote), no el cubeta-equivalente', async () => {
    const u = userEvent.setup();
    const { onSaved } = montar();
    const input = screen.getByLabelText(/Cuántos totes/);
    await u.clear(input);
    await u.type(input, '1');
    await u.type(screen.getByLabelText(/Motivo/), 'Terán pidió 1 tote');
    await u.click(screen.getByRole('button', { name: 'Corregir' }));

    await waitFor(() => {
      expect(api.corregirCantidadPedido).toHaveBeenCalledWith('PA-MT0KCLN9', 1, 'Terán pidió 1 tote');
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('una cantidad en cero o negativa no se puede guardar', async () => {
    const u = userEvent.setup();
    montar();
    await u.type(screen.getByLabelText(/Motivo/), 'motivo suficiente');
    const input = screen.getByLabelText(/Cuántos totes/);
    await u.clear(input);
    await u.type(input, '0');

    await waitFor(() => {
      expect(screen.getByText(/mayor a cero/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Corregir' })).toBeDisabled();
  });

  it('si el server lo rechaza (ya producido) lo DICE y no cierra el modal', async () => {
    const u = userEvent.setup();
    api.corregirCantidadPedido.mockRejectedValue(new Error('Este pedido ya está "producido": la materia prima ya se descontó'));
    const { onSaved } = montar();
    await u.type(screen.getByLabelText(/Motivo/), 'intento tardío');
    await u.click(screen.getByRole('button', { name: 'Corregir' }));

    await waitFor(() => {
      expect(screen.getByText(/ya se descontó/)).toBeInTheDocument();
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('sirve para pedidos en cubetas, no solo en totes', () => {
    montar({ medida: 'cubeta', medidaQty: 30, cantidad: 30 });
    expect(screen.getByLabelText(/Cuántas cubetas/)).toHaveValue(30);
    /* 30 cubetas no llegan a un tote: una sola bacha, sin aviso de mezclas. */
    expect(screen.queryByText(/bachas/)).not.toBeInTheDocument();
  });
});
