/* SalidaAmericanoModal — descuenta existencias de UN color por presentación
   (cubetas, galones o litros en totes). Modelo v2.

   Permisos backend: admin + almacen. */
import { useState } from 'react';
import api from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import humanizeError from '../../utils/humanizeError'; /* AUDIT UX 16-jul (U4) */

const PRES = [
  { id: 'cubetas', label: 'Cubetas', unidad: 'cubetas', campo: 'cubetas' },
  { id: 'galones', label: 'Galones', unidad: 'galones', campo: 'galones' },
  { id: 'litros', label: 'Litros (totes)', unidad: 'L', campo: 'totesLitros' },
];

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,12,8,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', borderRadius: 12, width: '100%', maxWidth: 460, maxHeight: 'calc(100vh - 32px)', maxBlockSize: 'calc(var(--pp-vvh, 100dvh) - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.35)' },
  header: { background: 'var(--lp-brand-700)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: 700, margin: 0 },
  closeBtn: { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer' },
  body: { padding: '18px 20px', overflowY: 'auto', flex: 1 },
  footer: { padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--lp-bg-sunken)' },
  colorBox: { padding: '10px 14px', borderRadius: 8, background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)', marginBottom: 8 },
  colorName: { fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)' },
  colorNums: { fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 4 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)', marginBottom: 6, marginTop: 14 },
  seg: { display: 'flex', gap: 4, background: 'var(--lp-bg-sunken)', borderRadius: 999, padding: 3 },
  segBtn: (on) => ({ flex: 1, padding: '8px 10px', minHeight: 38, borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 12.5, fontWeight: on ? 700 : 500, background: on ? 'var(--lp-brand-600)' : 'transparent', color: on ? '#fff' : 'var(--lp-text-secondary)' }),
  inputSm: { width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', boxSizing: 'border-box', outline: 'none' },
  btn: (primary) => ({ padding: '10px 18px', fontSize: 13, fontWeight: 700, border: primary ? 'none' : '1.5px solid var(--lp-border-subtle)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: primary ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)', color: primary ? '#fff' : 'var(--lp-text-secondary)' }),
  hint: { fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 6, lineHeight: 1.5 },
  alertErr: { background: 'var(--lp-danger-50, #FEE2E2)', color: 'var(--lp-danger-700, #991B1B)', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginTop: 12 },
};

const nf = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 });

export default function SalidaAmericanoModal({ color, almacen = '1', presInicial = 'cubetas', onClose, onSaved }) {
  useBodyScrollLock(true);
  const [pres, setPres] = useState(presInicial);
  const [cantidad, setCantidad] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  if (!color) return null;
  const presDef = PRES.find(p => p.id === pres) || PRES[0];
  const disponible = Number(color[presDef.campo]) || 0;

  const handleSalida = async () => {
    const q = parseFloat(cantidad);
    if (!Number.isFinite(q) || q <= 0) { setErr('Ingresa la cantidad que salió'); return; }
    if (q > disponible + 0.001) { setErr(`Solo hay ${nf(disponible)} ${presDef.unidad}`); return; }
    /* P1 (20-jul-2026): motivo OBLIGATORIO — la salida con destino es una
       Entrega (folio + remisión); esta salida es para ajustes/mermas. */
    if (nota.trim().length < 5) { setErr('Escribe el motivo (mín. 5 caracteres). Si es entrega a tienda, usa Entregas.'); return; }
    setSaving(true); setErr('');
    try {
      await api.salidaStkAmericano({ almacen, key: color.key, nombre: color.nombre, presentacion: pres, cantidad: q, nota: nota.trim() });
      onSaved && onSaved(); onClose();
    } catch (e) { setErr(humanizeError(e)); setSaving(false); } /* AUDIT UX 16-jul (U4) */
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h3 style={S.title}>Salida — {color.nombre}</h3>
          <button style={S.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.body}>
          <div style={S.colorBox}>
            <div style={S.colorName}>{color.nombre}</div>
            <div style={S.colorNums}>{nf(color.cubetas)} cub · {nf(color.galones)} gal · {nf(color.totesLitros)} L en totes</div>
          </div>

          <label style={S.label}>Presentación que sale</label>
          <div style={S.seg}>
            {PRES.map(p => (
              <button key={p.id} type="button" style={S.segBtn(pres === p.id)} onClick={() => { setPres(p.id); setErr(''); }} data-id={`stkAmericano.salida.pres.${p.id}`}>{p.label}</button>
            ))}
          </div>

          <label style={S.label}>Cantidad ({presDef.unidad}) — disponible {nf(disponible)}</label>
          <input style={S.inputSm} type="number" inputMode="decimal" step={pres === 'litros' ? '0.1' : '1'} min="0" max={disponible}
            value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0" autoFocus data-id="stkAmericano.salida.cantidad" />

          <label style={S.label}>Motivo *</label>
          <input style={S.inputSm} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: merma por daño, ajuste de conteo…" data-id="stkAmericano.salida.motivo" />
          <div style={S.hint}>Esta salida es para ajustes y mermas. Si va a una tienda, regístrala en <strong>Entregas</strong> (folio + remisión).</div>

          {err && <div style={S.alertErr}>{err}</div>}
        </div>
        <div style={S.footer}>
          <button style={S.btn(false)} onClick={onClose}>Cancelar</button>
          <button style={S.btn(true)} disabled={saving} onClick={handleSalida} data-id="stkAmericano.salida.guardar">
            {saving ? 'Guardando...' : 'Registrar salida'}
          </button>
        </div>
      </div>
    </div>
  );
}
