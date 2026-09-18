/* ════════════════════════════════════════════════════════════════════════════
   documentoImprimible — LO QUE SALE DE LA IMPRESORA (18-sep-2026).

   Reporte del dueño: "le doy imprimir y aunque ponga 1 salen muchas en blanco,
   y también salen entrecortadas". Las causas estaban en el documento que se
   manda a la ventana de impresión, y vivían DUPLICADAS en las dos pantallas que
   imprimen etiquetas (QRModal y el modal de sublote de Stock Fábrica), con el
   mismo código copiado. Estas pruebas las fijan en el único sitio donde ahora
   se arma el documento.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import { documentoImprimible, SANGRIA_MM } from '../lib/etiquetaLote';

const OFICIAL = { v: '52x25', label: '52×25 mm (oficial)', wMm: 52, hMm: 25, qrMm: 20 };
const HOJA_A4 = { v: 'A4-21', wMm: 70, hMm: 42.3, qrMm: 22, isSheet: true, cols: 3, rows: 7 };
const tres = ['<b>A</b>', '<b>B</b>', '<b>C</b>'];

const medidas = (html, clase) => {
  const re = new RegExp('\\.' + clase + ' \\{[^}]*width: ([\\d.]+)mm; height: ([\\d.]+)mm');
  const m = re.exec(html);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
};
const hoja = (html) => {
  const m = /@page \{ size: ([\d.]+)mm ([\d.]+)mm/.exec(html);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
};

describe('la caja nunca mide lo mismo que la hoja', () => {
  it('se queda la sangría por dentro, a lo alto y a lo ancho', () => {
    const html = documentoImprimible({ titulo: 't', etiquetas: tres, fmt: OFICIAL });
    const h = hoja(html);
    const caja = medidas(html, 'pag');
    expect(h).toEqual({ w: 52, h: 25 });
    /* Medir la caja EXACTAMENTE como la hoja es lo que hacía que el driver, al
       redondear (52×25 sale de 51.9×25.1), la dejara fuera por una décima: el
       navegador paginaba y salía la etiqueta partida + una hoja casi vacía. */
    expect(caja.w).toBeCloseTo(52 - SANGRIA_MM, 2);
    expect(caja.h).toBeCloseTo(25 - SANGRIA_MM, 2);
  });

  it('en 90° la hoja gira pero la caja sigue por dentro', () => {
    const html = documentoImprimible({ titulo: 't', etiquetas: tres, fmt: OFICIAL, rotacion: 90 });
    expect(hoja(html)).toEqual({ w: 25, h: 52 });
    const caja = medidas(html, 'pag');
    expect(caja.w).toBeCloseTo(25 - SANGRIA_MM, 2);
    expect(caja.h).toBeCloseTo(52 - SANGRIA_MM, 2);
    /* El giro se apoya en las medidas de la CAJA, no en las de la hoja: si no,
       el contenido rotado caería corrido media décima. */
    expect(html).toContain(`translateX(${24.6}mm) rotate(90deg)`);
  });
});

describe('ningún salto de página que sobre', () => {
  it('el salto va ENTRE etiquetas, nunca después de la última', () => {
    const html = documentoImprimible({ titulo: 't', etiquetas: tres, fmt: OFICIAL });
    /* La regla vieja: salto después de TODAS, y `:last-child` para quitárselo a
       la última — que nunca casaba, porque el último hijo de <body> es el
       <script>. La última se quedaba con un salto que sobra: Chromium lo
       descarta, otros motores sacan la etiqueta en blanco. */
    expect(html).not.toMatch(/page-break-after:\s*always/);
    expect(html).not.toMatch(/:last-child/);
    expect(html).toContain('.pag + .pag { break-before: page; page-break-before: always; }');
    expect(html).toContain('break-inside: avoid');
  });

  it('una copia produce UNA página', () => {
    const html = documentoImprimible({ titulo: 't', etiquetas: ['<b>sola</b>'], fmt: OFICIAL });
    expect(html.match(/class="pag"/g)).toHaveLength(1);
  });
});

describe('no se imprime a ciegas', () => {
  it('espera a que las imágenes estén listas, no a un cronómetro', () => {
    const html = documentoImprimible({ titulo: 't', etiquetas: tres, fmt: OFICIAL });
    expect(html).not.toMatch(/setTimeout\(\(\) => window\.print\(\), 400\)/);
    expect(html).toContain('document.images');
    expect(html).toContain('addEventListener("load"');
    expect(html).toContain('addEventListener("error"');
  });
});

describe('la hoja A4 de etiquetas', () => {
  it('las columnas miden lo que mide la celda, y la hoja va a sangre', () => {
    const html = documentoImprimible({ titulo: 't', etiquetas: tres, fmt: HOJA_A4 });
    /* Con `1fr` la columna se encogía al ancho disponible mientras la celda
       seguía midiendo 70 mm: las celdas se salían de su columna. Y con margen
       de 5 mm quedaban 200 mm útiles para 210 mm de etiquetas. */
    expect(html).toContain('grid-template-columns: repeat(3, 70mm)');
    expect(html).toContain('@page { size: A4; margin: 0; }');
    expect(html).not.toContain('margin: 5mm');
    /* El div separador de hojas no hacía nada: era un hijo de la rejilla con
       flex-basis, que en un grid no aplica. Las filas de alto fijo ya paginan
       solas. Lo que SÍ debe quedar es que una celda no se parta en dos. */
    expect(html).not.toContain('class="page-break"');
    expect(html).toContain('page-break-inside: avoid');
  });
});

describe('el documento es HTML completo y escapa el título', () => {
  it('no se cuela markup por el título', () => {
    const html = documentoImprimible({ titulo: 'QR <script>malo</script>', etiquetas: ['x'], fmt: OFICIAL });
    expect(html).toContain('<title>QR &lt;script&gt;malo&lt;/script&gt;</title>');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html.trim().endsWith('</html>')).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   EL CATÁLOGO DE FORMATOS, UNO SOLO (18-sep-2026)

   Reporte: "a veces imprime y a veces no… sale todo bien, pero como que no
   manda comunicación a la impresora, sólo desde el usuario de Josué".

   Había tres catálogos leyendo la MISMA preferencia del navegador y sólo uno
   conocía el 52×25 oficial; los otros caían en silencio a 50×25. El rollo mide
   52 y el trabajo salía de 50.
   ════════════════════════════════════════════════════════════════════════════ */
import {
  FORMATOS_ETIQUETA, FORMATO_OFICIAL, resolverFormato,
} from '../lib/etiquetaLote';

describe('el catálogo de formatos', () => {
  it('el 52×25 oficial existe y es el primero', () => {
    expect(FORMATO_OFICIAL).toBe('52x25');
    expect(FORMATOS_ETIQUETA[0].v).toBe('52x25');
    expect(FORMATOS_ETIQUETA[0]).toMatchObject({ wMm: 52, hMm: 25 });
  });

  it('lo que no se reconoce cae al OFICIAL, nunca a otra medida', () => {
    /* Ésta es la línea del fallo: antes caía al primero de SU lista (50×25) y
       se imprimía en un tamaño que nadie pidió, sin avisar. */
    expect(resolverFormato('52x25').v).toBe('52x25');
    expect(resolverFormato('una-medida-vieja').v).toBe(FORMATO_OFICIAL);
    expect(resolverFormato(undefined).v).toBe(FORMATO_OFICIAL);
    expect(resolverFormato(null).v).toBe(FORMATO_OFICIAL);
  });

  it('siguen estando las medidas que el piso ya usaba', () => {
    const hay = (v) => FORMATOS_ETIQUETA.some((f) => f.v === v);
    for (const v of ['50x25', '50x40', '60x40', '80x50', '100x70', 'A4-21', 'A4-24']) {
      expect(hay(v), v).toBe(true);
    }
  });
});

describe('la ventana de impresión dice con qué va a imprimir', () => {
  it('muestra papel, cuántas y el botón — y nada de eso se imprime', () => {
    const html = documentoImprimible({ titulo: 't', etiquetas: tres, fmt: OFICIAL });
    expect(html).toContain('Papel <b>52×25 mm</b>');
    expect(html).toContain('<b>3</b> etiquetas');
    expect(html).toContain('id="btnImprimir"');
    /* Sólo en pantalla: en la etiqueta no puede salir. */
    expect(html).toContain('@media print { .barra { display: none !important; } }');
  });

  it('avisa del giro cuando la etiqueta va rotada', () => {
    const html = documentoImprimible({ titulo: 't', etiquetas: tres, fmt: OFICIAL, rotacion: 90 });
    expect(html).toContain('girado <b>90°</b>');
  });
});
