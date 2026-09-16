/* ════════════════════════════════════════════════════════════════════════════
   HALLAZGOS P1 DE LA AUDITORÍA DEL 15-sep-2026 QUE VIVEN EN EL FRONTEND.

   BT-01 · El registro de calidad se enviaba dentro de un try con el catch
        VACÍO, y la línea siguiente anunciaba "QC aprobado" igual. Si esa
        llamada fallaba —sin señal, sesión vencida, error del servidor— el lote
        avanzaba a envasado sin su viscosidad ni su pH y nadie se enteraba. Para
        una fábrica con trazabilidad por lote es un hueco: el producto sale a la
        calle sin el dato que respalda que se aprobó.

   RV-4 y RV-7 · El espejo de la máquina de estados tenía que moverse con el
        backend: cancelar un lote aprobado por calidad, y que anular todas las
        piezas archive el lote como cancelado y no como entregado al cliente.

   ROL-A-02 · El técnico puede mandar a recolección SOLO en una orden interna
        con destino Terán. La condición depende del pedido, así que el espejo la
        aplica únicamente si el llamador le pasa ese contexto; sin contexto
        responde lo conservador, que es como se comportaba hasta hoy.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/* Vitest corre con la raíz del proyecto como cwd. */
const leer = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
import {
  TRANSICIONES_LOTE, TRANSICIONES_SUBLOTE,
  getAccionesLote, getAccionesSublote, calcularEstadoLote,
} from '../lib/loteTransiciones';

const loteCon = (...estados) => ({
  id: 'L1', estado: 'envasado',
  sublotes: estados.map((estado, i) => ({ cod: 'L1-' + i, estado, lit: 19 })),
});

describe('RV-4 — un lote aprobado por calidad se puede cancelar', () => {
  it('qc_aprobado está entre los estados desde los que se cancela', () => {
    expect(TRANSICIONES_LOTE.cancelarLote.desde).toContain('qc_aprobado');
  });

  it('la pantalla ofrece el botón a admin', () => {
    expect(getAccionesLote({ estado: 'qc_aprobado' }, 'admin')).toContain('cancelarLote');
  });

  it('sigue siendo solo de admin', () => {
    expect(getAccionesLote({ estado: 'qc_aprobado' }, 'tecnico')).not.toContain('cancelarLote');
  });

  it('desde envasado no se ofrece: ahí se anulan las piezas una a una', () => {
    expect(getAccionesLote({ estado: 'envasado' }, 'admin')).not.toContain('cancelarLote');
  });
});

describe('RV-7 — anular todas las piezas no es entregar al cliente', () => {
  it('todas anuladas deja el lote cancelado', () => {
    expect(calcularEstadoLote(loteCon('cancelado', 'cancelado'))).toBe('cancelado');
  });

  it('si queda una pieza viva el lote sí es entregado', () => {
    expect(calcularEstadoLote(loteCon('cancelado', 'en_stock_teran'))).toBe('entregado');
    expect(calcularEstadoLote(loteCon('cancelado', 'entregado_tienda'))).toBe('entregado');
  });
});

describe('ROL-A-02 — el técnico solo despacha la orden interna a Terán', () => {
  const sub = { cod: 'L1-A', estado: 'envasado', lit: 19 };

  it('con destino Terán sí se le ofrece', () => {
    expect(getAccionesSublote(sub, 'tecnico', { pedidoDestino: 'teran' })).toContain('marcarRecoleccion');
  });

  it('en un pedido normal no', () => {
    expect(getAccionesSublote(sub, 'tecnico', { pedidoDestino: 'cliente' })).not.toContain('marcarRecoleccion');
  });

  it('sin contexto tampoco: no se pinta un botón que el servidor va a rechazar', () => {
    expect(getAccionesSublote(sub, 'tecnico')).not.toContain('marcarRecoleccion');
  });

  it('almacén y admin siguen igual, con o sin contexto', () => {
    for (const rol of ['almacen', 'admin']) {
      expect(getAccionesSublote(sub, rol)).toContain('marcarRecoleccion');
      expect(getAccionesSublote(sub, rol, { pedidoDestino: 'cliente' })).toContain('marcarRecoleccion');
    }
  });

  it('el espejo declara al técnico, como el backend', () => {
    expect(TRANSICIONES_SUBLOTE.marcarRecoleccion.roles).toContain('tecnico');
  });
});

describe('BT-01 — un fallo al guardar el registro de calidad no se calla', () => {
  it('el catch del registro de calidad ya no está vacío', () => {
    /* Se lee el fuente: montar QCInline exigiría media pantalla de contexto, y
       lo que se quiere fijar es que el error NO se descarte y que el aviso
       llegue al mensaje de éxito. */
    const src = leer('src/components/PedidoLoteActions.jsx');

    const iQC = src.indexOf('api.registrarQC');
    expect(iQC).toBeGreaterThan(0);
    const bloque = src.slice(iQC, iQC + 1400);

    expect(bloque).not.toMatch(/\}\s*catch\s*\{\s*\}/);
    expect(bloque).toMatch(/catch\s*\(\s*eLedger\s*\)/);
    expect(bloque).toMatch(/avisoLedger/);
    /* el aviso viaja en el mensaje que ve el usuario */
    expect(bloque).toMatch(/onSuccess\([^)]*avisoLedger/);
  });
});

describe('RV-8 — destrabar un lote atorado tiene botón', () => {
  it('el cliente de API expone la llamada', () => {
    const src = leer('src/services/api.js');
    expect(src).toMatch(/forzarTransicionLote/);
    expect(src).toMatch(/\/api\/lotes\/forzar-transicion/);
  });

  it('la pantalla de trazabilidad monta el modal y solo se lo da a admin', () => {
    const src = leer('src/pages/trazabilidad/TrazabilidadPage.jsx');
    expect(src).toMatch(/ForzarEstadoModal/);
    /* el botón solo se pinta si el llamador pasa onForzar, y eso es esAdmin */
    expect(src).toMatch(/onForzar=\{esAdmin \? setForzarLote : undefined\}/);
    /* el motivo es obligatorio: el servidor exige 20 caracteres */
    expect(src).toMatch(/MOTIVO_MIN\s*=\s*20/);
  });
});
