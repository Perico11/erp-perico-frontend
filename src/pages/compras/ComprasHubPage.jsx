/* ════════════════════════════════════════════════════════════════════════════
   ComprasHubPage — entrada ÚNICA "Compras" para ADMIN (jul 2026, simplificación
   de menús — pedido del dueño: "unificar las que tengan el mismo uso").

   Antes el admin tenía 4 entradas del dominio compras: Compras, Pronóstico,
   SAT/CFDI y POS Aliases. Ahora es UNA entrada con 4 vistas (HubVistas).
   OJO: las decisiones LOCKED de §9 (Compras≠Pronóstico, SAT/POS pantalla
   propia) siguen intactas PARA ARELY — ella conserva sus 4 entradas y rutas
   directas (/pronostico, /sat, /pos-aliases siguen vivas). Solo cambia cómo
   NAVEGA el admin. Cero acciones perdidas: páginas completas embebidas.

   URL: /compras?vista=oc|pronostico|sat|aliases
   ════════════════════════════════════════════════════════════════════════════ */
import HubVistas from '../../components/layout/HubVistas';
import { useAuth } from '../../context/AuthContext';
import ComprasPage from './ComprasPage';
import SATPage from '../sat/SATPage';
import PosAliasesPage from '../pos-aliases/PosAliasesPage';

export default function ComprasHubPage() {
  const { user } = useAuth();
  /* Arely (compras): idéntico a antes — su pantalla directa, sin selector. */
  if (user?.rol !== 'admin') return <ComprasPage />;
  return (
    <HubVistas
      title="Compras"
      hubId="compras"
      vistas={[
        { id: 'oc',         label: 'Órdenes de compra', render: () => <ComprasPage embedded /> },
        { id: 'pronostico', label: 'Pronóstico',        render: () => <ComprasPage mode="pronostico" embedded /> },
        { id: 'sat',        label: 'SAT / CFDI',        render: () => <SATPage embedded /> },
        { id: 'aliases',    label: 'POS Aliases',       render: () => <PosAliasesPage embedded /> },
      ]}
    />
  );
}
