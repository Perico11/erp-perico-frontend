/* ════════════════════════════════════════════════════════════════════════════
   Búsqueda y reporte de envíos a tiendas (2-sep-2026, pedido del dueño).

   "Una barra de búsqueda para ver qué se ha mandado a cada tienda… y un
   reporte, ejemplo PROCAUCHO: cuántas se han enviado y a qué tiendas, y
   poder seleccionar las fechas."

   Fijan la lógica PURA de utils/reporteEnvios: match sin acentos/mayúsculas,
   producto por CONTIENE, rango de fechas local e INCLUSIVO, totales por
   presentación, desglose por tienda y detalle solo con las líneas del
   producto. Horas a mediodía UTC para que la fecha local no cruce de día
   corra donde corra la suite.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import {
  filtrarEntregas, productosDeEntregas, reporteEnvios, fechaLocalYMD,
  mesLocalYM, etiquetaMes, rangoDeMes, mesesDeEntregas, tiendasDeEntregas, lineasQueCoinciden, resumenFiltro,
} from '../utils/reporteEnvios';

const ENTREGAS = [
  {
    id: '1', folio: 'ENT-001', tienda: 'Terán Centro', usuario: 'Josué', fecha: '2026-08-10T12:00:00.000Z',
    lineas: [
      { fuente: 'pt', producto: 'PROCAUCHO 5X1', presentacion: 'cubeta', cantidad: 10 },
      { fuente: 'americano', almacen: '1', producto: 'Best Beige', presentacion: 'galon', cantidad: 4 },
    ],
  },
  {
    id: '2', folio: 'ENT-002', tienda: 'PALACO', usuario: 'Josué', fecha: '2026-08-20T12:00:00.000Z',
    lineas: [
      { fuente: 'pt', producto: 'PROCAUCHO 5X1', presentacion: 'cubeta', cantidad: 5 },
      { fuente: 'pt', producto: 'PROCAUCHO 5X1', presentacion: 'galon', cantidad: 8 },
    ],
  },
  {
    id: '3', folio: 'ENT-003', tienda: 'PALACO', usuario: 'Emmanuel', fecha: '2026-09-01T12:00:00.000Z',
    lineas: [{ fuente: 'envases', producto: 'Cubeta 19 L', presentacion: 'pieza', cantidad: 20 }],
  },
];

describe('filtrarEntregas — la barra de búsqueda', () => {
  it('por tienda, sin acentos ni mayúsculas: "teran" encuentra "Terán Centro"', () => {
    expect(filtrarEntregas(ENTREGAS, 'teran').map(e => e.folio)).toEqual(['ENT-001']);
    expect(filtrarEntregas(ENTREGAS, 'palaco')).toHaveLength(2);
  });

  it('por producto de cualquier línea y por folio', () => {
    expect(filtrarEntregas(ENTREGAS, 'procaucho').map(e => e.folio)).toEqual(['ENT-001', 'ENT-002']);
    expect(filtrarEntregas(ENTREGAS, 'ent-003').map(e => e.folio)).toEqual(['ENT-003']);
  });

  it('texto vacío = historial completo, sin filtrar', () => {
    expect(filtrarEntregas(ENTREGAS, '')).toHaveLength(3);
    expect(filtrarEntregas(ENTREGAS, '   ')).toHaveLength(3);
  });
});

describe('reporteEnvios — el reporte por producto', () => {
  it('el caso del dueño: "procaucho" → cuántas y a qué tiendas', () => {
    const r = reporteEnvios(ENTREGAS, { q: 'procaucho' });
    expect(r.totalUnidades).toBe(23);
    expect(r.totalPorPres).toEqual({ cubeta: 15, galon: 8 });
    /* por tienda, la que más se llevó primero */
    expect(r.porTienda.map(x => [x.tienda, x.unidades])).toEqual([['PALACO', 13], ['Terán Centro', 10]]);
    expect(r.porTienda[0].porPres).toEqual({ cubeta: 5, galon: 8 });
    /* el detalle trae SOLO las líneas del producto (el Best Beige no se cuela) */
    const e1 = r.entregas.find(e => e.folio === 'ENT-001');
    expect(e1.lineas).toEqual([{ producto: 'PROCAUCHO 5X1', presentacion: 'cubeta', cantidad: 10 }]);
    /* y viene en desc por fecha, como el historial */
    expect(r.entregas.map(e => e.folio)).toEqual(['ENT-002', 'ENT-001']);
  });

  it('el rango de fechas es local e INCLUSIVO en ambos extremos', () => {
    const dia2 = fechaLocalYMD('2026-08-20T12:00:00.000Z');
    const soloDia2 = reporteEnvios(ENTREGAS, { q: 'procaucho', desde: dia2, hasta: dia2 });
    expect(soloDia2.entregas.map(e => e.folio)).toEqual(['ENT-002']);
    expect(soloDia2.totalUnidades).toBe(13);

    const desde15 = reporteEnvios(ENTREGAS, { q: 'procaucho', desde: fechaLocalYMD('2026-08-15T12:00:00.000Z') });
    expect(desde15.entregas.map(e => e.folio)).toEqual(['ENT-002']);
  });

  it('sin producto = todos los envíos del rango, agrupados tienda×producto', () => {
    const r = reporteEnvios(ENTREGAS, {});
    expect(r.totalUnidades).toBe(47);
    expect(r.porTienda).toHaveLength(4);
    expect(r.porTienda[0]).toMatchObject({ tienda: 'PALACO', producto: 'Cubeta 19 L', unidades: 20 });
  });
});

describe('productosDeEntregas — el datalist del reporte', () => {
  it('únicos y ordenados', () => {
    expect(productosDeEntregas(ENTREGAS)).toEqual(['Best Beige', 'Cubeta 19 L', 'PROCAUCHO 5X1']);
  });
});

/* ── Filtro por mes y por tienda (24-sep-2026, pedido del dueño) ─────────────
   "Buscar productos específicos, a qué tienda fue, cuándo, cantidades y poder
   filtrar por mes." */
describe('mes y tienda', () => {
  it('rangoDeMes cubre el mes completo (último día del calendario, bisiesto incluido)', () => {
    expect(rangoDeMes('2026-08')).toEqual({ desde: '2026-08-01', hasta: '2026-08-31' });
    expect(rangoDeMes('2028-02')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
    expect(rangoDeMes('basura')).toEqual({ desde: '', hasta: '' });
  });

  it('etiquetaMes en español, sin depender del navegador', () => {
    expect(etiquetaMes('2026-09')).toBe('septiembre 2026');
  });

  it('mesesDeEntregas: únicos, del más reciente al más viejo; tiendas únicas ordenadas', () => {
    expect(mesesDeEntregas(ENTREGAS)).toEqual([mesLocalYM(ENTREGAS[2].fecha), mesLocalYM(ENTREGAS[0].fecha)]);
    expect(tiendasDeEntregas(ENTREGAS)).toEqual(['PALACO', 'Terán Centro']);
  });

  it('filtrarEntregas: mes y tienda se suman al texto', () => {
    const ago = mesLocalYM(ENTREGAS[0].fecha);
    expect(filtrarEntregas(ENTREGAS, '', { mes: ago }).map(e => e.folio)).toEqual(['ENT-001', 'ENT-002']);
    expect(filtrarEntregas(ENTREGAS, '', { tienda: 'palaco' }).map(e => e.folio)).toEqual(['ENT-002', 'ENT-003']);
    expect(filtrarEntregas(ENTREGAS, 'procaucho', { mes: ago, tienda: 'PALACO' }).map(e => e.folio)).toEqual(['ENT-002']);
    expect(filtrarEntregas(ENTREGAS, 'procaucho', { tienda: 'Terán Centro', mes: mesLocalYM(ENTREGAS[2].fecha) })).toEqual([]);
  });

  it('lineasQueCoinciden / resumenFiltro: buscar un producto solo suma SUS líneas', () => {
    expect(lineasQueCoinciden(ENTREGAS[0], 'procaucho').map(l => l.producto)).toEqual(['PROCAUCHO 5X1']);
    /* si el texto es la tienda o el folio, cuenta la entrega entera */
    expect(lineasQueCoinciden(ENTREGAS[0], 'teran')).toHaveLength(2);
    const r = resumenFiltro(filtrarEntregas(ENTREGAS, 'procaucho'), 'procaucho');
    expect(r).toEqual({ entregas: 2, unidades: 23, porPres: { cubeta: 15, galon: 8 } });
  });

  it('reporteEnvios: filtro por tienda y desglose por mes', () => {
    const r = reporteEnvios(ENTREGAS, { tienda: 'palaco' });
    expect(r.entregas.map(e => e.folio)).toEqual(['ENT-003', 'ENT-002']);
    expect(r.totalUnidades).toBe(33);
    expect(r.porMes).toEqual([
      { mes: mesLocalYM(ENTREGAS[2].fecha), porPres: { pieza: 20 }, unidades: 20, entregas: 1 },
      { mes: mesLocalYM(ENTREGAS[1].fecha), porPres: { cubeta: 5, galon: 8 }, unidades: 13, entregas: 1 },
    ]);
  });
});
