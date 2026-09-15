/* ── Conteo por PIEZAS del producto terminado (15-sep-2026, propuesta A) ────
   El dueño: "la lógica dice que tengo N cubetas, pero no es exacto: el stock
   viene en totes (llenos o parciales), cubetas, galones y litros envasados".

   Aquí vive la lógica PURA que comparten la fila de Stock ▸ Total (chips por
   presentación, existencia en litros) y la ficha "Contar existencia":
     · piezasDesdeBucket   — lo que pt-por-ubicacion dice de una ubicación,
                             expresado en piezas enteras + litros sueltos.
     · litrosDePiezas      — Σ litros de un conteo (espejo de lib/ptConteo del
                             backend: tote 988 L, cubeta 19, galón 3.785,
                             litro 0.946, atomizador 0.75).
     · totesParcialesDeTraza — totes abiertos rastreados (litrosRestante).
     · resumenPiezasTotal  — modelo de los chips de la fila Total.
   El escalar en cubetas-equivalente lo sigue derivando el backend; la
   pantalla sólo lo PREVISUALIZA. Sin I/O. */
import { CUBETA_ML } from './ptMedidas';

export const LITROS_CUBETA = CUBETA_ML / 1000; /* 19 */
export const LITROS_TOTE = 988;                 /* tote nacional (52 cubetas) */
/* Litros por pieza — espejo de PT_MEDIDA_ML del backend. */
export const LITROS_POR_PIEZA = { tote: LITROS_TOTE, cubeta: 19, galon: 3.785, litro: 0.946, atomizador750: 0.75 };

/* Piezas cerradas que se cuentan por unidad (orden de la ficha). */
export const PIEZAS_CERRADAS = [
  { key: 'cubeta',        label: 'Cubetas',      sing: 'cubeta',     plur: 'cubetas',      litros: 19 },
  { key: 'galon',         label: 'Galones',      sing: 'galón',      plur: 'galones',      litros: 3.785 },
  { key: 'litro',         label: 'Litros',       sing: 'litro',      plur: 'litros',       litros: 0.946 },
  { key: 'atomizador750', label: 'Atomizadores', sing: 'atomizador', plur: 'atomizadores', litros: 0.75 },
];
/* Claves del payload de POST /api/inventario/pt/conteo. */
export const PIEZAS_KEYS = ['tote', 'granelL', 'cubeta', 'galon', 'litro', 'atomizador750'];

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

export const fmtL = (n) => r1(n).toLocaleString('es-MX', { maximumFractionDigits: 1 });
export const fmtCub = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 });
export const cubALitros = (cub) => r1((Number(cub) || 0) * LITROS_CUBETA);
export const litrosACub = (L) => r3((Number(L) || 0) / LITROS_CUBETA);

export const piezasVacias = () => ({ tote: 0, granelL: 0, cubeta: 0, galon: 0, litro: 0, atomizador750: 0, otros: 0 });

/* Bucket de pt-por-ubicacion ({cubeta,galon,litro,tote,atm,otros,granel}) →
   piezas ENTERAS + litros sueltos. Las columnas pueden traer fracciones (un
   residual capturado en tote = 1.96, un remanente de 39.5 cub): la parte
   entera es la pieza, la fracción se reexpresa en litros a granel para que
   Σ litros no cambie. `granel` viene en cub-equiv → ×19. `otros` (etiquetas
   sin tipo conocido) se conserva aparte: no se puede contar como pieza. */
export function piezasDesdeBucket(b) {
  const p = piezasVacias();
  if (!b || typeof b !== 'object') return p;
  const n = (k) => Number(b[k]) || 0;
  let granelL = n('granel') * LITROS_CUBETA;
  const entera = (x, litros) => {
    const ent = Math.floor(x + 1e-9);
    const frac = x - ent;
    if (frac > 1e-6) granelL += frac * litros;
    return ent;
  };
  p.tote = entera(n('tote'), LITROS_TOTE);
  p.cubeta = entera(n('cubeta'), LITROS_POR_PIEZA.cubeta);
  p.galon = entera(n('galon'), LITROS_POR_PIEZA.galon);
  p.litro = entera(n('litro'), LITROS_POR_PIEZA.litro);
  p.atomizador750 = entera(n('atm'), LITROS_POR_PIEZA.atomizador750);
  p.otros = n('otros');
  p.granelL = r1(granelL);
  return p;
}

/* Σ litros de un conteo { tote, granelL, cubeta, galon, litro, atomizador750 }. */
export function litrosDePiezas(p) {
  let L = 0;
  for (const k of Object.keys(LITROS_POR_PIEZA)) L += (Number(p?.[k]) || 0) * LITROS_POR_PIEZA[k];
  L += Number(p?.granelL) || 0;
  return Math.round(L * 100) / 100;
}
export const cubDePiezas = (p) => litrosACub(litrosDePiezas(p));

/* Payload que espera el backend: piezas enteras + granelL con 2 decimales. */
export function payloadPiezas(p) {
  const out = {};
  for (const k of PIEZAS_KEYS) {
    const v = Math.max(0, Number(p?.[k]) || 0);
    out[k] = k === 'granelL' ? Math.round(v * 100) / 100 : Math.round(v);
  }
  return out;
}

/* ── Totes PARCIALES rastreados (trazabilidad), por producto ─────────────────
   Un tote abierto tiene `litrosRestante` por debajo del tote lleno; el bucket
   lo cuenta como 1 tote (52 cub) y no distingue. Espejo de los filtros de
   lib/ptFabrica del backend (lote/sublote que cuentan en stock, ubicación). */
const ESTADOS_TERAN = new Set(['en_stock_teran', 'recibido_teran', 'reenvasado', 'en_almacen']);
function ubicacionSublote(sl) {
  if (sl.ub === 'teran' || ESTADOS_TERAN.has(sl.estado)) return 'teran';
  if (sl.estado === 'tote_activo') {
    const recibido = !!sl.fechaRecepcionTeran
      || (Array.isArray(sl.historial) && sl.historial.some(h => h && h.accion === 'escanearRecibirTeran'));
    if (recibido) return 'teran';
  }
  if (sl.enCaminoOT) return 'transito';
  return 'fabrica';
}
export function totesParcialesDeTraza(lotes) {
  const map = {};
  (Array.isArray(lotes) ? lotes : []).forEach(lote => {
    if (!lote || lote.eliminado || lote.cancelado || lote.esPrueba) return;
    if (lote.estado === 'qc_hold' || lote.estado === 'rechazado') return;
    const producto = lote.producto || lote.nombre || lote.formula || 'SIN NOMBRE';
    (Array.isArray(lote.sublotes) ? lote.sublotes : []).forEach(sl => {
      if (!sl || sl.esMerma || sl.consumido || sl.soloEtiqueta) return;
      if (sl.estado === 'cancelado' || sl.estado === 'tote_vaciado') return;
      const esTote = String(sl.tipo || '').toLowerCase() === 'tote' || sl.claseSublote === 'tote';
      if (!esTote || sl.litrosRestante == null) return;
      const litros = Number(sl.litrosRestante);
      if (!(litros > 0.01) || litros >= LITROS_TOTE * 0.99) return;
      const ubic = ubicacionSublote(sl);
      if (ubic === 'transito') return;
      (map[producto] = map[producto] || []).push({ cod: sl.cod || sl.codigo || sl.id || '', litros: r1(litros), ubic });
    });
  });
  return map;
}

/* Piezas de UNA ubicación para contar: el tote ABIERTO se cuenta UNA vez.
   El bucket lo trae por partida doble — la etiqueta dice "hay un tote" (columna
   tote, 52 cub) y el pool dice "tiene 344 L" (granel) — así que el tote parcial
   sale de los llenos y sus litros mandan sobre el granel del pool. Sin
   parciales rastreados, el bucket pasa tal cual. */
export function piezasDeUbicacion(bucket, parciales) {
  const p = piezasDesdeBucket(bucket);
  const parc = Array.isArray(parciales) ? parciales : [];
  if (!parc.length) return p;
  const litrosParciales = r1(parc.reduce((s, t) => s + (Number(t.litros) || 0), 0));
  return { ...p, tote: Math.max(0, p.tote - parc.length), granelL: r1(Math.max(p.granelL, litrosParciales)) };
}

/* ── Modelo de los CHIPS de la fila Total ────────────────────────────────────
   { llenos, parciales[], litrosParciales, granelL, cubeta, galon, litro,
     atomizador750, otros, vacio }.
   Los totes parciales salen de trazabilidad; el resto del conteo de totes se
   asume lleno. El granel del pool (teranPres.granel / fabricaPres.granel)
   describe en litros el MISMO tote abierto que trazabilidad rastrea —
   derivarTeranPres y el reenvase lo alimentan así— por eso se netea contra
   los litros de los parciales: un tote abierto es un chip, no dos. */
export function resumenPiezasTotal(bucketTotal, parciales) {
  const p = piezasDesdeBucket(bucketTotal);
  const parc = Array.isArray(parciales) ? parciales : [];
  const litrosParciales = r1(parc.reduce((s, t) => s + (Number(t.litros) || 0), 0));
  const llenos = Math.max(0, p.tote - parc.length);
  const granelL = r1(Math.max(0, p.granelL - litrosParciales));
  const out = {
    llenos, parciales: parc, litrosParciales, granelL,
    cubeta: p.cubeta, galon: p.galon, litro: p.litro, atomizador750: p.atomizador750, otros: p.otros,
  };
  out.vacio = llenos === 0 && parc.length === 0 && granelL <= 0
    && p.cubeta === 0 && p.galon === 0 && p.litro === 0 && p.atomizador750 === 0 && p.otros === 0;
  return out;
}

/* Etiquetas de los chips (texto + tono), en el orden de la fila. */
export function chipsDePiezas(p) {
  if (!p) return [];
  const chips = [];
  if (p.llenos > 0) chips.push({ key: 'llenos', tono: 'tote', texto: `${p.llenos} ${p.llenos === 1 ? 'tote lleno' : 'totes llenos'}` });
  if (p.parciales && p.parciales.length > 0) {
    const n = p.parciales.length;
    chips.push({ key: 'parciales', tono: 'granel', texto: `${n} ${n === 1 ? 'tote parcial' : 'totes parciales'} · ${fmtL(p.litrosParciales)} L` });
  }
  if (p.granelL > 0) chips.push({ key: 'granel', tono: 'granel', texto: `a granel · ${fmtL(p.granelL)} L` });
  PIEZAS_CERRADAS.forEach(d => {
    const n = Number(p[d.key]) || 0;
    if (n > 0) chips.push({ key: d.key, tono: 'pieza', texto: `${fmtCub(n)} ${n === 1 ? d.sing : d.plur}` });
  });
  if (p.otros > 0) chips.push({ key: 'otros', tono: 'neutro', texto: `${fmtCub(p.otros)} ${p.otros === 1 ? 'otra pieza' : 'otras piezas'}` });
  return chips;
}

/* KPI "Totes abiertos": cada tote parcial rastreado + cada pool con granel
   sin tote rastreado (el granel ES el sobrante de un tote abierto). */
export function totesAbiertosDe(items) {
  return (Array.isArray(items) ? items : []).reduce((acc, it) => {
    const p = it && it.piezas;
    if (!p) return acc;
    acc.n += (p.parciales ? p.parciales.length : 0) + (p.granelL > 0.5 ? 1 : 0);
    acc.litros = r1(acc.litros + (p.litrosParciales || 0) + (p.granelL || 0));
    return acc;
  }, { n: 0, litros: 0 });
}
