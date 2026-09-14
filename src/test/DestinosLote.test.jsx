/* ════════════════════════════════════════════════════════════════════════════
   Destinos del lote (E2a, 14-sep-2026) — la mitad delantera del recall.

   Lo que fijan estas pruebas sobre la página REAL de Trazabilidad:
     · Cada card trae el botón "¿A qué tiendas fue este lote?" y al tocarlo
       se consulta GET /api/lotes/destinos con el código del lote.
     · El modal pinta la respuesta del recall: tienda con sus piezas, el
       folio de la entrega, lo que sigue en casa y lo que ya no es stock.
     · Un lote que nunca salió lo dice claro, sin inventar tiendas.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrazabilidadPage from '../pages/trazabilidad/TrazabilidadPage';

const LOTES = [{
  id: 'L1', codigoLote: 'LP-0001-001', producto: 'AZUL PALLETS PRINCE 5.0',
  estado: 'entregado', litrosTotal: 190, fecha: '2026-08-10T09:00:00.000Z',
  sublotes: [{ cod: 'LP-0001-001-A1', tipo: 'cubeta', qty: 3, lit: 57, estado: 'en_stock_teran', ub: 'teran' }],
}];

const DESTINOS = {
  ok: true,
  data: {
    tipoLote: 'nacional',
    lote: { codigoLote: 'LP-0001-001', producto: 'AZUL PALLETS PRINCE 5.0' },
    tiendas: [{
      tienda: 'PALACO', piezas: 6, litros: 114, litrosParciales: false,
      presentaciones: { cubeta: 6 },
      eventos: [{ fecha: '2026-09-01T10:00:00.000Z', qty: 4, tipo: 'cubeta', cod: 'LP-0001-001-A1', folio: 'ENT-20260901-001', usuario: 'Josué' }],
    }],
    enCasa: {
      teran: { piezas: 3, litros: 57, litrosParciales: false, sublotes: [{ cod: 'LP-0001-001-A1' }] },
      fabrica: { piezas: 0, litros: 0, litrosParciales: false, sublotes: [] },
      enCamino: { piezas: 0, litros: 0, litrosParciales: false, sublotes: [] },
    },
    otros: [{ clase: 'merma', cod: 'LP-0001-001-M', qty: 1, tipo: 'cubeta', lit: 19 }],
    totales: { tiendasCount: 1, entregadoPiezas: 6, enCasaPiezas: 3 },
  },
};

vi.mock('../services/api', () => ({
  default: {
    getTrazabilidad: vi.fn(() => Promise.resolve({ data: LOTES })),
    getDestinosLote: vi.fn(() => Promise.resolve(DESTINOS)),
  },
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { rol: 'admin', nombre: 'Emmanuel' }, can: () => true }),
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));
vi.mock('../components/layout/TopBar', () => ({ default: () => <div /> }));
vi.mock('../hooks/useConfirm', () => ({ default: () => [vi.fn(async () => true), null] }));

import api from '../services/api';

function abrirDestinos() {
  render(<MemoryRouter><TrazabilidadPage /></MemoryRouter>);
  return waitFor(() => screen.getByTitle('¿A qué tiendas fue este lote?'))
    .then(btn => { fireEvent.click(btn); return btn; });
}

describe('Destinos del lote — botón y modal en Trazabilidad', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el botón consulta destinos del lote y el modal pinta tienda, folio, casa y no-stock', async () => {
    await abrirDestinos();
    await waitFor(() => expect(api.getDestinosLote).toHaveBeenCalledWith('LP-0001-001'));

    /* La respuesta del recall, visible: */
    await screen.findByText('PALACO');
    expect(screen.getByText(/6 cubeta/)).toBeTruthy();
    expect(screen.getByText('ENT-20260901-001')).toBeTruthy();
    expect(screen.getByText('En Terán')).toBeTruthy();
    expect(screen.getByText('Merma')).toBeTruthy();
    expect(screen.getByText('Destinos del lote')).toBeTruthy();
  });

  it('un lote que nunca salió lo dice claro (y el modal cierra con la ✕)', async () => {
    api.getDestinosLote.mockResolvedValueOnce({
      ok: true,
      data: { ...DESTINOS.data, tiendas: [], otros: [], totales: { tiendasCount: 0, entregadoPiezas: 0, enCasaPiezas: 3 } },
    });
    await abrirDestinos();
    await screen.findByText('Este lote no ha salido a ninguna tienda.');
    fireEvent.click(screen.getByLabelText('Cerrar'));
    await waitFor(() => expect(screen.queryByText('Destinos del lote')).toBeNull());
  });
});
