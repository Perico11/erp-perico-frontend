import { useState } from 'react';
import api from '../../../services/api';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';

/* AprobarOCModal — HANDOFF jun 2026 (Sprint AC).
   Arely aprueba una OC: la OC ya trae proveedor + precio del catálogo, ella
   solo define la FORMA DE PAGO (Crédito 30d / Contado) y adjunta el COMPROBANTE
   (obligatorio en AMBOS). Para crédito se calcula el vencimiento a 30 días. */

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 16 },
  sheet: { background: 'var(--lp-bg-base)', borderRadius: 20, padding: '20px 20px 28px', maxWidth: 460, width: '100%', maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)', overflowY: 'auto' },
  h: { fontSize: 18, fontWeight: 700, color: 'var(--lp-text-primary)' },
  s: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2, marginBottom: 12 },
  sum: { background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 14, padding: '13px 14px', marginBottom: 6 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '5px 0' },
  k: { color: 'var(--lp-text-secondary)' },
  v: { fontWeight: 600, color: 'var(--lp-text-primary)' },
  catb: { fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)', marginLeft: 6 },
  lbl: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', margin: '16px 2px 6px' },
  seg: { display: 'flex', gap: 8 },
  segb: (on) => ({ flex: 1, height: 46, borderRadius: 12, border: '1.5px solid ' + (on ? 'transparent' : 'var(--lp-border-subtle)'), background: on ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)', color: on ? '#fff' : 'var(--lp-text-secondary)', fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer' }),
  vene: { display: 'flex', gap: 9, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 12, marginTop: 12, fontSize: 12.5, lineHeight: 1.4, background: 'var(--lp-info-50)', color: 'var(--lp-info-600)' },
  drop: (has) => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '22px 18px', marginTop: 6, border: '1.5px ' + (has ? 'solid var(--lp-brand-600)' : 'dashed var(--lp-border-default)'), borderRadius: 14, background: 'var(--lp-bg-sunken)', cursor: 'pointer', color: has ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)', textAlign: 'center', fontSize: 13, minHeight: 88 }),
  fn: { fontSize: 13, fontWeight: 700, color: 'var(--lp-brand-700)', wordBreak: 'break-all' },
  input: { width: '100%', height: 46, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 15, color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: '9px 12px', borderRadius: 8, fontSize: 12, marginTop: 12, whiteSpace: 'pre-line' },
  acts: { display: 'flex', gap: 10, marginTop: 18 },
  btn: { height: 50, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnGhost: { flex: '0 0 auto', padding: '0 20px', background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' },
  btnPrimary: { flex: 1, background: 'var(--lp-brand-600)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
};

const ICloud = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5-5 5 5"/><path d="M12 5v12"/></svg>
);
const IFile = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
);

function fmtKg(items) {
  const tot = (items || []).reduce((s, it) => s + (Number(it.kg) || 0), 0);
  return tot.toLocaleString('es-MX') + ' kg';
}

export default function AprobarOCModal({ oc, onClose, onSaved }) {
  const [pago, setPago] = useState('credito');
  const [fileName, setFileName] = useState('');
  const [fileB64, setFileB64] = useState('');
  const [ref, setRef] = useState('');
  const [dias, setDias] = useState(30); /* días de crédito — editable (no siempre 30) */
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  /* MÓVIL: bloquea el scroll del fondo y publica --pp-vvh (alto visible real
     que sigue al teclado) usado por S.sheet.maxHeight. El componente solo se
     monta cuando está abierto, por eso pasamos true. */
  useBodyScrollLock(true);

  const esContado = pago === 'contado';

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) { setErr('El comprobante excede 6 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { setFileB64(String(reader.result)); setFileName(f.name); setErr(''); };
    reader.readAsDataURL(f);
  };

  const puede = fileB64 && ref.trim();

  const aprobar = async () => {
    setErr('');
    if (!puede) { setErr('Adjunta el comprobante y captura la referencia.'); return; }
    setSaving(true);
    try {
      await api.aprobarOC({ id: oc.id, pago, referencia: ref.trim(), comprobantePdfBase64: fileB64, comprobanteNombre: fileName, diasCredito: pago === 'credito' ? Math.max(1, parseInt(dias) || 30) : undefined });
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e?.data?.error || e.message || 'Error al aprobar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay}>
      <div style={S.sheet}>
        <div style={S.h}>Aprobar orden de compra</div>
        <div style={S.s}>{oc.codigo} · {(oc.items && oc.items[0] && oc.items[0].mp) || 'materia prima'}</div>

        <div style={S.sum}>
          <div style={S.row}><span style={S.k}>Proveedor</span><span style={S.v}>{oc.proveedor}{oc.proveedor && oc.proveedor !== 'POR ASIGNAR' && <span style={S.catb}>catálogo</span>}</span></div>
          <div style={S.row}><span style={S.k}>Cantidad</span><span style={S.v}>{fmtKg(oc.items)}</span></div>
        </div>

        <label style={S.lbl}>Forma de pago</label>
        <div style={S.seg}>
          <button style={S.segb(pago === 'credito')} onClick={() => { setPago('credito'); }}>Crédito</button>
          <button style={S.segb(pago === 'contado')} onClick={() => { setPago('contado'); }}>Contado</button>
        </div>

        {!esContado && (
          <>
            <label style={S.lbl}>Días de crédito</label>
            <input style={S.input} type="number" min="1" max="365" inputMode="numeric"
              value={dias} onChange={(e) => setDias(e.target.value)} placeholder="Ej. 30, 45, 60…" />
            <div style={S.vene}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>
              <span>Vence en <strong>{Math.max(1, parseInt(dias) || 30)} días</strong>. El sistema avisa cuando esté por vencer y si se pasa la fecha de pago.</span>
            </div>
          </>
        )}

        <label style={S.lbl}>{esContado ? 'Comprobante de pago' : 'Comprobante de compra (factura / remisión)'} · obligatorio</label>
        <label style={S.drop(!!fileB64)}>
          {fileB64 ? IFile : ICloud}
          {fileB64
            ? <div style={S.fn}>{fileName}</div>
            : <>
                <div>{esContado ? 'Sube la transferencia / recibo del pago' : 'Sube la factura o remisión del proveedor'}</div>
                <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>PDF o imagen</div>
              </>}
          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={onFile} />
        </label>

        <label style={S.lbl}>Referencia</label>
        <input style={S.input} value={ref} onChange={(e) => setRef(e.target.value)} placeholder={esContado ? 'Ej. SPEI 0098123' : 'Ej. FAC-8841'} />

        {err && <div style={S.err}>{err}</div>}

        <div style={S.acts}>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...S.btn, ...S.btnPrimary, opacity: puede && !saving ? 1 : 0.5 }} onClick={aprobar} disabled={!puede || saving}>
            {saving ? 'Aprobando…' : (<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Aprobar OC</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
