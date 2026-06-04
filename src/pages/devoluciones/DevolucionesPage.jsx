import TopBar from '../../components/layout/TopBar';
import DevolucionesPanel from '../admin/DevolucionesPanel';

const S = {
  wrap: { padding: '0 20px 100px' },
};

/* Página dedicada — usa el panel ya existente de admin (mismo componente) */
export default function DevolucionesPage() {
  return (
    <div>
      <TopBar title="Devoluciones" />
      <div style={S.wrap}>
        <DevolucionesPanel />
      </div>
    </div>
  );
}
