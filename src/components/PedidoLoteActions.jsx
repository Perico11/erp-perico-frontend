import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  getAccionesLote,
  LABELS_ACCION_LOTE,
  ESTADO_LOTE_LABEL,
  ESTADO_LOTE_COLOR,
} from '../lib/loteTransiciones';

/* ──────────────────────────────────────────────────────────────────── */
/* PedidoLoteActions                                                    */
/* ──────────────────────────────────────────────────────────────────── */
/* Componente compartido — vive dentro de la card de un pedido y ofrece */
/* TODAS las acciones del flujo de la state machine para el lote        */
/* asociado, sin que el usuario tenga que cambiar de pantalla.          */
/*                                                                      */
/* Lógica:                                                              */
/*  - Si el pedido aún NO tiene lote en trazabilidad (estado=pendiente, */
/*    aceptado, o en_produccion sin lote creado): no muestra nada       */
/*    (los botones Aceptar/Iniciar siguen viviendo en la card).         */
/*  - Si el pedido tiene un lote: aparecen los botones de la SM         */
/*    permitidos para el rol actual (aprobarQC, rechazarQC,             */
/*    marcarEnvasado) + atajos a pantallas (Envasar, Stock Fábrica).    */
/*                                                                      */
/* Esto permite usar la card del pedido como punto único de control sin */
/* obligar a buscar el lote en otra pestaña. Las pantallas              */
/* especializadas (ProduccionPage, StockFabricaPage) siguen existiendo  */
/* como flujos guiados; este panel es un atajo paralelo.                */
/* ──────────────────────────────────────────────────────────────────── */

const S = {
  wrap: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '10px 12px', marginTop: 8,
    background: 'var(--lp-bg-sunken)', borderRadius: 8,
    border: '1px solid var(--lp-border-subtle)',
  },
  loteHeader: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    fontSize: 11,
  },
  loteCod: {
    fontFamily: 'var(--lp-font-mono)', fontWeight: 700,
    color: 'var(--lp-brand-700)',
  },
  estadoBadge: (color) => ({
    display: 'inline-block', padding: '2px 8px', fontSize: 10, fontWeight: 700,
    background: color + '22', color, borderRadius: 4,
    textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  sublotesResumen: { fontSize: 11, color: 'var(--lp-text-tertiary)' },
  actions: {
    display: 'grid', gap: 6, flexWrap: 'wrap',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  },
  btn: (kind) => ({
    padding: '7px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)',
    border: 'none', borderRadius: 6, minHeight: 36,
    background: kind === 'success' ? 'var(--lp-success-600)'
              : kind === 'danger'  ? 'var(--lp-danger-600)'
              : kind === 'warn'    ? 'var(--lp-warning-600)'
              : kind === 'info'    ? 'var(--lp-info-600)'
              : kind === 'ghost'   ? 'var(--lp-bg-raised)'
              :                      'var(--lp-brand-600)',
    color: kind === 'ghost' ? 'var(--lp-text-primary)' : '#fff',
    border: kind === 'ghost' ? '1.5px solid var(--lp-border-subtle)' : 'none',
  }),
  errMsg: {
    fontSize: 11, padding: '6px 10px', borderRadius: 6,
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
  },
};

/* QC inline form — minimal, solo lo esencial */
function QCInline({ lote, accion, userName, onSuccess, onCancel }) {
  const [viscosidad, setViscosidad] = useState('');
  const [ph, setPh] = useState('');
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const aprobar = accion === 'aprobarQC';

  const handleSubmit = async () => {
    if (aprobar && (!viscosidad || !ph)) return setErr('Viscosidad y pH son requeridos para aprobar');
    if (!aprobar && !nota.trim()) return setErr('Indica el motivo del rechazo');
    setBusy(true); setErr('');
    try {
      await api.transicionLote(lote.id, accion, {
        qc: {
          viscosidad: viscosidad ? parseFloat(viscosidad) : null,
          ph: ph ? parseFloat(ph) : null,
          notas: nota,
          resultado: aprobar ? 'aprobado' : 'rechazado',
          fecha: new Date().toISOString(),
          usuario: userName,
        },
        motivo: nota,
        usuario: userName,
      });
      /* Registro paralelo en el ledger inmutable de QC */
      try {
        await api.registrarQC({
          id: Date.now().toString(36),
          loteId: lote.id,
          codigoLote: lote.codigoLote || lote.codigo,
          producto: lote.producto || lote.nombre,
          resultado: aprobar ? 'aprobado' : 'rechazado',
          viscosidad: viscosidad ? parseFloat(viscosidad) : null,
          ph: ph ? parseFloat(ph) : null,
          notas: nota,
          fecha: new Date().toISOString(),
          usuario: userName,
        });
      } catch {}
      onSuccess(`QC ${aprobar ? 'aprobado' : 'rechazado'}: ${lote.producto || lote.codigo}`);
    } catch (e) {
      setErr(e.message || 'Error al registrar QC');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      padding: 10, marginTop: 6, borderRadius: 8,
      background: 'var(--lp-bg-raised)',
      border: '1.5px solid ' + (aprobar ? 'var(--lp-success-500)' : 'var(--lp-danger-500)'),
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: aprobar ? 'var(--lp-success-700)' : 'var(--lp-danger-700)' }}>
        {aprobar ? 'Registrar QC — Aprobar' : 'Registrar QC — Rechazar'}
      </div>
      {err && <div style={S.errMsg}>{err}</div>}
      {aprobar && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <input style={{ padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--lp-border-subtle)', fontSize: 12 }}
            type="number" step="0.1" placeholder="Viscosidad (KU)"
            value={viscosidad} onChange={e => setViscosidad(e.target.value)} />
          <input style={{ padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--lp-border-subtle)', fontSize: 12 }}
            type="number" step="0.1" placeholder="pH"
            value={ph} onChange={e => setPh(e.target.value)} />
        </div>
      )}
      <textarea style={{
        width: '100%', padding: '8px 10px', marginTop: 6,
        borderRadius: 6, border: '1.5px solid var(--lp-border-subtle)',
        fontSize: 12, fontFamily: 'inherit', resize: 'vertical', minHeight: 50,
        boxSizing: 'border-box',
      }}
        placeholder={aprobar ? 'Notas (opcional)' : 'Motivo del rechazo (requerido)'}
        value={nota} onChange={e => setNota(e.target.value)} />
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button style={S.btn(aprobar ? 'success' : 'danger')} disabled={busy} onClick={handleSubmit}>
          {busy ? 'Guardando…' : (aprobar ? '✓ Aprobar QC' : '✕ Rechazar QC')}
        </button>
        <button style={S.btn('ghost')} onClick={onCancel} disabled={busy}>Cancelar</button>
      </div>
    </div>
  );
}

export default function PedidoLoteActions({ pedido, lotes, userRol, userName, onSuccess, onError }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [qcMode, setQcMode] = useState(null); /* 'aprobarQC' | 'rechazarQC' | null */

  /* Resolver el lote asociado al pedido */
  const lote = useMemo(() => {
    if (!pedido || !Array.isArray(lotes)) return null;
    return lotes.find(l => l && !l.eliminado && (
      (l.pedidoId && l.pedidoId === pedido.id) ||
      (l.ordenId && l.ordenId === pedido.id)
    )) || null;
  }, [pedido, lotes]);

  if (!lote) return null;

  const acciones = getAccionesLote(lote, userRol);
  const sublotes = Array.isArray(lote.sublotes) ? lote.sublotes : [];
  const sublotesActivos = sublotes.filter(s => !s.esMerma && s.estado !== 'cancelado');
  const litTotal = Number(lote.litrosTotal) || 0;
  /* Evitar doble conteo TOTE + hijos finales */
  let litUsed = 0;
  sublotes.forEach(s => {
    const lit = Number(s.lit) || 0;
    const isTote = s.tipo === 'tote' || s.fase === 1 || s.claseSublote === 'tote';
    if (!isTote) { litUsed += lit; }
    else {
      const tieneHijos = sublotes.some(h => h !== s && (h.fromTote === s.cod || h.esHijoDe === s.cod));
      if (!tieneHijos) litUsed += lit;
    }
  });
  const pctEnvasado = litTotal > 0 ? Math.round((litUsed / litTotal) * 100) : 0;

  const estColor = ESTADO_LOTE_COLOR[lote.estado] || '#6B6560';
  const estLabel = ESTADO_LOTE_LABEL[lote.estado] || lote.estado;

  const handleTransicion = async (accion, payload = {}) => {
    setBusy(accion);
    try {
      await api.transicionLote(lote.id, accion, { ...payload, usuario: userName });
      if (onSuccess) onSuccess(`${LABELS_ACCION_LOTE[accion] || accion}: ${lote.producto || lote.codigo}`);
    } catch (e) {
      if (onError) onError(e.message || 'Error al ejecutar acción');
    } finally {
      setBusy('');
    }
  };

  /* Botón para acción canónica */
  const renderBoton = (accion) => {
    if (qcMode) return null; /* mientras estamos en el form QC, ocultar otros */
    const label = LABELS_ACCION_LOTE[accion] || accion;
    const isBusy = busy === accion;
    const kindMap = {
      aceptarPedido:        'primary',
      rechazarPedido:       'danger',
      iniciarProduccion:    'warn',
      finalizarProduccion:  'info',
      aprobarQC:            'success',
      rechazarQC:           'danger',
      reabrirProduccion:    'warn',
      marcarEnvasado:       'info',
      cancelarLote:         'danger',
    };
    /* Las acciones QC abren el form inline en lugar de despachar directo */
    if (accion === 'aprobarQC' || accion === 'rechazarQC') {
      return (
        <button key={accion} style={S.btn(kindMap[accion])} onClick={() => setQcMode(accion)}>
          {accion === 'aprobarQC' ? '✓ Aprobar QC' : '✕ Rechazar QC'}
        </button>
      );
    }
    return (
      <button
        key={accion}
        style={S.btn(kindMap[accion])}
        disabled={!!busy}
        onClick={() => handleTransicion(accion)}
      >
        {isBusy ? '…' : label}
      </button>
    );
  };

  /* Shortcut: ir a Stock Fábrica para envasar / Stock Fábrica para gestionar sublotes */
  const puedeEnvasar = (lote.estado === 'qc_aprobado' || lote.estado === 'producido' || lote.estado === 'en_envasado' || lote.estado === 'envasado')
                     && (userRol === 'tecnico' || userRol === 'almacen' || userRol === 'admin');
  const tieneSublotes = sublotes.length > 0;

  /* FIX jun 2026 (Sprint Q1): "Enviar a recolectar" como botón principal
     cuando el lote esté envasado y haya sublotes en estado 'envasado' que
     todavía no han sido marcados para recolección. Solo almacen/admin
     (los que controlan el almacén Terán). Marca todos los sublotes elegibles
     vía /api/sublotes/scan-bulk con accion='marcarRecoleccion' — esto
     dispara push a Luis automáticamente vía NOTIF_TARGETS_POR_EVENTO. */
  const puedeEnviarRecolectar =
    lote.estado === 'envasado' &&
    (userRol === 'almacen' || userRol === 'admin') &&
    sublotes.some(s => s.estado === 'envasado' && !s.esMerma);

  /* FIX jun 2026 (Sprint O4): atajos para Josué en la card del pedido.
     - Si hay sublotes 'en_camino' → botón "Recibir (escanear)" lleva a la
       pantalla canónica /almacen-recepcion donde está el scanner QR.
     - Si hay TOTEs 'tote_activo' (ya recibidos en Terán, esperando re-envase)
       → botón "Re-envasar TOTE" lleva al buffer en la misma pantalla.
     Ambos NAVEGAN (no duplican UI) — la fuente de verdad sigue siendo
     AlmacenRecepcionPage; aquí solo damos el shortcut contextual. */
  const sublotesEnCamino = sublotes.filter(s => s.estado === 'en_camino' && !s.esMerma);
  const totesActivos = sublotes.filter(s => {
    const esTote = s.claseSublote === 'tote' || s.tipo === 'tote' || s.fase === 1;
    if (!esTote || s.esMerma) return false;
    if (s.estado === 'tote_vaciado' || s.estado === 'cancelado') return false;
    const lr = typeof s.litrosRestante === 'number' ? s.litrosRestante : Number(s.lit) || 0;
    return lr > 0.5 && (s.ub === 'teran' || s.estado === 'tote_activo');
  });
  const puedeRecibirEnTeran = sublotesEnCamino.length > 0
    && (userRol === 'almacen' || userRol === 'admin');
  const puedeReenvasarTote = totesActivos.length > 0
    && (userRol === 'almacen' || userRol === 'admin' || userRol === 'tecnico');

  const handleEnviarRecolectar = async () => {
    setBusy('enviarRecolectar');
    try {
      const elegibles = sublotes.filter(s => s.estado === 'envasado' && !s.esMerma).length;
      const r = await api.post('/api/sublotes/scan-bulk', {
        loteId: lote.id,
        accion: 'marcarRecoleccion',
      });
      if (onSuccess) onSuccess(`${elegibles} sublote(s) listos — notificado a Luis`);
    } catch (e) {
      if (onError) onError(e.message || 'No se pudo enviar a recolectar');
    } finally {
      setBusy('');
    }
  };

  return (
    <div style={S.wrap}>
      {/* Header: lote asociado + estado */}
      <div style={S.loteHeader}>
        <span style={{ fontWeight: 600, color: 'var(--lp-text-secondary)' }}>Lote:</span>
        <span style={S.loteCod}>{lote.codigoLote || lote.codigo || lote.id}</span>
        <span style={S.estadoBadge(estColor)}>{estLabel}</span>
        {litTotal > 0 && pctEnvasado > 0 && (
          <span style={S.sublotesResumen}>· {pctEnvasado}% envasado ({litUsed.toFixed(0)}/{litTotal.toFixed(0)}L)</span>
        )}
        {tieneSublotes && (
          <span style={S.sublotesResumen}>· {sublotesActivos.length} sublote(s)</span>
        )}
      </div>

      {/* Botones de la state machine + atajos.
          FIX jun 2026 (Q1): cuando lote.estado='envasado' y aplica, sale
          "Enviar a recolectar" PRIMERO con estilo destacado (verde, abarca
          fila completa) — es la acción dominante en esa etapa para Josué.
          Los demás botones (Ver sublotes, Envasar si aplica, acciones SM)
          quedan al lado en sus celdas del grid. */}
      {!qcMode && (
        <>
          {puedeEnviarRecolectar && (
            <button
              style={{
                ...S.btn('success'),
                padding: '11px 14px',
                fontSize: 12.5,
                minHeight: 44,
                gridColumn: '1 / -1',
                marginBottom: 4,
                boxShadow: '0 2px 8px rgba(22,163,74,.18)',
              }}
              disabled={!!busy}
              onClick={handleEnviarRecolectar}
              title="Marcar todos los sublotes envasados como listos — Luis recibe notificación"
            >
              {busy === 'enviarRecolectar' ? '…' : '🚚 Enviar a recolectar'}
            </button>
          )}

          {/* O4: shortcut a recepción Terán cuando hay sublotes en camino */}
          {puedeRecibirEnTeran && (
            <button
              style={{
                ...S.btn('warn'),
                padding: '11px 14px',
                fontSize: 12.5,
                minHeight: 44,
                gridColumn: '1 / -1',
                marginBottom: 4,
              }}
              onClick={() => navigate('/almacen-recepcion')}
              title={`${sublotesEnCamino.length} sublote(s) en camino — escanear QR para recibir`}
            >
              Recibir en Terán · escanear QR ({sublotesEnCamino.length})
            </button>
          )}

          {/* O4: shortcut a re-envasar TOTE en Terán */}
          {puedeReenvasarTote && (
            <button
              style={{
                ...S.btn('info'),
                padding: '11px 14px',
                fontSize: 12.5,
                minHeight: 44,
                gridColumn: '1 / -1',
                marginBottom: 4,
                background: '#7C3AED', /* púrpura — color canónico del TOTE en toda la app */
                color: '#fff',
              }}
              onClick={() => navigate('/almacen-recepcion')}
              title={`${totesActivos.length} TOTE(s) activos — re-envasar en cubeta/galón/litro`}
            >
              Re-envasar TOTE en Terán ({totesActivos.length})
            </button>
          )}

          <div style={S.actions}>
            {acciones.map(a => renderBoton(a))}
            {puedeEnvasar && (
              <button style={S.btn('info')} onClick={() => navigate('/stock-fabrica')}>
                📦 Envasar
              </button>
            )}
            {tieneSublotes && (
              <button style={S.btn('ghost')} onClick={() => navigate('/stock-fabrica?lote=' + encodeURIComponent(lote.codigoLote || lote.codigo || lote.id))}>
                Ver sublotes
              </button>
            )}
            {!acciones.length && !puedeEnvasar && !tieneSublotes && !puedeEnviarRecolectar && !puedeRecibirEnTeran && !puedeReenvasarTote && (
              <span style={{ ...S.sublotesResumen, gridColumn: '1 / -1' }}>
                Sin acciones disponibles para tu rol en este estado.
              </span>
            )}
          </div>
        </>
      )}

      {/* Form QC inline */}
      {qcMode && (
        <QCInline
          lote={lote}
          accion={qcMode}
          userName={userName}
          onSuccess={(msg) => { setQcMode(null); onSuccess && onSuccess(msg); }}
          onCancel={() => setQcMode(null)}
        />
      )}
    </div>
  );
}
