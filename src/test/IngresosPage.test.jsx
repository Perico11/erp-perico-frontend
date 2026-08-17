/* IngresosPage — kebab ⋮ con opciones, lotes desplegables con menú … por lote,
   estado cancelado y sheet de cancelación (pedido dueño ago 2026, caso ING-017). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IngresosPage from '../pages/ingresos/IngresosPage';

const INGRESOS = [
  { id: 'ING-017', folio: 'ING-017', proveedor: 'GDB', estado: 'por_revisar', usuario: 'Josué',
    fechaCreacion: '2026-08-17T10:00:00.000Z',
    lineas: [{ tipo: 'mp', nombre: 'Azul grey', cantidad: 1, unidad: 'tote(s)',
      lotes: [{ codigoLote: 'AG-260817-1', cantidad: 1 }] }] },
  { id: 'ING-016', folio: 'ING-016', proveedor: 'Quimica Soltek', estado: 'recibido', usuario: 'Josué',
    fechaCreacion: '2026-08-16T10:00:00.000Z', revisadoPor: 'Emmanuel',
    lineas: [{ tipo: 'mp', nombre: 'BEIGE AMERICANO 2', cantidad: 10, unidad: 'totes' }],
    lotesTrazabilidad: [
      { codigoLote: 'BA2-260816-A', cantidad: 6, presentacion: 'tote', printUrl: '/api/etiquetas/tote/BA2-260816-A/print' },
      { codigoLote: 'BA2-260816-B', cantidad: 4, presentacion: 'tote', printUrl: '/api/etiquetas/tote/BA2-260816-B/print' },
    ] },
  { id: 'ING-015', folio: 'ING-015', proveedor: 'Limplast', estado: 'cancelado', usuario: 'Josué',
    fechaCreacion: '2026-08-15T10:00:00.000Z', canceladoPor: 'Emmanuel',
    motivoCancelacion: 'Fue una prueba', reversa: { aplicada: true, detalles: [] }, lineas: [] },
];

vi.mock('../services/api', () => ({
  default: {
    getIngresos: vi.fn(() => Promise.resolve({ ok: true, data: INGRESOS })),
    getMaestroMP: vi.fn(() => Promise.resolve({ data: { mps: {} } })),
    getEnvases: vi.fn(() => Promise.resolve({ data: { categorias: {}, tapas: {} } })),
    crearIngreso: vi.fn(() => Promise.resolve({ ok: true, ingreso: { folio: 'ING-018' } })),
    revisarIngreso: vi.fn(() => Promise.resolve({ ok: true })),
    cancelarIngreso: vi.fn(() => Promise.resolve({ ok: true, ingreso: { folio: 'ING-017' }, mensaje: 'Ingreso ING-017 cancelado' })),
    ingresoFacturaUrl: (id) => '/factura/' + id,
    etiquetaToteUrl: (cod) => '/etiqueta/' + cod,
    qrLoteUrl: (cod) => '/qr/' + cod,
  },
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { rol: 'admin', nombre: 'Emmanuel' } }),
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => {} }));
vi.mock('../hooks/useIsDesktop', () => ({ default: () => true }));

import api from '../services/api';

describe('IngresosPage — kebab, lotes desplegables y cancelación', () => {
  let openSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });
  afterEach(() => { openSpy.mockRestore(); });

  it('cada tarjeta tiene su kebab ⋮ con Ver factura / Revisar / Cancelar', async () => {
    render(<IngresosPage />);
    await waitFor(() => expect(screen.getByText('GDB')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Opciones de ING-017'));
    expect(screen.getByText(/Ver factura/)).toBeInTheDocument();
    expect(screen.getByText('Revisar y sumar al stock')).toBeInTheDocument();
    expect(screen.getByText('Cancelar ingreso')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Ver factura/));
    expect(openSpy).toHaveBeenCalledWith('/factura/ING-017', '_blank');
  });

  it('# de lote visible en la tarjeta y desplegable con menú … por lote (imprimir etiqueta)', async () => {
    render(<IngresosPage />);
    await waitFor(() => expect(screen.getByText('GDB')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Todos'));
    await waitFor(() => expect(screen.getByText('Quimica Soltek')).toBeInTheDocument());

    /* Los códigos de lote se ven SIN desplegar (resumen de la tarjeta) */
    expect(screen.getByText(/BA2-260816-A · BA2-260816-B/)).toBeInTheDocument();

    /* Desplegar → sub-tarjetas por lote con su menú … */
    fireEvent.click(screen.getByText('2 lotes'));
    expect(screen.getByText('BA2-260816-A')).toBeInTheDocument();
    expect(screen.getByText('BA2-260816-B')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Opciones del lote BA2-260816-A'));
    fireEvent.click(screen.getByText('Imprimir etiqueta'));
    expect(openSpy).toHaveBeenCalledWith('/etiqueta/BA2-260816-A', '_blank');
  });

  it('el kebab de un ingreso recibido con varios lotes despliega la sección de lotes', async () => {
    render(<IngresosPage />);
    await waitFor(() => expect(screen.getByText('GDB')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Recibidos'));
    await waitFor(() => expect(screen.getByText('Quimica Soltek')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Opciones de ING-016'));
    fireEvent.click(screen.getByText('Imprimir etiqueta de tote'));
    /* Con 2 lotes no abre uno al azar: despliega la sección para elegir */
    expect(screen.getByText('BA2-260816-A')).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('lotes manuales de un ingreso por revisar se ven marcados "etiqueta disponible al aprobar"', async () => {
    render(<IngresosPage />);
    await waitFor(() => expect(screen.getByText('GDB')).toBeInTheDocument());

    expect(screen.getByText(/AG-260817-1/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('1 lote'));
    expect(screen.getByText(/etiqueta disponible al aprobar/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Opciones del lote AG-260817-1')).toBeNull();
  });

  it('tarjeta cancelada: badge Cancelado + motivo + inventario revertido', async () => {
    render(<IngresosPage />);
    await waitFor(() => expect(screen.getByText('GDB')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancelados'));
    await waitFor(() => expect(screen.getByText('Limplast')).toBeInTheDocument());

    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    expect(screen.getByText(/Fue una prueba/)).toBeInTheDocument();
    expect(screen.getByText(/inventario revertido/)).toBeInTheDocument();
  });

  it('cancelar: exige motivo ≥10 chars y llama al endpoint', async () => {
    render(<IngresosPage />);
    await waitFor(() => expect(screen.getByText('GDB')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Opciones de ING-017'));
    fireEvent.click(screen.getByText('Cancelar ingreso'));

    /* Sheet abierto — botón de confirmación (el ingreso nunca sumó stock) */
    const btn = screen.getByText('Cancelar ingreso', { selector: 'button' });
    fireEvent.click(btn);
    expect(await screen.findByText(/mínimo 10 caracteres/)).toBeInTheDocument();
    expect(api.cancelarIngreso).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('Ej. Fue una prueba del sistema'),
      { target: { value: 'Fue una prueba del sistema' } });
    fireEvent.click(btn);
    await waitFor(() => expect(api.cancelarIngreso).toHaveBeenCalledWith('ING-017', { motivo: 'Fue una prueba del sistema' }));
  });
});
