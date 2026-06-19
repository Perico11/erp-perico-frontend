import { describe, it, expect } from 'vitest';
import { etiquetaMedida, etiquetaMedidaReal, medidaACubetas } from '../utils/ptMedidas';

/* etiquetaMedidaReal alimenta las vistas downstream (tarjeta de pedido,
   órdenes, producción): muestra la medida real con el cubeta-equivalente como
   contexto, o null para que la vista caiga a su texto de cubetas (compat). */
describe('etiquetaMedidaReal', () => {
  it('medida real (tote) → "2 totes · N cub" con el cubeta-equivalente', () => {
    const cub = medidaACubetas('tote', 2); /* 104 */
    expect(etiquetaMedidaReal('tote', 2, cub)).toBe('2 totes · 104 cub');
  });

  it('atomizador750 conserva el sufijo "750 ml"', () => {
    expect(etiquetaMedidaReal('atomizador750', 100, 4)).toBe('100 atomizadores 750 ml · 4 cub');
  });

  it('singular: 1 galón', () => {
    const cub = medidaACubetas('galon', 1);
    expect(etiquetaMedidaReal('galon', 1, cub)).toBe(`1 galón · ${cub.toLocaleString('es-MX', { maximumFractionDigits: 1 })} cub`);
  });

  it('cubeta → null (no aporta nada sobre "N cubetas"; la vista usa su fallback)', () => {
    expect(etiquetaMedidaReal('cubeta', 50, 50)).toBeNull();
  });

  it('sin medida → null (registros viejos caen a cubetas)', () => {
    expect(etiquetaMedidaReal(undefined, undefined, 50)).toBeNull();
    expect(etiquetaMedidaReal('', null, 50)).toBeNull();
  });

  it('medida inválida → null', () => {
    expect(etiquetaMedidaReal('barril', 3, 10)).toBeNull();
  });

  it('medida real sin medidaQty → null (no se puede formar "X totes")', () => {
    expect(etiquetaMedidaReal('tote', null, 104)).toBeNull();
  });
});

/* Sanidad del helper base que ya existía. */
describe('etiquetaMedida (base)', () => {
  it('pluraliza y formatea con locale es-MX', () => {
    expect(etiquetaMedida('tote', 2)).toBe('2 totes');
    expect(etiquetaMedida('cubeta', 1)).toBe('1 cubeta');
    expect(etiquetaMedida('atomizador750', 1500)).toBe('1,500 atomizadores 750 ml');
  });
});
