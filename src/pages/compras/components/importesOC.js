import { useState, useMemo } from 'react';

/* importesOC — la captura de los IMPORTES REALES de una OC (27-jul-2026).

   La factura del proveedor llega después de levantar la OC y casi siempre trae
   otro total. Esa corrección vive en DOS pantallas, y por eso el estado y los
   campos viven aquí, no duplicados en cada modal:
     · RegistrarPagoModal    → crédito: se corrige en el mismo acto de pagar.
     · CorregirImportesModal → contado o ya pagada (el pago se registró al
       aprobar, así que no hay otro momento donde entre la factura real).

   DOS CAMPOS, NO VEINTE (decisión del dueño): lo único editable es **Producto**
   (el total de la mercancía) y **Flete**. La causa real del descuadre es el tipo
   de cambio —el dólar se mueve y el costo final de TODA la compra cambia—, no un
   renglón suelto. Al teclear el total, el ajuste se reparte entre las partidas
   en proporción a lo que ya pesaban (o por kg si aún no tenían precio), que es
   justo lo que hace un movimiento cambiario. De ahí sale el $/kg de cada MP, que
   es lo que persiste la OC y lo que costea el sistema.

   Los kg NO se editan aquí — ya movieron inventario al recibir; eso es
   "Recibir MP". */

export const money = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/* '' cuando no hay valor previo: el placeholder invita a capturar el real sin
   simular que el estimado del maestro es el precio de la factura. */
const numStr = (v) => (v != null && Number(v) > 0 ? String(v) : '');
/* Monto para input: 2 decimales, sin separadores. */
const impStr = (v) => (Number(v) > 0 ? String(Math.round(Number(v) * 100) / 100) : '');

export function useImportesOC(oc) {
  /* Partidas: kg fijos (lo recibido) y precio vigente. Solo lectura en la UI. */
  const partidas = useMemo(() => (oc.items || []).map(it => ({
    mp: it.mp,
    kg: Number(it.kg_recibidos) > 0 ? Number(it.kg_recibidos) : (Number(it.kg) || 0),
    recibido: Number(it.kg_recibidos) > 0,
    precioOriginal: Number(it.precioUnitario) || 0,
  })), [oc]);

  const productoOriginal = useMemo(
    () => partidas.reduce((s, p) => s + p.kg * p.precioOriginal, 0), [partidas]);
  const totalKg = useMemo(() => partidas.reduce((s, p) => s + p.kg, 0), [partidas]);

  /* `precios` es DERIVADO del total tecleado — nadie lo edita a mano, pero es lo
     que viaja al backend (la OC guarda precioUnitario por partida). */
  const [precios, setPrecios] = useState(() => partidas.map(p => numStr(p.precioOriginal)));
  const [producto, setProductoRaw] = useState(() => impStr(productoOriginal));
  const [flete, setFlete] = useState(numStr(oc.fleteEstimadoMxn));
  const [totalIva, setTotalIva] = useState(numStr(oc.totalFacturaConIva));
  /* Casilla del dueño: corregir el importe también corrige el costo/kg del
     sistema (promedio ponderado). Solo aplica si la MP ya está en stock. */
  const [recostear, setRecostear] = useState(true);

  /* Sin kg ni precios previos no hay sobre qué repartir: el campo se bloquea. */
  const puedeRepartir = totalKg > 0;

  const setProducto = (v) => {
    setProductoRaw(v);
    const total = Number(v);
    /* Vacío o inválido → los precios vuelven a los de la OC (no hay cambio). */
    if (v === '' || !isFinite(total) || total < 0 || !puedeRepartir) {
      setPrecios(partidas.map(p => numStr(p.precioOriginal)));
      return;
    }
    setPrecios(partidas.map(p => {
      if (!(p.kg > 0)) return numStr(p.precioOriginal);
      /* Participación de la partida: la que ya tenía en pesos; si la OC no traía
         precios, se reparte por kg (única repartición defendible sin datos). */
      const parte = productoOriginal > 0
        ? (p.kg * p.precioOriginal) / productoOriginal
        : p.kg / totalKg;
      /* 6 decimales: con 4, un tote de 1,000 kg perdía centavos al reconstruir
         el total tecleado. */
      return String(Math.round(((total * parte) / p.kg) * 1e6) / 1e6);
    }));
  };

  /* Importe que se muestra por partida y el total: siempre reconstruidos desde
     los precios, así lo que se ve es exactamente lo que se va a guardar. */
  const importeDe = (i) => (partidas[i] ? partidas[i].kg * (Number(precios[i]) || 0) : 0);
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
  const productoNum = Number(producto);
  const hayError = (producto !== '' && (!isFinite(productoNum) || productoNum < 0)) ||
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
    oc, partidas, precios, importeDe, producto, setProducto, puedeRepartir, totalKg,
    flete, setFlete, totalIva, setTotalIva, recostear, setRecostear,
    totalProducto, fleteNum, subtotal,
    preciosCambiados, fleteCambio, ivaCambio, hayError, hayCambios, yaRecibida,
    payloadImportes,
  };
}
