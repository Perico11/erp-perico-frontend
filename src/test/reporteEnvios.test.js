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
import { filtrarEntregas, productosDeEntregas, reporteEnvios, fechaLocalYMD } from '../utils/reporteEnvios';

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
