import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

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
  { label: 'Inventario · Producto Terminado', sub: 'Stock de PT (Total/Fábrica/Terán)', ruta: '/inventario?tab=pt', roles: 'admin,tecnico,compras,almacen,inventario', keywords: 'inventario producto terminado pt cubetas pintura stock' },
  { label: 'Inventario PT · Fábrica', sub: 'PT físicamente en fábrica', ruta: '/inventario?tab=pt&pt=fabrica', roles: 'admin,tecnico,compras,almacen,inventario', keywords: 'inventario producto terminado pt en fabrica stock de fabrica que hay en fabrica totes cubetas' },
  { label: 'Inventario PT · Terán', sub: 'PT en almacén Terán', ruta: '/inventario?tab=pt&pt=teran', roles: 'admin,tecnico,compras,almacen,inventario', keywords: 'inventario producto terminado pt en teran almacen teran stock de teran' },
  { label: 'Inventario MP · Fábrica', sub: 'Materia prima en fábrica', ruta: '/inventario?tab=mp&mp=fabrica', roles: 'admin,tecnico,compras,almacen,inventario', keywords: 'inventario materia prima mp en fabrica stock de fabrica' },
  { label: 'Inventario MP · Terán', sub: 'Materia prima en almacén Terán', ruta: '/inventario?tab=mp&mp=teran', roles: 'admin,tecnico,compras,almacen,inventario', keywords: 'inventario materia prima mp en teran almacen teran stock de teran' },
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

  /* ── Botones específicos: navega Y resalta el botón exacto (dataId) ── */
  { label: 'Botón: Aprobar OC', sub: 'Compras → en la tarjeta de la OC', ruta: '/compras', roles: 'admin,compras', dataId: 'compras.btn.aprobar-oc', keywords: 'aprobar oc orden de compra autorizar boton' },
  { label: 'Botón: Registrar pago de OC', sub: 'Compras → tarjeta de OC', ruta: '/compras', roles: 'admin,compras', dataId: 'compras.btn.registrar-pago', keywords: 'registrar pago pagar oc abono comprobante' },
  { label: 'Botón: Recibir MP de una OC', sub: 'Compras → tarjeta de OC', ruta: '/compras', roles: 'admin,compras', dataId: 'compras.btn.recibir-mp', keywords: 'recibir mp materia prima oc entrada' },
  { label: 'Botón: Nueva OC / levantar', sub: 'Compras → crear orden de compra', ruta: '/compras', roles: 'admin,compras', dataId: 'compras.btn.levantar-oc', keywords: 'nueva oc levantar crear orden de compra' },
  { label: 'Botón: Recepción MP', sub: 'Inventario → MP → + Recepción MP', ruta: '/inventario?tab=mp', roles: 'admin,compras,almacen', dataId: 'inventario.btn.recepcion-mp', keywords: 'recepcion mp recibir materia prima entrada' },
  { label: 'Botón: Pedir reposición de PT', sub: 'Inventario → PT → Pedir', ruta: '/inventario?tab=pt', roles: 'admin,almacen,tecnico', dataId: 'inventario.btn.pedir-pt', keywords: 'pedir reposicion pt producto reabastecer' },
  { label: 'Botón: Ajustar existencia', sub: 'Inventario → MP/PT → Ajustar (cantidad, mínimo o renombrar)', ruta: '/inventario?tab=mp', roles: 'admin,tecnico,almacen,compras', dataId: 'inventario.btn.ajustar', keywords: 'ajustar existencia cantidad stock minimo cambiar nombre renombrar editar mp pt' },
  { label: 'Botón: Generar OC desde MRP', sub: 'Inventario → generar OC', ruta: '/inventario?tab=mp', roles: 'admin,compras', dataId: 'inventario.btn.generar-oc', keywords: 'generar oc mrp orden compra' },
  { label: 'Botón: Nueva orden', sub: 'Órdenes → + Nueva orden', ruta: '/ordenes', roles: 'admin,tecnico', dataId: 'ordenes.btn.nueva', keywords: 'nueva orden crear produccion boton' },
  { label: 'Botón: Nueva solicitud de OC', sub: 'Órdenes → solicitar MP', ruta: '/ordenes', roles: 'admin,tecnico', dataId: 'ordenes.btn.nueva-solicitud-oc', keywords: 'solicitud oc solicitar materia prima compras' },
  { label: 'Botón: Iniciar producción', sub: 'Órdenes → iniciar', ruta: '/ordenes', roles: 'admin,tecnico', dataId: 'ordenes.btn.iniciar-produccion', keywords: 'iniciar producir lanzar produccion orden' },
  { label: 'Botón: Aprobar QC', sub: 'Órdenes → liberar calidad', ruta: '/ordenes', roles: 'admin,tecnico', dataId: 'ordenes.btn.aprobar-qc', keywords: 'aprobar qc calidad liberar lote' },
  { label: 'Botón: Nuevo pedido', sub: 'Pedidos → + Nuevo pedido', ruta: '/pedidos', roles: 'admin,almacen,tecnico', dataId: 'pedidos.btn.nuevo', keywords: 'nuevo pedido crear almacen solicitar' },
  { label: 'Botón: Aceptar y producir', sub: 'Pedidos → aceptar', ruta: '/pedidos', roles: 'admin,tecnico', dataId: 'pedidos.btn.aceptar-producir', keywords: 'aceptar producir pedido enrique' },
  { label: 'Botón: Nueva sesión de conteo', sub: 'Conteo → nueva sesión', ruta: '/conteo', roles: 'admin,inventario', dataId: 'conteo.btn.nueva-sesion', keywords: 'nueva sesion conteo iniciar contar burgos' },
  { label: 'Botón: Contar (conteo)', sub: 'Conteo → registrar conteo', ruta: '/conteo', roles: 'admin,inventario', dataId: 'conteo.btn.contar', keywords: 'contar conteo fisico registrar' },
  { label: 'Botón: Nueva devolución', sub: 'Devoluciones → + Nueva', ruta: '/devoluciones', roles: 'admin,compras,almacen,tecnico', dataId: 'devoluciones.btn.nueva', keywords: 'nueva devolucion crear cliente' },
  { label: 'Botón: Subir XML (SAT)', sub: 'SAT → subir factura', ruta: '/sat', roles: 'admin,compras', dataId: 'sat.btn.subir-xml', keywords: 'subir xml factura sat cfdi cargar' },
  { label: 'Botón: Escanear QR en Terán', sub: 'Recepción → escanear', ruta: '/almacen', roles: 'admin,almacen', dataId: 'recepcion.btn.escanear', keywords: 'escanear qr recibir teran almacen josue' },
  { label: 'Botón: Escanear QR (trazabilidad)', sub: 'Trazabilidad → escanear', ruta: '/trazabilidad', roles: 'admin,tecnico,almacen,recolector,inventario,compras', dataId: 'traza.btn.escanear-qr', keywords: 'escanear qr lote trazabilidad rastrear' },
  { label: 'Botón: Generar OC (Pronóstico)', sub: 'Pronóstico → sugerencias → generar', ruta: '/pronostico', roles: 'admin,compras', dataId: 'forecast.btn.agregar-oc', keywords: 'generar oc pronostico sugerencia agregar a la orden' },
  { label: 'Botón: Exportar reporte', sub: 'Reportes → exportar', ruta: '/reportes', roles: 'admin,inventario,compras', dataId: 'reportes.btn.exportar', keywords: 'exportar reporte excel descargar' },
  { label: 'Botón: Atender pendiente (Inicio)', sub: 'Inicio → botón del hero', ruta: '/', dataId: 'inicio.btn.atender-hero', keywords: 'atender pendiente hero inicio revisar' },
];

/* Botones que abren un FORMULARIO/modal seguro → el bot puede "abrirlos" directo
   (como si el usuario diera click). Se EXCLUYEN los que ejecutan/comprometen algo
   (iniciar producción, aprobar QC, aceptar y producir, etc.): esos solo se resaltan. */
const ABRIBLES = new Set([
  'compras.btn.levantar-oc',        /* Nueva OC */
  'inventario.btn.recepcion-mp',    /* Recepción MP */
  'inventario.btn.ajustar',         /* Ajustar existencia */
  'ordenes.btn.nueva',              /* Nueva orden */
  'ordenes.btn.nueva-solicitud-oc', /* Solicitud de OC */
  'pedidos.btn.nuevo',              /* Nuevo pedido */
  'conteo.btn.nueva-sesion',        /* Nueva sesión de conteo */
  'devoluciones.btn.nueva',         /* Nueva devolución */
  'sat.btn.subir-xml',              /* Subir XML */
]);

/* Permiso GRANULAR real que gatea cada acción (el mismo que evalúa el ERP con
   permisos_roles.json). Si el rol "ve" la pantalla pero NO tiene el permiso, el bot
   lo marca como NO permitido (ej. almacén ve Inventario pero no puede Ajustar). Las
   acciones que NO están aquí se gatean solo por rol (acceso a pantalla). Se mapea por
   data-id (botón) o por label (acciones sin botón). El backend resuelve permitido/
   quién-puede contra la matriz real. */
const PERM_GATE = {
  'inventario.btn.ajustar': 'editarInventario',
  'inventario.btn.recepcion-mp': 'recibirMP',
  'conteo.btn.nueva-sesion': 'conteoFisico',
  'conteo.btn.contar': 'conteoFisico',
  'Agregar materia prima': 'editarInventario',
  'Agregar producto terminado': 'editarInventario',
  'Ajustar mínimos de stock': 'editarMinimos',
  'Conteo físico (cycle count)': 'conteoFisico',
};
const _permDe = (e) => (e.dataId && PERM_GATE[e.dataId]) || PERM_GATE[e.label] || '';

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

/* Sugerencias rápidas por rol (chips tappables bajo el saludo). `fill:true` =
   solo rellena el input (frase incompleta, p.ej. "stock de …"); sin fill = se
   envía directo. Filtra por rol para no ofrecer acciones que el usuario no hace. */
const SUGERENCIAS = {
  admin:      [{ t: 'Mis pendientes', q: 'pendientes' }, { t: 'Stock de…', q: 'stock de ', fill: true }, { t: 'Aprobar OC', q: 'aprobar oc' }, { t: 'Conteo', q: 'conteo' }],
  compras:    [{ t: 'Mis pendientes', q: 'pendientes' }, { t: 'Aprobar OC', q: 'aprobar oc' }, { t: 'Pronóstico', q: 'pronostico' }, { t: 'Recibir MP', q: 'recibir mp' }],
  tecnico:    [{ t: 'Mis pendientes', q: 'pendientes' }, { t: 'Nueva orden', q: 'nueva orden' }, { t: 'Calidad (QC)', q: 'calidad qc' }, { t: 'Stock de…', q: 'stock de ', fill: true }],
  almacen:    [{ t: 'Mis pendientes', q: 'pendientes' }, { t: 'Nuevo pedido', q: 'nuevo pedido' }, { t: 'Recibir en Terán', q: 'escanear teran' }, { t: 'Recolección', q: 'recoleccion' }],
  inventario: [{ t: 'Mis pendientes', q: 'pendientes' }, { t: 'Iniciar conteo', q: 'nueva sesion conteo' }, { t: 'Stock de…', q: 'stock de ', fill: true }, { t: 'Agregar MP', q: 'agregar materia prima' }],
  recolector: [{ t: 'Recolección', q: 'recoleccion' }, { t: 'Trazabilidad', q: 'trazabilidad' }],
};

/* Humaniza títulos técnicos de notificaciones para los "pendientes" del bot
   (versión ligera del humanizar() de NotificacionesPage). */
function _humanTitulo(s) {
  return String(s || '')
    .replace(/\b([a-z_]+)\.json\b/gi, (_, w) => w)
    .replace(/\b([a-z]+)(_[a-z]+)+\b/g, m => m.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
    .replace(/:\s+/g, ' — ')
    .trim();
}

const POS_KEY = 'pp_asistente_pos';

/* Render ligero del texto del bot: **negrita**, viñetas (-, •, 1.) y saltos de
   línea. Solo texto + <strong> (sin HTML peligroso). Evita que se vean los
   asteriscos/guiones en crudo y mantiene las respuestas legibles. */
function _inline(s) {
  const out = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(<strong key={out.length}>{m[1]}</strong>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
function BotText({ text }) {
  const lineas = String(text || '').split('\n');
  return (
    <>
      {lineas.map((ln, i) => {
        const t = ln.replace(/\s+$/, '');
        if (!t.trim()) return <div key={i} style={{ height: 5 }} />;
        const mb = t.match(/^\s*([-•*]|\d+\.)\s+/);
        const marca = mb ? (/\d/.test(mb[1]) ? mb[1] : '•') : null;
        const cuerpo = mb ? t.slice(mb[0].length) : t;
        return marca
          ? (<div key={i} style={{ display: 'flex', gap: 6, paddingLeft: 2, margin: '1px 0' }}>
              <span style={{ color: 'var(--lp-brand-600)', flex: '0 0 auto' }}>{marca}</span>
              <span>{_inline(cuerpo)}</span>
            </div>)
          : (<div key={i} style={{ margin: '1px 0' }}>{_inline(cuerpo)}</div>);
      })}
    </>
  );
}

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

  /* Mientras el panel está abierto: bloquea el scroll del fondo (mismo fix que
     los modales — el scroller real es #root) y publica --pp-vvh para que el
     teclado del móvil no tape el input. */
  useBodyScrollLock(open);

  /* Si la ventana cambia de tamaño (rotación, redimensionar), re-encaja el FAB
     dentro de la pantalla y lo vuelve a pegar al borde más cercano — si no, una
     posición guardada podría quedar fuera de vista. */
  useEffect(() => {
    const onResize = () => setPos(p => {
      if (!p) return p;
      const size = 54, pad = 8;
      const x = (p.x + size / 2 < window.innerWidth / 2) ? pad : window.innerWidth - size - pad;
      const y = Math.min(window.innerHeight - size - pad, Math.max(pad, p.y));
      return { x, y };
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
  /* Permiso granular real (mismo can() del ERP) — para que el cerebro offline
     gatee acciones sin depender de la IA. */
  const can = (p) => !!(auth && typeof auth.can === 'function' && auth.can(p));
  const pushBot = (msg) => setMensajes(m => [...m, typeof msg === 'string' ? { from: 'bot', text: msg } : { from: 'bot', ...msg }]);
  const reemplazarUltimo = (payload) => setMensajes(m => { const c = [...m]; for (let i = c.length - 1; i >= 0; i--) if (c[i].from === 'bot') { c[i] = typeof payload === 'string' ? { from: 'bot', text: payload } : { from: 'bot', ...payload }; break; } return c; });

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
    if (!it) return null; /* sin match → el caller cae a navegación */
    const est = it.qty <= 0 ? 'AGOTADO' : (it.min > 0 && it.qty < it.min) ? 'BAJO' : 'OK';
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
  /* Pendientes del usuario: lee /api/notificaciones (ya filtrado por rol en el
     server) y los resume. Solo lectura — sin confirmación. */
  async function accionPendientes() {
    const r = await api.getNotificaciones().catch(() => null);
    const arr = Array.isArray(r) ? r : (r?.data || r?.notificaciones || []);
    if (!arr.length) return { text: 'No tienes pendientes — todo en orden.' };
    const crit = arr.filter(n => n.severidad === 'critica').length;
    const top = arr.slice(0, 4).map(n => '• ' + _humanTitulo(n.titulo)).join('\n');
    const cab = `Tienes ${arr.length} alerta${arr.length === 1 ? '' : 's'}${crit ? ` (${crit} crítica${crit === 1 ? '' : 's'})` : ''}:`;
    return {
      text: `${cab}\n${top}${arr.length > 4 ? `\n…y ${arr.length - 4} más` : ''}`,
      results: [{ label: 'Ver todas las alertas', sub: 'Ir a Notificaciones', ruta: '/notificaciones' }],
    };
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
    /* Pendientes/alertas — lectura directa (sin confirmación), antes de todo. */
    if (/\b(pendientes?|mis\s+alertas|que\s+tengo|que\s+hay\s+pendiente|tareas?)\b/.test(_norm(t))) {
      pushBot('Revisando tus pendientes…');
      reemplazarUltimo(await accionPendientes());
      return;
    }
    const navResultados = (txt) => visibles.map(e => ({ e, s: _score(txt, e) })).filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s).slice(0, 5).map(r => r.e);

    /* Pregunta a la IA (Claude) con el catálogo completo (con roles); maneja
       navegar/abrir/texto. Asume que ya hay un mensaje "pensando" del bot (lo
       reemplaza). Si la IA falla, cae al matcher offline. */
    const responderIA = async () => {
      try {
        const historial = mensajes
          .filter(x => x && (x.from === 'user' || x.from === 'bot') && x.text)
          .slice(-8)
          .map(x => ({ role: x.from === 'user' ? 'user' : 'assistant', content: x.text }));
        const destinos = INDICE.map((e, i) => ({ id: i, label: e.label, sub: e.sub || '', boton: !!e.dataId, abrible: !!e.dataId && ABRIBLES.has(e.dataId), roles: e.roles || '', perm: _permDe(e) }));
        const r = await api.asistenteChat(t, historial, destinos);
        if (r && r.accion && r.accion.tipo === 'navegar') {
          const dest = INDICE[r.accion.destino_id];
          if (r.accion.ejecutar) {
            /* COMANDO → lo llevamos/abrimos directo. */
            reemplazarUltimo(r.text || (dest ? `Te llevo a ${dest.label}.` : 'Listo.'));
            if (dest) setTimeout(() => ir(dest, !!r.accion.abrir), 600); /* abrir = despliega el formulario */
          } else {
            /* PREGUNTA → respondemos y OFRECEMOS el botón (el usuario decide). */
            reemplazarUltimo({ text: r.text || '¿Te llevo?', results: dest ? [{ ...dest, _abrir: !!r.accion.abrir }] : [] });
          }
          return;
        }
        reemplazarUltimo(r && r.text ? r.text : 'No pude responder.');
      } catch (e) {
        const motivo = e?.data?.error || e?.message || 'error de conexión';
        const res = navResultados(t);
        reemplazarUltimo(res.length
          ? { text: 'La IA no está disponible ahorita (' + motivo + '). Mientras, te dejo accesos directos:', results: res }
          : 'No pude responder: ' + motivo);
      }
    };

    const acc = detectar(t);
    if (acc) {
      if (acc.admin && !esAdmin) { pushBot('Esa acción solo la puede hacer un administrador.'); return; }
      if (acc.tipo === 'stock') {
        pushBot('Buscando…');
        const r = await accionStock(acc.nombre);
        if (r) { reemplazarUltimo(r); return; }
        /* No es un producto (ej. "inventario de fábrica") → que la IA navegue/conteste. */
        await responderIA();
        return;
      }
      pushBot({ text: `Vas a ${acc.desc}. ¿Confirmo?`, confirm: acc });
      return;
    }
    /* CEREBRO OFFLINE (gratis, sin IA): si hay un match CLARO resuelve solo —
       sin permiso → lo dice + alternativas; pregunta → pasos + botón; navegar/
       crear → va directo (y abre el formulario si aplica). Lo ambiguo o
       conversacional cae a la IA (que entiende frase libre y da más detalle). */
    const off = visibles.map(e => ({ e, s: _score(t, e) })).filter(r => r.s > 0).sort((a, b) => b.s - a.s);
    const top = off[0];
    if (top && top.s >= 55 && (off.length === 1 || top.s > (off[1] ? off[1].s : 0) + 10)) {
      const e = top.e;
      const limpio = e.label.replace(/^Botón:\s*/, '');
      const perm = _permDe(e);
      if (perm && !can(perm)) {
        const alt = off.filter(r => r.e !== e && (!_permDe(r.e) || can(_permDe(r.e)))).slice(0, 3).map(r => r.e);
        pushBot(alt.length
          ? { text: `No tienes permiso para "${limpio}". Lo que sí puedes:`, results: alt }
          : `No tienes permiso para "${limpio}".`);
        return;
      }
      const norm = _norm(t);
      const esPregunta = /\?\s*$/.test(t) || /\b(como|cuales|cual|donde|que pasos|para que|se puede|puedo|necesito saber)\b/.test(norm);
      if (esPregunta) {
        pushBot({ text: e.sub ? `Para eso ve a: ${e.sub}` : 'Aquí lo haces:', results: [e] });
      } else {
        const abrir = /\b(abre|abreme|crear|nuevo|nueva|registrar|levantar|hazme|quiero)\b/.test(norm);
        pushBot(`Listo, te llevo a ${limpio}.`);
        setTimeout(() => ir(e, abrir), 350);
      }
      return;
    }
    /* Nada claro offline → IA (frase libre, datos en vivo, conversación). */
    pushBot('Pensando…');
    await responderIA();
  };

  const ir = (entry, abrir = false) => {
    setOpen(false); setQ('');
    navigate(entry.ruta);
    if (!entry.dataId) return;
    /* La página carga en diferido y el botón puede tardar en montar (o estar
       dentro de una pestaña). Sondeamos hasta ~5s hasta encontrarlo y lo
       resaltamos. Si nunca aparece (p.ej. no hay tarjetas), al menos navegó. */
    let tries = 0;
    const poll = setInterval(() => {
      tries++;
      const t = document.querySelector(`[data-id="${entry.dataId}"]`);
      if (t) {
        clearInterval(poll);
        t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        t.classList.add('pp-asistente-pulse');
        setTimeout(() => t.classList.remove('pp-asistente-pulse'), 2600);
        /* abrir = el bot abre el formulario directo (solo botones marcados abribles).
           RE-CONSULTAMOS el elemento al momento del click: la página pudo re-renderizar
           en estos ms y dejar `t` desconectado del DOM (un .click() sobre un elemento
           muerto no dispara nada). Buscamos el botón vivo y clicamos el clickable real. */
        if (abrir && ABRIBLES.has(entry.dataId)) setTimeout(() => {
          try {
            const vivo = document.querySelector(`[data-id="${entry.dataId}"]`) || t;
            const clickable = vivo.closest('button, a, [role="button"]') || vivo.querySelector('button, a, [role="button"]') || vivo;
            clickable.click();
          } catch (_) {}
        }, 550);
      } else if (tries >= 20) {
        clearInterval(poll);
      }
    }, 250);
  };

  /* Chips de arranque por rol: tappar = enviar (o rellenar si la frase está
     incompleta, p.ej. "stock de …"). Se muestran solo con el saludo, para no
     estorbar una vez que hay conversación. */
  const sugerencias = SUGERENCIAS[user.rol] || [{ t: 'Mis pendientes', q: 'pendientes' }];
  const usarSugerencia = (s) => {
    if (s.fill) { setQ(s.q); setTimeout(() => inputRef.current?.focus(), 0); }
    else responder(s.q);
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
            <div style={S.list} ref={listRef} aria-live="polite">
              {mensajes.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={m.from === 'user' ? S.bubbleUser : S.bubbleBot}>{m.from === 'user' ? m.text : <BotText text={m.text} />}</div>
                  {m.results && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, width: '100%' }}>
                      {m.results.map((e, j) => (
                        <button key={e.ruta + j} style={S.item} onClick={() => ir(e, true)}>
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
            {/* Chips de arranque (solo con el saludo) */}
            {mensajes.length <= 1 && sugerencias.length > 0 && (
              <div style={S.chipsRow}>
                {sugerencias.map((s, i) => (
                  <button key={i} type="button" style={S.chip} onClick={() => usarSugerencia(s)}>{s.t}</button>
                ))}
              </div>
            )}
            {/* Entrada */}
            <div style={S.inputRow}>
              <input
                ref={inputRef}
                style={S.input}
                placeholder="Escribe aquí… ej: pendientes, aprobar OC"
                value={q}
                autoComplete="off"
                autoCorrect="off"
                enterKeyHint="send"
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
    /* Alto = viewport VISIBLE (--pp-vvh sigue al teclado en iOS), no el layout
       completo → el panel bottom-aligned queda SIEMPRE por encima del teclado. */
    position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--pp-vvh, 100dvh)',
    zIndex: 1401, background: 'rgba(10,16,14,.35)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    padding: 'calc(12px + env(safe-area-inset-bottom,0px)) 12px 12px', fontFamily: 'var(--lp-font-sans)',
  },
  panel: {
    width: '100%', maxWidth: 460, background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 18, padding: 14,
    boxShadow: '0 14px 44px rgba(20,36,31,.22)',
    maxHeight: 'min(560px, calc(var(--pp-vvh, 100dvh) - 24px))',
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
    whiteSpace: 'pre-line',
  },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2, paddingLeft: 2 },
  chip: {
    padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 12.5, fontWeight: 600, color: 'var(--lp-brand-700)',
    background: 'color-mix(in srgb, var(--lp-brand-600) 9%, transparent)',
    border: '1px solid color-mix(in srgb, var(--lp-brand-600) 28%, transparent)',
    minHeight: 36,
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
