/* ════════════════════════════════════════════════════════════════════════════
   EL COMPARADOR QUE NO COMPARABA NADA (25-ago-2026).

   El dueño abrió "Comparar fórmulas" y TODAS las métricas salían "–". No es
   que faltara el dato: el modal lo pedía donde no vive.

     · Los económicos (costo, precio, margen, producción) no viajan en
       /api/formulas/todas — ese endpoint dice en su comentario "NO incluye
       datos de costo". Ahora se leen de /api/reports/margenes, que ya los
       calcula por fórmula con los costos auxiliares configurables.
     · Los técnicos (PVC, densidad, viscosidad, sólidos, finish) viven
       ANIDADOS bajo `tecnico` en formulas_custom, y se leían al nivel
       superior: salían vacíos aunque estuvieran capturados.

   Y un tercer detalle que hacía ver el modal como roto aunque tuviera datos:
   las dos tarjetas se titulaban con el nombre de cada fórmula, pero agrupan
   MÉTRICAS (económicas / técnicas) y cada renglón trae los dos valores. Se ve
   igual que si a la fórmula de la izquierda le faltaran los datos técnicos.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import CompararFormulasModal from '../pages/formulas/CompararFormulasModal';

vi.mock('../services/api', () => ({
  default: { getMargenes: vi.fn() },
}));
import api from '../services/api';

/* Como llegan de /api/formulas/todas: técnicos ANIDADOS bajo `tecnico`. */
const FORMULAS = [
  {
    nombre: 'AMARILLO CANARIO ASTRA',
    ingredientes: [{ nombre: 'RESINA', kg19: 8 }, { nombre: 'AGUA', kg19: 4 }],
    tecnico: { pvc: 42, densidad: 1.24, viscosidad: 95, solidosPeso: 55, solidosVolumen: 38, finish: 'Mate' },
  },
  {
    nombre: 'AMARILLO MEDIO ASTRA',
    ingredientes: [{ nombre: 'RESINA', kg19: 7 }, { nombre: 'AGUA', kg19: 4 }, { nombre: 'OXIDO', kg19: 1 }],
    tecnico: { pvc: 47, densidad: 1.31, viscosidad: 102, solidosPeso: 58, solidosVolumen: 41, finish: 'Satín' },
  },
];

const MARGENES = {
  ok: true,
  productos: [
    { nombre: 'AMARILLO CANARIO ASTRA', costoMP: 520.5, costoTotal: 640.25, precioVenta: 1000, margenPct: 36, prodMensual: 26 },
    { nombre: 'AMARILLO MEDIO ASTRA', costoMP: 610.75, costoTotal: 735.1, precioVenta: 1100, margenPct: 33.2, prodMensual: 12 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getMargenes.mockResolvedValue(MARGENES);
});

describe('Comparar fórmulas', () => {
  it('muestra los económicos que vienen de /api/reports/margenes', async () => {
    render(<CompararFormulasModal formulas={FORMULAS} onClose={() => {}} />);
    await waitFor(() => expect(api.getMargenes).toHaveBeenCalled());

    /* Costo, precio, margen y producción de AMBAS fórmulas, no "–". */
    await waitFor(() => {
      expect(screen.getByText('$520.50')).toBeInTheDocument();
      expect(screen.getByText('$610.75')).toBeInTheDocument();
    });
    expect(screen.getByText('$640.25')).toBeInTheDocument();
    expect(screen.getByText('$735.10')).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('36%')).toBeInTheDocument();
    expect(screen.getByText('33.2%')).toBeInTheDocument();
    expect(screen.getByText('26')).toBeInTheDocument();
  });

  it('lee los técnicos anidados bajo `tecnico` (antes se leían al nivel superior)', async () => {
    render(<CompararFormulasModal formulas={FORMULAS} onClose={() => {}} />);
    await waitFor(() => expect(api.getMargenes).toHaveBeenCalled());

    expect(screen.getByText('42')).toBeInTheDocument();      /* PVC A */
    expect(screen.getByText('47')).toBeInTheDocument();      /* PVC B */
    expect(screen.getByText('1.24')).toBeInTheDocument();    /* densidad A */
    expect(screen.getByText('102')).toBeInTheDocument();     /* viscosidad B */
    expect(screen.getByText('Mate')).toBeInTheDocument();
    expect(screen.getByText('Satín')).toBeInTheDocument();
  });

  it('sigue leyendo los técnicos al nivel superior (compat formulas_v2)', async () => {
    const planas = [
      { nombre: 'PLANA A', ingredientes: [], pvc: 30, densidad: 1.1, finish: 'Brillante' },
      { nombre: 'PLANA B', ingredientes: [], pvc: 33, densidad: 1.2, finish: 'Mate' },
    ];
    render(<CompararFormulasModal formulas={planas} onClose={() => {}} />);
    await waitFor(() => expect(api.getMargenes).toHaveBeenCalled());

    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('1.2')).toBeInTheDocument();
    expect(screen.getByText('Brillante')).toBeInTheDocument();
  });

  it('las tarjetas se titulan por GRUPO de métricas, con leyenda A/B de cada fórmula', async () => {
    render(<CompararFormulasModal formulas={FORMULAS} onClose={() => {}} />);
    await waitFor(() => expect(api.getMargenes).toHaveBeenCalled());

    /* El título dice qué contiene la tarjeta, no el nombre de una fórmula:
       ambas columnas traen las dos fórmulas. */
    expect(screen.getByText(/Económicos/)).toBeInTheDocument();
    expect(screen.getByText('Técnicos')).toBeInTheDocument();
    /* Y se rotula cuál columna es cuál: la leyenda (1) + el encabezado de
       cada una de las dos tarjetas (2) = 3 apariciones de "A" y de "B". */
    expect(screen.getAllByText('A')).toHaveLength(3);
    expect(screen.getAllByText('B')).toHaveLength(3);
    /* La leyenda LIGA cada letra con su fórmula (el nombre también sale en
       los <select>, así que se comprueba el emparejamiento, no su presencia). */
    const ligada = (letra, nombre) => screen.getAllByText(letra)
      .some(el => el.parentElement?.textContent?.includes(nombre));
    expect(ligada('A', 'AMARILLO CANARIO ASTRA')).toBe(true);
    expect(ligada('B', 'AMARILLO MEDIO ASTRA')).toBe(true);
  });

  it('si los costos no cargan lo DICE, en vez de dejar guiones mudos', async () => {
    api.getMargenes.mockRejectedValue(new Error('403 sin permisos'));
    render(<CompararFormulasModal formulas={FORMULAS} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/No se pudieron cargar los costos y precios/)).toBeInTheDocument();
    });
    /* Los técnicos siguen bien aunque los económicos fallen. */
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('avisa cuándo el margen sale vacío por falta de precio capturado', async () => {
    api.getMargenes.mockResolvedValue({
      ok: true,
      productos: [
        { nombre: 'AMARILLO CANARIO ASTRA', costoMP: 520.5, costoTotal: 640.25, precioVenta: 0, margenPct: null, prodMensual: 26 },
        { nombre: 'AMARILLO MEDIO ASTRA', costoMP: 610.75, costoTotal: 735.1, precioVenta: 0, margenPct: null, prodMensual: 12 },
      ],
    });
    render(<CompararFormulasModal formulas={FORMULAS} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Sin precio de venta capturado/)).toBeInTheDocument();
    });
  });

  it('avisa cuando ninguna fórmula tiene datos técnicos capturados', async () => {
    const sinTec = [
      { nombre: 'SIN TEC A', ingredientes: [{ nombre: 'X', kg19: 1 }] },
      { nombre: 'SIN TEC B', ingredientes: [{ nombre: 'Y', kg19: 2 }] },
    ];
    render(<CompararFormulasModal formulas={sinTec} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Ninguna de las dos fórmulas tiene datos técnicos/)).toBeInTheDocument();
    });
  });

  it('la comparación de ingredientes sigue intacta', async () => {
    render(<CompararFormulasModal formulas={FORMULAS} onClose={() => {}} />);
    await waitFor(() => expect(api.getMargenes).toHaveBeenCalled());

    const resumen = screen.getByText(/Ingredientes comparados/);
    expect(within(resumen).getByText(/3 totales/)).toBeInTheDocument();
    expect(within(resumen).getByText(/2 comunes/)).toBeInTheDocument();
    expect(within(resumen).getByText(/1 diferentes/)).toBeInTheDocument();
  });
});
