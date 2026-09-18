/* ════════════════════════════════════════════════════════════════════════════
   useQrSrc — el dibujo del QR que se pega en la etiqueta (18-sep-2026).

   Pedido del dueño: "ahora haz que el frontend también use ese QR", el que
   genera el backend. Hasta hoy había DOS implementaciones del mismo estándar en
   el mismo ERP: la del backend (lib/qr) y la de aquí (la librería `qrcode`).
   Ninguna dependía de un servicio externo —eso se resolvió en julio— pero dos
   implementaciones son dos cosas que mantener y dos que pueden separarse sin
   que nadie lo note.

   Ahora manda la del backend. El generador local NO se borra: queda de red de
   seguridad, y es lo que se ve mientras la respuesta viaja o si el servidor no
   contesta. Una etiqueta es un objeto físico que alguien está esperando para
   pegarlo en una cubeta: quedarse sin imprimir porque el servidor tosió es peor
   que imprimir el mismo QR dibujado aquí. Los dos codifican EL MISMO texto, así
   que el lector no nota la diferencia.

   El texto lo decide quien llama (qrPublicUrl: el dominio principal, decisión
   del dueño del 29-jul). Este hook sólo consigue el dibujo.
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { qrDataUrl } from '../lib/qrGenerator';

/* El mismo texto da siempre el mismo dibujo: se guarda para no volver a pedirlo
   (la pantalla de envasado abre y cierra el modal muchas veces al día). */
const CACHE = new Map();

export default function useQrSrc(texto) {
  const clave = String(texto || '');
  /* Lo que ya entregó el backend, con SU texto al lado: sin esa comparación, al
     cambiar de sublote se pintaría un instante el QR del anterior. */
  const [entrega, setEntrega] = useState(null);

  useEffect(() => {
    /* Sin texto no hay nada que dibujar. Pasa mientras el modal está cerrado:
       el hook se llama igual —tiene que llamarse SIEMPRE, es la regla de los
       hooks— pero no se le pide nada al servidor. */
    if (!clave || CACHE.has(clave)) return undefined;
    let vivo = true;
    (async () => {
      try {
        const r = await api.qrImagen(clave);
        if (!vivo || !r || !r.dataUri) return;
        CACHE.set(clave, r.dataUri);
        setEntrega({ clave, src: r.dataUri });
      } catch {
        /* Sin respuesta del servidor se queda el dibujo local. No se avisa:
           la etiqueta sale igual de buena. */
      }
    })();
    return () => { vivo = false; };
  }, [clave]);

  /* El local se calcula una vez por texto y sirve de respaldo permanente. */
  const respaldo = useMemo(
    () => (clave ? qrDataUrl(clave, { scale: 8, margin: 4, ecLevel: 'M' }) : ''),
    [clave],
  );

  const delBackend = (entrega && entrega.clave === clave) ? entrega.src : CACHE.get(clave);
  return delBackend || respaldo;
}
