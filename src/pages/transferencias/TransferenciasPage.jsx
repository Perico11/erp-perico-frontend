import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import PageTabs from '../../components/ui/PageTabs';
import SegmentedControl from '../../components/ui/SegmentedControl';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useConfirm from '../../hooks/useConfirm';
import useIsDesktop from '../../hooks/useIsDesktop';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { QRScanner } from '../../components/QRModal';
import { qrDataUrl } from '../../lib/qrGenerator';
import humanizeError from '../../utils/humanizeError'; /* AUDIT UX 16-jul (U4) */
import { PT_MEDIDAS, ptMedidaDef, medidaACubetas, etiquetaMedida } from '../../utils/ptMedidas';

/* ════════════════════════════════════════════════════════════════════════════
   TransferenciasPage — ÓRDENES DE TRANSFERENCIA (OT) Fábrica → Terán.

   Reskin Design System verde (Claude Design), 1:1 con el patrón de
   RecoleccionPage / AlmacenRecepcion (tabs por estado + hero "Leer QR" +
   cards + realtime) y DevolucionesMP (sheet de crear con autocompletar desde
   inventario). REUSA componentes existentes; cero backend nuevo.

   Flujo de DOS escaneos (backend routes/transferencias.js):
     crear   → estado 'solicitada' (no mueve inventario)
     surtir  → 'surtida'  (Fábrica − / tránsito +)  · técnico|admin
     recibir → 'recibida' (tránsito − / Terán +)    · almacén|admin
     cancelar → 'cancelada' (revierte tránsito si venía de surtida) · admin|almacén

   El QR codifica la URL '/transfer-qr/<otId>'. handleScan extrae el otId, busca
   la OT en la lista, decide la acción por estado+rol y dispara api.escanearOT.
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Iconos line SVG (sin emojis) ─────────────────────────────────────────── */
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
function IconTruck({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 4h13v12H1z" /><path d="M14 8h4l3 3v5h-7" />
      <circle cx="5.5" cy="18.5" r="2" /><circle cx="17.5" cy="18.5" r="2" />
    </svg>
  );
}
function IconCheck({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
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
function IconPlus({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconPrint({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}
function IconX({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function IconEdit({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/* ── Estado → presentación del badge (color-mix 14% como el resto del DS) ──── */
const ESTADO_META = {
  solicitada: { label: 'Solicitada', color: 'var(--lp-warning-600)' },
  surtida:    { label: 'En tránsito', color: 'var(--lp-info-600)' },
  recibida:   { label: 'Recibida', color: 'var(--lp-brand-600)' },
  cancelada:  { label: 'Cancelada', color: 'var(--lp-text-tertiary)' },
};

/* Tab activa ↔ estado de la OT */
const TAB_TO_ESTADO = { solicitadas: 'solicitada', transito: 'surtida', recibidas: 'recibida', canceladas: 'cancelada' };

/* Acción del scan según estado + rol (espejo de SM.validarTransicionOT).
   Devuelve la acción permitida, o { error } con el motivo de por qué no aplica. */
function accionParaScan(estado, rol) {
  if (estado === 'solicitada' && (rol === 'tecnico' || rol === 'admin')) return { accion: 'surtir' };
  if (estado === 'surtida' && (rol === 'almacen' || rol === 'admin')) return { accion: 'recibir' };
  if (estado === 'solicitada') return { error: 'Esta OT está por surtir — la surte fábrica (técnico) o admin.' };
  if (estado === 'surtida') return { error: 'Esta OT está en tránsito — la recibe almacén (Terán) o admin.' };
  if (estado === 'recibida') return { error: 'Esta OT ya fue recibida en Terán.' };
  if (estado === 'cancelada') return { error: 'Esta OT está cancelada.' };
  return { error: 'No hay acción disponible para esta OT.' };
}

/* Extrae el otId de un QR. El QR codifica '/transfer-qr/<otId>'. Acepta también
   el texto crudo (otId directo) por si el lector entrega solo el id. */
function extraerOtId(texto) {
  if (!texto) return '';
  const s = String(texto).trim();
  const m = /transfer-qr\/([^/?#]+)/.exec(s);
  return m ? m[1] : s;
}

/* URL imprimible del QR (mismo esquema que qrPayload del backend, pero absoluta
   para que el QR físico sea escaneable desde cualquier dispositivo). */
function urlQrOT(otId) {
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return window.location.origin + base + 'transfer-qr/' + otId;
}

const fmtFecha = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return ''; }
};

/* Texto de cantidad de una línea de OT, consciente de presentación para PT.
   PT con presentación → "52 cubetas" / "1 tote" (+ " · ENVASAR" si pide envasado
   desde granel). Envases/tapas (o PT legacy sin presentación) → "<cantidad> <unidad>".
   Usado en la card, el chip del sheet y la hoja imprimible para hablar el mismo idioma. */
function descLineaCantidad(l) {
  if (l && l.tipo === 'pt' && l.presentacion) {
    const conteo = l.cantidadPresentacion != null ? l.cantidadPresentacion : l.cantidad;
    return etiquetaMedida(l.presentacion, conteo) + (l.envasar ? ' · ENVASAR' : '');
  }
  return `${l.cantidad} ${l.unidad || ''}`.trim();
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
/* JUL 2026: `embedded` — la pantalla también vive como vista del hub "Logística"
   (/transferencias) del admin (patrón AlmacenPage). Solo suprime su TopBar. */
export default function TransferenciasPage({ embedded = false }) {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [confirm, ConfirmEl] = useConfirm();
  const userName = user?.nombre || '?';
  const rol = user?.rol || '';

  /* Pestaña deep-linkeable vía ?tab= */
  const TABS_VALIDOS = ['solicitadas', 'transito', 'recibidas', 'canceladas'];
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get('tab');
    return (t && TABS_VALIDOS.includes(t)) ? t : 'solicitadas';
  });
  useEffect(() => {
    const t = searchParams.get('tab');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t && TABS_VALIDOS.includes(t)) setActiveTab(t);
  }, [searchParams]);

  const [searchQ, setSearchQ] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(null);          // otId mientras se escribe
  const [scannerOpen, setScannerOpen] = useState(false);
  const [crearOpen, setCrearOpen] = useState(false);
  const [prefillSel, setPrefillSel] = useState(null); // {tipo, sel} desde ?nueva= (botón "Transferir a Terán" de Inventario)
  const [printOT, setPrintOT] = useState(null);    // OT cuyo QR se imprime
  const [editOT, setEditOT] = useState(null);      // OT en edición (sustituir/cambiar líneas)

  const showToast = useCallback((msg, isErr = false) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 4200);
  }, []);

  /* Prefill desde "Transferir a Terán" de Inventario: ?nueva=<JSON línea> abre la
     solicitud con el ítem ya seleccionado (el usuario solo pone la cantidad). */
  useEffect(() => {
    const nueva = searchParams.get('nueva');
    if (!nueva) return;
    try {
      const l = JSON.parse(nueva);
      if (l && l.tipo) {
        const sel = l.tipo === 'pt' ? (l.producto || '') : l.tipo === 'envase' ? ((l.catKey || '') + '|||' + (l.subKey || '')) : (l.tapaKey || '');
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefillSel({ tipo: l.tipo, sel }); setCrearOpen(true);
      }
    } catch { /* ?nueva= malformado → ignora */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* AUDIT UX 16-jul (U19): 8s → 30s; respaldo; el WS empuja (onTransferencias) */
  const { data, loading, reload } = useApiData(() => api.getOTs(), [], 30000);
  /* Inventario + envases para el autocompletar del sheet de crear (cargados una
     vez; sin polling — son catálogos relativamente estables). */
  const { data: invData } = useApiData(() => api.getInventario(), null, 0);
  const { data: envData } = useApiData(() => api.getEnvases(), null, 0);
  /* PT desglosado por ubicación → para mostrar el disponible POR PRESENTACIÓN
     (tote/cubeta/galón/litro/atomizador) en Fábrica dentro del sheet de crear. */
  const { data: ptUbicData } = useApiData(() => api.getPTPorUbicacion(), null, 0);

  /* Realtime: el backend hace broadcast 'inventario' Y 'transferencias' en cada
     scan, y 'transferencias' al crear. onInventario cubre los scans (como pide el
     contrato); onTransferencias cubre la creación por otro usuario; onTrazabilidad
     queda por simetría con las páginas hermanas. */
  useRealtimeSync({
    onInventario: () => reload(),
    onTransferencias: () => reload(),
    onTrazabilidad: () => reload(),
  });

  const ots = useMemo(() => {
    const arr = Array.isArray(data) ? data : (data?.data || []);
    return (Array.isArray(arr) ? arr : [])
      .slice()
      .sort((a, b) => (b.fechaSolicitud || '').localeCompare(a.fechaSolicitud || ''));
  }, [data]);

  const counts = useMemo(() => ({
    solicitadas: ots.filter(o => o.estado === 'solicitada').length,
    transito:    ots.filter(o => o.estado === 'surtida').length,
    recibidas:   ots.filter(o => o.estado === 'recibida').length,
    canceladas:  ots.filter(o => o.estado === 'cancelada').length,
  }), [ots]);

  const visibles = useMemo(() => {
    const estado = TAB_TO_ESTADO[activeTab];
    let list = ots.filter(o => o.estado === estado);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(o =>
        (o.folio || '').toLowerCase().includes(q) ||
        (o.lineas || []).some(l => (l.nombre || '').toLowerCase().includes(q)) ||
        (o.solicitadoPor || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [ots, activeTab, searchQ]);

  /* Quién puede crear OTs (mismo gate que el backend: admin/almacen/inventario) */
  const canCrear = rol === 'admin' || rol === 'almacen' || rol === 'inventario';
  /* Quién puede usar el hero "Leer QR": surtir (técnico) o recibir (almacén) o admin */
  const canScan = rol === 'admin' || rol === 'almacen' || rol === 'tecnico';

  /* ── Ejecutar una acción sobre una OT (botón de card o confirmación) ── */
  const ejecutar = useCallback(async (ot, accion, { skipConfirm } = {}) => {
    const LABEL = { surtir: 'Surtir', recibir: 'Recibir en Terán', cancelar: 'Cancelar OT' };
    const label = LABEL[accion] || accion;
    if (!skipConfirm) {
      const ok = await confirm(`¿${label}: ${ot.folio}?`, {
        confirmText: label,
        danger: accion === 'cancelar',
      });
      if (!ok) return;
    }
    setBusy(ot.id);
    try {
      const r = await api.escanearOT(ot.id, accion);
      reload();
      if (r?.idempotente) showToast(`${ot.folio}: ${r.aviso || 'sin cambios'}`);
      else showToast(`${ot.folio}: ${label.toLowerCase()} ✓`);
    } catch (err) {
      showToast(humanizeError(err), true); /* AUDIT UX 16-jul (U4) */
      /* El 409 de la state machine ("La OT está en estado…") = otro teléfono
         ya la movió — refrescamos para que la card salte a su tab real. */
      if (err?.status === 409) reload();
    } finally {
      setBusy(null);
    }
  }, [confirm, reload, showToast]);

  /* ── Resultado del escáner: extraer otId, ubicar la OT, decidir acción ── */
  const handleScan = useCallback(async (result) => {
    setScannerOpen(false);
    const raw = result?.cod || result?.raw || '';
    const otId = extraerOtId(raw);
    if (!otId) return showToast('QR no reconocido', true);

    const ot = ots.find(o => o.id === otId || o.folio === otId);
    if (!ot) return showToast('No se encontró la OT escaneada (¿lista desactualizada?)', true);

    const { accion, error } = accionParaScan(ot.estado, rol);
    if (error) {
      /* Estado/rol no permite acción: mostramos la OT y explicamos qué falta. */
      showToast(`${ot.folio} (${ESTADO_META[ot.estado]?.label || ot.estado}): ${error}`, true);
      const dest = ot.estado === 'surtida' ? 'transito' : ot.estado === 'recibida' ? 'recibidas' : ot.estado === 'cancelada' ? 'canceladas' : 'solicitadas';
      setActiveTab(dest);
      return;
    }
    /* El escaneo ES la confirmación física → no re-preguntamos. */
    await ejecutar(ot, accion, { skipConfirm: true });
  }, [ots, rol, ejecutar, showToast]);

  /* ── Tabs (móvil + escritorio comparten la lista, distinto estilo) ── */
  const TABS = [
    { id: 'solicitadas', label: `Solicitadas · ${counts.solicitadas}` },
    { id: 'transito',    label: `En tránsito · ${counts.transito}` },
    { id: 'recibidas',   label: `Recibidas · ${counts.recibidas}` },
    { id: 'canceladas',  label: `Canceladas · ${counts.canceladas}` },
  ];

  const emptyCopy =
    activeTab === 'solicitadas' ? (searchQ ? 'Sin resultados' : 'Sin solicitudes pendientes de surtir.')
    : activeTab === 'transito'  ? (searchQ ? 'Sin resultados' : 'Nada en tránsito hacia Terán.')
    : activeTab === 'recibidas' ? (searchQ ? 'Sin resultados' : 'Aún sin recepciones en Terán.')
    : (searchQ ? 'Sin resultados' : 'Sin órdenes canceladas.');

  if (loading && !data) {
    return (
      <>
        {!embedded && <TopBar title="Transferencias" />}
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  return (
    <>
      {!embedded && <TopBar title="Transferencias" />}
      <div style={isDesktop ? S.wrapDesktop : S.wrapMobile}>

        {/* Saludo + contador (TopBar no trae subtitle) */}
        <div style={S.greet}>Hola {userName} · Fábrica → Terán · {counts.solicitadas} por surtir</div>

        {/* HERO "Leer QR" + botón Nueva solicitud.
            Móvil: hero verde ancho completo, botón debajo.
            Escritorio: barra superior alineada a la derecha (botones tamaño estándar). */}
        {(canScan || canCrear) && (
          isDesktop ? (
            <div style={S.actionBarDesktop}>
              {canCrear && (
                <button style={S.newBtnDesktop} onClick={() => setCrearOpen(true)}
                  data-id="transferencias.btn.nueva" data-rol="admin,almacen,inventario">
                  <IconPlus size={18} /> Nueva solicitud
                </button>
              )}
              {canScan && (
                <button style={S.scanBtnDesktop} onClick={() => setScannerOpen(true)}
                  data-id="transferencias.btn.scan" data-rol="admin,almacen,tecnico"
                  aria-label="Leer QR de transferencia">
                  <IconQR size={20} /> Leer QR
                </button>
              )}
            </div>
          ) : (
            <>
              {canScan && (
                <button style={S.scanHeroMobile} onClick={() => setScannerOpen(true)}
                  data-id="transferencias.btn.scan" data-rol="admin,almacen,tecnico"
                  aria-label="Leer QR de transferencia">
                  <IconQR size={24} /> Leer QR
                </button>
              )}
              {canCrear && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                  <button style={S.newBtnMobile} onClick={() => setCrearOpen(true)}
                    data-id="transferencias.btn.nueva" data-rol="admin,almacen,inventario">
                    <IconPlus size={16} /> Nueva solicitud
                  </button>
                </div>
              )}
            </>
          )
        )}

        {/* Tabs pill */}
        <PageTabs
          tabs={TABS.map(t => ({ ...t, style: (a) => S.tab(a, isDesktop) }))}
          activeTab={activeTab}
          onChange={setActiveTab}
          style={S.tabs}
        />

        {/* Búsqueda (escritorio) */}
        {isDesktop && (
          <div style={S.toolbar}>
            <input
              type="text" style={S.search}
              placeholder="Buscar folio, producto o solicitante…"
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
            />
          </div>
        )}

        {/* Lista / grid de cards */}
        {visibles.length === 0 ? (
          <div style={S.empty}>
            <IconCheck size={38} />
            <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>{emptyCopy}</div>
          </div>
        ) : (
          <div style={isDesktop ? S.grid : undefined}>
            {visibles.map(ot => (
              <OTCard
                key={ot.id}
                ot={ot}
                rol={rol}
                busy={busy === ot.id}
                isDesktop={isDesktop}
                onAccion={(accion) => ejecutar(ot, accion)}
                onPrint={() => setPrintOT(ot)}
                onEditar={() => setEditOT(ot)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scanner */}
      {scannerOpen && (
        <QRScanner onResult={handleScan} onClose={() => setScannerOpen(false)} />
      )}

      {/* Sheet de crear / editar (sustituir líneas) */}
      {(crearOpen || editOT) && (
        <CrearSheet
          isDesktop={isDesktop}
          inv={invData}
          env={envData}
          ptUbic={ptUbicData}
          initialSel={editOT ? null : prefillSel}
          editOT={editOT}
          onClose={() => { setCrearOpen(false); setPrefillSel(null); setEditOT(null); }}
          onSaved={(res) => {
            const wasEdit = !!editOT;
            setCrearOpen(false); setEditOT(null); setPrefillSel(null);
            reload();
            if (wasEdit) showToast(`Solicitud ${res?.folio || editOT?.folio || ''} actualizada`);
            else {
              showToast(`Solicitud creada: ${res?.folio || ''}`);
              if (res?.ot) setPrintOT(res.ot);   // ofrecer imprimir el QR de inmediato
            }
          }}
        />
      )}

      {/* Hoja imprimible del QR */}
      {printOT && <OTQRPrintModal ot={printOT} onClose={() => setPrintOT(null)} />}

      {/* Toast */}
      {toast && (
        /* AUDIT UX 16-jul (U20): anunciar el toast a lectores de pantalla */
        <div role="status" aria-live="polite" style={{ ...S.toast, ...(toast.isErr ? S.toastErr : {}) }}>
          {toast.isErr
            ? <span style={{ display: 'inline-flex' }} aria-hidden="true"><IconX size={14} /></span>
            : <IconCheck size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
      {ConfirmEl}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Card de OT — diseño "glass forest" (handoff Pinturas El Perico, jun 2026).
   Reproduce 1:1 el spec SPEC-CARD-OT: tarjeta glass, chips por tipo, ruta,
   ítems, meta, nota y acciones. SOLO cambia la presentación; la LÓGICA es la
   misma (permisos por estado+rol, handlers reales, data-id/data-rol).
   ═══════════════════════════════════════════════════════════════════════════ */
/* Chip de tipo de línea — color por categoría (igual que el mockup). */
const CHIP_TIPO = {
  pt:     { bg: 'rgba(15,122,90,.12)',  fg: '#0f7a5a' },
  tapa:   { bg: 'rgba(182,121,29,.12)', fg: '#9a6a13' },
  envase: { bg: 'rgba(40,116,166,.12)', fg: '#1f6aa6' },
};
/* Badge de estado — paleta del diseño (ámbar/azul/verde/gris). */
const ESTADO_DS = {
  solicitada: { label: 'Solicitada',  fg: '#9a6a13', bg: 'rgba(182,121,29,.12)', dot: '#B6791D' },
  surtida:    { label: 'En tránsito', fg: '#1f6aa6', bg: 'rgba(40,116,166,.12)', dot: '#1f6aa6' },
  recibida:   { label: 'Recibida',    fg: '#0f7a5a', bg: 'rgba(15,122,90,.12)',  dot: '#0f7a5a' },
  cancelada:  { label: 'Cancelada',   fg: '#5a6b63', bg: 'rgba(90,107,99,.12)',  dot: '#5a6b63' },
};
/* Parte "612 pz" / "52 cubetas" / "1 tote · ENVASAR" en [número, resto] para
   resaltar el número como en el diseño, sin perder la lógica de presentación. */
function splitCantidad(l) {
  const s = descLineaCantidad(l);
  const i = s.indexOf(' ');
  return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}

function OTCard({ ot, rol, busy, onAccion, onPrint, onEditar }) {
  const lineas = Array.isArray(ot.lineas) ? ot.lineas : [];

  /* Acciones contextuales por estado + rol (espejo de la SM en el backend) */
  const puedeSurtir   = ot.estado === 'solicitada' && (rol === 'tecnico' || rol === 'admin');
  const puedeRecibir  = ot.estado === 'surtida' && (rol === 'almacen' || rol === 'admin');
  /* Cancelar: en 'Solicitada' → Josué (almacen), Enrique (tecnico) y admin.
     En 'En tránsito' (surtida) → solo admin (válvula de reversa). */
  const puedeCancelar =
    (ot.estado === 'solicitada' && (rol === 'admin' || rol === 'almacen' || rol === 'tecnico')) ||
    (ot.estado === 'surtida' && rol === 'admin');
  /* Editar líneas: solo antes de surtir ('Solicitada'), por admin/almacen/tecnico. */
  const puedeEditar = ot.estado === 'solicitada' && (rol === 'admin' || rol === 'almacen' || rol === 'tecnico');

  const tipoLabel = (l) => l.tipo === 'pt' ? 'PT' : l.tipo === 'tapa' ? 'Tapa' : 'Envase';
  const em = ESTADO_DS[ot.estado] || ESTADO_DS.solicitada;

  /* Botones neutros (Editar / Imprimir): lado a lado (2 columnas). Si solo hay
     uno presente, ocupa el ancho completo. El nowrap de btnNeutral evita que
     "Imprimir hoja QR" se parta en dos líneas. */
  const neutrales = [];
  if (puedeEditar) neutrales.push('editar');
  if (ot.estado !== 'cancelada') neutrales.push('imprimir');
  const neutralFull = neutrales.length === 1 ? { gridColumn: '1 / -1' } : null;
  const hayAcciones = puedeSurtir || puedeRecibir || neutrales.length > 0 || puedeCancelar || ot.estado === 'recibida';

  const iconNeutral = (icon) => <span style={{ color: '#5a6b63', display: 'inline-flex' }}>{icon}</span>;

  return (
    <div style={C.card}>
      {/* Header: folio + estado */}
      <div style={C.head}>
        <span style={C.folio}>{ot.folio}</span>
        <span style={C.estado(em)}><i style={C.estadoDot(em)} />{em.label}</span>
      </div>

      {/* Ruta */}
      <div style={C.route}>
        <span style={C.routeFrom}>Fábrica</span>
        <span style={{ display: 'inline-flex', color: '#0f7a5a' }}><IconArrow size={18} /></span>
        <span style={C.routeTo}>Almacén Terán</span>
      </div>

      {/* Ítems */}
      <div style={C.items}>
        {lineas.map((l, i) => {
          const c = CHIP_TIPO[l.tipo] || CHIP_TIPO.envase;
          const [qn, qr] = splitCantidad(l);
          return (
            <div key={i} style={{ ...C.itemRow, ...(i === lineas.length - 1 ? { borderBottom: 'none' } : null) }}>
              <span style={C.itemTag(c)}>{tipoLabel(l)}</span>
              <span style={C.itemName}>{l.nombre || l.producto || '—'}</span>
              <span style={C.itemQty}><b style={C.itemQtyNum}>{qn}</b>{qr ? ' ' + qr : ''}</span>
            </div>
          );
        })}
      </div>

      {/* Meta: quién solicitó / surtió / recibió / canceló */}
      <div style={C.meta}>
        {ot.solicitadoPor && <div>Solicitó <b style={C.metaB}>{ot.solicitadoPor}</b>{ot.fechaSolicitud ? ` · ${fmtFecha(ot.fechaSolicitud)}` : ''}</div>}
        {ot.surtidoPor && <div>Surtió y entregó <b style={C.metaB}>{ot.surtidoPor}</b>{ot.fechaSurtido ? ` · ${fmtFecha(ot.fechaSurtido)}` : ''}</div>}
        {ot.estado === 'surtida' && !ot.recibidoPor && <div style={C.metaPend}>Por recibir en Terán · pendiente (escaneo de almacén)</div>}
        {ot.recibidoPor && <div>Recibió <b style={C.metaB}>{ot.recibidoPor}</b>{ot.fechaRecepcion ? ` · ${fmtFecha(ot.fechaRecepcion)}` : ''}</div>}
        {ot.canceladoPor && <div>Canceló <b style={C.metaB}>{ot.canceladoPor}</b>{ot.fechaCancelacion ? ` · ${fmtFecha(ot.fechaCancelacion)}` : ''}</div>}
      </div>

      {/* Nota */}
      {ot.nota && <div style={C.nota}>{ot.nota}</div>}

      {/* Acciones */}
      {hayAcciones && (
        <div style={C.actions}>
          {puedeSurtir && (
            <button style={C.btnPrimary} disabled={busy} onClick={() => onAccion('surtir')}
              data-id="transferencias.btn.surtir" data-rol="tecnico,admin">
              {busy ? <span aria-hidden="true">…</span> : <><IconTruck size={18} /> Surtir</>}
            </button>
          )}
          {puedeRecibir && (
            <button style={C.btnPrimary} disabled={busy} onClick={() => onAccion('recibir')}
              data-id="transferencias.btn.recibir" data-rol="almacen,admin">
              {busy ? <span aria-hidden="true">…</span> : <><IconCheck size={18} /> Recibir en Terán</>}
            </button>
          )}
          {puedeEditar && (
            <button style={{ ...C.btnNeutral, ...neutralFull }} disabled={busy} onClick={onEditar}
              data-id="transferencias.btn.editar" data-rol="admin,almacen,tecnico">
              {iconNeutral(<IconEdit size={16} />)} Editar
            </button>
          )}
          {ot.estado !== 'cancelada' && (
            <button style={{ ...C.btnNeutral, ...neutralFull }} onClick={onPrint}
              data-id="transferencias.btn.imprimir" data-rol="admin,almacen,inventario,tecnico">
              {iconNeutral(<IconPrint size={16} />)} Imprimir hoja QR
            </button>
          )}
          {puedeCancelar && (
            <button style={C.btnCancel} disabled={busy} onClick={() => onAccion('cancelar')}
              data-id="transferencias.btn.cancelar" data-rol="admin,almacen,tecnico">
              Cancelar
            </button>
          )}
          {/* Estado terminal sin acción para este rol → chip pasivo */}
          {ot.estado === 'recibida' && (
            <div style={C.doneChip}><IconCheck size={16} /> Recibida en Terán</div>
          )}
        </div>
      )}
    </div>
  );
}

/* Estilos de la card "glass forest" — colores hardcodeados del handoff (tema
   claro forest; es un look deliberado, no usa los tokens var(--lp-*)). */
const C = {
  card: {
    position: 'relative', width: '100%',
    background: 'rgba(250,253,252,0.72)',
    backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,0.55)', borderRadius: 24,
    boxShadow: '0 18px 50px rgba(80,140,110,.20),0 4px 12px rgba(80,140,110,.10)',
    padding: '22px 22px 20px', display: 'flex', flexDirection: 'column', gap: 16,
    marginBottom: 14, fontFamily: 'var(--lp-font-sans)',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  folio: { fontSize: 11, fontWeight: 500, color: '#0f7a5a', letterSpacing: '0.04em', background: 'rgba(15,122,90,.10)', borderRadius: 99, padding: '4px 11px', whiteSpace: 'nowrap' },
  estado: (m) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: m.fg, background: m.bg, borderRadius: 99, padding: '5px 12px', whiteSpace: 'nowrap' }),
  estadoDot: (m) => ({ width: 7, height: 7, borderRadius: '50%', background: m.dot, display: 'inline-block' }),
  route: { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid rgba(0,0,0,.06)', borderRadius: 14, padding: '13px 16px', boxShadow: '0 1px 2px rgba(0,0,0,.04)', flexWrap: 'wrap' },
  routeFrom: { fontSize: 14, fontWeight: 500, color: '#16201c' },
  routeTo: { fontSize: 14, fontWeight: 500, color: '#0f7a5a' },
  items: { display: 'flex', flexDirection: 'column', gap: 2 },
  itemRow: { display: 'grid', gridTemplateColumns: '62px 1fr auto', alignItems: 'center', gap: 10, padding: '7px 4px', borderBottom: '1px solid rgba(0,0,0,.05)' },
  itemTag: (c) => ({ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', borderRadius: 99, padding: '3px 0', color: c.fg, background: c.bg }),
  itemName: { fontSize: 13, fontWeight: 500, color: '#16201c', textTransform: 'uppercase', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemQty: { fontSize: 12, color: '#5a6b63', whiteSpace: 'nowrap' },
  itemQtyNum: { color: '#16201c', fontWeight: 500 },
  meta: { fontSize: 12, color: '#5a6b63', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 2 },
  metaB: { color: '#16201c', fontWeight: 500 },
  metaPend: { color: '#94a39b', fontStyle: 'italic' },
  nota: { background: '#fff', border: '1px solid rgba(0,0,0,.06)', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#16201c', boxShadow: '0 1px 2px rgba(0,0,0,.03)', wordBreak: 'break-word' },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  btnPrimary: { gridColumn: '1 / -1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: '#fff', background: '#0f7a5a', borderRadius: 99, padding: 13, minHeight: 46, boxShadow: '0 6px 16px rgba(15,122,90,.30)' },
  btnNeutral: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: '#16201c', background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 14, padding: 12, minHeight: 46, boxShadow: '0 1px 2px rgba(0,0,0,.04)', whiteSpace: 'nowrap' },
  btnCancel: { gridColumn: '1 / -1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: '#b3261e', background: 'rgba(179,38,30,.05)', border: '1px solid rgba(179,38,30,.18)', borderRadius: 14, padding: 12, minHeight: 46 },
  doneChip: { gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(15,122,90,.08)', border: '1px solid rgba(15,122,90,.18)', color: '#0f7a5a', borderRadius: 14, padding: 12, fontSize: 13, fontWeight: 500 },
};

/* ═══════════════════════════════════════════════════════════════════════════
   CrearSheet — bottom-sheet (móvil) / modal (escritorio) para armar una OT.
   Añade LÍNEAS: tipo (PT / Envase / Tapa) → autocompletar desde inventario /
   envases → cantidad → "Agregar línea". Lista las líneas (con quitar). Submit →
   api.crearOT(lineas, nota). Calca el autocompletar de DevolucionesMPPage.
   ═══════════════════════════════════════════════════════════════════════════ */
/* Presentación PT → columna del desglose pt-por-ubicacion (backend usa 'atm'). */
const PRES_COL = { tote: 'tote', cubeta: 'cubeta', galon: 'galon', litro: 'litro', atomizador750: 'atm' };

function CrearSheet({ isDesktop, inv, env, ptUbic, onClose, onSaved, initialSel, editOT }) {
  useBodyScrollLock(true);
  const isEdit = !!editOT;

  /* Desenvolver shapes envueltos {ok, data:{...}} (defensivo, igual que DevolucionesMP). */
  const invPt = (inv && inv.data && inv.data.pt) || (inv && inv.pt) || {};
  const envases = (env && env.data) || env || {};
  const categorias = envases.categorias || {};
  const tapas = envases.tapas || {};

  /* Desglose PT por ubicación (defensivo: puede venir envuelto en {ok,data} o plano).
     fabricaBuckets[<producto>] = { tote, cubeta, galon, litro, atm, ... } disponibles en Fábrica. */
  const fabricaBuckets = (ptUbic && (ptUbic.data?.fabrica || ptUbic.fabrica)) || {};

  /* Listado de PT ordenado */
  const ptList = useMemo(() => Object.keys(invPt).sort((a, b) => a.localeCompare(b)), [invPt]);

  /* Opciones de envase aplanadas: catKey/subKey → label legible.
     value = "catKey|||subKey" para parsear sin ambigüedad. */
  const envaseOpts = useMemo(() => {
    const out = [];
    Object.entries(categorias).forEach(([catKey, cat]) => {
      const subs = (cat && cat.subcategorias) || {};
      Object.entries(subs).forEach(([subKey, sub]) => {
        const label = `${(cat.nombre || catKey)} · ${(sub.nombre || sub.marca || subKey)}`;
        out.push({ value: catKey + '|||' + subKey, label, catKey, subKey, nombre: sub.nombre || subKey, stock: Number(sub.stock) || 0, unidad: sub.unidad || 'pz' });
      });
    });
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [categorias]);

  /* Opciones de tapa */
  const tapaOpts = useMemo(() => {
    return Object.entries(tapas)
      .map(([tapaKey, t]) => ({ value: tapaKey, label: t.nombre || tapaKey, tapaKey, nombre: t.nombre || tapaKey, stock: Number(t.stock) || 0, unidad: t.unidad || 'pz' }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tapas]);

  /* Estado del builder de línea actual */
  const [tipo, setTipo] = useState(initialSel?.tipo || 'pt');
  const [sel, setSel] = useState(initialSel?.sel || '');         // PT name | "cat|||sub" | tapaKey según tipo
  const [cantidad, setCantidad] = useState('');
  const [ptPres, setPtPres] = useState('tote');     // presentación PT elegida (default tote: el PT suele venir a granel)
  const [envasar, setEnvasar] = useState(false);    // pedir envasada desde granel (solo si ptPres ≠ tote)
  /* En edición, precargamos las líneas y la nota de la OT existente. */
  const [lineas, setLineas] = useState(() => (isEdit && Array.isArray(editOT.lineas)) ? editOT.lineas.map(l => ({ ...l })) : []);
  const [nota, setNota] = useState(isEdit ? (editOT.nota || '') : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);  // índice de la línea que se está editando (null = agregar nueva)

  /* Al cambiar de tipo, limpiar la selección (y resetear presentación si dejamos PT) */
  const onTipo = (t) => { setTipo(t); setSel(''); if (t !== 'pt') { setPtPres('tote'); setEnvasar(false); } };

  /* Disponible por presentación en Fábrica del PT elegido (columnas tote/cubeta/galon/litro/atm). */
  const fabricaPres = (tipo === 'pt' && sel.trim() && fabricaBuckets[sel.trim()]) || {};

  /* Resuelve la selección actual a sus campos canónicos + stock + nombre */
  const resuelto = useMemo(() => {
    if (tipo === 'pt') {
      const nombre = sel.trim();
      if (!nombre) return null;
      const r = invPt[nombre];
      /* stock = total cub-equivalente en Fábrica (campo qty del inventario PT).
         presentacion/envasar viajan en la línea; el backend mueve cub-equivalente. */
      return {
        ok: !!r, nombre, unidad: 'cub', stock: r ? (Number(r.qty) || 0) : null,
        linea: { tipo: 'pt', producto: nombre, nombre, unidad: 'cub', presentacion: ptPres, envasar: ptPres !== 'tote' && envasar },
      };
    }
    if (tipo === 'envase') {
      const o = envaseOpts.find(x => x.value === sel);
      return o ? { ok: true, nombre: o.label, unidad: o.unidad, stock: o.stock, linea: { tipo: 'envase', catKey: o.catKey, subKey: o.subKey, nombre: o.nombre, unidad: o.unidad } } : null;
    }
    if (tipo === 'tapa') {
      const o = tapaOpts.find(x => x.value === sel);
      return o ? { ok: true, nombre: o.label, unidad: o.unidad, stock: o.stock, linea: { tipo: 'tapa', tapaKey: o.tapaKey, nombre: o.nombre, unidad: o.unidad } } : null;
    }
    return null;
  }, [tipo, sel, invPt, envaseOpts, tapaOpts, ptPres, envasar]);

  /* Al elegir/cambiar el PT, autoselecciona una presentación CON stock envasado
     (la de mayor disponible) y apaga "envasar" si el nuevo producto no tiene
     granel. Evita quedar en 'tote' deshabilitado cuando el producto solo tiene
     cubetas, etc. */
  useEffect(() => {
    if (tipo !== 'pt' || !(resuelto && resuelto.ok)) return;
    const dispOf = (k) => Number(fabricaPres[PRES_COL[k]] || 0);
    const granel = dispOf('tote');
    const env = granel > 0 ? envasar : false;
    if (granel <= 0 && envasar) setEnvasar(false);
    if (env || dispOf(ptPres) > 0) return;
    const best = PT_MEDIDAS.map(m => m.key).sort((a, b) => dispOf(b) - dispOf(a))[0];
    if (best && dispOf(best) > 0 && best !== ptPres) setPtPres(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, tipo]);

  const cantNum = Number(cantidad);
  /* Presentación válida: 'tote' requiere totes; otra medida requiere stock
     envasado O el flag envasar (se envasará desde granel). Bloquea el caso
     "pedir cubetas sin cubetas y sin envasar" que dejaba OTs descuadradas. */
  const presDispActual = tipo === 'pt' ? Number(fabricaPres[PRES_COL[ptPres]] || 0) : 1;
  const presValida = tipo !== 'pt'
    ? true
    : (ptPres === 'tote' ? presDispActual > 0 : (presDispActual > 0 || envasar));
  /* Tope de Fábrica: una OT solo mueve lo que hay. No permitir pedir más del stock
     en Fábrica (cub-equiv para PT). Suma lo ya agregado en ESTA solicitud del mismo
     ítem (excluye la línea en edición) para que dos líneas no evadan el tope. */
  const cantEnStock = tipo === 'pt' ? medidaACubetas(ptPres, cantNum) : cantNum;
  const keyActual = resuelto && resuelto.ok
    ? (tipo === 'pt' ? 'pt:' + (resuelto.linea.producto || resuelto.nombre)
       : tipo === 'envase' ? 'env:' + resuelto.linea.catKey + '/' + resuelto.linea.subKey
       : 'tap:' + resuelto.linea.tapaKey)
    : null;
  const yaEnOT = keyActual ? lineas.reduce((s, l, i) => {
    if (i === editingIdx) return s;
    const k = l.tipo === 'pt' ? 'pt:' + (l.producto || l.nombre)
      : l.tipo === 'envase' ? 'env:' + l.catKey + '/' + l.subKey
      : 'tap:' + l.tapaKey;
    return k === keyActual ? s + (Number(l.cantidad) || 0) : s;
  }, 0) : 0;
  const excedeFabrica = !!(resuelto && resuelto.ok && resuelto.stock != null
    && Number.isFinite(cantEnStock) && (cantEnStock + yaEnOT) > resuelto.stock + 0.001);
  const puedeAgregar = !!(resuelto && resuelto.ok && Number.isFinite(cantNum) && cantNum > 0 && presValida && !excedeFabrica);

  /* Resetea el builder de línea a su estado vacío (tras agregar/guardar/cancelar). */
  const resetBuilder = () => { setSel(''); setCantidad(''); setEnvasar(false); setPtPres('tote'); setEditingIdx(null); };

  /* Construye la línea canónica desde el estado ACTUAL del builder, o null si no es
     válida (ítem no resuelto, cantidad ≤ 0, presentación inválida o excede Fábrica).
     Compartida por "Guardar línea" y por el submit (para auto-confirmar una edición en
     curso que el usuario no confirmó explícitamente). */
  const construirLineaActual = () => {
    if (!puedeAgregar) return null;
    /* PT: cantidad = cubeta-equivalente (medidaACubetas), conserva el conteo en la
       presentación + flag envasar. Envase/tapa: cantidad cruda como siempre. */
    return tipo === 'pt'
      ? { ...resuelto.linea, presentacion: ptPres, cantidadPresentacion: cantNum, envasar: ptPres !== 'tote' && envasar, cantidad: medidaACubetas(ptPres, cantNum) }
      : { ...resuelto.linea, cantidad: cantNum };
  };

  /* Agregar nueva línea O guardar los cambios de la línea en edición (editingIdx). */
  const agregarLinea = () => {
    const nueva = construirLineaActual();
    if (!nueva) {
      setErr(excedeFabrica
        ? `No puedes pedir más de lo que hay en Fábrica (${resuelto?.stock?.toLocaleString('es-MX')} ${resuelto?.unidad || ''}).`
        : 'Elige un ítem válido y una cantidad > 0.');
      return;
    }
    setErr('');
    if (editingIdx != null) {
      setLineas(prev => prev.map((l, i) => i === editingIdx ? nueva : l));   // reemplaza en su lugar
    } else {
      setLineas(prev => [...prev, nueva]);
    }
    resetBuilder();
  };

  /* Carga una línea existente en el builder para cambiar su ítem y/o cantidad. */
  const editarLinea = (idx) => {
    const l = lineas[idx];
    if (!l) return;
    setErr('');
    setTipo(l.tipo);
    if (l.tipo === 'pt') {
      setSel(l.producto || l.nombre || '');
      setPtPres(l.presentacion || 'tote');
      setEnvasar(!!l.envasar);
      setCantidad(String(l.cantidadPresentacion != null ? l.cantidadPresentacion : l.cantidad));
    } else if (l.tipo === 'envase') {
      setSel((l.catKey || '') + '|||' + (l.subKey || ''));
      setCantidad(String(l.cantidad));
    } else {
      setSel(l.tapaKey || '');
      setCantidad(String(l.cantidad));
    }
    setEditingIdx(idx);
  };

  const quitarLinea = (idx) => {
    setLineas(prev => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) resetBuilder();
    else if (editingIdx != null && idx < editingIdx) setEditingIdx(editingIdx - 1);  // mantener el índice apuntando a la misma línea
  };

  const guardar = async () => {
    setErr('');
    /* Auto-confirmar la línea EN EDICIÓN que el usuario no confirmó con "Guardar línea"
       (trampa de UX: cambiar la cantidad y pulsar "Guardar cambios" directo enviaba el
       valor viejo). Si esa línea es inválida/excede Fábrica, bloquea con mensaje claro
       en lugar de mandar el valor anterior en silencio. */
    let lineasFinal = lineas;
    if (editingIdx != null) {
      const pend = construirLineaActual();
      if (!pend) {
        setErr(excedeFabrica
          ? `La línea en edición excede lo disponible en Fábrica (${resuelto?.stock?.toLocaleString('es-MX')} ${resuelto?.unidad || ''}). Corrígela o cancela la edición antes de guardar.`
          : 'Tienes una línea a medio editar. Confírmala con “Guardar línea” o cancela la edición antes de guardar.');
        return;
      }
      lineasFinal = lineas.map((l, i) => i === editingIdx ? pend : l);
    }
    if (lineasFinal.length === 0) { setErr('Agrega al menos una línea a la solicitud.'); return; }
    setSaving(true);
    try {
      const res = isEdit
        ? await api.editarOT(editOT.id, lineasFinal, nota.trim() || undefined)
        : await api.crearOT(lineasFinal, nota.trim() || undefined);
      onSaved && onSaved(res);
    } catch (e) {
      setErr(humanizeError(e)); /* AUDIT UX 16-jul (U4) */
    } finally {
      setSaving(false);
    }
  };

  const datalistId = 'ot-pt-list';

  return (
    <div style={SH.overlay(isDesktop)}>
      <div style={SH.sheet(isDesktop)}>
        <div style={{ flexShrink: 0, padding: '18px 20px 0' }}>
          <div style={SH.h}>{isEdit ? `Editar solicitud ${editOT.folio}` : 'Nueva solicitud de transferencia'}</div>
          <div style={SH.s}>{isEdit
            ? 'Sustituye ítems, cambia cantidades o agrega/quita líneas. Solo disponible antes de surtir.'
            : 'Fábrica → Terán · el inventario se mueve al surtir y recibir, no ahora.'}</div>
        </div>

        <div style={SH.body}>
          {/* ── Builder de línea ── */}
          <label style={SH.lbl}>Tipo de ítem</label>
          <div data-id="transferencias.select.tipo" data-rol="admin,almacen,inventario">
            <SegmentedControl
              options={[
                { value: 'pt', label: 'Producto (PT)' },
                { value: 'envase', label: 'Envase' },
                { value: 'tapa', label: 'Tapa' },
              ]}
              value={tipo} onChange={onTipo}
            />
          </div>

          {/* Selector del ítem según tipo */}
          {tipo === 'pt' ? (
            <>
              <label style={SH.lbl}>Producto terminado</label>
              <input style={SH.input} list={datalistId} value={sel} onChange={(e) => setSel(e.target.value)}
                data-id="transferencias.input.pt" data-rol="admin,almacen,inventario"
                placeholder="Escribe o elige un producto" />
              <datalist id={datalistId}>{ptList.map(p => <option key={p} value={p} />)}</datalist>
            </>
          ) : tipo === 'envase' ? (
            <>
              <label style={SH.lbl}>Envase</label>
              <select style={SH.select} value={sel} onChange={(e) => setSel(e.target.value)}
                data-id="transferencias.select.envase" data-rol="admin,almacen,inventario">
                <option value="">Elige un envase…</option>
                {envaseOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </>
          ) : (
            <>
              <label style={SH.lbl}>Tapa</label>
              <select style={SH.select} value={sel} onChange={(e) => setSel(e.target.value)}
                data-id="transferencias.select.tapa" data-rol="admin,almacen,inventario">
                <option value="">Elige una tapa…</option>
                {tapaOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </>
          )}

          {resuelto && resuelto.ok && resuelto.stock != null && (
            <div style={SH.hint}>Stock en Fábrica: {resuelto.stock.toLocaleString('es-MX')} {resuelto.unidad} (contado en cubetas equivalentes)</div>
          )}
          {tipo === 'pt' && sel.trim() && resuelto && !resuelto.ok && (
            <div style={SH.hint}>Ese producto no está en inventario; elígelo de la lista.</div>
          )}

          {/* ── Presentación PT (consciente del envasado) ──
              El PT suele venir a granel en tote; aquí se elige CÓMO se pide:
              tote / cubeta / galón / litro / atomizador. El movimiento de inventario
              siempre es cubeta-equivalente; esto es la forma física pedida. */}
          {tipo === 'pt' && resuelto && resuelto.ok && (() => {
            const granelDisp = Number(fabricaPres[PRES_COL.tote] || 0);
            const puedeEnvasar = granelDisp > 0;   /* se envasa DESDE granel (tote) */
            return (
            <>
              {/* Envasar desde granel — DESBLOQUEA pedir una presentación SIN stock
                  envasado. Regla (dueño jun 2026): por defecto solo puedes pedir lo
                  que YA está envasado; para otra medida hay que envasar desde el tote.
                  Sin este gate, Josué pidió cubetas de un producto que estaba en tote
                  → OT descuadrada y pedido sin cerrar. */}
              <label style={{ ...SH.checkRow, marginTop: 14, opacity: puedeEnvasar ? 1 : 0.45 }}
                data-id="transferencias.check.envasar" data-rol="admin,almacen,inventario"
                title={puedeEnvasar ? '' : 'No hay granel (tote) en Fábrica para envasar'}>
                <input type="checkbox" style={SH.check} checked={envasar} disabled={!puedeEnvasar}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setEnvasar(on);
                    /* al apagar envasar, si la presentación actual no tiene stock, vuelve a tote */
                    if (!on && ptPres !== 'tote' && Number(fabricaPres[PRES_COL[ptPres]] || 0) <= 0) setPtPres('tote');
                  }} />
                <span>Envasar desde <b>granel (tote)</b> — permite pedir una presentación sin stock envasado</span>
              </label>

              <label style={SH.lbl}>Presentación pedida</label>
              <div style={SH.presWrap} data-id="transferencias.select.presentacion" data-rol="admin,almacen,inventario">
                {PT_MEDIDAS.map(m => {
                  const disp = Number(fabricaPres[PRES_COL[m.key]] || 0);
                  const esTote = m.key === 'tote';
                  /* habilitada: tote solo si hay totes; otra medida si hay stock
                     envasado O si "envasar" está activo (se envasará desde granel). */
                  const habilitada = esTote ? disp > 0 : (disp > 0 || envasar);
                  const active = ptPres === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      disabled={!habilitada}
                      onClick={() => { if (!habilitada) return; setPtPres(m.key); if (esTote) setEnvasar(false); }}
                      title={habilitada ? '' : (esTote ? 'Sin totes en Fábrica' : 'Sin stock envasado — activa “Envasar desde granel” para pedir esta medida')}
                      style={{ ...SH.presPill, ...(active ? SH.presPillOn : {}), ...(habilitada ? {} : SH.presPillOff) }}>
                      <span style={SH.presPillLabel}>{m.label}</span>
                      <span style={{ ...SH.presPillDisp, ...(active ? SH.presPillDispOn : {}) }}>
                        {disp.toLocaleString('es-MX')} disp.{(!esTote && disp <= 0 && envasar) ? ' · envasar' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
            );
          })()}

          <div style={SH.row2}>
            <div style={{ flex: 2 }}>
              <label style={SH.lbl}>
                {tipo === 'pt' ? `Cantidad en ${ptMedidaDef(ptPres)?.label?.toLowerCase() || 'cubetas'}` : 'Cantidad'}
              </label>
              <input style={SH.input} type="number" inputMode="decimal" min="0" value={cantidad}
                onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <button style={{ ...SH.addBtn, opacity: puedeAgregar ? 1 : 0.5 }}
                onClick={agregarLinea} disabled={!puedeAgregar}
                data-id="transferencias.btn.agregar-linea" data-rol="admin,almacen,inventario">
                {editingIdx != null ? <><IconCheck size={16} /> Guardar línea</> : <><IconPlus size={16} /> Agregar</>}
              </button>
            </div>
          </div>
          {editingIdx != null && (
            <div style={{ ...SH.hint, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Editando la línea {editingIdx + 1}.</span>
              <button type="button" onClick={resetBuilder}
                style={{ background: 'none', border: 'none', color: 'var(--lp-brand-700)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11.5 }}>
                Cancelar edición
              </button>
            </div>
          )}
          {/* PT: equivalencia en vivo (el inventario se mueve en cubeta-equivalente) */}
          {tipo === 'pt' && cantNum > 0 && ptPres !== 'cubeta' && (
            <div style={SH.hint}>= {medidaACubetas(ptPres, cantNum).toLocaleString('es-MX')} cub equivalentes</div>
          )}
          {/* Guard de presentación: sin stock envasado y sin "envasar" → no se puede pedir */}
          {tipo === 'pt' && resuelto && resuelto.ok && !presValida && (
            <div style={{ ...SH.hint, color: 'var(--lp-warning-700)' }}>
              Sin stock envasado en {ptMedidaDef(ptPres)?.label?.toLowerCase() || 'esa medida'}. Activa “Envasar desde granel” para pedir esta presentación.
            </div>
          )}
          {excedeFabrica && (
            <div style={{ ...SH.hint, color: 'var(--lp-danger-700, #B42318)', fontWeight: 600 }}>
              Excede el stock en Fábrica ({resuelto.stock.toLocaleString('es-MX')} {resuelto.unidad}{yaEnOT > 0 ? ` · ${yaEnOT.toLocaleString('es-MX')} ya en esta solicitud` : ''}). Una transferencia solo mueve lo que hay en Fábrica.
            </div>
          )}

          {/* ── Líneas agregadas ── */}
          <label style={SH.lbl}>Líneas de la solicitud {lineas.length > 0 ? `· ${lineas.length}` : ''}</label>
          {lineas.length === 0 ? (
            <div style={SH.emptyLineas}>Aún sin líneas. Agrega productos, envases o tapas arriba.</div>
          ) : (
            <div style={SH.lineasList}>
              {lineas.map((l, i) => (
                <div key={i} style={{ ...SH.lineaChip, ...(editingIdx === i ? SH.lineaChipEditing : {}) }}>
                  <span style={SH.lineaChipTipo}>{l.tipo === 'pt' ? 'PT' : l.tipo === 'tapa' ? 'Tapa' : 'Env'}</span>
                  <span style={SH.lineaChipNombre}>{l.nombre}</span>
                  <span style={SH.lineaChipCant}>{descLineaCantidad(l)}</span>
                  <button style={SH.lineaChipEdit} onClick={() => editarLinea(i)} aria-label="Editar línea"
                    data-id="transferencias.btn.editar-linea" data-rol="admin,almacen,inventario">
                    <IconEdit size={13} />
                  </button>
                  <button style={SH.lineaChipDel} onClick={() => quitarLinea(i)} aria-label="Quitar línea">
                    <IconX size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label style={SH.lbl}>Nota (opcional)</label>
          <textarea style={SH.area} value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder="Ej. Para reponer stock de Terán antes del fin de semana…" />

          {err && <div style={SH.err}>{err}</div>}
        </div>

        <div style={SH.footer}>
          <div style={SH.acts}>
            <button style={{ ...SH.btn, ...SH.btnGhost }} onClick={onClose} disabled={saving}>Cancelar</button>
            <button style={{ ...SH.btn, ...SH.btnPrimary, opacity: lineas.length && !saving ? 1 : 0.5 }}
              onClick={guardar} disabled={!lineas.length || saving}
              data-id="transferencias.btn.crear" data-rol="admin,almacen,inventario">
              {isEdit
                ? (saving ? 'Guardando…' : `Guardar cambios${lineas.length ? ` (${lineas.length})` : ''}`)
                : (saving ? 'Creando…' : `Crear solicitud${lineas.length ? ` (${lineas.length})` : ''}`)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OTQRPrintModal — vista previa del QR de la OT + ventana imprimible simple.
   Genera el QR localmente con qrDataUrl (offline) y abre una ventana con el
   <img> del QR + folio + líneas + window.print().
   ═══════════════════════════════════════════════════════════════════════════ */
function OTQRPrintModal({ ot, onClose }) {
  const url = urlQrOT(ot.id);
  const qrPreview = qrDataUrl(url, { scale: 8, margin: 2, ecLevel: 'M' });
  const qrPrint = qrDataUrl(url, { scale: 10, margin: 2, ecLevel: 'M' });
  const lineas = Array.isArray(ot.lineas) ? ot.lineas : [];

  const imprimir = () => {
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) { alert('Habilita las ventanas emergentes para imprimir'); return; }
    const esc = (s) => String(s == null ? '' : s).replace(/</g, '&lt;');
    /* Filas con datos reales de la OT + relleno hasta 10 (spec) para que la tabla
       se vea completa y quede espacio para anotar a mano. Sin fila de total. */
    const minRows = Math.max(lineas.length, 10);
    const filas = Array.from({ length: minRows }, (_, i) => {
      const l = lineas[i];
      if (!l) return `<div class="trow"><div class="c c-num">${i + 1}</div><div class="c c-desc"></div><div class="c c-cod"></div><div class="c c-qty"></div><div class="c c-uni"></div></div>`;
      const tipo = l.tipo === 'pt' ? 'PT' : l.tipo === 'tapa' ? 'Tapa' : 'Envase';
      let cant, uni;
      if (l.tipo === 'pt' && l.presentacion) {
        cant = l.cantidadPresentacion != null ? l.cantidadPresentacion : l.cantidad;
        uni = esc(l.presentacion);
      } else {
        cant = l.cantidad; uni = esc(l.unidad || '');
      }
      const env = l.envasar ? ' <span class="env">ENVASAR</span>' : '';
      return `<div class="trow">
        <div class="c c-num">${i + 1}</div>
        <div class="c c-desc"><span>${esc(l.nombre || l.producto || '')}</span><span class="tag">${tipo}</span>${env}</div>
        <div class="c c-cod"></div>
        <div class="c c-qty">${esc(cant)}</div>
        <div class="c c-uni">${uni}</div>
      </div>`;
    }).join('');
    const logo = `${location.origin}/logos/logo-perico-green.svg`;
    const G = '#0f7a5a';
    /* Firmas (pedido dueño 26-jul, mismo criterio que la remisión de tiendas):
       arriba la SALIDA del origen y quien ENTREGA en el destino (Luis, el que
       transporta); abajo, centradas, las firmas de RECEPCIÓN del material. */
    const _sg = (f) => `
      <div class="sg">
        <div class="sgline"></div>
        <div class="sgname">${esc(f.name)}</div>
        <div class="sgrole">${esc(f.role)}</div>
        <div class="sgplace">${esc(f.place)}</div>
      </div>`;
    const firmasSalida = [
      { name: 'Enrique Gamboa García', role: 'Salida', place: 'Almacén Huertas' },
      { name: 'Luis Jonathan Lara', role: 'Entregó en Almacén Terán', place: 'Recolección y traslado' },
    ].map(_sg).join('');
    const firmasRecepcion = [
      /* 27-jul-2026: Rodolfo dejó de recibir en Almacén Terán; ahora firma
         Jhonny o Josué, el que esté en el turno. */
      { name: 'Jhonny / Josué', role: 'Recibido en almacén', place: 'Almacén Terán' },
      { name: 'Arely L. Meza', role: 'Recibido en recepción', place: 'Recepción Terán' },
    ].map(_sg).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transferencia ${esc(ot.folio)}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">
      <style>
        @page { size: letter; margin: 0; }
        *{box-sizing:border-box;}
        body { font-family: 'DM Sans', system-ui, sans-serif; color: #16201c; margin: 0; background:#fff; }
        .sheet { width:816px; min-height:1056px; padding:40px 52px 32px; margin:0 auto; display:flex; flex-direction:column; }
        .head { display:flex; align-items:flex-start; justify-content:space-between; border-bottom:2px solid ${G}; padding-bottom:18px; }
        .brand { display:flex; align-items:center; gap:14px; }
        .brand img { width:56px; height:auto; display:block; }
        .bname { font-size:19px; font-weight:500; letter-spacing:-.02em; color:${G}; }
        .btag { font-size:10px; color:#5a6b63; letter-spacing:.04em; text-transform:uppercase; }
        .hr { display:flex; align-items:flex-start; gap:16px; }
        .hrtext { display:flex; flex-direction:column; align-items:flex-end; gap:8px; padding-top:2px; }
        .hrtext .ttl { font-size:13px; font-weight:500; color:#16201c; }
        .foliorow { display:flex; align-items:center; gap:8px; }
        .foliolbl { font-size:10px; color:#5a6b63; text-transform:uppercase; letter-spacing:.06em; }
        .folio { font-size:13px; font-weight:500; color:${G}; border:1px solid ${G}; border-radius:6px; padding:3px 12px; }
        .qrcol { display:flex; flex-direction:column; align-items:center; gap:4px; }
        .qrbox { border:1px solid rgba(15,122,90,.4); border-radius:10px; padding:6px; line-height:0; }
        .qr { width:62px; height:62px; display:block; }
        .qrlbl { font-size:8px; letter-spacing:.14em; color:#5a6b63; text-transform:uppercase; }
        .title { margin-top:16px; text-align:center; }
        .title .t { font-size:18px; font-weight:500; letter-spacing:-.02em; }
        .title .s { font-size:11px; color:#5a6b63; margin-top:3px; }
        .od { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:16px; }
        .box { border:1px solid rgba(15,122,90,.25); border-radius:12px; padding:12px 16px; background:rgba(15,122,90,.04); }
        .box .lbl { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:${G}; font-weight:500; margin-bottom:9px; }
        .fld { display:flex; align-items:baseline; gap:8px; font-size:12px; margin-bottom:8px; }
        .fld span { color:#5a6b63; min-width:64px; }
        .fld i { flex:1; border-bottom:1px dotted #b6c2bc; font-style:normal; }
        .tbl { margin-top:16px; border:1px solid rgba(0,0,0,.14); border-radius:12px; overflow:hidden; }
        .thead { display:grid; grid-template-columns:48px 1fr 90px 90px 110px; background:${G}; color:#fff; font-size:11px; font-weight:500; }
        .thead > div { padding:9px 8px; text-align:center; }
        .thead .th-l { text-align:left; padding-left:12px; }
        .thead .th-d { border-left:1px solid rgba(255,255,255,.18); }
        .trow { display:grid; grid-template-columns:48px 1fr 90px 90px 110px; font-size:12px; border-top:1px solid rgba(0,0,0,.08); min-height:24px; }
        .trow .c { padding:4px 8px; display:flex; align-items:center; min-width:0; }
        .trow .c-num { justify-content:center; color:#9aa8a2; }
        .trow .c-desc, .trow .c-cod, .trow .c-qty, .trow .c-uni { border-left:1px solid rgba(0,0,0,.07); }
        .trow .c-qty { justify-content:flex-end; font-weight:500; }
        .tag { display:inline-block; margin-left:6px; font-size:9px; font-weight:500; color:${G}; background:rgba(15,122,90,.10); border-radius:4px; padding:1px 6px; vertical-align:middle; }
        .env { display:inline-block; margin-left:6px; padding:1px 7px; border:1.5px solid ${G}; border-radius:4px; font-size:10px; font-weight:500; color:${G}; }
        .obs .lbl { font-size:11px; color:#5a6b63; font-weight:500; margin:14px 0 8px; }
        .obsbox { border:1px solid rgba(0,0,0,.10); border-radius:10px; min-height:42px; padding:8px 10px; font-size:12px; }
        .firmas { margin-top:auto; padding-top:12px; }
        .firmas .lbl { font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:${G}; font-weight:500; margin-bottom:16px; text-align:center; }
        .fgrid { display:grid; grid-template-columns:1fr 1fr; gap:16px 40px; }
        /* Recepción: centrada debajo de las firmas de salida (26-jul). */
        .fgrid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px 40px; width:74%; margin:26px auto 0; }
        .sg { text-align:center; } .sgline { border-bottom:1px solid #16201c; height:24px; }
        .sgname { font-size:13px; font-weight:500; color:#16201c; margin-top:6px; } .sgrole { font-size:11px; font-weight:500; color:${G}; margin-top:3px; } .sgplace { font-size:10px; color:#5a6b63; margin-top:1px; }
        .pie { margin-top:14px; padding-top:10px; border-top:1px solid rgba(0,0,0,.08); display:flex; justify-content:space-between; font-size:9px; color:#9aa8a2; }
      </style></head><body>
      <div class="sheet">
        <div class="head">
          <div class="brand">
            <img src="${logo}" alt="Pinturas El Perico" onerror="this.style.display='none'" />
            <div>
              <div class="bname">Pinturas El Perico</div>
              <div class="btag">Control de inventario · Logística interna</div>
            </div>
          </div>
          <div class="hr">
            <div class="hrtext">
              <div class="ttl">Formato de transferencia</div>
              <div class="foliorow"><span class="foliolbl">Folio</span><span class="folio">${esc(ot.folio)}</span></div>
            </div>
            <div class="qrcol">
              <div class="qrbox"><img class="qr" src="${qrPrint}" alt="QR ${esc(ot.folio)}" /></div>
              <div class="qrlbl">Escanea</div>
            </div>
          </div>
        </div>

        <div class="title">
          <div class="t">Transferencia de mercancía entre almacén y tienda</div>
          <div class="s">Documento de control para entrega, traslado y recepción de producto</div>
        </div>

        <div class="od">
          <div class="box">
            <div class="lbl">Origen — Almacén Huertas</div>
            <div class="fld"><span>Fecha</span><i>&nbsp;</i></div>
            <div class="fld"><span>Hora salida</span><i>&nbsp;</i></div>
            <div class="fld"><span>Vehículo</span><i>&nbsp;</i></div>
          </div>
          <div class="box">
            <div class="lbl">Destino — Almacén / Tienda Terán</div>
            <div class="fld"><span>Fecha</span><i>&nbsp;</i></div>
            <div class="fld"><span>Hora llegada</span><i>&nbsp;</i></div>
            <div class="fld"><span>Recibe área</span><i>&nbsp;</i></div>
          </div>
        </div>

        <div class="tbl">
          <div class="thead">
            <div>#</div>
            <div class="th-l">Descripción del producto</div>
            <div class="th-d">Código</div>
            <div class="th-d">Cantidad</div>
            <div class="th-d">Unidad</div>
          </div>
          ${filas}
        </div>

        <div class="obs">
          <div class="lbl">Observaciones</div>
          <div class="obsbox">${ot.nota ? esc(ot.nota) : ''}</div>
        </div>

        <div class="firmas">
          <div class="lbl">Firmas de conformidad</div>
          <div class="fgrid">${firmasSalida}</div>
          <div class="fgrid2">${firmasRecepcion}</div>
        </div>

        <div class="pie">
          <span>Pinturas El Perico · Formato de transferencia interna</span>
          <span>Conservar copia en almacén de origen y destino</span>
        </div>
      </div>
      <script>setTimeout(() => window.print(), 450);</script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div style={PM.overlay}>
      <div style={PM.modal} onClick={(e) => e.stopPropagation()}>
        <div style={PM.header}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Hoja QR — {ot.folio}</div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
              Imprime y pégala con la mercancía; se escanea al surtir y al recibir.
            </div>
          </div>
          <button style={PM.close} onClick={onClose} aria-label="Cerrar"><IconX size={16} /></button>
        </div>
        <div style={PM.body}>
          <img src={qrPreview} alt={`QR ${ot.folio}`} style={PM.qrImg} />
          <div style={PM.folioBig}>{ot.folio}</div>
          <div style={PM.ruta}>Fábrica → Almacén Terán</div>
          <div style={PM.lineasPrev}>
            {lineas.map((l, i) => (
              <div key={i} style={PM.lineaPrevRow}>
                <span style={{ textTransform: 'uppercase' }}>{l.nombre || l.producto}</span>
                <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 700 }}>{descLineaCantidad(l)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={PM.footer}>
          <button style={{ ...PM.btn, ...PM.btnGhost }} onClick={onClose}>Cerrar</button>
          <button style={{ ...PM.btn, ...PM.btnPrimary }} onClick={imprimir}>
            <IconPrint size={16} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Estilos — SOLO tokens var(--lp-*). Claro y oscuro salen solos.
   ═══════════════════════════════════════════════════════════════════════════ */
const S = {
  wrapMobile: { padding: '4px 10px 110px' },
  wrapDesktop: { padding: '8px 24px 48px' },
  greet: { fontSize: 12.5, color: 'var(--lp-text-secondary)', margin: '2px 2px 12px' },

  /* hero scan móvil */
  scanHeroMobile: {
    width: '100%', height: 64, borderRadius: 18, border: 'none', cursor: 'pointer',
    background: 'var(--lp-brand-600)', color: '#fff',
    fontFamily: 'var(--lp-font-sans)', fontSize: 16, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
    boxShadow: '0 10px 24px -10px color-mix(in srgb, var(--lp-brand-600) 60%, transparent)',
    marginBottom: 12,
  },
  newBtnMobile: {
    height: 44, padding: '0 16px', borderRadius: 999, border: '1.5px solid var(--lp-border-default)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },

  /* barra escritorio — botones tamaño estándar a la derecha (no 100%) */
  actionBarDesktop: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 },
  newBtnDesktop: {
    height: 44, minHeight: 44, padding: '0 18px', borderRadius: 12, border: '1.5px solid var(--lp-border-default)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 8,
  },
  scanBtnDesktop: {
    height: 44, minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: 'var(--lp-brand-600)', color: '#fff',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', gap: 8,
    boxShadow: '0 8px 20px -12px color-mix(in srgb, var(--lp-brand-600) 60%, transparent)',
  },

  /* tabs pill */
  tabs: {
    display: 'flex', gap: 4, marginBottom: 14, overflowX: 'auto',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
  },
  tab: (active, isDesktop) => ({
    ...(isDesktop
      ? { flexShrink: 0, padding: '9px 16px', background: active ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)' }
      : { flex: 1, padding: '9px 6px', background: active ? 'var(--lp-brand-600)' : 'transparent' }),
    borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: active ? 700 : 500,
    color: active ? '#fff' : 'var(--lp-text-secondary)',
    whiteSpace: 'nowrap', minHeight: 44,
  }),

  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 200, maxWidth: 420, height: 44, padding: '0 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },

  grid: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' },

  card: {
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
    borderRadius: 18, padding: 16, marginBottom: 12,
    display: 'flex', flexDirection: 'column',
  },
  cardHead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11, flexWrap: 'wrap' },
  folio: { fontFamily: 'var(--lp-font-mono)', fontSize: 13, fontWeight: 800, color: 'var(--lp-brand-700)' },

  route: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
    padding: '10px 13px', borderRadius: 12, background: 'var(--lp-bg-sunken)',
    fontSize: 13, flexWrap: 'wrap',
  },
  routeNode: { color: 'var(--lp-text-primary)', fontWeight: 600 },
  routeArrow: { color: 'var(--lp-text-tertiary)', display: 'inline-flex' },

  lineas: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 },
  lineaRow: { display: 'flex', alignItems: 'baseline', gap: 8 },
  lineaTipo: {
    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
    background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', letterSpacing: '.04em',
    flexShrink: 0, textTransform: 'uppercase',
  },
  lineaNombre: { flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--lp-text-primary)', minWidth: 0, letterSpacing: '-.01em', textTransform: 'uppercase' },
  lineaCant: { fontFamily: 'var(--lp-font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--lp-text-secondary)', whiteSpace: 'nowrap' },

  meta: { fontSize: 12, color: 'var(--lp-text-secondary)', lineHeight: 1.6, marginBottom: 12 },
  metaK: { color: 'var(--lp-text-tertiary)' },
  nota: { marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'var(--lp-bg-sunken)', fontSize: 12, color: 'var(--lp-text-secondary)' },

  actionsMobile: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' },
  actionsDesktop: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'auto' },
  btnMobile: {
    width: '100%', height: 50, borderRadius: 14, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 15, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  btnDesktop: {
    flex: 1, minWidth: 130, height: 42, padding: '0 14px', borderRadius: 12, border: 'none',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnGhost: { background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', border: '1px solid var(--lp-border-subtle)' },
  btnDanger: { background: 'transparent', color: 'var(--lp-danger-600)', border: '1px solid var(--lp-border-subtle)' },
  doneChip: {
    flex: 1, minHeight: 42, borderRadius: 12,
    background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)',
    color: 'var(--lp-text-tertiary)', fontSize: 13, fontWeight: 600,
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
    background: 'var(--lp-text-primary)', color: 'var(--lp-bg-base)',
    boxShadow: '0 4px 16px rgba(0,0,0,.18)',
    display: 'flex', alignItems: 'center', gap: 8, maxWidth: '90vw', textAlign: 'center',
  },
  toastErr: { background: 'var(--lp-danger-600)', color: '#fff' },
};

/* ── Sheet (crear) — footer pegajoso, espejo de DevolucionesMP / Ordenes ── */
const SH = {
  overlay: (desktop) => ({ position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 9999, display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', overflow: 'auto', padding: desktop ? 16 : 0 }),
  sheet: (desktop) => ({ background: 'var(--lp-bg-base)', borderRadius: desktop ? 20 : '24px 24px 0 0', maxWidth: 480, width: '100%', maxHeight: desktop ? 'calc(var(--pp-vvh, 100dvh) - 32px)' : 'calc(var(--pp-vvh, 100dvh) - 16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: desktop ? '0 12px 48px rgba(0,0,0,.28)' : 'none' }),
  body: { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '18px 20px 12px' },
  footer: { flexShrink: 0, padding: '12px 20px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', gap: 10 },
  h: { fontSize: 18, fontWeight: 700, color: 'var(--lp-text-primary)' },
  s: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2, marginBottom: 4 },
  lbl: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', margin: '16px 2px 6px' },
  input: { width: '100%', height: 46, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 15, color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', height: 46, padding: '0 12px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 15, color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box', appearance: 'auto' },
  area: { width: '100%', minHeight: 64, padding: '10px 14px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 14.5, color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box', resize: 'vertical' },
  row2: { display: 'flex', gap: 10 },
  hint: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 5 },
  addBtn: {
    width: '100%', height: 46, borderRadius: 12, border: 'none', cursor: 'pointer',
    background: 'var(--lp-brand-600)', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  },

  /* Pills de presentación PT — wrap (5 opciones, cada una con disponible) */
  presWrap: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  presPill: {
    flex: '1 1 auto', minWidth: 84, padding: '8px 12px', borderRadius: 12, cursor: 'pointer',
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    fontFamily: 'inherit', textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  presPillOn: {
    background: 'color-mix(in srgb, var(--lp-brand-600) 12%, transparent)',
    borderColor: 'var(--lp-brand-600)',
  },
  presPillOff: { opacity: .42, cursor: 'not-allowed', borderStyle: 'dashed' },
  presPillLabel: { fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)' },
  presPillDisp: { fontSize: 10.5, fontWeight: 600, color: 'var(--lp-text-tertiary)' },
  presPillDispOn: { color: 'var(--lp-brand-700)' },

  /* Checkbox "pedir envasada desde granel" */
  checkRow: {
    display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 12, cursor: 'pointer',
    fontSize: 13, color: 'var(--lp-text-secondary)', lineHeight: 1.45,
  },
  check: { width: 18, height: 18, marginTop: 1, accentColor: 'var(--lp-brand-600)', flexShrink: 0, cursor: 'pointer' },

  emptyLineas: { fontSize: 12.5, color: 'var(--lp-text-tertiary)', padding: '14px 12px', borderRadius: 12, background: 'var(--lp-bg-sunken)', border: '1px dashed var(--lp-border-default)', textAlign: 'center' },
  lineasList: { display: 'flex', flexDirection: 'column', gap: 7 },
  lineaChip: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)' },
  lineaChipTipo: { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', letterSpacing: '.04em', flexShrink: 0 },
  lineaChipNombre: { flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--lp-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase' },
  lineaChipCant: { fontFamily: 'var(--lp-font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--lp-text-secondary)', whiteSpace: 'nowrap' },
  lineaChipEdit: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--lp-brand-700)', cursor: 'pointer', flexShrink: 0 },
  lineaChipEditing: { borderColor: 'var(--lp-brand-600)', background: 'color-mix(in srgb, var(--lp-brand-600) 8%, transparent)' },
  lineaChipDel: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--lp-text-tertiary)', cursor: 'pointer', flexShrink: 0 },

  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: '9px 12px', borderRadius: 8, fontSize: 12, marginTop: 12, whiteSpace: 'pre-line' },
  acts: { display: 'flex', gap: 10, flex: 1 },
  btn: { height: 50, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 },
  btnGhost: { flex: '0 0 auto', padding: '0 20px', background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' },
  btnPrimary: { flex: 1, background: 'var(--lp-brand-600)', color: '#fff' },
};

/* ── Modal de impresión QR ── */
const PM = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--lp-bg-raised)', borderRadius: 18, width: '100%', maxWidth: 400, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,.28)', display: 'flex', flexDirection: 'column' },
  header: { padding: '16px 20px', borderBottom: '1px solid var(--lp-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  close: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', cursor: 'pointer', flexShrink: 0 },
  body: { padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  qrImg: { width: 200, height: 200, borderRadius: 10, border: '1px solid var(--lp-border-subtle)', background: '#fff' },
  folioBig: { fontFamily: 'var(--lp-font-mono)', fontSize: 22, fontWeight: 800, color: 'var(--lp-brand-700)', marginTop: 14, letterSpacing: 1 },
  ruta: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 4 },
  lineasPrev: { width: '100%', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 },
  lineaPrevRow: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: 'var(--lp-text-primary)', paddingBottom: 6, borderBottom: '1px solid var(--lp-border-subtle)' },
  footer: { padding: '12px 20px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', gap: 10 },
  btn: { flex: 1, height: 46, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnGhost: { flex: '0 0 auto', padding: '0 20px', background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' },
  btnPrimary: { background: 'var(--lp-brand-600)', color: '#fff' },
};
