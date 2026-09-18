/* El Almacén 2 es RESERVA: de ahí no se envasa (18-sep-2026, regla del dueño).

   "Todo lo que está en almacén 2 es tote lleno; Terán envasa. Nunca se envasa
   allá, siempre se transfiere primero."

   El daño que evita no es de forma: los envases y las tapas salen SIEMPRE del
   pool de TERÁN, y ese pool sólo existe en Fábrica y Terán. Envasar un color
   del Almacén 2 gastaba cubetas de un almacén para pintura de otro. El servidor
   lo rechaza con 409; esto es para que nadie llegue a apretar el botón. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { urlImportStkAmericano: () => '/x' } }));
vi.mock('../hooks/useIsDesktop', () => ({ default: () => true }));
vi.mock('../components/ui/ImportExportPrint', () => ({ default: () => null }));
vi.mock('../pages/inventario/MPActions', () => ({ MPActionsMenu: () => null }));

import StkAmericanoView from '../pages/stk-americano/StkAmericanoView';

const DATA = {
  colores: [{ key: 'best-beige', nombre: 'Best Beige', cubetas: 0, galones: 0, totesLitros: 1000, totesEquiv: 1, totes: [{ codigoLote: 'USA2-0001-01', litros: 1000, litrosOriginal: 1000 }], lotes: [] }],
  resumen: { cubetas: 0, galones: 0, totesLitros: 1000, totesEquiv: 1, colores: 1 },
  catalogo: ['Best Beige'],
};
const ver = (almacen) => render(
  <StkAmericanoView data={DATA} loading={false} reload={() => {}} canEdit={true} almacen={almacen} />
);

describe('Almacén 2 = reserva', () => {
  it('en el Almacén 2 NO hay botón de envasar, y se dice por qué', () => {
    ver('2');
    expect(document.querySelector('[data-id="stkAmericano.btn.envasar"]')).toBeNull();
    expect(screen.getByText(/transfiere el tote a Terán/i)).toBeInTheDocument();
  });

  it('en Terán se envasa como siempre, y no aparece el aviso de reserva', () => {
    ver('1');
    expect(document.querySelector('[data-id="stkAmericano.btn.envasar"]')).not.toBeNull();
    expect(document.querySelector('[data-id="stkAmericano.aviso.reserva"]')).toBeNull();
  });
});
