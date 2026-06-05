import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';

const S = {
  page: {
    minHeight: '100dvh',
    width: '100%',
    maxWidth: '100vw',
    /* HANDOFF jun 2026: fondo calm forest con glow verde sutil arriba.
       Usa tokens → flipea solo en modo oscuro (glow mint sobre fondo oscuro). */
    background: 'radial-gradient(120% 60% at 50% 0%, color-mix(in srgb, var(--lp-brand-600) 7%, var(--lp-bg-base)) 0%, var(--lp-bg-base) 60%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
    fontFamily: 'var(--lp-font-sans)',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  },
  /* En móvil (≤480px) la card ocupa toda la pantalla — fondo blanco completo, sin sombra, sin radius. */
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'var(--lp-bg-raised)',
    borderRadius: 20,
    boxShadow: '0 12px 40px rgba(0,0,0,.08)',
    overflow: 'hidden',
    boxSizing: 'border-box',
    margin: 'clamp(8px, 3vw, 24px)',
  },
  cardBody: {
    padding: 'clamp(24px, 6vw, 32px) clamp(20px, 5vw, 32px) clamp(20px, 5vw, 28px)',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },

  /* Step 1 — Name */
  logoWrap: { display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoImg: {
    width: 72, height: 72, objectFit: 'contain',
    borderRadius: 14, border: '1.5px solid var(--lp-border-subtle)',
    padding: 6, background: 'var(--lp-bg-raised)',
    display: 'block', margin: '0 auto',
  },
  logoFallback: {
    width: 72, height: 72, borderRadius: 14,
    background: 'linear-gradient(135deg, var(--lp-brand-500), var(--lp-brand-700))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 28, fontWeight: 700, margin: '0 auto',
  },
  title: {
    fontSize: 18, fontWeight: 800, letterSpacing: '.06em',
    color: 'var(--lp-text-primary)', textAlign: 'center', marginTop: 12,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 12, color: 'var(--lp-text-tertiary)', textAlign: 'center', marginTop: 4,
  },
  label: {
    display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '.1em', color: 'var(--lp-text-tertiary)', marginBottom: 6, marginTop: 24,
  },
  input: {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 14,
    fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)',
    background: 'var(--lp-bg-raised)', outline: 'none', boxSizing: 'border-box',
  },
  btn: {
    width: '100%', padding: '14px 20px', borderRadius: 10,
    border: 'none', background: 'var(--lp-brand-600)', color: '#fff',
    fontSize: 15, fontWeight: 700, fontFamily: 'var(--lp-font-sans)',
    cursor: 'pointer', minHeight: 50, marginTop: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },

  /* Step 2 — PIN */
  avatarWrap: { textAlign: 'center', paddingTop: 8, marginBottom: 4 },
  avatar: {
    width: 62, height: 62, borderRadius: '50%',
    background: 'var(--lp-brand-600)', color: '#fff',
    fontSize: 24, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  pinName: {
    fontSize: 18, fontWeight: 700, color: 'var(--lp-text-primary)',
    textAlign: 'center', marginTop: 11,
  },
  pinSub: {
    fontSize: 13, color: 'var(--lp-text-tertiary)', textAlign: 'center', marginTop: 2,
  },
  dots: { display: 'flex', justifyContent: 'center', gap: 20, margin: '24px 0 24px' },
  dotOff: {
    width: 18, height: 18, borderRadius: '50%',
    border: '2px solid var(--lp-border-strong)', background: 'transparent',
    transition: 'all .2s', flex: '0 0 auto',
  },
  dotOn: {
    width: 18, height: 18, borderRadius: '50%',
    border: '2px solid var(--lp-brand-600)', background: 'var(--lp-brand-600)',
    transition: 'all .2s', transform: 'scale(1.15)', flex: '0 0 auto',
  },
  /* Reserva altura fija para evitar saltos cuando aparece error/loading */
  feedbackSlot: {
    minHeight: 24, marginBottom: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  numpad: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 'clamp(11px, 3vw, 15px)',
    maxWidth: 320, width: '100%', margin: '0 auto',
    boxSizing: 'border-box',
  },
  numBtn: {
    width: 'min(80px, 22vw)', height: 'min(80px, 22vw)',
    aspectRatio: '1 / 1', borderRadius: '50%',
    background: 'var(--lp-bg-sunken)', border: 'none',
    fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: 700, color: 'var(--lp-text-primary)',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background .15s', margin: '0 auto',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  },
  backBtn: {
    width: 'min(80px, 22vw)', height: 'min(80px, 22vw)',
    aspectRatio: '1 / 1', borderRadius: '50%',
    background: 'transparent', border: 'none',
    color: 'var(--lp-text-tertiary)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  },
  changeUser: {
    textAlign: 'center', marginTop: 20, paddingBottom: 4,
  },
  changeUserLink: {
    background: 'none', border: 'none', color: 'var(--lp-brand-600)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', textDecoration: 'none',
  },
  error: {
    textAlign: 'center', fontSize: 13, color: 'var(--lp-danger-600)',
    fontWeight: 600, marginBottom: 12,
  },
  loading: {
    textAlign: 'center', fontSize: 13, color: 'var(--lp-text-tertiary)', padding: '10px 0',
  },
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('name');
  const [logoOk, setLogoOk] = useState(true);
  const [shake, setShake] = useState(false); /* AB1: trigger animación shake en error de PIN */
  const nameRef = useRef(null);

  /* NO auto-focus: iOS Safari abre el teclado solo, después al tocar la barra
     de autocompletar hace un focus->blur->focus que React interpreta como
     re-render. El usuario tocará el input cuando esté listo. */

  /* iOS PWA Safari bug:
     Algunas versiones de iOS Safari (sobre todo en PWA standalone mode)
     disparan un submit fantasma del <form> cuando el usuario toca la barra
     de autofill arriba del teclado. Este submit hace setStep('pin') y al
     usuario le parece que la pantalla "se reinicia".
     Solución: NO usar <form>. Solo div + input controlled + button onClick.
     El Enter del teclado lo manejamos con onKeyDown explícito. */
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
      /* AB1 (HANDOFF): pantalla de éxito breve "Hola, {nombre} · Preparando
         todo…" antes de entrar — toque cálido es-MX. */
      setLoading(false);
      setStep('success');
      setTimeout(() => navigate('/', { replace: true }), 850);
    } catch (err) {
      /* Mensaje genérico por seguridad (no revelar si fue usuario o PIN). */
      setError(err.message || 'Usuario o PIN incorrecto.');
      setPin('');
      setLoading(false);
      /* Disparar shake en los puntos del PIN */
      setShake(true);
      setTimeout(() => setShake(false), 450);
    }
  };

  const handlePinInput = (char) => {
    if (pin.length >= 4 || loading) return;
    /* Acepta caracteres alfanuméricos (números y letras) */
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

  return (
    <div style={S.page}>
      <div className="login-card">
        <div style={S.cardBody}>
          {step === 'success' ? (
            /* AB1 (HANDOFF): pantalla de éxito cálida antes de entrar */
            <div style={{ textAlign: 'center', padding: '32px 8px 24px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 18px',
                background: 'color-mix(in srgb, var(--lp-brand-600) 16%, transparent)',
                color: 'var(--lp-brand-600)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--lp-text-primary)' }}>
                Hola, {nombre.trim()}
              </div>
              <div style={{ fontSize: 13, color: 'var(--lp-text-tertiary)', marginTop: 6 }}>
                Preparando todo…
              </div>
            </div>
          ) : step === 'name' ? (
            /* SIN <form>: en iOS Safari PWA standalone, el form se auto-submitea
               cuando el usuario toca la barra de autofill arriba del teclado.
               Eso causa el "reinicio sin parar" reportado. Usamos div + button onClick. */
            <div>
              {/* Logo cuadrado completo de El Perico — único lugar donde la version multicolor manda */}
              <div style={S.logoWrap}>
                {logoOk ? (
                  <Logo
                    variant="el-perico"
                    width={120}
                    height={132}
                    style={{ background: 'transparent', border: 'none' }}
                    onError={() => setLogoOk(false)}
                  />
                ) : (
                  <div style={S.logoFallback}>P</div>
                )}
              </div>
              <div style={S.title}>Producción</div>
              <div style={S.subtitle}>Astra Cover & Perico</div>

              <label style={S.label} htmlFor="usuario-input">Usuario</label>
              <input
                id="usuario-input"
                ref={nameRef}
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={handleNameKeyDown}
                placeholder="Nombre de usuario"
                style={S.input}
                /* name aleatorio no-semántico para que iOS NO lo identifique como campo
                   de username y NO muestre la barra de "usuarios guardados" que causa
                   el bug del re-submit. */
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
              <button
                type="button"
                onClick={submitName}
                disabled={!nombre.trim()}
                style={{ ...S.btn, ...(!nombre.trim() ? S.btnDisabled : {}) }}
              >
                <span>Continuar</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
          ) : (
            <>
              {/* Avatar */}
              <div style={S.avatarWrap}>
                <div style={S.avatar}>{nombre.trim().charAt(0).toUpperCase()}</div>
              </div>
              <div style={S.pinName}>{nombre.trim()}</div>
              <div style={S.pinSub}>Ingresa tu PIN — usa el teclado o los botones</div>

              {/* PIN dots */}
              <div style={S.dots} className={shake ? 'lp-shake' : undefined}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={i < pin.length ? S.dotOn : S.dotOff} />
                ))}
              </div>

              {/* Slot reservado: error o loading SIEMPRE ocupan la misma altura para no saltar el numpad */}
              <div style={S.feedbackSlot}>
                {error
                  ? <div style={{...S.error, marginBottom: 0}}>{error}</div>
                  : loading
                    ? <div style={{...S.loading, padding: 0}}>Verificando...</div>
                    : null
                }
              </div>

              {/* Numpad circular */}
              <div style={S.numpad}>
                {[1,2,3,4,5,6,7,8,9].map(d => (
                  <button key={d} type="button" onClick={() => handlePinInput(String(d))} style={S.numBtn}>
                    {d}
                  </button>
                ))}
                <div />
                <button type="button" onClick={() => handlePinInput('0')} style={S.numBtn}>0</button>
                <button type="button" onClick={() => setPin(p => p.slice(0, -1))} style={S.backBtn}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/>
                    <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
                  </svg>
                </button>
              </div>

              {/* Cambiar usuario */}
              <div style={S.changeUser}>
                <button
                  onClick={() => { setStep('name'); setPin(''); setError(''); }}
                  style={S.changeUserLink}
                >
                  ← Cambiar usuario
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
