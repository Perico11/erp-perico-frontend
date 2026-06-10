import { useState, useMemo } from 'react';
import TopBar from '../../components/layout/TopBar';
import PageTabs from '../../components/ui/PageTabs';
import SegmentedControl from '../../components/ui/SegmentedControl';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useAuth } from '../../context/AuthContext';
import useIsDesktop from '../../hooks/useIsDesktop';

/* DevolucionesMPPage — Capa 3 (Arely / rol compras).
   Devoluciones de MATERIA PRIMA al proveedor. Flujo SEPARADO del de PT.
   - Crear: descuenta inv.mp al registrar (la MP ya se apartó/envió).
   - Cerrar: nota de crédito del proveedor | reembolso+comprobante | (merma se fija al crear).
   Tres pestañas: Por gestionar · Con NC · Merma. */

const S = {
  wrap: { padding: '0 20px 110px' },
  newBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 18px',
    borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 14, fontWeight: 700, background: 'var(--lp-brand-600)', color: '#fff', margin: '4px 0 14px',
  },
  card: {
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm, 16px)', padding: 15, marginBottom: 10,
  },
  chead: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  cod: { fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-700)' },
  estado: (c) => ({ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: c.bg, color: c.fg }),
  mp: { fontSize: 16, fontWeight: 700, color: 'var(--lp-text-primary)', letterSpacing: '-.01em' },
  sub: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 2 },
  chips: { display: 'flex', gap: 7, flexWrap: 'wrap', margin: '10px 0' },
  chip: (kind) => ({
    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
    background: kind === 'descartar' ? 'var(--lp-warning-50)' : 'var(--lp-info-50, #EAF2FB)',
    color: kind === 'descartar' ? 'var(--lp-warning-700)' : 'var(--lp-info-600, #3E7BB6)',
  }),
  motivo: { fontSize: 12.5, color: 'var(--lp-text-secondary)', lineHeight: 1.45, padding: '9px 11px', borderRadius: 11, background: 'var(--lp-bg-sunken)', marginBottom: 12 },
  montorow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  k: { fontSize: 12, color: 'var(--lp-text-secondary)' },
  v: { fontFamily: 'var(--lp-font-mono)', fontSize: 17, fontWeight: 700, color: 'var(--lp-text-primary)' },
  nc: { fontFamily: 'var(--lp-font-mono)', fontSize: 12, color: 'var(--lp-brand-700)', fontWeight: 700 },
  act: { width: '100%', height: 46, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actPrimary: { background: 'var(--lp-brand-600)', color: '#fff' },
  /* Mockup Devoluciones.html: dos caminos de cierre como botones lado a lado */
  actGhost: { background: 'transparent', border: '1px solid var(--lp-border-default)', color: 'var(--lp-text-secondary)' },
  actRow: { display: 'flex', gap: 8 },
  actDone: { background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', border: '1px solid var(--lp-border-subtle)', cursor: 'default' },
  tsub: { fontSize: 12.5, color: 'var(--lp-text-secondary)', margin: '2px 0 12px' },
  link: { display: 'inline-block', marginTop: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--lp-brand-700)', textDecoration: 'none' },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', fontSize: 13.5, padding: '60px 20px', lineHeight: 1.5 },
  obs: { fontSize: 11.5, color: 'var(--lp-warning-700)', marginTop: 6 },

  /* ── Escritorio (ERP Escritorio.html → SCREENS.devol): encabezado, toolbar y tabla ── */
  wrapDesk: { padding: '0 28px 60px' },
  h1: { fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--lp-text-primary)' },
  psub: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3, marginBottom: 18 },
  toolbarRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  tablewrap: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: (alignRight) => ({
    textAlign: alignRight ? 'right' : 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', padding: '12px 16px',
    borderBottom: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-sunken)', whiteSpace: 'nowrap',
  }),
  td: { padding: '13px 16px', borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 13.5, color: 'var(--lp-text-primary)', verticalAlign: 'top' },
  tdFolio: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-brand-700)', whiteSpace: 'nowrap' },
  tdMono: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' },
  tdMut: { fontSize: 12.5, color: 'var(--lp-text-secondary)' },
  estDot: (c) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
    padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
    background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c,
  }),
  actBtn: {
    minHeight: 36, padding: '0 15px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
    background: 'var(--lp-brand-600)', color: '#fff',
  },
  cellLink: { display: 'inline-block', marginTop: 4, fontSize: 12, fontWeight: 600, color: 'var(--lp-brand-700)', textDecoration: 'none' },
};

/* Color del badge de "Cierre" por estado (escritorio) */
const ESTADO_COLOR = {
  por_gestionar: 'var(--lp-warning-600)',
  registrada:    'var(--lp-success-600)',
  merma:         'var(--lp-text-secondary)',
};

/* Tints del mockup (color-mix 14%): Por gestionar=ámbar, cerrada=acento, merma=neutro */
const ESTADO_BADGE = {
  por_gestionar: { bg: 'color-mix(in srgb, var(--lp-warning-600) 14%, transparent)', fg: 'var(--lp-warning-600)', label: 'Por gestionar' },
  registrada:    { bg: 'color-mix(in srgb, var(--lp-brand-600) 14%, transparent)', fg: 'var(--lp-brand-700)', label: 'NC / reembolso' },
  merma:         { bg: 'color-mix(in srgb, var(--lp-text-secondary) 14%, transparent)', fg: 'var(--lp-text-secondary)', label: 'Merma' },
};

const fmtMoney = (n) => (n == null || n === '') ? '—' : '$' + Number(n).toLocaleString('es-MX');

export default function DevolucionesMPPage() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState('por_gestionar');
  const [crear, setCrear] = useState(false);
  /* { dev, tipo } — tipo viene del botón elegido (mockup: Nota de crédito | Reembolso) */
  const [cerrar, setCerrar] = useState(null);

  const { data, loading, reload } = useApiData(() => api.getDevolucionesMP(), null, 60000);
  const { data: invData } = useApiData(() => api.getInventario(), null, 0);
  const { data: maestroData } = useApiData(() => api.getMaestroMP(), null, 0);

  useRealtimeSync({
    onDevolucion: () => reload(),
    onInventario: () => reload(),
  });

  const devs = useMemo(() => {
    const arr = Array.isArray(data) ? data : (data?.data || []);
    return arr.slice().sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));
  }, [data]);

  const counts = useMemo(() => ({
    por_gestionar: devs.filter(d => d.estado === 'por_gestionar').length,
    registrada: devs.filter(d => d.estado === 'registrada').length,
    merma: devs.filter(d => d.estado === 'merma').length,
  }), [devs]);

  const visibles = devs.filter(d => d.estado === tab);

  const tabs = [
    { id: 'por_gestionar', label: `Por gestionar · ${counts.por_gestionar}` },
    { id: 'registrada', label: `Con NC · ${counts.registrada}` },
    { id: 'merma', label: `Merma · ${counts.merma}` },
  ];

  /* ── Escritorio: encabezado + toolbar (tabs izq · botón der) + tabla ── */
  if (isDesktop) {
    return (
      <>
        <TopBar title="Devoluciones a proveedor" />
        <div style={S.wrapDesk}>
          <div style={S.h1}>Devoluciones</div>
          <div style={S.psub}>Materia prima → proveedor</div>

          <div style={S.toolbarRow}>
            <PageTabs tabs={tabs} activeTab={tab} onChange={setTab} />
            <button style={{ ...S.newBtn, margin: 0, marginLeft: 'auto' }} data-id="devoluciones.btn.nueva" data-rol="compras,admin" onClick={() => setCrear(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Nueva devolución
            </button>
          </div>

          {loading && !data ? (
            <div style={S.empty}>Cargando…</div>
          ) : !visibles.length ? (
            <div style={S.empty}>Sin devoluciones aquí.</div>
          ) : (
            <DevTable devs={visibles} onCerrar={(d, tipo) => setCerrar({ dev: d, tipo })} />
          )}
        </div>

        {crear && (
          <CrearSheet
            isDesktop={isDesktop} inv={invData} maestro={maestroData} usuario={user?.nombre}
            onClose={() => setCrear(false)}
            onSaved={() => { setCrear(false); reload(); }}
          />
        )}
        {cerrar && (
          <CerrarSheet
            isDesktop={isDesktop} dev={cerrar.dev} initialTipo={cerrar.tipo}
            onClose={() => setCerrar(null)}
            onSaved={() => { setCerrar(null); reload(); }}
          />
        )}
      </>
    );
  }

  /* ── Móvil (1:1 actual): botón + tabs + cards + bottom-sheets ── */
  return (
    <>
      <TopBar title="Devoluciones a proveedor" />
      <div style={S.wrap}>
        {/* tsub del mockup: "MP a proveedor · N por gestionar" con conteo en vivo */}
        <div style={S.tsub}>MP a proveedor · {counts.por_gestionar} por gestionar</div>

        <button style={S.newBtn} data-id="devoluciones.btn.nueva" data-rol="compras,admin" onClick={() => setCrear(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Nueva devolución
        </button>

        <PageTabs tabs={tabs} activeTab={tab} onChange={setTab} style={{ marginBottom: 14 }} />

        {loading && !data ? (
          <div style={S.empty}>Cargando…</div>
        ) : !visibles.length ? (
          <div style={S.empty}>Sin devoluciones aquí.</div>
        ) : (
          visibles.map(d => <DevCard key={d.id} d={d} onCerrar={(tipo) => setCerrar({ dev: d, tipo })} />)
        )}
      </div>

      {crear && (
        <CrearSheet
          isDesktop={isDesktop} inv={invData} maestro={maestroData} usuario={user?.nombre}
          onClose={() => setCrear(false)}
          onSaved={() => { setCrear(false); reload(); }}
        />
      )}
      {cerrar && (
        <CerrarSheet
          isDesktop={isDesktop} dev={cerrar}
          onClose={() => setCerrar(null)}
          onSaved={() => { setCerrar(null); reload(); }}
        />
      )}
    </>
  );
}

/* ── Tabla de devoluciones (escritorio) — 1:1 SCREENS.devol ── */
function DevTable({ devs, onCerrar }) {
  return (
    <div style={S.tablewrap}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th(false)}>Folio</th>
            <th style={S.th(false)}>Materia prima</th>
            <th style={S.th(false)}>Proveedor</th>
            <th style={S.th(true)}>Monto</th>
            <th style={S.th(false)}>Cierre</th>
            <th style={S.th(true)}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {devs.map(d => {
            const est = ESTADO_BADGE[d.estado] || ESTADO_BADGE.merma;
            const color = ESTADO_COLOR[d.estado] || ESTADO_COLOR.merma;
            const cantTxt = (d.cantidad != null ? d.cantidad + ' ' + (d.unidad || '') : '').trim();
            const dispTxt = d.disposicion === 'descartar' ? 'Descartar (merma)' : 'Devolver a proveedor';
            return (
              <tr key={d.id} data-id="devoluciones-mp.row.item" data-rol="admin,compras">
                <td style={{ ...S.td, ...S.tdFolio }}>{d.codigo || d.id}</td>
                <td style={S.td}>
                  <div style={{ fontWeight: 600 }}>{d.mp}</div>
                  <div style={S.tdMut}>{dispTxt}{cantTxt ? ' · ' + cantTxt : ''}</div>
                  {d.observacionAjuste ? <div style={S.obs}>{d.observacionAjuste}</div> : null}
                </td>
                <td style={S.td}>{d.proveedor || '—'}</td>
                <td style={{ ...S.td, ...S.tdMono, color: 'var(--lp-text-primary)' }}>{fmtMoney(d.montoEstimado)}</td>
                <td style={S.td}>
                  <span style={S.estDot(color)}>
                    <i style={{ width: 6, height: 6, borderRadius: 999, background: color, display: 'inline-block' }} />
                    {est.label}
                  </span>
                  {d.estado === 'registrada' && (
                    <div style={{ ...S.tdMut, marginTop: 4, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-brand-700)', fontWeight: 700 }}>
                      {d.cierreTipo === 'reembolso' ? d.referenciaPago : d.notaCredito}
                    </div>
                  )}
                </td>
                <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {d.estado === 'por_gestionar' && (
                    /* Mockup: NC primario + Reembolso secundario, mismos dos caminos */
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <button type="button" data-id="devoluciones.btn.registrar-nc" data-rol="admin,compras"
                        style={S.actBtn} onClick={() => onCerrar(d, 'nota_credito')}>
                        Nota de crédito
                      </button>
                      <button type="button" data-id="devoluciones.btn.reembolso" data-rol="admin,compras"
                        style={{ ...S.actBtn, background: 'transparent', border: '1px solid var(--lp-border-default)', color: 'var(--lp-text-secondary)' }}
                        onClick={() => onCerrar(d, 'reembolso')}>
                        Reembolso
                      </button>
                    </span>
                  )}
                  {d.estado === 'registrada' && (
                    <div style={{ ...S.tdMut, textAlign: 'right' }}>
                      {d.cierreTipo === 'reembolso' ? 'Reembolso registrado' : 'Crédito registrado'}
                      {d.cierreTipo === 'reembolso' && d.comprobanteArchivo && (
                        <div>
                          <a style={S.cellLink} href={api.comprobanteDevolucionMPUrl(d.id)} target="_blank" rel="noreferrer">Ver comprobante →</a>
                        </div>
                      )}
                    </div>
                  )}
                  {d.estado === 'merma' && (
                    <span style={{ ...S.tdMut, textAlign: 'right' }}>Sin nota de crédito</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DevCard({ d, onCerrar }) {
  const est = ESTADO_BADGE[d.estado] || ESTADO_BADGE.merma;
  const cantTxt = (d.cantidad != null ? d.cantidad + ' ' + (d.unidad || '') : '').trim();
  return (
    <div style={S.card}>
      <div style={S.chead}>
        <span style={S.cod}>{d.codigo || d.id}</span>
        <span style={S.estado(est)}>{est.label}</span>
      </div>
      <div style={S.mp}>{d.mp}</div>
      <div style={S.sub}>{d.proveedor}{cantTxt ? ' · ' + cantTxt : ''}</div>
      <div style={S.chips}>
        <span style={S.chip(d.disposicion)}>{d.disposicion === 'descartar' ? 'Descartar (merma)' : 'Devolver a proveedor'}</span>
      </div>
      {d.motivo ? <div style={S.motivo}>{d.motivo}</div> : null}
      {d.observacionAjuste ? <div style={S.obs}>{d.observacionAjuste}</div> : null}

      {d.estado === 'por_gestionar' && (
        <>
          <div style={S.montorow}>
            <span style={S.k}>Crédito esperado</span>
            <span style={S.v}>{fmtMoney(d.montoEstimado)}</span>
          </div>
          {/* Mockup: dos caminos de cierre auditables, lado a lado */}
          <div style={S.actRow}>
            <button style={{ ...S.act, ...S.actPrimary, flex: 1, width: 'auto' }}
              data-id="devoluciones.btn.registrar-nc" data-rol="compras,admin"
              onClick={() => onCerrar('nota_credito')}>
              Nota de crédito
            </button>
            <button style={{ ...S.act, ...S.actGhost, flex: 1, width: 'auto' }}
              data-id="devoluciones.btn.reembolso" data-rol="compras,admin"
              onClick={() => onCerrar('reembolso')}>
              Reembolso
            </button>
          </div>
        </>
      )}
      {d.estado === 'registrada' && (
        <>
          <div style={S.montorow}>
            <span style={S.k}>
              {d.cierreTipo === 'reembolso' ? 'Reembolso' : 'Nota de crédito'}{' '}
              <span style={S.nc}>{d.cierreTipo === 'reembolso' ? d.referenciaPago : d.notaCredito}</span>
            </span>
            <span style={S.v}>{fmtMoney(d.montoEstimado)}</span>
          </div>
          <button style={{ ...S.act, ...S.actDone }} disabled>
            ✓ {d.cierreTipo === 'reembolso' ? 'Reembolso registrado' : 'Crédito registrado'}
          </button>
          {d.cierreTipo === 'reembolso' && d.comprobanteArchivo && (
            <a style={S.link} href={api.comprobanteDevolucionMPUrl(d.id)} target="_blank" rel="noreferrer">Ver comprobante de pago →</a>
          )}
        </>
      )}
      {d.estado === 'merma' && (
        <button style={{ ...S.act, ...S.actDone }} disabled>
          Descartado como merma — sin nota de crédito
        </button>
      )}
    </div>
  );
}

/* ── Sheet: crear devolución ── */
const SH = {
  /* Bottom-sheet en móvil; modal centrado en escritorio (mismo overlay). */
  overlay: (desktop) => ({ position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 9999, display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', overflow: 'auto', padding: desktop ? 16 : 0 }),
  sheet: (desktop) => ({ background: 'var(--lp-bg-base)', borderRadius: desktop ? 20 : '24px 24px 0 0', padding: '20px 20px 28px', maxWidth: 460, width: '100%', maxHeight: desktop ? '92vh' : '94vh', overflowY: 'auto', boxShadow: desktop ? '0 12px 48px rgba(0,0,0,.28)' : 'none' }),
  h: { fontSize: 18, fontWeight: 700, color: 'var(--lp-text-primary)' },
  s: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2, marginBottom: 8 },
  lbl: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', margin: '16px 2px 6px' },
  input: { width: '100%', height: 46, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 15, color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box' },
  area: { width: '100%', minHeight: 70, padding: '10px 14px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 14.5, color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box', resize: 'vertical' },
  row2: { display: 'flex', gap: 10 },
  hint: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 5 },
  drop: (has) => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 18px', marginTop: 6, border: '1.5px ' + (has ? 'solid var(--lp-brand-600)' : 'dashed var(--lp-border-default)'), borderRadius: 14, background: 'var(--lp-bg-sunken)', cursor: 'pointer', color: has ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)', textAlign: 'center', fontSize: 13, minHeight: 84 }),
  fn: { fontSize: 13, fontWeight: 700, color: 'var(--lp-brand-700)', wordBreak: 'break-all' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: '9px 12px', borderRadius: 8, fontSize: 12, marginTop: 12, whiteSpace: 'pre-line' },
  acts: { display: 'flex', gap: 10, marginTop: 18 },
  btn: { height: 50, borderRadius: 12, border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnGhost: { flex: '0 0 auto', padding: '0 20px', background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' },
  btnPrimary: { flex: 1, background: 'var(--lp-brand-600)', color: '#fff' },
};

function CrearSheet({ isDesktop, inv, maestro, usuario, onClose, onSaved }) {
  /* getInventario() → { ok, data: { mp, pt } }; getMaestroMP() → { ok, data: { mps } }.
     Desenvolvemos .data (con fallback por si el shape cambia). */
  const invMp = (inv && inv.data && inv.data.mp) || (inv && inv.mp) || {};
  const maestroMps = (maestro && maestro.data && maestro.data.mps) || (maestro && maestro.mps) || {};
  const mpList = useMemo(() => Object.keys(invMp).sort((a, b) => a.localeCompare(b)), [invMp]);
  const stockDe = (mp) => {
    const r = invMp[mp];
    return r ? (Number(r.qty) || 0) : null;
  };
  const provDe = (mp) => {
    const m = maestroMps[mp];
    return (m && m.proveedor && (m.proveedor.principal || m.proveedor.proveedor_principal)) || '';
  };

  const [mp, setMp] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('kg');
  const [motivo, setMotivo] = useState('');
  const [disposicion, setDisposicion] = useState('devolver');
  const [monto, setMonto] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const onMp = (val) => {
    setMp(val);
    const p = provDe(val);
    if (p && !proveedor) setProveedor(p);
  };

  const stock = mp ? stockDe(mp) : null;
  const puede = mp.trim() && proveedor.trim() && Number(cantidad) > 0 && motivo.trim().length >= 3;

  const guardar = async () => {
    setErr('');
    if (!puede) { setErr('Completa MP, proveedor, cantidad (>0) y motivo (mín. 3 caracteres).'); return; }
    setSaving(true);
    try {
      await api.crearDevolucionMP({
        mp: mp.trim(), proveedor: proveedor.trim(), cantidad: Number(cantidad),
        unidad: unidad.trim() || 'kg', motivo: motivo.trim(), disposicion,
        montoEstimado: disposicion === 'devolver' && Number(monto) > 0 ? Number(monto) : null,
      });
      onSaved && onSaved();
    } catch (e) {
      setErr(e?.data?.error || e.message || 'Error al crear la devolución');
    } finally { setSaving(false); }
  };

  return (
    <div style={SH.overlay(isDesktop)} onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div style={SH.sheet(isDesktop)}>
        <div style={SH.h}>Nueva devolución de MP</div>
        <div style={SH.s}>La materia prima se descuenta del inventario al registrar.</div>

        <label style={SH.lbl}>Materia prima</label>
        <input style={SH.input} list="mp-list" value={mp} onChange={(e) => onMp(e.target.value)}
          data-id="devoluciones.input.mp" data-rol="compras,admin" placeholder="Escribe o elige una MP" />
        <datalist id="mp-list">{mpList.map(m => <option key={m} value={m} />)}</datalist>
        {mp && stock != null && <div style={SH.hint}>Stock actual: {stock.toLocaleString('es-MX')} {unidad}</div>}

        <label style={SH.lbl}>Proveedor</label>
        <input style={SH.input} value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Proveedor destino de la devolución" />

        <div style={SH.row2}>
          <div style={{ flex: 2 }}>
            <label style={SH.lbl}>Cantidad</label>
            <input style={SH.input} type="number" inputMode="decimal" min="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={SH.lbl}>Unidad</label>
            <input style={SH.input} value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="kg" />
          </div>
        </div>
        {mp && stock != null && Number(cantidad) > stock && (
          <div style={SH.hint}>Excede el stock; se descontará solo lo disponible ({stock.toLocaleString('es-MX')} {unidad}).</div>
        )}

        <label style={SH.lbl}>Motivo</label>
        <textarea style={SH.area} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Humedad fuera de especificación, no pasó QC de entrada…" />

        <label style={SH.lbl}>Disposición</label>
        <div data-id="devoluciones.select.disposicion" data-rol="compras,admin">
          <SegmentedControl
            options={[{ value: 'devolver', label: 'Devolver a proveedor' }, { value: 'descartar', label: 'Descartar (merma)' }]}
            value={disposicion} onChange={setDisposicion}
          />
        </div>

        {disposicion === 'devolver' && (
          <>
            <label style={SH.lbl}>Crédito esperado (opcional)</label>
            <input style={SH.input} type="number" inputMode="decimal" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$ estimado de la nota de crédito" />
          </>
        )}
        {disposicion === 'descartar' && (
          <div style={SH.hint}>Merma: la MP se da de baja sin nota de crédito ni reembolso.</div>
        )}

        {err && <div style={SH.err}>{err}</div>}

        <div style={SH.acts}>
          <button style={{ ...SH.btn, ...SH.btnGhost }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...SH.btn, ...SH.btnPrimary, opacity: puede && !saving ? 1 : 0.5 }}
            data-id="devoluciones.btn.crear" data-rol="compras,admin"
            onClick={guardar} disabled={!puede || saving}>
            {saving ? 'Creando…' : 'Crear devolución'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sheet: cerrar devolución (NC | reembolso+comprobante) ── */
const ICloud = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5-5 5 5" /><path d="M12 5v12" /></svg>
);
const IFile = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
);

function CerrarSheet({ isDesktop, dev, initialTipo, onClose, onSaved }) {
  /* initialTipo: el botón elegido en la card pre-selecciona el camino (mockup §7) */
  const [tipo, setTipo] = useState(initialTipo === 'reembolso' ? 'reembolso' : 'nota_credito');
  const [nc, setNc] = useState('');
  const [ref, setRef] = useState('');
  const [monto, setMonto] = useState(dev.montoEstimado || '');
  const [fileName, setFileName] = useState('');
  const [fileB64, setFileB64] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) { setErr('El comprobante excede 6 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { setFileB64(String(reader.result)); setFileName(f.name); setErr(''); };
    reader.readAsDataURL(f);
  };

  const puede = tipo === 'nota_credito' ? nc.trim() : (ref.trim() && fileB64);

  const guardar = async () => {
    setErr('');
    if (!puede) { setErr(tipo === 'nota_credito' ? 'Folio de nota de crédito requerido.' : 'Adjunta el comprobante y la referencia del reembolso.'); return; }
    setSaving(true);
    try {
      await api.cerrarDevolucionMP({
        id: dev.id, cierreTipo: tipo,
        notaCredito: tipo === 'nota_credito' ? nc.trim() : undefined,
        referenciaPago: tipo === 'reembolso' ? ref.trim() : undefined,
        comprobanteBase64: tipo === 'reembolso' ? fileB64 : undefined,
        monto: Number(monto) > 0 ? Number(monto) : undefined,
      });
      onSaved && onSaved();
    } catch (e) {
      setErr(e?.data?.error || e.message || 'Error al cerrar la devolución');
    } finally { setSaving(false); }
  };

  return (
    <div style={SH.overlay(isDesktop)} onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div style={SH.sheet(isDesktop)}>
        <div style={SH.h}>Cerrar {dev.codigo || 'devolución'}</div>
        <div style={SH.s}>{dev.mp} · {dev.proveedor}{dev.montoEstimado != null ? ` · ${fmtMoney(dev.montoEstimado)}` : ''}</div>

        <SegmentedControl
          options={[{ value: 'nota_credito', label: 'Nota de crédito' }, { value: 'reembolso', label: 'Reembolso' }]}
          value={tipo} onChange={setTipo}
        />

        {tipo === 'nota_credito' ? (
          <>
            <label style={SH.lbl}>Folio de la nota de crédito del proveedor</label>
            <input style={SH.input} value={nc} onChange={(e) => setNc(e.target.value)} placeholder="Ej. NC-PR-118" />
          </>
        ) : (
          <>
            <label style={SH.lbl}>Comprobante del reembolso · obligatorio</label>
            <label style={SH.drop(!!fileB64)} data-id="devoluciones.btn.adjuntar-comprobante" data-rol="compras,admin">
              {fileB64 ? IFile : ICloud}
              {fileB64
                ? <div style={SH.fn}>{fileName}</div>
                : <>
                    <div>Sube la transferencia / recibo del proveedor</div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>PDF o imagen</div>
                  </>}
              <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={onFile} />
            </label>
            <label style={SH.lbl}>Referencia de pago</label>
            <input style={SH.input} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ej. SPEI 0098123" />
          </>
        )}

        <label style={SH.lbl}>Monto (opcional)</label>
        <input style={SH.input} type="number" inputMode="decimal" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$ del crédito / reembolso" />

        {err && <div style={SH.err}>{err}</div>}

        <div style={SH.acts}>
          <button style={{ ...SH.btn, ...SH.btnGhost }} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={{ ...SH.btn, ...SH.btnPrimary, opacity: puede && !saving ? 1 : 0.5 }}
            data-id="devoluciones.btn.confirmar-cierre" data-rol="compras,admin"
            onClick={guardar} disabled={!puede || saving}>
            {saving ? 'Guardando…' : 'Confirmar cierre'}
          </button>
        </div>
      </div>
    </div>
  );
}
