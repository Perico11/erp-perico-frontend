/* El encabezado de "Nuevo pedido" tiene que respirar (17-sep-2026, reporte
   dueño: "arregla la estética de esta card, sale al darle click a nuevo
   pedido o pedir").

   `S.head` no tenía padding: el cuerpo y el pie del sheet sí lo traían, así
   que el título y la X quedaban pegados al borde del panel y sin nada que los
   separara del formulario. Aquí se fija el invariante que importa —las tres
   zonas del sheet alinean— en vez de un número mágico.

   Las dos puertas llevan a este mismo modal: el botón "+ Nuevo pedido" de
   Pedidos y el "+ Pedir" de las tarjetas del PT, que navega a
   /pedidos?nuevo=<producto>. */
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => {
  const vacio = vi.fn(() => Promise.resolve({ ok: true, data: [] }));
  return {
    default: new Proxy(
      { getFormulasSummary: vi.fn(() => Promise.resolve({ ok: true, summary: [{ nombre: 'BLANCO OFFWHITE 4.0' }] })) },
      { get: (t, k) => (typeof k !== 'string' || k in t ? t[k] : vacio) },
    ),
  };
});
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { nombre: 'Emmanuel', rol: 'admin' }, can: () => true }) }));
vi.mock('../hooks/useIsDesktop', () => ({ default: () => true }));

import NuevoPedidoModal from '../pages/pedidos/NuevoPedidoModal';

const abrir = async (prefill = null) => {
  await act(async () => {
    render(<MemoryRouter><NuevoPedidoModal onClose={() => {}} onCreated={() => {}} prefillProducto={prefill} /></MemoryRouter>);
  });
  await act(async () => { await Promise.resolve(); });
  return {
    cab: document.querySelector('[data-id="pedidos.nuevo.encabezado"]'),
    cuerpo: document.querySelector('[data-id="pedidos.nuevo.cuerpo"]'),
  };
};

describe('Nuevo pedido · el encabezado del sheet', () => {
  it('tiene padding: el título ya no va pegado al borde', async () => {
    const { cab } = await abrir();
    expect(cab).toBeTruthy();
    expect(cab.style.paddingTop).not.toBe('');
    expect(parseFloat(cab.style.paddingTop)).toBeGreaterThan(0);
    expect(parseFloat(cab.style.paddingLeft)).toBeGreaterThan(0);
  });

  it('alinea con el cuerpo: mismo padding horizontal', async () => {
    const { cab, cuerpo } = await abrir();
    /* El pie no se compara: su padding lleva env(safe-area-inset-bottom) y
       jsdom no sabe serializar esa función (la devuelve corrupta). En un
       navegador real resuelve 12px 22px 14px 22px — comprobado aparte. */
    expect(cab.style.paddingLeft).toBe(cuerpo.style.paddingLeft);
    expect(cab.style.paddingRight).toBe(cuerpo.style.paddingRight);
  });

  it('se separa del formulario con una regla, como el pie', async () => {
    const { cab } = await abrir();
    expect(cab.style.borderBottom).toMatch(/border-subtle|1px solid/);
  });

  it('el título, el subtítulo y el botón de cerrar siguen ahí', async () => {
    const { cab } = await abrir('BLANCO OFFWHITE 4.0');
    expect(cab.textContent).toMatch(/Nuevo pedido/);
    expect(cab.textContent).toMatch(/Captura un producto/);
    expect(cab.querySelector('button[aria-label="Cerrar"]')).toBeTruthy();
  });
});
