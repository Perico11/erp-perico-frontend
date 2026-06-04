/* ════════════════════════════════════════════════════════════════════════
   QR Code Generator — wrapper sobre la librería `qrcode` (NPM)
   ════════════════════════════════════════════════════════════════════════
   Usa la implementación canónica de QR Code (ISO/IEC 18004) en lugar de
   código casero. Mantenemos la misma API pública (qrSvg, qrDataUrl) para
   que los componentes que la consumen no requieran cambios.

   Diseño:
   - SÍNCRONO + asíncrono. La librería `qrcode` expone .toString() y .toDataURL()
     que son ambos async (basados en Promises). React no permite usar Promises
     directo en JSX, así que envolvemos en una mini-cache + retry pattern.
   - Para uso síncrono inmediato en JSX, usamos QRCode.create() que devuelve
     la matriz de bits sincrónicamente, y de ahí generamos un SVG inline.

   API:
     qrMatrix(text, ecLevel?)      → matriz de booleanos
     qrSvg(text, opts?)            → string SVG
     qrDataUrl(text, opts?)        → data:image/svg+xml,... (apto <img src>)
   ════════════════════════════════════════════════════════════════════════ */
import QRCode from 'qrcode';

/* QRCode.create() es síncrono y devuelve { modules: { size, data: Uint8Array }, ... }
   data[i] es 1 o 0 representando módulos black/white de izquierda a derecha,
   fila por fila. Lo usamos para construir SVG inline al instante. */

export function qrMatrix(text, ecLevel = 'M') {
  const qr = QRCode.create(String(text || ' '), { errorCorrectionLevel: ecLevel });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const mat = [];
  for (let r = 0; r < size; r++) {
    const row = new Array(size);
    for (let c = 0; c < size; c++) {
      row[c] = data[r * size + c] ? 1 : 0;
    }
    mat.push(row);
  }
  return mat;
}

export function qrSvg(text, opts = {}) {
  const ec = opts.ecLevel || 'M';
  const qr = QRCode.create(String(text || ' '), { errorCorrectionLevel: ec });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const scale = Math.max(1, opts.scale || 8);
  const margin = (opts.margin != null ? opts.margin : 2) * scale;
  const total = size * scale + margin * 2;
  const fg = opts.fg || '#000';
  const bg = opts.bg || '#fff';

  /* Construir path SVG: una "M...h{s}v{s}h-{s}z" por cada módulo negro.
     Más compacto que <rect> individuales y respeta shape-rendering crisp. */
  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (data[r * size + c]) {
        path += `M${margin + c * scale} ${margin + r * scale}h${scale}v${scale}h-${scale}z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${bg}"/><path d="${path}" fill="${fg}"/></svg>`;
}

/* Data URL SVG — apto para <img src="..."> */
export function qrDataUrl(text, opts = {}) {
  const svg = qrSvg(text, opts);
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
