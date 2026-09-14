/* ════════════════════════════════════════════════════════════════════════════
   F9 — Memoria al envasar (14-sep-2026, paquete "Ahora" de la auditoría).
   El AZUL 5.0 casi siempre sale en la misma presentación y marca; el sheet
   de envasado ahora arranca con LA ÚLTIMA COMBINACIÓN USADA PARA ESE
   PRODUCTO (derivada de los sublotes ya cargados — cero backend) y Enrique
   solo confirma o corrige. Lo que fijan estas pruebas:

     · Con historial del producto: el sheet abre con el tipo y la marca de
       la última vez (aunque aquel lote ya haya salido de la pestaña), y lo
       DICE ("Precargado como la última vez…").
     · Sin historial: el default de siempre (cubeta, primera marca con
       stock) y sin aviso — nada inventado.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StockFabricaPage from '../pages/stock-fabrica/StockFabricaPage';

/* L-viejo: el envasado anterior del AZUL (galón Premium), ya ENTREGADO — fuera
   de la pestaña En Fábrica, pero presente en trazabilidad. L-nuevo: por envasar. */
const LOTES = [
  {
    id: 'L-viejo', codigoLote: 'LP-0001-001', producto: 'AZUL 5.0',
    estado: 'entregado', litrosTotal: 95,
    sublotes: [{
      cod: 'LP-0001-001-A', tipo: 'galon', marca: 'Premium', tapaKey: '',
      claseSublote: 'envasado_final', qty: 25, lit: 94.6, estado: 'entregado_tienda',
      historial: [{ accion: 'crear', ts: '2026-09-10T10:00:00.000Z' }],
    }],
  },
  {
    id: 'L-nuevo', codigoLote: 'LP-0002-001', producto: 'AZUL 5.0',
    estado: 'producido', litrosTotal: 95, sublotes: [],
  },
  {
    id: 'L-rojo', codigoLote: 'LP-0003-001', producto: 'ROJO MATE',
    estado: 'producido', litrosTotal: 19, sublotes: [],
  },
];

const ENVASES = {
  categorias: {
    cubeta: { subcategorias: { 'cubeta-std': { nombre: '19L Estandar', marca: 'Estandar', stock: 10 } } },
    galon: { subcategorias: { 'galon-premium': { nombre: 'Galón Premium', marca: 'Premium', stock: 50 } } },
  },
  tapas: {}, tapa_default: {},
};

vi.mock('../services/api', () => ({
  default: {
    getTrazabilidad: vi.fn(() => Promise.resolve({ data: LOTES })),
    getEnvases: vi.fn(() => Promise.resolve({ data: ENVASES })),
    get: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { rol: 'tecnico', nombre: 'Enrique' }, can: () => true }),
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));
vi.mock('../components/layout/TopBar', () => ({ default: () => <div /> }));
vi.mock('../hooks/useVaciadores', () => ({
  default: () => ({ vaciadores: [], envasadorId: '', elegir: () => {}, camposSublote: {} }),
}));
vi.mock('../hooks/useConfirm', () => ({ default: () => [vi.fn(async () => true), null] }));

async function abrirEnvasar(codigoLote) {
  render(<MemoryRouter><StockFabricaPage embedded /></MemoryRouter>);
  await screen.findByText(codigoLote);
  /* El botón Envasar DE LA CARD de ese lote: subir por ancestros desde el
     folio hasta el contenedor que ya trae su propio botón (hay uno por
     lote envasable en pantalla — tomar botones[0] abría otra card). */
  let nodo = screen.getByText(codigoLote);
  let btn = null;
  while (nodo && !btn) {
    btn = nodo.querySelector ? nodo.querySelector('[data-id="stock.btn.envasar"]') : null;
    nodo = nodo.parentElement;
  }
  expect(btn).toBeTruthy();
  fireEvent.click(btn);
  await waitFor(() => expect(screen.getByText('Envasar lote')).toBeTruthy());
}

describe('F9 — memoria al envasar, por producto', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el AZUL arranca como la última vez (galón Premium) y lo dice', async () => {
    await abrirEnvasar('LP-0002-001');
    expect(screen.getByText('Precargado como la última vez de este producto — confirma o corrige.')).toBeTruthy();
    const sel = document.querySelector('[data-id="stock.sel.envase"]');
    expect(sel).toBeTruthy();
    /* Marca de la última vez seleccionada — y como "Premium" solo existe en
       GALÓN, esto también prueba que el tipo precargado es galón. */
    expect(sel.value).toBe('Premium');
  });

  it('un producto sin historial abre con el default de siempre y sin aviso', async () => {
    await abrirEnvasar('LP-0003-001');
    expect(screen.queryByText(/Precargado como la última vez/)).toBeNull();
    const sel = document.querySelector('[data-id="stock.sel.envase"]');
    expect(sel.value).toBe('Estandar');
  });
});
