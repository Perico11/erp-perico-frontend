/* ════════════════════════════════════════════════════════════════════════════
   EL # DE LOTE LLEGA A LAS PANTALLAS (25-ago-2026; reescrito el 26).

   El COMPORTAMIENTO del badge se prueba renderizándolo en LoteBadge.test.jsx.
   Aquí queda sólo lo que de verdad es una propiedad del fuente: que el dato
   viaje por todos los caminos que alimentan las pantallas, y que no queden
   ejemplos del formato viejo invitando a teclear un código que ya no existe.

   La versión anterior de este archivo comparaba cadenas del componente y la
   revisión adversarial la marcó por frágil: falso verde si el componente
   cambiaba de forma haciendo lo correcto. Eso se movió a pruebas de render.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const PRODUCCION = leer('src/pages/produccion/ProduccionPage.jsx');
const MISACTIVOS = leer('src/pages/produccion/MisActivosTab.jsx');
const PEDIDOS = leer('src/pages/pedidos/PedidosPage.jsx');
const API = leer('src/services/api.js');

describe('el dato llega por todos los caminos', () => {
  it('la cola de Producción lo trae venga de una orden o de un pedido', () => {
    /* Dos mapeos distintos alimentan la misma cola: si sólo uno lo trajera, el
       número aparecería y desaparecería según por dónde entró el trabajo. */
    expect(PRODUCCION.match(/codigoLote: [op]\.codigoLote \|\| '',/g) || []).toHaveLength(2);
  });

  it('"Mis activos" cae al número que apartó el pedido si el lote aún no existe', () => {
    /* Es el mismo trabajo: mientras no se produce, el código del encargo ES el
       que acabará en la etiqueta. Antes esta pestaña se quedaba en blanco. */
    expect(MISACTIVOS).toContain('lote?.codigoLote || lote?.codigo || p.codigoLote');
  });

  it('las dos pantallas usan el MISMO badge, no dos copias que se separen', () => {
    for (const f of [PRODUCCION, MISACTIVOS]) {
      expect(f).toMatch(/import LoteBadge from '\.\.\/\.\.\/components\/LoteBadge'/);
      expect(f).toMatch(/import \{ bachasDeItem \} from '\.\.\/\.\.\/utils\/loteSerie'/);
      expect(f).toMatch(/<LoteBadge codigo=\{[\w.]+\.codigoLote\} bachas=\{bachasDeItem\([\w.]+\)\} \/>/);
    }
  });

  it('la tarjeta del pedido prefiere la serie del sistema al campo escrito a mano', () => {
    expect(PEDIDOS).toContain('const codLote = p.codigoLote || p.lote;');
  });
});

describe('el frontend NO acuña códigos de lote', () => {
  it('crearLote manda el lote y el server le pone el número', () => {
    expect(API).toContain("crearLote: (lote) => request('POST', '/api/trazabilidad/lote', { lote })");
  });

  it('no queda ningún ejemplo con el formato viejo en la interfaz', () => {
    for (const f of [
      'src/components/QRModal.jsx',
      'src/components/LoteBadge.jsx',
      'src/pages/devoluciones/DevolucionesPage.jsx',
      'src/pages/produccion/ProduccionPage.jsx',
      'src/pages/produccion/MisActivosTab.jsx',
      'src/pages/pedidos/PedidosPage.jsx',
      'src/services/api.js',
      'src/pages/trazabilidad/TrazabilidadPage.jsx',
    ]) {
      /* LP-20260825-001 y LP-2026-001-A: los dos formatos que ya no se generan.
         (LoteBadge menciona LP-2026-08-13 en un comentario a propósito — es el
         caso real que motivó el arreglo — así que se excluye esa forma.) */
      const txt = leer(f).replace(/LP-2026-08-13/g, '');
      expect(txt).not.toMatch(/LP-(?:20\d{6}|2026)-/);
    }
  });
});
