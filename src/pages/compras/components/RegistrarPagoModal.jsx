import { useState } from 'react';
import api from '../../../services/api';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';

/* RegistrarPagoModal — HANDOFF jun 2026 (Sprint AC2).
   Cierra una OC a crédito: sube el comprobante del pago real (transferencia /
   recibo) y la referencia. La OC pasa a "pagada" y la alerta de vencimiento
   desaparece. */

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 16 },
  sheet: { background: 'var(--lp-bg-base)', borderRadius: 20, padding: '20px 20px 28px', maxWidth: 460, width: '100%', maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)', overflowY: 'auto' },
  h: { fontSize: 18, fontWeight: 700, color: 'var(--lp-text-primary)' },
  s: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2, marginBottom: 12 },
  lbl: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', margin: '16px 2px 6px' },
  drop: (has) => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '22px 18px', marginTop: 6, border: '1.5px ' + (has ? 'solid var(--lp-brand-600)' : 'dashed var(--lp-border-default)'), borderRadius: 14, background: 'var(--lp-bg-sunken)', cursor: 'pointer', color: has ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)', textAlign: 'center', fontSize: 13, minHeight: 88 }),
  fn: { fontSize: 13, fontWeight: 700, color: 'var(--lp-brand-700)', wordBreak: 'break-all' },
  input: { width: '100%', height: 46, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 15, color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: '9px 12px', borderRadius: 8, fontSize: 12, marginTop: 12, whiteSpace: 'pre-line' },
  acts: { display: 'flex', gap: 10, marginTop: 18 },
  btn: { height: 50, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnGhost: { flex: '0 0 auto', padding: '0 20px', background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' },
  btnPrimary: { flex: 1, background: 'var(--lp-brand-600)', color: '#fff' },
};

const ICloud = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5-5 5 5"/><path d="M12 5v12"/></svg>
);
const IFile = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
);

export default function RegistrarPagoModal({ oc, onClose, onSaved }) {
  const [fileName, setFileName] = useState('');
  const [fileB64, setFileB64] = useState('');
  const [ref, setRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  /* MÓVIL: este modal se monta solo cuando está abierto (el padre lo renderiza
     condicionalmente), por eso pasamos `true`. Congela el scroll del fondo y
     publica --pp-vvh para que el sheet tenga overflow interno scrolleable. */
  useBodyScrollLock(true);

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) { setErr('El comprobante excede 6 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { setFileB64(String(reader.result)); setFileName(f.name); setErr(''); };
    reader.readAsDataURL(f);
  };

  const puede = fileB64 && ref.trim();

  const registrar = async () => {
    setErr('');
    if (!puede) { setErr('Adjunta el comprobante de pago y la referencia.'); return; }
    setSaving(true);
    try {
      await api.registrarPagoOC({ id: oc.id, referencia: ref.trim(), comprobantePagoPdfBase64: fileB64, comprobanteNombre: fileName });
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e?.data?.error || e.message || 'Error al registrar el pago');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div style={S.sheet}>
        <div style={S.h}>Registrar pago del crédito</div>
        <div style={S.s}>{oc.codigo} · {oc.proveedor}</div>

        <label style={S.lbl}>Comprobante de pago · obligatorio</label>
        <label style={S.drop(!!fileB64)}>
          {fileB64 ? IFile : ICloud}
          {fileB64
            ? <div style={S.fn}>{fileName}</div>
            : <>
                <div>Sube la transferencia / recibo del pago</div>
                <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>PDF o imagen</div>
              </>}
          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={onFile} />
        </label>

        <label style={S.lbl}>Referencia de pago</label>
        <input style={S.input} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ej. SPEI 0098123" />

        {err && <div style={S.err}>{err}</div>}

        <div style={S.acts}>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...S.btn, ...S.btnPrimary, opacity: puede && !saving ? 1 : 0.5 }} onClick={registrar} disabled={!puede || saving}>
            {saving ? 'Registrando…' : 'Marcar pagada'}
          </button>
        </div>
      </div>
    </div>
  );
}
