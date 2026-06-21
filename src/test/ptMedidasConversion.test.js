import { describe, it, expect } from 'vitest';
import {
  CUBETA_ML, PT_MEDIDAS, ptMedidaDef, cubetasPorMedida, medidaACubetas,
} from '../utils/ptMedidas';

/* Complementa ptMedidas.test.js (que cubre las ETIQUETAS): aquí la MATEMÁTICA de
   conversión a cubeta-equivalente — el cálculo base de costo/forecast/mínimos.
   La cubeta (19 L) es la unidad de contabilidad; todo se deriva de sus ml. */
describe('ptMedidas — conversión a cubeta-equivalente', () => {
  it('constantes: CUBETA_ML=19000 y 5 medidas (tote/cubeta/galón/litro/atomizador)', () => {
    expect(CUBETA_ML).toBe(19000);
    expect(PT_MEDIDAS.map(m => m.key)).toEqual(['tote', 'cubeta', 'galon', 'litro', 'atomizador750']);
  });

  it('cubetasPorMedida: cubeta=1, tote=52, desconocida→1 (fallback seguro)', () => {
    expect(cubetasPorMedida('cubeta')).toBe(1);
    expect(cubetasPorMedida('tote')).toBe(52); /* 988000 / 19000 */
    expect(cubetasPorMedida('xxx')).toBe(1);
  });

  it('medidaACubetas: 2 totes = 104 cubetas (el caso real que motivó el selector)', () => {
    expect(medidaACubetas('tote', 2)).toBe(104);
    expect(medidaACubetas('cubeta', 5)).toBe(5);
  });

  it('medidaACubetas: galón/litro/atomizador → equivalente fraccionario (redondeo 3 decimales)', () => {
    expect(medidaACubetas('galon', 1)).toBeCloseTo(0.199, 3);
    expect(medidaACubetas('litro', 1)).toBeCloseTo(0.05, 3);
    expect(medidaACubetas('atomizador750', 100)).toBeCloseTo(3.947, 3);
  });

  it('medidaACubetas: cantidad inválida/cero → 0 (no NaN, no negativo espurio)', () => {
    expect(medidaACubetas('tote', 'abc')).toBe(0);
    expect(medidaACubetas('tote', 0)).toBe(0);
    expect(medidaACubetas('tote', undefined)).toBe(0);
  });

  it('medidaACubetas: medida desconocida usa factor 1 (trata como cubetas)', () => {
    expect(medidaACubetas('barril', 5)).toBe(5);
  });

  it('ptMedidaDef: conocida → objeto con ml; desconocida → null', () => {
    expect(ptMedidaDef('tote').ml).toBe(988000);
    expect(ptMedidaDef('atomizador750').ml).toBe(750);
    expect(ptMedidaDef('xxx')).toBeNull();
  });
});
