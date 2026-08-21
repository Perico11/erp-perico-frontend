/* ════════════════════════════════════════════════════════════════════════════
   LogisticaHubPage — entrada ÚNICA "Logística" para ADMIN (jul 2026,
   simplificación de menús — pedido del dueño).

   Une 3 entradas del mismo uso (mover producto terminado): Transferencias
   (OTs Fábrica↔Terán), Entregas a tiendas (la baja del CEDIS) y Recolección
   (la ruta de Luis). Josué, Luis y Burgos conservan sus entradas/rutas
   directas (/entregas, /recoleccion) — solo cambia cómo NAVEGA el admin.
   Cero acciones perdidas: páginas completas embebidas.

   URL: /transferencias?vista=transferencias|entregas|recoleccion
   (la ruta se queda en /transferencias para no romper deep-links ni QRs).
   ════════════════════════════════════════════════════════════════════════════ */
import HubVistas from '../../components/layout/HubVistas';
import { useAuth } from '../../context/AuthContext';
import TransferenciasPage from './TransferenciasPage';
import EntregasPage from '../entregas/EntregasPage';
import RecoleccionPage from '../recoleccion/RecoleccionPage';

export default function LogisticaHubPage() {
  const { user } = useAuth();
  /* No-admin (almacén/inventario/técnico): idéntico a antes. */
  if (user?.rol !== 'admin') return <TransferenciasPage />;
  return (
    <HubVistas
      title="Logística"
      hubId="logistica"
      vistas={[
        { id: 'transferencias', label: 'Transferencias', render: () => <TransferenciasPage embedded /> },
        { id: 'entregas',       label: 'Entregas',       render: () => <EntregasPage embedded /> },
        { id: 'recoleccion',    label: 'Recolección',    render: () => <RecoleccionPage embedded /> },
      ]}
    />
  );
}
