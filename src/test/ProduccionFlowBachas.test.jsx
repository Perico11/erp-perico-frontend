/* ════════════════════════════════════════════════════════════════════════════
   EL FLUJO YA NO PIDE DOS TANQUES EN UNO (25-ago-2026).

   Complemento de BachasPorTote.test.js: aquel fija la aritmética del tanque,
   éste fija que el FLUJO de producción arranque ya partido. Es la diferencia
   entre tener la regla y aplicarla — el bug del dueño fue exactamente eso:
   el multi-bacha existía desde junio, pero el default era 1 y nadie lo subía.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProduccionFlow from '../pages/produccion/ProduccionFlow';

vi.mock('../services/api', () => ({
  default: {
    getProduccionSteps: vi.fn(),
    getFormulas: vi.fn(),
    getMaestroMP: vi.fn(),
    getCheckpoint: vi.fn(),
    guardarCheckpoint: vi.fn(),
    borrarCheckpoint: vi.fn(),
  },
}));
import api from '../services/api';

/* SecureView monta marca de agua/anti-captura y no aporta al caso. */
vi.mock('../components/SecureView', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const STEPS = [{
  type: 'prep', titulo: 'Preparación', desc: 'Pesar materia prima',
  grupos: { agua: [{ nombre: 'AGUA', kg19: 400 / 52 }] },
}];

/* Un pedido de 2 totes tal como lo guarda NuevoPedidoModal: la cantidad ya
   viene en cubeta-equivalente (104) y la medida original queda aparte. */
const pedido2Totes = {
  _tipo: 'pedido', _raw: {}, id: 'PA-MT0KCLN9', codigo: 'PA-MT0KCLN9',
  formula: 'BLANCO OFFWHITE', cantidad: 104, medida: 'tote', medidaQty: 2,
  esPrueba: false, estado: 'en_produccion',
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getProduccionSteps.mockResolvedValue({ ok: true, steps: STEPS });
  api.getFormulas.mockResolvedValue({ formulas: {} });
  api.getMaestroMP.mockResolvedValue({ mps: {} });
  api.getCheckpoint.mockResolvedValue(null);
});

const montar = (item) =>
  render(<ProduccionFlow item={item} userName="Enrique" onClose={() => {}} onSuccess={() => {}} />);

describe('bachas por capacidad de tanque', () => {
  it('un pedido de 2 totes ABRE ya partido en 2 bachas', async () => {
    montar(pedido2Totes);
    /* El stepper muestra el número de bachas; antes decía 1. */
    await waitFor(() => {
      expect(screen.getByLabelText('Más bachas')).toBeInTheDocument();
    });
    const stepper = screen.getByLabelText('Más bachas').parentElement;
    expect(stepper.textContent).toContain('2');
  });

  it('explica POR QUÉ viene partido, en litros y tanques', async () => {
    montar(pedido2Totes);
    await waitFor(() => {
      expect(screen.getByText(/no cabe en una sola mezcla/)).toBeInTheDocument();
    });
    /* 104 cub × 19 L = 1,976 L contra un tanque de 988 L. */
    expect(screen.getByText(/1,976/)).toBeInTheDocument();
    expect(screen.getByText(/988/)).toBeInTheDocument();
  });

  it('un pedido de UN tote no cambia en nada (sin aviso, sin reparto)', async () => {
    montar({ ...pedido2Totes, cantidad: 52, medidaQty: 1 });
    await waitFor(() => expect(screen.getByLabelText('Más bachas')).toBeInTheDocument());

    const stepper = screen.getByLabelText('Más bachas').parentElement;
    expect(stepper.textContent).toContain('1');
    expect(screen.queryByText(/no cabe en una sola mezcla/)).not.toBeInTheDocument();
  });

  it('un pedido en cubetas sueltas tampoco se parte', async () => {
    montar({ ...pedido2Totes, cantidad: 20, medida: 'cubeta', medidaQty: 20 });
    await waitFor(() => expect(screen.getByLabelText('Más bachas')).toBeInTheDocument());
    const stepper = screen.getByLabelText('Más bachas').parentElement;
    expect(stepper.textContent).toContain('1');
  });

  it('el reparto se rotula en cubetas, no en "tote"', async () => {
    /* Decía "104 / 104 tote" — cantBachas está en la unidad de `cantidad`. */
    montar(pedido2Totes);
    await waitFor(() => expect(screen.getByText(/Reparto:/)).toBeInTheDocument());
    expect(screen.getByText(/Reparto:/).textContent).toMatch(/104 \/ 104 cub/);
    expect(screen.getByText(/Reparto:/).textContent).not.toMatch(/tote/);
  });

  it('reparte parejo: 52 y 52', async () => {
    montar(pedido2Totes);
    await waitFor(() => expect(screen.getByText(/Reparto:/)).toBeInTheDocument());
    const inputs = screen.getAllByRole('spinbutton');
    const valores = inputs.slice(0, 2).map(i => Number(i.value));
    expect(valores).toEqual([52, 52]);
  });
});
