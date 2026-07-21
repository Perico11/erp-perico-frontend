import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useConfirm from '../../hooks/useConfirm';
import useIsDesktop from '../../hooks/useIsDesktop';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import humanizeError from '../../utils/humanizeError';
import { PT_MEDIDAS, ptMedidaDef, medidaACubetas } from '../../utils/ptMedidas';

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
    zIndex: 1100, display: 'flex',
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
    /* FIX jun 2026 v3: altura contra el viewport VISIBLE real (teclado/barra
       del navegador incluidos) — con 92vh el sheet "cabía" sin overflow en
       teléfono y no había nada que scrollear. */
    maxHeight: 'calc(var(--pp-vvh, 100dvh) - 40px)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(26,24,21,.2)',
    transform: shown ? 'none' : 'translateY(24px)',
    transition: `transform .3s ${EASE}`,
  }),
  /* FIX jun 2026 v4: footer pegajoso (patrón OrdenesPage). El sheet es flex
     column con overflow oculto; solo este body scrollea, los botones quedan
     fijos abajo del fold en móvil. */
  sheetBody: { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '20px 22px 12px' },
  sheetFooter: { flexShrink: 0, padding: '12px 22px calc(14px + env(safe-area-inset-bottom, 0px))', display: 'flex', gap: 10, borderTop: '1px solid var(--lp-border-subtle)' },
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

/* AUDIT UX 16-jul (U18): clave localStorage del último solicitante usado */
const LS_ULTIMO_SOLICITANTE = 'pp_ultimo_solicitante';

export default function NuevoPedidoModal({ onClose, onCreated, prefillProducto = null, pedidos = [] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  useBodyScrollLock(); /* el body no scrollea mientras el sheet está abierto */
  /* Si llega prefillProducto (desde Inventario → "Pedir reposición"), inicializa el campo */
  const [producto, setProducto] = useState(prefillProducto || '');
  const [cantidad, setCantidad] = useState('');
  const [medida, setMedida] = useState('cubeta'); /* tote/cubeta/galón/litro/atomizador */
  /* AUDIT UX 16-jul (U18): arranca con el último solicitante usado (se teclea
     igual siempre — el operario solo lo cambia cuando pide alguien distinto). */
  const [solicitante, setSolicitante] = useState(() => {
    try { return localStorage.getItem(LS_ULTIMO_SOLICITANTE) || ''; } catch { return ''; }
  });
  const [esPrueba, setEsPrueba] = useState(false);
  const [formulas, setFormulas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, ConfirmEl] = useConfirm();
  /* P2 (21-jul-2026): "¿transferir en vez de producir?" — si el producto ya
     tiene stock en FÁBRICA, sugerir traerlo con una OT (con la línea
     prellenada) en lugar de lanzar una producción nueva. Best-effort: si el
     rol no puede leer inventario o crear OT, simplemente no aparece. */
  const [ptFabrica, setPtFabrica] = useState({});
  useEffect(() => {
    let alive = true;
    api.getInventario()
      .then(r => { if (alive) setPtFabrica((r?.data || r || {}).pt || {}); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const puedeCrearOT = ['admin', 'almacen', 'inventario'].includes(user?.rol);
  const stockFabInfo = useMemo(() => {
    const q = producto.trim().toUpperCase();
    if (!q) return null;
    const key = Object.keys(ptFabrica).find(k => k.trim().toUpperCase() === q);
    if (!key) return null;
    const fab = Number(ptFabrica[key]?.qty) || 0;
    if (fab <= 0) return null;
    const pedidasCub = cantidad && parseInt(cantidad) > 0 ? Math.round(medidaACubetas(medida, parseInt(cantidad))) : 0;
    return { key, fab, pedidasCub, cubre: pedidasCub > 0 && fab >= pedidasCub };
  }, [producto, ptFabrica, cantidad, medida]);
  /* AUDIT UX 16-jul (U18): datalist con los solicitantes de los últimos pedidos
     (máx 6 únicos, más reciente primero) — los pedidos llegan de la página padre. */
  const solicitantesRecientes = useMemo(() => {
    const vistos = [];
    [...(Array.isArray(pedidos) ? pedidos : [])]
      .sort((a, b) => new Date(b?.fecha || 0) - new Date(a?.fecha || 0))
      .forEach(p => {
        const s = String(p?.solicitante || '').trim();
        if (s && !vistos.some(v => v.toLowerCase() === s.toLowerCase())) vistos.push(s);
      });
    return vistos.slice(0, 6);
  }, [pedidos]);
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
      /* PT ocultos (jul 2026): los descontinuados no se pueden pedir */
      setFormulas(list.filter(s => !s?.oculto));
    }).catch(err => {
      console.warn('[NuevoPedido] Error cargando fórmulas:', err?.message);
      setFormulas([]);
    });
  }, []);

  const handleSave = async () => {
    if (!producto.trim()) return setErr('Selecciona el producto');
    const cantMed = parseInt(cantidad);
    if (!cantMed || cantMed < 1) return setErr('Cantidad debe ser un número mayor a 0');
    const cant = Math.round(medidaACubetas(medida, cantMed)); /* cubeta-equivalente para producción */
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
        medida,
        medidaQty: cantMed,
        solicitante: solicitante.trim(),
        esPrueba,
        estado: 'pendiente',
        fecha: new Date().toISOString(),
        creadoPor: user?.nombre || 'Usuario',
      };
      await api.upsertPedido(pedido);
      /* AUDIT UX 16-jul (U18): recordar el solicitante para el próximo pedido */
      try { localStorage.setItem(LS_ULTIMO_SOLICITANTE, solicitante.trim()); } catch { /* noop */ }
      onCreated?.();
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay(isDesktop, shown)}>
      {ConfirmEl}
      <div style={S.sheet(isDesktop, shown)} onClick={(e) => e.stopPropagation()}>
        <style>{FOCUS_CSS}</style>

        {/* Encabezado del sheet (modal-h + modal-s del mockup). La X no viene
            en el mockup pero se conserva (cierre accesible además del overlay).
            flexShrink:0 → header fijo, no scrollea (footer pegajoso v4). */}
        <div style={{ ...S.head, flexShrink: 0 }}>
          <div>
            <div style={S.title}>Nuevo pedido</div>
            <div style={S.sub}>Captura el producto y la cantidad. Quedará pendiente para producción.</div>
          </div>
          <button onClick={onClose} style={S.closeBtn} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Cuerpo scrolleable — único elemento con overflow. */}
        <div style={S.sheetBody}>
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
          /* AUDIT UX 16-jul (U14): autoFocus solo en escritorio — en móvil el
             teclado abre ANTES de pintar el sheet y tapa los botones (regla
             documentada en components/ui/Modal.jsx). */
          autoFocus={isDesktop}
        />
        <datalist id="formulas-list">
          {formulas.map((f, i) => <option key={i} value={f.nombre || f} />)}
        </datalist>

        <label style={S.label}>Medida *</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {PT_MEDIDAS.map((m) => {
            const on = medida === m.key;
            return (
              <button key={m.key} type="button" onClick={() => setMedida(m.key)}
                style={{ height: 34, padding: '0 11px', borderRadius: 999, cursor: 'pointer',
                  fontFamily: 'var(--lp-font-sans)', fontSize: 12, fontWeight: on ? 600 : 500,
                  border: on ? '1px solid transparent' : '1px solid var(--lp-border-subtle)',
                  background: on ? 'color-mix(in srgb, var(--lp-brand-600) 14%, transparent)' : 'var(--lp-bg-raised)',
                  color: on ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)', whiteSpace: 'nowrap' }}>
                {m.label}
              </button>
            );
          })}
        </div>
        <label style={S.label} htmlFor="np-qty">Cantidad ({ptMedidaDef(medida)?.label || 'unidades'}) *</label>
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
        {medida !== 'cubeta' && cantidad && parseInt(cantidad) > 0 && (
          <div style={{ marginTop: -4, marginBottom: 6, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
            = <strong>{Math.round(medidaACubetas(medida, parseInt(cantidad)))}</strong> cubetas-equivalente
          </div>
        )}

        {/* P2 (21-jul-2026): sugerencia "transferir en vez de producir" */}
        {stockFabInfo && (
          <div style={{
            marginTop: 8, padding: '10px 12px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5,
            background: 'color-mix(in srgb, var(--lp-brand-600) 10%, transparent)',
            border: '1.5px solid color-mix(in srgb, var(--lp-brand-600) 45%, transparent)',
            color: 'var(--lp-brand-700)',
          }}>
            Hay <strong>{stockFabInfo.fab.toLocaleString('es-MX')} cub</strong> de {stockFabInfo.key} en <strong>Fábrica</strong>
            {stockFabInfo.cubre
              ? ' — alcanza para este pedido: puedes traerlas con una transferencia en vez de producir.'
              : stockFabInfo.pedidasCub > 0
                ? ` (pides ${stockFabInfo.pedidasCub}) — podrías traer esas y producir solo el resto.`
                : ' — considera traerlas con una transferencia antes de producir más.'}
            {puedeCrearOT && (
              <button
                type="button"
                data-id="pedidos.btn.crear-ot-en-vez"
                onClick={() => navigate('/transferencias?nueva=' + encodeURIComponent(JSON.stringify({ tipo: 'pt', producto: stockFabInfo.key, nombre: stockFabInfo.key, unidad: 'cub' })))}
                style={{ display: 'block', marginTop: 8, padding: '7px 12px', borderRadius: 999, border: '1px solid var(--lp-brand-600)', background: 'transparent', color: 'var(--lp-brand-700)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}
              >
                Crear transferencia en su lugar →
              </button>
            )}
          </div>
        )}

        <label style={S.label} htmlFor="np-sol">Solicitante *</label>
        <input
          id="np-sol"
          className="np-finput"
          style={S.input}
          list="np-solicitantes"
          value={solicitante}
          onChange={(e) => setSolicitante(e.target.value)}
          placeholder="Cliente, sucursal, persona…"
        />
        {/* AUDIT UX 16-jul (U18): sugerencias de solicitantes recientes */}
        <datalist id="np-solicitantes">
          {solicitantesRecientes.map((s) => <option key={s} value={s} />)}
        </datalist>

        {/* AUDIT UX 16-jul (U13): el div es el ÚNICO handler del toggle — el
            input con su propio onChange duplicaba el toggle y tocar el checkbox
            exacto lo dejaba igual (doble inversión). pointerEvents:none + readOnly. */}
        <div style={S.pruebaBox(esPrueba)} onClick={() => setEsPrueba(p => !p)}>
          <input
            type="checkbox"
            checked={esPrueba}
            readOnly
            onChange={() => {}}
            style={{ cursor: 'pointer', pointerEvents: 'none' }}
          />
          <span>
            <strong>Modo prueba</strong> — no descuenta MP ni suma PT
          </span>
        </div>
        </div>{/* /sheetBody */}

        {/* Footer pegajoso — botones fijos abajo (no scrollean). */}
        <div style={S.sheetFooter}>
          <button style={S.btn(false)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btn(true)} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Crear pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
