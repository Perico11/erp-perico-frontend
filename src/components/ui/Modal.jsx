/* Modal — base + ConfirmModal con soporte opcional para prompt (textarea/input).
   Refactorizado a estilos inline con tokens LP para garantizar que el overlay
   sea visible. Antes usaba clases Tailwind (bg-raised, bg-brand-700, bg-black/55)
   que podían no compilar si la config Tailwind no tenía las extensiones, dejando
   el modal transparente. */
import { useEffect, useRef, useState } from 'react';
import Button from './Button';

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(15, 12, 8, 0.6)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
    fontFamily: 'var(--lp-font-sans)',
    /* MÓVIL: permitir que el overlay haga scroll si el modal es muy alto. */
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    /* CRÍTICO contraste: si el SO está en modo oscuro, iOS Safari y Chrome
       Android invierten los colores de los form elements (input/textarea)
       y los renderizan en oscuro aunque tengamos --lp-bg-raised:#fff. Esto
       causa "letras blancas sobre fondo blanco". Forzamos light scheme. */
    colorScheme: 'light',
  },
  dialog: (maxWidthPx) => ({
    /* Hex explícitos para inmunidad al dark mode del SO en móvil. */
    background: 'var(--lp-bg-raised)',
    color: '#1A1815',
    borderRadius: 'var(--lp-radius)',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
    width: '100%',
    maxWidth: maxWidthPx,
    /* CRÍTICO MÓVIL: 100dvh es "dynamic viewport height" — se contrae cuando
       el teclado virtual aparece. Con 100vh el modal se sale de pantalla y
       los botones quedan ocultos detrás del teclado (= "no funciona").
       Fallback a 100vh para navegadores viejos. */
    maxHeight: 'calc(100vh - 32px)',
    maxBlockSize: 'calc(100dvh - 32px)',
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    animation: 'modalIn 0.18s cubic-bezier(0.32, 0.72, 0, 1)',
    colorScheme: 'light',
  }),
  header: {
    background: 'var(--lp-brand-700)',
    color: '#fff',
    padding: '14px 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  title: { fontSize: 15, fontWeight: 700, margin: 0 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 6,
    background: 'rgba(255,255,255,0.15)',
    color: '#fff', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, lineHeight: 1,
    transition: 'background 0.15s',
  },
  body: {
    padding: '18px 20px',
    overflowY: 'auto',
    flex: 1,
    /* Hex explícito — el dark mode del SO no puede invertir esto. */
    background: 'var(--lp-bg-raised)',
    color: '#1A1815',
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid #E5E1DA',
    display: 'flex', gap: 8, justifyContent: 'flex-end',
    flexShrink: 0,
    background: '#FAFAF8',
  },
  message: {
    fontSize: 14, color: '#5A5550',
    lineHeight: 1.5,
    margin: 0,
  },
  promptLabel: {
    display: 'block', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.04em',
    color: '#5A5550',
    marginBottom: 6,
  },
  promptRequired: { color: '#DC2626' },
  textarea: (hasErr) => ({
    width: '100%', padding: '10px 12px',
    border: '1.5px solid ' + (hasErr ? '#DC2626' : '#E5E1DA'),
    borderRadius: 'var(--lp-radius-sm)',
    /* MÓVIL: 16px previene el zoom-on-focus de iOS Safari (zooms si <16px). */
    fontSize: 16, fontFamily: 'var(--lp-font-sans)',
    /* HEX EXPLÍCITO (no tokens) para inmunidad al dark mode del SO. */
    background: 'var(--lp-bg-raised)', color: '#1A1815',
    resize: 'vertical', minHeight: 80, boxSizing: 'border-box',
    outline: 'none',
    colorScheme: 'light',
  }),
  inputLine: (hasErr, numeric) => ({
    width: '100%', padding: '12px 14px',
    border: '1.5px solid ' + (hasErr ? '#DC2626' : '#E5E1DA'),
    borderRadius: 'var(--lp-radius-sm)',
    /* MÓVIL: 16px previene zoom-on-focus de iOS Safari. */
    fontSize: 16,
    fontFamily: numeric ? 'var(--lp-font-mono)' : 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: '#1A1815',
    boxSizing: 'border-box', outline: 'none',
    letterSpacing: numeric ? '0.3em' : 'normal',
    textAlign: numeric ? 'center' : 'left',
    colorScheme: 'light',
  }),
  errorBox: {
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    padding: 8, borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12, marginTop: 8,
  },
  charCount: {
    fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4,
  },
};

/* Inject keyframes una sola vez */
if (typeof document !== 'undefined' && !document.getElementById('__modal_keyframes__')) {
  const style = document.createElement('style');
  style.id = '__modal_keyframes__';
  style.textContent = `@keyframes modalIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`;
  document.head.appendChild(style);
}

export default function Modal({ open, onClose, title, children, footer, maxWidth = 448 }) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const el = dialogRef.current;
    const focusable = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    /* Solo hacemos focus automático en desktop (mouse). En móvil táctil,
       enfocar abre el teclado virtual antes de pintar el modal y los botones
       quedan ocultos detrás del teclado (= "no funciona"). En móvil el usuario
       toca el input cuando ya ve el modal completo. */
    const isTouch = typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    if (!isTouch && focusable.length) focusable[0].focus();
    const trap = (e) => {
      if (e.key !== 'Tab' || !focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    el.addEventListener('keydown', trap);
    return () => el.removeEventListener('keydown', trap);
  }, [open]);

  if (!open) return null;

  /* Soporta maxWidth como número o como string Tailwind legacy (max-w-md → 448) */
  const maxWidthPx = typeof maxWidth === 'number' ? maxWidth :
    maxWidth === 'max-w-sm' ? 384 :
    maxWidth === 'max-w-md' ? 448 :
    maxWidth === 'max-w-lg' ? 512 :
    maxWidth === 'max-w-xl' ? 576 : 448;

  return (
    <div
      ref={overlayRef}
      style={S.overlay}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={S.dialog(maxWidthPx)}
      >
        <div style={S.header}>
          <h3 style={S.title}>{title}</h3>
          <button
            onClick={onClose}
            style={S.closeBtn}
            aria-label="Cerrar"
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          >×</button>
        </div>
        <div style={S.body}>{children}</div>
        {footer && <div style={S.footer}>{footer}</div>}
      </div>
    </div>
  );
}

/** Modal de confirmación rápido — soporta opcionalmente prompt con textarea o input.
    Si se pasa `prompt`, se renderiza el campo obligatorio (con minLength validable).
    onConfirm recibe el texto cuando prompt está activo, sino solo se llama sin args. */
export function ConfirmModal({ open, onClose, onConfirm, title = 'Confirmar', message,
  confirmText = 'Confirmar', danger = false, prompt = null }) {
  const [texto, setTexto] = useState('');
  const [err, setErr] = useState('');

  /* Reset al abrir/cerrar */
  useEffect(() => { if (!open) { setTexto(''); setErr(''); } }, [open]);

  const handleConfirm = () => {
    if (prompt) {
      const minLen = prompt.minLength || 0;
      const requerido = prompt.required !== false; /* default true */
      const valor = texto.trim();
      if (requerido && !valor) { setErr('Este campo es obligatorio'); return; }
      if (minLen > 0 && valor.length < minLen) {
        setErr(`Mínimo ${minLen} caracteres (van ${valor.length})`); return;
      }
      onConfirm(valor);
    } else {
      onConfirm();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={handleConfirm}>{confirmText}</Button>
        </>
      }
    >
      {message && <p style={{ ...S.message, marginBottom: prompt ? 12 : 0 }}>{message}</p>}
      {prompt && (
        <div style={{ marginTop: 4 }}>
          <label style={S.promptLabel}>
            {prompt.label || 'Motivo'}
            {prompt.required !== false && <span style={S.promptRequired}> *</span>}
          </label>
          {prompt.rows === 1 ? (
            <input
              type={prompt.password ? 'password' : 'text'}
              inputMode={prompt.numeric ? 'numeric' : undefined}
              pattern={prompt.numeric ? '[0-9]*' : undefined}
              value={texto}
              onChange={e => { setTexto(e.target.value); if (err) setErr(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder={prompt.placeholder || ''}
              maxLength={prompt.maxLength || undefined}
              /* SIN autoFocus — en iOS Safari rompe el render del modal y deja
                 los botones fuera de pantalla. El user toca el input cuando ya
                 ve el modal completo. */
              autoComplete="off"
              style={S.inputLine(!!err, !!prompt.numeric)}
            />
          ) : (
            <textarea
              value={texto}
              onChange={e => { setTexto(e.target.value); if (err) setErr(''); }}
              placeholder={prompt.placeholder || 'Escribe el motivo...'}
              rows={prompt.rows || 4}
              style={S.textarea(!!err)}
            />
          )}
          {prompt.minLength > 0 && (
            <div style={S.charCount}>
              {texto.trim().length} / mín {prompt.minLength} caracteres
            </div>
          )}
          {err && <div style={S.errorBox}>{err}</div>}
        </div>
      )}
    </Modal>
  );
}
