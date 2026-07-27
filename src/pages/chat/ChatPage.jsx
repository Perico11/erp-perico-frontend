/* ════════════════════════════════════════════════════════════════════════════
   ChatPage — chat interno entre usuarios (jul 2026, pedido dueño).

   · Canal "General" (todos) + chats privados 1-a-1 con cada usuario.
   · Imágenes: adjuntar desde archivo/cámara (base64 → backend, máx 6 MB),
     thumbnail en el hilo, clic → abre completa (URL autenticada con token).
   · Menciones @: al teclear '@' aparece autocomplete de usuarios; el mensaje
     resalta las menciones y al mencionado le llega push dirigido.
   · Realtime WS (evento 'chat'), no-leídos por canal, marca de leído al abrir.

   Responsive: escritorio = 2 columnas (lista | hilo); móvil = lista ↔ hilo
   con botón regresar. Deep-link: /chat?canal=general | dm:a|b (las notifs
   push navegan aquí). Tema verde var(--lp-*), SVG line, touch ≥44px.
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import { useChatNotif } from '../../context/ChatNotifContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import api from '../../services/api';
import humanizeError from '../../utils/humanizeError';

/* ── Estilos ── */
const S = {
  shell: (desktop) => ({
    display: 'flex', gap: 0,
    height: desktop ? 'calc(100vh - 70px)' : 'calc(var(--pp-vvh, 100dvh) - 130px)',
    margin: desktop ? '0 24px 16px' : '0',
    borderRadius: desktop ? 18 : 0,
    border: desktop ? '1px solid var(--lp-border-subtle)' : 'none',
    overflow: 'hidden', background: 'var(--lp-bg-raised)',
  }),
  /* columna izquierda */
  lista: (desktop) => ({
    width: desktop ? 300 : '100%', flexShrink: 0,
    borderRight: desktop ? '1px solid var(--lp-border-subtle)' : 'none',
    display: 'flex', flexDirection: 'column', overflowY: 'auto',
    background: 'var(--lp-bg-raised)',
  }),
  secTitle: { fontSize: 10.5, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '14px 16px 6px' },
  canalRow: (on) => ({
    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
    padding: '11px 14px', minHeight: 60, border: 'none', cursor: 'pointer',
    background: on ? 'var(--lp-brand-50)' : 'transparent', textAlign: 'left',
    fontFamily: 'var(--lp-font-sans)', borderLeft: on ? '3px solid var(--lp-brand-600)' : '3px solid transparent',
  }),
  avatar: (color) => ({
    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
    background: color || 'var(--lp-brand-100)', color: 'var(--lp-brand-700)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700,
  }),
  canalNombre: { fontSize: 13.5, fontWeight: 600, color: 'var(--lp-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  canalPrev: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 },
  unread: {
    minWidth: 20, height: 20, borderRadius: 999, background: 'var(--lp-brand-600)',
    color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0,
  },
  /* hilo */
  hilo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--lp-bg-base)' },
  hiloHeader: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
    borderBottom: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', flexShrink: 0,
  },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 8, minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-text-secondary)' },
  msgsWrap: { flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 4 },
  diaSep: { alignSelf: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--lp-text-tertiary)', background: 'var(--lp-bg-sunken)', borderRadius: 999, padding: '4px 12px', margin: '10px 0 6px', textTransform: 'uppercase', letterSpacing: '.04em' },
  burbuja: (mio) => ({
    maxWidth: 'min(78%, 520px)', alignSelf: mio ? 'flex-end' : 'flex-start',
    background: mio ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)',
    color: mio ? '#fff' : 'var(--lp-text-primary)',
    border: mio ? 'none' : '1px solid var(--lp-border-subtle)',
    borderRadius: mio ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
    padding: '8px 12px', fontSize: 13.5, lineHeight: 1.45,
    wordBreak: 'break-word', whiteSpace: 'pre-wrap',
  }),
  burbujaDe: { fontSize: 10.5, fontWeight: 700, color: 'var(--lp-brand-700)', marginBottom: 2 },
  burbujaHora: (mio) => ({ fontSize: 9.5, marginTop: 3, textAlign: 'right', color: mio ? 'rgba(255,255,255,.75)' : 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }),
  imgMsg: { maxWidth: '100%', maxHeight: 260, borderRadius: 10, display: 'block', cursor: 'pointer', marginTop: 4 },
  mencion: (mio) => ({ fontWeight: 700, color: mio ? '#fff' : 'var(--lp-brand-700)', background: mio ? 'rgba(255,255,255,.18)' : 'var(--lp-brand-50)', borderRadius: 4, padding: '0 3px' }),
  /* composer */
  composer: { display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', padding: '8px 10px calc(8px + env(safe-area-inset-bottom, 0px))', flexShrink: 0, position: 'relative' },
  composerRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, resize: 'none', padding: '11px 14px',
    borderRadius: 14, border: '1px solid var(--lp-border-subtle)', fontSize: 14,
    fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-base)',
    color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box', lineHeight: 1.4,
  },
  iconBtn: { width: 44, height: 44, borderRadius: 12, border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-text-secondary)', flexShrink: 0 },
  sendBtn: (activo) => ({ width: 44, height: 44, borderRadius: 12, border: 'none', background: activo ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)', cursor: activo ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, transition: 'background .15s' }),
  previewChip: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--lp-bg-sunken)', borderRadius: 10, padding: 6, marginBottom: 8, maxWidth: 220 },
  previewImg: { width: 44, height: 44, objectFit: 'cover', borderRadius: 8 },
  mencionPop: {
    position: 'absolute', bottom: '100%', left: 10, right: 10, marginBottom: 6,
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 14, boxShadow: '0 6px 24px rgba(0,0,0,.14)', overflow: 'hidden', zIndex: 30,
    maxHeight: 220, overflowY: 'auto',
  },
  mencionItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', minHeight: 44, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', textAlign: 'left' },
  cargarMas: { alignSelf: 'center', margin: '2px 0 8px', padding: '8px 16px', minHeight: 36, borderRadius: 999, border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)' },
  /* picker de stickers */
  stickerPop: {
    position: 'absolute', bottom: '100%', left: 10, right: 10, marginBottom: 6,
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 14, boxShadow: '0 6px 24px rgba(0,0,0,.14)', zIndex: 30,
    maxHeight: 300, overflowY: 'auto', padding: '10px 12px 12px',
  },
  stickerSec: { fontSize: 10.5, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '6px 2px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  stickerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 4 },
  stickerBtn: { border: 'none', background: 'none', cursor: 'pointer', borderRadius: 10, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, padding: 4, position: 'relative' },
  stickerImg: { width: 46, height: 46, objectFit: 'contain', display: 'block' },
  stickerDel: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 999, border: 'none', background: 'var(--lp-danger-600)', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 },
  stickerAdd: { border: '1.5px dashed var(--lp-border-strong)', background: 'none', cursor: 'pointer', borderRadius: 10, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-text-tertiary)' },
  /* sticker dentro del hilo (burbuja transparente cuando va solo) */
  burbujaSticker: (mio) => ({
    maxWidth: 'min(78%, 520px)', alignSelf: mio ? 'flex-end' : 'flex-start',
    background: 'transparent', border: 'none', padding: '2px 0',
  }),
  stickerEnMsg: { width: 128, height: 128, objectFit: 'contain', display: 'block' },
  emojiEnMsg: { fontSize: 72, lineHeight: 1.15 },
  vacio: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--lp-text-tertiary)', fontSize: 13, padding: 20, textAlign: 'center' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: '8px 12px', borderRadius: 10, fontSize: 12, margin: '0 10px 8px' },
};

/* Colores de avatar por rol (tokens del DS — sin hex nuevos) */
const AVATAR_ROL = {
  admin: 'var(--lp-brand-100)', tecnico: 'var(--lp-info-100)', compras: 'var(--lp-warning-100)',
  almacen: 'var(--lp-success-100)', recolector: 'var(--lp-bg-sunken)', inventario: 'var(--lp-danger-100)',
};

/* Paquete rápido de stickers (emoji grande, sin assets — se pintan nativos). */
const EMOJI_STICKERS = ['👍','🙏','👏','💪','🤝','❤️','😂','😅','😮','😢','🤔','😴','👀','🫡','🎉','🔥','✅','❌','⚠️','❓','🚚','🎨','🖌️','🪣','📦','☕','🍻','💯'];

const IcoSend = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IcoImg = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
const IcoBack = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>;
const IcoX = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoGrupo = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcoSticker = <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
const IcoPlus = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>;

const inicial = (n) => (n || '?').trim().charAt(0).toUpperCase();
const horaFmt = (f) => f ? new Date(f).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
const diaFmt = (f) => {
  const d = new Date(f); const hoy = new Date();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

const canalDM = (a, b) => 'dm:' + [String(a), String(b)].sort().join('|');

/* Resalta @Nombre de usuarios reales dentro del texto del mensaje. */
function TextoConMenciones({ texto, usuarios, mio }) {
  const partes = useMemo(() => {
    if (!texto || !texto.includes('@')) return [texto];
    /* nombres largos primero para que "Luis Lara" gane sobre "Luis" */
    const nombres = usuarios.map(u => u.nombre).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!nombres.length) return [texto];
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('@(' + nombres.map(esc).join('|') + ')', 'g');
    const out = []; let last = 0; let m;
    while ((m = re.exec(texto)) !== null) {
      if (m.index > last) out.push(texto.slice(last, m.index));
      out.push({ mencion: m[0] });
      last = m.index + m[0].length;
    }
    if (last < texto.length) out.push(texto.slice(last));
    return out;
  }, [texto, usuarios]);
  return partes.map((p, i) =>
    typeof p === 'string' ? p : <span key={i} style={S.mencion(mio)}>{p.mencion}</span>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const chatNotif = useChatNotif();
  const [searchParams, setSearchParams] = useSearchParams();

  const [resumen, setResumen] = useState({ usuarios: [], canales: {}, yo: null });
  const [mensajes, setMensajes] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [texto, setTexto] = useState('');
  const [imagen, setImagen] = useState(null);       /* { base64, preview } */
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState('');
  const [mencionQuery, setMencionQuery] = useState(null); /* string tras '@' o null */
  const [stickers, setStickers] = useState([]);     /* catálogo personalizado */
  const [pickerOpen, setPickerOpen] = useState(false);

  const msgsRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const stickerFileRef = useRef(null);
  const canalRef = useRef(null);

  const esAdmin = user?.rol === 'admin';

  /* Canal activo desde la URL (deep-link de push: /chat?canal=dm:a|b). */
  const canal = searchParams.get('canal') || (isDesktop ? 'general' : null);
  canalRef.current = canal;

  const setCanal = useCallback((c) => {
    const next = new URLSearchParams();
    if (c) next.set('canal', c);
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  const cargarResumen = useCallback(async () => {
    try {
      const r = await api.getChatResumen();
      setResumen({ usuarios: r.usuarios || [], canales: r.canales || {}, yo: r.yo });
    } catch { /* backend viejo / sin red */ }
  }, []);
  useEffect(() => { cargarResumen(); }, [cargarResumen]);

  const cargarStickers = useCallback(() => {
    api.getChatStickers().then(r => setStickers(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { cargarStickers(); }, [cargarStickers]);

  const scrollAbajo = useCallback((suave) => {
    requestAnimationFrame(() => {
      const el = msgsRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
    });
  }, []);

  const marcarLeido = useCallback((c) => {
    api.marcarChatLeido(c).then(() => chatNotif.refresh()).catch(() => {});
  }, [chatNotif]);

  /* Cargar mensajes al cambiar de canal */
  useEffect(() => {
    if (!canal) { setMensajes([]); return; }
    let vivo = true;
    api.getChatMensajes(canal)
      .then(r => {
        if (!vivo) return;
        setMensajes(r.data || []);
        setHayMas(!!r.hayMas);
        setErr('');
        scrollAbajo(false);
        marcarLeido(canal);
        cargarResumen();
      })
      .catch(e => { if (vivo) setErr(humanizeError(e)); });
    return () => { vivo = false; };
  }, [canal]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargarAnteriores = useCallback(async () => {
    if (!canal || !mensajes.length) return;
    try {
      const r = await api.getChatMensajes(canal, mensajes[0].fecha);
      setMensajes(prev => [...(r.data || []), ...prev]);
      setHayMas(!!r.hayMas);
    } catch (e) { setErr(humanizeError(e)); }
  }, [canal, mensajes]);

  /* Realtime: mensaje nuevo → si es del canal abierto, append + leer; si no,
     el resumen actualiza previews y no-leídos. */
  useRealtimeSync({
    onChat: useCallback((payload) => {
      /* Catálogo de stickers cambió (admin subió/eliminó) → recargar. */
      if (payload && payload.evento === 'stickers') { cargarStickers(); return; }
      if (!payload || payload.evento !== 'mensaje' || !payload.mensaje) return;
      const m = payload.mensaje;
      if (payload.canal === canalRef.current) {
        setMensajes(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        scrollAbajo(true);
        if (m.deId !== user?.id) marcarLeido(payload.canal);
      }
      cargarResumen();
    }, [scrollAbajo, marcarLeido, cargarResumen, cargarStickers, user?.id]),
  });

  /* ── Adjuntar imagen ── */
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { setErr('Solo se pueden adjuntar imágenes'); return; }
    if (f.size > 6 * 1024 * 1024) { setErr('La imagen excede 6 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setImagen({ base64: reader.result, preview: reader.result });
    reader.readAsDataURL(f);
    setErr('');
  };

  /* ── Menciones: detectar '@palabra' al final del caret ── */
  const onTexto = (e) => {
    const v = e.target.value;
    setTexto(v);
    const caret = e.target.selectionStart;
    const antes = v.slice(0, caret);
    const m = /@([\wÁÉÍÓÚÑáéíóúñ]*)$/.exec(antes);
    setMencionQuery(m ? m[1] : null);
  };
  const usuariosMencion = useMemo(() => {
    if (mencionQuery == null) return [];
    const q = mencionQuery.toLowerCase();
    /* '@Todos' solo en General: notifica a todo el equipo (id especial '*'). */
    const base = canal === 'general'
      ? [{ id: '*', nombre: 'Todos', rol: 'todo el equipo' }, ...resumen.usuarios]
      : resumen.usuarios;
    return base.filter(u => u.nombre.toLowerCase().includes(q)).slice(0, 7);
  }, [mencionQuery, resumen.usuarios, canal]);

  const insertarMencion = (u) => {
    const el = inputRef.current;
    const caret = el ? el.selectionStart : texto.length;
    const antes = texto.slice(0, caret).replace(/@([\wÁÉÍÓÚÑáéíóúñ]*)$/, '@' + u.nombre + ' ');
    const despues = texto.slice(caret);
    setTexto(antes + despues);
    setMencionQuery(null);
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = antes.length; } });
  };

  /* Menciones efectivas al enviar: cada '@Nombre' presente en el texto.
     '@Todos' (solo General) manda el id especial '*' → push a todo el equipo. */
  const mencionesDe = (t) => {
    const ids = resumen.usuarios.filter(u => t.includes('@' + u.nombre)).map(u => u.id);
    if (canal === 'general' && t.includes('@Todos')) ids.push('*');
    return ids;
  };

  const enviar = async () => {
    if (enviando || !canal) return;
    const t = texto.trim();
    if (!t && !imagen) return;
    setEnviando(true); setErr('');
    try {
      const r = await api.enviarChat({
        canal, texto: t,
        imagenBase64: imagen ? imagen.base64 : undefined,
        menciones: mencionesDe(t),
      });
      if (r?.mensaje) setMensajes(prev => prev.some(x => x.id === r.mensaje.id) ? prev : [...prev, r.mensaje]);
      setTexto(''); setImagen(null); setMencionQuery(null);
      scrollAbajo(true);
      cargarResumen();
    } catch (e) {
      setErr(humanizeError(e));
    } finally { setEnviando(false); }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && isDesktop) { e.preventDefault(); enviar(); }
  };

  /* ── Stickers ── */
  const enviarSticker = async (valor) => {
    if (enviando || !canal) return;
    setPickerOpen(false); setEnviando(true); setErr('');
    try {
      const r = await api.enviarChat({ canal, sticker: valor });
      if (r?.mensaje) setMensajes(prev => prev.some(x => x.id === r.mensaje.id) ? prev : [...prev, r.mensaje]);
      scrollAbajo(true);
      cargarResumen();
    } catch (e) { setErr(humanizeError(e)); }
    finally { setEnviando(false); }
  };

  const onStickerFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { setErr('El sticker debe ser una imagen'); return; }
    if (f.size > 1024 * 1024) { setErr('El sticker excede 1 MB'); return; }
    const nombre = f.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Sticker';
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.subirChatSticker(nombre, reader.result);
        cargarStickers();
      } catch (err2) { setErr(humanizeError(err2)); }
    };
    reader.readAsDataURL(f);
  };

  const eliminarSticker = async (st, e) => {
    e.stopPropagation();
    try { await api.eliminarChatSticker(st.id); cargarStickers(); }
    catch (err2) { setErr(humanizeError(err2)); }
  };

  /* ── Datos de la lista de canales ── */
  const infoCanal = (c) => resumen.canales[c] || { noLeidos: 0, ultimo: null };
  const nombreCanal = (c) => {
    if (c === 'general') return 'General';
    const otro = (c || '').slice(3).split('|').find(id => id !== resumen.yo);
    const u = resumen.usuarios.find(x => x.id === otro);
    return u ? u.nombre : otro || '?';
  };

  /* Orden de DMs: con actividad más reciente primero, luego el resto A-Z. */
  const usuariosOrdenados = useMemo(() => {
    const conFecha = (u) => infoCanal(canalDM(resumen.yo, u.id)).ultimo?.fecha || '';
    return [...resumen.usuarios].sort((a, b) => {
      const fa = conFecha(a), fb = conFecha(b);
      if (fa !== fb) return fb.localeCompare(fa);
      return a.nombre.localeCompare(b.nombre);
    });
  }, [resumen]); // eslint-disable-line react-hooks/exhaustive-deps

  const mostrarLista = isDesktop || !canal;
  const mostrarHilo = isDesktop || !!canal;

  /* ── Render lista ── */
  const Lista = (
    <div style={S.lista(isDesktop)}>
      <div style={S.secTitle}>Canales</div>
      {(() => {
        const info = infoCanal('general');
        return (
          <button type="button" style={S.canalRow(canal === 'general')} data-id="chat.canal.general" onClick={() => setCanal('general')}>
            <span style={{ ...S.avatar('var(--lp-brand-100)'), color: 'var(--lp-brand-700)' }}>{IcoGrupo}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={S.canalNombre}>General</span>
              <div style={S.canalPrev}>
                {info.ultimo ? `${info.ultimo.deNombre}: ${info.ultimo.texto || (info.ultimo.sticker ? 'Sticker' : 'Imagen')}` : 'Mensajes para todo el equipo'}
              </div>
            </span>
            {info.noLeidos > 0 && <span style={S.unread}>{info.noLeidos > 99 ? '99+' : info.noLeidos}</span>}
          </button>
        );
      })()}
      <div style={S.secTitle}>Directos</div>
      {usuariosOrdenados.map(u => {
        const c = canalDM(resumen.yo, u.id);
        const info = infoCanal(c);
        return (
          <button key={u.id} type="button" style={S.canalRow(canal === c)} data-id={`chat.canal.dm.${u.id}`} onClick={() => setCanal(c)}>
            <span style={S.avatar(AVATAR_ROL[u.rol])}>{inicial(u.nombre)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={S.canalNombre}>{u.nombre}</span>
              <div style={S.canalPrev}>
                {info.ultimo
                  ? `${info.ultimo.deId === resumen.yo ? 'Tú: ' : ''}${info.ultimo.texto || (info.ultimo.sticker ? 'Sticker' : 'Imagen')}`
                  : (u.rol || '')}
              </div>
            </span>
            {info.noLeidos > 0 && <span style={S.unread}>{info.noLeidos > 99 ? '99+' : info.noLeidos}</span>}
          </button>
        );
      })}
    </div>
  );

  /* ── Render hilo ── */
  let diaPrev = '';
  const Hilo = !canal ? (
    <div style={{ ...S.hilo, ...(isDesktop ? {} : { display: 'none' }) }}>
      <div style={S.vacio}>{IcoGrupo}<div>Elige un canal o un compañero para empezar a chatear.</div></div>
    </div>
  ) : (
    <div style={S.hilo}>
      <div style={S.hiloHeader}>
        {!isDesktop && (
          <button type="button" style={S.backBtn} onClick={() => setCanal(null)} aria-label="Regresar a la lista">{IcoBack}</button>
        )}
        <span style={canal === 'general' ? { ...S.avatar('var(--lp-brand-100)'), width: 32, height: 32, color: 'var(--lp-brand-700)' } : { ...S.avatar(AVATAR_ROL[(resumen.usuarios.find(u => canalDM(resumen.yo, u.id) === canal) || {}).rol]), width: 32, height: 32, fontSize: 12 }}>
          {canal === 'general' ? IcoGrupo : inicial(nombreCanal(canal))}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--lp-text-primary)' }}>{nombreCanal(canal)}</div>
          <div style={{ fontSize: 10.5, color: 'var(--lp-text-tertiary)' }}>
            {canal === 'general' ? 'Todo el equipo' : 'Chat privado — solo ustedes dos lo ven'}
          </div>
        </div>
      </div>

      <div ref={msgsRef} style={S.msgsWrap}>
        {hayMas && <button type="button" style={S.cargarMas} onClick={cargarAnteriores}>Cargar mensajes anteriores</button>}
        {mensajes.length === 0 && (
          <div style={S.vacio}>Sin mensajes todavía. Escribe el primero.</div>
        )}
        {mensajes.map(m => {
          const mio = m.deId === resumen.yo;
          const dia = diaFmt(m.fecha);
          const sep = dia !== diaPrev; diaPrev = dia;
          /* Sticker SOLO (sin texto/imagen) → burbuja transparente, como en
             cualquier mensajería. Con texto acompaña dentro de la burbuja. */
          const soloSticker = m.sticker && !m.texto && !m.imagen;
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {sep && <div style={S.diaSep}>{dia}</div>}
              <div style={soloSticker ? S.burbujaSticker(mio) : S.burbuja(mio)}>
                {!mio && canal === 'general' && <div style={{ ...S.burbujaDe, ...(soloSticker ? { marginBottom: 0 } : {}) }}>{m.deNombre}</div>}
                {m.sticker && (m.sticker.startsWith('e:')
                  ? <div style={S.emojiEnMsg}>{m.sticker.slice(2)}</div>
                  : <img src={api.chatStickerUrl(m.sticker)} alt="Sticker" style={S.stickerEnMsg} />)}
                {m.texto && <TextoConMenciones texto={m.texto} usuarios={[...resumen.usuarios, { id: resumen.yo, nombre: user?.nombre }, { id: '*', nombre: 'Todos' }]} mio={mio} />}
                {m.imagen && (
                  <img
                    src={api.chatImagenUrl(m.imagen)} alt="Imagen adjunta" style={S.imgMsg}
                    onClick={() => window.open(api.chatImagenUrl(m.imagen), '_blank', 'noopener')}
                    onLoad={() => { const el = msgsRef.current; if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 400) scrollAbajo(false); }}
                  />
                )}
                <div style={{ ...S.burbujaHora(mio), ...(soloSticker ? { color: 'var(--lp-text-tertiary)', textAlign: mio ? 'right' : 'left' } : {}) }}>{horaFmt(m.fecha)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {err && <div style={S.err}>{err}</div>}

      <div style={S.composer}>
        {pickerOpen && (
          <div style={S.stickerPop}>
            {stickers.length > 0 && (
              <>
                <div style={S.stickerSec}><span>Catálogo del equipo</span></div>
                <div style={S.stickerGrid}>
                  {stickers.map(st => (
                    /* div-botón (no <button> anidado — HTML inválido) */
                    <div key={st.id} role="button" tabIndex={0} style={S.stickerBtn} title={st.nombre}
                      data-id={`chat.sticker.${st.id}`} onClick={() => enviarSticker(st.archivo)}
                      onKeyDown={(e) => { if (e.key === 'Enter') enviarSticker(st.archivo); }}>
                      <img src={api.chatStickerUrl(st.archivo)} alt={st.nombre} style={S.stickerImg} loading="lazy" />
                      {esAdmin && (
                        <button type="button" style={S.stickerDel} title="Quitar del catálogo"
                          onClick={(e) => eliminarSticker(st, e)} aria-label={'Eliminar sticker ' + st.nombre}>✕</button>
                      )}
                    </div>
                  ))}
                  {esAdmin && (
                    <button type="button" style={S.stickerAdd} title="Agregar sticker al catálogo (imagen ≤1 MB)"
                      data-id="chat.sticker.agregar" onClick={() => stickerFileRef.current?.click()}>{IcoPlus}</button>
                  )}
                </div>
              </>
            )}
            {stickers.length === 0 && esAdmin && (
              <>
                <div style={S.stickerSec}><span>Catálogo del equipo</span></div>
                <button type="button" style={{ ...S.stickerAdd, width: '100%', gap: 8, fontSize: 12, fontWeight: 600, fontFamily: 'var(--lp-font-sans)' }}
                  data-id="chat.sticker.agregar" onClick={() => stickerFileRef.current?.click()}>
                  {IcoPlus} Agregar el primer sticker (imagen ≤1 MB)
                </button>
              </>
            )}
            <div style={S.stickerSec}><span>Rápidos</span></div>
            <div style={S.stickerGrid}>
              {EMOJI_STICKERS.map(em => (
                <button key={em} type="button" style={S.stickerBtn} onClick={() => enviarSticker('e:' + em)}>{em}</button>
              ))}
            </div>
          </div>
        )}
        {mencionQuery != null && usuariosMencion.length > 0 && (
          <div style={S.mencionPop}>
            {usuariosMencion.map(u => (
              <button key={u.id} type="button" style={S.mencionItem} onClick={() => insertarMencion(u)}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--lp-brand-50)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
                <span style={{ ...S.avatar(AVATAR_ROL[u.rol]), width: 28, height: 28, fontSize: 11 }}>{inicial(u.nombre)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lp-text-primary)' }}>{u.nombre}</span>
                <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginLeft: 'auto', textTransform: 'capitalize' }}>{u.rol}</span>
              </button>
            ))}
          </div>
        )}
        {imagen && (
          <div style={S.previewChip}>
            <img src={imagen.preview} alt="" style={S.previewImg} />
            <span style={{ fontSize: 11, color: 'var(--lp-text-secondary)' }}>Imagen lista</span>
            <button type="button" onClick={() => setImagen(null)} style={{ ...S.iconBtn, width: 28, height: 28, border: 'none' }} aria-label="Quitar imagen">{IcoX}</button>
          </div>
        )}
        <div style={S.composerRow}>
          <button type="button" style={{ ...S.iconBtn, ...(pickerOpen ? { color: 'var(--lp-brand-600)', borderColor: 'var(--lp-brand-600)' } : {}) }}
            data-id="chat.btn.stickers" onClick={() => setPickerOpen(o => !o)} aria-label="Stickers" aria-expanded={pickerOpen}>{IcoSticker}</button>
          <button type="button" style={S.iconBtn} data-id="chat.btn.imagen" onClick={() => fileRef.current?.click()} aria-label="Adjuntar imagen">{IcoImg}</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
          <input ref={stickerFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onStickerFile} />
          <textarea
            ref={inputRef} rows={1} style={S.input} value={texto}
            placeholder={canal === 'general' ? 'Mensaje para todos… usa @ para mencionar' : 'Escribe un mensaje…'}
            onChange={onTexto} onKeyDown={onKeyDown} data-id="chat.input.texto"
          />
          <button type="button" style={S.sendBtn(!enviando && (texto.trim() || imagen))} data-id="chat.btn.enviar"
            onClick={enviar} disabled={enviando || (!texto.trim() && !imagen)} aria-label="Enviar mensaje">
            {IcoSend}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <TopBar title="Chat" />
      <div style={S.shell(isDesktop)}>
        {mostrarLista && Lista}
        {mostrarHilo && Hilo}
      </div>
    </div>
  );
}
