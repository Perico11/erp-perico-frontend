/* Tests de lib/estados.js — fuente ÚNICA de buckets/estados del pipeline.
   Fija el normalizador de estados-fantasma (mata la "deriva de buckets") y el
   bucketeo de PEDIDO que antes vivía inline en PedidosPage. */
import { describe, it, expect } from 'vitest';
import {
  normEstado, esPedidoTerminal, esPedidoRechazado, esPedidoHistorial, bucketPedido, esOrdenActiva,
} from '../lib/estados';

describe('normEstado — normaliza variantes/fantasmas a canónico', () => {
  it('entregada (con -a) → entregado', () => expect(normEstado('entregada')).toBe('entregado'));
  it('en_stock_teran → en_almacen', () => expect(normEstado('en_stock_teran')).toBe('en_almacen'));
  it('respeta canónicos', () => expect(normEstado('pendiente')).toBe('pendiente'));
  it('en_proceso NO se aliasa (es estado real)', () => expect(normEstado('en_proceso')).toBe('en_proceso'));
  it('case-insensitive', () => expect(normEstado('ENTREGADA')).toBe('entregado'));
  it('null/undefined → cadena vacía', () => { expect(normEstado(null)).toBe(''); expect(normEstado(undefined)).toBe(''); });
});

describe('esPedidoTerminal / esPedidoRechazado', () => {
  it('entregado/rechazado/cancelado son terminal', () => {
    expect(esPedidoTerminal('entregado')).toBe(true);
    expect(esPedidoTerminal('rechazado')).toBe(true);
    expect(esPedidoTerminal('cancelado')).toBe(true);
  });
  it('la variante entregada también es terminal (vía norm)', () => expect(esPedidoTerminal('entregada')).toBe(true));
  it('en_almacen y pendiente NO son terminal', () => {
    expect(esPedidoTerminal('en_almacen')).toBe(false);
    expect(esPedidoTerminal('pendiente')).toBe(false);
  });
  it('rechazado/cancelado son "rechazados"; entregado no', () => {
    expect(esPedidoRechazado('rechazado')).toBe(true);
    expect(esPedidoRechazado('cancelado')).toBe(true);
    expect(esPedidoRechazado('entregado')).toBe(false);
  });
});

describe('bucketPedido — Activos / Pruebas / Rechazados / Historial', () => {
  it('pendiente → activos; pendiente+prueba → pruebas', () => {
    expect(bucketPedido({ estado: 'pendiente' })).toBe('activos');
    expect(bucketPedido({ estado: 'pendiente', esPrueba: true })).toBe('pruebas');
  });
  it('en_almacen → activos (NO historial: el flujo descansa ahí)', () => {
    expect(bucketPedido({ estado: 'en_almacen' })).toBe('activos');
  });
  it('rechazado/cancelado → rechazados', () => {
    expect(bucketPedido({ estado: 'rechazado' })).toBe('rechazados');
    expect(bucketPedido({ estado: 'cancelado' })).toBe('rechazados');
  });
  it('entregado → historial; variante entregada también (drift fix)', () => {
    expect(bucketPedido({ estado: 'entregado' })).toBe('historial');
    expect(bucketPedido({ estado: 'entregada' })).toBe('historial');
  });
  it('entregado+prueba → null (invisible, comportamiento histórico preservado)', () => {
    expect(bucketPedido({ estado: 'entregado', esPrueba: true })).toBe(null);
  });
  it('null → null', () => expect(bucketPedido(null)).toBe(null));
  it('esPedidoHistorial coherente con bucket', () => {
    expect(esPedidoHistorial({ estado: 'entregado' })).toBe(true);
    expect(esPedidoHistorial({ estado: 'entregado', esPrueba: true })).toBe(false);
    expect(esPedidoHistorial({ estado: 'en_almacen' })).toBe(false);
  });
});

describe('esOrdenActiva — la tarjeta "Órdenes en proceso" cuenta TODO lo no cerrado (FIX 9-sep-2026)', () => {
  it('los estados del dominio del LOTE que la lista de arranque perdía SÍ son activos', () => {
    for (const e of ['producido', 'qc_hold', 'qc_aprobado', 'en_envasado', 'envasado',
      'en_recoleccion', 'en_camino', 'en_almacen', 'en_proceso']) {
      expect(esOrdenActiva(e), e).toBe(true);
    }
  });
  it('los de arranque siguen activos', () => {
    for (const e of ['pendiente', 'aceptado', 'en_produccion']) expect(esOrdenActiva(e), e).toBe(true);
  });
  it('las terminales NO cuentan — la variante "entregada" tampoco (vía norm)', () => {
    for (const e of ['entregado', 'entregada', 'cancelado', 'rechazado', 'eliminado']) {
      expect(esOrdenActiva(e), e).toBe(false);
    }
  });
  it('la variante en_stock_teran cuenta como en_almacen: activa', () => {
    expect(esOrdenActiva('en_stock_teran')).toBe(true);
  });
});
