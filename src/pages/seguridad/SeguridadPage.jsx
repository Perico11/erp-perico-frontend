/* SeguridadPage — Configuración personal de Google Authenticator (TOTP).

   Accesible a admin, tecnico, inventario y almacen — cualquier rol que ejecute
   acciones críticas (modificar inventario, fórmulas, canónico) y por lo tanto
   necesita TOTP propio.

   Reusa el componente TOTPSetupPanel que ya estaba en admin. */

import TopBar from '../../components/layout/TopBar';
import TOTPSetupPanel from '../admin/TOTPSetupPanel';

export default function SeguridadPage() {
  return (
    <div>
      <TopBar title="Seguridad" />
      <TOTPSetupPanel />
    </div>
  );
}
