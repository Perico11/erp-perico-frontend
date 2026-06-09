import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useConfirm from '../../hooks/useConfirm';
import useIsDesktop from '../../hooks/useIsDesktop';
import HelpHint from '../../components/HelpHint';
import Cronometro from '../../components/Cronometro';
import NDAModal from '../../components/NDAModal';
import NuevoPedidoModal from './NuevoPedidoModal';
import PedidoLoteActions from '../../components/PedidoLoteActions';
import PruebaBadge from '../../components/ui/PruebaBadge';
import {
  ESTADO_PEDIDO_LABEL as ESTADO_LABEL,
  ESTADO_PEDIDO_COLOR as ESTADO_COLOR,
} from '../../lib/estados';

/* ═══════════════════════════════════════════════════════════════════════
   PedidosPage — reskin "Claude Design" verde (jun 2026).

   Diseño 1:1 según los mockups del paquete entrega_v2:
     · ESCRITORIO (ERP Escritorio.html · SCREENS.pedidos): pills de filtro
       Activos/Pruebas/Historial + "+ Nuevo pedido" → grid g3 de cards anchas
       con folio, badge, mini-timeline y botón de acción por estado.
     · MÓVIL (ERP Móvil.html · S.pedidos): mismas pills + cards apiladas limpias.
     · STANDALONE (Pedidos.html · §7): "Eliminar pedido" SOLO admin; roles en
       Aceptar y producir / Iniciar / Rechazar / QC (data-id + data-rol).

   Tokens 100% var(--lp-*) (verde). Sin emojis → SVG line. mono para folios
   y cantidades. Botones nunca 100% width en escritorio. Touch ≥44px.

   LÓGICA INTACTA: todos los handlers, endpoints /api/pedidos/*, useRealtimeSync,
   useConfirm (NDA/confirm), esPrueba inmutable, PedidoLoteActions, el patrón
   "cerrar modal antes de await" del NDA, etc. Solo cambia la capa visual + el
   cableo de data-id → handler.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Iconos line (sin emojis) ─────────────────────────────────────────── */
const Icon = {
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  play: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  x: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  trash: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  ),
  flask: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.3h12.4a1.5 1.5 0 0 0 1.3-2.3L14 9.5V3" />
      <path d="M7 15h10" />
    </svg>
  ),
};

const S = {
  wrap: { padding: '0 20px 100px' },

  /* Toolbar: pills de filtro (izq) + "+ Nuevo pedido" (der) */
  toolbar: {
    display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16,
  },
  pillRow: { display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 },
  pill: (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    minHeight: 36, padding: '0 14px',
    borderRadius: 999,
    border: '1.5px solid ' + (active ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'),
    background: active ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)',
    color: active ? '#fff' : 'var(--lp-text-secondary)',
    fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap', transition: 'all .15s',
  }),
  pillCount: (active) => ({
    fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700,
    color: active ? '#fff' : 'var(--lp-text-tertiary)',
  }),
  newBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    minHeight: 44, padding: '0 18px',
    background: 'var(--lp-brand-600)', color: '#fff',
    border: '1.5px solid var(--lp-brand-600)', borderRadius: 999,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    whiteSpace: 'nowrap', flexShrink: 0,
  },

  /* KPIs */
  metric: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 },
  metricCard: (color) => ({
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderTop: `3px solid ${color}`,
    borderRadius: 'var(--lp-radius)', padding: '12px 14px',
  }),
  metricVal: { fontSize: 22, fontWeight: 800, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  metricLabel: { fontSize: 11, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, fontWeight: 700 },

  /* Card de pedido (radio 18px, header → mini-timeline → cuerpo → acciones) */
  pedidoCard: (estado, esPrueba) => ({
    background: esPrueba ? 'var(--lp-warning-50)' : 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderTop: `3px solid ${esPrueba ? 'var(--lp-warning-600)' : (ESTADO_COLOR[estado] || 'var(--lp-border-strong)')}`,
    borderRadius: 18,
    padding: '15px 16px',
    display: 'flex', flexDirection: 'column', gap: 12,
  }),
  pedidoHeader: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pedidoBody: { display: 'flex', flexDirection: 'column', gap: 4 },
  pedidoActions: {
    display: 'grid', gap: 8,
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    marginTop: 2,
  },
  pedidoId: { fontSize: 12, fontWeight: 600, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' },
  pedidoTitle: { fontSize: 15.5, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--lp-text-primary)' },
  pedidoMeta: { fontSize: 12, color: 'var(--lp-text-tertiary)', lineHeight: 1.5 },
  cantidad: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-text-secondary)' },
  estadoBadge: (estado) => ({
    display: 'inline-flex', alignItems: 'center', padding: '3px 9px', fontSize: 11, fontWeight: 700,
    background: (ESTADO_COLOR[estado] || '#9C9589') + '1f',
    color: ESTADO_COLOR[estado] || '#6B6560',
    borderRadius: 999, whiteSpace: 'nowrap',
  }),
  /* Botones de acción de la card */
  btn: (kind = 'primary') => ({
    minHeight: 44, padding: '0 16px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    borderRadius: 11,
    background: kind === 'primary' ? 'var(--lp-brand-600)'
              : kind === 'warning' ? 'var(--lp-warning-600)'
              : kind === 'danger'  ? 'var(--lp-danger-100)'
              :                      'var(--lp-bg-base)',
    color: (kind === 'primary' || kind === 'warning') ? '#fff'
         : kind === 'danger' ? 'var(--lp-danger-700)'
         :                     'var(--lp-text-secondary)',
    border: '1.5px solid ' + (
      kind === 'primary' ? 'var(--lp-brand-600)'
      : kind === 'warning' ? 'var(--lp-warning-600)'
      : kind === 'danger'  ? 'var(--lp-danger-200)'
      :                      'var(--lp-border-subtle)'),
    transition: 'transform .1s',
  }),

  empty: { textAlign: 'center', padding: '50px 0', color: 'var(--lp-text-tertiary)', fontSize: 13 },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 10, fontSize: 12, marginBottom: 12 },

  /* ── Mini pipeline horizontal por card ─────────────────────────────── */
  pipelineWrap: {
    display: 'flex', alignItems: 'center', gap: 0,
    padding: '6px 2px 2px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
  },
  pipelineStep: () => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, flex: '0 0 auto', minWidth: 52,
  }),
  pipelineDot: (estado, accent) => ({
    width: estado === 'current' ? 20 : 13, height: estado === 'current' ? 20 : 13,
    borderRadius: '50%',
    background: estado === 'pending' ? 'var(--lp-bg-sunken)' : accent,
    border: estado === 'pending' ? '1.5px solid var(--lp-border-default)' : 'none',
    boxShadow: estado === 'current' ? `0 0 0 4px ${accent}22` : 'none',
    transition: 'all .2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff',
  }),
  pipelineLabel: (estado) => ({
    fontSize: 8.5, fontWeight: estado === 'current' ? 700 : 500,
    color: estado === 'current' ? 'var(--lp-text-primary)'
         : estado === 'done'    ? 'var(--lp-text-secondary)'
         : 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '.03em', textAlign: 'center', whiteSpace: 'nowrap',
  }),
  pipelineLine: (done, accent) => ({
    flex: 1, height: 2,
    background: done ? accent : 'var(--lp-border-subtle)',
    minWidth: 12, marginBottom: 20,
    transition: 'background .2s',
  }),
};

/* Fases canónicas del pipeline de un pedido — espejo del backend.
   Cada fase agrupa varios estados internos (ej: aceptado + en_proceso
   son ambos "Aceptado"). Si el pedido está en cancelado/rechazado,
   no renderizamos el pipeline (no aplica). */
const PIPELINE_FASES = [
  { key: 'pendiente',  label: 'Pedido',     estados: ['pendiente'] },
  { key: 'aceptado',   label: 'Aceptado',   estados: ['aceptado', 'en_proceso'] },
  { key: 'produccion', label: 'Producción', estados: ['en_produccion', 'producido', 'qc_hold', 'qc_aprobado'] },
  { key: 'envasado',   label: 'Envasado',   estados: ['en_envasado', 'envasado'] },
  { key: 'camino',     label: 'En camino',  estados: ['en_recoleccion', 'en_camino'] },
  { key: 'entregado',  label: 'Entregado',  estados: ['en_almacen', 'entregado'] },
];

/* Devuelve el índice de fase actual del pedido (0..5) o -1 si no aplica */
function _idxFasePedido(estado) {
  const e = (estado || '').toLowerCase();
  for (let i = 0; i < PIPELINE_FASES.length; i++) {
    if (PIPELINE_FASES[i].estados.includes(e)) return i;
  }
  return -1;
}

/* Componente PipelinePedido — mini timeline horizontal por card */
function PipelinePedido({ estado, esPrueba }) {
  const idx = _idxFasePedido(estado);
  if (idx < 0) return null; /* cancelado/rechazado/eliminado: ocultar */
  const accent = esPrueba ? 'var(--lp-warning-600)' : 'var(--lp-brand-600)';
  /* Construimos un array plano de nodos (step + línea + step + ...) para
     que cada uno tenga key propia sin necesidad de Fragment con key. */
  const nodos = [];
  PIPELINE_FASES.forEach((fase, i) => {
    const st = i < idx ? 'done' : i === idx ? 'current' : 'pending';
    nodos.push(
      <div key={'s_' + fase.key} style={S.pipelineStep(st)}>
        <div style={S.pipelineDot(st, accent)}>
          {st === 'done' && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div style={S.pipelineLabel(st)}>{fase.label}</div>
      </div>
    );
    if (i < PIPELINE_FASES.length - 1) {
      nodos.push(
        <div key={'l_' + fase.key} style={S.pipelineLine(i < idx, accent)} />
      );
    }
  });
  return <div style={S.pipelineWrap}>{nodos}</div>;
}

/* X3 (jun 2026): ESTADO_COLOR y ESTADO_LABEL vienen de lib/estados.js. */

export default function PedidosPage() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('activos');
  const [showNuevo, setShowNuevo] = useState(false);
  /* Prefill desde otra pantalla (Inventario → "Pedir reposición" ?nuevo=BLANCO MATE) */
  const [prefillProducto, setPrefillProducto] = useState(null);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState('');
  const [confirm, ConfirmEl] = useConfirm();
  /* NDA gate — pendingProd guarda el pedido a iniciar mientras el usuario lee el NDA */
  const [pendingProd, setPendingProd] = useState(null);

  /* Si la URL trae ?nuevo=NombreProducto, abrir modal con prefill */
  useEffect(() => {
    const nuevo = searchParams.get('nuevo');
    if (nuevo) {
      setPrefillProducto(nuevo);
      setShowNuevo(true);
      /* Limpiar el query param para que un refresh no vuelva a abrir el modal */
      const params = new URLSearchParams(searchParams);
      params.delete('nuevo');
      setSearchParams(params, { replace: true });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const { data, loading, reload } = useApiData(() => api.getPedidos(), [], 8000);
  /* Trazabilidad: para resolver el lote asociado a cada pedido y mostrar las
     acciones de state machine directamente en la card. Polling lento — el WS
     trae los cambios en tiempo real. */
  const { data: trazData, reload: reloadTraz } = useApiData(() => api.getTrazabilidad(), [], 30000);
  const lotes = useMemo(() => {
    const arr = trazData?.data || trazData || [];
    return Array.isArray(arr) ? arr : [];
  }, [trazData]);

  /* Realtime: refrescar cuando hay cambios */
  useRealtimeSync({
    onPedidos: () => reload(),
    onOrdenes: () => reload(),
    onTrazabilidad: () => { reload(); reloadTraz(); },
  });

  const pedidos = useMemo(() => {
    const arr = Array.isArray(data) ? data : (data?.data || []);
    /* CRÍTICO: filtrar pedidos marcados como eliminados (estado='eliminado'
       o flag eliminado=true). El backend marca soft-delete para auditoría,
       pero el frontend NO debe mostrarlos en ninguna lista. Sin este filtro
       parecía que "el botón Cancelar no funcionaba" porque el pedido
       seguía visible aunque ya estaba eliminado en JSON. */
    return arr.filter(p => p && p.id && !p.eliminado && p.estado !== 'eliminado');
  }, [data]);

  /* Estados terminales = histórico */
  const TERMINALES = ['entregado', 'rechazado', 'cancelado'];
  /* Activos REALES (sin pruebas, sin terminales) */
  const activos    = pedidos.filter(p => !TERMINALES.includes(p.estado) && !p.esPrueba);
  /* Pruebas activas separadas */
  const pruebas    = pedidos.filter(p => !TERMINALES.includes(p.estado) && p.esPrueba);
  /* Rechazados / cancelados separados del histórico normal */
  const rechazados = pedidos.filter(p => p.estado === 'rechazado' || p.estado === 'cancelado');
  /* Historial = entregados (operación completada exitosa) */
  const historial  = pedidos.filter(p => p.estado === 'entregado' && !p.esPrueba);

  const k = useMemo(() => ({
    pendientes: pedidos.filter(p => p.estado === 'pendiente').length,
    enProduccion: pedidos.filter(p => ['aceptado', 'en_produccion'].includes(p.estado)).length,
    enQC: pedidos.filter(p => ['producido', 'qc_hold'].includes(p.estado)).length,
    enEnvasado: pedidos.filter(p => ['qc_aprobado', 'en_envasado'].includes(p.estado)).length,
    enCamino: pedidos.filter(p => ['envasado', 'en_recoleccion', 'en_camino'].includes(p.estado)).length,
    entregados: pedidos.filter(p => p.estado === 'entregado').length,
  }), [pedidos]);

  const canCrear = can('crearPedidos') || can('admin') || user?.rol === 'almacen';
  const canAceptar = can('admin') || user?.rol === 'tecnico';

  /* Sprint C: aceptar pedido AHORA crea orden atómicamente vía endpoint
     /api/pedidos/aceptar-y-producir. Antes hacía upsertPedido ciego, lo cual:
     (a) pisaba el estado si otro usuario lo había cambiado entre fetch y click,
     (b) dejaba el pedido sin orden vinculada (huérfano hasta que técnico la
         creara manualmente desde otra pantalla, frecuentemente sin pedidoId). */
  const handleAceptar = async (p) => {
    setErr(''); setBusyId(p.id);
    try {
      const r = await api.aceptarYProducir(p.id, { lanzarProduccion: false });
      if (!r?.ok) throw new Error(r?.error || 'No se pudo aceptar');
      reload();
    } catch (e) {
      setErr(e?.data?.error || e.message);
    } finally {
      setBusyId('');
    }
  };

  /* Cancelar pedido — UN solo botón unificado.
     - Admin: motivo + PIN → llama /api/pedidos/eliminar (cascada orden, revierte MP)
     - Otros roles autorizados (técnico) en pedidos no producidos: solo motivo,
       cambia estado a rechazado (sin PIN porque no hay MP que revertir aún)
     Se muestra siempre que el pedido NO esté en estado terminal. */
  const handleCancelar = async (p) => {
    setErr('');
    const esAdmin = user?.rol === 'admin';
    const yaProdujo = ['en_produccion','producido','qc_hold','qc_aprobado','en_envasado','envasado','en_recoleccion','en_camino','en_almacen'].includes(p.estado);

    /* Paso 1: motivo (común) */
    const motivo = await confirm(
      esAdmin
        ? `Vas a cancelar el pedido ${p.id} de ${p.producto}. ${yaProdujo ? 'Como ya entró a producción, se revertirán las materias primas consumidas. ' : ''}Indica el motivo para auditoría.`
        : `Vas a cancelar el pedido ${p.id} de ${p.producto}. Indica el motivo para dejar registro.`,
      {
        title: esAdmin ? 'Cancelar pedido — paso 1 de 2' : 'Cancelar pedido',
        confirmText: esAdmin ? 'Continuar' : 'Cancelar pedido',
        danger: true,
        prompt: {
          label: 'Motivo',
          placeholder: 'Ej: Pedido duplicado, error de captura, cliente canceló...',
          required: true,
          minLength: 5,
          rows: 3,
        },
      }
    );
    if (!motivo) return;

    /* Paso 2: PIN (solo admin) */
    let pin = null;
    if (esAdmin) {
      pin = await confirm(
        `Para confirmar, ingresa tu PIN (${user?.nombre}).`,
        {
          title: 'Cancelar pedido — paso 2 de 2',
          confirmText: 'Confirmar cancelación',
          danger: true,
          prompt: {
            label: 'PIN',
            placeholder: '0000',
            required: true,
            minLength: 4, maxLength: 6,
            rows: 1, numeric: true, password: true,
          },
        }
      );
      if (!pin) return;
    }

    setBusyId(p.id);
    try {
      if (esAdmin) {
        const r = await api.eliminarPedido(p.id, user?.nombre, pin, motivo);
        const msg = `Pedido ${p.id} cancelado` +
          (r?.revirtioMP ? ' · MP revertida' : '') +
          (r?.ordenInfo ? ' · orden ' + r.ordenInfo.codigo + ' también' : '');
        console.log('[CANCELAR]', msg);
        setErr(''); /* limpiar errores previos */
      } else {
        await api.upsertPedido({
          ...p,
          estado: 'rechazado',
          rechazadoPor: user?.nombre,
          motivoRechazo: motivo,
          fechaRechazo: new Date().toISOString(),
        });
      }
      reload();
    } catch (e) {
      console.error('[CANCELAR] error:', e);
      setErr('No se pudo cancelar: ' + (e?.data?.error || e.message || 'error desconocido'));
    } finally {
      setBusyId('');
    }
  };

  /* §7 Eliminar pedido — SOLO admin (data-rol="admin").
     Distinto de Cancelar/Rechazar: borrado definitivo (soft-delete con
     auditoría) que también cae en cascada sobre la orden vinculada y revierte
     las materias primas si el pedido ya había entrado a producción. Pide
     motivo + PIN del admin, igual que la ruta admin de handleCancelar pero
     etiquetado explícitamente como "Eliminar" para coincidir con el mockup. */
  const handleEliminar = async (p) => {
    setErr('');
    const yaProdujo = ['en_produccion','producido','qc_hold','qc_aprobado','en_envasado','envasado','en_recoleccion','en_camino','en_almacen'].includes(p.estado);

    const motivo = await confirm(
      `Vas a ELIMINAR el pedido ${p.id} de ${p.producto}. ${yaProdujo ? 'Como ya entró a producción, se revertirán las materias primas consumidas. ' : ''}Esta acción queda registrada para auditoría. Indica el motivo.`,
      {
        title: 'Eliminar pedido — paso 1 de 2',
        confirmText: 'Continuar',
        danger: true,
        prompt: {
          label: 'Motivo',
          placeholder: 'Ej: Pedido duplicado, captura errónea...',
          required: true,
          minLength: 5,
          rows: 3,
        },
      }
    );
    if (!motivo) return;

    const pin = await confirm(
      `Para confirmar la eliminación, ingresa tu PIN (${user?.nombre}).`,
      {
        title: 'Eliminar pedido — paso 2 de 2',
        confirmText: 'Eliminar definitivamente',
        danger: true,
        prompt: {
          label: 'PIN',
          placeholder: '0000',
          required: true,
          minLength: 4, maxLength: 6,
          rows: 1, numeric: true, password: true,
        },
      }
    );
    if (!pin) return;

    setBusyId(p.id);
    try {
      const r = await api.eliminarPedido(p.id, user?.nombre, pin, motivo);
      const msg = `Pedido ${p.id} eliminado` +
        (r?.revirtioMP ? ' · MP revertida' : '') +
        (r?.ordenInfo ? ' · orden ' + r.ordenInfo.codigo + ' también' : '');
      console.log('[ELIMINAR]', msg);
      setErr('');
      reload();
    } catch (e) {
      console.error('[ELIMINAR] error:', e);
      setErr('No se pudo eliminar: ' + (e?.data?.error || e.message || 'error desconocido'));
    } finally {
      setBusyId('');
    }
  };

  /* Sprint C: arrancar producción usa endpoint canónico que CREA orden
     (si no existe) + avanza pedido a en_produccion + setea fechaInicio.
     Antes hacía upsertPedido ciego sin crear orden formal — los lotes
     producidos así NO aparecían en KPI "En Proceso" de Órdenes/Fábrica
     y se descuadraba la reportería. */
  const arrancarProduccion = async (p) => {
    if (!p) return;
    setBusyId(p.id);
    try {
      const r = await api.aceptarYProducir(p.id, { lanzarProduccion: true });
      if (!r?.ok) throw new Error(r?.error || 'No se pudo iniciar producción');
      reload();
      navigate('/produccion');
    } catch (e) {
      setErr(e?.data?.error || e.message);
    } finally {
      setBusyId('');
    }
  };

  /* Iniciar producción: muestra NDA al técnico/admin antes de arrancar.
     Bypass: Emmanuel (id='admin') es el propietario y arranca sin modal. */
  const handleIniciarProduccion = (p) => {
    setErr('');
    if (user && user.id === 'admin') {
      arrancarProduccion(p);
      return;
    }
    setPendingProd(p);  /* dispara el modal NDA */
  };

  /* Callback cuando el usuario acepta el NDA.
     OJO (Bug-NDA): cerramos el modal (setPendingProd null) ANTES del await
     para que no quede colgado mientras la producción arranca. No reordenar. */
  const handleNDAAccept = async () => {
    const p = pendingProd;
    setPendingProd(null);
    await arrancarProduccion(p);
  };

  const handleNDAReject = () => {
    setPendingProd(null);
    setErr('NDA rechazado — la producción NO se inició.');
  };

  const lista = tab === 'pruebas'    ? pruebas
              : tab === 'rechazados' ? rechazados
              : tab === 'historial'  ? historial
              :                        activos;
  /* Ordenar por fecha desc */
  const listaOrdenada = [...lista].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  /* Pills de filtro — Activos / Pruebas (si hay) / Rechazados (si hay) / Historial */
  const FILTROS = [
    { value: 'activos',    label: 'Activos',    count: activos.length,    flask: false },
    /* Pruebas SIEMPRE visible (sub-tab estándar), aunque no haya pedidos de prueba. */
    { value: 'pruebas',    label: 'Pruebas',    count: pruebas.length,    flask: true },
    ...(rechazados.length > 0 ? [{ value: 'rechazados', label: 'Rechazados', count: rechazados.length, flask: false }] : []),
    { value: 'historial',  label: 'Historial',  count: historial.length,  flask: false },
  ];

  return (
    <div>
      <TopBar
        title="Pedidos"
        action={canCrear ? (
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999, border: 'none', background: 'var(--lp-brand-600)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', minHeight: 40, whiteSpace: 'nowrap' }}
            data-id="pedidos.btn.nuevo"
            data-rol="almacen,admin,tecnico"
            onClick={() => setShowNuevo(true)}
          >
            {Icon.plus}{isDesktop ? 'Nuevo' : ''}
          </button>
        ) : null}
      />
      <div style={S.wrap}>
        {err && <div style={S.err}>{err}</div>}

        {/* Filtros (el botón "Nuevo" vive en el TopBar, estilo limpio) */}
        <div style={S.toolbar}>
          <div style={S.pillRow} role="tablist" aria-label="Filtro de pedidos">
            {FILTROS.map(f => {
              const active = tab === f.value;
              return (
                <button
                  key={f.value}
                  role="tab"
                  aria-selected={active}
                  style={S.pill(active)}
                  onClick={() => setTab(f.value)}
                >
                  {f.flask && Icon.flask}
                  {f.label}
                  <span style={S.pillCount(active)}>· {f.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista — escritorio: grid g3 (cards anchas). móvil: cards apiladas. */}
        {loading && pedidos.length === 0 ? (
          <div style={S.empty}>Cargando pedidos…</div>
        ) : listaOrdenada.length === 0 ? (
          <div style={S.empty}>
            {tab === 'activos' ? 'No hay pedidos activos. ' + (canCrear ? 'Toca "+ Nuevo pedido" para crear uno.' : 'Espera a que almacén cree uno.') : 'Sin pedidos en este filtro.'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(340px, 1fr))' : '1fr',
            gap: 12,
          }}>
          {listaOrdenada.map(p => {
            const mostrarAceptar = tab === 'activos' && p.estado === 'pendiente' && canAceptar;
            const mostrarIniciar = tab === 'activos' && p.estado === 'aceptado' && canAceptar;
            const mostrarIrProduccion = tab === 'activos' && p.estado === 'en_produccion' && canAceptar;
            /* Cancelar disponible siempre que el pedido no esté en estado terminal.
               Admin puede cancelar cualquier pedido (cascada orden + reversa MP).
               Técnico solo pedidos pendientes/aceptados (no producidos aún). */
            const esTerminal = TERMINALES.includes(p.estado);
            const puedeAdminCancelar = user?.rol === 'admin' && !esTerminal;
            const puedeTecnicoCancelar = canAceptar && !puedeAdminCancelar && ['pendiente', 'aceptado'].includes(p.estado);
            const mostrarCancelar = (puedeAdminCancelar || puedeTecnicoCancelar) && tab === 'activos';
            /* §7: Eliminar = SOLO admin. No se renderiza para otros roles.
               Disponible en cualquier filtro mientras el pedido no esté ya
               eliminado (los terminales sí pueden eliminarse del histórico). */
            const esAdmin = user?.rol === 'admin';
            const mostrarEliminar = esAdmin;
            const tieneAcciones = mostrarAceptar || mostrarIniciar || mostrarIrProduccion || mostrarCancelar || mostrarEliminar;
            return (
              <div key={p.id} style={S.pedidoCard(p.estado, p.esPrueba)}>
                {/* Header: folio + badge estado + prueba + cronómetro */}
                <div style={S.pedidoHeader}>
                  <span style={S.pedidoId}>{p.id}</span>
                  <span style={S.estadoBadge(p.estado)}>{ESTADO_LABEL[p.estado] || p.estado}</span>
                  {p.esPrueba && <PruebaBadge size="sm" />}
                  {p.estado === 'en_produccion' && p.fechaInicioProduccion && (
                    <span style={{ marginLeft: 'auto' }}>
                      <Cronometro desde={p.fechaInicioProduccion} />
                    </span>
                  )}
                </div>

                {/* Mini-pipeline horizontal del estado del pedido. Ayuda visual
                    rápida — el operario ve la fase de un vistazo. */}
                <PipelinePedido estado={p.estado} esPrueba={p.esPrueba} />

                {/* Cuerpo: título + metadata */}
                <div style={S.pedidoBody}>
                  <div style={S.pedidoTitle}>
                    {p.producto} <span style={S.cantidad}>× {p.cantidad} cub</span>
                  </div>
                  <div style={S.pedidoMeta}>
                    {p.solicitante && <>Solicitante: <strong>{p.solicitante}</strong></>}
                    {p.lote && <> · Lote: <code>{p.lote}</code></>}
                    {p.fecha && <> · {new Date(p.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</>}
                    {p.creadoPor && <> · por {p.creadoPor}</>}
                    {p.estado === 'en_produccion' && p.produccionIniciadaPor && (
                      <> · Producción por <strong>{p.produccionIniciadaPor}</strong></>
                    )}
                  </div>
                </div>

                {/* Footer: acciones del pedido por estado. data-id/data-rol del
                    mockup cableados a los handlers reales. */}
                {tieneAcciones && (
                  <div style={S.pedidoActions}>
                    {mostrarAceptar && (
                      <button
                        style={S.btn('primary')}
                        data-id="pedidos.btn.aceptar-producir"
                        data-rol="tecnico,admin"
                        disabled={busyId === p.id}
                        onClick={() => handleAceptar(p)}
                      >
                        {busyId === p.id ? '…' : <>{Icon.check} Aceptar</>}
                      </button>
                    )}
                    {mostrarIniciar && (
                      <button
                        style={S.btn('warning')}
                        data-id="pedidos.btn.iniciar-produccion"
                        data-rol="tecnico,admin"
                        disabled={busyId === p.id}
                        onClick={() => handleIniciarProduccion(p)}
                        title="Arranca el cronómetro y abre la pantalla de producción"
                      >
                        {busyId === p.id ? '…' : <>{Icon.play} Iniciar producción</>}
                      </button>
                    )}
                    {mostrarIrProduccion && (
                      <button
                        style={S.btn('primary')}
                        data-id="pedidos.btn.ir-produccion"
                        data-rol="tecnico,admin"
                        onClick={() => navigate('/produccion')}
                        title="Ir a Producción para completar el lote"
                      >
                        Ir a Producción {Icon.arrow}
                      </button>
                    )}
                    {/* Cancelar / Rechazar UNIFICADO. Admin: motivo + PIN +
                        reversa MP. Técnico: solo motivo → rechazado. */}
                    {mostrarCancelar && (
                      <button
                        style={S.btn('danger')}
                        data-id={user?.rol === 'admin' ? 'pedidos.btn.cancelar' : 'pedidos.btn.rechazar'}
                        data-rol="tecnico,admin"
                        disabled={busyId === p.id}
                        onClick={() => handleCancelar(p)}
                        title={user?.rol === 'admin'
                          ? 'Cancelar pedido (pide motivo + PIN; revierte MP si aplica)'
                          : 'Rechazar pedido (pide motivo)'}
                      >
                        {busyId === p.id ? '…' : <>{Icon.x} {user?.rol === 'admin' ? 'Cancelar' : 'Rechazar'}</>}
                      </button>
                    )}
                    {/* §7: Eliminar pedido — SOLO admin (data-rol="admin"). */}
                    {mostrarEliminar && (
                      <button
                        style={S.btn('danger')}
                        data-id="pedidos.btn.eliminar"
                        data-rol="admin"
                        disabled={busyId === p.id}
                        onClick={() => handleEliminar(p)}
                        title="Eliminar pedido definitivamente (solo admin; pide motivo + PIN)"
                      >
                        {busyId === p.id ? '…' : <>{Icon.trash} Eliminar</>}
                      </button>
                    )}
                  </div>
                )}

                {/* Panel de acciones del LOTE asociado — punto único de control.
                    Aparece solo cuando ya hay lote en trazabilidad. Muestra
                    QC (data-id="pedidos.btn.registrar-qc"), marcar envasado, etc.,
                    según el estado y rol. No se renderiza si el lote no existe. */}
                <PedidoLoteActions
                  pedido={p}
                  lotes={lotes}
                  userRol={user?.rol}
                  userName={user?.nombre || '?'}
                  onSuccess={() => {
                    reload();
                    reloadTraz();
                    /* ack visual mínimo — limpiar error previo */
                    setErr('');
                  }}
                  onError={(msg) => setErr(msg)}
                />
              </div>
            );
          })}
          </div>
        )}
      </div>

      {showNuevo && (
        <NuevoPedidoModal
          prefillProducto={prefillProducto}
          onClose={() => { setShowNuevo(false); setPrefillProducto(null); }}
          onCreated={() => { setShowNuevo(false); setPrefillProducto(null); reload(); }}
        />
      )}

      {/* Aviso NDA antes de iniciar producción — fórmula = secreto industrial */}
      {pendingProd && (
        <NDAModal
          user={user}
          context="produccion"
          productoNombre={pendingProd.producto}
          onAccept={handleNDAAccept}
          onReject={handleNDAReject}
        />
      )}
      {ConfirmEl}
    </div>
  );
}
