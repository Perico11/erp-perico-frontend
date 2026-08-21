/* ════════════════════════════════════════════════════════════════════════════
   lib/scanSublote.js — Protocolo ÚNICO de escaneo de sublotes (P2, 21-jul-2026).

   Antes este flujo vivía COPIADO en 4 lugares (RecoleccionPage,
   AlmacenRecepcionPage, PedidoLoteActions, InboundAlertManager) — la misma
   clase de deriva que el "buckets drift": un fix en un escáner no llegaba a
   los otros 3. La cámara ya era compartida (QRScanner de QRModal); lo que se
   unifica aquí es el DESPACHO:

     1. extraer el código del resultado del escáner,
     2. POST /api/sublotes/scan con la acción (el guard scanCod===cod del
        backend se cumple porque mandamos el código físico leído),
     3. si el backend contesta 409 matchTipo='lote_no_sublote' (se escaneó el
        QR del LOTE, no el de una cubeta), confirmar con el usuario y despachar
        /api/sublotes/scan-bulk para todos los sublotes elegibles.

   La PRESENTACIÓN (toasts, spinners, vibración, marcado de banners) queda en
   cada pantalla vía callbacks — así cada rol conserva su UX exacta.
   ════════════════════════════════════════════════════════════════════════════ */
import api from '../services/api';

/* Código físico de un resultado del QRScanner ({cod} parseado o {raw}). */
export function extraerCodigoScan(result) {
  return String(result?.cod || result?.raw || '').trim();
}

/* ¿El código es el QR de una Orden de Transferencia? → devuelve el id OT-*
   o null. (Las OTs se reciben por /api/transferencias/scan, no por sublotes;
   hoy solo Recepción Terán las acepta.) */
export function otIdDeScan(code) {
  const m = /transfer-qr\/(OT-[A-Za-z0-9_-]+)/i.exec(code)
    || /^\s*(OT-[A-Za-z0-9_-]+)\s*$/i.exec(code);
  return m ? m[1] : null;
}

/* Despacho canónico single→bulk.
   opts:
     code        código físico escaneado (usar extraerCodigoScan antes)
     accion      acción de la state machine ('escanearRecoger' | 'escanearRecibirTeran' | …)
     confirm     fn de useConfirm (async (msg, opts) => bool) para ofrecer el bulk
     bulk        { pregunta?(data), titulo?, confirmText? } — textos del confirm
     onSublote   (r)  éxito individual — r.sublote es el sublote EFECTIVO (la
                 verdad física manda: puede diferir del que esperaba la UI)
     onBulk      (r2) éxito bulk — r2.procesados / r2.omitidos
     onError     (err, fase) fase = 'scan' | 'bulk'
   Devuelve: 'sublote' | 'bulk' | 'bulk-cancelado' | 'error'. */
export async function despacharScanSublote({ code, accion, confirm, bulk = {}, onSublote, onBulk, onError }) {
  try {
    const r = await api.escanearSublote(code, accion);
    if (onSublote) onSublote(r);
    return 'sublote';
  } catch (err) {
    const data = err?.data;
    if (data && data.matchTipo === 'lote_no_sublote' && data.loteId) {
      const pregunta = bulk.pregunta
        ? bulk.pregunta(data)
        : `Escaneaste el QR del LOTE ${data.codigoLote || ''}. ¿Procesar TODOS los sublotes elegibles del lote en una sola acción?`;
      const ok = await confirm(pregunta, {
        ...(bulk.titulo ? { title: bulk.titulo } : {}),
        confirmText: bulk.confirmText || 'Procesar todo el lote',
      });
      if (!ok) return 'bulk-cancelado';
      try {
        const r2 = await api.escanearLoteBulk({ loteId: data.loteId, codigoLote: data.codigoLote, accion, scanCod: code });
        if (onBulk) onBulk(r2);
        return 'bulk';
      } catch (e2) {
        if (onError) onError(e2, 'bulk');
        return 'error';
      }
    }
    if (onError) onError(err, 'scan');
    return 'error';
  }
}

/* Resumen estándar del resultado bulk para toasts. */
export function resumenBulk(r2) {
  const n = r2?.procesados?.length || 0;
  const omit = r2?.omitidos?.length || 0;
  return `${n} sublote(s)${omit ? ` · ${omit} omitido(s)` : ''}`;
}
