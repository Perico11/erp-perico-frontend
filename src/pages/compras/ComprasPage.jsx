import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import api from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import { useApiData, useSearch } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import { useAuth } from '../../context/AuthContext';
import PrediccionIATab from './PrediccionIATab';
import ForecastIATab from './ForecastIATab';
import PrediccionPedidosTab from './PrediccionPedidosTab';
import CatalogoCompraTab from './CatalogoCompraTab';
/* NOTA (§9): POS Aliases y SAT/CFDI salieron a pantallas propias (/pos-aliases, /sat).
   Sus componentes (PosAliasesTab / SATPanel) ya NO se montan aquí — viven en
   PosAliasesPage.jsx y SATPage.jsx respectivamente. */
import HelpHint from '../../components/HelpHint';
import SegmentedControl from '../../components/ui/SegmentedControl';
import PageTabs from '../../components/ui/PageTabs';
/* Modales reales del flujo OC (Sprint AC) — se REUSAN tal cual, sin tocarlos. */
import NewOCModal from './components/NewOCModal';
import Fab from '../../components/ui/Fab';
import AprobarOCModal from './components/AprobarOCModal';
import RegistrarPagoModal from './components/RegistrarPagoModal';
import EditOCModal from './components/EditOCModal';
import RecibirOCModal from './components/RecibirOCModal';
import EliminarOCModal from './components/EliminarOCModal';
import ComprobantesOCModal from './components/ComprobantesOCModal';
/* Mockup integracion/Compras.html: documento de OC imprimible con partidas */
import PrintOCOverlay from './components/PrintOCOverlay';
import ComprasScreen from '../../screens/ComprasScreen';
import KPICard from '../../components/ui/KPICard';

const S = {
  wrap: { padding: '0 20px 100px' },
  /* Mockup integracion/Pronóstico.html (.seg): sub-vistas como pills segmented,
     sin línea inferior — mismo patrón en Compras y Pronóstico. */
  tabs: {
    display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2,
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
  },
  tab: (active) => ({
    padding: '8px 14px', fontSize: 12.5, fontWeight: active ? 600 : 500,
    color: active ? '#fff' : 'var(--lp-text-secondary)',
    background: active ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)',
    border: 'none', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: 'var(--lp-font-sans)', flexShrink: 0,
  }),
  /* Subtítulo de pantalla (tsub del mockup): "Hola Arely · 2 por aprobar" */
  tsub: { fontSize: 12.5, color: 'var(--lp-text-secondary)', margin: '2px 0 12px' },
  h1: { fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--lp-text-primary)' },
  h1sub: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3, marginBottom: 16 },
  /* errbox del mockup: estados de error con Reintentar */
  errbox: {
    background: 'color-mix(in srgb, var(--lp-danger-600) 9%, var(--lp-bg-raised))',
    border: '1px solid color-mix(in srgb, var(--lp-danger-600) 26%, transparent)',
    color: 'var(--lp-danger-600)', borderRadius: 14, padding: '14px 16px',
    fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 11,
  },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap',
  },
  search: {
    flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  table: {
    width: '100%', borderCollapse: 'separate', borderSpacing: 0,
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)', overflow: 'hidden',
  },
  th: {
    padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.04em', color: 'var(--lp-text-tertiary)',
    background: 'var(--lp-bg-sunken)', borderBottom: '1.5px solid var(--lp-border-subtle)',
    textAlign: 'left', whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 14px', fontSize: 12, borderBottom: '1px solid var(--lp-border-subtle)',
    color: 'var(--lp-text-primary)',
  },
  dot: (color) => ({
    width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
  }),
  badge: (bg, fg) => ({
    display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 600,
    borderRadius: 6, background: bg, color: fg,
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
  kpiValue: { fontSize: 22, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', marginTop: 4 },
  kpiSub: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 },
  card: {
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 10,
  },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0', fontSize: 13 },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
};

/* ── Brand chart palette (verde manda — antes era morado #534AB7/#AFA9EC).
   Canvas no resuelve var(--lp-*), por eso se usan los hex del tema verde. ── */
const CHART_FC_HEX = '#7BC9AC';
const CHART_HIST_HEX = '#1D9E75';
const CHART_FC_STROKE_HEX = '#1D9E75';

/* ── Months helper ── */
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function mesLabel(mesKey) {
  if (!mesKey) return '';
  const parts = mesKey.split('-');
  const m = parseInt(parts[1]) - 1;
  return (MESES_CORTO[m] || '??') + ' ' + parts[0].slice(2);
}

/* ══════════════════════════════════════════════════════════════════ */
/* OCs — helpers de estado/pago/vencimiento (espejo de OCCard)        */
/* ══════════════════════════════════════════════════════════════════ */
function _diasVence(fechaVencimientoISO) {
  if (!fechaVencimientoISO) return null;
  try {
    const v = new Date(fechaVencimientoISO.slice(0, 10) + 'T00:00:00');
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.round((v - hoy) / (24 * 3600 * 1000));
  } catch { return null; }
}

/* "10 jun" desde un ISO de fecha de entrega (para la card de ComprasScreen). */
function _fmtEntrega(iso) {
  if (!iso) return '';
  try {
    const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + (MESES_CORTO[d.getMonth()] || '').toLowerCase();
  } catch { return ''; }
}

/* Clasifica una OC en: porAprobar | activa | recibida */
function _ocBucket(oc) {
  if (oc.estado === 'recibida' || oc.estado === 'completada' || oc.estado === 'eliminada' || oc.eliminada) {
    return 'recibida';
  }
  /* sin aprobar y sin forma de pago = está esperando aprobación */
  if (!oc.aprobada && !oc.pago) return 'porAprobar';
  return 'activa';
}

function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num === 0) return null;
  return '$' + num.toLocaleString('es-MX', { maximumFractionDigits: 0 });
}

/* Monto a mostrar en la columna/línea: factura real > estimado por items > flete. */
function _ocMonto(oc) {
  if (Number(oc.totalFacturaConIva) > 0) return fmtMoney(oc.totalFacturaConIva);
  const est = (oc.items || []).reduce((s, it) => {
    const kg = Number(it.kg) || 0;
    const p = Number(it.precioUnitario) || 0;
    return s + kg * p;
  }, 0);
  const flete = Number(oc.fleteEstimadoMxn) || 0;
  const total = est + flete;
  if (total > 0) return fmtMoney(total);
  return null;
}

/* Desglose para la card: PRODUCTO (precio base × kg — `precioUnitario` lo
   enriquece el server desde el costoBase del maestro) y FLETE por separado.
   Arely veía SOLO el flete; ahora se muestran ambos + total. Con factura real
   registrada, manda el total (no desglosamos). */
function _ocProducto(oc) {
  if (Number(oc.totalFacturaConIva) > 0) return null;
  const prod = (oc.items || []).reduce((s, it) => s + (Number(it.kg) || 0) * (Number(it.precioUnitario) || 0), 0);
  return prod > 0 ? fmtMoney(prod) : null;
}
function _ocFleteFmt(oc) {
  if (Number(oc.totalFacturaConIva) > 0) return null;
  const f = Number(oc.fleteEstimadoMxn) || 0;
  return f > 0 ? fmtMoney(f) : null;
}

function _ocKgTotal(oc) {
  return (oc.items || []).reduce((s, it) => s + (Number(it.kg) || 0), 0);
}

function _ocMPLabel(oc) {
  const items = oc.items || [];
  if (items.length === 0) return 'Materia prima';
  if (items.length === 1) return items[0].mp || 'Materia prima';
  return `${items[0].mp || 'MP'} +${items.length - 1}`;
}

/* Estado visual: { label, color (token) } */
function _ocEstadoVisual(oc, alertas) {
  const bucket = _ocBucket(oc);
  if (bucket === 'recibida') {
    if (oc.eliminada || oc.estado === 'eliminada') return { label: 'Eliminada', color: 'var(--lp-danger-600)' };
    return { label: 'Recibida', color: 'var(--lp-success-600)' };
  }
  if (bucket === 'porAprobar') return { label: 'Por aprobar', color: 'var(--lp-warning-600)' };
  if (alertas.vencida) return { label: 'Vencida', color: 'var(--lp-danger-600)' };
  if (alertas.porVencer) return { label: 'Por vencer', color: 'var(--lp-warning-600)' };
  return { label: 'Activa', color: 'var(--lp-info-600)' };
}

/* Etiqueta de forma de pago para la columna Pago */
function _ocPagoLabel(oc) {
  if (!oc.pago) return '—';
  if (oc.pago === 'contado') return 'Contado' + (oc.comprobanteNombre ? ' · comprobante' : '');
  if (oc.pago === 'credito') return oc.pagada ? 'Crédito · pagado' : 'Crédito 30d';
  return oc.pago;
}

/* ══════════════════════════════════════════════════════════════════ */
/* OC ACTIONS — botones + modales reales, gating idéntico a OCCard    */
/* Reutilizable por la fila de tabla (escritorio) y la card (móvil).  */
/* ══════════════════════════════════════════════════════════════════ */
const BTN = {
  base: {
    padding: '0 14px', minHeight: 44, height: 44, fontSize: 13, fontWeight: 600,
    borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    whiteSpace: 'nowrap',
  },
  primary: { background: 'var(--lp-brand-600)', color: '#fff' },
  ghost: { background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', border: '1px solid var(--lp-border-subtle)' },
  warn: { background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)' },
  danger: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)' },
  success: { background: 'var(--lp-success-100)', color: 'var(--lp-success-700)' },
  done: { background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-tertiary)', cursor: 'default' },
};
/* Versión compacta para celdas de tabla (escritorio): no estirar, tamaño cómodo. */
const BTN_SM = {
  base: {
    padding: '0 12px', minHeight: 34, height: 34, fontSize: 12, fontWeight: 600,
    borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    whiteSpace: 'nowrap',
  },
};

/* SVG line icons (sin emojis) */
const ICheck = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
);
const IPrint = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
);
const IPlus = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
);

/**
 * useOCActions — comparte el modal-state + handlers + gating de UNA oc.
 * Devuelve los botones a renderizar y los modales montados.
 * `compact` = botones de tabla (escritorio).
 */
function useOCActions(oc, onRefresh, can) {
  const [modal, setModal] = useState(null); /* aprobar | pago | editar | recibir | eliminar | null */
  const close = () => setModal(null);
  const refresh = () => onRefresh && onRefresh();

  const bucket = _ocBucket(oc);
  const isActive = bucket === 'activa';
  const isSolicitud = oc.origen === 'solicitud_tecnico' || oc.estado === 'solicitud';

  const necesitaAprobar = bucket === 'porAprobar' && can('compras');
  const esCreditoSinPagar = oc.pago === 'credito' && !oc.pagada;
  const dias = esCreditoSinPagar ? _diasVence(oc.fechaVencimiento) : null;
  const vencida = esCreditoSinPagar && dias != null && dias < 0;
  const porVencer = esCreditoSinPagar && dias != null && dias >= 0 && dias <= 5;

  const handlePrint = () => window.open(`/api/compras/oc/${oc.id}/print`, '_blank');

  const modals = (
    <>
      {modal === 'aprobar' && <AprobarOCModal oc={oc} onClose={close} onSaved={refresh} />}
      {modal === 'pago' && <RegistrarPagoModal oc={oc} onClose={close} onSaved={refresh} />}
      {modal === 'editar' && <EditOCModal oc={oc} onClose={close} onSaved={refresh} />}
      {modal === 'recibir' && <RecibirOCModal oc={oc} onClose={close} onSaved={refresh} />}
      {modal === 'eliminar' && <EliminarOCModal oc={oc} onClose={close} onSaved={refresh} />}
    </>
  );

  return {
    bucket, isActive, isSolicitud,
    necesitaAprobar, esCreditoSinPagar, dias, vencida, porVencer,
    setModal, handlePrint, modals,
  };
}

/* Renderiza la fila de botones de una OC. `sm` = compacto (tabla escritorio). */
function OCButtons({ a, can, sm }) {
  const SZ = sm ? BTN_SM.base : BTN.base;
  const recibida = a.bucket === 'recibida';
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: sm ? 'flex-end' : 'flex-start' }}>
      {a.necesitaAprobar && (
        /* §2: Aprobar OC → sheet de pago + comprobante */
        <button data-id="compras.btn.aprobar-oc" style={{ ...SZ, ...BTN.primary }}
          onClick={() => a.setModal('aprobar')} title="Aprobar OC: forma de pago + comprobante">
          Aprobar OC
        </button>
      )}
      {a.esCreditoSinPagar && can('compras') && (
        /* §2: Registrar pago (crédito) */
        <button data-id="compras.btn.registrar-pago" style={{ ...SZ, ...BTN.warn }}
          onClick={() => a.setModal('pago')} title="Registrar el pago del crédito (sube comprobante)">
          Registrar pago
        </button>
      )}
      {a.isActive && can('recibirMP') && (
        /* §2: Recibir MP */
        <button data-id="compras.btn.recibir-mp" style={{ ...SZ, ...(sm ? BTN.success : BTN.primary) }}
          onClick={() => a.setModal('recibir')} title="Registrar recepción de MP">
          {!sm && ICheck} Recibir MP
        </button>
      )}
      {a.isActive && can('compras') && (
        /* §2: Editar OC (compras, admin) */
        <button data-id="compras.btn.editar-oc" style={{ ...SZ, ...BTN.ghost }}
          onClick={() => a.setModal('editar')} title="Editar detalles de la OC">
          Editar
        </button>
      )}
      {!a.isSolicitud && !recibida && can('compras') && (
        /* §2: Imprimir OC */
        <button data-id="compras.btn.imprimir-oc" style={{ ...SZ, ...BTN.ghost }}
          onClick={a.handlePrint} title="Imprimir OC formal">
          {IPrint}{!sm && <span>Imprimir</span>}
        </button>
      )}
      {a.isActive && can('configuracion') && (
        /* §2: Eliminar OC (SOLO admin — can('configuracion') es admin-only) */
        <button data-id="compras.btn.eliminar-oc" data-rol="admin" style={{ ...SZ, ...BTN.danger }}
          onClick={() => a.setModal('eliminar')} title="Eliminar esta OC (solo admin)">
          Eliminar
        </button>
      )}
      {recibida && (
        <button style={{ ...SZ, ...BTN.done }} disabled>
          {ICheck} En inventario
        </button>
      )}
      {recibida && !a.isSolicitud && can('compras') && (
        <button data-id="compras.btn.imprimir-oc" style={{ ...SZ, ...BTN.ghost }}
          onClick={a.handlePrint} title="Imprimir OC formal">
          {IPrint}{!sm && <span>Imprimir</span>}
        </button>
      )}
    </div>
  );
}

/* Alerta de crédito (vencido / por vencer) — §2 */
function OCCreditAlert({ a, oc }) {
  if (a.vencida) {
    return (
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lp-danger-700)' }}>
        Crédito vencido · {Math.abs(a.dias)}d de retraso
      </div>
    );
  }
  if (a.porVencer) {
    return (
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lp-warning-700)' }}>
        Crédito por vencer · en {a.dias}d
      </div>
    );
  }
  if (a.esCreditoSinPagar && oc.fechaVencimiento) {
    return (
      <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)' }}>
        Crédito · vence {oc.fechaVencimiento.slice(0, 10)}
      </div>
    );
  }
  return null;
}

/* ── ESCRITORIO: una fila de la tabla de OCs ── */
function OCDeskRow({ oc, onRefresh, can }) {
  const a = useOCActions(oc, onRefresh, can);
  const ev = _ocEstadoVisual(oc, a);
  const monto = _ocMonto(oc);
  const producto = _ocProducto(oc);
  const flete = _ocFleteFmt(oc);
  const kg = _ocKgTotal(oc);
  return (
    <>
      <tr data-id="compras.card.oc">
        <td style={{ ...S.td, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-brand-700)' }}>
          {oc.codigo}
        </td>
        <td style={S.td}>
          <div style={{ fontWeight: 600 }}>{_ocMPLabel(oc)}</div>
          {kg > 0 && <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }}>{kg.toLocaleString('es-MX')} kg</div>}
          <OCCreditAlert a={a} oc={oc} />
        </td>
        <td style={S.td}>{oc.proveedor || '—'}</td>
        <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 600 }}>
          {monto || <span style={{ color: 'var(--lp-text-disabled)' }}>—</span>}
          {producto && (
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--lp-text-tertiary)', marginTop: 2, whiteSpace: 'nowrap' }}>
              prod {producto}{flete ? ` + flete ${flete}` : ''}
            </div>
          )}
        </td>
        <td style={{ ...S.td, fontSize: 11, color: 'var(--lp-text-secondary)' }}>{_ocPagoLabel(oc)}</td>
        <td style={S.td}>
          <span style={S.badge(`color-mix(in srgb, ${ev.color} 14%, transparent)`, ev.color)}>{ev.label}</span>
        </td>
        <td style={{ ...S.td, textAlign: 'right' }}>
          <OCButtons a={a} can={can} sm />
        </td>
      </tr>
      {a.modals}
    </>
  );
}

/* ── MÓVIL: card limpia (estilo S.compras) ── */
function OCMobileCard({ oc, onRefresh, can }) {
  const a = useOCActions(oc, onRefresh, can);
  const ev = _ocEstadoVisual(oc, a);
  const monto = _ocMonto(oc);
  const producto = _ocProducto(oc);
  const flete = _ocFleteFmt(oc);
  const stripe = ev.color;
  return (
    <div data-id="compras.card.oc"
      style={{ ...S.card, position: 'relative', paddingLeft: 20, borderRadius: 18 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', borderRadius: '18px 0 0 18px', background: stripe }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-700)' }}>
          {oc.codigo}
        </span>
        {a.isSolicitud && (
          <span style={S.badge('var(--lp-warning-100)', 'var(--lp-warning-700)')}>SOLICITUD</span>
        )}
        <span style={{ ...S.badge(`color-mix(in srgb, ${ev.color} 14%, transparent)`, ev.color), marginLeft: 'auto' }}>
          {ev.label}
        </span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--lp-text-primary)', letterSpacing: '-.01em' }}>
        {_ocMPLabel(oc)}
      </div>
      <div style={{ fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3 }}>
        {oc.proveedor || 'Proveedor'}
      </div>
      {(producto || flete || monto) && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 12, fontFamily: 'var(--lp-font-mono)' }}>
          {producto && <span style={{ color: 'var(--lp-text-tertiary)' }}>Producto <b style={{ color: 'var(--lp-text-secondary)', fontWeight: 700 }}>{producto}</b></span>}
          {flete && <span style={{ color: 'var(--lp-text-tertiary)' }}>Flete <b style={{ color: 'var(--lp-text-secondary)', fontWeight: 700 }}>{flete}</b></span>}
          {monto && <span style={{ color: 'var(--lp-text-tertiary)' }}>Total <b style={{ color: 'var(--lp-text-primary)', fontWeight: 700 }}>{monto}</b></span>}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <OCCreditAlert a={a} oc={oc} />
      </div>
      <div style={{ marginTop: 14 }}>
        <OCButtons a={a} can={can} />
      </div>
      {a.modals}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* OCs TAB — pills (Por aprobar/Activas/Recibidas) + Levantar OC       */
/* responsive: tabla (escritorio) / cards (móvil)                     */
/* ══════════════════════════════════════════════════════════════════ */
function OCsTabResponsive({ ocsData, onRefresh, prefillNewOC, onPrefillConsumed, onCreated, isDesktop }) {
  const { can, user } = useAuth();
  const [showNew, setShowNew] = useState(false);
  /* Modal activo (uno a la vez), levantado a este nivel: ComprasScreen es
     presentacional y dispara onAccion(cod) → aquí se resuelve la OC real y se
     abre el modal robusto correspondiente (con su comprobante/validaciones). */
  const [active, setActive] = useState(null); /* { oc, type } */
  /* Mockup Compras.html: "Imprimir OC" abre el documento con partidas en overlay
     (la versión del servidor sigue disponible desde el propio overlay). */
  const [printOC, setPrintOC] = useState(null);

  /* Si llega prefill desde MRP/Predicción, abrir Levantar OC */
  useEffect(() => { if (prefillNewOC) setShowNew(true); }, [prefillNewOC]);

  const ocs = useMemo(() => {
    const raw = Array.isArray(ocsData) ? ocsData : ocsData?.data || [];
    return raw;
  }, [ocsData]);

  /* Mapea cada OC real → shape presentacional de ComprasScreen, con los MISMOS
     helpers que usaba OCCard (bucket, monto, kg, vencimiento de crédito). */
  const ocsForScreen = useMemo(() => ocs.map(oc => {
    const bucket = _ocBucket(oc);
    const esCreditoSinPagar = oc.pago === 'credito' && !oc.pagada;
    const dias = esCreditoSinPagar ? _diasVence(oc.fechaVencimiento) : null;
    const vencida = (esCreditoSinPagar && dias != null && dias < 0) ? `${Math.abs(dias)}d` : undefined;
    const porVencer = (esCreditoSinPagar && dias != null && dias >= 0 && dias <= 5) ? `${dias}d` : undefined;
    const kg = _ocKgTotal(oc);
    return {
      cod: oc.codigo || oc.id,
      mp: _ocMPLabel(oc),
      qty: kg > 0 ? `${kg.toLocaleString('es-MX')} kg` : '',
      sol: oc.solicitadoPor || oc.solicitante || undefined,
      prov: oc.proveedor || '—',
      monto: _ocMonto(oc) || '',
      entrega: _fmtEntrega(oc.fechaEntrega),
      estado: bucket,
      vencida, porVencer,
      /* credito-pagado → ComprasScreen oculta "Registrar pago" */
      pago: (oc.pago === 'credito' && oc.pagada) ? 'credito-pagado' : oc.pago,
      comp: oc.comprobanteNombre || undefined,
      /* #3: OC nacida de una solicitud del técnico (Enrique) → badge SOLICITUD */
      solicitud: oc.origen === 'solicitud_tecnico' || oc.estado === 'solicitud',
      /* eliminada cae en el bucket 'recibida' (auditoría) pero se etiqueta distinto */
      eliminada: oc.eliminada || oc.estado === 'eliminada',
      /* FALTANTE: recibida con menos kg de los pedidos → badge en ComprasScreen. */
      faltante: !!oc.faltante,
    };
  }), [ocs]);

  const findOC = (cod) => ocs.find(o => (o.codigo || o.id) === cod);
  const openModal = (cod, type) => { const oc = findOC(cod); if (oc) setActive({ oc, type }); };
  const closeModal = () => setActive(null);
  const afterSave = () => { setActive(null); if (onRefresh) onRefresh(); };

  /* ComprasScreen pregunta can('eliminarOC') (no es un permiso real) → lo mapeamos
     a can('configuracion') = admin. El resto de permisos pasan directo. */
  const canForScreen = (p) => p === 'eliminarOC' ? can('configuracion') : can(p);

  const handleCreated = async () => {
    setShowNew(false);
    if (onPrefillConsumed) onPrefillConsumed();
    if (onCreated) onCreated();
    else await onRefresh();
  };
  const handleCloseNew = () => {
    setShowNew(false);
    if (onPrefillConsumed) onPrefillConsumed();
  };

  return (
    <>
      <ComprasScreen
        data={{ ocs: ocsForScreen }}
        isDesktop={isDesktop}
        role={user?.rol}
        can={canForScreen}
        /* Paquete MOCKUP 8 (lp-createbtn): en móvil el inline "Levantar OC"
           se oculta — lo cubre el FAB flotante de abajo. */
        onNuevaOC={isDesktop ? () => setShowNew(true) : undefined}
        onAprobarOC={(cod) => openModal(cod, 'aprobar')}
        onEditarOC={(cod) => openModal(cod, 'editar')}
        onEliminarOC={(cod) => openModal(cod, 'eliminar')}
        onRecibirMP={(cod) => openModal(cod, 'recibir')}
        onRegistrarPago={(cod) => openModal(cod, 'pago')}
        onImprimirOC={(cod) => { const oc = findOC(cod); if (oc) setPrintOC(oc); }}
        onVerComprobante={(cod) => openModal(cod, 'comprobante')}
      />

      {/* FAB móvil (paquete MOCKUP 8) — misma acción que "Levantar OC" */}
      {canForScreen('compras') && (
        <Fab label="Nueva OC" dataId="compras.fab.levantar-oc" dataRol="compras,admin"
          onClick={() => setShowNew(true)} />
      )}

      {printOC && <PrintOCOverlay oc={printOC} onClose={() => setPrintOC(null)} />}

      {active?.type === 'aprobar'  && <AprobarOCModal    oc={active.oc} onClose={closeModal} onSaved={afterSave} />}
      {active?.type === 'pago'     && <RegistrarPagoModal oc={active.oc} onClose={closeModal} onSaved={afterSave} />}
      {active?.type === 'editar'   && <EditOCModal       oc={active.oc} onClose={closeModal} onSaved={afterSave} />}
      {active?.type === 'recibir'  && <RecibirOCModal    oc={active.oc} onClose={closeModal} onSaved={afterSave} />}
      {active?.type === 'eliminar' && <EliminarOCModal   oc={active.oc} onClose={closeModal} onSaved={afterSave} />}
      {active?.type === 'comprobante' && <ComprobantesOCModal oc={active.oc} onClose={closeModal} />}

      {showNew && (
        <NewOCModal
          onClose={handleCloseNew}
          onCreated={handleCreated}
          prefillMP={prefillNewOC}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* BAR CHART — pure canvas, no dependencies (verde)                  */
/* ══════════════════════════════════════════════════════════════════ */
function BarChart({ historico, forecast, height = 220, onBarClick }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const allBars = useMemo(() => {
    const bars = [];
    const entries = Object.entries(historico || {}).sort(([a], [b]) => a.localeCompare(b));
    entries.forEach(([mes, val]) => bars.push({ mes, val, tipo: 'historico' }));
    (forecast || []).forEach(f => bars.push({ mes: f.mes, val: f.proyeccion_kg, tipo: 'forecast' }));
    return bars;
  }, [historico, forecast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || allBars.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const padL = 50, padR = 12, padT = 12, padB = 40;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const maxVal = Math.max(...allBars.map(b => b.val), 1);
    const barW = Math.max(4, Math.min(28, (chartW / allBars.length) - 4));
    const gap = (chartW - barW * allBars.length) / (allBars.length + 1);

    /* Grid lines */
    ctx.strokeStyle = '#e5e5e0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = '#999';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * (1 - i / 4)).toLocaleString(), padL - 6, y + 3);
    }

    /* Bars */
    allBars.forEach((bar, i) => {
      const x = padL + gap + i * (barW + gap);
      const bh = (bar.val / maxVal) * chartH;
      const y = padT + chartH - bh;

      if (bar.tipo === 'forecast') {
        ctx.fillStyle = CHART_FC_HEX;
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = CHART_FC_STROKE_HEX;
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, barW, bh);
        ctx.strokeRect(x, y, barW, bh);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = CHART_HIST_HEX;
        ctx.fillRect(x, y, barW, bh);
      }

      /* X label */
      if (allBars.length <= 18 || i % 2 === 0) {
        ctx.save();
        ctx.translate(x + barW / 2, h - padB + 12);
        ctx.rotate(-0.5);
        ctx.fillStyle = '#888';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(mesLabel(bar.mes), 0, 0);
        ctx.restore();
      }
    });

    /* Legend */
    const legY = padT + 2;
    ctx.fillStyle = CHART_HIST_HEX;
    ctx.fillRect(w - padR - 160, legY, 10, 10);
    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Historico', w - padR - 146, legY + 9);

    ctx.fillStyle = CHART_FC_HEX;
    ctx.fillRect(w - padR - 82, legY, 10, 10);
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = CHART_FC_STROKE_HEX;
    ctx.strokeRect(w - padR - 82, legY, 10, 10);
    ctx.setLineDash([]);
    ctx.fillStyle = '#666';
    ctx.fillText('Proyeccion', w - padR - 68, legY + 9);

    /* Click handler data */
    canvas._bars = allBars.map((bar, i) => ({
      x: padL + gap + i * (barW + gap),
      w: barW,
      ...bar,
    }));

  }, [allBars, height]);

  const handleClick = (e) => {
    if (!onBarClick || !canvasRef.current?._bars) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const bar = canvasRef.current._bars.find(b => x >= b.x && x <= b.x + b.w);
    if (bar) onBarClick(bar);
  };

  return (
    <div ref={containerRef} style={{ width: '100%', marginBottom: 16 }}>
      <canvas ref={canvasRef} style={{ display: 'block', cursor: 'pointer' }} onClick={handleClick} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* SEASONAL INDEX — horizontal mini bars                             */
/* ══════════════════════════════════════════════════════════════════ */
function SeasonalIndex({ indice }) {
  if (!indice || Object.keys(indice).length === 0) return null;
  const entries = Object.entries(indice).sort(([a], [b]) => a.localeCompare(b));
  const maxVal = Math.max(...entries.map(([, v]) => v), 1.3);

  return (
    <div style={S.card}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Indice estacional
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
        {entries.map(([mes, val]) => {
          const pct = (val / maxVal) * 100;
          const isHigh = val > 1.1;
          const isLow = val < 0.9;
          const color = isHigh ? 'var(--lp-success-600)' : isLow ? 'var(--lp-warning-600)' : 'var(--lp-brand-600)';
          const bgColor = isHigh ? 'var(--lp-success-100)' : isLow ? 'var(--lp-warning-100)' : 'var(--lp-brand-100)';
          return (
            <div key={mes} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lp-text-tertiary)', width: 28, flexShrink: 0 }}>
                {MESES_CORTO[parseInt(mes) - 1]}
              </span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--lp-bg-sunken)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: color, transition: 'width .3s' }} />
              </div>
              <span style={{ ...S.badge(bgColor, color), minWidth: 32, justifyContent: 'center' }}>
                {val.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 8 }}>
        {'> 1.0 = temporada alta, < 1.0 = temporada baja. Base: produccion historica real.'}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* ALERTS                                                             */
/* ══════════════════════════════════════════════════════════════════ */
function Alertas({ alertas }) {
  if (!alertas || alertas.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Alertas de consumo
      </div>
      {alertas.slice(-6).reverse().map((a, i) => {
        const isCrit = a.nivel === 'critical';
        const bg = isCrit ? 'var(--lp-danger-100)' : 'var(--lp-warning-100)';
        const fg = isCrit ? 'var(--lp-danger-600)' : 'var(--lp-warning-600)';
        const arrow = a.tipo === 'incremento' ? '+' : '';
        return (
          <div key={i} style={{ padding: '10px 14px', background: bg, borderRadius: 8, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...S.badge(isCrit ? 'var(--lp-danger-600)' : 'var(--lp-warning-600)', '#fff'), fontSize: 11 }}>
              {isCrit ? 'CRITICO' : 'AVISO'}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: fg, fontFamily: 'var(--lp-font-mono)' }}>
              {mesLabel(a.mes)}
            </span>
            <span style={{ fontSize: 12, color: fg, flex: 1 }}>{a.mensaje}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: fg, fontFamily: 'var(--lp-font-mono)' }}>
              {arrow}{a.variacion_pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* FORECAST POR MP — Top MPs con mayor consumo proyectado            */
/* ══════════════════════════════════════════════════════════════════ */
function ForecastMPTable({ forecastPorMP, consumoPorMP, inventario }) {
  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [sortBy, setSortBy] = useState('consumo');

  const items = useMemo(() => {
    if (!forecastPorMP) return [];
    let arr = Object.entries(forecastPorMP).map(([mp, data]) => {
      const stock = inventario?.[mp]?.qty ?? 0;
      const consumo = data.wma_mensual || 0;
      const mesesStock = consumo > 0 ? stock / consumo : 999;
      const deficit = consumo - stock;
      return { mp, consumo, stock, mesesStock, deficit, mesesDatos: data.meses_datos || 0 };
    });
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      arr = arr.filter(it => it.mp.toLowerCase().includes(q));
    }
    if (sortBy === 'consumo') arr.sort((a, b) => b.consumo - a.consumo);
    else if (sortBy === 'deficit') arr.sort((a, b) => b.deficit - a.deficit);
    else if (sortBy === 'meses') arr.sort((a, b) => a.mesesStock - b.mesesStock);
    return arr;
  }, [forecastPorMP, inventario, debouncedQuery, sortBy]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Proyeccion por materia prima
      </div>
      <div style={S.toolbar}>
        <input type="text" style={{ ...S.search, maxWidth: 260 }} placeholder="Buscar MP..."
          value={query} onChange={e => setQuery(e.target.value)} />
        <SegmentedControl
          value={sortBy}
          onChange={setSortBy}
          color="brand"
          options={[
            { value: 'consumo', label: 'Mayor consumo' },
            { value: 'deficit', label: 'Mayor déficit' },
            { value: 'meses',   label: 'Menos meses' },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <div style={S.empty}>Sin datos de MPs.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>MP</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Stock (kg)</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Consumo/mes</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Meses stock</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Deficit</th>
                <th style={S.th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 40).map(it => {
                const urgente = it.mesesStock < 1;
                const bajo = it.mesesStock < 2;
                const dotColor = urgente ? 'var(--lp-danger-600)' : bajo ? 'var(--lp-warning-600)' : 'var(--lp-success-600)';
                const statusBg = urgente ? 'var(--lp-danger-100)' : bajo ? 'var(--lp-warning-100)' : 'var(--lp-success-100)';
                const statusFg = urgente ? 'var(--lp-danger-600)' : bajo ? 'var(--lp-warning-600)' : 'var(--lp-success-600)';
                const statusTxt = urgente ? 'Urgente' : bajo ? 'Bajo' : 'OK';

                return (
                  <tr key={it.mp}>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={S.dot(dotColor)} />
                        <span>{it.mp}</span>
                      </div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>
                      {it.stock.toFixed(1)}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 600 }}>
                      {it.consumo.toFixed(1)}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: dotColor, fontWeight: 600 }}>
                      {it.mesesStock >= 99 ? '99+' : it.mesesStock.toFixed(1)}
                    </td>
                    <td style={{
                      ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700,
                      color: it.deficit > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)',
                    }}>
                      {it.deficit > 0 ? `-${it.deficit.toFixed(1)}` : '—'}
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(statusBg, statusFg)}>{statusTxt}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* SELECTED BAR DETAIL — top 10 MPs for a clicked month              */
/* ══════════════════════════════════════════════════════════════════ */
function BarDetail({ barData, consumoPorMP, onClose }) {
  /* BUG FIX React #310: el useMemo DEBE llamarse antes de cualquier early return.
     Antes: `if (!barData) return null` estaba ANTES de useMemo → cuando barData
     cambiaba de null a objeto, React veía un hook nuevo y crasheaba con
     "Rendered more hooks than during the previous render". */
  const topMPs = useMemo(() => {
    if (!consumoPorMP || !barData) return [];
    return Object.entries(consumoPorMP)
      .map(([mp, meses]) => ({ mp, kg: meses[barData.mes] || 0 }))
      .filter(it => it.kg > 0)
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 10);
  }, [consumoPorMP, barData?.mes]);

  if (!barData) return null;

  return (
    <div style={{ ...S.card, borderLeft: '3px solid var(--lp-brand-600)', borderRadius: '0 var(--lp-radius) var(--lp-radius) 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{mesLabel(barData.mes)}</span>
          <span style={{ ...S.badge(barData.tipo === 'forecast' ? 'var(--lp-brand-100)' : 'var(--lp-brand-100)', barData.tipo === 'forecast' ? 'var(--lp-brand-600)' : 'var(--lp-brand-700)'), marginLeft: 8 }}>
            {barData.tipo === 'forecast' ? 'Proyeccion' : 'Historico'}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--lp-text-tertiary)' }}>x</button>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-brand-600)' }}>
        {Math.round(barData.val).toLocaleString()} cubetas
      </div>
      {topMPs.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', marginTop: 12, marginBottom: 6, textTransform: 'uppercase' }}>
            Top 10 MPs consumidas
          </div>
          {topMPs.map(it => {
            const maxKg = topMPs[0].kg;
            const pct = maxKg > 0 ? (it.kg / maxKg) * 100 : 0;
            return (
              <div key={it.mp} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, minWidth: 140, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.mp}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--lp-bg-sunken)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'var(--lp-brand-500)' }} />
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--lp-font-mono)', fontWeight: 600, color: 'var(--lp-text-secondary)', minWidth: 55, textAlign: 'right' }}>
                  {it.kg.toFixed(0)} kg
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* FORECAST PT TABLE — Producto Terminado: Producción + Demanda POS + Blend */
/* ══════════════════════════════════════════════════════════════════ */
function ForecastPTTable({ forecastPorPT, consumoPorPT, forecastBlend, demandaPOS, posMeta }) {
  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [sortBy, setSortBy] = useState('blend');
  const [expanded, setExpanded] = useState(null);
  const [vista, setVista] = useState('blend'); /* blend | produccion | pos */

  const items = useMemo(() => {
    const blend = forecastBlend || {};
    const allKeys = new Set([...Object.keys(forecastPorPT || {}), ...Object.keys(blend)]);
    let arr = Array.from(allKeys).map(pt => {
      const prod = forecastPorPT?.[pt] || {};
      const b = blend[pt] || {};
      const pos = demandaPOS?.[pt] || {};
      const prodMensual = prod.wma_mensual || b.produccion_mensual || 0;
      const posMensual = pos.demanda_mensual || b.demanda_pos_mensual || 0;
      const blended = b.blended_mensual || prodMensual;
      const gap = b.gap ?? (prodMensual - posMensual);
      const gapPct = b.gapPct ?? (posMensual > 0 ? Math.round(((prodMensual / posMensual) - 1) * 100) : null);
      const fuente = b.fuente || 'produccion';
      const forecast = vista === 'blend' ? (b.forecast || prod.forecast || [])
                     : vista === 'pos' ? [] /* POS no tiene forecast mensual aún */
                     : (prod.forecast || []);
      const proxMes = forecast.length > 0 ? forecast[0].cubetas : (vista === 'pos' ? posMensual : 0);
      const yoy = prod.yoy_factor || 1;
      const trend = ((yoy - 1) * 100);
      return { pt, prodMensual, posMensual, blended, gap, gapPct, fuente, trend, proxMes,
               mesesDatos: prod.meses_datos || b.meses_datos_prod || 0, forecast, detalle: pos.detalle || b.detalle_pos || '' };
    });
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      arr = arr.filter(it => it.pt.toLowerCase().includes(q));
    }
    if (sortBy === 'blend') arr.sort((a, b) => b.blended - a.blended);
    else if (sortBy === 'produccion') arr.sort((a, b) => b.prodMensual - a.prodMensual);
    else if (sortBy === 'pos') arr.sort((a, b) => b.posMensual - a.posMensual);
    else if (sortBy === 'gap') arr.sort((a, b) => (a.gap) - (b.gap)); /* déficit primero */
    else if (sortBy === 'nombre') arr.sort((a, b) => a.pt.localeCompare(b.pt));
    return arr;
  }, [forecastPorPT, forecastBlend, demandaPOS, debouncedQuery, sortBy, vista]);

  const hasPOS = Object.keys(demandaPOS || {}).length > 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Proyeccion producto terminado
        </div>
        {hasPOS && (
          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--lp-info-100)', color: 'var(--lp-info-700)', fontWeight: 600 }}>
            + Ventas POS
          </span>
        )}
      </div>
      {hasPOS && posMeta && (
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginBottom: 8, padding: '4px 8px', background: 'var(--lp-bg-sunken)', borderRadius: 4 }}>
          Fuente POS: {posMeta.tienda || 'Tienda'} ({posMeta.periodo || '28 meses'}) — {posMeta.nota || ''}
        </div>
      )}
      <div style={S.toolbar}>
        <input type="text" style={{ ...S.search, maxWidth: 220 }} placeholder="Buscar producto..."
          value={query} onChange={e => setQuery(e.target.value)} />
        <SegmentedControl
          value={sortBy}
          onChange={setSortBy}
          color="brand"
          options={[
            ...(hasPOS ? [{ value: 'blend', label: 'Combinado' }] : []),
            { value: 'produccion', label: 'Producción' },
            ...(hasPOS ? [{ value: 'pos',  label: 'Demanda POS' }] : []),
            ...(hasPOS ? [{ value: 'gap',  label: 'Déficit' }] : []),
            { value: 'nombre',     label: 'A–Z' },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <div style={S.empty}>Sin datos de productos terminados.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Producto</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Produccion</th>
                {hasPOS && <th style={{ ...S.th, textAlign: 'right' }}>Demanda POS</th>}
                {hasPOS && <th style={{ ...S.th, textAlign: 'right' }}>Combinado</th>}
                {hasPOS && <th style={{ ...S.th, textAlign: 'right' }}>Gap</th>}
                <th style={{ ...S.th, textAlign: 'right' }}>Prox. mes</th>
                <th style={S.th}>6 meses</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const isOpen = expanded === it.pt;
                const maxFc = Math.max(...(it.forecast.length > 0 ? it.forecast.map(f => f.cubetas) : [1]), 1);
                /* Gap indicator: red = underproduction, green = overproduction */
                const gapColor = it.gap < -5 ? 'var(--lp-danger-600)' : it.gap > 5 ? 'var(--lp-success-600)' : 'var(--lp-text-tertiary)';
                const gapBg = it.gap < -5 ? 'var(--lp-danger-100)' : it.gap > 5 ? 'var(--lp-success-100)' : 'var(--lp-bg-sunken)';

                return (
                  <tr key={it.pt} style={{ cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : it.pt)}>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--lp-text-disabled)', transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>&#9654;</span>
                        <div>
                          <span>{it.pt}</span>
                          {it.fuente === 'pos' && <span style={{ fontSize: 8, marginLeft: 4, color: 'var(--lp-info-700)' }}>solo POS</span>}
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ marginTop: 8, marginLeft: 16 }} onClick={e => e.stopPropagation()}>
                          {it.detalle && <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginBottom: 6 }}>{it.detalle}</div>}
                          {it.forecast.length > 0 ? it.forecast.map(f => (
                            <div key={f.mes} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lp-text-tertiary)', width: 42 }}>{mesLabel(f.mes)}</span>
                              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--lp-bg-sunken)', overflow: 'hidden', maxWidth: 120 }}>
                                <div style={{ height: '100%', width: `${(f.cubetas / maxFc) * 100}%`, borderRadius: 3, background: it.fuente === 'pos' ? 'var(--lp-info-500)' : it.fuente === 'blend' ? 'var(--lp-brand-500)' : 'var(--lp-brand-300)' }} />
                              </div>
                              <span style={{ fontSize: 11, fontFamily: 'var(--lp-font-mono)', fontWeight: 600, color: 'var(--lp-text-secondary)' }}>
                                {f.cubetas}
                              </span>
                            </div>
                          )) : (
                            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>Demanda POS mensual constante: {it.posMensual} cub/mes</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', verticalAlign: 'top' }}>
                      {Math.round(it.prodMensual) || <span style={{ color: 'var(--lp-text-disabled)' }}>—</span>}
                    </td>
                    {hasPOS && (
                      <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', verticalAlign: 'top', color: 'var(--lp-info-700)' }}>
                        {it.posMensual || <span style={{ color: 'var(--lp-text-disabled)' }}>—</span>}
                      </td>
                    )}
                    {hasPOS && (
                      <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 600, verticalAlign: 'top' }}>
                        {it.blended}
                      </td>
                    )}
                    {hasPOS && (
                      <td style={{ ...S.td, textAlign: 'right', verticalAlign: 'top' }}>
                        {it.gapPct !== null ? (
                          <span style={S.badge(gapBg, gapColor)}>
                            {it.gap > 0 ? '+' : ''}{it.gap} ({it.gapPct > 0 ? '+' : ''}{it.gapPct}%)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--lp-text-disabled)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    )}
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 600, verticalAlign: 'top' }}>
                      {it.proxMes}
                    </td>
                    <td style={{ ...S.td, verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 20 }}>
                        {it.forecast.slice(0, 6).map((f, idx) => {
                          const bh = maxFc > 0 ? Math.max(2, (f.cubetas / maxFc) * 20) : 2;
                          return <div key={idx} style={{ width: 6, height: bh, borderRadius: 1, background: it.fuente === 'blend' ? 'var(--lp-brand-500)' : 'var(--lp-brand-300)' }} />;
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* PRONOSTICO TAB                                                     */
/* ══════════════════════════════════════════════════════════════════ */
function PronosticoTab({ forecastData, inventario }) {
  const [selectedBar, setSelectedBar] = useState(null);

  const d = forecastData?.data || forecastData || {};
  const forecast = d.forecast || [];
  const consumoMensual = d.consumoMensual || {};
  const indiceEstacional = d.indiceEstacional || {};
  const alertas = d.alertas || [];
  const forecastPorMP = d.forecastPorMP || {};
  const consumoPorMP = d.consumoPorMP || {};
  const forecastPorPT = d.forecastPorPT || {};
  const consumoPorPT = d.consumoPorPT || {};
  const forecastBlend = d.forecastBlend || {};
  const demandaPOS = d.demandaPOS || {};
  const posMeta = d.pos_meta || null;
  const params = d.parametros || {};

  const mesesHist = Object.keys(consumoMensual).length;
  const hasForecast = forecast.length > 0;

  /* KPIs */
  const promedioMensual = mesesHist > 0
    ? Math.round(Object.values(consumoMensual).reduce((s, v) => s + v, 0) / mesesHist)
    : 0;
  const proxMes = hasForecast ? Math.round(forecast[0].proyeccion_kg) : 0;
  const alertCount = alertas.length;

  /* PERIYOY (algoritmo propio) — combina 3 YoY independientes:
     producción, compras y ventas POS, comparando mes igual contra mes igual del año anterior. */
  const yoyProd    = params.yoy_produccion || {};
  const yoyComp    = params.yoy_compras    || {};
  const yoyVentas  = params.yoy_ventas     || {};
  const yoyPctProd = yoyProd.factor != null ? +((yoyProd.factor - 1) * 100).toFixed(1) : null;
  const yoyPctComp = yoyComp.factor != null ? +((yoyComp.factor - 1) * 100).toFixed(1) : null;
  const yoyPctVtas = yoyVentas.factor != null ? +((yoyVentas.factor - 1) * 100).toFixed(1) : null;
  /* Promedio simple de los YoY confiables = índice PERIYOY global */
  const yoyValores = [yoyPctProd, yoyPctComp, yoyPctVtas].filter(v => v != null);
  const periyoy = yoyValores.length > 0 ? +(yoyValores.reduce((s,v)=>s+v,0)/yoyValores.length).toFixed(1) : null;
  const periyoyConfiable = (yoyProd.confiable || yoyComp.confiable || yoyVentas.confiable);

  if (mesesHist === 0) {
    return <div style={S.empty}>Sin histórico suficiente para la tendencia. Se necesitan al menos 3 meses de producción.</div>;
  }

  return (
    <>
      {/* KPIs — estilo dot unificado (KPICard) */}
      <div style={S.kpiGrid}>
        <KPICard accent="var(--lp-brand-600)" label="Promedio/mes" value={promedioMensual.toLocaleString()} sub="cubetas" />
        <KPICard accent="var(--lp-success-600)" label="Prox. mes" value={proxMes.toLocaleString()} sub="proyeccion" />
        <KPICard
          accent={periyoy != null && periyoy >= 0 ? 'var(--lp-success-600)' : 'var(--lp-warning-600)'}
          style={{ cursor: 'help' }}
          title={`Crecimiento YoY = promedio de 3 YoY (mismo mes año anterior).\nProducción: ${yoyPctProd != null ? yoyPctProd + '%' : 'sin datos'} (${yoyProd.pares || 0} pares)\nCompras:    ${yoyPctComp != null ? yoyPctComp + '%' : 'sin datos'} (${yoyComp.pares || 0} pares)\nVentas POS: ${yoyPctVtas != null ? yoyPctVtas + '%' : 'sin desglose mensual'}`}
          label="Crecimiento YoY"
          value={periyoy != null
            ? <>{periyoy >= 0 ? '+' : ''}{periyoy}<span style={{ fontSize: 16, opacity: .7 }}>%</span></>
            : '—'}
          sub={<>
            Prod {yoyPctProd != null ? (yoyPctProd >= 0 ? '+' : '') + yoyPctProd + '%' : '—'}
            {' · '}Comp {yoyPctComp != null ? (yoyPctComp >= 0 ? '+' : '') + yoyPctComp + '%' : '—'}
            {' · '}POS {yoyPctVtas != null ? (yoyPctVtas >= 0 ? '+' : '') + yoyPctVtas + '%' : '—'}
            {!periyoyConfiable && <span style={{ color: 'var(--lp-warning-700)' }}> ~</span>}
          </>}
        />
        <KPICard accent={alertCount > 0 ? 'var(--lp-warning-600)' : 'var(--lp-text-tertiary)'} label="Alertas" value={alertCount} sub={`${mesesHist} meses datos`} />
      </div>

      {/* Chart */}
      <div style={{ ...S.card, padding: '16px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Produccion mensual + proyeccion
        </div>
        <BarChart
          historico={consumoMensual}
          forecast={forecast}
          height={240}
          onBarClick={setSelectedBar}
        />
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', textAlign: 'center' }}>
          Click en una barra para ver detalle de MPs consumidas
        </div>
      </div>

      {/* Bar detail */}
      {selectedBar && (
        <BarDetail barData={selectedBar} consumoPorMP={consumoPorMP} onClose={() => setSelectedBar(null)} />
      )}

      {/* Alerts */}
      <Alertas alertas={alertas} />

      {/* Seasonal index */}
      <SeasonalIndex indice={indiceEstacional} />

      {/* Forecast per PT */}
      <ForecastPTTable forecastPorPT={forecastPorPT} consumoPorPT={consumoPorPT}
        forecastBlend={forecastBlend} demandaPOS={demandaPOS} posMeta={posMeta} />

      {/* Forecast per MP */}
      <ForecastMPTable forecastPorMP={forecastPorMP} consumoPorMP={consumoPorMP} inventario={inventario} />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* FLAG POPUP COMPONENT — Banderitas con info de gasto_local, datos_insuficientes, CV */
/* ══════════════════════════════════════════════════════════════════ */
function FlagPopup({ flags, anchorRect, onClose }) {
  const [popRect, setPopRect] = useState(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!popRef.current || !anchorRect) return;
    const rect = popRef.current.getBoundingClientRect();
    setPopRect(rect);

    const handleClickOutside = (e) => {
      if (!popRef.current?.contains(e.target) && !e.target.closest('.lp-mrp-flag-btn')) {
        onClose();
      }
    };
    const handleScroll = () => onClose();

    setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
      document.addEventListener('scroll', handleScroll, true);
    }, 50);

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [anchorRect, onClose]);

  if (!anchorRect || flags.length === 0) return null;

  // Posicionar: intentar a la derecha, si no cabe, a la izquierda
  let left = anchorRect.left + anchorRect.width + 6;
  let top = anchorRect.top;
  if (popRect && left + popRect.width > window.innerWidth - 10) {
    left = anchorRect.left - popRect.width - 6;
  }
  if (popRect && top + popRect.height > window.innerHeight - 10) {
    top = window.innerHeight - popRect.height - 10;
  }

  return (
    <div
      ref={popRef}
      style={{
        position: 'fixed',
        zIndex: 9999,
        left: `${left}px`,
        top: `${top}px`,
        background: 'var(--lp-bg-raised)',
        border: '1px solid var(--lp-border-default, #d4d2c8)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,.12)',
        padding: '10px 12px',
        fontSize: 11,
        lineHeight: 1.4,
        color: 'var(--lp-text-primary, #1a1815)',
        minWidth: 220,
        maxWidth: 300,
      }}
    >
      {flags.map((f, idx) => (
        <div key={idx}>
          {idx > 0 && <div style={{ borderTop: '1px solid var(--lp-border-subtle, #e8e6de)', margin: '8px 0' }} />}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: f.color, fontSize: 14, fontWeight: 900, lineHeight: 1, marginTop: 1 }}>
              {f.icon}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: f.color, marginBottom: 2 }}>
                {f.titulo}
              </div>
              <div style={{ color: 'var(--lp-text-secondary, #6B6560)' }}>
                {f.texto}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* MRP TAB                                                            */
/* ══════════════════════════════════════════════════════════════════ */
function MRPTab({ mrpData, onCrearOC }) {
  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [flagPopup, setFlagPopup] = useState(null); // { flags, anchorRect }

  const items = useMemo(() => {
    const raw = mrpData?.data?.items || mrpData?.data || mrpData?.items || [];
    if (!Array.isArray(raw)) return [];
    let arr = [...raw];
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      arr = arr.filter(it => (it.mp || it.nombre || '').toLowerCase().includes(q));
    }
    return arr;
  }, [mrpData, debouncedQuery]);

  const toast = useToast();
  const [gen, setGen] = useState(false);

  const deficitItems = useMemo(() => items.filter(it => {
    const stock = it.stockActual ?? it.stock ?? it.tengo ?? 0;
    const deficit = it.deficit ?? 0;
    return deficit > 0 && !it.gasto_local && stock >= 0;
  }), [items]);

  /* "Para" — fecha límite para tener la MP (hoy si ya está en cero). */
  const fmtPara = (stock, consumo, deficit) => {
    if (deficit > 0 && stock <= 0) return 'hoy';
    if (!consumo || consumo <= 0) return '—';
    const dias = Math.max(0, Math.round((stock / consumo) * 30));
    const d = new Date(); d.setDate(d.getDate() + dias);
    return d.getDate() + ' ' + (MESES_CORTO[d.getMonth()] || '').toLowerCase();
  };

  const handleGenerarTodas = async () => {
    if (!deficitItems.length || gen) return;
    setGen(true);
    try {
      const payload = deficitItems.map(it => ({ mp: it.mp || it.nombre, cantidad: Math.ceil(it.deficit ?? 0), proveedor: it.proveedor_principal || it.proveedor || null }));
      const r = await api.generarOCsBulkForecast(payload, 'Generadas desde MRP');
      toast.success(`${r?.total ?? payload.length} OC(s) creadas → Compras · Por aprobar`, { duration: 5000 });
    } catch (e) {
      toast.error('Error al generar OCs: ' + (e?.data?.error || e.message));
    } finally { setGen(false); }
  };

  return (
    <>
      <div style={S.toolbar}>
        <input type="text" style={S.search} placeholder="Buscar materia prima..."
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {flagPopup && (
        <FlagPopup
          flags={flagPopup.flags}
          anchorRect={flagPopup.anchorRect}
          onClose={() => setFlagPopup(null)}
        />
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '2px 0 10px' }}>
        Plan de requerimientos (MRP) · Neto a comprar
      </div>

      {items.length === 0 ? (
        <div style={S.empty}>{debouncedQuery ? 'Sin resultados para tu búsqueda.' : 'MRP sin requerimientos netos pendientes.'}</div>
      ) : (
        <>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Materia prima</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Demanda</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Disponible</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Neto a comprar</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Para</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const mp = it.mp || it.nombre || `MP-${i}`;
                const stock = it.stockActual ?? it.stock ?? it.tengo ?? 0;
                const consumo = it.necesidadMes ?? it.consumo_mensual ?? it.necesito ?? 0;
                const deficit = it.deficit ?? 0;
                const priColor = deficit > 0
                  ? (stock <= 0 ? 'var(--lp-danger-600)' : 'var(--lp-warning-600)')
                  : 'var(--lp-success-600)';
                const clickable = deficit > 0 && !it.gasto_local;

                // Construir flags (banderitas)
                const flagsArr = [];
                if (it.gasto_local) {
                  flagsArr.push({
                    tipo: 'local',
                    icon: '★',
                    color: 'var(--lp-brand-600)',
                    titulo: 'Insumo local',
                    texto: 'Se pide localmente sin OC formal a proveedor (ej: agua de la llave). Sigue contando en el costeo.',
                  });
                }
                if (it.datos_insuficientes) {
                  flagsArr.push({
                    tipo: 'datos',
                    icon: '!',
                    color: 'var(--lp-warning-600)',
                    titulo: 'Datos insuficientes',
                    texto: 'Menos de 3 meses de consumo histórico. El pronóstico es estimación gruesa — interpretar con cautela.',
                  });
                }
                if (it.cv && it.cv > 0) {
                  const pct = Math.round((it.margen_aplicado - 1) * 100);
                  const bandaCV = it.cv < 0.20 ? 'muy estable' : it.cv < 0.50 ? 'normal' : it.cv < 1.0 ? 'volátil' : 'errático';
                  flagsArr.push({
                    tipo: 'cv',
                    icon: '~',
                    color: 'var(--lp-text-tertiary)',
                    titulo: `Margen dinámico (CV ${it.cv.toFixed(2)})`,
                    texto: `Variabilidad: ${bandaCV}. Margen aplicado: ${pct}% sobre el consumo mensual.`,
                  });
                }
                const topFlag = flagsArr.find(f => f.tipo === 'datos') || flagsArr.find(f => f.tipo === 'local') || flagsArr[0];

                return (
                  <tr key={mp}
                    onClick={clickable ? () => onCrearOC && onCrearOC({ mp, kg: Math.ceil(deficit), proveedor: it.proveedor_principal || it.proveedor || null }) : undefined}
                    style={clickable ? { cursor: 'pointer' } : undefined}
                    title={clickable ? `Click para crear OC de ${mp} (${Math.ceil(deficit)} kg)` : undefined}>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={S.dot(priColor)} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{mp}</span>
                          {flagsArr.length > 0 && (
                            <button
                              className="lp-mrp-flag-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setFlagPopup({ flags: flagsArr, anchorRect: rect });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                marginLeft: 2,
                                fontSize: 14,
                                fontWeight: 900,
                                color: topFlag.color,
                                lineHeight: 1,
                                title: 'Click para más info',
                              }}
                              title="Click para más info"
                            >
                              {topFlag.icon}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>
                      {/* FIX jun 2026 (reporte owner): la Demanda mostraba el consumo SIN
                          el margen dinámico por volatilidad, pero el Neto SÍ lo usa →
                          la aritmética parecía rota (Disponible > Demanda y aun así
                          "comprar X kg"). Ahora la columna muestra la demanda REAL del
                          cálculo (consumo × margen) y abajo el desglose. */}
                      {(() => {
                        const margen = Number(it.margen_aplicado) || 1;
                        const demandaReal = it.necesidad_periodo != null
                          ? Number(it.necesidad_periodo)
                          : (typeof consumo === 'number' ? consumo * margen : consumo);
                        const conMargen = margen > 1.02 && typeof demandaReal === 'number';
                        return (
                          <>
                            {typeof demandaReal === 'number' ? demandaReal.toFixed(0) : demandaReal} kg
                            {conMargen && (
                              <div style={{ fontSize: 10, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-sans)' }}>
                                {typeof consumo === 'number' ? consumo.toFixed(0) : consumo} +{Math.round((margen - 1) * 100)}% volatilidad
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>
                      {typeof stock === 'number' ? stock.toFixed(0) : stock} kg
                    </td>
                    <td style={{
                      ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700,
                      color: deficit > 0 ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
                    }}>
                      {deficit > 0 ? `${Math.ceil(deficit)} kg` : '—'}
                    </td>
                    <td style={{
                      ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)',
                      color: deficit > 0 && stock <= 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-secondary)',
                    }}>
                      {deficit > 0 ? fmtPara(stock, consumo, deficit) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {deficitItems.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button data-id="mrp.btn.generar-todas" data-rol="compras,admin" onClick={handleGenerarTodas} disabled={gen}
              style={{ minHeight: 46, padding: '0 22px', borderRadius: 12, border: 'none', cursor: gen ? 'default' : 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 14, fontWeight: 600, background: 'var(--lp-brand-600)', color: '#fff', opacity: gen ? .7 : 1 }}>
              {gen ? 'Generando…' : `Generar todas las OC (${deficitItems.length})`}
            </button>
          </div>
        )}
        </>
      )}
    </>
  );
}

/* ── errbox del mockup (Pronóstico.html): mensaje + Reintentar ── */
function ErrBox({ msg, onRetry }) {
  return (
    <div style={S.errbox}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" />
      </svg>
      <span style={{ flex: 1, minWidth: 160 }}>{msg}</span>
      {onRetry && (
        <button type="button" data-id="pronostico.btn.reintentar" data-rol="compras,admin" onClick={onRetry}
          style={{ height: 34, padding: '0 14px', borderRadius: 10, border: '1px solid var(--lp-border-subtle)', background: 'transparent', color: 'var(--lp-text-secondary)', fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
          Reintentar
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                    */
/* ══════════════════════════════════════════════════════════════════ */
/**
 * ComprasPage — pantalla COMPARTIDA por dos rutas (decisión LOCKED del dueño, §9):
 *   - mode='compras'    (/compras)    → SOLO ejecutar OCs (Por aprobar · Activas · Recibidas).
 *   - mode='pronostico' (/pronostico) → SOLO la inteligencia
 *                                        (Forecast IA [default] · MRP · Tendencia · IA avanzada · Pedidos).
 * Misma lógica, mismos handlers, mismos modales — solo cambia QUÉ tabs se muestran.
 * "Generar OC" desde la inteligencia (MRP/Predicción) sigue cayendo en Compras ▸ Por aprobar:
 *   handleCrearOCFromMRP guarda el prefill y, si está en modo pronóstico, navega a /compras
 *   con el prefill en el state de la ruta para que OCsTabResponsive abra "Levantar OC".
 */
export default function ComprasPage({ mode = 'compras' }) {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const esPronostico = mode === 'pronostico';
  /* Tab inicial por modo: compras→ocs (Por aprobar), pronostico→forecast (Forecast IA). */
  const [activeTab, setActiveTab] = useState(esPronostico ? 'forecast' : 'ocs');
  /* Prefill de "Levantar OC": puede venir local (modo compras) o por router state
     (cuando el usuario generó una OC desde /pronostico y se le redirige a /compras). */
  const [newOCPrefill, setNewOCPrefill] = useState(location.state?.newOCPrefill || null); // { mp, kg, proveedor }

  const { data: mrpData, loading: mrpLoading, error: mrpError, reload: reloadMRP } = useApiData(() => api.getMRP(), [], 15000);
  const { data: forecastData, loading: fcLoading, error: fcError, reload: reloadFc } = useApiData(() => api.getForecast(), null, 30000);
  const { data: invData } = useApiData(() => api.getInventario(), null, 30000);
  const { data: ocsData, loading: ocsLoading, reload: reloadOCs } = useApiData(() => api.get('/api/compras/oc'), [], 20000);

  /* FIX jun 2026 (K1): ComprasPage era la única pantalla pesada del ERP sin
     realtime sync — Arely solo veía OCs nuevas tras polling de 20s o refresh.
     Ahora reacciona a oc/precios/inventario en tiempo real. */
  useRealtimeSync({
    onOc:        () => reloadOCs(),
    onPrecios:   () => reloadOCs(),
    onInventario:() => reloadOCs(),
  });

  /* Callback desde MRPTab/Predicción: abre Levantar OC con la MP pre-llenada.
     - En modo 'compras' (la tab OCs existe aquí): cambia a la tab ocs con el prefill.
     - En modo 'pronostico' (la tab OCs NO existe aquí): navega a /compras pasando
       el prefill por router-state → ComprasPage(mode='compras') lo lee y abre
       "Levantar OC". Así la OC generada SIEMPRE cae en Compras ▸ Por aprobar. */
  const handleCrearOCFromMRP = (data) => {
    if (esPronostico) {
      navigate('/compras', { state: { newOCPrefill: data } });
      return;
    }
    setNewOCPrefill(data);
    setActiveTab('ocs');
  };
  const handleNewOCCreated = () => {
    setNewOCPrefill(null);
    /* Limpia el router-state para que un refresh no reabra el modal. */
    if (location.state?.newOCPrefill) navigate(location.pathname, { replace: true, state: {} });
    reloadOCs();
  };

  /* Subtítulo del mockup ("Hola Arely · 2 por aprobar · 1 vencida") con conteos
     en vivo de las OCs reales — solo informativo, no gatea nada. */
  const subCompras = useMemo(() => {
    const raw = Array.isArray(ocsData) ? ocsData : ocsData?.data || [];
    const porAprobar = raw.filter(o => _ocBucket(o) === 'porAprobar').length;
    const vencidas = raw.filter(o => {
      if (_ocBucket(o) !== 'activa') return false;
      if (o.pago !== 'credito' || o.pagada) return false;
      const d = _diasVence(o.fechaVencimiento);
      return d != null && d < 0;
    }).length;
    const hola = user?.nombre ? `Hola ${user.nombre}` : 'Órdenes de compra';
    return `${hola} · ${porAprobar} por aprobar${vencidas ? ` · ${vencidas} vencida${vencidas > 1 ? 's' : ''}` : ''}`;
  }, [ocsData, user]);

  /* Build simple inv map for MP stock lookup */
  const inventario = useMemo(() => {
    const raw = invData?.data || invData || {};
    if (typeof raw !== 'object' || Array.isArray(raw)) return {};
    const map = {};
    Object.entries(raw).forEach(([key, val]) => {
      if (val && typeof val === 'object' && val.tipo === 'mp') {
        map[key] = val;
      }
    });
    return map;
  }, [invData]);

  /* TABS — se eligen según `mode` (decisión LOCKED del dueño, §9). NO se borra
     lógica de ninguna tab; solo se decide CUÁLES se montan en cada pantalla.
     - mode='compras'    → SOLO ejecutar OCs (Por aprobar/Activas/Recibidas viven
       dentro de la tab 'ocs' vía SegmentedControl en OCsTabResponsive).
     - mode='pronostico' → SOLO la inteligencia: Sugerencias (Forecast IA, default),
       MRP, Tendencia (PronosticoTab/WMA), IA avanzada, Pedidos.
     SAT y POS Aliases salieron a pantallas propias (/sat, /pos-aliases) — ya NO
     se montan aquí en ningún modo. */
  const tabsCompras = [
    { id: 'ocs', label: 'Órdenes' },
    { id: 'catalogo', label: 'Catálogo' },
  ];
  const tabsPronostico = [
    { id: 'forecast',   label: 'Sugerencias' },
    { id: 'mrp',        label: 'MRP' },
    { id: 'pronostico', label: 'Tendencia' },
    { id: 'ia',         label: 'IA avanzada' },
    { id: 'pedidos',    label: 'Pedidos' },
  ];
  const tabs = esPronostico ? tabsPronostico : tabsCompras;

  return (
    <>
      <TopBar title={esPronostico ? 'Pronóstico' : 'Compras'} />
      <div style={S.wrap}>
        {/* Encabezado del mockup: h1+sub en escritorio (Pronóstico) / tsub con conteos (Compras) */}
        {esPronostico ? (
          isDesktop ? (
            <>
              <div style={S.h1}>Pronóstico</div>
              <div style={S.h1sub}>Inteligencia de compras · Forecast IA, MRP y tendencias</div>
            </>
          ) : (
            <div style={S.tsub}>Inteligencia de compras</div>
          )
        ) : (
          /* solo con datos cargados — evita el flash "0 por aprobar" */
          ocsData != null && <div style={S.tsub}>{subCompras}</div>
        )}
        {esPronostico ? (
          <HelpHint id="pronostico-overview" title="Pronóstico: la inteligencia de compra">
            <strong>Sugerencias</strong>: motor Forecast IA con demanda proyectada + safety stock; generar OC cae en Compras ▸ Por aprobar. <strong>MRP</strong>: detecta MPs que faltan según producción esperada. <strong>Tendencia</strong>: WMA × estacional × YoY blended con demanda POS. <strong>IA avanzada</strong>: Holt forecasting. <strong>Pedidos</strong>: predicción de pedidos.
          </HelpHint>
        ) : (
          <HelpHint id="compras-overview" title="Compras: ejecutar órdenes de compra">
            <strong>Compras</strong>: levanta, aprueba (con pago + comprobante), recibe y cierra órdenes de compra. La inteligencia (Forecast IA, MRP, Tendencia) vive en <strong>Pronóstico</strong>.
          </HelpHint>
        )}
        <PageTabs
          tabs={tabs.map(t => ({ ...t, style: (active) => S.tab(active) }))}
          activeTab={activeTab}
          onChange={setActiveTab}
          style={S.tabs}
        />

        {activeTab === 'ocs' && (
          ocsLoading
            ? <div style={S.spinner}><div className="lp-spinner" /></div>
            : <OCsTabResponsive
                ocsData={ocsData}
                onRefresh={reloadOCs}
                prefillNewOC={newOCPrefill}
                onPrefillConsumed={() => setNewOCPrefill(null)}
                onCreated={handleNewOCCreated}
                isDesktop={isDesktop}
              />
        )}

        {activeTab === 'catalogo' && (
          <CatalogoCompraTab
            isDesktop={isDesktop}
            onCreated={() => { reloadOCs(); setActiveTab('ocs'); }}
          />
        )}

        {activeTab === 'pedidos' && (
          <PrediccionPedidosTab onCreateOC={handleCrearOCFromMRP} />
        )}

        {activeTab === 'mrp' && (
          mrpLoading
            ? <div style={S.spinner}><div className="lp-spinner" /></div>
            : (mrpError && !mrpData)
              ? <ErrBox msg="Error al correr el MRP." onRetry={reloadMRP} />
              : <MRPTab mrpData={mrpData} onCrearOC={handleCrearOCFromMRP} />
        )}

        {activeTab === 'pronostico' && (
          fcLoading
            ? <div style={S.spinner}><div className="lp-spinner" /></div>
            : (fcError && !forecastData)
              ? <ErrBox msg="No se pudo cargar la tendencia." onRetry={reloadFc} />
              : <PronosticoTab forecastData={forecastData} inventario={inventario} />
        )}

        {/* Forecast IA genera OCs server-side (generarOCsBulkForecast) que caen
            directo en Compras ▸ Por aprobar — no necesita callback de prefill. */}
        {activeTab === 'forecast' && <ForecastIATab />}

        {activeTab === 'ia' && <PrediccionIATab />}
      </div>
    </>
  );
}
