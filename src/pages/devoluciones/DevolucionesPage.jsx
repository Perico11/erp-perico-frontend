import { useState, useEffect, useCallback, useRef } from 'react';
import TopBar from '../../components/layout/TopBar';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useConfirm from '../../hooks/useConfirm';
import useIsDesktop from '../../hooks/useIsDesktop';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import PruebaBadge, { esPrueba } from '../../components/ui/PruebaBadge';

/* ═══════════════════════════════════════════════════════════════════════
   DevolucionesPage — Devoluciones de PRODUCTO TERMINADO (cliente → fábrica).
   Roles: admin · tecnico · almacen (+ compras cierra reembolsos).

   Distinta de Devoluciones MP (DevolucionesMPPage). Esta pantalla maneja
   la queja física del cliente: se recibe en fábrica, se decide disposición
   (regresar/reprocesar/descartar) y, si regresa, se emite nota de crédito.

   AG-PT (jun 2026): se hizo responsive 1:1 con el design system verde.
     · Escritorio (isDesktop): TABLA ancha (Folio · Producto/Cliente ·
       Cantidad · Monto · Estado · Acción) — mismo lenguaje que InventarioPage.
     · Móvil (!isDesktop): cards limpias con badge de estado + acciones.
     · Modal de registro: centrado en escritorio, bottom-sheet en móvil.

   NOTA: antes esta página delegaba en <DevolucionesPanel> (componente
   compartido con el panel de admin). Para no tocar archivos compartidos, la
   lógica se internalizó aquí y se añadió el split escritorio/móvil. El panel
   compartido sigue intacto para su uso en otras vistas.
   ═══════════════════════════════════════════════════════════════════════ */

const S = {
  wrap: { padding: '0 20px 100px' },
  h1: { fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--lp-text-primary)', margin: '4px 0 0' },
  psub: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3, marginBottom: 16 },

  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  toolbarCount: { flex: 1, minWidth: 120, fontSize: 12, color: 'var(--lp-text-secondary)' },

  btnPrimary: {
    height: 40, padding: '0 16px', fontSize: 13, fontWeight: 700,
    borderRadius: 10, border: 'none', background: 'var(--lp-brand-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  btnGhost: {
    height: 36, padding: '0 13px', fontSize: 12.5, fontWeight: 600,
    borderRadius: 10, border: '1px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-raised)', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-secondary)', whiteSpace: 'nowrap',
  },
  btnGhostBrand: { color: 'var(--lp-brand-700)', borderColor: 'color-mix(in srgb, var(--lp-brand-600) 40%, transparent)' },
  btnGhostDanger: { color: 'var(--lp-danger-700)', borderColor: 'color-mix(in srgb, var(--lp-danger-600) 35%, transparent)' },
  btnSolidSm: {
    height: 36, padding: '0 14px', fontSize: 12.5, fontWeight: 700,
    borderRadius: 10, border: 'none', background: 'var(--lp-brand-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap',
  },

  /* estado pill (dot + label), estilo InventarioPage */
  estDot: (c) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
    padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
    background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c,
  }),
  badge: (bg, fg) => ({
    display: 'inline-flex', alignItems: 'center', padding: '2px 8px', fontSize: 10, fontWeight: 700,
    borderRadius: 6, background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '.04em',
    whiteSpace: 'nowrap',
  }),

  /* ── Tabla escritorio ── */
  tablewrap: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 720 },
  th: {
    textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
    color: 'var(--lp-text-tertiary)', padding: '12px 16px', borderBottom: '1px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-sunken)', whiteSpace: 'nowrap',
  },
  td: { padding: '12px 16px', borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 13.5, color: 'var(--lp-text-primary)', verticalAlign: 'middle' },
  tdMono: { fontFamily: 'var(--lp-font-mono)', fontWeight: 600 },
  rowActions: { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },

  /* ── Cards móvil ── */
  cardList: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
    borderRadius: 16, padding: '14px 16px',
  },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  cardName: { fontSize: 14.5, fontWeight: 600, color: 'var(--lp-text-primary)', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardQty: { fontWeight: 400, color: 'var(--lp-text-tertiary)', fontSize: 13 },
  cardMeta: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 2, lineHeight: 1.4 },
  cardNums: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '10px 0 4px' },
  cardMonto: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--lp-brand-700)' },
  cardFolio: { fontFamily: 'var(--lp-font-mono)', fontSize: 11.5, color: 'var(--lp-text-tertiary)' },
  cardBadges: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  cardActions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--lp-border-subtle)' },

  loading: { textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0', fontSize: 13 },
  err: {
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    padding: 10, borderRadius: 10, fontSize: 12.5, marginBottom: 12,
  },

  /* ── Sheet / modal (centrado escritorio · bottom móvil) ── */
  sheetOverlay: (desktop) => ({
    position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 1200,
    display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', padding: desktop ? 16 : 0,
  }),
  sheet: (desktop) => ({
    background: 'var(--lp-bg-base)', width: '100%', maxWidth: 520,
    borderRadius: desktop ? 20 : '24px 24px 0 0',
    boxShadow: '0 -8px 40px rgba(0,0,0,.22)',
    /* --pp-vvh (visualViewport, publicado por useBodyScrollLock) sigue al teclado
       en iOS/Android; fallback a 100dvh. El sheetBody scrollea, no el fondo. */
    display: 'flex', flexDirection: 'column', maxHeight: 'calc(var(--pp-vvh, 100dvh) - 24px)', overflow: 'hidden',
  }),
  sheetHeader: {
    padding: '18px 20px 14px', borderBottom: '1px solid var(--lp-border-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: 600, color: 'var(--lp-text-primary)' },
  sheetClose: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 8, margin: -8,
    minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--lp-text-tertiary)', borderRadius: 10,
  },
  sheetBody: { padding: '16px 20px', overflowY: 'auto' },
  sheetFooter: {
    padding: '12px 20px 18px', borderTop: '1px solid var(--lp-border-subtle)',
    display: 'flex', gap: 10,
  },
  field: { marginBottom: 14 },
  label: {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--lp-text-secondary)', margin: '0 2px 6px',
  },
  input: {
    width: '100%', height: 46, padding: '0 14px',
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 12,
    fontSize: 14.5, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    outline: 'none', boxSizing: 'border-box',
  },
  select: {
    width: '100%', height: 46, padding: '0 12px',
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 12,
    fontSize: 14.5, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    outline: 'none', boxSizing: 'border-box',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  check: {
    display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
    padding: '12px 12px', minHeight: 44, background: 'var(--lp-info-50)',
    borderRadius: 12, cursor: 'pointer', color: 'var(--lp-text-secondary)', boxSizing: 'border-box',
  },
  act2: (primary) => ({
    flex: 1, height: 50, borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    fontSize: 14.5, fontWeight: 600,
    border: primary ? 'none' : '1px solid var(--lp-border-subtle)',
    background: primary ? 'var(--lp-brand-600)' : 'transparent',
    color: primary ? '#fff' : 'var(--lp-text-secondary)',
  }),

  /* banner reembolso */
  alert: {
    background: 'var(--lp-warning-50)',
    border: '1.5px solid var(--lp-warning-300)',
    borderLeft: '4px solid var(--lp-warning-600)',
    padding: '12px 14px', borderRadius: 10,
    marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  },
};

/* ── Iconos SVG line (sin emojis) ── */
function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function IconReturn() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9" />
    </svg>
  );
}

/* ── Estado canónico → color + label legible ── */
function estadoDe(d) {
  if (d.estado === 'pendiente') return { c: 'var(--lp-warning-600)', label: 'Por recibir' };
  if (d.estado === 'recibido_fabrica' && !d.disposicion) return { c: 'var(--lp-brand-600)', label: 'Por disponer' };
  if (d.disposicion === 'regresar') {
    return d.reembolsoEmitido
      ? { c: 'var(--lp-success-600)', label: 'Reembolsado' }
      : { c: 'var(--lp-warning-600)', label: 'Reembolso pendiente' };
  }
  if (d.disposicion === 'reprocesar') return { c: 'var(--lp-brand-600)', label: 'En reproceso' };
  if (d.disposicion === 'descartar') return { c: 'var(--lp-text-tertiary)', label: 'Descartada' };
  return { c: 'var(--lp-text-secondary)', label: d.estado || 'Registrada' };
}

function EstadoBadge({ d }) {
  const s = estadoDe(d);
  return (
    <span style={S.estDot(s.c)}>
      <i style={{ width: 6, height: 6, borderRadius: 999, background: s.c, display: 'inline-block' }} />
      {s.label}
    </span>
  );
}

/* ════════════════ Sheet / Modal: registrar devolución ════════════════ */
function DevolucionSheet({ isDesktop, onClose, onSaved }) {
  const [cliente, setCliente] = useState('');
  const [producto, setProducto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [presentacion, setPresentacion] = useState('cubeta');
  const [motivo, setMotivo] = useState('');
  const [monto, setMonto] = useState('');
  const [codigoLote, setCodigoLote] = useState('');
  const [ajustar, setAjustar] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const firstRef = useRef(null);
  /* MÓVIL: bloquea scroll del fondo + publica --pp-vvh (alto visible real que
     sigue al teclado) para que sheetBody siempre tenga overflow interno. El
     sheet sólo se monta cuando está abierto, así que el lock es siempre activo. */
  useBodyScrollLock(true);
  useEffect(() => { const t = setTimeout(() => firstRef.current?.focus(), 120); return () => clearTimeout(t); }, []);

  const guardar = async () => {
    setErr('');
    if (!cliente.trim() || !producto.trim() || !cantidad) {
      return setErr('Cliente, producto y cantidad son requeridos');
    }
    setSaving(true);
    try {
      await api.registrarDevolucion(
        cliente.trim(), producto.trim(), parseFloat(cantidad),
        presentacion, motivo.trim(), parseFloat(monto) || 0,
        codigoLote.trim() || null, ajustar
      );
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.sheetOverlay(isDesktop)} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.sheet(isDesktop)} onClick={(e) => e.stopPropagation()} data-id="devoluciones.sheet.registrar" data-rol="admin,tecnico,almacen,compras">
        <div style={S.sheetHeader}>
          <div style={S.sheetTitle}>Registrar devolución</div>
          <button style={S.sheetClose} onClick={onClose} aria-label="Cerrar"><IconClose /></button>
        </div>
        <div style={S.sheetBody}>
          {err && <div style={S.err}>{err}</div>}
          <div style={S.field}>
            <label style={S.label}>Cliente</label>
            <input ref={firstRef} style={S.input} value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre o razón social" />
          </div>
          <div style={S.field}>
            <label style={S.label}>Producto</label>
            <input style={S.input} value={producto} onChange={(e) => setProducto(e.target.value)} placeholder="Ej: BLANCO MATE 4.0" />
          </div>
          <div style={S.grid2}>
            <div style={S.field}>
              <label style={S.label}>Cantidad</label>
              <input style={S.input} type="number" inputMode="decimal" min="0" step="0.01"
                value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Presentación</label>
              <select style={S.select} value={presentacion} onChange={(e) => setPresentacion(e.target.value)}>
                <option value="cubeta">Cubeta 19L</option>
                <option value="galon">Galón 3.78L</option>
                <option value="litro">Litro</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
          <div style={S.field}>
            <label style={S.label}>Monto a devolver (MXN)</label>
            <input style={S.input} type="number" inputMode="decimal" min="0" step="0.01"
              value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
          </div>
          <div style={S.field}>
            <label style={S.label}>Código de lote (opcional)</label>
            <input style={S.input} value={codigoLote} onChange={(e) => setCodigoLote(e.target.value)} placeholder="LP-2026-001-A" />
          </div>
          <div style={S.field}>
            <label style={S.label}>Motivo</label>
            <input style={S.input} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: Defecto de fabricación" />
          </div>
          <label style={S.check}>
            <input type="checkbox" checked={ajustar} onChange={(e) => setAjustar(e.target.checked)} style={{ accentColor: 'var(--lp-brand-600)', width: 18, height: 18 }} />
            <span>Sumar la cantidad devuelta al inventario PT</span>
          </label>
        </div>
        <div style={S.sheetFooter}>
          <button style={S.act2(false)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...S.act2(true), opacity: saving ? 0.6 : 1 }} onClick={guardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Registrar y emitir nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════ Acciones por devolución (compartidas tabla/cards) ════════════════ */
function DevAcciones({ d, can, verNota, recibir, disponer, reembolsar, alignEnd }) {
  return (
    <div style={alignEnd ? S.rowActions : { display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button style={S.btnGhost} onClick={() => verNota(d.id)} data-id="devoluciones.btn.ver-nota">Ver nota</button>

      {/* FIX jun 2026 (L2): Enrique/admin recibe físicamente en fábrica */}
      {d.estado === 'pendiente' && (can('produccion') || can('admin')) && (
        <button style={S.btnSolidSm} onClick={() => recibir(d)} data-id="devoluciones.btn.recibir" data-rol="admin,tecnico">
          Recibí en fábrica
        </button>
      )}

      {/* FIX jun 2026 (L2): tras recibir, decidir disposición */}
      {d.estado === 'recibido_fabrica' && !d.disposicion && (can('produccion') || can('admin')) && (
        <>
          <button style={{ ...S.btnGhost, ...S.btnGhostBrand }} onClick={() => disponer(d, 'regresar')} data-id="devoluciones.btn.regresar" data-rol="admin,tecnico">Regresar a stock</button>
          <button style={S.btnGhost} onClick={() => disponer(d, 'reprocesar')} data-id="devoluciones.btn.reprocesar" data-rol="admin,tecnico">Reprocesar</button>
          <button style={{ ...S.btnGhost, ...S.btnGhostDanger }} onClick={() => disponer(d, 'descartar')} data-id="devoluciones.btn.descartar" data-rol="admin,tecnico">Descartar</button>
        </>
      )}

      {/* FIX jun 2026 (K7): "Marcar reembolsado" sólo para compras/admin */}
      {d.disposicion === 'regresar' && !d.reembolsoEmitido && can('compras') && (
        <button style={S.btnSolidSm} onClick={() => reembolsar(d)} data-id="devoluciones.btn.reembolsar" data-rol="admin,compras">
          Marcar reembolsado
        </button>
      )}
    </div>
  );
}

/* ════════════════ MAIN ════════════════ */
export default function DevolucionesPage() {
  const { can, user } = useAuth();
  const isDesktop = useIsDesktop();
  /* FIX jun 2026 (L3): useConfirm reemplaza window.prompt — éste queda
     silenciosamente bloqueado en PWA standalone iOS. Patrón Sprint G-4. */
  const [confirm, ConfirmEl] = useConfirm();
  const [devs, setDevs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showSheet, setShowSheet] = useState(false);
  /* FIX jun 2026 (Sprint I - G5): banner emergente cuando llega broadcast
     devolución con requiereReembolso=true (Arely/admin lo necesita ver). */
  const [reembolsoAlert, setReembolsoAlert] = useState(null);
  const lastAlertRef = useRef(null);

  const cargar = useCallback(() => {
    setLoading(true);
    api.getDevoluciones()
      .then(r => setDevs(Array.isArray(r) ? r : (r.data || [])))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /* Realtime: cualquier evento 'devolucion' refresca la lista.
     Si trae requiereReembolso y el usuario es compras/admin, muestra banner. */
  useRealtimeSync({
    devolucion: (data) => {
      cargar();
      if (data && data.requiereReembolso &&
          user && ['admin', 'compras'].includes(user.rol) &&
          data.id !== lastAlertRef.current) {
        lastAlertRef.current = data.id;
        setReembolsoAlert(data);
      }
    },
  });

  const verNota = useCallback((id) => {
    window.open(`/api/devoluciones/${id}/nota`, '_blank');
  }, []);

  /* FIX jun 2026 (L2): Enrique recibe físicamente la devolución en fábrica. */
  const recibirEnFabrica = useCallback(async (dev) => {
    const ok = await confirm(
      `Devolución ${dev.id}\nCliente: ${dev.cliente || 'N/D'}\nProducto: ${dev.producto || 'N/D'}\n\nConfirma que recibiste físicamente este producto en fábrica.`,
      { title: 'Recibir en fábrica', confirmText: 'Sí, recibí' }
    );
    if (!ok) return;
    try {
      await api.recibirDevolucion(dev.id, user?.nombre, null, null);
      cargar();
    } catch (e) {
      setErr(e.message || 'No se pudo registrar la recepción');
    }
  }, [cargar, confirm, user]);

  /* FIX jun 2026 (L2): tras recibir, técnico/admin decide:
     regresar (vuelve al stock PT + dispara reembolso) · reprocesar · descartar. */
  const disponerDevolucion = useCallback(async (dev, disposicion) => {
    const labels = {
      regresar: 'Regresar al inventario PT (cliente recibe nota de crédito)',
      reprocesar: 'Enviar a reproceso',
      descartar: 'Descartar como merma',
    };
    const nota = await confirm(
      labels[disposicion] + `\n\nDevolución: ${dev.id}\nProducto: ${dev.producto || 'N/D'}`,
      {
        title: 'Disposición: ' + disposicion,
        confirmText: 'Confirmar disposición',
        prompt: { label: 'Nota (opcional)', placeholder: 'Detalles del estado físico, decisión...', required: false },
      }
    );
    if (nota === null || nota === false) return;
    try {
      await api.disponerDevolucion(dev.id, disposicion, String(nota || ''));
      cargar();
    } catch (e) {
      setErr(e.message || 'No se pudo registrar la disposición');
    }
  }, [cargar, confirm]);

  /* FIX jun 2026 (K7 + L3): emisor de reembolso usando useConfirm. */
  const emitirReembolso = useCallback(async (dev) => {
    const folio = await confirm(
      `Cliente: ${dev.cliente || 'N/D'}\nProducto: ${dev.producto || 'N/D'}\nMonto: $${dev.montoDevuelto || 0}`,
      {
        title: 'Emitir reembolso',
        confirmText: 'Confirmar reembolso',
        prompt: { label: 'Folio de nota de crédito', placeholder: dev.notaCredito || 'NC-...', required: false },
      }
    );
    if (folio === null || folio === false) return;
    try {
      await api.emitirReembolso(dev.id, String(folio).trim() || dev.notaCredito || '', dev.montoDevuelto || 0, '');
      cargar();
    } catch (e) {
      setErr(e.message || 'No se pudo emitir el reembolso');
    }
  }, [cargar, confirm]);

  const lista = [...devs].reverse();
  const accionProps = { can, verNota, recibir: recibirEnFabrica, disponer: disponerDevolucion, reembolsar: emitirReembolso };

  return (
    <div>
      <TopBar title="Devoluciones" />
      <div style={S.wrap}>
        <h1 style={S.h1}>Devoluciones</h1>
        <div style={S.psub}>Producto terminado regresado por el cliente — recepción en fábrica, disposición y nota de crédito.</div>

        {err && <div style={S.err}>{err}</div>}

        {/* Banner reembolso pendiente (broadcast G5) */}
        {reembolsoAlert && (
          <div style={S.alert}>
            <div style={{ flex: 1, minWidth: 180, fontSize: 12.5 }}>
              <div style={{ fontWeight: 700, color: 'var(--lp-warning-800)', marginBottom: 2 }}>
                Devolución requiere reembolso
              </div>
              <div style={{ color: 'var(--lp-text-secondary)' }}>
                Cliente <strong>{reembolsoAlert.cliente || 'N/D'}</strong> · {reembolsoAlert.producto || 'N/D'}
                {reembolsoAlert.montoDevuelto ? ` · $${Number(reembolsoAlert.montoDevuelto).toFixed(2)}` : ''}
                {' · '}Disposición decidida por {reembolsoAlert.decididoPor || 'N/D'}. Emitir nota de crédito.
              </div>
            </div>
            {reembolsoAlert.id && (
              <button style={S.btnGhost} onClick={() => verNota(reembolsoAlert.id)}>Ver nota</button>
            )}
            <button style={{ ...S.btnGhost, minWidth: 44, padding: '0 12px' }} onClick={() => setReembolsoAlert(null)} aria-label="Cerrar alerta">
              <IconClose />
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div style={S.toolbar}>
          <div style={S.toolbarCount}>{devs.length} devolución(es) registrada(s)</div>
          {/* FIX jun 2026 (K3-b): permiso natural 'devoluciones' (admin/tecnico/almacen/compras). */}
          {can('devoluciones') && (
            <button style={S.btnPrimary} onClick={() => setShowSheet(true)} data-id="devoluciones.btn.nueva" data-rol="admin,tecnico,almacen,compras">
              <IconPlus /> Registrar devolución
            </button>
          )}
        </div>

        {/* Contenido */}
        {loading ? (
          <div style={S.loading}>Cargando devoluciones...</div>
        ) : lista.length === 0 ? (
          <div style={S.empty}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--lp-text-tertiary)', opacity: 0.6, marginBottom: 10 }}>
              <IconReturn />
            </div>
            Sin devoluciones registradas
          </div>
        ) : isDesktop ? (
          /* ─────────── ESCRITORIO: tabla ─────────── */
          <div style={S.tablewrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Folio</th>
                  <th style={S.th}>Producto / Cliente</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Cantidad</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Monto</th>
                  <th style={S.th}>Estado</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(d => (
                  <tr key={d.id} data-id="devoluciones.row.item" data-rol="admin,tecnico,almacen,compras"
                    style={esPrueba(d) ? { background: 'var(--lp-warning-50)' } : undefined}>
                    <td style={{ ...S.td, ...S.tdMono, color: 'var(--lp-text-tertiary)', whiteSpace: 'nowrap' }}>{d.id}</td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{d.producto || 'N/D'}</span>
                        {esPrueba(d) && <PruebaBadge size="sm" />}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                        {d.cliente || 'N/D'} · {d.fecha ? new Date(d.fecha).toLocaleDateString('es-MX') : '—'}
                        {d.motivo && ` · ${d.motivo}`}
                        {esPrueba(d) && ' · sin impacto en inventario'}
                      </div>
                      {(d.reembolsoFolio || d.notaCredito) && (
                        <div style={{ fontSize: 11, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                          NC {d.reembolsoFolio || d.notaCredito}
                        </div>
                      )}
                    </td>
                    <td style={{ ...S.td, ...S.tdMono, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {d.cantidad} <span style={{ color: 'var(--lp-text-tertiary)', fontWeight: 400 }}>{d.presentacion}</span>
                    </td>
                    <td style={{ ...S.td, ...S.tdMono, textAlign: 'right', color: 'var(--lp-brand-700)' }}>
                      ${(d.montoDevuelto || 0).toFixed(2)}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        <EstadoBadge d={d} />
                        {d.ajusteRealizado && (
                          <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>Stock ajustado</span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <DevAcciones d={d} {...accionProps} alignEnd />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ─────────── MÓVIL: cards ─────────── */
          <div style={S.cardList}>
            {lista.map(d => (
              <div key={d.id} data-id="devoluciones.row.item" data-rol="admin,tecnico,almacen,compras"
                style={{ ...S.card, ...(esPrueba(d) ? { background: 'var(--lp-warning-50)', borderLeft: '4px solid var(--lp-warning-600)' } : {}) }}>
                <div style={S.cardTop}>
                  <div style={S.cardName}>
                    <span>{d.producto || 'N/D'}</span>
                    <span style={S.cardQty}>· {d.cantidad} {d.presentacion}</span>
                    {esPrueba(d) && <PruebaBadge size="sm" />}
                  </div>
                  <EstadoBadge d={d} />
                </div>
                <div style={S.cardMeta}>
                  {d.cliente || 'N/D'} · {d.fecha ? new Date(d.fecha).toLocaleDateString('es-MX') : '—'}
                  {d.motivo && ` · ${d.motivo}`}
                  {esPrueba(d) && ' · sin impacto en inventario'}
                </div>
                <div style={S.cardNums}>
                  <span style={S.cardMonto}>${(d.montoDevuelto || 0).toFixed(2)}</span>
                  <span style={S.cardFolio}>{d.id}</span>
                </div>
                {(d.ajusteRealizado || d.reembolsoFolio || d.notaCredito) && (
                  <div style={{ ...S.cardBadges, marginTop: 4 }}>
                    {d.ajusteRealizado && (
                      <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>Stock ajustado</span>
                    )}
                    {(d.reembolsoFolio || d.notaCredito) && (
                      <span style={{ fontSize: 11, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)' }}>
                        NC {d.reembolsoFolio || d.notaCredito}
                      </span>
                    )}
                  </div>
                )}
                <div style={S.cardActions}>
                  <DevAcciones d={d} {...accionProps} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSheet && <DevolucionSheet isDesktop={isDesktop} onClose={() => setShowSheet(false)} onSaved={cargar} />}
      {/* FIX jun 2026 (L3): renderizar useConfirm para que window.prompt quede fuera. */}
      {ConfirmEl}
    </div>
  );
}
