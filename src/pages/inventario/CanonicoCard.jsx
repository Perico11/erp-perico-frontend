/* ════════════════════════════════════════════════════════════════════════════
   CanonicoCard — "Inventario inicial (base canónica)" dentro de la pantalla de
   Inventario (solo admin). Permite CONGELAR el inventario actual como base v1
   (inmutable, con código admin/TOTP) y ver el DELTA: cuánto se ha movido el
   inventario operativo respecto a esa base. Reusa los endpoints existentes
   (/api/inventario/canonico, /crear, /delta).
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/ui/Toast';

const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 });
const fmtFecha = (iso) => { try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; } };

const S = {
  ov: { position: 'fixed', inset: 0, background: 'rgba(26,24,21,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius-lg)', border: '1px solid var(--lp-border-subtle)', width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column' },
  lbl: { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '12px 0 5px' },
  inp: { width: '100%', padding: '10px 12px', border: '1px solid var(--lp-border-subtle)', borderRadius: 10, fontSize: 13.5, fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)' },
  btnP: { height: 44, padding: '0 18px', borderRadius: 'var(--lp-radius-md)', border: 'none', background: 'var(--lp-brand-600)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13.5 },
  btnG: { height: 44, padding: '0 16px', borderRadius: 'var(--lp-radius-md)', border: '1px solid var(--lp-border-default)', background: 'transparent', color: 'var(--lp-text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 13.5 },
};

function FreezeModal({ onClose, onDone }) {
  const toast = useToast();
  const [motivo, setMotivo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!codigo.trim()) { toast.error('Ingresa tu código (TOTP o código admin)'); return; }
    setSaving(true);
    try {
      await api.crearCanonico(codigo.trim(), motivo.trim() || 'Congelación inicial del inventario base');
      toast.success('Inventario inicial congelado como base v1', { duration: 5000 });
      onDone();
    } catch (e) {
      toast.error('No se pudo congelar: ' + (e?.data?.error || e?.message || 'error'));
      setSaving(false);
    }
  };
  return (
    <div style={S.ov} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.box, padding: '18px 20px 16px' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>Congelar inventario inicial</div>
        <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 6, lineHeight: 1.45 }}>
          Guarda el inventario <strong>actual</strong> como la <strong>base canónica v1</strong> (inmutable, con checksum). Hazlo <strong>solo cuando ya cargaste los datos reales</strong> — después podrás ver cuánto se mueve el inventario respecto a esta base.
        </div>
        <label style={S.lbl}>Motivo (opcional)</label>
        <textarea style={{ ...S.inp, minHeight: 54, resize: 'vertical' }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: Carga inicial validada con conteo físico, jun 2026" />
        <label style={S.lbl}>Código de autorización *</label>
        <input style={S.inp} type="password" inputMode="numeric" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Tu Google Authenticator (6 dígitos) o código admin" />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button style={S.btnG} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...S.btnP, opacity: saving ? .7 : 1 }} onClick={submit} disabled={saving}>{saving ? 'Congelando…' : 'Congelar como v1'}</button>
        </div>
      </div>
    </div>
  );
}

function DeltaModal({ onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getCanonicoDelta().then(r => setData(r)).catch(e => setData({ err: e?.data?.error || e?.message || 'error' })).finally(() => setLoading(false));
  }, []);
  const th = { textAlign: 'left', padding: '6px 8px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', position: 'sticky', top: 0, background: 'var(--lp-bg-sunken)' };
  const td = { padding: '6px 8px', fontSize: 12, borderTop: '1px solid var(--lp-border-subtle)' };
  const Tabla = ({ titulo, rows, u }) => rows.length === 0 ? null : (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '6px 0' }}>{titulo} ({rows.length})</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Material</th><th style={{ ...th, textAlign: 'right' }}>Base</th><th style={{ ...th, textAlign: 'right' }}>Hoy</th><th style={{ ...th, textAlign: 'right' }}>Δ</th></tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const neg = r.delta < 0;
            return (
              <tr key={i}>
                <td style={td}>{r.nombre}</td>
                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)' }}>{fmt(r.canon)}</td>
                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{fmt(r.actual)} {u}</td>
                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: neg ? 'var(--lp-danger-600)' : 'var(--lp-brand-700)' }}>{neg ? '' : '+'}{fmt(r.delta)}{r.pct != null ? ` (${r.pct > 0 ? '+' : ''}${r.pct}%)` : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return (
    <div style={S.ov} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.box} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 18px 8px' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Delta vs inventario inicial</div>
          <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 3 }}>Cuánto se ha movido el inventario respecto a la base canónica{data && data.version ? ` v${data.version}` : ''}.</div>
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 18px', flex: 1 }}>
          {loading ? <div style={{ textAlign: 'center', padding: 28, color: 'var(--lp-text-tertiary)', fontSize: 13 }}>Calculando…</div>
            : data?.err ? <div style={{ color: 'var(--lp-danger-600)', fontSize: 13, padding: 10 }}>{data.err}</div>
            : (data?.totalCambios === 0) ? <div style={{ textAlign: 'center', padding: 28, color: 'var(--lp-text-tertiary)', fontSize: 13 }}>El inventario coincide exactamente con la base. Sin movimientos.</div>
            : <><Tabla titulo="Materia prima" rows={data?.delta?.mp || []} u="kg" /><Tabla titulo="Producto terminado" rows={data?.delta?.pt || []} u="cub" /></>}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
          <button style={S.btnG} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function CanonicoCard() {
  const [canon, setCanon] = useState(undefined); /* undefined=cargando · null=no existe · obj=existe */
  const [deltaCount, setDeltaCount] = useState(null);
  const [showFreeze, setShowFreeze] = useState(false);
  const [showDelta, setShowDelta] = useState(false);

  const load = useCallback(() => {
    api.getCanonico()
      .then(r => {
        setCanon(r.canonico || null);
        api.getCanonicoDelta().then(d => setDeltaCount(d.totalCambios)).catch(() => setDeltaCount(null));
      })
      .catch(() => { setCanon(null); setDeltaCount(null); });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (canon === undefined) return null;

  const meta = canon?._meta;
  const wrap = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '8px 0 4px', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-sunken)' };

  return (
    <>
      {!canon ? (
        <div style={wrap}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Inventario inicial (base) — aún no fijado</div>
            <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>Cuando termines de cargar los datos reales, congélalo como base para poder medir el movimiento.</div>
          </div>
          <button style={{ ...S.btnP, height: 38 }} onClick={() => setShowFreeze(true)}>Congelar inventario inicial</button>
        </div>
      ) : (
        <div style={wrap}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--lp-brand-600)', flex: '0 0 auto' }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Inventario inicial v{meta?.version} · congelado {fmtFecha(meta?.fechaCongelacion)}{meta?.congeladoPor ? ` por ${meta.congeladoPor}` : ''}</div>
            <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
              {deltaCount == null ? 'Base canónica protegida.' : deltaCount === 0 ? 'Sin movimiento respecto a la base.' : `${deltaCount} ${deltaCount === 1 ? 'material se ha movido' : 'materiales se han movido'} respecto a la base.`}
            </div>
          </div>
          <button style={{ ...S.btnG, height: 38 }} onClick={() => setShowDelta(true)}>Ver delta</button>
        </div>
      )}

      {showFreeze && <FreezeModal onClose={() => setShowFreeze(false)} onDone={() => { setShowFreeze(false); load(); }} />}
      {showDelta && <DeltaModal onClose={() => setShowDelta(false)} />}
    </>
  );
}
