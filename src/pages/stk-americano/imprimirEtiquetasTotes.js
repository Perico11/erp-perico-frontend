/* imprimirEtiquetasTotes — impresión MASIVA de etiquetas de totes americanos
   (18-jul, pedido dueño): una etiqueta por tote, cada una con SU QR/lote, todas
   en un solo trabajo de impresión (rollo RT-420MME). Usa el formato y la
   rotación memorizados de la impresora (pp_qr_formato / pp_qr_rot — las mismas
   claves del QRModal, así la config se comparte).
   items: [{ cod, producto, litros }] */
import { qrDataUrl } from '../../lib/qrGenerator';

const FORMATOS = {
  '50x25': { wMm: 50, hMm: 25, qrMm: 21 },
  '50x40': { wMm: 50, hMm: 40, qrMm: 22 },
  '60x40': { wMm: 60, hMm: 40, qrMm: 24 },
  '80x50': { wMm: 80, hMm: 50, qrMm: 30 },
  '100x70': { wMm: 100, hMm: 70, qrMm: 40 },
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

  const fecha = new Date().toISOString().slice(0, 10);
  const esc = (s) => String(s || '').replace(/</g, '&lt;');
  let labels = '';
  lista.forEach((it, i) => {
    const payload = JSON.stringify({ t: 'perico-lote', cod: it.cod, p: it.producto });
    const qr = qrDataUrl(payload, { scale: 10, margin: 2, ecLevel: 'M' });
    labels += `<div class="page"><div class="label">
      <img src="${qr}" />
      <div class="info">
        <div class="prod">${esc(it.producto)}</div>
        <div class="cod">${esc(it.cod)}</div>
        <div class="meta">TOTE · ${Number(it.litros) ? Number(it.litros).toLocaleString('es-MX') + ' L · ' : ''}${fecha} · ${i + 1}/${lista.length}</div>
      </div>
    </div></div>`;
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
        box-sizing: border-box; padding: 1.5mm;
        display: flex; align-items: center; gap: 2mm;
        transform-origin: 0 0; transform: ${tf};
      }
      .label img { width: ${fmt.qrMm}mm; height: ${fmt.qrMm}mm; }
      .info { flex: 1; min-width: 0; line-height: 1.25; overflow: hidden; }
      .prod { font-weight: bold; font-size: 8pt; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cod { font-family: monospace; font-weight: bold; font-size: 7.5pt; word-break: break-all; }
      .meta { color: #666; font-size: 6pt; margin-top: 1mm; }
    </style></head><body>
    ${labels}
    <script>setTimeout(() => window.print(), 500);</script>
    </body></html>`;
  w.document.write(html);
  w.document.close();
  return true;
}
