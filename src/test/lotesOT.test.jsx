import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { desgloseLotesDeOT, etiquetaPiezasLote } from '../utils/lotesOT';
import LotesDeOT from '../pages/transferencias/LotesDeOT';

/* El caso del dueño: 30 cubetas de PROCAUCHO, el surtido tomó 20 del lote
   viejo (entero) y 10 del nuevo (partido con espejo -T). */
const SURTIDO = {
  fecha: 'F', usuario: 'Enrique', sinLote: 0,
  lotes: [
    { producto: 'PROCAUCHO TERRACOTA 4.0', codigoLote: 'LP-20260702-001', cubEq: 20, piezas: 20,
      sublotes: [{ cod: 'LP-20260702-001-A', tipo: 'cubeta', tote: false, piezas: 20, cubEq: 20 }] },
    { producto: 'PROCAUCHO TERRACOTA 4.0', codigoLote: 'LP-20260702-002', cubEq: 10, piezas: 10,
      sublotes: [{ cod: 'LP-20260702-002-A', espejoCod: 'LP-20260702-002-A-T15', tipo: 'cubeta', tote: false, piezas: 10, cubEq: 10 }] },
  ],
};

describe('etiquetaPiezasLote', () => {
  it('solo cubetas: sin el cub-eq redundante', () => {
    expect(etiquetaPiezasLote(SURTIDO.lotes[0])).toBe('20 cubetas');
  });
  it('tote: pieza + cubeta-equivalente', () => {
    expect(etiquetaPiezasLote({ cubEq: 52, sublotes: [{ tipo: 'tote', tote: true, piezas: 1, cubEq: 52 }] })).toBe('1 tote · 52 cub');
  });
  it('mezcla de medidas en un lote', () => {
    const l = { cubEq: 11.6, sublotes: [{ tipo: 'cubeta', piezas: 10 }, { tipo: 'galon', piezas: 8 }] };
    expect(etiquetaPiezasLote(l)).toBe('10 cubetas + 8 galones · 11.6 cub');
  });
  it('tipo desconocido (OT vieja): "piezas"', () => {
    expect(etiquetaPiezasLote({ cubEq: 3, piezas: 3, sublotes: [{ piezas: 3 }] })).toBe('3 piezas · 3 cub');
  });
});

describe('desgloseLotesDeOT', () => {
  it('sin desglose (OT vieja / sin PT) → null', () => {
    expect(desgloseLotesDeOT({ lineas: [] })).toBeNull();
    expect(desgloseLotesDeOT({ lotesSurtidos: { lotes: [], sinLote: 0 } })).toBeNull();
    expect(desgloseLotesDeOT(null)).toBeNull();
  });
  it('surtida: muestra lo surtido', () => {
    const d = desgloseLotesDeOT({ lotesSurtidos: SURTIDO });
    expect(d.fuente).toBe('surtidos');
    expect(d.lotes.map(l => l.codigoLote)).toEqual(['LP-20260702-001', 'LP-20260702-002']);
    expect(d.variosProductos).toBe(false);
    expect(d.difiere).toBe(false);
  });
  it('recibida: prefiere lo recibido y avisa si no coincide con lo surtido', () => {
    const igual = desgloseLotesDeOT({ lotesSurtidos: SURTIDO, lotesRecibidos: { ...SURTIDO, lotes: [...SURTIDO.lotes].reverse() } });
    expect(igual.fuente).toBe('recibidos');
    expect(igual.difiere).toBe(false);
    const otro = desgloseLotesDeOT({ lotesSurtidos: SURTIDO, lotesRecibidos: { ...SURTIDO, lotes: [{ ...SURTIDO.lotes[0], cubEq: 30 }] } });
    expect(otro.difiere).toBe(true);
  });
  it('solo lo que viajó sin lote también se muestra', () => {
    const d = desgloseLotesDeOT({ lotesSurtidos: { lotes: [], sinLote: 4 } });
    expect(d.sinLote).toBe(4);
  });
});

describe('<LotesDeOT />', () => {
  it('pinta cada lote con su cantidad', () => {
    render(<LotesDeOT ot={{ lotesSurtidos: SURTIDO }} />);
    expect(screen.getByText('Lotes en esta OT')).toBeInTheDocument();
    expect(screen.getByText('Surtido en Fábrica')).toBeInTheDocument();
    expect(screen.getByText('LP-20260702-001')).toBeInTheDocument();
    expect(screen.getByText('20 cubetas')).toBeInTheDocument();
    expect(screen.getByText('LP-20260702-002')).toBeInTheDocument();
    expect(screen.getByText('10 cubetas')).toBeInTheDocument();
  });
  it('avisa lo que viajó sin lote', () => {
    render(<LotesDeOT ot={{ lotesSurtidos: { ...SURTIDO, sinLote: 5 } }} />);
    expect(screen.getByText(/5 cub viajaron sin lote registrado/)).toBeInTheDocument();
  });
  it('sin desglose no pinta nada', () => {
    const { container } = render(<LotesDeOT ot={{ lineas: [] }} />);
    expect(container.innerHTML).toBe('');
  });
});
