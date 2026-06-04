import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const ToastContext = createContext(null);

const TYPE_STYLES = {
  ok:      { bg: 'var(--lp-success-600)', fg: '#fff' },
  success: { bg: 'var(--lp-success-600)', fg: '#fff' },
  err:     { bg: 'var(--lp-danger-600)', fg: '#fff' },
  error:   { bg: 'var(--lp-danger-600)', fg: '#fff' },
  warn:    { bg: 'var(--lp-warning-600)', fg: '#fff' },
  warning: { bg: 'var(--lp-warning-600)', fg: '#fff' },
  info:    { bg: 'var(--lp-brand-600)', fg: '#fff' },
};

let _toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /* Función base — soporta dos firmas para retro-compat:
       toast(msg, type, duration)                        [legacy]
       toast(msg, { type, duration, action })            [moderno]
       toast.info(msg, { duration, action })             [helpers] */
  const baseToast = useCallback((msg, typeOrOpts = 'ok', durationLegacy = 4000) => {
    let opts = {};
    if (typeof typeOrOpts === 'string') {
      opts = { type: typeOrOpts, duration: durationLegacy };
    } else if (typeOrOpts && typeof typeOrOpts === 'object') {
      opts = typeOrOpts;
    }
    const id = ++_toastId;
    const duration = opts.duration || 4000;
    setToasts(prev => [...prev, { id, msg, type: opts.type || 'ok', action: opts.action }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    return id;
  }, []);

  /* Wrapper que expone tanto la función base como los helpers .info/.success/etc. */
  const toast = useMemo(() => {
    const fn = (msg, type, dur) => baseToast(msg, type, dur);
    fn.info    = (msg, opts = {}) => baseToast(msg, { ...opts, type: 'info' });
    fn.success = (msg, opts = {}) => baseToast(msg, { ...opts, type: 'success' });
    fn.warning = (msg, opts = {}) => baseToast(msg, { ...opts, type: 'warning' });
    fn.error   = (msg, opts = {}) => baseToast(msg, { ...opts, type: 'error' });
    return fn;
  }, [baseToast]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed',
        /* Bottom dinámico: altura del bottom-nav (56px) + safe-area + margen.
           Antes era 88px hardcoded y quedaba tapado en iPhones con notch. */
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none', maxWidth: 'calc(100vw - 32px)', width: 460,
      }}>
        {toasts.map(t => {
          const style = TYPE_STYLES[t.type] || TYPE_STYLES.ok;
          return (
            <div key={t.id} style={{
              background: style.bg, color: style.fg,
              padding: '12px 16px', borderRadius: 8,
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--lp-font-sans)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              display: 'flex', alignItems: 'center', gap: 12,
              pointerEvents: 'auto',
            }}>
              <div style={{ flex: 1 }}>{t.msg}</div>
              {t.action && (
                <button onClick={() => { t.action.onClick?.(); dismiss(t.id); }}
                  style={{
                    background: 'rgba(255,255,255,0.2)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.3)',
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>{t.action.label}</button>
              )}
              <button onClick={() => dismiss(t.id)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
