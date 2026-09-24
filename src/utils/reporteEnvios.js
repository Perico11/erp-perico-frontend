/* ════════════════════════════════════════════════════════════════════════════
   Reporte de envíos a tiendas (2-sep-2026, pedido del dueño).

   "Me gustaría un reporte, ejemplo PROCAUCHO: cuántas se han enviado y a qué
   tiendas, y poder seleccionar las fechas."

   Lógica PURA sobre el historial de entregas (GET /api/entregas?todas=1):
     · `filtrarEntregas(entregas, q)` — la barra de búsqueda del historial:
       matchea tienda, folio o cualquier producto de las líneas, sin
       distinguir acentos ni mayúsculas ("teran" encuentra "Terán").
     · `reporteEnvios(entregas, { q, desde, hasta })` — el reporte por
       producto: q matchea por CONTIENE ("procaucho" agarra todas sus
       variantes), las fechas son locales e inclusivas (YYYY-MM-DD), y
       devuelve totales por presentación, el desglose por tienda (y por
       producto, si el texto matchea varios) y las entregas involucradas.

   Filtro por MES y por TIENDA (24-sep-2026, pedido del dueño): "buscar
   productos específicos, a qué tienda fue, cuándo, cantidades y poder
   filtrar por mes". El mes es LOCAL (YYYY-MM, mismo criterio que las
   fechas del rango) y la tienda se compara sin acentos/mayúsculas. El
   reporte suma además un desglose `porMes` para ver la tendencia.
   ════════════════════════════════════════════════════════════════════════════ */

export const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ').trim().toLowerCase();

/* La fecha del registro es ISO-UTC; el dueño piensa en días LOCALES. sv-SE
   formatea YYYY-MM-DD, comparable como texto contra los <input type=date>. */
export const fechaLocalYMD = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '').slice(0, 10);
  return d.toLocaleDateString('sv-SE');
};

const enRango = (e, desde, hasta) => {
  const f = fechaLocalYMD(e.fecha);
  if (desde && f < desde) return false;
  if (hasta && f > hasta) return false;
  return true;
};

/* Mes LOCAL de la entrega como 'YYYY-MM' (comparable como texto). */
export const mesLocalYM = (iso) => fechaLocalYMD(iso).slice(0, 7);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/* 'YYYY-MM' → 'septiembre 2026'. Sin Intl: el nombre no depende del navegador. */
export function etiquetaMes(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
  if (!m) return String(ym || '');
  return `${MESES[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}

/* 'YYYY-MM' → { desde, hasta } inclusivos (el último día sale del calendario:
   el día 0 del mes siguiente, así febrero bisiesto no necesita casos). */
export function rangoDeMes(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ''));
  if (!m) return { desde: '', hasta: '' };
  const ultimo = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  return { desde: `${ym}-01`, hasta: `${ym}-${String(ultimo).padStart(2, '0')}` };
}

/* Meses con al menos una entrega, del más reciente al más viejo (el select). */
export function mesesDeEntregas(entregas) {
  const set = new Set();
  (Array.isArray(entregas) ? entregas : []).forEach(e => { if (e && e.fecha) set.add(mesLocalYM(e.fecha)); });
  return [...set].sort((a, b) => b.localeCompare(a));
}

/* Tiendas vistas en el historial (incluye sucursales ya dadas de baja). */
export function tiendasDeEntregas(entregas) {
  const set = new Set();
  (Array.isArray(entregas) ? entregas : []).forEach(e => { if (e && e.tienda) set.add(e.tienda); });
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

const esDeTienda = (e, tienda) => !norm(tienda) || norm(e.tienda) === norm(tienda);

/* Búsqueda del historial: tienda, folio o producto de cualquier línea.
   `mes` ('YYYY-MM') y `tienda` son filtros opcionales encima del texto. */
export function filtrarEntregas(entregas, q, { mes, tienda } = {}) {
  const nq = norm(q);
  return (Array.isArray(entregas) ? entregas : []).filter(e => e &&
    (!mes || mesLocalYM(e.fecha) === mes) &&
    esDeTienda(e, tienda) &&
    (!nq ||
      norm(e.tienda).includes(nq) ||
      norm(e.folio).includes(nq) ||
      (e.lineas || []).some(l => l && norm(l.producto).includes(nq))));
}

/* Líneas de la entrega que explican el match: si el texto coincide con la
   tienda o el folio es la entrega entera; si solo coincide con productos,
   solo esas líneas (buscar "procaucho" no debe sumar el Best Beige que
   viajó en el mismo folio). */
export function lineasQueCoinciden(e, q) {
  const lineas = ((e && e.lineas) || []).filter(Boolean);
  const nq = norm(q);
  if (!nq || norm(e.tienda).includes(nq) || norm(e.folio).includes(nq)) return lineas;
  return lineas.filter(l => norm(l.producto).includes(nq));
}

/* Totales de lo que el historial filtrado muestra: unidades por presentación
   de las líneas que coinciden (mismo criterio que lineasQueCoinciden). */
export function resumenFiltro(entregas, q) {
  const porPres = {};
  let unidades = 0;
  (Array.isArray(entregas) ? entregas : []).forEach(e => lineasQueCoinciden(e, q).forEach(l => {
    const cant = Number(l.cantidad) || 0;
    const pres = l.presentacion || 'unidad';
    porPres[pres] = (porPres[pres] || 0) + cant;
    unidades += cant;
  }));
  return { entregas: (Array.isArray(entregas) ? entregas : []).length, unidades, porPres };
}

/* Catálogo de productos vistos en el historial (para el datalist del reporte). */
export function productosDeEntregas(entregas) {
  const set = new Set();
  (Array.isArray(entregas) ? entregas : []).forEach(e =>
    (e?.lineas || []).forEach(l => { if (l && l.producto) set.add(l.producto); }));
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

export function reporteEnvios(entregas, { q, desde, hasta, tienda } = {}) {
  const nq = norm(q);
  const totalPorPres = {};
  const porTiendaMap = new Map();
  const porMesMap = new Map();
  const detalle = [];
  let totalUnidades = 0;

  (Array.isArray(entregas) ? entregas : []).forEach(e => {
    if (!e || !enRango(e, desde, hasta) || !esDeTienda(e, tienda)) return;
    const mias = (e.lineas || []).filter(l => l && (!nq || norm(l.producto).includes(nq)));
    if (!mias.length) return;
    const nomTienda = e.tienda || '(sin tienda)';
    const mes = mesLocalYM(e.fecha);
    if (!porMesMap.has(mes)) porMesMap.set(mes, { mes, porPres: {}, unidades: 0, entregas: 0 });
    const filaMes = porMesMap.get(mes);
    filaMes.entregas += 1;
    mias.forEach(l => {
      const cant = Number(l.cantidad) || 0;
      const pres = l.presentacion || 'unidad';
      totalUnidades += cant;
      totalPorPres[pres] = (totalPorPres[pres] || 0) + cant;
      filaMes.porPres[pres] = (filaMes.porPres[pres] || 0) + cant;
      filaMes.unidades += cant;
      const k = nomTienda + '|' + l.producto;
      if (!porTiendaMap.has(k)) porTiendaMap.set(k, { tienda: nomTienda, producto: l.producto, porPres: {}, unidades: 0 });
      const row = porTiendaMap.get(k);
      row.porPres[pres] = (row.porPres[pres] || 0) + cant;
      row.unidades += cant;
    });
    detalle.push({
      id: e.id, folio: e.folio, fecha: e.fecha, tienda: nomTienda,
      lineas: mias.map(l => ({ producto: l.producto, presentacion: l.presentacion, cantidad: Number(l.cantidad) || 0 })),
    });
  });

  const porTienda = [...porTiendaMap.values()]
    .sort((a, b) => (b.unidades - a.unidades) || a.tienda.localeCompare(b.tienda, 'es') || a.producto.localeCompare(b.producto, 'es'));
  /* desc por fecha, como el historial */
  detalle.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

  /* por mes, del más reciente al más viejo */
  const porMes = [...porMesMap.values()].sort((a, b) => b.mes.localeCompare(a.mes));

  return { totalUnidades, totalPorPres, porTienda, porMes, entregas: detalle };
}
