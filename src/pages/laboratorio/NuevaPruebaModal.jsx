import { useState, useMemo } from 'react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

/* ── Colores por categoría ── (tokens var(--lp-*), sin hardcodes ni morado
   del skin viejo; auto-adaptan a claro/oscuro. La etiqueta de texto distingue
   las categorías que comparten familia de color.) */
const CAT_COLORS = {
  'Resinas y Ligantes':     { bg: 'var(--lp-brand-50)',   color: 'var(--lp-brand-700)',   border: 'var(--lp-brand-200)' },
  'Pigmentos y Colorantes': { bg: 'var(--lp-warning-50)', color: 'var(--lp-warning-700)', border: 'var(--lp-warning-100)' },
  'Cargas y Extensores':    { bg: 'var(--lp-info-50)',    color: 'var(--lp-info-600)',    border: 'var(--lp-border-subtle)' },
  'Aditivos':               { bg: 'var(--lp-success-50)', color: 'var(--lp-success-700)', border: 'var(--lp-success-100)' },
  'Solventes y Agua':       { bg: 'var(--lp-info-50)',    color: 'var(--lp-info-600)',    border: 'var(--lp-border-subtle)' },
  'Biocidas':               { bg: 'var(--lp-danger-50)',  color: 'var(--lp-danger-700)',  border: 'var(--lp-danger-100)' },
  'Lab':                    { bg: 'var(--lp-warning-50)', color: 'var(--lp-warning-700)', border: 'var(--lp-warning-100)' },
  'Sin categoría':          { bg: 'var(--lp-bg-sunken)',  color: 'var(--lp-text-secondary)', border: 'var(--lp-border-subtle)' },
};

/* Orden canónico de categorías */
const CAT_ORDER = [
  'Resinas y Ligantes', 'Pigmentos y Colorantes', 'Cargas y Extensores',
  'Aditivos', 'Solventes y Agua', 'Biocidas', 'Lab', 'Sin categoría',
];

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px',
    overflowY: 'auto',
    /* MÓVIL: el overlay es el scroller (alignItems flex-start + padding). --pp-vvh
       (publicado por useBodyScrollLock) sigue al teclado en iOS/Android; cap a la
       altura visible real menos el padding vertical (24+24) para que siempre haya
       overflow interno alcanzable y nada quede detrás del teclado. Fallback 100dvh. */
    maxHeight: 'calc(var(--pp-vvh, 100dvh) - 48px)',
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)', width: '100%',
    maxWidth: 760, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,.15)',
    margin: '20px 0',
  },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 },
  formGroup: { marginBottom: 12 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 4 },
  input: {
    width: '100%', padding: '8px 12px', fontSize: 13, border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)', fontFamily: 'inherit', background: 'var(--lp-bg-base)',
    boxSizing: 'border-box', outline: 'none',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  btn: {
    padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 'var(--lp-radius-sm)',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  btnPrimary: { background: 'var(--lp-brand-600)', color: '#fff' },
  btnSecondary: { background: 'var(--lp-bg-base)', border: '1.5px solid var(--lp-border-subtle)', color: 'var(--lp-text-secondary)' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 },
  /* Ingredientes table */
  ingTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  ingTh: { textAlign: 'left', padding: '6px 8px', fontWeight: 700, color: 'var(--lp-text-tertiary)', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11 },
  ingTd: { padding: '4px 8px', borderBottom: '1px solid var(--lp-border-subtle)' },
  ingInput: {
    width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid var(--lp-border-subtle)',
    borderRadius: 4, fontFamily: 'inherit', background: 'var(--lp-bg-base)', boxSizing: 'border-box',
  },
  /* Categoría colapsable */
  catHeader: (colors, open) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
    background: colors.bg, borderRadius: open ? '8px 8px 0 0' : 8,
    cursor: 'pointer', userSelect: 'none', border: `1.5px solid ${colors.border}`,
    borderBottom: open ? `1px dashed ${colors.border}` : `1.5px solid ${colors.border}`,
    marginTop: 6, transition: 'all .15s',
  }),
  catArrow: (open) => ({
    fontSize: 10, transition: 'transform .15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
    color: 'inherit', flexShrink: 0,
  }),
  catName: { fontSize: 13, fontWeight: 700, flex: 1 },
  catCount: { fontSize: 11, fontWeight: 600, opacity: .7 },
  catBody: (colors) => ({
    padding: '8px 12px 10px', border: `1.5px solid ${colors.border}`,
    borderTop: 'none', borderRadius: '0 0 8px 8px', background: `${colors.bg}44`,
  }),
  /* Checkbox row */
  checkRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px',
    borderRadius: 4, cursor: 'pointer', transition: 'background .1s',
    fontSize: 12, color: 'var(--lp-text-primary)',
  },
  checkbox: (checked) => ({
    width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'}`,
    background: checked ? 'var(--lp-brand-600)' : '#fff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, transition: 'all .12s',
  }),
  selectedCount: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 10,
    background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)', marginLeft: 8,
  },
  /* Pasos */
  pasoRow: { display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' },
  pasoNum: { fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-600)', minWidth: 20 },
  /* Totales */
  totalsCard: {
    background: 'var(--lp-brand-50)', borderRadius: 'var(--lp-radius-sm)', padding: 12,
    display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 10,
  },
  totalItem: { fontSize: 12, color: 'var(--lp-text-secondary)' },
  totalVal: { fontWeight: 700, fontSize: 14, color: 'var(--lp-brand-700)' },
};

/* ── Componente de categoría colapsable ── */
function CatSection({ catName, mps, selectedNames, onToggle, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const colors = CAT_COLORS[catName] || CAT_COLORS['Sin categoría'];
  const selCount = mps.filter(m => selectedNames.has(m.nombre)).length;

  return (
    <div>
      <div style={S.catHeader(colors, open)} onClick={() => setOpen(!open)}>
        <span style={S.catArrow(open)}>▶</span>
        <span style={{ ...S.catName, color: colors.color }}>{catName}</span>
        <span style={S.catCount}>{mps.length} MPs</span>
        {selCount > 0 && (
          <span style={S.selectedCount}>{selCount} sel.</span>
        )}
      </div>
      {open && (
        <div style={S.catBody(colors)}>
          {mps.map(mp => {
            const checked = selectedNames.has(mp.nombre);
            return (
              <div
                key={mp.nombre}
                style={{ ...S.checkRow, background: checked ? `${colors.bg}` : 'transparent' }}
                onClick={() => onToggle(mp)}
                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = `${colors.bg}`; }}
                onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={S.checkbox(checked)}>
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{ fontWeight: checked ? 600 : 400, flex: 1 }}>{mp.nombre}</span>
                {mp.source === 'lab' && (
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, background: CAT_COLORS.Lab.bg, color: CAT_COLORS.Lab.color, fontWeight: 600 }}>LAB</span>
                )}
                {mp.costoKg != null && (
                  <span style={{ fontSize: 10, color: 'var(--lp-text-tertiary)' }}>${mp.costoKg}/kg</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NuevaPruebaModal({ prueba, maestro, labMPs, onClose, onSave, onNewMP }) {
  const isEdit = !!prueba;
  const [nombre, setNombre] = useState(prueba?.nombre || '');
  const [notas, setNotas] = useState(prueba?.notas || '');
  const [estado, setEstado] = useState(prueba?.estado || 'borrador');
  const [ingredientes, setIngredientes] = useState(prueba?.ingredientes || []);
  const [pasos, setPasos] = useState(prueba?.pasos || []);
  const [saving, setSaving] = useState(false);
  const [mpSearch, setMpSearch] = useState('');

  /* MÓVIL: congela el scroll del fondo y publica --pp-vvh (alto visible que sigue
     al teclado) mientras el modal está montado. El modal solo se monta cuando está
     abierto (el padre controla el montaje), por eso siempre activo. */
  useBodyScrollLock(true);

  /* Catálogo unificado: maestro + lab */
  const allMPs = useMemo(() => {
    const map = {};
    maestro.forEach(m => { map[m.nombre] = { ...m, source: 'maestro' }; });
    labMPs.forEach(m => { map[m.nombre] = { ...m, source: 'lab', tipo: m.tipo || 'Lab' }; });
    return Object.values(map).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [maestro, labMPs]);

  /* Agrupar por categoría */
  const mpsByCategory = useMemo(() => {
    const q = mpSearch.toLowerCase();
    const filtered = q ? allMPs.filter(m => m.nombre.toLowerCase().includes(q)) : allMPs;

    const groups = {};
    filtered.forEach(mp => {
      const cat = mp.source === 'lab' ? 'Lab' : (mp.tipo || 'Sin categoría');
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(mp);
    });

    /* Ordenar categorías según CAT_ORDER, desconocidas al final */
    return CAT_ORDER
      .filter(c => groups[c] && groups[c].length > 0)
      .map(c => ({ cat: c, mps: groups[c] }))
      .concat(
        Object.keys(groups)
          .filter(c => !CAT_ORDER.includes(c))
          .map(c => ({ cat: c, mps: groups[c] }))
      );
  }, [allMPs, mpSearch]);

  const selectedNames = useMemo(() => new Set(ingredientes.map(i => i.nombre)), [ingredientes]);

  /* Ingredientes helpers */
  const toggleIngrediente = (mp) => {
    if (selectedNames.has(mp.nombre)) {
      setIngredientes(ingredientes.filter(i => i.nombre !== mp.nombre));
    } else {
      setIngredientes([...ingredientes, {
        nombre: mp.nombre,
        cantidad: 0,
        unidad: 'kg',
        densidad: mp.densidad || null,
        solidos: mp.solidos || null,
        costoKg: mp.costoKg || null,
        porcentaje: 0,
      }]);
    }
  };

  const removeIngrediente = (nombre) => {
    setIngredientes(ingredientes.filter(i => i.nombre !== nombre));
  };

  const updateIng = (idx, field, value) => {
    const copy = [...ingredientes];
    copy[idx] = { ...copy[idx], [field]: value };
    setIngredientes(copy);
  };

  /* Cálculos en tiempo real */
  const totals = useMemo(() => {
    let pesoTotal = 0, costoTotal = 0, solidosNum = 0, solidosDen = 0, densNum = 0, densCount = 0;
    ingredientes.forEach(ing => {
      const cant = Number(ing.cantidad) || 0;
      pesoTotal += cant;
      if (ing.costoKg != null) costoTotal += cant * Number(ing.costoKg);
      if (ing.solidos != null && cant > 0) { solidosNum += cant * Number(ing.solidos); solidosDen += cant; }
      if (ing.densidad != null) { densNum += Number(ing.densidad); densCount++; }
    });
    const withPct = ingredientes.map(ing => ({
      ...ing,
      porcentaje: pesoTotal > 0 ? ((Number(ing.cantidad) || 0) / pesoTotal * 100).toFixed(2) : '0',
    }));
    return {
      pesoTotal, costoTotal,
      solidosPonderado: solidosDen > 0 ? solidosNum / solidosDen : 0,
      densidadTeorica: densCount > 0 ? densNum / densCount : 0,
      ingredientesConPct: withPct,
    };
  }, [ingredientes]);

  /* Pasos helpers */
  const addPaso = () => setPasos([...pasos, { descripcion: '', tiempo: '' }]);
  const updatePaso = (idx, field, value) => {
    const copy = [...pasos];
    copy[idx] = { ...copy[idx], [field]: value };
    setPasos(copy);
  };
  const removePaso = (idx) => setPasos(pasos.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!nombre.trim()) return alert('Nombre de prueba requerido');
    setSaving(true);
    try {
      await onSave({
        id: prueba?.id || undefined,
        nombre: nombre.trim(),
        notas, estado,
        ingredientes: totals.ingredientesConPct,
        pasos: pasos.filter(p => p.descripcion.trim()),
        pesoTotal: totals.pesoTotal,
        costoTotal: totals.costoTotal,
        solidosPonderado: totals.solidosPonderado,
        densidadTeorica: totals.densidadTeorica,
        creadoPor: prueba?.creadoPor,
        creadoEn: prueba?.creadoEn,
      });
      onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.title}>{isEdit ? 'Editar Prueba' : 'Nueva Prueba de Laboratorio'}</div>

        {/* ── Info básica ── */}
        <div style={S.section}>
          <div style={S.row2}>
            <div style={S.formGroup}>
              <label style={S.label}>Nombre de la prueba *</label>
              <input style={S.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: BLANCO MATE 5.0 EXPERIMENTAL" />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Estado</label>
              <select style={S.input} value={estado} onChange={e => setEstado(e.target.value)}>
                <option value="borrador">Borrador</option>
                <option value="en_proceso">En proceso</option>
                <option value="qc_pendiente">QC pendiente</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Notas</label>
            <textarea style={{ ...S.input, minHeight: 50, resize: 'vertical' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Objetivo de la prueba, observaciones..." />
          </div>
        </div>

        {/* ── Selector de Materias Primas por categoría ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>
            Ingredientes
            {selectedNames.size > 0 && (
              <span style={S.selectedCount}>{selectedNames.size} seleccionados</span>
            )}
          </div>
          <input
            style={{ ...S.input, marginBottom: 8 }}
            placeholder="Buscar materia prima..."
            value={mpSearch}
            onChange={e => setMpSearch(e.target.value)}
          />

          <div style={{ maxHeight: 340, overflowY: 'auto', borderRadius: 8 }}>
            {mpsByCategory.map(({ cat, mps }) => (
              <CatSection
                key={cat}
                catName={cat}
                mps={mps}
                selectedNames={selectedNames}
                onToggle={toggleIngrediente}
                defaultOpen={mps.some(m => selectedNames.has(m.nombre))}
              />
            ))}

            {mpsByCategory.length === 0 && mpSearch && (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--lp-text-tertiary)' }}>
                No encontrada.
                <button
                  style={{ ...S.btn, padding: '4px 12px', fontSize: 11, marginLeft: 8, background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)', border: 'none' }}
                  onClick={async () => {
                    const mp = { nombre: mpSearch.trim().toUpperCase(), tipo: 'otro' };
                    await onNewMP(mp);
                    setMpSearch('');
                  }}
                >
                  + Crear "{mpSearch.trim().toUpperCase()}" en Lab
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabla de cantidades ── */}
        {ingredientes.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Cantidades</div>
            <table style={S.ingTable}>
              <thead>
                <tr>
                  <th style={S.ingTh}>Materia Prima</th>
                  <th style={{ ...S.ingTh, width: 90 }}>Cantidad</th>
                  <th style={{ ...S.ingTh, width: 60 }}>Unidad</th>
                  <th style={{ ...S.ingTh, width: 60, textAlign: 'right' }}>%</th>
                  <th style={{ ...S.ingTh, width: 80, textAlign: 'right' }}>Costo</th>
                  <th style={{ ...S.ingTh, width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {totals.ingredientesConPct.map((ing, idx) => (
                  <tr key={ing.nombre}>
                    <td style={S.ingTd}>
                      <span style={{ fontWeight: 600 }}>{ing.nombre}</span>
                      {ing.densidad != null && <span style={{ fontSize: 10, color: 'var(--lp-text-tertiary)', marginLeft: 6 }}>d={ing.densidad}</span>}
                    </td>
                    <td style={S.ingTd}>
                      <input style={S.ingInput} type="number" inputMode="decimal" step="0.01" min="0" value={ing.cantidad}
                        onChange={e => updateIng(idx, 'cantidad', e.target.value)} />
                    </td>
                    <td style={S.ingTd}>
                      <select style={S.ingInput} value={ing.unidad || 'kg'} onChange={e => updateIng(idx, 'unidad', e.target.value)}>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="L">L</option>
                        <option value="mL">mL</option>
                      </select>
                    </td>
                    <td style={{ ...S.ingTd, textAlign: 'right', fontWeight: 600, color: 'var(--lp-brand-600)' }}>
                      {ing.porcentaje}%
                    </td>
                    <td style={{ ...S.ingTd, textAlign: 'right', fontSize: 11 }}>
                      {ing.costoKg != null ? '$' + ((Number(ing.cantidad) || 0) * Number(ing.costoKg)).toFixed(2) : '—'}
                    </td>
                    <td style={S.ingTd}>
                      <button onClick={() => removeIngrediente(ing.nombre)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-danger-600)', fontSize: 14, padding: 2 }}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={S.totalsCard}>
              <div style={S.totalItem}>Peso total: <span style={S.totalVal}>{totals.pesoTotal.toFixed(2)} kg</span></div>
              <div style={S.totalItem}>Costo total: <span style={S.totalVal}>${totals.costoTotal.toFixed(2)}</span></div>
              {totals.pesoTotal > 0 && (
                <div style={S.totalItem}>Costo/kg: <span style={S.totalVal}>${(totals.costoTotal / totals.pesoTotal).toFixed(2)}</span></div>
              )}
              {totals.solidosPonderado > 0 && (
                <div style={S.totalItem}>Solidos pond.: <span style={S.totalVal}>{totals.solidosPonderado.toFixed(1)}%</span></div>
              )}
              {totals.densidadTeorica > 0 && (
                <div style={S.totalItem}>Densidad teo.: <span style={S.totalVal}>{totals.densidadTeorica.toFixed(3)}</span></div>
              )}
            </div>
          </div>
        )}

        {/* ── Pasos de proceso ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>
            Proceso de Produccion
            <button style={{ ...S.btn, padding: '3px 12px', fontSize: 11, background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)', border: 'none' }} onClick={addPaso}>
              + Paso
            </button>
          </div>
          {pasos.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', padding: '8px 0' }}>
              Agrega los pasos del proceso de produccion (opcional)
            </div>
          )}
          {pasos.map((p, idx) => (
            <div key={idx} style={S.pasoRow}>
              <span style={S.pasoNum}>{idx + 1}.</span>
              <input style={{ ...S.ingInput, flex: 1 }} placeholder="Descripcion del paso..." value={p.descripcion}
                onChange={e => updatePaso(idx, 'descripcion', e.target.value)} />
              <input style={{ ...S.ingInput, width: 80 }} placeholder="Tiempo" value={p.tiempo}
                onChange={e => updatePaso(idx, 'tiempo', e.target.value)} />
              <button onClick={() => removePaso(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-danger-600)', fontSize: 14, padding: 2 }}>
                {'×'}
              </button>
            </div>
          ))}
        </div>

        {/* ── Acciones ── */}
        <div style={S.actions}>
          <button style={{ ...S.btn, ...S.btnSecondary }} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.btn, ...S.btnPrimary, opacity: saving ? .6 : 1 }} disabled={saving} onClick={handleSubmit}>
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear prueba'}
          </button>
        </div>
      </div>
    </div>
  );
}
