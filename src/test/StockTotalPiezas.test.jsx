/* Stock ▸ Total del PT con PIEZAS (15-sep-2026, propuesta A) — vista completa.
   Queja del dueño: "la lógica dice que tengo n cantidad de cubetas, pero esto
   no es exacto: los stock vienen en tote (llenos o parciales), cubetas,
   galones y algunos en litros envasados… además solo deja modificar la
   sección total y no lo que hay en fábrica y lo que hay en Terán".
   Aquí se fija lo que el usuario VE en la tabla: chips con las piezas reales,
   la existencia en litros con el cubeta-equivalente, el reparto por ubicación,
   y que "Contar" abre la ficha por ubicación (no el ajuste del total). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* Fábrica: 1 tote lleno + 12 cubetas = 64 cub (1,216 L).
   Terán: 1 tote ABIERTO con 344 L + 17 cubetas + 21 galones + 6 litros
   = 39.587 cub (752.16 L). Total = 103.587 cub ≈ 1,968 L. */
const PT_UBI = {
  ok: true,
  fabrica: { 'BLANCO OFFWHITE 4.0': { cubeta: 12, galon: 0, litro: 0, tote: 1, atm: 0, otros: 0, granel: 0, residual: 0 } },
  teran:   {
    'BLANCO OFFWHITE 4.0': { cubeta: 17, galon: 21, litro: 6, tote: 1, atm: 0, otros: 0, granel: 18.105, manual: 0 },
    'AZUL REY 4.0': { cubeta: 11, galon: 0, litro: 0, tote: 0, atm: 0, otros: 0, granel: 0, manual: 0 },
  },
  total:   {
    'BLANCO OFFWHITE 4.0': { cubeta: 29, galon: 21, litro: 6, tote: 2, atm: 0, otros: 0, granel: 18.105 },
    'AZUL REY 4.0': { cubeta: 11, galon: 0, litro: 0, tote: 0, atm: 0, otros: 0, granel: 0 },
  },
  descuadres: {},
};
const TRAZA = [{
  producto: 'BLANCO OFFWHITE 4.0', estado: 'en_almacen', codigoLote: 'LP-2026-010',
  sublotes: [
    { cod: 'SL-TOTE', tipo: 'tote', estado: 'tote_activo', ub: 'teran', litrosRestante: 344 },
    { cod: 'SL-CUB', tipo: 'cubeta', estado: 'en_stock_teran', qty: 17, lit: 323, ub: 'teran' },
  ],
}];
/* AZUL REY está agotado en Fábrica pero tiene 11 cub en Terán; ROJO ÓXIDO no
   tiene nada en ningún lado. */
const INV = { ok: true, data: { mp: {}, pt: {
  'BLANCO OFFWHITE 4.0': { qty: 64, teran: 39.587, min: 30, sku: 'PT-BOW-CUB' },
  'AZUL REY 4.0': { qty: 0, teran: 11, min: 20, sku: 'PT-ARY-CUB' },
  'ROJO ÓXIDO 4.0': { qty: 0, min: 15, sku: 'PT-ROX-CUB' },
} } };

/* La página monta media pantalla de Inventarios (tarjeta canónica, americano,
   menús…). Se declara lo que importa para este caso y cualquier otra llamada
   responde vacío, en vez de reventar el render con "no es una función". */
vi.mock('../services/api', () => {
  const declarados = {
    getInventario: vi.fn(() => Promise.resolve(INV)),
    getMaestroMP: vi.fn(() => Promise.resolve({ ok: true, data: { mps: {} } })),
    getEnvases: vi.fn(() => Promise.resolve({ ok: true, data: { categorias: {}, tapas: {} } })),
    getReportValuation: vi.fn(() => Promise.resolve(null)),
    getPTPorUbicacion: vi.fn(() => Promise.resolve(PT_UBI)),
    getMPPorUbicacion: vi.fn(() => Promise.resolve({ ok: true, fabrica: {}, teran: {} })),
    getTrazabilidad: vi.fn(() => Promise.resolve({ ok: true, data: TRAZA })),
    getAjustesPendientes: vi.fn(() => Promise.resolve({ ok: true, pendientes: [] })),
    getFormulasSummary: vi.fn(() => Promise.resolve({ ok: true, summary: [{ nombre: 'BLANCO OFFWHITE 4.0' }] })),
    getStkAmericano: vi.fn(() => Promise.resolve(null)),
    getPTOcultos: vi.fn(() => Promise.resolve({ ok: true, ocultos: {} })),
    ptConteo: vi.fn(() => Promise.resolve({ ok: true })),
    urlExportInv: () => '', urlPrintInv: () => '', urlImportInvPT: () => '', urlImportInv: () => '', urlImportEnvases: () => '',
  };
  const vacio = vi.fn(() => Promise.resolve({ ok: true, data: [] }));
  return {
    default: new Proxy(declarados, {
      get: (t, k) => (typeof k !== 'string' || k in t ? t[k] : vacio),
    }),
  };
});
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { nombre: 'Emmanuel', rol: 'admin' }, can: () => true }),
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));
vi.mock('../components/layout/TopBar', () => ({ default: ({ title }) => <div>{title}</div> }));

import api from '../services/api';
import InventarioPage from '../pages/inventario/InventarioPage';

const abrirPT = async () => {
  await act(async () => { render(<MemoryRouter initialEntries={['/inventario?tab=pt']}><InventarioPage /></MemoryRouter>); });
  await waitFor(() => expect(api.getPTPorUbicacion).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });
  return screen.getByText('BLANCO OFFWHITE 4.0').closest('tr');
};

describe('Stock ▸ Total del PT · piezas por presentación', () => {
  beforeEach(() => vi.clearAllMocks());

  it('la fila dice las piezas reales, no un total en cubetas', async () => {
    const fila = await abrirPT();
    expect(within(fila).getByText('1 tote lleno')).toBeInTheDocument();
    expect(within(fila).getByText('1 tote parcial · 344 L')).toBeInTheDocument();
    expect(within(fila).getByText('29 cubetas')).toBeInTheDocument();
    expect(within(fila).getByText('21 galones')).toBeInTheDocument();
    expect(within(fila).getByText('6 litros')).toBeInTheDocument();
  });

  it('la existencia se lee en litros con el cubeta-equivalente debajo', async () => {
    const fila = await abrirPT();
    expect(within(fila).getByText(/1,968.2 L/)).toBeInTheDocument();
    expect(within(fila).getByText(/≈ 103.6 cub/)).toBeInTheDocument();
  });

  it('dice cuánto hay en cada ubicación (Fábrica y Terán, no solo el total)', async () => {
    const fila = await abrirPT();
    expect(within(fila).getByText('Fábrica 1,216 L · Terán 752.2 L')).toBeInTheDocument();
  });

  it('"Ver en: Cubetas" vuelve a la unidad de siempre', async () => {
    const fila = await abrirPT();
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Cubetas' })); });
    expect(within(fila).getByText(/103.6 cub/)).toBeInTheDocument();
    expect(within(fila).getByText(/≈ 1,968.2 L/)).toBeInTheDocument();
  });

  it('el KPI "Totes abiertos" saca a la luz el granel del piso', async () => {
    await abrirPT();
    const kpi = screen.getByText('Totes abiertos').parentElement;
    expect(within(kpi).getByText('1')).toBeInTheDocument();
    expect(within(kpi).getByText('344 L a granel en el piso')).toBeInTheDocument();
  });

  it('"Contar" abre la ficha por UBICACIÓN y guarda el conteo de esa ubicación', async () => {
    const fila = await abrirPT();
    await act(async () => { fireEvent.click(within(fila).getByRole('button', { name: 'Contar' })); });
    expect(screen.getByText('Contar existencia')).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Terán · 752.2 L/ })); });
    /* El tote abierto de Terán se precarga como 344 L, no como tote lleno. */
    expect(document.querySelector('[data-id="inventario.contar.tote"]').value).toBe('0');
    expect(document.querySelector('[data-id="inventario.contar.granelL"]').value).toBe('344');
    await act(async () => {
      fireEvent.change(document.querySelector('[data-id="inventario.contar.galon"]'), { target: { value: '19' } });
    });
    await act(async () => {
      fireEvent.change(document.querySelector('[data-id="inventario.contar.motivo"]'), { target: { value: 'Conteo físico' } });
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Guardar conteo de Terán/ })); });

    await waitFor(() => expect(api.ptConteo).toHaveBeenCalledTimes(1));
    const [producto, ubicacion, piezas, nota] = api.ptConteo.mock.calls[0];
    expect(producto).toBe('BLANCO OFFWHITE 4.0');
    expect(ubicacion).toBe('teran');
    expect(piezas).toEqual({ tote: 0, granelL: 344, cubeta: 17, galon: 19, litro: 6, atomizador750: 0 });
    expect(nota).toBe('Conteo físico');
  });

  it('los KPIs cuentan el TOTAL, como la fila: con stock en Terán no es crítico', async () => {
    await abrirPT();
    /* AZUL REY: 0 en Fábrica pero 11 cub en Terán → bajo, no crítico. Antes el
       KPI lo contaba por el escalar de Fábrica y contradecía a su propia fila. */
    const fila = screen.getByText('AZUL REY 4.0').closest('tr');
    expect(within(fila).getByText('Bajo')).toBeInTheDocument();
    expect(within(screen.getByText('En crítico').parentElement).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByText('Stock bajo').parentElement).getByText('1')).toBeInTheDocument();
  });

  it('"Editar ficha" (nombre/SKU/mínimo) sigue disponible en el menú ⋯', async () => {
    const fila = await abrirPT();
    await act(async () => { fireEvent.click(within(fila).getByRole('button', { name: /Acciones/ })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Editar ficha/ })); });
    expect(screen.getByText('Ajustar existencia')).toBeInTheDocument();
    /* Esa ficha escribe el escalar de FÁBRICA: lo dice en el subtítulo. */
    expect(screen.getByText(/BLANCO OFFWHITE 4.0 · Fábrica/)).toBeInTheDocument();
  });
});
