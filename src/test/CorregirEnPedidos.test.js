/* ════════════════════════════════════════════════════════════════════════════
   EL BOTÓN QUE ESTABA EN LA PANTALLA EQUIVOCADA (25-ago-2026).

   "Corregir cantidad" nació en la cola de Producción — porque ahí fue donde el
   dueño vio el problema. Pero esa cola solo lista pedidos que YA arrancaron
   (pedidosListos filtra estado === 'en_produccion' && fechaInicioProduccion).

   O sea: un pedido en 'pendiente' o 'aceptado' —justo cuando conviene
   corregirlo, ANTES de que se descuente nada— no tenía el botón en ninguna
   parte. Su propio gate permitía esos estados, pero eran inalcanzables.

   El dueño lo dijo exacto: "sigue sin aparecer el botón de corregir # totes
   ANTES de la pantalla de producir".

   Estas pruebas fijan que el botón viva donde el pedido todavía se puede
   corregir, y que no se ofrezca cuando el server lo va a rechazar.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const leer = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const PEDIDOS = leer('src/pages/pedidos/PedidosPage.jsx');
const PRODUCCION = leer('src/pages/produccion/ProduccionPage.jsx');

describe('dónde vive "Corregir cantidad"', () => {
  it('está en PEDIDOS, que es donde el pedido todavía no ha arrancado', () => {
    expect(PEDIDOS).toContain('data-id="pedidos.btn.corregir-cantidad"');
    expect(PEDIDOS).toContain('CorregirCantidadModal');
  });

  it('sigue estando en la cola de Producción (no se movió, se sumó)', () => {
    expect(PRODUCCION).toContain('Corregir cantidad');
    expect(PRODUCCION).toContain('CorregirCantidadModal');
  });

  it('el modal es compartido: vive en components/, no dentro de una pantalla', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'src/components/CorregirCantidadModal.jsx'))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), 'src/pages/produccion/CorregirCantidadModal.jsx'))).toBe(false);
    for (const f of [PEDIDOS, PRODUCCION]) {
      expect(f).toMatch(/import CorregirCantidadModal from '[^']*components\/CorregirCantidadModal'/);
    }
  });
});

describe('cuándo se ofrece', () => {
  it('solo admin, y solo mientras el inventario no se haya movido', () => {
    /* A partir de 'producido' la MP ya se descontó y el server responde 409:
       ofrecer el botón ahí sería mandar al dueño contra un error. */
    expect(PEDIDOS).toMatch(/mostrarCorregir\s*=\s*tabOperable && user\?\.rol === 'admin'/);
    expect(PEDIDOS).toMatch(/\['pendiente', 'aceptado', 'en_produccion'\]\.includes\(p\.estado\)/);
    expect(PEDIDOS).toMatch(/mostrarCorregir[\s\S]{0,200}!p\.eliminado/);
  });

  it('cuenta como acción, para que la fila no se pinte vacía', () => {
    expect(PEDIDOS).toMatch(/const tieneAcciones = mostrarCorregir \|\|/);
  });

  it('va ANTES de aceptar e iniciar: revisar el cuánto precede a arrancar', () => {
    const iCorregir = PEDIDOS.indexOf('data-id="pedidos.btn.corregir-cantidad"');
    const iAceptar = PEDIDOS.indexOf('data-id="pedidos.btn.aceptar-producir"');
    const iIniciar = PEDIDOS.indexOf('data-id="pedidos.btn.iniciar-produccion"');
    expect(iCorregir).toBeGreaterThan(-1);
    expect(iCorregir).toBeLessThan(iAceptar);
    expect(iCorregir).toBeLessThan(iIniciar);
  });

  it('al guardar recarga pedidos Y órdenes (la orden lleva su propia copia)', () => {
    expect(PEDIDOS).toMatch(/onSaved=\{\(\) => \{ setCorregirModal\(null\); reload\(\); reloadOrd\(\); \}\}/);
  });
});
