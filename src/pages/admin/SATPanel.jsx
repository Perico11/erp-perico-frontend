import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';

const S = {
  panel: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', padding: 16,
  },
  uploadBox: {
    border: '2px dashed var(--lp-border-strong)',
    borderRadius: 'var(--lp-radius-sm)',
    padding: 32, textAlign: 'center',
    background: 'var(--lp-bg-sunken)', cursor: 'pointer',
    marginBottom: 16,
  },
  btnPrimary: {
    padding: '10px 16px', fontSize: 12, fontWeight: 700,
    borderRadius: 'var(--lp-radius-sm)', border: 'none',
    background: 'var(--lp-brand-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
  },
  btnGhost: {
    padding: '8px 14px', fontSize: 11, fontWeight: 600,
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-raised)', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)',
  },
  err: {
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    padding: 10, borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 12,
  },
  ok: {
    background: 'var(--lp-success-100)', color: 'var(--lp-success-700)',
    padding: 10, borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 12,
  },
  cfdi: {
    background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
    padding: 14, marginTop: 10, fontSize: 12, lineHeight: 1.7,
  },
  campo: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid var(--lp-border-subtle)' },
  campoLabel: { color: 'var(--lp-text-tertiary)', fontWeight: 500 },
  campoVal: { fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', fontWeight: 700 },
  ocCandidata: {
    background: 'var(--lp-info-50)', borderRadius: 'var(--lp-radius-sm)',
    padding: 10, marginBottom: 6, cursor: 'pointer',
    border: '1.5px solid transparent',
  },
  ocCandidataSel: {
    border: '1.5px solid var(--lp-brand-600)',
    background: 'var(--lp-brand-50)',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },
  row: {
    display: 'grid', gridTemplateColumns: '1fr auto auto',
    gap: 12, alignItems: 'center', padding: '10px 12px',
    background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12,
  },
  badge: (bg, fg) => ({
    display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700,
    borderRadius: 4, background: bg, color: fg,
    textTransform: 'uppercase', letterSpacing: '.04em',
  }),
};

export default function SATPanel() {
  const [facturas, setFacturas] = useState([]);
  const [parsed, setParsed] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [ocSel, setOcSel] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef(null);

  const cargar = useCallback(() => {
    api.getFacturasSAT()
      .then(r => setFacturas(Array.isArray(r) ? r : (r.data || [])))
      .catch(e => setErr(e.message));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleFile = async (file) => {
    if (!file) return;
    setErr(''); setOk(''); setParsing(true); setParsed(null); setCandidatos([]); setOcSel(null);
    try {
      const text = await file.text();
      const r = await api.satParse(text);
      setParsed(r.cfdi);
      setCandidatos(r.ocsCandidatas || []);
      if (r.ocsCandidatas?.length === 1) setOcSel(r.ocsCandidatas[0].id);
    } catch (e) {
      setErr(e.message || 'Error al parsear XML');
    } finally {
      setParsing(false);
    }
  };

  const registrar = async () => {
    if (!parsed) return;
    setErr(''); setOk('');
    try {
      await api.satRegistrar(parsed, ocSel || null);
      setOk(`Factura ${parsed.uuid} registrada${ocSel ? ' y vinculada a ' + ocSel : ' (sin vincular a OC)'}`);
      setParsed(null); setCandidatos([]); setOcSel(null);
      cargar();
    } catch (e) {
      setErr(e.message || 'Error al registrar');
    }
  };

  return (
    <div>
      {err && <div style={S.err}>{err}</div>}
      {ok && <div style={S.ok}>{ok}</div>}

      <div style={S.panel}>
        <div style={S.uploadBox} onClick={() => fileInputRef.current?.click()}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            {parsing ? 'Procesando...' : 'Arrastra o haz click para subir XML CFDI'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
            CFDI 4.0 generado por el SAT
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        {parsed && (
          <div>
            <div style={S.cfdi}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Datos extraídos del CFDI</div>
              <div style={S.campo}><span style={S.campoLabel}>UUID</span><span style={S.campoVal}>{parsed.uuid || '—'}</span></div>
              <div style={S.campo}><span style={S.campoLabel}>Folio</span><span style={S.campoVal}>{parsed.serie || ''}{parsed.folio || '—'}</span></div>
              <div style={S.campo}><span style={S.campoLabel}>Fecha</span><span style={S.campoVal}>{parsed.fecha || '—'}</span></div>
              <div style={S.campo}><span style={S.campoLabel}>Emisor</span><span style={S.campoVal}>{parsed.emisor?.rfc} · {parsed.emisor?.nombre}</span></div>
              <div style={S.campo}><span style={S.campoLabel}>Receptor</span><span style={S.campoVal}>{parsed.receptor?.rfc}</span></div>
              <div style={S.campo}><span style={S.campoLabel}>Subtotal</span><span style={S.campoVal}>${parsed.subtotal?.toFixed(2)}</span></div>
              <div style={S.campo}><span style={S.campoLabel}>Total</span><span style={{ ...S.campoVal, color: 'var(--lp-success-600)' }}>${parsed.total?.toFixed(2)} {parsed.moneda}</span></div>
              <div style={S.campo}><span style={S.campoLabel}>Conceptos</span><span style={S.campoVal}>{parsed.conceptos?.length || 0}</span></div>
            </div>

            {candidatos.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-secondary)', marginBottom: 8 }}>
                  OCs candidatas (match por monto ±2%)
                </div>
                {candidatos.map(c => (
                  <div
                    key={c.id}
                    style={{ ...S.ocCandidata, ...(ocSel === c.id ? S.ocCandidataSel : {}) }}
                    onClick={() => setOcSel(ocSel === c.id ? null : c.id)}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{c.codigo} — {c.proveedor}</div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                      Total: ${(c.total || 0).toFixed(2)} · Estado: {c.estado}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {candidatos.length === 0 && (
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--lp-text-tertiary)', padding: '8px 10px', background: 'var(--lp-warning-50)', borderRadius: 'var(--lp-radius-sm)' }}>
                Sin OC candidata por monto. Puedes registrar la factura sin vincular a OC.
              </div>
            )}

            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button style={S.btnPrimary} onClick={registrar}>
                Registrar factura{ocSel ? ' + vincular OC' : ' sin vincular'}
              </button>
              <button style={S.btnGhost} onClick={() => { setParsed(null); setCandidatos([]); setOcSel(null); }}>
                Descartar
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-secondary)', marginBottom: 8 }}>
          Facturas registradas ({facturas.length})
        </div>
        {facturas.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', textAlign: 'center', padding: 24 }}>
            Sin facturas SAT registradas
          </div>
        ) : (
          <div style={S.list}>
            {[...facturas].reverse().map(f => (
              <div key={f.uuid} style={S.row}>
                <div>
                  <div style={{ fontWeight: 700 }}>{f.serie || ''}{f.folio || f.uuid?.slice(0, 8)}</div>
                  <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                    {f.emisor?.rfc} · {f.emisor?.nombre} · {(f.fecha || '').slice(0, 10)}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 700 }}>
                  ${(f.total || 0).toFixed(2)}
                </div>
                <div>
                  {f.ocId ? (
                    <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>OC: {f.ocId}</span>
                  ) : (
                    <span style={S.badge('var(--lp-bg-sunken)', 'var(--lp-text-tertiary)')}>sin OC</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
