import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RemisionOverlay } from '../pages/entregas/EntregasPage';

/* Remisión de entrega a tiendas — bloque de firmas (pedido dueño 26-jul-2026):
     · arriba, dos firmas: SALIDA del CEDIS (Josué) y ENTREGÓ A la sucursal
       (el recolector que transporta),
     · abajo, centrada, la RECEPCIÓN del material en la tienda.
   El nombre del recolector se resuelve del padrón (rol 'recolector') para que el
   documento siga correcto si cambia la persona. */

vi.mock('../services/api', () => ({
  default: {
    getUsuarios: vi.fn(() => Promise.resolve({
      ok: true,
      data: [
        { id: 'almacen', nombre: 'Josué', rol: 'almacen' },
        { id: 'recolector', nombre: 'Luis Lara', rol: 'recolector' },
      ],
    })),
  },
}));

const ENTREGA = {
  folio: 'ENT-001',
  fecha: '2026-07-26T17:00:00Z',
  tienda: 'Sucursal Palaco',
  usuario: 'Josué',
  lineas: [
    { producto: 'BLANCO MATE 4.0', presentacion: 'cubeta', cantidad: 6, fuente: 'pt', sublotes: [] },
  ],
};

describe('RemisionOverlay — firmas', () => {
  it('la salida del CEDIS ya NO dice "Entregó" y conserva a quien despacha', async () => {
    render(<RemisionOverlay entrega={ENTREGA} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Salida — CEDIS Terán/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Entregó — CEDIS Terán/)).not.toBeInTheDocument();
    /* "Josué · nombre y firma" vive en el mismo bloque que la salida */
    const salida = screen.getByText(/Salida — CEDIS Terán/).closest('div');
    expect(salida.textContent).toMatch(/Josué · nombre y firma/);
  });

  it('agrega la firma del recolector "Entregó a <sucursal>" con su nombre', async () => {
    render(<RemisionOverlay entrega={ENTREGA} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Entregó a Sucursal Palaco/)).toBeInTheDocument();
    });
    const entrego = screen.getByText(/Entregó a Sucursal Palaco/).closest('div');
    expect(entrego.textContent).toMatch(/Luis Lara · nombre y firma/);
  });

  it('la recepción en tienda queda en su propio bloque centrado, debajo', async () => {
    const { container } = render(<RemisionOverlay entrega={ENTREGA} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Recibió — Sucursal Palaco/)).toBeInTheDocument();
    });
    const recepcion = container.querySelector('.lp-ent-firma2');
    expect(recepcion).toBeTruthy();
    expect(recepcion.textContent).toMatch(/Recibió — Sucursal Palaco/);
    expect(recepcion.textContent).toMatch(/nombre, firma y fecha/);
    /* y las dos de salida siguen juntas arriba, en su fila */
    const salida = container.querySelector('.lp-ent-firma');
    expect(salida.textContent).toMatch(/Salida — CEDIS Terán/);
    expect(salida.textContent).toMatch(/Entregó a Sucursal Palaco/);
  });

  it('sin padrón disponible usa el titular actual como respaldo', async () => {
    const api = (await import('../services/api')).default;
    api.getUsuarios.mockImplementationOnce(() => Promise.reject(new Error('sin red')));
    render(<RemisionOverlay entrega={ENTREGA} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Entregó a Sucursal Palaco/)).toBeInTheDocument();
    });
    const entrego = screen.getByText(/Entregó a Sucursal Palaco/).closest('div');
    expect(entrego.textContent).toMatch(/Luis Lara/);
  });
});
