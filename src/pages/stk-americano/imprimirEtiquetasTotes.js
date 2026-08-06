/* imprimirEtiquetasTotes — impresión MASIVA de etiquetas de totes americanos
   (18-jul, pedido dueño): una etiqueta por tote, cada una con SU QR/lote, todas
   en un solo trabajo de impresión (rollo RT-420MME). Usa el formato y la
   rotación memorizados de la impresora (pp_qr_formato / pp_qr_rot — las mismas
   claves del QRModal, así la config se comparte).
   items: [{ cod, producto, litros }] */
import { qrDataUrl } from '../../lib/qrGenerator';
import { qrPublicUrl } from '../../lib/qrPublicUrl';
import { etiquetaCss, etiquetaHtml } from '../../lib/etiquetaLote';

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
  let labels = '';
  lista.forEach((it, i) => {
    /* 28-jul-2026: URL en vez de JSON-con-datos — misma razón que QRModal (la
       etiqueta viaja pegada al tote; la página exige clave). 29-jul: dominio
       principal vía lib/qrPublicUrl. */
    const payload = qrPublicUrl(it.cod);
    const qr = qrDataUrl(payload, { scale: 10, margin: 2, ecLevel: 'M' });
    /* DISEÑO ÚNICO (5-ago): el tote lleva TOTE en la banda; el envasador aquí no
       aplica (nadie lo ha envasado todavía) y su renglón simplemente no sale. */
    labels += `<div class="page"><div class="label">${etiquetaHtml({
      qrSrc: qr, producto: it.producto, pres: 'TOTE', codigo: it.cod, fmt,
      envasador: '',
      meta: `${Number(it.litros) ? Number(it.litros).toLocaleString('es-MX') + ' L · ' : ''}${fecha} · ${i + 1}/${lista.length}`,
    })}</div></div>`;
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
      ${etiquetaCss(fmt, '.label')}
    </style></head><body>
    ${labels}
    <script>setTimeout(() => window.print(), 500);</script>
    </body></html>`;
  w.document.write(html);
  w.document.close();
  return true;
}
