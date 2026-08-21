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

   Espejo frontend de _generarQRPayload (server.js) — cambiar uno = cambiar
   el otro.
   ════════════════════════════════════════════════════════════════════════ */
export const QR_PUBLIC_BASE = 'https://pinturaselperico.com/QR';

export function qrPublicUrl(cod) {
  return QR_PUBLIC_BASE + '/' + encodeURIComponent(String(cod || ''));
}
