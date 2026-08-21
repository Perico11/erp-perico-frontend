/* Tests del protocolo único de escaneo (lib/scanSublote, P2 21-jul-2026):
   single→bulk con guard scanCod, cancelación del bulk y fases de error. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({
  default: {
    escanearSublote: vi.fn(),
    escanearLoteBulk: vi.fn(),
  },
}));

import api from '../services/api';
import { despacharScanSublote, extraerCodigoScan, otIdDeScan, resumenBulk } from '../lib/scanSublote';

beforeEach(() => vi.clearAllMocks());

describe('extraerCodigoScan / otIdDeScan', () => {
  it('prefiere cod parseado, cae a raw, y recorta espacios', () => {
    expect(extraerCodigoScan({ cod: 'LP-1-A' })).toBe('LP-1-A');
    expect(extraerCodigoScan({ raw: '  LP-2-B ' })).toBe('LP-2-B');
    expect(extraerCodigoScan(null)).toBe('');
  });
  it('detecta QR de OT por URL y por id pelado; sublotes no', () => {
    expect(otIdDeScan('https://x.com/transfer-qr/OT-abc123')).toBe('OT-abc123');
    expect(otIdDeScan(' OT-99 ')).toBe('OT-99');
    expect(otIdDeScan('LP-2026-0721-001-A')).toBe(null);
  });
});

describe('despacharScanSublote', () => {
  it('éxito individual → onSublote con la respuesta, sin bulk', async () => {
    api.escanearSublote.mockResolvedValue({ ok: true, sublote: { cod: 'LP-1-A' } });
    const onSublote = vi.fn();
    const res = await despacharScanSublote({ code: 'LP-1-A', accion: 'escanearRecoger', confirm: vi.fn(), onSublote });
    expect(res).toBe('sublote');
    expect(api.escanearSublote).toHaveBeenCalledWith('LP-1-A', 'escanearRecoger');
    expect(onSublote).toHaveBeenCalledWith({ ok: true, sublote: { cod: 'LP-1-A' } });
    expect(api.escanearLoteBulk).not.toHaveBeenCalled();
  });

  it('QR de LOTE (409 lote_no_sublote) + confirm → bulk con scanCod del QR físico', async () => {
    const err = new Error('es lote');
    err.data = { matchTipo: 'lote_no_sublote', loteId: 'L9', codigoLote: 'LP-2026-9' };
    api.escanearSublote.mockRejectedValue(err);
    api.escanearLoteBulk.mockResolvedValue({ procesados: [{}, {}], omitidos: [{}] });
    const confirm = vi.fn().mockResolvedValue(true);
    const onBulk = vi.fn();
    const res = await despacharScanSublote({ code: 'LP-2026-9', accion: 'escanearRecibirTeran', confirm, onBulk });
    expect(res).toBe('bulk');
    expect(api.escanearLoteBulk).toHaveBeenCalledWith({ loteId: 'L9', codigoLote: 'LP-2026-9', accion: 'escanearRecibirTeran', scanCod: 'LP-2026-9' });
    expect(onBulk).toHaveBeenCalled();
    expect(resumenBulk(onBulk.mock.calls[0][0])).toBe('2 sublote(s) · 1 omitido(s)');
  });

  it('bulk cancelado por el usuario → no llama bulk ni onError', async () => {
    const err = new Error('es lote');
    err.data = { matchTipo: 'lote_no_sublote', loteId: 'L9', codigoLote: 'LP-9' };
    api.escanearSublote.mockRejectedValue(err);
    const onError = vi.fn();
    const res = await despacharScanSublote({ code: 'LP-9', accion: 'escanearRecoger', confirm: vi.fn().mockResolvedValue(false), onError });
    expect(res).toBe('bulk-cancelado');
    expect(api.escanearLoteBulk).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('error normal → onError fase "scan"; error del bulk → fase "bulk"', async () => {
    const e1 = new Error('sublote no encontrado');
    api.escanearSublote.mockRejectedValue(e1);
    const onError = vi.fn();
    expect(await despacharScanSublote({ code: 'X', accion: 'escanearRecoger', confirm: vi.fn(), onError })).toBe('error');
    expect(onError).toHaveBeenCalledWith(e1, 'scan');

    const eLote = new Error('es lote');
    eLote.data = { matchTipo: 'lote_no_sublote', loteId: 'L1', codigoLote: 'LP-1' };
    api.escanearSublote.mockRejectedValue(eLote);
    const e2 = new Error('bulk falló');
    api.escanearLoteBulk.mockRejectedValue(e2);
    const onError2 = vi.fn();
    expect(await despacharScanSublote({ code: 'LP-1', accion: 'escanearRecoger', confirm: vi.fn().mockResolvedValue(true), onError: onError2 })).toBe('error');
    expect(onError2).toHaveBeenCalledWith(e2, 'bulk');
  });
});
