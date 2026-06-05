import { useState, useMemo, useCallback } from 'react';
import TopBar from '../../components/layout/TopBar';
import PageTabs from '../../components/ui/PageTabs';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useConfirm from '../../hooks/useConfirm';
import { QRScanner } from '../../components/QRModal';
import PruebaBadge, { esPrueba } from '../../components/ui/PruebaBadge';
import {
  ESTADO_SUBLOTE_LABEL,
  ESTADO_SUBLOTE_COLOR,
  getAccionesSublote,
  LABELS_ACCION_SUBLOTE,
} from '../../lib/loteTransiciones';

const B = (bg, fg) => ({
  display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 600,
  borderRadius: 6, background: bg, color: fg,
});

/* ──────────────────────────────────────────────────────────────────── */
/* RecoleccionPage refactorizada al state machine                       */
/* ──────────────────────────────────────────────────────────────────── */
/* Modelo: la unidad de trabajo de Luis es el SUBLOTE, no el lote.      */
/* Cada sublote tiene QR físico y avanza por su propio estado:          */
/*   envasado → en_recoleccion → en_camino → en_stock_teran             */
/* Luis dispara 'escanearRecoger' (envasado/en_recoleccion → en_camino) */
/* Josué (en AlmacenRecepcion) dispara 'escanearRecibirTeran'           */
/* ──────────────────────────────────────────────────────────────────── */

const S = {
  wrap: { padding: '0 20px 100px' },
  scanBar: {
    position: 'sticky', top: 0, zIndex: 5,
    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0',
    background: 'var(--lp-bg-base)',
    borderBottom: '1px solid var(--lp-border-subtle)',
    marginBottom: 16,
  },
  scanBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '14px 18px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg, var(--lp-brand-600), var(--lp-brand-700))',
    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', minHeight: 52,
    boxShadow: '0 4px 12px rgba(143,107,77,.25)',
  },
  tabs: {
    display: 'flex', gap: 0, borderBottom: '2px solid var(--lp-border-subtle)',
    marginBottom: 16, overflowX: 'auto',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
  },
  tab: (active) => ({
    padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
    borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
    background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: 'var(--lp-font-sans)', marginBottom: -2, flexShrink: 0,
  }),
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10, marginBottom: 16,
  },
  kpi: (accent) => ({
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)', padding: '14px 16px',
    borderTop: `3px solid ${accent}`, textAlign: 'center',
  }),
  kpiLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-tertiary)' },
  kpiValue: { fontSize: 24, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', marginTop: 4 },
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  card: {
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 10,
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    flexWrap: 'wrap', marginBottom: 6,
  },
  loteCode: { fontWeight: 700, fontSize: 12, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 8 },
  btnPrimary: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-brand-600)', color: '#fff', minHeight: 44,
  },
  btnSuccess: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-success-600)', color: '#fff', minHeight: 44,
  },
  sublote: {
    padding: '10px 12px', borderRadius: 8, marginBottom: 6,
    border: '1px solid var(--lp-border-subtle)', fontSize: 12,
    background: 'var(--lp-bg-sunken)',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  subloteHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  subloteCod: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 12 },
  subloteActions: { display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  smallBtn: {
    padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 11,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-brand-600)', color: '#fff', minHeight: 36,
  },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0', fontSize: 13 },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
  toast: {
    position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 1001,
    background: 'var(--lp-success-600)', color: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,.15)',
  },
  toastErr: { background: 'var(--lp-danger-600)' },
};

/* Estado UI: agrupa sublote.estado en buckets visuales para el rol Luis */
function bucketOfSublote(s) {
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
    return ub === 'fabrica' ? 'pendientes' : null; /* tote_activo en Terán = en buffer, no pendiente */
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
  const [confirm, ConfirmEl] = useConfirm();
  const userName = user?.nombre || '?';
  const rol = user?.rol || '';
  const [activeTab, setActiveTab] = useState('pendientes');
  const [searchQ, setSearchQ] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(null); // sublote.cod while saving
  const [scannerOpen, setScannerOpen] = useState(false);

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
        if (s.claseSublote === 'tote' && s.estado === 'tote_activo') return; /* TOTE activo no se recolecta directo */
        out.push({ ...s, _lote: lote });
      });
    });
    return out;
  }, [allLotes]);

  /* Buckets */
  const pendientes = useMemo(() => allSublotes.filter(s => bucketOfSublote(s) === 'pendientes'), [allSublotes]);
  const enCamino   = useMemo(() => allSublotes.filter(s => bucketOfSublote(s) === 'enCamino'),   [allSublotes]);
  const entregados = useMemo(() => allSublotes.filter(s => bucketOfSublote(s) === 'entregados'), [allSublotes]);

  const kpis = useMemo(() => ({
    pendientes: pendientes.length,
    enCamino: enCamino.length,
    entregados: entregados.length,
  }), [pendientes, enCamino, entregados]);

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

  /* Agrupar sublotes por lote para renderizar cards */
  const groupedByLote = useMemo(() => {
    const map = new Map();
    filtered.forEach(s => {
      const lid = s._lote?.id || s._lote?.codigoLote || 'sin-lote';
      if (!map.has(lid)) map.set(lid, { lote: s._lote, sublotes: [] });
      map.get(lid).sublotes.push(s);
    });
    return Array.from(map.values());
  }, [filtered]);

  /* Ejecutar transición de sublote vía state machine */
  const doTransicion = useCallback(async (sublote, accion) => {
    const label = LABELS_ACCION_SUBLOTE[accion] || accion;
    const ok = await confirm(`¿${label}: ${sublote.cod}?`, { confirmText: label });
    if (!ok) return;
    setBusy(sublote.cod);
    try {
      await api.transicionSublote(sublote.cod, accion, { usuario: userName });
      reload();
      showToast(`${sublote.cod}: ${label.toLowerCase()} ✓`);
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

    const accion = (rol === 'recolector' || rol === 'admin')
      ? 'escanearRecoger'
      : null;
    if (!accion) { feedbackScanError(); return showToast('No tienes permisos para recoger (solo recolector/admin)', true); }

    setBusy(code);
    try {
      const r = await api.escanearSublote(code, accion);
      reload();
      const subloteCod = r?.sublote?.cod || code;
      feedbackScanOK();
      showToast(`Recogido: ${subloteCod} ✓`);
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
            const r = await api.escanearLoteBulk({ loteId: data.loteId, accion });
            reload();
            const n = r?.procesados?.length || 0;
            const omit = r?.omitidos?.length || 0;
            feedbackScanOK();
            showToast(`Lote completo recogido: ${n} sublote(s)${omit ? ` · ${omit} omitido(s)` : ''} ✓`);
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
  }, [rol, reload, showToast, confirm, feedbackScanOK, feedbackScanError]);

  const canAct = rol === 'admin' || rol === 'tecnico' || rol === 'almacen' || rol === 'recolector';

  if (loading) {
    return (
      <>
        <TopBar title="Recolección" />
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  /* ────────────── VISTA SIMPLE PARA RECOLECTOR (Luis) ──────────────
     Luis es un ejecutor: ve QUÉ recoger antes de salir, escanea el QR cuando
     llega a fábrica, y puede validar QUÉ lleva consigo antes de salir hacia
     Terán. Tres bloques claros:
       1) Bloque "Por recoger" — número grande + lista mínima con producto/cantidad
       2) Botón gigante "Escanear QR"
       3) Bloque "Llevo conmigo" (colapsable) — lo escaneado pendiente de entregar
     Sin tabs ni búsqueda — Luis no es admin.                                  */
  if (rol === 'recolector') {
    return <VistaRecolector
      kpis={kpis}
      pendientes={pendientes}
      enCamino={enCamino}
      scannerOpen={scannerOpen}
      setScannerOpen={setScannerOpen}
      handleScan={handleScan}
      toast={toast}
      ConfirmEl={ConfirmEl}
      onRefresh={reload}
    />;
  }

  /* ────────────── VISTA COMPLETA (admin, almacén, tecnico) ────────────── */
  return (
    <>
      <TopBar title="Recolección" />
      <div style={S.wrap}>
        {/* Active scanner CTA */}
        {canAct && (
          <div style={S.scanBar}>
            <button
              style={S.scanBtn}
              onClick={() => setScannerOpen(true)}
              aria-label="Escanear QR de sublote"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                <rect x="7" y="7" width="10" height="10" rx="1"/>
              </svg>
              Escanear QR
            </button>
          </div>
        )}

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div style={S.kpi('#7C3AED')}>
            <div style={S.kpiLabel}>Por Recoger</div>
            <div style={S.kpiValue}>{kpis.pendientes}</div>
          </div>
          <div style={S.kpi('var(--lp-warning-600)')}>
            <div style={S.kpiLabel}>En Camino</div>
            <div style={S.kpiValue}>{kpis.enCamino}</div>
          </div>
          <div style={S.kpi('var(--lp-success-600)')}>
            <div style={S.kpiLabel}>Entregados</div>
            <div style={S.kpiValue}>{kpis.entregados}</div>
          </div>
        </div>

        {/* Tabs */}
        <PageTabs
          tabs={[
            { id: 'pendientes', label: `Por Recoger (${pendientes.length})`, style: (a) => S.tab(a) },
            { id: 'enCamino', label: `En Camino (${enCamino.length})`, style: (a) => S.tab(a) },
            { id: 'entregados', label: `Entregados (${entregados.length})`, style: (a) => S.tab(a) },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          style={S.tabs}
        />

        {/* Search */}
        <div style={S.toolbar}>
          <input type="text" style={S.search} placeholder="Buscar sublote, código o producto..."
            value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>

        {/* Sublotes agrupados por lote */}
        {groupedByLote.length === 0 ? (
          <div style={{ ...S.empty, padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚚</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>
              {searchQ ? 'Sin resultados' : 'No hay sublotes en esta categoría'}
            </div>
            {!searchQ && activeTab === 'pendientes' && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                Cuando fábrica envase un lote, sus sublotes aparecerán aquí listos para recoger.
              </div>
            )}
          </div>
        ) : (
          groupedByLote.map(({ lote, sublotes }) => (
            <div key={lote?.id || lote?.codigoLote || Math.random()} style={S.card}>
              <div style={S.cardHeader}>
                <span style={S.loteCode}>{lote?.codigoLote || lote?.codigo || lote?.id}</span>
                <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                  {sublotes.length} sublote(s)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={S.cardTitle}>{lote?.producto || lote?.formula || lote?.nombre}</div>
                {/* FIX jun 2026 (N7): Luis debe ver claramente si es prueba para
                    no recolectar físicamente. */}
                {esPrueba(lote) && <PruebaBadge size="md" />}
              </div>
              <div style={S.cardMeta}>
                {lote?.cantidad && `${lote.cantidad} cubetas`}
                {lote?.litrosTotal && ` · ${lote.litrosTotal} L totales`}
                {lote?.ordenCodigo && ` · ${lote.ordenCodigo}`}
              </div>
              {esPrueba(lote) && (
                <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--lp-warning-50)', border: '1.5px solid var(--lp-warning-300)', borderRadius: 8, fontSize: 12, color: 'var(--lp-warning-800)' }}>
                  Este lote es de prueba — no recolectes físicamente, sólo simula el flujo.
                </div>
              )}

              {sublotes.map(s => {
                const acciones = getAccionesSublote(s, rol);
                const estColor = ESTADO_SUBLOTE_COLOR[s.estado] || 'var(--lp-text-tertiary)';
                const estLabel = ESTADO_SUBLOTE_LABEL[s.estado] || s.estado || '—';
                const isBusy = busy === s.cod;
                return (
                  <div key={s.cod} style={S.sublote}>
                    <div style={S.subloteHeader}>
                      <span style={S.subloteCod}>{s.cod}</span>
                      {(esPrueba(s) || esPrueba(lote)) && <PruebaBadge size="sm" />}
                      <span style={B(estColor + '22', estColor)}>{estLabel}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text-secondary)' }}>
                      {s.qty} {s.tipo} · {s.lit}L
                      {s.marca && <> · <span style={{ fontWeight: 600 }}>{s.marca}</span></>}
                      {s.esHijoDe && <> · <span style={{ color: '#7C3AED' }}>↳ tote {s.esHijoDe}</span></>}
                    </div>
                    {/* Acciones permitidas por rol según state machine */}
                    {acciones.length > 0 && (
                      <div style={S.subloteActions}>
                        {acciones.filter(a => a !== 'cancelarSublote').map(a => (
                          <button
                            key={a}
                            style={{
                              ...S.smallBtn,
                              background: a === 'escanearRecoger' ? 'var(--lp-brand-600)'
                                       : a === 'escanearRecibirTeran' ? 'var(--lp-success-600)'
                                       : 'var(--lp-text-tertiary)',
                            }}
                            disabled={isBusy}
                            onClick={() => doTransicion(s, a)}
                          >
                            {isBusy ? '...' : (LABELS_ACCION_SUBLOTE[a] || a)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Scanner */}
      {scannerOpen && (
        <QRScanner
          onResult={handleScan}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, ...(toast.isErr ? S.toastErr : {}) }}>
          <span style={{ marginRight: 8 }}>{toast.isErr ? '✕' : '✓'}</span>{toast.msg}
        </div>
      )}
      {ConfirmEl}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Vista simplificada de Luis (rol=recolector)                         */
/*                                                                     */
/* Diseño:                                                             */
/*   ┌─ "Por recoger" ─ N gigante ─────────┐                          */
/*   │ • BLANCO MATE × 52 cub · LP-001     │                          */
/*   │ • GRIS PERLA × 24 cub · LP-002      │                          */
/*   └─────────────────────────────────────┘                          */
/*   ┌─[ ESCANEAR QR ]─────────────────────┐                          */
/*   └─────────────────────────────────────┘                          */
/*   ┌─ Llevo conmigo (2) ▾ ───────────────┐                          */
/*   │ Click para expandir y ver detalle   │                          */
/*   └─────────────────────────────────────┘                          */
/* ═══════════════════════════════════════════════════════════════════ */
function VistaRecolector({ kpis, pendientes, enCamino, scannerOpen, setScannerOpen, handleScan, toast, ConfirmEl, onRefresh }) {
  const [showCarga, setShowCarga] = useState(false);
  const pend = kpis.pendientes;

  /* Agrupar sublotes pendientes por lote para mostrar productos, no sublotes
     crípticos. Luis quiere ver "BLANCO MATE × 52", no "LP-2026-0522-001-A". */
  const pendientesByLote = useMemo(() => {
    const map = new Map();
    pendientes.forEach(s => {
      const lid = s._lote?.id || s._lote?.codigoLote || s.cod;
      if (!map.has(lid)) map.set(lid, { lote: s._lote, sublotes: [], cubetas: 0, litros: 0 });
      const entry = map.get(lid);
      entry.sublotes.push(s);
      entry.cubetas += parseInt(s.qty) || 0;
      entry.litros  += parseFloat(s.lit) || 0;
    });
    return Array.from(map.values());
  }, [pendientes]);

  const enCaminoByLote = useMemo(() => {
    const map = new Map();
    enCamino.forEach(s => {
      const lid = s._lote?.id || s._lote?.codigoLote || s.cod;
      if (!map.has(lid)) map.set(lid, { lote: s._lote, sublotes: [], cubetas: 0, litros: 0 });
      const entry = map.get(lid);
      entry.sublotes.push(s);
      entry.cubetas += parseInt(s.qty) || 0;
      entry.litros  += parseFloat(s.lit) || 0;
    });
    return Array.from(map.values());
  }, [enCamino]);

  const cargaCubetasTotal = enCaminoByLote.reduce((acc, g) => acc + g.cubetas, 0);

  const styles = {
    wrap: { padding: '0 16px 100px' },
    block: {
      background: 'var(--lp-bg-raised)',
      border: '1.5px solid var(--lp-border-subtle)',
      borderRadius: 'var(--lp-radius)',
      padding: '20px 18px',
      marginBottom: 14,
    },
    blockHeader: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12,
    },
    blockLabel: {
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.08em', color: 'var(--lp-text-tertiary)',
    },
    refreshBtn: {
      background: 'none', border: 'none', cursor: 'pointer',
      padding: 6, borderRadius: 6, color: 'var(--lp-text-tertiary)',
      display: 'flex', alignItems: 'center',
    },
    bigNum: {
      fontSize: 72, fontWeight: 800, fontFamily: 'var(--lp-font-mono)',
      color: pend > 0 ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
      lineHeight: 1, textAlign: 'center', margin: '4px 0 16px',
    },
    pendItem: {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 0', borderTop: '1px solid var(--lp-border-subtle)',
    },
    pendDot: {
      width: 8, height: 8, borderRadius: '50%',
      background: 'var(--lp-brand-600)', flexShrink: 0,
    },
    pendBody: { flex: 1, minWidth: 0 },
    pendProducto: {
      fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    },
    pendMeta: { fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2 },
    pendCubetas: {
      fontSize: 13, fontWeight: 700, fontFamily: 'var(--lp-font-mono)',
      color: 'var(--lp-text-primary)', flexShrink: 0,
    },
    scanBtn: (active) => ({
      width: '100%',
      padding: '24px 24px', borderRadius: 18, border: 'none',
      background: active
        ? 'linear-gradient(135deg, var(--lp-brand-600), var(--lp-brand-700))'
        : 'var(--lp-bg-sunken)',
      color: active ? '#fff' : 'var(--lp-text-tertiary)',
      fontSize: 19, fontWeight: 800, cursor: active ? 'pointer' : 'not-allowed',
      fontFamily: 'var(--lp-font-sans)', minHeight: 84,
      boxShadow: active ? '0 8px 28px rgba(37,99,235,.32)' : 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
      marginBottom: 14,
      /* Z4 (jun 2026): pulse sutil cuando hay pendientes — refuerza CTA */
      animation: active ? 'lpPulse 2.4s ease-in-out infinite' : 'none',
    }),
    scanBtnSub: {
      fontSize: 12, fontWeight: 600, opacity: .85, letterSpacing: '.02em',
    },
    cargaHeader: {
      width: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', cursor: 'pointer',
      background: 'none', border: 'none', padding: 0,
      fontFamily: 'inherit', textAlign: 'left',
    },
    cargaTitle: {
      fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)',
    },
    cargaCount: {
      fontSize: 12, color: 'var(--lp-text-tertiary)', fontWeight: 600,
    },
    cargaChevron: (open) => ({
      width: 18, height: 18, transform: open ? 'rotate(180deg)' : 'rotate(0)',
      transition: 'transform 0.2s', color: 'var(--lp-text-tertiary)',
    }),
    helpText: {
      fontSize: 13, color: 'var(--lp-text-secondary)',
      textAlign: 'center', maxWidth: 340, margin: '0 auto 16px',
      lineHeight: 1.45,
    },
  };

  return (
    <>
      <TopBar title="Recolección" />
      <div style={{ ...styles.wrap, paddingTop: 16 }}>

        {/* ─── BLOQUE 1: Por recoger ─── */}
        <div style={styles.block}>
          <div style={styles.blockHeader}>
            <div style={styles.blockLabel}>Pedidos listos para recoger</div>
            <button
              style={styles.refreshBtn}
              onClick={onRefresh}
              title="Actualizar"
              aria-label="Actualizar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            </button>
          </div>

          <div style={styles.bigNum}>{pend}</div>

          {pend > 0 ? (
            <>
              <div style={{ ...styles.helpText, marginBottom: 8 }}>
                Estos son los lotes esperándote en fábrica:
              </div>
              <div>
                {pendientesByLote.map((g, i) => (
                  <div key={(g.lote?.id || i)} style={styles.pendItem}>
                    <span style={styles.pendDot} />
                    <div style={styles.pendBody}>
                      <div style={{ ...styles.pendProducto, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.lote?.producto || g.lote?.formula || g.lote?.nombre || '—'}
                        </span>
                        {esPrueba(g.lote) && <PruebaBadge size="sm" />}
                      </div>
                      <div style={styles.pendMeta}>
                        {g.lote?.codigoLote || g.lote?.codigo || g.lote?.id}
                        {g.litros ? ` · ${Math.round(g.litros)} L` : ''}
                      </div>
                    </div>
                    <div style={styles.pendCubetas}>×{g.cubetas}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={styles.helpText}>
              Sin pedidos pendientes. Te llegará una notificación cuando haya algo listo.
            </div>
          )}
        </div>

        {/* ─── BLOQUE 2: Botón Escanear (CTA dominante tipo delivery app) ───
            Z4 (jun 2026): label contextual — "Voy por él" cuando hay pendientes,
            "Escanear QR" cuando no. La frase "Voy por él" es la del owner
            y se usa también en banners de notif (consistencia léxica). */}
        <button
          style={styles.scanBtn(pend > 0)}
          disabled={pend === 0}
          onClick={() => setScannerOpen(true)}
          aria-label={pend > 0 ? 'Voy por él · Escanear QR de lote' : 'Escanear QR de lote'}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
            <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
            <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
            <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
            <rect x="7" y="7" width="10" height="10" rx="1"/>
          </svg>
          {pend > 0 ? 'Voy por él' : 'Escanear QR'}
          {pend > 0 && <span style={styles.scanBtnSub}>Toca para escanear el QR del lote</span>}
        </button>

        {/* ─── BLOQUE 3: Llevo conmigo (colapsable) ─── */}
        {enCaminoByLote.length > 0 && (
          <div style={styles.block}>
            <button
              style={styles.cargaHeader}
              onClick={() => setShowCarga(v => !v)}
              aria-expanded={showCarga}
              aria-controls="carga-detalle"
            >
              <div>
                <div style={styles.cargaTitle}>
                  Llevo conmigo: {enCaminoByLote.length} lote{enCaminoByLote.length === 1 ? '' : 's'}
                </div>
                <div style={styles.cargaCount}>
                  {cargaCubetasTotal} cubeta{cargaCubetasTotal === 1 ? '' : 's'} en total
                </div>
              </div>
              <svg style={styles.cargaChevron(showCarga)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showCarga && (
              <div id="carga-detalle" style={{ marginTop: 12 }}>
                {enCaminoByLote.map((g, i) => (
                  <div key={(g.lote?.id || i)} style={styles.pendItem}>
                    <span style={{ ...styles.pendDot, background: 'var(--lp-warning-600)' }} />
                    <div style={styles.pendBody}>
                      <div style={{ ...styles.pendProducto, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.lote?.producto || g.lote?.formula || g.lote?.nombre || '—'}
                        </span>
                        {esPrueba(g.lote) && <PruebaBadge size="sm" />}
                      </div>
                      <div style={styles.pendMeta}>
                        {g.lote?.codigoLote || g.lote?.codigo || g.lote?.id}
                        {g.litros ? ` · ${Math.round(g.litros)} L` : ''}
                      </div>
                    </div>
                    <div style={styles.pendCubetas}>×{g.cubetas}</div>
                  </div>
                ))}
                <div style={{ ...styles.helpText, marginTop: 14, fontSize: 12 }}>
                  Almacén Terán confirma la recepción al recibir.
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {scannerOpen && (
        <QRScanner onResult={handleScan} onClose={() => setScannerOpen(false)} />
      )}
      {toast && (
        <div style={{ ...S.toast, ...(toast.isErr ? S.toastErr : {}) }}>
          <span style={{ marginRight: 8 }}>{toast.isErr ? '✕' : '✓'}</span>{toast.msg}
        </div>
      )}
      {ConfirmEl}
    </>
  );
}
