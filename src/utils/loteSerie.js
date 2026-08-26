/* ════════════════════════════════════════════════════════════════════════════
   utils/loteSerie.js — cálculos del # de lote para la interfaz.

   Vive aparte de <LoteBadge> por dos razones: un archivo que exporta un
   componente Y funciones sueltas rompe el fast-refresh de Vite (lo marca el
   lint), y estas dos funciones son aritmética pura — se prueban solas, sin
   montar nada.
   ════════════════════════════════════════════════════════════════════════════ */
import { bachasParaLitros } from './ptMedidas';

/* Cuántas bachas necesita un item de la cola (cantidad en cubetas × litros). */
export function bachasDeItem(item) {
  if (!item) return 1;
  const litPerUnit = Number(item.litPerUnit) || Number(item._raw?.litPerUnit) || 19;
  return bachasParaLitros((Number(item.cantidad) || 0) * litPerUnit);
}

/* LP-0007-001 + 3 bachas → "LP-0007-001…003". Si el código no tiene la forma
   esperada se devuelve tal cual: nunca se inventa un rango. */
export function rangoDeLote(codigo, bachas) {
  const cod = String(codigo || '');
  const n = Math.max(1, Number(bachas) || 1);
  if (!cod || n <= 1) return cod;
  const m = /^(LP-\d+-)(\d+)$/i.exec(cod);
  if (!m) return cod;
  const ancho = m[2].length;
  const ultimo = String(parseInt(m[2], 10) + n - 1).padStart(ancho, '0');
  return `${m[1]}${m[2]}…${ultimo}`;
}

