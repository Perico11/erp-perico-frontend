import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/* ════════════════════════════════════════════════════════════════════════
   AsistenteFlotante — botón flotante arrastrable que vive en TODAS las
   pantallas (jun 2026, pedido dueño). Le preguntas "¿dónde está tal botón?"
   y te lleva ahí, resaltando el destino.

   v1 = asistente de navegación inteligente (offline, sin API key): normaliza
   el texto, tolera errores de dedo (distancia de edición) y empareja contra
   un índice curado de pantallas y acciones. Filtra por el rol del usuario.
   Upgrade futuro: chat con LLM real conectando el backend.
   ════════════════════════════════════════════════════════════════════════ */

/* Índice de destinos. ruta = a dónde navegar; dataId (opcional) = elemento a
   resaltar; roles = quién lo ve (vacío = todos). keywords = sinónimos. */
const INDICE = [
  { label: 'Inicio', sub: 'Resumen y pendientes', ruta: '/', keywords: 'home dashboard tablero principal resumen pendientes inicio' },
  { label: 'Notificaciones', sub: 'Alertas y activar avisos del teléfono', ruta: '/notificaciones', keywords: 'notificaciones alertas avisos push campana activar telefono' },

  { label: 'Inventario · Materia Prima', sub: 'Stock de MP por categoría', ruta: '/inventario?tab=mp', roles: 'admin,tecnico,compras,almacen,inventario', keywords: 'inventario materia prima mp stock existencia quimicos resinas cargas pigmentos' },
  { label: 'Agregar materia prima', sub: 'Inventario → MP → Fábrica/Terán → Agregar', ruta: '/inventario?tab=mp', roles: 'admin,inventario,tecnico', keywords: 'agregar alta nueva materia prima mp recepcion dar de alta' },
  { label: 'Inventario · Producto Terminado', sub: 'Stock de PT (Total/Fábrica/Terán)', ruta: '/inventario?tab=pt', roles: 'admin,tecnico,compras,almacen,inventario', keywords: 'inventario producto terminado pt cubetas pintura stock fabrica teran' },
  { label: 'Agregar producto terminado', sub: 'Inventario → PT → Agregar PT', ruta: '/inventario?tab=pt', roles: 'admin,inventario', keywords: 'agregar pt producto terminado nuevo dar de alta' },
  { label: 'Inventario · Envases', sub: 'Envases, tapas, importar/exportar', ruta: '/inventario?tab=env', roles: 'admin,tecnico,compras,almacen,inventario', keywords: 'envases tapas botes cubetas presentaciones importar exportar imprimir' },
  { label: 'Ajustar mínimos de stock', sub: 'En cada fila: botón Ajustar', ruta: '/inventario', roles: 'admin,inventario', keywords: 'ajustar minimo minimos existencia stock corregir conteo' },

  { label: 'Compras / Órdenes de compra', sub: 'Aprobar, pagar, recibir OC', ruta: '/compras', roles: 'admin,compras', keywords: 'compras oc orden de compra aprobar pagar recibir proveedor arely comprobante credito' },
  { label: 'Pronóstico de compras', sub: 'Sugerencias, MRP, tendencia, IA', ruta: '/pronostico', roles: 'admin,compras', keywords: 'pronostico forecast sugerencias mrp tendencia prediccion ia comprar' },
  { label: 'SAT / CFDI', sub: 'Facturas, XML', ruta: '/sat', roles: 'admin,compras', keywords: 'sat cfdi factura xml fiscal' },
  { label: 'Devoluciones a proveedor (MP)', sub: 'Devolver materia prima', ruta: '/devoluciones-mp', roles: 'admin,compras', keywords: 'devolucion devoluciones proveedor materia prima mp nota credito reembolso' },

  { label: 'Órdenes de producción', sub: 'Crear y seguir órdenes', ruta: '/ordenes', roles: 'admin,tecnico', keywords: 'ordenes orden produccion nueva orden destino teran fabrica enrique' },
  { label: 'Producción', sub: 'Fabricar y QC', ruta: '/produccion', roles: 'admin,tecnico', keywords: 'produccion fabricar producir lote completar paso terminar' },
  { label: 'Control de calidad (QC)', sub: 'Producción → Calidad', ruta: '/produccion?tab=calidad', roles: 'admin,tecnico', keywords: 'qc calidad control retener hold liberar viscosidad ph' },
  { label: 'Stock de Fábrica / Envasado', sub: 'Envasar, transferir, QR', ruta: '/stock-fabrica', roles: 'admin,tecnico,almacen', keywords: 'stock fabrica envasado envasar sublote transferir qr etiqueta tote' },
  { label: 'Fórmulas', sub: 'Recetas y costos', ruta: '/formulas', roles: 'admin,tecnico,compras', keywords: 'formulas recetas formula costo comparar ingredientes' },
  { label: 'Laboratorio', sub: 'Pruebas de laboratorio', ruta: '/laboratorio', roles: 'admin,tecnico', keywords: 'laboratorio lab pruebas ensayo' },

  { label: 'Pedidos de almacén', sub: 'Crear pedidos a fábrica', ruta: '/pedidos', roles: 'admin,almacen,tecnico', keywords: 'pedidos pedido nuevo almacen solicitar producto josue aceptar producir' },
  { label: 'Recolección', sub: 'Recoger y llevar lotes (Luis)', ruta: '/recoleccion', roles: 'admin,recolector,almacen', keywords: 'recoleccion recolectar recoger luis llevar voy por el escanear' },
  { label: 'Recepción Almacén Terán', sub: 'Recibir lotes en Terán (Josué)', ruta: '/almacen', roles: 'admin,almacen', keywords: 'almacen teran recepcion recibir escanear qr josue' },
  { label: 'Devoluciones de producto (cliente)', sub: 'Registrar devoluciones PT', ruta: '/devoluciones', roles: 'admin,compras,almacen,tecnico', keywords: 'devoluciones devolucion cliente producto terminado nota credito' },
  { label: 'Trazabilidad', sub: 'Seguir un lote en el flujo', ruta: '/trazabilidad', roles: 'admin,tecnico,almacen,compras,recolector,inventario', keywords: 'trazabilidad lote rastreo seguimiento en camino checkpoint pipeline' },

  { label: 'Conteo físico (cycle count)', sub: 'Contar inventario (Burgos)', ruta: '/conteo', roles: 'admin,inventario', keywords: 'conteo cycle count contar fisico varianza burgos ajuste' },
  { label: 'Reportes', sub: 'Rentabilidad, cierre mensual', ruta: '/reportes', roles: 'admin,inventario,compras', keywords: 'reportes reporte rentabilidad margenes valuacion cierre mensual ira' },

  { label: 'Administración / Usuarios', sub: 'Usuarios, permisos, branding', ruta: '/admin', roles: 'admin', keywords: 'admin administracion usuarios permisos roles pin branding sesiones margenes' },
  { label: 'Seguridad', sub: 'Auditoría y candado', ruta: '/seguridad', roles: 'admin,tecnico,inventario,almacen', keywords: 'seguridad auditoria candado totp codigo' },
];

/* ── Búsqueda tolerante a errores ── */
function _norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function _lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
function _score(query, entry) {
  const q = _norm(query); if (!q) return 0;
  const texto = _norm(entry.label + ' ' + (entry.sub || '') + ' ' + (entry.keywords || ''));
  if (texto.includes(q)) return 100;                              /* frase completa */
  const qToks = q.split(' ').filter(Boolean);
  const tToks = texto.split(' ');
  let s = 0;
  for (const qt of qToks) {
    if (tToks.includes(qt)) { s += 30; continue; }
    if (tToks.some(t => t.startsWith(qt) && qt.length >= 3)) { s += 20; continue; }
    if (tToks.some(t => t.length >= 4 && qt.length >= 4 && _lev(qt, t) <= 2)) { s += 12; continue; } /* typo */
  }
  return s;
}

const POS_KEY = 'pp_asistente_pos';

export default function AsistenteFlotante() {
  let auth = null; try { auth = useAuth(); } catch { /* sin provider */ }
  const user = auth?.user || null;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  /* Chat (jun 2026): historial de mensajes. Saludo inicial al abrir. */
  const [mensajes, setMensajes] = useState([]);
  const listRef = useRef(null);
  const [pos, setPos] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); if (p && typeof p.x === 'number') return p; } catch {}
    return null; /* null = posición por defecto (abajo-derecha) */
  });
  const dragRef = useRef({ dragging: false, moved: 0, sx: 0, sy: 0, ox: 0, oy: 0 });
  const inputRef = useRef(null);

  useEffect(() => { if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 80); }, [open]);
  /* Saludo al abrir por primera vez. */
  useEffect(() => {
    if (open && mensajes.length === 0) {
      const nom = user?.nombre ? ', ' + String(user.nombre).split(' ')[0] : '';
      setMensajes([{ from: 'bot', text: `¡Hola${nom}! ¿Cómo te ayudo? Escríbeme qué quieres hacer o a dónde ir.` }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  /* Auto-scroll al último mensaje. */
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [mensajes, open]);

  /* Destinos visibles para el rol actual */
  const visibles = useMemo(() => {
    const rol = user?.rol;
    return INDICE.filter(e => !e.roles || !rol || e.roles.split(',').includes(rol));
  }, [user]);

  if (!user) return null; /* solo con sesión */

  /* ── Drag del botón ── */
  const onPointerDown = (e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    dragRef.current = { dragging: true, moved: 0, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top };
    el.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current; if (!d.dragging) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    d.moved = Math.max(d.moved, Math.abs(dx) + Math.abs(dy));
    const size = 54, pad = 8;
    const x = Math.min(window.innerWidth - size - pad, Math.max(pad, d.ox + dx));
    const y = Math.min(window.innerHeight - size - pad, Math.max(pad, d.oy + dy));
    setPos({ x, y });
  };
  const onPointerUp = (e) => {
    const d = dragRef.current; if (!d.dragging) return;
    d.dragging = false;
    if (d.moved < 6) { setOpen(o => !o); return; } /* fue un toque → abrir/cerrar */
    /* Snap al borde izquierdo o derecho más cercano */
    setPos(p => {
      if (!p) return p;
      const size = 54, pad = 8;
      const snapped = { x: (p.x + size / 2 < window.innerWidth / 2) ? pad : window.innerWidth - size - pad, y: p.y };
      try { localStorage.setItem(POS_KEY, JSON.stringify(snapped)); } catch {}
      return snapped;
    });
  };

  const esAdmin = user?.rol === 'admin';
  const pushBot = (msg) => setMensajes(m => [...m, typeof msg === 'string' ? { from: 'bot', text: msg } : { from: 'bot', ...msg }]);
  const reemplazarUltimo = (texto) => setMensajes(m => { const c = [...m]; for (let i = c.length - 1; i >= 0; i--) if (c[i].from === 'bot') { c[i] = { from: 'bot', text: texto }; break; } return c; });

  /* ── Acciones reales (comandos) ── */
  async function _todosLosItems() {
    const [invR, envR] = await Promise.all([api.getInventario().catch(() => null), api.getEnvases().catch(() => null)]);
    const inv = invR?.data || invR || {};
    const items = [];
    Object.entries(inv.mp || {}).forEach(([k, v]) => items.push({ nombre: k, qty: +v.qty || 0, min: +v.min || 0, tipo: 'MP', u: 'kg' }));
    Object.entries(inv.pt || {}).forEach(([k, v]) => items.push({ nombre: k, qty: +v.qty || 0, min: +v.min || 0, tipo: 'PT', u: 'cub' }));
    const env = envR?.data || envR || {};
    Object.values(env.categorias || {}).forEach(cat => Object.values(cat.subcategorias || {}).forEach(s => items.push({ nombre: s.nombre, qty: +s.stock || 0, min: +s.min || 0, tipo: 'Envase', u: 'pz' })));
    Object.values(env.tapas || {}).forEach(t => items.push({ nombre: t.nombre, qty: +t.stock || 0, min: +t.min || 0, tipo: 'Tapa', u: 'pz' }));
    return items;
  }
  function _mejorMatch(nombre, lista, getN) {
    const q = _norm(nombre), qns = q.replace(/ /g, '');
    let best = null, bs = -1;
    lista.forEach(it => {
      const n = _norm(getN(it)); const nns = n.replace(/ /g, '');
      const sc = n === q ? 100 : n.includes(q) || q.includes(n) ? 60 : (nns.length >= 4 && _lev(qns, nns) <= 2 ? 35 : 0);
      if (sc > bs) { bs = sc; best = it; }
    });
    return bs > 0 ? best : null;
  }

  async function accionStock(nombre) {
    const items = await _todosLosItems();
    const it = _mejorMatch(nombre, items, x => x.nombre);
    if (!it) return `No encontré "${nombre}" en el inventario.`;
    const est = it.qty <= 0 ? 'AGOTADO ⚠️' : (it.min > 0 && it.qty < it.min) ? 'BAJO' : 'OK';
    return `${it.tipo} · ${it.nombre}: ${it.qty.toLocaleString('es-MX')} ${it.u} (mínimo ${it.min} ${it.u}) — ${est}.`;
  }
  async function accionAgregarMP(nombre, n) {
    const r = await api.getInventario().catch(() => null);
    const mp = (r?.data || r || {}).mp || {};
    const it = _mejorMatch(nombre, Object.keys(mp).map(k => ({ k })), x => x.k);
    if (!it) return `No encontré la materia prima "${nombre}". Créala en Inventario → MP.`;
    await api.setMPUbicacion(it.k, 'fabrica', n, 'agregar', 'Agregado desde el asistente');
    return `Listo: agregué ${n} kg de ${it.k} al stock de Fábrica.`;
  }
  async function accionPin(nombreUser, pin) {
    const r = await api.getUsuarios().catch(() => null);
    const arr = r?.data || r?.usuarios || (Array.isArray(r) ? r : []) || [];
    const u = _mejorMatch(nombreUser, arr, x => x.nombre || '');
    if (!u) return `No encontré al usuario "${nombreUser}".`;
    await api.cambiarPin(u.id, pin);
    return `Listo: el PIN de ${u.nombre} ahora es ${pin}. Sus otras sesiones se cerraron.`;
  }

  /* Detecta un comando en el texto. */
  function detectar(t) {
    const s = _norm(t); let m;
    if ((m = s.match(/pin\s+(?:de|del)\s+(.+?)\s+(?:a|en|por|:)?\s*(\d{4})\b/)) || (m = s.match(/(?:cambia\w*|nuevo pin)\s+(?:el pin\s+)?(?:de|a)\s+(.+?)\s+(\d{4})/))) {
      return { tipo: 'pin', admin: true, user: m[1].trim(), pin: m[2], desc: `cambiar el PIN de “${m[1].trim()}” a ${m[2]}` };
    }
    if ((m = s.match(/(?:agrega\w*|sube\w*|suma\w*|a[nñ]ade\w*)\s+(\d+(?:\.\d+)?)\s*(?:kg|kilos)?\s+(?:de\s+|al\s+|a\s+)?(.+?)(?:\s+(?:a|en)\s+(?:la\s+)?fabrica)?\s*$/))) {
      return { tipo: 'agregarMP', admin: true, nombre: m[2].trim(), n: parseFloat(m[1]), desc: `agregar ${m[1]} kg de “${m[2].trim()}” al stock de Fábrica` };
    }
    if ((m = s.match(/(?:stock|existencia|inventario|cuant[oa]\s+(?:hay|tengo|queda))\s+(?:de\s+|del\s+)?(.+)/))) {
      return { tipo: 'stock', admin: false, nombre: m[1].trim() };
    }
    return null;
  }

  async function ejecutar(acc) {
    pushBot('Un momento…');
    let r;
    try {
      if (acc.tipo === 'pin') r = await accionPin(acc.user, acc.pin);
      else if (acc.tipo === 'agregarMP') r = await accionAgregarMP(acc.nombre, acc.n);
      else r = 'Acción no reconocida.';
    } catch (e) { r = 'No se pudo: ' + (e?.data?.error || e?.message || 'error'); }
    reemplazarUltimo(r);
  }

  /* Responder a un mensaje del usuario. */
  const responder = async (texto) => {
    const t = (texto || '').trim();
    if (!t) return;
    setQ('');
    setMensajes(m => [...m, { from: 'user', text: t }]);
    const acc = detectar(t);
    if (acc) {
      if (acc.admin && !esAdmin) { pushBot('Esa acción solo la puede hacer un administrador.'); return; }
      if (acc.tipo === 'stock') { pushBot('Buscando…'); const r = await accionStock(acc.nombre); reemplazarUltimo(r); return; }
      pushBot({ text: `Vas a ${acc.desc}. ¿Confirmo?`, confirm: acc });
      return;
    }
    /* Navegación (fallback) */
    const res = visibles.map(e => ({ e, s: _score(t, e) })).filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s).slice(0, 5).map(r => r.e);
    pushBot(res.length
      ? { text: res.length === 1 ? 'Te llevo aquí:' : 'Encontré esto — toca a dónde quieres ir:', results: res }
      : { text: 'No te entendí. Puedo: consultar stock (“stock de X”), agregar stock a una MP, cambiar un PIN, o llevarte a una pantalla (“compras”, “conteo”…).' });
  };

  const ir = (entry) => {
    setOpen(false); setQ('');
    navigate(entry.ruta);
    if (entry.dataId) {
      setTimeout(() => {
        const t = document.querySelector(`[data-id="${entry.dataId}"]`);
        if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.add('pp-asistente-pulse'); setTimeout(() => t.classList.remove('pp-asistente-pulse'), 2200); }
      }, 700);
    }
  };

  const fabStyle = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 12, top: '58vh', bottom: 'auto', left: 'auto' }; /* media altura derecha, lejos de los FAB de abajo */

  return (
    <>
      <button
        type="button"
        aria-label="Asistente: buscar una pantalla o botón"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ ...S.fab, ...fabStyle }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
          <path d="M19 14l.7 1.9L21.6 16.6l-1.9.7L19 19l-.7-1.7L16.4 16.6l1.9-.7z" />
        </svg>
      </button>

      {open && (
        <div style={S.overlay} onClick={() => setOpen(false)}>
          <div style={S.panel} onClick={e => e.stopPropagation()}>
            <div style={S.head}>
              <div style={S.headTitle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lp-brand-600)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" /></svg>
                Asistente
              </div>
              <button style={S.close} onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            {/* Conversación */}
            <div style={S.list} ref={listRef}>
              {mensajes.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={m.from === 'user' ? S.bubbleUser : S.bubbleBot}>{m.text}</div>
                  {m.results && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, width: '100%' }}>
                      {m.results.map((e, j) => (
                        <button key={e.ruta + j} style={S.item} onClick={() => ir(e)}>
                          <div>
                            <div style={S.itemLabel}>{e.label}</div>
                            <div style={S.itemSub}>{e.sub}</div>
                          </div>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lp-brand-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                      ))}
                    </div>
                  )}
                  {m.confirm && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button style={S.confirmYes}
                        onClick={() => { const acc = m.confirm; setMensajes(ms => ms.map((x, j) => j === i ? { from: 'bot', text: x.text.replace(' ¿Confirmo?', '') + ' ✓' } : x)); ejecutar(acc); }}>
                        Sí, hazlo
                      </button>
                      <button style={S.confirmNo}
                        onClick={() => setMensajes(ms => ms.map((x, j) => j === i ? { from: 'bot', text: 'Cancelado.' } : x))}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Entrada */}
            <div style={S.inputRow}>
              <input
                ref={inputRef}
                style={S.input}
                placeholder="Escribe aquí… ej: aprobar OC, agregar envase"
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') responder(q); }}
              />
              <button style={S.send} onClick={() => responder(q)} disabled={!q.trim()} aria-label="Enviar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const S = {
  fab: {
    position: 'fixed', zIndex: 1400, width: 54, height: 54, borderRadius: '50%',
    border: 'none', cursor: 'grab', touchAction: 'none',
    background: 'linear-gradient(135deg, var(--lp-brand-600), var(--lp-brand-700))',
    boxShadow: '0 6px 20px rgba(20,36,31,.28)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1401, background: 'rgba(10,16,14,.35)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    padding: 'calc(12px + env(safe-area-inset-bottom,0px)) 12px 12px', fontFamily: 'var(--lp-font-sans)',
  },
  panel: {
    width: '100%', maxWidth: 460, background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 18, padding: 14,
    boxShadow: '0 14px 44px rgba(20,36,31,.22)', maxHeight: 'min(70vh, 560px)',
    display: 'flex', flexDirection: 'column',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headTitle: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 800, color: 'var(--lp-text-primary)' },
  close: { background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--lp-text-tertiary)' },
  list: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 2px', minHeight: 120 },
  bubbleBot: {
    alignSelf: 'flex-start', maxWidth: '88%', background: 'var(--lp-bg-base)',
    border: '1px solid var(--lp-border-subtle)', borderRadius: '14px 14px 14px 4px',
    padding: '9px 12px', fontSize: 13.5, lineHeight: 1.45, color: 'var(--lp-text-primary)',
  },
  bubbleUser: {
    alignSelf: 'flex-end', maxWidth: '88%', background: 'var(--lp-brand-600)', color: '#fff',
    borderRadius: '14px 14px 4px 14px', padding: '9px 12px', fontSize: 13.5, lineHeight: 1.45,
  },
  inputRow: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 },
  input: {
    flex: 1, boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 14, fontFamily: 'inherit',
    background: 'var(--lp-bg-base)', outline: 'none', color: 'var(--lp-text-primary)',
  },
  send: {
    flexShrink: 0, width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
    background: 'var(--lp-brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  confirmYes: { padding: '8px 16px', borderRadius: 10, border: 'none', background: 'var(--lp-brand-600)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  confirmNo: { padding: '8px 16px', borderRadius: 10, border: '1.5px solid var(--lp-border-subtle)', background: 'transparent', color: 'var(--lp-text-secondary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: 12,
    border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-base)',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  itemLabel: { fontSize: 13.5, fontWeight: 700, color: 'var(--lp-text-primary)' },
  itemSub: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 1 },
};
