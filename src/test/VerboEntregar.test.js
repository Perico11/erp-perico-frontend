/* ════════════════════════════════════════════════════════════════════════════
   F5 — Una sola palabra para "entregar" (14-sep-2026, paquete "Ahora" de la
   auditoría de flujos). Tres maneras terminan en ENTREGADO: la entrega REAL
   desde Terán (descuenta inventario), el cierre de ETIQUETA ("Ya se entregó")
   y el cierre AUTOMÁTICO al recibir una OT. Lo que fijan estas pruebas:

     · Cada superficie dice CUÁL de las tres es, con el mismo vocabulario.
     · Un pedido EN PROCESO muestra el porqué ANTES: botón bloqueado + razón
       visible, en vez de desaparecer el botón y dejar el rechazo del server
       como única explicación.

   Mismo estilo fuente-como-contrato que PedidoYaEntregado.test.js: F5 es
   texto y orden, no lógica — el contrato es lo que el operador LEE.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const leer = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const PEDIDOS = leer('src/pages/pedidos/PedidosPage.jsx');
const ENTREGAS = leer('src/pages/entregas/EntregasPage.jsx');

describe('F5 — el porqué ANTES: pedido en proceso no se cierra a mano', () => {
  it('el botón bloqueado existe, deshabilitado, solo para en_proceso en la pestaña operable', () => {
    expect(PEDIDOS).toContain('data-id="pedidos.btn.ya-entregado-bloqueado"');
    expect(PEDIDOS).toMatch(/explicarNoCierreEnProceso = tabOperable && !p\._esOrdenInterna\s*&& normEstado\(p\.estado\) === 'en_proceso'/);
    expect(PEDIDOS).toMatch(/pedidos\.btn\.ya-entregado-bloqueado"[\s\S]{0,220}disabled/);
  });

  it('la razón se lee en la card, no en el rechazo del server', () => {
    expect(PEDIDOS).toContain('parte del lote sigue en Fábrica, por eso no se puede cerrar a mano');
    expect(PEDIDOS).toContain('Se cierra solo cuando lo que falta se recibe en Terán');
  });

  it('cuenta como acción para que la fila no se pinte vacía', () => {
    expect(PEDIDOS).toMatch(/const tieneAcciones = [^;]*explicarNoCierreEnProceso/);
  });
});

describe('F5 — mismo vocabulario en las tres variantes', () => {
  it('"Ya se entregó" se presenta como cierre de ETIQUETA y apunta a las otras dos', () => {
    expect(PEDIDOS).toMatch(/Cierre de ETIQUETA[\s\S]{0,160}sin tocar inventario/);
    expect(PEDIDOS).toMatch(/La entrega que SÍ descuenta vive en Entregas; una OT recibida cierra su pedido sola/);
  });

  it('Entregas se presenta como la entrega REAL y nombra a las otras dos', () => {
    expect(ENTREGAS).toContain('La <strong>entrega real</strong> ocurre aquí');
    expect(ENTREGAS).toMatch(/«Ya se entregó» de Pedidos[\s\S]{0,120}etiqueta/);
    expect(ENTREGAS).toContain('una OT recibida cierra');
  });
});
