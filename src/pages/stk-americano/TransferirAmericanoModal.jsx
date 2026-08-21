/* TransferirAmericanoModal — transferencia SIMPLE entre almacenes americanos
   (el Almacén 2 es extensión del Almacén 1 — decisión dueño 18-jul-2026).
   Mueve cubetas / galones / litros de totes de un color al otro almacén; los
   lotes viajan con las unidades y los TOTES viajan con su folio cuando se
   mueven litros.

   ELEGIR EL TAMBO (21-ago-2026). Esta pantalla pedía LITROS y nada más, así que
   con varios totes iguales el sistema escogía uno — y no tenía por qué ser el
   que el almacenista cargó. Pasó: se quiso mandar a Terán el tote del lote
   GD89563 y viajó otro, así que en Terán apareció material que no era el
   esperado y la etiqueta habría salido con el lote equivocado. Hubo que
   corregirlo a mano por SSH.
   Ahora se elige el tote de una lista, igual que al envasar, y el backend
   recibe `codigoLote`. "Automático" sigue disponible para granel suelto o
   cuando da igual cuál sea.
   Regla UX 18-jul: el click FUERA no cierra (solo X / Cancelar). */
import { useState } from 'react';
import api from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import humanizeError from '../../utils/humanizeError';

const LBL_ALM = { '1': 'Americano Terán (Alm. 1)', '2': 'Almacén 2' };

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,12,8,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', borderRadius: 12, width: '100%', maxWidth: 440, maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.35)' },
  header: { background: 'var(--lp-brand-700)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: 700, margin: 0 },
  closeBtn: { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer' },
  body: { padding: '18px 20px', overflowY: 'auto', flex: 1 },
  ruta: { padding: '10px 14px', borderRadius: 8, background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)', fontSize: 13, fontWeight: 600, textAlign: 'center' },
  label: { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)', marginBottom: 6, marginTop: 14 },
  seg: { display: 'flex', gap: 4, background: 'var(--lp-bg-sunken)', borderRadius: 999, padding: 3 },
  segBtn: (on, dis) => ({ flex: 1, padding: '8px 6px', minHeight: 38, borderRadius: 999, border: 'none', cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 12, fontWeight: on ? 700 : 500, opacity: dis ? 0.4 : 1, background: on ? 'var(--lp-brand-600)' : 'transparent', color: on ? '#fff' : 'var(--lp-text-secondary)' }),
  input: { width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6, background: 'var(--lp-bg-base)', color: 'var(--lp-text-primary)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
  resumen: (bad) => ({ marginTop: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: bad ? 'var(--lp-danger-50, #FEE2E2)' : 'color-mix(in srgb, var(--lp-info-600) 10%, transparent)', color: bad ? 'var(--lp-danger-700, #991B1B)' : 'var(--lp-text-secondary)', border: '1px solid ' + (bad ? 'color-mix(in srgb, var(--lp-danger-600) 40%, transparent)' : 'color-mix(in srgb, var(--lp-info-600) 28%, transparent)') }),
  footer: { padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--lp-bg-sunken)' },
  btn: (primary, dis) => ({ padding: '10px 18px', fontSize: 13, fontWeight: 700, border: primary ? 'none' : '1.5px solid var(--lp-border-subtle)', borderRadius: 6, cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: dis ? 0.55 : 1, background: primary ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)', color: primary ? '#fff' : 'var(--lp-text-secondary)' }),
  err: { background: 'var(--lp-danger-50, #FEE2E2)', color: 'var(--lp-danger-700, #991B1B)', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginTop: 12 },
};

const nf = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 });

export default function TransferirAmericanoModal({ color, deAlmacen = '1', onClose, onSaved }) {
  useBodyScrollLock(true);
  const aAlmacen = deAlmacen === '2' ? '1' : '2';
  const disp = {
    cubetas: Number(color?.cubetas) || 0,
    galones: Number(color?.galones) || 0,
    litros: Number(color?.totesLitros) || 0,
  };
  const primera = disp.litros > 0 ? 'litros' : disp.cubetas > 0 ? 'cubetas' : 'galones';
  const [pres, setPres] = useState(primera);
  const [cantidad, setCantidad] = useState('');
  /* '' = automático (lo elige el backend). Si no, el folio del tote cargado. */
  const [toteSel, setToteSel] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  if (!color) return null;

  const esLitros = pres === 'litros';
  const n = esLitros ? Number(cantidad) : parseInt(cantidad, 10);
  /* Sólo los totes con contenido: uno vacío no se puede cargar. */
  const totes = esLitros ? (color.totes || []).filter(t => t && (Number(t.litros) || 0) > 0) : [];
  const tote = totes.find(t => t.codigoLote === toteSel) || null;
  /* Con un tambo elegido el techo es ESE tambo, no el granel del color: pedir
     más saldría de otro tote y volveríamos al problema original. */
  const dispSel = tote ? (Number(tote.litros) || 0) : disp[pres];
  const excede = Number.isFinite(n) && n > dispSel + 0.001;
  const puede = Number.isFinite(n) && n > 0 && !excede && !saving;

  const handleTransferir = async () => {
    if (!puede) return;
    setSaving(true); setErr('');
    try {
      await api.transferirStkAmericano({
        key: color.key, nombre: color.nombre, de: deAlmacen, a: aAlmacen,
        presentacion: pres, cantidad: n, nota: nota || undefined,
        ...(tote ? { codigoLote: tote.codigoLote } : {}),
      });
      onSaved && onSaved({ presentacion: pres, cantidad: n, aAlmacen });
      onClose();
    } catch (e) { setErr(humanizeError(e)); setSaving(false); }
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h3 style={S.title}>Transferir — {color.nombre}</h3>
          <button style={S.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.body}>
          <div style={S.ruta}>{LBL_ALM[deAlmacen]} &nbsp;→&nbsp; {LBL_ALM[aAlmacen]}</div>

          <label style={S.label}>Qué se transfiere</label>
          <div style={S.seg}>
            {[['cubetas', `Cubetas (${nf(disp.cubetas)})`], ['galones', `Galones (${nf(disp.galones)})`], ['litros', `Litros totes (${nf(disp.litros)})`]].map(([v, l]) => (
              <button key={v} type="button" style={S.segBtn(pres === v, disp[v] <= 0)} disabled={disp[v] <= 0}
                onClick={() => { setPres(v); setCantidad(''); setToteSel(''); }} data-id={`stkAmericano.transferir.pres.${v}`}>{l}</button>
            ))}
          </div>

          {esLitros && totes.length > 0 && (
            <>
              <label style={S.label}>Qué tambo se movió</label>
              <select style={S.input} value={toteSel} data-id="stkAmericano.transferir.tote"
                onChange={e => {
                  const cod = e.target.value;
                  setToteSel(cod);
                  /* Mover un tambo COMPLETO es el caso normal: se precarga con
                     sus litros para no teclear el número y equivocarse. */
                  const t = totes.find(x => x.codigoLote === cod);
                  setCantidad(t ? String(t.litros) : '');
                }}>
                <option value="">Automático — lo elige el sistema</option>
                {totes.map(t => (
                  <option key={t.codigoLote} value={t.codigoLote}>
                    {t.codigoLote}{t.loteProveedor && t.loteProveedor !== t.codigoLote ? ` · lote ${t.loteProveedor}` : ''} — {nf(t.litros)} L
                  </option>
                ))}
              </select>
            </>
          )}

          <label style={S.label}>Cantidad {esLitros ? '(litros)' : ''}</label>
          <input style={S.input} type="number" inputMode="decimal" min="0" step={esLitros ? '0.01' : '1'}
            value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="0"
            onKeyDown={e => { if (e.key === 'Enter') handleTransferir(); }} data-id="stkAmericano.transferir.cantidad" />

          <label style={S.label}>Nota (opcional)</label>
          <input style={S.input} type="text" value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Ej: tote abierto movido al patio" maxLength={300} />

          <div style={S.resumen(excede)}>
            {Number.isFinite(n) && n > 0 ? (
              excede
                ? (tote
                  ? `El tote ${tote.codigoLote} solo tiene ${nf(dispSel)} L.`
                  : `Solo hay ${nf(dispSel)} ${pres} disponibles en ${LBL_ALM[deAlmacen]}.`)
                : <>Se moverán <strong>{nf(n)} {esLitros ? 'L' : pres}</strong> al {LBL_ALM[aAlmacen]}.{' '}
                  {tote
                    ? <>Sale del tote <strong>{tote.codigoLote}</strong>, que conserva su folio al cruzar.</>
                    : esLitros ? 'Los totes viajan con su folio: el lote no cambia al cruzar.' : 'Los lotes viajan con las unidades.'}</>
            ) : 'Indica cuánto se transfiere.'}
          </div>
          {err && <div style={S.err}>{err}</div>}
        </div>
        <div style={S.footer}>
          <button style={S.btn(false, saving)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btn(true, !puede)} disabled={!puede} onClick={handleTransferir} data-id="stkAmericano.transferir.confirmar" data-rol="admin,almacen">
            {saving ? 'Transfiriendo…' : 'Transferir'}
          </button>
        </div>
      </div>
    </div>
  );
}
