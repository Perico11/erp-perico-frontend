import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getPushSettings,
  setPushSettings,
  getPushPermission,
  showPush,
  dispatchPushFromEvent,
  TIPOS_POR_ROL,
  rolPuedeRecibir,
  rutaParaRol,
} from '../utils/pushNotifications';

describe('pushNotifications utility', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    /* Reset Notification mock */
    global.Notification = vi.fn(function (title, opts) {
      this.title = title;
      this.options = opts;
      this.close = vi.fn();
    });
    global.Notification.permission = 'granted';
    global.Notification.requestPermission = vi.fn().mockResolvedValue('granted');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
  });

  it('returns defaults when nothing in storage', () => {
    const s = getPushSettings();
    expect(s.enabled).toBe(false);
    expect(s.stockCritico).toBe(true);
    expect(s.soloEnSegundoPlano).toBe(true);
  });

  it('persists patches to localStorage', () => {
    setPushSettings({ enabled: true, stockCritico: false });
    const s = getPushSettings();
    expect(s.enabled).toBe(true);
    expect(s.stockCritico).toBe(false);
    expect(s.ocVencida).toBe(true); /* unchanged default */
  });

  it('reads permission from Notification API', () => {
    expect(getPushPermission()).toBe('granted');
    global.Notification.permission = 'denied';
    expect(getPushPermission()).toBe('denied');
  });

  it('does not show push when settings.enabled is false', () => {
    setPushSettings({ enabled: false });
    const r = showPush({ tipo: 'stockCritico', title: 'X', body: 'Y' });
    expect(r).toBeNull();
    expect(Notification).not.toHaveBeenCalled();
  });

  it('shows push when enabled, permission granted, and tab hidden', () => {
    setPushSettings({ enabled: true, stockCritico: true, soloEnSegundoPlano: true });
    const r = showPush({ tipo: 'stockCritico', title: 'Stock critico', body: 'AGUA' });
    expect(r).not.toBeNull();
    expect(Notification).toHaveBeenCalledWith('Stock critico', expect.objectContaining({ body: 'AGUA' }));
  });

  it('respects per-event toggle (ocVencida=false blocks)', () => {
    setPushSettings({ enabled: true, ocVencida: false });
    const r = showPush({ tipo: 'ocVencida', title: 'OC', body: '123' });
    expect(r).toBeNull();
  });

  it('dispatchPushFromEvent does not throw on unknown event', () => {
    expect(() => dispatchPushFromEvent('foo', {}, null)).not.toThrow();
  });

  it('dispatchPushFromEvent fires devolucion notification', () => {
    setPushSettings({ enabled: true, devolucion: true });
    /* Mock fetch for the inventario branch's checkAlertasYNotificar */
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ notificaciones: [] }),
    });
    dispatchPushFromEvent('devolucion', {
      cliente: 'Cliente Test',
      producto: 'BLANCO MATE',
      cantidad: 2,
      id: 'd-1',
    }, null, 'tecnico'); /* tecnico SÍ está en el pipeline de devoluciones */
    expect(Notification).toHaveBeenCalled();
    const call = Notification.mock.calls[0];
    expect(call[0]).toBe('Devolución registrada');
    expect(call[1].body).toMatch(/BLANCO MATE/);
  });

  /* ── Gate por rol (pipeline) — decisión owner jun 2026 ── */

  it('TIPOS_POR_ROL espeja el mapa TIPO_ROLES_PERMITIDOS del backend', () => {
    expect(TIPOS_POR_ROL.stock_bajo).toEqual(['admin', 'compras', 'almacen']);
    expect(TIPOS_POR_ROL.qc_hold).toEqual(['admin', 'tecnico']);
    expect(TIPOS_POR_ROL.conteo_pendiente_aprobacion).toEqual(['admin']);
    expect(TIPOS_POR_ROL.devolucion_mp_pendiente).toEqual(['admin', 'compras']);
  });

  it('rolPuedeRecibir: respeta lista, admin siempre pasa, sin lista pasa', () => {
    expect(rolPuedeRecibir('stockCritico', 'recolector')).toBe(false);
    expect(rolPuedeRecibir('stockCritico', 'almacen')).toBe(true);
    expect(rolPuedeRecibir('stockCritico', 'admin')).toBe(true);
    expect(rolPuedeRecibir('qc_hold', 'compras')).toBe(false);   /* snake_case también gateado */
    expect(rolPuedeRecibir('pinCambiado', 'recolector')).toBe(true); /* sin lista → pasa */
    expect(rolPuedeRecibir('stockCritico', null)).toBe(true);    /* rol desconocido → fail-open */
  });

  it('showPush bloquea tipo fuera del pipeline del rol (rol desde sesión)', () => {
    sessionStorage.setItem('pp_user', JSON.stringify({ rol: 'recolector' }));
    setPushSettings({ enabled: true, stockCritico: true });
    const r = showPush({ tipo: 'stockCritico', title: 'X', body: 'Y' });
    expect(r).toBeNull();
    expect(Notification).not.toHaveBeenCalled();
  });

  it('showPush permite con rol explícito dentro del pipeline', () => {
    setPushSettings({ enabled: true, stockCritico: true });
    const r = showPush({ tipo: 'stockCritico', title: 'X', body: 'Y', rol: 'almacen' });
    expect(r).not.toBeNull();
  });

  it('dispatchPushFromEvent gatea evento WS por rol (qc_hold: recolector NO, tecnico SÍ)', () => {
    setPushSettings({ enabled: true, qcHold: true });
    dispatchPushFromEvent('trazabilidad', { estado: 'qc_hold', codigoLote: 'L-1' }, null, 'recolector');
    expect(Notification).not.toHaveBeenCalled();
    dispatchPushFromEvent('trazabilidad', { estado: 'qc_hold', codigoLote: 'L-1' }, null, 'tecnico');
    expect(Notification).toHaveBeenCalled();
    expect(Notification.mock.calls[0][0]).toBe('Lote retenido en QC');
  });

  it('rutaParaRol degrada a / las pantallas que el rol no puede abrir', () => {
    expect(rutaParaRol('/compras', 'tecnico')).toBe('/');
    expect(rutaParaRol('/compras', 'compras')).toBe('/compras');
    expect(rutaParaRol('/produccion?tab=calidad', 'tecnico')).toBe('/produccion?tab=calidad');
    expect(rutaParaRol('/produccion?tab=calidad', 'almacen')).toBe('/');
    expect(rutaParaRol('/notificaciones', 'recolector')).toBe('/notificaciones'); /* abierta a todos */
    expect(rutaParaRol('/compras', 'admin')).toBe('/compras'); /* admin nunca degrada */
    expect(rutaParaRol('/compras', null)).toBe('/compras');    /* rol desconocido: RoleRoute es la red */
  });
});
