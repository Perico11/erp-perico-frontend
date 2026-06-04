import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import Cronometro from '../../components/Cronometro';
import ProduccionFlow from './ProduccionFlow';
import NDAModal from '../../components/NDAModal';
import PageTabs from '../../components/ui/PageTabs';
import MisActivosTab from './MisActivosTab';

/* ── Badge helper ── */
const B = (bg, fg) => ({
  display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 600,
  borderRadius: 6, background: bg, color: fg, marginRight: 4,
});

const S = {
  wrap: { padding: '0 20px 100px' },
  tabs: {
    display: 'flex', gap: 0, borderBottom: '2px solid var(--lp-border-subtle)',
    marginBottom: 16, overflowX: 'auto',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
  },
  tab: (active) => ({
    padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
    borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
    background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: 'var(--lp-font-sans)', marginBottom: -2, flexShrink: 0,
  }),
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10, marginBottom: 16,
  },
  kpi: (accent) => ({
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)', padding: '14px 16px',
    borderTop: `3px solid ${accent}`, textAlign: 'center',
  }),
  kpiLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-tertiary)' },
  kpiValue: { fontSize: 24, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', marginTop: 4 },
  card: (highlight) => ({
    background: highlight ? 'var(--lp-brand-50)' : 'var(--lp-bg-raised)',
    border: highlight ? '2px solid var(--lp-brand-200)' : '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 10,
  }),
  cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 8 },
  cardActions: { display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  btnPrimary: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-brand-600)', color: '#fff', minHeight: 40,
  },
  btnSuccess: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-success-600)', color: '#fff', minHeight: 40,
  },
  btnDanger: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-danger-600)', color: '#fff', minHeight: 40,
  },
  btnSecondary: {
    padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', minHeight: 40,
  },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0', fontSize: 13 },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
  /* Modal */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    width: '100%', maxWidth: 520,
    /* Reducimos maxHeight para dejar margen al bottom-nav (64px) + safe-area.
       Antes era 90vh y los botones del footer quedaban tapados. */
    maxHeight: 'calc(100vh - 80px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,.18)',
  },
  modalHeader: {
    padding: '16px 20px', borderBottom: '1px solid var(--lp-border-subtle)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  modalBody: { padding: '16px 20px' },
  modalFooter: {
    padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)',
    display: 'flex', justifyContent: 'flex-end', gap: 8,
  },
  fieldLabel: {
    fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)',
    marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '.04em',
  },
  fieldInput: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: '#fff', outline: 'none',
    boxSizing: 'border-box', marginBottom: 12,
  },
  toast: {
    position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 1001,
    background: 'var(--lp-success-600)', color: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,.15)',
  },
  ingTable: {
    width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12,
  },
  ingTh: {
    textAlign: 'left', padding: '8px 10px', fontWeight: 700, fontSize: 11,
    textTransform: 'uppercase', color: 'var(--lp-text-tertiary)',
    borderBottom: '2px solid var(--lp-border-subtle)', background: 'var(--lp-bg-sunken)',
  },
  ingTd: {
    padding: '8px 10px', borderBottom: '1px solid var(--lp-border-subtle)',
    fontFamily: 'var(--lp-font-mono)', fontSize: 12,
  },
};

/* ═══════════════════════════════════════════════════════════════════ */
/* PRODUCCIÓN MODAL — Lanzar producción desde una orden o un pedido    */
/* item._tipo === 'orden' | 'pedido'                                   */
/* ═══════════════════════════════════════════════════════════════════ */
function ProduccionModal({ item, userName, onClose, onSuccess }) {
  const [formulaData, setFormulaData] = useState(null);
  const [loadingFormula, setLoadingFormula] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lotes, setLotes] = useState(item.cantidad || 1);

  const tipo = item._tipo || 'orden'; /* 'orden' | 'pedido' */
  const productoNombre = item.formula || item.producto || '';

  /* Load formula on mount.
     - Si es ORDEN: usar getFormulaOrden (valida estado activo).
     - Si es PEDIDO: cargar todas las fórmulas y buscar por nombre. */
  useEffect(() => {
    let cancel = false;
    const fetchIt = async () => {
      try {
        if (tipo === 'orden') {
          const r = await api.getFormulaOrden(item.id);
          if (cancel) return;
          setFormulaData(r?.formula || r?.data?.formula || r);
        } else {
          const r = await api.getFormulas();
          if (cancel) return;
          const all = r?.formulas || r?.data?.formulas || r?.data || r || {};
          const f = all[productoNombre] || all[productoNombre?.toUpperCase?.()] || null;
          if (!f) throw new Error(`Fórmula "${productoNombre}" no encontrada`);
          setFormulaData(f);
        }
      } catch (err) {
        if (!cancel) setError(err.message || 'No se pudo cargar la fórmula');
      } finally {
        if (!cancel) setLoadingFormula(false);
      }
    };
    fetchIt();
    return () => { cancel = true; };
  }, [item.id, tipo, productoNombre]);

  const ingredientes = useMemo(() => {
    if (!formulaData) return [];
    const ings = formulaData.ingredientes || formulaData.materias || [];
    return Array.isArray(ings) ? ings : Object.entries(ings).map(([nombre, data]) => ({
      nombre,
      ...(typeof data === 'object' ? data : { kg19: data }),
    }));
  }, [formulaData]);

  const descuentos = useMemo(() =>
    ingredientes.map(ing => ({
      mp: ing.nombre,
      cantidad: +((ing.kg19 || 0) * lotes).toFixed(3),
    })),
    [ingredientes, lotes]
  );

  const handleProducir = async () => {
    if (descuentos.length === 0) return setError('Sin ingredientes para descontar');
    setSaving(true);
    setError('');
    try {
      /* 1. Descontar MP + sumar PT */
      await api.registrarProduccion({
        descuentos,
        producto: productoNombre,
        lotes,
        esPrueba: item.esPrueba || false,
        ordenId: tipo === 'orden' ? item.id : '',
        pedidoId: tipo === 'pedido' ? item.id : (item.pedidoId || ''),
        usuario: userName,
      });

      const ahora = new Date().toISOString();

      /* 2. Cambiar estado de la fuente */
      if (tipo === 'orden') {
        const updated = {
          ...item._raw,
          estado: 'qc',
          historial: [
            ...(item._raw?.historial || []),
            { estado: 'qc', fecha: ahora, usuario: userName,
              nota: `Producción completada (${lotes} cubetas). Pasa a QC.` },
          ],
        };
        await api.upsertOrden(updated);
      } else {
        /* pedido → producido (cierra cronómetro, abre flujo QC) */
        const updated = {
          ...item._raw,
          estado: 'producido',
          fechaFinProduccion: ahora,
          /* mantenemos fechaInicioProduccion para auditoría/duración */
          historial: [
            ...(item._raw?.historial || []),
            { estado: 'producido', fecha: ahora, usuario: userName,
              nota: `Producción completada (${lotes} cubetas). Pasa a QC.` },
          ],
        };
        await api.upsertPedido(updated);
      }

      /* 3. Crear lote en trazabilidad — código asignado por servidor.
         FIX C2 + HIGH litrosTotal (auditoría 2026-06). */
      const litPerUnit = Number(item.litPerUnit) || Number(item._raw?.litPerUnit) || 19;
      const lotePayload = {
        ordenId: tipo === 'orden' ? item.id : '',
        ordenCodigo: tipo === 'orden' ? item.codigo : '',
        pedidoId: tipo === 'pedido' ? item.id : (item.pedidoId || ''),
        producto: productoNombre,
        nombre: productoNombre,
        cantidad: lotes,
        litPerUnit,
        litrosTotal: lotes * litPerUnit,
        estado: 'producido',
        esPrueba: item.esPrueba || false,
        fecha: ahora,
        usuario: userName,
        sublotes: [],
        duracionProduccionMs: item.fechaInicioProduccion
          ? new Date(ahora).getTime() - new Date(item.fechaInicioProduccion).getTime()
          : null,
        historial: [{
          estado: 'producido', fecha: ahora, usuario: userName,
          nota: `Producción: ${lotes} ${litPerUnit === 19 ? 'cubetas' : 'unidades'} de ${productoNombre}`,
        }],
      };

      const loteRes = await api.crearLote(lotePayload);
      if (!loteRes?.ok || !loteRes?.lote) {
        throw new Error(loteRes?.error || 'No se pudo crear lote en trazabilidad');
      }
      const loteCreado = loteRes.lote;

      onSuccess(`Producción completada: ${productoNombre} x${lotes}. Lote ${loteCreado.codigoLote}`);
    } catch (err) {
      setError(err.message || 'Error en producción');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Lanzar Producción</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--lp-text-tertiary)' }} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}

          {/* Item info */}
          <div style={{ padding: 12, background: 'var(--lp-bg-sunken)', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' }}>
              {item.codigo || item.id} {tipo === 'pedido' && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--lp-text-tertiary)' }}>(Pedido)</span>}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{productoNombre}</div>
            <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2 }}>
              Cantidad original: {item.cantidad} cubetas
              {item.esPrueba && <span style={{ marginLeft: 8, color: 'var(--lp-warning-600)', fontWeight: 600 }}>🧪 PRUEBA</span>}
            </div>
            {item.fechaInicioProduccion && (
              <div style={{ marginTop: 8 }}>
                <Cronometro desde={item.fechaInicioProduccion} prefix="⏱ Desde inicio:" />
              </div>
            )}
          </div>

          {/* Lotes input */}
          <label style={S.fieldLabel}>Cubetas a producir</label>
          <input style={S.fieldInput} type="number" inputMode="decimal" min="1" value={lotes}
            onChange={e => setLotes(Math.max(1, parseInt(e.target.value) || 1))} />

          {/* Ingredientes table */}
          {loadingFormula ? (
            <div style={{ textAlign: 'center', padding: 20 }}><div className="lp-spinner" style={{ margin: '0 auto' }} /></div>
          ) : ingredientes.length > 0 ? (
            <>
              <label style={S.fieldLabel}>Ingredientes a descontar</label>
              <table style={S.ingTable}>
                <thead>
                  <tr>
                    <th style={S.ingTh}>Materia Prima</th>
                    <th style={{ ...S.ingTh, textAlign: 'right' }}>kg/cub</th>
                    <th style={{ ...S.ingTh, textAlign: 'right' }}>Total kg</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientes.map((ing, i) => (
                    <tr key={i}>
                      <td style={{ ...S.ingTd, fontFamily: 'var(--lp-font-sans)', fontWeight: 500 }}>{ing.nombre}</td>
                      <td style={{ ...S.ingTd, textAlign: 'right' }}>{(ing.kg19 || 0).toFixed(2)}</td>
                      <td style={{ ...S.ingTd, textAlign: 'right', fontWeight: 700 }}>
                        {((ing.kg19 || 0) * lotes).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginBottom: 8 }}>
                Se descontarán {ingredientes.length} materias primas del inventario.
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', padding: '12px 0' }}>
              Sin datos de ingredientes disponibles.
            </div>
          )}
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnSuccess} disabled={saving || loadingFormula} onClick={handleProducir}>
            {saving ? 'Produciendo...' : `Producir ${lotes} cubetas`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* QC MODAL — Registrar resultados de calidad                        */
/* ═══════════════════════════════════════════════════════════════════ */
function QCModal({ orden, lotes, qcRecords, userName, onClose, onSuccess }) {
  const [viscosidad, setViscosidad] = useState('');
  const [ph, setPh] = useState('');
  const [brillo, setBrillo] = useState('');
  const [densidad, setDensidad] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* Resolve the lote behind the orden — could be embedded as orden.loteRef
     (when qcItems built the row from a lote without orden), or we resolve
     it from the lotes array by ordenId/codigo. The state machine operates
     on lote.id; this lookup ensures the dispatch goes to the right entity. */
  const lote = useMemo(() => {
    if (orden?.loteRef) return orden.loteRef;
    if (!Array.isArray(lotes)) return null;
    return lotes.find(l => l && (
      (l.ordenId && l.ordenId === orden?.id) ||
      (l.ordenCodigo && orden?.codigo && l.ordenCodigo === orden.codigo) ||
      (l.id === orden?.id)
    )) || null;
  }, [orden, lotes]);

  const buildQcPayload = (resultado) => ({
    viscosidad: viscosidad ? parseFloat(viscosidad) : null,
    ph: ph ? parseFloat(ph) : null,
    brillo: brillo ? parseFloat(brillo) : null,
    densidad: densidad ? parseFloat(densidad) : null,
    notas: notas || '',
    resultado,
    fecha: new Date().toISOString(),
    usuario: userName,
  });

  const buildQcRecord = (resultado) => ({
    id: Date.now().toString(36),
    ordenId: orden?.id,
    ordenCodigo: orden?.codigo,
    loteId: lote?.id,
    codigoLote: lote?.codigoLote || lote?.codigo,
    producto: orden?.formula || lote?.producto || lote?.nombre,
    resultado,
    viscosidad: viscosidad ? parseFloat(viscosidad) : null,
    ph: ph ? parseFloat(ph) : null,
    brillo: brillo ? parseFloat(brillo) : null,
    densidad: densidad ? parseFloat(densidad) : null,
    notas: notas || '',
    fecha: new Date().toISOString(),
    usuario: userName,
  });

  const handleApprove = async () => {
    setSaving(true);
    setError('');
    try {
      /* PRIMARY: usar state machine si tenemos lote — dispatcha aprobarQC
         que valida estado actual ('producido' o 'qc_hold'), aplica QC bajo
         mutex, propaga estado del pedido y broadcast WebSocket por rol. */
      if (lote?.id) {
        await api.transicionLote(lote.id, 'aprobarQC', {
          qc: buildQcPayload('aprobado'),
          usuario: userName,
        });
      } else if (orden?.id) {
        /* FALLBACK: si no hay lote (orden sin trazabilidad aún) mantener el
           upsert sobre la orden directo. Igual registramos QC. */
        await api.upsertOrden({
          ...orden,
          estado: 'terminada',
          qcResultados: { ...buildQcPayload('aprobado'), aprobado: true },
          historial: [
            ...(orden.historial || []),
            { estado: 'terminada', fecha: new Date().toISOString(), usuario: userName, nota: 'QC aprobado' },
          ],
        });
      }
      /* Ledger inmutable de QC (independiente del state machine) */
      try { await api.registrarQC(buildQcRecord('aprobado')); } catch {}
      onSuccess(`QC aprobado: ${orden?.formula || lote?.producto}`);
    } catch (err) {
      setError(err.message || 'Error al aprobar QC');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!notas.trim()) return setError('Describe el motivo del rechazo en Notas');
    setSaving(true);
    setError('');
    try {
      if (lote?.id) {
        await api.transicionLote(lote.id, 'rechazarQC', {
          qc: buildQcPayload('rechazado'),
          motivo: notas,
          usuario: userName,
        });
      } else if (orden?.id) {
        await api.upsertOrden({
          ...orden,
          estado: 'en_proceso',
          qcResultados: { ...buildQcPayload('rechazado'), aprobado: false },
          historial: [
            ...(orden.historial || []),
            { estado: 'en_proceso', fecha: new Date().toISOString(), usuario: userName, nota: `QC rechazado: ${notas}` },
          ],
        });
      }
      try { await api.registrarQC(buildQcRecord('rechazado')); } catch {}
      onSuccess(`QC rechazado: ${orden?.formula || lote?.producto} → vuelve a producción`);
    } catch (err) {
      setError(err.message || 'Error al rechazar QC');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Control de Calidad</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--lp-text-tertiary)' }} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ padding: 12, background: 'var(--lp-bg-sunken)', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' }}>{orden.codigo}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{orden.formula}</div>
            <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2 }}>{orden.cantidad} cubetas</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={S.fieldLabel}>Viscosidad (KU)</label>
              <input style={S.fieldInput} type="number" inputMode="decimal" step="0.1" placeholder="Ej: 85"
                value={viscosidad} onChange={e => setViscosidad(e.target.value)} />
            </div>
            <div>
              <label style={S.fieldLabel}>pH</label>
              <input style={S.fieldInput} type="number" inputMode="decimal" step="0.1" placeholder="Ej: 8.5"
                value={ph} onChange={e => setPh(e.target.value)} />
            </div>
            <div>
              <label style={S.fieldLabel}>Brillo (GU)</label>
              <input style={S.fieldInput} type="number" inputMode="decimal" step="0.1" placeholder="Ej: 20"
                value={brillo} onChange={e => setBrillo(e.target.value)} />
            </div>
            <div>
              <label style={S.fieldLabel}>Densidad (g/mL)</label>
              <input style={S.fieldInput} type="number" inputMode="decimal" step="0.01" placeholder="Ej: 1.32"
                value={densidad} onChange={e => setDensidad(e.target.value)} />
            </div>
          </div>

          <label style={S.fieldLabel}>Notas / Observaciones</label>
          <input style={S.fieldInput} placeholder="Observaciones del QC..."
            value={notas} onChange={e => setNotas(e.target.value)} />
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnDanger} disabled={saving} onClick={handleReject}>
            Rechazar
          </button>
          <button style={S.btnSuccess} disabled={saving} onClick={handleApprove}>
            {saving ? 'Guardando...' : 'Aprobar QC'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                         */
/* ═══════════════════════════════════════════════════════════════════ */
export default function ProduccionPage() {
  const { user, can } = useAuth();
  const userName = user?.nombre || '?';
  /* Leer ?tab=calidad de la URL para que redirección desde alertas funcione.
     Permite que push notifs o notificacionesPage envíen al usuario directo
     a la tab Calidad QC. */
  const [searchParams, setSearchParams] = useSearchParams();
  /* Sprint H: default es "activos" (vista unificada). Los query params siguen
     soportando ?tab=calidad / ?tab=reportes / ?tab=produccion para deep links. */
  const initialTab = searchParams.get('tab') === 'calidad'    ? 'calidad'
                    : searchParams.get('tab') === 'reportes'   ? 'reportes'
                    : searchParams.get('tab') === 'produccion' ? 'produccion'
                    : 'activos';
  const [activeTab, setActiveTab] = useState(initialTab);
  /* Limpiar el query param después de leerlo para que un F5 no vuelva al mismo tab forzado.
     FIX jun 2026 (M1): no borrar `continuar` hasta que el efecto de auto-abrir
     wizard lo haya consumido (depende de productibles que cargan async). */
  useEffect(() => {
    if (searchParams.get('tab') && !searchParams.get('continuar')) {
      const params = new URLSearchParams(searchParams);
      params.delete('tab');
      setSearchParams(params, { replace: true });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);
  const [toastMsg, setToastMsg] = useState('');
  const [prodModal, setProdModal] = useState(null);  // orden/pedido a producir paso-a-paso
  const [qcModal, setQcModal] = useState(null);      // orden a QC
  const [pendingNDA, setPendingNDA] = useState(null); // item esperando aceptación NDA

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 5000);
  }, []);

  /* Emmanuel (id='admin') es el propietario de las fórmulas — bypass del NDA.
     Para cualquier otro usuario se muestra el modal NDA antes de arrancar. */
  const handleStartProduccion = useCallback((it) => {
    if (user && user.id === 'admin') {
      /* Bypass NDA: ejecutar la lógica de arranque directamente */
      (async () => {
        if (it._tipo === 'pedido' && it.estado === 'aceptado') {
          try {
            await api.upsertPedido({
              ...it._raw,
              estado: 'en_produccion',
              fechaInicioProduccion: new Date().toISOString(),
              produccionIniciadaPor: userName,
            });
            reloadPed();
          } catch (e) { showToast('Error: ' + (e.message || 'no se pudo iniciar')); }
        } else {
          setProdModal(it);
        }
      })();
      return;
    }
    setPendingNDA(it);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userName]);

  const { data: ordData, loading, reload: reloadOrd } = useApiData(() => api.getOrdenes(), [], 5000);
  const { data: pedData, reload: reloadPed } = useApiData(() => api.getPedidos(), [], 5000);
  const { data: trazData, reload: reloadTraz } = useApiData(() => api.getTrazabilidad(), [], 8000);
  const { data: qcData } = useApiData(() => api.getQC(), [], 10000);

  /* Realtime: refrescar todas las fuentes ante cambios */
  useRealtimeSync({
    onOrdenes: () => reloadOrd(),
    onPedidos: () => reloadPed(),
    onTrazabilidad: () => reloadTraz(),
  });

  const ordenes = useMemo(() => {
    const arr = ordData?.data || (Array.isArray(ordData) ? ordData : []);
    /* Filtrar órdenes con soft-delete del admin/script. */
    return (Array.isArray(arr) ? arr : []).filter(o => o && !o.eliminado);
  }, [ordData]);

  const pedidos = useMemo(() => {
    const arr = Array.isArray(pedData) ? pedData : (pedData?.data || []);
    /* Filtrar pedidos con soft-delete (estado='eliminado' o flag eliminado). */
    return (Array.isArray(arr) ? arr : []).filter(p => p && !p.eliminado && p.estado !== 'eliminado');
  }, [pedData]);

  const lotes = useMemo(() => {
    const arr = trazData?.data || [];
    /* Filtrar lotes con soft-delete. El backend los mantiene para auditoría
       pero el frontend no debe mostrarlos en producción/QC. */
    return (Array.isArray(arr) ? arr : []).filter(l => l && !l.eliminado);
  }, [trazData]);

  const qcRecords = useMemo(() => {
    const arr = qcData?.data || [];
    return Array.isArray(arr) ? arr : [];
  }, [qcData]);

  /* PRODUCCIÓN ACTIVA REAL — sin pruebas, sin canceladas */
  const enProceso = useMemo(() =>
    ordenes.filter(o => !o.eliminado && o.estado === 'en_proceso' && o.fechaInicioProduccion && !o.esPrueba)
      .sort((a, b) => {
        const p = { urgente: 0, alta: 1, normal: 2 };
        return (p[a.prioridad] || 2) - (p[b.prioridad] || 2);
      }),
    [ordenes]
  );

  /* Pedidos en producción activa REAL */
  const pedidosListos = useMemo(() =>
    pedidos.filter(p => p && p.estado === 'en_produccion' && p.fechaInicioProduccion && !p.esPrueba)
      .sort((a, b) => (a.fechaInicioProduccion || a.fecha || '').localeCompare(b.fechaInicioProduccion || b.fecha || '')),
    [pedidos]
  );

  /* Items en producción de PRUEBA (separados, no contaminan vista activa) */
  const enPrueba = useMemo(() => {
    const ords = ordenes.filter(o => !o.eliminado && o.estado === 'en_proceso' && o.fechaInicioProduccion && o.esPrueba);
    const peds = pedidos.filter(p => p && p.estado === 'en_produccion' && p.fechaInicioProduccion && p.esPrueba);
    return [...ords, ...peds];
  }, [ordenes, pedidos]);

  /* Lista unificada de items productibles, normalizada para el modal */
  const productibles = useMemo(() => {
    const fromOrden = enProceso.map(o => ({
      _tipo: 'orden',
      _raw: o,
      id: o.id,
      codigo: o.codigo,
      formula: o.formula || o.producto,
      cantidad: o.cantidad,
      esPrueba: !!o.esPrueba,
      prioridad: o.prioridad,
      estado: o.estado,
      fechaInicioProduccion: o.fechaInicioProduccion,
      fechaCreacion: o.fechaCreacion,
      notas: o.notas,
      pedidoId: o.pedidoId || '',
    }));
    const fromPedido = pedidosListos.map(p => ({
      _tipo: 'pedido',
      _raw: p,
      id: p.id,
      codigo: p.id,
      formula: p.producto,
      cantidad: p.cantidad,
      esPrueba: !!p.esPrueba,
      prioridad: p.prioridad || 'normal',
      estado: p.estado,
      fechaInicioProduccion: p.fechaInicioProduccion,
      fechaCreacion: p.fecha,
      notas: p.solicitante ? `Solicitante: ${p.solicitante}` : '',
      pedidoId: p.id,
    }));
    /* Pedidos primero (cronómetro corriendo arriba), luego órdenes */
    return [...fromPedido, ...fromOrden];
  }, [enProceso, pedidosListos]);

  /* FIX jun 2026 (M1): si la URL trae `?continuar=<id>`, abrir el wizard del
     pedido/orden directamente. Antes "Continuar wizard" desde MisActivosTab
     solo cambiaba la tab y Enrique tenía que volver a clickear su lote. */
  useEffect(() => {
    const continuarId = searchParams.get('continuar');
    if (!continuarId || prodModal || productibles.length === 0) return;
    const item = productibles.find(p => p.id === continuarId || p.pedidoId === continuarId);
    if (item) {
      setProdModal(item);
      /* Consumido — limpiar query para que F5 no vuelva a forzar */
      const params = new URLSearchParams(searchParams);
      params.delete('continuar');
      params.delete('tab');
      setSearchParams(params, { replace: true });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [productibles, searchParams]);

  /* QC items — BUG FIX: antes filtraba por o.estado === 'qc' (string que NO existe).
     Los estados canónicos tras producción son 'producido' (pendiente de QC),
     'qc_hold' (retenido) y 'qc_aprobado' (aprobado, ya envasable).
     Incluimos también lotes desde trazabilidad para que aparezcan aunque la orden
     ya esté como 'terminada'. */
  const qcItems = useMemo(() => {
    const ordItems = ordenes.filter(o => !o.eliminado && (o.estado === 'producido' || o.estado === 'qc_hold'));
    /* Agregar lotes pendientes de QC que no estén ya en ordItems */
    const ordIds = new Set(ordItems.map(o => o.id));
    const loteItems = (lotes || [])
      .filter(l => l && (l.estado === 'producido' || l.estado === 'qc_hold'))
      .filter(l => !ordIds.has(l.ordenId))
      .map(l => ({
        id: l.id,
        codigo: l.codigoLote || l.codigo,
        producto: l.producto || l.nombre,
        cantidad: l.cantidad,
        estado: l.estado,
        fecha: l.fecha,
        loteRef: l, /* referencia al lote para acciones QC */
      }));
    return [...ordItems, ...loteItems];
  }, [ordenes, lotes]);

  /* Stats */
  const stats = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const mes = hoy.slice(0, 7);
    const lotesHoy = lotes.filter(l => l.fecha?.startsWith(hoy)).length;
    const lotesMes = lotes.filter(l => l.fecha?.startsWith(mes)).length;
    const total = ordenes.filter(o => !o.eliminado).length;
    const completadas = ordenes.filter(o => o.estado === 'terminada' || o.estado === 'entregada').length;
    const qcAprobados = qcRecords.filter(r => r.resultado === 'aprobado').length;
    const qcRechazados = qcRecords.filter(r => r.resultado === 'rechazado').length;
    return { lotesHoy, lotesMes, total, completadas, qcAprobados, qcRechazados };
  }, [lotes, ordenes, qcRecords]);

  /* Sprint H (jun 2026, decisión owner): nuevo tab "Mis activos" como vista
     unificada. Antes el pedido "saltaba" entre tabs según su estado (Lanzar
     lote → Calidad QC → Reportes) y Enrique perdía el hilo. Ahora "Mis activos"
     muestra TODOS sus pedidos/lotes activos en una sola tabla con su pipeline
     visual, sin importar el estado actual. */
  const tabs = [
    { id: 'activos',    label: 'Mis activos' },
    { id: 'produccion', label: 'Lanzar lote' },
    { id: 'calidad',    label: 'Calidad QC' },
    { id: 'reportes',   label: 'Reportes' },
  ];

  if (loading) {
    return (
      <>
        <TopBar title="Producción" />
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Producción" />
      <div style={S.wrap}>
        <PageTabs
          tabs={tabs.map(t => ({ ...t, style: (active) => S.tab(active) }))}
          activeTab={activeTab}
          onChange={setActiveTab}
          style={S.tabs}
        />

        {/* ════════ MIS ACTIVOS — vista unificada (Sprint H) ════════
           Muestra TODOS los pedidos/lotes activos del técnico con timeline
           visual del status. Antes los pedidos "saltaban" entre tabs según
           su estado y Enrique perdía el hilo. Aquí ve todo en una sola vista. */}
        {activeTab === 'activos' && (
          <MisActivosTab pedidos={pedidos} ordenes={ordenes} lotes={lotes} />
        )}

        {/* ════════ PRODUCCIÓN TAB ════════ */}
        {activeTab === 'produccion' && (
          <>
            <div style={S.kpiGrid}>
              <div style={S.kpi('var(--lp-warning-600)')}>
                <div style={S.kpiLabel}>Listos / En curso</div>
                <div style={S.kpiValue}>{productibles.length}</div>
              </div>
              <div style={S.kpi('#7C3AED')}>
                <div style={S.kpiLabel}>En QC</div>
                <div style={S.kpiValue}>{qcItems.length}</div>
              </div>
              <div style={S.kpi('var(--lp-success-600)')}>
                <div style={S.kpiLabel}>Lotes Hoy</div>
                <div style={S.kpiValue}>{stats.lotesHoy}</div>
              </div>
              <div style={S.kpi('var(--lp-brand-600)')}>
                <div style={S.kpiLabel}>Lotes Mes</div>
                <div style={S.kpiValue}>{stats.lotesMes}</div>
              </div>
            </div>

            {productibles.length === 0 ? (
              <div style={{ ...S.empty, padding: '60px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⚙️</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>Sin producción activa</div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 4, lineHeight: 1.6 }}>
                  Aquí solo aparecen lotes con el cronómetro ya iniciado.<br />
                  Para arrancar uno: ve a <strong>Pedidos</strong> o <strong>Órdenes</strong> y presiona <strong>Producir</strong>.
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 12,
              }}>
              {productibles.map(it => {
                const enCurso = it._tipo === 'pedido' && it.estado === 'en_produccion' && it.fechaInicioProduccion;
                return (
                  <div key={it._tipo + ':' + it.id} style={S.card(enCurso)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' }}>{it.codigo}</span>
                      {it._tipo === 'pedido'
                        ? <span style={B('var(--lp-brand-100)', 'var(--lp-brand-700)')}>Pedido</span>
                        : <span style={B('var(--lp-warning-100)', 'var(--lp-warning-600)')}>Orden En Proceso</span>}
                      {it.estado === 'en_produccion' && (
                        <span style={B('var(--lp-warning-100)', 'var(--lp-warning-600)')}>En curso</span>
                      )}
                      {it.estado === 'aceptado' && (
                        <span style={B('var(--lp-success-100)', 'var(--lp-success-600)')}>Listo</span>
                      )}
                      {it.prioridad === 'urgente' && <span style={B('var(--lp-danger-100)', 'var(--lp-danger-600)')}>URGENTE</span>}
                      {it.prioridad === 'alta' && <span style={B('var(--lp-warning-100)', 'var(--lp-warning-600)')}>ALTA</span>}
                      {it.esPrueba && <span style={B('var(--lp-warning-100)', 'var(--lp-warning-600)')}>🧪 PRUEBA</span>}
                      {enCurso && <Cronometro desde={it.fechaInicioProduccion} />}
                    </div>
                    <div style={S.cardTitle}>{it.formula}</div>
                    <div style={S.cardMeta}>
                      {it.cantidad} cubetas
                      {it.fechaCreacion && ` · ${it.fechaCreacion}`}
                      {it.notas && ` · ${it.notas}`}
                    </div>
                    <div style={S.cardActions}>
                      {can('produccion') && it._tipo === 'pedido' && it.estado === 'aceptado' && (
                        <button
                          style={{ ...S.btnSuccess, background: 'var(--lp-warning-600)' }}
                          onClick={() => handleStartProduccion(it)}
                        >
                          Iniciar producción
                        </button>
                      )}
                      {can('produccion') && (it._tipo === 'orden' || it.estado === 'en_produccion') && (
                        <button style={S.btnSuccess} onClick={() => handleStartProduccion(it)}>
                          Iniciar producción
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </>
        )}

        {/* ════════ CALIDAD TAB ════════ */}
        {activeTab === 'calidad' && (
          <>
            <div style={S.kpiGrid}>
              <div style={S.kpi('#7C3AED')}>
                <div style={S.kpiLabel}>En QC</div>
                <div style={S.kpiValue}>{qcItems.length}</div>
              </div>
              <div style={S.kpi('var(--lp-success-600)')}>
                <div style={S.kpiLabel}>Aprobados</div>
                <div style={S.kpiValue}>{stats.qcAprobados}</div>
              </div>
              <div style={S.kpi('var(--lp-danger-600)')}>
                <div style={S.kpiLabel}>Rechazados</div>
                <div style={S.kpiValue}>{stats.qcRechazados}</div>
              </div>
            </div>

            {qcItems.length === 0 ? (
              <div style={S.empty}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>Sin productos en control de calidad</div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 4 }}>
                  Los productos aparecen aquí después de completar producción.
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 12,
              }}>
              {qcItems.map(o => (
                <div key={o.id} style={S.card(true)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--lp-brand-600)', fontFamily: 'var(--lp-font-mono)' }}>{o.codigo}</span>
                    <span style={B('#EDE9FE', '#7C3AED')}>QC Pendiente</span>
                    {o.esPrueba && <span style={B('var(--lp-warning-100)', 'var(--lp-warning-600)')}>🧪 PRUEBA</span>}
                  </div>
                  <div style={S.cardTitle}>{o.formula}</div>
                  <div style={S.cardMeta}>{o.cantidad} cubetas · {o.fechaCreacion}</div>
                  {o.qcResultados && (
                    <div style={{ fontSize: 11, marginTop: 8, padding: '8px 12px', background: 'var(--lp-bg-sunken)', borderRadius: 8 }}>
                      <strong>Último QC:</strong>
                      {o.qcResultados.viscosidad != null && ` Visc: ${o.qcResultados.viscosidad} KU`}
                      {o.qcResultados.ph != null && ` · pH: ${o.qcResultados.ph}`}
                      {o.qcResultados.brillo != null && ` · Brillo: ${o.qcResultados.brillo}`}
                      {o.qcResultados.notas && ` · ${o.qcResultados.notas}`}
                    </div>
                  )}
                  <div style={S.cardActions}>
                    {can('registrarQC') && (
                      <button style={S.btnPrimary} onClick={() => setQcModal(o)}>
                        Registrar QC
                      </button>
                    )}
                  </div>
                </div>
              ))}
              </div>
            )}

            {/* Recent QC records */}
            {qcRecords.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 10 }}>
                  Historial QC reciente
                </div>
                {qcRecords.slice(-10).reverse().map(r => (
                  <div key={r.id} style={{
                    padding: '10px 14px', borderRadius: 8, marginBottom: 6,
                    border: '1px solid var(--lp-border-subtle)',
                    background: r.resultado === 'aprobado' ? 'var(--lp-success-50)' : 'var(--lp-danger-50)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{r.producto}</span>
                      <span style={B(
                        r.resultado === 'aprobado' ? 'var(--lp-success-100)' : 'var(--lp-danger-100)',
                        r.resultado === 'aprobado' ? 'var(--lp-success-600)' : 'var(--lp-danger-600)',
                      )}>
                        {r.resultado === 'aprobado' ? '✓ Aprobado' : '✗ Rechazado'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4 }}>
                      {r.ordenCodigo} · {new Date(r.fecha).toLocaleDateString('es-MX')}
                      {r.viscosidad != null && ` · Visc: ${r.viscosidad}`}
                      {r.ph != null && ` · pH: ${r.ph}`}
                      {r.notas && ` · ${r.notas}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════ REPORTES TAB ════════ */}
        {activeTab === 'reportes' && (
          <>
            <div style={S.kpiGrid}>
              <div style={S.kpi('var(--lp-brand-600)')}>
                <div style={S.kpiLabel}>Total Órdenes</div>
                <div style={S.kpiValue}>{stats.total}</div>
              </div>
              <div style={S.kpi('var(--lp-success-600)')}>
                <div style={S.kpiLabel}>Completadas</div>
                <div style={S.kpiValue}>{stats.completadas}</div>
              </div>
              <div style={S.kpi('var(--lp-warning-600)')}>
                <div style={S.kpiLabel}>Lotes Este Mes</div>
                <div style={S.kpiValue}>{stats.lotesMes}</div>
              </div>
            </div>

            {/* QC rate */}
            {(stats.qcAprobados + stats.qcRechazados) > 0 && (
              <div style={{
                background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
                borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Tasa de aprobación QC</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    fontSize: 28, fontWeight: 700, fontFamily: 'var(--lp-font-mono)',
                    color: 'var(--lp-success-600)',
                  }}>
                    {Math.round((stats.qcAprobados / (stats.qcAprobados + stats.qcRechazados)) * 100)}%
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)' }}>
                    {stats.qcAprobados} aprobados · {stats.qcRechazados} rechazados
                  </div>
                </div>
              </div>
            )}

            <div style={S.empty}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>Reportes detallados</div>
              <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 4 }}>
                Gráficas de producción mensual y análisis de tendencias próximamente.
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── NDA gate antes de iniciar producción ── */}
      {pendingNDA && (
        <NDAModal
          user={user}
          context="produccion"
          productoNombre={pendingNDA.formula || pendingNDA.producto || ''}
          onAccept={async () => {
            const it = pendingNDA;
            setPendingNDA(null);
            /* Si es un pedido aceptado y aún no tiene fechaInicioProduccion → arrancar cronómetro */
            if (it._tipo === 'pedido' && it.estado === 'aceptado') {
              try {
                await api.upsertPedido({
                  ...it._raw,
                  estado: 'en_produccion',
                  fechaInicioProduccion: new Date().toISOString(),
                  produccionIniciadaPor: userName,
                });
                reloadPed();
              } catch (e) { showToast('Error: ' + (e.message || 'no se pudo iniciar')); }
            } else {
              /* Para órdenes y pedidos ya en producción, abrir directo el flujo paso-a-paso */
              setProdModal(it);
            }
          }}
          onReject={() => {
            setPendingNDA(null);
            showToast('NDA rechazado — la producción NO se inició.');
          }}
        />
      )}

      {/* ── Modals ── */}
      {prodModal && (
        <div style={S.overlay} onClick={() => setProdModal(null)}>
          <div style={{
            ...S.modal, maxWidth: 720, width: '100%',
          }} onClick={e => e.stopPropagation()}>
            <ProduccionFlow
              item={prodModal}
              userName={userName}
              onClose={() => setProdModal(null)}
              onSuccess={(msg) => {
                setProdModal(null);
                reloadOrd(); reloadPed(); reloadTraz();
                showToast(msg);
              }}
            />
          </div>
        </div>
      )}
      {qcModal && (
        <QCModal
          orden={qcModal}
          lotes={lotes}
          qcRecords={qcRecords}
          userName={userName}
          onClose={() => setQcModal(null)}
          onSuccess={(msg) => {
            setQcModal(null);
            reloadOrd();
            /* También refrescar trazabilidad: la transición de lote cambia
               lote.estado y dispara WS, pero forzamos aquí por si la pestaña
               se quedó sin recibir el evento (offline, filtro de rol, etc) */
            reloadTraz();
            showToast(msg);
          }}
        />
      )}

      {/* ── Toast ── */}
      {toastMsg && <div style={S.toast}><span style={{ marginRight: 8 }}>✓</span>{toastMsg}</div>}
    </>
  );
}
