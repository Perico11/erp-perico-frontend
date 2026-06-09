import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MargenesDashboard from '../pages/admin/MargenesDashboard';

vi.mock('../services/api', () => ({
  default: {
    getMargenes: vi.fn(() => Promise.resolve({
      ok: true,
      kpis: {
        totalProductos: 3,
        conPrecio: 2,
        sinPrecio: 1,
        margenPromedio: 25.5,
        ingresosTotalMensual: 50000,
        margenTotalMensual: 12500,
        productosNoRentables: 1,
      },
      productos: [
        {
          nombre: 'BLANCO MATE 4.0', costoMP: 500, costoEnvase: 64,
          costoManoObra: 25, costoMerma: 7.5, costoTotal: 596.5,
          precioVenta: 1000, margenAbs: 403.5, margenPct: 40.4,
          prodMensual: 26, prodUlt6m: 156,
          ingresosMensual: 26000, margenMensual: 10491,
          mpsSinCosto: [], completo: true, descontinuada: false,
        },
        {
          nombre: 'BLANCO SATIN 4.0', costoMP: 600, costoEnvase: 64,
          costoManoObra: 25, costoMerma: 9, costoTotal: 698,
          precioVenta: 800, margenAbs: 102, margenPct: 12.8,
          prodMensual: 9, prodUlt6m: 54,
          ingresosMensual: 7200, margenMensual: 918,
          mpsSinCosto: [], completo: true, descontinuada: false,
        },
        {
          nombre: 'PRODUCTO_PERDIDA', costoMP: 800, costoEnvase: 64,
          costoManoObra: 25, costoMerma: 12, costoTotal: 901,
          precioVenta: 700, margenAbs: -201, margenPct: -28.7,
          prodMensual: 5, prodUlt6m: 30,
          ingresosMensual: 3500, margenMensual: -1005,
          mpsSinCosto: [], completo: true, descontinuada: false,
        },
      ],
      costosAuxiliares: { envase: 50, tapa: 14, manoObra: 25, pctMerma: 0.015 },
    })),
    setPrecioVenta: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ can: (p) => p === 'editarPrecios' || p === 'configuracion' }),
}));

describe('MargenesDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renderiza los 6 KPIs principales', async () => {
    render(<MargenesDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Productos totales')).toBeInTheDocument();
      expect(screen.getByText('Con precio venta')).toBeInTheDocument();
      expect(screen.getByText('Sin precio venta')).toBeInTheDocument();
      /* "No rentables" aparece como label de KPI Y como <option> del filtro
         (rediseño verde movió los filtros a un <select>). Scopeamos al label
         del KPI (un <div>, no la <option>) para evitar el match múltiple. */
      const noRentables = screen.getAllByText('No rentables')
        .filter((el) => el.tagName !== 'OPTION');
      expect(noRentables.length).toBeGreaterThan(0);
      expect(screen.getByText('Margen promedio')).toBeInTheDocument();
      expect(screen.getByText('Margen mensual')).toBeInTheDocument();
    });
  });

  it('muestra los 3 productos en la tabla', async () => {
    render(<MargenesDashboard />);
    await waitFor(() => {
      expect(screen.getByText('BLANCO MATE 4.0')).toBeInTheDocument();
      expect(screen.getByText('BLANCO SATIN 4.0')).toBeInTheDocument();
      expect(screen.getByText('PRODUCTO_PERDIDA')).toBeInTheDocument();
    });
  });

  it('muestra el margen porcentual correcto', async () => {
    render(<MargenesDashboard />);
    await waitFor(() => {
      expect(screen.getByText('40.4%')).toBeInTheDocument();
      expect(screen.getByText('12.8%')).toBeInTheDocument();
      expect(screen.getByText('-28.7%')).toBeInTheDocument();
    });
  });

  it('los filtros existen como opciones del select', async () => {
    /* Rediseño verde: los filtros pasaron de pills clicables a un <select>.
       Verificamos que las opciones canónicas existan como <option>. */
    render(<MargenesDashboard />);
    await waitFor(() => screen.getByText('BLANCO MATE 4.0'));
    expect(screen.getByRole('option', { name: /Rentables \(≥30%\)/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No rentables' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sin precio' })).toBeInTheDocument();
  });
});
