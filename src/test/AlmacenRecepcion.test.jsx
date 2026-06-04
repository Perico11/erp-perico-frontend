import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AlmacenRecepcionPage from '../pages/almacen-recepcion/AlmacenRecepcionPage';

vi.mock('../services/api', () => ({
  default: {
    getTrazabilidad: vi.fn(() => Promise.resolve({
      ok: true,
      data: [
        {
          id: 'L-1', codigo: 'LP-2026-001',
          producto: 'BLANCO MATE 4.0', cantidad: 50,
          fecha: '2026-05-08T08:00:00Z', estado: 'en_camino',
        },
        {
          id: 'L-2', codigo: 'LP-2026-002',
          producto: 'PROCAUCHO 4.0', cantidad: 100,
          fecha: '2026-05-07T08:00:00Z', estado: 'en_almacen',
          recibidoPor: 'Josué', fechaRecepcionAlmacen: '2026-05-07T15:00:00Z',
        },
        {
          id: 'L-3', codigo: 'LP-2026-003',
          producto: 'BLANCO SATIN 4.0', cantidad: 30,
          fecha: '2026-05-06T08:00:00Z', estado: 'entregado',
        },
      ],
    })),
    upsertTrazabilidad: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { nombre: 'Josué', rol: 'almacen' } }),
}));

vi.mock('../hooks/useRealtimeSync', () => ({
  useRealtimeSync: () => ({ connected: false }),
}));

vi.mock('../components/layout/TopBar', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../components/QRModal', () => ({
  QRScanner: () => <div data-testid="qr-scanner">scanner</div>,
}));

describe('AlmacenRecepcionPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('muestra los KPIs En camino, En almacén, Entregados', async () => {
    render(<AlmacenRecepcionPage />);
    await waitFor(() => {
      expect(screen.getByText('En camino')).toBeInTheDocument();
      expect(screen.getByText('En almacén')).toBeInTheDocument();
      expect(screen.getByText('Entregados')).toBeInTheDocument();
    });
  });

  it('por defecto filtra a en_camino', async () => {
    render(<AlmacenRecepcionPage />);
    await waitFor(() => {
      expect(screen.getByText('BLANCO MATE 4.0')).toBeInTheDocument();
      /* PROCAUCHO está en_almacen, no debe aparecer con filtro en_camino */
      expect(screen.queryByText('PROCAUCHO 4.0')).not.toBeInTheDocument();
    });
  });

  it('botón "Escanear QR" existe', async () => {
    render(<AlmacenRecepcionPage />);
    await waitFor(() => {
      expect(screen.getByText(/Escanear QR/)).toBeInTheDocument();
    });
  });

  it('muestra botón "Recibir" para lotes en camino', async () => {
    render(<AlmacenRecepcionPage />);
    await waitFor(() => {
      expect(screen.getByText('Recibir')).toBeInTheDocument();
    });
  });
});
