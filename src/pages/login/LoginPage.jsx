import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';
import { getActiveTheme, toggleTheme } from '../../utils/theme';

/* ═══════════════════════════════════════════════════════════════════════
   LoginPage — reskin verde "Claude Design" (jun 2026)
   1:1 con mockup: "Inicio de sesión final.html".

   VISUAL: tema verde (--lp-*), DM Sans, claro+oscuro, sin emojis (SVG line),
   toggle de tema arriba-derecha, logo, paso 1 = usuario (campo de texto con
   icono), paso 2 = PIN (back + mini-avatar + 4 dots + shake en error + keypad
   circular con icono delete), overlay de éxito con check.

   LÓGICA INTACTA: el flujo de auth real no se toca. login(nombre,pin) sigue
   llamando a la API de sesión (header x-session-token lo pone services/api.js).
   El error fuera de horario (mensaje del backend, p.ej. "hours") y cualquier
   bloqueo por intentos llegan como err.message y se muestran genéricos.
   ═══════════════════════════════════════════════════════════════════════ */

/* Login = full-screen centrado, igual en móvil y escritorio. El mockup no
   diverge por ancho (mismo card 360px centrado), así que no se usa useIsDesktop. */
const S = {
  page: {
    minHeight: '100dvh',
    width: '100%',
    maxWidth: '100vw',
    /* fondo calm: glow verde sutil arriba sobre la base. Flipea solo con tokens
       en modo oscuro (mint sobre fondo oscuro). */
    background: 'radial-gradient(125% 80% at 50% -5%, color-mix(in srgb, var(--lp-brand-600) 8%, var(--lp-bg-base)) 0%, var(--lp-bg-base) 58%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 'clamp(16px, 6vw, 24px)',
    fontFamily: 'var(--lp-font-sans)',
    color: 'var(--lp-text-primary)',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    WebkitFontSmoothing: 'antialiased',
  },
  app: {
    width: '100%', maxWidth: 360, position: 'relative',
    boxSizing: 'border-box',
  },

  /* Toggle tema — arriba derecha, ≥44px touch */
  toggle: {
    position: 'absolute', top: -6, right: 0,
    width: 44, height: 44, borderRadius: '50%',
    background: 'color-mix(in srgb, var(--lp-text-primary) 5%, transparent)',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--lp-text-secondary)', zIndex: 5,
    WebkitTapHighlightColor: 'transparent',
  },

  /* Marca */
  brand: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 14, margin: '30px 0 8px',
  },
  logoFallback: {
    width: 60, height: 60, borderRadius: 14,
    background: 'linear-gradient(135deg, var(--lp-brand-500), var(--lp-brand-700))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 26, fontWeight: 700,
  },

  title: {
    fontSize: 20, fontWeight: 600, letterSpacing: '-.01em',
    textAlign: 'center', color: 'var(--lp-text-primary)',
  },
  sub: {
    fontSize: 13.5, color: 'var(--lp-text-secondary)',
    textAlign: 'center', marginTop: 4,
  },

  /* Paso 1 — usuario */
  step1: { marginTop: 26 },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 26 },
  field: {
    display: 'flex', alignItems: 'center', gap: 11,
    height: 54, padding: '0 16px', borderRadius: 14,
    background: 'color-mix(in srgb, var(--lp-text-primary) 1.5%, transparent)',
    border: '1.5px solid var(--lp-border-subtle)',
    transition: 'border-color .2s',
    boxSizing: 'border-box',
  },
  fieldFocus: { borderColor: 'var(--lp-brand-600)' },
  fieldIcon: { color: 'var(--lp-text-secondary)', flexShrink: 0, display: 'flex' },
  input: {
    flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none',
    fontFamily: 'inherit', fontSize: 16, color: 'var(--lp-text-primary)',
    padding: 0,
  },
  continue: {
    height: 54, borderRadius: 14, border: 'none',
    background: 'var(--lp-brand-600)', color: '#fff', marginTop: 6,
    fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    transition: 'filter .2s, transform .1s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    WebkitTapHighlightColor: 'transparent',
  },
  continueDisabled: { opacity: 0.45, cursor: 'not-allowed' },

  /* Paso 2 — PIN */
  step2: {
    marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  back: {
    position: 'absolute', top: -6, left: 0,
    width: 44, height: 44, borderRadius: '50%',
    background: 'color-mix(in srgb, var(--lp-text-primary) 4%, transparent)',
    border: '1px solid var(--lp-border-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--lp-text-secondary)', flexShrink: 0, zIndex: 5,
    WebkitTapHighlightColor: 'transparent',
  },
  pinTop: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 11, width: '100%', marginBottom: 14,
  },
  miniAv: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'var(--lp-brand-600)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 600, flexShrink: 0,
  },
  uName: {
    display: 'block', fontSize: 15, fontWeight: 500, lineHeight: 1.15,
    color: 'var(--lp-text-primary)', textAlign: 'left',
  },
  dots: { display: 'flex', gap: 15, margin: '26px 0 4px' },
  dot: {
    width: 13, height: 13, borderRadius: '50%',
    border: '1.5px solid color-mix(in srgb, var(--lp-brand-600) 45%, transparent)',
    background: 'transparent',
    transition: 'all .3s cubic-bezier(.34,1.56,.64,1)',
  },
  dotOn: {
    width: 13, height: 13, borderRadius: '50%',
    border: '1.5px solid var(--lp-brand-600)',
    background: 'var(--lp-brand-600)',
    transform: 'scale(1.06)',
    transition: 'all .3s cubic-bezier(.34,1.56,.64,1)',
  },
  /* Slot de altura fija: error/loading no desplazan el keypad */
  feedbackSlot: {
    minHeight: 18, marginTop: 8, marginBottom: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%',
  },
  errmsg: { fontSize: 13, color: 'var(--lp-danger-600)', fontWeight: 600, textAlign: 'center' },
  loadingTxt: { fontSize: 13, color: 'var(--lp-text-tertiary)', textAlign: 'center' },

  keypad: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10, width: '100%', marginTop: 8,
  },
  key: {
    height: 64, minHeight: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit', fontSize: 26, fontWeight: 400,
    color: 'var(--lp-text-primary)', cursor: 'pointer',
    background: 'transparent', border: 'none', borderRadius: 16,
    transition: 'transform .1s, background .15s',
    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
  },
  keyFn: {
    height: 64, minHeight: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', borderRadius: 16,
    color: 'var(--lp-text-tertiary)', cursor: 'pointer',
    transition: 'transform .1s, background .15s',
    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
  },
  pinFoot: {
    marginTop: 14, minHeight: 44, fontSize: 13, fontWeight: 500,
    color: 'var(--lp-brand-600)', background: 'none', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    WebkitTapHighlightColor: 'transparent',
  },

  /* Éxito */
  success: {
    position: 'fixed', inset: 0, zIndex: 20,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    background: 'var(--lp-bg-base)',
  },
  ring: {
    width: 78, height: 78, borderRadius: '50%',
    background: 'var(--lp-brand-600)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  successT: { fontSize: 19, fontWeight: 600, color: 'var(--lp-text-primary)' },
  successS: { fontSize: 14, color: 'var(--lp-text-secondary)' },
};

/* Recordar el último usuario en ESTE dispositivo (solo el nombre, NUNCA el PIN).
   Al cerrarse la sesión, se vuelve a entrar poniendo solo el PIN. Pedido dueño
   jun 2026. */
const REMEMBER_KEY = 'pp_last_user';
function _savedUser() {
  try { return (localStorage.getItem(REMEMBER_KEY) || '').trim(); } catch { return ''; }
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState(() => _savedUser());
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  /* Si ya hay un usuario recordado, saltar directo al PIN. */
  const [step, setStep] = useState(() => (_savedUser() ? 'pin' : 'name'));
  const [logoOk, setLogoOk] = useState(true);
  const [shake, setShake] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const [theme, setThemeState] = useState(() => getActiveTheme());
  const nameRef = useRef(null);

  const isDark = theme === 'dark';

  /* El toggle de tema usa el sistema canónico (utils/theme): persiste en
     pp_theme y flipea data-theme/.dark a nivel app. Solo se lee/llama la
     utilidad compartida; no se modifica. */
  useEffect(() => {
    const onChange = (e) => setThemeState(e?.detail || getActiveTheme());
    window.addEventListener('pp-theme-change', onChange);
    return () => window.removeEventListener('pp-theme-change', onChange);
  }, []);

  /* NO auto-focus: iOS Safari abre el teclado y la barra de autofill provoca
     focus->blur->focus que React interpreta como re-render. El usuario toca
     el input cuando esté listo. */

  /* iOS PWA Safari bug: un <form> standalone se auto-submitea al tocar la barra
     de autofill arriba del teclado, "reiniciando" la pantalla. Por eso NO se
     usa <form>: solo div + input controlado + button onClick. El Enter se
     maneja con onKeyDown explícito. */
  const submitName = () => {
    const valDom = (nameRef.current?.value || '').trim();
    const val = valDom || nombre.trim();
    if (!val) return;
    setNombre(val);
    setStep('pin');
    setError('');
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitName();
    }
  };

  const doLogin = async (pinVal) => {
    setLoading(true);
    setError('');
    try {
      await login(nombre.trim(), pinVal);
      /* Recordar el usuario en este dispositivo (solo el nombre) para que la
         próxima vez solo pida el PIN. */
      try { localStorage.setItem(REMEMBER_KEY, nombre.trim()); } catch {}
      /* Pantalla de éxito breve antes de entrar */
      setLoading(false);
      setStep('success');
      setTimeout(() => navigate('/', { replace: true }), 850);
    } catch (err) {
      /* Mensaje del backend tal cual (incluye fuera de horario para no-admin
         y bloqueo por intentos). Fallback genérico por seguridad. */
      setError(err.message || 'Usuario o PIN incorrecto.');
      setPin('');
      setLoading(false);
      setShake(true);
      setTimeout(() => setShake(false), 460);
    }
  };

  const handlePinInput = (char) => {
    if (pin.length >= 4 || loading) return;
    /* Acepta alfanuméricos (números y letras) */
    if (!/^[a-zA-Z0-9]$/.test(char)) return;
    const newPin = pin + char;
    setPin(newPin);
    if (newPin.length === 4) {
      setTimeout(() => doLogin(newPin), 200);
    }
  };

  /* Listener de teclado físico: solo activo en step PIN */
  useEffect(() => {
    if (step !== 'pin') return;
    const onKey = (e) => {
      if (loading) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        setPin(p => p.slice(0, -1));
      } else if (e.key === 'Enter' && pin.length > 0) {
        e.preventDefault();
        if (pin.length >= 1) doLogin(pin);
      } else if (e.key === 'Escape') {
        setStep('name');
        setPin('');
        setError('');
      } else if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
        e.preventDefault();
        handlePinInput(e.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pin, loading]);

  /* "Cambiar usuario": vuelve al paso nombre con el campo vacío para escribir
     otro. NO borra el usuario recordado — eso se actualiza solo al entrar con
     éxito con otro nombre (así, si solo querían ver, sigue recordado). */
  const goBack = () => { setStep('name'); setPin(''); setError(''); setNombre(''); };

  /* ── Éxito: overlay full-screen ── */
  if (step === 'success') {
    return (
      <div style={S.page}>
        <div style={S.success}>
          <div style={S.ring}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div style={S.successT}>Hola, {nombre.trim()}</div>
          <div style={S.successS}>Preparando todo&hellip;</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.app}>
        {/* Toggle de tema */}
        <button
          type="button"
          style={S.toggle}
          onClick={() => setThemeState(toggleTheme())}
          aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
        >
          {isDark ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>

        {/* Back (solo en paso PIN) */}
        {step === 'pin' && (
          <button type="button" style={S.back} onClick={goBack} aria-label="Volver">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        {/* Marca */}
        <div style={S.brand}>
          {logoOk ? (
            <Logo
              variant="perico-green"
              height={62}
              style={{ background: 'transparent', border: 'none' }}
              onError={() => setLogoOk(false)}
            />
          ) : (
            <div style={S.logoFallback}>P</div>
          )}
        </div>

        {step === 'name' ? (
          /* ── Paso 1 — usuario ── */
          <div style={S.step1}>
            <div style={S.title}>Inicia sesión</div>
            <div style={S.sub}>Ingresa tu usuario para continuar</div>

            <div style={S.fieldWrap}>
              <label
                htmlFor="usuario-input"
                style={{ ...S.field, ...(fieldFocused ? S.fieldFocus : {}) }}
              >
                <span style={S.fieldIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  id="usuario-input"
                  ref={nameRef}
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onFocus={() => setFieldFocused(true)}
                  onBlur={() => setFieldFocused(false)}
                  placeholder="Usuario o nombre"
                  style={S.input}
                  /* name no-semántico: iOS NO lo trata como username y NO muestra
                     la barra de "usuarios guardados" que dispara el bug de re-submit. */
                  name="q"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  inputMode="text"
                  aria-autocomplete="none"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                />
              </label>
              <button
                type="button"
                onClick={submitName}
                disabled={!nombre.trim()}
                style={{ ...S.continue, ...(!nombre.trim() ? S.continueDisabled : {}) }}
              >
                <span>Continuar</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          /* ── Paso 2 — PIN ── */
          <div style={S.step2}>
            <div style={S.pinTop}>
              <div style={S.miniAv}>{nombre.trim().charAt(0).toUpperCase()}</div>
              <div>
                <span style={S.uName}>{nombre.trim()}</span>
              </div>
            </div>
            <div style={S.title}>Ingresa tu PIN</div>
            <div style={S.sub}>4 dígitos</div>

            {/* Dots con shake en error */}
            <div style={S.dots} className={shake ? 'lp-shake' : undefined}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={i < pin.length ? S.dotOn : S.dot} />
              ))}
            </div>

            {/* Slot reservado: error/loading no saltan el keypad */}
            <div style={S.feedbackSlot}>
              {error
                ? <div style={S.errmsg}>{error}</div>
                : loading
                  ? <div style={S.loadingTxt}>Verificando&hellip;</div>
                  : null}
            </div>

            {/* Keypad */}
            <div style={S.keypad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                <button key={d} type="button" onClick={() => handlePinInput(String(d))} style={S.key}>
                  {d}
                </button>
              ))}
              <div />
              <button type="button" onClick={() => handlePinInput('0')} style={S.key}>0</button>
              <button type="button" onClick={() => setPin(p => p.slice(0, -1))} style={S.keyFn} aria-label="Borrar">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <path d="M18 9l-6 6M12 9l6 6" />
                </svg>
              </button>
            </div>

            {/* Cambiar usuario */}
            <button type="button" onClick={goBack} style={S.pinFoot}>
              Cambiar usuario
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
