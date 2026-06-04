import { useState, useRef, useEffect, useMemo } from 'react';
import api from '../../services/api';

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)', width: '100%',
    maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24,
    boxShadow: '0 8px 32px rgba(0,0,0,.15)',
  },
  title: { fontSize: 17, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 4 },
  subtitle: { fontSize: 12, color: 'var(--lp-text-tertiary)', marginBottom: 16 },
  formGroup: { marginBottom: 14 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 4 },
  input: {
    width: '100%', padding: '8px 12px', fontSize: 13, border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)', fontFamily: 'inherit', background: 'var(--lp-bg-base)',
    boxSizing: 'border-box', outline: 'none',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  btn: {
    padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 'var(--lp-radius-sm)',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  btnPrimary: { background: 'var(--lp-brand-600)', color: '#fff' },
  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
  imgPreview: {
    maxWidth: '100%', maxHeight: 200, borderRadius: 6, border: '1px solid var(--lp-border-subtle)',
    marginTop: 8,
  },
  uploadArea: {
    border: '2px dashed var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-sm)',
    padding: 20, textAlign: 'center', cursor: 'pointer', color: 'var(--lp-text-tertiary)',
    fontSize: 13, transition: 'border-color .15s',
  },
  estadoBtn: (active, color) => ({
    padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--lp-radius-sm)',
    cursor: 'pointer', fontFamily: 'inherit', border: '2px solid',
    background: active ? color : 'var(--lp-bg-base)',
    color: active ? '#fff' : 'var(--lp-text-secondary)',
    borderColor: active ? color : 'var(--lp-border-subtle)',
    transition: 'all .15s',
  }),
};

export default function QCResultModal({ prueba, onClose, onSave }) {
  const existingQC = prueba.qc || {};
  const [viscosidad, setViscosidad] = useState(existingQC.viscosidad ?? '');
  const [ph, setPh] = useState(existingQC.ph ?? '');
  const [densidad, setDensidad] = useState(existingQC.densidad ?? '');
  const [brillo, setBrillo] = useState(existingQC.brillo ?? '');
  const [cubrimiento, setCubrimiento] = useState(existingQC.cubrimiento || '');
  const [observaciones, setObservaciones] = useState(existingQC.observaciones || '');
  const [estado, setEstado] = useState(existingQC.estado || '');
  const [imagenBase64, setImagenBase64] = useState(existingQC.imagenBase64 || null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  /* ─── Rangos QC del producto (calculados desde fórmula en backend) ───
     Carga al abrir el modal. Si el producto no tiene specs configurados,
     simplemente no se muestran rangos y los inputs se ven sin colores. */
  const [specs, setSpecs] = useState(null);
  useEffect(() => {
    let alive = true;
    api.getQCSpecs().then(r => {
      if (!alive) return;
      const all = r?.data || {};
      const nombre = prueba?.nombre || prueba?.producto || prueba?.formula;
      const matched = nombre ? (all[nombre] || all[String(nombre).toUpperCase()]) : null;
      setSpecs(matched?.rangos || null);
    }).catch(() => { if (alive) setSpecs(null); });
    return () => { alive = false; };
  }, [prueba?.id]);

  /* Evalúa cada lectura contra su rango. Devuelve 'ok'|'fuera'|'sin-spec' */
  const evaluar = (campo, valor) => {
    if (!specs || !specs[campo]) return 'sin-spec';
    if (valor === '' || valor === null) return 'sin-spec';
    const v = Number(valor);
    if (isNaN(v)) return 'sin-spec';
    const r = specs[campo];
    const minOk = r.min == null || v >= r.min;
    const maxOk = r.max == null || v <= r.max;
    return (minOk && maxOk) ? 'ok' : 'fuera';
  };

  const evals = useMemo(() => ({
    viscosidad:     evaluar('viscosidad',     viscosidad),
    pH:             evaluar('pH',             ph),
    densidad:       evaluar('densidad',       densidad),
  }), [viscosidad, ph, densidad, specs]);

  /* Estilo del input según evaluación */
  const inputEval = (estadoEval) => {
    if (estadoEval === 'ok')    return { ...S.input, borderColor: '#059669', background: '#ECFDF5' };
    if (estadoEval === 'fuera') return { ...S.input, borderColor: '#DC2626', background: '#FEF2F2' };
    return S.input;
  };

  /* Helper que renderiza rango bajo el label, ej: "esperado 1.18-1.28 g/mL" */
  const rangoTexto = (campo) => {
    if (!specs || !specs[campo]) return null;
    const r = specs[campo];
    const partes = [];
    if (r.min != null && r.max != null) partes.push(`${r.min}-${r.max}`);
    else if (r.min != null) partes.push(`≥ ${r.min}`);
    else if (r.max != null) partes.push(`≤ ${r.max}`);
    if (r.unidad) partes.push(r.unidad);
    return partes.length ? (
      <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--lp-text-tertiary)', marginLeft: 6 }}>
        (esperado {partes.join(' ')})
      </span>
    ) : null;
  };

  /* Sugerencia automática de veredicto: si hay specs y alguna lectura está fuera, sugiere rechazar */
  const sugerencia = useMemo(() => {
    if (!specs) return null;
    const tieneLecturas = [viscosidad, ph, densidad].some(v => v !== '' && v !== null);
    if (!tieneLecturas) return null;
    const algunFuera = Object.values(evals).some(e => e === 'fuera');
    return algunFuera ? 'rechazado' : 'aprobado';
  }, [evals, viscosidad, ph, densidad, specs]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert('La imagen no debe exceder 4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagenBase64(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!estado) return alert('Selecciona un veredicto: Aprobado o Rechazado');
    setSaving(true);
    try {
      await onSave(prueba.id, {
        viscosidad: viscosidad !== '' ? Number(viscosidad) : null,
        ph: ph !== '' ? Number(ph) : null,
        densidad: densidad !== '' ? Number(densidad) : null,
        brillo: brillo !== '' ? Number(brillo) : null,
        cubrimiento: cubrimiento || null,
        observaciones,
        estado,
        imagenBase64,
      });
      onClose();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.title}>Control de Calidad</div>
        <div style={S.subtitle}>Prueba: {prueba.nombre}</div>

        {/* Banner de specs cargados — guía visual al técnico */}
        {specs && (
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            color: '#1E40AF', padding: '6px 10px', borderRadius: 6,
            fontSize: 11, marginBottom: 14,
          }}>
            Rangos esperados cargados desde la fórmula. Si una lectura sale del rango,
            el campo se marca en rojo y se sugiere automáticamente "rechazado".
          </div>
        )}

        <div style={S.row3}>
          <div style={S.formGroup}>
            <label style={S.label}>
              Viscosidad{rangoTexto('viscosidad')}
            </label>
            <input style={inputEval(evals.viscosidad)} type="number" inputMode="decimal" step="1"
              value={viscosidad} onChange={e => setViscosidad(e.target.value)} />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>
              pH{rangoTexto('pH')}
            </label>
            <input style={inputEval(evals.pH)} type="number" inputMode="decimal" step="0.1"
              value={ph} onChange={e => setPh(e.target.value)} />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>
              Densidad (g/mL){rangoTexto('densidad')}
            </label>
            <input style={inputEval(evals.densidad)} type="number" inputMode="decimal" step="0.001"
              value={densidad} onChange={e => setDensidad(e.target.value)} />
          </div>
        </div>

        <div style={S.row2}>
          <div style={S.formGroup}>
            <label style={S.label}>Brillo (UB)</label>
            <input style={S.input} type="number" inputMode="decimal" step="0.1" value={brillo} onChange={e => setBrillo(e.target.value)} />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Cubrimiento</label>
            <select style={S.input} value={cubrimiento} onChange={e => setCubrimiento(e.target.value)}>
              <option value="">— Seleccionar —</option>
              <option value="excelente">Excelente</option>
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="deficiente">Deficiente</option>
            </select>
          </div>
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>Observaciones</label>
          <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Color, textura, aplicabilidad, secado..." />
        </div>

        {/* ── Imagen ── */}
        <div style={S.formGroup}>
          <label style={S.label}>Imagen (opcional)</label>
          <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={handleFileChange} />
          {imagenBase64 ? (
            <div>
              <img src={imagenBase64} alt="QC" style={S.imgPreview} />
              <div style={{ marginTop: 6 }}>
                <button style={{ ...S.btn, padding: '4px 12px', fontSize: 11, background: '#FEE2E2', color: '#DC2626' }} onClick={() => setImagenBase64(null)}>
                  Quitar imagen
                </button>
                <button style={{ ...S.btn, padding: '4px 12px', fontSize: 11, marginLeft: 6, background: 'var(--lp-bg-base)', border: '1px solid var(--lp-border-subtle)', color: 'var(--lp-text-secondary)' }} onClick={() => fileRef.current?.click()}>
                  Cambiar
                </button>
              </div>
            </div>
          ) : (
            <div style={S.uploadArea} onClick={() => fileRef.current?.click()}>
              Click para subir imagen (max 4 MB)
            </div>
          )}
        </div>

        {/* ── Veredicto ── */}
        <div style={S.formGroup}>
          <label style={S.label}>
            Veredicto *
            {sugerencia && (
              <span style={{
                fontSize: 10, fontWeight: 700, marginLeft: 8,
                color: sugerencia === 'aprobado' ? '#059669' : '#DC2626',
              }}>
                Sugerido por validación: {sugerencia === 'aprobado' ? 'APROBADO' : 'RECHAZADO'}
              </span>
            )}
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button style={S.estadoBtn(estado === 'aprobado', '#059669')} onClick={() => setEstado('aprobado')}>
              Aprobado
            </button>
            <button style={S.estadoBtn(estado === 'rechazado', '#DC2626')} onClick={() => setEstado('rechazado')}>
              Rechazado
            </button>
          </div>
        </div>

        <div style={S.actions}>
          <button style={{ ...S.btn, background: 'var(--lp-bg-base)', border: '1.5px solid var(--lp-border-subtle)', color: 'var(--lp-text-secondary)' }} onClick={onClose}>
            Cancelar
          </button>
          <button style={{ ...S.btn, ...S.btnPrimary, opacity: saving ? .6 : 1 }} disabled={saving} onClick={handleSave}>
            {saving ? 'Guardando...' : 'Guardar QC'}
          </button>
        </div>
      </div>
    </div>
  );
}
