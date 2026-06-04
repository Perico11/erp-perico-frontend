import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import InboundAlertManager from '../InboundAlertManager';
import PedidoIncomingManager from '../PedidoIncomingManager';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useToast } from '../ui/Toast';

export default function AppLayout() {
  const navigate = useNavigate();
  const toast = useToast();

  /* Notificaciones globales de eventos de control de inventario
     (cierre mensual auto, conteo finalizado pendiente de aprobar, recordatorio
     semanal, conteo aprobado). El filtrado por rol lo hace el backend con
     __targetRoles — el cliente solo muestra lo que recibe. */
  useRealtimeSync({
    onCycleCount: (payload) => {
      if (!payload) return;
      const evt = payload.evento;
      if (evt === 'finalizada') {
        toast.info(payload.mensaje || 'Conteo finalizado', {
          action: { label: 'Ir a aprobar', onClick: () => navigate('/conteo') },
          duration: 12000,
        });
      } else if (evt === 'aprobada') {
        toast.success(payload.mensaje || 'Conteo aprobado', { duration: 8000 });
      } else if (evt === 'recordatorio-semanal') {
        toast.warning(payload.mensaje || 'Tienes conteos pendientes esta semana', {
          action: { label: 'Ver pendientes', onClick: () => navigate('/conteo') },
          duration: 15000,
        });
      }
    },
    onReportes: (payload) => {
      if (!payload) return;
      if (payload.evento === 'cierre-automatico') {
        toast.info(payload.mensaje || 'Mes cerrado automáticamente', {
          action: { label: 'Ver reporte', onClick: () => navigate('/reportes') },
          duration: 15000,
        });
      }
    },
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--lp-bg-base)' }}>
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
      <BottomNav />
      {/* Banner emergente global para Luis + Josué cuando hay sublotes envasados
          disponibles en fábrica. Compiten: el primer scan/aceptar gana, el otro
          recibe broadcast WS y se le oculta el banner automáticamente. */}
      <InboundAlertManager />
      {/* Sprint P (jun 2026): Modal central bloqueante para pedidos nuevos.
          Solo se monta para rol 'tecnico' (el provider asegura activo=false
          para otros roles → manager devuelve null). */}
      <PedidoIncomingManager />
    </div>
  );
}
