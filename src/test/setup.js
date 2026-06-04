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
