import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useConfirm from '../../hooks/useConfirm';
import useIsDesktop from '../../hooks/useIsDesktop';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import humanizeError from '../../utils/humanizeError';

/* ═══════════════════════════════════════════════════════════════════════
   NuevoPedidoModal — reskin mockup Pedidos.html (jun 2026).

   Visual del mockup: BOTTOM-SHEET en móvil (radio 24px arriba, sube con
   transform), modal centrado en escritorio (HANDOFF §4 "Sheets/modales").
   Campos .flabel/.finput (48px, radio 12, fondo tile, focus borde verde),
   acciones Cancelar (ghost) + Crear pedido (primario) repartidas.

   LÓGICA INTACTA: validaciones, confirm de esPrueba (useConfirm — no
   window.confirm, ver Sprint G-4), id 'PA-', api.upsertPedido, datalist de
   fórmulas con parse multi-shape. Campos que el mockup OMITE y se CONSERVAN:
   Solicitante (obligatorio) y el checkbox Modo prueba.
   ═══════════════════════════════════════════════════════════════════════ */

/* :focus no se puede inline — clase mínima inyectada con el sheet */
const FOCUS_CSS = `
  .np-finput:focus{ border-color: var(--lp-brand-600) !important; outline: none; }
  .np-finput::placeholder{ color: var(--lp-text-tertiary); }
`;

const EASE = 'cubic-bezier(.22,1,.36,1)';

const S = {
  overlay: (isDesktop, shown) => ({
    position: 'fixed', inset: 0, background: 'rgba(10,16,14,.45)',
    zIndex: 100, display: 'flex',
    alignItems: isDesktop ? 'center' : 'flex-end',
    justifyContent: 'center',
    padding: isDesktop ? 20 : 0,
    fontFamily: 'var(--lp-font-sans)',
    opacity: shown ? 1 : 0,
    transition: `opacity .25s ${EASE}`,
  }),
  sheet: (isDesktop, shown) => ({
    background: 'var(--lp-bg-raised)',
    borderRadius: isDesktop ? 18 : '24px 24px 0 0',
    width: '100%',
    maxWidth: isDesktop ? 440 : 'none',
    maxHeight: '92vh', overflowY: 'auto',
    /* FIX jun 2026: el scroll del sheet no se encadena al body (scroll bleed móvil) */
    overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
    padding: '22px 22px 30px',
    boxShadow: '0 12px 40px rgba(26,24,21,.2)',
    transform: shown ? 'none' : 'translateY(24px)',
    transition: `transform .3s ${EASE}`,
  }),
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 18, fontWeight: 600, color: 'var(--lp-text-primary)', letterSpacing: '-.01em' },
  sub: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 3 },
  closeBtn: {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--lp-text-secondary)',
  },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', margin: '14px 2px 6px' },
  input: {
    width: '100%', height: 48, padding: '0 14px', fontSize: 15,
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 12,
    background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-primary)',
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
  acts: { display: 'flex', gap: 10, marginTop: 22 },
  btn: (primary) => ({
    flex: 1, minHeight: 46, padding: '0 16px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    borderRadius: 11,
    background: primary ? 'var(--lp-brand-600)' : 'transparent',
    color: primary ? '#fff' : 'var(--lp-text-secondary)',
    border: primary ? '1.5px solid var(--lp-brand-600)' : '1px solid var(--lp-border-subtle)',
  }),
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 10, fontSize: 12, marginTop: 12 },
  pruebaBox: (active) => ({
    padding: '12px 14px', borderRadius: 12,
    background: active ? 'var(--lp-warning-50)' : 'var(--lp-bg-sunken)',
    border: '1.5px solid ' + (active ? 'var(--lp-warning-500)' : 'var(--lp-border-subtle)'),
    fontSize: 12, marginTop: 14, color: active ? 'var(--lp-warning-700)' : 'var(--lp-text-secondary)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, boxSizing: 'border-box',
  }),
};

export default function NuevoPedidoModal({ onClose, onCreated, prefillProducto = null }) {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  useBodyScrollLock(); /* el body no scrollea mientras el sheet está abierto */
  /* Si llega prefillProducto (desde Inventario → "Pedir reposición"), inicializa el campo */
  const [producto, setProducto] = useState(prefillProducto || '');
  const [cantidad, setCantidad] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [esPrueba, setEsPrueba] = useState(false);
  const [formulas, setFormulas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, ConfirmEl] = useConfirm();
  /* Animación de entrada del sheet (mockup .overlay.show). prefers-reduced-motion → sin transición. */
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let reduce = false;
    try { reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { /* noop */ }
    if (reduce) { setShown(true); return undefined; }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

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
    <div style={S.overlay(isDesktop, shown)} onClick={onClose}>
      {ConfirmEl}
      <div style={S.sheet(isDesktop, shown)} onClick={(e) => e.stopPropagation()}>
        <style>{FOCUS_CSS}</style>

        {/* Encabezado del sheet (modal-h + modal-s del mockup). La X no viene
            en el mockup pero se conserva (cierre accesible además del overlay). */}
        <div style={S.head}>
          <div>
            <div style={S.title}>Nuevo pedido</div>
            <div style={S.sub}>Captura el producto y la cantidad. Quedará pendiente para producción.</div>
          </div>
          <button onClick={onClose} style={S.closeBtn} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {err && <div style={S.err}>{err}</div>}

        <label style={S.label} htmlFor="np-prod">Producto *</label>
        <input
          id="np-prod"
          className="np-finput"
          style={S.input}
          list="formulas-list"
          value={producto}
          onChange={(e) => setProducto(e.target.value)}
          placeholder="Ej. Vinílica blanca 19L"
          autoFocus
        />
        <datalist id="formulas-list">
          {formulas.map((f, i) => <option key={i} value={f.nombre || f} />)}
        </datalist>

        <label style={S.label} htmlFor="np-qty">Cantidad (cubetas) *</label>
        <input
          id="np-qty"
          className="np-finput"
          style={S.input}
          type="number"
          inputMode="numeric"
          min="1"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          placeholder="52"
        />

        <label style={S.label} htmlFor="np-sol">Solicitante *</label>
        <input
          id="np-sol"
          className="np-finput"
          style={S.input}
          value={solicitante}
          onChange={(e) => setSolicitante(e.target.value)}
          placeholder="Cliente, sucursal, persona…"
        />

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

        <div style={S.acts}>
          <button style={S.btn(false)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btn(true)} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Crear pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
