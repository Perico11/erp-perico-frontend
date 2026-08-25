/* ════════════════════════════════════════════════════════════════════════════
   EL BOTÓN QUE PROMETÍA PRODUCIR Y SOLO ACEPTABA (25-ago-2026).

   El dueño le dio "Aceptar y producir" a BLANCO SG V3 y el pedido no llegó a
   la cola de producción. No estaba roto: el flujo son DOS pasos a propósito.

     pendiente  --[Aceptar]-->  aceptado  --[Iniciar producción]-->  en_produccion

   El primer paso crea la orden pero manda lanzarProduccion:false, porque
   arrancar exige dos cosas que viven en el segundo: validar que haya materia
   prima suficiente, y aceptar el NDA (el server rechaza lanzarProduccion:true
   sin ndaAceptado para quien no es admin). El diseño está bien; la ETIQUETA
   prometía los dos pasos y solo daba uno.

   Lo que fija esta prueba no es el texto por el texto, sino el CONTRATO entre
   lo que el botón dice y lo que su handler hace.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FUENTE = fs.readFileSync(
  path.join(process.cwd(), 'src/pages/pedidos/PedidosPage.jsx'), 'utf8');

/* El cuerpo de una función `const nombre = async (p) => { … }` hasta el cierre
   que está al mismo nivel de indentación. Suficiente para ver qué manda. */
function cuerpoDe(nombre) {
  const i = FUENTE.indexOf(`const ${nombre} = async (p) => {`);
  expect(i, `no se encontró ${nombre}`).toBeGreaterThan(-1);
  const fin = FUENTE.indexOf('\n  };', i);
  return FUENTE.slice(i, fin > -1 ? fin : i + 3000);
}

describe('aceptar un pedido no es producirlo', () => {
  it('handleAceptar NO lanza producción (crea la orden y para ahí)', () => {
    expect(cuerpoDe('handleAceptar')).toContain('lanzarProduccion: false');
  });

  it('handleIniciarProduccion SÍ la lanza, y valida stock de MP antes', () => {
    const c = cuerpoDe('handleIniciarProduccion');
    expect(c).toContain('api.validarStock');
    /* El lanzamiento real ocurre tras el NDA, fuera del cuerpo corto: se
       verifica sobre el archivo completo que exista con ndaAceptado. */
    expect(FUENTE).toContain('lanzarProduccion: true, ndaAceptado: true');
  });

  it('el botón de aceptar NO promete producir', () => {
    /* Decía "Aceptar y producir". Que la etiqueta prometa el segundo paso es
       exactamente lo que hizo al dueño buscar el pedido en la cola. */
    const i = FUENTE.indexOf('data-id="pedidos.btn.aceptar-producir"');
    expect(i).toBeGreaterThan(-1);
    const bloque = FUENTE.slice(i, i + 1200);
    const etiqueta = bloque.match(/\{Icon\.check\} ([^<]+)</);
    expect(etiqueta, 'no se encontró la etiqueta del botón').not.toBeNull();
    expect(etiqueta[1].toLowerCase()).not.toMatch(/produc/);
  });

  it('y dice en su title cuál es el paso que falta', () => {
    const i = FUENTE.indexOf('data-id="pedidos.btn.aceptar-producir"');
    const bloque = FUENTE.slice(i, i + 1200);
    expect(bloque).toMatch(/title="[^"]*Iniciar producción[^"]*"/);
  });

  it('los dos botones siguen apareciendo en el estado que les toca', () => {
    expect(FUENTE).toMatch(/mostrarAceptar\s*=\s*tabOperable && p\.estado === 'pendiente'/);
    expect(FUENTE).toMatch(/mostrarIniciar\s*=\s*tabOperable && p\.estado === 'aceptado'/);
  });
});
