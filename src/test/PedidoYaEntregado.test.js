/* ════════════════════════════════════════════════════════════════════════════
   "YA SE ENTREGÓ" — cierre manual de pedidos atorados (2-sep-2026, dueño).

   "En la página de pedidos de Josué y Enrique aparecen pedidos ya entregados
   y subidos al inventario de Terán y dados de baja del stock de Fábrica, pero
   siguen apareciendo. Deberíamos eliminarlos SIN que se sumen o resten."

   El hueco: una OT mueve los escalares pero no cierra el pedido → la card
   vive en Activos para siempre. El botón la manda a Historial como ENTREGADO
   vía /api/pedidos/marcar-entregado, que cambia SOLO la etiqueta.

   Estas pruebas fijan dónde vive el botón, a quién se le ofrece y qué
   promete (cero movimientos de inventario).
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const leer = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const PEDIDOS = leer('src/pages/pedidos/PedidosPage.jsx');
const API = leer('src/services/api.js');

describe('el botón "Ya se entregó"', () => {
  it('vive en la card de Pedidos y despacha el cierre manual', () => {
    expect(PEDIDOS).toContain('data-id="pedidos.btn.ya-entregado"');
    expect(PEDIDOS).toContain('Ya se entregó');
    expect(PEDIDOS).toMatch(/onClick=\{\(\) => handleMarcarEntregado\(p\)\}/);
  });

  it('solo en estados POR ENTREGAR (envasado→en_almacen) — antes de eso van Cancelar/Eliminar', () => {
    expect(PEDIDOS).toMatch(/mostrarMarcarEntregado\s*=\s*tabOperable && !p\._esOrdenInterna\s*&& esPedidoPorEntregar\(p\.estado\)/);
    /* La fuente única: el helper de lib/estados, no una lista local. */
    expect(PEDIDOS).toMatch(/import \{[\s\S]{0,400}esPedidoPorEntregar,[\s\S]{0,200}\} from '\.\.\/\.\.\/lib\/estados'/);
  });

  it('lo ven quienes operan el flujo: almacén (Josué), técnico (Enrique) y admin', () => {
    expect(PEDIDOS).toMatch(/mostrarMarcarEntregado[\s\S]{0,300}(esAdmin \|\| user\?\.rol === 'almacen' \|\| user\?\.rol === 'tecnico')/);
    expect(PEDIDOS).toContain('data-rol="almacen,tecnico,admin"');
  });

  it('cuenta como acción, para que la fila no se pinte vacía', () => {
    expect(PEDIDOS).toMatch(/const tieneAcciones = [^;]*mostrarMarcarEntregado/);
  });
});

describe('el contrato con el dueño: "sin que se sumen o resten"', () => {
  it('el confirm lo dice con todas sus letras antes de llamar al server', () => {
    expect(PEDIDOS).toMatch(/handleMarcarEntregado[\s\S]{0,600}No suma ni resta inventario/);
    expect(PEDIDOS).toMatch(/confirmText: 'Sí, ya se entregó'/);
  });

  it('llama al endpoint dedicado (no un upsert ciego que pise estados)', () => {
    expect(API).toMatch(/marcarPedidoEntregado: \(pedidoId\) =>\s*request\('POST', '\/api\/pedidos\/marcar-entregado', \{ pedidoId \}\)/);
    expect(PEDIDOS).toContain('api.marcarPedidoEntregado(p.id)');
  });

  it('al cerrar recarga pedidos Y órdenes (la orden vinculada también se cierra)', () => {
    expect(PEDIDOS).toMatch(/handleMarcarEntregado[\s\S]{0,900}reload\(\); reloadOrd\(\);/);
  });
});
