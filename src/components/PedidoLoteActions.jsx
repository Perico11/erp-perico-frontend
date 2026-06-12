import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  getAccionesLote,
  getAccionesSublote,
  LABELS_ACCION_LOTE,
  LABELS_ACCION_SUBLOTE,
  ESTADO_LOTE_LABEL,
  ESTADO_LOTE_COLOR,
  ESTADO_SUBLOTE_LABEL,
  ESTADO_SUBLOTE_COLOR,
} from '../lib/loteTransiciones';
import PruebaBadge from './ui/PruebaBadge';
import useConfirm from '../hooks/useConfirm';
import { QRScanner } from './QRModal';

/* Iconos SVG line (sin emojis) para los botones QC */
const IcoCheck = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
);
const IcoX = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: 4 }} aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

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
  /* Lenguaje M7 (paquete MOCKUP 7) — coherente con las cards de Pedidos para
     TODOS los roles que ven esta card (técnico/almacén/admin): acciones de
     avance = verde sólido dominante (el mockup no diferencia ámbar/azul),
     Aprobar QC = verde success, destructivas = outline danger tint,
     navegación/secundarias = ghost. Touch ≥44px. */
  btn: (kind) => {
    const destructiva = kind === 'danger';
    const ghost = kind === 'ghost';
    return {
      padding: '0 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      fontFamily: 'var(--lp-font-sans)',
      borderRadius: 12, minHeight: 44,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      background: destructiva ? 'color-mix(in srgb, var(--lp-danger-600) 10%, transparent)'
                : ghost ? 'transparent'
                : kind === 'success' ? 'var(--lp-success-600)'
                : 'var(--lp-brand-600)',
      color: destructiva ? 'var(--lp-danger-600)' : ghost ? 'var(--lp-text-secondary)' : '#fff',
      border: destructiva ? '1px solid color-mix(in srgb, var(--lp-danger-600) 35%, transparent)'
            : ghost ? '1px solid var(--lp-border-subtle)' : 'none',
    };
  },
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
        /* nota Y motivo: el guard del backend lee nota (jun 2026 — mandar solo
           motivo hacía que "Rechazar QC" diera 422 SIEMPRE). */
        nota: nota,
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
          {busy ? 'Guardando…' : (aprobar ? <><IcoCheck /> Aprobar QC</> : <><IcoX /> Rechazar QC</>)}
        </button>
        <button style={S.btn('ghost')} onClick={onCancel} disabled={busy}>Cancelar</button>
      </div>
    </div>
  );
}

export default function PedidoLoteActions({ pedido, lotes, userRol, userName, onSuccess, onError, onEnvasarInline, onReenvasarInline, ocultarVerSublotes }) {
  /* onEnvasarInline(lote) / onReenvasarInline(tote, lote): si se pasan (pantalla
     /flujo), los botones Envasar / Re-envasar abren el modal EN SITIO en vez de
     navegar a otra pestaña. Sin ellos, conservan el navigate (PedidosPage etc.).
     ocultarVerSublotes: en /flujo los sublotes ya se listan en la misma card —
     el botón sería un duplicado (feedback owner jun 2026). */
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [qcMode, setQcMode] = useState(null); /* 'aprobarQC' | 'rechazarQC' | null */
  const [scanRecepcion, setScanRecepcion] = useState(false); /* escáner QR de recepción Terán */
  /* FIX jun 2026 (bug "Ver sublotes roto"): los sublotes se EXPANDEN aquí mismo
     — antes navegaba a /stock-fabrica?lote= y con la regla en_almacen el lote
     caía fuera del tab default → pantalla vacía. Inline = imposible de romper. */
  const [verSubs, setVerSubs] = useState(false);
  const [confirm, ConfirmEl] = useConfirm();

  /* Resolver el lote asociado al pedido */
  const lote = useMemo(() => {
    if (!pedido || !Array.isArray(lotes)) return null;
    return lotes.find(l => l && !l.eliminado && (
      (l.pedidoId && l.pedidoId === pedido.id) ||
      (l.ordenId && l.ordenId === pedido.id)
    )) || null;
  }, [pedido, lotes]);

  if (!lote) return null;

  const sublotes = Array.isArray(lote.sublotes) ? lote.sublotes : [];
  /* FIX jun 2026 (auditoría A1/A4): el envasado se hace SOLO por el botón
     "Envasar" (EnvasadoModal), no por transiciones directas de la SM:
     - registrarEnvasado como botón avanzaría el lote a 'en_envasado' SIN crear
       sublotes (descuadra pct/roll-up). Se quita siempre.
     - marcarEnvasado sin sublotes siempre da 422 (botón fantasma). Se quita si
       no hay sublotes; con sublotes sí es válido (marcar 100% manual). */
  const acciones = getAccionesLote(lote, userRol).filter(a => {
    if (a === 'registrarEnvasado') return false;
    if (a === 'marcarEnvasado' && sublotes.length === 0) return false;
    return true;
  });
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
          {accion === 'aprobarQC' ? <><IcoCheck /> Aprobar QC</> : <><IcoX /> Rechazar QC</>}
        </button>
      );
    }
    /* FIX jun 2026 (auditoría): cancelarLote exige motivo (guard) — antes
       despachaba sin campo para indicarlo → 422 SIEMPRE. Prompt con nota. */
    if (accion === 'cancelarLote') {
      return (
        <button key={accion} style={S.btn('danger')} disabled={!!busy}
          onClick={async () => {
            const nota = await confirm(
              `Vas a CANCELAR el lote ${lote.codigoLote || lote.codigo || lote.id}. Indica el motivo (queda en auditoría).`,
              { title: 'Cancelar lote', confirmText: 'Cancelar lote', danger: true,
                prompt: { label: 'Motivo de cancelación', required: true, minLength: 5, maxLength: 300, rows: 2 } }
            );
            if (!nota) return;
            handleTransicion(accion, { nota, motivo: nota });
          }}>
          {isBusy ? '…' : label}
        </button>
      );
    }
    /* FIX jun 2026 (auditoría): finalizarProduccion exige payload.lotes (guard
       'Cantidad de lotes inválida') — antes despachaba vacío → 422 SIEMPRE
       (callejón sin salida tras reabrirProduccion). */
    const payloadExtra = accion === 'finalizarProduccion'
      ? { lotes: Number(lote.cantidad) || 1 }
      : {};
    return (
      <button
        key={accion}
        style={S.btn(kindMap[accion])}
        disabled={!!busy}
        onClick={() => handleTransicion(accion, payloadExtra)}
      >
        {isBusy ? '…' : label}
      </button>
    );
  };

  /* Shortcut: ir a Stock Fábrica para envasar / Stock Fábrica para gestionar sublotes */
  /* jun 2026: envasado = Enrique (técnico)/admin. Josué (almacén) ya NO envasa
     — su flujo arranca en "Enviar a recolectar". */
  const puedeEnvasar = (lote.estado === 'qc_aprobado' || lote.estado === 'producido' || lote.estado === 'en_envasado' || lote.estado === 'envasado')
                     && (userRol === 'tecnico' || userRol === 'admin');
  const tieneSublotes = sublotes.length > 0;

  /* FIX jun 2026 (Sprint Q1): "Enviar a recolectar" como botón principal
     cuando el lote esté envasado y haya sublotes en estado 'envasado' que
     todavía no han sido marcados para recolección. Solo almacen/admin
     (los que controlan el almacén Terán). Marca todos los sublotes elegibles
     vía /api/sublotes/scan-bulk con accion='marcarRecoleccion' — esto
     dispara push a Luis automáticamente vía NOTIF_TARGETS_POR_EVENTO. */
  /* FIX jun 2026 (auditoría #8): incluir 'en_proceso' — tras un despacho
     PARCIAL el roll-up deja el lote en_proceso y los sublotes 'envasado'
     restantes perdían el botón (quedaban huérfanos en esta card). */
  /* FEATURE dueño (jun 2026): orden INTERNA con destino 'teran' = emergencia
     (el técnico notó faltante en Terán sin pedido de Almacén). En ese caso el
     TÉCNICO también puede mandar a recolección — no depende de Josué, que ni
     sabe del faltante. Para todo lo demás sigue siendo almacen/admin. */
  const destinoTeran = pedido?.destino === 'teran';
  const puedeEnviarRecolectar =
    (lote.estado === 'envasado' || lote.estado === 'en_proceso') &&
    (userRol === 'almacen' || userRol === 'admin' || (userRol === 'tecnico' && destinoTeran)) &&
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
  /* Vaciar TOTE (merma) — cierre MANUAL del remanente (decisión owner 10 jun
     2026, revierte la auto-merma): doble gate rol explícito + SM espejo
     (getAccionesSublote exige estado tote_activo y rol admin/técnico). */
  const totesVaciables = totesActivos.filter(s =>
    (userRol === 'admin' || userRol === 'tecnico') &&
    getAccionesSublote(s, userRol).includes('vaciarTote')
  );
  const puedeVaciarTote = totesVaciables.length > 0;

  const handleEnviarRecolectar = async () => {
    /* FEFO: un lote CADUCADO no sale a recolección. El backend lo bloquea (guard
       en la state machine); aquí la UX: admin puede forzar con nota (auditado),
       el resto recibe aviso. */
    const caducado = lote.fechaCaducidad && new Date(lote.fechaCaducidad).getTime() < Date.now();
    let overridePayload = {};
    if (caducado) {
      const fecha = String(lote.fechaCaducidad).slice(0, 10);
      if (userRol !== 'admin') {
        if (onError) onError(`Lote CADUCADO (venció ${fecha}). No puede salir a recolección — avisa a un administrador.`);
        return;
      }
      const nota = await confirm(
        `Este lote está CADUCADO (venció ${fecha}). Despacharlo de todas formas requiere tu autorización y queda en auditoría. Indica el motivo.`,
        { title: 'Forzar despacho de lote caducado', confirmText: 'Forzar con esta nota', danger: true,
          prompt: { label: 'Motivo del override', placeholder: 'Ej: cliente lo acepta, uso no crítico…', required: true, minLength: 5, maxLength: 300, rows: 2 } }
      );
      if (!nota) return;
      overridePayload = { overrideCaducidad: true, notaOverride: nota };
    }
    setBusy('enviarRecolectar');
    try {
      const elegibles = sublotes.filter(s => s.estado === 'envasado' && !s.esMerma).length;
      const r = await api.post('/api/sublotes/scan-bulk', {
        loteId: lote.id,
        accion: 'marcarRecoleccion',
        ...overridePayload,
      });
      if (onSuccess) onSuccess(caducado ? `Lote caducado despachado con override — notificado a Luis` : `${elegibles} sublote(s) listos — notificado a Luis`);
    } catch (e) {
      if (onError) onError(e.message || 'No se pudo enviar a recolectar');
    } finally {
      setBusy('');
    }
  };

  /* Vaciar TOTE — confirm con nota OBLIGATORIA (guard del backend); el
     remanente se registra como sublote merma y el lote puede concluir. */
  const handleVaciarTote = async () => {
    const tote = totesVaciables[0];
    if (!tote) return;
    const lr = typeof tote.litrosRestante === 'number' ? tote.litrosRestante : Number(tote.lit) || 0;
    const nota = await confirm(
      `Vas a vaciar el TOTE ${tote.cod}: los ${lr.toFixed(2)} L restantes se registrarán como MERMA y el lote podrá concluir. Indica el motivo (queda en auditoría).`,
      { title: 'Vaciar TOTE (merma)', confirmText: 'Vaciar y registrar merma', danger: true,
        prompt: { label: 'Motivo del vaciado', placeholder: 'Ej: remanente no envasable, producto asentado…', required: true, minLength: 5, maxLength: 300, rows: 2 } }
    );
    if (!nota) return;
    setBusy('vaciarTote');
    try {
      await api.transicionSublote(tote.cod, 'vaciarTote', { nota });
      if (onSuccess) onSuccess(`TOTE ${tote.cod} vaciado — ${lr.toFixed(2)} L registrados como merma`);
    } catch (e) {
      if (onError) onError(e.message || 'No se pudo vaciar el TOTE');
    } finally {
      setBusy('');
    }
  };

  /* jun 2026 (decisión owner): "al recibir en Terán debe abrir el QR para
     escanear el lote y se registre en automático". El botón ya NO navega a
     otra pantalla — abre el escáner aquí mismo. Al leer el QR de la cubeta
     impresa por Enrique, el código resuelve el sublote y dispara
     escanearRecibirTeran (en_camino → en_stock_teran = alta como PT, o
     tote_activo si viene en TOTE). El escaneo físico ES la verificación:
     el endpoint /sublotes/scan resuelve el sublote por el código leído, así
     que el guard scanCod===cod se cumple intrínsecamente (no hay bypass
     manual). Si se lee el QR del LOTE completo, ofrece recibir todo en bulk. */
  const handleScanRecepcion = async (result) => {
    setScanRecepcion(false);
    const code = (result?.cod || result?.raw || '').trim();
    if (!code) { if (onError) onError('QR no reconocido'); return; }
    setBusy('recibirTeran');
    try {
      const r = await api.escanearSublote(code, 'escanearRecibirTeran');
      const s = r?.sublote;
      const esTote = s?.claseSublote === 'tote' || s?.tipo === 'tote';
      if (onSuccess) onSuccess(`${s?.cod || code} recibido en Terán${esTote ? ' (TOTE activo en buffer)' : ' (alta como PT)'}`);
    } catch (err) {
      const data = err?.data;
      if (data && data.matchTipo === 'lote_no_sublote' && data.loteId) {
        const ok = await confirm(
          `Escaneaste el QR del LOTE ${data.codigoLote || ''}. ¿Recibir TODOS los sublotes en camino del lote?`,
          { confirmText: 'Recibir todo el lote' }
        );
        if (ok) {
          try {
            const r2 = await api.escanearLoteBulk({ loteId: data.loteId, codigoLote: data.codigoLote, accion: 'escanearRecibirTeran', scanCod: code });
            const n = r2?.procesados?.length || 0;
            const omit = r2?.omitidos?.length || 0;
            if (onSuccess) onSuccess(`Lote recibido: ${n} sublote(s)${omit ? ` · ${omit} omitido(s)` : ''}`);
          } catch (e2) { if (onError) onError(e2.message || 'Bulk scan falló'); }
        }
      } else {
        if (onError) onError(err.message || 'El QR no coincide con un sublote en camino');
      }
    } finally {
      setBusy('');
    }
  };

  return (
    <div style={S.wrap}>
      {ConfirmEl}
      {scanRecepcion && <QRScanner onResult={handleScanRecepcion} onClose={() => setScanRecepcion(false)} />}
      {/* Header: lote asociado + estado */}
      <div style={S.loteHeader}>
        <span style={{ fontWeight: 600, color: 'var(--lp-text-secondary)' }}>Lote:</span>
        <span style={S.loteCod}>{lote.codigoLote || lote.codigo || lote.id}</span>
        {lote.esPrueba && <PruebaBadge size="sm" />}
        <span style={S.estadoBadge(estColor)}>{estLabel}</span>
        {/* Destino de orden interna (feature dueño jun 2026): visible para que
            todos sepan si esta producción se queda o va a Terán de emergencia. */}
        {pedido?.origen === 'interna' && pedido?.destino && (
          <span style={S.estadoBadge(pedido.destino === 'teran' ? 'var(--lp-warning-600)' : 'var(--lp-text-tertiary)')}>
            {pedido.destino === 'teran' ? '→ Terán (emergencia)' : 'Se queda en fábrica'}
          </span>
        )}
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
              {busy === 'enviarRecolectar' ? '…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Enviar a recolectar</span>}
            </button>
          )}

          {/* O4 + jun 2026: recibir en Terán = ABRIR EL ESCÁNER aquí mismo.
              Antes navegaba a /almacen-recepcion (2 pasos). Ahora el botón abre
              la cámara QR inline → al leer la cubeta se da de alta en automático
              (sin botón de "confirmar" manual que se salte el escaneo físico). */}
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
              disabled={busy === 'recibirTeran'}
              onClick={() => setScanRecepcion(true)}
              title={`${sublotesEnCamino.length} sublote(s) en camino — escanear QR de la cubeta para recibir`}
            >
              {busy === 'recibirTeran' ? 'Recibiendo…' : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="17.5" y1="17.5" x2="17.5" y2="17.5"/></svg>
                  Recibir en Terán · escanear QR ({sublotesEnCamino.length})
                </span>
              )}
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
                background: 'var(--lp-qc-600)', /* púrpura — color canónico del TOTE en toda la app */
                color: '#fff',
              }}
              onClick={() => onReenvasarInline
                ? onReenvasarInline(totesActivos[0], lote)
                /* FIX jun 2026 (censo menú): la ruta real es /almacen — el fallback
                   apuntaba a /almacen-recepcion (inexistente → Dashboard). */
                : navigate('/almacen?reenvasar=' + encodeURIComponent(totesActivos[0]?.cod || ''))}
              title={`${totesActivos.length} TOTE(s) activos — re-envasar en cubeta/galón/litro`}
            >
              Re-envasar TOTE en Terán ({totesActivos.length})
            </button>
          )}

          {/* Vaciar TOTE (merma) — cierre MANUAL del remanente (decisión owner
              10 jun 2026). Secundario discreto, ancho auto (nunca 100% en
              desktop): el wrap es flex column → alignSelf evita el stretch. */}
          {puedeVaciarTote && (
            <button
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', fontSize: 11.5, fontWeight: 600,
                fontFamily: 'var(--lp-font-sans)', cursor: 'pointer',
                borderRadius: 8, minHeight: 36, marginBottom: 4,
                background: 'transparent',
                border: '1px solid var(--lp-border-subtle)',
                color: 'var(--lp-danger-600)',
              }}
              disabled={!!busy}
              onClick={handleVaciarTote}
              title={`Registrar el remanente del TOTE ${totesVaciables[0]?.cod || ''} como merma y concluir el lote`}
            >
              {busy === 'vaciarTote' ? 'Vaciando…' : LABELS_ACCION_SUBLOTE.vaciarTote}
            </button>
          )}

          <div style={S.actions}>
            {acciones.map(a => renderBoton(a))}
            {puedeEnvasar && (
              <button style={{ ...S.btn('info'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={() => onEnvasarInline ? onEnvasarInline(lote) : navigate('/stock-fabrica')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>Envasar
              </button>
            )}
            {tieneSublotes && !ocultarVerSublotes && (
              <button style={S.btn('ghost')} onClick={() => setVerSubs(v => !v)}>
                {verSubs ? 'Ocultar sublotes' : `Ver sublotes (${sublotesActivos.length})`}
              </button>
            )}
            {!acciones.length && !puedeEnvasar && !tieneSublotes && !puedeEnviarRecolectar && !puedeRecibirEnTeran && !puedeReenvasarTote && (
              <span style={{ ...S.sublotesResumen, gridColumn: '1 / -1' }}>
                {/* FIX jun 2026: el mensaje genérico parecía botón faltante (reporte
                    owner: "no avanza a envasado"). Ahora dice QUIÉN sigue. */}
                {['producido', 'qc_aprobado', 'en_envasado'].includes(lote.estado)
                  ? 'Esperando envasado — lo hace el técnico (o admin) desde aquí o en Stock Fábrica. Tu turno llega en "Enviar a recolectar".'
                  : lote.estado === 'envasado' || lote.estado === 'en_proceso'
                    ? 'Envasado listo — Almacén (o admin) lo manda con "Enviar a recolectar".'
                    : lote.estado === 'en_recoleccion'
                      ? 'Esperando a Luis — ya fue notificado para recoger el lote.'
                      : lote.estado === 'en_camino'
                        ? 'En camino — Almacén Terán lo recibe escaneando el QR.'
                        : 'Sin acciones disponibles para tu rol en este estado.'}
              </span>
            )}
          </div>

          {/* Sublotes EXPANDIDOS inline (jun 2026 — antes navegaba y se rompía) */}
          {verSubs && tieneSublotes && !ocultarVerSublotes && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sublotesActivos.map(s => {
                const c = ESTADO_SUBLOTE_COLOR[s.estado] || 'var(--lp-text-tertiary)';
                const l = ESTADO_SUBLOTE_LABEL[s.estado] || s.estado || '—';
                const qtyTxt = [s.qty != null ? `${s.qty} ${s.tipo || 'cub'}` : null, s.lit ? `${s.lit} L` : null].filter(Boolean).join(' · ');
                return (
                  <div key={s.cod} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                    <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-text-secondary)' }}>{s.cod}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}>
                      <i style={{ width: 5, height: 5, borderRadius: 999, background: c }} />{l}
                    </span>
                    {qtyTxt && <span style={{ color: 'var(--lp-text-tertiary)' }}>{qtyTxt}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: 'var(--lp-text-tertiary)' }}>
                      {(s.ub || 'fabrica') === 'teran' ? 'Terán' : 'Fábrica'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
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
