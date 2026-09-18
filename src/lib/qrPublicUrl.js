/* ════════════════════════════════════════════════════════════════════════
   qrPublicUrl — la URL que llevan IMPRESOS los QR físicos (29-jul-2026).

   Decisión del dueño: las etiquetas salen con el DOMINIO PRINCIPAL
   `pinturaselperico.com/QR/<código>` — no con el subdominio del sistema ni
   con el origin de quien imprime (imprimir desde localhost/vite grababa
   URLs de desarrollo en etiquetas físicas).

   El WordPress del dominio principal (SiteGround) redirige
   /QR/* → sistema.pinturaselperico.com/qr/* — ahí vive la ficha con clave
   de planta. El escaneo INTERNO no depende de esta URL: la app manda la
   cadena tal cual y el backend extrae el código por PATH (case-insensitive),
   así que etiquetas viejas (subdominio o JSON) siguen funcionando.

   VUELVE A SER ESPEJO DEL BACKEND (18-sep-2026, pedido del dueño: "deja la del
   dominio principal en las dos"). Había dejado de serlo: el backend imprimía
   `sistema.pinturaselperico.com/qr/<cod>` y esto el dominio principal, así que
   el mismo bote acababa con dos códigos distintos según quién lo imprimiera.
   Hoy la dirección canónica vive en `lib/qrPublico.js` del backend y es ésta —
   cambiar una es cambiar la otra.

   Y OJO CON LA MAYÚSCULA: la ruta va en `/QR/`. Los lectores del backend
   buscaban `/qr/` en minúsculas, y por eso las etiquetas impresas desde aquí no
   resolvían al escanearlas en el flujo interno (recoger, recibir en Terán,
   entregar). Se arregló allá con un único lector que no distingue mayúsculas.
   ════════════════════════════════════════════════════════════════════════ */
export const QR_PUBLIC_BASE = 'https://pinturaselperico.com/QR';

export function qrPublicUrl(cod) {
  return QR_PUBLIC_BASE + '/' + encodeURIComponent(String(cod || ''));
}
