/* ════════════════════════════════════════════════════════════════════════════
   etiquetaLote — DISEÑO ÚNICO de la etiqueta impresa (5-ago-2026, elección del
   dueño: "cabecera invertida", propuesta 1).

     ┌──────────────────────────────┐
     │ CBT   BEST BEIGE             │ ← banda negra: se lee de lejos qué es
     ├──────────────────────────────┤
     │ ▓▓▓▓  USA-0007               │ ← folio grande (11 pt)
     │ ▓▓▓▓  Envasó: Marcos R.      │ ← quién lo envasó, en renglón propio
     │ ▓▓▓▓  05/08/2026 · 19 L      │
     └──────────────────────────────┘

   Antes había TRES implementaciones divergentes del mismo layout (QRModal rollo,
   QRModal hoja A4, imprimirEtiquetasTotes). Este módulo es el único lugar donde
   vive el diseño: quien imprima, imprime esto.

   El QR se encoge para dejar sitio a la banda — nunca al revés. A 16 mm cada
   módulo mide ~0.55 mm, por encima del ~0.4 mm que necesita un lector de celular;
   por debajo de 14 mm el escaneo empieza a sufrir con papel térmico gastado, así
   que ese es el piso duro.
   ════════════════════════════════════════════════════════════════════════════ */

export const QR_MM_MIN = 14;

/* Abreviaturas que pidió el dueño. La clave es lo que traen los datos
   (sublote.tipo, lote.medida, presentación de PT); el valor, lo que se imprime. */
const ABREV = {
  tote: 'TOTE',
  cubeta: 'CBT', cub: 'CBT', cubetas: 'CBT',
  galon: 'GLN', galón: 'GLN', gal: 'GLN', galones: 'GLN',
  litro: 'LT', litros: 'LT', lt: 'LT', l: 'LT',
  atomizador750: 'ATM', atomizador: 'ATM', atm: 'ATM',
};

/* Devuelve la abreviatura de la presentación, o '' si no se reconoce (la banda
   entonces muestra solo el producto en vez de inventar una etiqueta falsa). */
export function abreviaPresentacion(v) {
  const k = String(v || '').trim().toLowerCase();
  if (!k) return '';
  if (ABREV[k]) return ABREV[k];
  /* Tolera "19L Estándar", "Cubeta Premium", "1 galón": busca la palabra clave. */
  for (const [pal, ab] of Object.entries(ABREV)) {
    if (pal.length > 2 && k.includes(pal)) return ab;
  }
  return '';
}

/* Único valor de un campo entre los sublotes, o '' si discrepan. Un lote de
   producción con cubetas Y galones no tiene UNA presentación: mejor banda sin
   abreviatura que una etiqueta que miente sobre la mitad de las piezas. */
function unanime(sublotes, campo) {
  const vals = [...new Set((sublotes || []).map(s => String((s && s[campo]) || '').trim()).filter(Boolean))];
  return vals.length === 1 ? vals[0] : '';
}

/* Saca la presentación de un lote/sublote venga como venga (los callers son
   media docena de pantallas con formas distintas). */
export function presentacionDeLote(lote) {
  if (!lote) return '';
  const directa = abreviaPresentacion(lote.presentacion || lote.medida || lote.tipo || lote.pres);
  if (directa) return directa;
  /* Lotes de producción nacional: la presentación vive en los sublotes. */
  return abreviaPresentacion(unanime(lote.sublotes, 'tipo'));
}

export function envasadorDeLote(lote) {
  if (!lote) return '';
  const directo = String(lote.envasadoPor || lote.envasador || lote.vaciador || '').trim();
  return directo || unanime(lote.sublotes, 'envasadoPor');
}

/* ─── SELLO DE FECHA Y HORA (21-ago-2026, pedido dueño) ──────────────────────
   La etiqueta oficial lleva "2026-08-15 17:42": cuándo se envasó. Antes este
   renglón mostraba fecha y LITROS, y el dueño pidió cambiar los litros por la
   hora ("no pongas cuántos litros restan; ahí puedes poner hora en que se
   envasó") — con varias tandas del mismo lote en el día, la fecha sola no
   distingue cuál cubeta es cuál.

   La hora se RECORTA de la misma cadena ISO que la fecha, sin convertir de
   zona: así fecha y hora describen el mismo instante en el mismo marco y no
   pueden contradecirse (una conversión podría dejar la hora de un día y la
   fecha de otro). Sin hora en el dato, sale sólo la fecha. */
export function selloFechaHora(iso) {
  const s = String(iso || '');
  const fecha = s.slice(0, 10);
  if (!fecha) return '';
  const m = /T(\d{2}:\d{2})/.exec(s);
  return m ? `${fecha} ${m[1]}` : fecha;
}

export const escHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* QR efectivo: el del formato, recortado a lo que deja libre la banda. */
export function qrEfectivoMm(fmt) {
  const banda = bandaMm(fmt.hMm);
  const disponible = fmt.hMm - banda - 2.6; /* padding del cuerpo, arriba y abajo */
  return Math.max(QR_MM_MIN, Math.min(fmt.qrMm, +(disponible - 1).toFixed(1)));
}

function bandaMm(hMm) { return hMm <= 30 ? 5.8 : 7.5; }

/* Márgenes AJUSTADOS (5-ago, 2ª vuelta): 1 mm de aire lateral en vez de 1.5.
   Son 1 mm más de ancho útil para el texto, que se va todo a la tipografía. */
const PAD_X = 1;

/* Escala tipográfica: en 50×25 va apretada; en etiquetas grandes crece. */
function tipos(hMm) {
  const g = hMm <= 30 ? 1 : hMm <= 45 ? 1.25 : 1.6;
  return {
    pres: +(12 * (hMm <= 30 ? 1 : 1.2)).toFixed(1),
    prod: +(9 * (hMm <= 30 ? 1 : 1.15)).toFixed(1),
    cod: +(13 * g).toFixed(1),
    env: +(8 * g).toFixed(1),
    meta: +(6.5 * g).toFixed(1),
  };
}

/* CSS del diseño. `sel` acota las reglas al contenedor de cada modo:
   '.label' para rollo térmico, '.cell' para la hoja A4. */
export function etiquetaCss(fmt, sel = '.label') {
  const banda = bandaMm(fmt.hMm);
  const t = tipos(fmt.hMm);
  const qr = qrEfectivoMm(fmt);
  return `
  /* Cinturón: si algún día se vuelve a usar un fondo, que al menos se intente
     imprimir. NO se confía en esto — el diseño no depende de ningún fondo. */
  ${sel} { display: flex; flex-direction: column; padding: 0; overflow: hidden;
    color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* 🐛 5-ago: la banda era blanco-sobre-negro y salió INVISIBLE en la térmica —
     los navegadores no imprimen background-color salvo que el usuario marque
     "Gráficos de fondo", y esa casilla es por impresión. Los BORDES sí se
     imprimen siempre: de ahí la regla gruesa de abajo y el recuadro del CBT. */
  ${sel} .eb { display: flex; align-items: center; gap: 1.6mm;
    padding: 0.5mm ${PAD_X}mm; height: ${banda}mm; box-sizing: border-box; flex-shrink: 0;
    border-bottom: 0.6mm solid #000; }
  ${sel} .eb-pres { font-size: ${t.pres}pt; font-weight: bold; line-height: 1; flex-shrink: 0;
    letter-spacing: .02em; border: 0.35mm solid #000; border-radius: 0.7mm; padding: 0.2mm 0.9mm; }
  ${sel} .eb-prod { font-size: ${t.prod}pt; font-weight: bold; line-height: 1.1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; }
  ${sel} .ec { display: flex; align-items: center; gap: 1.8mm; padding: 1.3mm ${PAD_X}mm; flex: 1; min-height: 0; }
  ${sel} .ec img { width: ${qr}mm; height: ${qr}mm; flex-shrink: 0; }
  ${sel} .ei { flex: 1; min-width: 0; line-height: 1.3; overflow: hidden; }
  ${sel} .e-cod { font-family: ui-monospace, monospace; font-weight: bold; font-size: ${t.cod}pt;
    white-space: nowrap; letter-spacing: -.03em; }
  ${sel} .e-env { font-size: ${t.env}pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  ${sel} .e-meta { color: #000; font-size: ${t.meta}pt; margin-top: .3mm;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`;
}

/* Ancho libre para el bloque de texto, a la derecha del QR. */
export function anchoTextoMm(fmt) {
  return +(fmt.wMm - PAD_X * 2 - qrEfectivoMm(fmt) - 1.8).toFixed(1);
}

/* Cuerpo del folio ajustado a lo que mida el código. Los folios nuevos entran a
   tamaño completo; uno viejo y largo (USA-20260731-010) baja de punto hasta
   caber ENTERO — nunca se parte ni se corta, que fue el problema original. */
export function codFontPt(codigo, fmt) {
  const disponible = anchoTextoMm(fmt);
  const largo = String(codigo || '').length;
  const anchoA = (pt) => pt * (25.4 / 72) * 0.6 * largo; /* mono ≈ 0.6em por carácter */
  let pt = tipos(fmt.hMm).cod;
  while (pt > 7 && anchoA(pt) > disponible) pt = +(pt - 0.5).toFixed(1);
  return pt;
}

/* ─── ETIQUETA DE TOTE — SIN QR (10-ago-2026, pedido dueño) ─────────────────
   El tote se identifica A OJO: banda "TOTE + color" y el folio en grande
   ocupando el resto de la etiqueta. Nada más — ni QR ni fecha: el tote se
   elige de una lista al envasar, no se escanea.

   El folio se autoajusta al ANCHO completo (no hay QR que le quite espacio) y
   se topa con el alto del cuerpo; nunca se parte ni se corta. */
export function codFontPtTote(codigo, fmt) {
  const anchoMm = fmt.wMm - PAD_X * 2 - 1;
  const altoMm = fmt.hMm - bandaMm(fmt.hMm) - 3;
  const largo = Math.max(1, String(codigo || '').length);
  const mmPorPt = 25.4 / 72;
  const porAncho = anchoMm / (mmPorPt * 0.6 * largo);  /* mono ≈ 0.6em por carácter */
  const porAlto = altoMm / (mmPorPt * 1.05);           /* una línea con su aire */
  return +Math.max(8, Math.min(porAncho, porAlto)).toFixed(1);
}

export function etiquetaToteCss(fmt, sel = '.label') {
  const banda = bandaMm(fmt.hMm);
  const t = tipos(fmt.hMm);
  return `
  ${sel} { display: flex; flex-direction: column; padding: 0; overflow: hidden;
    color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Misma regla que la etiqueta con QR: bordes, no fondos (la térmica no
     imprime background-color — ver la nota de etiquetaCss). */
  ${sel} .eb { display: flex; align-items: center; gap: 1.6mm;
    padding: 0.5mm ${PAD_X}mm; height: ${banda}mm; box-sizing: border-box; flex-shrink: 0;
    border-bottom: 0.6mm solid #000; }
  ${sel} .eb-pres { font-size: ${t.pres}pt; font-weight: bold; line-height: 1; flex-shrink: 0;
    letter-spacing: .02em; border: 0.35mm solid #000; border-radius: 0.7mm; padding: 0.2mm 0.9mm; }
  ${sel} .eb-prod { font-size: ${t.prod}pt; font-weight: bold; line-height: 1.1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; }
  ${sel} .et { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
    padding: 0.8mm ${PAD_X}mm; }
  ${sel} .et-cod { font-family: ui-monospace, monospace; font-weight: bold;
    white-space: nowrap; letter-spacing: -.03em; line-height: 1; }`;
}

export function etiquetaToteHtml({ producto, codigo, fmt }) {
  const pt = fmt ? codFontPtTote(codigo, fmt) : null;
  return `<div class="eb"><span class="eb-pres">TOTE</span><span class="eb-prod">${escHtml(producto)}</span></div>
    <div class="et"><div class="et-cod"${pt ? ` style="font-size:${pt}pt"` : ''}>${escHtml(codigo)}</div></div>`;
}

/* Markup de UNA etiqueta. Todo lo que falte simplemente no ocupa renglón.
   `fmt` es opcional: sin él, el folio usa el tamaño base de la hoja de estilo. */
export function etiquetaHtml({ qrSrc, producto, pres, codigo, envasador, meta, fmt }) {
  const p = escHtml(pres);
  const codStyle = fmt ? ` style="font-size:${codFontPt(codigo, fmt)}pt"` : '';
  return `<div class="eb">${p ? `<span class="eb-pres">${p}</span>` : ''}<span class="eb-prod">${escHtml(producto)}</span></div>
    <div class="ec"><img src="${qrSrc}" />
      <div class="ei">
        <div class="e-cod"${codStyle}>${escHtml(codigo)}</div>
        ${envasador ? `<div class="e-env">Envasó: <b>${escHtml(envasador)}</b></div>` : ''}
        ${meta ? `<div class="e-meta">${escHtml(meta)}</div>` : ''}
      </div>
    </div>`;
}
