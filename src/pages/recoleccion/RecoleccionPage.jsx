import { useState, useMemo, useCallback, useEffect, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import PageTabs from '../../components/ui/PageTabs';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useConfirm from '../../hooks/useConfirm';
import useIsDesktop from '../../hooks/useIsDesktop';
import humanizeError from '../../utils/humanizeError'; /* AUDIT UX 16-jul (U4) */
import { QRScanner } from '../../components/QRModal';
import { despacharScanSublote, extraerCodigoScan, resumenBulk } from '../../lib/scanSublote';
import PruebaBadge, { esPrueba } from '../../components/ui/PruebaBadge';
import {
  getAccionesSublote,
  LABELS_ACCION_SUBLOTE,
} from '../../lib/loteTransiciones';
import {
  ESTADO_LOTE_RECOLECCION,
  ESTADO_LOTE_EN_CAMINO,
  ESTADO_LOTE_EN_FABRICACION,
  ESTADO_ORDEN_PRODUCIENDO,
} from '../../lib/estados';

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
  if (ESTADO_LOTE_RECOLECCION.includes(e)) return 'pendientes';
  if (ESTADO_LOTE_EN_CAMINO.includes(e)) return 'enCamino';
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
/* JUL 2026: `embedded` — la pantalla también vive como vista del hub "Logística"
   (/transferencias) del admin (patrón AlmacenPage). Solo suprime su TopBar. */
export default function RecoleccionPage({ embedded = false }) {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [confirm, ConfirmEl] = useConfirm();
  const userName = user?.nombre || '?';
  const rol = user?.rol || '';
  /* Pestaña activa deep-linkeable vía ?tab= (p.ej. /recoleccion?tab=enCamino
     desde el asistente). Inicializa y re-sincroniza desde la URL validada. */
  const [searchParams] = useSearchParams();
  const TABS_VALIDOS = ['enProceso', 'pendientes', 'enCamino', 'entregados'];
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get('tab');
    return (t && TABS_VALIDOS.includes(t)) ? t : 'pendientes';
  });
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TABS_VALIDOS.includes(t)) setActiveTab(t);
  }, [searchParams]);
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

  /* AUDIT UX 16-jul (U19): polling 5s/8s → 30s/45s; respaldo; el WS empuja
     (onTrazabilidad/onOrdenes abajo). El polling agresivo drenaba la batería
     del teléfono de Luis sin aportar frescura real. */
  const { data: trazData, loading, reload } = useApiData(() => api.getTrazabilidad(), [], 30000);
  /* Órdenes — para la sub-pestaña "En proceso": Josué VIGILA lo que fábrica está
     produciendo (incluye órdenes que aún no crearon lote, p.ej. recién arrancadas
     en el asistente). Solo lectura. Polling moderado + WS. */
  const { data: ordData, reload: reloadOrd } = useApiData(() => api.getOrdenes(), [], 45000);

  /* FIX jun 2026 (K1): Luis necesita ver INSTANTÁNEAMENTE cuando un nuevo
     sublote se marca como listo para recolectar. 5s de polling = pierde
     turnos contra otros recolectores en futuro. Realtime cierra el gap. */
  useRealtimeSync({
    onTrazabilidad: () => reload(),
    onOrdenes: () => reloadOrd(),
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

  /* "En proceso" (solo lectura) — lo que fábrica está produciendo, ANTES de que
     un sublote esté listo para recolectar. Cuando se envase, sus sublotes pasan a
     "Por recoger". Excluye pruebas. Dos fuentes:
       · LOTES en fabricación (producido / QC), aún sin envasar.
       · ÓRDENES en producción que TODAVÍA no crearon lote (recién arrancadas). */
  const allOrdenes = useMemo(() => {
    const arr = ordData?.data || ordData || [];
    return Array.isArray(arr) ? arr.filter(o => o && !o.eliminado) : [];
  }, [ordData]);

  const enProceso = useMemo(() => {
    const out = [];
    const LOTE_PROC = ESTADO_LOTE_EN_FABRICACION; /* fuente única: lib/estados */
    allLotes.forEach(l => {
      if (l.esPrueba || !LOTE_PROC.includes(l.estado)) return;
      out.push({
        key: 'L_' + (l.codigoLote || l.codigo || l.id),
        codigo: l.codigoLote || l.codigo || l.id,
        producto: l.producto || l.nombre || l.formula || '—',
        detalle: Number(l.litrosTotal) ? `${Number(l.litrosTotal).toLocaleString('es-MX')} L` : (l.cantidad ? `${l.cantidad} cub` : ''),
        quien: l.usuario || l.creadoPor || l.produccionIniciadaPor || '',
        estado: l.estado, tipo: 'lote',
      });
    });
    /* Órdenes en producción que aún NO tienen lote (si ya hay lote, se muestra arriba). */
    const conLote = new Set();
    allLotes.forEach(l => { [l.ordenId, l.ordenCodigo, l.pedidoId].forEach(k => k && conLote.add(k)); });
    allOrdenes.forEach(o => {
      if (o.esPrueba || !ESTADO_ORDEN_PRODUCIENDO.includes(o.estado)) return;
      if (conLote.has(o.id) || conLote.has(o.codigo) || (o.pedidoId && conLote.has(o.pedidoId))) return;
      out.push({
        key: 'O_' + (o.codigo || o.id),
        codigo: o.codigo || o.id,
        producto: o.producto || o.formula || '—',
        detalle: o.cantidad ? `${o.cantidad} cub` : '',
        quien: o.usuario || o.creadoPor || '',
        estado: o.estado, tipo: 'orden',
      });
    });
    return out;
  }, [allLotes, allOrdenes]);

  const enProcesoFiltrado = useMemo(() => {
    if (!searchQ) return enProceso;
    const q = searchQ.toLowerCase();
    return enProceso.filter(x => (x.producto || '').toLowerCase().includes(q) || (x.codigo || '').toLowerCase().includes(q));
  }, [enProceso, searchQ]);

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
    /* DECISIÓN OWNER jun 2026 (refinada): "Voy por él" NO abre la cámara —
       es un cambio de status directo que los demás ven por el sync de
       trazabilidad. El guard scanCod===cod se satisface con el cod de la
       card (click = confirmación visual del sublote elegido). El escaneo
       físico queda como camino paralelo en el hero "Leer QR" (identificar
       la cubeta correcta entre varias). Recibir en Terán NO vive aquí —
       es botón único de Josué en Recepción (siempre vía escáner). */
    if (accion === 'escanearRecibirTeran') {
      setScanIntent(accion);
      setScannerOpen(true);
      return;
    }
    const label = LABELS_ACCION_SUBLOTE[accion] || accion;
    /* AUDIT UX 16-jul (U10): confirm ELIMINADO — el propio comentario de arriba
       dice que el tap en la card YA es la confirmación visual del sublote
       elegido; el diálogo duplicaba el gesto (2 taps) en la tarea más
       repetitiva de Luis. El toast de abajo confirma el resultado. */
    setBusy(sublote.cod);
    try {
      const payload = { usuario: userName };
      if (accion === 'escanearRecoger') payload.scanCod = sublote.cod;
      await api.transicionSublote(sublote.cod, accion, payload);
      reload();
      showToast(`${sublote.cod}: ${label.toLowerCase()}`);
    } catch (err) {
      showToast(humanizeError(err), true); /* AUDIT UX 16-jul (U4) */
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
    } catch {}
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
      setTimeout(() => { try { ctx.close(); } catch {} }, 200);
    } catch {}
  }, []);

  const feedbackScanError = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([200]); /* largo = error */
      }
    } catch {}
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
      setTimeout(() => { try { ctx.close(); } catch {} }, 400);
    } catch {}
  }, []);

  /* Resultado del scan: dispatch al server con la acción permitida por rol.
     Si el QR escaneado resulta ser el del LOTE (no de sublote individual), el
     backend devuelve 409 con matchTipo='lote_no_sublote' y un loteId. En ese
     caso ofrecemos al usuario procesar TODOS los sublotes elegibles del lote
     en una sola operación (bulk scan). */
  /* P2 (21-jul-2026): despacho vía protocolo compartido lib/scanSublote —
     la presentación (toasts, haptic) sigue siendo de esta pantalla. */
  const handleScan = useCallback(async (result) => {
    setScannerOpen(false);
    const code = extraerCodigoScan(result);
    if (!code) { feedbackScanError(); return showToast('QR no reconocido', true); }

    /* Acción: la del botón que abrió el escáner (scanIntent), o la default por
       rol (recolector/admin → escanearRecoger) cuando se usa el hero "Leer QR". */
    const accion = scanIntent
      || ((rol === 'recolector' || rol === 'admin') ? 'escanearRecoger' : null);
    setScanIntent(null);
    if (!accion) { feedbackScanError(); return showToast('No tienes permisos para recoger (solo recolector/admin)', true); }

    setBusy(code);
    await despacharScanSublote({
      code, accion, confirm,
      bulk: {
        pregunta: (d) => `Escaneaste el QR del LOTE ${d.codigoLote}. ¿Tomar TODOS los sublotes elegibles del lote en una sola acción?`,
        confirmText: 'Tomar todo el lote',
      },
      onSublote: (r) => { reload(); feedbackScanOK(); showToast(`Recogido: ${r?.sublote?.cod || code}`); },
      onBulk: (r2) => { reload(); feedbackScanOK(); showToast(`Lote completo recogido: ${resumenBulk(r2)}`); },
      onError: (err) => { feedbackScanError(); showToast(humanizeError(err), true); },
    });
    setBusy(null);
  }, [rol, reload, showToast, confirm, feedbackScanOK, feedbackScanError, scanIntent]);

  /* canScan: quién puede usar el hero "Leer QR" (handleScan gatea por rol).
     Las acciones por card las decide la state machine (getAccionesSublote). */
  const canScan = rol === 'admin' || rol === 'recolector';

  if (loading) {
    return (
      <>
        {!embedded && <TopBar title="Recolección" />}
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  /* Lista de tabs (compartida móvil/escritorio) */
  const TABS = [
    { id: 'enProceso',  label: `En proceso · ${enProceso.length}` },
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
      {!embedded && <TopBar title="Recolección" />}
      <div style={isDesktop ? S.wrapDesktop : S.wrapMobile}>

        {/* Saludo + contador (subtítulo .tsub del mockup — TopBar no trae subtitle) */}
        <div style={S.greet}>Hola {userName} · {pendientes.length} por recoger</div>

        {/* HERO "Leer QR" — móvil: ancho completo; escritorio: botón auto.
            Mismo efecto que "Voy por él" pero identificando la cubeta por su
            QR físico (decisión owner jun 2026: el escaneo de Luis vive aquí). */}
        {canScan && (
          isDesktop ? (
            <div style={S.scanRowDesktop}>
              <button
                style={S.scanBtnDesktop}
                onClick={() => { setScanIntent(null); setScannerOpen(true); }}
                aria-label="Leer QR de sublote"
              >
                <IconQR size={20} />
                Leer QR
              </button>
            </div>
          ) : (
            <button
              style={S.scanHeroMobile}
              onClick={() => setScannerOpen(true)}
              aria-label="Leer QR de sublote"
            >
              <IconQR size={24} />
              Leer QR
            </button>
          )
        )}

        {/* TABS tipo pill (estilo mockup: móvil = 3 pills flex:1 que reparten
            el ancho; escritorio = pills compactas a la izquierda) */}
        <PageTabs
          tabs={TABS.map(t => ({ ...t, style: (a) => S.tab(a, isDesktop) }))}
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
        {activeTab === 'enProceso' ? (
          /* "En proceso" — solo lectura: Josué vigila la producción en curso. */
          enProcesoFiltrado.length === 0 ? (
            <div style={S.empty}>
              <IconCheck size={40} />
              <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>{searchQ ? 'Sin resultados' : 'Nada en producción ahora.'}</div>
              {!searchQ && (
                <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--lp-text-tertiary)' }}>
                  Aquí ves lo que fábrica está produciendo. Cuando se envase, pasará a “Por recoger”.
                </div>
              )}
            </div>
          ) : (
            <div style={isDesktop ? S.grid3 : undefined}>
              {enProcesoFiltrado.map(it => <ProcesoCard key={it.key} item={it} />)}
            </div>
          )
        ) : filteredSublotes.length === 0 ? (
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
        /* AUDIT UX 16-jul (U20): anunciar el toast a lectores de pantalla */
        <div role="status" aria-live="polite" style={{ ...S.toast, ...(toast.isErr ? S.toastErr : {}) }}>
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
/* Card de sublote — diseño "glass forest" con banda de estado (handoff  */
/* Card Tote Listo 3a, jun 2026). Misma card en escritorio y móvil.      */
/*   ┌ banda tinte: ✓ "Listo para recolectar" ........ folio ┐          */
/*   │ Producto (22/500)                                      │          */
/*   │ 1 tote · 988 L · LP-…                                  │          │
/*   │ [ Fábrica  →  Almacén Terán ]  (panel blanco)          │          │
/*   │ [ Voy por él ]  (pill verde, camión)                   │          │
/*   └─────────────────────────────────────────────────────────┘        │
/* La LÓGICA se conserva (acciones state-machine, scan, buckets,         */
/* esPrueba); solo cambia la presentación. La banda cambia color/label/  */
/* icono por bucket (Listo/En camino/Entregado). */
/* ═══════════════════════════════════════════════════════════════════ */
const RC_FOREST = '#0f7a5a', RC_TXT = '#16201c', RC_TXT2 = '#5a6b63';

/* Banda de estado por bucket (color forest / azul en-camino). */
function bandMeta(bucket) {
  if (bucket === 'enCamino') return { label: 'En camino', fg: '#1f6aa6', icon: 'truck' };
  if (bucket === 'entregados') return { label: 'Entregado en Terán', fg: RC_FOREST, icon: 'check' };
  return { label: 'Listo para recolectar', fg: RC_FOREST, icon: 'check' };
}

const RC = {
  card: { background: 'rgba(250,253,252,0.72)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: '1px solid rgba(255,255,255,0.55)', borderRadius: 24, boxShadow: '0 18px 50px rgba(80,140,110,.20),0 4px 12px rgba(80,140,110,.10)', overflow: 'hidden', display: 'flex', flexDirection: 'column', marginBottom: 12, fontFamily: 'var(--lp-font-sans)' },
  band: (fg) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 24px', background: `color-mix(in srgb, ${fg} 10%, transparent)`, borderBottom: `1px solid color-mix(in srgb, ${fg} 12%, transparent)` }),
  bandIcon: (fg) => ({ width: 26, height: 26, borderRadius: '50%', background: fg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
  bandLabel: (fg) => ({ fontSize: 14, fontWeight: 500, color: fg }),
  bandFolio: (fg) => ({ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: fg, letterSpacing: '.02em', fontFamily: 'var(--lp-font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%' }),
  body: { padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 22, fontWeight: 500, letterSpacing: '-.01em', color: RC_TXT, lineHeight: 1.2 },
  meta: { fontSize: 13, color: RC_TXT2, marginTop: 4, lineHeight: 1.5 },
  metaB: { color: RC_TXT, fontWeight: 500 },
  route: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid rgba(0,0,0,.06)', borderRadius: 14, padding: '13px 16px', boxShadow: '0 1px 2px rgba(0,0,0,.04)', flexWrap: 'wrap' },
  routeFrom: { fontSize: 14, fontWeight: 500, color: RC_TXT },
  routeTo: { fontSize: 14, fontWeight: 500, color: RC_FOREST },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 500, color: '#fff', background: RC_FOREST, border: 'none', borderRadius: 99, padding: 14, minHeight: 50, boxShadow: '0 8px 18px rgba(15,122,90,.30)' },
  doneHint: { fontSize: 12.5, color: RC_TXT2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  pruebaNote: { padding: '10px 12px', background: 'rgba(182,121,29,.10)', border: '1px solid rgba(182,121,29,.35)', borderRadius: 12, fontSize: 12.5, color: '#9a6a13', lineHeight: 1.4 },
};

function BandIcon({ kind }) {
  if (kind === 'truck') return <IconTruck size={15} />;
  if (kind === 'flask') return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.3h12.4a1.5 1.5 0 0 0 1.3-2.3L14 9.5V3" /><path d="M7 15h10" /></svg>
  );
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
  );
}

/* ProcesoCard — card de SOLO LECTURA para la sub-pestaña "En proceso": Josué
   vigila lo que fábrica produce. Sin acciones; al envasarse pasa a "Por recoger". */
function faseProceso(estado) {
  if (estado === 'qc_hold') return { label: 'QC retenido', fg: '#b3261e' };
  if (estado === 'qc_aprobado') return { label: 'QC aprobado', fg: '#0f7a5a' };
  if (estado === 'producido') return { label: 'Producido — por envasar', fg: '#9a6a13' };
  return { label: 'En producción', fg: '#1f6aa6' };
}
function ProcesoCard({ item }) {
  const f = faseProceso(item.estado);
  return (
    <div style={RC.card}>
      <div style={RC.band(f.fg)}>
        <span style={RC.bandIcon(f.fg)}><BandIcon kind="flask" /></span>
        <span style={RC.bandLabel(f.fg)}>{f.label}</span>
        <span style={RC.bandFolio(f.fg)}>{item.codigo}</span>
      </div>
      <div style={RC.body}>
        <div>
          <div style={RC.title}>{item.producto}</div>
          <div style={RC.meta}>
            {item.detalle && <b style={RC.metaB}>{item.detalle}</b>}
            {item.quien ? `${item.detalle ? ' · ' : ''}produce ${item.quien}` : ''}
          </div>
        </div>
        <div style={RC.doneHint}>
          <BandIcon kind="flask" /> En fábrica — aparecerá en “Por recoger” al envasarse
        </div>
      </div>
    </div>
  );
}

function SubloteCard({ sublote: s, rol, busy, onAccion }) {
  const lote = s._lote || {};
  const esLotePrueba = esPrueba(lote);
  const esSublotePrueba = esPrueba(s);
  const producto = lote.producto || lote.formula || lote.nombre || '—';
  const codLote = lote.codigoLote || lote.codigo || lote.id;

  const bucket = bucketOfSublote(s);
  /* Destino según estado: entregados parten de Terán; resto Fábrica → Terán */
  const origen = bucket === 'entregados' ? 'Almacén Terán' : 'Fábrica';
  const band = bandMeta(bucket);

  /* Acciones permitidas por la state machine real para este rol.
     Excluimos cancelarSublote (anulación admin) y escanearRecibirTeran
     (recepción de Josué, no de Luis). En 'entregados' no hay acciones. */
  const acciones = bucket === 'entregados'
    ? []
    : getAccionesSublote(s, rol).filter(a => a !== 'cancelarSublote' && a !== 'escanearRecibirTeran');

  /* Meta "1 tote · 988 L · LP-… · marca · ↳ tote" (conserva extras). */
  const metaParts = [];
  if (s.qty != null) metaParts.push(<b style={RC.metaB}>{s.qty} {s.tipo || 'cubetas'}</b>);
  if (s.lit) metaParts.push(<b style={RC.metaB}>{s.lit} L</b>);
  if (codLote) metaParts.push(<span style={{ fontFamily: 'var(--lp-font-mono)' }}>{codLote}</span>);
  if (s.marca) metaParts.push(<b style={RC.metaB}>{s.marca}</b>);
  if (s.esHijoDe) metaParts.push(<span style={{ color: '#d4537e' }}>↳ tote {s.esHijoDe}</span>);

  return (
    <div style={RC.card}>
      {/* Banda de estado: icono + label + folio */}
      <div style={RC.band(band.fg)}>
        <span style={RC.bandIcon(band.fg)}><BandIcon kind={band.icon} /></span>
        <span style={RC.bandLabel(band.fg)}>{band.label}</span>
        <span style={RC.bandFolio(band.fg)}>{s.cod}</span>
      </div>

      {/* Cuerpo */}
      <div style={RC.body}>
        <div>
          <div style={RC.titleRow}>
            <span style={RC.title}>{producto}</span>
            {(esSublotePrueba || esLotePrueba) && <PruebaBadge size="sm" />}
          </div>
          <div style={RC.meta}>
            {metaParts.map((m, i) => <Fragment key={i}>{i > 0 ? ' · ' : ''}{m}</Fragment>)}
          </div>
        </div>

        {/* Aviso de prueba: Luis no recolecta físicamente */}
        {esLotePrueba && (
          <div style={RC.pruebaNote}>
            Este lote es de prueba — no recolectes físicamente, sólo simula el flujo.
          </div>
        )}

        {/* Ruta Fábrica → Terán (panel blanco) */}
        <div style={RC.route}>
          <span style={RC.routeFrom}>{origen}</span>
          <span style={{ display: 'inline-flex', color: RC_FOREST }}><IconArrow size={18} /></span>
          <span style={RC.routeTo}>Almacén Terán</span>
        </div>

        {/* Acción dominante por estado (state machine + data-id/data-rol). */}
        {acciones.length > 0 ? (
          acciones.map(a => {
            const meta = ACCION_BTN[a] || {
              label: LABELS_ACCION_SUBLOTE[a] || a,
              dataId: `recoleccion.btn.${a}`,
              dataRol: 'recolector,admin',
              Icon: IconArrow,
            };
            const Ico = meta.Icon;
            return (
              <button
                key={a}
                data-id={meta.dataId}
                data-rol={meta.dataRol}
                style={RC.btnPrimary}
                disabled={busy}
                onClick={() => onAccion(s, a)}
              >
                {busy ? <span aria-hidden="true">…</span> : <><Ico size={18} /> {meta.label}</>}
              </button>
            );
          })
        ) : bucket === 'enCamino' ? (
          /* En camino: la recepción la confirma SOLO Terán por QR (Recepción de
             Josué) — aquí solo una pista pasiva, sin atajo duplicado. */
          <div style={RC.doneHint}>
            <IconTruck size={15} /> Terán lo recibe por QR
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Estilos — SOLO tokens var(--lp-*). Claro y oscuro salen solos.       */
/* ═══════════════════════════════════════════════════════════════════ */
const S = {
  wrapMobile: { padding: '4px 16px 100px' },
  wrapDesktop: { padding: '8px 24px 48px' },
  /* subtítulo "Hola Luis · N por recoger" (.tsub del mockup) */
  greet: { fontSize: 12.5, color: 'var(--lp-text-secondary)', margin: '2px 2px 12px' },

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

  /* tabs pill (estilo mockup): activo verde sólido. Móvil = .tab{flex:1}
     del mockup (las 3 reparten el ancho, inactivas transparentes);
     escritorio = pills compactas con fondo sunken. */
  tabs: {
    display: 'flex', gap: 4, marginBottom: 14, overflowX: 'auto',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
  },
  tab: (active, isDesktop) => ({
    ...(isDesktop
      ? { flexShrink: 0, padding: '9px 16px', background: active ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)' }
      : { flex: 1, padding: '9px 6px', background: active ? 'var(--lp-brand-600)' : 'transparent' }),
    borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: active ? 600 : 500,
    color: active ? '#fff' : 'var(--lp-text-secondary)',
    whiteSpace: 'nowrap', minHeight: 44,
  }),

  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 200, maxWidth: 420, height: 44, padding: '0 14px', borderRadius: 10,
    /* AUDIT UX 16-jul (U15): 16px mínimo en inputs — <16 fuerza zoom en iOS */
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 16,
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
  prod: { fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--lp-text-primary)' },
  qty: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3 },
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
    width: '100%', height: 54, borderRadius: 14, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 15.5, fontWeight: 600,
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

  /* toast oscuro invertido (.toast del mockup); error en danger */
  toast: {
    position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)',
    padding: '12px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 1001,
    background: 'var(--lp-text-primary)', color: 'var(--lp-bg-base)',
    boxShadow: '0 4px 16px rgba(0,0,0,.18)',
    display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', maxWidth: '90vw',
  },
  toastErr: { background: 'var(--lp-danger-600)', color: '#fff' },
};
