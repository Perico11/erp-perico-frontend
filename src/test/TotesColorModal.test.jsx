/* TotesColorModal + etiqueta de tote SIN QR (10-ago-2026).
   Reglas del dueño: cada tote con su folio (base del color + nº), etiqueta sin
   QR (folio en grande + color), y por tote las acciones reimprimir /
   transferir al otro almacén / eliminar (baja confirmada). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/api', () => ({
  default: {
    transferirToteAmericano: vi.fn(() => Promise.resolve({ ok: true })),
    eliminarToteAmericano: vi.fn(() => Promise.resolve({ ok: true, litros: 1000 })),
  },
}));
vi.mock('../hooks/useBodyScrollLock', () => ({ default: () => {} }));

import api from '../services/api';
import TotesColorModal from '../pages/stk-americano/TotesColorModal';
import { etiquetaToteHtml, etiquetaToteCss, codFontPtTote } from '../lib/etiquetaLote';

const F50x25 = { wMm: 50, hMm: 25 };
const COLOR = {
  key: 'BEST BEIGE', nombre: 'Best Beige',
  totes: [
    { codigoLote: 'USA2-0001-02', litros: 1000, litrosOriginal: 1000, fecha: '2026-07-18T11:00:00.000Z' },
    { codigoLote: 'USA2-0001-01', litros: 411.45, litrosOriginal: 1000, fecha: '2026-07-18T10:00:00.000Z', loteProveedor: 'BB-4471-A', tandas: 2 },
  ],
};

describe('etiqueta de tote (sin QR)', () => {
  it('lleva banda TOTE + color y el folio en grande — sin imagen alguna', () => {
    const h = etiquetaToteHtml({ producto: 'Best Beige', codigo: 'USA2-0001-01', fmt: F50x25 });
    expect(h).toContain('>TOTE<');
    expect(h).toContain('Best Beige');
    expect(h).toContain('USA2-0001-01');
    expect(h).not.toContain('<img');
  });

  it('el folio SIN QR sale más grande que en la etiqueta con QR (usa todo el ancho)', () => {
    expect(codFontPtTote('USA2-0001-01', F50x25)).toBeGreaterThan(13);
  });

  it('un folio largo baja de punto hasta caber entero, nunca por debajo del piso', () => {
    const corto = codFontPtTote('USA-0001-01', F50x25);
    const largo = codFontPtTote('USA2-20260718-071', F50x25);
    expect(largo).toBeLessThan(corto);
    expect(largo).toBeGreaterThanOrEqual(8);
  });

  it('escapa HTML en el nombre del color', () => {
    expect(etiquetaToteHtml({ producto: '<script>x</script>', codigo: 'USA-0001-01', fmt: F50x25 })).not.toContain('<script>');
  });

  it('el CSS no depende de fondos (la térmica no los imprime): separa con bordes', () => {
    const css = etiquetaToteCss(F50x25, '.label');
    expect(css).toContain('border-bottom');
    expect(css).not.toMatch(/background(-color)?\s*:/);
  });
});

describe('TotesColorModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista los totes en FEFO (el más viejo primero) con litros y acciones', () => {
    render(<TotesColorModal color={COLOR} almacen="2" onClose={() => {}} onChanged={() => {}} />);
    const filas = screen.getAllByText(/USA2-0001-\d\d/).map(e => e.textContent);
    expect(filas).toEqual(['USA2-0001-01', 'USA2-0001-02']);
    expect(screen.getByText(/lote fabricante BB-4471-A/)).toBeInTheDocument();
    expect(screen.getByText(/2 tandas envasadas \(la próxima es -03\)/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reimprimir etiqueta' })).toHaveLength(2);
  });

  it('en Almacén 2 la transferencia ofrece Americano 1, y manda EL tote elegido', async () => {
    const onChanged = vi.fn();
    render(<TotesColorModal color={COLOR} almacen="2" onClose={() => {}} onChanged={onChanged} />);
    await userEvent.click(screen.getAllByRole('button', { name: /Transferir a Americano 1/ })[0]);
    /* confirmación explícita antes de mover la pieza */
    await userEvent.click(await screen.findByRole('button', { name: 'Transferir' }));
    await waitFor(() => expect(api.transferirToteAmericano).toHaveBeenCalledWith({
      de: '2', a: '1', key: 'BEST BEIGE', nombre: 'Best Beige', codigoLote: 'USA2-0001-01',
    }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('eliminar exige motivo y va con confirmar:true', async () => {
    render(<TotesColorModal color={COLOR} almacen="2" onClose={() => {}} onChanged={() => {}} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    const dlg = await screen.findByPlaceholderText(/error|existe/i);
    await userEvent.type(dlg, 'doble captura');
    await userEvent.click(await screen.findByRole('button', { name: 'Dar de baja' }));
    await waitFor(() => expect(api.eliminarToteAmericano).toHaveBeenCalledWith(expect.objectContaining({
      almacen: '2', codigoLote: 'USA2-0001-01', confirmar: true, nota: 'doble captura',
    })));
  });
});
