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

/* ── Estado → presentación del badge (color-mix 14% como el resto del DS) ──── */
const ESTADO_META = {
  solicitada: { label: 'Solicitada', color: 'var(--lp-warning-600)' },
  surtida:    { label: 'En tránsito', color: 'var(--lp-info-600)' },
  recibida:   { label: 'Recibida', color: 'var(--lp-brand-600)' },
  cancelada:  { label: 'Cancelada', color: 'var(--lp-text-tertiary)' },
};
function EstadoBadge({ estado }) {
  const m = ESTADO_META[estado] || { label: estado || '—', color: 'var(--lp-text-tertiary)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
      background: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: m.color, whiteSpace: 'nowrap',
    }}>
      <i style={{ width: 6, height: 6, borderRadius: 999, background: m.color, display: 'inline-block' }} />
      {m.label}
    </span>
  );
}

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

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function TransferenciasPage() {
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

  const { data, loading, reload } = useApiData(() => api.getOTs(), [], 8000);
  /* Inventario + envases para el autocompletar del sheet de crear (cargados una
     vez; sin polling — son catálogos relativamente estables). */
  const { data: invData } = useApiData(() => api.getInventario(), null, 0);
  const { data: envData } = useApiData(() => api.getEnvases(), null, 0);

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
      showToast('Error: ' + (err?.data?.error || err.message || 'No se pudo actualizar'), true);
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
        <TopBar title="Transferencias" />
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Transferencias" />
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
              />
            ))}
          </div>
        )}
      </div>

      {/* Scanner */}
      {scannerOpen && (
        <QRScanner onResult={handleScan} onClose={() => setScannerOpen(false)} />
      )}

      {/* Sheet de crear */}
      {crearOpen && (
        <CrearSheet
          isDesktop={isDesktop}
          inv={invData}
          env={envData}
          initialSel={prefillSel}
          onClose={() => { setCrearOpen(false); setPrefillSel(null); }}
          onSaved={(res) => {
            setCrearOpen(false);
            reload();
            showToast(`Solicitud creada: ${res?.folio || ''}`);
            if (res?.ot) setPrintOT(res.ot);   // ofrecer imprimir el QR de inmediato
          }}
        />
      )}

      {/* Hoja imprimible del QR */}
      {printOT && <OTQRPrintModal ot={printOT} onClose={() => setPrintOT(null)} />}

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, ...(toast.isErr ? S.toastErr : {}) }}>
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
   Card de OT — visual unificado móvil/escritorio.
   Layout: folio · estado badge / ruta / líneas (nombre × cantidad) /
   quién+cuándo / acciones contextuales (Surtir / Recibir / Cancelar) +
   Imprimir hoja QR.
   ═══════════════════════════════════════════════════════════════════════════ */
function OTCard({ ot, rol, busy, isDesktop, onAccion, onPrint }) {
  const lineas = Array.isArray(ot.lineas) ? ot.lineas : [];

  /* Acciones contextuales por estado + rol */
  const puedeSurtir   = ot.estado === 'solicitada' && (rol === 'tecnico' || rol === 'admin');
  const puedeRecibir  = ot.estado === 'surtida' && (rol === 'almacen' || rol === 'admin');
  const puedeCancelar = (ot.estado === 'solicitada' || ot.estado === 'surtida') && (rol === 'admin' || rol === 'almacen');

  const tipoLabel = (l) => l.tipo === 'pt' ? 'PT' : l.tipo === 'tapa' ? 'Tapa' : 'Envase';

  return (
    <div style={S.card}>
      {/* header: folio + estado */}
      <div style={S.cardHead}>
        <span style={S.folio}>{ot.folio}</span>
        <span style={{ marginLeft: 'auto' }}><EstadoBadge estado={ot.estado} /></span>
      </div>

      {/* ruta Fábrica → Terán */}
      <div style={S.route}>
        <b style={S.routeNode}>Fábrica</b>
        <span style={S.routeArrow}><IconArrow size={16} /></span>
        <b style={S.routeNode}>Almacén Terán</b>
      </div>

      {/* líneas */}
      <div style={S.lineas}>
        {lineas.map((l, i) => (
          <div key={i} style={S.lineaRow}>
            <span style={S.lineaTipo}>{tipoLabel(l)}</span>
            <span style={S.lineaNombre}>{l.nombre || l.producto || '—'}</span>
            <span style={S.lineaCant}>{l.cantidad} {l.unidad || ''}</span>
          </div>
        ))}
      </div>

      {/* trazas: quién solicitó / surtió / recibió / canceló */}
      <div style={S.meta}>
        {ot.solicitadoPor && <div><span style={S.metaK}>Solicitó</span> <b>{ot.solicitadoPor}</b>{ot.fechaSolicitud ? ` · ${fmtFecha(ot.fechaSolicitud)}` : ''}</div>}
        {ot.surtidoPor && <div><span style={S.metaK}>Surtió</span> <b>{ot.surtidoPor}</b>{ot.fechaSurtido ? ` · ${fmtFecha(ot.fechaSurtido)}` : ''}</div>}
        {ot.recibidoPor && <div><span style={S.metaK}>Recibió</span> <b>{ot.recibidoPor}</b>{ot.fechaRecepcion ? ` · ${fmtFecha(ot.fechaRecepcion)}` : ''}</div>}
        {ot.canceladoPor && <div><span style={S.metaK}>Canceló</span> <b>{ot.canceladoPor}</b>{ot.fechaCancelacion ? ` · ${fmtFecha(ot.fechaCancelacion)}` : ''}</div>}
        {ot.nota && <div style={S.nota}>{ot.nota}</div>}
      </div>

      {/* acciones */}
      <div style={isDesktop ? S.actionsDesktop : S.actionsMobile}>
        {puedeSurtir && (
          <button style={{ ...(isDesktop ? S.btnDesktop : S.btnMobile), background: 'var(--lp-info-600)', color: '#fff' }}
            disabled={busy} onClick={() => onAccion('surtir')}
            data-id="transferencias.btn.surtir" data-rol="tecnico,admin">
            {busy ? <span aria-hidden="true">…</span> : <><IconTruck size={isDesktop ? 18 : 20} /> Surtir</>}
          </button>
        )}
        {puedeRecibir && (
          <button style={{ ...(isDesktop ? S.btnDesktop : S.btnMobile), background: 'var(--lp-brand-600)', color: '#fff' }}
            disabled={busy} onClick={() => onAccion('recibir')}
            data-id="transferencias.btn.recibir" data-rol="almacen,admin">
            {busy ? <span aria-hidden="true">…</span> : <><IconCheck size={isDesktop ? 18 : 20} /> Recibir en Terán</>}
          </button>
        )}
        {/* Imprimir hoja QR — disponible mientras la OT siga viva */}
        {ot.estado !== 'cancelada' && (
          <button style={{ ...(isDesktop ? S.btnDesktop : S.btnMobile), ...S.btnGhost }}
            onClick={onPrint}
            data-id="transferencias.btn.imprimir" data-rol="admin,almacen,inventario,tecnico">
            <IconPrint size={isDesktop ? 16 : 18} /> Imprimir hoja QR
          </button>
        )}
        {puedeCancelar && (
          <button style={{ ...(isDesktop ? S.btnDesktop : S.btnMobile), ...S.btnDanger }}
            disabled={busy} onClick={() => onAccion('cancelar')}
            data-id="transferencias.btn.cancelar" data-rol="admin,almacen">
            Cancelar
          </button>
        )}
        {/* Estado terminal sin acción para este rol → chip pasivo */}
        {ot.estado === 'recibida' && (
          <div style={S.doneChip}><IconCheck size={16} /> Recibida en Terán</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CrearSheet — bottom-sheet (móvil) / modal (escritorio) para armar una OT.
   Añade LÍNEAS: tipo (PT / Envase / Tapa) → autocompletar desde inventario /
   envases → cantidad → "Agregar línea". Lista las líneas (con quitar). Submit →
   api.crearOT(lineas, nota). Calca el autocompletar de DevolucionesMPPage.
   ═══════════════════════════════════════════════════════════════════════════ */
function CrearSheet({ isDesktop, inv, env, onClose, onSaved, initialSel }) {
  useBodyScrollLock(true);

  /* Desenvolver shapes envueltos {ok, data:{...}} (defensivo, igual que DevolucionesMP). */
  const invPt = (inv && inv.data && inv.data.pt) || (inv && inv.pt) || {};
  const envases = (env && env.data) || env || {};
  const categorias = envases.categorias || {};
  const tapas = envases.tapas || {};

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
  const [lineas, setLineas] = useState([]);   // líneas acumuladas
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  /* Al cambiar de tipo, limpiar la selección */
  const onTipo = (t) => { setTipo(t); setSel(''); };

  /* Resuelve la selección actual a sus campos canónicos + stock + nombre */
  const resuelto = useMemo(() => {
    if (tipo === 'pt') {
      const nombre = sel.trim();
      if (!nombre) return null;
      const r = invPt[nombre];
      return { ok: !!r, nombre, unidad: 'cub', stock: r ? (Number(r.qty) || 0) : null, linea: { tipo: 'pt', producto: nombre, nombre, unidad: 'cub' } };
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
  }, [tipo, sel, invPt, envaseOpts, tapaOpts]);

  const cantNum = Number(cantidad);
  const puedeAgregar = !!(resuelto && resuelto.ok && Number.isFinite(cantNum) && cantNum > 0);

  const agregarLinea = () => {
    if (!puedeAgregar) { setErr('Elige un ítem válido y una cantidad > 0.'); return; }
    setErr('');
    setLineas(prev => [...prev, { ...resuelto.linea, cantidad: cantNum }]);
    setSel(''); setCantidad('');
  };

  const quitarLinea = (idx) => setLineas(prev => prev.filter((_, i) => i !== idx));

  const guardar = async () => {
    setErr('');
    if (lineas.length === 0) { setErr('Agrega al menos una línea a la solicitud.'); return; }
    setSaving(true);
    try {
      const res = await api.crearOT(lineas, nota.trim() || undefined);
      onSaved && onSaved(res);
    } catch (e) {
      setErr(e?.data?.error || e.message || 'Error al crear la solicitud');
    } finally {
      setSaving(false);
    }
  };

  const datalistId = 'ot-pt-list';

  return (
    <div style={SH.overlay(isDesktop)} onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div style={SH.sheet(isDesktop)}>
        <div style={{ flexShrink: 0, padding: '18px 20px 0' }}>
          <div style={SH.h}>Nueva solicitud de transferencia</div>
          <div style={SH.s}>Fábrica → Terán · el inventario se mueve al surtir y recibir, no ahora.</div>
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
            <div style={SH.hint}>Stock en Fábrica: {resuelto.stock.toLocaleString('es-MX')} {resuelto.unidad}</div>
          )}
          {tipo === 'pt' && sel.trim() && resuelto && !resuelto.ok && (
            <div style={SH.hint}>Ese producto no está en inventario; elígelo de la lista.</div>
          )}

          <div style={SH.row2}>
            <div style={{ flex: 2 }}>
              <label style={SH.lbl}>Cantidad</label>
              <input style={SH.input} type="number" inputMode="decimal" min="0" value={cantidad}
                onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <button style={{ ...SH.addBtn, opacity: puedeAgregar ? 1 : 0.5 }}
                onClick={agregarLinea} disabled={!puedeAgregar}
                data-id="transferencias.btn.agregar-linea" data-rol="admin,almacen,inventario">
                <IconPlus size={16} /> Agregar
              </button>
            </div>
          </div>
          {resuelto && resuelto.ok && resuelto.stock != null && cantNum > resuelto.stock && (
            <div style={SH.hint}>Excede el stock en Fábrica ({resuelto.stock.toLocaleString('es-MX')} {resuelto.unidad}); el surtido se rechazará si no alcanza.</div>
          )}

          {/* ── Líneas agregadas ── */}
          <label style={SH.lbl}>Líneas de la solicitud {lineas.length > 0 ? `· ${lineas.length}` : ''}</label>
          {lineas.length === 0 ? (
            <div style={SH.emptyLineas}>Aún sin líneas. Agrega productos, envases o tapas arriba.</div>
          ) : (
            <div style={SH.lineasList}>
              {lineas.map((l, i) => (
                <div key={i} style={SH.lineaChip}>
                  <span style={SH.lineaChipTipo}>{l.tipo === 'pt' ? 'PT' : l.tipo === 'tapa' ? 'Tapa' : 'Env'}</span>
                  <span style={SH.lineaChipNombre}>{l.nombre}</span>
                  <span style={SH.lineaChipCant}>{l.cantidad} {l.unidad}</span>
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
              {saving ? 'Creando…' : `Crear solicitud${lineas.length ? ` (${lineas.length})` : ''}`}
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
    const filas = lineas.map(l => `
      <tr>
        <td class="tp">${esc(l.tipo === 'pt' ? 'PT' : l.tipo === 'tapa' ? 'Tapa' : 'Envase')}</td>
        <td>${esc(l.nombre || l.producto || '')}</td>
        <td class="qty">${esc(l.cantidad)} ${esc(l.unidad || '')}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OT ${esc(ot.folio)}</title>
      <style>
        @page { size: A4; margin: 16mm; }
        body { font-family: system-ui, -apple-system, sans-serif; color: #111; margin: 0; }
        .wrap { max-width: 600px; margin: 0 auto; }
        .head { display: flex; align-items: center; gap: 18px; border-bottom: 2px solid #111; padding-bottom: 14px; }
        .qr { width: 200px; height: 200px; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .folio { font-family: monospace; font-size: 26px; font-weight: 800; letter-spacing: 1px; }
        .sub { font-size: 13px; color: #555; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
        th { text-align: left; border-bottom: 1px solid #999; padding: 8px 6px; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: .04em; }
        td { padding: 9px 6px; border-bottom: 1px solid #e5e5e5; }
        td.tp { font-weight: 700; white-space: nowrap; width: 60px; }
        td.qty { text-align: right; font-family: monospace; font-weight: 700; white-space: nowrap; }
        .foot { margin-top: 26px; font-size: 12px; color: #555; }
        .sign { display: flex; gap: 40px; margin-top: 40px; }
        .sign div { flex: 1; border-top: 1px solid #111; padding-top: 6px; font-size: 11px; color: #444; text-align: center; }
      </style></head><body>
      <div class="wrap">
        <div class="head">
          <img class="qr" src="${qrPrint}" alt="QR ${esc(ot.folio)}" />
          <div>
            <h1>Orden de transferencia</h1>
            <div class="folio">${esc(ot.folio)}</div>
            <div class="sub">Fábrica &rarr; Almacén Terán</div>
            <div class="sub">Solicitó: ${esc(ot.solicitadoPor || '—')}${ot.nota ? ' · ' + esc(ot.nota) : ''}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Tipo</th><th>Concepto</th><th style="text-align:right">Cantidad</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
        <div class="foot">Escanea el QR en Fábrica para surtir y en Terán para recibir.</div>
        <div class="sign"><div>Surtió (Fábrica)</div><div>Recibió (Terán)</div></div>
      </div>
      <script>setTimeout(() => window.print(), 350);</script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div style={PM.overlay} onClick={onClose}>
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
                <span>{l.nombre || l.producto}</span>
                <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 700 }}>{l.cantidad} {l.unidad || ''}</span>
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
  wrapMobile: { padding: '4px 16px 110px' },
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

  grid: { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' },

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
  lineaNombre: { flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--lp-text-primary)', minWidth: 0, letterSpacing: '-.01em' },
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

  emptyLineas: { fontSize: 12.5, color: 'var(--lp-text-tertiary)', padding: '14px 12px', borderRadius: 12, background: 'var(--lp-bg-sunken)', border: '1px dashed var(--lp-border-default)', textAlign: 'center' },
  lineasList: { display: 'flex', flexDirection: 'column', gap: 7 },
  lineaChip: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)' },
  lineaChipTipo: { fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', letterSpacing: '.04em', flexShrink: 0 },
  lineaChipNombre: { flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--lp-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  lineaChipCant: { fontFamily: 'var(--lp-font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--lp-text-secondary)', whiteSpace: 'nowrap' },
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
