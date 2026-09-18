/* ════════════════════════════════════════════════════════════════════════════
   El QR de las etiquetas lo dibuja EL BACKEND (18-sep-2026).

   Pedido del dueño: "ahora haz que el frontend también use ese QR". Había dos
   implementaciones del mismo estándar en el mismo ERP —la de lib/qr en el
   backend y la librería `qrcode` aquí—; ahora manda la del backend y la local
   queda de respaldo, porque una etiqueta que no sale es peor que la misma
   etiqueta dibujada por el otro generador.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const qrImagen = vi.fn();
vi.mock('../services/api', () => ({ default: { qrImagen: (...a) => qrImagen(...a) } }));
vi.mock('../hooks/useBodyScrollLock', () => ({ default: () => {} }));

import useQrSrc from '../hooks/useQrSrc';
import { SubloteQRPrintModal } from '../pages/stock-fabrica/StockFabricaPage';

const DEL_BACKEND = 'data:image/svg+xml;utf8,%3Csvg%20del-backend%3E';
/* Un código distinto por prueba: el hook guarda en caché por texto, y la caché
   vive en el módulo (que es justo lo que se quiere en producción). */
let n = 0;
const codigo = () => `LP-20260630-001-A-h${n++}`;

describe('useQrSrc', () => {
  beforeEach(() => qrImagen.mockReset());

  it('usa el dibujo del backend en cuanto llega', async () => {
    qrImagen.mockResolvedValue({ ok: true, dataUri: DEL_BACKEND });
    const texto = 'https://pinturaselperico.com/QR/' + codigo();
    const { result } = renderHook(() => useQrSrc(texto));
    /* Antes de la respuesta ya hay QR: el local. La vista previa nunca sale vacía. */
    expect(result.current).toMatch(/^data:image\/svg\+xml/);
    await waitFor(() => expect(result.current).toBe(DEL_BACKEND));
    expect(qrImagen).toHaveBeenCalledWith(texto);
  });

  it('si el backend no da un dibujo utilizable, la etiqueta sale con el local', async () => {
    /* Cubre las dos formas de que no haya dibujo del servidor: que conteste un
       error y que no conteste nada aprovechable. La tercera —que la llamada
       reviente— la cubre de hecho el resto de la suite: los demás tests de esta
       pantalla simulan `api` sin el método, así que llamarlo lanza un
       TypeError que este mismo hook atrapa, y sus etiquetas siguen saliendo.
       (No se simula aquí un mock que reviente: el corredor de pruebas invoca
       los mocks por su cuenta y marcaría el test como fallido aunque el hook lo
       atrape — el fallo sería del andamio, no del código.) */
    for (const respuesta of [{ ok: false, error: 'lo que sea' }, undefined, {}]) {
      qrImagen.mockResolvedValue(respuesta);
      const texto = 'https://pinturaselperico.com/QR/' + codigo();
      const { result } = renderHook(() => useQrSrc(texto));
      await new Promise((r) => setTimeout(r, 20));
      /* Sigue habiendo QR: el local, que codifica el MISMO texto. Una etiqueta
         que no sale es peor que la misma etiqueta dibujada por el otro motor. */
      expect(result.current).toMatch(/^data:image\/svg\+xml/);
      expect(result.current).not.toBe(DEL_BACKEND);
    }
  });

  it('no se lo vuelve a pedir: el mismo texto da siempre el mismo dibujo', async () => {
    qrImagen.mockResolvedValue({ ok: true, dataUri: DEL_BACKEND });
    const texto = 'https://pinturaselperico.com/QR/' + codigo();
    const a = renderHook(() => useQrSrc(texto));
    await waitFor(() => expect(a.result.current).toBe(DEL_BACKEND));
    const b = renderHook(() => useQrSrc(texto));
    expect(b.result.current).toBe(DEL_BACKEND);
    expect(qrImagen).toHaveBeenCalledTimes(1);
  });
});

describe('la etiqueta que se imprime lleva ese QR', () => {
  beforeEach(() => qrImagen.mockReset());

  it('el sublote imprime con el dibujo del backend', async () => {
    qrImagen.mockResolvedValue({ ok: true, dataUri: DEL_BACKEND });
    const write = vi.fn();
    window.open = vi.fn(() => ({ document: { write, close: vi.fn() } }));
    const cod = codigo();
    render(<SubloteQRPrintModal payload={{
      sublotes: [{ cod, tipo: 'cubeta', qty: 4, lit: 76, envasadoPor: 'Apolo' }],
      lote: { producto: 'BLANCO SGLOSS V3' }, isTote: false, q: 4, tipo: 'cubeta', litTotal: 76,
    }} onClose={() => {}} />);
    await waitFor(() => expect(qrImagen).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /Imprimir/i }));
    const html = write.mock.calls.map(c => c[0]).join('');
    expect(html).toContain(DEL_BACKEND);
    /* Y el documento sale con los arreglos de impresión, no con los viejos. */
    expect(html).toContain('.pag + .pag { break-before: page; page-break-before: always; }');
    expect(html).not.toMatch(/:last-child/);
  });
});
