import { useState, useMemo, useCallback } from 'react';
import TopBar from '../../components/layout/TopBar';
import PageTabs from '../../components/ui/PageTabs';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useConfirm from '../../hooks/useConfirm';
import useIsDesktop from '../../hooks/useIsDesktop';
import { QRScanner } from '../../components/QRModal';
import PruebaBadge, { esPrueba } from '../../components/ui/PruebaBadge';
import {
  ESTADO_SUBLOTE_LABEL,
  ESTADO_SUBLOTE_COLOR,
  getAccionesSublote,
  LABELS_ACCION_SUBLOTE,
} from '../../lib/loteTransiciones';

/* ──────────────────────────────────────────────────────────────────── */
/* RecoleccionPage — reskin Design System verde (Claude Design)         */
/* ──────────────────────────────────────────────────────────────────── */
/* Responsive 1:1 con el paquete entrega_v2:                            */
/*   · escritorio → grid de cards g3 (ERP Escritorio.html · recoleccion) */
/*   · móvil      → cards limpias + hero verde "Escanear QR"             */
/*                  (ERP Móvil.html · S.recoleccion + Recolección.html)  */
/*                                                                       */
/* La unidad de trabajo de Luis es el SUBLOTE, no el lote. Cada sublote  */
/* tiene QR físico y avanza por su propio estado:                        */
/*   envasado → en_recoleccion → en_camino → en_stock_teran             */
/* Luis dispara 'escanearRecoger' (envasado/en_recoleccion → en_camino) */
/* Josué (en AlmacenRecepcion) dispara 'escanearRecibirTeran'           */
/*                                                                       */
/* RESKIN VISUAL + cableo de botones — TODA la lógica se conserva:       */
/* handlers, api/endpoints, useRealtimeSync, useConfirm, state machine   */
/* de sublotes, esPrueba, validaciones, feedback háptico, scanner.       */
/* ──────────────────────────────────────────────────────────────────── */

/* Iconos line SVG (sin emojis) ─────────────────────────────────────── */
function IconQR({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M3 12h18" />
    </svg>
  );
}
function IconTruck({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 4h13v12H1z" /><path d="M14 8h4l3 3v5h-7" />
      <circle cx="5.5" cy="18.5" r="2" /><circle cx="17.5" cy="18.5" r="2" />
    </svg>
  );
}
function IconCheckBox({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function IconArrow({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
function IconCheck({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/* Pill de estado (badge con bolita) — espejo del .badge del mockup ─── */
function EstadoBadge({ estado }) {
  const color = ESTADO_SUBLOTE_COLOR[estado] || 'var(--lp-text-tertiary)';
  const label = ESTADO_SUBLOTE_LABEL[estado] || estado || '—';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
      background: `color-mix(in srgb, ${color} 14%, transparent)`, color,
    }}>
      <i style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {label}
    </span>
  );
}

/* Mapa de acción → presentación del botón (verbo del mockup + icono + color).
   La disponibilidad real la decide getAccionesSublote(s, rol) — esto es solo
   la capa visual + los data-id/data-rol del mockup (Recolección.html). */
const ACCION_BTN = {
  escanearRecoger: {
    label: 'Voy por él',
    dataId: 'recoleccion.btn.voy',
    dataRol: 'recolector,admin',
    bg: 'var(--lp-brand-600)',
    fg: '#fff',
    Icon: IconTruck,
  },
  escanearRecibirTeran: {
    label: 'Entregar en Terán',
    dataId: 'recoleccion.btn.entregar',
    dataRol: 'recolector,admin',
    bg: 'var(--lp-info-600)',
    fg: '#fff',
    Icon: IconCheckBox,
  },
  marcarRecoleccion: {
    label: LABELS_ACCION_SUBLOTE.marcarRecoleccion,
    dataId: 'recoleccion.btn.marcar',
    dataRol: 'almacen,admin',
    bg: 'var(--lp-text-tertiary)',
    fg: '#fff',
    Icon: IconArrow,
  },
};

/* Estado UI: agrupa sublote.estado en buckets visuales para el rol Luis.
   Exportada para reuso en la pantalla unificada /flujo. */
export function bucketOfSublote(s) {
  const e = s?.estado;
  if (e === 'envasado' || e === 'en_recoleccion') return 'pendientes';
  if (e === 'en_camino') return 'enCamino';
  if (e === 'en_stock_teran') return 'entregados';
  if (e === 'tote_vaciado' || e === 'cancelado') return null;
  /* Retro-compat: TOTE en tote_activo pero aún en fábrica = pendiente de recoger.
     Esto cubre sublotes legacy creados antes del fix donde TOTE arrancaba
     incorrectamente en tote_activo en lugar de envasado. */
  if (e === 'tote_activo') {
    const ub = s?.ub || 'fabrica';
    /* FIX jun 2026: tote_activo en TERÁN = Luis YA lo entregó (Josué lo recibió
       y está en buffer de re-envase) → cuenta como ENTREGADO en su historial.
       Antes devolvía null y desaparecía: Luis perdía el registro de la entrega.
       En fábrica (legacy) sigue siendo pendiente de recoger. */
    return ub === 'fabrica' ? 'pendientes' : 'entregados';
  }
  /* Compat con sublotes legacy sin estado: usar 'ub' como pista */
  if (s?.ub === 'teran') return 'entregados';
  if (s?.ub === 'fabrica') return 'pendientes';
  return 'pendientes';
}

/* ═══════════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                          */
/* ═══════════════════════════════════════════════════════════════════ */
export default function RecoleccionPage() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [confirm, ConfirmEl] = useConfirm();
  const userName = user?.nombre || '?';
  const rol = user?.rol || '';
  const [activeTab, setActiveTab] = useState('pendientes');
  const [searchQ, setSearchQ] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(null); // sublote.cod while saving
  const [scannerOpen, setScannerOpen] = useState(false);
  /* FIX jun 2026: acción que disparará el escáner. null = default por rol
     (escanearRecoger desde el hero "Escanear QR"). Un botón de tarjeta la
     fija a su acción concreta antes de abrir la cámara. */
  const [scanIntent, setScanIntent] = useState(null);

  const showToast = useCallback((msg, isErr = false) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const { data: trazData, loading, reload } = useApiData(() => api.getTrazabilidad(), [], 5000);

  /* FIX jun 2026 (K1): Luis necesita ver INSTANTÁNEAMENTE cuando un nuevo
     sublote se marca como listo para recolectar. 5s de polling = pierde
     turnos contra otros recolectores en futuro. Realtime cierra el gap. */
  useRealtimeSync({
    onTrazabilidad: () => reload(),
  });

  const allLotes = useMemo(() => {
    const arr = trazData?.data || [];
    return (Array.isArray(arr) ? arr : [])
      .filter(l => l && !l.eliminado)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [trazData]);

  /* Aplanar a sublotes con referencia al lote padre */
  const allSublotes = useMemo(() => {
    const out = [];
    allLotes.forEach(lote => {
      (lote.sublotes || []).forEach(s => {
        if (s.esMerma) return; /* merma no se recolecta */
        /* FIX jun 2026: ya NO saltamos tote_activo. Un TOTE tote_activo en Terán
           es una entrega de Luis YA completada → debe quedar en su historial de
           "Entregados" (bucketOfSublote lo clasifica). En fábrica (legacy) sigue
           siendo recolectable como pendiente. */
        out.push({ ...s, _lote: lote });
      });
    });
    return out;
  }, [allLotes]);

  /* Buckets */
  const pendientes = useMemo(() => allSublotes.filter(s => bucketOfSublote(s) === 'pendientes'), [allSublotes]);
  const enCamino   = useMemo(() => allSublotes.filter(s => bucketOfSublote(s) === 'enCamino'),   [allSublotes]);
  const entregados = useMemo(() => allSublotes.filter(s => bucketOfSublote(s) === 'entregados'), [allSublotes]);

  /* Filtrado por tab + búsqueda */
  const filtered = useMemo(() => {
    let list;
    if (activeTab === 'pendientes') list = pendientes;
    else if (activeTab === 'enCamino') list = enCamino;
    else list = entregados;
    if (!searchQ) return list;
    const q = searchQ.toLowerCase();
    return list.filter(s =>
      (s.cod || '').toLowerCase().includes(q) ||
      (s._lote?.producto || s._lote?.nombre || '').toLowerCase().includes(q) ||
      (s._lote?.codigoLote || s._lote?.codigo || '').toLowerCase().includes(q)
    );
  }, [activeTab, pendientes, enCamino, entregados, searchQ]);

  /* Lista plana ordenada para cards (1 card por sublote = 1 QR físico) */
  const filteredSublotes = useMemo(() => filtered, [filtered]);

  /* Ejecutar transición de sublote vía state machine */
  const doTransicion = useCallback(async (sublote, accion) => {
    /* FIX jun 2026: escanearRecoger / escanearRecibirTeran exigen el QR FÍSICO
       (guard scanCod===cod en el backend). NO se pueden disparar con un botón
       "a ciegas" — eso devolvía "El código escaneado no coincide con este
       sublote". El botón ahora ABRE LA CÁMARA con la acción correcta; al leer
       el QR de la cubeta (o teclear el código) se marca en automático. */
    if (accion === 'escanearRecoger' || accion === 'escanearRecibirTeran') {
      setScanIntent(accion);
      setScannerOpen(true);
      return;
    }
    const label = LABELS_ACCION_SUBLOTE[accion] || accion;
    const ok = await confirm(`¿${label}: ${sublote.cod}?`, { confirmText: label });
    if (!ok) return;
    setBusy(sublote.cod);
    try {
      await api.transicionSublote(sublote.cod, accion, { usuario: userName });
      reload();
      showToast(`${sublote.cod}: ${label.toLowerCase()}`);
    } catch (err) {
      showToast('Error: ' + (err.message || 'No se pudo actualizar'), true);
    } finally {
      setBusy(null);
    }
  }, [confirm, userName, reload, showToast]);

  /* Feedback haptic + sonido para escaneo exitoso.
     Útil para Luis en ambientes ruidosos (camión, almacén) — confirma sin
     necesidad de mirar la pantalla. Vibration API funciona en Android.
     iOS Safari NO soporta vibrate, pero el sonido sí funciona. */
  const feedbackScanOK = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([80, 40, 80]); /* corto-pausa-corto = OK */
      }
    } catch (e) {}
    try {
      /* Beep corto vía Web Audio API — funciona en iOS Safari y Android Chrome.
         Frecuencia 880Hz por 120ms con envelope para evitar click. */
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      setTimeout(() => { try { ctx.close(); } catch(e){} }, 200);
    } catch (e) {}
  }, []);

  const feedbackScanError = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([200]); /* largo = error */
      }
    } catch (e) {}
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 220; /* tono grave = error */
      osc.type = 'square';
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
      setTimeout(() => { try { ctx.close(); } catch(e){} }, 400);
    } catch (e) {}
  }, []);

  /* Resultado del scan: dispatch al server con la acción permitida por rol.
     Si el QR escaneado resulta ser el del LOTE (no de sublote individual), el
     backend devuelve 409 con matchTipo='lote_no_sublote' y un loteId. En ese
     caso ofrecemos al usuario procesar TODOS los sublotes elegibles del lote
     en una sola operación (bulk scan). */
  const handleScan = useCallback(async (result) => {
    setScannerOpen(false);
    const code = result?.cod || result?.raw || '';
    if (!code) { feedbackScanError(); return showToast('QR no reconocido', true); }

    /* Acción: la del botón que abrió el escáner (scanIntent), o la default por
       rol (recolector/admin → escanearRecoger) cuando se usa el hero "Escanear QR". */
    const accion = scanIntent
      || ((rol === 'recolector' || rol === 'admin') ? 'escanearRecoger' : null);
    setScanIntent(null);
    if (!accion) { feedbackScanError(); return showToast('No tienes permisos para recoger (solo recolector/admin)', true); }

    setBusy(code);
    try {
      const r = await api.escanearSublote(code, accion);
      reload();
      const subloteCod = r?.sublote?.cod || code;
      feedbackScanOK();
      showToast(`Recogido: ${subloteCod}`);
    } catch (err) {
      /* Caso especial: era QR de LOTE → ofrecer bulk */
      const data = err?.data;
      if (data && data.matchTipo === 'lote_no_sublote' && data.loteId) {
        const ok = await confirm(
          `Escaneaste el QR del LOTE ${data.codigoLote}. ¿Tomar TODOS los sublotes elegibles del lote en una sola acción?`,
          { confirmText: 'Tomar todo el lote' }
        );
        if (ok) {
          try {
            const r = await api.escanearLoteBulk({ loteId: data.loteId, codigoLote: data.codigoLote, accion, scanCod: code });
            reload();
            const n = r?.procesados?.length || 0;
            const omit = r?.omitidos?.length || 0;
            feedbackScanOK();
            showToast(`Lote completo recogido: ${n} sublote(s)${omit ? ` · ${omit} omitido(s)` : ''}`);
          } catch (e2) {
            feedbackScanError();
            showToast('Error: ' + (e2.message || 'Bulk scan falló'), true);
          }
        }
      } else {
        feedbackScanError();
        showToast('Error: ' + (err.message || 'Scan falló'), true);
      }
    } finally {
      setBusy(null);
    }
  }, [rol, reload, showToast, confirm, feedbackScanOK, feedbackScanError, scanIntent]);

  /* canScan: quién puede usar el hero "Escanear QR" (handleScan gatea por rol).
     Las acciones por card las decide la state machine (getAccionesSublote). */
  const canScan = rol === 'admin' || rol === 'recolector';

  if (loading) {
    return (
      <>
        <TopBar title="Recolección" />
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  /* Lista de tabs (compartida móvil/escritorio) */
  const TABS = [
    { id: 'pendientes', label: `Por recoger · ${pendientes.length}` },
    { id: 'enCamino',   label: `En camino · ${enCamino.length}` },
    { id: 'entregados', label: `Entregados · ${entregados.length}` },
  ];

  const emptyCopy =
    activeTab === 'pendientes' ? (searchQ ? 'Sin resultados' : 'Nada por recoger ahora. Respira tranquilo.')
    : activeTab === 'enCamino' ? (searchQ ? 'Sin resultados' : 'Sin envíos en camino.')
    : (searchQ ? 'Sin resultados' : 'Aún sin entregas.');

  /* ════════════════════ RENDER ════════════════════ */
  return (
    <>
      <TopBar title="Recolección" />
      <div style={isDesktop ? S.wrapDesktop : S.wrapMobile}>

        {/* HERO "Escanear QR" — móvil: ancho completo; escritorio: botón auto */}
        {canScan && (
          isDesktop ? (
            <div style={S.scanRowDesktop}>
              <button
                style={S.scanBtnDesktop}
                onClick={() => { setScanIntent(null); setScannerOpen(true); }}
                aria-label="Escanear QR de sublote"
              >
                <IconQR size={20} />
                Escanear QR
              </button>
            </div>
          ) : (
            <button
              style={S.scanHeroMobile}
              onClick={() => setScannerOpen(true)}
              aria-label="Escanear QR de sublote"
            >
              <IconQR size={24} />
              Escanear QR
            </button>
          )
        )}

        {/* TABS tipo pill (estilo mockup) */}
        <PageTabs
          tabs={TABS.map(t => ({ ...t, style: (a) => S.tab(a) }))}
          activeTab={activeTab}
          onChange={setActiveTab}
          style={S.tabs}
        />

        {/* Búsqueda — útil para admin/almacén con muchos lotes */}
        {isDesktop && (
          <div style={S.toolbar}>
            <input
              type="text" style={S.search}
              placeholder="Buscar sublote, código o producto…"
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
            />
          </div>
        )}

        {/* LISTA / GRID de cards */}
        {filteredSublotes.length === 0 ? (
          <div style={S.empty}>
            <IconCheck size={40} />
            <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>{emptyCopy}</div>
            {!searchQ && activeTab === 'pendientes' && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--lp-text-tertiary)' }}>
                Cuando fábrica envase un lote, sus sublotes aparecerán aquí listos para recoger.
              </div>
            )}
          </div>
        ) : (
          <div style={isDesktop ? S.grid3 : undefined}>
            {filteredSublotes.map(s => (
              <SubloteCard
                key={s.cod}
                sublote={s}
                rol={rol}
                busy={busy === s.cod}
                onAccion={doTransicion}
                isDesktop={isDesktop}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scanner */}
      {scannerOpen && (
        <QRScanner
          onResult={handleScan}
          onClose={() => { setScannerOpen(false); setScanIntent(null); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, ...(toast.isErr ? S.toastErr : {}) }}>
          {toast.isErr
            ? <span style={{ display: 'inline-flex' }} aria-hidden="true">✕</span>
            : <IconCheck size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
      {ConfirmEl}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Card de sublote — visual unificado móvil/escritorio                  */
/*                                                                     */
/* Layout (espejo de Recolección.html y SCREENS.recoleccion):           */
/*   ┌ folio · estado badge ────────────────────┐                      */
/*   │ Producto 19L                              │                      │
/*   │ 40 cubetas · 760 L                        │                      │
/*   │ [Fábrica] → [Almacén Terán]               │                      │
/*   │ [ Voy por él / Entregar en Terán ]        │                      │
/*   └────────────────────────────────────────────┘                    │
/*                                                                     */
/* Acciones gateadas por la state machine real (getAccionesSublote).    */
/* Los data-id/data-rol vienen del mockup; cada botón está cableado a    */
/* doTransicion (api.transicionSublote) — la acción REAL.               */
/* ═══════════════════════════════════════════════════════════════════ */
function SubloteCard({ sublote: s, rol, busy, onAccion, isDesktop }) {
  const lote = s._lote || {};
  const esLotePrueba = esPrueba(lote);
  const esSublotePrueba = esPrueba(s);
  const producto = lote.producto || lote.formula || lote.nombre || '—';
  const codLote = lote.codigoLote || lote.codigo || lote.id;
  const litros = s.lit ? `${s.lit} L` : '';
  const qtyTxt = [
    s.qty != null ? `${s.qty} ${s.tipo || 'cubetas'}` : null,
    litros,
  ].filter(Boolean).join(' · ');

  const bucket = bucketOfSublote(s);
  /* Destino según estado: entregados parten de Terán; resto Fábrica → Terán */
  const origen = bucket === 'entregados' ? 'Almacén Terán' : 'Fábrica';

  /* Acciones permitidas por la state machine real para este rol.
     Excluimos cancelarSublote (acción de anulación admin, no del flujo Luis).
     FIX jun 2026: en "Entregados" NO mostramos acciones de recolección — el
     sublote ya llegó a Terán. (getAccionesSublote aún ofrecería escanearRecoger
     para un tote_activo, pero el backend lo rechaza si ya está en Terán; aquí
     evitamos el botón fantasma y dejamos solo el chip "Entregado".) */
  /* FIX jun 2026 (censo duplicados): 'escanearRecibirTeran' ("Entregar en
     Terán") se quita de esta pantalla — era duplicado 100% de Recepción Terán
     (misma entidad/estado/acción para almacen). Recolección queda 100% de Luis. */
  const acciones = bucket === 'entregados'
    ? []
    : getAccionesSublote(s, rol).filter(a => a !== 'cancelarSublote' && a !== 'escanearRecibirTeran');

  return (
    <div style={S.card}>
      {/* header: folio + estado */}
      <div style={S.cardHead}>
        <span style={S.folio}>{s.cod}</span>
        {(esSublotePrueba || esLotePrueba) && <PruebaBadge size="sm" />}
        <span style={{ marginLeft: 'auto' }}><EstadoBadge estado={s.estado} /></span>
      </div>

      {/* producto + cantidad */}
      <div style={S.prod}>{producto}</div>
      <div style={S.qty}>
        {qtyTxt}
        {codLote && <> · <span style={S.codLoteInline}>{codLote}</span></>}
        {s.marca && <> · <span style={{ fontWeight: 600, color: 'var(--lp-text-secondary)' }}>{s.marca}</span></>}
        {s.esHijoDe && <> · <span style={{ color: '#7C3AED' }}>↳ tote {s.esHijoDe}</span></>}
      </div>

      {/* ruta Fábrica → Terán (chip del mockup .route) */}
      <div style={S.route}>
        <b style={S.routeNode}>{origen}</b>
        <span style={S.routeArrow}><IconArrow size={16} /></span>
        <b style={S.routeNode}>Almacén Terán</b>
      </div>

      {/* aviso de prueba: Luis no recolecta físicamente */}
      {esLotePrueba && (
        <div style={S.pruebaNote}>
          Este lote es de prueba — no recolectes físicamente, sólo simula el flujo.
        </div>
      )}

      {/* acción dominante por estado (state machine + data-id/data-rol mockup) */}
      {acciones.length > 0 ? (
        <div style={isDesktop ? S.actionsDesktop : S.actionsMobile}>
          {acciones.map(a => {
            const meta = ACCION_BTN[a] || {
              label: LABELS_ACCION_SUBLOTE[a] || a,
              dataId: `recoleccion.btn.${a}`,
              dataRol: 'recolector,admin',
              bg: 'var(--lp-brand-600)',
              fg: '#fff',
              Icon: IconArrow,
            };
            const Ico = meta.Icon;
            return (
              <button
                key={a}
                data-id={meta.dataId}
                data-rol={meta.dataRol}
                style={{
                  ...(isDesktop ? S.btnDesktop : S.btnMobile),
                  background: meta.bg, color: meta.fg,
                }}
                disabled={busy}
                onClick={() => onAccion(s, a)}
              >
                {busy ? <span aria-hidden="true">…</span> : <><Ico size={isDesktop ? 18 : 20} />{meta.label}</>}
              </button>
            );
          })}
        </div>
      ) : (
        /* Estado terminal (entregado en Terán) — chip "hecho", no botón */
        bucket === 'entregados' && (
          <div style={S.doneChip}>
            <IconCheck size={16} /> Entregado en Terán
          </div>
        )
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Estilos — SOLO tokens var(--lp-*). Claro y oscuro salen solos.       */
/* ═══════════════════════════════════════════════════════════════════ */
const S = {
  wrapMobile: { padding: '4px 16px 100px' },
  wrapDesktop: { padding: '8px 24px 48px' },

  /* hero scan móvil — ancho completo, verde, hero tipo delivery app */
  scanHeroMobile: {
    width: '100%', height: 64, borderRadius: 18, border: 'none', cursor: 'pointer',
    background: 'var(--lp-brand-600)', color: '#fff',
    fontFamily: 'var(--lp-font-sans)', fontSize: 16, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
    boxShadow: '0 10px 24px -10px color-mix(in srgb, var(--lp-brand-600) 60%, transparent)',
    marginBottom: 14,
  },
  /* escritorio — botón tamaño estándar alineado a la derecha (no 100%) */
  scanRowDesktop: {
    display: 'flex', justifyContent: 'flex-end', marginBottom: 16,
  },
  scanBtnDesktop: {
    height: 40, padding: '0 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: 'var(--lp-brand-600)', color: '#fff',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44,
  },

  /* tabs pill (estilo mockup): activo verde sólido */
  tabs: {
    display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
  },
  tab: (active) => ({
    flexShrink: 0, padding: '9px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: active ? 600 : 500,
    background: active ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)',
    color: active ? '#fff' : 'var(--lp-text-tertiary)',
    whiteSpace: 'nowrap', minHeight: 44,
  }),

  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 200, maxWidth: 420, height: 44, padding: '0 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },

  /* grid de 3 (escritorio) */
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },

  /* card 16-18px radius */
  card: {
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
    borderRadius: 18, padding: 16, marginBottom: 12,
    display: 'flex', flexDirection: 'column',
  },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' },
  folio: {
    fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700,
    color: 'var(--lp-brand-600)',
  },
  prod: { fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--lp-text-primary)' },
  qty: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 3 },
  codLoteInline: { fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)' },

  route: {
    display: 'flex', alignItems: 'center', gap: 8, margin: '13px 0',
    padding: '11px 13px', borderRadius: 12, background: 'var(--lp-bg-sunken)',
    fontSize: 13, flexWrap: 'wrap',
  },
  routeNode: { color: 'var(--lp-text-primary)', fontWeight: 600 },
  routeArrow: { color: 'var(--lp-text-tertiary)', display: 'inline-flex' },

  pruebaNote: {
    marginBottom: 12, padding: '8px 10px',
    background: 'color-mix(in srgb, var(--lp-warning-600) 12%, transparent)',
    border: '1.5px solid color-mix(in srgb, var(--lp-warning-600) 40%, transparent)',
    borderRadius: 10, fontSize: 12, color: 'var(--lp-warning-600)',
  },

  /* acciones: móvil = botón ancho completo (CTA), escritorio = ancho completo de card
     pero la card es estrecha (1/3), por eso no estira de borde a borde de pantalla */
  actionsMobile: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' },
  actionsDesktop: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'auto' },
  btnMobile: {
    width: '100%', height: 50, borderRadius: 14, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 15, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  btnDesktop: {
    flex: 1, minWidth: 140, height: 44, padding: '0 16px', borderRadius: 12, border: 'none',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 13.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  doneChip: {
    marginTop: 'auto', height: 44, borderRadius: 12,
    background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)',
    color: 'var(--lp-text-tertiary)', fontSize: 13.5, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },

  empty: {
    textAlign: 'center', color: 'var(--lp-text-secondary)',
    padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },

  toast: {
    position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
    padding: '12px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 1001,
    background: 'var(--lp-success-600)', color: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,.18)',
    display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
  },
  toastErr: { background: 'var(--lp-danger-600)' },
};
