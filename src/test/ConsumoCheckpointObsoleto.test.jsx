/* ════════════════════════════════════════════════════════════════════════════
   DESCONTÓ MP PARA 2 LOTES DESPUÉS DE CORREGIR A 1 (25-ago-2026).

   El dueño corrigió la orden de BLANCO OFFWHITE a 1 tote y al cerrar la
   producción el ERP descontó materia prima como si fueran 2. Lo notó en el
   dióxido de titanio.

   La causa NO era la corrección: era el checkpoint. ProduccionFlow autoguarda
   `consumoReal` cada 15s, y al reabrir lo restauraba VERBATIM — con los kg
   calculados para las 104 cubetas de antes. Y `descuentos` (lo que se le
   descuenta a almacén) sale de `consumoReal`, no de `item.cantidad`. Así que
   corregir la cantidad arreglaba el tamaño del lote y el PT, pero NO lo que
   salía de inventario: 1 tote producido, 2 totes de MP descontada.

   El `teorico` de cada renglón es siempre kg19 × cantidad, así que comparar
   contra la fórmula fresca delata el desfase. Si no cuadra, el consumo guardado
   es de otra tirada y se reconstruye.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProduccionFlow from '../pages/produccion/ProduccionFlow';

vi.mock('../services/api', () => ({
  default: {
    getProduccionSteps: vi.fn(), getFormulas: vi.fn(), getMaestroMP: vi.fn(),
    getProduccionCheckpoint: vi.fn(), saveProduccionCheckpoint: vi.fn(),
    clearProduccionCheckpoint: vi.fn(),
  },
}));
import api from '../services/api';
vi.mock('../components/SecureView', () => ({ default: ({ children }) => <div>{children}</div> }));

/* Paso de ajustes: es donde vive la tabla de consumo real. */
const STEPS = [{ type: 'ajustes', titulo: 'Consumo real', desc: 'Ajusta lo que usaste' }];

const KG19_TIO2 = 0.50301; /* como en la fórmula real del offwhite */
const FORMULA = {
  'BLANCO OFFWHITE': {
    ingredientes: [
      { nombre: 'DIOXIDO DE TITANIO R2196+', kg19: KG19_TIO2 },
      { nombre: 'AGUA', kg19: 400 / 52 },
    ],
  },
};

/* La orden YA corregida a 1 tote (52 cub)… */
const ITEM_1_TOTE = {
  _tipo: 'pedido', _raw: {}, id: 'PA-MT0KCLN9', codigo: 'PA-MT0KCLN9',
  formula: 'BLANCO OFFWHITE', cantidad: 52, medida: 'tote', medidaQty: 1, esPrueba: false,
};

/* …pero con un checkpoint guardado cuando eran 2 totes (104 cub). */
const CHECKPOINT_VIEJO = {
  checkpoint: {
    state: {
      curStep: 0,
      consumoReal: [
        { mp: 'DIOXIDO DE TITANIO R2196+', teorico: +(KG19_TIO2 * 104).toFixed(3), real: +(KG19_TIO2 * 104).toFixed(3), sustituyeA: null, esExtra: false, motivo: '' },
        { mp: 'AGUA', teorico: 800, real: 800, sustituyeA: null, esExtra: false, motivo: '' },
      ],
      numBachas: 2,
      cantBachas: [52, 52],
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getProduccionSteps.mockResolvedValue({ ok: true, steps: STEPS });
  api.getFormulas.mockResolvedValue({ formulas: FORMULA });
  api.getMaestroMP.mockResolvedValue({ mps: {} });
  api.getProduccionCheckpoint.mockResolvedValue(null);
});

const montar = (item = ITEM_1_TOTE) =>
  render(<ProduccionFlow item={item} userName="Enrique" onClose={() => {}} onSuccess={() => {}} />);

describe('consumo restaurado de una cantidad distinta', () => {
  it('el checkpoint de 2 totes NO impone su consumo sobre una orden de 1', async () => {
    api.getProduccionCheckpoint.mockResolvedValue(CHECKPOINT_VIEJO);
    montar();

    /* Lo correcto para 52 cubetas, no las 104 del checkpoint. */
    const esperadoTiO2 = (KG19_TIO2 * 52).toFixed(2);
    const viejoTiO2 = (KG19_TIO2 * 104).toFixed(2);
    await waitFor(() => {
      expect(screen.getByText(esperadoTiO2)).toBeInTheDocument();
    });
    expect(screen.queryByText(viejoTiO2)).not.toBeInTheDocument();
    expect(screen.getByText('400.00')).toBeInTheDocument();   /* agua para 1 tote */
    expect(screen.queryByText('800.00')).not.toBeInTheDocument();
  });

  it('lo DICE, para que el operario recapture lo que hubiera ajustado', async () => {
    api.getProduccionCheckpoint.mockResolvedValue(CHECKPOINT_VIEJO);
    montar();
    await waitFor(() => {
      expect(screen.getByText(/Se recalculó el consumo/)).toBeInTheDocument();
    });
  });

  it('un checkpoint que SÍ corresponde a la cantidad se respeta tal cual', async () => {
    /* Incluidos los ajustes a mano del operario: real ≠ teórico se conserva. */
    api.getProduccionCheckpoint.mockResolvedValue({
      checkpoint: { state: { curStep: 0, numBachas: 1, cantBachas: [52], consumoReal: [
        { mp: 'DIOXIDO DE TITANIO R2196+', teorico: +(KG19_TIO2 * 52).toFixed(3), real: 30, sustituyeA: null, esExtra: false, motivo: 'se usó menos' },
        { mp: 'AGUA', teorico: 400, real: 400, sustituyeA: null, esExtra: false, motivo: '' },
      ] } },
    });
    montar();

    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeInTheDocument());
    expect(screen.queryByText(/Se recalculó el consumo/)).not.toBeInTheDocument();
  });

  it('sin checkpoint se calcula de la fórmula, como siempre', async () => {
    montar();
    await waitFor(() => {
      expect(screen.getByText((KG19_TIO2 * 52).toFixed(2))).toBeInTheDocument();
    });
    expect(screen.queryByText(/Se recalculó el consumo/)).not.toBeInTheDocument();
  });
});
