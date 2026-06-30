import { describe, it, expect } from 'vitest';
import { interpretarConfirmacion } from '../utils/asistenteConfirmacion';

describe('interpretarConfirmacion', () => {
  it('afirmaciones por texto/voz → "si"', () => {
    for (const s of ['sí', 'si', 'Sí', 'sale', 'dale', 'hazlo', 'confirmo', 'ok', 'va', 'correcto', 'adelante', 'de acuerdo', 'sí hazlo', 'claro que sí', 'perfecto']) {
      expect(interpretarConfirmacion(s)).toBe('si');
    }
  });

  it('negaciones por texto/voz → "no"', () => {
    for (const s of ['no', 'No', 'cancela', 'cancelar', 'mejor no', 'olvídalo', 'detente', 'no gracias', 'ya no', 'aborta']) {
      expect(interpretarConfirmacion(s)).toBe('no');
    }
  });

  it('ante la duda (sí y no) → "no" gana (seguridad)', () => {
    expect(interpretarConfirmacion('no, mejor sí')).toBe('no');
  });

  it('otros mensajes (no confirmación) → null', () => {
    for (const s of ['transfiere 1 tote de blanco a teran', '¿cuánto stock hay?', 'pendientes', 'stock de agua', '', null, undefined, 'azul rey']) {
      expect(interpretarConfirmacion(s)).toBe(null);
    }
  });

  it('tolera signos y espacios', () => {
    expect(interpretarConfirmacion('  ¡Sí! ')).toBe('si');
    expect(interpretarConfirmacion('no...')).toBe('no');
  });
});
