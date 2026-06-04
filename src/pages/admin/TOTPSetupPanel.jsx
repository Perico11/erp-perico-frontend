/* TOTPSetupPanel — Configurar Google Authenticator (TOTP) para admin.

   Flujo:
   1. Llama GET /api/totp/setup → recibe secret + QR + otpauth
   2. Muestra QR para escanear en Google Authenticator (o Microsoft Auth / Authy)
   3. Usuario escanea + ingresa código generado para verificar
   4. POST /api/totp/verify → confirma que funciona
   5. A partir de ahí el código se usa para: Inventario Canónico, Override ajuste stock

   El secreto es por usuario (session.userId). Cada admin tiene el suyo. */

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const S = {
  page: { padding: '0 20px 100px', maxWidth: 900, margin: '0 auto' },
  hero: {
    background: 'linear-gradient(135deg, #5A1EAF, #8E27E2)',
    color: '#fff', padding: '20px 24px', borderRadius: 12, marginBottom: 18,
  },
  heroTitle: { fontSize: 18, fontWeight: 700, margin: 0 },
  heroSub: { fontSize: 12, opacity: 0.85, marginTop: 6 },
  card: {
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', padding: 22, marginBottom: 14,
  },
  step: {
    display: 'flex', gap: 14, marginBottom: 18,
    padding: '14px 16px', background: 'var(--lp-bg-base)', borderRadius: 10,
    borderLeft: '4px solid var(--lp-brand-600)',
  },
  stepNum: {
    width: 32, height: 32, borderRadius: '50%',
    background: 'var(--lp-brand-600)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, flexShrink: 0,
  },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  stepText: { fontSize: 12, color: 'var(--lp-text-secondary)', lineHeight: 1.5 },
  qrBox: {
    background: '#fff', padding: 14, borderRadius: 10,
    border: '2px dashed var(--lp-brand-300)', textAlign: 'center',
    margin: '16px auto', maxWidth: 280,
  },
  qrImg: { width: 250, height: 250, display: 'block', margin: '0 auto' },
  secretCode: {
    fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
    background: 'var(--lp-bg-sunken)', padding: '8px 12px',
    borderRadius: 6, color: 'var(--lp-text-primary)',
    display: 'inline-block', marginTop: 8,
    letterSpacing: '0.1em', userSelect: 'all',
  },
  inputTOTP: {
    width: 200, padding: '14px 14px', fontSize: 24, letterSpacing: '0.4em',
    fontFamily: 'monospace', textAlign: 'center', border: '2px solid #8E27E2',
    borderRadius: 8, background: '#FFF', color: '#1A1815',
    outline: 'none', colorScheme: 'light',
  },
  btn: (kind) => ({
    padding: '10px 20px', fontSize: 13, fontWeight: 700, borderRadius: 8,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    background: kind === 'primary' ? 'var(--lp-brand-600)' : kind === 'danger' ? '#DC2626' : 'var(--lp-bg-base)',
    color: kind === 'primary' || kind === 'danger' ? '#fff' : 'var(--lp-text-primary)',
    marginRight: 8,
    border: kind ? 'none' : '1px solid var(--lp-border-subtle)',
  }),
  alertOK: { background: '#D1FAE5', color: '#065F46', padding: 12, borderRadius: 6, fontSize: 13, marginTop: 12 },
  alertErr: { background: '#FEE2E2', color: '#991B1B', padding: 12, borderRadius: 6, fontSize: 13, marginTop: 12 },
  statusOk: { color: '#059669', fontWeight: 700 },
  statusNew: { color: '#D97706', fontWeight: 700 },
};

export default function TOTPSetupPanel() {
  const { user } = useAuth();
  const [setupData, setSetupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [codigo, setCodigo] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifResult, setVerifResult] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const cargar = async (reset = false) => {
    setLoading(true);
    setErr('');
    setVerifResult(null);
    try {
      const r = await fetch('/api/totp/setup' + (reset ? '?reset=1' : ''), {
        headers: { 'x-session-token': sessionStorage.getItem('pp_token') || '' },
      }).then(r => r.json());
      if (!r.ok) throw new Error(r.error);
      setSetupData(r);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(false); }, []);

  const handleVerify = async () => {
    if (codigo.length !== 6) { setVerifResult({ ok: false, msg: 'Código debe tener 6 dígitos' }); return; }
    setVerifying(true);
    try {
      const r = await fetch('/api/totp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionStorage.getItem('pp_token') || '',
        },
        body: JSON.stringify({ code: codigo }),
      }).then(r => r.json());
      setVerifResult({ ok: r.ok, msg: r.ok ? '¡Configurado correctamente! Ya puedes usar este código en Inventario y Canónico.' : r.error });
    } catch (e) {
      setVerifResult({ ok: false, msg: e.message });
    } finally {
      setVerifying(false);
      setCodigo('');
    }
  };

  if (user?.rol !== 'admin' && user?.rol !== 'tecnico') {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ color: '#DC2626', fontWeight: 700 }}>Solo admin o tecnico pueden configurar TOTP.</div>
        </div>
      </div>
    );
  }

  if (loading) return <div style={S.page}><div style={S.card}>Cargando configuración…</div></div>;
  if (err) return <div style={S.page}><div style={S.card}><div style={S.alertErr}>{err}</div></div></div>;

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <h2 style={S.heroTitle}>Google Authenticator (TOTP)</h2>
        <div style={S.heroSub}>
          Configura tu app de autenticación (Google Authenticator, Microsoft Authenticator, Authy, 1Password…).
          El código de 6 dígitos cambia cada 30 segundos y se usa para acciones críticas:
          Inventario Canónico + Override de ajuste de stock en Inventario.
        </div>
      </div>

      {setupData && (
        <div style={S.card}>
          <div style={{ marginBottom: 14, fontSize: 14 }}>
            Estado:{' '}
            {setupData.configured ? (
              <span style={S.statusOk}>YA configurado para {user.nombre}</span>
            ) : (
              <span style={S.statusNew}>NUEVO secret generado (primera vez o regenerado)</span>
            )}
          </div>

          <div style={S.step}>
            <div style={S.stepNum}>1</div>
            <div style={S.stepBody}>
              <div style={S.stepTitle}>Instala una app de autenticación en tu celular</div>
              <div style={S.stepText}>
                Las más populares (todas funcionan): <strong>Google Authenticator</strong>,
                Microsoft Authenticator, Authy, 1Password.<br />
                Descarga de App Store (iPhone) o Play Store (Android).
              </div>
            </div>
          </div>

          <div style={S.step}>
            <div style={S.stepNum}>2</div>
            <div style={S.stepBody}>
              <div style={S.stepTitle}>Escanea este código QR en la app</div>
              <div style={S.stepText}>
                Abre Google Authenticator → "+" abajo → "Escanear código QR" → apunta la cámara aquí.
              </div>
              <div style={S.qrBox}>
                <img src={setupData.qrUrl} alt="QR Google Authenticator" style={S.qrImg} />
                <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 8 }}>
                  ¿No puedes escanear? Ingresa este código manualmente:
                </div>
                <div style={S.secretCode}>{setupData.secret}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
                Aparecerá una entrada en tu app llamada <strong>PinturasPerico ({user.nombre})</strong>
                con un código de 6 dígitos que cambia cada 30 segundos.
              </div>
            </div>
          </div>

          <div style={S.step}>
            <div style={S.stepNum}>3</div>
            <div style={S.stepBody}>
              <div style={S.stepTitle}>Verifica que funciona</div>
              <div style={S.stepText}>
                Mira tu app, toma el código actual de 6 dígitos e ingrésalo aquí:
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                <input
                  style={S.inputTOTP}
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  value={codigo}
                  onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                />
                <button
                  style={S.btn('primary')}
                  disabled={verifying || codigo.length !== 6}
                  onClick={handleVerify}
                >
                  {verifying ? 'Verificando…' : 'Verificar código'}
                </button>
              </div>
              {verifResult && (
                <div style={verifResult.ok ? S.alertOK : S.alertErr}>{verifResult.msg}</div>
              )}
            </div>
          </div>

          <div style={S.step}>
            <div style={S.stepNum}>4</div>
            <div style={S.stepBody}>
              <div style={S.stepTitle}>¿Cambiaste de celular o perdiste el QR?</div>
              <div style={S.stepText}>
                Puedes regenerar el secret (esto invalidará el anterior — tendrás que volver a
                escanear el nuevo QR en tu app). <strong>OJO:</strong> después de regenerar, la
                vieja entrada de Google Authenticator queda inservible.
              </div>
              <div style={{ marginTop: 10 }}>
                {!confirmReset ? (
                  <button style={S.btn('')} onClick={() => setConfirmReset(true)}>
                    Regenerar secret (perderé el anterior)
                  </button>
                ) : (
                  <>
                    <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 700, marginRight: 10 }}>
                      ¿Seguro? El secret anterior dejará de funcionar.
                    </span>
                    <button style={S.btn('danger')} onClick={() => { setConfirmReset(false); cargar(true); }}>
                      Sí, regenerar
                    </button>
                    <button style={S.btn('')} onClick={() => setConfirmReset(false)}>
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>¿Dónde se usa este código?</div>
        <ul style={{ fontSize: 12, color: 'var(--lp-text-secondary)', lineHeight: 1.6, paddingLeft: 18 }}>
          <li><strong>Admin → Inventario Canónico:</strong> crear v1 o modificar versiones</li>
          <li><strong>Inventario → MP/PT (paloma azul):</strong> override admin al ajustar stock fuera de sesión de conteo</li>
        </ul>
        <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 10, fontStyle: 'italic' }}>
          El código tiene validez de 30 segundos. Si te equivocas, espera al siguiente.
        </div>
      </div>
    </div>
  );
}
