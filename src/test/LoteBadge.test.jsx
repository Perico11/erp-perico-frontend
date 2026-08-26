/* ════════════════════════════════════════════════════════════════════════════
   EL BADGE DEL # DE LOTE — POR COMPORTAMIENTO, NO POR TEXTO DEL FUENTE.

   La primera versión de estas pruebas comparaba cadenas del código fuente. La
   revisión adversarial lo marcó, y con razón: daban falso verde cuando el
   componente cambiaba de forma pero seguía haciendo lo correcto, y falso rojo
   cuando el comportamiento no cambiaba pero el texto sí. Aquí se RENDERIZA.

   Los dos defectos reales que se fijan:
     · el chip usaba variables CSS inexistentes (--lp-bg-subtle, --lp-border)
       con fallbacks hex claros: en modo oscuro quedaba casi blanco, 2.7:1;
     · prometía UN código cuando una tirada de varias bachas imprime varios.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoteBadge from '../components/LoteBadge';
import { bachasDeItem, rangoDeLote } from '../utils/loteSerie';

describe('qué enseña el badge', () => {
  it('una bacha: el código tal cual', () => {
    render(<LoteBadge codigo="LP-0007-001" bachas={1} />);
    expect(screen.getByTestId('lote-badge')).toHaveTextContent('LP-0007-001');
  });

  it('varias bachas: el RANGO, porque cada bacha es su propio lote', () => {
    render(<LoteBadge codigo="LP-0007-001" bachas={3} />);
    const b = screen.getByTestId('lote-badge');
    expect(b).toHaveTextContent('LP-0007-001…003');
    expect(b.getAttribute('title')).toContain('3 bachas');
  });

  it('sin código no pinta NADA: un placeholder acabaría copiado a la etiqueta', () => {
    const { container } = render(<LoteBadge codigo="" bachas={2} />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByTestId('lote-badge')).toBeNull();
  });
});

describe('el chip respeta el tema (el bug de contraste)', () => {
  it('usa variables del tema, nunca un color fijo', () => {
    render(<LoteBadge codigo="LP-0001-001" />);
    const st = screen.getByTestId('lote-badge').getAttribute('style');
    expect(st).toContain('var(--lp-bg-sunken)');
    expect(st).toContain('var(--lp-border-subtle)');
    /* Un hex fijo no cambia con el tema: eso fue lo que dejó el chip casi
       blanco en modo oscuro. */
    expect(st).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});

describe('el rango nunca se inventa', () => {
  it('un código que no tiene la forma esperada se deja intacto', () => {
    expect(rangoDeLote('LP-2026-08-13', 3)).toBe('LP-2026-08-13');
    expect(rangoDeLote('GD89563', 4)).toBe('GD89563');
    expect(rangoDeLote('', 3)).toBe('');
  });
  it('respeta el ancho al pasar de 009 a 010', () => {
    expect(rangoDeLote('LP-0007-009', 2)).toBe('LP-0007-009…010');
  });
});

describe('cuántas bachas son', () => {
  it('un tote (52 cubetas) es una bacha; dos totes son dos', () => {
    expect(bachasDeItem({ cantidad: 52, litPerUnit: 19 })).toBe(1);
    expect(bachasDeItem({ cantidad: 104, litPerUnit: 19 })).toBe(2);
  });
  it('lee litPerUnit del _raw si el item no lo trae', () => {
    expect(bachasDeItem({ cantidad: 104, _raw: { litPerUnit: 19 } })).toBe(2);
  });
});
