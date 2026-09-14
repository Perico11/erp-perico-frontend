/* ════════════════════════════════════════════════════════════════════════════
   F4 — Guardar los muebles de Luis (14-sep-2026, paquete "Ahora" de la
   auditoría de flujos). Contexto: desde el 9-sep el envío a Terán lo hace
   Enrique con "Producto enviado"; Luis quedó como respaldo. Lo que fijan
   estas pruebas:

     · Recolección SALE del menú general (Sidebar): la pantalla ya no se
       ofrece — la ruta sigue viva por URL y en el hub del admin.
     · Luis (recolector) CONSERVA su tab fijo en el teléfono: él es quien
       opera el respaldo cuando alguien lo abre.
     · "Enviar a recolectar" vive PLEGADO: en la card del pedido, Josué ve
       primero "Camino de respaldo (con Luis)…" y solo al abrirlo aparece
       el botón real, que despacha marcarRecoleccion como siempre.
       (El pliegue gemelo de Stock Fábrica se fija en productoEnviado.test.)
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NAV_ITEMS } from '../components/layout/Sidebar';
import BottomNav from '../components/layout/BottomNav';
import PedidoLoteActions from '../components/PedidoLoteActions';

let rolActual = 'almacen';
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { rol: rolActual, nombre: 'Josué' }, can: () => true, logout: vi.fn() }),
}));
vi.mock('../services/api', () => ({
  default: {
    escanearLoteBulk: vi.fn(() => Promise.resolve({ ok: true, procesados: [{ cod: 'LP-R1' }] })),
  },
}));
vi.mock('../hooks/useConfirm', () => ({ default: () => [vi.fn(async () => true), null] }));

import api from '../services/api';

const PEDIDO = { id: 'P1', producto: 'AZUL 5.0', estado: 'en_proceso' };
const LOTES = [{
  id: 'L1', codigoLote: 'LP-0009-001', pedidoId: 'P1', producto: 'AZUL 5.0',
  estado: 'envasado', litrosTotal: 95,
  sublotes: [{ cod: 'LP-R1', tipo: 'cubeta', qty: 5, lit: 95, estado: 'envasado', ub: 'fabrica' }],
}];

describe('F4 — los muebles de Luis, guardados sin borrarse', () => {
  beforeEach(() => { vi.clearAllMocks(); rolActual = 'almacen'; });

  it('Recolección ya no está en el menú general (la ruta queda viva por URL)', () => {
    expect(NAV_ITEMS.some(i => i.path === '/recoleccion'), 'sin entrada de Sidebar').toBe(false);
  });

  it('Luis conserva su tab fijo — él opera el respaldo', () => {
    rolActual = 'recolector';
    render(<MemoryRouter><BottomNav /></MemoryRouter>);
    expect(screen.getByText('Recolección')).toBeTruthy();
  });

  it('card del pedido (Josué): primero el toggle de respaldo, luego el botón, y despacha como siempre', async () => {
    render(
      <MemoryRouter>
        <PedidoLoteActions pedido={PEDIDO} lotes={LOTES} userRol="almacen" userName="Josué" />
      </MemoryRouter>
    );
    /* El botón directo ya no existe: */
    expect(document.querySelector('[data-id="pedido.btn.enviar-recolectar"]')).toBeNull();
    const toggle = document.querySelector('[data-id="pedido.btn.respaldo-luis"]');
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle);
    const btn = document.querySelector('[data-id="pedido.btn.enviar-recolectar"]');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('respaldo');
    fireEvent.click(btn);
    await waitFor(() => expect(api.escanearLoteBulk).toHaveBeenCalled());
    expect(api.escanearLoteBulk.mock.calls[0][0].accion).toBe('marcarRecoleccion');
  });

  it('los textos de turno nombran el camino de Enrique, no el de Luis', () => {
    rolActual = 'recolector'; /* rol sin acciones en envasado → ve el mensaje de turno */
    /* Sin sublotes listados: la card muestra el mensaje de "quién sigue". */
    const lotesSinSubs = [{ ...LOTES[0], sublotes: [] }];
    render(
      <MemoryRouter>
        <PedidoLoteActions pedido={PEDIDO} lotes={lotesSinSubs} userRol="recolector" userName="Luis" />
      </MemoryRouter>
    );
    expect(screen.getByText(/Enrique \(o admin\) lo manda con "Producto enviado"/)).toBeTruthy();
  });
});
