/* ════════════════════════════════════════════════════════════════════════════
   SustituirMPModal — cambiar una materia prima por otra en TODAS las fórmulas.

   17-sep-2026, pedido del dueño: "necesito un botón para sustituir una materia
   prima en volumen en fórmulas: que si tengo TEXANOL poder sustituirlo por
   otra y se refleje en todas las fórmulas que están cargadas con ese material".

   Ya había un botón así, pero escondido en Inventarios ▸ MP ▸ Maestro ▸ menú ⋯
   del renglón, y hace algo distinto: también transfiere el stock y DA DE BAJA
   la original. Éste vive donde se piensa el problema —Fórmulas— y hace sólo lo
   que se pidió: las recetas cambian, la MP vieja sigue viva con su existencia.

   La VISTA PREVIA no es adorno. Esto toca todas las fórmulas de un jalón, así
   que primero se enseña qué va a pasar en cada una —cuánto lleva hoy y cuánto
   quedaría— y sólo entonces se habilita el botón de aplicar. La calcula el
   servidor con la misma función que luego aplica, así que no puede mentir.
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useMemo, useEffect } from 'react';
import api from '../../services/api';

export default function SustituirMPModal({ S, formulas, onClose, onDone }) {
  const [original, setOriginal] = useState('');
  const [sustituta, setSustituta] = useState('');
  const [preview, setPreview] = useState(null);   /* null = aún no se ha consultado */
  const [cargando, setCargando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [err, setErr] = useState('');
  const [mpsInv, setMpsInv] = useState([]);

  /* Las MPs que SE PUEDEN sustituir salen de las fórmulas cargadas, con en
     cuántas aparece cada una: es el dato que hace falta para decidir. */
  const usadas = useMemo(() => {
    const cuenta = new Map();
    Object.values(formulas || {}).forEach(fm => {
      const vistos = new Set();
      (fm?.ingredientes || []).forEach(ing => {
        const n = String(ing?.nombre || '').trim();
        if (!n || vistos.has(n.toUpperCase())) return;
        vistos.add(n.toUpperCase());
        cuenta.set(n, (cuenta.get(n) || 0) + 1);
      });
    });
    return [...cuenta.entries()].map(([nombre, n]) => ({ nombre, n }))
      .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
  }, [formulas]);

  /* La sustituta se elige del inventario: una receta no debe acabar pidiendo
     una materia prima que no existe. Si el inventario no carga, se permite
     escribir libre — más vale eso que un botón muerto. */
  useEffect(() => {
    api.getInventario?.()
      .then(r => setMpsInv(Object.keys(r?.data?.mp || r?.mp || {}).sort((a, b) => a.localeCompare(b, 'es'))))
      .catch(() => setMpsInv([]));
  }, []);

  /* Cambiar cualquiera de las dos invalida la vista previa: lo que se vio ya
     no corresponde a lo que se va a aplicar. */
  const cambiar = (set) => (v) => { set(v); setPreview(null); setErr(''); };

  const verPreview = async () => {
    setErr(''); setCargando(true); setPreview(null);
    try {
      const r = await api.sustituirMpEnFormulas(original.trim(), sustituta.trim(), false);
      setPreview(r?.data || r);
    } catch (e) {
      setErr(e?.data?.error || e.message || 'No se pudo calcular la vista previa');
    }
    setCargando(false);
  };

  const aplicar = async () => {
    setErr(''); setAplicando(true);
    try {
      const r = await api.sustituirMpEnFormulas(original.trim(), sustituta.trim(), true);
      const d = r?.data || r;
      onDone && onDone(`${original.trim()} → ${sustituta.trim()}: ${d.total} ${d.total === 1 ? 'fórmula' : 'fórmulas'} actualizadas${d.fusiones ? ` (${d.fusiones} con renglones fusionados)` : ''}`);
      onClose && onClose();
    } catch (e) {
      setErr(e?.data?.error || e.message || 'No se pudo sustituir');
      setAplicando(false);
    }
  };

  const listo = original.trim() && sustituta.trim()
    && original.trim().toUpperCase() !== sustituta.trim().toUpperCase();
  const num = (v) => (Number(v) || 0).toLocaleString('es-MX', { maximumFractionDigits: 3 });

  return (
    <div style={S.overlay} data-id="formulas.sustituir.modal">
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Sustituir materia prima en las fórmulas</div>
          <button style={S.btnSecondary} onClick={onClose} disabled={aplicando}>Cerrar</button>
        </div>

        <div style={S.modalBody}>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--lp-bg-sunken)', fontSize: 12.5, color: 'var(--lp-text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
            Cambia la materia prima en <strong>todas</strong> las fórmulas que la usan.
            La original <strong>no se elimina</strong>: se queda en el inventario con su
            existencia y su historial. Si una fórmula ya usa las dos, los kilos se
            <strong> suman en un solo renglón</strong>.
          </div>

          <label style={S.fieldLabel}>Materia prima a reemplazar</label>
          <select style={S.fieldInput} value={original} data-id="formulas.sustituir.original"
            onChange={e => cambiar(setOriginal)(e.target.value)} disabled={aplicando}>
            <option value="">Elige una de las {usadas.length} que usan las fórmulas…</option>
            {usadas.map(u => (
              <option key={u.nombre} value={u.nombre}>{u.nombre} — en {u.n} {u.n === 1 ? 'fórmula' : 'fórmulas'}</option>
            ))}
          </select>

          <label style={S.fieldLabel}>Materia prima que la sustituye</label>
          <input style={S.fieldInput} type="text" list="mps-sustitutas" value={sustituta}
            data-id="formulas.sustituir.sustituta" placeholder="Busca en el inventario…"
            onChange={e => cambiar(setSustituta)(e.target.value)} disabled={aplicando} />
          <datalist id="mps-sustitutas">
            {mpsInv.filter(m => m !== original).map(m => <option key={m} value={m} />)}
          </datalist>

          {err && (
            <div data-id="formulas.sustituir.error" style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--lp-danger-100)', color: 'var(--lp-danger-600)', fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{err}</div>
          )}

          {preview && (
            <div data-id="formulas.sustituir.preview">
              {preview.total === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)' }}>
                  Ninguna fórmula usa <strong>{preview.mpOriginal}</strong>. No hay nada que cambiar.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
                    Cambiarían {preview.total} {preview.total === 1 ? 'fórmula' : 'fórmulas'}
                    {preview.fusiones > 0 && <span style={{ color: 'var(--lp-warning-700)' }}> · {preview.fusiones} con renglones que se fusionan</span>}
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--lp-border-subtle)', borderRadius: 8 }}>
                    {preview.cambios.map(c => (
                      <div key={c.formula} data-id="formulas.sustituir.cambio"
                        style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '7px 10px', borderBottom: '1px solid var(--lp-bg-sunken)', fontSize: 12 }}>
                        <span style={{ fontWeight: 600, minWidth: 0 }}>{c.formula}</span>
                        <span style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-secondary)', whiteSpace: 'nowrap' }}>
                          {c.fusion
                            ? <>{num(c.antes)} + {num(c.yaTenia)} → <strong style={{ color: 'var(--lp-warning-700)' }}>{num(c.despues)}</strong> kg</>
                            : <>{num(c.despues)} kg</>}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose} disabled={aplicando}>Cancelar</button>
          {!preview || preview.total === 0 ? (
            <button style={{ ...S.btnPrimary, opacity: listo && !cargando ? 1 : .5 }} data-id="formulas.sustituir.ver"
              onClick={verPreview} disabled={!listo || cargando}>
              {cargando ? 'Calculando…' : 'Ver qué cambia'}
            </button>
          ) : (
            <button style={{ ...S.btnPrimary, opacity: aplicando ? .5 : 1 }} data-id="formulas.sustituir.aplicar"
              onClick={aplicar} disabled={aplicando}>
              {aplicando ? 'Sustituyendo…' : `Sustituir en ${preview.total} ${preview.total === 1 ? 'fórmula' : 'fórmulas'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
