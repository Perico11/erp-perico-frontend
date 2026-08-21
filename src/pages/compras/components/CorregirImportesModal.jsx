import { useState } from 'react';
import api from '../../../services/api';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import { useImportesOC } from './importesOC';
import ImportesOCFields from './ImportesOCFields';

/* CorregirImportesModal (27-jul-2026, pedido del dueño).

   En las OCs de CONTADO el pago se registra al aprobar, así que "Registrar pago"
   ya no aparece: si la factura real llega con otro precio o el flete cambió, no
   había dónde corregirlo (y "Editar" rechaza toda OC recibida, además de que
   nunca editó precios). Mismo alcance que al pagar: solo dinero — precio/kg,
   flete y total facturado. Los kg no se tocan aquí: eso es "Recibir MP".

   Sirve igual para un crédito YA pagado al que después le llega una nota o una
   factura corregida. */

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 16 },
  sheet: { background: 'var(--lp-bg-base)', borderRadius: 20, padding: '20px 20px 28px', maxWidth: 460, width: '100%', maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)', overflowY: 'auto' },
  h: { fontSize: 18, fontWeight: 700, color: 'var(--lp-text-primary)' },
  s: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2, marginBottom: 12 },
  lbl: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', margin: '16px 2px 6px' },
  input: { width: '100%', height: 46, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 15, color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: '9px 12px', borderRadius: 8, fontSize: 12, marginTop: 12, whiteSpace: 'pre-line' },
  acts: { display: 'flex', gap: 10, marginTop: 18 },
  btn: { height: 50, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnGhost: { flex: '0 0 auto', padding: '0 20px', background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' },
  btnPrimary: { flex: 1, background: 'var(--lp-brand-600)', color: '#fff' },
};

export default function CorregirImportesModal({ oc, onClose, onSaved }) {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const imp = useImportesOC(oc);

  useBodyScrollLock(true);

  const puede = imp.hayCambios && !imp.hayError;

  const guardar = async () => {
    setErr('');
    if (imp.hayError) { setErr('Revisa los importes: no se aceptan valores negativos ni texto.'); return; }
    if (!imp.hayCambios) { setErr('No hay ningún importe distinto al que ya tiene la OC.'); return; }
    setSaving(true);
    try {
      await api.corregirImportesOC({
        id: oc.id,
        ...imp.payloadImportes(),
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      });
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e?.data?.error || e.message || 'Error al corregir los importes');
    } finally {
      setSaving(false);
    }
  };

  const pagoLbl = oc.pago === 'contado' ? 'Contado · pagada al aprobar'
                : (oc.pagada ? 'Crédito · ya pagada' : 'Crédito');

  return (
    <div style={S.overlay}>
      <div style={S.sheet}>
        <div style={S.h}>Corregir importes</div>
        <div style={S.s}>{oc.codigo} · {oc.proveedor} · {pagoLbl}</div>

        <ImportesOCFields ctl={imp} titulo="Importes reales de la factura" />

        <label style={S.lbl}>Motivo · opcional</label>
        <input
          style={S.input}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. el proveedor subió el flete"
          maxLength={200}
        />

        {err && <div style={S.err}>{err}</div>}

        <div style={S.acts}>
          <button style={{ ...S.btn, ...S.btnGhost }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            data-id="compras.btn.guardar-importes"
            style={{ ...S.btn, ...S.btnPrimary, opacity: puede && !saving ? 1 : 0.5 }}
            onClick={guardar}
            disabled={!puede || saving}
          >
            {saving ? 'Guardando…' : 'Guardar importes'}
          </button>
        </div>
      </div>
    </div>
  );
}
