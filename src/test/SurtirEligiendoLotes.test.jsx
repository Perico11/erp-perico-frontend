/* ════════════════════════════════════════════════════════════════════════════
   Surtir eligiendo lotes, sin escáner (24-sep-2026). Lo que fijan estas pruebas:
     · la hoja de surtir carga lo disponible por lote y viene PRELLENADA con la
       sugerencia automática (20 del lote viejo + 10 del nuevo);
     · si al camión subieron otras piezas, se cambian los números y se manda
       EXACTAMENTE eso en `seleccionLotes`;
     · si no suma lo solicitado, no se manda nada y se dice cuánto falta;
     · sin lotes que cubran, el surtido va en automático (sin seleccionLotes).
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  valoresDesdeSugerencia, totalesPorProducto, seleccionParaEnviar, seleccionPosible, estadoTotal,
} from '../utils/seleccionLotes';

const OT = {
  id: 'OT-1', folio: 'OT-077', estado: 'solicitada', solicitadoPor: 'Josué',
  lineas: [{ tipo: 'pt', producto: 'PROCAUCHO TERRACOTA 4.0', nombre: 'PROCAUCHO TERRACOTA 4.0', cantidad: 30, unidad: 'cub' }],
};
const LOTES = {
  ok: true, otId: 'OT-1', productos: [{
    producto: 'PROCAUCHO TERRACOTA 4.0', cantidad: 30, sinCubrir: 0,
    disponibles: [
      { codigoLote: 'LP-V', cubEq: 20, sublotes: [{ cod: 'LP-V-A', tipo: 'cubeta', tote: false, qty: 20, cubEqUnidad: 1, cubEq: 20 }] },
      { codigoLote: 'LP-N', cubEq: 40, sublotes: [{ cod: 'LP-N-A', tipo: 'cubeta', tote: false, qty: 40, cubEqUnidad: 1, cubEq: 40 }] },
    ],
    sugerencia: [{ cod: 'LP-V-A', unidades: 20 }, { cod: 'LP-N-A', unidades: 10 }],
  }],
};

describe('utils de selección de lotes', () => {
  const ps = LOTES.productos;
  it('prellenado, totales y lo que se envía', () => {
    const v = valoresDesdeSugerencia(ps);
    expect(v).toEqual({ 'LP-V-A': 20, 'LP-N-A': 10 });
    expect(totalesPorProducto(ps, v)[0]).toMatchObject({ cantidad: 30, elegido: 30, ok: true });
    expect(seleccionParaEnviar(ps, { 'LP-V-A': '0', 'LP-N-A': '30' })).toEqual([{ cod: 'LP-N-A', unidades: 30 }]);
  });
  it('faltan / sobran / inválida', () => {
    expect(estadoTotal(totalesPorProducto(ps, { 'LP-N-A': 25 })[0])).toBe('Faltan 5 cub');
    expect(estadoTotal(totalesPorProducto(ps, { 'LP-N-A': 32 })[0])).toBe('Sobran 2 cub');
    expect(estadoTotal(totalesPorProducto(ps, { 'LP-V-A': 21, 'LP-N-A': 9 })[0])).toBe('LP-V-A: sólo hay 20');
    expect(estadoTotal(totalesPorProducto(ps, { 'LP-N-A': 29.5 })[0])).toBe('LP-N-A: cantidad inválida');
  });
  it('un tote cuenta entero', () => {
    const tp = [{ producto: 'X', cantidad: 52, disponibles: [{ codigoLote: 'T', sublotes: [{ cod: 'T-A', tote: true, qty: 1, cubEq: 52, cubEqUnidad: 52 }] }] }];
    expect(totalesPorProducto(tp, { 'T-A': 1 })[0].ok).toBe(true);
    expect(seleccionParaEnviar(tp, { 'T-A': 1 })).toEqual([{ cod: 'T-A', unidades: 1 }]);
  });
  it('sin disponible que cubra → no se ofrece elegir', () => {
    expect(seleccionPosible(ps)).toBe(true);
    expect(seleccionPosible([{ ...ps[0], cantidad: 70 }])).toBe(false);
    expect(seleccionPosible([])).toBe(false);
  });
});

/* ── La pantalla completa, con la API simulada ── */
const escanearOT = vi.fn();
const getSurtidoLotesOT = vi.fn();
vi.mock('../services/api', () => ({
  default: {
    getOTs: () => Promise.resolve({ data: [OT] }),
    getInventario: () => Promise.resolve({ pt: {}, mp: {} }),
    getEnvases: () => Promise.resolve({ categorias: {}, tapas: {} }),
    getPTPorUbicacion: () => Promise.resolve({ data: [] }),
    getFirmantes: () => Promise.resolve({}),
    getSurtidoLotesOT: (...a) => getSurtidoLotesOT(...a),
    escanearOT: (...a) => escanearOT(...a),
  },
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { rol: 'tecnico', nombre: 'Enrique' }, can: () => true }),
}));
vi.mock('../components/layout/TopBar', () => ({ default: () => null }));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => {} }));

window.scrollTo = () => {}; /* jsdom no lo implementa (useBodyScrollLock) */
const { default: TransferenciasPage } = await import('../pages/transferencias/TransferenciasPage');

async function abrirSurtir() {
  render(<MemoryRouter><TransferenciasPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /Surtir/ }));
  return screen.findByText('¿De qué lotes sale?');
}

describe('Surtir eligiendo lotes', () => {
  beforeEach(() => {
    escanearOT.mockReset().mockResolvedValue({ ok: true, ot: { ...OT, estado: 'surtida' }, trazabilidad: { modo: 'elegido' } });
    getSurtidoLotesOT.mockReset().mockResolvedValue(LOTES);
  });

  it('viene prellenado con la sugerencia; cambiar a 30 del lote nuevo manda exactamente eso', async () => {
    await abrirSurtir();
    expect(getSurtidoLotesOT).toHaveBeenCalledWith('OT-1');
    const inV = screen.getByLabelText('Piezas de LP-V-A que van');
    const inN = screen.getByLabelText('Piezas de LP-N-A que van');
    expect(inV).toHaveValue(20);
    expect(inN).toHaveValue(10);
    expect(screen.getByText(/30 de 30 cub · Completo/)).toBeInTheDocument();

    fireEvent.change(inV, { target: { value: '0' } });
    fireEvent.change(inN, { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /Surtir completo/ }));
    await waitFor(() => expect(escanearOT).toHaveBeenCalled());
    expect(escanearOT).toHaveBeenCalledWith('OT-1', 'surtir', undefined, [{ cod: 'LP-N-A', unidades: 30 }]);
  });

  it('si no suma lo solicitado, no se manda y dice cuánto falta', async () => {
    await abrirSurtir();
    fireEvent.change(screen.getByLabelText('Piezas de LP-N-A que van'), { target: { value: '5' } });
    expect(screen.getByText(/25 de 30 cub · Faltan 5 cub/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Surtir completo/ }));
    expect(await screen.findByText(/Faltan 5 cub\. Ajusta los lotes/)).toBeInTheDocument();
    expect(escanearOT).not.toHaveBeenCalled();
  });

  it('"Usar sugerencia" regresa al prellenado', async () => {
    await abrirSurtir();
    const inN = screen.getByLabelText('Piezas de LP-N-A que van');
    fireEvent.change(inN, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Usar sugerencia' }));
    expect(screen.getByLabelText('Piezas de LP-N-A que van')).toHaveValue(10);
  });

  it('sin lotes que cubran lo pedido: surtido automático, sin seleccionLotes', async () => {
    getSurtidoLotesOT.mockResolvedValue({ ok: true, productos: [{ ...LOTES.productos[0], disponibles: [], sugerencia: [] }] });
    render(<MemoryRouter><TransferenciasPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Surtir/ }));
    const aviso = await screen.findByText(/Fábrica no tiene lotes registrados/);
    expect(screen.queryByText('¿De qué lotes sale?')).toBeNull();
    fireEvent.click(within(aviso.closest('div').parentElement.parentElement).getByRole('button', { name: /Surtir completo/ }));
    await waitFor(() => expect(escanearOT).toHaveBeenCalledWith('OT-1', 'surtir', undefined, undefined));
  });
});
