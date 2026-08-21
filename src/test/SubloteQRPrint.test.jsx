/* SubloteQRPrintModal — la etiqueta que MÁS se imprime (una por cubeta).
   Se quedó fuera de la unificación del 5-ago y siguió saliendo con el layout
   viejo (producto / "Cubeta" / código chico) mientras el lote y los totes ya
   imprimían el diseño nuevo. Este test ancla que la etiqueta del sublote sale
   de lib/etiquetaLote como todas las demás. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/api', () => ({ default: {} }));
vi.mock('../hooks/useBodyScrollLock', () => ({ default: () => {} }));

import { SubloteQRPrintModal } from '../pages/stock-fabrica/StockFabricaPage';

const PAYLOAD = {
  sublotes: [{
    cod: 'LP-20260630-001-A-hI', tipo: 'cubeta', env: '19L Estándar',
    marca: 'Astra Cover', qty: 17, lit: 323, envasadoPor: 'Marcos R.',
  }],
  lote: { producto: 'B. NEGRO SATIN 4.0' },
  isTote: false, q: 17, tipo: 'cubeta', litTotal: 323,
};

/* Captura el HTML que se manda a la ventana de impresión. */
function capturarImpresion() {
  const write = vi.fn();
  window.open = vi.fn(() => ({ document: { write, close: vi.fn() } }));
  return () => write.mock.calls.map(c => c[0]).join('');
}

describe('SubloteQRPrintModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('la vista previa muestra la banda y el envasador, no el layout viejo', () => {
    render(<SubloteQRPrintModal payload={PAYLOAD} onClose={() => {}} />);
    expect(screen.getByText('CBT')).toBeInTheDocument();
    expect(screen.getByText('B. NEGRO SATIN 4.0')).toBeInTheDocument();
    expect(screen.getByText('Marcos R.')).toBeInTheDocument();
    expect(screen.getByText('LP-20260630-001-A-hI')).toBeInTheDocument();
  });

  it('imprime el diseño único (banda + folio + envasador) en rollo térmico', async () => {
    const html = capturarImpresion();
    render(<SubloteQRPrintModal payload={PAYLOAD} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Imprimir \d+ ticket/ }));
    const out = html();
    expect(out).toContain('eb-pres');
    expect(out).toContain('>CBT<');
    expect(out).toContain('Envasó: <b>Marcos R.</b>');
    expect(out).toContain('LP-20260630-001-A-hI');
    /* Layout viejo, el de la foto del 6-ago: producto / "Cubeta" / código chico. */
    expect(out).not.toContain('class="prod"');
    expect(out).not.toContain('>19L Estándar<');
  });

  it('la presentación sale del TIPO, nunca de `env` (19L Estándar es una cubeta)', async () => {
    const html = capturarImpresion();
    render(<SubloteQRPrintModal payload={PAYLOAD} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Imprimir \d+ ticket/ }));
    expect(html()).not.toContain('>LT<');
  });

  it('el tote lleva TOTE y sus litros; la cubeta no lleva litros (van por pieza)', async () => {
    const htmlTote = capturarImpresion();
    const { unmount } = render(<SubloteQRPrintModal
      payload={{ ...PAYLOAD, isTote: true, litTotal: 1000, sublotes: [{ ...PAYLOAD.sublotes[0], tipo: 'tote' }] }}
      onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Imprimir \d+ ticket/ }));
    expect(htmlTote()).toContain('>TOTE<');
    expect(htmlTote()).toContain('1,000 L');
    unmount();

    const htmlCub = capturarImpresion();
    render(<SubloteQRPrintModal payload={PAYLOAD} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /Imprimir \d+ ticket/ }));
    expect(htmlCub()).not.toContain('323 L');
  });
});
