import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TransferenciasPage from '../pages/transferencias/TransferenciasPage';

/* ════════════════════════════════════════════════════════════════════════════
   Descuadre físico vs inventario en el sheet de crear OT (ago 2026).

   Bug: el modal mostraba "Tote 1 disp." junto a "Stock en Fábrica: 0 cub" y no
   explicaba nada. Son dos fuentes distintas:
     • las píldoras "N disp."  ← getPTPorUbicacion() → fabrica[X] (trazabilidad)
     • "Stock en Fábrica"      ← getInventario() → inv.pt[X].qty (lo que surte)

   El backend ahora publica cubEquiv / transferible / descuadre en fabrica[X].
   Aquí se verifica que el modal los use para EXPLICAR y que nunca vete la
   creación de la solicitud (crear una OT no mueve inventario).

   El sheet se abre con ?nueva=<JSON línea>, el mismo prefill que usa el botón
   "Transferir a Terán" de Inventario.
   ════════════════════════════════════════════════════════════════════════════ */

const PROD = 'BLANCO OFFWHITE';

/* fabrica[PROD]: 1 tote físico (52 cub-equiv) que el escalar NO respalda. */
const ptUbicDescuadrado = {
  ok: true,
  fabrica: { [PROD]: { tote: 1, cubeta: 0, galon: 0, litro: 0, atm: 0, cubEquiv: 52, transferible: 0, descuadre: 52 } },
  teran: {}, total: {},
  descuadres: { [PROD]: { cubEquiv: 52, transferible: 0, descuadre: 52 } },
};
/* Mismo tote, pero con el inventario cuadrado. */
const ptUbicCuadrado = {
  ok: true,
  fabrica: { [PROD]: { tote: 1, cubeta: 0, galon: 0, litro: 0, atm: 0, cubEquiv: 52, transferible: 52, descuadre: 0 } },
  teran: {}, total: {},
  descuadres: {},
};

let invQty = 0;
let ptUbic = ptUbicDescuadrado;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { nombre: 'Josue', rol: 'almacen' } }),
}));

vi.mock('../services/api', () => ({
  default: {
    getOTs: vi.fn(() => Promise.resolve({ ok: true, data: [] })),
    getInventario: vi.fn(() => Promise.resolve({ ok: true, data: { mp: {}, pt: { [PROD]: { qty: invQty, min: 5 } } } })),
    getEnvases: vi.fn(() => Promise.resolve({ ok: true, data: { categorias: {}, tapas: {} } })),
    getPTPorUbicacion: vi.fn(() => Promise.resolve(ptUbic)),
    crearOT: vi.fn(() => Promise.resolve({ ok: true, id: 'OT-1', folio: 'OT-001' })),
    editarOT: vi.fn(() => Promise.resolve({ ok: true })),
    escanearOT: vi.fn(() => Promise.resolve({ ok: true })),
    /* TopBar (montado por la página) pide el contador de alertas. */
    getNotificaciones: vi.fn(() => Promise.resolve({ ok: true, data: [] })),
  },
}));

vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => {} }));

const renderConPT = () => {
  const nueva = encodeURIComponent(JSON.stringify({ tipo: 'pt', producto: PROD }));
  return render(
    <MemoryRouter initialEntries={[`/transferencias?nueva=${nueva}`]}>
      <TransferenciasPage />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  invQty = 0;
  ptUbic = ptUbicDescuadrado;
  /* TopBar hace fetch('/api/branding') al montar; el stub global de setup.js
     devuelve undefined y rompe el .then. */
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: true, data: null }) }));
});

describe('CrearSheet — descuadre físico vs inventario', () => {
  it('explica el descuadre con números y con la acción a tomar', async () => {
    renderConPT();
    const aviso = await screen.findByText(/cub sin registrar/i);
    /* Los tres números del backend, no un mensaje genérico */
    expect(aviso.textContent).toMatch(/52 cub físicas/i);
    expect(aviso.textContent).toMatch(/0 cub cuadradas/i);
    expect(aviso.textContent).toMatch(/52 cub sin registrar/i);
    /* Y la salida concreta */
    expect(aviso.textContent).toMatch(/Inventario → PT → Fábrica/);
  });

  it('marca la píldora de la presentación que no se puede surtir', async () => {
    renderConPT();
    await waitFor(() => expect(screen.getByText(/1 disp\./)).toBeTruthy());
    expect(screen.getByText(/1 disp\..*sin cuadrar/)).toBeTruthy();
  });

  it('NO bloquea agregar la línea: crear una OT no mueve inventario', async () => {
    /* 1 tote = 52 cub-equiv contra 0 cub cuadradas: el peor caso posible.
       Aun así debe poder pedirse — el veto real vive en el surtido. */
    renderConPT();
    await screen.findByText(/cub sin registrar/i);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '1' } });
    await waitFor(() => expect(screen.getByText(/52 cub equivalentes/)).toBeTruthy());
    const btn = document.querySelector('[data-id="transferencias.btn.agregar-linea"]');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
  });

  it('sin descuadre no muestra el aviso ni marca las píldoras', async () => {
    invQty = 52; ptUbic = ptUbicCuadrado;
    renderConPT();
    await waitFor(() => expect(screen.getByText(/1 disp\./)).toBeTruthy());
    expect(screen.queryByText(/cub sin registrar/i)).toBeNull();
    expect(screen.queryByText(/sin cuadrar/)).toBeNull();
  });

  it('backend viejo (sin los campos nuevos) se comporta como antes', async () => {
    ptUbic = { ok: true, fabrica: { [PROD]: { tote: 1, cubeta: 0, galon: 0, litro: 0, atm: 0 } }, teran: {}, total: {} };
    renderConPT();
    await waitFor(() => expect(screen.getByText(/1 disp\./)).toBeTruthy());
    expect(screen.queryByText(/cub sin registrar/i)).toBeNull();
    expect(screen.queryByText(/sin cuadrar/)).toBeNull();
  });
});
