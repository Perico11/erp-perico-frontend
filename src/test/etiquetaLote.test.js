/* lib/etiquetaLote — diseño único de la etiqueta impresa (5-ago).
   Lo que se prueba es lo que se rompe en el piso: que la abreviatura sea la
   correcta, que el QR nunca baje del piso legible, y que un lote mixto no
   imprima una presentación que sería mentira en la mitad de las piezas. */
import { describe, it, expect } from 'vitest';
import {
  abreviaPresentacion, presentacionDeLote, envasadorDeLote,
  qrEfectivoMm, etiquetaCss, etiquetaHtml, codFontPt, anchoTextoMm, QR_MM_MIN, selloFechaHora,
} from '../lib/etiquetaLote';

const F50x25 = { wMm: 50, hMm: 25, qrMm: 21 };
const F100x70 = { wMm: 100, hMm: 70, qrMm: 40 };

describe('abreviaPresentacion', () => {
  it('usa las abreviaturas que pidió el dueño', () => {
    expect(abreviaPresentacion('cubeta')).toBe('CBT');
    expect(abreviaPresentacion('galon')).toBe('GLN');
    expect(abreviaPresentacion('litro')).toBe('LT');
    expect(abreviaPresentacion('tote')).toBe('TOTE');
  });

  it('tolera lo que traen los datos reales', () => {
    expect(abreviaPresentacion('Galón')).toBe('GLN');
    expect(abreviaPresentacion('CUBETAS')).toBe('CBT');
    expect(abreviaPresentacion('Cubeta Premium')).toBe('CBT');
    expect(abreviaPresentacion('atomizador750')).toBe('ATM');
  });

  it('calla en vez de inventar cuando no reconoce', () => {
    expect(abreviaPresentacion('')).toBe('');
    expect(abreviaPresentacion(null)).toBe('');
    expect(abreviaPresentacion('caja de cartón')).toBe('');
  });

  /* Trampa real: "19L Estándar" es el NOMBRE DEL ENVASE de una cubeta de 19 L.
     Leerlo como presentación imprimiría LT en cubetas. Por eso el nombre del
     envase (`lote.env`) no alimenta la abreviatura — solo medida/tipo/presentación. */
  it('el nombre del envase NO se confunde con la presentación', () => {
    expect(abreviaPresentacion('19L Estándar')).toBe('');
    expect(presentacionDeLote({ env: '19L Estándar' })).toBe('');
    expect(presentacionDeLote({ env: '19L Estándar', tipo: 'cubeta' })).toBe('CBT');
  });
});

describe('presentacionDeLote', () => {
  it('lee el campo directo venga como venga', () => {
    expect(presentacionDeLote({ medida: 'cubeta' })).toBe('CBT');
    expect(presentacionDeLote({ presentacion: 'galon' })).toBe('GLN');
    expect(presentacionDeLote({ tipo: 'tote' })).toBe('TOTE');
  });

  it('la deriva de los sublotes cuando son todos iguales', () => {
    expect(presentacionDeLote({ sublotes: [{ tipo: 'cubeta' }, { tipo: 'cubeta' }] })).toBe('CBT');
  });

  it('un lote MIXTO no declara presentación', () => {
    expect(presentacionDeLote({ sublotes: [{ tipo: 'cubeta' }, { tipo: 'galon' }] })).toBe('');
  });
});

describe('envasadorDeLote', () => {
  it('toma el directo y si no, el unánime de los sublotes', () => {
    expect(envasadorDeLote({ envasadoPor: 'Marcos R.' })).toBe('Marcos R.');
    expect(envasadorDeLote({ sublotes: [{ envasadoPor: 'Ana' }, { envasadoPor: 'Ana' }] })).toBe('Ana');
  });

  it('con dos envasadores distintos no atribuye a nadie', () => {
    expect(envasadorDeLote({ sublotes: [{ envasadoPor: 'Ana' }, { envasadoPor: 'Luis' }] })).toBe('');
    expect(envasadorDeLote({})).toBe('');
  });
});

describe('qrEfectivoMm', () => {
  it('encoge el QR para que quepa la banda, nunca por debajo del piso legible', () => {
    const qr = qrEfectivoMm(F50x25);
    expect(qr).toBeLessThan(F50x25.qrMm);      /* cedió espacio a la banda */
    expect(qr).toBeGreaterThanOrEqual(QR_MM_MIN);
    expect(qr).toBeLessThanOrEqual(25 - 4.6);  /* cabe bajo la banda */
  });

  it('en etiquetas grandes respeta el tamaño del formato', () => {
    expect(qrEfectivoMm(F100x70)).toBe(F100x70.qrMm);
  });

  it('nunca baja de 14 mm aunque la etiqueta sea diminuta', () => {
    expect(qrEfectivoMm({ wMm: 40, hMm: 20, qrMm: 18 })).toBeGreaterThanOrEqual(QR_MM_MIN);
  });
});

describe('etiquetaHtml', () => {
  const base = { qrSrc: 'data:,x', producto: 'Best Beige', pres: 'CBT', codigo: 'USA-0007' };

  it('arma banda + folio + envasador', () => {
    const h = etiquetaHtml({ ...base, envasador: 'Marcos R.', meta: '05/08/2026 · 19 L' });
    expect(h).toContain('>CBT<');
    expect(h).toContain('Best Beige');
    expect(h).toContain('USA-0007');
    expect(h).toContain('Marcos R.');
  });

  it('sin envasador no imprime ese renglón (no deja "Envasó:" huérfano)', () => {
    const h = etiquetaHtml({ ...base, envasador: '', meta: '' });
    expect(h).not.toContain('Envasó');
    expect(h).not.toContain('e-meta');
  });

  it('sin presentación la banda queda solo con el producto', () => {
    expect(etiquetaHtml({ ...base, pres: '' })).not.toContain('eb-pres');
  });

  it('escapa el HTML de los nombres', () => {
    const h = etiquetaHtml({ ...base, producto: '<script>x</script>', envasador: 'a"b' });
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
    expect(h).toContain('&quot;');
  });
});

describe('codFontPt — el folio nunca se corta ni se parte', () => {
  it('los folios nuevos entran a tamaño completo', () => {
    expect(codFontPt('USA-0007', F50x25)).toBe(13);
    expect(codFontPt('USA-001-15', F50x25)).toBe(13);
  });

  it('un folio VIEJO y largo baja de punto hasta caber entero', () => {
    const pt = codFontPt('USA-20260731-010', F50x25);
    expect(pt).toBeLessThan(13);
    expect(pt).toBeGreaterThanOrEqual(7);
    /* el ancho resultante cabe en el hueco de texto */
    const ancho = pt * (25.4 / 72) * 0.6 * 'USA-20260731-010'.length;
    expect(ancho).toBeLessThanOrEqual(anchoTextoMm(F50x25));
  });

  it('el html lleva el tamaño calculado cuando se le pasa el formato', () => {
    const h = etiquetaHtml({ qrSrc: 'data:,x', producto: 'X', pres: 'CBT', codigo: 'USA-20260731-010', fmt: F50x25 });
    expect(h).toMatch(/e-cod" style="font-size:[\d.]+pt"/);
  });
});

describe('etiquetaCss', () => {
  it('NO usa fondos: la térmica no los imprime (bug 5-ago)', () => {
    const css = etiquetaCss(F50x25, '.label');
    /* declaración real, no la palabra suelta en un comentario */
    expect(css).not.toMatch(/background(-color)?\s*:/);
    expect(css).toContain('print-color-adjust: exact');
    /* la separación es un BORDE, que sí se imprime siempre */
    expect(css).toMatch(/border-bottom: [\d.]+mm solid #000/);
  });


  it('acota las reglas al selector del modo de impresión', () => {
    expect(etiquetaCss(F50x25, '.cell')).toContain('.cell .eb');
    expect(etiquetaCss(F50x25, '.label')).toContain('.label .eb');
  });

  it('el folio se imprime más grande que el texto de apoyo', () => {
    const css = etiquetaCss(F50x25, '.label');
    const cod = +/\.e-cod[^}]*font-size: ([\d.]+)pt/.exec(css)[1];
    const env = +/\.e-env[^}]*font-size: ([\d.]+)pt/.exec(css)[1];
    expect(cod).toBeGreaterThan(env);
    expect(cod).toBeGreaterThanOrEqual(11);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   SELLO DE FECHA Y HORA (21-ago-2026).

   El renglón de abajo mostraba fecha y LITROS; el dueño pidió cambiar los
   litros por la HORA: con varias tandas del mismo lote en un día, la fecha
   sola no distingue cuál cubeta es cuál.
   ════════════════════════════════════════════════════════════════════════════ */
describe('selloFechaHora', () => {
  it('imprime fecha y hora del mismo instante', () => {
    expect(selloFechaHora('2026-08-15T17:42:09.000Z')).toBe('2026-08-15 17:42');
  });

  it('recorta la hora de la MISMA cadena que la fecha', () => {
    /* Convertir de zona podría dejar la hora de un día y la fecha de otro:
       dos datos que se contradicen en la misma etiqueta. */
    const iso = '2026-08-15T23:50:00.000Z';
    const out = selloFechaHora(iso);
    expect(out.slice(0, 10)).toBe(iso.slice(0, 10));
    expect(out.slice(11)).toBe('23:50');
  });

  it('sin hora en el dato, sale sólo la fecha', () => {
    expect(selloFechaHora('2026-08-15')).toBe('2026-08-15');
  });

  it('sin dato no inventa nada', () => {
    expect(selloFechaHora(null)).toBe('');
    expect(selloFechaHora(undefined)).toBe('');
    expect(selloFechaHora('')).toBe('');
  });
});
