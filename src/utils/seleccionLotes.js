/* Elegir de qué lotes sale una OT al SURTIR, sin escáner (24-sep-2026).
   El backend (GET /api/transferencias/:id/surtido-lotes) da, por producto:
     { producto, cantidad, disponibles: [{ codigoLote, sublotes: [{ cod, tipo,
       tote, qty, cubEqUnidad, cubEq }] }], sugerencia: [{ cod, unidades }], sinCubrir }
   La pantalla prellena con la sugerencia (del más viejo al más nuevo) y el piso
   corrige si al camión subieron otras piezas. Lo que se manda es lo que se
   marca; la VALIDACIÓN final es del backend (409 si no cuadra). */

const TOL = 0.01;

/* { cod: unidades } prellenado con la sugerencia del surtido automático. */
export function valoresDesdeSugerencia(productos) {
  const vals = {};
  for (const p of (Array.isArray(productos) ? productos : [])) {
    for (const s of (Array.isArray(p.sugerencia) ? p.sugerencia : [])) vals[s.cod] = Number(s.unidades) || 0;
  }
  return vals;
}

const _sublotes = (p) => (Array.isArray(p && p.disponibles) ? p.disponibles : []).flatMap(l => (Array.isArray(l.sublotes) ? l.sublotes : []));

/* Cub-eq elegido de un sublote con `n` piezas (un tote cuenta entero). */
export function cubDeFila(s, n) {
  const u = Number(n) || 0;
  if (u <= 0) return 0;
  return s.tote ? Number(s.cubEq) || 0 : Math.round(u * (Number(s.cubEqUnidad) || 0) * 1000) / 1000;
}

/* Por producto: cuánto se pidió, cuánto va elegido y si cuadra. */
export function totalesPorProducto(productos, vals) {
  return (Array.isArray(productos) ? productos : []).map(p => {
    let elegido = 0;
    let invalida = null;
    for (const s of _sublotes(p)) {
      const raw = vals[s.cod];
      if (raw === '' || raw == null) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) { invalida = invalida || `${s.cod}: cantidad inválida`; continue; }
      if (n > (Number(s.qty) || 0)) { invalida = invalida || `${s.cod}: sólo hay ${s.qty}`; continue; }
      elegido += cubDeFila(s, n);
    }
    elegido = Math.round(elegido * 1000) / 1000;
    const cantidad = Number(p.cantidad) || 0;
    return { producto: p.producto, cantidad, elegido, diferencia: Math.round((elegido - cantidad) * 1000) / 1000, ok: !invalida && Math.abs(elegido - cantidad) <= TOL, invalida };
  });
}

/* ¿Hay con qué elegir? Si Fábrica no tiene etiquetas que cubran algún
   producto, no se ofrece la selección y el surtido va en automático. */
export function seleccionPosible(productos) {
  const ps = Array.isArray(productos) ? productos : [];
  return ps.length > 0 && ps.every(p => {
    const disp = _sublotes(p).reduce((a, s) => a + (Number(s.cubEq) || 0), 0);
    return disp + TOL >= (Number(p.cantidad) || 0);
  });
}

/* Lo que va en `seleccionLotes` del scan: sólo filas con piezas. */
export function seleccionParaEnviar(productos, vals) {
  const out = [];
  for (const p of (Array.isArray(productos) ? productos : [])) {
    for (const s of _sublotes(p)) {
      const n = Number(vals[s.cod]);
      if (Number.isInteger(n) && n > 0) out.push({ cod: s.cod, unidades: s.tote ? Number(s.qty) || 1 : n });
    }
  }
  return out;
}

/* "Faltan 5 cub" / "Sobran 2 cub" / "Completo" */
export function estadoTotal(t) {
  if (t.invalida) return t.invalida;
  if (t.ok) return 'Completo';
  const n = Math.abs(t.diferencia).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  return t.diferencia < 0 ? `Faltan ${n} cub` : `Sobran ${n} cub`;
}
