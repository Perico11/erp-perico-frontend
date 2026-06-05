import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import HelpHint from '../../components/HelpHint';
import MisLotesPipeline from './MisLotesPipeline';

const S = {
  wrap: { padding: '20px 20px 100px' },
  greeting: { marginBottom: 14 },
  greetH: { fontSize: 18, fontWeight: 700, color: 'var(--lp-text-primary)' },
  greetSub: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 4 },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 8px 2px',
  },
  /* Grid compacto: hasta 6 columnas en pantallas anchas, 4 en medianas, 2 en móvil */
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8,
  },
  kpi: (accent, clickable) => ({
    background: 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderTop: `2px solid ${accent}`,           /* 3px → 2px (más sutil) */
    padding: '11px 13px',                       /* 14/16 → 11/13 (más denso) */
    cursor: clickable ? 'pointer' : 'default',
    transition: 'transform .12s, box-shadow .12s, border-color .12s',
    fontFamily: 'var(--lp-font-sans)',
    textAlign: 'left', width: '100%', minHeight: 78,
    display: 'flex', flexDirection: 'column', gap: 2,
  }),
  kpiLabel: {
    fontSize: 11, fontWeight: 700,
    color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '.05em',
  },
  kpiValue: {
    fontSize: 20, fontWeight: 800, marginTop: 2,
    color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)',
    lineHeight: 1.1,
  },
  kpiSub: {
    fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 'auto', paddingTop: 3, lineHeight: 1.3,
  },
  trend: (positivo) => ({
    fontSize: 11, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
    background: positivo ? 'var(--lp-success-100)' : 'var(--lp-danger-100)',
    color: positivo ? 'var(--lp-success-700)' : 'var(--lp-danger-700)',
    marginLeft: 5,
  }),
  /* === Top productos del mes === */
  topPanel: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    padding: '14px 16px',
  },
  topRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 0',
    fontSize: 12,
  },
  topRank: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)',
    fontSize: 10, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, fontFamily: 'var(--lp-font-mono)',
  },
  topName: {
    flex: 1, fontWeight: 600, color: 'var(--lp-text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  topBarWrap: {
    width: 140, height: 6,
    background: 'var(--lp-bg-sunken)', borderRadius: 3, overflow: 'hidden',
    flexShrink: 0,
  },
  topBar: (pct, color) => ({
    height: '100%',
    width: Math.max(2, pct) + '%',
    background: color,
    borderRadius: 3,
    transition: 'width .3s',
  }),
  topVal: {
    fontFamily: 'var(--lp-font-mono)',
    fontWeight: 700, fontSize: 12,
    color: 'var(--lp-text-primary)',
    minWidth: 50, textAlign: 'right',
  },
  topSub: {
    fontSize: 11, color: 'var(--lp-text-tertiary)',
    marginTop: 2,
  },

  /* === Sparkline 12 meses === */
  trendPanel: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    padding: '14px 16px',
  },
  sparkRow: {
    display: 'flex', alignItems: 'flex-end',
    gap: 4, height: 80, marginTop: 4,
  },
  sparkBar: (pct, isCurrent) => ({
    flex: 1, height: Math.max(4, pct) + '%',
    /* Mes actual en púrpura (igual que producción), histórico en teal suave */
    background: isCurrent ? '#7C3AED' : '#5DCAA5',
    opacity: isCurrent ? 1 : 0.55,
    borderRadius: '3px 3px 0 0',
    transition: 'opacity .15s',
    cursor: 'pointer',
  }),
  sparkMonths: {
    display: 'flex', justifyContent: 'space-between',
    marginTop: 6, fontFamily: 'var(--lp-font-mono)',
  },
  sparkMonth: (isCurrent) => ({
    flex: 1, textAlign: 'center',
    fontSize: 11,
    color: isCurrent ? '#534AB7' : 'var(--lp-text-tertiary)',
    fontWeight: isCurrent ? 700 : 500,
  }),
  trendStats: {
    display: 'flex', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 12,
    borderTop: '1px solid var(--lp-border-subtle)',
    fontSize: 11, gap: 12, flexWrap: 'wrap',
  },
  trendStat: { color: 'var(--lp-text-tertiary)' },
  trendStatVal: { color: 'var(--lp-text-primary)', fontWeight: 700, fontFamily: 'var(--lp-font-mono)' },

  /* Layout 2 columnas para opción 2 + 3 */
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
    marginTop: 6,
  },

  /* Hero banner — pendiente prioritario destacado */
  hero: {
    background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
    border: '1.5px solid #FCD34D',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 14,
    marginBottom: 14,
    cursor: 'pointer',
    transition: 'transform .12s, box-shadow .12s',
    fontFamily: 'var(--lp-font-sans)',
    textAlign: 'left', width: '100%',
  },
  heroIcon: {
    width: 42, height: 42, borderRadius: 10, background: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 13, fontWeight: 700, color: '#92400E' },
  heroMeta: { fontSize: 11, color: '#A16207', marginTop: 2 },
  heroBadge: {
    background: '#D97706', color: '#fff', padding: '8px 14px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, flexShrink: 0,
    fontFamily: 'inherit', border: 'none',
  },
  loading: { textAlign: 'center', padding: '40px 0', color: 'var(--lp-text-tertiary)' },
  err: {
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    padding: 10, borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 12,
  },
  /* Pendientes por rol (sección B) */
  pendList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 10,
  },
  pendCard: (accent) => ({
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderLeft: `3px solid ${accent}`,
    borderRadius: 'var(--lp-radius)',
    padding: 14,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    fontFamily: 'var(--lp-font-sans)',
    transition: 'transform .12s, box-shadow .12s',
  }),
  pendHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  pendTitle: { fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)' },
  pendCount: (color) => ({
    fontSize: 11, fontWeight: 800, padding: '2px 8px',
    borderRadius: 12, color: '#fff', background: color, fontFamily: 'var(--lp-font-mono)',
  }),
  pendDesc: { fontSize: 11, color: 'var(--lp-text-secondary)', lineHeight: 1.5 },
  pendItems: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 6, lineHeight: 1.6 },
  empty: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px dashed var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    padding: 20,
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--lp-text-tertiary)',
    gridColumn: '1 / -1',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  /* ── Z1 (jun 2026): tira de enfoque del rol ───────────────────────── */
  focoStrip: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px',
    background: 'var(--lp-bg-sunken)',
    border: '1px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12, color: 'var(--lp-text-secondary)',
    marginBottom: 12, lineHeight: 1.4,
  },
  focoIcon: {
    width: 28, height: 28, borderRadius: 8,
    background: 'var(--lp-brand-50)', color: 'var(--lp-brand-600)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  focoTxt: { flex: 1, minWidth: 0 },
  focoStrong: { color: 'var(--lp-text-primary)', fontWeight: 700 },

  /* ── Bloques visuales agrupando pendientes por área de flujo ─────── */
  bloque: {
    marginBottom: 12,
  },
  bloqueHead: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 10, fontWeight: 800, color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '.08em',
    margin: '0 0 6px 2px',
  },
  bloqueIcon: {
    width: 14, height: 14, color: 'var(--lp-text-tertiary)',
  },
  /* Verde celebratorio sutil para "todo al día" */
  okBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    color: 'var(--lp-success-700)', fontWeight: 700,
  },
  okIcon: {
    width: 18, height: 18,
    color: 'var(--lp-success-600)',
  },
};

const fmt$ = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const fmt$2 = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  /* Tarjetas de pendientes — se filtran por permisos del rol */
  const cards = [
    can('crearPedidos') || can('admin') ? {
      key: 'pedidos',
      titulo: 'Pedidos por preparar',
      desc: 'Pedidos de almacén esperando a Enrique para crear orden',
      count: tareas.pedidosPendientes.length,
      items: muestraNombres(tareas.pedidosPendientes, 'codigo'),
      accent: 'var(--lp-info-600)',
      pillColor: 'var(--lp-info-600)',
      ruta: '/pedidos',
    } : null,
    can('admin') || can('tecnico') ? {
      key: 'ordenes',
      titulo: 'Órdenes en proceso',
      desc: 'Producción asignada que aún no se cierra',
      count: tareas.ordenesPendientes.length,
      items: muestraNombres(tareas.ordenesPendientes, 'codigo'),
      accent: 'var(--lp-warning-600)',
      pillColor: 'var(--lp-warning-600)',
      ruta: '/ordenes',
    } : null,
    can('registrarQC') || can('admin') ? {
      key: 'qc',
      titulo: 'QC por hacer',
      desc: 'Lotes producidos esperando revisión de calidad',
      count: tareas.lotesProducidos.length,
      items: muestraNombres(tareas.lotesProducidos),
      accent: 'var(--lp-warning-700)',
      pillColor: 'var(--lp-warning-700)',
      ruta: '/produccion',
    } : null,
    (can('admin') || can('tecnico')) && tareas.lotesQC.length > 0 ? {
      key: 'qc-hold',
      titulo: 'QC retenidos',
      desc: 'Lotes con problemas de calidad que requieren retrabajo',
      count: tareas.lotesQC.length,
      items: muestraNombres(tareas.lotesQC),
      accent: 'var(--lp-danger-600)',
      pillColor: 'var(--lp-danger-600)',
      ruta: '/produccion',
    } : null,
    can('admin') || can('tecnico') || can('almacen') ? {
      key: 'envasado',
      titulo: 'Por envasar',
      desc: 'Lotes aprobados de QC, listos para envasar',
      count: tareas.lotesEnvasado.length,
      items: muestraNombres(tareas.lotesEnvasado),
      accent: 'var(--lp-brand-600)',
      pillColor: 'var(--lp-brand-600)',
      ruta: '/stock-fabrica',
    } : null,
    can('admin') || can('almacen') || can('recolector') ? {
      key: 'recoleccion',
      titulo: 'Por recolectar',
      desc: 'Lotes envasados esperando a Luis',
      count: tareas.lotesRecoleccion.length,
      items: muestraNombres(tareas.lotesRecoleccion),
      accent: 'var(--lp-success-600)',
      pillColor: 'var(--lp-success-600)',
      ruta: '/recoleccion',
    } : null,
    can('admin') || can('almacen') ? {
      key: 'almacen',
      titulo: 'En camino a Almacén',
      desc: 'Luis ya escaneó, esperando confirmación de recepción',
      count: tareas.lotesEnCamino.length,
      items: muestraNombres(tareas.lotesEnCamino),
      accent: 'var(--lp-info-700)',
      pillColor: 'var(--lp-info-700)',
      ruta: '/almacen',
    } : null,
    can('admin') || can('compras') ? {
      key: 'oc-vencidas',
      titulo: 'OCs vencidas',
      desc: 'Órdenes de compra que pasaron fecha de entrega',
      count: tareas.ocsVencidas.length,
      items: muestraNombres(tareas.ocsVencidas, 'codigo'),
      accent: 'var(--lp-danger-700)',
      pillColor: 'var(--lp-danger-700)',
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
      accent: 'var(--lp-warning-600)',
      pillColor: 'var(--lp-warning-600)',
      ruta: '/compras',
    } : null,
    /* FIX jun 2026 (L5): card para técnico — devoluciones físicas pendientes de recibir */
    can('produccion') || can('admin') ? {
      key: 'dev-recibir',
      titulo: 'Devoluciones por recibir',
      desc: 'Producto devuelto por cliente esperando inspección en fábrica',
      count: tareas.devsPendRecibir.length,
      items: muestraNombres(tareas.devsPendRecibir, 'id'),
      accent: 'var(--lp-info-700)',
      pillColor: 'var(--lp-info-700)',
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
      accent: 'var(--lp-warning-700)',
      pillColor: 'var(--lp-warning-700)',
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
      accent: 'var(--lp-danger-600)',
      pillColor: 'var(--lp-danger-600)',
      ruta: '/conteo',
    } : null,
  ].filter(Boolean);

  /* Z1 (jun 2026): clasificación por área de flujo para agrupar cards visualmente.
     Cada key de card se asigna a un área. Las áreas se renderizan en orden de
     relevancia: producción primero (pedidos→QC→envasar), luego logística
     (recolectar→en camino), luego compras, luego operación cross-rol. */
  const AREA_DE_CARD = {
    pedidos:           { area: 'produccion',  label: 'Producción' },
    ordenes:           { area: 'produccion',  label: 'Producción' },
    qc:                { area: 'produccion',  label: 'Producción' },
    'qc-hold':         { area: 'produccion',  label: 'Producción' },
    envasado:          { area: 'produccion',  label: 'Producción' },
    recoleccion:       { area: 'logistica',   label: 'Logística' },
    almacen:           { area: 'logistica',   label: 'Logística' },
    'oc-vencidas':     { area: 'compras',     label: 'Compras' },
    'ocs-por-aprobar': { area: 'compras',     label: 'Compras' },
    'dev-recibir':     { area: 'operacion',   label: 'Operación' },
    'dev-reembolsar':  { area: 'compras',     label: 'Compras' },
    'conteos-vencidos':{ area: 'operacion',   label: 'Operación' },
  };
  const ORDEN_AREAS = ['produccion', 'logistica', 'compras', 'operacion'];

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
        <TopBar title="Dashboard" />
        <div style={S.wrap}>
          <div style={S.err}>{err}</div>
        </div>
      </div>
    );
  }

  const d = data || {
    produccion: {}, inventario: {}, compras: {}, margenes: {}, trazabilidad: {}, devoluciones: {},
  };

  const cardsConCount = cards.filter(c => c.count > 0);

  return (
    <div>
      <TopBar title="Dashboard" />
      <div style={S.wrap}>
        <div style={S.greeting}>
          <div style={S.greetH}>{saludo}, {user?.nombre || ''}</div>
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

            {/* Z1 (jun 2026): Tira de foco — hint corto del rol */}
            {focoDelRol && (
              <button
                type="button"
                onClick={() => navigate(focoDelRol.ruta)}
                style={{ ...S.focoStrip, border: '1px solid var(--lp-border-subtle)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}
              >
                <div style={S.focoIcon}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div style={S.focoTxt}>
                  <span style={S.focoStrong}>Tu enfoque: </span>{focoDelRol.txt}
                </div>
              </button>
            )}

            {/* ════════ Sección 1 — Pendientes para tu rol ════════
                Hero del más prioritario + cards agrupadas por área de flujo
                (producción / logística / compras / operación). La agrupación
                hace más legible cuando hay 5+ pendientes mezclados. */}
            {cardsConCount.length > 0 && (
              <div style={S.section}>
                <div style={S.sectionTitle}>Pendientes para tu rol</div>
                {/* Hero banner para el pendiente más prioritario */}
                {(() => {
                  const hero = cardsConCount[0];
                  return (
                    <button
                      style={S.hero}
                      onClick={() => navigate(hero.ruta)}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(217,119,6,.18)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                    >
                      <div style={S.heroIcon}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </div>
                      <div style={S.heroText}>
                        <div style={S.heroTitle}>{hero.count} {hero.titulo.toLowerCase()}</div>
                        <div style={S.heroMeta}>{hero.desc}{hero.items ? ' · ' + hero.items : ''}</div>
                      </div>
                      <span style={S.heroBadge}>Atender →</span>
                    </button>
                  );
                })()}
                {/* Cards restantes agrupadas por área de flujo */}
                {cardsConCount.length > 1 && (() => {
                  const restantes = cardsConCount.slice(1);
                  const porArea = {};
                  restantes.forEach(c => {
                    const meta = AREA_DE_CARD[c.key] || { area: 'operacion', label: 'Operación' };
                    if (!porArea[meta.area]) porArea[meta.area] = { label: meta.label, cards: [] };
                    porArea[meta.area].cards.push(c);
                  });
                  return ORDEN_AREAS.filter(a => porArea[a]).map(areaKey => (
                    <div key={areaKey} style={S.bloque}>
                      <div style={S.bloqueHead}>
                        <svg style={S.bloqueIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="2"/>
                          <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
                        </svg>
                        {porArea[areaKey].label}
                      </div>
                      <div style={S.pendList}>
                        {porArea[areaKey].cards.map(c => (
                          <button
                            key={c.key}
                            style={S.pendCard(c.accent)}
                            onClick={() => navigate(c.ruta)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 14px rgba(26,24,21,.06)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = '';
                              e.currentTarget.style.boxShadow = '';
                            }}
                          >
                            <div style={S.pendHead}>
                              <div style={S.pendTitle}>{c.titulo}</div>
                              <div style={S.pendCount(c.pillColor)}>{c.count}</div>
                            </div>
                            <div style={S.pendDesc}>{c.desc}</div>
                            {c.items && <div style={S.pendItems}>{c.items}</div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
            {cardsConCount.length === 0 && cards.length > 0 && (
              <div style={{ ...S.empty, marginBottom: 14 }}>
                <span style={S.okBadge}>
                  <svg style={S.okIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
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
                  {/* Sprint H (jun 2026): Pipeline de lotes activos para almacen+recolector.
                     Josué y Luis ven los lotes con su status timeline desde que Enrique los
                     acepta, no solo cuando ya están en su pantalla. Realtime sync vía WS. */}
                  {(user?.rol === 'almacen' || user?.rol === 'recolector') && (
                    <MisLotesPipeline rol={user.rol} />
                  )}

                  {/* HOY EN LA PLANTA — Producción + Inventario + Devoluciones */}
                  {verSeccionHoy && (
                    <div style={S.section}>
                      <div style={S.sectionTitle}>Hoy en la planta</div>
                      <div style={S.grid}>
                        {verProduccion && (
                          <button style={S.kpi('#7C3AED', true)} onClick={() => navigate('/produccion')}>
                            <div style={S.kpiLabel}>Cubetas/mes</div>
                            <div style={S.kpiValue}>
                              {(d.produccion.promMensual || 0).toLocaleString()}
                              {d.produccion.growthPct != null && d.produccion.growthPct !== 0 && (
                                <span style={S.trend(d.produccion.growthPct > 0)}>
                                  {d.produccion.growthPct > 0 ? '+' : ''}{d.produccion.growthPct}%
                                </span>
                              )}
                            </div>
                            <div style={S.kpiSub}>Promedio últimos 6 meses</div>
                          </button>
                        )}
                        {verTrazab && (
                          <button style={S.kpi('#7C3AED', true)} onClick={() => navigate('/trazabilidad')}>
                            <div style={S.kpiLabel}>Lotes en flujo</div>
                            <div style={S.kpiValue}>{(d.trazabilidad.lotesEnEnvasado || 0) + (d.trazabilidad.lotesEnCamino || 0)}</div>
                            <div style={S.kpiSub}>
                              {d.trazabilidad.lotesEnEnvasado || 0} envasando · {d.trazabilidad.lotesEnCamino || 0} en camino
                            </div>
                          </button>
                        )}
                        {verInventario && (
                          <>
                            <button style={S.kpi('#0F6E56', true)} onClick={() => navigate('/inventario?tab=mp')}>
                              <div style={S.kpiLabel}>Valor inventario MP</div>
                              <div style={S.kpiValue}>{fmt$(d.inventario.valorMP || 0)}</div>
                              <div style={S.kpiSub}>
                                {d.inventario.mpsTotales || 0} MPs · {d.inventario.ptsTotales || 0} PTs
                              </div>
                            </button>
                            <button
                              style={S.kpi(d.inventario.mpsCriticas > 0 ? 'var(--lp-danger-600)' : 'var(--lp-border-subtle)', true)}
                              onClick={() => navigate('/inventario?tab=mp&filter=sin')}
                              title="Ver MPs sin existencia"
                            >
                              <div style={S.kpiLabel}>Stock crítico</div>
                              <div style={{
                                ...S.kpiValue,
                                color: d.inventario.mpsCriticas > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)',
                              }}>{d.inventario.mpsCriticas || 0}</div>
                              <div style={S.kpiSub}>MPs sin existencia →</div>
                            </button>
                            <button
                              style={S.kpi(d.inventario.mpsBajas > 0 ? 'var(--lp-warning-600)' : 'var(--lp-border-subtle)', true)}
                              onClick={() => navigate('/inventario?tab=mp&filter=bajo')}
                              title="Ver MPs por debajo del mínimo"
                            >
                              <div style={S.kpiLabel}>Stock bajo</div>
                              <div style={{
                                ...S.kpiValue,
                                color: d.inventario.mpsBajas > 0 ? 'var(--lp-warning-700)' : 'var(--lp-text-tertiary)',
                              }}>{d.inventario.mpsBajas || 0}</div>
                              <div style={S.kpiSub}>Por debajo del mínimo →</div>
                            </button>
                          </>
                        )}
                        {verDevol && (
                          <button
                            style={S.kpi(d.devoluciones.ult30d > 0 ? '#D85A30' : 'var(--lp-border-subtle)', true)}
                            onClick={() => navigate('/devoluciones')}
                          >
                            <div style={S.kpiLabel}>Devoluciones 30d</div>
                            <div style={{
                              ...S.kpiValue,
                              color: d.devoluciones.ult30d > 0 ? '#993C1D' : 'var(--lp-text-tertiary)',
                            }}>{d.devoluciones.ult30d || 0}</div>
                            <div style={S.kpiSub}>{fmt$2(d.devoluciones.monto30d || 0)} devueltos</div>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* COMPRAS Y RENTABILIDAD — solo admin/compras */}
                  {verSeccionCompr && (
                    <div style={S.section}>
                      <div style={S.sectionTitle}>Compras y rentabilidad</div>
                      <div style={S.grid}>
                        {verCompras && (
                          <>
                            <button style={S.kpi('#D97706', true)} onClick={() => navigate('/compras')}>
                              <div style={S.kpiLabel}>OCs activas</div>
                              <div style={S.kpiValue}>{d.compras.ocsActivas || 0}</div>
                              <div style={S.kpiSub}>{fmt$(d.compras.montoPendiente || 0)} pendiente</div>
                            </button>
                            <button
                              style={S.kpi(d.compras.ocsVencidas > 0 ? 'var(--lp-danger-600)' : 'var(--lp-border-subtle)', true)}
                              onClick={() => navigate('/compras')}
                            >
                              <div style={S.kpiLabel}>OCs vencidas</div>
                              <div style={{
                                ...S.kpiValue,
                                color: d.compras.ocsVencidas > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)',
                              }}>{d.compras.ocsVencidas || 0}</div>
                              <div style={S.kpiSub}>Pasada fecha de entrega</div>
                            </button>
                          </>
                        )}
                        {verRentab && (
                          <>
                            <button style={S.kpi('var(--lp-success-600)', true)} onClick={() => navigate('/admin?section=margenes')}>
                              <div style={S.kpiLabel}>Margen mensual</div>
                              <div style={S.kpiValue}>
                                {fmt$(d.margenes.margenMensual)}
                                {d.margenes.margenPct > 0 && (
                                  <span style={S.trend(true)}>{d.margenes.margenPct}%</span>
                                )}
                              </div>
                              <div style={S.kpiSub}>Ingresos {fmt$(d.margenes.ingresosMensual)}</div>
                            </button>
                            <button style={S.kpi('var(--lp-brand-600)', true)} onClick={() => navigate('/admin?section=margenes')}>
                              <div style={S.kpiLabel}>Con precio</div>
                              <div style={S.kpiValue}>
                                {d.margenes.conPrecio} <span style={{ fontSize: 13, opacity: .5 }}>/ {d.margenes.totalProductos}</span>
                              </div>
                              <div style={S.kpiSub}>{d.margenes.totalProductos - d.margenes.conPrecio} sin precio</div>
                            </button>
                            <button
                              style={S.kpi(d.margenes.noRentables > 0 ? 'var(--lp-danger-600)' : 'var(--lp-border-subtle)', true)}
                              onClick={() => navigate('/admin?section=margenes')}
                            >
                              <div style={S.kpiLabel}>No rentables</div>
                              <div style={{
                                ...S.kpiValue,
                                color: d.margenes.noRentables > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)',
                              }}>{d.margenes.noRentables || 0}</div>
                              <div style={S.kpiSub}>Costo &gt; precio</div>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TRAZABILIDAD — flujo de lotes */}
                  {verSeccionTraz && (
                    <div style={S.section}>
                      <div style={S.sectionTitle}>Trazabilidad — flujo de lotes</div>
                      <div style={S.grid}>
                        {verQC && (
                          <>
                            <button style={S.kpi('#D97706', true)} onClick={() => navigate('/produccion')}>
                              <div style={S.kpiLabel}>QC pendientes</div>
                              <div style={{
                                ...S.kpiValue,
                                color: (d.trazabilidad.lotesQCPendientes || 0) > 0 ? 'var(--lp-warning-700)' : 'var(--lp-text-tertiary)',
                              }}>{d.trazabilidad.lotesQCPendientes || 0}</div>
                              <div style={S.kpiSub}>Lotes producidos esperando revisión</div>
                            </button>
                            <button style={S.kpi('var(--lp-danger-600)', true)} onClick={() => navigate('/trazabilidad')}>
                              <div style={S.kpiLabel}>QC retenidos</div>
                              <div style={{
                                ...S.kpiValue,
                                color: (d.trazabilidad.lotesQCHold || 0) > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)',
                              }}>{d.trazabilidad.lotesQCHold || 0}</div>
                              <div style={S.kpiSub}>Requieren retrabajo</div>
                            </button>
                          </>
                        )}
                        {verEnCamino && (
                          <button style={S.kpi('var(--lp-success-600)', true)} onClick={() => navigate('/almacen')}>
                            <div style={S.kpiLabel}>En camino a almacén</div>
                            <div style={{ ...S.kpiValue }}>{d.trazabilidad.lotesEnCamino || 0}</div>
                            <div style={S.kpiSub}>Por confirmar recepción</div>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* ════════ Sección 3 — Top productos del mes ════════
                Solo visible para admin/compras (mismo permiso que /api/dashboard/exec).
                Otros roles (Enrique, Josué, Luis) no necesitan ver esto. */}
            {(can('admin') || can('compras')) && (
            <div style={S.section}>
              <div style={S.sectionTitle}>
                Top {Math.min(5, (d.topProductos || []).length)} productos del mes
              </div>
              <div style={S.topPanel}>
                {!Array.isArray(d.topProductos) ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--lp-text-tertiary)', fontSize: 12 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--lp-warning-600)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
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
                    /* Paleta diversa para top productos — uno por rank, fácil distinguir */
                    const COLORES_RANK = ['#7C3AED', '#0F6E56', '#D97706', '#D85A30', '#534AB7'];
                    return d.topProductos.map((p, i) => {
                      const pct = (p.cubetas / max) * 100;
                      const accent = COLORES_RANK[i] || '#7C3AED';
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
              <div style={S.trendPanel}>
                {!Array.isArray(d.serie12m) ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--lp-text-tertiary)', fontSize: 12 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--lp-warning-600)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
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
                    const NOMBRES_MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
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
                                ({NOMBRES_MES[parseInt(d.statsTrend.mejorMes.mes.slice(5,7))-1]})
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
