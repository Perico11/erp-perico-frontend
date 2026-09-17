/* El debounce del buscador tiene que morir con el componente (17-sep-2026).

   Lo destapó el CI del PR de las tarjetas por ubicación: las 442 pruebas
   pasaban y el run fallaba igual, con

     ReferenceError: window is not defined
       ❯ Timeout._onTimeout src/hooks/useApi.js:75  → setTimeout(… setDebouncedQuery …)
       This error was caught after test environment was torn down.

   `useSearch` programa un setTimeout por tecla y no lo cancelaba al
   desmontar: si la pantalla se cierra dentro de los 200 ms del último
   tecleo, el temporizador sigue vivo y llama setState sobre algo que ya no
   existe. En la app es una fuga silenciosa; en las pruebas tumba la corrida
   entera cuando cae justo después del desmontaje —por eso no se reproduce
   siempre y por eso hay que arreglar la causa, no la prueba. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearch } from '../hooks/useApi';

const montar = () => renderHook(() => useSearch(200));

afterEach(() => { vi.useRealTimers(); });

describe('useSearch · el debounce no sobrevive al desmontaje', () => {
  it('al desmontar se cancela el temporizador pendiente', () => {
    vi.useFakeTimers();
    const { result, unmount } = montar();
    act(() => { result.current.setQuery('azul'); });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('y ese temporizador ya no dispara nada después', () => {
    vi.useFakeTimers();
    const { result, unmount } = montar();
    act(() => { result.current.setQuery('azul'); });
    unmount();
    /* Sin la limpieza, aquí corre setDebouncedQuery sobre un componente muerto. */
    expect(() => { act(() => { vi.advanceTimersByTime(500); }); }).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('mientras vive, sigue rebotando: sólo el último tecleo cuenta', () => {
    vi.useFakeTimers();
    const { result } = montar();
    act(() => { result.current.setQuery('a'); });
    act(() => { result.current.setQuery('az'); });
    act(() => { result.current.setQuery('azul'); });
    expect(vi.getTimerCount()).toBe(1);
    expect(result.current.debouncedQuery).toBe('');
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.debouncedQuery).toBe('azul');
  });
});
