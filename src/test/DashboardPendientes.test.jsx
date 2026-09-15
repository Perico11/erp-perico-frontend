/* ════════════════════════════════════════════════════════════════════════════
   Tarjetas de PENDIENTES del Inicio — el reporte del dueño (9-sep-2026):
   "cuando hay órdenes o pedidos en proceso sigue marcando 0".

   La causa: las órdenes ESPEJAN el estado de su lote (sync canónico), así que
   viven en todo el dominio (en_envasado, envasado, en_almacen…) — y la lista
   de arranque del dashboard solo contaba hasta en_produccion. Estas pruebas
   fijan los conteos con datos en la forma REAL del VPS, y que el click de la
   fila navega a su pantalla.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardPage from '../pages/dashboard/DashboardPage';
import api from '../services/api';

const navMock = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => navMock,
}));

/* Datos con la forma real: órdenes en estados del dominio del LOTE (la
   variante 'entregada' y la prueba NO cuentan), pedidos con la entrega
   parcial 'en_proceso', devoluciones con una de prueba colada. */
const ORDENES = [
  { id: 'O1', codigo: 'ORD-1', estado: 'en_envasado' },
  { id: 'O2', codigo: 'ORD-2', estado: 'envasado' },
  { id: 'O3', codigo: 'ORD-3', estado: 'en_almacen' },
  { id: 'O4', codigo: 'ORD-4', estado: 'entregada' },
  { id: 'O5', codigo: 'ORD-5', estado: 'en_produccion', esPrueba: true },
];
const PEDIDOS = [
  { id: 'P1', codigo: 'PA-1', estado: 'en_proceso' },
  { id: 'P2', codigo: 'PA-2', estado: 'en_camino' },
  { id: 'P3', codigo: 'PA-3', estado: 'entregado' },
  { id: 'P4', codigo: 'PA-4', estado: 'pendiente' },
];
const DEVOLUCIONES = [
  { id: 'D1', estado: 'pendiente' },
  { id: 'D2', estado: 'pendiente', esPrueba: true },
  { id: 'D3', estado: 'recibido_fabrica' },
];

vi.mock('../services/api', () => ({
  default: {
    getDashboardExec: vi.fn(() => Promise.resolve({ data: null })),
    getPedidos: vi.fn(() => Promise.resolve({ data: PEDIDOS })),
    getOrdenes: vi.fn(() => Promise.resolve({ data: ORDENES })),
    getTrazabilidad: vi.fn(() => Promise.resolve({ data: [] })),
    getOCs: vi.fn(() => Promise.resolve({ data: [] })),
    getDevoluciones: vi.fn(() => Promise.resolve(DEVOLUCIONES)),
    get: vi.fn(() => Promise.resolve({ data: [] })),
    getNotificaciones: vi.fn(() => Promise.resolve({ data: [] })),
    /* E1: sin dato de reorden por default — la tarjeta no debe salir. */
    getResumenReorden: vi.fn(() => Promise.resolve({ data: null })),
  },
}));

let rolActual = 'admin';
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { rol: rolActual, nombre: 'Emmanuel' }, can: () => true }),
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));
vi.mock('../components/layout/TopBar', () => ({ default: () => <div /> }));
vi.mock('../pages/dashboard/MisLotesPipeline', () => ({ default: () => <div /> }));

const fila = (key) => document.querySelector(`[data-id="inicio.row.pendiente.${key}"]`);

describe('DashboardPage — tarjetas de pendientes con datos reales', () => {
  beforeEach(() => { vi.clearAllMocks(); rolActual = 'admin'; });

  it('LA DE DINERO: órdenes en estados avanzados del lote SÍ cuentan (3, no 0) — entregada y prueba fuera', async () => {
    render(<DashboardPage />);
    /* Con 3 activas, "Órdenes en proceso" es el pendiente más urgente → HERO. */
    expect(await screen.findByText('3 órdenes en proceso')).toBeInTheDocument();
  });

  it('un pedido con entrega PARCIAL (en_proceso) cuenta en "Pedidos de stock por entregar"', async () => {
    render(<DashboardPage />);
    await screen.findByText('3 órdenes en proceso');
    const row = fila('pedidos-entregar');
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('Pedidos de stock por entregar');
    expect(row.textContent).toContain('PA-1 · PA-2'); /* en_proceso + en_camino; entregado NO */
    expect(row.textContent.trim().endsWith('2')).toBe(true); /* el conteo cierra la fila */
  });

  it('la devolución de PRUEBA no infla "Devoluciones por recibir"', async () => {
    render(<DashboardPage />);
    await screen.findByText('3 órdenes en proceso');
    const row = fila('dev-recibir');
    expect(row.textContent).toContain('Devoluciones por recibir');
    expect(row.textContent.trim().endsWith('1')).toBe(true);
  });

  it('el click de la fila NAVEGA a su pantalla (los botones conectados)', async () => {
    render(<DashboardPage />);
    await screen.findByText('3 órdenes en proceso');
    fireEvent.click(fila('pedidos-entregar'));
    expect(navMock).toHaveBeenCalledWith('/pedidos?tab=activos');
  });

  it('al TÉCNICO se le restan las fuera-de-fábrica, como en su pantalla de Órdenes', async () => {
    rolActual = 'tecnico';
    render(<DashboardPage />);
    /* ORD-3 (en_almacen) sale de su vista → 2 activas. */
    expect(await screen.findByText('2 órdenes en proceso')).toBeInTheDocument();
  });

  /* ── E1 (15-sep-2026): la tarjeta de reorden — el pronóstico al Inicio ── */

  it('E1: la tarjeta de reorden lista el top por nombre, suma +N y navega a /pronostico', async () => {
    api.getResumenReorden.mockResolvedValueOnce({
      data: {
        sugeridas: 4, criticas: 0, altas: 2, medias: 2,
        top: [{ mp: 'RESINA A' }, { mp: 'PIGMENTO B' }, { mp: 'CAL' }],
      },
    });
    render(<DashboardPage />);
    /* Sin críticas la tarjeta es ámbar y el hero sigue siendo órdenes. */
    await screen.findByText('3 órdenes en proceso');
    const row = fila('reorden');
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('Materias bajo punto de reorden');
    expect(row.textContent).toContain('RESINA A · PIGMENTO B · CAL · +1');
    expect(row.textContent.trim().endsWith('4')).toBe(true);
    fireEvent.click(row);
    expect(navMock).toHaveBeenCalledWith('/pronostico');
  });

  it('E1: con materias CRÍTICAS la tarjeta escala a hero del Inicio', async () => {
    api.getResumenReorden.mockResolvedValueOnce({
      data: {
        sugeridas: 4, criticas: 2, altas: 1, medias: 1,
        top: [{ mp: 'RESINA A' }, { mp: 'PIGMENTO B' }],
      },
    });
    render(<DashboardPage />);
    expect(await screen.findByText('4 materias bajo su punto de reorden')).toBeInTheDocument();
  });

  it('E1: sin dato del backend la tarjeta NO aparece — un cero inventado miente', async () => {
    render(<DashboardPage />); /* default: { data: null } */
    await screen.findByText('3 órdenes en proceso');
    expect(fila('reorden')).toBeNull();
  });
});
