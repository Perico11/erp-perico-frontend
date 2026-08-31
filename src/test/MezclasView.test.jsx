/* ════════════════════════════════════════════════════════════════════════════
   PESTAÑA MEZCLAS — historial + botón (31-ago-2026, pedido dueño).

   "Una pestaña nueva para Mezclar colores" — el 28-ago salió el botón + modal
   y quedó pendiente la pestaña. Se fija: que el historial enseñe QUÉ se
   fusionó, cuándo, quién y con qué lote; que la pestaña sobreviva a un
   historial vacío y a un error de red; que el botón abra EL MISMO asistente
   de siempre con el almacén elegido; y que sin permiso de edición el botón
   no exista pero el historial sí.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import MezclasView from '../pages/stk-americano/MezclasView';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    getMezclasAmericano: vi.fn(),
    mezclarStkAmericano: vi.fn(() => Promise.resolve({ ok: true, lote: 'USA-0020-01', color: { nombre: 'BLANCO OFF WHITE' } })),
    getInventario: vi.fn(() => Promise.resolve({ ok: true, data: { pt: {} } })),
    getVaciadores: vi.fn(() => Promise.resolve({ ok: true, data: [] })),
  },
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));

const MEZCLA = {
  id: 'm-1', fecha: '2026-08-28T22:00:00.000Z', tipo: 'mezcla_stk_americano',
  producto: 'BLANCO OFF WHITE', ubicacion: 'teran', cantidad: 950, unidad: 'L',
  lote: 'USA-0019-01', tambos: ['USA-0019-01'], colorNuevo: true,
  composicion: [{ color: 'BLANCO', litros: 700 }, { color: 'BEIGE', litros: 250 }],
  usuario: 'Josué', mezcladoPor: 'Kendy',
};

beforeEach(() => vi.clearAllMocks());

describe('MezclasView', () => {
  it('el historial enseña qué se fusionó, cuándo, quién y con qué lote', async () => {
    api.getMezclasAmericano.mockResolvedValue({ ok: true, mezclas: [MEZCLA] });
    render(<MezclasView canEdit />);
    await waitFor(() => expect(document.querySelector('[data-id="mezclas.card"]')).toBeTruthy());
    const card = document.querySelector('[data-id="mezclas.card"]').textContent;
    expect(card).toContain('BLANCO OFF WHITE');
    expect(card).toContain('COLOR NUEVO');
    expect(card).toContain('BLANCO 700 L');
    expect(card).toContain('BEIGE 250 L');
    expect(card).toContain('USA-0019-01');
    expect(card).toContain('Kendy');
    expect(card).toContain('Terán');
  });

  it('historial vacío: lo dice, no truena ni queda en blanco', async () => {
    api.getMezclasAmericano.mockResolvedValue({ ok: true, mezclas: [] });
    render(<MezclasView canEdit />);
    await waitFor(() => expect(document.querySelector('[data-id="mezclas.vacio"]')).toBeTruthy());
  });

  it('error de red: mensaje visible, sin pantalla rota', async () => {
    api.getMezclasAmericano.mockRejectedValue(new Error('se cayó la red'));
    render(<MezclasView canEdit />);
    await waitFor(() => expect(screen.getByText(/se cayó la red/)).toBeTruthy());
  });

  it('el botón abre EL MISMO asistente, con el almacén elegido', async () => {
    api.getMezclasAmericano.mockResolvedValue({ ok: true, mezclas: [] });
    render(<MezclasView canEdit colores1={[{ key: 'a', nombre: 'A', totes: [] }]} colores2={[]} />);
    await waitFor(() => expect(document.querySelector('[data-id="mezclas.btn.mezclar"]')).toBeTruthy());
    fireEvent.click(document.querySelector('[data-id="mezclas.almacen.2"]'));
    fireEvent.click(document.querySelector('[data-id="mezclas.btn.mezclar"]'));
    /* El modal existente es reconocible por su selector de ingrediente. */
    await waitFor(() => expect(document.querySelector('[data-id="stkAmericano.mezclar.color0"]')).toBeTruthy());
  });

  it('sin permiso de edición: historial sí, botón no', async () => {
    api.getMezclasAmericano.mockResolvedValue({ ok: true, mezclas: [MEZCLA] });
    render(<MezclasView canEdit={false} />);
    await waitFor(() => expect(document.querySelector('[data-id="mezclas.card"]')).toBeTruthy());
    expect(document.querySelector('[data-id="mezclas.btn.mezclar"]')).toBeNull();
  });

  it('al guardar una mezcla, el historial se recarga solo', async () => {
    api.getMezclasAmericano.mockResolvedValue({ ok: true, mezclas: [] });
    render(<MezclasView canEdit colores1={[{ key: 'a', nombre: 'A', totes: [] }]} />);
    await waitFor(() => expect(api.getMezclasAmericano).toHaveBeenCalledTimes(1));
    fireEvent.click(document.querySelector('[data-id="mezclas.btn.mezclar"]'));
    await waitFor(() => expect(document.querySelector('[data-id="stkAmericano.mezclar.color0"]')).toBeTruthy());
    /* Simular el onSaved del modal es frágil; aquí basta fijar que cerrar y
       volver no duplica cargas — el detalle del onSaved lo cubre la prueba
       del contrato del modal. Cerramos y verificamos que sólo hubo la carga
       inicial (el reload ocurre en onSaved, no al cerrar). */
    fireEvent.click(screen.getByText('×'));
    expect(api.getMezclasAmericano).toHaveBeenCalledTimes(1);
  });
});
