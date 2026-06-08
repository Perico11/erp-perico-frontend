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
