/* Conteo por PIEZAS del PT (15-sep-2026, propuesta A) — lógica pura.
   El dueño: "la lógica dice que tengo N cubetas, pero el stock viene en totes
   (llenos o parciales), cubetas, galones y algunos en litros envasados".
   Estos tests anclan que:
     · un bucket de pt-por-ubicacion se lee como piezas ENTERAS + litros sueltos
       (la fracción de una columna no se pierde: se va a granel);
     · los litros del tote ABIERTO no se cuentan dos veces (chip parcial vs granel);
     · Σ litros y el cubeta-equivalente cuadran con el backend (lib/ptConteo);
     · el payload al endpoint lleva las 6 claves que el backend entiende. */
import { describe, it, expect } from 'vitest';
import {
  piezasDesdeBucket, piezasDeUbicacion, litrosDePiezas, cubDePiezas, payloadPiezas,
  totesParcialesDeTraza, resumenPiezasTotal, chipsDePiezas, totesAbiertosDe,
  cubALitros, litrosACub, LITROS_TOTE,
} from '../utils/ptConteo';

/* Terán de BLANCO OFFWHITE 4.0: un tote abierto con 344 L (granel 18.105 cub)
   + 17 cubetas + 21 galones + 6 litros. Mismo caso que el test de integración
   del backend (test/ptConteoRoutes.integration.test.js). */
const TERAN = { cubeta: 17, galon: 21, litro: 6, tote: 0, atm: 0, otros: 0, granel: 18.105, manual: 0 };
const FABRICA = { cubeta: 12, galon: 0, litro: 0, tote: 1, atm: 0, otros: 0, granel: 0, residual: 0 };

describe('piezasDesdeBucket', () => {
  it('lee el bucket como piezas enteras y pasa el granel a litros', () => {
    const p = piezasDesdeBucket(TERAN);
    expect(p).toMatchObject({ tote: 0, cubeta: 17, galon: 21, litro: 6, atomizador750: 0 });
    expect(p.granelL).toBe(344); /* 18.105 cub × 19 L */
  });

  it('la FRACCIÓN de una columna no se pierde: se va a granel', () => {
    /* Residual capturado en medida tote: 1.5 totes = 1 tote + 494 L sueltos. */
    const p = piezasDesdeBucket({ tote: 1.5, cubeta: 0, galon: 0, litro: 0, atm: 0, otros: 0 });
    expect(p.tote).toBe(1);
    expect(p.granelL).toBe(494);
    expect(litrosDePiezas(p)).toBe(1.5 * LITROS_TOTE);
  });

  it('las piezas sin tipo (etiquetas viejas) quedan aparte, no como cubetas', () => {
    expect(piezasDesdeBucket({ otros: 173 }).otros).toBe(173);
    expect(piezasDesdeBucket({ otros: 173 }).cubeta).toBe(0);
  });

  it('bucket ausente → todo en cero', () => {
    expect(piezasDesdeBucket(null)).toMatchObject({ tote: 0, cubeta: 0, granelL: 0 });
  });
});

describe('piezasDeUbicacion (lo que precarga la ficha "Contar")', () => {
  /* Terán con el tote ABIERTO: el bucket lo trae dos veces — la etiqueta en la
     columna tote y sus 344 L en el granel del pool. */
  const TERAN_CON_ETIQUETA = { ...TERAN, tote: 1 };
  const PARCIAL = [{ cod: 'SL-A', litros: 344, ubic: 'teran' }];

  it('el tote abierto cuenta UNA vez: 344 L, no un tote lleno además', () => {
    const p = piezasDeUbicacion(TERAN_CON_ETIQUETA, PARCIAL);
    expect(p.tote).toBe(0);
    expect(p.granelL).toBe(344);
    expect(litrosDePiezas(p)).toBe(752.16); /* = el escalar del pool */
  });

  it('un tote LLENO junto a uno abierto sigue contando como lleno', () => {
    const p = piezasDeUbicacion({ ...TERAN_CON_ETIQUETA, tote: 2 }, PARCIAL);
    expect(p.tote).toBe(1);
    expect(p.granelL).toBe(344);
  });

  it('sin totes abiertos rastreados el bucket pasa tal cual', () => {
    expect(piezasDeUbicacion(FABRICA, [])).toEqual(piezasDesdeBucket(FABRICA));
  });
});

describe('litros y cubeta-equivalente', () => {
  it('Σ litros de Terán cuadra con el backend: 752.16 L ≈ 39.587 cub', () => {
    const p = piezasDesdeBucket(TERAN);
    expect(litrosDePiezas(p)).toBe(752.16);
    expect(cubDePiezas(p)).toBe(39.587);
  });

  it('Fábrica: 1 tote + 12 cubetas = 1,216 L', () => {
    expect(litrosDePiezas(piezasDesdeBucket(FABRICA))).toBe(1216);
  });

  it('cubALitros / litrosACub son inversas (cubeta = 19 L)', () => {
    expect(cubALitros(104)).toBe(1976);
    expect(litrosACub(1976)).toBe(104);
  });
});

describe('payloadPiezas', () => {
  it('manda las 6 claves del endpoint, enteras salvo granelL', () => {
    const p = payloadPiezas({ tote: 1, granelL: 343.995, cubeta: 17, galon: 21, litro: 6, atomizador750: 0, otros: 9 });
    expect(p).toEqual({ tote: 1, granelL: 344, cubeta: 17, galon: 21, litro: 6, atomizador750: 0 });
  });

  it('valores vacíos o negativos se saneian a 0 (nunca stock negativo)', () => {
    expect(payloadPiezas({ cubeta: '', galon: -3 })).toEqual({ tote: 0, granelL: 0, cubeta: 0, galon: 0, litro: 0, atomizador750: 0 });
  });
});

describe('totesParcialesDeTraza', () => {
  const TRAZA = [{
    producto: 'BLANCO OFFWHITE 4.0', estado: 'en_almacen',
    sublotes: [
      { cod: 'SL-A', tipo: 'tote', estado: 'tote_activo', ub: 'teran', litrosRestante: 344 },
      { cod: 'SL-B', tipo: 'tote', estado: 'tote_activo', ub: 'teran', litrosRestante: 988 },  /* lleno */
      { cod: 'SL-C', tipo: 'tote', estado: 'tote_vaciado', ub: 'teran', litrosRestante: 12 },  /* vacío */
      { cod: 'SL-D', tipo: 'cubeta', estado: 'en_stock_teran', qty: 17 },
    ],
  }, {
    producto: 'AZUL REY 4.0', estado: 'envasado',
    sublotes: [{ cod: 'SL-E', tipo: 'tote', estado: 'tote_activo', litrosRestante: 610 }],
  }, {
    producto: 'DE PRUEBA', esPrueba: true,
    sublotes: [{ cod: 'SL-F', tipo: 'tote', estado: 'tote_activo', litrosRestante: 500 }],
  }];

  it('solo los totes ABIERTOS con litros, por producto y ubicación', () => {
    const m = totesParcialesDeTraza(TRAZA);
    expect(m['BLANCO OFFWHITE 4.0']).toEqual([{ cod: 'SL-A', litros: 344, ubic: 'teran' }]);
    expect(m['AZUL REY 4.0']).toEqual([{ cod: 'SL-E', litros: 610, ubic: 'fabrica' }]);
  });

  it('los lotes de prueba nunca cuentan', () => {
    expect(totesParcialesDeTraza(TRAZA)['DE PRUEBA']).toBeUndefined();
  });
});

describe('resumenPiezasTotal + chips de la fila', () => {
  /* Total = Fábrica (1 tote lleno + 12 cub) + Terán (tote abierto 344 L + 17 cub
     + 21 gal + 6 L). El bucket total cuenta 2 totes y 344 L de granel: uno de
     esos totes ES el abierto. */
  const TOTAL = { tote: 2, cubeta: 29, galon: 21, litro: 6, atm: 0, otros: 0, granel: 18.105 };
  const PARCIALES = [{ cod: 'SL-A', litros: 344, ubic: 'teran' }];

  it('el tote abierto es UN chip: ni tote lleno de más ni granel duplicado', () => {
    const p = resumenPiezasTotal(TOTAL, PARCIALES);
    expect(p.llenos).toBe(1);
    expect(p.parciales).toHaveLength(1);
    expect(p.litrosParciales).toBe(344);
    expect(p.granelL).toBe(0);
  });

  it('los chips dicen las piezas reales, no "104 cubetas"', () => {
    const textos = chipsDePiezas(resumenPiezasTotal(TOTAL, PARCIALES)).map(c => c.texto);
    expect(textos).toEqual(['1 tote lleno', '1 tote parcial · 344 L', '29 cubetas', '21 galones', '6 litros']);
  });

  it('el chip de tote va en ámbar y el del parcial en morado (granel)', () => {
    const chips = chipsDePiezas(resumenPiezasTotal(TOTAL, PARCIALES));
    expect(chips[0].tono).toBe('tote');
    expect(chips[1].tono).toBe('granel');
    expect(chips[2].tono).toBe('pieza');
  });

  it('granel SIN tote rastreado se muestra como tal (censo pendiente)', () => {
    const p = resumenPiezasTotal({ cubeta: 3, granel: 10 }, []);
    expect(p.granelL).toBe(190);
    expect(chipsDePiezas(p).map(c => c.texto)).toEqual(['a granel · 190 L', '3 cubetas']);
  });

  it('producto sin existencia → sin chips', () => {
    const p = resumenPiezasTotal({}, []);
    expect(p.vacio).toBe(true);
    expect(chipsDePiezas(p)).toEqual([]);
  });
});

describe('KPI "Totes abiertos"', () => {
  it('cuenta los parciales rastreados y los pools con granel suelto', () => {
    const items = [
      { piezas: resumenPiezasTotal({ tote: 2, granel: 18.105 }, [{ cod: 'SL-A', litros: 344, ubic: 'teran' }]) },
      { piezas: resumenPiezasTotal({ cubeta: 3, granel: 32.1 }, []) }, /* granel sin tote censado */
      { piezas: resumenPiezasTotal({ cubeta: 8 }, []) },
      { piezas: null },
    ];
    const t = totesAbiertosDe(items);
    expect(t.n).toBe(2);
    expect(t.litros).toBe(953.9); /* 344 del parcial + 609.9 del granel (32.1 cub) */
  });
});
