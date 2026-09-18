/* imprimirEtiquetasTotes — impresión de etiquetas de totes americanos.
   Reescrita 10-ago-2026 (pedido dueño): la etiqueta del tote va SIN QR — solo
   la banda "TOTE + color" y el folio en grande (USA-0050-03). El tote se
   identifica a ojo y al envasar se elige de la lista; no se escanea.
   Sirve igual para la impresión masiva (todos los totes) que para reimprimir
   UNO desde el menú del color.

   18-sep-2026 — DOS ARREGLOS, los dos por el mismo reporte del dueño ("a veces
   imprime y a veces no… sale todo bien, pero como que no manda comunicación a
   la impresora, sólo desde el usuario de Josué", en la pantalla de almacén):

     · EL FORMATO. Esta función tenía su PROPIA lista de formatos, sin el 52×25
       —el oficial, y el que el QRModal deja guardado por defecto en la misma
       preferencia del navegador (pp_qr_formato)—. Al no encontrarlo caía EN
       SILENCIO al 50×25: el rollo puesto mide 52×25 y el trabajo salía armado
       de 50 mm. Ahora usa el catálogo único de lib/etiquetaLote, donde lo que
       no se reconoce cae al OFICIAL.
     · EL DOCUMENTO. Lo armaba aquí, con los mismos tres defectos que ya se
       arreglaron en las otras dos pantallas: la caja del tamaño exacto de la
       hoja (el driver redondea y el navegador pagina), un salto de página que
       sobraba al final, e imprimir a ciegas a los 500 ms. Ahora lo arma
       documentoImprimible, que es el único sitio donde vive eso.

   items: [{ cod, producto }] */
import {
  documentoImprimible, etiquetaToteCss, etiquetaToteHtml,
  resolverFormato, formatoGuardado, rotacionGuardada,
} from '../../lib/etiquetaLote';

export default function imprimirEtiquetasTotes(items) {
  const lista = (items || []).filter((x) => x && x.cod);
  if (!lista.length) { alert('No hay totes con lote asignado para imprimir'); return false; }

  const fmt = resolverFormato(formatoGuardado());
  const rotacion = rotacionGuardada();

  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) { alert('Habilita popups para imprimir'); return false; }

  w.document.write(documentoImprimible({
    titulo: `Etiquetas de totes (${lista.length})`,
    etiquetas: lista.map((it) => etiquetaToteHtml({ producto: it.producto, codigo: it.cod, fmt })),
    fmt,
    rotacion,
    css: etiquetaToteCss,
  }));
  w.document.close();
  return true;
}
