/* ════════════════════════════════════════════════════════════════════════════
   FormulasHubPage — entrada ÚNICA "Fórmulas y lab" para ADMIN (jul 2026,
   simplificación de menús — pedido del dueño).

   Une 2 entradas del mismo uso (I+D del producto): Fórmulas (el editor con
   NDA/SecureView) y Laboratorio (pruebas de reformulación). Enrique conserva
   su entrada/ruta directa a /laboratorio — solo cambia cómo NAVEGA el admin.
   Cero acciones perdidas: páginas completas embebidas (NDA y SecureView de
   Fórmulas siguen activos dentro de su vista).

   URL: /formulas?vista=formulas|laboratorio  (ruta ya era solo-admin).
   ════════════════════════════════════════════════════════════════════════════ */
import HubVistas from '../../components/layout/HubVistas';
import FormulasPage from './FormulasPage';
import LaboratorioPage from '../laboratorio/LaboratorioPage';

export default function FormulasHubPage() {
  return (
    <HubVistas
      title="Fórmulas y laboratorio"
      hubId="formulas"
      vistas={[
        { id: 'formulas',    label: 'Fórmulas',    render: () => <FormulasPage embedded /> },
        { id: 'laboratorio', label: 'Laboratorio', render: () => <LaboratorioPage embedded /> },
      ]}
    />
  );
}
