import { useState, useRef, useEffect, useMemo } from 'react';
import api from '../../../services/api';

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(26, 24, 21, 0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' },
  modal: { background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)', padding: 24, maxWidth: 580, width: '92%', maxHeight: '92vh', overflowY: 'auto' },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--lp-success-700)', marginBottom: 16 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--lp-font-sans)', boxSizing: 'border-box' },
  fieldGroup: { marginBottom: 14 },
  itemHeader: { display: 'grid', gridTemplateColumns: '2fr 80px 100px', gap: 10, alignItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--lp-border-subtle)' },
  itemRow: { display: 'grid', gridTemplateColumns: '2fr 80px 100px', gap: 10, alignItems: 'center', padding: '6px 0', fontSize: 12 },
  small: { padding: '6px 8px', fontSize: 11, border: '1px solid var(--lp-border-subtle)', borderRadius: 6, fontFamily: 'var(--lp-font-mono)', boxSizing: 'border-box', width: '100%', textAlign: 'right' },
  itemsBox: { background: 'var(--lp-bg-sunken)', borderRadius: 8, padding: 12, marginBottom: 14 },
  diff: (val) => ({ fontSize: 11, fontWeight: 600, color: val < 0 ? 'var(--lp-danger-700)' : val > 0 ? 'var(--lp-warning-700)' : 'var(--lp-success-700)' }),
  buttons: { display: 'flex', gap: 10 },
  btn: { flex: 1, padding: '12px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)' },
  btnSuccess: { background: 'var(--lp-success-600)', color: '#fff' },
  btnGhost: { background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-primary)' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 10 },
  canvas: { border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, width: '100%', cursor: 'crosshair', touchAction: 'none', background: 'var(--lp-bg-raised)' },
  canvasHint: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4 },
  clearBtn: { padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid var(--lp-border-subtle)', borderRadius: 6, background: 'var(--lp-bg-raised)', cursor: 'pointer' },
};

export default function RecibirOCModal({ oc, onClose, onSaved }) {
  const [items, setItems] = useState(() =>
    (oc.items || []).map(i => ({
      mp: i.mp,
      kg: Number(i.kg) || 0,
      kg_recibidos: i.kg_recibidos != null ? Number(i.kg_recibidos) : Number(i.kg) || 0,
    }))
  );
  const [recibidoPor, setRecibidoPor] = useState('');
  /* Mini-QC al recibir MP: por defecto la calidad es OK. Si Enrique detecta
     problema visual (color, viscosidad, daño en empaque), marca "Con
     observaciones" y agrega nota. El lote MP queda en qc_hold_mp y debe
     ser revisado antes de poder usarse en producción. */
  const [calidadOk, setCalidadOk] = useState(true);
  const [qcNotas, setQcNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasFirma, setHasFirma] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = c.offsetWidth * 2;
    c.height = 140 * 2;
    const ctx = c.getContext('2d');
    ctx.scale(2, 2);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1815';
  }, []);

  const updateRecibido = (idx, val) => {
    const v = val === '' ? 0 : Number(val);
    setItems(items.map((it, i) => i === idx ? { ...it, kg_recibidos: v } : it));
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const ctx = c.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasFirma(true);
  };
  const draw = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const ctx = c.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const endDraw = () => { drawingRef.current = false; };
  const clearFirma = () => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    setHasFirma(false);
  };

  const totalPedido = useMemo(() => items.reduce((s, i) => s + (Number(i.kg) || 0), 0), [items]);
  const totalRecibido = useMemo(() => items.reduce((s, i) => s + (Number(i.kg_recibidos) || 0), 0), [items]);

  const recibir = async () => {
    setErr('');
    if (!recibidoPor.trim()) { setErr('Ingresa quién recibe'); return; }
    if (!hasFirma) { setErr('Firma requerida'); return; }
    if (totalRecibido <= 0) { setErr('Al menos un item con kg_recibidos > 0'); return; }
    if (!calidadOk && !qcNotas.trim()) {
      setErr('Si la calidad NO es OK, describe el motivo en las notas');
      return;
    }
    setSaving(true);
    try {
      const firma = canvasRef.current.toDataURL('image/png');
      const qcMP = { calidadOk, notas: qcNotas.trim() };
      await api.recibirOC(
        oc.id,
        items.map(i => ({ mp: i.mp, kg_recibidos: Number(i.kg_recibidos) || 0 })),
        firma,
        recibidoPor.trim(),
        qcMP
      );
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e.message || 'Error al recibir');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div style={S.modal}>
        <div style={S.title}>Recibir OC — {oc.codigo}</div>
        <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 14 }}>
          Proveedor: <strong>{oc.proveedor}</strong>
        </div>

        {err && <div style={S.err}>{err}</div>}

        <div style={S.fieldGroup}>
          <label style={S.label}>Kg recibidos por item</label>
          <div style={S.itemsBox}>
            <div style={S.itemHeader}>
              <span>Materia Prima</span>
              <span style={{ textAlign: 'right' }}>Pedido</span>
              <span style={{ textAlign: 'right' }}>Recibido</span>
            </div>
            {items.map((it, idx) => {
              const diff = (Number(it.kg_recibidos) || 0) - it.kg;
              return (
                <div key={idx} style={S.itemRow}>
                  <span style={{ fontWeight: 600 }}>{it.mp}</span>
                  <span style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{it.kg} kg</span>
                  <input
                    style={S.small}
                    type="number"
                    min="0"
                    step="0.1"
                    value={it.kg_recibidos}
                    onChange={(e) => updateRecibido(idx, e.target.value)}
                  />
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--lp-border-subtle)', fontSize: 12, fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ fontFamily: 'var(--lp-font-mono)' }}>
                {totalRecibido} / {totalPedido} kg
                <span style={S.diff(totalRecibido - totalPedido)}>
                  {' '}({totalRecibido - totalPedido > 0 ? '+' : ''}{totalRecibido - totalPedido} kg)
                </span>
              </span>
            </div>
          </div>
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label}>Recibido por</label>
          <input style={S.input} value={recibidoPor} onChange={(e) => setRecibidoPor(e.target.value)} placeholder="Nombre completo" />
        </div>

        {/* Mini-QC de recepción MP — bloquea el ingreso al inventario activo
            si la MP llegó con problemas visibles (daño, color/viscosidad rara). */}
        <div style={S.fieldGroup}>
          <label style={S.label}>QC de recepción</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setCalidadOk(true)}
              style={{
                padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: '1.5px solid ' + (calidadOk ? 'var(--lp-success-600)' : 'var(--lp-border-subtle)'),
                background: calidadOk ? 'var(--lp-success-50)' : '#fff',
                color: calidadOk ? 'var(--lp-success-700)' : 'var(--lp-text-secondary)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              ✓ Calidad OK
            </button>
            <button
              type="button"
              onClick={() => setCalidadOk(false)}
              style={{
                padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: '1.5px solid ' + (!calidadOk ? 'var(--lp-warning-600)' : 'var(--lp-border-subtle)'),
                background: !calidadOk ? 'var(--lp-warning-50)' : '#fff',
                color: !calidadOk ? 'var(--lp-warning-700)' : 'var(--lp-text-secondary)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              ⚠ Con observaciones
            </button>
          </div>
          {!calidadOk && (
            <textarea
              style={{ ...S.input, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Describe el problema (color raro, daño en empaque, viscosidad, etc.)"
              value={qcNotas}
              onChange={(e) => setQcNotas(e.target.value)}
              maxLength={500}
            />
          )}
          {!calidadOk && (
            <div style={{ fontSize: 11, color: 'var(--lp-warning-700)', marginTop: 4, lineHeight: 1.5 }}>
              El lote MP quedará retenido (qc_hold_mp). Antes de usarse en producción debe ser revisado y liberado por admin.
            </div>
          )}
        </div>

        <div style={S.fieldGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ ...S.label, marginBottom: 0 }}>Firma</label>
            <button style={S.clearBtn} onClick={clearFirma} type="button">Limpiar</button>
          </div>
          <canvas
            ref={canvasRef}
            style={{ ...S.canvas, height: 140 }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          <div style={S.canvasHint}>
            {hasFirma ? 'Firma capturada · click en Limpiar para repetir' : 'Firma con mouse o dedo en pantalla táctil'}
          </div>
        </div>

        <div style={S.buttons}>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...S.btn, ...S.btnSuccess }} onClick={recibir} disabled={saving}>
            {saving ? 'Procesando...' : 'Confirmar recepción'}
          </button>
        </div>
      </div>
    </div>
  );
}
