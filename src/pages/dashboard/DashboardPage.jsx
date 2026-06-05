import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import HelpHint from '../../components/HelpHint';
import MisLotesPipeline from './MisLotesPipeline';

/* ════════════════════════════════════════════════════════════════════
   Reskin "Claude Design" (verde) — Inicio / Dashboard
   Refs: ERP Escritorio.html (SCREENS.inicio) · ERP Móvil.html (S.inicio)
   · Inicio Resumen.html. Escritorio = saludo + KPIs g4 + "Requiere tu
   atención" g3 (cards borde-left de color). Móvil = secciones apiladas:
   "Requiere tu atención" (card hero) + "Pendientes" (lista lrow) +
   "Tu día" (g2 KPIs). Tokens SOLO var(--lp-*). Sin emojis (SVG line).
   KPIs/montos en var(--lp-font-mono). Touch ≥44px. Reskin VISUAL: toda
   la lógica por rol, endpoints, realtime y drill-down se conserva 1:1.
   ════════════════════════════════════════════════════════════════════ */

/* Paleta de acentos — solo tokens LP del tema verde. El mockup usa
   info(azul)/amber/danger/purple; mapeamos al set existente. */
const ACC = {
  brand:   'var(--lp-brand-600)',
  info:    'var(--lp-info-600)',
  amber:   'var(--lp-warning-600)',
  amberHi: 'var(--lp-warning-700)',
  crit:    'var(--lp-danger-600)',
  critHi:  'var(--lp-danger-700)',
  ok:      'var(--lp-success-600)',
  okHi:    'var(--lp-success-700)',
  mut:     'var(--lp-border-strong)',
};
const tint = (c) => `color-mix(in srgb, ${c} 14%, transparent)`;

const S = {
  wrap: (isDesktop) => ({ padding: isDesktop ? '24px 26px 48px' : '16px 18px 96px' }),

  /* Saludo */
  greeting: { marginBottom: 18 },
  greetH: (isDesktop) => ({
    fontSize: isDesktop ? 23 : 21, fontWeight: 600, letterSpacing: '-.02em',
    color: 'var(--lp-text-primary)', lineHeight: 1.15,
  }),
  greetSub: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3 },

  /* Sección + etiqueta */
  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 12, fontWeight: 600, color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 11px 2px',
  },

  /* Grids de KPI: g4 ancho en escritorio, g2 apilado en móvil */
  grid: (isDesktop) => ({
    display: 'grid',
    gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(220px, 1fr))' : '1fr 1fr',
    gap: isDesktop ? 12 : 10,
  }),

  /* KPI card (estilo .card .kpi del mockup) */
  kpi: (accent, clickable, isDesktop) => ({
    background: 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius)',
    border: '1px solid var(--lp-border-subtle)',
    padding: isDesktop ? '15px 16px' : '14px 15px',
    cursor: clickable ? 'pointer' : 'default',
    transition: 'transform .12s, box-shadow .12s, border-color .12s',
    fontFamily: 'var(--lp-font-sans)',
    textAlign: 'left', width: '100%', minHeight: 44,
    display: 'flex', flexDirection: 'column', gap: 4,
  }),
  kpiLabel: {
    fontSize: 11, fontWeight: 600, color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '.04em',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  kpiDot: (c) => ({ width: 7, height: 7, borderRadius: 999, background: c, flexShrink: 0, display: 'inline-block' }),
  kpiValue: {
    fontSize: 22, fontWeight: 700, marginTop: 2,
    color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)',
    lineHeight: 1.1, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
  },
  kpiSub: { fontSize: 11.5, color: 'var(--lp-text-secondary)', marginTop: 2, lineHeight: 1.3 },
  trend: (positivo) => ({
    fontSize: 12, fontWeight: 700,
    color: positivo ? 'var(--lp-success-700)' : 'var(--lp-danger-700)',
    fontFamily: 'var(--lp-font-mono)',
  }),

  /* ── Requiere tu atención (escritorio: g3 cards borde-left) ── */
  atnGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12,
  },
  atnCard: (accent) => ({
    background: 'var(--lp-bg-raised)',
    border: '1px solid var(--lp-border-subtle)',
    borderLeft: `3px solid ${accent}`,
    borderRadius: 'var(--lp-radius)',
    padding: '14px 16px',
    cursor: 'pointer', width: '100%', textAlign: 'left',
    fontFamily: 'var(--lp-font-sans)',
    transition: 'transform .12s, box-shadow .12s',
    display: 'flex', flexDirection: 'column', gap: 4, minHeight: 44,
  }),
  atnHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  atnTitle: { fontSize: 14, fontWeight: 600, color: 'var(--lp-text-primary)' },
  atnDesc: { fontSize: 12, color: 'var(--lp-text-secondary)', lineHeight: 1.45 },
  atnItems: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 2, fontFamily: 'var(--lp-font-mono)' },
  atnBadge: (c) => ({
    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
    background: tint(c), color: c, fontFamily: 'var(--lp-font-mono)', flexShrink: 0,
  }),

  /* ── Requiere tu atención (móvil: card hero del más prioritario) ── */
  atnHero: (accent) => ({
    background: 'var(--lp-bg-raised)',
    border: '1px solid var(--lp-border-subtle)',
    borderLeft: `3px solid ${accent}`,
    borderRadius: 'var(--lp-radius-lg)',
    padding: '15px 16px',
    cursor: 'pointer', width: '100%', textAlign: 'left',
    fontFamily: 'var(--lp-font-sans)', display: 'flex', flexDirection: 'column', gap: 4,
  }),
  atnHeroTitle: { fontSize: 16, fontWeight: 600, color: 'var(--lp-text-primary)' },
  atnHeroDesc: { fontSize: 12.5, color: 'var(--lp-text-secondary)', lineHeight: 1.4 },
  atnHeroBtn: {
    marginTop: 12, height: 46, width: '100%',
    borderRadius: 12, border: 'none', cursor: 'pointer',
    background: 'var(--lp-brand-600)', color: '#fff',
    fontFamily: 'var(--lp-font-sans)', fontSize: 14, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },

  /* ── Pendientes (móvil: lista lrow dentro de una card) ── */
  listCard: {
    background: 'var(--lp-bg-raised)',
    border: '1px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-lg)',
    padding: '2px 15px',
  },
  lrow: (last) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '13px 0',
    borderBottom: last ? 'none' : '1px solid var(--lp-border-subtle)',
    background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', border: 'none',
    minHeight: 44,
  }),
  lrowIc: (c) => ({
    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
    background: tint(c), color: c,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }),
  lrowNm: { flex: 1, minWidth: 0 },
  lrowT: { fontSize: 14, fontWeight: 500, color: 'var(--lp-text-primary)' },
  lrowS: {
    fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  lrowCt: (c) => ({ fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 14, color: c }),

  /* ── Tira de foco del rol ── */
  focoStrip: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 13px',
    background: 'var(--lp-bg-sunken)',
    border: '1px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    fontSize: 13, color: 'var(--lp-text-secondary)',
    marginBottom: 16, lineHeight: 1.4,
    cursor: 'pointer', textAlign: 'left', width: '100%',
    fontFamily: 'var(--lp-font-sans)',
  },
  focoIcon: {
    width: 30, height: 30, borderRadius: 9,
    background: 'var(--lp-brand-50)', color: 'var(--lp-brand-600)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  focoTxt: { flex: 1, minWidth: 0 },
  focoStrong: { color: 'var(--lp-text-primary)', fontWeight: 600 },

  /* === Top productos del mes === */
  panel: {
    background: 'var(--lp-bg-raised)',
    border: '1px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    padding: '14px 16px',
  },
  topRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', fontSize: 12.5 },
  topRank: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)',
    fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, fontFamily: 'var(--lp-font-mono)',
  },
  topName: {
    flex: 1, fontWeight: 500, color: 'var(--lp-text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  topBarWrap: {
    width: 140, height: 6, background: 'var(--lp-bg-sunken)',
    borderRadius: 3, overflow: 'hidden', flexShrink: 0,
  },
  topBar: (pct, color) => ({
    height: '100%', width: Math.max(2, pct) + '%', background: color,
    borderRadius: 3, transition: 'width .3s',
  }),
  topVal: {
    fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 12.5,
    color: 'var(--lp-text-primary)', minWidth: 50, textAlign: 'right',
  },
  topSub: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 },

  /* === Sparkline 12 meses === */
  sparkRow: { display: 'flex', alignItems: 'flex-end', gap: 5, height: 110, marginTop: 4 },
  sparkBar: (pct, isCurrent) => ({
    flex: 1, height: Math.max(4, pct) + '%',
    background: isCurrent ? 'var(--lp-brand-600)' : 'color-mix(in srgb, var(--lp-brand-600) 30%, var(--lp-bg-sunken))',
    borderRadius: '5px 5px 0 0',
    transition: 'opacity .15s', cursor: 'pointer',
  }),
  sparkMonths: { display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--lp-font-mono)' },
  sparkMonth: (isCurrent) => ({
    flex: 1, textAlign: 'center', fontSize: 11,
    color: isCurrent ? 'var(--lp-brand-600)' : 'var(--lp-text-tertiary)',
    fontWeight: isCurrent ? 700 : 500,
  }),
  trendStats: {
    display: 'flex', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 12,
    borderTop: '1px solid var(--lp-border-subtle)',
    fontSize: 11.5, gap: 12, flexWrap: 'wrap',
  },
  trendStat: { color: 'var(--lp-text-tertiary)' },
  trendStatVal: { color: 'var(--lp-text-primary)', fontWeight: 700, fontFamily: 'var(--lp-font-mono)' },

  /* Estados */
  loading: { textAlign: 'center', padding: '40px 0', color: 'var(--lp-text-tertiary)', fontSize: 13 },
  err: {
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    padding: 12, borderRadius: 'var(--lp-radius-sm)', fontSize: 13, marginBottom: 12,
  },
  empty: {
    background: 'var(--lp-bg-raised)',
    border: '1px dashed var(--lp-border-default)',
    borderRadius: 'var(--lp-radius)',
    padding: 20, textAlign: 'center', fontSize: 13,
    color: 'var(--lp-text-tertiary)', marginBottom: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  okBadge: { display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--lp-success-700)', fontWeight: 600 },
  okIcon: { width: 18, height: 18, color: 'var(--lp-success-600)' },
};

const fmt$ = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const fmt$2 = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Iconos line (SVG) por tipo de pendiente — sin emojis */
const ICONS = {
  pedidos: <><path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4" /><rect x="9" y="2" width="6" height="4" rx="1" /><path d="M9 14h6" /></>,
  ordenes: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" /></>,
  qc: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  'qc-hold': <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
  envasado: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  recoleccion: <><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>,
  almacen: <><path d="M16 16l2 2 4-4" /><path d="M21 14V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l1-.6" /><path d="M3.3 7 12 12l8.7-5" /></>,
  'oc-vencidas': <><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 1.9-1.6L22 7H5" /></>,
  'ocs-por-aprobar': <><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 1.9-1.6L22 7H5" /></>,
  'dev-recibir': <><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></>,
  'dev-reembolsar': <><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></>,
  'conteos-vencidos': <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
};
const CardIcon = ({ id, color }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[id] || ICONS.pedidos}
  </svg>
);

/* FIX jun 2026 (K4): import del módulo canónico de estados. Antes los
   arrays estaban hardcoded con valores desalineados — PEND_PEDIDOS usaba
   'nuevo','en_preparacion' que NO son estados reales del sistema (el
   sistema usa 'pendiente'). Resultado: KPI "Pedidos pendientes" siempre 0. */
import {
  ESTADO_PEDIDO_PENDIENTE as PEND_PEDIDOS,
  ESTADO_ORDEN_PENDIENTE as PEND_ORDENES,
  ESTADO_LOTE_PRE_QC as PEND_PRODUCCION,
  ESTADO_LOTE_QC as PEND_QC,
  ESTADO_LOTE_ENVASANDO as PEND_ENVASADO,
  ESTADO_LOTE_RECOLECCION as PEND_RECOLECCION,
  ESTADO_LOTE_EN_CAMINO as PEND_ALMACEN,
} from '../../lib/estados';

export default function DashboardPage() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [trazabilidad, setTrazabilidad] = useState([]);
  const [ocs, setOCs] = useState([]);
  /* FIX jun 2026 (L5): cargas adicionales para cards Burgos/Arely/Josué.
     Burgos sin estos endpoints siempre veía "Todo al día" aunque tuviera
     40 MPs vencidos de conteo. Arely sin /devoluciones no veía cuántas
     requieren reembolso. */
  const [devoluciones, setDevoluciones] = useState([]);
  const [conteosPend, setConteosPend] = useState([]);

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getDashboardExec().then(r => r.data).catch(() => null),
      api.getPedidos().then(r => r.data || []).catch(() => []),
      api.getOrdenes().then(r => r.data || []).catch(() => []),
      api.getTrazabilidad().then(r => r.data || []).catch(() => []),
      api.getOCs().then(r => r.data || r.ocs || []).catch(() => []),
      api.getDevoluciones().then(r => Array.isArray(r) ? r : (r.data || [])).catch(() => []),
      /* Calendario de conteos pendientes (Sprint K17/cycle-count cron). El
         endpoint puede no existir todavía en algunas instalaciones; tolera 404. */
      api.get('/api/reportes/calendario-conteos').then(r => r.data || r.items || []).catch(() => []),
    ]).then(([exec, peds, ords, trz, ocList, devs, conteos]) => {
      setData(exec);
      setPedidos(Array.isArray(peds) ? peds : []);
      setOrdenes(Array.isArray(ords) ? ords : []);
      setTrazabilidad(Array.isArray(trz) ? trz : []);
      setOCs(Array.isArray(ocList) ? ocList : []);
      setDevoluciones(Array.isArray(devs) ? devs : []);
      setConteosPend(Array.isArray(conteos) ? conteos : []);
    }).catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /* Realtime: refrescar cuando cambian datos clave */
  useRealtimeSync({
    onInventario: () => cargar(),
    onOc: () => cargar(),
    onTrazabilidad: () => cargar(),
    onPedidos: () => cargar(),
    onOrdenes: () => cargar(),
  });

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  /* ── Cómputo de tareas pendientes por rol ──
     IMPORTANTE: excluir esPrueba en TODOS los pendientes — los lotes de prueba
     no son operación real y no deben aparecer como urgencias en el dashboard. */
  const tareas = useMemo(() => {
    const noEliminado = (x) => !x?.eliminado && !x?.cancelado && !x?.esPrueba;
    const peds = (pedidos || []).filter(noEliminado);
    const ords = (ordenes || []).filter(noEliminado);
    const lotes = (trazabilidad || []).filter(noEliminado);
    const ocList = (ocs || []).filter(noEliminado);

    const pedidosPendientes  = peds.filter(p => PEND_PEDIDOS.includes((p.estado || '').toLowerCase()));
    const ordenesPendientes  = ords.filter(o => PEND_ORDENES.includes((o.estado || '').toLowerCase()));
    const lotesProducidos    = lotes.filter(l => PEND_PRODUCCION.includes((l.estado || '').toLowerCase()));
    const lotesQC            = lotes.filter(l => PEND_QC.includes((l.estado || '').toLowerCase()));
    const lotesEnvasado      = lotes.filter(l => PEND_ENVASADO.includes((l.estado || '').toLowerCase()));
    const lotesRecoleccion   = lotes.filter(l => PEND_RECOLECCION.includes((l.estado || '').toLowerCase()));
    const lotesEnCamino      = lotes.filter(l => PEND_ALMACEN.includes((l.estado || '').toLowerCase()));
    const ocsActivas         = ocList.filter(oc => !oc.recibida && !['cancelada', 'eliminada'].includes((oc.estado || '').toLowerCase()));
    const ocsVencidas        = ocsActivas.filter(oc => {
      if (!oc.fechaEntrega) return false;
      try { return new Date(oc.fechaEntrega) < new Date(); } catch { return false; }
    });

    /* FIX jun 2026 (L5): pendientes específicos de Burgos/Arely/Josué */
    const devsPendRecibir   = (devoluciones || []).filter(d => d && d.estado === 'pendiente');
    const devsPorReembolsar = (devoluciones || []).filter(d => d && d.disposicion === 'regresar' && !d.reembolsoEmitido);
    const ocsPorAprobar     = ocList.filter(oc => {
      const est = (oc.estado || '').toLowerCase();
      return est === 'pendiente_aprobacion' || (!oc.proveedor && est !== 'recibida');
    });
    const conteosVencidos   = (conteosPend || []).filter(c => c && (c.vencido || c.estado === 'vencido' || c.diasRestantes < 0));

    return {
      pedidosPendientes, ordenesPendientes, lotesProducidos, lotesQC,
      lotesEnvasado, lotesRecoleccion, lotesEnCamino, ocsActivas, ocsVencidas,
      devsPendRecibir, devsPorReembolsar, ocsPorAprobar, conteosVencidos,
    };
  }, [pedidos, ordenes, trazabilidad, ocs, devoluciones, conteosPend]);

  const muestraNombres = (arr, key = 'codigoLote', n = 3) => {
    if (!arr.length) return '';
    return arr.slice(0, n).map(x => x[key] || x.codigo || x.id || '?').join(' · ')
      + (arr.length > n ? ` · +${arr.length - n}` : '');
  };

  /* Tarjetas de pendientes — se filtran por permisos del rol.
     accent = solo tokens LP (var(--lp-*)). */
  const cards = [
    can('crearPedidos') || can('admin') ? {
      key: 'pedidos',
      titulo: 'Pedidos por preparar',
      desc: 'Pedidos de almacén esperando a Enrique para crear orden',
      count: tareas.pedidosPendientes.length,
      items: muestraNombres(tareas.pedidosPendientes, 'codigo'),
      accent: ACC.info,
      ruta: '/pedidos',
    } : null,
    can('admin') || can('tecnico') ? {
      key: 'ordenes',
      titulo: 'Órdenes en proceso',
      desc: 'Producción asignada que aún no se cierra',
      count: tareas.ordenesPendientes.length,
      items: muestraNombres(tareas.ordenesPendientes, 'codigo'),
      accent: ACC.amber,
      ruta: '/ordenes',
    } : null,
    can('registrarQC') || can('admin') ? {
      key: 'qc',
      titulo: 'QC por hacer',
      desc: 'Lotes producidos esperando revisión de calidad',
      count: tareas.lotesProducidos.length,
      items: muestraNombres(tareas.lotesProducidos),
      accent: ACC.amberHi,
      ruta: '/produccion',
    } : null,
    (can('admin') || can('tecnico')) && tareas.lotesQC.length > 0 ? {
      key: 'qc-hold',
      titulo: 'QC retenidos',
      desc: 'Lotes con problemas de calidad que requieren retrabajo',
      count: tareas.lotesQC.length,
      items: muestraNombres(tareas.lotesQC),
      accent: ACC.crit,
      ruta: '/produccion',
    } : null,
    can('admin') || can('tecnico') || can('almacen') ? {
      key: 'envasado',
      titulo: 'Por envasar',
      desc: 'Lotes aprobados de QC, listos para envasar',
      count: tareas.lotesEnvasado.length,
      items: muestraNombres(tareas.lotesEnvasado),
      accent: ACC.brand,
      ruta: '/stock-fabrica',
    } : null,
    can('admin') || can('almacen') || can('recolector') ? {
      key: 'recoleccion',
      titulo: 'Por recolectar',
      desc: 'Lotes envasados esperando a Luis',
      count: tareas.lotesRecoleccion.length,
      items: muestraNombres(tareas.lotesRecoleccion),
      accent: ACC.ok,
      ruta: '/recoleccion',
    } : null,
    can('admin') || can('almacen') ? {
      key: 'almacen',
      titulo: 'En camino a Almacén',
      desc: 'Luis ya escaneó, esperando confirmación de recepción',
      count: tareas.lotesEnCamino.length,
      items: muestraNombres(tareas.lotesEnCamino),
      accent: ACC.info,
      ruta: '/almacen',
    } : null,
    can('admin') || can('compras') ? {
      key: 'oc-vencidas',
      titulo: 'OCs vencidas',
      desc: 'Órdenes de compra que pasaron fecha de entrega',
      count: tareas.ocsVencidas.length,
      items: muestraNombres(tareas.ocsVencidas, 'codigo'),
      accent: ACC.critHi,
      ruta: '/compras',
    } : null,
    /* FIX jun 2026 (L5): card específica de Arely — OCs nuevas pendientes
       de su aprobación. Sin esto Arely solo tenía "OCs vencidas" y caía
       a "Todo al día" aunque hubiera 5 OCs por procesar. */
    can('compras') || can('admin') ? {
      key: 'ocs-por-aprobar',
      titulo: 'OCs por aprobar',
      desc: 'Solicitudes de Enrique pendientes de asignar proveedor/precio',
      count: tareas.ocsPorAprobar.length,
      items: muestraNombres(tareas.ocsPorAprobar, 'codigo'),
      accent: ACC.amber,
      ruta: '/compras',
    } : null,
    /* FIX jun 2026 (L5): card para técnico — devoluciones físicas pendientes de recibir */
    can('produccion') || can('admin') ? {
      key: 'dev-recibir',
      titulo: 'Devoluciones por recibir',
      desc: 'Producto devuelto por cliente esperando inspección en fábrica',
      count: tareas.devsPendRecibir.length,
      items: muestraNombres(tareas.devsPendRecibir, 'id'),
      accent: ACC.info,
      ruta: '/devoluciones',
    } : null,
    /* FIX jun 2026 (L5 + Sprint I G5): card para Arely — devoluciones que
       requieren NC. Antes sólo aparecía banner emergente perdible. */
    can('compras') || can('admin') ? {
      key: 'dev-reembolsar',
      titulo: 'Reembolsos por emitir',
      desc: 'Devoluciones regresadas a stock que necesitan nota de crédito',
      count: tareas.devsPorReembolsar.length,
      items: muestraNombres(tareas.devsPorReembolsar, 'cliente'),
      accent: ACC.amberHi,
      ruta: '/devoluciones',
    } : null,
    /* FIX jun 2026 (L5): card específica de Burgos — conteos vencidos.
       Antes Burgos no tenía NINGUNA card y veía "Todo al día" aunque
       tuviera 40 MPs vencidos. Ahora ve su workload en el dashboard. */
    can('conteoFisico') || can('admin') ? {
      key: 'conteos-vencidos',
      titulo: 'Conteos vencidos',
      desc: 'MPs/PT que el calendario indica contar ya y no se hicieron',
      count: tareas.conteosVencidos.length,
      items: muestraNombres(tareas.conteosVencidos, 'item') || muestraNombres(tareas.conteosVencidos, 'nombre'),
      accent: ACC.crit,
      ruta: '/conteo',
    } : null,
  ].filter(Boolean);

  /* Foco del rol: hint corto sobre qué priorizar hoy. Independiente
     de los pendientes — es un atajo mental para roles operativos. */
  const focoDelRol = (() => {
    const rol = user?.rol;
    if (!rol) return null;
    if (rol === 'tecnico')    return { txt: 'Aceptar pedidos, producir, envasar.', ruta: '/pedidos' };
    if (rol === 'almacen')    return { txt: 'Crear pedidos, recibir lotes en Terán, gestionar PT.', ruta: '/pedidos' };
    if (rol === 'recolector') return { txt: 'Recoger sublotes listos y llevarlos a Terán.', ruta: '/recoleccion' };
    if (rol === 'compras')    return { txt: 'Procesar OCs, aprobar precios, gestionar reembolsos.', ruta: '/compras' };
    if (rol === 'inventario') return { txt: 'Conteos físicos, ajustes con candado, reportar varianzas.', ruta: '/conteo' };
    if (rol === 'admin')      return { txt: 'Supervisión global, ajustes con TOTP, decisiones de margen.', ruta: '/admin' };
    return null;
  })();

  if (err && !data) {
    return (
      <div>
        <TopBar title="Inicio" />
        <div style={S.wrap(isDesktop)}>
          <div style={S.err}>{err}</div>
        </div>
      </div>
    );
  }

  const d = data || {
    produccion: {}, inventario: {}, compras: {}, margenes: {}, trazabilidad: {}, devoluciones: {},
  };

  const cardsConCount = cards.filter(c => c.count > 0);

  /* Hover helpers (reskin: elevación sutil con sombra LP) */
  const hoverIn = (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--lp-shadow-md)'; };
  const hoverOut = (e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; };

  /* ── KPI reutilizable ── */
  const Kpi = ({ accent, onClick, label, value, valueColor, trend, trendPos, sub }) => (
    <button style={S.kpi(accent, !!onClick, isDesktop)} onClick={onClick} onMouseEnter={onClick ? hoverIn : undefined} onMouseLeave={onClick ? hoverOut : undefined}>
      <div style={S.kpiLabel}><span style={S.kpiDot(accent)} />{label}</div>
      <div style={{ ...S.kpiValue, ...(valueColor ? { color: valueColor } : {}) }}>
        {value}
        {trend != null && <span style={S.trend(trendPos)}>{trend}</span>}
      </div>
      {sub != null && <div style={S.kpiSub}>{sub}</div>}
    </button>
  );

  return (
    <div>
      <TopBar title="Inicio" />
      <div style={S.wrap(isDesktop)}>
        {/* Saludo (estilo head() del mockup) */}
        <div style={S.greeting}>
          <div style={S.greetH(isDesktop)}>{saludo}, {user?.nombre || ''}</div>
          <div style={S.greetSub}>
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {loading && !data ? (
          <div style={S.loading}>Cargando KPIs...</div>
        ) : (
          <>
            <HelpHint id="dashboard-bienvenida" title={`¡Hola ${user?.nombre || ''}!`}>
              Este es tu tablero. Arriba ves <strong>tareas pendientes para tu rol</strong>: solo te muestra lo que tú puedes accionar. Abajo, los <strong>KPIs cruzados</strong> de toda la operación. Haz click en cualquier tarjeta para ir al detalle.
            </HelpHint>

            {/* Tira de foco — hint corto del rol */}
            {focoDelRol && (
              <button type="button" onClick={() => navigate(focoDelRol.ruta)} style={S.focoStrip}>
                <span style={S.focoIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
                <span style={S.focoTxt}>
                  <span style={S.focoStrong}>Tu enfoque: </span>{focoDelRol.txt}
                </span>
              </button>
            )}

            {/* ════════ Sección 1 — Requiere tu atención ════════
                Escritorio: grid g3 de cards con borde-left de color.
                Móvil: card hero del más prioritario + lista de pendientes. */}
            {cardsConCount.length > 0 && (
              <div style={S.section}>
                <div style={S.sectionTitle}>Requiere tu atención</div>

                {isDesktop ? (
                  /* ── Escritorio: g3 cards (mockup SCREENS.inicio "atn") ── */
                  <div style={S.atnGrid}>
                    {cardsConCount.map(c => (
                      <button key={c.key} style={S.atnCard(c.accent)} onClick={() => navigate(c.ruta)} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                        <div style={S.atnHead}>
                          <div style={S.atnTitle}>{c.count} {c.titulo.toLowerCase()}</div>
                          <span style={S.atnBadge(c.accent)}>{c.count}</span>
                        </div>
                        <div style={S.atnDesc}>{c.desc}</div>
                        {c.items && <div style={S.atnItems}>{c.items}</div>}
                      </button>
                    ))}
                  </div>
                ) : (
                  /* ── Móvil: hero del primero + lista lrow del resto ── */
                  <>
                    {(() => {
                      const hero = cardsConCount[0];
                      return (
                        <button style={S.atnHero(hero.accent)} onClick={() => navigate(hero.ruta)}>
                          <div style={S.atnHeroTitle}>{hero.count} {hero.titulo.toLowerCase()}</div>
                          <div style={S.atnHeroDesc}>{hero.desc}{hero.items ? ' · ' + hero.items : ''}</div>
                          <span style={S.atnHeroBtn}>
                            Atender
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                            </svg>
                          </span>
                        </button>
                      );
                    })()}

                    {cardsConCount.length > 1 && (
                      <>
                        <div style={{ ...S.sectionTitle, marginTop: 18 }}>Pendientes</div>
                        <div style={S.listCard}>
                          {cardsConCount.slice(1).map((c, i, arr) => (
                            <button key={c.key} style={S.lrow(i === arr.length - 1)} onClick={() => navigate(c.ruta)}>
                              <span style={S.lrowIc(c.accent)}><CardIcon id={c.key} color={c.accent} /></span>
                              <span style={S.lrowNm}>
                                <span style={S.lrowT}>{c.titulo}</span>
                                {c.items && <span style={{ ...S.lrowS, display: 'block' }}>{c.items}</span>}
                              </span>
                              <span style={S.lrowCt(c.accent)}>{c.count}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            {cardsConCount.length === 0 && cards.length > 0 && (
              <div style={S.empty}>
                <span style={S.okBadge}>
                  <svg style={S.okIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Todo al día — sin pendientes para tu rol
                </span>
              </div>
            )}

            {/* ════════ Sección 2 — KPIs ejecutivos agrupados ════════
                Cada KPI / sección visible sólo si el rol tiene permiso del módulo
                correspondiente. Roles sin acceso (ej. recolector) no ven nada de
                inventario, compras ni rentabilidad. */}
            {(() => {
              const verProduccion = can('admin') || can('tecnico') || can('produccion');
              const verInventario = can('admin') || can('inventario') || can('compras') || can('almacen') || can('tecnico');
              const verCompras    = can('admin') || can('compras');
              const verDevol      = can('admin') || can('compras');
              const verRentab     = can('admin') || can('compras');
              const verQC         = can('admin') || can('tecnico') || can('registrarQC');
              const verEnCamino   = can('admin') || can('almacen');

              const verSeccionHoy   = verProduccion || verInventario || verDevol;
              const verSeccionCompr = verCompras || verRentab;
              /* Trazabilidad sólo si hay KPIs visibles dentro (QC para técnico, En camino para almacén) */
              const verSeccionTraz  = verQC || verEnCamino;
              /* Para Lotes en flujo en sección "Hoy" usamos el mismo gate de QC/almacén/compras */
              const verTrazab       = verQC || verEnCamino || can('compras');

              return (
                <>
                  {/* Pipeline de lotes activos para almacen+recolector. */}
                  {(user?.rol === 'almacen' || user?.rol === 'recolector') && (
                    <MisLotesPipeline rol={user.rol} />
                  )}

                  {/* HOY EN LA PLANTA — Producción + Inventario + Devoluciones */}
                  {verSeccionHoy && (
                    <div style={S.section}>
                      <div style={S.sectionTitle}>Hoy en la planta</div>
                      <div style={S.grid(isDesktop)}>
                        {verProduccion && (
                          <Kpi
                            accent={ACC.brand}
                            onClick={() => navigate('/produccion')}
                            label="Cubetas / mes"
                            value={(d.produccion.promMensual || 0).toLocaleString()}
                            trend={d.produccion.growthPct != null && d.produccion.growthPct !== 0
                              ? `${d.produccion.growthPct > 0 ? '+' : ''}${d.produccion.growthPct}%` : null}
                            trendPos={d.produccion.growthPct > 0}
                            sub="Promedio últimos 6 meses"
                          />
                        )}
                        {verTrazab && (
                          <Kpi
                            accent={ACC.info}
                            onClick={() => navigate('/trazabilidad')}
                            label="Lotes en flujo"
                            value={(d.trazabilidad.lotesEnEnvasado || 0) + (d.trazabilidad.lotesEnCamino || 0)}
                            sub={`${d.trazabilidad.lotesEnEnvasado || 0} envasando · ${d.trazabilidad.lotesEnCamino || 0} en camino`}
                          />
                        )}
                        {verInventario && (
                          <>
                            <Kpi
                              accent={ACC.brand}
                              onClick={() => navigate('/inventario?tab=mp')}
                              label="Valor inventario MP"
                              value={fmt$(d.inventario.valorMP || 0)}
                              sub={`${d.inventario.mpsTotales || 0} MPs · ${d.inventario.ptsTotales || 0} PTs`}
                            />
                            <Kpi
                              accent={d.inventario.mpsCriticas > 0 ? ACC.crit : ACC.mut}
                              onClick={() => navigate('/inventario?tab=mp&filter=sin')}
                              label="Stock crítico"
                              value={d.inventario.mpsCriticas || 0}
                              valueColor={d.inventario.mpsCriticas > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)'}
                              sub="MPs sin existencia →"
                            />
                            <Kpi
                              accent={d.inventario.mpsBajas > 0 ? ACC.amber : ACC.mut}
                              onClick={() => navigate('/inventario?tab=mp&filter=bajo')}
                              label="Stock bajo"
                              value={d.inventario.mpsBajas || 0}
                              valueColor={d.inventario.mpsBajas > 0 ? 'var(--lp-warning-700)' : 'var(--lp-text-tertiary)'}
                              sub="Por debajo del mínimo →"
                            />
                          </>
                        )}
                        {verDevol && (
                          <Kpi
                            accent={d.devoluciones.ult30d > 0 ? ACC.amber : ACC.mut}
                            onClick={() => navigate('/devoluciones')}
                            label="Devoluciones 30d"
                            value={d.devoluciones.ult30d || 0}
                            valueColor={d.devoluciones.ult30d > 0 ? 'var(--lp-warning-700)' : 'var(--lp-text-tertiary)'}
                            sub={`${fmt$2(d.devoluciones.monto30d || 0)} devueltos`}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* COMPRAS Y RENTABILIDAD — solo admin/compras */}
                  {verSeccionCompr && (
                    <div style={S.section}>
                      <div style={S.sectionTitle}>Compras y rentabilidad</div>
                      <div style={S.grid(isDesktop)}>
                        {verCompras && (
                          <>
                            <Kpi
                              accent={ACC.amber}
                              onClick={() => navigate('/compras')}
                              label="OCs activas"
                              value={d.compras.ocsActivas || 0}
                              sub={`${fmt$(d.compras.montoPendiente || 0)} pendiente`}
                            />
                            <Kpi
                              accent={d.compras.ocsVencidas > 0 ? ACC.crit : ACC.mut}
                              onClick={() => navigate('/compras')}
                              label="OCs vencidas"
                              value={d.compras.ocsVencidas || 0}
                              valueColor={d.compras.ocsVencidas > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)'}
                              sub="Pasada fecha de entrega"
                            />
                          </>
                        )}
                        {verRentab && (
                          <>
                            <Kpi
                              accent={ACC.ok}
                              onClick={() => navigate('/admin?section=margenes')}
                              label="Margen mensual"
                              value={fmt$(d.margenes.margenMensual)}
                              trend={d.margenes.margenPct > 0 ? `${d.margenes.margenPct}%` : null}
                              trendPos
                              sub={`Ingresos ${fmt$(d.margenes.ingresosMensual)}`}
                            />
                            <Kpi
                              accent={ACC.brand}
                              onClick={() => navigate('/admin?section=margenes')}
                              label="Con precio"
                              value={<>{d.margenes.conPrecio} <span style={{ fontSize: 13, opacity: .5 }}>/ {d.margenes.totalProductos}</span></>}
                              sub={`${d.margenes.totalProductos - d.margenes.conPrecio} sin precio`}
                            />
                            <Kpi
                              accent={d.margenes.noRentables > 0 ? ACC.crit : ACC.mut}
                              onClick={() => navigate('/admin?section=margenes')}
                              label="No rentables"
                              value={d.margenes.noRentables || 0}
                              valueColor={d.margenes.noRentables > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)'}
                              sub="Costo > precio"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TRAZABILIDAD — flujo de lotes */}
                  {verSeccionTraz && (
                    <div style={S.section}>
                      <div style={S.sectionTitle}>Trazabilidad — flujo de lotes</div>
                      <div style={S.grid(isDesktop)}>
                        {verQC && (
                          <>
                            <Kpi
                              accent={ACC.amber}
                              onClick={() => navigate('/produccion')}
                              label="QC pendientes"
                              value={d.trazabilidad.lotesQCPendientes || 0}
                              valueColor={(d.trazabilidad.lotesQCPendientes || 0) > 0 ? 'var(--lp-warning-700)' : 'var(--lp-text-tertiary)'}
                              sub="Lotes producidos esperando revisión"
                            />
                            <Kpi
                              accent={ACC.crit}
                              onClick={() => navigate('/trazabilidad')}
                              label="QC retenidos"
                              value={d.trazabilidad.lotesQCHold || 0}
                              valueColor={(d.trazabilidad.lotesQCHold || 0) > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)'}
                              sub="Requieren retrabajo"
                            />
                          </>
                        )}
                        {verEnCamino && (
                          <Kpi
                            accent={ACC.ok}
                            onClick={() => navigate('/almacen')}
                            label="En camino a almacén"
                            value={d.trazabilidad.lotesEnCamino || 0}
                            sub="Por confirmar recepción"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* ════════ Sección 3 — Top productos del mes ════════
                Solo visible para admin/compras (mismo permiso que /api/dashboard/exec). */}
            {(can('admin') || can('compras')) && (
              <div style={S.section}>
                <div style={S.sectionTitle}>
                  Top {Math.min(5, (d.topProductos || []).length)} productos del mes
                </div>
                <div style={S.panel}>
                  {!Array.isArray(d.topProductos) ? (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--lp-text-tertiary)', fontSize: 12 }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--lp-warning-600)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <div style={{ fontWeight: 600, color: 'var(--lp-warning-700)', marginBottom: 4 }}>
                        Backend desactualizado
                      </div>
                      <div style={{ lineHeight: 1.5 }}>
                        El endpoint del dashboard aún no devuelve los datos de Top productos.<br />
                        Reinicia el server con <code style={{ background: 'var(--lp-bg-sunken)', padding: '2px 6px', borderRadius: 4 }}>reiniciar.bat</code> y haz hard refresh.
                      </div>
                    </div>
                  ) : d.topProductos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--lp-text-tertiary)', fontSize: 12 }}>
                      Sin producción registrada en el mes más reciente.
                    </div>
                  ) : (() => {
                    const max = Math.max(...d.topProductos.map(p => p.cubetas), 1);
                    /* Paleta diversa por rank — solo tokens LP del tema verde */
                    const COLORES_RANK = [ACC.brand, ACC.ok, ACC.amber, ACC.info, ACC.amberHi];
                    return d.topProductos.map((p, i) => {
                      const pct = (p.cubetas / max) * 100;
                      const accent = COLORES_RANK[i] || ACC.brand;
                      return (
                        <div key={p.nombre} style={S.topRow}>
                          <div style={S.topRank}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={S.topName}>{p.nombre}</div>
                            {p.tienePrecio && p.margenPct != null && (
                              <div style={S.topSub}>
                                Margen {p.margenPct}% · ${Math.round(p.margenMes).toLocaleString()} utilidad/mes
                              </div>
                            )}
                            {!p.tienePrecio && (
                              <div style={{ ...S.topSub, color: 'var(--lp-warning-700)' }}>
                                Sin precio cargado
                              </div>
                            )}
                          </div>
                          <div style={S.topBarWrap}>
                            <div style={S.topBar(pct, accent)} />
                          </div>
                          <div style={S.topVal}>{p.cubetas.toLocaleString()}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* ════════ Sección 4 — Producción últimos 12 meses ════════
                Solo visible para admin/compras (mismo permiso). */}
            {(can('admin') || can('compras')) && (
              <div style={S.section}>
                <div style={S.sectionTitle}>Producción últimos 12 meses</div>
                <div style={S.panel}>
                  {!Array.isArray(d.serie12m) ? (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--lp-text-tertiary)', fontSize: 12 }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--lp-warning-600)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <div style={{ fontWeight: 600, color: 'var(--lp-warning-700)', marginBottom: 4 }}>
                        Backend desactualizado
                      </div>
                      <div style={{ lineHeight: 1.5 }}>
                        Los datos de la serie de 12 meses aún no llegan.<br />
                        Reinicia el server (<code style={{ background: 'var(--lp-bg-sunken)', padding: '2px 6px', borderRadius: 4 }}>reiniciar.bat</code>) y haz <code>Ctrl+Shift+R</code>.
                      </div>
                    </div>
                  ) : d.serie12m.length < 3 ? (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--lp-text-tertiary)', fontSize: 12 }}>
                      Se necesitan al menos 3 meses de datos para mostrar la tendencia.
                    </div>
                  ) : (() => {
                    const max = Math.max(...d.serie12m.map(x => x.cubetas), 1);
                    const lastIdx = d.serie12m.length - 1;
                    const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                    return (
                      <>
                        <div style={S.sparkRow}>
                          {d.serie12m.map((x, i) => {
                            const pct = (x.cubetas / max) * 100;
                            return (
                              <div
                                key={x.mes}
                                style={S.sparkBar(pct, i === lastIdx)}
                                title={`${x.mes}: ${x.cubetas.toLocaleString()} cubetas`}
                              />
                            );
                          })}
                        </div>
                        <div style={S.sparkMonths}>
                          {d.serie12m.map((x, i) => {
                            const m = parseInt(x.mes.slice(5, 7)) - 1;
                            return (
                              <span key={x.mes} style={S.sparkMonth(i === lastIdx)}>
                                {NOMBRES_MES[m]}
                              </span>
                            );
                          })}
                        </div>
                        <div style={S.trendStats}>
                          <div>
                            <span style={S.trendStat}>Promedio: </span>
                            <span style={S.trendStatVal}>
                              {(d.statsTrend?.promedio || 0).toLocaleString()} cub
                            </span>
                          </div>
                          {d.statsTrend?.mejorMes && (
                            <div>
                              <span style={S.trendStat}>Mejor mes: </span>
                              <span style={S.trendStatVal}>
                                {d.statsTrend.mejorMes.cubetas.toLocaleString()} cub
                                ({NOMBRES_MES[parseInt(d.statsTrend.mejorMes.mes.slice(5, 7)) - 1]})
                              </span>
                            </div>
                          )}
                          {d.statsTrend?.crecimiento != null && (
                            <div>
                              <span style={S.trendStat}>Crecimiento: </span>
                              <span style={{
                                ...S.trendStatVal,
                                color: d.statsTrend.crecimiento >= 0 ? 'var(--lp-success-700)' : 'var(--lp-danger-700)',
                              }}>
                                {d.statsTrend.crecimiento >= 0 ? '+' : ''}{d.statsTrend.crecimiento}%
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
