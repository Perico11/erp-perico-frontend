/* Vitest + Testing Library setup */
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

/* Mock global de fetch para todos los tests */
global.fetch = vi.fn();

/* Mock de localStorage / sessionStorage */
const storageMock = () => {
  let store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
};
Object.defineProperty(window, 'sessionStorage', { value: storageMock() });
Object.defineProperty(window, 'localStorage', { value: storageMock() });

/* Mock de matchMedia — jsdom no lo implementa. Lo usa useIsDesktop (rediseño
   verde) para decidir layout escritorio/móvil. Por defecto devolvemos true
   (escritorio) para que los tests rendericen el layout de tablas/grids. */
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/* Mock de scrollTo — jsdom tampoco lo implementa (ni en Element ni en window).
   Lo usa el riel de checkpoints (components/pipeline/Checkpoint) para
   auto-centrar el paso activo. Sin esto, montar cualquier pantalla con el riel
   revienta con "scrollTo is not a function" por un detalle de scroll. */
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
if (!window.scrollTo) window.scrollTo = () => {};
