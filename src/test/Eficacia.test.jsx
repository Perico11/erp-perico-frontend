/* ════════════════════════════════════════════════════════════════════════════
   E3 — Tablero de eficacia (15-sep-2026). Lo que fijan estas pruebas:

     · El menú tiene UNA entrada /eficacia, "Eficacia", SOLO admin — es la
       pestaña propia que pidió el dueño, no un item que parpadea para el piso.
     · La página pinta los 4 números con su comparación (la dirección buena
       de cada uno: días/merma bajar, rotación/conteos subir).
     · HONESTIDAD visible: pedidos sin fechas completas y litros incompletos
       (≈) SE DICEN en pantalla — no se rellenan con ceros.
     · Si el backend falla, se muestra el error humanizado, no cards vacías.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NAV_ITEMS } from '../components/layout/Sidebar';
import api from '../services/api';
import EficaciaPage from '../pages/eficacia/EficaciaPage';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { rol: 'admin', nombre: 'Emmanuel' }, can: () => true }),
}));
vi.mock('../components/layout/TopBar', () => ({ default: ({ title }) => <div>{title}</div> }));
vi.mock('../services/api', () => ({
  default: { getEficaciaTablero: vi.fn() },
}));

const TABLERO = {
  ventana: { desde: '2026-08-18T12:00:00.000Z', hasta: '2026-09-15T12:00:00.000Z', dias: 28 },
  diasPedido: {
    promedio: 4.2, entregados: 12, sinFechas: 2,
    masLentos: [{ codigo: 'PED-A', producto: 'AZUL PALLETS', dias: 9.5 }],
    prev: { promedio: 6.1, entregados: 9 },
  },
  merma: {
    mermaCub: 3, producidoCub: 145, pct: 2.1,
    porProducto: [{ producto: 'AZUL PALLETS', mermaCub: 2 }],
    prev: { mermaCub: 4, producidoCub: 120, pct: 3.3 },
  },
  rotacion: {
    totalPiezas: 145, totalLitros: 1330.5, litrosParciales: true,
    prev: { totalPiezas: 120, totalLitros: 1100, litrosParciales: false },
    tiendas: [
      {
        tienda: 'Terán', piezas: 90, litros: 830.5, litrosParciales: true, porSemana: [400, 200, 150, 80.5],
        ritmo: { reciente: 600, anterior: 230.5, deltaLitros: 369.5, pct: 160 }, /* acelera */
        frecuenciaDias: 3.5, entregasDias: 8,
      },
      {
        tienda: 'Centro', piezas: 55, litros: 500, litrosParciales: false, porSemana: [100, 150, 200, 50],
        ritmo: { reciente: 250, anterior: 250, deltaLitros: 0, pct: 0 }, /* pareja */
        frecuenciaDias: 7, entregasDias: 4,
      },
      {
        tienda: 'Ruby', piezas: 10, litros: 90, litrosParciales: false, porSemana: [0, 0, 45, 45],
        ritmo: { reciente: 0, anterior: 90, deltaLitros: -90, pct: -100 }, /* frena en seco */
        frecuenciaDias: null, entregasDias: 1, /* un solo día: no se inventa */
      },
    ],
    topProductos: [
      { producto: 'AZUL PALLETS', piezas: 60, litros: 900.5, litrosParciales: false },
      { producto: 'KILZ', piezas: 20, litros: 75.7, litrosParciales: true },
    ],
  },
  conteos: {
    finalizados: 3, meta: 4, metaNota: '1 por semana', cumplimientoPct: 75,
    diasDesdeUltimo: 2, prev: { finalizados: 1 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('E3 — menú', () => {
  it('UNA entrada /eficacia, llamada "Eficacia", SOLO para admin', () => {
    const entradas = NAV_ITEMS.filter(i => i.path === '/eficacia');
    expect(entradas).toHaveLength(1);
    expect(entradas[0].label).toBe('Eficacia');
    expect(entradas[0].roles).toEqual(['admin']);
  });
});

describe('E3 — EficaciaPage', () => {
  it('pinta los 4 números con sus comparaciones y su ventana', async () => {
    api.getEficaciaTablero.mockResolvedValue({ ok: true, data: TABLERO });
    render(<MemoryRouter><EficaciaPage /></MemoryRouter>);

    /* Los 4 números grandes (espera al fetch con el primero). El de rotación
       es LITROS — el dueño pidió que el litro mandara sobre las piezas. */
    expect(await screen.findByText('4.2 días')).toBeTruthy();
    expect(screen.getByText('2.1%')).toBeTruthy();
    expect(screen.getByText('1330.5 L')).toBeTruthy();
    expect(screen.getByText('3 de 4')).toBeTruthy();

    /* Las 5 tarjetas por nombre. La primera se renombró (15-sep): "Días de
       pedido → Terán" hacía pensar en pedidos de TIENDAS, que no existen. */
    expect(screen.getByText('Surtido Fábrica → Terán')).toBeTruthy();
    expect(screen.queryByText('Días de pedido → Terán')).toBeNull();
    expect(screen.getByText('% de merma')).toBeTruthy();
    expect(screen.getByText('Rotación por tienda')).toBeTruthy();
    expect(screen.getByText('Conteos cíclicos')).toBeTruthy();
    expect(screen.getByText('Top 10 · lo más pedido por tiendas')).toBeTruthy();

    const cuerpo = document.body.textContent;
    /* Tendencias con la dirección buena resuelta: días bajaron (-1.9) y
       rotación subió (+230.5 L) — ambas se muestran con el valor previo. */
    expect(cuerpo).toContain('-1.9 días');
    expect(cuerpo).toContain('(6.1 días)');
    expect(cuerpo).toContain('+230.5 L');
    expect(cuerpo).toContain('(1100 L)');
    /* Rotación: piezas quedan de dato secundario, y el desglose por tienda
       lleva los litros como número fuerte */
    expect(cuerpo).toContain('145 piezas en total');
    expect(cuerpo).toContain('Terán');
    expect(cuerpo).toContain('90 pzas');
    expect(cuerpo).toContain('830.5 L');
    expect(cuerpo).toContain('Centro');
    /* Ritmo por tienda (2 semanas vs 2): acelera con %, pareja dice "igual",
       frenón en seco marca −100%; la leyenda explica la flecha */
    expect(cuerpo).toContain('+160%');
    expect(cuerpo).toContain('igual');
    expect(cuerpo).toContain('-100%');
    expect(cuerpo).toContain('verde acelera, rojo frena');
    /* El más lento del periodo, con nombre y días */
    expect(cuerpo).toContain('PED-A');
    expect(cuerpo).toContain('9.5');
    /* Conteos: meta y último */
    expect(cuerpo).toContain('1 por semana');
    expect(cuerpo).toContain('75%');
    expect(cuerpo).toContain('último hace 2 días');
    /* Ventana declarada */
    expect(cuerpo).toContain('28 días');
    /* La tarjeta 1 explica qué mide (no son pedidos de tiendas) */
    expect(cuerpo).toContain('días del pedido del almacén a su entrega en Terán');
    /* Frecuencia por tienda: con dato sale "cada ~X d"; Ruby (1 día) no inventa */
    expect(cuerpo).toContain('cada ~3.5 d');
    expect(cuerpo).toContain('cada ~7 d');
    /* Top 10 con ranking, litros y honestidad */
    expect(cuerpo).toContain('900.5 L');
    expect(cuerpo).toContain('75.7 L');
    expect(cuerpo).toContain('no captura pedidos de tienda');
  });

  it('HONESTIDAD visible: sin-fechas y litros incompletos se dicen en pantalla', async () => {
    api.getEficaciaTablero.mockResolvedValue({ ok: true, data: TABLERO });
    render(<MemoryRouter><EficaciaPage /></MemoryRouter>);
    await screen.findByText('4.2 días');

    const cuerpo = document.body.textContent;
    expect(cuerpo).toContain('no se adivina');       /* 2 pedidos sin fechas completas */
    expect(cuerpo).toContain('≈ incompleto');        /* litros sin equivalencia (Terán) */
    expect(cuerpo).toContain('no se inventan');
  });

  it('merma sin producción: muestra "—" y lo explica, jamás un 0% inventado', async () => {
    api.getEficaciaTablero.mockResolvedValue({
      ok: true,
      data: {
        ...TABLERO,
        merma: { mermaCub: 1, producidoCub: 0, pct: null, porProducto: [], prev: { mermaCub: 0, producidoCub: 0, pct: null } },
      },
    });
    render(<MemoryRouter><EficaciaPage /></MemoryRouter>);
    await screen.findByText('4.2 días');

    expect(document.body.textContent).toContain('sin producción en el periodo');
    /* El número grande de merma sería un nodo '0%' exacto si se inventara;
       substring no sirve: el '-100%' del ritmo de Ruby contiene '0%'. */
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('el selector "Mes vs mes pasado" pide modo=mes y la pantalla declara el mismo corte', async () => {
    api.getEficaciaTablero.mockResolvedValueOnce({ ok: true, data: TABLERO });
    const TAB_MES = {
      ...TABLERO,
      ventana: {
        desde: '2026-09-01T06:00:00.000Z', hasta: '2026-09-15T12:00:00.000Z', dias: 15,
        modo: 'mes', prevDesde: '2026-08-01T06:00:00.000Z', prevHasta: '2026-08-15T12:00:00.000Z',
      },
    };
    api.getEficaciaTablero.mockResolvedValueOnce({ ok: true, data: TAB_MES });
    render(<MemoryRouter><EficaciaPage /></MemoryRouter>);
    await screen.findByText('4.2 días');

    fireEvent.click(screen.getByText('Mes vs mes pasado'));
    await waitFor(() => expect(api.getEficaciaTablero).toHaveBeenCalledTimes(2));
    expect(api.getEficaciaTablero.mock.calls[1][1]).toBe('mes');

    /* La línea de ventana dice el corte, y las tendencias cambian de
       etiqueta: comparan contra el mes pasado, no contra "4 sem. previas". */
    const cortes = await screen.findAllByText(/mismo corte/);
    expect(cortes.length).toBeGreaterThanOrEqual(2); /* ventana + tendencias */
    expect(document.body.textContent).toContain('mes: 1 sep → 15 sep · contra 1 ago → 15 ago');
    expect(document.body.textContent).toContain('vs mes pasado');
    expect(document.body.textContent).not.toContain('vs 4 sem. previas');
  });

  it('si el backend falla, muestra el error humanizado en lugar de cards vacías', async () => {
    api.getEficaciaTablero.mockRejectedValue(new Error('El servidor no respondió a tiempo'));
    render(<MemoryRouter><EficaciaPage /></MemoryRouter>);

    expect(await screen.findByText('El servidor no respondió a tiempo')).toBeTruthy();
    expect(screen.queryByText('Días de pedido → Terán')).toBeNull();
  });
});
