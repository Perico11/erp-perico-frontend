import { useEffect } from 'react';
import { ESTADO_PEDIDO_LABEL, ESTADO_PEDIDO_COLOR, normEstado } from '../../lib/estados';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useIsDesktop from '../../hooks/useIsDesktop';

/* ════════════════════════════════════════════════════════════════════════
   LoteDetalleModal — detalle COMPLETO de un lote SIN salir de la pantalla.
   Pedido dueño (jun 2026): desde Producción > "Lanzar lote" > KPI Lotes, al
   click en un lote ver toda su trazabilidad + el TIEMPO que tardó en
   producirse, inline (no navegar a Trazabilidad). Lee todo del objeto lote
   (ya viene completo de /api/trazabilidad): duracionProduccionMs, sublotes,
   qcResultados, historial. Sin fetch extra. Estados vía lib/estados.
   ════════════════════════════════════════════════════════════════════════ */

/* duración ms → "X h Y min" / "X min Y s" / "X s" */
function fmtDur(ms) {
  if (ms == null || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${sec} s`;
  return `${sec} s`;
}
function fmtFecha(f) {
  if (!f) return '—';
  try { return new Date(f).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}

function Stat({ label, value, big, accent }) {
  return (
    <div style={S.stat}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, ...(big ? S.statBig : {}), ...(accent ? { color: 'var(--lp-brand-600)' } : {}) }}>{value}</div>
    </div>
  );
}
function KV({ k, v }) {
  return (
    <div style={S.kv}>
      <span style={S.kvK}>{k}</span>
      <span style={S.kvV}>{v}</span>
    </div>
  );
}

export default function LoteDetalleModal({ lote, onClose, onVerTrazabilidad }) {
  useBodyScrollLock(!!lote);
  const isDesktop = useIsDesktop();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!lote) return null;

  const cod = lote.codigoLote || lote.codigo || lote.id;
  const est = normEstado(lote.estado);
  const estColor = ESTADO_PEDIDO_COLOR[est] || 'var(--lp-text-tertiary)';
  const sublotes = Array.isArray(lote.sublotes) ? lote.sublotes : [];
  const historial = Array.isArray(lote.historial) ? lote.historial : [];
  const eventos = Array.isArray(lote.eventos) ? lote.eventos : [];
  const nPasos = eventos.filter(e => e.tipo === 'paso_completado').length;
  const qc = lote.qcResultados || lote.qc || {};
  const qcCampos = [
    ['Viscosidad', qc.viscosidad], ['pH', qc.ph], ['Densidad', qc.densidad],
    ['Finura', qc.finura], ['Brillo', qc.brillo], ['Color', qc.color], ['Apariencia', qc.apariencia],
  ].filter(([, v]) => v != null && v !== '');

  return (
    <div style={S.overlay}>
      <div style={{ ...S.sheet, ...(isDesktop ? S.sheetDesktop : S.sheetMobile) }} onClick={e => e.stopPropagation()}>
        {/* ── Header ── */}
        <div style={S.head}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={S.cod}>{cod}{lote.bachaDe > 1 && <span style={S.bacha}>Bacha {lote.bachaIndex}/{lote.bachaDe}</span>}{lote.esPrueba && <span style={S.prueba}>🧪 prueba</span>}</div>
            <div style={S.prod}>{lote.producto || lote.nombre || '—'}</div>
          </div>
          <span style={{ ...S.estado, background: estColor + '22', color: estColor }}>{ESTADO_PEDIDO_LABEL[est] || est || '—'}</span>
          <button style={S.closeBtn} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div style={S.body}>
          {/* ── TIEMPO DE PRODUCCIÓN ── */}
          <div style={S.section}>
            <div style={S.secTitle}>Tiempo de producción</div>
            <div style={S.statGrid}>
              <Stat label="Duración total" value={fmtDur(lote.duracionProduccionMs)} big accent />
              <Stat label="Tiempo activo" value={fmtDur(lote.tiempoActivoMs)} />
              <Stat label="Pausado" value={fmtDur(lote.tiempoPausadoMs)} />
              <Stat label="Pausas" value={String(lote.numPausas ?? 0)} />
            </div>
            <div style={S.timeRange}>
              Inicio {fmtFecha(lote.fechaInicio)} &rarr; Fin {fmtFecha(lote.fechaFin)}
              {nPasos > 0 && <> · {nPasos} pasos completados</>}
            </div>
          </div>

          {/* ── RESUMEN ── */}
          <div style={S.section}>
            <div style={S.secTitle}>Resumen</div>
            <div style={S.kvGrid}>
              <KV k="Cantidad" v={lote.cantidad != null ? `${lote.cantidad} ${lote.cantidad === 1 ? 'pza' : 'pzas'}` : '—'} />
              <KV k="Litros total" v={lote.litrosTotal != null ? `${lote.litrosTotal} L` : '—'} />
              <KV k="Producido por" v={lote.usuario || lote.creadoPor || '—'} />
              {lote.ordenCodigo && <KV k="Orden" v={lote.ordenCodigo} />}
              {lote.fechaCaducidad && <KV k="Caducidad" v={fmtFecha(lote.fechaCaducidad)} />}
              {lote.shelfLifeMonths && <KV k="Vida útil" v={`${lote.shelfLifeMonths} meses`} />}
            </div>
          </div>

          {/* ── CALIDAD (QC) ── */}
          {(qcCampos.length > 0 || qc.aprobado != null) && (
            <div style={S.section}>
              <div style={S.secTitle}>
                Calidad (QC)
                {qc.aprobado != null && (
                  <span style={{ ...S.qcBadge, background: (qc.aprobado ? 'var(--lp-success-600)' : 'var(--lp-danger-600)') + '22', color: qc.aprobado ? 'var(--lp-success-600)' : 'var(--lp-danger-600)' }}>
                    {qc.aprobado ? 'Aprobado' : 'Rechazado'}
                  </span>
                )}
              </div>
              {qcCampos.length > 0 && (
                <div style={S.kvGrid}>
                  {qcCampos.map(([k, v]) => <KV key={k} k={k} v={String(v)} />)}
                </div>
              )}
              {qc.notas && <div style={S.notas}>{qc.notas}</div>}
            </div>
          )}

          {/* ── ENVASADO / SUBLOTES ── */}
          {sublotes.length > 0 && (
            <div style={S.section}>
              <div style={S.secTitle}>Envasado · {sublotes.length} sublote{sublotes.length > 1 ? 's' : ''}</div>
              {sublotes.map((s, i) => (
                <div key={s.cod || i} style={S.subRow}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={S.subCod}>{s.cod}{s.esMerma && <span style={S.merma}>merma</span>}</div>
                    <div style={S.subMeta}>{s.env || s.tipo}{s.marca ? ` · ${s.marca}` : ''}{s.tapa ? ` · ${s.tapa}` : ''}</div>
                  </div>
                  <div style={S.subQty}>{s.qty} pz · {s.lit} L</div>
                  <span style={S.subUb}>{s.ub === 'teran' ? 'Terán' : 'Fábrica'}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── LÍNEA DE TIEMPO (historial de estados) ── */}
          {historial.length > 0 && (
            <div style={S.section}>
              <div style={S.secTitle}>Línea de tiempo</div>
              <div style={S.timeline}>
                {historial.map((h, i) => {
                  const he = normEstado(h.estado);
                  const c = ESTADO_PEDIDO_COLOR[he] || 'var(--lp-brand-500)';
                  return (
                    <div key={i} style={S.tlItem}>
                      <div style={S.tlRail}>
                        <div style={{ ...S.tlDot, background: c }} />
                        {i < historial.length - 1 && <div style={S.tlLine} />}
                      </div>
                      <div style={{ minWidth: 0, flex: 1, paddingBottom: i < historial.length - 1 ? 14 : 0 }}>
                        <div style={S.tlTop}>
                          <span style={{ fontWeight: 700, color: c }}>{ESTADO_PEDIDO_LABEL[he] || he}</span>
                          <span style={S.tlTime}>{fmtFecha(h.fecha)}</span>
                        </div>
                        {h.nota && <div style={S.tlNota}>{h.nota}</div>}
                        {h.usuario && <div style={S.tlUser}>por {h.usuario}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={S.foot}>
          {onVerTrazabilidad && (
            <button style={S.footLink} onClick={onVerTrazabilidad}>Ver en Trazabilidad &rarr;</button>
          )}
          <button style={S.footClose} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,.45)',
    display: 'flex', justifyContent: 'center',
  },
  sheet: {
    background: 'var(--lp-bg-raised)', display: 'flex', flexDirection: 'column',
    boxShadow: '0 12px 48px rgba(0,0,0,.25)', overflow: 'hidden',
  },
  sheetDesktop: {
    width: 'min(580px, 94vw)', maxHeight: '88vh', margin: 'auto',
    borderRadius: 'var(--lp-radius-lg, 18px)',
  },
  sheetMobile: {
    width: '100%', maxHeight: 'calc(var(--pp-vvh, 100vh) - 24px)',
    marginTop: 'auto', borderRadius: '24px 24px 0 0',
  },
  head: {
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '16px 18px',
    borderBottom: '1px solid var(--lp-border-subtle)',
  },
  cod: { fontSize: 14, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  prod: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3 },
  prueba: { fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)' },
  bacha: { fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)' },
  estado: { fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0, alignSelf: 'center' },
  closeBtn: { border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--lp-text-tertiary)', fontSize: 16, lineHeight: 1, padding: 4, flexShrink: 0 },

  body: { padding: '4px 18px 8px', overflowY: 'auto', flex: 1 },
  section: { padding: '14px 0', borderBottom: '1px solid var(--lp-border-subtle)' },
  secTitle: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 },

  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 },
  stat: { background: 'var(--lp-bg-base)', borderRadius: 12, padding: '10px 12px' },
  statLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--lp-text-tertiary)' },
  statValue: { fontSize: 15, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', marginTop: 4 },
  statBig: { fontSize: 20 },
  timeRange: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 10 },

  kvGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px 16px' },
  kv: { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 },
  kvK: { color: 'var(--lp-text-tertiary)' },
  kvV: { color: 'var(--lp-text-primary)', fontWeight: 600, textAlign: 'right', minWidth: 0 },

  qcBadge: { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 },
  notas: { fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 10, lineHeight: 1.5, fontStyle: 'italic' },

  subRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--lp-border-subtle)' },
  subCod: { fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', display: 'flex', alignItems: 'center', gap: 6 },
  subMeta: { fontSize: 11.5, color: 'var(--lp-text-secondary)', marginTop: 2 },
  subQty: { fontSize: 12, fontWeight: 600, color: 'var(--lp-text-primary)', whiteSpace: 'nowrap', flexShrink: 0 },
  subUb: { fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--lp-bg-base)', color: 'var(--lp-text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 },
  merma: { fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: 'var(--lp-danger-100, #FEE2E2)', color: 'var(--lp-danger-600)' },

  timeline: { display: 'flex', flexDirection: 'column' },
  tlItem: { display: 'flex', gap: 12 },
  tlRail: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 },
  tlDot: { width: 11, height: 11, borderRadius: 999, marginTop: 3 },
  tlLine: { width: 2, flex: 1, background: 'var(--lp-border-subtle)', marginTop: 2 },
  tlTop: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  tlTime: { fontSize: 11, color: 'var(--lp-text-tertiary)', whiteSpace: 'nowrap' },
  tlNota: { fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2, lineHeight: 1.45 },
  tlUser: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 },

  foot: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    padding: '12px 18px', borderTop: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-base)',
  },
  footLink: { border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--lp-brand-600)', fontSize: 13, fontWeight: 600, font: 'inherit', padding: 0 },
  footClose: { border: '1px solid var(--lp-border)', background: 'var(--lp-bg-raised)', cursor: 'pointer', color: 'var(--lp-text-primary)', fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 10, marginLeft: 'auto' },
};
