/* Resumen de pendientes para el badge PROACTIVO del asistente flotante.
   Lee el `resumen` que devuelve GET /api/notificaciones
   ({ total, noLeidas, criticas, medias, bajas }) y lo reduce a lo que el FAB y
   el saludo necesitan:
     - count    = cuántas NO LEÍDAS (lo "nuevo desde la última vez") → va en el badge.
     - critico  = hay al menos una crítica → el badge va en rojo (si no, ámbar).
     - badge    = etiqueta corta para el círculo ("0".."99", "99+").
     - mostrar  = si pintar el badge (solo cuando hay no leídas).
   Defensivo ante resumen ausente/no numérico (la IA/red puede fallar). */
export function resumirPendientes(resumen) {
  const r = resumen && typeof resumen === 'object' ? resumen : {};
  const num = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };
  const total = num(r.total);
  const noLeidas = num(r.noLeidas);
  const criticas = num(r.criticas);
  return {
    total,
    noLeidas,
    criticas,
    count: noLeidas,
    critico: criticas > 0,
    badge: noLeidas > 99 ? '99+' : String(noLeidas),
    mostrar: noLeidas > 0,
  };
}

/* Frase corta para el saludo proactivo del bot al abrir. Usa el TOTAL de
   pendientes abiertos (no solo no leídas) para dar el panorama completo, y marca
   las críticas. Devuelve '' si no hay nada (el saludo normal se mantiene). */
export function fraseProactiva(resumen) {
  const { total, criticas } = resumirPendientes(resumen);
  if (total <= 0) return '';
  const plural = total === 1 ? 'pendiente' : 'pendientes';
  const crit = criticas > 0 ? ` (${criticas} crítica${criticas === 1 ? '' : 's'})` : '';
  return `Tienes **${total}** ${plural}${crit}.`;
}
