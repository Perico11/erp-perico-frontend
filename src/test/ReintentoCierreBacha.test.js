/* ════════════════════════════════════════════════════════════════════════════
   EL REENVÍO DEL CIERRE NO DEBE MENTIRLE AL TÉCNICO (27-ago-2026).

   Si se cae la conexión a media tanda y el técnico le da otra vez, el server
   ahora devuelve el lote que YA existía en vez de duplicarlo, marcado con
   `reenvio`. Ese lote ya pasó su QC.

   Sin este arreglo el asistente le volvía a pedir la transición, la máquina de
   estados la rechazaba —de qc_aprobado no se va a qc_aprobado—, el catch la
   tragaba como "no crítico" y el resumen final decía "producido" de un lote
   realmente APROBADO. El dato quedaba bien y la pantalla mal, que es la familia
   de fallos que este ERP ya cargó dos veces (excluirPedido, bachaIndex).
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FUENTE = fs.readFileSync(
  path.join(process.cwd(), 'src/pages/produccion/ProduccionFlow.jsx'), 'utf8');

describe('el asistente entiende un reenvío del cierre', () => {
  it('lee la bandera que manda el server', () => {
    expect(FUENTE).toContain('if (loteRes.reenvio) {');
  });

  it('toma el estado REAL del lote, no el que asumiría por su cuenta', () => {
    expect(FUENTE).toMatch(/if \(loteRes\.reenvio\) \{\s*estadosFinales\.push\(loteCreado\.estado \|\| 'producido'\);/);
  });

  it('se salta la auto-QC de esa bacha en vez de intentarla y fallar', () => {
    /* El `continue` va ANTES del bloque de QC: si quedara después, se volvería
       a pedir la transición que la máquina de estados ya rechaza. */
    const iReenvio = FUENTE.indexOf('if (loteRes.reenvio) {');
    const iQc = FUENTE.indexOf("const accion = todosEnRango ? 'aprobarQC' : 'rechazarQC';");
    expect(iReenvio).toBeGreaterThan(-1);
    expect(iQc).toBeGreaterThan(-1);
    expect(iReenvio).toBeLessThan(iQc);
    expect(FUENTE.slice(iReenvio, iQc)).toContain('continue;');
  });

  it('el folio del lote reenviado SÍ se apunta: es el mismo trabajo', () => {
    /* folios.push va antes del early-continue; si se saltara, el resumen
       perdería las bachas que el reenvío recuperó. */
    const iFolio = FUENTE.indexOf('folios.push(loteCreado.codigoLote);');
    const iReenvio = FUENTE.indexOf('if (loteRes.reenvio) {');
    expect(iFolio).toBeGreaterThan(-1);
    expect(iFolio).toBeLessThan(iReenvio);
  });
});
