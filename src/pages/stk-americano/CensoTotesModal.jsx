/* CensoTotesModal — le pone FOLIO al granel que ya está en piso sin identidad
   (5-ago-2026, pedido dueño: "necesito diferenciar si se envasó de un tote
   distinto aunque sea el mismo día").

   Hasta ahora Terán recibía litros anónimos y cada sesión de envasado inventaba
   un código: un tote envasado en parcialidades quedaba partido en varios lotes.
   Aquí Josué declara los totes FÍSICOS abiertos de un color y el sistema emite
   un folio corrido por cada uno; de ahí en adelante el envasado sale de un tote.

   Si lo declarado no cuadra con el sistema, el backend responde 409 y el ajuste
   se confirma explícitamente (el conteo físico manda, pero nunca en silencio).
   Regla UX 18-jul: el click FUERA no cierra (solo X / Cancelar). */
import { useState } from 'react';
import api from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import humanizeError from '../../utils/humanizeError';

const LITROS_TOTE = 1000;

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,12,8,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.35)' },
  header: { background: 'var(--lp-brand-700)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: 700, margin: 0 },
  closeBtn: { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer' },
  body: { padding: '18px 20px', overflowY: 'auto', flex: 1 },
  intro: { padding: '10px 14px', borderRadius: 8, background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)', fontSize: 12.5, color: 'var(--lp-text-secondary)', lineHeight: 1.5 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)', marginBottom: 6, marginTop: 16 },
  fila: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  num: { width: 26, fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', flexShrink: 0 },
  input: { width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6, background: 'var(--lp-bg-base)', color: 'var(--lp-text-primary)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
  inputL: { flex: '0 0 110px' },
  inputProv: { flex: 1, fontSize: 13 },
  quitar: { width: 32, height: 38, flexShrink: 0, borderRadius: 6, border: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', fontSize: 16, lineHeight: 1, cursor: 'pointer' },
  addBtn: { marginTop: 4, padding: '9px 14px', fontSize: 12.5, fontWeight: 600, borderRadius: 6, border: '1.5px dashed var(--lp-border-subtle)', background: 'transparent', color: 'var(--lp-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' },
  resumen: (bad) => ({ marginTop: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13, lineHeight: 1.5, background: bad ? 'var(--lp-warn-50, #FEF3C7)' : 'color-mix(in srgb, var(--lp-info-600) 10%, transparent)', color: bad ? 'var(--lp-warn-800, #92400E)' : 'var(--lp-text-secondary)', border: '1px solid ' + (bad ? 'color-mix(in srgb, var(--lp-warn-600, #D97706) 40%, transparent)' : 'color-mix(in srgb, var(--lp-info-600) 28%, transparent)') }),
  confirmBox: { marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--lp-warn-50, #FEF3C7)', border: '1px solid color-mix(in srgb, var(--lp-warn-600, #D97706) 45%, transparent)', color: 'var(--lp-warn-800, #92400E)', fontSize: 12.5, lineHeight: 1.5, display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer' },
  footer: { padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--lp-bg-sunken)' },
  btn: (primary, dis) => ({ padding: '10px 18px', fontSize: 13, fontWeight: 700, border: primary ? 'none' : '1.5px solid var(--lp-border-subtle)', borderRadius: 6, cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: dis ? 0.55 : 1, background: primary ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)', color: primary ? '#fff' : 'var(--lp-text-secondary)' }),
  err: { background: 'var(--lp-danger-50, #FEE2E2)', color: 'var(--lp-danger-700, #991B1B)', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginTop: 12 },
};

const nf = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });

/* Sugerencia inicial: los litros sin identificar repartidos en totes llenos + el
   resto. Es solo un punto de partida — manda lo que Josué ve en el piso. */
function sugerir(granel) {
  const out = [];
  let rest = +Number(granel || 0).toFixed(2);
  while (rest > LITROS_TOTE + 0.01) { out.push({ litros: String(LITROS_TOTE), loteProveedor: '' }); rest = +(rest - LITROS_TOTE).toFixed(2); }
  if (rest > 0.01) out.push({ litros: String(rest), loteProveedor: '' });
  return out.length ? out : [{ litros: '', loteProveedor: '' }];
}

export default function CensoTotesModal({ color, almacen = '1', onClose, onSaved }) {
  useBodyScrollLock(true);
  const granel = Number(color?.granelSinLote) || 0;
  const [filas, setFilas] = useState(() => sugerir(granel));
  const [nota, setNota] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  if (!color) return null;

  const set = (i, campo, val) => setFilas(f => f.map((x, j) => (j === i ? { ...x, [campo]: val } : x)));
  const quitar = (i) => setFilas(f => (f.length > 1 ? f.filter((_, j) => j !== i) : f));

  const validas = filas.map(f => Number(f.litros)).filter(n => Number.isFinite(n) && n > 0);
  const declarado = +validas.reduce((s, n) => s + n, 0).toFixed(2);
  const dif = +(declarado - granel).toFixed(2);
  const descuadra = Math.abs(dif) > 1;
  const excedeTote = filas.some(f => Number(f.litros) > LITROS_TOTE + 0.01);
  const puede = validas.length > 0 && !excedeTote && !saving && (!descuadra || confirmar);

  const handleGuardar = async () => {
    if (!puede) return;
    setSaving(true); setErr('');
    try {
      const r = await api.censarTotesAmericano({
        almacen, key: color.key, nombre: color.nombre,
        totes: filas.filter(f => Number(f.litros) > 0).map(f => ({ litros: Number(f.litros), loteProveedor: f.loteProveedor.trim() || undefined })),
        confirmarAjuste: descuadra || undefined,
        nota: nota.trim() || undefined,
      });
      onSaved && onSaved(r);
      onClose();
    } catch (e) { setErr(humanizeError(e)); setSaving(false); }
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h3 style={S.title}>Censo de totes — {color.nombre}</h3>
          <button style={S.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.body}>
          <div style={S.intro}>
            Hay <strong>{nf(granel)} L</strong> sin tote identificado. Declara cuántos totes
            físicos son y cuánto tiene cada uno: el sistema le da su folio a cada uno y a
            partir de ahí el envasado sale de un tote concreto.
          </div>

          <label style={S.label}>Totes abiertos de este color</label>
          {filas.map((f, i) => (
            <div key={i} style={S.fila}>
              <span style={S.num}>{i + 1}</span>
              <input style={{ ...S.input, ...S.inputL }} type="number" inputMode="decimal" min="0" max={LITROS_TOTE} step="0.01"
                value={f.litros} onChange={e => set(i, 'litros', e.target.value)} placeholder="litros"
                data-id={`stkAmericano.censo.litros.${i}`} />
              <input style={{ ...S.input, ...S.inputProv }} type="text" value={f.loteProveedor}
                onChange={e => set(i, 'loteProveedor', e.target.value)} placeholder="lote del fabricante (opcional)" maxLength={60}
                data-id={`stkAmericano.censo.loteProveedor.${i}`} />
              <button type="button" style={S.quitar} onClick={() => quitar(i)} disabled={filas.length <= 1}
                aria-label={`Quitar tote ${i + 1}`}>×</button>
            </div>
          ))}
          <button type="button" style={S.addBtn} onClick={() => setFilas(f => [...f, { litros: '', loteProveedor: '' }])}
            data-id="stkAmericano.censo.agregar">+ Agregar otro tote</button>

          <label style={S.label}>Nota (opcional)</label>
          <input style={S.input} type="text" value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Ej: dos totes abiertos en el patio" maxLength={300} />

          <div style={S.resumen(descuadra || excedeTote)}>
            {excedeTote
              ? `Un tote no puede tener más de ${nf(LITROS_TOTE)} L. Si son dos, agrégalos por separado.`
              : validas.length === 0
                ? 'Indica los litros de cada tote.'
                : <>
                    Declaras <strong>{validas.length} tote{validas.length > 1 ? 's' : ''}</strong> con <strong>{nf(declarado)} L</strong> en total.
                    {descuadra
                      ? <> El sistema tiene <strong>{nf(granel)} L</strong> sin identificar: sobran/faltan <strong>{dif > 0 ? '+' : ''}{nf(dif)} L</strong>.</>
                      : ' Cuadra con el sistema.'}
                  </>}
          </div>

          {descuadra && validas.length > 0 && !excedeTote && (
            <label style={S.confirmBox}>
              <input type="checkbox" checked={confirmar} onChange={e => setConfirmar(e.target.checked)}
                data-id="stkAmericano.censo.confirmarAjuste" />
              <span>Confirmo el conteo físico: ajusta el stock de {color.nombre} en <strong>{dif > 0 ? '+' : ''}{nf(dif)} L</strong>. Queda registrado a mi nombre.</span>
            </label>
          )}
          {err && <div style={S.err}>{err}</div>}
        </div>
        <div style={S.footer}>
          <button style={S.btn(false, saving)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btn(true, !puede)} disabled={!puede} onClick={handleGuardar}
            data-id="stkAmericano.censo.confirmar" data-rol="admin,almacen">
            {saving ? 'Registrando…' : `Registrar ${validas.length || ''} tote${validas.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
