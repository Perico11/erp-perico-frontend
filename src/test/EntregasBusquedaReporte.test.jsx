/* ════════════════════════════════════════════════════════════════════════════
   Entregas: barra de búsqueda + hoja de reporte (2-sep-2026, pedido dueño).

   Render de la hoja con fechas FIJADAS a mano (el default "últimos 30 días"
   depende del reloj; los tests no). Y anclas de cableado en la página: la
   búsqueda filtra con la fuente única y el fetch trae el historial completo.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../hooks/useBodyScrollLock', () => ({ default: () => {} }));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({ connected: false }) }));
vi.mock('../services/api', () => ({
  default: {
    getUsuarios: vi.fn(() => Promise.resolve({ ok: true, data: [] })),
    getFirmantes: vi.fn(() => Promise.resolve({ ok: true, data: {} })),
  },
}));

import { ReporteEnviosSheet } from '../pages/entregas/EntregasPage';

const ENTREGAS = [
  {
    id: '1', folio: 'ENT-001', tienda: 'Terán Centro', usuario: 'Josué', fecha: '2026-08-10T12:00:00.000Z',
    lineas: [
      { fuente: 'pt', producto: 'PROCAUCHO 5X1', presentacion: 'cubeta', cantidad: 10 },
      { fuente: 'americano', almacen: '1', producto: 'Best Beige', presentacion: 'galon', cantidad: 4 },
    ],
  },
  {
    id: '2', folio: 'ENT-002', tienda: 'PALACO', usuario: 'Josué', fecha: '2026-08-20T12:00:00.000Z',
    lineas: [
      { fuente: 'pt', producto: 'PROCAUCHO 5X1', presentacion: 'cubeta', cantidad: 5 },
      { fuente: 'pt', producto: 'PROCAUCHO 5X1', presentacion: 'galon', cantidad: 8 },
    ],
  },
];

const setVal = (dataId, value) => {
  fireEvent.change(document.querySelector(`[data-id="${dataId}"]`), { target: { value } });
};

describe('ReporteEnviosSheet', () => {
  it('el caso del dueño: PROCAUCHO en un rango → total, tiendas y detalle', async () => {
    await act(async () => {
      render(<ReporteEnviosSheet isDesktop entregas={ENTREGAS} onClose={() => {}} />);
    });
    await act(async () => {
      setVal('entregas.reporte.desde', '2026-08-01');
      setVal('entregas.reporte.hasta', '2026-08-31');
      setVal('entregas.reporte.producto', 'procaucho');
    });

    const total = document.querySelector('[data-id="entregas.reporte.total"]');
    expect(total.textContent).toContain('15 cubetas');
    expect(total.textContent).toContain('8 galones');

    const filas = [...document.querySelectorAll('[data-id="entregas.reporte.fila-tienda"]')];
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain('PALACO');      /* 13 u. — la que más */
    expect(filas[1].textContent).toContain('Terán Centro');
    expect(screen.getByText('ENT-002')).toBeInTheDocument();
  });

  it('el rango manda: acotar a un solo día deja fuera lo demás', async () => {
    await act(async () => {
      render(<ReporteEnviosSheet isDesktop entregas={ENTREGAS} onClose={() => {}} />);
    });
    await act(async () => {
      setVal('entregas.reporte.desde', '2026-08-20');
      setVal('entregas.reporte.hasta', '2026-08-20');
      setVal('entregas.reporte.producto', 'procaucho');
    });
    const filas = [...document.querySelectorAll('[data-id="entregas.reporte.fila-tienda"]')];
    expect(filas).toHaveLength(1);
    expect(filas[0].textContent).toContain('PALACO');
    expect(screen.queryByText('ENT-001')).toBeNull();
  });
});

describe('cableado en la página', () => {
  const PAGE = fs.readFileSync(path.join(process.cwd(), 'src/pages/entregas/EntregasPage.jsx'), 'utf8');
  const API = fs.readFileSync(path.join(process.cwd(), 'src/services/api.js'), 'utf8');

  it('la búsqueda existe, filtra con la fuente única y la lista pinta lo filtrado', () => {
    expect(PAGE).toContain('data-id="entregas.input.buscar"');
    expect(PAGE).toMatch(/filtradas = useMemo\(\(\) => filtrarEntregas\(entregas, busca\)/);
    expect(PAGE).toMatch(/filtradas\.map\(e =>/);
  });

  it('el fetch trae el historial COMPLETO (todas=1) — sin eso el reporte miente', () => {
    expect(PAGE).toContain('api.getEntregas(true)');
    expect(API).toMatch(/getEntregas: \(todas\) =>\s*request\('GET', '\/api\/entregas' \+ \(todas \? '\?todas=1' : ''\)\)/);
  });

  it('el botón Reporte vive en la pantalla y abre la hoja', () => {
    expect(PAGE).toContain('data-id="entregas.btn.reporte"');
    expect(PAGE).toMatch(/\{reporte && <ReporteEnviosSheet/);
  });
});
