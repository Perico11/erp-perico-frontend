/* ════════════════════════════════════════════════════════════════════════════
   RealtimeSingleton.test.jsx — Una sola conexión WebSocket por pestaña.

   POR QUÉ EXISTE (auditoría 26-jul-2026): cada invocación de useRealtimeSync
   abría su PROPIO socket. Con AuthContext, AppLayout, TopBar, los contextos de
   notificaciones y la página activa, una pestaña normal mantenía 8 conexiones
   simultáneas — lo confirmé interceptando el constructor de WebSocket en el
   navegador. Ocho autenticaciones, ocho copias de cada evento y ocho pings cada
   30 segundos por pestaña.

   Y algo peor que el desperdicio: dispatchPushFromEvent corría una vez POR
   SOCKET, así que un solo evento del servidor podía disparar 8 notificaciones
   push idénticas al teléfono.
   ════════════════════════════════════════════════════════════════════════════ */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useRealtimeSync, _debugRealtime, _resetRealtime } from '../hooks/useRealtimeSync';

/* WebSocket de mentira: cuenta cuántos se construyen y deja mandar mensajes. */
let construidos = [];
class FakeWebSocket {
  static OPEN = 1;
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    construidos.push(this);
  }
  send() {}
  close() { this.readyState = 3; if (this.onclose) this.onclose(); }
  _abrir() { if (this.onopen) this.onopen(); }
  _recibir(obj) { if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) }); }
}

/* El despacho de push se cuenta aparte: es el que se disparaba N veces. */
const pushSpy = vi.fn();
vi.mock('../utils/pushNotifications', () => ({
  dispatchPushFromEvent: (...a) => pushSpy(...a),
  getCurrentRol: () => 'admin',
}));

function Consumidor({ onInventario }) {
  useRealtimeSync({ onInventario });
  return null;
}

describe('useRealtimeSync — conexión compartida', () => {
  beforeEach(() => {
    /* La conexión vive a nivel de módulo — que sea compartida es el punto de
       todo esto — así que hay que limpiarla entre tests o uno arrastra al otro. */
    _resetRealtime();
    construidos = [];
    pushSpy.mockClear();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    sessionStorage.setItem('pp_token', 'tok-abc');
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    /* Vaciar suscriptores y dejar que el cierre diferido corra. */
    act(() => { vi.advanceTimersByTime(5000); });
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('ocho componentes comparten UN socket, no ocho', () => {
    render(
      <MemoryRouter>
        {Array.from({ length: 8 }, (_, i) => <Consumidor key={i} onInventario={() => {}} />)}
      </MemoryRouter>
    );

    expect(construidos.length).toBe(1);
    expect(_debugRealtime().suscriptores).toBe(8);
  });

  it('el token de sesión viaja en la URL (sin él el servidor cierra a los 5 s)', () => {
    render(<MemoryRouter><Consumidor onInventario={() => {}} /></MemoryRouter>);
    expect(construidos[0].url).toContain('token=tok-abc');
  });

  it('un evento llega a TODOS los suscriptores', () => {
    const a = vi.fn(), b = vi.fn(), c = vi.fn();
    render(
      <MemoryRouter>
        <Consumidor onInventario={a} />
        <Consumidor onInventario={b} />
        <Consumidor onInventario={c} />
      </MemoryRouter>
    );

    act(() => {
      construidos[0]._abrir();
      construidos[0]._recibir({ evento: 'inventario', payload: { x: 1 } });
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
  });

  it('el push del navegador se dispara UNA vez por evento, no una por suscriptor', () => {
    render(
      <MemoryRouter>
        {Array.from({ length: 5 }, (_, i) => <Consumidor key={i} onInventario={() => {}} />)}
      </MemoryRouter>
    );

    act(() => {
      construidos[0]._abrir();
      construidos[0]._recibir({ evento: 'inventario', payload: {} });
    });

    /* Antes: 5 sockets × 1 evento = 5 notificaciones idénticas al teléfono. */
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('si un handler truena, los demás siguen recibiendo', () => {
    const bueno = vi.fn();
    render(
      <MemoryRouter>
        <Consumidor onInventario={() => { throw new Error('bug en una pantalla'); }} />
        <Consumidor onInventario={bueno} />
      </MemoryRouter>
    );

    act(() => {
      construidos[0]._abrir();
      construidos[0]._recibir({ evento: 'inventario', payload: {} });
    });

    expect(bueno).toHaveBeenCalledTimes(1);
  });

  it('cambiar de pantalla no reabre la conexión (margen de gracia)', () => {
    const { unmount } = render(<MemoryRouter><Consumidor onInventario={() => {}} /></MemoryRouter>);
    expect(construidos.length).toBe(1);

    unmount();                                    /* sale la pantalla vieja */
    act(() => { vi.advanceTimersByTime(500); });  /* menos que la gracia */
    render(<MemoryRouter><Consumidor onInventario={() => {}} /></MemoryRouter>); /* entra la nueva */
    act(() => { vi.advanceTimersByTime(5000); });

    expect(construidos.length).toBe(1);
    expect(_debugRealtime().socketAbierto).toBe(true);
  });

  it('si el servidor rechaza la sesión, DEJA de reintentar', () => {
    /* Medido en producción el 26-jul-2026: 168 conexiones sin autenticar en 3
       minutos. El servidor acepta la conexión y la cierra a los 5 s con 4401 si
       no llegó token; como el backoff se reiniciaba en `onopen`, nunca crecía y
       una pantalla de login reconectaba cada ~6 segundos para siempre. */
    sessionStorage.removeItem('pp_token');
    render(<MemoryRouter><Consumidor onInventario={() => {}} /></MemoryRouter>);
    expect(construidos.length).toBe(1);

    act(() => {
      construidos[0]._abrir();
      construidos[0].readyState = 3;
      if (construidos[0].onclose) construidos[0].onclose({ code: 4401 });
    });

    /* Dos minutos después no debe haber abierto una sola conexión más. */
    act(() => { vi.advanceTimersByTime(120000); });
    expect(construidos.length).toBe(1);
  });

  it('tras iniciar sesión vuelve a conectar solo', () => {
    /* El efecto del hook solo corre al montar: si nada vigilara el token, quien
       inicia sesión se quedaría sin tiempo real hasta recargar la página. */
    sessionStorage.removeItem('pp_token');
    render(<MemoryRouter><Consumidor onInventario={() => {}} /></MemoryRouter>);

    act(() => {
      construidos[0]._abrir();
      construidos[0].readyState = 3;
      if (construidos[0].onclose) construidos[0].onclose({ code: 4401 });
    });
    act(() => { vi.advanceTimersByTime(30000); });
    expect(construidos.length).toBe(1);   /* sigue sin reintentar */

    sessionStorage.setItem('pp_token', 'tok-nuevo');   /* login */
    act(() => { vi.advanceTimersByTime(4000); });

    expect(construidos.length).toBe(2);
    expect(construidos[1].url).toContain('token=tok-nuevo');
  });

  it('sin suscriptores la conexión se cierra (no queda colgada)', () => {
    const { unmount } = render(<MemoryRouter><Consumidor onInventario={() => {}} /></MemoryRouter>);
    act(() => { construidos[0]._abrir(); });
    expect(_debugRealtime().socketAbierto).toBe(true);

    unmount();
    act(() => { vi.advanceTimersByTime(4000); });

    expect(_debugRealtime().suscriptores).toBe(0);
    expect(_debugRealtime().socketAbierto).toBe(false);
  });
});
