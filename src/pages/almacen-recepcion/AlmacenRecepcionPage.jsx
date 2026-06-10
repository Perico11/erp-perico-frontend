import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { QRScanner } from '../../components/QRModal';
import PruebaBadge, { esPrueba } from '../../components/ui/PruebaBadge';
import useConfirm from '../../hooks/useConfirm';
import useIsDesktop from '../../hooks/useIsDesktop';
import { getAccionesSublote } from '../../lib/loteTransiciones';
import { ReenvasadoModal, SubloteQRPrintModal } from '../stock-fabrica/StockFabricaPage';

/* ──────────────────────────────────────────────────────────────────────────
   AlmacenRecepcionPage — Recepción Terán (Josué)
   Rediseño 1:1 con el mockup verde "Recepción Terán.html" (entrega_v2).
   Conserva TODO el wiring del state machine de sublotes:
     · escanearRecibirTeran (recibir 1 sublote)         → api.transicionSublote
     · escanear QR (1 sublote o lote completo)           → api.escanearSublote / escanearLoteBulk
     · reenvasarTote (TOTE en buffer → sublotes hijos)   → api.transicionSublote
   Gating real: solo admin/almacen actúan (canAct). data-rol="almacen,admin".
   ────────────────────────────────────────────────────────────────────────── */

const S = {
  /* móvil: una columna; escritorio: aprovecha el ancho del shell (sidebar + topbar) */
  wrap: { padding: '6px 20px 110px' },
  wrapDesktop: { padding: '8px 24px 48px' },
  greet: { fontSize: 12.5, color: 'var(--lp-text-secondary)', margin: '2px 2px 12px' },

  /* scan hero — botón verde, redondeado 18px (mockup) — MÓVIL: ancho completo */
  scanHero: (activo) => ({
    width: '100%', height: 64, borderRadius: 18, border: 'none', cursor: 'pointer',
    background: 'var(--lp-brand-600)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
    fontFamily: 'var(--lp-font-sans)', fontSize: 16, fontWeight: 700, marginBottom: 14,
    boxShadow: '0 10px 24px -10px color-mix(in srgb, var(--lp-brand-600) 60%, transparent)',
    animation: activo ? 'lpPulse 2.4s ease-in-out infinite' : 'none',
  }),
  /* escritorio: barra superior — botón tamaño estándar alineado a la derecha (no 100%) */
  scanRowDesktop: { display: 'flex', justifyContent: 'flex-end', marginBottom: 16 },
  scanBtnDesktop: (activo) => ({
    height: 44, minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: 'var(--lp-brand-600)', color: '#fff',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 8,
    boxShadow: '0 8px 20px -12px color-mix(in srgb, var(--lp-brand-600) 60%, transparent)',
    animation: activo ? 'lpPulse 2.4s ease-in-out infinite' : 'none',
  }),

  /* tabs pill */
  tabs: { display: 'flex', gap: 4, marginBottom: 12 },
  /* escritorio: pills alineadas a la izquierda, no estiradas a todo el ancho */
  tabsDesktop: { display: 'flex', gap: 6, marginBottom: 16 },
  tabDesktop: (on) => ({
    padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: on ? 700 : 500, minHeight: 44,
    background: on ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)',
    color: on ? '#fff' : 'var(--lp-text-secondary)', whiteSpace: 'nowrap',
  }),

  /* grid de cards (escritorio): 2-3 columnas auto-fill */
  grid: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' },
  tab: (on) => ({
    flex: 1, padding: '9px 6px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: on ? 700 : 500,
    background: on ? 'var(--lp-brand-600)' : 'transparent',
    color: on ? '#fff' : 'var(--lp-text-secondary)',
  }),

  /* card por sublote */
  card: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 18, padding: 16, marginBottom: 12 },
  /* escritorio: sin marginBottom (lo da el grid), flex-col para alinear el CTA abajo */
  cardDesktop: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column' },
  cardPrueba: { background: 'var(--lp-warning-50)', borderLeft: '4px solid var(--lp-warning-600)' },
  chead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 },
  cod: { fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-700)' },
  estado: (c) => ({ marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: c.bg, color: c.fg }),
  prod: { fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--lp-text-primary)' },
  qty: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3 },
  from: { display: 'flex', alignItems: 'center', gap: 8, margin: '13px 0', padding: '11px 13px', borderRadius: 12, background: 'var(--lp-bg-sunken)', fontSize: 13, color: 'var(--lp-text-secondary)' },
  pruebaNote: { marginTop: 11, padding: '9px 11px', background: 'var(--lp-warning-100)', border: '1.5px solid var(--lp-warning-500)', borderRadius: 11, fontSize: 12, color: 'var(--lp-warning-800)', lineHeight: 1.4 },

  act: { width: '100%', height: 54, borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 15.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9 },
  /* escritorio: CTA pegado al fondo de la card (alturas parejas en grid), un poco más compacto */
  actDesktop: { width: '100%', height: 44, minHeight: 44, marginTop: 'auto', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 13.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actPrimary: { background: 'var(--lp-brand-600)', color: '#fff' },
  actDone: { background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', border: '1px solid var(--lp-border-subtle)', cursor: 'default' },

  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', fontSize: 13.5, padding: '54px 20px', lineHeight: 1.5 },
  loading: { textAlign: 'center', color: 'var(--lp-text-tertiary)', fontSize: 13, padding: '40px 0' },

  /* TOTE buffer (funcionalidad real — no está en el mockup; se conserva) */
  toteBuffer: { background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-brand-300, color-mix(in srgb, var(--lp-brand-600) 30%, transparent))', borderLeft: '4px solid var(--lp-brand-600)', borderRadius: 18, padding: 16, marginBottom: 14 },
  toteTitle: { fontSize: 14, fontWeight: 700, color: 'var(--lp-brand-700)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 },
  toteSub: { fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 12 },
  toteGrid: { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' },
  toteCard: { background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, padding: 12 },

  toast: { position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)', padding: '12px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 1001, background: 'var(--lp-text-primary)', color: 'var(--lp-bg-base)', boxShadow: '0 4px 16px rgba(0,0,0,.15)', maxWidth: '88%', textAlign: 'center' },
  toastErr: { background: 'var(--lp-danger-600)', color: '#fff' },

  /* modal re-envasar (sin cambios funcionales) */
  overlay: { position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius, 16px)', width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.18)' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid var(--lp-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalBody: { padding: '16px 20px' },
  modalFooter: { padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '.04em' },
  fieldInput: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)', fontSize: 13, fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none', boxSizing: 'border-box', marginBottom: 12, color: 'var(--lp-text-primary)' },
  fieldSelect: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)', fontSize: 13, fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none', boxSizing: 'border-box', marginBottom: 12, appearance: 'auto', color: 'var(--lp-text-primary)' },
};

const QR_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M3 12h18" /></svg>
);
const TRUCK_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 4h13v12H1z" /><path d="M14 8h4l3 3v5h-7" /><circle cx="5.5" cy="18.5" r="2" /><circle cx="17.5" cy="18.5" r="2" /></svg>
);

/* ReenvasarToteModal local + buildQrUrl eliminados (jun 2026, censo dedup):
   era la 3a copia del modal de reenvasado, desincronizada. Se usa el
   ReenvasadoModal compartido de StockFabricaPage (con toteInicial). */

/* ── Tile .from del mockup: "Recolectó Luis · salió 11:40" ──
   Quién/hora salen del historial REAL del sublote (evento en_camino =
   Luis escaneó; en_stock_teran = recibido). Sin evento de salida no se
   inventa nada: la card cae al texto previo "codigo · Fábrica → Terán". */
const _hm = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    /* 24h como el mockup ("salió 11:40 · recibido 13:30") */
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return ''; }
};
function fromTileInfo(s, esRecibido) {
  const hist = Array.isArray(s?.historial) ? s.historial : [];
  const buscar = (estado) => {
    for (let i = hist.length - 1; i >= 0; i--) {
      const h = hist[i];
      if (h && h.estado === estado) return h;
    }
    return null;
  };
  const salida = buscar('en_camino');
  const llegada = esRecibido ? buscar('en_stock_teran') : null;
  if (salida && salida.usuario) {
    const t = llegada && llegada.fecha
      ? `recibido ${_hm(llegada.fecha)}`
      : (salida.fecha ? `salió ${_hm(salida.fecha)}` : '');
    return { verbo: 'Recolectó', who: salida.usuario, t };
  }
  /* Sublote nacido en Terán (hijo de re-envasado de TOTE): nunca viajó —
     "Recolectó" sería falso. Mostramos quién lo dio de alta en stock. */
  if (llegada && llegada.usuario) {
    return { verbo: 'Recibió', who: llegada.usuario, t: llegada.fecha ? _hm(llegada.fecha) : '' };
  }
  return null;
}

/* ─────────────── PAGE PRINCIPAL ─────────────── */
export default function AlmacenRecepcionPage() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const userName = user?.nombre || '?';
  const rol = user?.rol || '';
  const [confirm, ConfirmEl] = useConfirm();
  const [filter, setFilter] = useState('en_camino'); /* en_camino | en_almacen */
  const [scanning, setScanning] = useState(false);
  const [reenvaseFor, setReenvaseFor] = useState(null);
  const [printQR, setPrintQR] = useState(null);
  /* envases: marcas para el modal compartido de reenvasado */
  const { data: envDataRec } = useApiData(() => api.getEnvases(), null, 30000);
  const envases = envDataRec?.data || envDataRec || null;
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const showToast = useCallback((msg, isErr = false) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const { data: trazaData, loading, reload } = useApiData(() => api.getTrazabilidad(), [], 8000);
  useRealtimeSync({ onTrazabilidad: () => reload() });

  const lotes = useMemo(() => {
    const arr = trazaData?.data || trazaData || [];
    return (Array.isArray(arr) ? arr : []).filter(l => l && !l.eliminado);
  }, [trazaData]);

  const allSublotes = useMemo(() => {
    const out = [];
    lotes.forEach(lote => {
      (lote.sublotes || []).forEach(s => { if (s.esMerma) return; out.push({ ...s, _lote: lote }); });
    });
    return out;
  }, [lotes]);

  const sublotesEnCamino = useMemo(() =>
    allSublotes.filter(s => s.estado === 'en_camino' || (!s.estado && s.ub === 'fabrica' && (s._lote?.estado === 'en_camino' || s._lote?.estado === 'en_recoleccion'))),
    [allSublotes]);
  const totesActivos = useMemo(() =>
    allSublotes.filter(s => {
      const esTote = s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1;
      if (!esTote) return false;
      if (s.estado === 'tote_vaciado' || s.estado === 'cancelado') return false;
      if (s.ub !== 'teran' && s.estado !== 'tote_activo') return false;
      const lr = typeof s.litrosRestante === 'number' ? s.litrosRestante : Number(s.lit) || 0;
      return lr > 0.5;
    }), [allSublotes]);
  const sublotesEnAlmacen = useMemo(() => allSublotes.filter(s => s.estado === 'en_stock_teran'), [allSublotes]);

  const totales = useMemo(() => ({
    enCamino: sublotesEnCamino.length,
    totesActivos: totesActivos.length,
    enAlmacen: sublotesEnAlmacen.length,
  }), [sublotesEnCamino, totesActivos, sublotesEnAlmacen]);

  const lista = filter === 'en_camino' ? sublotesEnCamino : sublotesEnAlmacen;

  /* FIX jun 2026 (bug Josué): el atajo "Re-envasar TOTE" de la card del pedido
     llega aquí con ?reenvasar=<cod>. Auto-abrimos el modal de re-envasado para
     ese TOTE — antes solo aterrizaba en la página y Josué tenía que buscar el
     buffer y pulsar de nuevo. Si el TOTE aún no cargó (totesActivos vacío) NO
     limpiamos el param: reintenta cuando llegue la data. */
  useEffect(() => {
    const cod = searchParams.get('reenvasar');
    if (!cod || reenvaseFor) return;
    const tote = totesActivos.find(t => t.cod === cod) || totesActivos[0];
    if (tote) {
      setReenvaseFor({ tote, lote: tote._lote });
      searchParams.delete('reenvasar');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, totesActivos, reenvaseFor, setSearchParams]);

  /* Recibir un sublote en Terán vía state machine */
  /* jun 2026: se eliminó `recibirSublote` (confirmación manual). La recepción
     en Terán ahora es SOLO vía escaneo físico del QR de la cubeta — ver
     handleScanResult. No hay camino que se salte el escáner. */

  /* Scanner: dispatch al endpoint /sublotes/scan */
  const handleScanResult = useCallback(async (result) => {
    setScanning(false);
    const code = result?.cod || result?.raw || '';
    if (!code) return showToast('QR no reconocido', true);
    setBusy(code);
    try {
      const r = await api.escanearSublote(code, 'escanearRecibirTeran');
      reload();
      const s = r?.sublote;
      const esTote = s?.claseSublote === 'tote' || s?.tipo === 'tote';
      showToast(`${s?.cod || code} recibido${esTote ? ' (TOTE en buffer)' : ''}`);
    } catch (err) {
      const data = err?.data;
      if (data && data.matchTipo === 'lote_no_sublote' && data.loteId) {
        const ok = await confirm(`Escaneaste el QR del LOTE ${data.codigoLote}. ¿Recibir TODOS los sublotes en camino del lote?`, { confirmText: 'Recibir todo el lote' });
        if (ok) {
          try {
            const r2 = await api.escanearLoteBulk({ loteId: data.loteId, codigoLote: data.codigoLote, accion: 'escanearRecibirTeran', scanCod: code });
            reload();
            const n = r2?.procesados?.length || 0;
            const omit = r2?.omitidos?.length || 0;
            showToast(`Lote completo recibido: ${n} sublote(s)${omit ? ` · ${omit} omitido(s)` : ''}`);
          } catch (e2) { showToast('Error: ' + (e2.message || 'Bulk scan falló'), true); }
        }
      } else {
        showToast('Error: ' + (err.message || 'Scan falló'), true);
      }
    } finally {
      setBusy(null);
    }
  }, [reload, showToast, confirm]);

  /* Vaciar TOTE manualmente — DECISIÓN OWNER 10 jun 2026 (revierte la
     auto-merma): el remanente se registra como MERMA solo cuando admin/técnico
     lo decide. Nota OBLIGATORIA (guard del backend) — va al historial. */
  const handleVaciarTote = useCallback(async (tote) => {
    const lr = typeof tote.litrosRestante === 'number' ? tote.litrosRestante : Number(tote.lit) || 0;
    const nota = await confirm(
      `Vas a vaciar el TOTE ${tote.cod}: los ${lr.toFixed(2)} L restantes se registrarán como MERMA y el lote podrá concluir. Indica el motivo (queda en auditoría).`,
      { title: 'Vaciar TOTE (merma)', confirmText: 'Vaciar y registrar merma', danger: true,
        prompt: { label: 'Motivo del vaciado', placeholder: 'Ej: remanente no envasable, producto asentado…', required: true, minLength: 5, maxLength: 300, rows: 2 } }
    );
    if (!nota) return;
    setBusy(tote.cod);
    try {
      await api.transicionSublote(tote.cod, 'vaciarTote', { nota });
      reload();
      showToast(`TOTE ${tote.cod} vaciado — ${lr.toFixed(2)} L registrados como merma`);
    } catch (e) {
      showToast('Error: ' + (e.message || 'No se pudo vaciar el TOTE'), true);
    } finally {
      setBusy(null);
    }
  }, [confirm, reload, showToast]);

  /* Gating real: solo admin/almacen reciben en Terán (Enrique está en fábrica). */
  const canAct = rol === 'admin' || rol === 'almacen';

  const subloteQtyTxt = (s) => {
    const esTote = s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1;
    return esTote ? `${s.lit} L granel` : `${s.qty} ${s.tipo} · ${s.lit} L`;
  };

  return (
    <div>
      <TopBar title="Recepción Terán" />
      <div style={isDesktop ? S.wrapDesktop : S.wrap}>
        <div style={S.greet}>Hola {userName} · {totales.enCamino} por recibir</div>

        {/* Scan hero — solo roles que pueden recibir.
            Móvil: hero verde ancho completo. Escritorio: barra superior, botón estándar. */}
        {canAct && (
          isDesktop ? (
            <div style={S.scanRowDesktop}>
              <button type="button" data-id="recepcion.btn.scan" data-rol="almacen,admin"
                style={S.scanBtnDesktop(totales.enCamino > 0)} onClick={() => setScanning(true)}
                aria-label="Escanear QR de recepción">
                {QR_ICON}
                Escanear QR de recepción
              </button>
            </div>
          ) : (
            <button type="button" data-id="recepcion.btn.scan" data-rol="almacen,admin"
              style={S.scanHero(totales.enCamino > 0)} onClick={() => setScanning(true)}
              aria-label="Escanear QR de recepción">
              {QR_ICON}
              Escanear QR de recepción
            </button>
          )
        )}

        {/* TOTEs en buffer (funcionalidad real, no en el mockup — se conserva) */}
        {totesActivos.length > 0 && (
          <div style={S.toteBuffer}>
            <div style={S.toteTitle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></svg>
              TOTEs activos · buffer de granel
            </div>
            <div style={S.toteSub}>Cada TOTE queda activo hasta vaciarse. Re-envasa al final (cubetas/galones/litros) según pidan los clientes.</div>
            <div style={S.toteGrid}>
              {totesActivos.map(tote => {
                const lr = typeof tote.litrosRestante === 'number' ? tote.litrosRestante : Number(tote.lit) || 0;
                const orig = typeof tote.litrosOriginal === 'number' ? tote.litrosOriginal : Number(tote.lit) || 0;
                const pctUsed = orig > 0 ? Math.round(((orig - lr) / orig) * 100) : 0;
                return (
                  <div key={tote.cod} style={S.toteCard}>
                    <div style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--lp-brand-700)' }}>{tote.cod}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{tote._lote?.producto || tote._lote?.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>{lr.toFixed(1)}L de {orig.toFixed(1)}L · {pctUsed}% usado</div>
                    <div style={{ height: 6, background: 'var(--lp-bg-raised)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pctUsed}%`, height: '100%', background: 'var(--lp-brand-600)' }} />
                    </div>
                    {canAct && (
                      <button type="button" data-id="recepcion.btn.reenvasar" data-rol="almacen,admin"
                        onClick={() => setReenvaseFor({ tote, lote: tote._lote })}
                        style={{ width: '100%', marginTop: 10, background: 'var(--lp-brand-600)', color: '#fff', border: 'none', padding: '9px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', minHeight: 40 }}>
                        Re-envasar (cubeta / galón / litro)
                      </button>
                    )}
                    {/* Vaciar TOTE (merma) — cierre MANUAL del remanente (decisión
                        owner 10 jun 2026). El SM espejo gatea admin/técnico; Josué
                        (almacen) no lo ve. Botón secundario discreto, ancho auto. */}
                    {getAccionesSublote(tote, rol).includes('vaciarTote') && (
                      <button type="button" data-id="recepcion.btn.vaciarTote" data-rol="admin,tecnico"
                        disabled={busy === tote.cod}
                        onClick={() => handleVaciarTote(tote)}
                        title={`Registrar los ${(typeof tote.litrosRestante === 'number' ? tote.litrosRestante : Number(tote.lit) || 0).toFixed(2)} L restantes como merma y vaciar el TOTE`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'auto', marginTop: 8, background: 'transparent', color: 'var(--lp-danger-600)', border: '1px solid var(--lp-border-subtle)', padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', minHeight: 40, opacity: busy === tote.cod ? 0.6 : 1 }}>
                        {busy === tote.cod ? 'Vaciando…' : 'Vaciar TOTE (merma)'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs — escritorio: pills compactas a la izquierda; móvil: flex 1:1 */}
        <div style={isDesktop ? S.tabsDesktop : S.tabs}>
          <button style={isDesktop ? S.tabDesktop(filter === 'en_camino') : S.tab(filter === 'en_camino')} onClick={() => setFilter('en_camino')}>Por recibir · {totales.enCamino}</button>
          <button style={isDesktop ? S.tabDesktop(filter === 'en_almacen') : S.tab(filter === 'en_almacen')} onClick={() => setFilter('en_almacen')}>Recibidos hoy · {totales.enAlmacen}</button>
        </div>

        {/* Lista de sublotes (cards) */}
        {loading ? (
          <div style={S.loading}>Cargando sublotes…</div>
        ) : lista.length === 0 ? (
          <div style={S.empty}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: .6 }} aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            <br />{filter === 'en_camino' ? 'Todo recibido. Sin pendientes en el andén.' : 'Aún sin recepciones hoy.'}
          </div>
        ) : (
          /* móvil: una columna (cards apiladas con marginBottom);
             escritorio: grid auto-fill 2-3 columnas (mismo card, CTA al fondo). */
          <div style={isDesktop ? S.grid : undefined}>
            {lista.map(s => {
              const lote = s._lote;
              const prueba = esPrueba(lote);
              const esTote = s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1;
              const isBusy = busy === s.cod;
              const acciones = getAccionesSublote(s, rol);
              const puedeRecibir = canAct && acciones.includes('escanearRecibirTeran');
              const actBase = isDesktop ? S.actDesktop : S.act;
              const est = filter === 'en_camino'
                ? { l: 'En camino', bg: 'color-mix(in srgb, var(--lp-warning-600) 14%, transparent)', fg: 'var(--lp-warning-700)' }
                : { l: 'Recibido', bg: 'color-mix(in srgb, var(--lp-brand-600) 14%, transparent)', fg: 'var(--lp-brand-700)' };
              const ft = fromTileInfo(s, filter === 'en_almacen');
              return (
                <div key={s.cod} style={{ ...(isDesktop ? S.cardDesktop : S.card), ...(prueba ? S.cardPrueba : {}) }}>
                  <div style={S.chead}>
                    <span style={S.cod}>{s.cod}</span>
                    {esTote && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--lp-bg-sunken)', color: 'var(--lp-brand-700)', letterSpacing: '.04em' }}>TOTE</span>}
                    {prueba && <PruebaBadge size="sm" />}
                    <span style={S.estado(est)}>{est.l}</span>
                  </div>
                  <div style={S.prod}>{lote?.producto || lote?.nombre || '—'}</div>
                  <div style={S.qty}>{subloteQtyTxt(s)}</div>
                  {/* .from del mockup: quién recolectó + hora (historial real);
                      fallback al codigo de lote + ruta si aún no hay evento */}
                  <div style={S.from}>
                    {TRUCK_ICON}
                    {ft ? (
                      <span>{ft.verbo} <b style={{ color: 'var(--lp-text-primary)', fontWeight: 600 }}>{ft.who}</b>{ft.t ? ` · ${ft.t}` : ''}</span>
                    ) : (
                      <span>{(lote?.codigo || lote?.codigoLote || '')} · Fábrica → Terán</span>
                    )}
                  </div>
                  {prueba && filter === 'en_camino' && (
                    <div style={S.pruebaNote}>Lote de prueba — no sumes PT al stock físico, sólo simula la recepción.</div>
                  )}
                  {filter === 'en_camino' ? (
                    puedeRecibir ? (
                      /* jun 2026 (decisión owner): recepción = SOLO vía escaneo
                         físico del QR de la cubeta. Antes este botón confirmaba
                         directo (recibirSublote) saltándose el escaneo. Ahora
                         abre la cámara; al leer el QR de la cubeta impresa por
                         Enrique se da de alta en automático (handleScanResult →
                         escanearRecibirTeran). El escaneo ES la verificación. */
                      <button type="button" data-id="recepcion.btn.escanear" data-rol="almacen,admin"
                        style={{ ...actBase, ...S.actPrimary, opacity: isBusy ? 0.6 : 1 }} disabled={isBusy}
                        onClick={() => setScanning(true)}
                        title="Lee el QR de la cubeta para darla de alta en Terán">
                        {QR_ICON} {isBusy ? 'Recibiendo…' : (esTote ? 'Escanear TOTE para recibir' : 'Escanear QR para recibir')}
                      </button>
                    ) : (
                      <button style={{ ...actBase, ...S.actDone }} disabled>En camino — espera a que llegue</button>
                    )
                  ) : (
                    <button style={{ ...actBase, ...S.actDone }} disabled>✓ En stock Terán</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {scanning && <QRScanner onResult={handleScanResult} onClose={() => setScanning(false)} />}

      {/* Modal COMPARTIDO de reenvasado (jun 2026, censo dedup): se eliminó la
          copia local desincronizada — una sola implementación para todo el ERP,
          con impresión de QR del sublote nuevo incluida. */}
      {reenvaseFor && (
        <ReenvasadoModal
          lote={reenvaseFor.lote} envases={envases} userName={userName}
          toteInicial={reenvaseFor.tote?.cod}
          onClose={() => setReenvaseFor(null)}
          onSuccess={(payload) => {
            setReenvaseFor(null); reload();
            showToast(`Re-envasado: ${payload?.q} ${payload?.tipo}(s) desde ${payload?.desdeTote}`);
            const s = payload?.sublotes?.[0];
            if (s?.qrPayload || s?.cod) setPrintQR(payload);
          }}
        />
      )}
      {printQR && <SubloteQRPrintModal payload={printQR} onClose={() => setPrintQR(null)} />}

      {toast && <div style={{ ...S.toast, ...(toast.isErr ? S.toastErr : {}) }}>{toast.msg}</div>}
      {ConfirmEl}
    </div>
  );
}
