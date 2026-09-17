/* ════════════════════════════════════════════════════════════════════════════
   LA PANTALLA NO LE PIDE A ENRIQUE UN PRECIO QUE NO PUEDE VER

   El candado de verdad está en el servidor (erp-perico-backend,
   lib/visibilidadCostos): ocultar un dato en el navegador no lo oculta, la
   respuesta viaja igual y se lee con las herramientas del propio navegador.

   Pero si el servidor deja de mandar precios y la pantalla sigue enseñando los
   campos "Monto" y "Costo por kg", a quien captura le queda un formulario que
   le pide un dato que ya no puede consultar en ningún lado del sistema. Esto es
   esa mitad: que los campos de dinero no se le pinten.

   No se pierde el costeo — al registrar el ingreso el SERVIDOR toma el precio de
   la orden de compra vinculada, donde Arely ya lo capturó y donde nunca dejó de
   estar.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockUser = { rol: 'tecnico', nombre: 'Enrique' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
  AuthProvider: ({ children }) => children,
}));
vi.mock('../components/SecureView', () => ({ default: ({ children }) => <div>{children}</div> }));

vi.mock('../services/api', () => ({
  default: {
    getIngresos: vi.fn(), getMaestroMP: vi.fn(), getEnvases: vi.fn(),
    getOCs: vi.fn(), getStkAmericano: vi.fn(), crearIngreso: vi.fn(),
    editarIngreso: vi.fn(), eliminarIngreso: vi.fn(), revisarIngreso: vi.fn(),
    etiquetaToteUrl: vi.fn(() => ''), ingresoFacturaUrl: vi.fn(() => ''),
  },
}));

import api from '../services/api';
import IngresosPage from '../pages/ingresos/IngresosPage';

const montar = () => render(<MemoryRouter><IngresosPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mockUser.rol = 'tecnico';
  api.getIngresos.mockResolvedValue({ ok: true, data: [] });
  /* El maestro llega SIN costo, como lo manda el servidor a estos roles. */
  api.getMaestroMP.mockResolvedValue({ ok: true, data: { mps: { 'TIO2': { stock: 10 } } } });
  api.getEnvases.mockResolvedValue({ ok: true, data: {} });
  api.getOCs.mockResolvedValue({ ok: true, data: [] });
  api.getStkAmericano.mockResolvedValue({ ok: true, data: {} });
});

/* El formulario vive detrás de "Nuevo ingreso" y NO se monta al abrir la
   pantalla. La primera versión de esta prueba no lo abría: pasaba con el cambio
   y sin él —o sea, no probaba nada— y por eso se comprueba primero que el campo
   SÍ aparece para compras. Si esa deja de fallar sin el arreglo, el resto de
   este archivo es decorativo. */
const abrirAlta = async () => {
  const btn = await screen.findByRole('button', { name: /nuevo ingreso/i });
  fireEvent.click(btn);
  /* Se espera por un campo del formulario, no por el título: "Nuevo ingreso"
     aparece dos veces (el botón y el encabezado del panel). */
  await waitFor(() => {
    if (!document.querySelector('input[placeholder*="Lote de la MP"]')) throw new Error('el alta no abrió');
  });
};

const textoEnPantalla = () => document.body.textContent || '';

describe('los campos de dinero son solo para quien ve precios', () => {
  it('COMPRAS sí ve "Costo por kg" y "Monto" — la guarda del candado', async () => {
    mockUser.rol = 'compras';
    montar();
    await abrirAlta();
    expect(textoEnPantalla()).toMatch(/Monto/);
    expect(document.querySelector('input[placeholder*="Costo por kg"]')).not.toBeNull();
  });

  it('el TÉCNICO no ve ninguno de los dos', async () => {
    mockUser.rol = 'tecnico';
    montar();
    await abrirAlta();
    expect(document.querySelector('input[placeholder*="Costo por kg"]')).toBeNull();
    expect(textoEnPantalla()).not.toMatch(/\bMonto\b/);
  });

  it('almacén tampoco', async () => {
    mockUser.rol = 'almacen';
    montar();
    await abrirAlta();
    expect(document.querySelector('input[placeholder*="Costo por kg"]')).toBeNull();
    expect(textoEnPantalla()).not.toMatch(/\bMonto\b/);
  });

  it('y el lote de la MP se queda: no es dinero y sirve para reclamar al proveedor', async () => {
    mockUser.rol = 'tecnico';
    montar();
    await abrirAlta();
    expect(document.querySelector('input[placeholder*="Lote de la MP"]')).not.toBeNull();
  });
});
