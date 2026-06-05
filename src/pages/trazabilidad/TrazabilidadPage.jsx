import { useState, useMemo, useCallback } from 'react';
import TopBar from '../../components/layout/TopBar';
import api from '../../services/api';
import { useApiData, useSearch } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { ESTADO_LOTE_LABEL } from '../../lib/loteTransiciones';
import PruebaBadge from '../../components/ui/PruebaBadge';
import QRModal, { QRScanner } from '../../components/QRModal';
import { useAuth } from '../../context/AuthContext';
import useConfirm from '../../hooks/useConfirm';
import useIsDesktop from '../../hooks/useIsDesktop';

/* ════════════════════════════════════════════════════════════════════════
   TrazabilidadPage — Reskin "Claude Design" verde (jun 2026).
   Cada lote en su propia card con su timeline INDIVIDUAL (Sprint S: NO
   pipeline agregado). Responsive: escritorio = timeline ancho; móvil =
   timeline vertical compacto. Tokens var(--lp-*) (verde). Sin emojis (SVG
   line). §7: Escanear QR (rol amplio) + Lote manual (admin) cableados.
   Lógica conservada: /api/trazabilidad, realtime, búsqueda, PruebaBadge,
   expand/colapso de sublotes, estados canónicos.
   ════════════════════════════════════════════════════════════════════════ */

/* ── SVG Icons (stroke, same style as nav) ── */
const ICONS = {
  produccion: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  qc: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  envasado: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>,
  clipboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
  truck: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  almacen: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  reenvasado: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>,
  orden: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  fabrica: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  pin: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  qr: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M21 21v-3M14 21h3"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
};

/* labels canónicos importados de lib/loteTransiciones.js. Cada estado lleva
   bg/fg en tokens verdes (paleta del rediseño Claude Design). */
const ESTADO_BG_FG = {
  producido:       { bg: 'var(--lp-brand-100)',   fg: 'var(--lp-brand-700)' },
  qc_aprobado:     { bg: 'var(--lp-success-100)',  fg: 'var(--lp-success-700)' },
  qc_hold:         { bg: 'var(--lp-danger-100)',   fg: 'var(--lp-danger-600)' },
  en_envasado:     { bg: 'var(--lp-warning-100)',  fg: 'var(--lp-warning-600)' },
  envasado:        { bg: 'var(--lp-info-50)',      fg: 'var(--lp-info-600)' },
  en_recoleccion:  { bg: 'var(--lp-brand-50)',     fg: 'var(--lp-brand-600)' },
  en_camino:       { bg: 'var(--lp-warning-100)',  fg: 'var(--lp-warning-600)' },
  en_almacen:      { bg: 'var(--lp-success-100)',  fg: 'var(--lp-success-600)' },
  reenvasado:      { bg: 'var(--lp-info-50)',      fg: 'var(--lp-info-600)' },
  entregado:       { bg: 'var(--lp-success-100)',  fg: 'var(--lp-success-700)' },
};
const ESTADO_CONFIG = Object.keys(ESTADO_BG_FG).reduce((acc, k) => {
  acc[k] = { label: ESTADO_LOTE_LABEL[k] || k, ...ESTADO_BG_FG[k] };
  return acc;
}, { reenvasado: { label: 'Re-envasado', ...ESTADO_BG_FG.reenvasado } });

/* ── Pipeline steps (ordered) — solo para ubicar el avance del lote ── */
const PIPELINE_STEPS = [
  { key: 'orden',          icon: 'orden',       label: 'Orden' },
  { key: 'producido',      icon: 'produccion',  label: 'Producido' },
  { key: 'qc_aprobado',    icon: 'qc',          label: 'QC' },
  { key: 'en_envasado',    icon: 'envasado',    label: 'Envasado' },
  { key: 'en_recoleccion', icon: 'clipboard',   label: 'Por recoger' },
  { key: 'en_camino',      icon: 'truck',       label: 'En camino' },
  { key: 'en_almacen',     icon: 'almacen',     label: 'Almacen' },
  { key: 'reenvasado',     icon: 'reenvasado',  label: 'Re-envasado' },
  { key: 'entregado',      icon: 'check',       label: 'Entregado' },
];

/* ── Estilos ── */
const S = {
  wrap: { padding: '0 20px 100px', maxWidth: 1180, margin: '0 auto' },
  wrapDesk: { padding: '0 32px 80px', maxWidth: 1180, margin: '0 auto' },

  /* Toolbar §7: buscador + Escanear QR + Lote manual */
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap',
  },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200,
    height: 46, padding: '0 14px', borderRadius: 13,
    border: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)',
  },
  search: {
    flex: 1, border: 'none', outline: 'none', background: 'transparent',
    fontSize: 14, fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)',
  },
  /* Botones NO 100% width en escritorio; ≥44px touch en móvil */
  btnGhost: (full) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: 46, padding: '0 16px', borderRadius: 12,
    border: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)',
    color: 'var(--lp-text-secondary)', fontFamily: 'var(--lp-font-sans)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    ...(full ? { flex: 1 } : {}),
  }),
  btnPrimary: (full) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: 46, padding: '0 16px', borderRadius: 12, border: 'none',
    background: 'var(--lp-brand-600)', color: '#fff',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
    ...(full ? { flex: 1 } : {}),
  }),

  filterPill: (active) => ({
    padding: '7px 14px', fontSize: 12, fontWeight: active ? 700 : 600,
    borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
    border: active ? '1px solid transparent' : '1px solid var(--lp-border-subtle)',
    background: active ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)',
    color: active ? '#fff' : 'var(--lp-text-secondary)',
    fontFamily: 'var(--lp-font-sans)',
  }),

  /* ── Cards ── */
  card: {
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-lg)', overflow: 'hidden', marginBottom: 12,
  },
  cardMain: { padding: '15px 16px', cursor: 'pointer' },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginBottom: 6,
  },
  loteCode: {
    fontWeight: 700, fontSize: 13, color: 'var(--lp-brand-600)',
    fontFamily: 'var(--lp-font-mono)', letterSpacing: '.01em',
  },
  badge: (bg, fg) => ({
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px', fontSize: 11,
    fontWeight: 600, borderRadius: 999, background: bg, color: fg,
  }),
  productName: { fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--lp-text-primary)', marginBottom: 3 },
  meta: { fontSize: 12.5, color: 'var(--lp-text-secondary)', fontFamily: 'var(--lp-font-mono)' },
  progress: {
    height: 6, borderRadius: 3, background: 'var(--lp-bg-sunken)',
    marginTop: 10, overflow: 'hidden',
  },
  progressBar: (pct) => ({
    height: '100%', borderRadius: 3, width: `${Math.min(pct, 100)}%`,
    background: pct >= 100 ? 'var(--lp-success-600)' : 'var(--lp-brand-600)',
    transition: 'width .3s',
  }),
  sublotesWrap: {
    padding: '0 16px 14px', borderTop: '1px solid var(--lp-border-subtle)',
  },
  sublote: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
    borderBottom: '1px solid var(--lp-bg-sunken)', fontSize: 12.5,
    color: 'var(--lp-text-secondary)',
  },
  subloteCod: {
    fontWeight: 600, fontFamily: 'var(--lp-font-mono)', fontSize: 11,
    color: 'var(--lp-brand-600)', minWidth: 80,
  },
  faseBadge: (granel) => ({
    display: 'inline-flex', padding: '1px 7px', fontSize: 10.5, fontWeight: 600,
    borderRadius: 999,
    background: granel ? 'var(--lp-brand-50)' : 'var(--lp-info-50)',
    color: granel ? 'var(--lp-brand-700)' : 'var(--lp-info-600)',
  }),
  seclbl: {
    fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', marginBottom: 12,
  },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '48px 0', fontSize: 13.5 },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 12, marginBottom: 16,
  },
  kpi: (accent) => ({
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)', padding: '14px 16px',
    borderTop: `3px solid ${accent}`, textAlign: 'center',
  }),
  kpiLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--lp-text-tertiary)' },
  kpiValue: { fontSize: 26, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', marginTop: 4 },
};

/* ── Helper: determine pipeline position index for a given estado ── */
function pipelineIndex(estado) {
  const idx = PIPELINE_STEPS.findIndex(s => s.key === estado);
  // Map "envasado" to the same position as "en_envasado" (step index 3)
  if (estado === 'envasado') return 3;
  return idx >= 0 ? idx : -1;
}

/* tiempo relativo legible para la bitácora */
function _tiempoRelativo(fechaISO) {
  if (!fechaISO) return '';
  try {
    const t = new Date(fechaISO).getTime();
    const diff = Date.now() - t;
    if (diff < 0) return '';
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `hace ${d} día${d === 1 ? '' : 's'}`;
    const sem = Math.floor(d / 7);
    if (sem < 5) return `hace ${sem} sem`;
    const mes = Math.floor(d / 30);
    return `hace ${mes} mes${mes === 1 ? '' : 'es'}`;
  } catch { return ''; }
}

/* Construye eventos cronológicos del lote + sus sublotes (lote.historial,
   sublote.historial). Si no hay historial, sintetiza el evento inicial. */
function buildEventos(lote) {
  const list = [];
  (lote.historial || []).forEach(h => {
    if (!h || !h.fecha) return;
    list.push({
      fecha: h.fecha, usuario: h.usuario || 'sistema',
      estado: h.estado || h.accion || '—', nota: h.nota || '', scope: 'lote',
    });
  });
  (lote.sublotes || []).forEach(s => {
    (s.historial || []).forEach(h => {
      if (!h || !h.fecha) return;
      list.push({
        fecha: h.fecha, usuario: h.usuario || 'sistema',
        estado: h.estado || h.accion || '—',
        nota: h.nota || `Sublote ${s.cod || ''}`, scope: 'sublote', subloteCod: s.cod,
      });
    });
  });
  if (list.length === 0 && lote.fecha) {
    list.push({
      fecha: lote.fecha, usuario: lote.usuario || 'sistema',
      estado: 'producido', nota: 'Lote creado', scope: 'lote',
    });
  }
  return list.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
}

/* ═══════════════════════════════════════════════════════════════════════
   LoteTimeline — trazabilidad INDIVIDUAL del lote dentro de su card.
   Timeline VERTICAL (referencia Trazabilidad.html / S.traza / vtl()):
     · dot verde con check = etapa completada, con línea verde
     · dot anillo verde con pulso = etapa actual
     · dot anillo gris = etapa pendiente
   Cada fila: etapa (mono no — nombre legible) + hora en mono a la derecha,
   responsable, y nota opcional. isDesktop → más aire y dots grandes.
   ═══════════════════════════════════════════════════════════════════════ */
function LoteTimeline({ lote, isDesktop }) {
  const eventos = useMemo(() => buildEventos(lote), [lote]);

  /* Etiqueta legible del evento (estado canónico → label) */
  const labelEvento = (estado) => {
    const cfg = ESTADO_CONFIG[estado];
    return (cfg && cfg.label) || ESTADO_LOTE_LABEL[estado] || estado;
  };

  const lastIdx = eventos.length - 1;
  const dotSize = isDesktop ? 18 : 16;
  const railLeft = dotSize / 2;          // centro del dot
  const padLeft = dotSize + 16;          // sangría del contenido

  return (
    <div>
      <div style={S.seclbl}>Bitácora del lote ({eventos.length})</div>
      <div style={{ position: 'relative' }}>
        {eventos.map((ev, i) => {
          const done = i < lastIdx;
          const current = i === lastIdx;
          const cfg = ESTADO_CONFIG[ev.estado] || { bg: 'var(--lp-bg-sunken)', fg: 'var(--lp-text-tertiary)' };
          const rel = _tiempoRelativo(ev.fecha);
          const fecha = ev.fecha ? `${ev.fecha.slice(0, 10)} ${ev.fecha.slice(11, 16)}` : '—';
          return (
            <div key={i} style={{
              position: 'relative', paddingLeft: padLeft,
              paddingBottom: i < lastIdx ? (isDesktop ? 20 : 16) : 0,
            }}>
              {/* Línea conectora (no en el último) */}
              {i < lastIdx && (
                <div style={{
                  position: 'absolute', left: railLeft - 1, top: dotSize, bottom: -2,
                  width: 2, background: 'var(--lp-brand-600)',
                }} />
              )}
              {/* Dot */}
              <div style={{
                position: 'absolute', left: 0, top: 1,
                width: dotSize, height: dotSize, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--lp-brand-600)'
                          : current ? 'var(--lp-bg-raised)' : 'var(--lp-bg-raised)',
                border: done ? 'none'
                      : current ? '2px solid var(--lp-brand-600)' : '2px solid var(--lp-border-subtle)',
                boxShadow: current ? '0 0 0 4px var(--lp-brand-100)' : 'none',
              }}>
                {done && (
                  <svg width={dotSize - 6} height={dotSize - 6} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                )}
                {current && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--lp-brand-600)' }} />
                )}
              </div>
              {/* Contenido */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: isDesktop ? 14.5 : 13.5,
                  fontWeight: current || done ? 600 : 500,
                  color: current || done ? 'var(--lp-text-primary)' : 'var(--lp-text-tertiary)',
                }}>
                  {labelEvento(ev.estado)}
                </span>
                <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11, color: 'var(--lp-text-tertiary)', flexShrink: 0 }}>
                  {fecha}
                </span>
              </div>
              {ev.usuario && ev.usuario !== '—' && (
                <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2 }}>
                  Responsable: <b style={{ color: 'var(--lp-text-primary)', fontWeight: 600 }}>{ev.usuario}</b>
                  {ev.scope === 'sublote' && ev.subloteCod && (
                    <span style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)', marginLeft: 6 }}>· {ev.subloteCod}</span>
                  )}
                  {rel && <span style={{ color: 'var(--lp-text-disabled)', fontStyle: 'italic', marginLeft: 6 }}>· {rel}</span>}
                </div>
              )}
              {ev.nota && (
                <div style={{
                  fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 6,
                  padding: '9px 11px', borderRadius: 11, background: 'var(--lp-bg-sunken)',
                  lineHeight: 1.45, borderLeft: `3px solid ${cfg.fg}`,
                }}>
                  {ev.nota}
                </div>
              )}
            </div>
          );
        })}
        {eventos.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)' }}>Sin eventos registrados.</div>
        )}
      </div>
    </div>
  );
}

/* ── Lote Card ── */
function LoteCard({ lote, isDesktop, onShowQR }) {
  const [open, setOpen] = useState(false);
  const est = ESTADO_CONFIG[lote.estado] || { label: lote.estado, bg: 'var(--lp-bg-sunken)', fg: 'var(--lp-text-tertiary)' };
  const sublotes = lote.sublotes || [];
  const litTotal = lote.litrosTotal || 0;
  /* Evitar doble conteo TOTE + hijos finales */
  let litUsed = 0;
  sublotes.forEach(s => {
    if (s.esMerma) return;
    const lit = Number(s.lit) || 0;
    const isTote = s.tipo === 'tote' || s.fase === 1 || s.claseSublote === 'tote';
    if (!isTote) { litUsed += lit; }
    else {
      const tieneHijos = sublotes.some(h => h !== s && (h.fromTote === s.cod || h.esHijoDe === s.cod));
      if (!tieneHijos) litUsed += lit;
    }
  });
  const pct = litTotal > 0 ? Math.round((litUsed / litTotal) * 100) : 0;
  const isPrueba = lote.esPrueba === true;
  const hasTotes = sublotes.some(s => s.tipo === 'tote' || s.fase === 1);
  const idx = pipelineIndex(lote.estado);
  const curStep = idx >= 0 ? PIPELINE_STEPS[Math.min(idx, PIPELINE_STEPS.length - 1)] : null;

  return (
    <div style={{ ...S.card, ...(isPrueba ? { border: '1.5px solid var(--lp-warning-500)', background: 'var(--lp-warning-50)' } : {}) }}>
      <div style={S.cardMain} onClick={() => setOpen(!open)}>
        <div style={S.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={S.loteCode}>{lote.codigoLote || lote.id}</span>
            {isPrueba && <PruebaBadge size="sm" />}
            <span style={S.badge(est.bg, est.fg)}>{est.label}</span>
            {hasTotes && <span style={S.badge('var(--lp-brand-50)', 'var(--lp-brand-700)')}>2 fases</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {/* QR del lote — abre QRModal con el lote */}
            <button
              data-id="traza.btn.ver-qr"
              data-rol="admin,tecnico,almacen,compras,recolector,inventario"
              onClick={(e) => { e.stopPropagation(); onShowQR && onShowQR(lote); }}
              title="Ver / imprimir QR del lote"
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)',
                color: 'var(--lp-text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {ICONS.qr}
            </button>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--lp-text-disabled)', transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none' }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
        <div style={S.productName}>{lote.producto || lote.formula || lote.nombre || '—'}</div>
        {lote.ordenCodigo && (
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--lp-text-disabled)', display: 'inline-flex' }}>{ICONS.orden}</span>
            {lote.ordenCodigo}
          </div>
        )}
        <div style={S.meta}>
          {lote.cantidad ? `${lote.cantidad} cub` : ''}
          {litTotal > 0 ? `${lote.cantidad ? ' · ' : ''}${litTotal} L` : ''}
          {sublotes.length > 0 ? ` · ${sublotes.length} sublote${sublotes.length > 1 ? 's' : ''}` : ''}
          {lote.fecha ? ` · ${lote.fecha.slice(0, 10)}` : ''}
        </div>
        {/* Mini indicador de etapa actual (sin pipeline agregado) */}
        {curStep && !open && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--lp-text-secondary)' }}>
            <span style={{ color: 'var(--lp-brand-600)', display: 'inline-flex' }}>{ICONS[curStep.icon]}</span>
            Etapa: <b style={{ color: 'var(--lp-text-primary)', fontWeight: 600 }}>{curStep.label}</b>
          </div>
        )}
        {litTotal > 0 && (
          <>
            <div style={S.progress}><div style={S.progressBar(pct)} /></div>
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4, textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>
              {litUsed} L / {litTotal} L ({pct}%)
            </div>
          </>
        )}
      </div>

      {/* Trazabilidad individual de ESTE lote (Sprint S). Aparece al expandir,
          aunque no haya sublotes. Escritorio: timeline + sublotes en grid de
          2 columnas para aprovechar el ancho; móvil: apilado. */}
      {open && (
        <div style={S.sublotesWrap}>
          <div style={{
            display: isDesktop && sublotes.length > 0 ? 'grid' : 'block',
            gridTemplateColumns: isDesktop && sublotes.length > 0 ? '1.2fr 1fr' : undefined,
            gap: isDesktop ? 28 : 0, paddingTop: 14,
          }}>
            <LoteTimeline lote={lote} isDesktop={isDesktop} />

            {sublotes.length > 0 && (
              <div style={{ marginTop: isDesktop ? 0 : 16 }}>
                <div style={S.seclbl}>Sublotes ({sublotes.length})</div>
                {sublotes.map((sub, i) => {
                  const isTote = sub.tipo === 'tote' || sub.fase === 1 || sub.claseSublote === 'tote';
                  const desdeTote = sub.fromTote || sub.esHijoDe;
                  const hijosDelTote = isTote ? sublotes.filter(h => h.fromTote === sub.cod || h.esHijoDe === sub.cod) : [];
                  const litHijos = hijosDelTote.reduce((a, h) => a + (Number(h.lit) || 0), 0);
                  const litRestTote = isTote ? Math.max(0, (Number(sub.lit) || 0) - litHijos) : 0;
                  return (
                    <div key={sub.cod || i} style={{
                      ...S.sublote,
                      marginLeft: desdeTote ? 14 : 0,
                      borderLeft: desdeTote ? '3px solid var(--lp-info-600)' : undefined,
                      paddingLeft: desdeTote ? 10 : 0,
                      flexWrap: 'wrap',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                        {desdeTote && <span style={{ fontSize: 12, color: 'var(--lp-info-600)' }}>↳</span>}
                        <span style={S.subloteCod}>{sub.cod || `#${i + 1}`}</span>
                        {isTote && <span style={S.faseBadge(true)}>Granel</span>}
                        {sub.fase === 2 && desdeTote && <span style={S.faseBadge(false)}>Retail</span>}
                        <span style={{ flex: 1 }}>
                          {sub.tipo}{sub.env ? ` · ${sub.env}` : ''}{sub.marca ? ` · ${sub.marca}` : ''}
                          {sub.qty ? ` · x${sub.qty}` : ''}
                          {sub.lit ? ` · ${sub.lit}L` : ''}
                        </span>
                        {sub.tapa && <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>{sub.tapa}</span>}
                        {sub.esMerma && <span style={S.badge('var(--lp-warning-100)', 'var(--lp-warning-600)')}>Merma</span>}
                        {sub.consumido && <span style={S.badge('var(--lp-success-100)', 'var(--lp-success-700)')}>Consumido</span>}
                        <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          {sub.ub === 'teran' ? ICONS.pin : ICONS.fabrica}
                          {sub.ub === 'teran' ? ' Teran' : ' Fabrica'}
                        </span>
                      </div>
                      {isTote && hijosDelTote.length > 0 && (
                        <div style={{ width: '100%', fontSize: 10.5, color: 'var(--lp-text-tertiary)', paddingLeft: 80, fontFamily: 'var(--lp-font-mono)' }}>
                          {litHijos.toFixed(0)}L reenvasado → {litRestTote.toFixed(0)}L pendiente en tote
                        </div>
                      )}
                      {desdeTote && (
                        <div style={{ width: '100%', fontSize: 10.5, color: 'var(--lp-info-600)', paddingLeft: 80 }}>
                          ↳ reenvasado desde tote {desdeTote}
                        </div>
                      )}
                      {sub.fecha && (
                        <div style={{ width: '100%', fontSize: 10.5, color: 'var(--lp-text-tertiary)', paddingLeft: 80, fontFamily: 'var(--lp-font-mono)' }}>
                          {sub.fecha.slice(0, 10)} {sub.fecha.slice(11, 16)}{sub.usuario ? ` · ${sub.usuario}` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/* MAIN PAGE                                                         */
/* ================================================================ */
export default function TrazabilidadPage() {
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const rol = user?.rol || '';
  const esAdmin = rol === 'admin';

  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [filter, setFilter] = useState('todos');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrLote, setQrLote] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirm, ConfirmEl] = useConfirm();

  const { data: trazData, loading, reload } = useApiData(() => api.getTrazabilidad(), [], 8000);

  /* trazabilidad es la fuente de verdad cross-rol — toda transición de
     lote/sublote debe reflejarse al instante. */
  useRealtimeSync({
    onTrazabilidad: () => reload(),
  });

  const showToast = useCallback((msg, isErr = false) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const lotes = useMemo(() => {
    const arr = trazData?.data || (Array.isArray(trazData) ? trazData : []);
    /* Filtrar lotes con soft-delete (eliminado:true). El backend los mantiene
       para auditoría, el frontend no los muestra. */
    return (Array.isArray(arr) ? arr : []).filter(l => l && !l.eliminado);
  }, [trazData]);

  /* Filters por estado (con contadores) */
  const filters = useMemo(() => {
    const all = [{ id: 'todos', label: 'Todos' }];
    const counts = {};
    lotes.forEach(l => {
      const st = l.estado || 'producido';
      counts[st] = (counts[st] || 0) + 1;
    });
    Object.entries(ESTADO_CONFIG).forEach(([key, cfg]) => {
      if (counts[key]) all.push({ id: key, label: `${cfg.label} (${counts[key]})` });
    });
    return all;
  }, [lotes]);

  /* Filtered + searched */
  const filtered = useMemo(() => {
    let arr = lotes;
    if (filter !== 'todos') {
      if (filter === 'en_envasado') {
        arr = arr.filter(l => l.estado === 'en_envasado' || l.estado === 'envasado');
      } else {
        arr = arr.filter(l => l.estado === filter);
      }
    }
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      arr = arr.filter(l =>
        (l.codigoLote || '').toLowerCase().includes(q) ||
        (l.producto || l.formula || l.nombre || '').toLowerCase().includes(q) ||
        (l.ordenCodigo || '').toLowerCase().includes(q)
      );
    }
    return arr.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [lotes, filter, debouncedQuery]);

  /* KPIs */
  const kpis = useMemo(() => {
    const total = lotes.length;
    const hoy = new Date().toISOString().slice(0, 10);
    const lotesHoy = lotes.filter(l => l.fecha?.startsWith(hoy)).length;
    const envasados = lotes.filter(l => ['envasado', 'en_almacen', 'reenvasado', 'entregado'].includes(l.estado)).length;
    const enProceso = lotes.filter(l => ['producido', 'qc_aprobado', 'en_envasado'].includes(l.estado)).length;
    return { total, lotesHoy, envasados, enProceso };
  }, [lotes]);

  /* §7: Escanear QR → busca el lote escaneado y lo trae al buscador.
     Reutiliza el QRScanner compartido (BarcodeDetector / jsQR / manual). */
  const handleScanResult = useCallback((parsed) => {
    setScannerOpen(false);
    const cod = (parsed && (parsed.cod || parsed.codigoLote || parsed.raw)) || '';
    if (!cod) { showToast('No se pudo leer el QR.', true); return; }
    const match = lotes.find(l =>
      (l.codigoLote || '').toLowerCase() === String(cod).toLowerCase() ||
      (l.id || '').toLowerCase() === String(cod).toLowerCase()
    );
    if (match) {
      setQuery(match.codigoLote || match.id || String(cod));
      setFilter('todos');
      showToast(`Lote ${match.codigoLote || match.id} localizado.`);
    } else {
      setQuery(String(cod));
      setFilter('todos');
      showToast(`Buscando "${cod}" — sin coincidencia exacta.`, true);
    }
  }, [lotes, setQuery, showToast]);

  /* §7: + Lote manual (solo admin) → crea un lote en trazabilidad vía
     api.crearLote (server asigna código canónico LP-YYYYMMDD-NNN dentro del
     mutex). Pide producto y cantidad; NO inventa datos extra. */
  const handleLoteManual = useCallback(async () => {
    if (!esAdmin) return;
    const producto = await confirm('Registra un lote manualmente (sin pasar por producción). Quedará auditado.', {
      title: '+ Lote manual',
      confirmText: 'Continuar',
      prompt: { label: 'Producto / fórmula', placeholder: 'Ej. Vinílica azul rey 19L', required: true },
    });
    if (!producto) return;
    const cantStr = await confirm('¿Cuántas cubetas?', {
      title: '+ Lote manual',
      confirmText: 'Crear lote',
      prompt: { label: 'Cantidad (cubetas)', placeholder: '0', required: true },
    });
    if (!cantStr) return;
    const cantidad = Number(cantStr);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      showToast('Cantidad inválida.', true);
      return;
    }
    const ahora = new Date().toISOString();
    const litPerUnit = 19;
    const lotePayload = {
      ordenId: '', ordenCodigo: '',
      producto: producto.trim(), nombre: producto.trim(),
      cantidad,
      litPerUnit,
      litrosTotal: cantidad * litPerUnit,
      estado: 'producido',
      esPrueba: false,
      fecha: ahora,
      usuario: user?.nombre || user?.usuario || 'admin',
      sublotes: [],
      manual: true,
      historial: [{ estado: 'producido', fecha: ahora, usuario: user?.nombre || user?.usuario || 'admin', nota: 'Lote registrado manualmente (admin).' }],
    };
    try {
      const res = await api.crearLote(lotePayload);
      if (!res?.ok || !res?.lote) throw new Error(res?.error || 'No se pudo crear el lote');
      showToast(`Lote ${res.lote.codigoLote || res.lote.id} creado.`);
      reload();
    } catch (e) {
      showToast(e?.message || 'Error al crear lote.', true);
    }
  }, [esAdmin, confirm, showToast, reload, user]);

  if (loading) {
    return (
      <>
        <TopBar title="Trazabilidad" />
        <div style={S.spinner}><div className="lp-spinner" /></div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Trazabilidad" />
      <div style={isDesktop ? S.wrapDesk : S.wrap}>
        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div style={S.kpi('var(--lp-brand-600)')}>
            <div style={S.kpiLabel}>Total Lotes</div>
            <div style={S.kpiValue}>{kpis.total}</div>
          </div>
          <div style={S.kpi('var(--lp-success-600)')}>
            <div style={S.kpiLabel}>Hoy</div>
            <div style={S.kpiValue}>{kpis.lotesHoy}</div>
          </div>
          <div style={S.kpi('var(--lp-warning-600)')}>
            <div style={S.kpiLabel}>En Proceso</div>
            <div style={S.kpiValue}>{kpis.enProceso}</div>
          </div>
          <div style={S.kpi('var(--lp-brand-500)')}>
            <div style={S.kpiLabel}>Envasados</div>
            <div style={S.kpiValue}>{kpis.envasados}</div>
          </div>
        </div>

        {/* Toolbar §7: buscador + Escanear QR (rol amplio) + Lote manual (admin).
            En escritorio los botones van a la derecha del buscador y NO se
            estiran al 100%; en móvil ocupan fila propia con touch ≥46px. */}
        <div style={S.toolbar}>
          <div style={S.searchBox}>
            <span style={{ color: 'var(--lp-text-tertiary)', display: 'inline-flex' }}>{ICONS.search}</span>
            <input
              data-id="traza.input.buscar"
              data-rol="admin,tecnico,almacen,compras,recolector,inventario"
              type="text"
              style={S.search}
              placeholder="Buscar lote, producto, orden o escanear QR..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button
            data-id="traza.btn.escanear-qr"
            data-rol="admin,tecnico,almacen,compras,recolector,inventario"
            style={S.btnGhost(!isDesktop)}
            onClick={() => setScannerOpen(true)}
          >
            {ICONS.qr} Escanear QR
          </button>
          {esAdmin && (
            <button
              data-id="traza.btn.lote-manual"
              data-rol="admin"
              title="Solo admin"
              style={S.btnPrimary(!isDesktop)}
              onClick={handleLoteManual}
            >
              {ICONS.plus} Lote manual
            </button>
          )}
        </div>

        {/* Filter pills por estado (folios mono, scrollable en móvil) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, flexWrap: isDesktop ? 'wrap' : 'nowrap' }}>
          {filters.map(f => (
            <button key={f.id} style={S.filterPill(f.id === filter)} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Lote cards — cada uno con su timeline individual */}
        {filtered.length === 0 ? (
          <div style={S.empty}>
            {debouncedQuery ? `Sin resultados para "${debouncedQuery}"` : 'Sin lotes registrados.'}
          </div>
        ) : (
          filtered.map(lote => (
            <LoteCard
              key={lote.id || lote.codigoLote}
              lote={lote}
              isDesktop={isDesktop}
              onShowQR={setQrLote}
            />
          ))
        )}
      </div>

      {/* §7: Scanner QR compartido (no se modifica QRModal.jsx) */}
      {scannerOpen && (
        <QRScanner
          onResult={handleScanResult}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* QR del lote — modal compartido (no se modifica QRModal.jsx) */}
      {qrLote && <QRModal lote={qrLote} onClose={() => setQrLote(null)} />}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
          left: '50%', transform: 'translateX(-50%)', zIndex: 1200,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 18px', borderRadius: 12,
          background: toast.isErr ? 'var(--lp-danger-100)' : 'var(--lp-brand-600)',
          color: toast.isErr ? 'var(--lp-danger-600)' : '#fff',
          fontSize: 13, fontWeight: 600, fontFamily: 'var(--lp-font-sans)',
          boxShadow: '0 8px 28px -10px rgba(20,30,25,.4)', maxWidth: '90vw',
        }}>
          {toast.isErr ? <span aria-hidden="true">✕</span> : ICONS.check}
          <span>{toast.msg}</span>
        </div>
      )}
      {ConfirmEl}
    </>
  );
}
