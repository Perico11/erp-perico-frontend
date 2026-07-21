import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DevolucionesPage from '../pages/devoluciones/DevolucionesPage';

/* T1 (jul 2026): DevolucionesPanel (panel viejo de Admin) se eliminó — la
   pantalla canónica es DevolucionesPage (/devoluciones, sheets con data-id).
   Este test cubre ahora la página. */

vi.mock('../services/api', () => ({
  default: {
    getDevoluciones: vi.fn(() => Promise.resolve({
      ok: true,
      data: [
        {
          id: 'DEV-ABC', fecha: '2026-05-08T10:00:00Z',
          cliente: 'Cliente Test', producto: 'BLANCO MATE 4.0',
          cantidad: 5, presentacion: 'cubeta', motivo: 'Defecto',
          montoDevuelto: 5000, notaCredito: 'NC-XYZ',
          ajusteRealizado: true, creadoPor: 'Emmanuel',
        },
      ],
    })),
    registrarDevolucion: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

/* El gate del botón "Registrar devolución" es el permiso 'devoluciones'
   (admin/tecnico/almacen/compras). El mock concede solo ese permiso. */
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ can: (p) => p === 'devoluciones', user: { nombre: 'Test', rol: 'admin' } }),
}));

vi.mock('../hooks/useRealtimeSync', () => ({
  useRealtimeSync: () => ({ connected: false }),
}));

vi.mock('../components/layout/TopBar', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

describe('DevolucionesPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renderiza la lista de devoluciones', async () => {
    render(<DevolucionesPage />);
    await waitFor(() => {
      expect(screen.getByText('BLANCO MATE 4.0')).toBeInTheDocument();
      expect(screen.getByText(/Cliente Test/)).toBeInTheDocument();
    });
  });

  it('muestra el badge "Stock ajustado"', async () => {
    render(<DevolucionesPage />);
    await waitFor(() => {
      expect(screen.getByText('Stock ajustado')).toBeInTheDocument();
    });
  });

  it('muestra el monto formateado correctamente', async () => {
    render(<DevolucionesPage />);
    await waitFor(() => {
      expect(screen.getByText('$5000.00')).toBeInTheDocument();
    });
  });

  it('botón "Registrar devolución" aparece con permiso devoluciones', async () => {
    render(<DevolucionesPage />);
    await waitFor(() => {
      expect(screen.getByText('Registrar devolución')).toBeInTheDocument();
    });
  });
});
