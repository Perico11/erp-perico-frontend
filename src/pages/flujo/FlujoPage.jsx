/* ════════════════════════════════════════════════════════════════════════
   FlujoPage — pantalla ÚNICA del ciclo de vida del lote (pedido → entregado).
   Decisión owner (jun 2026): el lote deja de "saltar" entre 7 pantallas. Aquí
   cada lote es UNA card que permanece en su lugar y AVANZA visualmente por el
   pipeline; cada rol actúa EN SITIO cuando es su turno (Enrique envasa, Josué
   recolecta/recibe/reenvasa, Luis recoge), reutilizando los componentes reales:
     · PedidoLoteActions  → acciones de etapa LOTE (aceptar/QC/envasar/recolectar/recibir)
     · EnvasadoModal / ReenvasadoModal / SubloteQRPrintModal (de StockFabrica)
     · QRScanner          → escaneo físico (recoger / recibir)
     · getAccionesSublote / bucketOfSublote → gateo por estado+rol
   Las pantallas por rol siguen existiendo (respaldo); ésta es la vista principal.
   ════════════════════════════════════════════════════════════════════════ */
import { useState, useMemo, useCallback } from 'react';
import TopBar from '../../components/layout/TopBar';
import PageTabs from '../../components/ui/PageTabs';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import useConfirm from '../../hooks/useConfirm';
import { QRScanner } from '../../components/QRModal';
import PruebaBadge, { esPrueba } from '../../components/ui/PruebaBadge';
import PedidoLoteActions from '../../components/PedidoLoteActions';
import { EnvasadoModal, ReenvasadoModal, SubloteQRPrintModal } from '../stock-fabrica/StockFabricaPage';
import { bucketOfSublote } from '../recoleccion/RecoleccionPage';
import {
  calcularEstadoLote, getAccionesLote, getAccionesSublote,
  LABELS_ACCION_SUBLOTE, ESTADO_SUBLOTE_LABEL, ESTADO_SUBLOTE_COLOR,
  ESTADO_LOTE_LABEL, ESTADO_LOTE_COLOR,
} from '../../lib/loteTransiciones';

/* ── Pipeline completo pedido → entregado ─────────────────────────────── */
const PASOS = [
  { key: 'pendiente',      label: 'Pedido' },
  { key: 'aceptado',       label: 'Aceptado' },
  { key: 'en_produccion',  label: 'Producción' },
  { key: 'producido',      label: 'Producido' },
  { key: 'qc_aprobado',    label: 'QC' },
  { key: 'en_envasado',    label: 'Envasando' },
  { key: 'envasado',       label: 'Envasado' },
  { key: 'en_recoleccion', label: 'Recolección' },
  { key: 'en_camino',      label: 'En camino' },
  { key: 'en_almacen',     label: 'En Terán' },
  { key: 'entregado',      label: 'Entregado' },
];
function idxPaso(estado) {
  if (estado === 'qc_hold')        return PASOS.findIndex(p => p.key === 'qc_aprobado');
  if (estado === 'en_proceso')     return PASOS.findIndex(p => p.key === 'en_camino');
  if (estado === 'en_stock_teran') return PASOS.findIndex(p => p.key === 'en_almacen');
  const i = PASOS.findIndex(p => p.key === estado);
  return i >= 0 ? i : 0;
}

/* ── Iconos SVG line ──────────────────────────────────────────────────── */
const IcoTruck = ({ s = 16 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>);
const IcoQR = ({ s = 16 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="17.5" y1="17.5" x2="17.5" y2="17.5"/></svg>);
const IcoCheck = ({ s = 15 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>);

/* Mapa acción de sublote → presentación del botón */
const SUB_BTN = {
  escanearRecoger:      { label: 'Voy por él',          bg: 'var(--lp-brand-600)', Ico: IcoTruck, scan: true },
  escanearRecibirTeran: { label: 'Recibir (escanear)',  bg: 'var(--lp-info-600)',  Ico: IcoQR,    scan: true },
  marcarRecoleccion:    { label: 'Listo para recolectar', bg: 'var(--lp-text-tertiary)', Ico: IcoTruck, scan: false },
  reenvasarTote:        { label: 'Re-envasar TOTE',     bg: '#7C3AED',             Ico: IcoQR,    scan: false },
};

/* ── Pipeline horizontal ──────────────────────────────────────────────── */
function PipelineRow({ estado }) {
  const idx = idxPaso(estado);
  return (
    <div style={S.timeline}>
      {PASOS.map((p, i) => {
        const done = i < idx, current = i === idx;
        return (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
            <div style={S.step}>
              <div style={S.dot(done, current)} />
              <div style={S.stepLabel(done, current)}>{p.label}</div>
            </div>
            {i < PASOS.length - 1 && <div style={S.line(done)} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Fila de sublote (etapa recolección → recepción → reenvasado) ─────── */
function SubloteRow({ s, rol, busy, onAccion }) {
  const bucket = bucketOfSublote(s);
  /* En 'entregados' no mostramos acción (ya llegó a Terán). */
  const acciones = bucket === 'entregados'
    ? []
    : getAccionesSublote(s, rol).filter(a => a !== 'cancelarSublote');
  const color = ESTADO_SUBLOTE_COLOR[s.estado] || 'var(--lp-text-tertiary)';
  const label = ESTADO_SUBLOTE_LABEL[s.estado] || s.estado || '—';
  const qtyTxt = [s.qty != null ? `${s.qty} ${s.tipo || 'cub'}` : null, s.lit ? `${s.lit} L` : null].filter(Boolean).join(' · ');
  return (
    <div style={S.subRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
        <span style={S.subCod}>{s.cod}</span>
        <span style={S.subBadge(color)}><i style={{ width: 5, height: 5, borderRadius: 999, background: color }} />{label}</span>
        {qtyTxt && <span style={S.subQty}>{qtyTxt}</span>}
        {bucket === 'entregados' && <span style={S.subDone}><IcoCheck s={13} /> en Terán</span>}
      </div>
      {acciones.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {acciones.map(a => {
            const meta = SUB_BTN[a] || { label: LABELS_ACCION_SUBLOTE[a] || a, bg: 'var(--lp-brand-600)', Ico: IcoTruck };
            const Ico = meta.Ico;
            return (
              <button key={a} style={{ ...S.subBtn, background: meta.bg }} disabled={busy}
                onClick={() => onAccion(s, a, meta)}>
                {busy ? '…' : <><Ico s={14} />{meta.label}</>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Card de un item de flujo (1 lote, o pedido/orden sin lote aún) ────── */
function FlujoCard({ item, lotes, rol, userName, isDesktop, onSubAccion, busySub,
                     onEnvasarInline, onReenvasarInline, onLoteSuccess, onLoteError }) {
  const lote = item.lote;
  const source = item.source;
  const displayEstado = lote ? (calcularEstadoLote(lote) || lote.estado) : (source?.estado || 'pendiente');
  const folio = item.folio;
  const producto = (lote?.producto || lote?.nombre || lote?.formula || source?.producto || '—');
  const cantidad = lote?.cantidad ?? source?.cantidad;
  const prueba = (lote && esPrueba(lote)) || (source && esPrueba(source));
  const estLabel = ESTADO_LOTE_LABEL[displayEstado] || displayEstado;
  const estColor = ESTADO_LOTE_COLOR[displayEstado] || 'var(--lp-text-tertiary)';
  const sublotes = (lote?.sublotes || []).filter(x => !x.esMerma && x.estado !== 'cancelado');
  /* El pedido/orden que PedidoLoteActions usa para resolver el lote por id */
  const pedidoForActions = source || (lote ? { id: lote.ordenId || lote.pedidoId || lote.id, producto, cantidad, estado: lote.estado, esPrueba: prueba } : null);

  return (
    <div style={isDesktop ? S.cardDesktop : S.card}>
      <div style={S.cardHead}>
        <span style={S.folio}>{folio}</span>
        {prueba && <PruebaBadge size="sm" />}
        <span style={S.estadoBadge(estColor)}>{estLabel}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--lp-text-tertiary)' }}>{cantidad != null ? `${cantidad} cub` : ''}</span>
      </div>
      <div style={S.prod}>{producto}</div>

      <PipelineRow estado={displayEstado} />

      {/* Acciones de etapa LOTE (reusa PedidoLoteActions con modales inline) */}
      {pedidoForActions && (
        <PedidoLoteActions
          pedido={pedidoForActions}
          lotes={lotes}
          userRol={rol}
          userName={userName}
          onSuccess={onLoteSuccess}
          onError={onLoteError}
          onEnvasarInline={onEnvasarInline}
          onReenvasarInline={onReenvasarInline}
        />
      )}

      {/* Acciones de etapa SUBLOTE (recolección → recepción → reenvasado) */}
      {sublotes.length > 0 && (
        <div style={S.subList}>
          {sublotes.map(s => (
            <SubloteRow key={s.cod} s={s} rol={rol} busy={busySub === s.cod} onAccion={onSubAccion} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
export default function FlujoPage() {
  const { user } = useAuth();
  const rol = user?.rol || '';
  const userName = user?.nombre || '?';
  const isDesktop = useIsDesktop();
  const [confirm, ConfirmEl] = useConfirm();

  const [tab, setTab] = useState('activos');     /* activos | accionables | todos */
  const [toast, setToast] = useState(null);
  const [busySub, setBusySub] = useState(null);
  const [scanAccion, setScanAccion] = useState(null);   /* escanearRecoger | escanearRecibirTeran */
  const [envasarModal, setEnvasarModal] = useState(null);   /* lote */
  const [reenvasarModal, setReenvasarModal] = useState(null); /* lote */
  const [printQR, setPrintQR] = useState(null);             /* payload */

  const showToast = useCallback((msg, isErr = false) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const { data: pedData, reload: rP } = useApiData(() => api.getPedidos(), [], 8000);
  const { data: ordData, reload: rO } = useApiData(() => api.getOrdenes(), [], 30000);
  const { data: trazData, reload: rT } = useApiData(() => api.getTrazabilidad(), [], 5000);
  const { data: envData } = useApiData(() => api.getEnvases(), null, 30000);
  const envases = envData?.data || envData || null;
  const reloadAll = useCallback(() => { rT(); rP(); rO(); }, [rT, rP, rO]);

  useRealtimeSync({
    onTrazabilidad: () => { rT(); rP(); rO(); },
    onPedidos: () => rP(),
    onOrdenes: () => rO(),
  });

  const lotes = useMemo(() => {
    const arr = trazData?.data || trazData || [];
    return (Array.isArray(arr) ? arr : []).filter(l => l && !l.eliminado);
  }, [trazData]);
  const pedidos = useMemo(() => {
    const arr = Array.isArray(pedData) ? pedData : (pedData?.data || []);
    return arr.filter(p => p && p.id && !p.eliminado && p.estado !== 'eliminado');
  }, [pedData]);
  const ordenes = useMemo(() => {
    const arr = ordData?.data || ordData || [];
    return (Array.isArray(arr) ? arr : []).filter(o => o && !o.eliminado);
  }, [ordData]);

  /* Ensamblar flowItems: 1 por lote + pedidos/órdenes SIN lote todavía. */
  const flowItems = useMemo(() => {
    const srcById = {};
    pedidos.forEach(p => { srcById[p.id] = p; });
    ordenes.forEach(o => { srcById[o.id] = o; });

    const items = [];
    const usedSrc = new Set();
    lotes.forEach(l => {
      const src = (l.pedidoId && srcById[l.pedidoId]) || (l.ordenId && srcById[l.ordenId]) || null;
      if (src) usedSrc.add(src.id);
      items.push({
        key: l.id,
        lote: l,
        source: src,
        folio: src?.codigo || src?.id || l.codigoLote || l.codigo || l.id,
        fecha: l.fecha || src?.fecha || src?.fechaCreacion || '',
      });
    });
    /* Pedidos/órdenes activos que aún NO tienen lote (pedido→aceptado) */
    const PRE = ['pendiente', 'aceptado', 'en_produccion'];
    [...pedidos, ...ordenes].forEach(src => {
      if (usedSrc.has(src.id)) return;
      if (!PRE.includes(src.estado)) return;
      if (items.some(it => it.source && it.source.id === src.id)) return;
      items.push({
        key: 'src-' + src.id,
        lote: null,
        source: src,
        folio: src.codigo || src.id,
        fecha: src.fecha || src.fechaCreacion || '',
      });
    });
    /* Orden ESTABLE: por fecha desc (la card no salta al avanzar de estado). */
    items.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    return items;
  }, [lotes, pedidos, ordenes]);

  const itemHasActions = useCallback((it) => {
    const estObj = it.lote || it.source || {};
    const loteAcc = getAccionesLote(estObj, rol).filter(a => a !== 'cancelarLote');
    if (loteAcc.length > 0) return true;
    return (it.lote?.sublotes || []).some(s => !s.esMerma && getAccionesSublote(s, rol).filter(a => a !== 'cancelarSublote').length > 0);
  }, [rol]);

  const TERMINALES = ['entregado', 'cancelado', 'rechazado'];
  const visibles = useMemo(() => {
    return flowItems.filter(it => {
      const est = it.lote ? (calcularEstadoLote(it.lote) || it.lote.estado) : (it.source?.estado);
      if (tab === 'todos') return true;
      if (tab === 'accionables') return itemHasActions(it);
      /* activos: ocultar terminales */
      return !TERMINALES.includes(est);
    });
  }, [flowItems, tab, itemHasActions]);

  /* ── Acción de sublote ── */
  const onSubAccion = useCallback(async (s, accion, meta) => {
    if (accion === 'reenvasarTote') {
      const lote = lotes.find(l => (l.sublotes || []).some(x => x.cod === s.cod));
      if (lote) setReenvasarModal(lote);
      return;
    }
    if (meta?.scan) {            /* escanearRecoger / escanearRecibirTeran → cámara */
      setScanAccion(accion);
      return;
    }
    /* marcarRecoleccion (sin escaneo) */
    const label = LABELS_ACCION_SUBLOTE[accion] || accion;
    const ok = await confirm(`¿${label}: ${s.cod}?`, { confirmText: label });
    if (!ok) return;
    setBusySub(s.cod);
    try {
      await api.transicionSublote(s.cod, accion, { usuario: userName });
      reloadAll();
      showToast(`${s.cod}: ${label.toLowerCase()}`);
    } catch (e) {
      showToast('Error: ' + (e.message || 'No se pudo'), true);
    } finally { setBusySub(null); }
  }, [lotes, confirm, userName, reloadAll, showToast]);

  /* ── Escaneo físico (recoger / recibir) ── */
  const handleScan = useCallback(async (result) => {
    const accion = scanAccion;
    setScanAccion(null);
    const code = (result?.cod || result?.raw || '').trim();
    if (!code || !accion) return;
    setBusySub(code);
    try {
      const r = await api.escanearSublote(code, accion);
      reloadAll();
      showToast(`${r?.sublote?.cod || code}: ${accion === 'escanearRecoger' ? 'en camino' : 'recibido en Terán'}`);
    } catch (err) {
      const data = err?.data;
      if (data && data.matchTipo === 'lote_no_sublote' && data.loteId) {
        const ok = await confirm(`Escaneaste el QR del LOTE ${data.codigoLote || ''}. ¿Aplicar a TODOS sus sublotes elegibles?`, { confirmText: 'Todo el lote' });
        if (ok) {
          try { const r2 = await api.escanearLoteBulk({ loteId: data.loteId, accion }); reloadAll(); showToast(`Lote: ${r2?.procesados?.length || 0} sublote(s)`); }
          catch (e2) { showToast('Error: ' + (e2.message || 'bulk'), true); }
        }
      } else { showToast('Error: ' + (err.message || 'El QR no coincide'), true); }
    } finally { setBusySub(null); }
  }, [scanAccion, reloadAll, showToast, confirm]);

  const onLoteSuccess = useCallback((msg) => { reloadAll(); if (msg) showToast(typeof msg === 'string' ? msg : 'Listo'); }, [reloadAll, showToast]);
  const onLoteError = useCallback((msg) => showToast(msg || 'Error', true), [showToast]);

  const TABS = [
    { id: 'activos', label: 'Activos' },
    { id: 'accionables', label: 'Para mí' },
    { id: 'todos', label: 'Todos' },
  ];

  return (
    <>
      <TopBar title="Flujo" />
      <div style={isDesktop ? S.wrapD : S.wrap}>
        <PageTabs tabs={TABS.map(t => ({ ...t, style: (a) => S.tab(a) }))} activeTab={tab} onChange={setTab} style={S.tabs} />

        {visibles.length === 0 ? (
          <div style={S.empty}>
            <IcoCheck s={36} />
            <div style={{ marginTop: 10 }}>{tab === 'accionables' ? 'Nada pendiente para tu rol ahora.' : 'Sin lotes en este filtro.'}</div>
          </div>
        ) : (
          <div style={isDesktop ? S.grid : undefined}>
            {visibles.map(it => (
              <FlujoCard
                key={it.key}
                item={it}
                lotes={lotes}
                rol={rol}
                userName={userName}
                isDesktop={isDesktop}
                busySub={busySub}
                onSubAccion={onSubAccion}
                onEnvasarInline={(lote) => setEnvasarModal(lote)}
                onReenvasarInline={(tote, lote) => setReenvasarModal(lote)}
                onLoteSuccess={onLoteSuccess}
                onLoteError={onLoteError}
              />
            ))}
          </div>
        )}
      </div>

      {/* Escáner físico compartido */}
      {scanAccion && <QRScanner onResult={handleScan} onClose={() => setScanAccion(null)} />}

      {/* Envasado inline */}
      {envasarModal && (
        <EnvasadoModal
          lote={envasarModal} envases={envases} userName={userName}
          onClose={() => setEnvasarModal(null)}
          onSuccess={(payload) => {
            setEnvasarModal(null); reloadAll();
            showToast(`Envasado: ${payload?.q ?? ''} ${payload?.tipo || ''}`.trim());
            const s = payload?.sublotes?.[0];
            if (s?.qrPayload || s?.cod) setPrintQR(payload);
          }}
        />
      )}
      {/* Reenvasado inline */}
      {reenvasarModal && (
        <ReenvasadoModal
          lote={reenvasarModal} envases={envases} userName={userName}
          onClose={() => setReenvasarModal(null)}
          onSuccess={(payload) => {
            setReenvasarModal(null); reloadAll();
            showToast(`Re-envasado: ${payload?.q ?? ''} ${payload?.tipo || ''}`.trim());
            const s = payload?.sublotes?.[0];
            if (s?.qrPayload || s?.cod) setPrintQR(payload);
          }}
        />
      )}
      {printQR && <SubloteQRPrintModal payload={printQR} onClose={() => setPrintQR(null)} />}

      {toast && (
        <div style={{ ...S.toast, ...(toast.isErr ? S.toastErr : {}) }}>
          {toast.isErr ? <span aria-hidden="true">✕</span> : <IcoCheck s={15} />}<span>{toast.msg}</span>
        </div>
      )}
      {ConfirmEl}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
const S = {
  wrap: { padding: '4px 16px 100px' },
  wrapD: { padding: '8px 24px 48px' },
  tabs: { display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none' },
  tab: (active) => ({
    flexShrink: 0, padding: '9px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: active ? 600 : 500,
    background: active ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)',
    color: active ? '#fff' : 'var(--lp-text-tertiary)', whiteSpace: 'nowrap', minHeight: 44,
  }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 14, alignItems: 'start' },
  card: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 16, padding: 14, marginBottom: 12 },
  cardDesktop: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 16, padding: 16 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  folio: { fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-700)' },
  estadoBadge: (c) => ({ display: 'inline-block', padding: '2px 8px', fontSize: 10, fontWeight: 700, background: c + '22', color: c, borderRadius: 4, textTransform: 'uppercase', letterSpacing: '.04em' }),
  prod: { fontSize: 16, fontWeight: 600, color: 'var(--lp-text-primary)', letterSpacing: '-.01em', marginBottom: 8 },

  timeline: { display: 'flex', alignItems: 'flex-start', gap: 0, margin: '4px 0 6px', overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' },
  step: { flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 56 },
  dot: (done, current) => ({ width: 12, height: 12, borderRadius: '50%', background: current ? 'var(--lp-brand-600)' : done ? 'var(--lp-success-500)' : 'var(--lp-border-subtle)', boxShadow: current ? '0 0 0 3px color-mix(in srgb, var(--lp-brand-600) 22%, transparent)' : 'none', zIndex: 2 }),
  line: (done) => ({ flex: 1, height: 2, background: done ? 'var(--lp-success-500)' : 'var(--lp-border-subtle)', minWidth: 16, marginTop: 5 }),
  stepLabel: (done, current) => ({ fontSize: 9, marginTop: 4, color: current ? 'var(--lp-brand-700)' : done ? 'var(--lp-success-700)' : 'var(--lp-text-tertiary)', fontWeight: current ? 700 : 400, textAlign: 'center', whiteSpace: 'nowrap' }),

  subList: { marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 },
  subRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  subCod: { fontFamily: 'var(--lp-font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)' },
  subBadge: (c) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }),
  subQty: { fontSize: 11, color: 'var(--lp-text-tertiary)' },
  subDone: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--lp-success-600)' },
  subBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 14px', borderRadius: 10, border: 'none', cursor: 'pointer', color: '#fff', fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: 600 },

  empty: { textAlign: 'center', color: 'var(--lp-text-secondary)', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  toast: { position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)', padding: '12px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 1001, background: 'var(--lp-success-600)', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,.18)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' },
  toastErr: { background: 'var(--lp-danger-600)' },
};
