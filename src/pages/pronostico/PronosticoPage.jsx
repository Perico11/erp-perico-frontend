/* ═══════════════════════════════════════════════════════════════════
   PronosticoPage — /pronostico (NUEVA, decisión LOCKED del dueño §9)
   "La inteligencia" de compra: Sugerencias (Forecast IA, default) · MRP ·
   Tendencia · IA avanzada · Pedidos.

   REUSO TOTAL: es exactamente ComprasPage en modo 'pronostico'. Comparten el
   MISMO componente (mismos handlers, modales, realtime) — solo cambia QUÉ tabs
   se montan y el título del TopBar. "Generar OC" desde aquí cae en
   Compras ▸ Por aprobar vía navegación a /compras con prefill (ver ComprasPage).
   ═══════════════════════════════════════════════════════════════════ */
import ComprasPage from '../compras/ComprasPage';

export default function PronosticoPage() {
  return <ComprasPage mode="pronostico" />;
}
