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

/* Y el pie: 17-sep, segundo reporte del dueño —"la parte de abajo donde está
   cancelar y crear pedidos queda sin padding abajo"—. Medido en un navegador
   real el pie SÍ tenía padding (12px 22px 14px), pero 14 abajo contra 16
   arriba se lee apretado, más con la esquina redondeada de 18 px. Ahora el
   aire de abajo iguala al de arriba.

   Ojo al leerlo: jsdom no sabe serializar env(), así que devuelve el valor
   corrupto ("env(0px * , * safe-area-inset-bottom)") y el navegador tiraría
   la declaración entera EN EL VOLCADO. Por eso aquí se mira el texto del
   estilo y no el valor calculado. */
describe('Nuevo pedido · el pie del sheet', () => {
  it('el aire de abajo iguala al del encabezado, y conserva el safe-area del teléfono', async () => {
    const { cab } = await abrir();
    const pie = document.querySelector('[data-id="pedidos.nuevo.pie"]');
    expect(pie).toBeTruthy();
    const estilo = pie.getAttribute('style') || '';
    expect(estilo).toMatch(/calc\(16px/);                       /* = los 16 del encabezado */
    expect(cab.style.paddingTop).toBe('16px');
    expect(estilo).toMatch(/safe-area-inset-bottom/);           /* el teléfono suma su barra */
    expect(estilo).toMatch(/22px/);                             /* alineado con cuerpo y cabecera */
  });
});
