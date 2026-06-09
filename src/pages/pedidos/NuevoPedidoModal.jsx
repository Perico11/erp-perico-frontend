import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useConfirm from '../../hooks/useConfirm';
import humanizeError from '../../utils/humanizeError';

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(26,24,21,.5)',
    zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    fontFamily: 'var(--lp-font-sans)',
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius-lg, 14px)',
    maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto',
    boxShadow: '0 12px 40px rgba(26,24,21,.2)',
  },
  header: {
    padding: '14px 18px', borderBottom: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)' },
  body: { padding: 18 },
  field: { marginBottom: 12 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' },
  input: {
    width: '100%', padding: '9px 12px', fontSize: 14,
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-sm)',
    background: 'var(--lp-bg-base)', color: 'var(--lp-text-primary)',
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
  footer: {
    padding: '12px 18px', borderTop: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', gap: 10, justifyContent: 'flex-end',
  },
  btn: (primary) => ({
    padding: '9px 16px', fontSize: 13, fontWeight: 600,
    background: primary ? 'var(--lp-brand-600)' : 'var(--lp-bg-base)',
    color: primary ? '#fff' : 'var(--lp-text-primary)',
    border: '1.5px solid ' + (primary ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'),
    borderRadius: 'var(--lp-radius-sm)', cursor: primary ? 'pointer' : 'pointer',
    fontFamily: 'inherit',
  }),
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 12 },
  pruebaBox: (active) => ({
    padding: '10px 12px', borderRadius: 'var(--lp-radius-sm)',
    background: active ? 'var(--lp-warning-50)' : 'var(--lp-bg-sunken)',
    border: '1.5px solid ' + (active ? 'var(--lp-warning-500)' : 'var(--lp-border-subtle)'),
    fontSize: 12, marginTop: 8, color: active ? 'var(--lp-warning-700)' : 'var(--lp-text-secondary)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
  }),
};

export default function NuevoPedidoModal({ onClose, onCreated, prefillProducto = null }) {
  const { user } = useAuth();
  /* Si llega prefillProducto (desde Inventario → "Pedir reposición"), inicializa el campo */
  const [producto, setProducto] = useState(prefillProducto || '');
  const [cantidad, setCantidad] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [esPrueba, setEsPrueba] = useState(false);
  const [formulas, setFormulas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, ConfirmEl] = useConfirm();

  useEffect(() => {
    /* BUG FIX: el endpoint /api/formulas/summary devuelve {ok, data:{summary:[...]}}
       no {ok, data:[...]}. La versión anterior leía r.data y obtenía un objeto
       {summary:[]}, que Array.isArray detectaba como false → setFormulas([]).
       Adicionalmente, el rol 'almacen' (Josué) NO tiene permiso para /api/formulas
       (fallback antiguo) → recibía 403 silencioso y se quedaba con lista vacía.
       Ahora: parse robusto desde múltiples shapes posibles, sin fallback 403. */
    api.getFormulasSummary?.().then(r => {
      /* Shapes posibles:
         - {ok, data:{summary:[{nombre,...}, ...]}}  ← shape actual del backend
         - {data:[...]}                              ← shape antiguo
         - {summary:[...]}                           ← directo
         - [...]                                     ← raw array
      */
      let list = [];
      if (r?.data?.summary && Array.isArray(r.data.summary)) list = r.data.summary;
      else if (r?.summary && Array.isArray(r.summary)) list = r.summary;
      else if (Array.isArray(r?.data)) list = r.data;
      else if (Array.isArray(r)) list = r;
      setFormulas(list);
    }).catch(err => {
      console.warn('[NuevoPedido] Error cargando fórmulas:', err?.message);
      setFormulas([]);
    });
  }, []);

  const handleSave = async () => {
    if (!producto.trim()) return setErr('Selecciona el producto');
    const cant = parseInt(cantidad);
    if (!cant || cant < 1) return setErr('Cantidad debe ser un número mayor a 0');
    if (!solicitante.trim()) return setErr('Indica el solicitante');

    /* Sprint G-4: useConfirm en lugar de window.confirm nativo.
       El confirm() nativo era silently dismissed en PWA standalone iOS — el
       pedido se creaba como REAL aunque el usuario quisiera PRUEBA. */
    if (esPrueba) {
      const ok = await confirm(
        'Modo PRUEBA activado. NO descuenta materia prima, NO suma producto terminado, el lote queda marcado como prueba.',
        { title: 'Confirmar modo prueba', confirmText: 'Activar prueba', danger: false }
      );
      if (!ok) return;
    }

    setSaving(true);
    setErr('');
    try {
      const id = 'PA-' + Date.now().toString(36).toUpperCase();
      const pedido = {
        id,
        producto: producto.trim(),
        cantidad: cant,
        solicitante: solicitante.trim(),
        esPrueba,
        estado: 'pendiente',
        fecha: new Date().toISOString(),
        creadoPor: user?.nombre || 'Usuario',
      };
      await api.upsertPedido(pedido);
      onCreated?.();
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      {ConfirmEl}
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <div style={S.title}>Nuevo pedido</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lp-text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }} aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={S.body}>
          {err && <div style={S.err}>{err}</div>}

          <div style={S.field}>
            <label style={S.label}>Producto *</label>
            <input
              style={S.input}
              list="formulas-list"
              value={producto}
              onChange={(e) => setProducto(e.target.value)}
              placeholder="Buscar fórmula…"
              autoFocus
            />
            <datalist id="formulas-list">
              {formulas.map((f, i) => <option key={i} value={f.nombre || f} />)}
            </datalist>
          </div>

          <div style={S.field}>
            <label style={S.label}>Cantidad (cubetas) *</label>
            <input
              style={S.input}
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Solicitante *</label>
            <input
              style={S.input}
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              placeholder="Cliente, sucursal, persona…"
            />
          </div>

          <div style={S.pruebaBox(esPrueba)} onClick={() => setEsPrueba(p => !p)}>
            <input
              type="checkbox"
              checked={esPrueba}
              onChange={(e) => setEsPrueba(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>
              <strong>Modo prueba</strong> — no descuenta MP ni suma PT
            </span>
          </div>
        </div>
        <div style={S.footer}>
          <button style={S.btn(false)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btn(true)} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Crear pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
