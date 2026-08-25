/* ════════════════════════════════════════════════════════════════════════════
   PRIMERO SE REVISA EL CUÁNTO, LUEGO SE ARRANCA (25-ago-2026).

   Indicación del dueño después de usar la pantalla: "Corregir cantidad" va
   ANTES de "Producir". No es cosmético — revisar el cuánto es el paso PREVIO
   a arrancar, y una vez producido ya no se puede corregir (el server lo niega
   con 409, porque ahí la MP ya se descontó). Poner el botón después invita a
   descubrirlo cuando ya no sirve.

   Esta prueba fija el ORDEN en el DOM. Es lo bastante fácil de voltear en un
   refactor como para que valga la pena tenerlo escrito.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FUENTE = fs.readFileSync(
  path.join(process.cwd(), 'src/pages/produccion/ProduccionPage.jsx'), 'utf8');

describe('orden de los botones en la cola de producción', () => {
  it('"Corregir cantidad" se renderiza ANTES que "Producir"', () => {
    /* Se ancla en el title del botón y en el onClick de producir: son únicos y
       no dependen de la indentación, que un formateo cambiaría sin avisar. */
    const iCorregir = FUENTE.indexOf('title="Corregir cuántos totes/cubetas se van a producir"');
    const iProducir = FUENTE.indexOf('onClick={() => handleStartProduccion(it)}');
    expect(iCorregir, 'no se encontró el botón de corregir').toBeGreaterThan(-1);
    expect(iProducir, 'no se encontró el botón de producir').toBeGreaterThan(-1);
    expect(iCorregir).toBeLessThan(iProducir);
  });

  it('sigue gateado a admin y a pedidos que no se han producido', () => {
    /* El botón no debe ofrecerse cuando el server va a rechazarlo (409). */
    expect(FUENTE).toMatch(/puedeCorregir\s*=\s*it\._tipo === 'pedido'\s*&&\s*user\?\.rol === 'admin'/);
    expect(FUENTE).toMatch(/\['pendiente', 'aceptado', 'en_produccion'\]\.includes\(it\.estado\)/);
  });
});
