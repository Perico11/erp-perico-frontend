/* CanonicoPanel — Pantalla admin para gestionar inventario CANÓNICO.

   El canónico es la "fotografía fija" inicial del inventario. Solo admin puede
   crearlo o modificarlo, y SIEMPRE con código TOTP de Google Authenticator.

   Funciones:
   - Ver versión actual, fecha de congelación, checksum
   - Ver delta vs inventario operativo (cuánto se ha movido desde el canónico)
   - Crear v1 (solo si no existe)
   - Modificar (genera nueva versión con motivo + TOTP) */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const S = {
  page: { padding: '0 20px 100px', maxWidth: 1100, margin: '0 auto' },
  hero: {
    background: 'linear-gradient(135deg, #5A1EAF, #8E27E2)',
    color: '#fff', padding: '20px 24px', borderRadius: 12, marginBottom: 18,
  },
  heroTitle: { fontSize: 18, fontWeight: 700, margin: 0 },
  heroSub: { fontSize: 12, opacity: 0.85, marginTop: 6 },
  card: {
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', padding: 18, marginBottom: 14,
  },
  section: { fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--lp-text-primary)' },
  meta: { fontSize: 12, color: 'var(--lp-text-secondary)', display: 'grid', gridTemplateColumns: '160px 1fr', gap: '6px 12px' },
  metaLbl: { fontWeight: 700, color: 'var(--lp-text-tertiary)' },
  checksum: { fontFamily: 'var(--lp-font-mono)', fontSize: 11, color: 'var(--lp-text-tertiary)', wordBreak: 'break-all' },
  btn: (kind) => ({
    padding: '10px 20px', fontSize: 13, fontWeight: 700, borderRadius: 8,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    background: kind === 'primary' ? 'var(--lp-brand-600)' : kind === 'danger' ? '#DC2626' : 'var(--lp-bg-base)',
    color: kind === 'primary' || kind === 'danger' ? '#fff' : 'var(--lp-text-primary)',
    marginRight: 8,
  }),
  alertOK: { background: '#D1FAE5', color: '#065F46', padding: 12, borderRadius: 6, fontSize: 12, marginTop: 12 },
  alertErr: { background: '#FEE2E2', color: '#991B1B', padding: 12, borderRadius: 6, fontSize: 12, marginTop: 12 },
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(15,12,8,0.6)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    backdropFilter: 'blur(3px)',
  },
  modalCard: {
    background: 'var(--lp-bg-raised)', color: '#1A1815', borderRadius: 12, width: '100%', maxWidth: 480,
    padding: 24, boxShadow: '0 24px 60px rgba(0,0,0,.35)', colorScheme: 'light',
  },
  modalTitle: { fontSize: 16, fontWeight: 700, marginBottom: 12 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#5A5550', marginBottom: 6, marginTop: 14 },
  input: {
    width: '100%', padding: '12px 14px', fontSize: 16, border: '1.5px solid #E5E1DA',
    borderRadius: 8, background: 'var(--lp-bg-raised)', color: '#1A1815', boxSizing: 'border-box',
    outline: 'none', fontFamily: 'inherit', colorScheme: 'light',
  },
  inputTOTP: {
    width: '100%', padding: '14px 14px', fontSize: 24, letterSpacing: '0.4em',
    fontFamily: 'monospace', textAlign: 'center', border: '2px solid #8E27E2',
    borderRadius: 8, background: 'var(--lp-bg-raised)', color: '#1A1815', boxSizing: 'border-box',
    outline: 'none', colorScheme: 'light',
  },
  textarea: {
    width: '100%', padding: '10px 12px', fontSize: 13, border: '1.5px solid #E5E1DA',
    borderRadius: 8, background: 'var(--lp-bg-raised)', color: '#1A1815', minHeight: 70, resize: 'vertical',
    boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', colorScheme: 'light',
  },
  deltaTable: {
    width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 10,
  },
  deltaTh: {
    textAlign: 'left', padding: '6px 8px', background: 'var(--lp-gray-100)',
    borderBottom: '2px solid var(--lp-border-subtle)', fontWeight: 700, fontSize: 11,
  },
  deltaTd: { padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)' },
};

export default function CanonicoPanel() {
  const { user } = useAuth();
  const [canonico, setCanonico] = useState(null);
  const [delta, setDelta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showCrear, setShowCrear] = useState(false);
  const [showModificar, setShowModificar] = useState(false);

  const cargar = async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await api.getCanonico();
      setCanonico(r.canonico);
      try {
        const d = await api.getCanonicoDelta();
        setDelta(d);
      } catch (e) { /* sin delta ok */ }
    } catch (e) {
      if (e?.status === 404) {
        setCanonico(null); /* aún no existe */
      } else {
        setErr(e?.data?.error || e.message);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  if (user?.rol !== 'admin') {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ color: '#DC2626', fontWeight: 700 }}>Solo el rol admin puede ver esta pantalla.</div>
        </div>
      </div>
    );
  }

  if (loading) return <div style={S.page}><div style={S.card}>Cargando…</div></div>;

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <h2 style={S.heroTitle}>Inventario Canónico</h2>
        <div style={S.heroSub}>
          La "fotografía fija" inicial del inventario. Solo admin puede crearla o modificarla
          con código de Google Authenticator. Los conteos cíclicos NO modifican el canónico
          directamente — son histórico de consumo.
        </div>
      </div>

      {err && <div style={S.alertErr}>{err}</div>}

      {!canonico ? (
        <div style={S.card}>
          <div style={S.section}>Aún no se ha creado el inventario canónico</div>
          <div style={{ fontSize: 13, color: 'var(--lp-text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
            Al crearlo, el inventario actual quedará congelado como <strong>versión 1</strong>.
            Esto será la fuente de verdad para futuros conteos. Solo tú podrás modificarlo,
            siempre con código de tu Google Authenticator.
          </div>
          <button style={S.btn('primary')} onClick={() => setShowCrear(true)}>
            Crear inventario canónico v1
          </button>
        </div>
      ) : (
        <>
          <div style={S.card}>
            <div style={S.section}>Versión actual</div>
            <div style={S.meta}>
              <span style={S.metaLbl}>Versión</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--lp-brand-700)' }}>
                v{canonico._meta.version}
              </span>
              <span style={S.metaLbl}>Congelado por</span>
              <span>{canonico._meta.congeladoPor}</span>
              <span style={S.metaLbl}>Fecha congelación</span>
              <span>{new Date(canonico._meta.fechaCongelacion).toLocaleString('es-MX')}</span>
              {canonico._meta.ultimaModificacion && (
                <>
                  <span style={S.metaLbl}>Última modificación</span>
                  <span>{new Date(canonico._meta.ultimaModificacion).toLocaleString('es-MX')} por {canonico._meta.modificadoPor}</span>
                </>
              )}
              <span style={S.metaLbl}>Motivo inicial</span>
              <span>{canonico._meta.motivo}</span>
              <span style={S.metaLbl}>MPs congeladas</span>
              <span>{Object.keys(canonico.snapshot.mp || {}).length}</span>
              <span style={S.metaLbl}>PTs congelados</span>
              <span>{Object.keys(canonico.snapshot.pt || {}).length}</span>
              <span style={S.metaLbl}>Checksum SHA256</span>
              <span style={S.checksum}>{canonico._meta.checksumSHA256}</span>
            </div>
            <div style={{ marginTop: 16 }}>
              <button style={S.btn('primary')} onClick={() => setShowModificar(true)}>
                Modificar canónico (TOTP requerido)
              </button>
              <button style={S.btn('')} onClick={cargar}>Recargar</button>
            </div>
          </div>

          {delta && delta.totalCambios > 0 && (
            <div style={S.card}>
              <div style={S.section}>
                Delta vs inventario operativo — {delta.totalCambios} cambios
              </div>
              <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginBottom: 10 }}>
                Diferencia entre el canónico v{delta.version} y el inventario actual (movimientos
                acumulados desde la congelación).
              </div>
              <table style={S.deltaTable}>
                <thead>
                  <tr>
                    <th style={S.deltaTh}>Tipo</th>
                    <th style={S.deltaTh}>Nombre</th>
                    <th style={{ ...S.deltaTh, textAlign: 'right' }}>Canónico</th>
                    <th style={{ ...S.deltaTh, textAlign: 'right' }}>Actual</th>
                    <th style={{ ...S.deltaTh, textAlign: 'right' }}>Δ</th>
                    <th style={{ ...S.deltaTh, textAlign: 'right' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {[...delta.delta.mp.map(d => ({ ...d, t: 'MP' })),
                    ...delta.delta.pt.map(d => ({ ...d, t: 'PT' }))].slice(0, 30).map((d, i) => (
                    <tr key={i}>
                      <td style={S.deltaTd}>{d.t}</td>
                      <td style={S.deltaTd}>{d.nombre}</td>
                      <td style={{ ...S.deltaTd, textAlign: 'right', fontFamily: 'monospace' }}>{d.canon}</td>
                      <td style={{ ...S.deltaTd, textAlign: 'right', fontFamily: 'monospace' }}>{d.actual}</td>
                      <td style={{ ...S.deltaTd, textAlign: 'right', fontFamily: 'monospace', color: d.delta > 0 ? '#059669' : '#DC2626' }}>
                        {d.delta > 0 ? '+' : ''}{d.delta}
                      </td>
                      <td style={{ ...S.deltaTd, textAlign: 'right', fontFamily: 'monospace' }}>
                        {d.pct !== null ? (d.pct > 0 ? '+' : '') + d.pct + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(delta.delta.mp.length + delta.delta.pt.length) > 30 && (
                <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 6 }}>
                  Mostrando primeros 30. Total: {delta.totalCambios} cambios.
                </div>
              )}
            </div>
          )}

          <div style={S.card}>
            <div style={S.section}>Historial de versiones</div>
            {(canonico.historialVersiones || []).slice().reverse().map(v => (
              <div key={v.version} style={{
                padding: '10px 12px', marginBottom: 6, borderRadius: 6,
                background: 'var(--lp-bg-base)',
                borderLeft: '3px solid var(--lp-brand-600)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>v{v.version} — {new Date(v.fecha).toLocaleString('es-MX')}</div>
                <div style={{ fontSize: 11, color: 'var(--lp-text-secondary)', marginTop: 2 }}>
                  Por {v.usuario}. {v.motivo}
                </div>
                {Array.isArray(v.cambios) && v.cambios.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4 }}>
                    {v.cambios.length} cambios aplicados
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {showCrear && <CrearCanonicoModal onClose={() => setShowCrear(false)} onSaved={cargar} />}
      {showModificar && <ModificarCanonicoModal canonico={canonico} onClose={() => setShowModificar(false)} onSaved={cargar} />}
    </div>
  );
}

/* ───────── Modal: Crear v1 ───────── */
function CrearCanonicoModal({ onClose, onSaved }) {
  const [codigoTOTP, setCodigoTOTP] = useState('');
  const [motivo, setMotivo] = useState('Congelación inicial del inventario base');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleCrear = async () => {
    if (codigoTOTP.length !== 6) { setErr('El código TOTP debe ser de 6 dígitos'); return; }
    setSaving(true);
    setErr('');
    try {
      await api.crearCanonico(codigoTOTP, motivo);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e?.data?.error || e.message);
    } finally { setSaving(false); }
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalCard} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>Crear inventario canónico v1</div>
        <p style={{ fontSize: 12, color: '#5A5550', lineHeight: 1.5 }}>
          El inventario actual quedará congelado como la versión 1 oficial. Solo tú podrás
          modificarla en el futuro, siempre con código de Google Authenticator.
        </p>

        <label style={S.label}>Motivo de congelación</label>
        <textarea style={S.textarea} value={motivo} onChange={e => setMotivo(e.target.value)} />

        <label style={S.label}>Código Google Authenticator (6 dígitos)</label>
        <input
          style={S.inputTOTP}
          type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
          value={codigoTOTP}
          onChange={e => setCodigoTOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          autoFocus
        />

        {err && <div style={S.alertErr}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button style={S.btn('')} onClick={onClose}>Cancelar</button>
          <button style={S.btn('primary')} disabled={saving} onClick={handleCrear}>
            {saving ? 'Creando…' : 'Crear canónico v1'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Modal: Modificar (nueva versión) ───────── */
function ModificarCanonicoModal({ canonico, onClose, onSaved }) {
  const [codigoTOTP, setCodigoTOTP] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cambiosTexto, setCambiosTexto] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  /* Parser simple: cada línea "TIPO|NOMBRE|qty|min". Ej: MP|AGUA|150|20 */
  const cambiosParsed = useMemo(() => {
    const lineas = cambiosTexto.split('\n').map(l => l.trim()).filter(Boolean);
    const cambios = { mp: {}, pt: {} };
    const errores = [];
    lineas.forEach((l, i) => {
      const partes = l.split('|').map(p => p.trim());
      if (partes.length < 3) { errores.push(`Línea ${i + 1}: formato "TIPO|NOMBRE|qty[|min]"`); return; }
      const [tipo, nombre, qtyStr, minStr] = partes;
      const qty = parseFloat(qtyStr);
      if (isNaN(qty)) { errores.push(`Línea ${i + 1}: qty inválida`); return; }
      const min = minStr !== undefined ? parseFloat(minStr) : undefined;
      const t = tipo.toLowerCase();
      if (t === 'mp' || t === 'pt') {
        cambios[t][nombre] = { qty, ...(min !== undefined && !isNaN(min) ? { min } : {}) };
      } else {
        errores.push(`Línea ${i + 1}: TIPO debe ser MP o PT`);
      }
    });
    return { cambios, errores };
  }, [cambiosTexto]);

  const totalCambios = Object.keys(cambiosParsed.cambios.mp).length + Object.keys(cambiosParsed.cambios.pt).length;

  const handleModificar = async () => {
    if (motivo.length < 5) { setErr('Motivo requerido (≥5 caracteres)'); return; }
    if (codigoTOTP.length !== 6) { setErr('Código TOTP debe ser 6 dígitos'); return; }
    if (totalCambios === 0) { setErr('No hay cambios válidos'); return; }
    setSaving(true);
    setErr('');
    try {
      const r = await api.modificarCanonico(codigoTOTP, motivo, cambiosParsed.cambios);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e?.data?.error || e.message);
    } finally { setSaving(false); }
  };

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={{ ...S.modalCard, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>Modificar canónico (nueva versión v{canonico._meta.version + 1})</div>
        <p style={{ fontSize: 12, color: '#5A5550', lineHeight: 1.5 }}>
          Esta acción genera una nueva versión inmutable del canónico. Todas las versiones
          previas se preservan en el historial.
        </p>

        <label style={S.label}>Motivo de la modificación (≥5 caracteres)</label>
        <textarea
          style={S.textarea}
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Ej: Conteo físico confirmado de 23/may. Recepción no registrada de X MP."
        />

        <label style={S.label}>Cambios (uno por línea: TIPO|NOMBRE|qty[|min])</label>
        <textarea
          style={{ ...S.textarea, minHeight: 120, fontFamily: 'monospace' }}
          value={cambiosTexto}
          onChange={e => setCambiosTexto(e.target.value)}
          placeholder={'MP|AGUA|150|20\nMP|DIOXIDO DE TITANIO R2196+|180\nPT|BLANCO MATE 4.0|25|10'}
        />
        <div style={{ fontSize: 11, color: '#5A5550', marginTop: 4 }}>
          {totalCambios > 0 && <span style={{ color: '#059669', fontWeight: 700 }}>{totalCambios} cambios válidos detectados. </span>}
          {cambiosParsed.errores.length > 0 && <span style={{ color: '#DC2626' }}>{cambiosParsed.errores.length} líneas con error</span>}
        </div>

        <label style={S.label}>Código Google Authenticator</label>
        <input
          style={S.inputTOTP}
          type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
          value={codigoTOTP}
          onChange={e => setCodigoTOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
        />

        {err && <div style={S.alertErr}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button style={S.btn('')} onClick={onClose}>Cancelar</button>
          <button style={S.btn('primary')} disabled={saving || totalCambios === 0} onClick={handleModificar}>
            {saving ? 'Aplicando…' : `Aplicar ${totalCambios} cambios + nueva versión`}
          </button>
        </div>
      </div>
    </div>
  );
}
