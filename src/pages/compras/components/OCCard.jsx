import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import EditOCModal from './EditOCModal';
import RecibirOCModal from './RecibirOCModal';
import EliminarOCModal from './EliminarOCModal';
import AprobarOCModal from './AprobarOCModal';
import RegistrarPagoModal from './RegistrarPagoModal';
import { presEnvases } from '../presentaciones';

/* AC (jun 2026): días para vencer un crédito (negativo = vencido) */
function _diasVence(fechaVencimientoISO) {
  if (!fechaVencimientoISO) return null;
  try {
    const v = new Date(fechaVencimientoISO.slice(0, 10) + 'T00:00:00');
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.round((v - hoy) / (24 * 3600 * 1000));
  } catch { return null; }
}

const PRESENTACIONES_COMPRAS = [
  { v: 'cubeta_20', lbl: 'CUBETA / 20 kg' },
  { v: 'cubeta_50', lbl: 'CUBETA / 50 kg' },
  { v: 'saco_25', lbl: 'SACO / 25 kg' },
  { v: 'tambor_200', lbl: 'TAMBOR / 200 kg' },
  { v: 'tote_1000', lbl: 'TOTE / 1,000 kg' },
  { v: 'otro', lbl: 'Otro (especificar)' },
];

const S = {
  card: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    padding: 16,
    marginBottom: 10,
  },
  stripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
    borderRadius: 'var(--lp-radius) 0 0 var(--lp-radius)',
  },
  stripeRecibida: {
    background: 'var(--lp-success-600)',
  },
  stripeEliminada: {
    background: 'var(--lp-danger-600)',
  },
  stripePendiente: {
    background: 'var(--lp-brand-600)',
  },
  header: {
    paddingLeft: 12,
    marginBottom: 14,
  },
  code: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--lp-text-primary)',
    marginBottom: 4,
  },
  prov: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--lp-text-secondary)',
    marginBottom: 4,
  },
  meta: {
    fontSize: 11,
    color: 'var(--lp-text-tertiary)',
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  badge: (bg, fg) => ({
    display: 'inline-flex',
    padding: '2px 8px',
    fontSize: 10,
    fontWeight: 600,
    borderRadius: 6,
    background: bg,
    color: fg,
  }),
  items: {
    marginBottom: 14,
  },
  itemRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid var(--lp-border-subtle)',
    fontSize: 11,
  },
  itemRowHeader: {
    fontWeight: 700,
    color: 'var(--lp-text-secondary)',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  buttons: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  btn: {
    padding: '6px 12px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)',
  },
  btnPrimary: {
    background: 'var(--lp-brand-600)',
    color: '#fff',
  },
  btnGhost: {
    background: 'var(--lp-bg-sunken)',
    color: 'var(--lp-text-primary)',
  },
  btnSuccess: {
    background: 'var(--lp-success-100)',
    color: 'var(--lp-success-700)',
  },
  btnDanger: {
    background: 'var(--lp-danger-100)',
    color: 'var(--lp-danger-700)',
  },
};

function fmt(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OCCard({ oc, onRefresh }) {
  const { can } = useAuth();
  const isActive = oc.estado !== 'recibida' && oc.estado !== 'eliminada' && !oc.eliminada;
  const isSolicitud = oc.origen === 'solicitud_tecnico' || oc.estado === 'solicitud';
  const [showEdit, setShowEdit] = useState(false);
  const [showRecibir, setShowRecibir] = useState(false);
  const [showEliminar, setShowEliminar] = useState(false);
  const [showAprobar, setShowAprobar] = useState(false);
  const [showPago, setShowPago] = useState(false);
  const refresh = () => onRefresh && onRefresh();

  /* AC (jun 2026): estado de pago/aprobación de la OC */
  const necesitaAprobar = isActive && !oc.aprobada && !oc.pago && can('compras');
  const esCreditoSinPagar = oc.pago === 'credito' && !oc.pagada;
  const dias = esCreditoSinPagar ? _diasVence(oc.fechaVencimiento) : null;
  const vencida = esCreditoSinPagar && dias != null && dias < 0;
  const porVencer = esCreditoSinPagar && dias != null && dias >= 0 && dias <= 5;

  const totalKg = useMemo(() => {
    return (oc.items || []).reduce((s, it) => s + (Number(it.kg) || 0), 0);
  }, [oc.items]);

  const totalRecibido = useMemo(() => {
    return (oc.items || []).reduce((s, it) => s + (Number(it.kg_recibidos) || 0), 0);
  }, [oc.items]);

  /* Producto = precio base × kg. precioUnitario lo enriquece el server desde el
     costoBase del maestro; antes la card mostraba SOLO el flete. */
  const productoMxn = useMemo(() => {
    return (oc.items || []).reduce((s, it) => s + (Number(it.kg) || 0) * (Number(it.precioUnitario) || 0), 0);
  }, [oc.items]);
  const sinFacturaReal = !(Number(oc.totalFacturaConIva) > 0);

  const stripeColor = oc.estado === 'recibida' || oc.estado === 'completada'
    ? S.stripeRecibida
    : oc.eliminada || oc.estado === 'eliminada'
      ? S.stripeEliminada
      : vencida
        ? { background: 'var(--lp-danger-600)' }
        : porVencer
          ? { background: 'var(--lp-warning-600)' }
          : S.stripePendiente;

  const handlePrint = () => {
    window.open(`/api/compras/oc/${oc.id}/print`, '_blank');
  };

  const getPresLabel = (pres) => {
    const found = PRESENTACIONES_COMPRAS.find(p => p.v === pres);
    return found ? found.lbl : pres;
  };

  return (
    <div style={{ ...S.card, position: 'relative', paddingLeft: 20 }}>
      <div style={{ ...S.stripe, ...stripeColor }} />

      {isSolicitud && (
        <div style={{ marginBottom: 10 }}>
          <span style={S.badge('var(--lp-warning-100)', 'var(--lp-warning-700)')}>
            SOLICITUD DE TÉCNICO
          </span>
        </div>
      )}

      <div style={S.header}>
        <div style={S.code}>{oc.codigo}</div>
        <div style={S.prov}>{oc.proveedor}</div>
        <div style={S.meta}>
          <span>
            {new Date(oc.fechaCreacion).toLocaleDateString('es-MX')}
            {' · por '}
            {oc.creadoPor || '?'}
          </span>
          {oc.almacenDestino && (
            <span>{oc.almacenDestino}</span>
          )}
          <span style={S.badge(
            oc.estado === 'recibida' || oc.estado === 'completada'
              ? 'var(--lp-success-100)'
              : oc.eliminada || oc.estado === 'eliminada'
                ? 'var(--lp-danger-100)'
                : 'var(--lp-brand-100)',
            oc.estado === 'recibida' || oc.estado === 'completada'
              ? 'var(--lp-success-700)'
              : oc.eliminada || oc.estado === 'eliminada'
                ? 'var(--lp-danger-700)'
                : 'var(--lp-brand-700)'
          )}>
            {oc.estado}
          </span>
        </div>
      </div>

      {/* Items table */}
      <div style={S.items}>
        <div style={S.itemRow}>
          <span style={S.itemRowHeader}>Materia Prima</span>
          <span style={{ ...S.itemRowHeader, textAlign: 'right' }}>Pedido</span>
          <span style={{ ...S.itemRowHeader, textAlign: 'right' }}>Recibido</span>
          <span style={{ ...S.itemRowHeader, textAlign: 'right' }}>Diferencia</span>
        </div>
        {(oc.items || []).slice(0, 6).map((it, idx) => (
          <div key={idx} style={S.itemRow}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{it.mp}</div>
              {it.presentacion && (
                <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                  {it.presentacion === 'otro' && it.presentacionOtro
                    ? `Otro: ${it.presentacionOtro}`
                    : `${getPresLabel(it.presentacion)}${presEnvases(it.presentacion, it.kg) ? ` · ${presEnvases(it.presentacion, it.kg)}` : ''}`}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontSize: 11 }}>
              {it.kg || 0} kg
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontSize: 11 }}>
              {it.kg_recibidos != null ? `${it.kg_recibidos} kg` : '—'}
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--lp-text-secondary)' }}>
              {it.diferencia || '—'}
            </div>
          </div>
        ))}
        {(oc.items || []).length > 6 && (
          <div style={{ ...S.itemRow, fontStyle: 'italic', color: 'var(--lp-text-tertiary)' }}>
            <span>+{(oc.items || []).length - 6} items más...</span>
          </div>
        )}
      </div>

      {/* Summary */}
      {(totalKg > 0 || oc.fleteEstimadoMxn || oc.totalFacturaConIva) && (
        <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--lp-bg-sunken)', borderRadius: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span>Total Pedido:</span>
            <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 600 }}>
              {totalKg} kg {totalRecibido > 0 && `(${totalRecibido} recibidos)`}
            </span>
          </div>
          {productoMxn > 0 && sinFacturaReal && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--lp-text-secondary)', marginBottom: 4 }}>
              <span>Producto (precio base × kg):</span>
              <span style={{ fontFamily: 'var(--lp-font-mono)' }}>
                ${fmt(productoMxn)}
              </span>
            </div>
          )}
          {oc.fleteEstimadoMxn > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--lp-text-secondary)' }}>
              <span>Flete:</span>
              <span style={{ fontFamily: 'var(--lp-font-mono)' }}>
                ${fmt(oc.fleteEstimadoMxn)}
              </span>
            </div>
          )}
          {productoMxn > 0 && sinFacturaReal && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--lp-text-primary)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--lp-border-subtle)' }}>
              <span>Total estimado:</span>
              <span style={{ fontFamily: 'var(--lp-font-mono)' }}>
                ${fmt(productoMxn + (Number(oc.fleteEstimadoMxn) || 0))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* AC (jun 2026): info de forma de pago / vencimiento del crédito */}
      {oc.pago && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {oc.pago === 'contado' && (
            <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>Contado{oc.comprobanteNombre ? ' · comprobante' : ''}</span>
          )}
          {oc.pago === 'credito' && oc.pagada && (
            <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>Crédito · pagada</span>
          )}
          {vencida && (
            <span style={S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)')}>Crédito vencido hace {Math.abs(dias)}d</span>
          )}
          {porVencer && (
            <span style={S.badge('var(--lp-warning-100)', 'var(--lp-warning-700)')}>Crédito vence en {dias}d</span>
          )}
          {esCreditoSinPagar && !vencida && !porVencer && (
            <span style={S.badge('var(--lp-brand-100)', 'var(--lp-brand-700)')}>Crédito · vence {oc.fechaVencimiento ? oc.fechaVencimiento.slice(0, 10) : ''}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={S.buttons}>
        {/* AC: Aprobar es la acción dominante para OCs sin forma de pago */}
        {necesitaAprobar && (
          <button
            style={{ ...S.btn, ...S.btnPrimary }}
            onClick={() => setShowAprobar(true)}
            title="Aprobar OC: forma de pago + comprobante"
          >
            Revisar y aprobar
          </button>
        )}
        {/* AC: Registrar pago de crédito sin pagar */}
        {esCreditoSinPagar && can('compras') && (
          <button
            style={{ ...S.btn, background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)' }}
            onClick={() => setShowPago(true)}
            title="Registrar el pago del crédito (sube comprobante)"
          >
            Registrar pago
          </button>
        )}
        {!isSolicitud && !oc.eliminada && oc.estado !== 'eliminada' && can('compras') && (
          <button
            style={{ ...S.btn, ...S.btnSuccess }}
            onClick={handlePrint}
            title="Imprimir OC formal"
          >
            Imprimir OC
          </button>
        )}
        {isActive && can('compras') && (
          <button
            style={{ ...S.btn, ...S.btnGhost }}
            onClick={() => setShowEdit(true)}
            title="Editar detalles de la OC"
          >
            Editar
          </button>
        )}
        {isActive && can('recibirMP') && (
          <button
            style={{ ...S.btn, ...S.btnGhost }}
            onClick={() => setShowRecibir(true)}
            title="Registrar recepción"
          >
            Recibir MP
          </button>
        )}
        {isActive && can('configuracion') && (
          <button
            style={{ ...S.btn, ...S.btnDanger }}
            onClick={() => setShowEliminar(true)}
            title="Eliminar esta OC"
          >
            Eliminar
          </button>
        )}
      </div>

      {showAprobar && (
        <AprobarOCModal oc={oc} onClose={() => setShowAprobar(false)} onSaved={refresh} />
      )}
      {showPago && (
        <RegistrarPagoModal oc={oc} onClose={() => setShowPago(false)} onSaved={refresh} />
      )}
      {showEdit && (
        <EditOCModal oc={oc} onClose={() => setShowEdit(false)} onSaved={refresh} />
      )}
      {showRecibir && (
        <RecibirOCModal oc={oc} onClose={() => setShowRecibir(false)} onSaved={refresh} />
      )}
      {showEliminar && (
        <EliminarOCModal oc={oc} onClose={() => setShowEliminar(false)} onSaved={refresh} />
      )}
    </div>
  );
}
