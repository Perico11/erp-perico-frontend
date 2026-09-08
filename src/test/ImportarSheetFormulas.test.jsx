/* ════════════════════════════════════════════════════════════════════════════
   Importar la Google Sheet de fórmulas desde la pantalla (4-sep-2026, pedido
   dueño: "conéctala al ERP").

   La modal enseña el PLAN del servidor antes de escribir: cambios con sus
   kg, bloqueos que apagan el APLICAR (salvo "omitir"), y el resultado con
   respaldo. Anclas de cableado: el botón vive en la pantalla (solo admin) y
   api manda el libro al endpoint nuevo.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../hooks/useBodyScrollLock', () => ({ default: () => {} }));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));
vi.mock('../services/api', () => ({
  default: { importarFormulasXlsx: vi.fn(), exportarFormulasXlsx: vi.fn() },
}));

import api from '../services/api';
import { ImportarSheetModal } from '../pages/formulas/FormulasPage';

const PLAN = {
  cambios: [{
    nombre: 'PROCAUCHO 4.0', hoja: 'PROCAUCHO 4.0',
    modificados: [{ mp: 'AGUA', antes: 6, despues: 7, deltaPct: 16.7 }],
    agregados: [], quitados: [{ mp: 'OMYACARB 10-SJ', kg19: 2 }],
    pesoAntes: 13, pesoDespues: 12,
  }],
  altas: [], sinCambio: ['NEGRO MATE 4.0'], renombres: [], avisos: [],
  bloqueos: [], mpNuevas: [], enErpFueraDelLibro: ['ASTRA-LAST'],
  erroresDeLectura: [], tolerancia: 0.001,
};

const subirArchivo = async () => {
  const input = document.querySelector('[data-id="formulas.importar.archivo"]');
  const file = new File(['PK-finge-ser-xlsx'], 'Formulas Perico.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
};

beforeEach(() => vi.clearAllMocks());

describe('ImportarSheetModal', () => {
  it('subir el libro pide el plan (dry-run) y lo enseña con sus kg', async () => {
    api.importarFormulasXlsx.mockResolvedValue({ ok: true, data: { aplicado: false, plan: PLAN } });
    await act(async () => { render(<ImportarSheetModal onClose={() => {}} onSuccess={() => {}} />); });
    await subirArchivo();

    await screen.findByText(/cambian 1/);
    /* dry-run: sin 'APLICAR' en la llamada */
    expect(api.importarFormulasXlsx).toHaveBeenCalledTimes(1);
    expect(api.importarFormulasXlsx.mock.calls[0][1]).toBeUndefined();

    const plan = document.querySelector('[data-id="formulas.importar.plan"]');
    expect(plan.textContent).toContain('~ AGUA: 6 → 7 kg');
    expect(plan.textContent).toContain('− OMYACARB 10-SJ: llevaba 2 kg');
    expect(plan.textContent).toContain('1 fórmula(s) del ERP no vienen en el libro');

    const btn = document.querySelector('[data-id="formulas.importar.aplicar"]');
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain('APLICAR (1)');
  });

  it('con bloqueos el APLICAR se apaga; "omitir bloqueadas" lo enciende', async () => {
    api.importarFormulasXlsx.mockResolvedValue({
      ok: true,
      data: { aplicado: false, plan: { ...PLAN, bloqueos: [{ nombre: 'X', motivo: 'usa materia prima que el maestro no tiene: "MP FANTASMA"' }], mpNuevas: [{ mp: 'MP FANTASMA', formulas: ['X'] }] } },
    });
    await act(async () => { render(<ImportarSheetModal onClose={() => {}} onSuccess={() => {}} />); });
    await subirArchivo();
    await screen.findByText(/MP FANTASMA/);

    const btn = document.querySelector('[data-id="formulas.importar.aplicar"]');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Hay bloqueos');

    await act(async () => {
      fireEvent.click(document.querySelector('[data-id="formulas.importar.omitir"]'));
    });
    expect(document.querySelector('[data-id="formulas.importar.aplicar"]').disabled).toBe(false);
  });

  it('APLICAR confirma, manda APLICAR con todas sus letras y enseña respaldo', async () => {
    const onSuccess = vi.fn();
    api.importarFormulasXlsx
      .mockResolvedValueOnce({ ok: true, data: { aplicado: false, plan: PLAN } })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          aplicado: true, plan: PLAN, formulasEscritas: ['PROCAUCHO 4.0'], mpsResincronizadas: 2,
          backupDir: '/var/www/erp-perico/backups/importar-xlsx-2026', propagar: { corrido: true, ok: true, detalle: '' },
        },
      });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => { render(<ImportarSheetModal onClose={() => {}} onSuccess={onSuccess} />); });
    await subirArchivo();
    await screen.findByText(/cambian 1/);
    await act(async () => {
      fireEvent.click(document.querySelector('[data-id="formulas.importar.aplicar"]'));
    });

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(document.querySelector('[data-id="formulas.importar.resultado"]')).not.toBeNull();
    });
    expect(api.importarFormulasXlsx.mock.calls[1][1]).toBe('APLICAR');

    const res = document.querySelector('[data-id="formulas.importar.resultado"]');
    expect(res.textContent).toContain('1 fórmula(s) escritas');
    expect(res.textContent).toContain('backups/importar-xlsx-2026');
    expect(res.textContent).toContain('recalculadas');

    await act(async () => { fireEvent.click(screen.getByText('Listo')); });
    expect(onSuccess).toHaveBeenCalledWith('1 fórmula(s) importadas de la Sheet');
    confirmSpy.mockRestore();
  });
});

describe('la ida del ciclo: Exportar el ERP → .xlsx', () => {
  it('baja el libro fresco y enseña cómo REEMPLAZAR la Sheet', async () => {
    /* jsdom no trae createObjectURL: se suplanta para la descarga programática */
    URL.createObjectURL = vi.fn(() => 'blob:libro');
    URL.revokeObjectURL = vi.fn();
    api.exportarFormulasXlsx.mockResolvedValue({
      ok: true,
      data: { xlsxBase64: btoa('PK-libro-fresco'), nombreArchivo: 'Formulas Perico — ERP 2026-09-04.xlsx', numFormulas: 69 },
    });

    await act(async () => { render(<ImportarSheetModal onClose={() => {}} onSuccess={() => {}} />); });
    await act(async () => {
      fireEvent.click(document.querySelector('[data-id="formulas.importar.exportar"]'));
    });

    expect(api.exportarFormulasXlsx).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const hint = document.querySelector('[data-id="formulas.importar.export-hint"]');
    expect(hint.textContent).toContain('REEMPLAZAR hoja de cálculo');
  });
});

describe('cableado en la página y en api', () => {
  const PAGE = fs.readFileSync(path.join(process.cwd(), 'src/pages/formulas/FormulasPage.jsx'), 'utf8');
  const API = fs.readFileSync(path.join(process.cwd(), 'src/services/api.js'), 'utf8');

  it('el botón vive en la pantalla (solo admin) y abre la modal', () => {
    expect(PAGE).toContain('data-id="formulas.btn.importar-sheet"');
    expect(PAGE).toMatch(/\{importar && \(\s*<ImportarSheetModal/);
  });

  it('api manda el libro al endpoint nuevo y solo escribe con APLICAR', () => {
    expect(API).toMatch(/request\('POST', '\/api\/formulas\/importar-xlsx'/);
    expect(API).toMatch(/\.\.\.\(aplicar \? \{ aplicar \} : \{\}\)/);
  });

  it('la exportación pega al GET del libro fresco', () => {
    expect(API).toMatch(/exportarFormulasXlsx: \(\) => request\('GET', '\/api\/formulas\/exportar-xlsx'\)/);
    expect(PAGE).toContain('data-id="formulas.importar.exportar"');
  });
});
