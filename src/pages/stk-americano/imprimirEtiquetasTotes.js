/* imprimirEtiquetasTotes — impresión de etiquetas de totes americanos.
   Reescrita 10-ago-2026 (pedido dueño): la etiqueta del tote va SIN QR — solo
   la banda "TOTE + color" y el folio en grande (USA-0050-03). El tote se
   identifica a ojo y al envasar se elige de la lista; no se escanea.
   Sirve igual para la impresión masiva (todos los totes) que para reimprimir
   UNO desde el menú del color. Usa el formato y la rotación memorizados de la
   impresora (pp_qr_formato / pp_qr_rot — las mismas claves del QRModal).
   items: [{ cod, producto }] */
import { etiquetaToteCss, etiquetaToteHtml } from '../../lib/etiquetaLote';

const FORMATOS = {
  '50x25': { wMm: 50, hMm: 25 },
  '50x40': { wMm: 50, hMm: 40 },
  '60x40': { wMm: 60, hMm: 40 },
  '80x50': { wMm: 80, hMm: 50 },
  '100x70': { wMm: 100, hMm: 70 },
};

export default function imprimirEtiquetasTotes(items) {
  const lista = (items || []).filter(x => x && x.cod);
  if (!lista.length) { alert('No hay totes con lote asignado para imprimir'); return false; }

  let formato = '50x25', rot = 0;
  try {
    const f = localStorage.getItem('pp_qr_formato');
    if (f && FORMATOS[f]) formato = f;
    const r = parseInt(localStorage.getItem('pp_qr_rot'), 10);
    if ([0, 90, 180, 270].includes(r)) rot = r;
  } catch { /* defaults */ }
  const fmt = FORMATOS[formato] || FORMATOS['50x25'];

  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) { alert('Habilita popups para imprimir'); return false; }

  const portrait = rot === 90 || rot === 270;
  const pageW = portrait ? fmt.hMm : fmt.wMm;
  const pageH = portrait ? fmt.wMm : fmt.hMm;
  const tf = rot === 90 ? `translateX(${fmt.hMm}mm) rotate(90deg)`
    : rot === 180 ? `translate(${fmt.wMm}mm, ${fmt.hMm}mm) rotate(180deg)`
    : rot === 270 ? `translateY(${fmt.wMm}mm) rotate(270deg)`
    : 'none';

  let labels = '';
  lista.forEach(it => {
    labels += `<div class="page"><div class="label">${etiquetaToteHtml({ producto: it.producto, codigo: it.cod, fmt })}</div></div>`;
  });

  const html = `<!DOCTYPE html><html><head><title>Etiquetas de totes (${lista.length})</title>
    <style>
      @page { size: ${pageW}mm ${pageH}mm; margin: 0; }
      body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
      .page { width: ${pageW}mm; height: ${pageH}mm; position: relative; overflow: hidden; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
      .label {
        position: absolute; top: 0; left: 0;
        width: ${fmt.wMm}mm; height: ${fmt.hMm}mm;
        box-sizing: border-box;
        transform-origin: 0 0; transform: ${tf};
      }
      ${etiquetaToteCss(fmt, '.label')}
    </style></head><body>
    ${labels}
    <script>setTimeout(() => window.print(), 500);</script>
    </body></html>`;
  w.document.write(html);
  w.document.close();
  return true;
}
