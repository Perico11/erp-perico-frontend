/* ════════════════════════════════════════════════════════════════════════════
   EL CÓDIGO MUERTO QUE ERA LA INTENCIÓN ORIGINAL (25-ago-2026).

   La cola de Producción solo listaba pedidos 'en_produccion'. Y sin embargo:
     · renderProdAction YA traía una rama `isAceptado` que pinta "Iniciar
       producción" para pedidos en estado 'aceptado';
     · handleStartProduccion YA sabía arrancar un pedido aceptado (upsert a
       en_produccion + cronómetro).
   Las dos eran INALCANZABLES: el filtro nunca dejaba llegar un aceptado hasta
   ahí. Quien escribió esas ramas quería que los aceptados se vieran; solo
   faltaba el filtro.

   Se notó por dos caminos distintos del dueño: fue a buscar a Producción un
   pedido que acababa de aceptar y no estaba, y después no encontró dónde
   corregirle la cantidad antes de arrancar.

   Al volver alcanzable esa ruta aparece algo que antes no importaba: arrancaba
   SIN validar stock de MP, cosa que Pedidos sí hacía. Mientras nadie podía
   llegar ahí daba igual; ahora no. Eso también se fija aquí.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FUENTE = fs.readFileSync(
  path.join(process.cwd(), 'src/pages/produccion/ProduccionPage.jsx'), 'utf8');

describe('los pedidos aceptados entran a la cola de Producción', () => {
  it('el filtro ya no exige en_produccion: también toma los aceptados', () => {
    expect(FUENTE).toMatch(/const esperando = pedidos\.filter\(p => p && p\.estado === 'aceptado'\)/);
    expect(FUENTE).toMatch(/const enCurso = pedidos\.filter\(p => p && p\.estado === 'en_produccion' && p\.fechaInicioProduccion\)/);
  });

  it('primero lo que corre, después la fila de espera', () => {
    /* Una cola se lee así; y el cronómetro de lo activo debe quedar arriba. */
    expect(FUENTE).toMatch(/return \[\.\.\.enCurso, \.\.\.esperando\]/);
  });

  it('la rama isAceptado deja de ser código muerto', () => {
    expect(FUENTE).toMatch(/isAceptado[\s\S]{0,120}'Iniciar producción'/);
  });
});

describe('arrancar desde Producción valida MP, igual que desde Pedidos', () => {
  it('existe un único arranque compartido por los dos caminos del NDA', () => {
    expect(FUENTE).toContain('const arrancarAceptado = useCallback');
    /* Con NDA y sin NDA llaman al mismo sitio: no dos copias que se separen. */
    const llamadas = FUENTE.match(/await arrancarAceptado\(it\)/g) || [];
    expect(llamadas.length).toBe(2);
  });

  it('valida stock ANTES de mover el pedido a en_produccion', () => {
    const i = FUENTE.indexOf('const arrancarAceptado = useCallback');
    const cuerpo = FUENTE.slice(i, i + 1800);
    const iValida = cuerpo.indexOf('api.validarStock');
    const iUpsert = cuerpo.indexOf('api.upsertPedido');
    expect(iValida).toBeGreaterThan(-1);
    expect(iUpsert).toBeGreaterThan(-1);
    expect(iValida).toBeLessThan(iUpsert);
  });

  it('pasa excluirPedido: el pedido no compite consigo mismo por su reserva', () => {
    /* Sin esto vuelve el "insuficiencia de titanio" con titanio de sobra. */
    expect(FUENTE).toMatch(/api\.validarStock\([^)]*,\s*undefined,\s*it\.id\)/);
  });

  it('si falta MP avisa y NO arranca', () => {
    const i = FUENTE.indexOf('const arrancarAceptado = useCallback');
    const cuerpo = FUENTE.slice(i, i + 1800);
    expect(cuerpo).toMatch(/v\.suficiente === false/);
    expect(cuerpo).toMatch(/Stock MP insuficiente/);
    /* El return corta antes del upsert. */
    const iReturn = cuerpo.indexOf('return;');
    expect(iReturn).toBeLessThan(cuerpo.indexOf('api.upsertPedido'));
  });

  it('si la validación falla por red NO bloquea el arranque', () => {
    /* Mismo criterio que PedidosPage: un endpoint caído no debe parar la planta. */
    const i = FUENTE.indexOf('const arrancarAceptado = useCallback');
    expect(FUENTE.slice(i, i + 1800)).toMatch(/catch \{ \/\* si la validación falla/);
  });
});
