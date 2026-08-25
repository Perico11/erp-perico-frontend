/* ═══════════════════════════════════════════════════════════════════════
   PedidoIncomingManager — Sprint P (jun 2026).

   Monta el PedidoModal cuando hay un pedido pendiente NO VISTO para Enrique.
   Toda la lógica de cola, realtime y mutación vive en PedidosNotifContext;
   este componente solo decide CUÁNDO renderizar el modal y orquesta las
   4 acciones del handoff (accept/reject/cola/detail).
   ═══════════════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PedidoModal from './PedidoModal';
import { usePedidosNotif } from '../context/PedidosNotifContext';

export default function PedidoIncomingManager() {
  const { activo, peek, accept, reject, markSeen } = usePedidosNotif();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  /* Solo se monta el modal para el rol técnico — el provider ya lo asegura
     con `activo`, pero protegemos por defensa. */
  if (!activo) return null;
  if (!peek) return null;

  const handleResolve = async (accion, motivo) => {
    if (busy) return;
    setBusy(true);
    try {
      if (accion === 'accept') {
        await accept(peek);
      } else if (accion === 'reject') {
        /* Auditoría 24-ago-2026: el backend exige motivo ≥5 chars — antes se
           mandaba '' y el rechazo daba 400 SIEMPRE. El modal ahora lo captura
           y llega aquí como segundo argumento. */
        await reject(peek, String(motivo || '').trim());
      } else if (accion === 'cola') {
        markSeen(peek); /* sigue en backlog pero el modal no reabre */
      } else if (accion === 'detail') {
        markSeen(peek); /* marcar para que al volver no reabra */
        navigate('/pedidos?focus=' + encodeURIComponent(peek.id || peek.codigo || ''));
      }
    } catch (e) {
      /* Si falla, lo dejamos en cola para que pueda reintentar */
      markSeen(peek);
      window.alert('No se pudo procesar el pedido: ' + (e?.message || 'error desconocido'));
    } finally {
      setBusy(false);
    }
  };

  return <PedidoModal pedido={peek} onResolve={handleResolve} />;
}
