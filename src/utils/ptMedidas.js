/* Medidas de captura de Producto Terminado — FUENTE ÚNICA compartida por
   Inventario (Ajustar / Agregar PT) y Pedidos (Nuevo pedido).
   La CUBETA (19 L) es la unidad base de contabilidad; el cubeta-equivalente
   (para costo/forecast/mínimos) se deriva de los ml de cada medida (volúmenes del
   catálogo de envases + tote = 52 cubetas). Agregar una medida = una línea más. */
export const CUBETA_ML = 19000;

export const PT_MEDIDAS = [
  { key: 'tote',          label: 'Tote',              ml: 988000, sing: 'tote',       plur: 'totes' },
  { key: 'cubeta',        label: 'Cubeta',            ml: 19000,  sing: 'cubeta',     plur: 'cubetas' },
  { key: 'galon',         label: 'Galón',             ml: 3785,   sing: 'galón',      plur: 'galones' },
  { key: 'litro',         label: 'Litro',             ml: 946,    sing: 'litro',      plur: 'litros' },
  { key: 'atomizador750', label: 'Atomizador 750 ml', ml: 750,    sing: 'atomizador', plur: 'atomizadores' },
];

export const ptMedidaDef = (key) => PT_MEDIDAS.find(m => m.key === key) || null;
export const cubetasPorMedida = (key) => { const m = ptMedidaDef(key); return m ? m.ml / CUBETA_ML : 1; };
/* cantidad en una medida → cubetas-equivalente (base). Ej. tote × 2 = 104. */
export const medidaACubetas = (key, cant) => Math.round((Number(cant) || 0) * cubetasPorMedida(key) * 1000) / 1000;
/* etiqueta legible: (tote, 2) → "2 totes" · (cubeta, 1) → "1 cubeta" */
export const etiquetaMedida = (key, cant) => {
  const m = ptMedidaDef(key); if (!m) return '';
  const n = Number(cant) || 0;
  const palabra = n === 1 ? m.sing : m.plur;
  return `${n.toLocaleString('es-MX')} ${palabra}${key === 'atomizador750' ? ' 750 ml' : ''}`;
};
