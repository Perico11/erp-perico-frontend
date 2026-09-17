/* ════════════════════════════════════════════════════════════════════════════
   EL AVISO DE CONSUMO QUE NO LE LLEGABA A NADIE (16-sep-2026).

   La auditoría del 15-sep añadió al servidor una revisión de cordura sobre lo
   que se descuenta al producir (FL-02). Lo que no tiene lectura posible lo
   RECHAZA; lo que solo llama la atención —un consumo muy por debajo del
   teórico, que puede ser un reproceso legítimo— lo deja pasar y lo devuelve en
   la respuesta, en `avisos`.

   Pero la pantalla tiraba esa respuesta. El aviso viajaba entero desde el
   servidor y moría ahí: quedaba en el registro del servidor, donde no lo lee
   nadie, y Enrique cerraba el lote sin enterarse de que había consumido una
   fracción de lo que la fórmula pedía. Un aviso que no llega a quien decide no
   es un aviso.

   Se comprueba montando el flujo de verdad y llegando a la pantalla de éxito,
   no leyendo el fuente: lo que importa es que el técnico LO VEA.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProduccionFlow from '../pages/produccion/ProduccionFlow';

vi.mock('../services/api', () => ({
  default: {
    getProduccionSteps: vi.fn(), getFormulas: vi.fn(), getMaestroMP: vi.fn(),
    getProduccionCheckpoint: vi.fn(), saveProduccionCheckpoint: vi.fn(),
    clearProduccionCheckpoint: vi.fn(), registrarProduccion: vi.fn(),
    crearLote: vi.fn(), transicionLote: vi.fn(),
    upsertOrden: vi.fn(), upsertPedido: vi.fn(),
  },
}));
import api from '../services/api';
vi.mock('../components/SecureView', () => ({ default: ({ children }) => <div>{children}</div> }));

/* Un solo paso y sin QC: el botón de terminar queda habilitado de entrada. */
const STEPS = [{ type: 'ajustes', titulo: 'Consumo real', desc: 'Ajusta lo que usaste' }];
const FORMULA = { 'BLANCO QA': { ingredientes: [{ nombre: 'TIO2', kg19: 1 }] } };
const ITEM = { id: 'ORD-1', _tipo: 'orden', codigo: 'OP-1', formula: 'BLANCO QA', cantidad: 1 };

const montar = () => render(
  <ProduccionFlow item={ITEM} userName="Enrique" onClose={() => {}} onSuccess={() => {}} />,
);
const terminar = async () => {
  const btn = await screen.findByRole('button', { name: /terminar lote/i });
  fireEvent.click(btn);
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getProduccionSteps.mockResolvedValue({ ok: true, steps: STEPS });
  api.getFormulas.mockResolvedValue({ formulas: FORMULA });
  api.getMaestroMP.mockResolvedValue({ mps: {} });
  api.getProduccionCheckpoint.mockResolvedValue(null);
  api.saveProduccionCheckpoint.mockResolvedValue({ ok: true });
  api.clearProduccionCheckpoint.mockResolvedValue({ ok: true });
  api.crearLote.mockResolvedValue({ ok: true, lote: { codigoLote: 'LP-0001-001', estado: 'producido' } });
  api.transicionLote.mockResolvedValue({ ok: true });
  api.upsertOrden.mockResolvedValue({ ok: true });
  api.upsertPedido.mockResolvedValue({ ok: true });
});

describe('el aviso de cordura del servidor llega a la pantalla', () => {
  it('un consumo muy bajo se le enseña al técnico, con el lote ya registrado', async () => {
    api.registrarProduccion.mockResolvedValue({
      ok: true,
      avisos: ['Consumo muy bajo: 0.4 kg frente a 19 kg teóricos.'],
    });
    montar();
    await terminar();

    await waitFor(() => expect(screen.getByText(/lote completado/i)).toBeInTheDocument());
    /* El lote SÍ quedó: no se le dice que falló algo que no falló. */
    expect(screen.getByText(/el lote quedó registrado, pero revisa esto/i)).toBeInTheDocument();
    expect(screen.getByText(/consumo muy bajo: 0\.4 kg frente a 19 kg teóricos/i)).toBeInTheDocument();
  });

  it('varios avisos se enumeran, no se pisan', async () => {
    api.registrarProduccion.mockResolvedValue({
      ok: true, avisos: ['Primer aviso de prueba.', 'Segundo aviso de prueba.'],
    });
    montar();
    await terminar();

    await waitFor(() => expect(screen.getByText(/lote completado/i)).toBeInTheDocument());
    expect(screen.getByText(/primer aviso de prueba/i)).toBeInTheDocument();
    expect(screen.getByText(/segundo aviso de prueba/i)).toBeInTheDocument();
  });

  it('sin avisos la pantalla queda limpia, como hasta hoy', async () => {
    api.registrarProduccion.mockResolvedValue({ ok: true });
    montar();
    await terminar();

    await waitFor(() => expect(screen.getByText(/lote completado/i)).toBeInTheDocument());
    expect(screen.queryByText(/revisa esto/i)).toBeNull();
    expect(document.querySelector('[data-id="avisos-produccion"]')).toBeNull();
  });

  it('una respuesta sin `avisos` no rompe el cierre', async () => {
    /* El servidor solo incluye el campo cuando hay algo que decir. */
    api.registrarProduccion.mockResolvedValue({ ok: true, avisos: null });
    montar();
    await terminar();
    await waitFor(() => expect(screen.getByText(/lote completado/i)).toBeInTheDocument());
  });
});
