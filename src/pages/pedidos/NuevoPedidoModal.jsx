import { useState, useEffect, useMemo, useRef } from 'react';
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

   MULTI-PRODUCTO v2 (28-jul-2026, iteración con el dueño): la sucursal pide
   varios colores de un jalón. La v1 apilaba N formularios completos — el dueño
   pidió el patrón carrito: capturas UN producto, lo GUARDAS con su botón
   ("Agregar a la lista") y queda como renglón compacto arriba mientras capturas
   el siguiente. Menos alto, menos scroll, y el error de validación ya no queda
   fuera de vista (se pinta pegado al footer y se auto-scrollea).

   Al guardar se crea UN PEDIDO POR RENGLÓN — el modelo no cambia: producción
   sigue trabajando por fórmula/bacha, así que un "pedido multi-producto" real
   no existe aguas abajo; lo multi es la CAPTURA. Ids 'PA-<ts+i>' (mismo
   esquema, sin colisión dentro del lote). Si un upsert falla a media tanda,
   los ya creados se quitan de la lista y el error dice cuáles entraron —
   reintentar solo crea los que faltan, sin duplicar.

   LÓGICA INTACTA: validaciones, confirm de esPrueba (useConfirm — no
   window.confirm, ver Sprint G-4), api.upsertPedido, datalist de fórmulas
   con parse multi-shape. Campos que el mockup OMITE y se CONSERVAN:
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
    maxWidth: isDesktop ? 460 : 'none',
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
  /* Renglón GUARDADO: compacto, editable con tap. */
  fila: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)', marginTop: 8 },
  filaCheck: { flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'color-mix(in srgb, var(--lp-brand-600) 15%, transparent)', color: 'var(--lp-brand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  filaNombre: { fontSize: 13.5, fontWeight: 600, color: 'var(--lp-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  filaDetalle: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 1 },
  filaQuitar: { flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--lp-danger-600)', fontSize: 17, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  /* Botón "guardar producto y capturar el siguiente" */
  addBtn: {
    width: '100%', marginTop: 12, minHeight: 46, padding: '10px 14px',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: '1.5px solid var(--lp-brand-600)', borderRadius: 12,
    background: 'color-mix(in srgb, var(--lp-brand-600) 10%, transparent)',
    color: 'var(--lp-brand-700)',
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
  /* El error vive pegado ABAJO del cuerpo (junto al footer, donde está el dedo
     al tocar "Crear pedido") y además se auto-scrollea a la vista — en la v1
     se pintaba hasta ARRIBA del sheet y con el formulario largo quedaba fuera
     de pantalla: tocabas crear y "no pasaba nada". */
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

const EDITOR_VACIO = { producto: '', medida: 'cubeta', cantidad: '' };

/* Resumen "52 cubetas" / "24 galones (= 5 cub)" para el renglón guardado. */
function resumenLinea(l) {
  const n = parseInt(l.cantidad);
  const def = ptMedidaDef(l.medida);
  const nombreMed = (def?.label || l.medida || '').toLowerCase();
  let s = `${n} ${nombreMed}${n === 1 ? '' : nombreMed.endsWith('n') ? 'es' : 's'}`;
  if (l.medida !== 'cubeta') s += ` (= ${Math.round(medidaACubetas(l.medida, n))} cub)`;
  return s;
}

export default function NuevoPedidoModal({ onClose, onCreated, prefillProducto = null, pedidos = [] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  useBodyScrollLock(); /* el body no scrollea mientras el sheet está abierto */
  /* Patrón carrito: `guardados` = renglones ya confirmados (compactos);
     `editor` = el producto que se está capturando ahora mismo. Si llega
     prefillProducto (desde Inventario → "Pedir reposición"), inicia el editor. */
  const [guardados, setGuardados] = useState([]);
  const [editor, setEditor] = useState({ ...EDITOR_VACIO, producto: prefillProducto || '' });
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
  const errRef = useRef(null);
  const prodInputRef = useRef(null);

  /* El error siempre A LA VISTA: al aparecer, scrollear hasta él. */
  useEffect(() => {
    if (err && errRef.current) {
      try { errRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* noop */ }
    }
  }, [err]);

  const setEd = (campo, valor) => setEditor(prev => ({ ...prev, [campo]: valor }));

  const editorTieneAlgo = !!(editor.producto.trim() || String(editor.cantidad).trim());
  const validarEditor = () => {
    if (!editor.producto.trim()) return 'Selecciona el producto';
    const c = parseInt(editor.cantidad);
    if (!c || c < 1) return `${editor.producto.trim()}: cantidad debe ser un número mayor a 0`;
    return null;
  };

  /* "Agregar a la lista": guarda el producto del editor como renglón compacto
     y deja el editor limpio para capturar el siguiente. */
  const guardarProducto = () => {
    const e = validarEditor();
    if (e) { setErr(e); return; }
    setGuardados(prev => [...prev, { producto: editor.producto.trim(), medida: editor.medida, cantidad: parseInt(editor.cantidad) }]);
    setEditor({ ...EDITOR_VACIO });
    setErr('');
    try { prodInputRef.current?.focus(); } catch { /* noop */ }
  };
  const quitarGuardado = (idx) => setGuardados(prev => prev.filter((_, i) => i !== idx));
  /* Tap en un renglón guardado → vuelve al editor para corregirlo. Solo si el
     editor está libre; si hay una captura a medias, primero se resuelve esa. */
  const editarGuardado = (idx) => {
    if (editorTieneAlgo) { setErr('Guarda o limpia el producto que estás capturando antes de editar otro.'); return; }
    const l = guardados[idx];
    setGuardados(prev => prev.filter((_, i) => i !== idx));
    setEditor({ producto: l.producto, medida: l.medida, cantidad: String(l.cantidad) });
    setErr('');
    try { prodInputRef.current?.focus(); } catch { /* noop */ }
  };

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
    const q = editor.producto.trim().toUpperCase();
    if (!q) return null;
    const key = Object.keys(ptFabrica).find(k => k.trim().toUpperCase() === q);
    if (!key) return null;
    const fab = Number(ptFabrica[key]?.qty) || 0;
    if (fab <= 0) return null;
    const pedidasCub = editor.cantidad && parseInt(editor.cantidad) > 0 ? Math.round(medidaACubetas(editor.medida, parseInt(editor.cantidad))) : 0;
    return { key, fab, pedidasCub, cubre: pedidasCub > 0 && fab >= pedidasCub };
  }, [editor.producto, editor.cantidad, editor.medida, ptFabrica]);
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
    /* Lista final = renglones guardados + lo que quede en el editor (si el
       operario capturó el último producto y tocó directo "Crear pedido" sin
       pasar por "Agregar a la lista", ese también cuenta — no se pierde). */
    const finales = [...guardados];
    if (editorTieneAlgo) {
      const e = validarEditor();
      if (e) return setErr(e);
      finales.push({ producto: editor.producto.trim(), medida: editor.medida, cantidad: parseInt(editor.cantidad) });
    }
    if (finales.length === 0) return setErr('Captura al menos un producto');
    if (!solicitante.trim()) return setErr('Indica el solicitante');

    /* Sprint G-4: useConfirm en lugar de window.confirm nativo.
       El confirm() nativo era silently dismissed en PWA standalone iOS — el
       pedido se creaba como REAL aunque el usuario quisiera PRUEBA. */
    if (esPrueba) {
      const ok = await confirm(
        'Modo PRUEBA activado. NO descuenta materia prima, NO suma producto terminado, ' +
        (finales.length > 1 ? `los ${finales.length} pedidos quedan marcados como prueba.` : 'el lote queda marcado como prueba.'),
        { title: 'Confirmar modo prueba', confirmText: 'Activar prueba', danger: false }
      );
      if (!ok) return;
    }

    setSaving(true);
    setErr('');
    /* UN pedido por renglón, secuencial (el backend serializa con mutex y
       notifica al técnico por cada uno). Si uno falla a la mitad, los ya
       creados se QUITAN de la lista y el error dice cuáles entraron —
       reintentar solo crea los que faltan, sin duplicar. */
    let creados = 0;
    try {
      const base = Date.now();
      for (let i = 0; i < finales.length; i++) {
        const l = finales[i];
        const pedido = {
          id: 'PA-' + (base + i).toString(36).toUpperCase(),
          producto: l.producto,
          cantidad: Math.round(medidaACubetas(l.medida, l.cantidad)), /* cubeta-equivalente para producción */
          medida: l.medida,
          medidaQty: l.cantidad,
          solicitante: solicitante.trim(),
          esPrueba,
          estado: 'pendiente',
          fecha: new Date().toISOString(),
          creadoPor: user?.nombre || 'Usuario',
        };
        await api.upsertPedido(pedido);
        creados = i + 1;
      }
      /* AUDIT UX 16-jul (U18): recordar el solicitante para el próximo pedido */
      try { localStorage.setItem(LS_ULTIMO_SOLICITANTE, solicitante.trim()); } catch { /* noop */ }
      /* Los pedidos prueba viven en la pestaña "Pruebas" (bucket aparte) — el
         padre usa este flag para brincar a esa pestaña y que el operario VEA
         lo que acaba de crear (si no, "no pasó nada" a simple vista). */
      onCreated?.(esPrueba);
    } catch (e) {
      if (creados > 0) {
        const hechos = finales.slice(0, creados).map(l => l.producto);
        setGuardados(finales.slice(creados));
        setEditor({ ...EDITOR_VACIO });
        setErr(`Se crearon ${creados}: ${hechos.join(', ')}. El siguiente falló: ${humanizeError(e)} — vuelve a guardar (solo se crean los que faltan).`);
      } else {
        setErr(humanizeError(e));
      }
    } finally {
      setSaving(false);
    }
  };

  const numFinales = guardados.length + (editorTieneAlgo && !validarEditor() ? 1 : 0);

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
            <div style={S.sub}>Captura un producto, agrégalo a la lista y sigue con el siguiente.</div>
          </div>
          <button onClick={onClose} style={S.closeBtn} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Cuerpo scrolleable — único elemento con overflow. */}
        <div style={S.sheetBody}>

        {/* Renglones ya guardados (patrón carrito): compactos, tap para editar. */}
        {guardados.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <label style={{ ...S.label, margin: '0 2px 2px' }}>En este pedido · {guardados.length}</label>
            {guardados.map((l, i) => (
              <div key={l.producto + i} style={S.fila} data-id="pedidos.nuevo.fila-guardada"
                role="button" title="Editar este producto" onClick={() => editarGuardado(i)}>
                <span style={S.filaCheck}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div style={S.filaNombre}>{l.producto}</div>
                  <div style={S.filaDetalle}>{resumenLinea(l)}</div>
                </div>
                <button
                  style={S.filaQuitar}
                  onClick={(e) => { e.stopPropagation(); quitarGuardado(i); }}
                  title="Quitar de la lista"
                  aria-label={'Quitar ' + l.producto}
                >×</button>
              </div>
            ))}
          </div>
        )}

        <label style={S.label} htmlFor="np-prod">
          {guardados.length > 0 ? 'Siguiente producto' : 'Producto *'}
        </label>
        <input
          id="np-prod"
          ref={prodInputRef}
          className="np-finput"
          style={S.input}
          list="formulas-list"
          value={editor.producto}
          onChange={(e) => setEd('producto', e.target.value)}
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
            const on = editor.medida === m.key;
            return (
              <button key={m.key} type="button" onClick={() => setEd('medida', m.key)}
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
        <label style={S.label} htmlFor="np-qty">Cantidad ({ptMedidaDef(editor.medida)?.label || 'unidades'}) *</label>
        <input
          id="np-qty"
          className="np-finput"
          style={S.input}
          type="number"
          inputMode="numeric"
          min="1"
          value={editor.cantidad}
          onChange={(e) => setEd('cantidad', e.target.value)}
          placeholder="52"
        />
        {editor.medida !== 'cubeta' && editor.cantidad && parseInt(editor.cantidad) > 0 && (
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
            = <strong>{Math.round(medidaACubetas(editor.medida, parseInt(editor.cantidad)))}</strong> cubetas-equivalente
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

        {/* Guardar el producto capturado y dejar el editor listo para el que sigue. */}
        <button style={S.addBtn} onClick={guardarProducto} data-id="pedidos.nuevo.btn.agregar-producto">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Agregar a la lista y capturar otro
        </button>

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

        {/* Error SIEMPRE visible: pegado al final (junto al footer) + auto-scroll. */}
        {err && <div ref={errRef} style={S.err} data-id="pedidos.nuevo.error">{err}</div>}
        </div>{/* /sheetBody */}

        {/* Footer pegajoso — botones fijos abajo (no scrollean). */}
        <div style={S.sheetFooter}>
          <button style={S.btn(false)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btn(true)} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : numFinales > 1 ? `Crear ${numFinales} pedidos` : 'Crear pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
