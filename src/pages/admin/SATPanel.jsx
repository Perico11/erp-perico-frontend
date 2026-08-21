import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';

/* SATPanel — presentación 1:1 con el mockup `integracion/SAT CFDI.html`
   (dropzone, KPIs "Resumen", cards de factura con folio mono + badges + cruce
   OC, candidatas como opciones seleccionables). La LÓGICA es la misma de
   siempre: subir XML → satParse → elegir OC candidata (match por monto ±2%)
   → satRegistrar con/sin vincular. Lo que el mockup llama "conciliar" ocurre
   aquí al registrar la factura — no existe endpoint para re-conciliar una
   factura ya registrada, por eso las cards registradas no traen ese botón. */

const tint = (c) => `color-mix(in srgb, ${c} 14%, transparent)`;

const S = {
  /* dropzone del mockup */
  drop: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '22px 18px', border: '1.5px dashed var(--lp-border-default)',
    borderRadius: 16, background: 'var(--lp-bg-sunken)', cursor: 'pointer',
    textAlign: 'center', color: 'var(--lp-text-secondary)', fontSize: 13.5,
    fontFamily: 'var(--lp-font-sans)', marginBottom: 4,
  },
  seclbl: {
    fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em',
    color: 'var(--lp-text-tertiary)', margin: '18px 2px 10px',
  },
  kpis: { display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 4 },
  kpi: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, padding: '12px 13px' },
  kpiL: { fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--lp-text-tertiary)' },
  kpiV: { fontFamily: 'var(--lp-font-mono)', fontSize: 19, fontWeight: 700, marginTop: 5, color: 'var(--lp-text-primary)' },
  /* card de factura (fc) */
  fc: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 18, padding: '15px 16px', marginBottom: 11 },
  fcH: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' },
  folio: { fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-700)' },
  badge: (c) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
    padding: '3px 9px', borderRadius: 999, background: tint(c), color: c, whiteSpace: 'nowrap',
  }),
  dot: (c) => ({ width: 6, height: 6, borderRadius: 999, background: c, display: 'inline-block' }),
  prov: { fontSize: 15, fontWeight: 600, color: 'var(--lp-text-primary)' },
  rfc: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)', margin: '2px 0 8px' },
  row2: { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' },
  k: { color: 'var(--lp-text-secondary)' },
  v: { fontWeight: 500, color: 'var(--lp-text-primary)' },
  vMono: { fontWeight: 500, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  /* opciones de OC candidata (opt del mockup) */
  opt: (sel) => ({
    display: 'flex', alignItems: 'center', gap: 11, padding: 13,
    border: '1.5px solid ' + (sel ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'),
    borderRadius: 12, cursor: 'pointer', marginBottom: 9,
    background: sel ? 'color-mix(in srgb, var(--lp-brand-600) 7%, var(--lp-bg-raised))' : 'var(--lp-bg-raised)',
  }),
  btn: {
    height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'var(--lp-brand-600)', color: '#fff', padding: '0 18px',
  },
  btnGhost: {
    height: 44, borderRadius: 12, cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'transparent', border: '1px solid var(--lp-border-default)',
    color: 'var(--lp-text-secondary)', padding: '0 16px',
  },
  err: {
    background: 'color-mix(in srgb, var(--lp-danger-600) 9%, var(--lp-bg-raised))',
    border: '1px solid color-mix(in srgb, var(--lp-danger-600) 26%, transparent)',
    color: 'var(--lp-danger-600)', borderRadius: 14, padding: '12px 14px',
    fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
  },
  ok: {
    background: tint('var(--lp-brand-600)'),
    border: '1px solid color-mix(in srgb, var(--lp-brand-600) 26%, transparent)',
    color: 'var(--lp-brand-700)', borderRadius: 14, padding: '12px 14px',
    fontSize: 13, marginBottom: 12,
  },
  state: { textAlign: 'center', color: 'var(--lp-text-tertiary)', fontSize: 13.5, padding: '48px 20px', lineHeight: 1.5 },
  skel: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, padding: 15, marginBottom: 11 },
  skLn: (w) => ({ height: 11, borderRadius: 6, background: 'var(--lp-bg-sunken)', marginBottom: 9, width: w || '100%' }),
};

const IUp = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5-5 5 5" /><path d="M12 5v12" /></svg>
);
const IWarn = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
);
const ICheck = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

const fmt$ = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SATPanel() {
  const [facturas, setFacturas] = useState([]);
  const [parsed, setParsed] = useState(null);
  const [candidatos, setCandidatos] = useState([]);
  const [ocSel, setOcSel] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [parsing, setParsing] = useState(false);

  const cargar = useCallback(() => {
    api.getFacturasSAT()
      .then(r => setFacturas(Array.isArray(r) ? r : (r.data || [])))
      .catch(e => setErr(e.message));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /* Realtime (T3 jul 2026): canal 'sat' (solo admin) — otra sesión registra
     una factura y esta bandeja refresca sin F5. */
  useRealtimeSync({ onSat: () => cargar() });

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
      setErr(e.message || 'El XML no es un CFDI válido');
    } finally {
      setParsing(false);
    }
  };

  const registrar = async () => {
    if (!parsed) return;
    setErr(''); setOk('');
    try {
      await api.satRegistrar(parsed, ocSel || null);
      setOk(`Factura ${parsed.uuid} registrada${ocSel ? ' y conciliada con ' + ocSel : ' (sin vincular a OC)'}`);
      setParsed(null); setCandidatos([]); setOcSel(null);
      cargar();
    } catch (e) {
      setErr(e.message || 'Error al registrar');
    }
  };

  /* KPIs en vivo (Resumen del mockup) */
  const sinOC = facturas.filter(f => !f.ocId).length;
  const montoTotal = facturas.reduce((s, f) => s + (Number(f.total) || 0), 0);

  const Row = ({ k, v, mono, color }) => (
    <div style={S.row2}>
      <span style={S.k}>{k}</span>
      <span style={{ ...(mono ? S.vMono : S.v), ...(color ? { color } : {}) }}>{v}</span>
    </div>
  );

  return (
    <div style={{ fontFamily: 'var(--lp-font-sans)' }}>
      {err && <div style={S.err}>{IWarn}<span style={{ flex: 1 }}>{err}</span></div>}
      {ok && <div style={S.ok}>{ok}</div>}

      {/* ── Dropzone (mockup): subir XML del CFDI ──
          El input vive DENTRO del label: el click nativo del label abre el
          picker (sin onClick manual, que lo abriría dos veces). */}
      <label style={S.drop} data-id="sat.btn.subir-xml" data-rol="compras,admin">
        {IUp}
        <div>
          {parsing
            ? 'Procesando CFDI…'
            : <>Arrastra o <b style={{ color: 'var(--lp-brand-700)' }}>sube el XML del CFDI</b></>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
          CFDI 4.0 · se cruza automáticamente contra las OC por monto (±2%)
        </div>
        <input
          type="file"
          accept=".xml"
          style={{ display: 'none' }}
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
        />
      </label>

      {/* ── Cargando: skeleton del mockup ── */}
      {parsing && (
        <>
          <style>{`
            @keyframes lpSatPulse { 50% { opacity: .5; } }
            .lp-sat-skel { animation: lpSatPulse 1.3s cubic-bezier(.22,1,.36,1) infinite; }
            @media (prefers-reduced-motion: reduce) { .lp-sat-skel { animation: none; } }
          `}</style>
          <div style={S.seclbl}>Procesando CFDI…</div>
          {[0, 1].map(i => (
            <div key={i} className="lp-sat-skel" style={S.skel}>
              <div style={S.skLn('35%')} />
              <div style={S.skLn()} />
              <div style={{ ...S.skLn('55%'), marginBottom: 0 }} />
            </div>
          ))}
        </>
      )}

      {/* ── CFDI parseado → conciliar y registrar ── */}
      {parsed && !parsing && (
        <>
          <div style={S.seclbl}>Datos extraídos del CFDI</div>
          <div style={S.fc}>
            <div style={S.fcH}>
              <span style={S.folio}>{parsed.serie || ''}{parsed.folio || (parsed.uuid || '').slice(0, 8)}</span>
              <span style={{ ...S.badge('var(--lp-info-600)'), marginLeft: 'auto' }}>Por registrar</span>
            </div>
            <div style={S.prov}>{parsed.emisor?.nombre || 'Emisor'}</div>
            <div style={S.rfc}>{parsed.emisor?.rfc || '—'}</div>
            <Row k="UUID" v={parsed.uuid || '—'} mono />
            <Row k="Fecha" v={parsed.fecha || '—'} mono />
            <Row k="Receptor" v={parsed.receptor?.rfc || '—'} mono />
            <Row k="Subtotal" v={fmt$(parsed.subtotal)} mono />
            <Row k="Total" v={`${fmt$(parsed.total)} ${parsed.moneda || ''}`} mono color="var(--lp-brand-700)" />
            <Row k="Conceptos" v={parsed.conceptos?.length || 0} mono />
          </div>

          {candidatos.length > 0 ? (
            <>
              <div style={S.seclbl}>Conciliar con OC · match por monto ±2%</div>
              <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', margin: '-4px 2px 10px' }}>
                Selecciona la OC a la que corresponde esta factura
              </div>
              {candidatos.map(c => {
                const sel = ocSel === c.id;
                return (
                  <div key={c.id} style={S.opt(sel)} data-id="sat.opt.oc" data-rol="compras,admin"
                    onClick={() => setOcSel(sel ? null : c.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--lp-text-primary)' }}>
                        <span style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-brand-700)' }}>{c.codigo}</span>
                        {' · '}{c.proveedor || 'Proveedor'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2 }}>
                        {fmt$(c.total)} · {c.estado || '—'}
                      </div>
                    </div>
                    {sel && <span style={{ color: 'var(--lp-brand-600)', flexShrink: 0 }}>{ICheck}</span>}
                  </div>
                );
              })}
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', padding: '10px 12px', background: tint('var(--lp-warning-600)'), borderRadius: 12, marginTop: 4 }}>
              Sin OC candidata por monto. Puedes registrar la factura sin vincular a OC.
            </div>
          )}

          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button style={S.btnGhost} data-id="sat.btn.descartar"
              onClick={() => { setParsed(null); setCandidatos([]); setOcSel(null); }}>
              Descartar
            </button>
            <button style={{ ...S.btn, flex: 1 }} data-id="sat.btn.confirmar-conciliacion" data-rol="compras,admin"
              onClick={registrar}>
              {ocSel ? 'Registrar y conciliar' : 'Registrar sin vincular'}
            </button>
          </div>
        </>
      )}

      {/* ── Resumen (KPIs del mockup) ── */}
      <div style={S.seclbl}>Resumen</div>
      <div style={S.kpis}>
        <div style={S.kpi}>
          <div style={S.kpiL}>Facturas</div>
          <div style={S.kpiV}>{facturas.length}</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kpiL}>Sin OC</div>
          <div style={{ ...S.kpiV, color: sinOC > 0 ? 'var(--lp-warning-600)' : 'var(--lp-text-primary)' }}>{sinOC}</div>
        </div>
        <div style={S.kpi}>
          <div style={S.kpiL}>Monto total</div>
          <div style={S.kpiV}>{'$' + Math.round(montoTotal).toLocaleString('es-MX')}</div>
        </div>
      </div>

      {/* ── Facturas (CFDI) — cards del mockup ── */}
      <div style={S.seclbl}>Facturas (CFDI)</div>
      {facturas.length === 0 ? (
        <div style={S.state}>
          Aún no hay facturas cargadas.<br />Sube el XML del CFDI para empezar a conciliar.
        </div>
      ) : (
        [...facturas].reverse().map(f => {
          const conciliada = !!f.ocId;
          const c = conciliada ? 'var(--lp-brand-600)' : 'var(--lp-danger-600)';
          return (
            <div key={f.uuid} style={S.fc} data-id="sat.card.factura" data-rol="compras,admin">
              <div style={S.fcH}>
                <span style={S.folio}>{f.serie || ''}{f.folio || f.uuid?.slice(0, 8)}</span>
                <span style={S.badge(c)}><span style={S.dot(c)} />{conciliada ? 'Conciliada' : 'Sin OC'}</span>
                {conciliada && (
                  <span style={{ ...S.badge('var(--lp-info-600)'), marginLeft: 'auto' }}>▸ {f.ocId}</span>
                )}
              </div>
              <div style={S.prov}>{f.emisor?.nombre || 'Emisor'}</div>
              <div style={S.rfc}>{f.emisor?.rfc || '—'}</div>
              <Row k="Monto" v={fmt$(f.total)} mono />
              <Row k="Fecha" v={(f.fecha || '').slice(0, 10) || '—'} mono />
            </div>
          );
        })
      )}
    </div>
  );
}
