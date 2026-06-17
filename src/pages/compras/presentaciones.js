/* Presentaciones de envase para órdenes de compra (compartido entre Sugerencias y Catálogo). */
export const PRESENTACIONES = [
  { v: '', lbl: 'Presentación…' },
  { v: 'saco_25', lbl: 'Saco 25 kg' },
  { v: 'saco_50', lbl: 'Saco 50 kg' },
  { v: 'cubeta_19', lbl: 'Cubeta 19 kg' },
  { v: 'cubeta_20', lbl: 'Cubeta 20 kg' },
  { v: 'cubeta_50', lbl: 'Cubeta 50 kg' },
  { v: 'tambor_200', lbl: 'Tambor 200 kg' },
  { v: 'tambor_220', lbl: 'Tambor 220 kg' },
  { v: 'tote_1000', lbl: 'Tote 1,000 kg' },
  { v: 'granel', lbl: 'Granel' },
];
export const presLabel = (v) => (PRESENTACIONES.find(p => p.v === v) || {}).lbl || '';

/* Número de envases recomendado a partir de los kg y la presentación.
   Ej: presEnvases('saco_25', 1000) → "40 sacos". Granel / otro / sin tamaño → null. */
const _PLURAL_ENVASE = { saco: 'sacos', cubeta: 'cubetas', tambor: 'tambores', tote: 'totes', bote: 'botes' };
export const presEnvases = (v, kgTotal) => {
  const m = /^([a-z]+)_(\d+(?:\.\d+)?)$/.exec(String(v || ''));
  if (!m) return null; /* granel, otro, vacío */
  const perKg = parseFloat(m[2]);
  const kg = parseFloat(kgTotal);
  if (!(perKg > 0) || !(kg > 0)) return null;
  const n = kg / perKg;
  const nFmt = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  const sing = m[1];
  const unidad = nFmt === '1' ? sing : (_PLURAL_ENVASE[sing] || sing + 's');
  return `${nFmt} ${unidad}`;
};
