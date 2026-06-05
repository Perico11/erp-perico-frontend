import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import PageTabs from '../../components/ui/PageTabs';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import QRModal from '../../components/QRModal';
import useConfirm from '../../hooks/useConfirm';
import { ESTADO_SUBLOTE_LABEL, ESTADO_SUBLOTE_COLOR, ESTADO_LOTE_LABEL } from '../../lib/loteTransiciones';
import PruebaBadge from '../../components/ui/PruebaBadge';
import { qrSvg, qrDataUrl } from '../../lib/qrGenerator';

/* Construye la URL pública del QR de un sublote. Mirror de _generarQRPayload del backend. */
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

/* ── Helpers ── */
const B = (bg, fg) => ({
  display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 600,
  borderRadius: 6, background: bg, color: fg, marginRight: 4,
});

function litUsed(lote) {
  /* Evitar doble conteo TOTE + hijos: los sublotes finales que salen de un TOTE
     representan los MISMOS litros que el TOTE contenía. Solo contamos:
     - Sublotes finales (no-tote, fase!=1)
     - Para TOTEs: solo los litros YA consumidos (lit - litrosRestante),
       que NO tengan hijos registrados (si tienen hijos, esos ya se cuentan) */
  const subs = lote.sublotes || [];
  let total = 0;
  subs.forEach(s => {
    const lit = Number(s.lit) || 0;
    const isTote = s.tipo === 'tote' || s.fase === 1 || s.claseSublote === 'tote';
    if (!isTote) {
      /* Sublote final — siempre cuenta */
      total += lit;
    } else {
      /* TOTE: solo contar litros que AÚN no tienen hijos finales registrados.
         Si el TOTE tiene litrosRestante, esos litros no están envasados.
         Si tiene hijos (fromTote/esHijoDe), esos litros ya se contaron arriba. */
      const tieneHijos = subs.some(h => h !== s && (h.fromTote === s.cod || h.esHijoDe === s.cod));
      if (!tieneHijos) {
        /* TOTE sin reenvasar — sus litros representan material envasado a granel */
        total += lit;
      }
      /* Si tiene hijos, NO sumamos el TOTE — los hijos ya cubren esos litros */
    }
  });
  return total;
}
function litRest(lote) {
  const total = Number(lote.litrosTotal) || 0;
  return Math.max(0, total - litUsed(lote));
}
function envEstado(lote) {
  const total = Number(lote.litrosTotal) || 0;
  if (total <= 0) return 'listo';
  const used = litUsed(lote);
  if (used <= 0) return 'listo';
  const rest = total - used;
  if (rest < 1 || (rest / total) < 0.005) return 'envasado';
  return 'parcial';
}

/* X3 (jun 2026): labels canónicos importados desde lib/loteTransiciones.js.
   El bg/fg sigue local porque StockFabrica usa paletas suaves (chip pastel)
   distintas a las del badge sólido del state-machine en otros lugares.
   Si el lote tiene un estado fuera del dominio canónico, el .label
   default es el código crudo (debug-friendly). */
const ESTADO_BG_FG = {
  producido:      { bg: 'var(--lp-brand-100)',   fg: 'var(--lp-brand-700)' },
  qc_aprobado:    { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-600)' },
  en_envasado:    { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
  en_proceso:     { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
  envasado:       { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-600)' },
  en_recoleccion: { bg: '#EDE9FE',              fg: '#7C3AED' },
  en_camino:      { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
  en_almacen:     { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-600)' },
  reenvasado:     { bg: '#FAECE7',              fg: '#993C1D' },
};
const ESTADO_MAP = Object.keys(ESTADO_BG_FG).reduce((acc, k) => {
  acc[k] = { label: ESTADO_LOTE_LABEL[k] || k, ...ESTADO_BG_FG[k] };
  return acc;
}, { reenvasado: { label: 'Re-envasado', ...ESTADO_BG_FG.reenvasado } }); /* reenvasado no está en ESTADO_LOTE_LABEL */

const S = {
  wrap: { padding: '0 20px 100px' },
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
    flexWrap: 'wrap', marginBottom: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 8 },
  cardActions: { display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  progressWrap: { height: 8, borderRadius: 4, background: 'var(--lp-bg-sunken)', overflow: 'hidden', marginBottom: 4 },
  progressBar: (pct) => ({
    height: '100%', borderRadius: 4, width: `${Math.min(100, pct)}%`,
    background: pct >= 100 ? 'var(--lp-success-500)' : 'var(--lp-brand-500)',
    transition: 'width .3s',
  }),
  btnPrimary: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-brand-600)', color: '#fff', minHeight: 40,
  },
  btnSuccess: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-success-600)', color: '#fff', minHeight: 40,
  },
  btnSecondary: {
    padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', minHeight: 40,
  },
  btnWarn: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-warning-600)', color: '#fff', minHeight: 40,
  },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0', fontSize: 13 },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
  /* Modal */
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
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    boxSizing: 'border-box', marginBottom: 12,
  },
  fieldSelect: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    boxSizing: 'border-box', marginBottom: 12, appearance: 'auto',
  },
  /* ── Z8 (jun 2026): formulario guiado de envasado ─────────────────── */
  stepBar: {
    display: 'flex', alignItems: 'center', gap: 6,
    marginBottom: 16, flexWrap: 'wrap',
  },
  stepChip: (st /* done | current | pending */) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11, fontWeight: st === 'current' ? 700 : 600,
    color: st === 'pending' ? 'var(--lp-text-tertiary)'
         : st === 'current' ? 'var(--lp-brand-700)'
         : 'var(--lp-success-700)',
  }),
  stepNum: (st) => ({
    width: 18, height: 18, borderRadius: '50%',
    background: st === 'pending' ? 'var(--lp-bg-sunken)'
             : st === 'current' ? 'var(--lp-brand-600)'
             : 'var(--lp-success-600)',
    color: st === 'pending' ? 'var(--lp-text-tertiary)' : '#fff',
    fontSize: 9, fontWeight: 800, fontFamily: 'var(--lp-font-mono)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }),
  stepSep: { width: 12, height: 1, background: 'var(--lp-border-default)' },
  presoGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))',
    gap: 8, marginBottom: 16,
  },
  presoCard: (active, disabled) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    padding: '12px 8px', borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid ' + (active ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'),
    background: active ? 'var(--lp-brand-50)' : (disabled ? 'var(--lp-bg-sunken)' : 'var(--lp-bg-raised)'),
    color: active ? 'var(--lp-brand-700)' : (disabled ? 'var(--lp-text-tertiary)' : 'var(--lp-text-secondary)'),
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    fontFamily: 'var(--lp-font-sans)', minHeight: 76,
    transition: 'all .15s', textAlign: 'center',
  }),
  presoNombre: { fontSize: 12, fontWeight: 700, lineHeight: 1.1 },
  presoCap: { fontSize: 10, opacity: .8, fontFamily: 'var(--lp-font-mono)' },
  ticket: {
    background: 'var(--lp-bg-sunken)',
    border: '1.5px dashed var(--lp-border-default)',
    borderRadius: 'var(--lp-radius-sm)',
    padding: '12px 14px', marginTop: 4,
  },
  ticketRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 12, padding: '3px 0',
  },
  ticketKey: { color: 'var(--lp-text-tertiary)', fontWeight: 600 },
  ticketVal: { color: 'var(--lp-text-primary)', fontWeight: 700, fontFamily: 'var(--lp-font-mono)' },
  toast: {
    position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 1001,
    background: 'var(--lp-success-600)', color: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,.15)',
  },
  sublote: {
    padding: '8px 12px', borderRadius: 8, marginBottom: 4,
    border: '1px solid var(--lp-border-subtle)', fontSize: 12,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
};

/* Z8 (jun 2026): metadata de presentaciones con iconos SVG inline.
   Reemplaza el <select> plano por tarjetas visuales touch-friendly. */
const PRESENTACIONES_META = [
  {
    key: 'cubeta', nombre: 'Cubeta', cap: '19 L',
    icon: (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z"/><path d="M4 7h16"/><path d="M9 4h6l1 3H8l1-3Z"/></svg>),
  },
  {
    key: 'galon', nombre: 'Galón', cap: '3.785 L',
    icon: (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3h4v2.5l2.5 1.8A3 3 0 0 1 18 9.7V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9.7a3 3 0 0 1 1.5-2.4L10 5.5V3Z"/><path d="M6 12h12"/></svg>),
  },
  {
    key: 'litro', nombre: 'Litro', cap: '1 L',
    icon: (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h6v3l1 2v13a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7l1-2V2Z"/><path d="M8 11h8"/></svg>),
  },
  {
    key: 'otros', nombre: 'Otros', cap: 'bote/funda',
    icon: (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>),
  },
  {
    key: 'tote', nombre: 'TOTE', cap: 'granel',
    icon: (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="2.6"/><path d="M4 5v14a8 2.6 0 0 0 16 0V5"/><path d="M4 12a8 2.6 0 0 0 16 0"/></svg>),
  },
];

/* ═══════════════════════════════════════════════════════════════════ */
/* ENVASADO MODAL                                                     */
/* ═══════════════════════════════════════════════════════════════════ */
function EnvasadoModal({ lote, envases, userName, onClose, onSuccess }) {
  /* REGLA DE NEGOCIO: TOTE indivisible.
     Un TOTE es un contenedor de transporte a granel. Si el lote se envasa en
     TOTE, va TODO el lote en uno o más TOTEs del MISMO tipo — nunca mezclado
     con envases finales (cubeta/galón/litro) en el mismo lote.

     - Si el lote ya tiene sublotes envasados_final → solo permitimos seguir
       envasando en envases finales (TOTE deshabilitado).
     - Si el lote ya tiene sublotes TOTE → solo permitimos crear más TOTEs
       (envases finales deshabilitados).
     - Si el lote NO tiene sublotes todavía → el técnico elige libremente,
       pero al elegir TOTE auto-llenamos la cantidad con los litros restantes
       (porque va TODO el lote o nada). */
  const sublotesActuales = (lote.sublotes || []).filter(s => !s.esMerma);
  /* Detectores explícitos — NO usar negaciones que dan falso positivo con
     sublotes legacy donde claseSublote/fase pueden ser undefined.
     PRESENTACIONES_FINALES = solo las realmente finales. */
  const PRESENTACIONES_FINALES = ['cubeta', 'galon', 'litro'];
  const haySublotesFinales = sublotesActuales.some(s =>
    s.claseSublote === 'envasado_final' ||
    s.fase === 2 ||
    PRESENTACIONES_FINALES.includes(s.tipo)
  );
  const haySublotesTote = sublotesActuales.some(s =>
    s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1
  );
  /* Si ya hay TOTEs, forzar tipo='tote'. Si ya hay finales, default='cubeta'. */
  const tipoInicial = haySublotesTote ? 'tote' : 'cubeta';
  const [tipo, setTipo] = useState(tipoInicial);
  const [marca, setMarca] = useState('');
  const [tapaKey, setTapaKey] = useState('');
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const rest = litRest(lote);
  const tapas = envases?.tapas || {};
  const tapaDefault = envases?.tapa_default || {};

  /* Capacidad por tipo — tote usa litros directos, no qty × cap */
  const isTote = tipo === 'tote';
  const capMap = { cubeta: 19, galon: 3.785, litro: 1, tote: 1 };
  const litPorUnidad = capMap[tipo] || 19;
  const maxUnidades = isTote ? rest : Math.floor(rest / litPorUnidad);
  const litTotal = isTote ? (parseFloat(qty) || 0) : (parseInt(qty) || 0) * litPorUnidad;

  /* TOTE indivisible: al cambiar a TOTE, auto-llenar litros con TODO el restante.
     Si el técnico necesita dos TOTEs (lote más grande que un solo contenedor),
     editará el campo, pero la sugerencia inicial es "todo el lote". */
  useEffect(() => {
    if (isTote && rest > 0) {
      setQty(String(Math.floor(rest)));
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [isTote]);

  /* Solo cubeta usa tapa formal. Galón/litro/tote no requieren */
  const usaTapa = tipo === 'cubeta';

  /* Marcas DISPONIBLES para el tipo seleccionado.
     En vez de usar `envases.marcas` (lista plana mezclada), filtramos las
     subcategorias dentro de la categoria activa. Así "Premium" para cubeta
     resuelve a `cubeta-premium`, para galón a `galon-premium`, etc. */
  const subcatList = useMemo(() => {
    if (isTote) return [];
    const cat = envases?.categorias?.[tipo];
    if (!cat?.subcategorias) return [];
    return Object.entries(cat.subcategorias)
      .map(([k, v]) => ({
        key: k,
        nombre: v.nombre,
        marca: v.marca,
        stock: v.stock || 0,
        min: v.min || 0,
      }))
      .sort((a, b) => (b.stock - a.stock) || a.nombre.localeCompare(b.nombre));
  }, [tipo, isTote, envases]);

  /* Auto-seleccionar primera subcat con stock cuando cambia el tipo */
  useEffect(() => {
    if (isTote) { setMarca(''); return; }
    /* Si la marca actual no coincide con ninguna subcat del nuevo tipo, reset */
    const found = subcatList.find(s => s.marca === marca);
    if (!found) {
      const firstWithStock = subcatList.find(s => s.stock > 0);
      setMarca(firstWithStock?.marca || '');
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [tipo]);

  /* subKey real para enviar al backend */
  const subcatActual = subcatList.find(s => s.marca === marca);
  const subKey = subcatActual?.key || null;
  const stockEnvase = subcatActual?.stock || 0;
  const stockEnvaseInsuf = !isTote && parseInt(qty) > 0 && stockEnvase < parseInt(qty);

  /* Auto-sugerir tapa cuando cambia la marca (si no hay override manual) */
  const tapaSugerida = marca ? tapaDefault[marca] : '';
  /* Si no hay tapa seleccionada, usar la sugerida */
  const tapaEfectiva = tapaKey || tapaSugerida || '';
  const tapaInfo = tapaEfectiva ? tapas[tapaEfectiva] : null;
  const stockTapaInsuf = usaTapa && tapaInfo && (tapaInfo.stock || 0) < (parseInt(qty) || 0);

  const handleSubmit = async () => {
    const q = isTote ? parseFloat(qty) : parseInt(qty);
    if (!q || q < (isTote ? 0.1 : 1)) return setError(isTote ? 'Litros debe ser > 0' : 'Cantidad debe ser >= 1');
    if (litTotal > rest + 0.5) return setError(`Solo quedan ${rest.toFixed(1)} L, estas intentando envasar ${litTotal.toFixed(1)} L`);
    /* TOTE indivisible: bloqueo de mezcla */
    if (isTote && haySublotesFinales) return setError('Este lote ya tiene envases finales — no se puede agregar TOTE');
    if (!isTote && haySublotesTote) return setError('Este lote ya tiene un TOTE activo — los envases finales se generan al re-envasar el TOTE en Terán');
    if (!isTote && !subKey) return setError(`Selecciona una marca de ${tipo} (no hay ${tipo} seleccionado)`);
    if (stockEnvaseInsuf) return setError(`Stock insuficiente de "${subcatActual.nombre}": tienes ${stockEnvase}, necesitas ${q}`);
    if (usaTapa && !tapaEfectiva && Object.keys(tapas).length > 0) return setError('Selecciona una tapa para cubetas');
    if (stockTapaInsuf) return setError(`Stock insuficiente de "${tapaInfo.nombre}": tienes ${tapaInfo.stock}, necesitas ${q}`);
    setSaving(true);
    setError('');
    try {
      const letra = String.fromCharCode(65 + (lote.sublotes || []).length);
      const cod = (lote.codigo || lote.codigoLote || lote.id) + '-' + letra;
      const litExact = +litTotal.toFixed(2);
      /* SUBLOTE v2: aliñado con la state machine canonizada.
         - claseSublote: discriminador 'envasado_final' | 'tote'
         - estado: 'envasado' (final) o 'tote_activo' (granel, mientras le queden litros)
         - litrosOriginal: capacidad total al crearse
         - litrosRestante: solo aplica a TOTE (decrementa al re-envasar);
           en envasado_final queda en 0 (se entrega completo)
         - qrPayload: URL pública /qr/<cod> que apuntará al landing
         - esHijoDe: null (este sublote nace directo del lote, no de un TOTE)
         - historial: trazabilidad granular por sublote */
      const sublote = {
        cod,
        /* Discriminador semántico (sublote.claseSublote — vive aparte del 'tipo' visual) */
        claseSublote: isTote ? 'tote' : 'envasado_final',
        /* Estado inicial canónico: TODO sublote nace en 'envasado' (listo para
           recolectar). El estado 'tote_activo' solo se aplica cuando Josué
           recibe el TOTE en Terán via escanearRecibirTeran (se resuelve auto).
           Antes el TOTE arrancaba en tote_activo y bloqueaba a Luis. */
        estado: 'envasado',
        /* Presentación física (mantener nombre para compat con dashboards viejos) */
        tipo,
        subKey: subKey || undefined,
        env: isTote
          ? `Tote ${q}L`
          : (subcatActual?.nombre || (tipo === 'cubeta' ? '19L Estandar' : tipo === 'galon' ? '3.785L' : '1L')),
        marca: marca || null,
        qty: isTote ? 1 : q,
        lit: litExact,
        litrosOriginal: litExact,
        litrosRestante: isTote ? litExact : 0,
        tapa: usaTapa ? (tapaInfo?.nombre || null) : null,
        tapaKey: usaTapa ? tapaEfectiva : null,
        ub: 'fabrica',
        esMerma: false,
        fase: isTote ? 1 : 2,
        esHijoDe: null,
        qrPayload: buildQrUrl(cod),
        historial: [{
          accion: 'crear',
          estadoNuevo: isTote ? 'tote_activo' : 'envasado',
          ts: new Date().toISOString(),
          usuario: userName || null,
        }],
      };
      /* FIX jun 2026: log explícito del payload para diagnóstico en consola
         si algo falla. El usuario puede abrir DevTools (F12) y ver el JSON
         exacto que se intentó enviar. */
      console.log('[ENVASADO] POST /api/envasado/registrar', { loteId: lote.id, sublote });
      await api.registrarEnvasado(lote.id, [sublote]);
      onSuccess({ sublotes: [sublote], lote, isTote, q, tipo, litTotal });
    } catch (err) {
      /* FIX jun 2026: mostrar error completo + detalles del backend si vienen.
         Antes solo se mostraba "Datos inválidos" sin saber qué campo falló. */
      const baseMsg = err.message || 'Error al envasar';
      const detalles = err?.data?.detalles || err?.data?.errors || [];
      const fullMsg = Array.isArray(detalles) && detalles.length > 0
        ? `${baseMsg}\n\nCampos con problema:\n• ${detalles.slice(0, 5).join('\n• ')}`
        : baseMsg;
      console.error('[ENVASADO] Error:', err, 'data:', err?.data);
      setError(fullMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            Envasar Lote
            {lote.esPrueba && <PruebaBadge size="sm" />}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-tertiary)', display: 'flex', padding: 4 }} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={S.modalBody}>
          {/* Z8: step bar guía — pasos adaptativos según presentación.
              TOTE: 2 pasos (Presentación · Litros). Cubeta: 4 (Pres · Envase ·
              Tapa · Cantidad). Galón/Litro/Otros: 3 (Pres · Envase · Cantidad). */}
          {(() => {
            const pasos = [{ k: 'preso', label: 'Presentación', ok: !!tipo }];
            if (!isTote) pasos.push({ k: 'envase', label: 'Envase', ok: !!subKey });
            if (usaTapa) pasos.push({ k: 'tapa', label: 'Tapa', ok: !!tapaEfectiva });
            pasos.push({ k: 'cant', label: isTote ? 'Litros' : 'Cantidad', ok: parseFloat(qty) > 0 });
            /* el "actual" es el primer paso no-ok */
            const idxActual = pasos.findIndex(p => !p.ok);
            const nodes = [];
            pasos.forEach((p, i) => {
              const st = p.ok ? 'done' : (i === idxActual ? 'current' : 'pending');
              nodes.push(
                <span key={p.k} style={S.stepChip(st)}>
                  <span style={S.stepNum(st)}>
                    {st === 'done' ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (i + 1)}
                  </span>
                  {p.label}
                </span>
              );
              if (i < pasos.length - 1) nodes.push(<span key={'sep' + p.k} style={S.stepSep} />);
            });
            return <div style={S.stepBar}>{nodes}</div>;
          })()}

          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--lp-danger-100)',
              color: 'var(--lp-danger-600)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 12,
              whiteSpace: 'pre-line', /* respeta \n del mensaje multi-línea */
              lineHeight: 1.5,
              maxHeight: 200, overflowY: 'auto',
            }}>
              {error}
            </div>
          )}

          <div style={{ padding: 12, background: 'var(--lp-bg-sunken)', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' }}>{lote.codigo || lote.id}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{lote.producto || lote.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2 }}>
              Disponible: <strong>{rest.toFixed(1)} L</strong> de {(lote.litrosTotal || 0).toFixed(1)} L
            </div>
          </div>

          <label style={S.fieldLabel}>Presentación</label>
          {/* Z8: tarjetas visuales en vez de <select>. Auto-completar marca/tapa
             sigue funcionando igual al cambiar de tipo (efecto del setTipo).
             La regla TOTE-indivisible deshabilita visualmente las opciones
             incompatibles según lo ya envasado. */}
          <div style={S.presoGrid}>
            {PRESENTACIONES_META.map(p => {
              const disabled = p.key === 'tote' ? haySublotesFinales : haySublotesTote;
              const active = tipo === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => setTipo(p.key)}
                  style={S.presoCard(active, disabled)}
                  title={p.key === 'tote' ? 'TOTE / Granel — contenedor para reenvasar en Terán' : `${p.nombre} (${p.cap})`}
                >
                  <span>{p.icon}</span>
                  <span style={S.presoNombre}>{p.nombre}</span>
                  <span style={S.presoCap}>{p.cap}</span>
                </button>
              );
            })}
          </div>
          {(haySublotesFinales || haySublotesTote) && (
            <div style={{
              padding: '8px 10px', marginBottom: 12,
              background: 'var(--lp-info-50)', color: 'var(--lp-info-700)',
              borderRadius: 6, fontSize: 11, lineHeight: 1.5,
            }}>
              {haySublotesFinales
                ? 'Este lote ya tiene sublotes en envase final. No puedes agregar TOTE — un lote va completo en envases finales o completo en TOTE, no se mezcla.'
                : 'Este lote ya tiene un TOTE activo. Solo puedes seguir envasando en TOTE — los envases finales (cubeta/galón/litro) se generan al re-envasar el TOTE en Terán.'}
            </div>
          )}

          {!isTote && (
            <>
              <label style={S.fieldLabel}>
                {tipo === 'cubeta' ? 'Cubeta' : tipo === 'galon' ? 'Galón' : tipo === 'litro' ? 'Litro' : 'Envase'} a usar
                {subcatActual && (
                  <span style={{ marginLeft: 6, fontSize: 11,
                    color: stockEnvase > 0 ? 'var(--lp-success-600)' : 'var(--lp-danger-600)',
                    fontWeight: 700 }}>
                    stock {stockEnvase}
                  </span>
                )}
              </label>
              {subcatList.length === 0 ? (
                <div style={{ padding: 10, background: 'var(--lp-warning-50)', borderRadius: 8, fontSize: 12, color: 'var(--lp-warning-700)', marginBottom: 12 }}>
                  No hay subcategorías de {tipo} registradas. Pídele a admin que las dé de alta.
                </div>
              ) : (
                <select
                  style={{ ...S.fieldSelect,
                    borderColor: stockEnvaseInsuf ? 'var(--lp-danger-500)' : 'var(--lp-border-subtle)' }}
                  value={marca}
                  onChange={e => setMarca(e.target.value)}
                >
                  <option value="">— Selecciona —</option>
                  {subcatList.map(s => (
                    <option key={s.key} value={s.marca || s.nombre} disabled={s.stock <= 0}>
                      {s.nombre} {s.stock > 0 ? `(stock: ${s.stock})` : '— SIN STOCK'}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}

          {usaTapa && Object.keys(tapas).length > 0 && (
            <>
              <label style={S.fieldLabel}>
                Tapa (cubeta requiere tapa)
                {tapaSugerida && !tapaKey && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--lp-brand-600)', fontWeight: 500 }}>
                    sugerida según marca
                  </span>
                )}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6, marginBottom: 12 }}>
                {Object.entries(tapas).map(([k, t]) => {
                  const stock = t.stock || 0;
                  const cantidadActual = parseInt(qty) || 0;
                  const sinStock = stock <= 0;
                  const insuficiente = !sinStock && cantidadActual > 0 && stock < cantidadActual;
                  const isSelected = tapaEfectiva === k;
                  const isDefault = tapaSugerida === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTapaKey(k)}
                      disabled={sinStock}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                        border: '1.5px solid ' + (isSelected ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'),
                        borderRadius: 'var(--lp-radius-sm)',
                        background: isSelected ? 'var(--lp-brand-50)' : (sinStock ? 'var(--lp-bg-sunken)' : 'var(--lp-bg-raised)'),
                        cursor: sinStock ? 'not-allowed' : 'pointer',
                        opacity: sinStock ? 0.5 : 1,
                        fontSize: 11, textAlign: 'left',
                        fontFamily: 'var(--lp-font-sans)',
                      }}
                      title={t.nombre + ' — stock: ' + stock}
                    >
                      <span style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: t.color || '#999',
                        border: '1.5px solid var(--lp-border-subtle)',
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--lp-text-primary)' }}>{t.color_nombre || t.nombre}</div>
                        <div style={{
                          fontSize: 11,
                          color: sinStock || insuficiente ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)',
                          fontFamily: 'var(--lp-font-mono)',
                          fontWeight: insuficiente ? 700 : 400,
                        }}>
                          {sinStock ? 'sin stock' : 'stock ' + stock}
                        </div>
                      </div>
                      {isDefault && (
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)',
                          padding: '1px 5px', borderRadius: 3,
                        }}>def</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <label style={S.fieldLabel}>
            {isTote ? `Litros a envasar (max ${maxUnidades.toFixed(0)})` : `Cantidad (max ${maxUnidades})`}
          </label>
          <input style={S.fieldInput} type="number" inputMode="decimal"
            min={isTote ? '0.1' : '1'}
            step={isTote ? '0.1' : '1'}
            max={maxUnidades}
            placeholder={isTote ? `Ej: ${Math.min(rest, 1000).toFixed(0)}` : `Ej: ${Math.min(maxUnidades, 30)}`}
            value={qty} onChange={e => setQty(e.target.value)} />

          {/* Z8: preview tipo "ticket" — resumen visual claro de lo que se
             va a crear antes de confirmar. Reemplaza la línea de texto densa. */}
          {qty && parseFloat(qty) > 0 && (
            <div style={S.ticket}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                Resumen del sublote
              </div>
              <div style={S.ticketRow}>
                <span style={S.ticketKey}>Presentación</span>
                <span style={S.ticketVal}>
                  {isTote ? `TOTE granel` : `${parseInt(qty)} × ${PRESENTACIONES_META.find(p => p.key === tipo)?.nombre || tipo}`}
                </span>
              </div>
              {!isTote && (
                <div style={S.ticketRow}>
                  <span style={S.ticketKey}>Marca / envase</span>
                  <span style={S.ticketVal}>{subcatActual?.nombre || marca || '—'}</span>
                </div>
              )}
              {usaTapa && tapaInfo && (
                <div style={S.ticketRow}>
                  <span style={S.ticketKey}>Tapa</span>
                  <span style={{ ...S.ticketVal, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: tapaInfo.color || '#999', border: '1px solid var(--lp-border-subtle)' }} />
                    {tapaInfo.color_nombre || tapaInfo.nombre}
                  </span>
                </div>
              )}
              <div style={S.ticketRow}>
                <span style={S.ticketKey}>Volumen</span>
                <span style={S.ticketVal}>{litTotal.toFixed(1)} L</span>
              </div>
              <div style={{ ...S.ticketRow, borderTop: '1px dashed var(--lp-border-default)', marginTop: 4, paddingTop: 6 }}>
                <span style={S.ticketKey}>Quedará en lote</span>
                <span style={{ ...S.ticketVal, color: (rest - litTotal) < 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)' }}>
                  {Math.max(0, rest - litTotal).toFixed(1)} L
                </span>
              </div>
              {usaTapa && tapaInfo && (
                <div style={S.ticketRow}>
                  <span style={S.ticketKey}>Tapas restantes</span>
                  <span style={{ ...S.ticketVal, color: stockTapaInsuf ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)' }}>
                    {Math.max(0, (tapaInfo.stock || 0) - parseInt(qty))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnSuccess} disabled={saving} onClick={handleSubmit}>
            {saving ? 'Envasando...' : isTote ? `Envasar tote ${qty || 0}L` : `Envasar ${qty || 0} ${tipo}(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* REENVASADO MODAL — re-envasar desde tote (puede tardar días)       */
/* Usa la state machine: transicionSublote(toteCod, 'reenvasarTote')  */
/* El backend crea sublotes hijo con esHijoDe=toteCod y decrementa    */
/* litrosRestante del TOTE. Si el TOTE se vacía pasa a tote_vaciado.  */
/* ═══════════════════════════════════════════════════════════════════ */
function ReenvasadoModal({ lote, envases, userName, onClose, onSuccess }) {
  const sublotes = lote.sublotes || [];
  /* TOTEs candidatos = sublotes con estado tote_activo y litrosRestante > 0.
     Compat: viejos sublotes sin estado se infieren por tipo==='tote' */
  const totes = sublotes.filter(s => {
    const esTote = s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1;
    if (!esTote) return false;
    if (s.consumido) return false;
    if (s.estado === 'tote_vaciado' || s.estado === 'cancelado') return false;
    /* Si tiene litrosRestante explícito úsalo; si no, calcula desde hijos */
    if (typeof s.litrosRestante === 'number') return s.litrosRestante > 0.5;
    return true;
  });
  const [selectedTote, setSelectedTote] = useState(totes[0]?.cod || '');
  const [tipo, setTipo] = useState('cubeta');
  const [marca, setMarca] = useState('');
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const marcas = envases?.marcas || [];
  const tote = totes.find(t => t.cod === selectedTote);
  /* litros disponibles: preferir el campo explícito del state machine,
     fallback al cálculo legacy por hijos */
  const litDisponible = (() => {
    if (!tote) return 0;
    if (typeof tote.litrosRestante === 'number') return tote.litrosRestante;
    const litUsed = sublotes
      .filter(s => (s.fromTote === selectedTote || s.esHijoDe === selectedTote) && !s.esMerma)
      .reduce((a, s) => a + (Number(s.lit) || 0), 0);
    return Math.max(0, (Number(tote.lit) || 0) - litUsed);
  })();

  const capMap = { cubeta: 19, galon: 3.785, litro: 1 };
  const litPorUnidad = capMap[tipo] || 19;
  const maxUnidades = Math.floor(litDisponible / litPorUnidad);
  const litTotal = (parseInt(qty) || 0) * litPorUnidad;

  const handleSubmit = async () => {
    const q = parseInt(qty);
    if (!q || q < 1) return setError('Cantidad debe ser >= 1');
    if (litTotal > litDisponible + 0.5) return setError(`Solo quedan ${litDisponible.toFixed(1)} L en tote`);
    if (!selectedTote) return setError('Selecciona un tote');
    setSaving(true);
    setError('');
    try {
      const letraBase = sublotes.length;
      const cod = (lote.codigo || lote.codigoLote || lote.id) + '-' + String.fromCharCode(65 + letraBase);
      const litExact = +litTotal.toFixed(2);
      /* Hijo de TOTE: nace ya en estado 'envasado' listo para recolección */
      const subloteHijo = {
        cod,
        claseSublote: 'envasado_final',
        estado: 'envasado',
        tipo,
        env: tipo === 'cubeta' ? '19L Estandar' : tipo === 'galon' ? '3.785L' : '1L',
        marca: marca || null,
        qty: q,
        lit: litExact,
        litrosOriginal: litExact,
        litrosRestante: 0,
        tapa: null,
        esMerma: false,
        fase: 2,
        esHijoDe: selectedTote,
        /* Backward compat con dashboards viejos */
        fromTote: selectedTote,
        qrPayload: buildQrUrl(cod),
        historial: [{
          accion: 'reenvasarTote',
          estadoNuevo: 'envasado',
          ts: new Date().toISOString(),
          usuario: userName || null,
          desdeTote: selectedTote,
        }],
      };
      /* Usar la state machine: el backend valida tote_activo + crea hijos + decrementa */
      await api.transicionSublote(selectedTote, 'reenvasarTote', {
        nuevosSublotes: [subloteHijo],
        litrosConsumidos: litExact,
      });
      onSuccess({
        sublotes: [subloteHijo],
        lote,
        isTote: false,
        q,
        tipo,
        litTotal: litExact,
        desdeTote: selectedTote,
      });
    } catch (err) {
      setError(err.message || 'Error al re-envasar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ ...S.modalHeader, borderBottom: '3px solid #993C1D' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Re-envasar desde tote</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--lp-text-tertiary)' }}>x</button>
        </div>
        <div style={S.modalBody}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ padding: 12, background: '#EDE9FE', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', fontFamily: 'var(--lp-font-mono)' }}>{lote.codigo || lote.codigoLote || lote.id}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: '#3C3489' }}>{lote.producto || lote.nombre}</div>
          </div>

          {totes.length > 1 && (
            <>
              <label style={S.fieldLabel}>Tote origen</label>
              <select style={S.fieldSelect} value={selectedTote} onChange={e => setSelectedTote(e.target.value)}>
                {totes.map(t => (
                  <option key={t.cod} value={t.cod}>{t.cod} — {t.lit}L</option>
                ))}
              </select>
            </>
          )}

          {tote && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-bg-sunken)', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
              Tote: <strong>{selectedTote}</strong> · Disponible: <strong>{litDisponible.toFixed(1)} L</strong> de {tote.lit}L
            </div>
          )}

          <label style={S.fieldLabel}>Presentacion retail</label>
          <select style={S.fieldSelect} value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="cubeta">Cubeta (19L)</option>
            <option value="galon">Galon (3.785L)</option>
            <option value="litro">Litro (1L)</option>
          </select>

          <label style={S.fieldLabel}>Marca (opcional)</label>
          {marcas.length > 0 ? (
            <select style={S.fieldSelect} value={marca} onChange={e => setMarca(e.target.value)}>
              <option value="">— Sin marca —</option>
              {marcas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input style={S.fieldInput} placeholder="Ej: Premium" value={marca} onChange={e => setMarca(e.target.value)} />
          )}

          <label style={S.fieldLabel}>Cantidad (max {maxUnidades})</label>
          <input style={S.fieldInput} type="number" inputMode="decimal" min="1" max={maxUnidades}
            placeholder={`Ej: ${Math.min(maxUnidades, 20)}`}
            value={qty} onChange={e => setQty(e.target.value)} />

          {qty && parseInt(qty) > 0 && (
            <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', padding: '8px 12px', background: 'var(--lp-bg-sunken)', borderRadius: 8, marginBottom: 8 }}>
              {parseInt(qty)} {tipo}(s) x {litPorUnidad}L = <strong>{litTotal.toFixed(1)} L</strong>
              {' · '}Quedaran en tote: <strong>{Math.max(0, litDisponible - litTotal).toFixed(1)} L</strong>
            </div>
          )}
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.btnPrimary, background: '#993C1D' }} disabled={saving} onClick={handleSubmit}>
            {saving ? 'Re-envasando...' : `Re-envasar ${qty || 0} ${tipo}(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* SUBLOTE QR PRINT MODAL                                             */
/* Aparece automáticamente al crear un sublote (envasado o re-envase).*/
/* Permite imprimir uno o varios tickets con el QR ya generado y      */
/* asignado al sublote — para pegarlo físicamente al envase.           */
/* ═══════════════════════════════════════════════════════════════════ */
function SubloteQRPrintModal({ payload, onClose }) {
  const { sublotes = [], lote, isTote, q, tipo, litTotal, desdeTote } = payload || {};
  const sublote = sublotes[0];
  const cantidadDefault = sublote ? (isTote ? 1 : Number(sublote.qty) || 1) : 1;
  const [copias, setCopias] = useState(cantidadDefault);
  const [formato, setFormato] = useState(isTote ? '80x50' : '50x40');

  if (!sublote) return null;

  const FMT = [
    { v: '50x40', label: '50×40 mm (rollo térmico)', wMm: 50, hMm: 40, qrMm: 22 },
    { v: '60x40', label: '60×40 mm (rollo térmico)', wMm: 60, hMm: 40, qrMm: 24 },
    { v: '80x50', label: '80×50 mm (rollo térmico)', wMm: 80, hMm: 50, qrMm: 32 },
    { v: '100x70', label: '100×70 mm (rollo grande)', wMm: 100, hMm: 70, qrMm: 42 },
    { v: 'A4-21', label: 'A4 · 21 etiquetas (3×7)', wMm: 70, hMm: 42.3, qrMm: 24, isSheet: true, cols: 3, rows: 7 },
    { v: 'A4-24', label: 'A4 · 24 etiquetas (3×8)', wMm: 70, hMm: 37, qrMm: 22, isSheet: true, cols: 3, rows: 8 },
  ];
  const fmt = FMT.find(f => f.v === formato) || FMT[0];

  const qrUrl = sublote.qrPayload || buildQrUrl(sublote.cod);
  /* QR generado LOCAL — sin depender de quickchart.io u otro servicio externo.
     Esto resuelve el bug de "QR no carga" y permite imprimir offline. */
  const qrUrlPreview = qrDataUrl(qrUrl, { scale: 8, margin: 2, ecLevel: 'M' });
  const qrUrlPrint = qrDataUrl(qrUrl, { scale: 10, margin: 2, ecLevel: 'M' });

  const producto = (lote?.producto || lote?.nombre || '').slice(0, 40);
  const fecha = new Date().toISOString().slice(0, 10);
  const presentacion = sublote.env || tipo || '';
  const marca = sublote.marca || '';

  const imprimir = () => {
    const n = Math.max(1, Math.min(999, parseInt(copias) || 1));
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) { alert('Habilita popups para imprimir'); return; }
    const prodSafe = producto.replace(/</g, '&lt;');
    const marcaSafe = marca.replace(/</g, '&lt;');
    const presSafe = presentacion.replace(/</g, '&lt;');

    let html;
    if (fmt.isSheet) {
      const total = fmt.cols * fmt.rows;
      let labels = '';
      for (let i = 0; i < n; i++) {
        labels += `<div class="cell">
          <img src="${qrUrlPrint}" />
          <div class="info">
            <div class="prod">${prodSafe}</div>
            <div class="pres">${presSafe}${marcaSafe ? ' · ' + marcaSafe : ''}</div>
            <div class="cod">${sublote.cod}</div>
            <div class="meta">${fecha} · ${i + 1}/${n}</div>
          </div>
        </div>`;
        if ((i + 1) % total === 0 && i + 1 < n) labels += '<div class="page-break"></div>';
      }
      html = `<!DOCTYPE html><html><head><title>QR ${sublote.cod} (${n})</title>
        <style>
          @page { size: A4; margin: 5mm; }
          body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
          .grid { display: grid; grid-template-columns: repeat(${fmt.cols}, 1fr); gap: 0; }
          .cell { width: ${fmt.wMm}mm; height: ${fmt.hMm}mm; border: 0.3mm dashed #ccc;
                  box-sizing: border-box; padding: 2mm; display: flex; align-items: center;
                  gap: 2mm; page-break-inside: avoid; }
          .cell img { width: ${fmt.qrMm}mm; height: ${fmt.qrMm}mm; }
          .info { flex: 1; min-width: 0; font-size: 7pt; line-height: 1.25; }
          .prod { font-weight: bold; font-size: 8pt; overflow: hidden;
                  text-overflow: ellipsis; white-space: nowrap; }
          .pres { font-size: 7pt; color: #444; }
          .cod { font-family: monospace; font-weight: bold; font-size: 7pt; margin-top: 1mm; }
          .meta { color: #666; font-size: 6pt; }
          .page-break { break-after: page; flex-basis: 100%; }
          @media print { .cell { border: none; } }
        </style></head><body>
        <div class="grid">${labels}</div>
        <script>setTimeout(() => window.print(), 400);</script>
        </body></html>`;
    } else {
      let labels = '';
      for (let i = 0; i < n; i++) {
        labels += `<div class="ticket">
          <img src="${qrUrlPrint}" />
          <div class="info">
            <div class="prod">${prodSafe}</div>
            <div class="pres">${presSafe}${marcaSafe ? ' · ' + marcaSafe : ''}</div>
            <div class="cod">${sublote.cod}</div>
            <div class="meta">${fecha}${n > 1 ? ' · ' + (i + 1) + '/' + n : ''}</div>
          </div>
        </div>`;
      }
      html = `<!DOCTYPE html><html><head><title>QR ${sublote.cod} (${n})</title>
        <style>
          @page { size: ${fmt.wMm}mm ${fmt.hMm}mm; margin: 0; }
          body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
          .ticket { width: ${fmt.wMm}mm; height: ${fmt.hMm}mm; box-sizing: border-box;
                    padding: 2mm; display: flex; align-items: center; gap: 2mm;
                    page-break-after: always; }
          .ticket:last-child { page-break-after: auto; }
          .ticket img { width: ${fmt.qrMm}mm; height: ${fmt.qrMm}mm; }
          .info { flex: 1; min-width: 0; line-height: 1.3; }
          .prod { font-weight: bold; font-size: 9pt; overflow: hidden;
                  text-overflow: ellipsis; white-space: nowrap; }
          .pres { font-size: 7pt; color: #444; margin: 1mm 0; }
          .cod { font-family: monospace; font-weight: bold; font-size: 8pt; }
          .meta { color: #666; font-size: 6pt; margin-top: 1mm; }
        </style></head><body>
        ${labels}
        <script>setTimeout(() => window.print(), 400);</script>
        </body></html>`;
    }
    w.document.write(html);
    w.document.close();
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ ...S.modalHeader, borderBottom: '3px solid var(--lp-success-500)' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>QR del sublote — imprimir</div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
              Pega este QR físicamente en cada envase para trazabilidad
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--lp-text-tertiary)' }} aria-label="Cerrar">×</button>
        </div>
        <div style={S.modalBody}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
            padding: 16, marginBottom: 16,
          }}>
            <img src={qrUrlPreview} alt={`QR ${sublote.cod}`}
              style={{ width: 180, height: 180, background: 'var(--lp-bg-raised)',
                       border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6 }} />
            <div style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 13, fontWeight: 700,
                          marginTop: 10, textAlign: 'center', wordBreak: 'break-all' }}>
              {sublote.cod}
            </div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4,
                          lineHeight: 1.5, textAlign: 'center' }}>
              {producto}<br/>
              {isTote
                ? <>TOTE granel · <strong>{litTotal?.toFixed(1)} L</strong></>
                : <>{q} × {presentacion} · <strong>{litTotal?.toFixed(1)} L</strong></>
              }
              {desdeTote && <><br/>↳ re-envasado desde tote {desdeTote}</>}
            </div>
          </div>

          <label style={S.fieldLabel}>Cantidad de tickets</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {[1, cantidadDefault, 10, 50].filter((n, i, a) => n > 0 && a.indexOf(n) === i).map(n => (
              <button key={n} type="button"
                style={{
                  padding: '5px 10px', fontSize: 11, fontWeight: 600,
                  borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: copias === n ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)',
                  color: copias === n ? '#fff' : 'var(--lp-text-secondary)',
                  fontFamily: 'var(--lp-font-sans)',
                }}
                onClick={() => setCopias(n)}>
                {n === cantidadDefault && !isTote ? `${n} (todos)` : n}
              </button>
            ))}
          </div>
          <input style={S.fieldInput} type="number" inputMode="decimal" min="1" max="999"
            value={copias}
            onChange={e => setCopias(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))} />

          <label style={S.fieldLabel}>Formato</label>
          <select style={S.fieldSelect} value={formato} onChange={e => setFormato(e.target.value)}>
            <optgroup label="Rollo térmico">
              {FMT.filter(f => !f.isSheet).map(f => <option key={f.v} value={f.v}>{f.label}</option>)}
            </optgroup>
            <optgroup label="Hoja A4">
              {FMT.filter(f => f.isSheet).map(f => <option key={f.v} value={f.v}>{f.label}</option>)}
            </optgroup>
          </select>

          <div style={{
            fontSize: 11, color: 'var(--lp-text-tertiary)', lineHeight: 1.6,
            padding: '8px 10px', background: 'var(--lp-info-50)', borderRadius: 'var(--lp-radius-sm)',
          }}>
            Al escanear cualquier ticket de este sublote, Luis (recolección) o Josué (Terán)
            pueden registrar las transiciones de estado correspondientes. El QR contiene la URL
            <code style={{ marginLeft: 4, fontFamily: 'var(--lp-font-mono)' }}>{qrUrl}</code>.
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Más tarde</button>
          <button style={S.btnPrimary} onClick={imprimir}>
            Imprimir {copias} ticket{copias > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* LOTE CARD                                                          */
/* ═══════════════════════════════════════════════════════════════════ */
function LoteCard({ lote, canEnvasar, canTransfer, isAdmin, onEnvasar, onCerrar, onTransferir, onReenvasar, onEnviarRecolectar, onQR, onEliminarPrueba, onIrQC, onAnularSublote, autoExpand }) {
  const [showSublotes, setShowSublotes] = useState(!!autoExpand);
  const est = ESTADO_MAP[lote.estado] || { label: lote.estado, bg: 'var(--lp-bg-sunken)', fg: 'var(--lp-text-tertiary)' };
  const total = Number(lote.litrosTotal) || 0;
  const used = litUsed(lote);
  const rest = Math.max(0, total - used);
  const pct = total > 0 ? (used / total) * 100 : 0;
  const envSt = envEstado(lote);
  const sublotes = lote.sublotes || [];
  const enFabrica = sublotes.filter(s => s.ub === 'fabrica' && !s.esMerma);
  const hasTotes = sublotes.some(s => s.tipo === 'tote' || s.fase === 1);
  const totesSinConsumir = sublotes.filter(s => (s.tipo === 'tote' || s.fase === 1) && !s.consumido);

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' }}>
            {lote.codigo || lote.codigoLote || lote.id}
          </span>
          <span style={B(est.bg, est.fg)}>{est.label}</span>
          {hasTotes && <span style={B('#EDE9FE', '#7C3AED')}>2 fases</span>}
          {lote.esPrueba && <PruebaBadge size="sm" />}
        </div>
        <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>{(lote.fecha || '').slice(0, 10)}</span>
      </div>

      <div style={S.cardTitle}>{lote.producto || lote.nombre}</div>
      <div style={S.cardMeta}>
        {lote.cantidad} cubetas · {total.toFixed(0)} L totales
        {lote.ordenCodigo && ` · ${lote.ordenCodigo}`}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <>
          <div style={S.progressWrap}>
            <div style={S.progressBar(pct)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
            <span>{used.toFixed(1)} L envasados ({Math.round(pct)}%)</span>
            <span>{rest.toFixed(1)} L restantes</span>
          </div>
        </>
      )}

      {/* Sublotes toggle */}
      {sublotes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setShowSublotes(!showSublotes)}
            style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--lp-brand-600)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
          >
            {showSublotes ? '▾' : '▸'} {sublotes.length} sublote(s)
          </button>
          {showSublotes && (
            <div style={{ marginTop: 6 }}>
              {sublotes.map((s, i) => {
                const isTote = s.tipo === 'tote' || s.fase === 1 || s.claseSublote === 'tote';
                const desdeTote = s.fromTote || s.esHijoDe;
                /* Para TOTEs: calcular litros ya reenvasados en hijos */
                const hijosDelTote = isTote ? sublotes.filter(h => h.fromTote === s.cod || h.esHijoDe === s.cod) : [];
                const litHijos = hijosDelTote.reduce((a, h) => a + (Number(h.lit) || 0), 0);
                const litRestTote = isTote ? Math.max(0, (Number(s.lit) || 0) - litHijos) : 0;
                return (
                <div key={i} style={{
                  ...S.sublote,
                  background: s.esMerma ? 'var(--lp-danger-50)' : isTote ? '#EDE9FE' : s.ub === 'teran' ? 'var(--lp-success-50)' : 'var(--lp-bg-sunken)',
                  marginLeft: desdeTote ? 16 : 0,
                  borderLeft: desdeTote ? '3px solid #1E40AF' : undefined,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {desdeTote && <span style={{ fontSize: 11, color: '#1E40AF' }}>↳</span>}
                    <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 600, fontSize: 11 }}>{s.cod}</span>
                    {s.esMerma && <span style={B('var(--lp-danger-100)', 'var(--lp-danger-600)')}>MERMA</span>}
                    {isTote && <span style={B('#EDE9FE', '#7C3AED')}>Granel</span>}
                    {s.fase === 2 && desdeTote && <span style={B('#DBEAFE', '#1E40AF')}>Retail</span>}
                    {s.consumido && <span style={B('#D1FAE5', '#065F46')}>Consumido</span>}
                  </div>
                  <div style={{ fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{isTote ? 'Tote' : `${s.qty} ${s.tipo}`}</span>
                      <span style={{ color: 'var(--lp-text-tertiary)' }}>{s.lit}L</span>
                      {s.marca && <span style={{ color: 'var(--lp-text-tertiary)' }}>{s.marca}</span>}
                      <span style={B(
                        s.ub === 'teran' ? 'var(--lp-success-100)' : 'var(--lp-brand-100)',
                        s.ub === 'teran' ? 'var(--lp-success-600)' : 'var(--lp-brand-700)',
                      )}>{s.ub === 'teran' ? 'Teran' : 'Fabrica'}</span>
                    </div>
                    {/* Trazabilidad: TOTE muestra cuánto se ha reenvasado */}
                    {isTote && hijosDelTote.length > 0 && (
                      <div style={{ color: 'var(--lp-text-tertiary)', fontSize: 10, marginTop: 2, textAlign: 'right' }}>
                        {litHijos.toFixed(0)}L reenvasado → {litRestTote.toFixed(0)}L pendiente en tote
                      </div>
                    )}
                    {/* Trazabilidad: hijo muestra de qué TOTE salió */}
                    {desdeTote && (
                      <div style={{ color: '#1E40AF', fontSize: 10, marginTop: 2, textAlign: 'right' }}>
                        ↳ reenvasado desde tote {desdeTote}
                      </div>
                    )}
                    {/* Fecha de creación */}
                    {s.fecha && (
                      <div style={{ color: 'var(--lp-text-tertiary)', fontSize: 10, marginTop: 1, textAlign: 'right' }}>
                        {s.fecha.slice(0, 10)} {s.fecha.slice(11, 16)} · {s.usuario || ''}
                      </div>
                    )}
                    {/* Sprint G-1: botón Anular para sublotes mal capturados.
                       Solo disponible si NO está en Terán, NO es merma, NO está
                       cancelado y NO tiene hijos (no se puede anular un TOTE
                       con retail ya envasado). Permitido a quien pueda envasar. */}
                    {onAnularSublote && canEnvasar && !s.esMerma && !s.cancelado
                      && s.ub !== 'teran' && hijosDelTote.length === 0 && (
                      <div style={{ marginTop: 4, textAlign: 'right' }}>
                        <button
                          onClick={() => onAnularSublote(lote, s)}
                          style={{
                            padding: '3px 8px', fontSize: 10, fontWeight: 600,
                            background: 'transparent', color: 'var(--lp-danger-600)',
                            border: '1px solid var(--lp-danger-300, rgba(220,38,38,0.3))',
                            borderRadius: 4, cursor: 'pointer',
                          }}
                          title="Anular sublote (reponer envase/tapa al stock)"
                        >Anular</button>
                      </div>
                    )}
                    {s.cancelado && (
                      <div style={{ color: 'var(--lp-danger-600)', fontSize: 10, marginTop: 2, textAlign: 'right', fontStyle: 'italic' }}>
                        ✕ Anulado{s.motivoAnulacion ? ` — ${s.motivoAnulacion}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={S.cardActions}>
        <button
          style={{ ...S.btnPrimary, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', border: '1.5px solid var(--lp-border-subtle)' }}
          onClick={() => onQR && onQR(lote)}
          title="Generar QR del lote"
        >
          QR
        </button>
        {/* FIX jun 2026 (decisión owner: QC opcional): permitir envasar desde
           'producido' directamente. El botón principal de envasado se muestra,
           y SI el lote está en 'producido' también ofrecemos un botón secundario
           "Hacer QC" para quien prefiera completarlo. qc_hold sigue bloqueando
           porque significa que algo falló y debe resolverse antes. */}
        {canEnvasar && lote.estado === 'qc_hold' && (
          <button
            style={{ ...S.btnPrimary, background: 'var(--lp-danger-600)' }}
            onClick={() => onIrQC && onIrQC(lote)}
            title="QC retenido — reabrir producción o reaprobar"
          >
            ✕ QC retenido
          </button>
        )}
        {canEnvasar && envSt !== 'envasado' && rest > 0 && lote.estado !== 'qc_hold' && (
          <button style={S.btnPrimary} onClick={() => onEnvasar(lote)}>
            Envasar
          </button>
        )}
        {/* FIX jun 2026 (O3): "Enviar a recolectar" como acción primaria
            cuando todo el lote está envasado y hay sublotes listos. Notifica
            push a Luis. */}
        {canTransfer && lote.estado === 'envasado' && (lote.sublotes || []).some(s => s.estado === 'envasado' && !s.esMerma) && onEnviarRecolectar && (
          <button
            style={{ ...S.btnPrimary, background: 'var(--lp-success-600)' }}
            onClick={() => onEnviarRecolectar(lote)}
            title="Marcar listos para recolectar — Luis recibe notificación"
          >
            🚚 Enviar a recolectar
          </button>
        )}
        {canEnvasar && lote.estado === 'producido' && (
          <button
            style={{ ...S.btnPrimary, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', border: '1.5px solid var(--lp-border-subtle)' }}
            onClick={() => onIrQC && onIrQC(lote)}
            title="QC es opcional. Hacer QC formal antes de envasar (recomendado para auditoría)."
          >
            QC (opcional)
          </button>
        )}
        {canEnvasar && envSt === 'parcial' && (
          <button style={S.btnWarn} onClick={() => onCerrar(lote)}>
            Cerrar (merma)
          </button>
        )}
        {canTransfer && enFabrica.length > 0 && (
          <button style={S.btnSuccess} onClick={() => onTransferir(lote)}>
            Transferir a Teran
          </button>
        )}
        {canEnvasar && totesSinConsumir.length > 0 && (lote.estado === 'en_almacen' || lote.estado === 'envasado') && (
          <button style={{ ...S.btnPrimary, background: '#993C1D' }} onClick={() => onReenvasar(lote)}>
            Re-envasar tote
          </button>
        )}
        {/* Solo admin puede eliminar lotes de PRUEBA y solo si lo son */}
        {isAdmin && lote.esPrueba && onEliminarPrueba && (
          <button
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: 'var(--lp-danger-600)', color: '#fff',
              fontFamily: 'var(--lp-font-sans)',
            }}
            onClick={() => onEliminarPrueba(lote)}
            title="Eliminar permanentemente este lote de prueba"
          >
            🗑 Eliminar prueba
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                          */
/* ═══════════════════════════════════════════════════════════════════ */
export default function StockFabricaPage() {
  const { user, can } = useAuth();
  const [confirm, ConfirmEl] = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightLote = searchParams.get('lote') || '';
  const userName = user?.nombre || '?';
  const rol = user?.rol || '';
  const [activeTab, setActiveTab] = useState('enFabrica');
  const [searchQ, setSearchQ] = useState(highlightLote);
  const [toastMsg, setToastMsg] = useState('');
  const [envasadoModal, setEnvasadoModal] = useState(null);
  const [reenvasadoModal, setReenvasadoModal] = useState(null);
  const [qrLote, setQrLote] = useState(null);
  /* Payload de impresión QR del sublote recién creado — se abre automáticamente
     después de un envasado/re-envasado exitoso para que el operador imprima
     y pegue el QR físicamente en el envase. */
  const [printSubloteQR, setPrintSubloteQR] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 5000);
  }, []);

  const { data: trazData, loading, reload: reloadTraz } = useApiData(() => api.getTrazabilidad(), [], 5000);
  const { data: envData } = useApiData(() => api.getEnvases(), null, 30000);

  /* FIX jun 2026 (K1): cambios de estado de lote (envasado, recogido) deben
     reflejarse al instante para todos los roles que tienen esta pantalla
     abierta (Enrique, Josué, admin). */
  useRealtimeSync({
    onTrazabilidad: () => reloadTraz(),
  });

  const envases = useMemo(() => envData?.data || envData || null, [envData]);

  const allLotes = useMemo(() => {
    const arr = trazData?.data || [];
    return (Array.isArray(arr) ? arr : [])
      .filter(l => l && !l.eliminado)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [trazData]);

  /* Lotes en fábrica REALES (sin pruebas, sin cancelados — vista principal) */
  const enFabricaActivos = useMemo(() =>
    allLotes.filter(l => {
      const e = l.estado;
      /* en_proceso = estado legacy/compat, se trata como en_envasado */
      const enFlujo = e === 'producido' || e === 'qc_aprobado' || e === 'en_envasado' || e === 'envasado' || e === 'en_proceso';
      return enFlujo && !l.esPrueba && !l.cancelado && e !== 'qc_hold';
    }),
    [allLotes]
  );

  /* Lotes en fábrica de PRUEBA */
  const enFabricaPrueba = useMemo(() =>
    allLotes.filter(l => {
      const e = l.estado;
      const enFlujo = e === 'producido' || e === 'qc_aprobado' || e === 'en_envasado' || e === 'envasado';
      return enFlujo && l.esPrueba && !l.cancelado;
    }),
    [allLotes]
  );

  /* Lotes RECHAZADOS o cancelados */
  const enFabricaRechazados = useMemo(() =>
    allLotes.filter(l => l.cancelado || l.estado === 'qc_hold' || l.estado === 'rechazado'),
    [allLotes]
  );

  /* Compat: enFabrica sigue refiriéndose a la lista activa para el resto del código */
  const enFabrica = enFabricaActivos;

  /* Lotes transferidos — también separamos prueba */
  const transferidosActivos = useMemo(() =>
    allLotes.filter(l => ['en_recoleccion', 'en_camino', 'en_almacen', 'reenvasado'].includes(l.estado) && !l.esPrueba),
    [allLotes]
  );
  const transferidosPrueba = useMemo(() =>
    allLotes.filter(l => ['en_recoleccion', 'en_camino', 'en_almacen', 'reenvasado'].includes(l.estado) && l.esPrueba),
    [allLotes]
  );
  const transferidos = transferidosActivos;

  /* Filtered según tab activo */
  const filtered = useMemo(() => {
    let list;
    if (activeTab === 'enFabrica')        list = enFabricaActivos;
    else if (activeTab === 'transferidos') list = transferidosActivos;
    else if (activeTab === 'pruebas')      list = [...enFabricaPrueba, ...transferidosPrueba];
    else if (activeTab === 'rechazados')   list = enFabricaRechazados;
    else                                    list = enFabricaActivos;
    if (!searchQ) return list;
    const q = searchQ.toLowerCase();
    return list.filter(l =>
      (l.producto || l.nombre || '').toLowerCase().includes(q) ||
      (l.codigo || l.codigoLote || '').toLowerCase().includes(q)
    );
  }, [activeTab, enFabricaActivos, transferidosActivos, enFabricaPrueba, transferidosPrueba, enFabricaRechazados, searchQ]);

  /* KPIs */
  const kpis = useMemo(() => ({
    sinEnvasar: enFabrica.filter(l => envEstado(l) === 'listo').length,
    parcial: enFabrica.filter(l => envEstado(l) === 'parcial').length,
    envasados: enFabrica.filter(l => envEstado(l) === 'envasado').length,
    total: enFabrica.length,
  }), [enFabrica]);

  const canEnvasar = can('envasado') || can('produccion');
  const canTransfer = rol === 'admin' || rol === 'almacen';

  const handleCerrar = useCallback(async (lote) => {
    const ok = await confirm(`¿Cerrar lote ${lote.codigo}? Los litros restantes se registrarán como merma.`, { danger: true, confirmText: 'Cerrar lote' });
    if (!ok) return;
    try {
      await api.cerrarLote(lote.id);
      reloadTraz();
      showToast(`Lote ${lote.codigo} cerrado con merma`);
    } catch (err) {
      showToast('Error: ' + (err.message || 'No se pudo cerrar'));
    }
  }, [reloadTraz, showToast, confirm]);

  const handleTransferir = useCallback(async (lote) => {
    const enFab = (lote.sublotes || []).filter(s => s.ub === 'fabrica' && !s.esMerma);
    if (enFab.length === 0) return showToast('No hay sublotes en fábrica para transferir');
    const ok = await confirm(`¿Transferir ${enFab.length} sublote(s) de ${lote.codigo} a Almacén Terán?`, { confirmText: 'Transferir' });
    if (!ok) return;
    try {
      await api.transferirSublotes(lote.id, enFab.map(s => s.cod));
      reloadTraz();
      showToast(`${enFab.length} sublote(s) transferidos a Terán`);
    } catch (err) {
      showToast('Error: ' + (err.message || 'No se pudo transferir'));
    }
  }, [reloadTraz, showToast, confirm]);

  /* FIX jun 2026 (Sprint O - O3): "Enviar a recolectar" como acción primaria
     cuando el lote está envasado. Marca TODOS los sublotes envasados como
     en_recoleccion vía /api/sublotes/scan-bulk con acción marcarRecoleccion.
     Esto dispara push a Luis (NOTIF_TARGETS['sublote.marcarRecoleccion']).
     Antes Josué tenía que ir sublote por sublote desde otra pantalla. */
  const handleEnviarRecolectar = useCallback(async (lote) => {
    const envasados = (lote.sublotes || []).filter(s => s.estado === 'envasado' && !s.esMerma);
    if (envasados.length === 0) return showToast('No hay sublotes envasados para enviar a recolección');
    const ok = await confirm(
      `Marcar ${envasados.length} sublote(s) de ${lote.codigoLote || lote.codigo} como "listos para recolectar". Luis recibirá notificación inmediata.`,
      { confirmText: 'Enviar a recolectar', title: 'Enviar a recolectar' }
    );
    if (!ok) return;
    try {
      await api.post('/api/sublotes/scan-bulk', { loteId: lote.id, accion: 'marcarRecoleccion' });
      reloadTraz();
      showToast(`${envasados.length} sublote(s) listos — notificado a Luis`);
    } catch (err) {
      showToast('Error: ' + (err.message || 'No se pudo enviar a recolectar'));
    }
  }, [reloadTraz, showToast, confirm]);

  /* Sprint G-1: anular sublote mal capturado. El backend repone envase/tapa
     al stock y marca el sublote como cancelado:true para auditoría (no se
     borra para preservar trazabilidad). */
  const handleAnularSublote = useCallback(async (lote, sublote) => {
    const motivo = await confirm(
      `Vas a anular el sublote ${sublote.cod} (${sublote.qty} ${sublote.tipo} ${sublote.marca || ''}). Los envases/tapas regresan al stock. Indica el motivo para auditoría.`,
      {
        title: 'Anular sublote',
        confirmText: 'Anular',
        danger: true,
        prompt: {
          label: 'Motivo (ej: marca equivocada, tapa equivocada)',
          placeholder: 'Motivo de la anulación',
          required: true, minLength: 5, maxLength: 200, rows: 2,
        },
      }
    );
    if (!motivo) return;
    try {
      await api.transicionSublote(sublote.cod, 'cancelarSublote', { motivo });
      reloadTraz();
      showToast(`Sublote ${sublote.cod} anulado`);
    } catch (err) {
      showToast('Error: ' + (err?.data?.error || err.message || 'No se pudo anular'));
    }
  }, [reloadTraz, showToast, confirm]);

  const handleEliminarPrueba = useCallback(async (lote) => {
    const ok = await confirm(`¿Eliminar permanentemente el lote de prueba ${lote.codigo || lote.codigoLote}?`, { danger: true, confirmText: 'Eliminar' });
    if (!ok) return;
    try {
      await api.eliminarLotePrueba(lote.codigoLote || lote.codigo);
      reloadTraz();
      showToast(`Lote de prueba ${lote.codigo || lote.codigoLote} eliminado`);
    } catch (err) {
      showToast('Error: ' + (err.message || 'No se pudo eliminar'));
    }
  }, [reloadTraz, showToast, confirm]);

  if (loading) {
    return (
      <>
        <TopBar title="Stock Fábrica" />
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Stock Fábrica" />
      <div style={S.wrap}>
        {/* Tabs */}
        <PageTabs
          tabs={[
            { id: 'enFabrica', label: `En Fábrica (${enFabricaActivos.length})`, style: (a) => S.tab(a) },
            { id: 'transferidos', label: `Transferidos (${transferidosActivos.length})`, style: (a) => S.tab(a) },
            ...((enFabricaPrueba.length + transferidosPrueba.length) > 0
              ? [{ id: 'pruebas', label: `🧪 Pruebas (${enFabricaPrueba.length + transferidosPrueba.length})`, style: (a) => S.tab(a) }]
              : []),
            ...(enFabricaRechazados.length > 0
              ? [{ id: 'rechazados', label: `✕ Rechazados (${enFabricaRechazados.length})`, style: (a) => S.tab(a) }]
              : []),
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          style={S.tabs}
        />

        {/* KPIs */}
        {activeTab === 'enFabrica' && (
          <div style={S.kpiGrid}>
            <div style={S.kpi('var(--lp-brand-600)')}>
              <div style={S.kpiLabel}>Sin Envasar</div>
              <div style={S.kpiValue}>{kpis.sinEnvasar}</div>
            </div>
            <div style={S.kpi('var(--lp-warning-600)')}>
              <div style={S.kpiLabel}>Parcial</div>
              <div style={S.kpiValue}>{kpis.parcial}</div>
            </div>
            <div style={S.kpi('var(--lp-success-600)')}>
              <div style={S.kpiLabel}>Envasados</div>
              <div style={S.kpiValue}>{kpis.envasados}</div>
            </div>
            <div style={S.kpi('var(--lp-text-tertiary)')}>
              <div style={S.kpiLabel}>Total</div>
              <div style={S.kpiValue}>{kpis.total}</div>
            </div>
          </div>
        )}

        {/* Search */}
        <div style={S.toolbar}>
          <input type="text" style={S.search} placeholder="Buscar lote..."
            value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>

        {/* Lotes */}
        {filtered.length === 0 ? (
          <div style={{ ...S.empty, padding: '60px 20px' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--lp-text-disabled)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>
              {searchQ ? 'Sin resultados' : activeTab === 'enFabrica' ? 'Sin lotes en fabrica' : 'Sin lotes transferidos'}
            </div>
          </div>
        ) : (
          filtered.map(lote => (
            <LoteCard
              key={lote.id}
              lote={lote}
              canEnvasar={canEnvasar}
              canTransfer={canTransfer}
              isAdmin={rol === 'admin'}
              autoExpand={!!highlightLote && (lote.codigo === highlightLote || lote.codigoLote === highlightLote || lote.id === highlightLote)}
              onEnvasar={setEnvasadoModal}
              onCerrar={handleCerrar}
              onTransferir={handleTransferir}
              onEnviarRecolectar={handleEnviarRecolectar}
              onReenvasar={setReenvasadoModal}
              onQR={setQrLote}
              onEliminarPrueba={handleEliminarPrueba}
              onAnularSublote={handleAnularSublote}
              onIrQC={() => window.location.assign('/produccion?tab=calidad')}
            />
          ))
        )}
      </div>

      {/* Envasado Modal — al éxito cierra y abre el QR print modal del sublote */}
      {envasadoModal && (
        <EnvasadoModal
          lote={envasadoModal}
          envases={envases}
          userName={userName}
          onClose={() => setEnvasadoModal(null)}
          onSuccess={(payload) => {
            setEnvasadoModal(null);
            reloadTraz();
            const s = payload?.sublotes?.[0];
            const msg = payload?.isTote
              ? `Envasado granel: tote ${payload.litTotal?.toFixed(1)}L de ${payload.lote?.producto || payload.lote?.nombre}`
              : `Envasado: ${payload?.q} ${payload?.tipo}(s) de ${payload?.lote?.producto || payload?.lote?.nombre}`;
            showToast(msg);
            /* Abre print modal solo si tenemos sublote con qrPayload */
            if (s?.qrPayload || s?.cod) setPrintSubloteQR(payload);
          }}
        />
      )}

      {/* Reenvasado Modal — usa state machine transicionSublote(reenvasarTote) */}
      {reenvasadoModal && (
        <ReenvasadoModal
          lote={reenvasadoModal}
          envases={envases}
          userName={userName}
          onClose={() => setReenvasadoModal(null)}
          onSuccess={(payload) => {
            setReenvasadoModal(null);
            reloadTraz();
            const s = payload?.sublotes?.[0];
            const msg = `Re-envasado: ${payload?.q} ${payload?.tipo}(s) desde tote ${payload?.desdeTote}`;
            showToast(msg);
            if (s?.qrPayload || s?.cod) setPrintSubloteQR(payload);
          }}
        />
      )}

      {/* QR de LOTE (legacy, vista completa del lote) */}
      {qrLote && (
        <QRModal lote={qrLote} onClose={() => setQrLote(null)} />
      )}

      {/* QR del SUBLOTE recién creado — para imprimir y pegar al envase */}
      {printSubloteQR && (
        <SubloteQRPrintModal
          payload={printSubloteQR}
          onClose={() => setPrintSubloteQR(null)}
        />
      )}

      {/* Toast */}
      {toastMsg && <div style={S.toast}><span style={{ marginRight: 8 }}>OK</span>{toastMsg}</div>}
      {ConfirmEl}
    </>
  );
}
