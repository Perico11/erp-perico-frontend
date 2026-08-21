/* Editar color americano: el NOMBRE solo lo puede tocar Emmanuel (11-ago).
   El backend re-valida; aquí se prueba el gating de UI y el flujo de guardado
   (renombrar primero, luego guardar cantidades sobre el nombre nuevo). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AltaAmericanoModal from '../pages/stk-americano/AltaAmericanoModal';

const mockAuth = vi.hoisted(() => ({ current: null }));
vi.mock('../context/AuthContext', () => ({
  useAuthOpcional: () => mockAuth.current,
  useAuth: () => mockAuth.current,
}));

vi.mock('../services/api', () => ({
  default: {
    renombrarStkAmericano: vi.fn().mockResolvedValue({ ok: true }),
    colorStkAmericano: vi.fn().mockResolvedValue({ ok: true, color: {}, lotes: [] }),
  },
}));
import api from '../services/api';

const COLOR = { key: 'BLANCO MATE', nombre: 'Blanco mate', cubetas: 10, galones: 5, totesLitros: 100, totes: [] };
const abrir = () => render(<AltaAmericanoModal color={COLOR} almacen="1" onClose={() => {}} onSaved={() => {}} />);
const inputNombre = () => document.querySelector('[data-id="stkAmericano.color.nombre"]');

beforeEach(() => { vi.clearAllMocks(); });

describe('renombrar color americano (solo Emmanuel)', () => {
  it('Josué (almacén) ve el nombre BLOQUEADO al editar', () => {
    mockAuth.current = { user: { nombre: 'Josué', rol: 'almacen' } };
    abrir();
    expect(inputNombre().disabled).toBe(true);
  });

  it('otro admin también lo ve bloqueado', () => {
    mockAuth.current = { user: { nombre: 'Arely', rol: 'admin' } };
    abrir();
    expect(inputNombre().disabled).toBe(true);
  });

  it('Emmanuel puede editarlo y al guardar renombra ANTES de guardar cantidades', async () => {
    mockAuth.current = { user: { nombre: 'Emmanuel', rol: 'admin' } };
    abrir();
    const inp = inputNombre();
    expect(inp.disabled).toBe(false);
    fireEvent.change(inp, { target: { value: 'Blanco Mate GDB' } });
    /* aviso de qué va a pasar, antes de guardar */
    expect(screen.getByText(/pasará a llamarse/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(api.colorStkAmericano).toHaveBeenCalled());
    expect(api.renombrarStkAmericano).toHaveBeenCalledWith({ almacen: '1', key: 'BLANCO MATE', nuevoNombre: 'Blanco Mate GDB' });
    expect(api.renombrarStkAmericano.mock.invocationCallOrder[0])
      .toBeLessThan(api.colorStkAmericano.mock.invocationCallOrder[0]);
    expect(api.colorStkAmericano.mock.calls[0][0].nombre).toBe('Blanco Mate GDB');
  });

  it('Emmanuel SIN cambiar el nombre no dispara el renombre', async () => {
    mockAuth.current = { user: { nombre: 'Emmanuel', rol: 'admin' } };
    abrir();
    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(api.colorStkAmericano).toHaveBeenCalled());
    expect(api.renombrarStkAmericano).not.toHaveBeenCalled();
  });
});
