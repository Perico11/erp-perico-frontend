import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useConfirm from '../../hooks/useConfirm';
import HelpHint from '../../components/HelpHint';
import SegmentedControl from '../../components/ui/SegmentedControl';
import Cronometro from '../../components/Cronometro';
import NDAModal from '../../components/NDAModal';
import NuevoPedidoModal from './NuevoPedidoModal';
import PedidoLoteActions from '../../components/PedidoLoteActions';
import PruebaBadge from '../../components/ui/PruebaBadge';
import {
  ESTADO_PEDIDO_LABEL as ESTADO_LABEL,
  ESTADO_PEDIDO_COLOR as ESTADO_COLOR,
} from '../../lib/estados';

const S = {
  wrap: { padding: '0 20px 100px' },
  toolbar: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 },
  btn: (kind = 'primary') => ({
    padding: '9px 16px', fontSize: 13, fontWeight: 600,
    background: kind === 'primary' ? 'var(--lp-brand-600)' : 'var(--lp-bg-base)',
    color: kind === 'primary' ? '#fff' : 'var(--lp-text-primary)',
    border: '1.5px solid ' + (kind === 'primary' ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'),
    borderRadius: 'var(--lp-radius-sm)', cursor: 'pointer', fontFamily: 'inherit',
  }),
  metric: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 },
  metricCard: (color) => ({
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderTop: `3px solid ${color}`,
    borderRadius: 'var(--lp-radius)', padding: '12px 14px',
  }),
  metricVal: { fontSize: 22, fontWeight: 800, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  metricLabel: { fontSize: 11, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, fontWeight: 700 },
  /* FIX bug visual del card:
     Antes: display:flex + flex-wrap apilaba los botones verticalmente sin
     estructura, creando el efecto "Aceptar arriba / Rechazar abajo".
     Ahora: layout vertical claro con header, cuerpo y footer con grid 2 cols
     para botones lado-a-lado (responsive: en pantallas <360px se apilan). */
  pedidoCard: (estado) => ({
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderTop: `3px solid ${ESTADO_COLOR[estado] || 'var(--lp-border-strong)'}`,
    borderRadius: 'var(--lp-radius)',
    padding: '14px 16px', marginBottom: 8,
    display: 'flex', flexDirection: 'column', gap: 12,
  }),
  pedidoHeader: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  },
  pedidoBody: { display: 'flex', flexDirection: 'column', gap: 4 },
  pedidoActions: {
    display: 'grid', gap: 8,
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    marginTop: 4,
  },
  pedidoMain: { flex: 1, minWidth: 220 }, /* legacy, dejado por compatibilidad */
  pedidoId: { fontSize: 11, fontWeight: 700, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' },
  pedidoTitle: { fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)' },
  pedidoMeta: { fontSize: 11, color: 'var(--lp-text-tertiary)', lineHeight: 1.5 },
  estadoBadge: (estado) => ({
    display: 'inline-block', padding: '3px 8px', fontSize: 10, fontWeight: 700,
    background: ESTADO_COLOR[estado] || '#9C9589', color: '#fff',
    borderRadius: 4, textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  empty: { textAlign: 'center', padding: '40px 0', color: 'var(--lp-text-tertiary)', fontSize: 13 },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 12 },
};

/* X3 (jun 2026): ESTADO_COLOR y ESTADO_LABEL ahora vienen de lib/estados.js
   con alias. Antes vivían duplicados aquí (shape distinto al de OrdenesPage
   y DashboardPage). Centralizando se eliminó el drift. */

export default function PedidosPage() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
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

  /* Callback cuando el usuario acepta el NDA */
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

  return (
    <div>
      <TopBar title="Pedidos" />
      <div style={S.wrap}>
        <HelpHint id="pedidos-flujo" title="Cómo funciona el flujo de pedidos">
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li><strong>Almacén</strong> crea un pedido (producto + cantidad + solicitante).</li>
            <li><strong>Técnico (Enrique)</strong> lo ve aquí, lo acepta y lanza la orden de producción.</li>
            <li>El pedido cambia de estado automáticamente: <em>pendiente → aceptado → en_produccion → producido → QC → envasado → en_camino → entregado</em>.</li>
            <li>Cualquier rol con permiso puede ver el progreso aquí.</li>
          </ol>
        </HelpHint>

        {err && <div style={S.err}>{err}</div>}

        {/* KPIs */}
        <div style={S.metric}>
          <div style={S.metricCard('var(--lp-text-tertiary)')}>
            <div style={{ ...S.metricVal, color: k.pendientes > 0 ? 'var(--lp-warning-700)' : 'var(--lp-text-primary)' }}>{k.pendientes}</div>
            <div style={S.metricLabel}>Pendientes</div>
          </div>
          <div style={S.metricCard('var(--lp-warning-600)')}>
            <div style={S.metricVal}>{k.enProduccion}</div>
            <div style={S.metricLabel}>En producción</div>
          </div>
          <div style={S.metricCard('var(--lp-info-600)')}>
            <div style={S.metricVal}>{k.enQC}</div>
            <div style={S.metricLabel}>En QC</div>
          </div>
          <div style={S.metricCard('var(--lp-warning-500)')}>
            <div style={S.metricVal}>{k.enEnvasado}</div>
            <div style={S.metricLabel}>Envasando</div>
          </div>
          <div style={S.metricCard('var(--lp-warning-600)')}>
            <div style={S.metricVal}>{k.enCamino}</div>
            <div style={S.metricLabel}>En camino</div>
          </div>
          <div style={S.metricCard('var(--lp-success-600)')}>
            <div style={S.metricVal}>{k.entregados}</div>
            <div style={S.metricLabel}>Entregados</div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={S.toolbar}>
          <SegmentedControl
            value={tab}
            onChange={setTab}
            color="brand"
            options={[
              { value: 'activos',    label: `Activos (${activos.length})` },
              ...(pruebas.length > 0    ? [{ value: 'pruebas',    label: `🧪 Pruebas (${pruebas.length})` }] : []),
              ...(rechazados.length > 0 ? [{ value: 'rechazados', label: `Rechazados (${rechazados.length})` }] : []),
              { value: 'historial',  label: `Historial (${historial.length})` },
            ]}
          />
          {canCrear && (
            <button style={{ ...S.btn('primary'), marginLeft: 'auto' }} onClick={() => setShowNuevo(true)}>
              + Nuevo pedido
            </button>
          )}
        </div>

        {/* Lista */}
        {loading && pedidos.length === 0 ? (
          <div style={S.empty}>Cargando pedidos…</div>
        ) : listaOrdenada.length === 0 ? (
          <div style={S.empty}>
            {tab === 'activos' ? 'No hay pedidos activos. ' + (canCrear ? 'Click "+ Nuevo pedido" para crear uno.' : 'Espera a que almacén cree uno.') : 'Sin pedidos en historial.'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 10,
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
            const tieneAcciones = mostrarAceptar || mostrarIniciar || mostrarIrProduccion || mostrarCancelar;
            return (
              <div key={p.id} style={S.pedidoCard(p.estado)}>
                {/* Header: ID + badge estado + cronómetro */}
                <div style={S.pedidoHeader}>
                  <span style={S.pedidoId}>{p.id}</span>
                  <span style={S.estadoBadge(p.estado)}>{ESTADO_LABEL[p.estado] || p.estado}</span>
                  {p.esPrueba && <PruebaBadge size="sm" />}
                  {p.estado === 'en_produccion' && p.fechaInicioProduccion && (
                    <Cronometro desde={p.fechaInicioProduccion} />
                  )}
                </div>

                {/* Cuerpo: título + metadata */}
                <div style={S.pedidoBody}>
                  <div style={S.pedidoTitle}>{p.producto} × {p.cantidad} cubetas</div>
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

                {/* Footer: acciones del pedido (solo un botón Cancelar, sin duplicados). */}
                {tieneAcciones && (
                  <div style={S.pedidoActions}>
                    {mostrarAceptar && (
                      <button
                        style={{ ...S.btn('primary'), gridColumn: mostrarCancelar ? 'auto' : '1 / -1' }}
                        disabled={busyId === p.id}
                        onClick={() => handleAceptar(p)}
                      >
                        {busyId === p.id ? '…' : '✓ Aceptar'}
                      </button>
                    )}
                    {mostrarIniciar && (
                      <button
                        style={{ ...S.btn('primary'), background: 'var(--lp-warning-600)', borderColor: 'var(--lp-warning-600)', gridColumn: mostrarCancelar ? 'auto' : '1 / -1' }}
                        disabled={busyId === p.id}
                        onClick={() => handleIniciarProduccion(p)}
                        title="Arranca el cronómetro y abre la pantalla de producción"
                      >
                        {busyId === p.id ? '…' : '▶ Iniciar producción'}
                      </button>
                    )}
                    {mostrarIrProduccion && (
                      <button
                        style={{ ...S.btn('primary'), gridColumn: mostrarCancelar ? 'auto' : '1 / -1' }}
                        onClick={() => navigate('/produccion')}
                        title="Ir a Producción para completar el lote"
                      >
                        Ir a Producción →
                      </button>
                    )}
                    {/* Botón UNIFICADO: Cancelar pedido. Para admin pide motivo + PIN
                        y revierte MP. Para técnico solo pide motivo y rechaza. */}
                    {mostrarCancelar && (
                      <button
                        style={{
                          ...S.btn('secondary'),
                          background: 'var(--lp-danger-100)',
                          color: 'var(--lp-danger-700)',
                          borderColor: 'var(--lp-danger-200)',
                        }}
                        disabled={busyId === p.id}
                        onClick={() => handleCancelar(p)}
                        title={user?.rol === 'admin'
                          ? 'Cancelar pedido (pide motivo + PIN; revierte MP si aplica)'
                          : 'Cancelar pedido (pide motivo)'}
                      >
                        {busyId === p.id ? '…' : 'Cancelar pedido'}
                      </button>
                    )}
                  </div>
                )}

                {/* Panel de acciones del LOTE asociado — punto único de control.
                    Aparece solo cuando ya hay lote en trazabilidad. Muestra
                    QC, marcar envasado, etc., según el estado y rol.
                    No se renderiza si el lote no existe (estado pendiente o aceptado). */}
                <PedidoLoteActions
                  pedido={p}
                  lotes={lotes}
                  userRol={user?.rol}
                  userName={user?.nombre || '?'}
                  onSuccess={(msg) => {
                    reload();
                    reloadTraz();
                    /* ack visual mínimo — usar setErr con sentido positivo */
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
