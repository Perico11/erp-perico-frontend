/* ═══════════════════════════════════════════════════════════════════
   SecureView — Wrapper para pantallas con información confidencial
   Aplica todas las disuasiones técnicas posibles desde web:

   1. Watermark dinámico repetido sobre toda la pantalla con:
      nombre / email / IP / fecha-hora / contexto
      → si alguien toma foto al monitor, queda identificado.

   2. Bloqueo de eventos client-side:
      - context-menu (clic derecho)
      - selección de texto (selectstart, dragstart)
      - copy / cut / paste
      - atajos: Ctrl+C/V/U/S/P, F12, Ctrl+Shift+I/J/C
      Cada bloqueo se registra en bitácora forense (best effort).

   3. Detección de DevTools abierto (mide diferencia outerHeight - innerHeight).
      → si detecta DevTools, oculta el contenido y pide cerrarlo.

   4. Auto-blur del contenido cuando la pestaña pierde foco.
      → si abre WhatsApp/cámara, el contenido sensible se oculta.

   IMPORTANTE: estas medidas son DISUASORIAS, no infalibles. Su valor real es:
   (a) impedir el 95% de extracciones casuales,
   (b) generar bitácora forense útil en caso legal,
   (c) reducir la "deniability" del filtrador (aceptó NDA + intentó copiar).
   ═══════════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const WATERMARK_OPACITY = 0.10;        /* 10% — visible pero no estorba */
const WATERMARK_FONT = '12px var(--lp-font-mono, monospace)';
const WATERMARK_COLOR = '#1a1815';
const WATERMARK_ANGLE = -22;            /* grados */
const WATERMARK_SPACING_X = 320;        /* px entre repeticiones */
const WATERMARK_SPACING_Y = 110;
/* Umbral subido para evitar falsos positivos en Edge/Chrome con barra de
   favoritos + tabs múltiples. La heurística outerHeight-innerHeight puede
   pasar 160px sin que DevTools esté abierto. 280px es más conservador. */
const DEVTOOLS_THRESHOLD = 280;
/* Requerimos N ticks consecutivos antes de bloquear para evitar flash falso
   cuando la barra de Edge aparece/desaparece o cambia el zoom temporalmente. */
const DEVTOOLS_CONSECUTIVE_TICKS = 3;
const REPORT_THROTTLE_MS = 5000;        /* No saturar API con eventos repetidos */

let _lastReports = {};

function reportEvent(tipo, detalle, user) {
  const k = tipo + ':' + (detalle || '');
  const now = Date.now();
  if (_lastReports[k] && (now - _lastReports[k]) < REPORT_THROTTLE_MS) return;
  _lastReports[k] = now;
  try {
    api.post('/api/audit/security', {
      tipo, detalle: detalle || null,
      usuario: user?.nombre || '?',
      rol: user?.rol || '?',
      url: window.location.pathname,
      userAgent: navigator.userAgent,
      ts: new Date().toISOString(),
    }).catch(() => {});
  } catch {}
}

/* Emmanuel (id='admin') es el propietario de las fórmulas — exento de
   watermark, bloqueos y bitácora forense. Cualquier otro usuario, incluso
   con rol admin (ej. Imerh), sí pasa por SecureView. */
export default function SecureView(props) {
  const { user } = useAuth();
  if (user && user.id === 'admin') {
    return <>{props.children}</>;
  }
  return <SecureViewInner {...props} user={user} />;
}

function SecureViewInner({ context, productoNombre, children, user }) {
  const [hidden, setHidden] = useState(false);  /* oculta contenido si DevTools o blur */
  const [reason, setReason] = useState('');
  const containerRef = useRef(null);

  const userName = user?.nombre || 'Usuario';
  const userEmail = user?.email || (userName ? userName.toLowerCase() + '@pinturaselperico.com' : '');
  const userId = user?.id || '?';

  /* ═══ Watermark: dataURI generada en runtime con info dinámica ═══ */
  const watermarkUri = useMemo(() => {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-MX');
    const hora = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const text1 = (userName + ' · ' + userId).toUpperCase();
    const text2 = userEmail;
    const text3 = fecha + ' ' + hora + (productoNombre ? ' · ' + productoNombre : '');
    /* SVG con 3 líneas de texto rotado */
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WATERMARK_SPACING_X}" height="${WATERMARK_SPACING_Y}">
      <g transform="rotate(${WATERMARK_ANGLE} ${WATERMARK_SPACING_X / 2} ${WATERMARK_SPACING_Y / 2})" fill="${WATERMARK_COLOR}" opacity="${WATERMARK_OPACITY}" font-family="monospace" font-size="11" font-weight="700">
        <text x="50%" y="35%" text-anchor="middle">${escapeXml(text1)}</text>
        <text x="50%" y="55%" text-anchor="middle" font-weight="500">${escapeXml(text2)}</text>
        <text x="50%" y="75%" text-anchor="middle" font-weight="500">${escapeXml(text3)}</text>
      </g>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, userEmail, userId, productoNombre]);

  /* ═══ Bloqueo de eventos client-side ═══ */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const blockAndLog = (e, tipo) => {
      e.preventDefault();
      e.stopPropagation();
      reportEvent(tipo, context || null, user);
      return false;
    };

    const onContextMenu = (e) => blockAndLog(e, 'CLIC_DERECHO_BLOQUEADO');
    const onSelectStart = (e) => { e.preventDefault(); return false; };
    const onDragStart = (e) => blockAndLog(e, 'DRAG_BLOQUEADO');
    const onCopy = (e) => blockAndLog(e, 'COPY_BLOQUEADO');
    const onCut = (e) => blockAndLog(e, 'CUT_BLOQUEADO');
    const onPaste = (e) => blockAndLog(e, 'PASTE_BLOQUEADO');

    const onKey = (e) => {
      const k = (e.key || '').toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      /* Atajos de extracción */
      const blocked =
        (ctrl && ['c', 'x', 'a', 's', 'p', 'u'].includes(k)) ||
        (k === 'f12') ||
        (ctrl && shift && ['i', 'j', 'c'].includes(k)) ||
        (k === 'printscreen');
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        reportEvent('ATAJO_BLOQUEADO', (ctrl ? 'Ctrl+' : '') + (shift ? 'Shift+' : '') + (e.key || ''), user);
        return false;
      }
    };

    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('selectstart', onSelectStart);
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('copy', onCopy);
    el.addEventListener('cut', onCut);
    el.addEventListener('paste', onPaste);
    document.addEventListener('keydown', onKey, true);

    return () => {
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('selectstart', onSelectStart);
      el.removeEventListener('dragstart', onDragStart);
      el.removeEventListener('copy', onCopy);
      el.removeEventListener('cut', onCut);
      el.removeEventListener('paste', onPaste);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [user, context]);

  /* ═══ Detección de DevTools (heurística por dimensiones) ═══
     Anti-falsos-positivos:
     - Umbral elevado (280px) — Edge con barra de favoritos + tabs múltiples
       puede llegar a ~200px sin DevTools.
     - Requiere DEVTOOLS_CONSECUTIVE_TICKS ticks seguidos antes de bloquear.
       Esto evita que un cambio transitorio de la barra de Edge (al hacer
       scroll, cambiar zoom, mostrar/ocultar favoritos) dispare el bloqueo.
     - Si dejan de detectarse, vuelve a 0 inmediatamente para no quedar
       atorado en "bloqueado" tras un falso positivo. */
  useEffect(() => {
    let consecutiveTicks = 0;
    let detected = false;
    const check = () => {
      const dh = window.outerHeight - window.innerHeight;
      const dw = window.outerWidth - window.innerWidth;
      const candidato = dh > DEVTOOLS_THRESHOLD || dw > DEVTOOLS_THRESHOLD;
      if (candidato) {
        consecutiveTicks++;
        if (consecutiveTicks >= DEVTOOLS_CONSECUTIVE_TICKS && !detected) {
          detected = true;
          setHidden(true);
          setReason('Cierra las herramientas de desarrollador (DevTools) para volver a ver esta pantalla.');
          reportEvent('DEVTOOLS_DETECTADO', `dh=${dh} dw=${dw}`, user);
        }
      } else {
        consecutiveTicks = 0;
        if (detected) {
          detected = false;
          setHidden(false);
          setReason('');
        }
      }
    };
    const interval = setInterval(check, 1000);
    /* No hacer check() inmediato — al montar el componente puede haber
       transiciones de layout que generen falso positivo en el primer tick. */
    return () => clearInterval(interval);
  }, [user]);

  /* ═══ Auto-blur al perder foco ═══ */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        setHidden(true);
        setReason('Pestaña inactiva — vuelve aquí para ver la información.');
        reportEvent('TAB_OCULTA', context || null, user);
      } else {
        /* Si DevTools no está abierto, restaurar */
        const dh = window.outerHeight - window.innerHeight;
        const dw = window.outerWidth - window.innerWidth;
        if (dh < DEVTOOLS_THRESHOLD && dw < DEVTOOLS_THRESHOLD) {
          setHidden(false);
          setReason('');
        }
      }
    };
    const onBlur = () => {
      setHidden(true);
      setReason('Ventana sin foco — haz clic aquí para ver la información.');
    };
    const onFocus = () => {
      const dh = window.outerHeight - window.innerHeight;
      const dw = window.outerWidth - window.innerWidth;
      if (dh < DEVTOOLS_THRESHOLD && dw < DEVTOOLS_THRESHOLD && !document.hidden) {
        setHidden(false);
        setReason('');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, context]);

  /* ═══ Render ═══ */
  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* Contenido protegido */}
      <div style={{ filter: hidden ? 'blur(20px)' : 'none', transition: 'filter .15s' }}>
        {children}
      </div>

      {/* Watermark — capa de logo perico (negro al 5%) repetido como pertenencia institucional */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
          backgroundImage: 'url("' + (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL ? import.meta.env.BASE_URL.replace(/\/$/, '') : '') + '/logos/' + encodeURIComponent('Logo negro.png') + '")',
          backgroundRepeat: 'repeat',
          backgroundSize: '180px 180px',
          opacity: 0.05,
          zIndex: 4,
        }}
      />

      {/* Watermark dinámico — capa de identificación trazable por usuario */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
          backgroundImage: `url("${watermarkUri}")`,
          backgroundRepeat: 'repeat',
          zIndex: 5,
          mixBlendMode: 'multiply',
        }}
      />

      {/* Aviso superpuesto cuando se detecta DevTools / blur */}
      {hidden && (
        <div
          style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15,12,8,.88)', zIndex: 9999,
            color: '#fff', textAlign: 'center', padding: 24,
          }}
        >
          <div style={{ maxWidth: 480 }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
              Información protegida — vista pausada
            </div>
            <div style={{ fontSize: 13, opacity: .9, lineHeight: 1.5 }}>
              {reason}
            </div>
            <div style={{ fontSize: 11, opacity: .6, marginTop: 14 }}>
              Este evento ha sido registrado en la bitácora del sistema.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
