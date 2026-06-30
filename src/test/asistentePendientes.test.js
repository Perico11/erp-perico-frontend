import { describe, it, expect } from 'vitest';
import { resumirPendientes, fraseProactiva } from '../utils/asistentePendientes';

describe('resumirPendientes', () => {
  it('badge = no leídas; rojo si hay críticas', () => {
    const r = resumirPendientes({ total: 10, noLeidas: 4, criticas: 2 });
    expect(r.count).toBe(4);
    expect(r.badge).toBe('4');
    expect(r.mostrar).toBe(true);
    expect(r.critico).toBe(true);
  });

  it('sin críticas → no es rojo (ámbar)', () => {
    const r = resumirPendientes({ total: 5, noLeidas: 5, criticas: 0 });
    expect(r.critico).toBe(false);
    expect(r.mostrar).toBe(true);
  });

  it('cero no leídas → no se muestra el badge', () => {
    const r = resumirPendientes({ total: 8, noLeidas: 0, criticas: 0 });
    expect(r.mostrar).toBe(false);
    expect(r.badge).toBe('0');
  });

  it('cap a 99+ para muchos pendientes', () => {
    expect(resumirPendientes({ noLeidas: 150 }).badge).toBe('99+');
    expect(resumirPendientes({ noLeidas: 99 }).badge).toBe('99');
  });

  it('defensivo: resumen ausente / valores basura → ceros, no se muestra', () => {
    for (const bad of [null, undefined, {}, { noLeidas: 'x' }, { noLeidas: -3 }, { noLeidas: NaN }]) {
      const r = resumirPendientes(bad);
      expect(r.count).toBe(0);
      expect(r.mostrar).toBe(false);
    }
  });
});

describe('fraseProactiva', () => {
  it('singular / plural / críticas', () => {
    expect(fraseProactiva({ total: 1, criticas: 0 })).toBe('Tienes **1** pendiente.');
    expect(fraseProactiva({ total: 3, criticas: 0 })).toBe('Tienes **3** pendientes.');
    expect(fraseProactiva({ total: 5, criticas: 1 })).toBe('Tienes **5** pendientes (1 crítica).');
    expect(fraseProactiva({ total: 5, criticas: 2 })).toBe('Tienes **5** pendientes (2 críticas).');
  });

  it('sin pendientes → cadena vacía (saludo normal)', () => {
    expect(fraseProactiva({ total: 0 })).toBe('');
    expect(fraseProactiva(null)).toBe('');
  });
});
