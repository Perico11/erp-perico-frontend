/* ════════════════════════════════════════════════════════════════════════════
   MEZCLAR COLORES — el modal (28-ago-2026, pedido dueño).

   "Usamos el blanco y un beige para crear el blanco off white… que el nuevo
   color se cree en automático a inventario con su cantidad y lote."

   Lo que se fija aquí es el CONTRATO con el backend: que el payload lleve
   exactamente lo que el piso eligió (tote elegido vs granel, litros, destino),
   que la pintura de fábrica sólo se ofrezca en Terán, y que el botón no deje
   mandar una mezcla incompleta o con más litros de los que hay.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import MezclarAmericanoModal from '../pages/stk-americano/MezclarAmericanoModal';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    mezclarStkAmericano: vi.fn(() => Promise.resolve({ ok: true, lote: 'USA-0012-01', color: { nombre: 'BLANCO OFF WHITE' } })),
    getInventario: vi.fn(() => Promise.resolve({ ok: true, data: { pt: { 'BLANCO SG': { qty: 10, teran: 60 } } } })),
    getVaciadores: vi.fn(() => Promise.resolve({ ok: true, data: [] })),
  },
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));

/* El piso real: navajo con su tambo del proveedor, beige con granel. */
const COLORES = [
  { key: 'navajo', nombre: 'NAVAJO', cubetas: 0, galones: 0, totesLitros: 1000,
    totes: [{ codigoLote: 'GD89810 #07', litros: 1000, loteProveedor: 'GD89810 #07' }] },
  { key: 'best-beige', nombre: 'BEST BEIGE', cubetas: 0, galones: 0, totesLitros: 600, totes: [] },
];

const $ = (sel) => document.querySelector(sel);
const abrir = (props) => render(
  <MezclarAmericanoModal colores={COLORES} almacen="1" onClose={() => {}} onSaved={() => {}} {...props} />
);
const ponerIngrediente = (i, key, litros) => {
  fireEvent.change($(`[data-id="stkAmericano.mezclar.color${i}"]`), { target: { value: key } });
  fireEvent.change($(`[data-id="stkAmericano.mezclar.litros${i}"]`), { target: { value: String(litros) } });
};

beforeEach(() => vi.clearAllMocks());

describe('mezclar colores', () => {
  it('arma el payload con el tote ELEGIDO, el granel y el color destino', async () => {
    abrir();
    ponerIngrediente(0, 'navajo', 600);
    fireEvent.change($('[data-id="stkAmericano.mezclar.tote0"]'), { target: { value: 'GD89810 #07' } });
    ponerIngrediente(1, 'best-beige', 400);
    fireEvent.change($('[data-id="stkAmericano.mezclar.destino"]'), { target: { value: 'BLANCO OFF WHITE' } });
    fireEvent.click($('[data-id="stkAmericano.mezclar.confirmar"]'));
    await waitFor(() => expect(api.mezclarStkAmericano).toHaveBeenCalledTimes(1));
    const payload = api.mezclarStkAmericano.mock.calls[0][0];
    expect(payload.almacen).toBe('1');
    expect(payload.destino).toEqual({ nombre: 'BLANCO OFF WHITE' });
    expect(payload.ingredientes).toEqual([
      { fuente: 'americano', key: 'navajo', nombre: 'NAVAJO', litros: 600, codigoLote: 'GD89810 #07' },
      { fuente: 'americano', key: 'best-beige', nombre: 'BEST BEIGE', litros: 400 },
    ]);
  });

  it('con menos de dos ingredientes completos el botón NO manda nada', async () => {
    abrir();
    ponerIngrediente(0, 'navajo', 600);
    fireEvent.change($('[data-id="stkAmericano.mezclar.destino"]'), { target: { value: 'X' } });
    fireEvent.click($('[data-id="stkAmericano.mezclar.confirmar"]'));
    expect(api.mezclarStkAmericano).not.toHaveBeenCalled();
  });

  it('pedir más litros de los que hay bloquea la mezcla y lo dice', async () => {
    abrir();
    ponerIngrediente(0, 'navajo', 600);
    ponerIngrediente(1, 'best-beige', 9999);
    fireEvent.change($('[data-id="stkAmericano.mezclar.destino"]'), { target: { value: 'X' } });
    fireEvent.click($('[data-id="stkAmericano.mezclar.confirmar"]'));
    expect(api.mezclarStkAmericano).not.toHaveBeenCalled();
    expect(document.body.textContent).toMatch(/disponibles/);
  });

  it('la pintura de fábrica se ofrece en Terán con sus litros del pool', async () => {
    abrir();
    await waitFor(() => expect(api.getInventario).toHaveBeenCalled());
    fireEvent.click($('[data-id="stkAmericano.mezclar.fuentePt0"]'));
    const opciones = [...$('[data-id="stkAmericano.mezclar.pt0"]').options].map(o => o.textContent);
    /* 60 cub-equiv × 19 L = 1140 L */
    expect(opciones.some(t => t.includes('BLANCO SG') && t.includes('1,140'))).toBe(true);

    fireEvent.change($('[data-id="stkAmericano.mezclar.pt0"]'), { target: { value: 'BLANCO SG' } });
    fireEvent.change($('[data-id="stkAmericano.mezclar.litros0"]'), { target: { value: '400' } });
    ponerIngrediente(1, 'navajo', 600);
    fireEvent.change($('[data-id="stkAmericano.mezclar.destino"]'), { target: { value: 'BLANCO OFF WHITE' } });
    fireEvent.click($('[data-id="stkAmericano.mezclar.confirmar"]'));
    await waitFor(() => expect(api.mezclarStkAmericano).toHaveBeenCalledTimes(1));
    expect(api.mezclarStkAmericano.mock.calls[0][0].ingredientes[0]).toEqual({ fuente: 'pt', producto: 'BLANCO SG', litros: 400 });
  });

  it('en el Almacén 2 la pintura de fábrica NO se ofrece: vive en Terán', () => {
    abrir({ almacen: '2' });
    expect(api.getInventario).not.toHaveBeenCalled();
    expect($('[data-id="stkAmericano.mezclar.fuentePt0"]').disabled).toBe(true);
  });

  it('un destino que no existe avisa que el color se creará en automático', () => {
    abrir();
    fireEvent.change($('[data-id="stkAmericano.mezclar.destino"]'), { target: { value: 'BLANCO OFF WHITE' } });
    expect($('[data-id="stkAmericano.mezclar.badgeNuevo"]')).toBeTruthy();
    fireEvent.change($('[data-id="stkAmericano.mezclar.destino"]'), { target: { value: 'best beige' } });
    expect($('[data-id="stkAmericano.mezclar.badgeNuevo"]')).toBeNull();
  });

  it('el lote manual viaja en el payload', async () => {
    abrir();
    ponerIngrediente(0, 'navajo', 300);
    ponerIngrediente(1, 'best-beige', 200);
    fireEvent.change($('[data-id="stkAmericano.mezclar.destino"]'), { target: { value: 'X' } });
    fireEvent.change($('[data-id="stkAmericano.mezclar.lote"]'), { target: { value: 'TG-260828' } });
    fireEvent.click($('[data-id="stkAmericano.mezclar.confirmar"]'));
    await waitFor(() => expect(api.mezclarStkAmericano).toHaveBeenCalledTimes(1));
    expect(api.mezclarStkAmericano.mock.calls[0][0].loteManual).toBe('TG-260828');
  });
});
