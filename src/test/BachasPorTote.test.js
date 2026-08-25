/* ════════════════════════════════════════════════════════════════════════════
   800 KG DE AGUA EN UN TANQUE DE 400 (25-ago-2026).

   El dueño mandó producir un pedido de BLANCO OFFWHITE por 2 totes y el flujo
   le pidió el doble de cada materia prima. No se habían juntado dos órdenes:
   el pedido ES de 2 totes y el ERP lo trataba como UNA sola mezcla.

   La cadena: el pedido guarda `cantidad` en CUBETA-EQUIVALENTE (2 totes = 104),
   ProduccionFlow escala la receta por esa cantidad (kg19 × 104) y el número de
   bachas arrancaba en 1. Resultado: la receta de la orden entera presentada
   como una tirada, y 400 kg de agua convertidos en 800.

   Una bacha es un tanque y el tanque es un tote. Estas pruebas fijan esa
   frontera, que es la que impide repetir el error.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import {
  LITROS_POR_BACHA, bachasParaLitros, medidaACubetas, cubetasPorMedida,
} from '../utils/ptMedidas';

const CUB = 19; /* litros por cubeta — la unidad base de `cantidad` */

describe('capacidad de una bacha', () => {
  it('una bacha es un tote: 988 L', () => {
    expect(LITROS_POR_BACHA).toBe(988);
    /* Y el tote sigue siendo 52 cubetas, que es de donde sale el 104. */
    expect(cubetasPorMedida('tote')).toBe(52);
  });

  it('el caso del dueño: 2 totes = 104 cub = 2 bachas, no 1', () => {
    const cantidad = medidaACubetas('tote', 2);
    expect(cantidad).toBe(104);
    expect(bachasParaLitros(cantidad * CUB)).toBe(2);
  });

  it('un tote exacto sigue siendo UNA bacha (no parte de más por redondeo)', () => {
    const cantidad = medidaACubetas('tote', 1); /* 52 cub = 988 L clavados */
    expect(bachasParaLitros(cantidad * CUB)).toBe(1);
  });

  it('el pedido chico no se toca: 10 cubetas = 1 bacha', () => {
    expect(bachasParaLitros(10 * CUB)).toBe(1);
  });

  it('lo que se pasa aunque sea por poco necesita otra bacha', () => {
    expect(bachasParaLitros(989)).toBe(2);
    expect(bachasParaLitros(53 * CUB)).toBe(2); /* 1007 L */
  });

  it('escala más allá del tope viejo de 6 bachas (una orden de 8 totes)', () => {
    /* cambiarNumBachas topaba en 6: 8 totes no se podían repartir bien. */
    const cantidad = medidaACubetas('tote', 8);
    expect(bachasParaLitros(cantidad * CUB)).toBe(8);
  });

  it('cantidad cero o basura no revienta ni pide media bacha', () => {
    expect(bachasParaLitros(0)).toBe(1);
    expect(bachasParaLitros(-5)).toBe(1);
    expect(bachasParaLitros(undefined)).toBe(1);
    expect(bachasParaLitros('no es un número')).toBe(1);
  });
});

describe('el reparto de la receta', () => {
  /* kg19 del agua en BLANCO OFFWHITE ≈ 7.6923: por eso 52 cub dan ~400 kg. */
  const kg19Agua = 400 / 52;

  it('el TOTAL de la orden sigue siendo el total (el inventario no cambia)', () => {
    /* La MP se descuenta una vez por el total — partir en bachas NO debe
       alterar lo que sale de almacén, solo cómo se reparte en el tanque. */
    const totalKg = kg19Agua * 104;
    expect(Math.round(totalKg)).toBe(800);
  });

  it('lo que va POR BACHA es la mitad: los 400 kg que esperaba el dueño', () => {
    const totalKg = kg19Agua * 104;
    const n = bachasParaLitros(104 * CUB);
    expect(Math.round(totalKg / n)).toBe(400);
  });
});
