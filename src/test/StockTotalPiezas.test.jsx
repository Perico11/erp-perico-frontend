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
  fabrica: { 'BLANCO OFFWHITE 4.0': { cubeta: 12, galon: 0, litro: 0, tote: 1, atm: 0, otros: 0, granel: 0, residual: 0, sublotes: 2 } },
  teran:   {
    /* `teranPresScalar` es el desglose CRUDO del pool que publica el backend
       para el modal de envasado. */
    'BLANCO OFFWHITE 4.0': { cubeta: 17, galon: 21, litro: 6, tote: 1, atm: 0, otros: 0, granel: 18.105, manual: 0,
      sublotes: 3, teranPresScalar: { tote: 1, granel: 18.105, cubeta: 17, galon: 21, litro: 6 } },
    'AZUL REY 4.0': { cubeta: 11, galon: 0, litro: 0, tote: 0, atm: 0, otros: 0, granel: 0, manual: 11 },
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
    getStkAmericano: vi.fn(() => Promise.resolve({ ok: true, data: { colores: [], catalogo: [], resumen: { cubetas: 0, galones: 0, totesLitros: 0, totesEquiv: 0, colores: 0 } } })),
    getPTOcultos: vi.fn(() => Promise.resolve({ ok: true, ocultos: {} })),
    ptConteo: vi.fn(() => Promise.resolve({ ok: true })),
    setPTUbicacion: vi.fn(() => Promise.resolve({ ok: true })),
    ajustePT: vi.fn(() => Promise.resolve({ ok: true })),
    ptMeta: vi.fn(() => Promise.resolve({ ok: true })),
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
};
const tarjeta = (nombre) => screen.getByText(nombre).closest('[data-id="inventario.pt.card"]');
const verTabla = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Tabla' })); });
};
const fila = (nombre) => screen.getByText(nombre).closest('tr');

describe('Stock ▸ Total del PT · tarjetas (propuesta D)', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('la barra dice de qué está hecho el stock, no "104 cubetas"', async () => {
    await abrirPT();
    const c = tarjeta('BLANCO OFFWHITE 4.0');
    expect(within(c).getByText('1 tote lleno')).toBeInTheDocument();
    expect(within(c).getByText('parcial 344 L')).toBeInTheDocument();
    expect(within(c).getByText('29 cub')).toBeInTheDocument();
    expect(within(c).getByText('21 gal')).toBeInTheDocument();
    expect(within(c).getByText('6 L')).toBeInTheDocument();
    /* Cada tramo pesa lo que sus litros: el tote lleno es el más ancho (la
       mitad del stock) y la barra completa suma 100. */
    const barra = c.querySelector('[data-id="inventario.pt.composicion"]');
    const anchos = [...barra.children].map(x => parseFloat(x.style.width));
    expect(anchos.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 1);
    expect(Math.max(...anchos)).toBe(anchos[0]);
    expect(anchos[0]).toBeGreaterThan(45);
    expect(Math.min(...anchos)).toBeGreaterThanOrEqual(1.5); /* ni un tramo invisible */
  });

  it('existencia en litros con el equivalente en cubetas, y el mínimo', async () => {
    const c = (await abrirPT(), tarjeta('BLANCO OFFWHITE 4.0'));
    expect(within(c).getByText(/1,968.2 L/)).toBeInTheDocument();
    expect(within(c).getByText(/≈ 103.6 cub/)).toBeInTheDocument();
    expect(within(c).getByText(/mín 570 L/)).toBeInTheDocument();
  });

  it('el reparto por ubicación va en la tarjeta', async () => {
    const c = (await abrirPT(), tarjeta('BLANCO OFFWHITE 4.0'));
    expect(within(c).getByText('Fábrica').parentElement.textContent).toContain('1,216 L');
    expect(within(c).getByText('Terán').parentElement.textContent).toContain('752.2 L');
  });

  it('"Envasar" abre el mismo modal de siempre cuando hay tote o granel', async () => {
    await abrirPT();
    const c = tarjeta('BLANCO OFFWHITE 4.0');
    await act(async () => { fireEvent.click(within(c).getByRole('button', { name: 'Envasar' })); });
    expect(screen.getByText('Envasar en Terán')).toBeInTheDocument();
  });

  it('"→ Terán" sigue ahí, y solo donde hay stock en Fábrica', async () => {
    await abrirPT();
    /* Es el mismo flujo de orden de transferencia de la pestaña Fábrica. */
    expect(within(tarjeta('BLANCO OFFWHITE 4.0')).getByRole('button', { name: '→ Terán' })).toBeInTheDocument();
    /* AZUL REY no tiene nada en Fábrica: no hay qué transferir. */
    expect(within(tarjeta('AZUL REY 4.0')).queryByRole('button', { name: '→ Terán' })).toBeNull();
  });

  it('"Ver detalle" trae los lotes, el granel y lo cargado a mano', async () => {
    await abrirPT();
    const c = tarjeta('BLANCO OFFWHITE 4.0');
    await act(async () => { fireEvent.click(within(c).getByRole('button', { name: /Ver detalle/ })); });
    expect(within(c).getByText('LP-2026-010')).toBeInTheDocument();
    expect(within(c).getByText(/Granel: 18.1 cub-eq/)).toBeInTheDocument();
    expect(within(c).getByText(/Sublotes:/)).toBeInTheDocument();
  });

  it('el registro manual de Terán se puede quitar desde el detalle', async () => {
    await abrirPT();
    const c = tarjeta('AZUL REY 4.0');
    await act(async () => { fireEvent.click(within(c).getByRole('button', { name: /Ver detalle/ })); });
    expect(within(c).getByText(/Manual en Terán: 11 cub/)).toBeInTheDocument();
    expect(within(c).getByRole('button', { name: 'Eliminar registro manual' })).toBeInTheDocument();
  });

  it('sin nada en ninguna ubicación no ofrece envasar', async () => {
    await abrirPT();
    /* ROJO ÓXIDO está en cero: no tiene desglose en ninguna ubicación. */
    expect(within(tarjeta('ROJO ÓXIDO 4.0')).queryByRole('button', { name: 'Envasar' })).toBeNull();
    expect(within(tarjeta('ROJO ÓXIDO 4.0')).getByRole('button', { name: 'Ajustar' })).toBeInTheDocument();
  });

  it('la ficha de ajuste sigue a un clic: "Ajustar", y abre en Fábrica', async () => {
    await abrirPT();
    await act(async () => { fireEvent.click(within(tarjeta('BLANCO OFFWHITE 4.0')).getByRole('button', { name: 'Ajustar' })); });
    expect(screen.getByText('Ajustar existencia')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Fábrica · 64 cub/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Terán · 39.6 cub/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText(/Existencia actual en Fábrica/)).toBeInTheDocument();
  });

  it('la pestaña Terán ajusta el pool del almacén, sin tocar Fábrica', async () => {
    await abrirPT();
    await act(async () => { fireEvent.click(within(tarjeta('BLANCO OFFWHITE 4.0')).getByRole('button', { name: 'Ajustar' })); });
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Terán · 39.6 cub/ })); });
    expect(screen.getByText(/Existencia actual en Terán/)).toBeInTheDocument();
    /* El pool se lleva en cubetas: el campo arranca con lo que hay allá. */
    const campo = document.querySelector('[data-id="inventario.ajuste.qty-teran"]');
    expect(campo.value).toBe('39.587');

    await act(async () => { fireEvent.change(campo, { target: { value: '30' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Fijar Terán: 30 cub/ })); });

    await waitFor(() => expect(api.setPTUbicacion).toHaveBeenCalledTimes(1));
    const [producto, ubicacion, qty, modo] = api.setPTUbicacion.mock.calls[0];
    expect(producto).toBe('BLANCO OFFWHITE 4.0');
    expect(ubicacion).toBe('teran');
    expect(qty).toBe(30);
    expect(modo).toBe('fijar');
    expect(api.ajustePT).not.toHaveBeenCalled(); /* Fábrica intacta */
  });

  it('la ficha cuenta POR PIEZAS la ubicación elegida, y el tote abierto va una vez', async () => {
    await abrirPT();
    await act(async () => { fireEvent.click(within(tarjeta('BLANCO OFFWHITE 4.0')).getByRole('button', { name: 'Ajustar' })); });
    /* Fábrica: 1 tote lleno + 12 cubetas. */
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Por piezas' })); });
    expect(document.querySelector('[data-id="inventario.contar.tote"]').value).toBe('1');
    expect(document.querySelector('[data-id="inventario.contar.cubeta"]').value).toBe('12');

    /* Terán: el tote está ABIERTO, así que son 344 L, no un tote lleno además. */
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Terán · 39.6 cub/ })); });
    expect(document.querySelector('[data-id="inventario.contar.tote"]').value).toBe('0');
    expect(document.querySelector('[data-id="inventario.contar.granelL"]').value).toBe('344');
    expect(document.querySelector('[data-id="inventario.contar.cubeta"]').value).toBe('17');
  });

  it('el conteo llega al backend con su ubicación y en piezas', async () => {
    await abrirPT();
    await act(async () => { fireEvent.click(within(tarjeta('BLANCO OFFWHITE 4.0')).getByRole('button', { name: 'Ajustar' })); });
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Por piezas' })); });
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Terán · 39.6 cub/ })); });
    await act(async () => {
      fireEvent.change(document.querySelector('[data-id="inventario.contar.galon"]'), { target: { value: '19' } });
    });
    expect(document.querySelector('[data-id="inventario.contar.preview"]').textContent).toContain('39.2');
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/Conteo físico/), { target: { value: 'Conteo físico' } });
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Guardar conteo de Terán/ })); });

    await waitFor(() => expect(api.ptConteo).toHaveBeenCalledTimes(1));
    const [producto, ubicacion, piezas, nota] = api.ptConteo.mock.calls[0];
    expect(producto).toBe('BLANCO OFFWHITE 4.0');
    expect(ubicacion).toBe('teran');
    expect(piezas).toEqual({ tote: 0, granelL: 344, cubeta: 17, galon: 19, litro: 6, atomizador750: 0 });
    expect(nota).toBe('Conteo físico');
    expect(api.setPTUbicacion).not.toHaveBeenCalled(); /* no pasa por el ajuste del pool */
  });

  it('por total, Terán no captura por medida: la medida es de Fábrica', async () => {
    await abrirPT();
    await act(async () => { fireEvent.click(within(tarjeta('BLANCO OFFWHITE 4.0')).getByRole('button', { name: 'Ajustar' })); });
    expect(screen.getByRole('button', { name: 'Tote' })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Terán/ })); });
    expect(screen.queryByRole('button', { name: 'Tote' })).toBeNull();
    expect(screen.getByText(/Solo cambia el pool de/)).toBeInTheDocument();
  });

  /* Regla NUEVA (17-sep-2026, pedido dueño): "agrégale a todos el botón de
     pedir, por si quieren hacer mayor stock puedan ordenarlo". Antes sólo
     aparecía en el producto bajo — y quien quería adelantarse no tenía por
     dónde. Lo que se conserva es la JERARQUÍA: acentuado cuando urge,
     apagado cuando sólo es una opción, para que "Bajo" siga significando algo. */
  it('"+ Pedir" está en TODAS las tarjetas, también en la que va bien', async () => {
    await abrirPT();
    for (const n of ['AZUL REY 4.0', 'BLANCO OFFWHITE 4.0', 'ROJO ÓXIDO 4.0']) {
      expect(within(tarjeta(n)).getByRole('button', { name: '+ Pedir' })).toBeInTheDocument();
    }
  });

  it('pero acentuado sólo cuando urge: el que va bien lo trae apagado', async () => {
    await abrirPT();
    const pedir = (n) => within(tarjeta(n)).getByRole('button', { name: '+ Pedir' });
    /* AZUL REY está bajo (11 cub contra un mínimo de 20) → color de marca. */
    expect(pedir('AZUL REY 4.0').style.color).toMatch(/brand/);
    /* BLANCO OFFWHITE va bien (103 cub contra 30) → neutro. */
    expect(pedir('BLANCO OFFWHITE 4.0').style.color).not.toMatch(/brand/);
  });

  it('y en la TABLA igual: el mismo producto no lo ofrece en tarjeta y lo esconde en tabla', async () => {
    await abrirPT();
    await verTabla();
    for (const n of ['AZUL REY 4.0', 'BLANCO OFFWHITE 4.0']) {
      expect(within(fila(n)).getByRole('button', { name: '+ Pedir' })).toBeInTheDocument();
    }
  });

  it('sin el desglose por ubicación no ofrece contar: queda la ficha de ajuste', async () => {
    api.getPTPorUbicacion.mockImplementationOnce(() => new Promise(() => {})); /* nunca resuelve */
    await act(async () => { render(<MemoryRouter initialEntries={['/inventario?tab=pt']}><InventarioPage /></MemoryRouter>); });
    await act(async () => { await Promise.resolve(); });
    const c = tarjeta('BLANCO OFFWHITE 4.0');
    expect(within(c).queryByRole('button', { name: /^Contar/ })).toBeNull();
    expect(within(c).getByRole('button', { name: 'Ajustar' })).toBeInTheDocument();
    expect(within(c).getByText(/Cargando el desglose/)).toBeInTheDocument();
  });

  it('el KPI "Totes abiertos" saca a la luz el granel del piso', async () => {
    await abrirPT();
    const kpi = screen.getByText('Totes abiertos').parentElement;
    expect(within(kpi).getByText('1')).toBeInTheDocument();
    expect(within(kpi).getByText('344 L a granel en el piso')).toBeInTheDocument();
  });

  it('los KPIs cuentan el TOTAL, como la tarjeta: con stock en Terán no es crítico', async () => {
    await abrirPT();
    /* AZUL REY: 0 en Fábrica pero 11 cub en Terán → bajo, no crítico. */
    expect(within(tarjeta('AZUL REY 4.0')).getByText('Bajo')).toBeInTheDocument();
    expect(within(screen.getByText('En crítico').parentElement).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByText('Stock bajo').parentElement).getByText('1')).toBeInTheDocument();
  });
});

describe('El buscador no se mueve de pestaña en pestaña', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  /* Queja del dueño: al entrar a Americano la barra desaparecía y las
     pestañas brincaban a la izquierda. */
  const posicionDelBuscador = () => {
    const input = document.querySelector('[data-id="inventario.buscador"]');
    const fila = input.closest('div').parentElement;          /* la fila del toolbar */
    return { input, primero: fila.firstElementChild.contains(input) };
  };

  it('la barra está en el mismo sitio en PT y en Americano', async () => {
    await abrirPT();
    const enPT = posicionDelBuscador();
    expect(enPT.input).toBeVisible();
    expect(enPT.primero).toBe(true);
    expect(enPT.input.placeholder).toBe('Buscar material…');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Americano Terán' })); });
    const enAmericano = posicionDelBuscador();
    expect(enAmericano.input).toBeVisible();
    expect(enAmericano.primero).toBe(true);
    /* Misma barra, ahora buscando colores: la vista ya no trae la suya. */
    expect(enAmericano.input.placeholder).toBe('Buscar color…');
    expect(screen.queryByPlaceholderText('Buscar color…')).toBe(enAmericano.input);
  });
});

describe('Stock ▸ Total del PT · la tabla sigue disponible', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('el conmutador vuelve a la tabla, con las piezas en chips', async () => {
    await abrirPT();
    await verTabla();
    const f = fila('BLANCO OFFWHITE 4.0');
    expect(within(f).getByText('1 tote lleno')).toBeInTheDocument();
    expect(within(f).getByText('1 tote parcial · 344 L')).toBeInTheDocument();
    expect(within(f).getByText(/1,968.2 L/)).toBeInTheDocument();
    expect(within(f).getByText('Fábrica 1,216 L · Terán 752.2 L')).toBeInTheDocument();
  });

  it('"Ver en: Cubetas" cambia la unidad en la tabla', async () => {
    await abrirPT();
    await verTabla();
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Cubetas' })); });
    const f = fila('BLANCO OFFWHITE 4.0');
    expect(within(f).getByText(/103.6 cub/)).toBeInTheDocument();
    expect(within(f).getByText(/≈ 1,968.2 L/)).toBeInTheDocument();
  });

  it('desde la tabla, "Ajustar" abre la misma ficha con sus dos ubicaciones', async () => {
    await abrirPT();
    await verTabla();
    await act(async () => { fireEvent.click(within(fila('BLANCO OFFWHITE 4.0')).getByRole('button', { name: 'Ajustar' })); });
    expect(screen.getByText('Ajustar existencia')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Fábrica · 64 cub/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Por piezas' })).toBeInTheDocument();
  });
});
