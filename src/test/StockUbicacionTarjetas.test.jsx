/* La MISMA tarjeta en PT ▸ Fábrica y PT ▸ Terán (17-sep-2026, pedido dueño:
   "ese mismo diseño lo tenga en PT > Fábrica y Terán, no solo la pestaña de
   Total… cada card trae su propia necesidad").

   Lo que se fija aquí es justo esa "propia necesidad": que cada pestaña hable
   de SU bodega —sus piezas, sus litros, sus totes— y traiga los botones que
   aplican ahí, conectados al flujo que ya tenían: Pedir, Envasar (el modal de
   esa ubicación, no el otro), → Terán sólo desde Fábrica, y Ajustar abriendo
   la ficha YA en esa ubicación. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* Mismos datos del caso del piso: Fábrica 1 tote lleno + 12 cubetas = 64 cub;
   Terán 1 tote ABIERTO con 344 L + 17 cub + 21 gal + 6 L = 39.587 cub. */
const PT_UBI = {
  ok: true,
  fabrica: {
    'BLANCO OFFWHITE 4.0': {
      cubeta: 12, galon: 0, litro: 0, tote: 1, atm: 0, otros: 0, granel: 0, residual: 0, sublotes: 2,
      cubEquiv: 64, transferible: 64, descuadre: 0,
      totesFisicos: { total: 1, parciales: 0, detalle: [{ cod: 'SL-FAB', toteCod: 'LP-2026-010-A', litrosRestante: 988 }] },
    },
  },
  teran: {
    'BLANCO OFFWHITE 4.0': {
      cubeta: 17, galon: 21, litro: 6, tote: 1, atm: 0, otros: 0, granel: 18.105, manual: 0, sublotes: 3,
      teranPresScalar: { tote: 1, granel: 18.105, cubeta: 17, galon: 21, litro: 6 },
      totesFisicos: { total: 1, parciales: 1, detalle: [{ cod: 'SL-TOTE', toteCod: 'LP-2026-010-B', litrosRestante: 344 }] },
    },
    'AZUL REY 4.0': { cubeta: 11, galon: 0, litro: 0, tote: 0, atm: 0, otros: 0, granel: 0, manual: 11 },
  },
  total: {
    'BLANCO OFFWHITE 4.0': { cubeta: 29, galon: 21, litro: 6, tote: 2, atm: 0, otros: 0, granel: 18.105 },
    'AZUL REY 4.0': { cubeta: 11, galon: 0, litro: 0, tote: 0, atm: 0, otros: 0, granel: 0 },
  },
  descuadres: {},
};
const TRAZA = [{
  producto: 'BLANCO OFFWHITE 4.0', estado: 'en_almacen', codigoLote: 'LP-2026-010',
  sublotes: [
    { cod: 'SL-TOTE', tipo: 'tote', estado: 'tote_activo', ub: 'teran', litrosRestante: 344 },
    { cod: 'SL-FAB', tipo: 'tote', estado: 'envasado', ub: 'fabrica', litrosRestante: 988 },
  ],
}];
/* AZUL REY no tiene NADA en Fábrica: no debe aparecer en esa pestaña.
   ROJO ÓXIDO no tiene nada en ningún lado: en ninguna de las dos. */
const INV = { ok: true, data: { mp: {}, pt: {
  'BLANCO OFFWHITE 4.0': { qty: 64, teran: 39.587, min: 30, sku: 'PT-BOW-CUB' },
  'AZUL REY 4.0': { qty: 0, teran: 11, min: 20, sku: 'PT-ARY-CUB' },
  'ROJO ÓXIDO 4.0': { qty: 0, min: 15, sku: 'PT-ROX-CUB' },
} } };

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
    getStkAmericano: vi.fn(() => Promise.resolve({ ok: true, data: { colores: [], catalogo: [], resumen: { cubetas: 0, galones: 0, totesLitros: 0, totesEquiv: 0, colores: 0 } } })),
    getPTOcultos: vi.fn(() => Promise.resolve({ ok: true, ocultos: {} })),
    ptConteo: vi.fn(() => Promise.resolve({ ok: true })),
    setPTUbicacion: vi.fn(() => Promise.resolve({ ok: true })),
    ajustePT: vi.fn(() => Promise.resolve({ ok: true })),
    ptMeta: vi.fn(() => Promise.resolve({ ok: true })),
    urlExportInv: () => '', urlPrintInv: () => '', urlImportInvPT: () => '', urlImportInv: () => '', urlImportEnvases: () => '',
  };
  const vacio = vi.fn(() => Promise.resolve({ ok: true, data: [] }));
  return { default: new Proxy(declarados, { get: (t, k) => (typeof k !== 'string' || k in t ? t[k] : vacio) }) };
});
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { nombre: 'Emmanuel', rol: 'admin' }, can: () => true }),
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));
vi.mock('../components/layout/TopBar', () => ({ default: ({ title }) => <div>{title}</div> }));

import api from '../services/api';
import InventarioPage from '../pages/inventario/InventarioPage';

const abrir = async (pestana) => {
  await act(async () => { render(<MemoryRouter initialEntries={['/inventario?tab=pt']}><InventarioPage /></MemoryRouter>); });
  await waitFor(() => expect(api.getPTPorUbicacion).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });
  if (pestana) {
    await act(async () => { fireEvent.click(document.querySelector(`[data-id="inventario.ptview.${pestana}"]`)); });
  }
};
const tarjetas = (scope) => [...document.querySelectorAll(`[data-id="inventario.pt.card"][data-scope="${scope}"]`)];
const tarjeta = (scope, nombre) => tarjetas(scope).find(c => c.textContent.includes(nombre));
const boton = (card, texto) => within(card).queryByRole('button', { name: texto });

describe('PT ▸ Fábrica y Terán con la tarjeta de Total', () => {
  beforeEach(() => vi.clearAllMocks());

  it('las dos pestañas usan LA MISMA tarjeta, no la lista vieja', async () => {
    await abrir('fabrica');
    expect(tarjetas('fabrica').length).toBeGreaterThan(0);
    await act(async () => { fireEvent.click(document.querySelector('[data-id="inventario.ptview.teran"]')); });
    expect(tarjetas('teran').length).toBeGreaterThan(0);
  });

  it('cada pestaña enseña SU existencia, no la del total', async () => {
    await abrir('fabrica');
    /* Fábrica: 64 cub = 1,216 L. El total del producto (103.6 cub) sale como
       referencia, no como la cifra grande. */
    const c = tarjeta('fabrica', 'BLANCO OFFWHITE');
    expect(c.textContent).toMatch(/1,216 L/);
    /* La unidad de lectura por omisión es litros: el total son 1,968.2 L. */
    expect(c.textContent).toMatch(/de 1,968.*en total/);

    await act(async () => { fireEvent.click(document.querySelector('[data-id="inventario.ptview.teran"]')); });
    /* Terán: 39.587 cub = 752.2 L — el tote abierto NO se cuenta dos veces. */
    expect(tarjeta('teran', 'BLANCO OFFWHITE').textContent).toMatch(/752\.2 L/);
  });

  it('sólo salen los productos que tienen algo en ESA bodega', async () => {
    await abrir('fabrica');
    expect(tarjeta('fabrica', 'BLANCO OFFWHITE')).toBeTruthy();
    expect(tarjeta('fabrica', 'AZUL REY')).toBeFalsy();      /* 0 en Fábrica */
    expect(tarjeta('fabrica', 'ROJO ÓXIDO')).toBeFalsy();    /* 0 en todos lados */

    await act(async () => { fireEvent.click(document.querySelector('[data-id="inventario.ptview.teran"]')); });
    expect(tarjeta('teran', 'AZUL REY')).toBeTruthy();       /* 11 cub en Terán */
    expect(tarjeta('teran', 'ROJO ÓXIDO')).toBeFalsy();
  });

  it('"→ Terán" existe en Fábrica y NO existe estando en Terán', async () => {
    await abrir('fabrica');
    expect(boton(tarjeta('fabrica', 'BLANCO OFFWHITE'), '→ Terán')).toBeTruthy();
    await act(async () => { fireEvent.click(document.querySelector('[data-id="inventario.ptview.teran"]')); });
    expect(boton(tarjeta('teran', 'BLANCO OFFWHITE'), '→ Terán')).toBeFalsy();
  });

  it('Ajustar abre la ficha YA en la ubicación que se está viendo', async () => {
    await abrir('teran');
    await act(async () => { fireEvent.click(boton(tarjeta('teran', 'BLANCO OFFWHITE'), 'Ajustar')); });
    /* La ficha trae las dos pestañas y arranca en Terán. */
    const tabTeran = document.querySelector('[data-id="inventario.ajuste.ubic.teran"]');
    expect(tabTeran).toBeTruthy();
    expect(tabTeran.getAttribute('aria-selected')).toBe('true');
  });

  it('Envasar en Terán abre el modal del POOL, no el de Fábrica', async () => {
    await abrir('teran');
    await act(async () => { fireEvent.click(boton(tarjeta('teran', 'BLANCO OFFWHITE'), 'Envasar')); });
    /* El modal del pool de Terán pregunta por el origen tote/granel. */
    await waitFor(() => expect(document.body.textContent).toMatch(/Envasar en Terán/));
    expect(document.querySelector('[data-id="inventario.sel.origen-fab"]')).toBeFalsy();
  });

  it('en Fábrica, Envasar declara el cambio de presentación (modal de Fábrica)', async () => {
    await abrir('fabrica');
    /* 12 cubetas rastreadas en Fábrica: hay qué declarar. */
    await act(async () => { fireEvent.click(boton(tarjeta('fabrica', 'BLANCO OFFWHITE'), 'Envasar')); });
    await waitFor(() => expect(document.querySelector('[data-id="inventario.sel.origen-fab"]')).toBeTruthy());
  });

  it('el detalle de cada pestaña habla sólo de SUS totes', async () => {
    await abrir('fabrica');
    const cF = tarjeta('fabrica', 'BLANCO OFFWHITE');
    await act(async () => { fireEvent.click(within(cF).getByText(/Ver detalle/)); });
    expect(cF.textContent).toMatch(/LP-2026-010-A/);
    expect(cF.textContent).not.toMatch(/LP-2026-010-B/);

    await act(async () => { fireEvent.click(document.querySelector('[data-id="inventario.ptview.teran"]')); });
    const cT = tarjeta('teran', 'BLANCO OFFWHITE');
    await act(async () => { fireEvent.click(within(cT).getByText(/Ver detalle/)); });
    expect(cT.textContent).toMatch(/LP-2026-010-B/);
    expect(cT.textContent).not.toMatch(/LP-2026-010-A/);
  });

  it('el buscador de la barra filtra estas pestañas (ya no hay un segundo buscador)', async () => {
    await abrir('teran');
    expect(tarjetas('teran').length).toBe(2);
    const buscador = document.querySelector('[data-id="inventario.buscador"]');
    await act(async () => { fireEvent.change(buscador, { target: { value: 'azul' } }); });
    await waitFor(() => expect(tarjetas('teran').length).toBe(1));
    expect(tarjeta('teran', 'AZUL REY')).toBeTruthy();
    /* Un solo campo de búsqueda en la pantalla. */
    expect(document.querySelectorAll('input[placeholder*="Buscar"]').length).toBe(1);
  });

  it('el semáforo habla del PRODUCTO: 0 en Fábrica con existencia en Terán no es "agotado"', async () => {
    await abrir('teran');
    /* AZUL REY: 0 en Fábrica, 11 cub en Terán, mínimo 20 → bajo, no agotado. */
    const c = tarjeta('teran', 'AZUL REY');
    expect(c.textContent).not.toMatch(/AGOTADO/i);
    expect(boton(c, '+ Pedir')).toBeTruthy();
  });
});
