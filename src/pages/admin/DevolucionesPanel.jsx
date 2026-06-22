import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useConfirm from '../../hooks/useConfirm';
import PruebaBadge, { esPrueba } from '../../components/ui/PruebaBadge';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const S = {
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  btnPrimary: {
    padding: '10px 16px', fontSize: 12, fontWeight: 700,
    borderRadius: 'var(--lp-radius-sm)', border: 'none',
    background: 'var(--lp-brand-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
  },
  btnGhost: {
    padding: '8px 14px', fontSize: 11, fontWeight: 600,
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-raised)', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)',
  },
  panel: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', padding: 16,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: {
    display: 'grid', gridTemplateColumns: '1fr 100px 120px auto',
    gap: 12, alignItems: 'center', padding: '12px 14px',
    background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
  },
  badge: (bg, fg) => ({
    display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700,
    borderRadius: 4, background: bg, color: fg,
    textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  loading: { textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
  err: {
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    padding: 10, borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 12,
  },
  /* Modal */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(26,24,21,.5)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)', maxWidth: 520, width: '100%',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    /* MÓVIL: el dialog no debe exceder el alto visible (sigue al teclado vía
       --pp-vvh, publicado por useBodyScrollLock); el body interno scrollea. */
    maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)',
  },
  modalHeader: {
    padding: '14px 18px', borderBottom: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 14, fontWeight: 700 },
  modalClose: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: 22, color: 'var(--lp-text-tertiary)', padding: 4, lineHeight: 1,
  },
  modalBody: { padding: 16, overflowY: 'auto', flex: 1 },
  modalFooter: {
    padding: '12px 16px', borderTop: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', gap: 8, justifyContent: 'flex-end',
  },
  field: { marginBottom: 12 },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--lp-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6,
  },
  input: {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 13, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)',
    boxSizing: 'border-box',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
};

function DevolucionModal({ onClose, onSaved }) {
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

  /* MÓVIL: bloquea el scroll del fondo mientras el modal está abierto y publica
     --pp-vvh (alto visible real, sigue al teclado) que el dialog usa en su
     maxHeight para que el body SIEMPRE tenga overflow interno scrolleable.
     El componente sólo se monta cuando showModal=true → pasamos true. */
  useBodyScrollLock(true);

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
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <div style={S.modalTitle}>Registrar devolución</div>
          <button style={S.modalClose} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.modalBody}>
          {err && <div style={S.err}>{err}</div>}
          <div style={S.field}>
            <label style={S.label}>Cliente</label>
            <input style={S.input} value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre o razón social" />
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
              <select style={S.input} value={presentacion} onChange={(e) => setPresentacion(e.target.value)}>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '8px 10px', background: 'var(--lp-info-50)', borderRadius: 'var(--lp-radius-sm)', cursor: 'pointer' }}>
            <input type="checkbox" checked={ajustar} onChange={(e) => setAjustar(e.target.checked)} style={{ accentColor: 'var(--lp-brand-600)' }} />
            <span>Sumar la cantidad devuelta al inventario PT</span>
          </label>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnGhost} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btnPrimary} onClick={guardar} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar y emitir nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DevolucionesPanel() {
  const { can, user } = useAuth();
  /* FIX jun 2026 (L3): useConfirm reemplaza window.prompt — este último
     queda silenciosamente bloqueado en PWA standalone iOS, igual que
     window.confirm. Patrón establecido en Sprint G-4. */
  const [confirm, ConfirmEl] = useConfirm();
  const [devs, setDevs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showModal, setShowModal] = useState(false);
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
          user && ['admin','compras'].includes(user.rol) &&
          data.id !== lastAlertRef.current) {
        lastAlertRef.current = data.id;
        setReembolsoAlert(data);
      }
    },
  });

  const verNota = (id) => {
    window.open(`/api/devoluciones/${id}/nota`, '_blank');
  };

  /* FIX jun 2026 (L2): Enrique recibe físicamente la devolución en fábrica.
     Solo aparece para devs con estado='pendiente'. */
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
     - regresar (vuelve al stock PT, dispara reembolso si cliente lo amerita)
     - reprocesar (entra a línea de reproceso)
     - descartar (merma documentada) */
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

  /* FIX jun 2026 (K7 + L3): emisor de reembolso usando useConfirm (no
     window.prompt — fallaba en iOS PWA). */
  const emitirReembolso = useCallback(async (dev) => {
    const folio = await confirm(
      `Cliente: ${dev.cliente || 'N/D'}\nProducto: ${dev.producto || 'N/D'}\nMonto: $${dev.montoDevuelto || 0}`,
      {
        title: 'Emitir reembolso',
        confirmText: 'Confirmar reembolso',
        prompt: {
          label: 'Folio de nota de crédito',
          placeholder: dev.notaCredito || 'NC-...',
          required: false,
        },
      }
    );
    if (folio === null || folio === false) return; /* cancelado */
    try {
      await api.emitirReembolso(dev.id, String(folio).trim() || dev.notaCredito || '', dev.montoDevuelto || 0, '');
      cargar();
    } catch (e) {
      setErr(e.message || 'No se pudo emitir el reembolso');
    }
  }, [cargar, confirm]);

  if (loading) return <div style={S.loading}>Cargando devoluciones...</div>;

  return (
    <div>
      {err && <div style={S.err}>{err}</div>}
      {reembolsoAlert && (
        <div style={{
          background: 'var(--lp-warning-50)',
          border: '1.5px solid var(--lp-warning-300)',
          borderLeft: '4px solid var(--lp-warning-600)',
          padding: '12px 14px', borderRadius: 'var(--lp-radius-sm)',
          marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: 'var(--lp-warning-800)', marginBottom: 2 }}>
              Devolución requiere reembolso
            </div>
            <div style={{ color: 'var(--lp-text-secondary)' }}>
              Cliente <strong>{reembolsoAlert.cliente || 'N/D'}</strong> · {reembolsoAlert.producto || 'N/D'}
              {reembolsoAlert.montoDevuelto ? ` · $${Number(reembolsoAlert.montoDevuelto).toFixed(2)}` : ''}
              {' · '}Disposición decidida por {reembolsoAlert.decididoPor || 'N/D'}.
              {' '}Emitir nota de crédito.
            </div>
          </div>
          {reembolsoAlert.id && (
            <button style={S.btnGhost} onClick={() => verNota(reembolsoAlert.id)}>
              Ver nota
            </button>
          )}
          <button
            style={{ ...S.btnGhost, padding: '6px 10px' }}
            onClick={() => setReembolsoAlert(null)}
            aria-label="Cerrar alerta"
          >×</button>
        </div>
      )}
      <div style={S.toolbar}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--lp-text-secondary)' }}>
          {devs.length} devolución(es) registrada(s)
        </div>
        {/* FIX jun 2026 (K3-b): Josué es el principal originador de
            devoluciones — recibe quejas físicas en Terán. El gate anterior
            'configuracion' solo lo tenía admin/compras, bloqueándolo. El
            permiso natural es 'devoluciones' (admin/tecnico/almacen/compras). */}
        {can('devoluciones') && (
          <button style={S.btnPrimary} onClick={() => setShowModal(true)}>
            + Registrar devolución
          </button>
        )}
      </div>
      <div style={S.panel}>
        {devs.length === 0 ? (
          <div style={S.loading}>Sin devoluciones registradas</div>
        ) : (
          <div style={S.list}>
            {[...devs].reverse().map(d => (
              <div
                key={d.id}
                style={{
                  ...S.row,
                  /* FIX jun 2026 (N9): resalta visualmente devs prueba */
                  ...(esPrueba(d) ? { background: 'var(--lp-warning-50)', borderLeft: '4px solid var(--lp-warning-600)' } : {}),
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{d.producto}</span>
                    <span style={{ fontWeight: 400, color: 'var(--lp-text-tertiary)' }}>· {d.cantidad} {d.presentacion}</span>
                    {esPrueba(d) && <PruebaBadge size="sm" />}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                    {d.cliente} · {new Date(d.fecha).toLocaleDateString('es-MX')}
                    {d.motivo && ` · ${d.motivo}`}
                    {esPrueba(d) && ' · sin impacto en inventario'}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-brand-700)', textAlign: 'right' }}>
                  ${(d.montoDevuelto || 0).toFixed(2)}
                </div>
                <div>
                  {d.ajusteRealizado && (
                    <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>
                      Stock ajustado
                    </span>
                  )}
                  {/* FIX jun 2026 (Sprint I - G5): visibilidad persistente del
                      reembolso pendiente para que Arely lo vea aunque no haya
                      recibido el push (refresh de pantalla, sesión nueva). */}
                  {d.disposicion === 'regresar' && !d.reembolsoEmitido && (
                    <span style={S.badge('var(--lp-warning-100)', 'var(--lp-warning-800)')}>
                      Reembolso pendiente
                    </span>
                  )}
                  {d.reembolsoEmitido && (
                    <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>
                      Reembolsado
                    </span>
                  )}
                  {d.notaCredito && (
                    <div style={{ fontSize: 11, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                      {d.reembolsoFolio || d.notaCredito}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button style={S.btnGhost} onClick={() => verNota(d.id)}>Ver nota</button>
                  {/* FIX jun 2026 (L2): Enrique/admin recibe físicamente */}
                  {d.estado === 'pendiente' && (can('produccion') || can('admin')) && (
                    <button style={S.btnPrimary} onClick={() => recibirEnFabrica(d)}>
                      Recibí en fábrica
                    </button>
                  )}
                  {/* FIX jun 2026 (L2): tras recibir, decidir disposición */}
                  {d.estado === 'recibido_fabrica' && !d.disposicion && (can('produccion') || can('admin')) && (
                    <>
                      <button style={S.btnGhost} onClick={() => disponerDevolucion(d, 'regresar')}>Regresar a stock</button>
                      <button style={S.btnGhost} onClick={() => disponerDevolucion(d, 'reprocesar')}>Reprocesar</button>
                      <button style={{ ...S.btnGhost, color: 'var(--lp-danger-700)' }} onClick={() => disponerDevolucion(d, 'descartar')}>Descartar</button>
                    </>
                  )}
                  {/* FIX jun 2026 (K7): "Marcar reembolsado" sólo para compras/admin */}
                  {d.disposicion === 'regresar' && !d.reembolsoEmitido && can('compras') && (
                    <button style={S.btnPrimary} onClick={() => emitirReembolso(d)}>
                      Marcar reembolsado
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showModal && <DevolucionModal onClose={() => setShowModal(false)} onSaved={cargar} />}
      {/* FIX jun 2026 (L3): renderizar useConfirm para que window.prompt
          quede definitivamente fuera. */}
      {ConfirmEl}
    </div>
  );
}
