/* Interpreta una respuesta de confirmación del usuario (por TEXTO o VOZ) cuando
   el asistente tiene una acción de escritura PENDIENTE (nueva orden/pedido,
   transferencia, etc.). Decisión del dueño (jun 2026): toda acción de escritura
   debe confirmarse por texto o voz, no solo por botón.

   Devuelve 'si' | 'no' | null (null = no es una respuesta de confirmación → el
   asistente la procesa como un mensaje normal y deja la confirmación en pie con
   sus botones). Tolerante a acentos/mayúsculas/signos (espejo de _norm del bot). */
function _norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Palabras sueltas (primer token o frase entera de 1 palabra). */
const SI = new Set(['si', 'sii', 'sip', 'simon', 'sale', 'dale', 'hazlo', 'confirmo', 'confirmar', 'confirmado', 'confirma', 'correcto', 'ok', 'oka', 'okey', 'va', 'vale', 'adelante', 'claro', 'afirmativo', 'perfecto', 'procede', 'acepto', 'aceptar', 'aprueba', 'aprobado', 'aja']);
const NO = new Set(['no', 'nel', 'nop', 'nope', 'cancela', 'cancelar', 'cancelado', 'olvidalo', 'detente', 'detener', 'para', 'alto', 'negativo', 'aborta', 'abortar', 'espera']);

/* Frases de varias palabras (se evalúan al inicio del texto normalizado). */
const FRASES_NO = [/^mejor no/, /^asi no/, /^ya no/, /^no gracias/, /^no lo hagas/, /^mejor cancela/, /^cancela\w* (eso|todo|la)/];
const FRASES_SI = [/^de acuerdo/, /^hagamoslo/, /^esta bien/, /^asi es/, /^claro que si/, /^si por favor/, /^si hazlo/, /^que si/, /^obvio que si/, /^hazlo ya/];

export function interpretarConfirmacion(texto) {
  const t = _norm(texto);
  if (!t) return null;
  for (const re of FRASES_NO) if (re.test(t)) return 'no';
  for (const re of FRASES_SI) if (re.test(t)) return 'si';
  /* "no" pega más fuerte que "sí" si ambos aparecen (seguridad: ante la duda, frenar). */
  const first = t.split(' ')[0];
  if (NO.has(t) || NO.has(first)) return 'no';
  if (SI.has(t) || SI.has(first)) return 'si';
  return null;
}
