/* ════════════════════════════════════════════════════════════════════════════
   Botón "Producto enviado" — DECISIÓN OWNER 9-sep-2026: "eliminemos lo del QR
   para recoger y pongamos un botón en Enrique de producto enviado; Luis no ha
   funcionado como puente entre fábrica y Terán".

   Lo que fijan estas pruebas:
     · El espejo de la state machine ofrece marcarEnviadoTeran a técnico/admin
       (el botón de Enrique) y NUNCA a recolector/almacén.
     · La página real de Stock Fábrica pinta "Producto enviado" para el
       técnico con envasado listo, y al confirmarlo despacha el scan-bulk
       con la acción nueva — SIN QR. Para Josué (almacén) el botón no existe;
       él conserva "Enviar a recolectar".
     · El camino de Luis sigue existiendo como respaldo: nada se borró,
       solo dejó de ser requisito.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  getAccionesSublote, LABELS_ACCION_SUBLOTE, NOTIF_TARGETS_POR_EVENTO, TRANSICIONES_SUBLOTE,
} from '../lib/loteTransiciones';
import StockFabricaPage from '../pages/stock-fabrica/StockFabricaPage';

/* Un lote real de la pestaña "En fábrica": envasado, con una cubeta lista. */
const LOTES = [{
  id: 'L1', codigoLote: 'LP-0001-001-A', codigo: 'LP-0001-001-A',
  producto: 'AZUL PALLETS PRINCE 5.0', estado: 'envasado', litrosTotal: 95,
  sublotes: [{ cod: 'LP-0001-001-A1', tipo: 'cubeta', qty: 5, lit: 95, estado: 'envasado', ub: 'fabrica' }],
}];

vi.mock('../services/api', () => ({
  default: {
    getTrazabilidad: vi.fn(() => Promise.resolve({ data: LOTES })),
    getEnvases: vi.fn(() => Promise.resolve({ data: null })),
    escanearLoteBulk: vi.fn(() => Promise.resolve({ ok: true, procesados: [{ cod: 'LP-0001-001-A1' }] })),
    get: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

let rolActual = 'tecnico';
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { rol: rolActual, nombre: 'Enrique' }, can: () => true }),
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));
vi.mock('../components/layout/TopBar', () => ({ default: () => <div /> }));
vi.mock('../hooks/useVaciadores', () => ({
  default: () => ({ vaciadores: [], envasadorId: '', elegir: () => {}, camposSublote: () => ({}) }),
}));
/* Auto-confirmar el diálogo: la UX real pregunta antes de despachar. */
vi.mock('../hooks/useConfirm', () => ({ default: () => [vi.fn(async () => true), null] }));

import api from '../services/api';

describe('espejo de la SM — marcarEnviadoTeran', () => {
  it('técnico y admin la ven en envasado y en rezagados en_recoleccion; recolector y almacén NO', () => {
    for (const estado of ['envasado', 'en_recoleccion']) {
      for (const rol of ['tecnico', 'admin']) {
        expect(getAccionesSublote({ estado }, rol), `${rol}/${estado}`).toContain('marcarEnviadoTeran');
      }
      for (const rol of ['recolector', 'almacen']) {
        expect(getAccionesSublote({ estado }, rol), `${rol}/${estado}`).not.toContain('marcarEnviadoTeran');
      }
    }
  });

  it('aterriza en en_camino — la recepción de Josué no cambia (sigue desde en_camino)', () => {
    expect(TRANSICIONES_SUBLOTE.marcarEnviadoTeran.a).toBe('en_camino');
    expect(TRANSICIONES_SUBLOTE.escanearRecibirTeran.desde).toContain('en_camino');
  });

  it('tiene label humano y notifica a Josué (almacen) dejando fuera a Luis', () => {
    expect(LABELS_ACCION_SUBLOTE.marcarEnviadoTeran).toBe('Producto enviado');
    const targets = NOTIF_TARGETS_POR_EVENTO['sublote.marcarEnviadoTeran'];
    expect(targets).toContain('almacen');
    expect(targets).not.toContain('recolector');
  });

  it('el camino de Luis sigue vivo como respaldo (no se borró nada)', () => {
    expect(getAccionesSublote({ estado: 'envasado' }, 'recolector')).toContain('escanearRecoger');
    expect(getAccionesSublote({ estado: 'envasado' }, 'almacen')).toContain('marcarRecoleccion');
  });
});

describe('Stock Fábrica — el botón en la página real', () => {
  beforeEach(() => { vi.clearAllMocks(); rolActual = 'tecnico'; });
  const btn = () => document.querySelector('[data-id="stock.btn.producto-enviado"]');

  it('EL DEL DUEÑO: Enrique ve "Producto enviado" y al confirmarlo despacha el bulk SIN QR', async () => {
    render(<MemoryRouter><StockFabricaPage embedded /></MemoryRouter>);
    await screen.findByText('AZUL PALLETS PRINCE 5.0');
    expect(btn()).toBeTruthy();
    expect(btn().textContent).toContain('Producto enviado');
    fireEvent.click(btn());
    await waitFor(() => {
      expect(api.escanearLoteBulk).toHaveBeenCalledWith({ loteId: 'L1', accion: 'marcarEnviadoTeran' });
    });
    /* sin scanCod ni qrPayload: es botón, no escaneo */
    const args = api.escanearLoteBulk.mock.calls[0][0];
    expect(args.scanCod).toBeUndefined();
    expect(args.qrPayload).toBeUndefined();
  });

  it('Josué (almacén) NO lo ve — él conserva "Enviar a recolectar"', async () => {
    rolActual = 'almacen';
    render(<MemoryRouter><StockFabricaPage embedded /></MemoryRouter>);
    await screen.findByText('AZUL PALLETS PRINCE 5.0');
    expect(btn()).toBeNull();
    expect(document.querySelector('[data-id="stock.btn.enviar-recolectar"]')).toBeTruthy();
  });
});
