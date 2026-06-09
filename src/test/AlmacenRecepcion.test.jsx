import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AlmacenRecepcionPage from '../pages/almacen-recepcion/AlmacenRecepcionPage';

/* Rediseño verde (Sprint AG): AlmacenRecepcionPage opera sobre SUBLOTES
   (lote.sublotes[]), no sobre lotes de nivel superior. Un sublote en estado
   'en_camino' es recibible por almacén/admin (escanearRecibirTeran), y uno
   'en_stock_teran' cuenta como recibido. El mock provee lotes con sublotes
   para reflejar la state machine actual. */
vi.mock('../services/api', () => ({
  default: {
    getTrazabilidad: vi.fn(() => Promise.resolve({
      ok: true,
      data: [
        {
          id: 'L-1', codigo: 'LP-2026-001', codigoLote: 'LP-2026-001',
          producto: 'BLANCO MATE 4.0', estado: 'en_camino',
          fecha: '2026-05-08T08:00:00Z',
          sublotes: [
            { cod: 'LP-2026-001-A', estado: 'en_camino', tipo: 'cubeta', qty: 50, lit: 950, ub: 'fabrica' },
          ],
        },
        {
          id: 'L-2', codigo: 'LP-2026-002', codigoLote: 'LP-2026-002',
          producto: 'PROCAUCHO 4.0', estado: 'en_proceso',
          fecha: '2026-05-07T08:00:00Z',
          sublotes: [
            { cod: 'LP-2026-002-A', estado: 'en_stock_teran', tipo: 'cubeta', qty: 100, lit: 1900, ub: 'teran' },
          ],
        },
      ],
    })),
    transicionSublote: vi.fn(() => Promise.resolve({ ok: true })),
    escanearSublote: vi.fn(() => Promise.resolve({ ok: true })),
    escanearLoteBulk: vi.fn(() => Promise.resolve({ ok: true, procesados: [] })),
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

  it('muestra los tabs "Por recibir" y "Recibidos hoy"', async () => {
    /* Rediseño verde: los contadores viven en los tabs ("Por recibir · N" /
       "Recibidos hoy · N"), no en KPIs sueltos "En camino/En almacén". */
    render(<AlmacenRecepcionPage />);
    await waitFor(() => {
      expect(screen.getByText(/Por recibir/)).toBeInTheDocument();
      expect(screen.getByText(/Recibidos hoy/)).toBeInTheDocument();
    });
  });

  it('por defecto filtra a en_camino (sublotes por recibir)', async () => {
    render(<AlmacenRecepcionPage />);
    await waitFor(() => {
      /* El sublote en_camino de BLANCO MATE aparece en "Por recibir". */
      expect(screen.getByText('BLANCO MATE 4.0')).toBeInTheDocument();
      /* PROCAUCHO ya está en_stock_teran → no aparece con filtro en_camino. */
      expect(screen.queryByText('PROCAUCHO 4.0')).not.toBeInTheDocument();
    });
  });

  it('botón "Escanear QR" existe', async () => {
    render(<AlmacenRecepcionPage />);
    await waitFor(() => {
      /* Texto actual: "Escanear QR de recepción". */
      expect(screen.getByText(/Escanear QR/)).toBeInTheDocument();
    });
  });

  it('muestra botón de recepción para sublotes en camino', async () => {
    /* Para un sublote en_camino, almacén ve "Confirmar recepción"
       (escanearRecibirTeran). El texto "Recibir" anterior ya no existe. */
    render(<AlmacenRecepcionPage />);
    await waitFor(() => {
      expect(screen.getByText('Confirmar recepción')).toBeInTheDocument();
    });
  });
});
