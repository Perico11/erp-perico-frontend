/* Rechazar conteo (anular) — auditoría 10-ago-2026.
   Un conteo finalizado con números malos no tenía salida: el admin solo veía
   "Aprobar ajuste" (justo lo que corrompería el inventario). Ahora junto a
   Aprobar hay "Rechazar conteo" (danger, motivo obligatorio vía prompt) y el
   estado 'anulado' queda visible en el historial con su motivo. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CycleCountPage from '../pages/cycle-count/CycleCountPage';

const SESIONES = [
  {
    id: 'CC-fin1', folio: 'FC-2026-0007', fecha: '2026-08-09T11:00:00Z',
    usuario: 'Burgos', categoria: 'mp', tipo: 'completo', estado: 'finalizado',
    totalItems: 1, contados: 1, varianzas: 0,
    items: [{ key: 'AGUA', nombre: 'AGUA', stockSistema: 100, stockFisico: 101, varianza: 1, pctVarianza: 1, flagged: false, unidad: 'kg' }],
  },
  {
    id: 'CC-anu1', folio: 'FC-2026-0005', fecha: '2026-08-08T09:00:00Z',
    usuario: 'Burgos', categoria: 'mp', tipo: 'completo', estado: 'anulado',
    anuladoPor: 'Emmanuel', fechaAnulacion: '2026-08-10T10:00:00Z',
    motivoAnulacion: 'Doble aplicación de DISPEX detectada',
    totalItems: 1, contados: 1, varianzas: 1,
    items: [{ key: 'DISPEX', nombre: 'DISPEX AA-4144', stockSistema: 50, stockFisico: 80, varianza: 30, pctVarianza: 60, flagged: true, unidad: 'kg' }],
  },
];

vi.mock('../services/api', () => ({
  default: {
    getCycleCounts: vi.fn(() => Promise.resolve({ ok: true, data: SESIONES })),
    anularConteo: vi.fn(() => Promise.resolve({ ok: true })),
    cycleCountAprobar: vi.fn(() => Promise.resolve({ ok: true })),
    urlExportCycleCount: vi.fn(() => '#'),
    urlPrintCycleCount: vi.fn(() => '#'),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    can: () => true,
    user: { id: 'emmanuel', nombre: 'Emmanuel', rol: 'admin' },
  }),
}));

vi.mock('../components/layout/TopBar', () => ({
  default: ({ title }) => <div data-testid="topbar">{title}</div>,
}));

import api from '../services/api';

const irAlHistorial = async () => {
  render(<MemoryRouter><CycleCountPage /></MemoryRouter>);
  await waitFor(() => expect(api.getCycleCounts).toHaveBeenCalled());
  await userEvent.click(screen.getByRole('button', { name: /Historial/ }));
  await screen.findByText('FC-2026-0007');
};

describe('Rechazar conteo (anular)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('el admin ve "Rechazar conteo" junto a "Aprobar ajuste" en las finalizadas', async () => {
    await irAlHistorial();
    expect(screen.getByRole('button', { name: 'Aprobar ajuste' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar conteo' })).toBeInTheDocument();
  });

  it('rechazar pide motivo obligatorio y llama api.anularConteo(id, motivo)', async () => {
    await irAlHistorial();
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar conteo' }));
    /* prompt del useConfirm — el motivo viaja al backend, que exige ≥5 chars */
    const textarea = await screen.findByPlaceholderText(/números dobles/i);
    await userEvent.type(textarea, 'Conteo con báscula descalibrada');
    /* el confirm del modal comparte rótulo con el botón de la card: es el último en el DOM */
    const botones = screen.getAllByRole('button', { name: 'Rechazar conteo' });
    await userEvent.click(botones[botones.length - 1]);
    await waitFor(() => expect(api.anularConteo).toHaveBeenCalledWith('CC-fin1', 'Conteo con báscula descalibrada'));
  });

  it('una sesión anulada muestra el badge, quién y el motivo — y NO ofrece aprobar', async () => {
    await irAlHistorial();
    expect(screen.getByText('anulado')).toBeInTheDocument();
    expect(screen.getByText(/por Emmanuel/)).toBeInTheDocument();
    expect(screen.getByText(/Doble aplicación de DISPEX detectada/)).toBeInTheDocument();
    /* solo la finalizada ofrece acciones: la anulada no se aprueba ni se re-anula */
    expect(screen.getAllByRole('button', { name: 'Aprobar ajuste' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Rechazar conteo' })).toHaveLength(1);
  });
});
