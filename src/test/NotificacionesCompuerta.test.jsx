/* Notificaciones COMPUERTA (ago 2026).
   Bug raíz: marcar-leída al click y "Leer todas" enterraban PARA SIEMPRE las
   notifs cuyo hash (tipo|severidad|mensaje) es estático — p.ej. un conteo
   finalizado quedaba invisible aunque nadie lo aprobara. Regla nueva: los tipos
   en TIPOS_COMPUERTA (se generan por ESTADO y se autolimpian al resolverse)
   NO se marcan leídos al click, NO entran en "Leer todas" (que ahora pide
   confirmación y los excluye del contador) y llevan hint "pendiente". */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const state = vi.hoisted(() => ({ data: null, navigate: vi.fn() }));

vi.mock('../services/api', () => ({
  default: {
    getNotificaciones: vi.fn(() => Promise.resolve(state.data)),
    marcarNotificacionesLeidas: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));
/* La página consume la API vía useApiData; lo cortocircuitamos para servir el
   fixture síncrono (sin polling de 30 s en el test). */
vi.mock('../hooks/useApi', () => ({
  useApiData: () => ({ data: state.data, loading: false, reload: vi.fn() }),
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => {} }));
vi.mock('../hooks/useBodyScrollLock', () => ({ default: () => {} }));
vi.mock('../components/layout/TopBar', () => ({ default: () => null }));
vi.mock('../components/PushSettings', () => ({ default: () => null }));
vi.mock('../utils/pushNotifications', () => ({ getPushPermission: () => 'default' }));
vi.mock('react-router-dom', () => ({ useNavigate: () => state.navigate }));

import api from '../services/api';
import NotificacionesPage from '../pages/notificaciones/NotificacionesPage';

/* Fixture: 2 compuertas + 1 alerta normal, todas sin leer. */
const N_CONTEO = {
  id: 'conteo-aprob-CC1', tipo: 'conteo_pendiente_aprobacion', severidad: 'critica',
  titulo: 'Conteo con 2 varianza(s) requiere tu aprobación',
  mensaje: 'Burgos finalizó el conteo de Materia Prima',
  fecha: '2026-08-10T09:00:00.000Z', area: 'inventario', ruta: '/conteo',
  _hash: 'h-conteo', leida: false,
};
const N_DEVMP = {
  id: 'devmp-pend-D1', tipo: 'devolucion_mp_pendiente', severidad: 'media',
  titulo: 'Devolución a proveedor por gestionar — DEV-MP-004',
  mensaje: 'registra nota de crédito o reembolso',
  fecha: '2026-08-09T15:00:00.000Z', area: 'compras', ruta: '/devoluciones-mp',
  _hash: 'h-devmp', leida: false,
};
const N_STOCK = {
  id: 'stock-AGUA', tipo: 'stock_bajo', severidad: 'media',
  titulo: 'AGUA — stock bajo', mensaje: 'Tienes 34.0 kg, mínimo 800 kg',
  fecha: '2026-08-11T08:00:00.000Z', area: 'inventario',
  _hash: 'h-stock', leida: false,
};
const armarData = (notifs) => ({
  ok: true,
  data: notifs,
  resumen: {
    total: notifs.length,
    criticas: notifs.filter(n => n.severidad === 'critica').length,
    medias: notifs.filter(n => n.severidad === 'media').length,
    bajas: 0,
  },
});

describe('NotificacionesPage — compuertas de acción', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.data = armarData([N_CONTEO, N_DEVMP, N_STOCK]);
  });

  it('click en compuerta NAVEGA sin marcarla leída', async () => {
    render(<NotificacionesPage />);
    await userEvent.click(screen.getByRole('button', { name: /Conteo con 2 varianza/ }));
    expect(state.navigate).toHaveBeenCalledWith('/conteo');
    expect(api.marcarNotificacionesLeidas).not.toHaveBeenCalled();
  });

  it('click en tipo normal SÍ marca leída y navega por su área', async () => {
    render(<NotificacionesPage />);
    await userEvent.click(screen.getByRole('button', { name: /AGUA/ }));
    expect(state.navigate).toHaveBeenCalledWith('/inventario');
    await waitFor(() => expect(api.marcarNotificacionesLeidas).toHaveBeenCalledWith([
      { id: 'stock-AGUA', hash: 'h-stock' },
    ]));
  });

  it('las cards-compuerta llevan el hint "pendiente hasta resolverse"', () => {
    render(<NotificacionesPage />);
    expect(screen.getAllByText(/Pendiente hasta resolverse/)).toHaveLength(2);
  });

  it('"Leer todas" cuenta solo marcables, pide confirmación y Cancelar no marca nada', async () => {
    render(<NotificacionesPage />);
    /* 3 sin leer, pero 2 son compuertas → el botón dice (1) */
    await userEvent.click(screen.getByRole('button', { name: /Leer todas \(1\)/ }));
    expect(await screen.findByText(/Se marcarán 1 notificación/)).toBeInTheDocument();
    expect(screen.getByText(/2 pendiente\(s\) de acción quedan fuera/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.marcarNotificacionesLeidas).not.toHaveBeenCalled();
  });

  it('"Leer todas" confirmado marca SOLO las no-compuerta', async () => {
    render(<NotificacionesPage />);
    await userEvent.click(screen.getByRole('button', { name: /Leer todas \(1\)/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar leídas' }));
    await waitFor(() => expect(api.marcarNotificacionesLeidas).toHaveBeenCalledWith([
      { id: 'stock-AGUA', hash: 'h-stock' },
    ]));
    /* Ninguna compuerta viajó en el payload */
    const enviados = api.marcarNotificacionesLeidas.mock.calls[0][0].map(x => x.id);
    expect(enviados).not.toContain('conteo-aprob-CC1');
    expect(enviados).not.toContain('devmp-pend-D1');
  });

  it('compuerta enterrada por un click PREVIO al fix re-aparece como no leída', () => {
    /* El backend la trae leida:true (hash estático marcado hace semanas); el
       front la fuerza a la bandeja y no ofrece "Leer todas" (0 marcables). */
    state.data = armarData([{ ...N_CONTEO, leida: true }]);
    render(<NotificacionesPage />);
    expect(screen.getByRole('button', { name: /Conteo con 2 varianza/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Leer todas/ })).toBeNull();
  });
});
