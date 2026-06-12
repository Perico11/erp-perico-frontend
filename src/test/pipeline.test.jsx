/* Tests del pipeline canónico (Checkpoint.jsx) — protege la semántica de
   etapas que consumen MisLotesPipeline, PedidosPage y RutaPedidoRail.
   AG30 separó en_recoleccion como etapa propia: estos tests evitan que un
   refactor futuro vuelva a colapsarla o rompa los alias. */
import { describe, it, expect } from 'vitest';
import { ETAPAS_PEDIDO, idxEtapaLote } from '../components/pipeline/Checkpoint';

const keys = ETAPAS_PEDIDO.map(e => e.key);

describe('ETAPAS_PEDIDO (ciclo de vida canónico)', () => {
  it('tiene las 11 etapas en el orden del flujo real', () => {
    expect(keys).toEqual([
      'pedido', 'aceptado', 'en_produccion', 'producido', 'qc_aprobado',
      'en_envasado', 'envasado', 'en_recoleccion', 'en_camino', 'en_almacen', 'entregado',
    ]);
  });

  it('en_recoleccion es etapa PROPIA del Almacén (no del Técnico)', () => {
    const et = ETAPAS_PEDIDO.find(e => e.key === 'en_recoleccion');
    expect(et).toBeTruthy();
    expect(et.rol).toBe('Almacén');
  });

  it('envasado ya no se llama "Listo para recolectar" (eso colapsaba 2 estados)', () => {
    const et = ETAPAS_PEDIDO.find(e => e.key === 'envasado');
    expect(et.label).toBe('Envasado');
  });
});

describe('idxEtapaLote (estado crudo → índice de etapa)', () => {
  const idxDe = (k) => keys.indexOf(k);

  it('en_recoleccion mapea a su PROPIA etapa (no a envasado)', () => {
    expect(idxEtapaLote('en_recoleccion')).toBe(idxDe('en_recoleccion'));
    expect(idxEtapaLote('en_recoleccion')).toBeGreaterThan(idxEtapaLote('envasado'));
  });

  it('qc_hold se ubica en QC (se pinta rojo aparte, sin avanzar)', () => {
    expect(idxEtapaLote('qc_hold')).toBe(idxDe('qc_aprobado'));
  });

  it('en_proceso (despacho parcial) cuenta como en_camino', () => {
    expect(idxEtapaLote('en_proceso')).toBe(idxDe('en_camino'));
  });

  it('el orden es monótono a lo largo del flujo', () => {
    const flujo = ['pedido', 'aceptado', 'en_produccion', 'producido',
      'en_envasado', 'envasado', 'en_recoleccion', 'en_camino', 'en_almacen', 'entregado'];
    for (let i = 1; i < flujo.length; i++) {
      expect(idxEtapaLote(flujo[i])).toBeGreaterThan(idxEtapaLote(flujo[i - 1]));
    }
  });

  it('estado desconocido cae al inicio (0), no truena', () => {
    expect(idxEtapaLote('xx-no-existe')).toBe(0);
    expect(idxEtapaLote(undefined)).toBe(0);
  });
});
