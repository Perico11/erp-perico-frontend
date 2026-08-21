/* ════════════════════════════════════════════════════════════════════════════
   EntregasCatalogo.test.js — Un producto con stock en Terán nunca desaparece
   de la pantalla de Entregas.

   POR QUÉ EXISTE (reporte del dueño, 27-jul-2026): "en Entregas de Josué no se
   están registrando las entregas a tienda, y el azul rey y otros colores dicen
   que no aparecen como disponibles a pesar de tener stock".

   No era un fallo de guardado: Josué no podía ni ARMAR la entrega. El catálogo
   filtraba por presentación envasada, así que un producto cuyo stock estuviera
   en un tote sin abrir o en granel se caía de la lista entera. En producción
   eran 4 productos invisibles con 208 cub-eq (BASE CHOCOLATE, MANDARINA,
   BLANCO SGLOSS y B. VERDE BOSQUE, cada uno con tote=1), más AZUL REY, que
   mostraba 10 cubetas cuando el inventario decía 52.

   La regla de negocio es correcta —a una tienda no se le entrega un tote de
   988 L— pero esconder el producto convierte una regla en un error aparente.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import { catalogoPT } from '../pages/entregas/EntregasPage';

/* Forma real de /api/inventario/pt-por-ubicacion (tomada de producción). */
const TERAN = {
  'AZUL REY  4.0': { cubeta: 10, galon: 16, litro: 0, tote: 0, atm: 0, granel: 38.813 },
  'B. VERDE BOSQUE 4.0': { cubeta: 0, galon: 0, litro: 0, tote: 1, atm: 0, granel: 0 },
  'PROCAUCHO BLANCO 4.0': { cubeta: 36, galon: 0, litro: 0, tote: 0, atm: 0, granel: 0 },
  'SIN NADA': { cubeta: 0, galon: 0, litro: 0, tote: 0, atm: 0, granel: 0 },
};

describe('catálogo de PT para entregas', () => {
  it('un producto cuyo stock está TODO en un tote sigue apareciendo', () => {
    const cat = catalogoPT(TERAN);
    const vb = cat.find(c => c.nombre === 'B. VERDE BOSQUE 4.0');

    expect(vb).toBeTruthy();          /* ESTA es la regresión: antes no existía */
    expect(vb.envasado).toBe(false);  /* pero marcado como no entregable */
    expect(vb.totes).toBe(1);
    expect(vb.sinEnvasar).toBe(52);   /* 1 tote = 52 cub-eq */
  });

  it('el granel cuenta como pendiente de envasar, no como disponible', () => {
    const azul = catalogoPT(TERAN).find(c => c.nombre === 'AZUL REY  4.0');

    expect(azul.envasado).toBe(true);
    expect(azul.disp.cubeta).toBe(10);      /* lo que de verdad se puede entregar */
    expect(azul.disp.galon).toBe(16);
    expect(azul.sinEnvasar).toBe(38.81);    /* el resto, que explicaba el "solo hay 10" */
  });

  it('un producto totalmente envasado no reporta pendientes', () => {
    const p = catalogoPT(TERAN).find(c => c.nombre === 'PROCAUCHO BLANCO 4.0');
    expect(p.envasado).toBe(true);
    expect(p.sinEnvasar).toBe(0);
  });

  it('los que no tienen nada sí se omiten', () => {
    expect(catalogoPT(TERAN).find(c => c.nombre === 'SIN NADA')).toBeUndefined();
  });

  it('lo entregable va primero; lo que hay que re-envasar, después', () => {
    const nombres = catalogoPT(TERAN).map(c => c.nombre);
    expect(nombres.indexOf('B. VERDE BOSQUE 4.0')).toBe(nombres.length - 1);
  });

  it('no truena con datos incompletos', () => {
    expect(catalogoPT(undefined)).toEqual([]);
    expect(catalogoPT({})).toEqual([]);
    const raro = catalogoPT({ X: { cubeta: '5', tote: null, granel: undefined } });
    expect(raro[0].disp.cubeta).toBe(5);
    expect(raro[0].sinEnvasar).toBe(0);
  });

  it('las fracciones de cubeta no se cuentan como entregables', () => {
    /* 0.6 de cubeta no es una cubeta: entregar media no es una opción. */
    const c = catalogoPT({ X: { cubeta: 0.6, galon: 0, tote: 0, granel: 0 } });
    expect(c).toEqual([]);
  });
});
