/* De qué LOTE viene cada pieza de una Orden de Transferencia (24-sep-2026).
   El backend guarda en la OT el reparto que decidió el surtido
   (`ot.lotesSurtidos`) y el que aterrizó en Terán (`ot.lotesRecibidos`):
     { fecha, usuario, sinLote, lotes: [{ producto, codigoLote, cubEq, piezas,
       sublotes: [{ cod, espejoCod?, tipo, tote, piezas, cubEq }] }] }
   Sin esto Terán no sabía que de 30 cubetas, 20 eran de un lote y 10 de otro,
   y podía etiquetarlas todas con el mismo. Aquí solo se LEE y se arma el texto;
   la decisión es 100% backend. */
import { etiquetaMedida, ptMedidaDef } from './ptMedidas';

const _num = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 });

/* "20 cubetas" · "1 tote · 52 cub" · "8 galones · 1.6 cub" · "3 piezas" */
export function etiquetaPiezasLote(lote) {
  const porTipo = new Map();
  for (const s of (lote && Array.isArray(lote.sublotes) ? lote.sublotes : [])) {
    const tipo = ptMedidaDef(s.tipo) ? s.tipo : (s.tote ? 'tote' : '');
    porTipo.set(tipo, (porTipo.get(tipo) || 0) + (Number(s.piezas) || 0));
  }
  if (porTipo.size === 0 && lote) porTipo.set('', Number(lote.piezas) || 0);
  const partes = [...porTipo.entries()].map(([tipo, n]) =>
    tipo ? etiquetaMedida(tipo, n) : `${n.toLocaleString('es-MX')} ${n === 1 ? 'pieza' : 'piezas'}`);
  const soloCubetas = porTipo.size === 1 && porTipo.has('cubeta');
  const cub = Number(lote && lote.cubEq) || 0;
  return soloCubetas ? partes.join(' + ') : `${partes.join(' + ')} · ${_num(cub)} cub`;
}

const _firma = (d) => (d && Array.isArray(d.lotes) ? d.lotes : [])
  .map(l => `${String(l.producto || '').toUpperCase()}|${l.codigoLote}|${Number(l.cubEq) || 0}`)
  .sort().join(';');

/* Lo que la tarjeta muestra: lo RECIBIDO si ya llegó (es lo que vive en
   Terán), si no lo SURTIDO. `difiere` avisa si lo que aterrizó no es lo que
   salió de Fábrica. null = la OT no trae desglose (OT vieja o sin PT). */
export function desgloseLotesDeOT(ot) {
  if (!ot) return null;
  const rec = ot.lotesRecibidos && Array.isArray(ot.lotesRecibidos.lotes) ? ot.lotesRecibidos : null;
  const sur = ot.lotesSurtidos && Array.isArray(ot.lotesSurtidos.lotes) ? ot.lotesSurtidos : null;
  const d = rec || sur;
  if (!d) return null;
  const sinLote = Number(d.sinLote) || 0;
  if (d.lotes.length === 0 && sinLote <= 0) return null;
  const productos = new Set(d.lotes.map(l => String(l.producto || '').trim().toUpperCase()));
  return {
    fuente: rec ? 'recibidos' : 'surtidos',
    /* 'elegido' = Fábrica marcó los lotes a mano; 'automatico' = sugerencia. */
    modo: (sur && sur.modo) || null,
    lotes: d.lotes,
    sinLote,
    variosProductos: productos.size > 1,
    difiere: !!(rec && sur && _firma(rec) !== _firma(sur)),
  };
}
