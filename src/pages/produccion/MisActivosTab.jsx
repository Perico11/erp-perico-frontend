/* MisActivosTab — Sprint H (jun 2026).

   Vista unificada para Enrique (técnico) que muestra TODOS sus pedidos/lotes
   activos en una sola tabla, sin importar el estado actual. Antes el pedido
   "saltaba" entre tabs de ProduccionPage según su estado (Lanzar lote → Calidad
   QC → Reportes) y Enrique perdía el hilo del avance.

   Ahora ve cada pedido con su timeline visual del status y un botón contextual
   que lo lleva a la acción siguiente según el estado.
*/
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const PASOS = [
  { key: 'aceptado',       label: 'Aceptado',    short: 'Acep' },
  { key: 'en_produccion',  label: 'Producción',  short: 'Prod' },
  { key: 'producido',      label: 'Terminado',   short: 'Term' },
  { key: 'qc_aprobado',    label: 'QC OK',       short: 'QC' },
  { key: 'en_envasado',    label: 'Envasando',   short: 'Env' },
  { key: 'envasado',       label: 'Listo',       short: 'Listo' },
  { key: 'en_recoleccion', label: 'Recolección', short: 'Recol' },
  { key: 'en_camino',      label: 'En camino',   short: 'Cam' },
  { key: 'en_almacen',     label: 'En Terán',    short: 'Terán' },
  { key: 'entregado',      label: 'Entregado',   short: 'OK' },
];

function _idxPaso(estado) {
  const i = PASOS.findIndex(p => p.key === estado);
  return i >= 0 ? i : 0;
}

/* Mapa estado → acción siguiente para Enrique. Le muestra el botón correcto
   contextualmente. Si el estado ya escapó del workflow de Enrique (en Luis o
   Josué), el botón muestra solo info (no acción).
   FIX jun 2026 (M1): "Continuar wizard" antes solo cambiaba la tab y no abría
   el wizard. Ahora pasa `continuar=<id>` para que ProduccionPage abra
   automáticamente ProduccionFlow del lote en curso. */
function accionContextual(estado, navigate, itemId) {
  const id = encodeURIComponent(itemId || '');
  switch (estado) {
    case 'pendiente':
    case 'aceptado':
      return { label: '▶ Iniciar producción', primary: true,
               onClick: () => navigate('/pedidos') };
    case 'en_produccion':
      return { label: 'Continuar wizard', primary: true,
               onClick: () => navigate('/produccion?tab=produccion&continuar=' + id) };
    case 'producido':
      return { label: 'Envasar', primary: true,
               onClick: () => navigate('/stock-fabrica') };
    case 'qc_hold':
      return { label: 'Resolver QC', primary: true,
               onClick: () => navigate('/produccion?tab=calidad') };
    case 'qc_aprobado':
    case 'en_envasado':
      return { label: 'Continuar envasado', primary: true,
               onClick: () => navigate('/stock-fabrica') };
    case 'envasado':
      return { label: 'Listo — Luis recogerá', primary: false,
               onClick: () => navigate('/stock-fabrica') };
    case 'en_recoleccion':
    case 'en_camino':
      return { label: 'En manos de Luis', primary: false, disabled: true };
    case 'en_almacen':
    case 'entregado':
      return { label: 'Entregado a Terán', primary: false, disabled: true };
    default:
      return { label: 'Ver detalle', primary: false,
               onClick: () => navigate('/trazabilidad') };
  }
}

const S = {
  wrap: { padding: '4px 0' },
  empty: {
    padding: '40px 20px', textAlign: 'center',
    color: 'var(--lp-text-tertiary)', fontSize: 13,
  },
  card: (esPrueba) => ({
    background: esPrueba ? 'var(--lp-warning-50)' : 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius)',
    border: '1.5px solid ' + (esPrueba ? 'var(--lp-warning-500)' : 'var(--lp-border-subtle)'),
    borderLeft: esPrueba ? '4px solid var(--lp-warning-600)' : '1.5px solid var(--lp-border-subtle)',
    padding: 14, marginBottom: 10,
  }),
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, gap: 10, flexWrap: 'wrap',
  },
  codigo: {
    fontFamily: 'var(--lp-font-mono)', fontSize: 11, fontWeight: 600,
    color: 'var(--lp-text-tertiary)',
  },
  producto: {
    fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)',
    flex: 1, minWidth: 200,
  },
  meta: {
    fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2,
  },
  badge: (color) => ({
    display: 'inline-block', padding: '3px 10px',
    borderRadius: 12, fontSize: 11, fontWeight: 700,
    background: color, color: '#fff', whiteSpace: 'nowrap',
  }),
  timeline: {
    display: 'flex', alignItems: 'center', gap: 0,
    margin: '10px 0', overflowX: 'auto', paddingBottom: 4,
  },
  step: {
    flex: '0 0 auto', display: 'flex', flexDirection: 'column',
    alignItems: 'center', minWidth: 55, position: 'relative',
  },
  dot: (done, current) => ({
    width: 14, height: 14, borderRadius: '50%',
    background: current ? 'var(--lp-brand-600)'
              : done ? 'var(--lp-success-500)'
              : 'var(--lp-border-subtle)',
    boxShadow: current ? '0 0 0 4px var(--lp-brand-100)' : 'none',
    zIndex: 2,
  }),
  line: (done) => ({
    flex: 1, height: 2,
    background: done ? 'var(--lp-success-500)' : 'var(--lp-border-subtle)',
    minWidth: 14,
  }),
  stepLabel: (done, current) => ({
    fontSize: 9, marginTop: 4,
    color: current ? 'var(--lp-brand-700)' : done ? 'var(--lp-success-700)' : 'var(--lp-text-tertiary)',
    fontWeight: current ? 700 : 400,
    textAlign: 'center', maxWidth: 50, lineHeight: 1.1,
  }),
  actions: {
    display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10,
    paddingTop: 10, borderTop: '1px solid var(--lp-border-subtle)',
  },
  btn: (primary, disabled) => ({
    padding: '10px 18px', minHeight: 44,
    borderRadius: 8, border: 'none',
    fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? 'var(--lp-bg-base)'
              : primary ? 'var(--lp-success-600)' : 'var(--lp-bg-raised)',
    color: disabled ? 'var(--lp-text-tertiary)'
         : primary ? '#fff' : 'var(--lp-text-primary)',
    border: !primary && !disabled ? '1.5px solid var(--lp-border-subtle)' : 'none',
    opacity: disabled ? 0.7 : 1,
  }),
};

export default function MisActivosTab({ pedidos, ordenes, lotes }) {
  const navigate = useNavigate();

  /* Construir lista unificada: pedidos activos + lotes activos.
     Un pedido y su lote son la MISMA cosa visualmente (mismo timeline).
     Si existe lote, usamos su estado (más actualizado). Sino, el estado del pedido. */
  const items = useMemo(() => {
    const result = [];
    /* Index lotes por pedidoId para lookup rápido */
    const loteByPedido = {};
    (lotes || []).forEach(l => {
      if (l && l.pedidoId && !l.eliminado) loteByPedido[l.pedidoId] = l;
    });
    /* Index órdenes por pedidoId para mostrar código de orden */
    const ordenByPedido = {};
    (ordenes || []).forEach(o => {
      if (o && o.pedidoId && !o.eliminado) ordenByPedido[o.pedidoId] = o;
    });

    /* 1. Pedidos activos (no terminales, no eliminados) */
    (pedidos || []).forEach(p => {
      if (!p || p.eliminado) return;
      if (['entregado', 'cancelado', 'rechazado'].includes(p.estado)) return;
      const lote = loteByPedido[p.id];
      const orden = ordenByPedido[p.id];
      /* El estado "real" más actualizado es el del lote si existe */
      const estado = lote?.estado || p.estado;
      result.push({
        id: p.id,
        codigo: p.codigo || p.id,
        codigoOrden: orden?.codigo,
        codigoLote: lote?.codigoLote || lote?.codigo,
        producto: p.producto || lote?.producto || lote?.nombre || '-',
        cantidad: p.cantidad,
        litPerUnit: p.litPerUnit || lote?.litPerUnit,
        esPrueba: !!p.esPrueba,
        solicitante: p.solicitante,
        estado,
        lote,
      });
    });

    /* 2. Lotes activos SIN pedido vinculado (órdenes internas) */
    (lotes || []).forEach(l => {
      if (!l || l.eliminado) return;
      if (l.pedidoId) return; /* ya está arriba via pedido */
      if (['entregado', 'cancelado'].includes(l.estado)) return;
      result.push({
        id: l.id,
        codigo: l.codigo || l.id,
        codigoLote: l.codigoLote || l.codigo,
        producto: l.producto || l.nombre || l.formula || '-',
        cantidad: l.cantidad,
        litPerUnit: l.litPerUnit,
        esPrueba: !!l.esPrueba,
        estado: l.estado,
        lote: l,
        origen: 'interna',
      });
    });

    /* Ordenar por estado más avanzado primero (los que están más cerca de entrega arriba) */
    result.sort((a, b) => _idxPaso(b.estado) - _idxPaso(a.estado));
    return result;
  }, [pedidos, ordenes, lotes]);

  if (items.length === 0) {
    return (
      <div style={S.empty}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 6 }}>
          No tienes pedidos ni lotes activos
        </div>
        <div>Cuando Almacén Terán cree un pedido, aparecerá aquí con su pipeline en tiempo real.</div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={{ fontSize: 13, color: 'var(--lp-text-tertiary)', marginBottom: 12 }}>
        {items.length} pedido{items.length !== 1 ? 's' : ''} activo{items.length !== 1 ? 's' : ''} —
        cada uno con su pipeline. El botón te lleva a la acción siguiente según el estado.
      </div>
      {items.map(it => {
        const idxActual = _idxPaso(it.estado);
        const estadoActual = PASOS[idxActual];
        const colorEstado = it.estado === 'qc_hold'      ? 'var(--lp-danger-600)'
                          : it.estado === 'envasado'      ? 'var(--lp-success-600)'
                          : it.estado === 'entregado'     ? 'var(--lp-success-700)'
                          : it.estado === 'en_recoleccion' || it.estado === 'en_camino'
                                                          ? 'var(--lp-warning-600)'
                          : 'var(--lp-brand-600)';
        const accion = accionContextual(it.estado, navigate, it.id);
        return (
          <div key={it.id} style={S.card(it.esPrueba)}>
            <div style={S.header}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.codigo}>
                  {it.codigo}
                  {it.codigoOrden && ` · ${it.codigoOrden}`}
                  {it.codigoLote && ` · ${it.codigoLote}`}
                  {it.esPrueba && ' · 🧪 PRUEBA'}
                  {it.origen === 'interna' && ' · INTERNA'}
                </div>
                <div style={S.producto}>{it.producto}</div>
                {(it.solicitante || it.cantidad) && (
                  <div style={S.meta}>
                    {it.cantidad && `${it.cantidad} ${it.litPerUnit === 19 ? 'cubetas' : 'unidades'}`}
                    {it.solicitante && ` · solicitante ${it.solicitante}`}
                  </div>
                )}
              </div>
              <span style={S.badge(colorEstado)}>{estadoActual.label}</span>
            </div>

            {/* Timeline horizontal */}
            <div style={S.timeline}>
              {PASOS.map((paso, i) => {
                const done = i < idxActual;
                const current = i === idxActual;
                return (
                  <div key={paso.key} style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
                    <div style={S.step}>
                      <div style={S.dot(done, current)} />
                      <div style={S.stepLabel(done, current)}>{paso.short}</div>
                    </div>
                    {i < PASOS.length - 1 && <div style={S.line(done)} />}
                  </div>
                );
              })}
            </div>

            <div style={S.actions}>
              <button
                style={S.btn(accion.primary, !!accion.disabled)}
                disabled={!!accion.disabled}
                onClick={accion.onClick}
              >
                {accion.label}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
