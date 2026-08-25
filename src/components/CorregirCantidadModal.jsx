/* ════════════════════════════════════════════════════════════════════════════
   CORREGIR CUÁNTO SE VA A PRODUCIR (25-ago-2026).

   El dueño mandó producir BLANCO OFFWHITE por 2 totes cuando era 1 y no había
   por dónde arreglarlo: el ERP deja crear, aceptar, rechazar y eliminar un
   pedido, pero no corregir su cantidad. Se editaba el JSON del VPS a mano.

   No usa window.prompt a propósito — la PWA de iOS lo traga en silencio (mismo
   motivo por el que el rechazo de pedidos dejó de usarlo).

   Vive en components/ porque lo usan DOS pantallas: Pedidos (antes de arrancar,
   que es cuando de verdad conviene corregir) y la cola de Producción.

   El candado real vive en el servidor (solo admin, solo antes de 'producido',
   motivo obligatorio, y el cubeta-equivalente lo recalcula él). Aquí solo se
   captura y se muestra la equivalencia para que nadie confunda totes con
   cubetas, que es de donde salió el enredo.
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useMemo } from 'react';
import api from '../services/api';
import humanizeError from '../utils/humanizeError';
import { ptMedidaDef, medidaACubetas, etiquetaMedida, bachasParaLitros } from '../utils/ptMedidas';

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(10,16,14,.45)', zIndex: 1200,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { background: 'var(--lp-bg-raised)', borderRadius: 18, padding: 20, width: '100%',
    maxWidth: 440, fontFamily: 'var(--lp-font-sans)', boxSizing: 'border-box' },
  title: { fontSize: 17, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 2 },
  sub: { fontSize: 12.5, color: 'var(--lp-text-tertiary)', marginBottom: 16 },
  label: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-tertiary)',
    display: 'block', marginBottom: 5, letterSpacing: '.03em' },
  input: { width: '100%', height: 46, padding: '0 12px', fontSize: 15, boxSizing: 'border-box',
    fontFamily: 'var(--lp-font-mono)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 11, background: 'var(--lp-bg-base)', color: 'var(--lp-text-primary)', outline: 'none' },
  textarea: { width: '100%', minHeight: 68, padding: '10px 12px', fontSize: 14, boxSizing: 'border-box',
    fontFamily: 'inherit', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 11,
    background: 'var(--lp-bg-base)', color: 'var(--lp-text-primary)', outline: 'none', resize: 'vertical' },
  equiv: { fontSize: 12.5, color: 'var(--lp-brand-700)', margin: '8px 0 16px', lineHeight: 1.5 },
  err: { fontSize: 12.5, color: 'var(--lp-danger-700)', background: 'var(--lp-danger-50)',
    border: '1px solid var(--lp-danger-200)', borderRadius: 10, padding: '9px 11px', marginBottom: 12 },
  row: { display: 'flex', gap: 10, marginTop: 4 },
  ghost: { flex: '0 0 auto', height: 46, padding: '0 18px', borderRadius: 12, cursor: 'pointer',
    border: '1px solid var(--lp-border-subtle)', background: 'transparent',
    color: 'var(--lp-text-secondary)', fontSize: 14.5, fontWeight: 600, fontFamily: 'inherit' },
  primary: (off) => ({ flex: 1, height: 46, borderRadius: 12, border: 'none', fontFamily: 'inherit',
    cursor: off ? 'default' : 'pointer', background: 'var(--lp-brand-600)', color: '#fff',
    fontSize: 14.5, fontWeight: 600, opacity: off ? .45 : 1 }),
};

export default function CorregirCantidadModal({ pedido, onClose, onSaved }) {
  const medida = pedido.medida || 'cubeta';
  const def = ptMedidaDef(medida);
  const [qty, setQty] = useState(String(pedido.medidaQty ?? pedido.cantidad ?? 1));
  const [motivo, setMotivo] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const n = Number(qty);
  const valido = Number.isFinite(n) && n > 0;
  const cubetas = useMemo(() => (valido ? Math.round(medidaACubetas(medida, n)) : 0), [medida, n, valido]);
  const bachas = useMemo(() => (valido ? bachasParaLitros(cubetas * 19) : 1), [cubetas, valido]);
  const puede = valido && motivo.trim().length >= 5 && !saving;

  const guardar = async () => {
    if (!puede) return;
    setSaving(true); setErr('');
    try {
      await api.corregirCantidadPedido(pedido.id, n, motivo.trim());
      onSaved?.();
    } catch (e) {
      setErr(humanizeError(e));
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.card} onClick={e => e.stopPropagation()}>
        <div style={S.title}>Corregir cantidad</div>
        <div style={S.sub}>{pedido.formula || pedido.producto} · {pedido.codigo || pedido.id}</div>

        {err && <div style={S.err}>{err}</div>}

        <label style={S.label} htmlFor="cc-qty">
          {/* "cubeta" es la única medida femenina del catálogo — "Cuántos cubetas"
              se lee como error de la app y resta confianza justo donde se está
              corrigiendo un número que mueve inventario. */}
          {def ? `${medida === 'cubeta' ? 'Cuántas' : 'Cuántos'} ${def.plur}` : 'Cuántas unidades'}
        </label>
        <input id="cc-qty" type="number" min="0" step="any" inputMode="decimal" style={S.input}
          value={qty} onChange={e => setQty(e.target.value)} autoFocus />

        <div style={S.equiv}>
          {valido ? (
            <>Queda en <strong>{etiquetaMedida(medida, n)}</strong> = <strong>{cubetas.toLocaleString('es-MX')} cubetas</strong>
              {bachas > 1 && <> · se produce en <strong>{bachas} bachas</strong></>}
              <br />
              <span style={{ color: 'var(--lp-text-tertiary)' }}>
                Antes: {etiquetaMedida(medida, Number(pedido.medidaQty) || 0)} = {Number(pedido.cantidad || 0).toLocaleString('es-MX')} cubetas
              </span>
            </>
          ) : <span style={{ color: 'var(--lp-danger-600)' }}>Escribe una cantidad mayor a cero.</span>}
        </div>

        <label style={S.label} htmlFor="cc-motivo">Motivo (queda en el historial)</label>
        <textarea id="cc-motivo" style={S.textarea} value={motivo} placeholder="Ej. Terán pidió 1 tote, se capturaron 2"
          onChange={e => setMotivo(e.target.value)} />
        {motivo.trim().length > 0 && motivo.trim().length < 5 && (
          <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 4 }}>Al menos 5 caracteres.</div>
        )}

        <div style={S.row}>
          <button type="button" style={S.ghost} onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" style={S.primary(!puede)} onClick={guardar} disabled={!puede}>
            {saving ? 'Guardando…' : 'Corregir'}
          </button>
        </div>
      </div>
    </div>
  );
}
