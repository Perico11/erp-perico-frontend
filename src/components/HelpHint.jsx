import { useEffect, useState } from 'react';

/**
 * HelpHint — banner discreto con un tip por pantalla.
 * Persiste en localStorage que el usuario lo descartó (clave única por id).
 *
 * Props:
 *   id: string único (p.ej. "dashboard-pendientes")
 *   title: título corto (opcional)
 *   children: cuerpo del tip (puede llevar JSX)
 *   variant: 'info' | 'warning' (default 'info')
 *   showAlways: si true, ignora localStorage y siempre se muestra (raro)
 */
export default function HelpHint({ id, title, children, variant = 'info', showAlways = false }) {
  const storageKey = 'hint_seen_' + (id || 'default');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (showAlways) return setVisible(true);
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) setVisible(true);
    } catch { setVisible(true); }
  }, [storageKey, showAlways]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(storageKey, '1'); } catch {}
  };

  const palette = variant === 'warning' ? {
    bg: 'var(--lp-warning-50)',
    border: 'var(--lp-warning-300)',
    fg: 'var(--lp-warning-700)',
    icon: 'var(--lp-warning-600)',
  } : {
    bg: 'var(--lp-info-50)',
    border: 'var(--lp-info-200, var(--lp-border-subtle))',
    fg: 'var(--lp-info-700)',
    icon: 'var(--lp-info-600)',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      background: palette.bg,
      border: `1.5px solid ${palette.border}`,
      borderRadius: 'var(--lp-radius)',
      padding: '12px 14px',
      marginBottom: 14,
      fontSize: 12,
      color: 'var(--lp-text-secondary)',
      lineHeight: 1.5,
      fontFamily: 'var(--lp-font-sans)',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={palette.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontWeight: 700, color: palette.fg, marginBottom: 4, fontSize: 13 }}>{title}</div>}
        <div>{children}</div>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: 'none',
          border: 'none',
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 600,
          color: palette.fg,
          cursor: 'pointer',
          borderRadius: 6,
          fontFamily: 'inherit',
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,.04)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
      >
        Entendido ✓
      </button>
    </div>
  );
}

/**
 * Componente para reset de todos los hints (útil para Configuración o testing).
 * NO navega ni hace alert intrusivo: solo limpia localStorage y muestra confirmación
 * inline temporal. El usuario se queda en la misma pantalla.
 */
export function ResetAllHints() {
  const [done, setDone] = useState(false);

  const reset = (e) => {
    /* Prevenir cualquier navegación accidental */
    e?.preventDefault?.();
    e?.stopPropagation?.();
    Object.keys(localStorage)
      .filter(k => k.startsWith('hint_seen_'))
      .forEach(k => localStorage.removeItem(k));
    setDone(true);
    /* Restaurar el estado del botón después de 3s */
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <button
      type="button"
      onClick={reset}
      style={{
        padding: '6px 12px', fontSize: 12, fontWeight: 600,
        background: done ? 'var(--lp-success-100)' : 'var(--lp-bg-base)',
        color: done ? 'var(--lp-success-700)' : 'var(--lp-text-secondary)',
        border: '1.5px solid ' + (done ? 'var(--lp-success-300, var(--lp-success-600))' : 'var(--lp-border-subtle)'),
        borderRadius: 'var(--lp-radius-sm)', cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background .2s, color .2s, border-color .2s',
      }}
    >
      {done ? '✓ Reseteado · navega a otra pantalla para ver los tips' : 'Mostrar tips de nuevo'}
    </button>
  );
}
