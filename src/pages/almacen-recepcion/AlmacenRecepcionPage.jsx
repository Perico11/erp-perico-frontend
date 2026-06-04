import { useState, useMemo, useCallback } from 'react';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { QRScanner } from '../../components/QRModal';
import PruebaBadge, { esPrueba } from '../../components/ui/PruebaBadge';
import SegmentedControl from '../../components/ui/SegmentedControl';
import useConfirm from '../../hooks/useConfirm';
import {
  ESTADO_SUBLOTE_LABEL,
  ESTADO_SUBLOTE_COLOR,
  getAccionesSublote,
  LABELS_ACCION_SUBLOTE,
} from '../../lib/loteTransiciones';

/* ──────────────────────────────────────────────────────────────────── */
/* AlmacenRecepcionPage refactorizada al state machine                  */
/* ──────────────────────────────────────────────────────────────────── */
/* Josué trabaja a nivel de SUBLOTE:                                    */
/*   1. Sublotes en_camino → escanea → escanearRecibirTeran             */
/*      - Si claseSublote='envasado_final' → estado = 'en_stock_teran'  */
/*      - Si claseSublote='tote' → estado = 'tote_activo' (queda en     */
/*        buffer, se decrementa cada vez que se re-envasa al final)     */
/*   2. TOTEs activos → re-envasar (acción reenvasarTote) que crea      */
/*      sublotes hijos en estado 'envasado' listos para venderse.       */
/*      El TOTE puede quedar activo durante días.                       */
/*   3. Sublotes en_stock_teran o tote_vaciado → listos para entrega    */
/* ──────────────────────────────────────────────────────────────────── */

const S = {
  wrap: { padding: '0 20px 100px' },
  scanBar: {
    /* Sticky debajo del TopBar (56px + notch). Si se quedara en top:0 quedaría
       tapado o se montaría sobre el header de la app. */
    position: 'sticky',
    top: 'calc(56px + env(safe-area-inset-top, 0px))',
    zIndex: 5,
    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0',
    background: 'var(--lp-bg-base)',
    borderBottom: '1px solid var(--lp-border-subtle)',
    marginBottom: 16,
  },
  scanBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '14px 18px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg, var(--lp-success-600), var(--lp-success-700))',
    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', minHeight: 52,
    boxShadow: '0 4px 12px rgba(34,139,75,.25)',
  },
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 200, padding: '10px 14px',
    borderRadius: 'var(--lp-radius-sm)', border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 13, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    outline: 'none', boxSizing: 'border-box',
  },
  metric: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12, marginBottom: 16,
  },
  metricCard: (accent) => ({
    background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
    padding: 14, textAlign: 'center',
    borderTop: accent ? `3px solid ${accent}` : 'none',
  }),
  metricVal: { fontSize: 24, fontWeight: 800, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  metricLabel: { fontSize: 11, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, fontWeight: 600 },
  card: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    padding: 14, marginBottom: 10,
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: 12,
    marginBottom: 10, flexWrap: 'wrap',
  },
  loteCode: { fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-700)' },
  cardTitle: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  cardMeta: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 },
  badge: (bg, fg) => ({
    display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700,
    borderRadius: 4, background: bg, color: fg,
    textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  sublote: {
    padding: '10px 12px', borderRadius: 8, marginBottom: 6,
    border: '1px solid var(--lp-border-subtle)', fontSize: 12,
    background: 'var(--lp-bg-sunken)',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  subloteRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  subloteCod: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 12 },
  toteBuffer: {
    background: '#EDE9FE',
    border: '1.5px solid #7C3AED',
    borderRadius: 'var(--lp-radius)',
    padding: 16, marginBottom: 16,
  },
  smallBtn: {
    padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 11,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-success-600)', color: '#fff', minHeight: 36,
  },
  loading: { textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
  empty: { textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
  toast: {
    position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 1001,
    background: 'var(--lp-success-600)', color: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,.15)',
  },
  toastErr: { background: 'var(--lp-danger-600)' },
  /* Re-envase modal */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,.18)',
  },
  modalHeader: {
    padding: '16px 20px', borderBottom: '1px solid var(--lp-border-subtle)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  modalBody: { padding: '16px 20px' },
  modalFooter: {
    padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)',
    display: 'flex', justifyContent: 'flex-end', gap: 8,
  },
  fieldLabel: {
    fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)',
    marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '.04em',
  },
  fieldInput: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: '#fff', outline: 'none',
    boxSizing: 'border-box', marginBottom: 12,
  },
  fieldSelect: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: '#fff', outline: 'none',
    boxSizing: 'border-box', marginBottom: 12, appearance: 'auto',
  },
};

function buildQrUrl(cod) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  let base = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
      base = String(import.meta.env.BASE_URL).replace(/\/$/, '');
    }
  } catch {}
  return `${origin}${base}/qr/${encodeURIComponent(cod)}`;
}

/* ─────────────── MODAL: Re-envasar desde TOTE en Terán ─────────────── */
function ReenvasarToteModal({ tote, lote, userName, onClose, onSuccess }) {
  const [tipo, setTipo] = useState('cubeta');
  const [marca, setMarca] = useState('');
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const litDisponible = typeof tote.litrosRestante === 'number'
    ? tote.litrosRestante
    : (Number(tote.lit) || 0);
  const capMap = { cubeta: 19, galon: 3.785, litro: 1 };
  const litPorUnidad = capMap[tipo] || 19;
  const maxUnidades = Math.floor(litDisponible / litPorUnidad);
  const litTotal = (parseInt(qty) || 0) * litPorUnidad;

  const handleSubmit = async () => {
    const q = parseInt(qty);
    if (!q || q < 1) return setError('Cantidad debe ser >= 1');
    if (litTotal > litDisponible + 0.5) return setError(`Solo quedan ${litDisponible.toFixed(1)} L en el tote`);
    setSaving(true);
    setError('');
    try {
      const sublotesActuales = (lote?.sublotes || []).length;
      const cod = (lote?.codigo || lote?.codigoLote || lote?.id || tote.cod) + '-' + String.fromCharCode(65 + sublotesActuales);
      const litExact = +litTotal.toFixed(2);
      const subloteHijo = {
        cod,
        claseSublote: 'envasado_final',
        estado: 'en_stock_teran', /* nace YA en Terán, listo para venta */
        tipo,
        env: tipo === 'cubeta' ? '19L Estandar' : tipo === 'galon' ? '3.785L' : '1L',
        marca: marca || null,
        qty: q,
        lit: litExact,
        litrosOriginal: litExact,
        litrosRestante: 0,
        tapa: null,
        ub: 'teran',
        esMerma: false,
        fase: 2,
        esHijoDe: tote.cod,
        fromTote: tote.cod,
        qrPayload: buildQrUrl(cod),
        historial: [{
          accion: 'reenvasarTote',
          estadoNuevo: 'en_stock_teran',
          ts: new Date().toISOString(),
          usuario: userName || null,
          desdeTote: tote.cod,
          lugar: 'teran',
        }],
      };
      await api.transicionSublote(tote.cod, 'reenvasarTote', {
        nuevosSublotes: [subloteHijo],
        litrosConsumidos: litExact,
        lugar: 'teran',
      });
      onSuccess({ sublote: subloteHijo, tote, q, tipo, litTotal: litExact });
    } catch (err) {
      setError(err.message || 'Error al re-envasar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ ...S.modalHeader, borderBottom: '3px solid #7C3AED' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Re-envasar TOTE en Terán</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--lp-text-tertiary)' }}>×</button>
        </div>
        <div style={S.modalBody}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <div style={{ padding: 12, background: '#EDE9FE', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', fontFamily: 'var(--lp-font-mono)' }}>{tote.cod}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{lote?.producto || lote?.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2 }}>
              Disponible en TOTE: <strong>{litDisponible.toFixed(1)} L</strong>
              {typeof tote.litrosOriginal === 'number' && <> de {tote.litrosOriginal.toFixed(1)} L originales</>}
            </div>
          </div>

          <label style={S.fieldLabel}>Presentación final</label>
          <select style={S.fieldSelect} value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="cubeta">Cubeta (19L)</option>
            <option value="galon">Galón (3.785L)</option>
            <option value="litro">Litro (1L)</option>
          </select>

          <label style={S.fieldLabel}>Marca (opcional)</label>
          <input style={S.fieldInput} placeholder="Ej: Premium" value={marca} onChange={e => setMarca(e.target.value)} />

          <label style={S.fieldLabel}>Cantidad (máx {maxUnidades})</label>
          <input style={S.fieldInput} type="number" inputMode="numeric" pattern="[0-9]*"
            min="1" max={maxUnidades}
            placeholder={`Ej: ${Math.min(maxUnidades, 20)}`}
            value={qty} onChange={e => setQty(e.target.value)} />

          {qty && parseInt(qty) > 0 && (
            <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', padding: '8px 12px', background: 'var(--lp-bg-sunken)', borderRadius: 8, marginBottom: 8 }}>
              {parseInt(qty)} {tipo}(s) × {litPorUnidad}L = <strong>{litTotal.toFixed(1)} L</strong>
              {' · '}Quedará en TOTE: <strong>{Math.max(0, litDisponible - litTotal).toFixed(1)} L</strong>
            </div>
          )}
        </div>
        <div style={S.modalFooter}>
          <button style={{
            padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)',
          }} onClick={onClose}>Cancelar</button>
          <button style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: '#7C3AED', color: '#fff',
          }} disabled={saving} onClick={handleSubmit}>
            {saving ? 'Re-envasando...' : `Re-envasar ${qty || 0} ${tipo}(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── PAGE PRINCIPAL ─────────────── */
export default function AlmacenRecepcionPage() {
  const { user } = useAuth();
  const userName = user?.nombre || '?';
  const rol = user?.rol || '';
  const [confirm, ConfirmEl] = useConfirm();
  const [filter, setFilter] = useState('en_camino');
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [reenvaseFor, setReenvaseFor] = useState(null); /* {tote, lote} */
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(null);

  const showToast = useCallback((msg, isErr = false) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const { data: trazaData, loading, reload } = useApiData(() => api.getTrazabilidad(), [], 8000);
  useRealtimeSync({ onTrazabilidad: () => reload() });

  const lotes = useMemo(() => {
    const arr = trazaData?.data || trazaData || [];
    /* Filtrar lotes con soft-delete: el backend marca eliminado:true para
       auditoría, pero el frontend NO debe mostrarlos en ninguna vista. */
    return (Array.isArray(arr) ? arr : []).filter(l => l && !l.eliminado);
  }, [trazaData]);

  /* Aplanar a sublotes con referencia al padre */
  const allSublotes = useMemo(() => {
    const out = [];
    lotes.forEach(lote => {
      (lote.sublotes || []).forEach(s => {
        if (s.esMerma) return;
        out.push({ ...s, _lote: lote });
      });
    });
    return out;
  }, [lotes]);

  /* Buckets para Josué */
  const sublotesEnCamino = useMemo(() =>
    allSublotes.filter(s => s.estado === 'en_camino' || (!s.estado && s.ub === 'fabrica' && (s._lote?.estado === 'en_camino' || s._lote?.estado === 'en_recoleccion'))),
    [allSublotes]
  );
  const totesActivos = useMemo(() =>
    allSublotes.filter(s => {
      const esTote = s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1;
      if (!esTote) return false;
      if (s.estado === 'tote_vaciado' || s.estado === 'cancelado') return false;
      if (s.ub !== 'teran' && s.estado !== 'tote_activo') return false;
      const lr = typeof s.litrosRestante === 'number' ? s.litrosRestante : Number(s.lit) || 0;
      return lr > 0.5;
    }),
    [allSublotes]
  );
  const sublotesEnAlmacen = useMemo(() =>
    allSublotes.filter(s => s.estado === 'en_stock_teran'),
    [allSublotes]
  );

  const totales = useMemo(() => ({
    enCamino: sublotesEnCamino.length,
    totesActivos: totesActivos.length,
    enAlmacen: sublotesEnAlmacen.length,
  }), [sublotesEnCamino, totesActivos, sublotesEnAlmacen]);

  /* Lista filtrada según tab + búsqueda */
  const filtered = useMemo(() => {
    let list;
    if (filter === 'en_camino') list = sublotesEnCamino;
    else if (filter === 'en_almacen') list = sublotesEnAlmacen;
    else list = [...sublotesEnCamino, ...totesActivos, ...sublotesEnAlmacen];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(s =>
      (s.cod || '').toLowerCase().includes(q) ||
      (s._lote?.producto || s._lote?.nombre || '').toLowerCase().includes(q) ||
      (s._lote?.codigoLote || s._lote?.codigo || '').toLowerCase().includes(q)
    );
  }, [filter, sublotesEnCamino, totesActivos, sublotesEnAlmacen, search]);

  const groupedByLote = useMemo(() => {
    const map = new Map();
    filtered.forEach(s => {
      const lid = s._lote?.id || s._lote?.codigoLote || 'sin-lote';
      if (!map.has(lid)) map.set(lid, { lote: s._lote, sublotes: [] });
      map.get(lid).sublotes.push(s);
    });
    return Array.from(map.values());
  }, [filtered]);

  /* Recibir un sublote en Terán vía state machine */
  const recibirSublote = useCallback(async (sublote) => {
    setBusy(sublote.cod);
    try {
      await api.transicionSublote(sublote.cod, 'escanearRecibirTeran', { usuario: userName });
      reload();
      const esTote = sublote.claseSublote === 'tote' || sublote.tipo === 'tote';
      showToast(`${sublote.cod} recibido${esTote ? ' (TOTE activo en buffer)' : ''} ✓`);
    } catch (err) {
      showToast('Error: ' + (err.message || 'No se pudo recibir'), true);
    } finally {
      setBusy(null);
    }
  }, [userName, reload, showToast]);

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
      showToast(`${s?.cod || code} recibido${esTote ? ' (TOTE en buffer)' : ''} ✓`);
    } catch (err) {
      /* Si era QR de LOTE: ofrecer recibir todos los sublotes del lote */
      const data = err?.data;
      if (data && data.matchTipo === 'lote_no_sublote' && data.loteId) {
        const ok = await confirm(
          `Escaneaste el QR del LOTE ${data.codigoLote}. ¿Recibir TODOS los sublotes en camino del lote?`,
          { confirmText: 'Recibir todo el lote' }
        );
        if (ok) {
          try {
            const r2 = await api.escanearLoteBulk({ loteId: data.loteId, accion: 'escanearRecibirTeran' });
            reload();
            const n = r2?.procesados?.length || 0;
            const omit = r2?.omitidos?.length || 0;
            showToast(`Lote completo recibido: ${n} sublote(s)${omit ? ` · ${omit} omitido(s)` : ''} ✓`);
          } catch (e2) {
            showToast('Error: ' + (e2.message || 'Bulk scan falló'), true);
          }
        }
      } else {
        showToast('Error: ' + (err.message || 'Scan falló'), true);
      }
    } finally {
      setBusy(null);
    }
  }, [reload, showToast, confirm]);

  /* FIX jun 2026 (K3-d): tecnico (Enrique) NO debe recibir en Terán —
     físicamente está en fábrica. Permitirlo creaba riesgo de stock fantasma
     (alguien marca recibido sin estar en el almacén destino). El backend
     server.js:2798 también restringía pero el frontend exponía el botón. */
  const canAct = rol === 'admin' || rol === 'almacen';

  return (
    <div>
      <TopBar title="Recepción Almacén Terán" />
      <div style={S.wrap}>
        {/* Scanner siempre visible — el flujo principal de Josué */}
        {canAct && (
          <div style={S.scanBar}>
            <button
              style={S.scanBtn}
              onClick={() => setScanning(true)}
              aria-label="Escanear QR de sublote para recibir"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                <rect x="7" y="7" width="10" height="10" rx="1"/>
              </svg>
              Escanear QR para recibir
            </button>
          </div>
        )}

        {/* KPIs */}
        <div style={S.metric}>
          <div style={S.metricCard('var(--lp-warning-500)')}>
            <div style={{ ...S.metricVal, color: 'var(--lp-warning-700)' }}>{totales.enCamino}</div>
            <div style={S.metricLabel}>Sublotes en camino</div>
          </div>
          <div style={S.metricCard('#7C3AED')}>
            <div style={{ ...S.metricVal, color: '#7C3AED' }}>{totales.totesActivos}</div>
            <div style={S.metricLabel}>TOTEs en buffer</div>
          </div>
          <div style={S.metricCard('var(--lp-success-500)')}>
            <div style={{ ...S.metricVal, color: 'var(--lp-success-700)' }}>{totales.enAlmacen}</div>
            <div style={S.metricLabel}>En stock Terán</div>
          </div>
        </div>

        {/* TOTEs activos (buffer) — sección destacada porque pueden tardar días */}
        {totesActivos.length > 0 && (
          <div style={S.toteBuffer}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#7C3AED', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🛢️</span>
              TOTEs activos · buffer de granel
            </div>
            <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 12 }}>
              Cada TOTE queda activo hasta vaciarse. Re-envasa al final (cubetas/galones/litros) según pidan los clientes.
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {totesActivos.map(tote => {
                const lr = typeof tote.litrosRestante === 'number' ? tote.litrosRestante : Number(tote.lit) || 0;
                const orig = typeof tote.litrosOriginal === 'number' ? tote.litrosOriginal : Number(tote.lit) || 0;
                const pctUsed = orig > 0 ? Math.round(((orig - lr) / orig) * 100) : 0;
                return (
                  <div key={tote.cod} style={{
                    background: '#fff',
                    border: '1.5px solid var(--lp-border-subtle)',
                    borderRadius: 'var(--lp-radius-sm)',
                    padding: 12,
                  }}>
                    <div style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>
                      {tote.cod}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                      {tote._lote?.producto || tote._lote?.nombre}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                      {lr.toFixed(1)}L de {orig.toFixed(1)}L disponibles · {pctUsed}% usado
                    </div>
                    <div style={{ height: 6, background: 'var(--lp-bg-sunken)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pctUsed}%`, height: '100%', background: '#7C3AED' }} />
                    </div>
                    {canAct && (
                      <button
                        type="button"
                        onClick={() => setReenvaseFor({ tote, lote: tote._lote })}
                        style={{
                          width: '100%', marginTop: 10,
                          background: '#7C3AED', color: '#fff', border: 'none',
                          padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit', minHeight: 38,
                        }}
                      >
                        Re-envasar (cubeta / galón / litro)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={S.toolbar}>
          <input style={S.search} type="text" placeholder="Buscar por código o producto..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'en_camino', label: `En camino (${totales.enCamino})` },
              { value: 'en_almacen', label: `En stock (${totales.enAlmacen})` },
              { value: 'todos', label: 'Todos' },
            ]}
            color="brand"
          />
        </div>

        {/* Sublotes agrupados por lote */}
        {loading ? (
          <div style={S.loading}>Cargando sublotes...</div>
        ) : groupedByLote.length === 0 ? (
          <div style={S.empty}>
            {filter === 'en_camino'
              ? 'Sin sublotes en camino. Cuando Luis entregue un envío, aparecerá aquí.'
              : 'Sin sublotes que coincidan.'}
          </div>
        ) : (
          groupedByLote.map(({ lote, sublotes }) => (
            <div
              key={lote?.id || lote?.codigoLote || Math.random()}
              style={{
                ...S.card,
                /* FIX jun 2026 (N8): resaltar visualmente cuando es prueba */
                ...(esPrueba(lote) ? { background: 'var(--lp-warning-50)', borderLeft: '4px solid var(--lp-warning-600)' } : {}),
              }}
            >
              <div style={S.cardHeader}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.loteCode}>{lote?.codigo || lote?.codigoLote || lote?.id}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={S.cardTitle}>{lote?.producto || lote?.nombre}</div>
                    {esPrueba(lote) && <PruebaBadge size="md" />}
                  </div>
                  <div style={S.cardMeta}>
                    {sublotes.length} sublote(s)
                    {lote?.ordenCodigo && ` · ${lote.ordenCodigo}`}
                  </div>
                  {esPrueba(lote) && (
                    <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--lp-warning-100)', border: '1.5px solid var(--lp-warning-500)', borderRadius: 8, fontSize: 12, color: 'var(--lp-warning-800)' }}>
                      Lote de prueba — no sumes PT al stock físico, sólo simula recepción.
                    </div>
                  )}
                </div>
              </div>
              {sublotes.map(s => {
                const acciones = getAccionesSublote(s, rol);
                const estColor = ESTADO_SUBLOTE_COLOR[s.estado] || 'var(--lp-text-tertiary)';
                const estLabel = ESTADO_SUBLOTE_LABEL[s.estado] || s.estado || '—';
                const isBusy = busy === s.cod;
                const esTote = s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1;
                return (
                  <div key={s.cod} style={S.sublote}>
                    <div style={S.subloteRow}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={S.subloteCod}>{s.cod}</span>
                        {esTote && <span style={S.badge('#EDE9FE', '#7C3AED')}>TOTE</span>}
                        <span style={S.badge(estColor + '22', estColor)}>{estLabel}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                        {esTote ? `${s.lit}L granel` : `${s.qty} ${s.tipo} · ${s.lit}L`}
                        {s.marca && <> · {s.marca}</>}
                      </div>
                    </div>
                    {s.esHijoDe && (
                      <div style={{ fontSize: 11, color: '#7C3AED' }}>↳ re-envasado desde {s.esHijoDe}</div>
                    )}
                    {acciones.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {acciones.includes('escanearRecibirTeran') && (
                          <button
                            style={S.smallBtn}
                            disabled={isBusy}
                            onClick={() => recibirSublote(s)}
                          >
                            {isBusy ? '...' : (esTote ? 'Recibir TOTE' : 'Recibir')}
                          </button>
                        )}
                        {acciones.includes('reenvasarTote') && esTote && (
                          <button
                            style={{ ...S.smallBtn, background: '#7C3AED' }}
                            onClick={() => setReenvaseFor({ tote: s, lote })}
                          >
                            Re-envasar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}

        {/* Scanner */}
        {scanning && (
          <QRScanner onResult={handleScanResult} onClose={() => setScanning(false)} />
        )}

        {/* Re-envase modal (cuando Josué re-envasa un TOTE en Terán) */}
        {reenvaseFor && (
          <ReenvasarToteModal
            tote={reenvaseFor.tote}
            lote={reenvaseFor.lote}
            userName={userName}
            onClose={() => setReenvaseFor(null)}
            onSuccess={(payload) => {
              setReenvaseFor(null);
              reload();
              showToast(`Re-envasado: ${payload.q} ${payload.tipo}(s) desde ${payload.tote.cod} ✓`);
            }}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, ...(toast.isErr ? S.toastErr : {}) }}>
          <span style={{ marginRight: 8 }}>{toast.isErr ? '✕' : '✓'}</span>{toast.msg}
        </div>
      )}
      {ConfirmEl}
    </div>
  );
}
