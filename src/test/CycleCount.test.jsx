import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CycleCountPage from '../pages/cycle-count/CycleCountPage';

vi.mock('../services/api', () => ({
  default: {
    getCycleCounts: vi.fn(() => Promise.resolve({
      ok: true,
      data: [
        {
          id: 'CC-abc123',
          fecha: '2026-05-08T10:00:00Z',
          usuario: 'Burgos',
          categoria: 'mp',
          tipo: 'completo',
          estado: 'activo',
          totalItems: 3,
          contados: 1,
          varianzas: 0,
          items: [
            { key: 'W-5916', nombre: 'W-5916', stockSistema: 4580, stockFisico: null, unidad: 'kg' },
            { key: 'AGUA', nombre: 'AGUA', stockSistema: 5000, stockFisico: 5000, unidad: 'kg', varianza: 0, pctVarianza: 0, flagged: false },
            { key: 'DIOXIDO', nombre: 'DIOXIDO TITANIO', stockSistema: 1876, stockFisico: null, unidad: 'kg' },
          ],
        },
      ],
    })),
    cycleCountIniciar: vi.fn(() => Promise.resolve({ ok: true })),
    cycleCountRegistrar: vi.fn((id, key, qty) => Promise.resolve({
      ok: true, item: { key, nombre: key, stockSistema: 100, stockFisico: qty, varianza: qty - 100, pctVarianza: 0, flagged: false, unidad: 'kg' },
    })),
    cycleCountFinalizar: vi.fn(() => Promise.resolve({ ok: true })),
    cycleCountAprobar: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    can: (perm) => ['conteoFisico', 'admin'].includes(perm),
    user: { id: 'burgos', nombre: 'Burgos', rol: 'inventario' },
  }),
}));

vi.mock('../components/layout/TopBar', () => ({
  default: ({ title }) => <div data-testid="topbar">{title}</div>,
}));

describe('CycleCountPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('muestra la sesión activa del usuario actual', async () => {
    render(<MemoryRouter><CycleCountPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('CC-abc123')).toBeInTheDocument();
    });
  });

  it('muestra los KPIs de la sesión: total, contados, varianzas', async () => {
    render(<MemoryRouter><CycleCountPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Total items')).toBeInTheDocument();
      expect(screen.getByText('Contados')).toBeInTheDocument();
      expect(screen.getByText(/Varianzas/)).toBeInTheDocument();
    });
  });

  it('renderiza los items de la sesión activa', async () => {
    render(<MemoryRouter><CycleCountPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('W-5916')).toBeInTheDocument();
      expect(screen.getByText('AGUA')).toBeInTheDocument();
      expect(screen.getByText('DIOXIDO TITANIO')).toBeInTheDocument();
    });
  });

  it('botón Finalizar conteo está visible', async () => {
    render(<MemoryRouter><CycleCountPage /></MemoryRouter>);
    await waitFor(() => {
      /* Rediseño verde: el botón ahora rotula "Finalizar conteo (firma PIN)". */
      expect(screen.getByText(/Finalizar conteo/)).toBeInTheDocument();
    });
  });
});
