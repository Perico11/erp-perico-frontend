/* QCModal — rangos visibles + aviso fuera de rango con justificación (11-ago-2026).
   El QC formal (el que LIBERA un lote en qc_hold) validaba a ciegas: aceptaba
   130 KU sin aviso mientras el wizard sí exige 80-120 (routes/produccion.js).
   Estos tests anclan: rango visible bajo cada campo (de la receta o del
   default espejo), aviso ámbar + nota obligatoria (≥5 chars) para aprobar
   fuera de rango, aprobación sin fricción cuando todo está en rango, y que
   la justificación viaja auditada en el payload de la transición. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/api', () => ({
  default: {
    getProduccionSteps: vi.fn(() => Promise.resolve({ ok: true, steps: [] })),
    transicionLote: vi.fn(() => Promise.resolve({ ok: true })),
    registrarQC: vi.fn(() => Promise.resolve({ ok: true })),
    upsertOrden: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));
vi.mock('../hooks/useBodyScrollLock', () => ({ default: () => {} }));

import api from '../services/api';
import { QCModal } from '../pages/produccion/ProduccionPage';

const LOTE = {
  id: 'L1', codigoLote: 'LP-20260811-001', producto: 'BLANCO MATE 4.0',
  estado: 'qc_hold',
  /* lecturas que dejó el wizard en planta — el modal las muestra, no las re-pide */
  qcReadings: { viscosidad: 95, ph: 8.2 },
};
const ORDEN = { id: 'O1', codigo: 'ORD-001', formula: 'BLANCO MATE 4.0', cantidad: 10, loteRef: LOTE };

function renderModal(props = {}) {
  return render(
    <QCModal orden={ORDEN} lotes={[]} qcRecords={[]} userName="Enrique"
      onClose={() => {}} onSuccess={() => {}} {...props} />
  );
}

describe('QCModal — rangos QC', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra el rango default (espejo del wizard) bajo cada campo con rango', async () => {
    renderModal();
    expect(await screen.findByText(/Rango: 80-120 KU/)).toBeInTheDocument();
    expect(screen.getByText(/Rango: 7\.5-9\.5/)).toBeInTheDocument();
    expect(screen.getByText(/Rango: 1\.10-1\.50 g\/mL/)).toBeInTheDocument();
    /* Brillo no tiene rango en el backend → sin hint de rango para GU */
    expect(screen.queryByText(/Rango:.*GU/)).not.toBeInTheDocument();
    /* pide la MISMA fuente que el wizard para la fórmula del lote */
    await waitFor(() => expect(api.getProduccionSteps).toHaveBeenCalledWith('BLANCO MATE 4.0', 1, 19));
  });

  it('usa el rango de la receta cuando /api/produccion/steps lo trae', async () => {
    api.getProduccionSteps.mockResolvedValueOnce({
      ok: true,
      steps: [{
        type: 'qc', titulo: 'Control de Calidad: Pre-Envasado',
        pruebas: [{ id: 'viscosidad', min: 90, max: 110, rango: '90-110', unidad: 'KU', tipo: 'number' }],
      }],
    });
    renderModal();
    expect(await screen.findByText(/Rango: 90-110 KU/)).toBeInTheDocument();
  });

  it('muestra la lectura que el wizard dejó en el lote (no re-capturar a ciegas)', async () => {
    renderModal();
    /* qcReadings.viscosidad=95 y ph=8.2 vienen dentro del objeto lote */
    expect(await screen.findByText('95')).toBeInTheDocument();
    expect(screen.getByText('8.2')).toBeInTheDocument();
  });

  it('valor fuera de rango pinta el aviso y bloquea Aprobar hasta justificar (≥5 chars)', async () => {
    renderModal();
    await screen.findByText(/Rango: 80-120 KU/);
    await userEvent.type(screen.getByPlaceholderText('Ej: 85'), '130');

    /* aviso ámbar bajo el campo + panel de justificación */
    expect(screen.getByText(/Fuera de rango — Rango: 80-120 KU/)).toBeInTheDocument();
    expect(screen.getByText(/Fuera de rango: Viscosidad \(KU\)/)).toBeInTheDocument();

    const aprobar = screen.getByRole('button', { name: /Aprobar QC/ });
    expect(aprobar).toBeDisabled();

    /* nota corta (<5) sigue bloqueando */
    const nota = screen.getByLabelText(/Justificación para aprobar/);
    await userEvent.type(nota, 'ok');
    expect(aprobar).toBeDisabled();
    expect(api.transicionLote).not.toHaveBeenCalled();

    /* nota suficiente desbloquea y aprueba */
    await userEvent.type(nota, ' — instrucción del dueño');
    expect(aprobar).toBeEnabled();
    await userEvent.click(aprobar);
    await waitFor(() => expect(api.transicionLote).toHaveBeenCalled());
  });

  it('valor en rango aprueba sin pedir nota de justificación', async () => {
    renderModal();
    await screen.findByText(/Rango: 80-120 KU/);
    await userEvent.type(screen.getByPlaceholderText('Ej: 85'), '95');
    await userEvent.type(screen.getByPlaceholderText('Ej: 8.5'), '8.2');

    expect(screen.queryByText(/Justificación para aprobar/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Aprobar QC/ }));

    await waitFor(() => expect(api.transicionLote).toHaveBeenCalledWith('L1', 'aprobarQC',
      expect.objectContaining({
        usuario: 'Enrique',
        qc: expect.objectContaining({ viscosidad: 95, ph: 8.2 }),
      })));
    /* sin fuera-de-rango NO viaja notaFueraDeRango */
    const qcEnviado = api.transicionLote.mock.calls[0][2].qc;
    expect(qcEnviado.notaFueraDeRango).toBeUndefined();
  });

  it('la justificación viaja en el payload de la transición y en el ledger QC', async () => {
    renderModal();
    await screen.findByText(/Rango: 80-120 KU/);
    await userEvent.type(screen.getByPlaceholderText('Ej: 85'), '130');
    await userEvent.type(screen.getByLabelText(/Justificación para aprobar/), 'viscosímetro en calibración');
    await userEvent.click(screen.getByRole('button', { name: /Aprobar QC/ }));

    await waitFor(() => expect(api.transicionLote).toHaveBeenCalledWith('L1', 'aprobarQC',
      expect.objectContaining({
        qc: expect.objectContaining({
          viscosidad: 130,
          notaFueraDeRango: 'viscosímetro en calibración',
        }),
      })));
    await waitFor(() => expect(api.registrarQC).toHaveBeenCalledWith(
      expect.objectContaining({ notaFueraDeRango: 'viscosímetro en calibración', resultado: 'aprobado' })));
  });
});
