/* ════════════════════════════════════════════════════════════════════════════
   InventarioHubPage — entrada ÚNICA "Inventario" para ADMIN (jul 2026,
   simplificación de menús — pedido del dueño).

   Une 3 entradas del mismo uso (llevar el inventario al día): Stock (la
   pantalla grande de MP/PT/Envases/Americano), Conteo (cycle-count, el admin
   aprueba aquí) e Ingresos de proveedor (revisar y sumar al stock).

   Burgos (inventario), Enrique (técnico) y Josué (almacén) conservan sus
   entradas/rutas directas (/conteo, /ingresos) — solo cambia cómo NAVEGA el
   admin. Cero acciones perdidas: páginas completas embebidas.

   URL: /inventario?vista=stock|conteo|ingresos
   Deep-links viejos (/inventario?tab=stkAmericano, ?tab=pt…) siguen vivos:
   sin ?vista= cae a "stock" y el ?tab= interno pasa intacto a InventarioPage.
   ════════════════════════════════════════════════════════════════════════════ */
import HubVistas from '../../components/layout/HubVistas';
import { useAuth } from '../../context/AuthContext';
import InventarioPage from './InventarioPage';
import CycleCountPage from '../cycle-count/CycleCountPage';
import IngresosPage from '../ingresos/IngresosPage';

export default function InventarioHubPage() {
  const { user } = useAuth();
  /* No-admin (técnico/compras/almacén/inventario): idéntico a antes. */
  if (user?.rol !== 'admin') return <InventarioPage />;
  return (
    <HubVistas
      title="Inventarios"
      hubId="inventario"
      vistas={[
        { id: 'stock',    label: 'Stock',    render: () => <InventarioPage embedded /> },
        { id: 'conteo',   label: 'Conteo',   render: () => <CycleCountPage embedded /> },
        /* IngresosPage no tiene TopBar propio — se monta tal cual. */
        { id: 'ingresos', label: 'Ingresos proveedor', render: () => <IngresosPage /> },
      ]}
    />
  );
}
