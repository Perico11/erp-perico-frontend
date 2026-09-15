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
import { render, screen } from '@testing-library/react';
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
    totalPiezas: 145, prev: { totalPiezas: 120 },
    tiendas: [
      { tienda: 'Terán', piezas: 90, litros: 830.5, litrosParciales: true, porSemana: [40, 20, 20, 10] },
      { tienda: 'Centro', piezas: 55, litros: 500, litrosParciales: false, porSemana: [10, 15, 20, 10] },
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

    /* Los 4 números grandes (espera al fetch con el primero) */
    expect(await screen.findByText('4.2 días')).toBeTruthy();
    expect(screen.getByText('2.1%')).toBeTruthy();
    expect(screen.getByText('3 de 4')).toBeTruthy();

    /* Las 4 tarjetas por nombre */
    expect(screen.getByText('Días de pedido → Terán')).toBeTruthy();
    expect(screen.getByText('% de merma')).toBeTruthy();
    expect(screen.getByText('Rotación por tienda')).toBeTruthy();
    expect(screen.getByText('Conteos cíclicos')).toBeTruthy();

    const cuerpo = document.body.textContent;
    /* Tendencias con la dirección buena resuelta: días bajaron (-1.9) y
       rotación subió (+25) — ambas se muestran con el valor previo. */
    expect(cuerpo).toContain('-1.9 días');
    expect(cuerpo).toContain('(6.1 días)');
    expect(cuerpo).toContain('+25 pzas');
    /* Rotación: total y desglose por tienda */
    expect(cuerpo).toContain('145');
    expect(cuerpo).toContain('Terán');
    expect(cuerpo).toContain('Centro');
    /* El más lento del periodo, con nombre y días */
    expect(cuerpo).toContain('PED-A');
    expect(cuerpo).toContain('9.5');
    /* Conteos: meta y último */
    expect(cuerpo).toContain('1 por semana');
    expect(cuerpo).toContain('75%');
    expect(cuerpo).toContain('último hace 2 días');
    /* Ventana declarada */
    expect(cuerpo).toContain('28 días');
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
    expect(document.body.textContent).not.toContain('0%');
  });

  it('si el backend falla, muestra el error humanizado en lugar de cards vacías', async () => {
    api.getEficaciaTablero.mockRejectedValue(new Error('El servidor no respondió a tiempo'));
    render(<MemoryRouter><EficaciaPage /></MemoryRouter>);

    expect(await screen.findByText('El servidor no respondió a tiempo')).toBeTruthy();
    expect(screen.queryByText('Días de pedido → Terán')).toBeNull();
  });
});
