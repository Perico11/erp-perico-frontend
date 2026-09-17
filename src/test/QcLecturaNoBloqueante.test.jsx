/* ════════════════════════════════════════════════════════════════════════════
   UNA TRANCA SOBRE UNA MEDICIÓN QUE VARÍA NO DA DATOS BUENOS: DA DATOS FALSOS

   Al meter el pH al checkpoint post-molienda apareció el problema de fondo. Un
   paso de QC deshabilita "Continuar" mientras una lectura esté fuera de rango,
   sin forma de saltarlo. Con un pH de 9.7 en el tanque, el operario se queda
   con el botón muerto y dos salidas: corregir el tanque, o TECLEAR UN NÚMERO
   DENTRO DE RANGO para poder seguir. La segunda es la que pasa cuando hay prisa
   en el piso — y entonces lo que queda guardado es mentira. Se cumple la forma
   y se pierde el dato, que era justo lo que el campo venía a rescatar. El dueño
   lo dijo sin rodeos: "la idea es que capture y podamos tener esa info".

   La salida no es dejar de revisar el rango, es separar las dos preguntas, que
   ya eran dos evaluaciones distintas en el código:

     qcEnRango     → ¿puede avanzar?           ahora ignora el rango de estos campos
     todosEnRango  → ¿el lote sale aprobado?   los sigue mirando igual

   Resultado: el operario SIEMPRE puede anotar la lectura real y avanzar, y un
   pH corrido deja el lote RETENIDO (qc_hold) para que calidad lo revise. La
   lectura obligatoria sigue siéndolo: vacío traba igual.

   La finura NO lleva la marca, a propósito: por debajo de 4 Hegman la respuesta
   correcta no es anotar y seguir, es regresar la mezcla al molino.

   Se comprueba montando el flujo de verdad y mirando el botón, no el fuente.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProduccionFlow from '../pages/produccion/ProduccionFlow';

vi.mock('../services/api', () => ({
  default: {
    getProduccionSteps: vi.fn(), getFormulas: vi.fn(), getMaestroMP: vi.fn(),
    getProduccionCheckpoint: vi.fn(), saveProduccionCheckpoint: vi.fn(),
    clearProduccionCheckpoint: vi.fn(), registrarProduccion: vi.fn(),
    crearLote: vi.fn(), transicionLote: vi.fn(),
    upsertOrden: vi.fn(), upsertPedido: vi.fn(),
  },
}));
import api from '../services/api';
vi.mock('../components/SecureView', () => ({ default: ({ children }) => <div>{children}</div> }));

/* El checkpoint post-molienda tal como lo manda el servidor: la finura traba,
   el pH no. Un solo paso para que el botón visible sea el de terminar. */
const STEPS = [{
  type: 'qc', titulo: 'Control de Calidad: Post-Molienda', qcEtapa: 'molienda',
  desc: 'Verifica la finura de molienda y el pH de la pasta.',
  accion: 'Anota el pH que marque el aparato.',
  pruebas: [
    { id: 'finura', lbl: 'Finura de Molienda', unidad: 'Hegman', equipo: 'Grindometro',
      rango: '4-8', min: 4, max: 8, tipo: 'number', step: 0.5 },
    { id: 'ph', lbl: 'pH', unidad: '', bloquea: false, equipo: 'pH-metro digital',
      rango: '7.5-9.5', min: 7.5, max: 9.5, tipo: 'number', step: 0.1 },
  ],
}];
const FORMULA = { 'BLANCO QA': { ingredientes: [{ nombre: 'TIO2', kg19: 1 }] } };
const ITEM = { id: 'ORD-1', _tipo: 'orden', codigo: 'OP-1', formula: 'BLANCO QA', cantidad: 1 };

const montar = () => render(
  <ProduccionFlow item={ITEM} userName="Enrique" onClose={() => {}} onSuccess={() => {}} />,
);
const botonTerminar = async () => await screen.findByRole('button', { name: /terminar lote/i });

/* Los inputs de QC van en el orden de `pruebas`. */
const capturar = async ({ finura, ph }) => {
  const inputs = await waitFor(() => {
    const n = document.querySelectorAll('input[type="number"]');
    if (n.length < 2) throw new Error(`esperaba 2 inputs de QC, hay ${n.length}`);
    return n;
  });
  if (finura !== undefined) fireEvent.change(inputs[0], { target: { value: String(finura) } });
  if (ph !== undefined) fireEvent.change(inputs[1], { target: { value: String(ph) } });
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getProduccionSteps.mockResolvedValue({ ok: true, steps: STEPS });
  api.getFormulas.mockResolvedValue({ formulas: FORMULA });
  api.getMaestroMP.mockResolvedValue({ mps: {} });
  api.getProduccionCheckpoint.mockResolvedValue(null);
  api.saveProduccionCheckpoint.mockResolvedValue({ ok: true });
  api.clearProduccionCheckpoint.mockResolvedValue({ ok: true });
  api.registrarProduccion.mockResolvedValue({ ok: true });
  api.crearLote.mockResolvedValue({ ok: true, lote: { id: 'L1', codigoLote: 'LP-0001-001', estado: 'producido' } });
  api.transicionLote.mockResolvedValue({ ok: true });
  api.upsertOrden.mockResolvedValue({ ok: true });
  api.upsertPedido.mockResolvedValue({ ok: true });
});

describe('el pH se puede anotar aunque salga fuera de rango', () => {
  it('con el pH corrido el botón SIGUE VIVO: nadie tiene que inventar un número', async () => {
    montar();
    await capturar({ finura: 6, ph: 9.7 });
    await waitFor(() => expect(botonTerminar()).resolves.toBeDefined());
    const btn = await botonTerminar();
    expect(btn.disabled).toBe(false);
  });

  it('y se le avisa de lo que va a pasar, con la lectura a la vista', async () => {
    montar();
    await capturar({ finura: 6, ph: 9.7 });
    const aviso = await screen.findByText(/fuera de rango/i);
    expect(aviso.textContent).toMatch(/9\.7/);
    expect(document.querySelector('[data-id="qc-fuera-sin-trabar"]').textContent)
      .toMatch(/retenido/i);
  });

  it('sin aviso cuando el pH está donde debe: no se pinta de más', async () => {
    montar();
    await capturar({ finura: 6, ph: 8.2 });
    await waitFor(() => expect(botonTerminar()).resolves.toBeDefined());
    expect(document.querySelector('[data-id="qc-fuera-sin-trabar"]')).toBeNull();
  });

  it('el pH sigue siendo OBLIGATORIO: vacío no deja avanzar', async () => {
    montar();
    await capturar({ finura: 6 });
    const btn = await botonTerminar();
    expect(btn.disabled).toBe(true);
  });
});

describe('la finura sigue trabando, que para eso está', () => {
  it('con la finura por debajo de 4 Hegman el botón NO deja avanzar', async () => {
    montar();
    await capturar({ finura: 2, ph: 8.2 });
    const btn = await botonTerminar();
    expect(btn.disabled).toBe(true);
  });

  it('y lo dice: la mezcla se regresa al molino, no se anota y se sigue', async () => {
    montar();
    await capturar({ finura: 2, ph: 8.2 });
    expect(await screen.findByText(/completa todas las mediciones dentro de rango/i)).toBeDefined();
  });
});

describe('el lote sale RETENIDO cuando el pH está corrido', () => {
  it('se cierra el lote y la transición pedida es rechazarQC, no aprobarQC', async () => {
    montar();
    await capturar({ finura: 6, ph: 9.7 });
    fireEvent.click(await botonTerminar());
    await waitFor(() => expect(api.transicionLote).toHaveBeenCalled());
    const [, accion, payload] = api.transicionLote.mock.calls[0];
    expect(accion).toBe('rechazarQC');
    expect(payload.qc.ph).toBe('9.7');
  });

  it('y sale APROBADO cuando las dos lecturas están en su sitio', async () => {
    montar();
    await capturar({ finura: 6, ph: 8.2 });
    fireEvent.click(await botonTerminar());
    await waitFor(() => expect(api.transicionLote).toHaveBeenCalled());
    const [, accion, payload] = api.transicionLote.mock.calls[0];
    expect(accion).toBe('aprobarQC');
    expect(payload.qc.ph).toBe('8.2');
  });
});
