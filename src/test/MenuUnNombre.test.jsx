/* ════════════════════════════════════════════════════════════════════════════
   F6 — Un solo nombre por cosa en el menú (14-sep-2026, paquete "Ahora" de la
   auditoría de flujos). Lo que fijan estas pruebas:

     · /transferencias tiene UNA sola entrada de menú y se llama "Logística"
       para todos los roles (antes: "Logística" para admin y "Transferencias"
       para el piso — dos nombres para la misma puerta).
     · El encabezado de la página dice lo mismo que el menú: el no-admin ve
       su misma pantalla de transferencias bajo el título "Logística" (hub de
       una vista: sin selector); el admin conserva sus 3 vistas.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NAV_ITEMS } from '../components/layout/Sidebar';
import LogisticaHubPage from '../pages/transferencias/LogisticaHubPage';

let rolActual = 'almacen';
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { rol: rolActual, nombre: 'Josué' }, can: () => true }),
}));
vi.mock('../components/layout/TopBar', () => ({ default: ({ title }) => <div>{title}</div> }));
vi.mock('../pages/transferencias/TransferenciasPage', () => ({ default: () => <div>CONTENIDO-TRANSFERENCIAS</div> }));
vi.mock('../pages/entregas/EntregasPage', () => ({ default: () => <div>CONTENIDO-ENTREGAS</div> }));
vi.mock('../pages/recoleccion/RecoleccionPage', () => ({ default: () => <div>CONTENIDO-RECOLECCION</div> }));

describe('F6 — un solo nombre para /transferencias', () => {
  it('el menú tiene UNA entrada para /transferencias, llamada Logística, para admin y piso por igual', () => {
    const entradas = NAV_ITEMS.filter(i => i.path === '/transferencias');
    expect(entradas).toHaveLength(1);
    expect(entradas[0].label).toBe('Logística');
    for (const rol of ['admin', 'almacen', 'inventario', 'tecnico']) {
      expect(entradas[0].roles, `rol ${rol}`).toContain(rol);
    }
    expect(NAV_ITEMS.some(i => i.label === 'Transferencias'), 'el nombre viejo ya no existe en el menú').toBe(false);
  });

  it('no-admin: misma pantalla de siempre bajo el título "Logística", sin selector de vistas', () => {
    rolActual = 'almacen';
    render(<MemoryRouter><LogisticaHubPage /></MemoryRouter>);
    expect(screen.getByText('Logística')).toBeTruthy();
    expect(screen.getByText('CONTENIDO-TRANSFERENCIAS')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('admin: el hub conserva sus 3 vistas', () => {
    rolActual = 'admin';
    render(<MemoryRouter><LogisticaHubPage /></MemoryRouter>);
    expect(screen.getByRole('tab', { name: 'Transferencias' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Entregas' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Recolección' })).toBeTruthy();
  });
});
