/* ════════════════════════════════════════════════════════════════════════════
   ELEGIR EL TOTE AL TRANSFERIR (21-ago-2026).

   La pantalla pedía LITROS y nada más. Con varios totes del mismo color y los
   mismos litros —el Almacén 2 tenía OCHO de 1 000 L de BLANCO MATE— el sistema
   escogía uno, y no tenía por qué ser el que el almacenista cargó.

   Pasó de verdad: se quiso mandar a Terán el tote del lote GD89563 y viajó
   otro. En Terán apareció material que no era el esperado, la etiqueta habría
   salido con el lote equivocado, y hubo que corregirlo a mano por SSH con un
   script (scripts/transferir_tote.js en el backend). Esta pantalla es el
   arreglo nativo: con ella, ese script sobra.

   Lo que se fija aquí es que el tote elegido SEA el que se manda, que no se
   pueda pedir de un tote más de lo que tiene, y que "automático" siga
   existiendo para el granel suelto.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TransferirAmericanoModal from '../pages/stk-americano/TransferirAmericanoModal';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: { transferirStkAmericano: vi.fn(() => Promise.resolve({ ok: true })) },
}));

/* El Almacén 2 tal como estaba el 21-ago: varios totes idénticos de 1 000 L,
   uno de ellos el del lote del proveedor, más un resto y un tote a medias. */
const COLOR = {
  /* Con cubetas > 0 para poder probar el cambio de presentación: el botón de
     una presentación sin existencias sale deshabilitado, y el clic no haría
     nada. */
  key: 'blanco-mate', nombre: 'BLANCO MATE', cubetas: 12, galones: 0, totesLitros: 3026.08,
  totes: [
    { codigoLote: 'USA2-0009-04', litros: 1000 },
    { codigoLote: 'GD89563', litros: 1000, loteProveedor: 'GD89563' },
    { codigoLote: 'USA2-0009-03', litros: 981 },
    { codigoLote: 'USA-0050-01', litros: 45.08 },
    { codigoLote: 'USA2-0009-99', litros: 0 },
  ],
};

const abrir = (props) => render(
  <TransferirAmericanoModal color={COLOR} deAlmacen="2" onClose={() => {}} onSaved={() => {}} {...props} />
);
const selector = () => document.querySelector('[data-id="stkAmericano.transferir.tote"]');
const cantidad = () => document.querySelector('[data-id="stkAmericano.transferir.cantidad"]');
const confirmar = () => document.querySelector('[data-id="stkAmericano.transferir.confirmar"]');

beforeEach(() => vi.clearAllMocks());

describe('elegir el tote al transferir litros', () => {
  it('lista los totes con su lote de proveedor y sus litros', () => {
    abrir();
    const opciones = [...selector().options].map(o => o.textContent);
    expect(opciones[0]).toMatch(/Autom/);
    expect(opciones.join('|')).toMatch(/GD89563/);
    expect(opciones.join('|')).toMatch(/1,000 L/);
  });

  it('no ofrece totes vacíos: no se puede cargar lo que no tiene nada', () => {
    abrir();
    const vals = [...selector().options].map(o => o.value);
    expect(vals).not.toContain('USA2-0009-99');
  });

  it('manda EL tote elegido, no otro de los iguales', async () => {
    /* El fallo original en una línea: dos totes de 1 000 L y el sistema
       escogía el primero. */
    abrir();
    fireEvent.change(selector(), { target: { value: 'GD89563' } });
    fireEvent.click(confirmar());
    await waitFor(() => expect(api.transferirStkAmericano).toHaveBeenCalled());
    const payload = api.transferirStkAmericano.mock.calls[0][0];
    expect(payload.codigoLote).toBe('GD89563');
    expect(payload.presentacion).toBe('litros');
    expect(payload.de).toBe('2');
    expect(payload.a).toBe('1');
  });

  it('al elegir un tote precarga sus litros — mover uno completo es lo normal', () => {
    abrir();
    fireEvent.change(selector(), { target: { value: 'USA2-0009-03' } });
    expect(cantidad().value).toBe('981');
  });

  it('el techo pasa a ser ESE tote, no el granel del color', async () => {
    /* Pedir 1 500 L de un tote de 981 saldría de otro tote: justo el problema
       que esta pantalla viene a evitar. */
    abrir();
    fireEvent.change(selector(), { target: { value: 'USA2-0009-03' } });
    fireEvent.change(cantidad(), { target: { value: '1500' } });
    expect(screen.getByText(/USA2-0009-03 solo tiene/)).toBeTruthy();
    expect(confirmar().disabled).toBe(true);
    fireEvent.click(confirmar());
    await waitFor(() => expect(api.transferirStkAmericano).not.toHaveBeenCalled());
  });

  it('sin elegir tote NO manda codigoLote — el granel suelto sigue funcionando', async () => {
    abrir();
    fireEvent.change(cantidad(), { target: { value: '100' } });
    fireEvent.click(confirmar());
    await waitFor(() => expect(api.transferirStkAmericano).toHaveBeenCalled());
    expect(api.transferirStkAmericano.mock.calls[0][0].codigoLote).toBeUndefined();
  });

  it('el resumen dice de qué tote sale, para poder cotejarlo con el fisico', () => {
    abrir();
    fireEvent.change(selector(), { target: { value: 'GD89563' } });
    expect(screen.getByText(/conserva su folio al cruzar/)).toBeTruthy();
    expect(screen.getAllByText('GD89563').length).toBeGreaterThan(0);
  });

  it('cambiar a cubetas quita el selector y olvida el tote', async () => {
    /* Un tote elegido que sobreviva a un cambio de presentación mandaria un
       codigoLote que no corresponde a lo que se está moviendo. */
    abrir();
    fireEvent.change(selector(), { target: { value: 'GD89563' } });
    fireEvent.click(document.querySelector('[data-id="stkAmericano.transferir.pres.cubetas"]'));
    expect(selector()).toBeNull();
  });

  it('un color SIN totes no muestra selector', () => {
    abrir({ color: { key: 'x', nombre: 'X', cubetas: 5, galones: 0, totesLitros: 0, totes: [] } });
    expect(selector()).toBeNull();
  });
});
