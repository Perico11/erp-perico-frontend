import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData, useSearch } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import CompararFormulasModal from './CompararFormulasModal';
import HelpHint from '../../components/HelpHint';
import SecureView from '../../components/SecureView';
import NDAModal, { ndaYaAceptado } from '../../components/NDAModal';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const B = (bg, fg) => ({
  display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 600,
  borderRadius: 6, background: bg, color: fg, marginRight: 4,
});

const S = {
  wrap: { padding: '0 20px 100px' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  card: {
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', overflow: 'hidden', marginBottom: 10,
  },
  cardMain: { padding: '14px 16px', cursor: 'pointer' },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  formulaName: { fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)' },
  arrow: (open) => ({
    fontSize: 10, color: 'var(--lp-text-disabled)', transition: 'transform .2s',
    transform: open ? 'rotate(90deg)' : 'none',
  }),
  ingWrap: { padding: '0 16px 14px', borderTop: '1px solid var(--lp-border-subtle)' },
  ingTitle: {
    fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)',
    padding: '10px 0 6px', textTransform: 'uppercase', letterSpacing: '.04em',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  ingRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
    borderBottom: '1px solid var(--lp-bg-sunken)', fontSize: 12,
  },
  ingName: { flex: 1, fontWeight: 500, color: 'var(--lp-text-primary)', minWidth: 0 },
  ingQty: {
    fontWeight: 700, fontFamily: 'var(--lp-font-mono)', fontSize: 12,
    color: 'var(--lp-text-primary)', minWidth: 55, textAlign: 'right',
  },
  ingUnit: { fontSize: 11, color: 'var(--lp-text-tertiary)', minWidth: 24 },
  meta: { fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 4, lineHeight: 1.5 },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0', fontSize: 13 },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
  statsRow: {
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
  /* Modal */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    width: '100%', maxWidth: 560, maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)', overflowY: 'auto',
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
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', outline: 'none',
    boxSizing: 'border-box', marginBottom: 12,
  },
  btnPrimary: {
    padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-brand-600)', color: '#fff', minHeight: 40,
  },
  btnSecondary: {
    padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', minHeight: 40,
  },
  btnSmall: {
    padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)', minHeight: 28,
  },
  btnDanger: {
    padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', minHeight: 28,
  },
  toast: {
    position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 1001,
    background: 'var(--lp-success-600)', color: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,.15)',
  },
};

/* ═══════════════════════════════════════════════════════════════════ */
/* RENAME MODAL                                                       */
/* ═══════════════════════════════════════════════════════════════════ */
function RenameModal({ formulaId, onClose, onSuccess }) {
  const [newName, setNewName] = useState(formulaId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* MÓVIL: el modal solo se monta cuando está abierto → bloquea scroll de fondo
     y publica --pp-vvh para que el cuerpo scrollee internamente. */
  useBodyScrollLock(true);

  const handleSave = async () => {
    const n = newName.trim();
    if (!n) return setError('Nombre vacío');
    if (n === formulaId) return onClose();
    setSaving(true);
    setError('');
    try {
      await api.renameFormula(formulaId, n);
      onSuccess(`Renombrada: "${formulaId}" → "${n}"`);
    } catch (err) {
      setError(err.message || 'Error al renombrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Renombrar Fórmula</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--lp-text-tertiary)' }} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <div style={{ padding: 12, background: 'var(--lp-bg-sunken)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: 'var(--lp-text-secondary)' }}>
            El cambio se propagará a órdenes, pedidos, trazabilidad, producción mensual y taxonomía.
          </div>
          <label style={S.fieldLabel}>Nombre actual</label>
          <div style={{ padding: '8px 12px', background: 'var(--lp-bg-sunken)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--lp-font-mono)', marginBottom: 12, color: 'var(--lp-text-tertiary)' }}>
            {formulaId}
          </div>
          <label style={S.fieldLabel}>Nuevo nombre</label>
          <input style={S.fieldInput} value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnPrimary} disabled={saving} onClick={handleSave}>
            {saving ? 'Guardando...' : 'Renombrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DuplicarModal({ formulaId, onClose, onSuccess }) {
  const [newName, setNewName] = useState(formulaId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useBodyScrollLock(true);

  const handleSave = async () => {
    const n = newName.trim();
    if (!n) return setError('Nombre vacío');
    if (n === formulaId) return setError('El nombre nuevo debe ser distinto del original');
    setSaving(true);
    setError('');
    try {
      await api.duplicateFormula(formulaId, n);
      onSuccess(`Duplicada: "${formulaId}" → "${n}"`);
    } catch (err) {
      setError(err.message || 'Error al duplicar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Duplicar Fórmula</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--lp-text-tertiary)' }} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <div style={{ padding: 12, background: 'var(--lp-bg-sunken)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: 'var(--lp-text-secondary)' }}>
            Crea una fórmula NUEVA copiando los ingredientes de la original. La original no se modifica — luego puedes ajustar la receta de la copia.
          </div>
          <label style={S.fieldLabel}>Copiar de</label>
          <div style={{ padding: '8px 12px', background: 'var(--lp-bg-sunken)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--lp-font-mono)', marginBottom: 12, color: 'var(--lp-text-tertiary)' }}>
            {formulaId}
          </div>
          <label style={S.fieldLabel}>Nombre de la nueva fórmula</label>
          <input style={S.fieldInput} value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnPrimary} disabled={saving} onClick={handleSave}>
            {saving ? 'Duplicando...' : 'Duplicar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* COMBOBOX — buscar MP en maestro con autocomplete + crear nueva     */
/* ═══════════════════════════════════════════════════════════════════ */
function MPCombobox({ value, onSelect, onCreateNew, mps }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || '');
  const wrapRef = useRef(null);

  useEffect(() => { setQ(value || ''); }, [value]);

  /* Cierra al click afuera */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    const qq = (q || '').toLowerCase().trim();
    if (!qq) return mps.slice(0, 50);
    return mps.filter(m => m.nombre.toLowerCase().includes(qq)).slice(0, 50);
  }, [q, mps]);

  const exactMatch = filtered.some(m => m.nombre.toLowerCase() === (q || '').toLowerCase().trim());

  return (
    <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        style={{ ...S.fieldInput, width: '100%', marginBottom: 0, fontSize: 12, padding: '8px 10px' }}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Escribe para buscar materia prima…"
      />
      {open && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4,
          background: 'var(--lp-bg-raised)',
          border: '1.5px solid var(--lp-border-strong)',
          borderRadius: 'var(--lp-radius)',
          boxShadow: '0 8px 24px rgba(26,24,21,.12)',
          maxHeight: 240, overflowY: 'auto', zIndex: 100,
        }}>
          {filtered.map((mp) => (
            <button
              key={mp.nombre}
              type="button"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '8px 12px',
                background: 'none', border: 'none', textAlign: 'left',
                fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                borderBottom: '1px solid var(--lp-border-subtle)',
                color: 'var(--lp-text-primary)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--lp-bg-sunken)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              onClick={() => { onSelect(mp); setOpen(false); setQ(mp.nombre); }}
            >
              <span style={{ fontWeight: 500 }}>{mp.nombre}</span>
              <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginLeft: 8 }}>
                {mp.categoria || 'sin cat'}
                {mp.costoKg > 0 && ` · $${mp.costoKg.toFixed(2)}/kg`}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
              Sin coincidencias
            </div>
          )}
          {q.trim() && !exactMatch && (
            <button
              type="button"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 12px',
                background: 'var(--lp-brand-50)', border: 'none', textAlign: 'left',
                fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                color: 'var(--lp-brand-700)', fontWeight: 600,
              }}
              onClick={() => { onCreateNew(q.trim()); setOpen(false); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Crear nueva MP: "{q.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* CREAR NUEVA MP — sub-modal con propiedades para no romper formula  */
/* ═══════════════════════════════════════════════════════════════════ */
function NuevaMPModal({ nombreInicial, onClose, onCreated }) {
  const [nombre, setNombre] = useState(nombreInicial || '');
  const [categoria, setCategoria] = useState('Sin Categoría');
  const [densidad, setDensidad] = useState(1);
  const [precioBase, setPrecioBase] = useState(0);
  const [flete, setFlete] = useState(5);
  const [moneda, setMoneda] = useState('MXN');
  const [stock, setStock] = useState(0);
  const [stockMin, setStockMin] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  /* MÓVIL: el modal solo se monta cuando está abierto → bloquea scroll de fondo
     y publica --pp-vvh para que el cuerpo scrollee internamente. */
  useBodyScrollLock(true);

  const CATEGORIAS = [
    'Resinas y Ligantes', 'Pigmentos y Colorantes', 'Solventes y Coalescentes',
    'Aditivos y Dispersantes', 'Cargas y Cargas Minerales', 'Conservadores y Biocidas',
    'Sin Categoría',
  ];

  const handleCreate = async () => {
    if (!nombre.trim()) return setErr('Nombre requerido');
    if (precioBase < 0 || flete < 0) return setErr('Precios deben ser positivos');
    setSaving(true);
    setErr('');
    try {
      /* Auditoría 24-ago-2026 (F1-03): este botón mandaba {mp, campos:{…}} a
         POST /api/maestro-mp — que espera {mp, campo, valor} — y respondía 400
         SIEMPRE: crear una MP desde el editor de fórmulas nunca funcionó. El
         alta canónica es api.crearMP → /api/maestro-mp/crear (permiso altaMP),
         que además siembra el inventario y espeja el costo. El costo viaja
         LANDED en MXN (base + flete), como lo modela /crear. */
      await api.crearMP({
        nombre: nombre.trim(),
        categoria,
        stockInicial: parseFloat(stock) || 0,
        min: parseFloat(stockMin) || 0,
        costoKg: (parseFloat(precioBase) || 0) + (parseFloat(flete) || 0),
        densidad: parseFloat(densidad) || 1,
        presentacion: '',
      });
      onCreated({
        nombre: nombre.trim(),
        categoria,
        densidad: parseFloat(densidad) || 1,
        costoKg: (parseFloat(precioBase) || 0) + (parseFloat(flete) || 0),
      });
    } catch (e) {
      setErr(e.message || 'Error al crear MP');
    } finally {
      setSaving(false);
    }
  };

  /* Overlay de pantalla completa: 1100 = sobre el bottom-nav Y sobre el
     editor de fórmula (S.overlay base 1000) desde el que se abre. El viejo
     zIndex:200 lo dejaba DEBAJO de ambos. */
  return (
    <div style={{ ...S.overlay, zIndex: 1100 }}>
      <div style={{ ...S.modal, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Crear nueva materia prima</div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-secondary)', marginTop: 2 }}>
              Se agregará al maestro con sus precios para no romper cálculos
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--lp-text-tertiary)' }} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          {err && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {err}
            </div>
          )}

          <label style={S.fieldLabel}>Nombre canónico</label>
          <input style={S.fieldInput} value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />

          <label style={S.fieldLabel}>Categoría</label>
          <select style={S.fieldInput} value={categoria} onChange={e => setCategoria(e.target.value)}>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={S.fieldLabel}>Precio base</label>
              <input style={S.fieldInput} type="number" inputMode="decimal" step="0.01" min="0" value={precioBase} onChange={e => setPrecioBase(e.target.value)} />
            </div>
            <div>
              <label style={S.fieldLabel}>Flete /kg</label>
              <input style={S.fieldInput} type="number" inputMode="decimal" step="0.01" min="0" value={flete} onChange={e => setFlete(e.target.value)} />
            </div>
            <div>
              <label style={S.fieldLabel}>Moneda</label>
              <select style={S.fieldInput} value={moneda} onChange={e => setMoneda(e.target.value)}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={S.fieldLabel}>Densidad (kg/L)</label>
              <input style={S.fieldInput} type="number" inputMode="decimal" step="0.001" min="0" value={densidad} onChange={e => setDensidad(e.target.value)} />
            </div>
            <div>
              <label style={S.fieldLabel}>Stock inicial</label>
              <input style={S.fieldInput} type="number" inputMode="decimal" step="1" min="0" value={stock} onChange={e => setStock(e.target.value)} />
            </div>
            <div>
              <label style={S.fieldLabel}>Stock mín.</label>
              <input style={S.fieldInput} type="number" inputMode="decimal" step="1" min="0" value={stockMin} onChange={e => setStockMin(e.target.value)} />
            </div>
          </div>

          <div style={{
            background: 'var(--lp-info-50)', border: '1px solid var(--lp-info-200)',
            padding: 10, borderRadius: 8, fontSize: 11, color: 'var(--lp-text-secondary)',
            lineHeight: 1.5, marginTop: 8,
          }}>
            Total por kg = ${((parseFloat(precioBase) || 0) + (parseFloat(flete) || 0)).toFixed(2)} {moneda}.
            Esto entra al maestro y se usa para calcular el costo de cualquier fórmula que la incluya.
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnPrimary} disabled={saving} onClick={handleCreate}>
            {saving ? 'Creando...' : 'Crear y agregar a fórmula'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* EDIT INGREDIENTES MODAL — con drag & drop + combobox MP            */
/* ═══════════════════════════════════════════════════════════════════ */
function EditIngModal({ formulaId, formula, onClose, onSuccess }) {
  const [ings, setIngs] = useState(() =>
    (formula.ingredientes || []).map(ing => ({ ...ing }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [dragArmedIdx, setDragArmedIdx] = useState(null); /* idx con drag habilitado (handle pressed) */
  const [creatingMP, setCreatingMP] = useState(null); /* { idx, nombre } */
  const [mps, setMps] = useState([]); /* lista MPs del maestro */

  /* MÓVIL: el modal solo se monta cuando está abierto → bloquea scroll de fondo
     y publica --pp-vvh para que el cuerpo scrollee internamente. */
  useBodyScrollLock(true);

  /* Cargar MPs del maestro al abrir */
  useEffect(() => {
    api.getMaestroMP().then(r => {
      const data = r.data || r;
      const list = [];
      Object.entries(data?.mps || {}).forEach(([nombre, m]) => {
        if (m.estado === 'eliminado') return;
        list.push({
          nombre,
          categoria: m.categoria,
          estado: m.estado,
          densidad: m.densidad || 1,
          costoKg: m.costo?.costoKg || 0,
        });
      });
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setMps(list);
    }).catch(() => {});
  }, []);

  const totalKg = ings.reduce((s, i) => s + (parseFloat(i.kg19) || 0), 0);

  /* BASE FIJA para los %: el total de la fórmula GUARDADA (al abrir el modal).
     Contra base fija, al mover una cantidad SOLO esa fila cambia su % y el TOTAL
     marca el desbalance (ej. 103.2%). Antes se dividía entre el total ACTUAL →
     siempre re-normalizaba a 100% y el usuario no veía moverse nada. */
  const baseKg = useMemo(
    () => (formula.ingredientes || []).reduce((s, i) => s + (parseFloat(i.kg19) || 0), 0),
    [] // eslint-disable-line react-hooks/exhaustive-deps — snapshot al abrir
  );
  const refKg = baseKg > 0 ? baseKg : totalKg; /* fórmula nueva: base viva */
  const totalPct = refKg > 0 ? (totalKg / refKg) * 100 : 0;
  const desbalance = Math.abs(totalPct - 100);
  /* Volumen VIVO (kg/densidad) — el campo ing.vol guardado no se actualiza al teclear */
  const totalVol = ings.reduce((s, i) => s + ((parseFloat(i.kg19) || 0) / (parseFloat(i.densidad) || 1)), 0);

  const updateIng = (idx, field, val) => {
    setIngs(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: val } : ing));
  };

  const removeIng = (idx) => {
    setIngs(prev => prev.filter((_, i) => i !== idx));
  };

  const addIng = () => {
    setIngs(prev => [...prev, { no: prev.length + 1, nombre: '', kg19: 0, vol: 0, densidad: 1, cat: '' }]);
  };

  /* Drag & Drop handlers */
  const handleDragStart = (idx) => (e) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };
  const handleDragOver = (idx) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  };
  const handleDragLeave = () => setDragOverIdx(null);
  const handleDrop = (idx) => (e) => {
    e.preventDefault();
    const from = draggedIdx;
    if (from === null || from === idx) {
      setDraggedIdx(null); setDragOverIdx(null); return;
    }
    setIngs(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      return next.map((ing, i) => ({ ...ing, no: i + 1 }));
    });
    setDraggedIdx(null); setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDraggedIdx(null); setDragOverIdx(null); setDragArmedIdx(null); };

  /* Cuando seleccionan MP del combobox: actualiza nombre + auto-llena densidad/cat */
  const handleSelectMP = (idx, mp) => {
    setIngs(prev => prev.map((ing, i) => i === idx ? {
      ...ing,
      nombre: mp.nombre,
      densidad: mp.densidad || ing.densidad || 1,
      cat: mp.categoria || ing.cat,
    } : ing));
  };

  /* Cuando crean nueva MP desde el combobox */
  const handleNuevaMPCreated = (mp) => {
    if (creatingMP) {
      setIngs(prev => prev.map((ing, i) => i === creatingMP.idx ? {
        ...ing,
        nombre: mp.nombre,
        densidad: mp.densidad || 1,
        cat: mp.categoria,
      } : ing));
      /* Refresh lista para que aparezca al buscar */
      setMps(prev => {
        if (prev.find(p => p.nombre === mp.nombre)) return prev;
        return [...prev, mp].sort((a, b) => a.nombre.localeCompare(b.nombre));
      });
    }
    setCreatingMP(null);
  };

  const handleSave = async () => {
    for (const ing of ings) {
      if (!ing.nombre || !ing.nombre.trim()) return setError('Todos los ingredientes necesitan nombre');
    }
    setSaving(true);
    setError('');
    try {
      const cleaned = ings.map((ing, i) => ({
        ...ing,
        no: i + 1,
        kg19: parseFloat(ing.kg19) || 0,
        vol: parseFloat(ing.vol) || parseFloat(ing.kg19) || 0,
      }));
      await api.updateFormula(formulaId, cleaned);
      onSuccess(`Ingredientes de "${formulaId}" actualizados`);
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div style={S.overlay}>
      <div style={{ ...S.modal, maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Editar Ingredientes</div>
            <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2 }}>
              {formulaId} · Arrastra ⋮⋮ para reordenar
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--lp-text-tertiary)' }} aria-label="Cerrar">✕</button>
        </div>
        <div style={S.modalBody}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <HelpHint id="formulas-editor" title="Editar fórmula sin romper cálculos">
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li><strong>Mantén presionado el icono ⠿</strong> y arrastra para reordenar (orden de adición en producción).</li>
              <li>Al teclear en el campo Ingrediente aparece dropdown con MPs del maestro — selecciona para evitar typos.</li>
              <li>Si la MP no existe, click <strong>"Crear nueva MP"</strong> y captura precio + densidad para no romper costos ni PVC.</li>
            </ul>
          </HelpHint>

          {/* Header row */}
          <div style={{ display: 'flex', gap: 8, padding: '4px 0 4px 22px', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
            <span style={{ width: 24 }}>#</span>
            <span style={{ flex: 1, minWidth: 0 }}>Ingrediente</span>
            <span style={{ width: 90, textAlign: 'right' }}>kg/cubeta</span>
            <span style={{ width: 60, textAlign: 'right' }}>%</span>
            <span style={{ width: 28 }}></span>
          </div>

          {ings.map((ing, idx) => {
            const pct = refKg > 0 ? ((parseFloat(ing.kg19) || 0) / refKg * 100) : 0;
            const isDragOver = dragOverIdx === idx && draggedIdx !== idx;
            const isDragging = draggedIdx === idx;
            return (
              <div
                key={idx}
                draggable={dragArmedIdx === idx}
                onDragStart={handleDragStart(idx)}
                onDragOver={handleDragOver(idx)}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop(idx)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6,
                  padding: '4px 4px',
                  borderRadius: 6,
                  background: isDragOver ? 'var(--lp-brand-50)' :
                              isDragging ? 'var(--lp-bg-sunken)' : 'transparent',
                  opacity: isDragging ? 0.5 : 1,
                  borderTop: isDragOver ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
                  transition: 'background .12s, border .08s',
                }}
              >
                {/* Drag handle — solo este activa el drag */}
                <span
                  onMouseDown={() => setDragArmedIdx(idx)}
                  onMouseUp={() => setDragArmedIdx(null)}
                  onMouseLeave={() => setDragArmedIdx(prev => prev === idx ? null : prev)}
                  style={{
                    cursor: 'grab', color: dragArmedIdx === idx ? 'var(--lp-brand-600)' : 'var(--lp-text-tertiary)',
                    fontSize: 16, padding: '4px 6px', userSelect: 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 4,
                    background: dragArmedIdx === idx ? 'var(--lp-brand-50)' : 'transparent',
                    transition: 'background .1s, color .1s',
                  }}
                  title="Mantén presionado y arrastra para reordenar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                  </svg>
                </span>
                <span style={{ width: 22, fontSize: 11, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }}>
                  {idx + 1}
                </span>
                <MPCombobox
                  value={ing.nombre}
                  mps={mps}
                  onSelect={(mp) => handleSelectMP(idx, mp)}
                  onCreateNew={(nombre) => setCreatingMP({ idx, nombre })}
                />
                <input
                  style={{ ...S.fieldInput, width: 90, marginBottom: 0, textAlign: 'right', fontSize: 12, padding: '8px 10px', fontFamily: 'var(--lp-font-mono)' }}
                  type="number"
                  step="0.001"
                  min="0"
                  value={ing.kg19 ?? ''}
                  onChange={e => updateIng(idx, 'kg19', e.target.value)}
                />
                <span style={{ width: 60, textAlign: 'right', fontSize: 11, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }}>
                  {pct.toFixed(1)}%
                </span>
                <button onClick={() => removeIng(idx)} style={{ ...S.btnDanger, width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✕
                </button>
              </div>
            );
          })}

          {/* Total row — % contra la fórmula guardada: 100% = balanceada; otro valor = desbalance */}
          <div style={{ display: 'flex', gap: 8, padding: '8px 0 4px 22px', borderTop: '2px solid var(--lp-border-subtle)', marginTop: 8 }}>
            <span style={{ width: 24 }}></span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 12 }}>Total por cubeta 19L</span>
            <span style={{ width: 90, textAlign: 'right', fontWeight: 700, fontSize: 12, fontFamily: 'var(--lp-font-mono)' }}>
              {totalKg.toFixed(2)} kg
            </span>
            <span style={{
              width: 60, textAlign: 'right', fontSize: 11, fontFamily: 'var(--lp-font-mono)',
              fontWeight: desbalance > 0.5 ? 700 : 400,
              color: desbalance > 2 ? 'var(--lp-danger-600)' : desbalance > 0.5 ? 'var(--lp-warning-700)' : 'var(--lp-success-600, #1D9E75)',
            }}>
              {totalPct.toFixed(1)}%
            </span>
            <span style={{ width: 28 }}></span>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '2px 28px 0 22px', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 10.5, color: 'var(--lp-text-tertiary)' }}>
              % vs fórmula guardada ({refKg.toFixed(2)} kg) · Vol. calc: {totalVol.toFixed(1)} L de 19 L
              {desbalance > 0.5 ? ` · desbalance ${totalPct > 100 ? '+' : '−'}${desbalance.toFixed(1)}%` : ' · balanceada'}
            </span>
          </div>

          <button onClick={addIng} style={{ ...S.btnSmall, marginTop: 12 }}>
            + Agregar ingrediente
          </button>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnPrimary} disabled={saving} onClick={handleSave}>
            {saving ? 'Guardando...' : `Guardar (${ings.length} ingredientes)`}
          </button>
        </div>
      </div>
    </div>
    {creatingMP && (
      <NuevaMPModal
        nombreInicial={creatingMP.nombre}
        onClose={() => setCreatingMP(null)}
        onCreated={handleNuevaMPCreated}
      />
    )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* FORMULA CARD                                                        */
/* ═══════════════════════════════════════════════════════════════════ */
function FormulaCard({ id, formula, isAdmin, oculta, onOcultar, onRename, onEdit, onDuplicate }) {
  const [open, setOpen] = useState(false);
  const ings = formula.ingredientes || [];
  const tec = formula.tecnico || {};
  const totalKg = ings.reduce((sum, ing) => sum + (ing.kg19 || 0), 0);
  /* Volumen vivo desde kg/densidad (no del campo vol guardado) — control físico:
     una cubeta debe llenar ~19 L; si la fórmula queda desbalanceada, esto lo delata. */
  const totalVol = ings.reduce((sum, ing) => sum + ((ing.kg19 || 0) / (ing.densidad || 1)), 0);
  const pctLlenado = (totalVol / 19) * 100;
  const desbalanceVol = Math.abs(pctLlenado - 100);

  return (
    <div style={S.card}>
      <div style={S.cardMain} onClick={() => setOpen(!open)}>
        <div style={S.cardHeader}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.formulaName}>{id}</div>
            <div style={S.meta}>
              {ings.length} ingredientes · {totalKg.toFixed(1)} kg · {totalVol.toFixed(1)} L/cubeta
              {tec.densidad ? ` · δ ${tec.densidad.toFixed(3)}` : ''}
              {tec.acabado ? ` · ${tec.acabado}` : ''}
            </div>
            {(tec.nv_peso || tec.pvc) && (
              <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tec.nv_peso != null && <span>NV: {tec.nv_peso.toFixed(1)}%</span>}
                {tec.pvc != null && <span>PVC: {tec.pvc.toFixed(1)}%</span>}
                {tec.kg_total != null && <span>Peso: {tec.kg_total.toFixed(1)} kg</span>}
              </div>
            )}
          </div>
          <span style={S.arrow(open)}>▶</span>
        </div>
      </div>

      {open && (
        <div style={S.ingWrap}>
          <div style={S.ingTitle}>
            <span>Ingredientes</span>
            {isAdmin && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                {oculta && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: 0.5, padding: '3px 8px',
                    borderRadius: 10, background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)',
                  }}>OCULTA</span>
                )}
                <button style={S.btnSmall} onClick={(e) => { e.stopPropagation(); onEdit(id, formula); }}>
                  Editar
                </button>
                <button style={{ ...S.btnSmall, background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)' }}
                  onClick={(e) => { e.stopPropagation(); onRename(id); }}>
                  Renombrar
                </button>
                <button style={{ ...S.btnSmall, background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)' }}
                  onClick={(e) => { e.stopPropagation(); onDuplicate(id); }}>
                  Duplicar
                </button>
                <button
                  title={oculta ? 'Volver a mostrar en todas las pantallas' : 'Ocultar de Inventario, Pedidos y Fórmulas (no elimina nada)'}
                  style={{ ...S.btnSmall, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' }}
                  onClick={(e) => { e.stopPropagation(); onOcultar && onOcultar(id); }}>
                  {oculta ? 'Mostrar' : 'Ocultar'}
                </button>
              </div>
            )}
          </div>
          {ings.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', padding: '8px 0' }}>
              Sin ingredientes registrados
            </div>
          ) : (
            ings.map((ing, i) => (
              <div key={i} style={S.ingRow}>
                <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <span style={S.ingName}>{ing.nombre || ing.mp}</span>
                <span style={S.ingQty}>{(ing.kg19 || 0).toFixed(3)}</span>
                <span style={S.ingUnit}>kg</span>
                {totalKg > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', minWidth: 40, textAlign: 'right' }}>
                    {((ing.kg19 || 0) / totalKg * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            ))
          )}
          {totalKg > 0 && (
            <>
              <div style={{ ...S.ingRow, fontWeight: 700, borderBottom: 'none', paddingTop: 8 }}>
                <span style={{ width: 20, flexShrink: 0 }}></span>
                <span style={S.ingName}>Total por cubeta 19L</span>
                <span style={S.ingQty}>{totalKg.toFixed(3)}</span>
                <span style={S.ingUnit}>kg</span>
                {/* Llenado de cubeta (vol calc / 19 L) — reacciona si la fórmula quedó
                    desbalanceada, a diferencia del viejo "100%" fijo de composición. */}
                <span style={{
                  fontSize: 11, minWidth: 40, textAlign: 'right', fontFamily: 'var(--lp-font-mono)',
                  fontWeight: desbalanceVol > 1 ? 700 : 400,
                  color: desbalanceVol > 3 ? 'var(--lp-danger-600)' : desbalanceVol > 1 ? 'var(--lp-warning-700)' : 'var(--lp-text-tertiary)',
                }}>
                  {pctLlenado.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 4px 0' }}>
                <span style={{ fontSize: 10.5, color: 'var(--lp-text-tertiary)' }}>
                  Llenado: {totalVol.toFixed(2)} L de 19 L{desbalanceVol > 1 ? ` · ${pctLlenado > 100 ? 'sobra' : 'falta'} ${Math.abs(totalVol - 19).toFixed(2)} L` : ' ✓'}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                          */
/* ═══════════════════════════════════════════════════════════════════ */
/* JUL 2026: `embedded` — la pantalla también vive como vista del hub "Fórmulas
   y lab" (/formulas) del admin (patrón AlmacenPage). Solo suprime su TopBar. */
/* ═══════════════════════════════════════════════════════════════════ */
/* IMPORTAR LA GOOGLE SHEET (4-sep-2026, pedido dueño: "conéctala")     */
/* ═══════════════════════════════════════════════════════════════════ */
/* El flujo del INDICE de la Sheet, pero terminando AQUÍ en vez de en un
   chat: descargar el libro (.xlsx), subirlo, ver el plan (dry-run del
   servidor: qué cambia, qué se bloquea) y APLICAR con respaldo. */
const SHEET_FORMULAS_URL = 'https://docs.google.com/spreadsheets/d/129aTdHXyZMI4DBgyTd59vRrU0DaTtc1LFeTVzv2HN4A/edit';

const kgTxt = (n) => Number(n).toFixed(3).replace(/\.?0+$/, '');

export function ImportarSheetModal({ onClose, onSuccess }) {
  useBodyScrollLock(true);
  const [b64, setB64] = useState(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [plan, setPlan] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [omitir, setOmitir] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exportHint, setExportHint] = useState('');

  /* La ida del ciclo: si una fórmula se editó o nació EN el ERP, la Sheet
     está vieja — este botón baja el libro fresco para reemplazarla. */
  const exportar = async () => {
    if (cargando) return;
    setError(''); setExportHint('');
    setCargando(true);
    try {
      const r = await api.exportarFormulasXlsx();
      const { xlsxBase64, nombreArchivo } = r?.data || {};
      const bytes = Uint8Array.from(atob(xlsxBase64 || ''), ch => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url; a.download = nombreArchivo || 'Formulas ERP.xlsx'; a.click();
      URL.revokeObjectURL(url);
      setExportHint('Libro descargado. En la Sheet: Archivo → Importar → Subir → REEMPLAZAR hoja de cálculo — la URL y los permisos no cambian.');
    } catch (err) {
      setError(err.message || 'No se pudo exportar');
    } finally { setCargando(false); }
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError(''); setPlan(null); setResultado(null); setOmitir(false); setCargando(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = () => reject(new Error('No se pudo leer el archivo'));
        r.readAsDataURL(file);
      });
      setB64(base64); setNombreArchivo(file.name);
      const r = await api.importarFormulasXlsx(base64);
      setPlan(r?.data?.plan || null);
    } catch (err) {
      setError(err.message || 'No se pudo armar el plan');
    } finally { setCargando(false); }
  };

  const hayQueEscribir = plan ? (plan.cambios.length + plan.altas.length) : 0;
  const bloqueada = !!(plan && plan.bloqueos.length && !omitir);

  const aplicar = async () => {
    if (!b64 || !plan || cargando) return;
    if (!window.confirm(`Se van a escribir ${hayQueEscribir} fórmula(s) en el ERP (con respaldo previo). ¿Aplicar?`)) return;
    setCargando(true); setError('');
    try {
      const r = await api.importarFormulasXlsx(b64, 'APLICAR', omitir);
      setResultado(r?.data || null);
    } catch (err) {
      setError(err.message || 'No se pudo aplicar');
    } finally { setCargando(false); }
  };

  const seccion = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)', margin: '14px 0 6px' };
  const linea = { fontSize: 12.5, padding: '3px 0', color: 'var(--lp-text-primary)', lineHeight: 1.5 };
  const mono = { fontFamily: 'var(--lp-font-mono)' };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Importar fórmulas desde la Sheet</div>
          <button style={S.btnSecondary} onClick={onClose}>Cerrar</button>
        </div>
        <div style={S.modalBody} data-id="formulas.importar.cuerpo">
          {!resultado && (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                1) Abre la <a href={SHEET_FORMULAS_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--lp-brand-600)', fontWeight: 700 }}>Sheet de fórmulas</a> y
                edita solo <strong>Materia Prima</strong> y <strong>kg/19L</strong>. 2) <strong>Archivo → Descargar → .xlsx</strong>.
                3) Súbelo aquí: primero se enseña el plan, no se escribe nada hasta APLICAR.
              </div>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={onFile}
                disabled={cargando}
                style={{ ...S.fieldInput, padding: 8 }}
                data-id="formulas.importar.archivo"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
                  ¿Editaste o creaste una fórmula EN el ERP? Refresca la Sheet primero:
                </span>
                <button style={S.btnSmall} onClick={exportar} disabled={cargando} data-id="formulas.importar.exportar">
                  Exportar el ERP → .xlsx
                </button>
              </div>
              {exportHint && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--lp-success-50)', color: 'var(--lp-success-700)', fontSize: 12.5, fontWeight: 600 }} data-id="formulas.importar.export-hint">
                  {exportHint}
                </div>
              )}
            </>
          )}

          {cargando && <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)' }}>Trabajando…</div>}
          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
              {error}
            </div>
          )}

          {plan && !resultado && (
            <div data-id="formulas.importar.plan">
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4 }}>
                {nombreArchivo} — cambian {plan.cambios.length} · altas {plan.altas.length} · sin cambio {plan.sinCambio.length} · bloqueadas {plan.bloqueos.length}
              </div>

              {plan.cambios.length > 0 && (
                <>
                  <div style={seccion}>Cambios de receta</div>
                  {plan.cambios.map(c => (
                    <div key={c.nombre} style={{ ...linea, borderBottom: '1px solid var(--lp-bg-sunken)', paddingBottom: 6, marginBottom: 4 }} data-id="formulas.importar.cambio">
                      <strong>{c.nombre}</strong> <span style={{ color: 'var(--lp-text-tertiary)' }}>[{kgTxt(c.pesoAntes)} → {kgTxt(c.pesoDespues)} kg]</span>
                      {c.modificados.map(m => (
                        <div key={'m' + m.mp} style={mono}>~ {m.mp}: {kgTxt(m.antes)} → {kgTxt(m.despues)} kg</div>
                      ))}
                      {c.agregados.map(a => (
                        <div key={'a' + a.mp} style={{ ...mono, color: 'var(--lp-success-700)' }}>+ {a.mp}: {kgTxt(a.kg19)} kg (nueva en esta fórmula)</div>
                      ))}
                      {c.quitados.map(q => (
                        <div key={'q' + q.mp} style={{ ...mono, color: 'var(--lp-danger-600)' }}>− {q.mp}: llevaba {kgTxt(q.kg19)} kg (sale)</div>
                      ))}
                    </div>
                  ))}
                </>
              )}

              {plan.altas.length > 0 && (
                <>
                  <div style={seccion}>Fórmulas nuevas</div>
                  {plan.altas.map(a => (
                    <div key={a.nombre} style={linea}>+ <strong>{a.nombre}</strong>: {a.numIngredientes} ingredientes, {kgTxt(a.pesoDespues)} kg</div>
                  ))}
                </>
              )}

              {plan.avisos.length > 0 && (
                <>
                  <div style={{ ...seccion, color: 'var(--lp-warning-700)' }}>Avisos (no impiden aplicar)</div>
                  {plan.avisos.map((a, i) => (
                    <div key={i} style={{ ...linea, color: 'var(--lp-warning-700)' }}>⚠ {a.nombre}: {a.texto}</div>
                  ))}
                </>
              )}

              {plan.bloqueos.length > 0 && (
                <>
                  <div style={{ ...seccion, color: 'var(--lp-danger-600)' }}>Bloqueos (estas fórmulas NO se aplican)</div>
                  {plan.bloqueos.map((b, i) => (
                    <div key={i} style={{ ...linea, color: 'var(--lp-danger-600)' }} data-id="formulas.importar.bloqueo">✖ {b.nombre}: {b.motivo}</div>
                  ))}
                  {plan.mpNuevas.length > 0 && (
                    <div style={{ ...linea, color: 'var(--lp-text-secondary)' }}>
                      Las MP desconocidas se dan de alta en el maestro (Fórmulas → Nueva MP) y se reintenta.
                    </div>
                  )}
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, marginTop: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={omitir} onChange={e => setOmitir(e.target.checked)} data-id="formulas.importar.omitir" />
                    Aplicar solo las fórmulas sanas y saltar las bloqueadas
                  </label>
                </>
              )}

              {plan.enErpFueraDelLibro.length > 0 && (
                <div style={{ ...linea, color: 'var(--lp-text-tertiary)', marginTop: 10 }}>
                  {plan.enErpFueraDelLibro.length} fórmula(s) del ERP no vienen en el libro: se dejan intactas (el importador nunca borra).
                </div>
              )}
            </div>
          )}

          {resultado && (
            <div data-id="formulas.importar.resultado">
              {resultado.aplicado ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-success-700)' }}>
                    Aplicado: {resultado.formulasEscritas.length} fórmula(s) escritas, {resultado.mpsResincronizadas} MP resincronizadas.
                  </div>
                  <div style={{ ...linea, ...mono, fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 6 }}>
                    Respaldo: {resultado.backupDir}
                  </div>
                  <div style={{ ...linea, marginTop: 4 }}>
                    {resultado.propagar.corrido
                      ? (resultado.propagar.ok
                        ? 'Propiedades (PVC, densidad, sólidos) recalculadas.'
                        : 'OJO: el recálculo de propiedades falló — avisar a soporte. Las recetas sí quedaron.')
                      : `Recálculo de propiedades pendiente: ${resultado.propagar.motivo || 'correrlo a mano'}.`}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  El ERP ya coincide con el libro: no había nada que escribir.
                </div>
              )}
            </div>
          )}
        </div>
        <div style={S.modalFooter}>
          {resultado ? (
            <button style={S.btnPrimary} onClick={() => onSuccess(resultado.aplicado
              ? `${resultado.formulasEscritas.length} fórmula(s) importadas de la Sheet`
              : 'El ERP ya coincidía con la Sheet')}>
              Listo
            </button>
          ) : (
            <>
              <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
              <button
                style={{ ...S.btnPrimary, opacity: (!plan || !hayQueEscribir || bloqueada || cargando) ? 0.5 : 1 }}
                disabled={!plan || !hayQueEscribir || bloqueada || cargando}
                onClick={aplicar}
                data-id="formulas.importar.aplicar"
              >
                {bloqueada ? 'Hay bloqueos' : hayQueEscribir ? `APLICAR (${hayQueEscribir})` : 'Nada que aplicar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FormulasPage({ embedded = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.rol === 'admin';
  const { query, debouncedQuery, setQuery } = useSearch(200);
  /* Emmanuel (id='admin') es el propietario — auto-aceptado, sin NDA. */
  const [ndaOk, setNdaOk] = useState(() => (user && user.id === 'admin') || ndaYaAceptado(user, 'formulas'));
  const { data: fData, loading, error, reload } = useApiData(
    () => ndaOk ? api.getFormulas() : Promise.resolve({ data: { formulas: {} } }),
    [ndaOk], 30000
  );
  const [renameId, setRenameId] = useState(null);
  const [dupId, setDupId] = useState(null);
  const [editTarget, setEditTarget] = useState(null); // { id, formula }
  const [toastMsg, setToastMsg] = useState('');
  const [comparar, setComparar] = useState(false);
  const [importar, setImportar] = useState(false);

  /* Realtime (T3 jul 2026): canal 'formulas' — cambios de fórmula / precio MP
     hechos en otra sesión refrescan el summary (badge de recálculo en vivo,
     antes dependía del polling de 30s). */
  useRealtimeSync({ onFormulas: () => reload() });

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 5000);
  }, []);

  const formulas = useMemo(() => {
    if (!fData) return {};
    const raw = fData?.data?.formulas || fData?.formulas || fData?.data || {};
    if (typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw;
  }, [fData]);

  /* PT ocultos (jul 2026): descontinuados fuera de la vista sin eliminarlos.
     Fuente: pt_ocultos.json vía /api/pt-ocultos. Solo admin puede alternar. */
  const [ocultos, setOcultos] = useState({});
  const [verOcultas, setVerOcultas] = useState(false);
  useEffect(() => {
    api.getPTOcultos?.().then(r => setOcultos(r?.data?.ocultos || r?.ocultos || {})).catch(() => {});
  }, []);
  const toggleOculto = useCallback(async (id) => {
    const nuevo = !ocultos[id];
    try {
      const r = await api.setPTOculto(id, nuevo);
      setOcultos(r?.ocultos || { ...ocultos, ...(nuevo ? { [id]: true } : {}) });
      if (!nuevo) { const cp = { ...(r?.ocultos || ocultos) }; delete cp[id]; setOcultos(r?.ocultos || cp); }
      showToast(nuevo ? `"${id}" oculta — ya no aparece en Inventario ni Pedidos` : `"${id}" visible de nuevo`);
    } catch (e) { showToast('Error: ' + (e.message || 'no se pudo cambiar')); }
  }, [ocultos, showToast]);
  const numOcultas = Object.keys(ocultos).length;

  const entries = useMemo(() => {
    let arr = Object.entries(formulas);
    if (!verOcultas) arr = arr.filter(([id]) => !ocultos[id]);
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      arr = arr.filter(([id, f]) =>
        (f.nombre || id).toLowerCase().includes(q) ||
        (f.ingredientes || []).some(ing => (ing.nombre || '').toLowerCase().includes(q))
      );
    }
    return arr.sort((a, b) => (a[1].nombre || a[0]).localeCompare(b[1].nombre || b[0]));
  }, [formulas, debouncedQuery, ocultos, verOcultas]);

  const totalFormulas = Object.keys(formulas).length;
  const avgIngs = totalFormulas > 0
    ? Math.round(Object.values(formulas).reduce((sum, f) => sum + (f.ingredientes?.length || 0), 0) / totalFormulas)
    : 0;

  if (!ndaOk) {
    return (
      <>
        {!embedded && <TopBar title="Fórmulas" />}
        <NDAModal user={user} context="formulas" onAccept={() => setNdaOk(true)} onReject={() => navigate('/')} />
      </>
    );
  }

  if (loading) {
    return (
      <>
        {!embedded && <TopBar title="Fórmulas" />}
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  return (
    <>
      {!embedded && <TopBar title="Fórmulas" />}
      <SecureView context="formulas">
      <div style={S.wrap}>
        {error && (
          <div style={{
            padding: '12px 16px', marginBottom: 16, borderRadius: 10,
            background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)',
            fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 8,
          }}>
            <span>Error cargando fórmulas: {error}</span>
            <button onClick={reload} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', background: 'var(--lp-danger-600)',
              color: '#fff', fontFamily: 'var(--lp-font-sans)',
            }}>Reintentar</button>
          </div>
        )}

        <div style={S.statsRow}>
          <div style={S.kpi('var(--lp-brand-600)')}>
            <div style={S.kpiLabel}>Fórmulas</div>
            <div style={S.kpiValue}>{totalFormulas}</div>
          </div>
          <div style={S.kpi('var(--lp-success-600)')}>
            <div style={S.kpiLabel}>Prom. Ingredientes</div>
            <div style={S.kpiValue}>{avgIngs}</div>
          </div>
          <div style={S.kpi('var(--lp-brand-400)')}>
            <div style={S.kpiLabel}>Vol. por Cubeta</div>
            <div style={S.kpiValue}>19L</div>
          </div>
        </div>

        <div style={S.toolbar}>
          <input
            type="text"
            style={S.search}
            placeholder="Buscar fórmula o ingrediente..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button
            onClick={() => setComparar(true)}
            disabled={Object.keys(formulas).length < 2}
            style={{
              padding: '10px 16px', fontSize: 12, fontWeight: 700,
              borderRadius: 'var(--lp-radius-sm)',
              border: '1.5px solid var(--lp-border-subtle)',
              background: 'var(--lp-bg-raised)',
              color: 'var(--lp-text-primary)',
              cursor: Object.keys(formulas).length >= 2 ? 'pointer' : 'not-allowed',
              opacity: Object.keys(formulas).length >= 2 ? 1 : 0.5,
              fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap',
            }}
          >
            Comparar dos fórmulas
          </button>
          {isAdmin && (
            <button
              onClick={() => setImportar(true)}
              data-id="formulas.btn.importar-sheet"
              style={{
                padding: '10px 16px', fontSize: 12, fontWeight: 700,
                borderRadius: 'var(--lp-radius-sm)',
                border: '1.5px solid var(--lp-brand-600)',
                background: 'var(--lp-bg-raised)',
                color: 'var(--lp-brand-700)',
                cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap',
              }}
            >
              Importar Sheet (.xlsx)
            </button>
          )}
          {isAdmin && numOcultas > 0 && (
            <button
              onClick={() => setVerOcultas(v => !v)}
              style={{
                padding: '10px 16px', fontSize: 12, fontWeight: 700,
                borderRadius: 'var(--lp-radius-sm)',
                border: '1.5px solid ' + (verOcultas ? 'var(--lp-warning-700)' : 'var(--lp-border-subtle)'),
                background: verOcultas ? 'var(--lp-warning-100)' : 'var(--lp-bg-raised)',
                color: verOcultas ? 'var(--lp-warning-700)' : 'var(--lp-text-primary)',
                cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap',
              }}
            >
              {verOcultas ? 'Ocultar de nuevo' : `Ver ocultas (${numOcultas})`}
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <div style={S.empty}>
            {debouncedQuery ? `Sin resultados para "${debouncedQuery}"` : 'Sin fórmulas registradas.'}
          </div>
        ) : (
          entries.map(([id, formula]) => (
            <FormulaCard
              key={id}
              id={id}
              formula={formula}
              isAdmin={isAdmin}
              oculta={!!ocultos[id]}
              onOcultar={toggleOculto}
              onRename={setRenameId}
              onDuplicate={setDupId}
              onEdit={(fId, f) => setEditTarget({ id: fId, formula: f })}
            />
          ))
        )}
      </div>

      {/* Rename Modal */}
      {renameId && (
        <RenameModal
          formulaId={renameId}
          onClose={() => setRenameId(null)}
          onSuccess={(msg) => { setRenameId(null); reload(); showToast(msg); }}
        />
      )}
      {dupId && (
        <DuplicarModal
          formulaId={dupId}
          onClose={() => setDupId(null)}
          onSuccess={(msg) => { setDupId(null); reload(); showToast(msg); }}
        />
      )}

      {/* Edit Ingredientes Modal */}
      {/* Edit Ingredientes Modal */}
      {editTarget && (
        <EditIngModal
          formulaId={editTarget.id}
          formula={editTarget.formula}
          onClose={() => setEditTarget(null)}
          onSuccess={(msg) => { setEditTarget(null); reload(); showToast(msg); }}
        />
      )}

      {/* Comparar formulas */}
      {comparar && (
        <CompararFormulasModal
          formulas={Object.entries(formulas).map(([id, f]) => ({ ...f, nombre: f.nombre || id }))}
          /* summary[] trae las propiedades por fórmula (pvc, densidad,
             nv_peso, nv_vol, acabado_texto). Vive junto a formulas{} en
             formulas_custom.json, no dentro de cada fórmula. */
          summary={fData?.data?.summary || fData?.summary || []}
          onClose={() => setComparar(false)}
        />
      )}

      {/* La Sheet de fórmulas entra al ERP (plan → APLICAR) */}
      {importar && (
        <ImportarSheetModal
          onClose={() => setImportar(false)}
          onSuccess={(msg) => { setImportar(false); reload(); showToast(msg); }}
        />
      )}

      {/* Toast */}
      {toastMsg && <div style={S.toast}><span style={{ marginRight: 8 }}>OK</span>{toastMsg}</div>}
      </SecureView>
    </>
  );
}
