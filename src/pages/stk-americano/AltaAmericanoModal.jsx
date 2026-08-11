/* AltaAmericanoModal — Alta / edición de un COLOR del stock americano (modelo v2).
   Un color tiene 3 presentaciones: cubetas (nº), galones (nº), totes (litros a
   granel; 1000 L = 1 tote lleno). Al editar, precarga los valores (modo 'set').

   Permisos backend: admin + almacen. */
import { useState } from 'react';
import api from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import humanizeError from '../../utils/humanizeError'; /* AUDIT UX 16-jul (U4) */
import { useAuthOpcional } from '../../context/AuthContext';

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,12,8,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 32px)', maxBlockSize: 'calc(var(--pp-vvh, 100dvh) - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.35)' },
  header: { background: 'var(--lp-brand-700)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: 700, margin: 0 },
  closeBtn: { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer' },
  body: { padding: '18px 20px', overflowY: 'auto', flex: 1 },
  footer: { padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--lp-bg-sunken)' },
  label: { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)', marginBottom: 6, marginTop: 12 },
  input: { width: '100%', padding: '12px 14px', fontSize: 16, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
  inputSm: { width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', boxSizing: 'border-box', outline: 'none' },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  btn: (primary) => ({ padding: '10px 18px', fontSize: 13, fontWeight: 700, border: primary ? 'none' : '1.5px solid var(--lp-border-subtle)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: primary ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)', color: primary ? '#fff' : 'var(--lp-text-secondary)' }),
  hint: { fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 6, lineHeight: 1.5 },
  alertErr: { background: 'var(--lp-danger-50, #FEE2E2)', color: 'var(--lp-danger-700, #991B1B)', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginTop: 12 },
};

export default function AltaAmericanoModal({ catalogo = [], color = null, almacen = '1', onClose, onSaved }) {
  useBodyScrollLock(true);
  const editando = !!color;
  /* Renombrar un color al editar = SOLO Emmanuel (decisión dueño 11-ago tras
     revertir el renombre masivo: la identidad del producto la dicta él, color
     por color). El backend lo vuelve a validar — esto solo habilita el campo. */
  const auth = useAuthOpcional();
  const puedeRenombrar = editando && auth?.user?.rol === 'admin'
    && String(auth?.user?.nombre || '').trim().toLowerCase() === 'emmanuel';

  const [nombre, setNombre] = useState(color?.nombre || '');
  const [cubetas, setCubetas] = useState(color ? String(color.cubetas ?? 0) : '');
  const [galones, setGalones] = useState(color ? String(color.galones ?? 0) : '');
  const [totesLitros, setTotesLitros] = useState(color ? String(color.totesLitros ?? 0) : '');
  const [proveedor, setProveedor] = useState(color?.proveedor || '');
  const [costoLitro, setCostoLitro] = useState(color?.costoLitro != null ? String(color.costoLitro) : '');
  const [nota, setNota] = useState(color?.nota || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  /* Folios de tote asignados por el backend al guardar el alta (11-ago): se
     muestran en esta misma ventana, solo lectura — el sistema los emite y no
     se repiten jamás. */
  const [lotesAsignados, setLotesAsignados] = useState(null);

  const numOrUndef = (v) => (v === '' ? undefined : (Number.isFinite(parseFloat(v)) ? parseFloat(v) : undefined));

  const nombreCambiado = editando && nombre.trim() !== String(color?.nombre || '').trim();

  const handleSave = async () => {
    if (!nombre.trim()) { setErr('Escribe el nombre del color'); return; }
    setSaving(true); setErr('');
    try {
      /* Renombre manual (solo Emmanuel): primero se sustituye el nombre — el
         viejo queda como alias y las importaciones no re-crean el duplicado —
         y después se guardan las cantidades sobre la clave nueva. */
      if (puedeRenombrar && nombreCambiado) {
        await api.renombrarStkAmericano({ almacen, key: color.key, nuevoNombre: nombre.trim() });
      }
      /* Alta = SUMAR (11-ago, pedido dueño): un tote que llega se agrega al
         stock existente del color. 'set' queda solo para Editar (corrección). */
      const r = await api.colorStkAmericano({
        almacen,
        nombre: nombre.trim(),
        cubetas: numOrUndef(cubetas), galones: numOrUndef(galones), totesLitros: numOrUndef(totesLitros),
        proveedor: proveedor.trim() || undefined,
        costoLitro: costoLitro !== '' ? parseFloat(costoLitro) : undefined,
        nota: nota.trim() || undefined,
        modo: editando ? 'set' : 'sumar',
      });
      onSaved && onSaved();
      if (!editando && Array.isArray(r?.lotes) && r.lotes.length) {
        setLotesAsignados(r.lotes); setSaving(false);   /* la ventana se queda mostrando el folio */
      } else {
        onClose();
      }
    } catch (e) { setErr(humanizeError(e)); setSaving(false); } /* AUDIT UX 16-jul (U4) */
  };

  /* Pantalla de confirmación: el/los folios del tote recién dado de alta. */
  if (lotesAsignados) {
    return (
      <div style={S.overlay}>
        <div style={S.modal} onClick={e => e.stopPropagation()}>
          <div style={S.header}>
            <h3 style={S.title}>Color agregado — lote asignado</h3>
            <button style={S.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
          </div>
          <div style={S.body}>
            <div style={{ fontSize: 13, color: 'var(--lp-text-secondary)', lineHeight: 1.5 }}>
              {nombre.trim()} quedó registrado. {lotesAsignados.length === 1 ? 'Su tote recibió este folio' : `Sus ${lotesAsignados.length} totes recibieron estos folios`} (asignado por el sistema — no se puede modificar ni se repetirá):
            </div>
            {lotesAsignados.map(l => (
              <div key={l} data-id="stkAmericano.color.loteAsignado" style={{ marginTop: 10, padding: '14px 16px', borderRadius: 8, background: 'var(--lp-bg-sunken)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, letterSpacing: '.03em', textAlign: 'center' }}>
                {l}
              </div>
            ))}
            <div style={S.hint}>Anótalo o imprime su etiqueta desde "Etiquetas totes" — con él se elige el tote al envasar.</div>
          </div>
          <div style={S.footer}>
            <button style={S.btn(true)} onClick={onClose} data-id="stkAmericano.color.loteListo">Listo</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h3 style={S.title}>{editando ? 'Editar color' : 'Agregar color americano'}</h3>
          <button style={S.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.body}>
          <label style={S.label}>Color / producto</label>
          <input style={{ ...S.input, ...(editando && !puedeRenombrar ? { opacity: .7 } : {}) }} list="stk-am-catalogo" value={nombre}
            disabled={editando && !puedeRenombrar} data-id="stkAmericano.color.nombre"
            onChange={e => setNombre(e.target.value)} placeholder="Escribe o selecciona un color..." autoComplete="off" />
          <datalist id="stk-am-catalogo">{catalogo.map(c => <option key={c} value={c} />)}</datalist>
          {!editando && <div style={S.hint}>{catalogo.length} color(es) registrados. Si ya existe, lo que captures se SUMA a su stock (para corregir cantidades usa Editar).</div>}
          {puedeRenombrar && !nombreCambiado && <div style={S.hint}>Puedes corregir el nombre del color (solo tú). El nombre anterior queda como alias: importar con el nombre viejo cae aquí, sin duplicar.</div>}
          {puedeRenombrar && nombreCambiado && (
            <div style={{ ...S.hint, color: 'var(--lp-warning-700, #92400E)' }}>
              Al guardar, "{color?.nombre}" pasará a llamarse "{nombre.trim()}" en este almacén. Folios de totes y tandas no cambian; el nombre viejo queda como alias.
            </div>
          )}

          <div style={S.row3}>
            <div>
              <label style={S.label}>Cubetas</label>
              <input style={S.inputSm} type="number" inputMode="numeric" step="1" min="0" value={cubetas} onChange={e => setCubetas(e.target.value)} placeholder="0" data-id="stkAmericano.color.cubetas" />
            </div>
            <div>
              <label style={S.label}>Galones</label>
              <input style={S.inputSm} type="number" inputMode="numeric" step="1" min="0" value={galones} onChange={e => setGalones(e.target.value)} placeholder="0" data-id="stkAmericano.color.galones" />
            </div>
            <div>
              <label style={S.label}>Litros (totes)</label>
              <input style={S.inputSm} type="number" inputMode="decimal" step="1" min="0" value={totesLitros} onChange={e => setTotesLitros(e.target.value)} placeholder="0" data-id="stkAmericano.color.litros" />
            </div>
          </div>
          <div style={S.hint}>Litros a granel en totes (1000 L = 1 tote lleno; ej. 650 = tote al 65%, 4000 = 4 totes).</div>

          <div style={S.row2}>
            <div>
              <label style={S.label}>Proveedor (opcional)</label>
              <input style={S.inputSm} value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Ej: GDB" />
            </div>
            <div>
              <label style={S.label}>Costo por litro (opcional)</label>
              <input style={S.inputSm} type="number" inputMode="decimal" step="0.01" min="0" value={costoLitro} onChange={e => setCostoLitro(e.target.value)} placeholder="MXN/L" />
            </div>
          </div>

          <label style={S.label}>Nota (opcional)</label>
          <input style={S.inputSm} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: llegó 14/jul" />

          {err && <div style={S.alertErr}>{err}</div>}
        </div>
        <div style={S.footer}>
          <button style={S.btn(false)} onClick={onClose}>Cancelar</button>
          <button style={S.btn(true)} disabled={saving} onClick={handleSave} data-id="stkAmericano.color.guardar">
            {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar color'}
          </button>
        </div>
      </div>
    </div>
  );
}
