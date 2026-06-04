import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DevolucionesPanel from '../pages/admin/DevolucionesPanel';

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

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ can: (p) => p === 'configuracion' }),
}));

describe('DevolucionesPanel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renderiza la lista de devoluciones', async () => {
    render(<DevolucionesPanel />);
    await waitFor(() => {
      expect(screen.getByText('BLANCO MATE 4.0')).toBeInTheDocument();
      expect(screen.getByText(/Cliente Test/)).toBeInTheDocument();
    });
  });

  it('muestra el badge "Stock ajustado"', async () => {
    render(<DevolucionesPanel />);
    await waitFor(() => {
      expect(screen.getByText('Stock ajustado')).toBeInTheDocument();
    });
  });

  it('muestra el monto formateado correctamente', async () => {
    render(<DevolucionesPanel />);
    await waitFor(() => {
      expect(screen.getByText('$5000.00')).toBeInTheDocument();
    });
  });

  it('botón "+ Registrar devolución" aparece con permiso configuracion', async () => {
    render(<DevolucionesPanel />);
    await waitFor(() => {
      expect(screen.getByText('+ Registrar devolución')).toBeInTheDocument();
    });
  });
});
