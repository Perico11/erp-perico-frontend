/* ════════════════════════════════════════════════════════════════════════════
   LoteBadge — el # de lote del encargo, visible desde que se asigna.
   (26-ago-2026, tras la revisión adversarial del cambio LP-0001-001)

   El dueño: "que se herede desde que se asigna hasta que se saca en Terán a
   envasar con el botón, todo debe coincidir". El backend acuña el número al
   crear el pedido; esto lo enseña, para que el operario pueda comparar contra
   la etiqueta que va a imprimir.

   Vive aparte porque lo usan DOS pantallas —la cola de Producción y "Mis
   activos"— y porque tenerlo suelto permite probarlo por comportamiento en vez
   de por coincidencia de texto en el fuente.

   RANGO CUANDO SON VARIAS BACHAS. Un encargo de más de un tanque se fabrica en
   N bachas y cada una es su propio lote: LP-0007-001, -002, -003. Enseñar sólo
   el -001 invitaba a copiarlo a las tres etiquetas, así que con más de una se
   muestra el rango completo.

   Sin código no pinta nada: lo anterior al cambio no tiene serie, y un
   placeholder ahí sería peor que el vacío —el piso lo copiaría a la etiqueta—. */
import { rangoDeLote } from '../utils/loteSerie';

export default function LoteBadge({ codigo, bachas }) {
  if (!codigo) return null;
  const n = Math.max(1, Number(bachas) || 1);
  const texto = rangoDeLote(codigo, n);
  return (
    <span
      data-testid="lote-badge"
      title={n > 1
        ? `Esta tirada son ${n} bachas y cada una es su propio lote: ${texto}`
        : 'Número de lote de este encargo — el mismo que llevará la etiqueta'}
      style={{
        fontFamily: 'var(--lp-font-mono)', fontSize: 11, fontWeight: 700,
        /* Variables REALES del tema: las de la primera versión
           (--lp-bg-subtle, --lp-border) no existían y sus fallbacks eran hex
           claros fijos → en modo oscuro quedaba un chip casi blanco, 2.7:1. */
        color: 'var(--lp-text-secondary)', background: 'var(--lp-bg-sunken)',
        border: '1px solid var(--lp-border-subtle)', borderRadius: 5, padding: '1px 6px',
      }}
    >
      {texto}
    </span>
  );
}
