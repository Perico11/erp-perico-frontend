/* ════════════════════════════════════════════════════════════════════════════
   El verbo del tile en Recepción Terán (9-sep-2026, dueño): "cambia el
   recolectó por envió". Con el botón "Producto enviado" de Enrique nadie
   recolectó — la card de Josué debe decir "Envió Enrique", y seguir diciendo
   "Recolectó" cuando el que salió fue el escaneo de Luis.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AlmacenRecepcionPage from '../pages/almacen-recepcion/AlmacenRecepcionPage';

const salida = (accion, usuario) => [{
  accion, usuario, estado: 'en_camino', estadoPrev: 'envasado', fecha: '2026-09-09T20:21:00.000Z',
}];
const LOTES = [{
  id: 'L1', codigoLote: 'LP-0001-014-A', producto: 'AZUL PALLETS PRINCE 5.0', estado: 'en_proceso',
  sublotes: [
    { cod: 'LP-0001-014-A1', tipo: 'cubeta', qty: 30, lit: 570, estado: 'en_camino', ub: 'fabrica', historial: salida('marcarEnviadoTeran', 'Enrique') },
    { cod: 'LP-0001-014-A2', tipo: 'galon', qty: 100, lit: 378.5, estado: 'en_camino', ub: 'fabrica', historial: salida('escanearRecoger', 'Luis') },
  ],
}];

vi.mock('../services/api', () => ({
  default: {
    getTrazabilidad: vi.fn(() => Promise.resolve({ data: LOTES })),
    getEnvases: vi.fn(() => Promise.resolve({ data: null })),
    getOTs: vi.fn(() => Promise.resolve({ data: [] })),
    get: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { rol: 'almacen', nombre: 'Josué' }, can: () => true }),
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));
vi.mock('../components/layout/TopBar', () => ({ default: () => <div /> }));
vi.mock('../hooks/useVaciadores', () => ({
  default: () => ({ vaciadores: [], envasadorId: '', elegir: () => {}, camposSublote: () => ({}) }),
}));
vi.mock('../hooks/useConfirm', () => ({ default: () => [vi.fn(async () => true), null] }));

describe('Recepción Terán — el verbo del tile según QUIÉN sacó el producto', () => {
  it('botón de Enrique → "Envió Enrique"; escaneo de Luis → "Recolectó Luis"', async () => {
    render(<MemoryRouter><AlmacenRecepcionPage embedded /></MemoryRouter>);
    const tiles = await screen.findAllByText(/salió 20:21|salió/);
    expect(tiles.length).toBeGreaterThan(0);
    const texto = document.body.textContent;
    expect(texto).toContain('Envió Enrique');
    expect(texto).toContain('Recolectó Luis');
    expect(texto).not.toContain('Recolectó Enrique');
  });
});
