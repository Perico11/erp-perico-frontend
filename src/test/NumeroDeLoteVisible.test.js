/* ════════════════════════════════════════════════════════════════════════════
   EL # DE LOTE SE VE DESDE QUE SE ASIGNA (25-ago-2026).

   Pedido del dueño: "cuando Josué hace un pedido de cualquier clase se debe
   crear un lote #… que se herede desde que se asigna hasta que se saca en
   Terán a envasar con el botón. TODO DEBE COINCIDIR."

   El número lo acuña el BACKEND al crear el pedido (LP-0007-001) y viaja
   pedido → orden → lote → tote. El frontend no lo inventa —nunca lo hizo— pero
   antes tampoco lo enseñaba: entre aceptar y cerrar el lote, la pantalla no
   sabía nombrar lo que se estaba fabricando. Lo que se fija aquí es que ese
   número LLEGUE a la cola de producción y a la tarjeta del pedido, para poder
   compararlo contra la etiqueta impresa.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const PRODUCCION = leer('src/pages/produccion/ProduccionPage.jsx');
const PEDIDOS = leer('src/pages/pedidos/PedidosPage.jsx');
const API = leer('src/services/api.js');

describe('la cola de Producción nombra el lote antes de producirlo', () => {
  it('el código viaja al item, venga de una orden o de un pedido', () => {
    /* Dos mapeos distintos alimentan la misma cola: si solo uno lo trajera,
       el número aparecería y desaparecería según por dónde entró el trabajo. */
    const veces = PRODUCCION.match(/codigoLote: [op]\.codigoLote \|\| '',/g) || [];
    expect(veces.length).toBe(2);
  });

  it('se pinta en escritorio Y en móvil', () => {
    const veces = PRODUCCION.match(/<LoteBadge codigo=\{it\.codigoLote\} \/>/g) || [];
    expect(veces.length).toBe(2);
  });

  it('sin código no pinta nada: mejor vacío que un número inventado', () => {
    /* Lo anterior al cambio no tiene serie; enseñar un placeholder ahí sería
       peor que no enseñar nada — el piso lo copiaría a la etiqueta. */
    expect(PRODUCCION).toMatch(/function LoteBadge\(\{ codigo \}\) \{\s*if \(!codigo\) return null;/);
  });
});

describe('la tarjeta del pedido muestra su lote', () => {
  it('prefiere la serie del sistema sobre el campo viejo escrito a mano', () => {
    expect(PEDIDOS).toContain('const codLote = p.codigoLote || p.lote;');
    expect(PEDIDOS).toMatch(/if \(codLote\) metaParts\.push\(<>Lote <code/);
  });

  it('el campo viejo `lote` no se pierde para lo que ya existía', () => {
    /* Hay pedidos con lote escrito a mano de antes del cambio. */
    expect(PEDIDOS).not.toMatch(/metaParts\.push\(<>Lote <code[^)]*\{p\.lote\}/);
    expect(PEDIDOS).toContain('p.codigoLote || p.lote');
  });
});

describe('el frontend NO acuña códigos de lote', () => {
  it('crearLote manda el lote y el server le pone el número', () => {
    expect(API).toContain("crearLote: (lote) => request('POST', '/api/trazabilidad/lote', { lote })");
  });

  it('no queda ningún LP-FECHA en textos de la interfaz', () => {
    /* El formato viejo (LP-20260825-001) ya no se genera; los ejemplos que
       lo enseñaban invitaban a teclear un código que el sistema no da. */
    for (const f of [
      'src/components/QRModal.jsx',
      'src/pages/devoluciones/DevolucionesPage.jsx',
      'src/pages/produccion/ProduccionPage.jsx',
      'src/pages/pedidos/PedidosPage.jsx',
      'src/services/api.js',
      'src/pages/trazabilidad/TrazabilidadPage.jsx',
    ]) {
      expect(leer(f)).not.toMatch(/LP-(?:20\d{6}|2026)-/);
    }
  });
});
