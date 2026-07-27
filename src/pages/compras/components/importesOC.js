import { useState, useMemo } from 'react';

/* importesOC — la captura de los IMPORTES REALES de una OC (27-jul-2026).

   La factura del proveedor llega después de levantar la OC y casi siempre trae
   otro precio o otro flete. Esa corrección vive en DOS pantallas, y por eso el
   estado y los campos viven aquí, no duplicados en cada modal:
     · RegistrarPagoModal    → crédito: se corrige en el mismo acto de pagar.
     · CorregirImportesModal → contado o ya pagada (el pago se registró al
       aprobar, así que no hay otro momento donde entre la factura real).

   Solo dinero: precio/kg por partida, flete y total facturado. Los kg NO se
   editan aquí — ya movieron inventario al recibir; eso es "Recibir MP". */


export const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/* '' cuando no hay valor previo: el placeholder invita a capturar el real sin
   simular que el estimado del maestro es el precio de la factura. */
const numStr = (v) => (v != null && Number(v) > 0 ? String(v) : '');

export function useImportesOC(oc) {
  /* Partidas: kg fijos (lo recibido), precio editable. */
  const partidas = useMemo(() => (oc.items || []).map(it => ({
    mp: it.mp,
    kg: Number(it.kg_recibidos) > 0 ? Number(it.kg_recibidos) : (Number(it.kg) || 0),
    recibido: Number(it.kg_recibidos) > 0,
    precioOriginal: Number(it.precioUnitario) || 0,
  })), [oc]);

  const [precios, setPrecios] = useState(() => partidas.map(p => numStr(p.precioOriginal)));
  const [flete, setFlete] = useState(numStr(oc.fleteEstimadoMxn));
  const [totalIva, setTotalIva] = useState(numStr(oc.totalFacturaConIva));
  /* Casilla del dueño: corregir el precio también corrige el costo/kg del
     sistema (promedio ponderado). Solo aplica si la MP ya está en stock. */
  const [recostear, setRecostear] = useState(true);

  const setPrecio = (idx, v) => setPrecios(prev => prev.map((p, i) => (i === idx ? v : p)));

  const totalProducto = useMemo(
    () => partidas.reduce((s, p, i) => s + p.kg * (Number(precios[i]) || 0), 0),
    [partidas, precios]
  );
  const fleteNum = Number(flete) || 0;
  const subtotal = totalProducto + fleteNum;

  /* Qué cambió respecto a lo que hoy tiene la OC (lo que se manda al backend). */
  const preciosCambiados = useMemo(() => partidas
    .map((p, i) => ({ mp: p.mp, kg: p.kg, antes: p.precioOriginal, ahora: Number(precios[i]), raw: precios[i] }))
    .filter(c => c.raw !== '' && isFinite(c.ahora) && c.ahora >= 0 && c.ahora !== c.antes),
    [partidas, precios]);
  const fleteCambio = flete !== '' && isFinite(fleteNum) && fleteNum >= 0 && fleteNum !== (Number(oc.fleteEstimadoMxn) || 0);
  const ivaNum = Number(totalIva);
  const ivaCambio = totalIva !== '' && isFinite(ivaNum) && ivaNum >= 0 && ivaNum !== (Number(oc.totalFacturaConIva) || 0);
  const hayError = precios.some(p => p !== '' && (!isFinite(Number(p)) || Number(p) < 0)) ||
                   (flete !== '' && (!isFinite(fleteNum) || fleteNum < 0)) ||
                   (totalIva !== '' && (!isFinite(ivaNum) || ivaNum < 0));
  const hayCambios = preciosCambiados.length > 0 || fleteCambio || ivaCambio;
  const yaRecibida = oc.estado === 'recibida';

  /* Solo lo que cambió — el backend ignora lo idéntico, pero así el historial
     y el broadcast no se llenan de ruido. */
  const payloadImportes = () => {
    const p = {};
    if (preciosCambiados.length) {
      p.items = preciosCambiados.map(c => ({ mp: c.mp, precioUnitario: c.ahora }));
      p.actualizarCostos = yaRecibida && recostear;
    }
    if (fleteCambio) p.fleteEstimadoMxn = fleteNum;
    if (ivaCambio) p.totalFacturaConIva = ivaNum;
    return p;
  };

  return {
    oc, partidas, precios, setPrecio, flete, setFlete, totalIva, setTotalIva,
    recostear, setRecostear, totalProducto, fleteNum, subtotal,
    preciosCambiados, fleteCambio, ivaCambio, hayError, hayCambios, yaRecibida,
    payloadImportes,
  };
}
