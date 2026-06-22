/* AgregarPTModal — Cargar inventario inicial de Producto Terminado.
   Para PT que YA estaba en almacén ANTES de empezar a usar el ERP.

   Dos modos:
   - Individual: selecciona 1 producto + qty + min
   - Masivo: pega líneas tipo "NOMBRE,cantidad,min" (1 por línea) y se carga todo.

   Permisos en backend: admin + inventario + almacen (NO recolectores). */
import { useState, useMemo, useEffect } from 'react';
import api from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(15, 12, 8, 0.6)',
    backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', color: '#1A1815',
    borderRadius: 12, width: '100%', maxWidth: 560,
    maxHeight: 'calc(100vh - 32px)', maxBlockSize: 'calc(var(--pp-vvh, 100dvh) - 32px)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,.35)',
    colorScheme: 'light',
  },
  header: {
    background: 'var(--lp-brand-700)', color: '#fff',
    padding: '14px 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 15, fontWeight: 700, margin: 0 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 6, border: 'none',
    background: 'rgba(255,255,255,.15)', color: '#fff',
    fontSize: 18, lineHeight: 1, cursor: 'pointer',
  },
  body: {
    padding: '18px 20px', overflowY: 'auto', flex: 1,
    background: 'var(--lp-bg-raised)', color: '#1A1815',
  },
  footer: {
    padding: '12px 20px', borderTop: '1px solid #E5E1DA',
    display: 'flex', gap: 8, justifyContent: 'flex-end',
    background: '#FAFAF8',
  },
  tabBar: {
    display: 'flex', gap: 6, marginBottom: 16,
    borderBottom: '2px solid #E5E1DA',
  },
  tabBtn: (active) => ({
    padding: '8px 14px', fontSize: 13, fontWeight: 700,
    background: 'none', border: 'none', cursor: 'pointer',
    color: active ? 'var(--lp-brand-700)' : '#6B6560',
    borderBottom: active ? '3px solid var(--lp-brand-600)' : '3px solid transparent',
    marginBottom: -2,
  }),
  label: {
    display: 'block', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.04em',
    color: '#5A5550', marginBottom: 6, marginTop: 12,
  },
  input: {
    width: '100%', padding: '12px 14px', fontSize: 16,
    border: '1.5px solid #E5E1DA', borderRadius: 8,
    background: 'var(--lp-bg-raised)', color: '#1A1815',
    boxSizing: 'border-box', outline: 'none',
    colorScheme: 'light', fontFamily: 'inherit',
  },
  inputSm: {
    width: '100%', padding: '10px 12px', fontSize: 14,
    border: '1.5px solid #E5E1DA', borderRadius: 6,
    background: 'var(--lp-bg-raised)', color: '#1A1815',
    boxSizing: 'border-box', outline: 'none',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  textarea: {
    width: '100%', padding: '10px 12px', fontSize: 13,
    border: '1.5px solid #E5E1DA', borderRadius: 8,
    background: 'var(--lp-bg-raised)', color: '#1A1815',
    minHeight: 140, resize: 'vertical', boxSizing: 'border-box',
    outline: 'none', fontFamily: 'monospace',
  },
  btn: (primary) => ({
    padding: '10px 18px', fontSize: 13, fontWeight: 700,
    border: primary ? 'none' : '1.5px solid #E5E1DA',
    borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
    background: primary ? 'var(--lp-brand-600)' : '#FAFAF8',
    color: primary ? '#fff' : '#5A5550',
  }),
  hint: {
    fontSize: 12, color: '#6B6560', marginTop: 6, lineHeight: 1.5,
  },
  alertOK: {
    background: '#D1FAE5', color: '#065F46',
    padding: '10px 12px', borderRadius: 6, fontSize: 12, marginTop: 12,
  },
  alertErr: {
    background: '#FEE2E2', color: '#991B1B',
    padding: '10px 12px', borderRadius: 6, fontSize: 12, marginTop: 12,
  },
};

export default function AgregarPTModal({ onClose, onSaved }) {
  /* MÓVIL: bloquea el scroll del FONDO y publica --pp-vvh (alto visible real que
     sigue al teclado) que el dialog usa en su maxHeight. El componente solo se
     monta cuando está abierto → siempre activo. */
  useBodyScrollLock(true);

  const [tab, setTab] = useState('individual');

  /* Cargar lista de productos del summary para autocompletar */
  const [productos, setProductos] = useState([]);
  useEffect(() => {
    let alive = true;
    api.getFormulasSummary().then(r => {
      if (!alive) return;
      const sum = r?.data?.summary || r?.data || [];
      setProductos(sum.map(s => s.nombre).filter(Boolean).sort());
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  /* Modo individual */
  const [producto, setProducto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [min, setMin] = useState('');
  const [nota, setNota] = useState('');

  /* Modo masivo */
  const [bulkText, setBulkText] = useState('');
  const bulkParsed = useMemo(() => {
    const lineas = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const items = [];
    const errores = [];
    lineas.forEach((linea, idx) => {
      /* Acepta separadores: tab, coma, punto-coma */
      const partes = linea.split(/[\t,;]/).map(p => p.trim());
      if (partes.length < 2) {
        errores.push(`Línea ${idx + 1}: faltan campos (formato: producto,cantidad[,min])`);
        return;
      }
      const cant = parseFloat(partes[1]);
      if (isNaN(cant) || cant < 0) {
        errores.push(`Línea ${idx + 1}: cantidad inválida "${partes[1]}"`);
        return;
      }
      const m = partes[2] !== undefined ? parseFloat(partes[2]) : null;
      items.push({ producto: partes[0], cantidad: cant, min: m });
    });
    return { items, errores };
  }, [bulkText]);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); /* {ok, msg, errores} */

  const handleSaveIndividual = async () => {
    if (!producto) { setResult({ ok: false, msg: 'Selecciona un producto' }); return; }
    const cant = parseFloat(cantidad);
    if (isNaN(cant) || cant < 0) { setResult({ ok: false, msg: 'Cantidad inválida' }); return; }
    setSaving(true);
    try {
      const r = await api.ptInicial({
        producto, cantidad: cant,
        min: min !== '' ? parseFloat(min) : undefined,
        nota: nota || 'Carga inicial individual',
      });
      setResult({ ok: true, msg: `OK: ${producto} → ${cant} cubetas` });
      onSaved && onSaved();
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setResult({ ok: false, msg: 'Error: ' + (e?.data?.error || e.message) });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBulk = async () => {
    if (bulkParsed.items.length === 0) {
      setResult({ ok: false, msg: 'No hay líneas válidas' });
      return;
    }
    setSaving(true);
    try {
      const r = await api.ptInicial({
        items: bulkParsed.items,
        nota: nota || 'Carga inicial masiva',
      });
      const aplic = (r.aplicados || []).length;
      const errs = (r.errores || []).length;
      setResult({
        ok: errs === 0,
        msg: `Aplicados: ${aplic} / ${r.total || bulkParsed.items.length}` +
             (errs ? ` · Errores: ${errs}` : ''),
        errores: r.errores,
      });
      onSaved && onSaved();
      if (errs === 0) setTimeout(() => onClose(), 1800);
    } catch (e) {
      setResult({ ok: false, msg: 'Error: ' + (e?.data?.error || e.message) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h3 style={S.title}>Agregar inventario inicial PT</h3>
          <button style={S.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div style={S.body}>
          <div style={S.tabBar}>
            <button style={S.tabBtn(tab === 'individual')} onClick={() => setTab('individual')}>
              Un producto
            </button>
            <button style={S.tabBtn(tab === 'masivo')} onClick={() => setTab('masivo')}>
              Carga masiva (Excel)
            </button>
          </div>

          {tab === 'individual' && (
            <>
              <label style={S.label}>Producto</label>
              <input
                style={S.input}
                list="productos-pt"
                value={producto}
                onChange={e => setProducto(e.target.value)}
                placeholder="Escribe o selecciona..."
                autoComplete="off"
              />
              <datalist id="productos-pt">
                {productos.map(p => <option key={p} value={p} />)}
              </datalist>
              <div style={S.hint}>
                {productos.length} productos disponibles del catálogo del sistema.
                También puedes escribir un nombre nuevo si es un producto no listado.
              </div>

              <div style={S.row2}>
                <div>
                  <label style={S.label}>Cantidad (cubetas)</label>
                  <input
                    style={S.inputSm}
                    type="number" inputMode="decimal" step="0.1" min="0"
                    value={cantidad}
                    onChange={e => setCantidad(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label style={S.label}>Mínimo (opcional)</label>
                  <input
                    style={S.inputSm}
                    type="number" inputMode="decimal" step="1" min="0"
                    value={min}
                    onChange={e => setMin(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <label style={S.label}>Nota (opcional)</label>
              <input
                style={S.inputSm}
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Ej: Conteo físico 23 mayo / Inv inicial al instalar ERP"
              />
            </>
          )}

          {tab === 'masivo' && (
            <>
              <label style={S.label}>Pega líneas (1 producto por línea)</label>
              <textarea
                style={S.textarea}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={
                  'BLANCO MATE 4.0, 25, 10\n' +
                  'PROCAUCHO 4.0, 18, 8\n' +
                  'NEGRO MATE 4.0, 12\n' +
                  '...'
                }
              />
              <div style={S.hint}>
                Formato por línea: <strong>NombreProducto, cantidad[, minimo]</strong><br />
                Separadores aceptados: coma, tab, punto-coma.
                Puedes copiar y pegar directo desde Excel (cada fila = una línea).
                {bulkParsed.items.length > 0 && (
                  <><br /><strong style={{ color: '#059669' }}>
                    {bulkParsed.items.length} líneas válidas detectadas
                  </strong></>
                )}
                {bulkParsed.errores.length > 0 && (
                  <><br /><strong style={{ color: '#DC2626' }}>
                    {bulkParsed.errores.length} líneas con error (ver detalle al guardar)
                  </strong></>
                )}
              </div>

              <label style={S.label}>Nota global</label>
              <input
                style={S.inputSm}
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Ej: Inventario inicial del 23/05/2026"
              />
            </>
          )}

          {result && (
            <div style={result.ok ? S.alertOK : S.alertErr}>
              {result.msg}
              {result.errores && result.errores.length > 0 && (
                <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 11 }}>
                  {result.errores.slice(0, 10).map((e, i) => (
                    <li key={i}>Línea {e.idx + 1} ({e.producto || '?'}): {e.error}</li>
                  ))}
                  {result.errores.length > 10 && <li>… y {result.errores.length - 10} más</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        <div style={S.footer}>
          <button style={S.btn(false)} onClick={onClose}>Cancelar</button>
          <button
            style={S.btn(true)}
            disabled={saving}
            onClick={tab === 'individual' ? handleSaveIndividual : handleSaveBulk}
          >
            {saving ? 'Guardando...' :
             tab === 'individual' ? 'Agregar' :
             `Cargar ${bulkParsed.items.length} producto${bulkParsed.items.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
