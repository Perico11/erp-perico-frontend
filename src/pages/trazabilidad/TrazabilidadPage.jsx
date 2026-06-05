import { useState, useMemo } from 'react';
import TopBar from '../../components/layout/TopBar';
import api from '../../services/api';
import { useApiData, useSearch } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { ESTADO_LOTE_LABEL } from '../../lib/loteTransiciones';
import PruebaBadge from '../../components/ui/PruebaBadge';

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
};

/* X3 (jun 2026): labels canónicos importados de lib/loteTransiciones.js,
   bg/fg local porque TrazabilidadPage usa una paleta pastel distinta. */
const ESTADO_BG_FG = {
  producido:       { bg: 'var(--lp-brand-100)',   fg: 'var(--lp-brand-700)' },
  qc_aprobado:     { bg: '#D1FAE5',              fg: '#065F46' },
  qc_hold:         { bg: 'var(--lp-danger-100)',  fg: 'var(--lp-danger-600)' },
  en_envasado:     { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
  envasado:        { bg: '#DBEAFE',              fg: '#1E40AF' },
  en_recoleccion:  { bg: '#EDE9FE',              fg: '#7C3AED' },
  en_camino:       { bg: '#FEF3C7',              fg: '#92400E' },
  en_almacen:      { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-600)' },
  reenvasado:      { bg: '#FAECE7',              fg: '#993C1D' },
  entregado:       { bg: 'var(--lp-success-100)', fg: 'var(--lp-success-700)' },
};
const ESTADO_CONFIG = Object.keys(ESTADO_BG_FG).reduce((acc, k) => {
  acc[k] = { label: ESTADO_LOTE_LABEL[k] || k, ...ESTADO_BG_FG[k] };
  return acc;
}, { reenvasado: { label: 'Re-envasado', ...ESTADO_BG_FG.reenvasado } });

/* ── Pipeline steps (ordered) ── */
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

/* ── Styles ── */
const S = {
  wrap: { padding: '0 20px 100px' },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap',
  },
  search: {
    flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: '#fff', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  filterPill: (active) => ({
    padding: '6px 14px', fontSize: 11, fontWeight: active ? 600 : 500,
    borderRadius: 20, border: 'none', cursor: 'pointer',
    background: active ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)',
    color: active ? '#fff' : 'var(--lp-text-secondary)',
    fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap',
  }),

  /* ── Pipeline Track (Propuesta C) ── */
  trackWrap: {
    position: 'relative', overflowX: 'auto', padding: '8px 0 20px',
    marginBottom: 16, WebkitOverflowScrolling: 'touch',
    /* En móvil mostramos scrollbar fino para que el usuario sepa que el
       pipeline es ancho y puede deslizar horizontalmente. Antes era 'none'
       y la affordance estaba oculta. */
    scrollbarWidth: 'thin',
  },
  trackInner: { position: 'relative', minWidth: 720, padding: '0 8px' },
  trackLine: {
    position: 'absolute', top: 19, left: 32, right: 32, height: 3,
    background: 'var(--lp-border-subtle)', borderRadius: 2, zIndex: 0,
  },
  trackFill: (pct) => ({
    height: '100%', width: `${pct}%`, borderRadius: 2,
    background: 'var(--lp-brand-600)', transition: 'width .4s ease',
  }),
  trackNodes: {
    display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1,
  },
  trackNode: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    cursor: 'pointer', width: 68,
  },
  trackCircle: (state) => {
    // state: 'done' | 'active' | 'optional' | 'default'
    const base = {
      width: 38, height: 38, borderRadius: '50%', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      transition: 'all .15s', border: '2.5px solid var(--lp-border-subtle)',
      background: 'var(--lp-bg-raised)',
    };
    if (state === 'done') return { ...base, borderColor: '#0F6E56', background: '#E1F5EE' };
    if (state === 'active') return { ...base, borderColor: 'var(--lp-brand-600)', background: '#EEEDFE', boxShadow: '0 0 0 3px rgba(99,90,183,0.12)' };
    if (state === 'optional') return { ...base, opacity: 0.35 };
    return base;
  },
  trackIconColor: (state) => {
    if (state === 'done') return '#085041';
    if (state === 'active') return 'var(--lp-brand-700)';
    return 'var(--lp-text-tertiary)';
  },
  trackLabel: (state) => ({
    fontSize: 11, fontWeight: state === 'active' ? 700 : 500, marginTop: 5,
    color: state === 'active' ? 'var(--lp-brand-700)' : state === 'done' ? '#0F6E56' : 'var(--lp-text-secondary)',
    textAlign: 'center', lineHeight: 1.15, maxWidth: 64,
  }),
  trackCount: (state) => ({
    fontSize: 11, fontWeight: 600, fontFamily: 'var(--lp-font-mono)', marginTop: 2,
    color: state === 'active' ? 'var(--lp-brand-600)' : state === 'done' ? '#0F6E56' : 'var(--lp-text-tertiary)',
    background: state === 'active' ? 'var(--lp-brand-100)' : state === 'done' ? '#E1F5EE' : 'transparent',
    padding: state === 'active' || state === 'done' ? '0 6px' : '0',
    borderRadius: 6, minWidth: 14, textAlign: 'center',
  }),

  /* ── Cards ── */
  card: {
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', overflow: 'hidden', marginBottom: 10,
  },
  cardMain: { padding: '14px 16px', cursor: 'pointer' },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginBottom: 6,
  },
  loteCode: {
    fontWeight: 700, fontSize: 12, color: 'var(--lp-brand-600)',
    fontFamily: 'var(--lp-font-mono)',
  },
  badge: (bg, fg) => ({
    display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 600,
    borderRadius: 6, background: bg, color: fg,
  }),
  productName: { fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 4 },
  meta: { fontSize: 12, color: 'var(--lp-text-secondary)' },
  progress: {
    height: 6, borderRadius: 3, background: 'var(--lp-border-subtle)',
    marginTop: 8, overflow: 'hidden',
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
    borderBottom: '1px solid var(--lp-bg-sunken)', fontSize: 12,
  },
  subloteCod: {
    fontWeight: 600, fontFamily: 'var(--lp-font-mono)', fontSize: 11,
    color: 'var(--lp-brand-600)', minWidth: 80,
  },
  faseBadge: (fase) => ({
    display: 'inline-flex', padding: '1px 6px', fontSize: 11, fontWeight: 600,
    borderRadius: 4,
    background: fase === 1 ? '#EDE9FE' : '#DBEAFE',
    color: fase === 1 ? '#7C3AED' : '#1E40AF',
  }),
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0', fontSize: 13 },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
  kpiGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10, marginBottom: 16,
  },
  kpi: (accent) => ({
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)', padding: '14px 16px',
    borderTop: `3px solid ${accent}`, textAlign: 'center',
  }),
  kpiLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-tertiary)' },
  kpiValue: { fontSize: 24, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', marginTop: 4 },
};

/* ── Helper: determine pipeline position index for a given estado ── */
function pipelineIndex(estado) {
  const idx = PIPELINE_STEPS.findIndex(s => s.key === estado);
  // Map "envasado" to the same position as "en_envasado" (step index 3)
  if (estado === 'envasado') return 3;
  return idx >= 0 ? idx : -1;
}

/* Z7 (jun 2026): tiempo relativo legible para la bitácora */
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

/* ═══════════════════════════════════════════════════════════════════════
   LoteHistorialTimeline — Sprint S (jun 2026).
   Trazabilidad INDIVIDUAL del lote, dentro de su propia card.
   Reemplaza al pipeline general agregado (que sumaba lotes en lugar de
   mostrar el rastro real de cada uno). Muestra:
     1. Mini-pipeline horizontal: pasos pasados (verde) · paso actual
        (azul activo) · pasos pendientes (gris)
     2. Timeline detallado con fechas, usuarios y notas, derivado de
        lote.historial y lote.sublotes[].historial
   ═══════════════════════════════════════════════════════════════════════ */
function LoteHistorialTimeline({ lote }) {
  const currentIdx = pipelineIndex(lote.estado);

  /* Construir lista cronológica de eventos relevantes del lote y sus
     sublotes para mostrar quién hizo qué y cuándo. */
  const eventos = useMemo(() => {
    const list = [];
    /* Historial del lote */
    (lote.historial || []).forEach(h => {
      if (!h || !h.fecha) return;
      list.push({
        fecha: h.fecha,
        usuario: h.usuario || 'sistema',
        estado: h.estado || h.accion || '—',
        nota: h.nota || '',
        scope: 'lote',
      });
    });
    /* Historial de cada sublote (cuando Luis recoge, Josué recibe, etc.) */
    (lote.sublotes || []).forEach(s => {
      (s.historial || []).forEach(h => {
        if (!h || !h.fecha) return;
        list.push({
          fecha: h.fecha,
          usuario: h.usuario || 'sistema',
          estado: h.estado || h.accion || '—',
          nota: h.nota || `Sublote ${s.cod || ''}`,
          scope: 'sublote',
          subloteCod: s.cod,
        });
      });
    });
    /* Si no hay historial pero hay fecha del lote, agregar evento inicial */
    if (list.length === 0 && lote.fecha) {
      list.push({
        fecha: lote.fecha,
        usuario: lote.usuario || 'sistema',
        estado: 'producido',
        nota: 'Lote creado',
        scope: 'lote',
      });
    }
    return list.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  }, [lote]);

  return (
    <div style={{ padding: '12px 0 0' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
        Trazabilidad de este lote
      </div>

      {/* Z7 (jun 2026): mini-pipeline horizontal del lote — más compacto.
          Antes minWidth:580 forzaba scroll en móvil; ahora 360 para que
          quepa en 375px con margen y solo scrollea cuando todos los pasos
          tienen labels largos. Iconos más chicos (26→26 sin cambio) pero
          padding mejor. */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: 0, minWidth: 360, position: 'relative', padding: '6px 4px' }}>
          {/* Línea de fondo */}
          <div style={{
            position: 'absolute', top: 18, left: 20, right: 20, height: 2,
            background: 'var(--lp-border-subtle)', zIndex: 0,
          }}>
            <div style={{
              height: '100%',
              width: currentIdx > 0 ? `${(currentIdx / (PIPELINE_STEPS.length - 1)) * 100}%` : '0%',
              background: 'var(--lp-success-500)',
              transition: 'width .3s ease',
            }} />
          </div>
          {PIPELINE_STEPS.map((step, i) => {
            const done = i < currentIdx;
            const current = i === currentIdx;
            const optional = step.key === 'reenvasado' && !((lote.sublotes || []).some(s => s.tipo === 'tote' || s.fase === 1));
            const bg = current ? 'var(--lp-brand-600)'
                     : done    ? 'var(--lp-success-500)'
                     : optional? 'transparent'
                     :           'var(--lp-bg-sunken)';
            const fg = current || done ? '#fff' : optional ? 'var(--lp-text-disabled)' : 'var(--lp-text-tertiary)';
            const border = optional ? '1.5px dashed var(--lp-border-default)' : 'none';
            return (
              <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1, minWidth: 48 }}>
                <div style={{
                  width: current ? 34 : 28, height: current ? 34 : 28, borderRadius: '50%',
                  background: bg, color: fg, border,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, marginBottom: 4,
                  boxShadow: current ? '0 0 0 4px var(--lp-brand-100)' : 'none',
                  transition: 'all .2s',
                }}>
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : ICONS[step.icon]}
                </div>
                <span style={{
                  fontSize: 9.5, fontWeight: current ? 700 : 500,
                  color: current ? 'var(--lp-brand-700)' : done ? 'var(--lp-success-700)' : 'var(--lp-text-tertiary)',
                  textAlign: 'center', maxWidth: 62, lineHeight: 1.2,
                }}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline detallado */}
      {eventos.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--lp-border-subtle)', paddingTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
            Bitácora ({eventos.length} eventos)
          </div>
          <div style={{ position: 'relative', paddingLeft: 14 }}>
            {/* Línea vertical de la timeline */}
            <div style={{
              position: 'absolute', left: 4, top: 4, bottom: 4, width: 2,
              background: 'var(--lp-border-subtle)',
            }} />
            {eventos.map((ev, i) => {
              const cfg = ESTADO_CONFIG[ev.estado] || { bg: 'var(--lp-bg-sunken)', fg: 'var(--lp-text-tertiary)', label: ev.estado };
              return (
                <div key={i} style={{ position: 'relative', paddingLeft: 14, paddingBottom: 8 }}>
                  <div style={{
                    position: 'absolute', left: -4, top: 5, width: 10, height: 10, borderRadius: '50%',
                    background: cfg.fg, border: '2px solid var(--lp-bg-raised)',
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: cfg.bg, color: cfg.fg, textTransform: 'uppercase', letterSpacing: '.04em',
                    }}>{cfg.label || ev.estado}</span>
                    {ev.scope === 'sublote' && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)' }}>
                        {ev.subloteCod}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                      {ev.fecha?.slice(0, 10)} {ev.fecha?.slice(11, 16)} · {ev.usuario}
                    </span>
                    {(() => {
                      const rel = _tiempoRelativo(ev.fecha);
                      return rel ? (
                        <span style={{ fontSize: 10, color: 'var(--lp-text-disabled)', fontStyle: 'italic' }}>
                          {rel}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  {ev.nota && (
                    <div style={{ fontSize: 11, color: 'var(--lp-text-secondary)', marginTop: 2 }}>{ev.nota}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Lote Card ── */
function LoteCard({ lote }) {
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

  return (
    <div style={{ ...S.card, ...(isPrueba ? { border: '1.5px solid var(--lp-warning-200)', background: 'var(--lp-warning-50)' } : {}) }}>
      <div style={S.cardMain} onClick={() => setOpen(!open)}>
        <div style={S.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={S.loteCode}>{lote.codigoLote || lote.id}</span>
            {isPrueba && <PruebaBadge size="sm" />}
            <span style={S.badge(est.bg, est.fg)}>{est.label}</span>
            {hasTotes && <span style={S.badge('#EDE9FE', '#7C3AED')}>2 fases</span>}
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--lp-text-disabled)', transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
        <div style={S.productName}>{lote.producto || lote.formula || lote.nombre || '—'}</div>
        {lote.ordenCodigo && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--lp-text-disabled)', display: 'inline-flex' }}>{ICONS.orden}</span>
            {lote.ordenCodigo}
          </div>
        )}
        <div style={S.meta}>
          {lote.cantidad && `${lote.cantidad} cubetas`}
          {litTotal > 0 && ` · ${litTotal}L total`}
          {sublotes.length > 0 && ` · ${sublotes.length} sublote${sublotes.length > 1 ? 's' : ''}`}
          {lote.fecha && ` · ${lote.fecha.slice(0, 10)}`}
        </div>
        {litTotal > 0 && (
          <div style={S.progress}><div style={S.progressBar(pct)} /></div>
        )}
        {litTotal > 0 && (
          <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4, textAlign: 'right' }}>
            {litUsed}L / {litTotal}L ({pct}%)
          </div>
        )}
      </div>

      {/* FIX jun 2026 (Sprint S): trazabilidad individual de ESTE lote,
          ya no agregada arriba. Aparece siempre al expandir, aunque no
          haya sublotes (ej. lote recién producido). */}
      {open && (
        <div style={S.sublotesWrap}>
          <LoteHistorialTimeline lote={lote} />
        </div>
      )}

      {open && sublotes.length > 0 && (
        <div style={S.sublotesWrap}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', padding: '10px 0 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Sublotes
          </div>
          {sublotes.map((sub, i) => {
            const isTote = sub.tipo === 'tote' || sub.fase === 1 || sub.claseSublote === 'tote';
            const desdeTote = sub.fromTote || sub.esHijoDe;
            const hijosDelTote = isTote ? sublotes.filter(h => h.fromTote === sub.cod || h.esHijoDe === sub.cod) : [];
            const litHijos = hijosDelTote.reduce((a, h) => a + (Number(h.lit) || 0), 0);
            const litRestTote = isTote ? Math.max(0, (Number(sub.lit) || 0) - litHijos) : 0;
            return (
            <div key={sub.cod || i} style={{
              ...S.sublote,
              marginLeft: desdeTote ? 16 : 0,
              borderLeft: desdeTote ? '3px solid #1E40AF' : undefined,
              paddingLeft: desdeTote ? 10 : 0,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                {desdeTote && <span style={{ fontSize: 11, color: '#1E40AF' }}>↳</span>}
                <span style={S.subloteCod}>{sub.cod || `#${i + 1}`}</span>
                {isTote && <span style={S.faseBadge(1)}>Granel</span>}
                {sub.fase === 2 && desdeTote && <span style={S.faseBadge(2)}>Retail</span>}
                <span style={{ flex: 1 }}>
                  {sub.tipo}{sub.env ? ` · ${sub.env}` : ''}{sub.marca ? ` · ${sub.marca}` : ''}
                  {sub.qty ? ` · x${sub.qty}` : ''}
                  {sub.lit ? ` · ${sub.lit}L` : ''}
                </span>
                {sub.tapa && <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>{sub.tapa}</span>}
                {sub.esMerma && <span style={S.badge('var(--lp-warning-100)', 'var(--lp-warning-600)')}>Merma</span>}
                {sub.consumido && <span style={S.badge('#D1FAE5', '#065F46')}>Consumido</span>}
                <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {sub.ub === 'teran' ? ICONS.pin : ICONS.fabrica}
                  {sub.ub === 'teran' ? ' Teran' : ' Fabrica'}
                </span>
              </div>
              {/* Trazabilidad de envasado */}
              {isTote && hijosDelTote.length > 0 && (
                <div style={{ width: '100%', fontSize: 10, color: 'var(--lp-text-tertiary)', paddingLeft: 80 }}>
                  {litHijos.toFixed(0)}L reenvasado → {litRestTote.toFixed(0)}L pendiente en tote
                </div>
              )}
              {desdeTote && (
                <div style={{ width: '100%', fontSize: 10, color: '#1E40AF', paddingLeft: 80 }}>
                  ↳ reenvasado desde tote {desdeTote}
                </div>
              )}
              {sub.fecha && (
                <div style={{ width: '100%', fontSize: 10, color: 'var(--lp-text-tertiary)', paddingLeft: 80 }}>
                  {sub.fecha.slice(0, 10)} {sub.fecha.slice(11, 16)}{sub.usuario ? ` · ${sub.usuario}` : ''}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* (jun 2026 Sprint S): se eliminó el bloque "Sin sublotes registrados"
          — el timeline ya muestra el estado y eventos del lote, así que esa
          info no aporta. */}
    </div>
  );
}

/* ── Pipeline Track Component ── */
function PipelineTrack({ estadoCounts, filter, setFilter }) {
  const total = PIPELINE_STEPS.length;

  // Calculate progress fill: percentage based on where most lotes are
  const progressPct = useMemo(() => {
    let maxIdx = 0;
    PIPELINE_STEPS.forEach((step, i) => {
      if ((estadoCounts[step.key] || 0) > 0) maxIdx = i;
    });
    // Also count "envasado" as reaching step 3 (en_envasado position)
    if ((estadoCounts['envasado'] || 0) > 0) maxIdx = Math.max(maxIdx, 3);
    return total > 1 ? Math.round((maxIdx / (total - 1)) * 100) : 0;
  }, [estadoCounts, total]);

  return (
    <div style={S.trackWrap}>
      <div style={S.trackInner}>
        {/* Background line + progress fill */}
        <div style={S.trackLine}>
          <div style={S.trackFill(progressPct)} />
        </div>

        {/* Nodes */}
        <div style={S.trackNodes}>
          {PIPELINE_STEPS.map((step) => {
            // For "en_envasado", also count "envasado" state
            let count = estadoCounts[step.key] || 0;
            if (step.key === 'en_envasado') count += (estadoCounts['envasado'] || 0);

            const isActive = filter === step.key || (step.key === 'en_envasado' && filter === 'envasado');
            const hasLotes = count > 0;
            // Determine node visual state
            let nodeState = 'default';
            if (isActive) nodeState = 'active';
            else if (hasLotes) nodeState = 'done';
            else if (step.key === 'reenvasado') nodeState = 'optional';

            const iconColor = S.trackIconColor(nodeState);

            return (
              <div
                key={step.key}
                style={S.trackNode}
                onClick={() => setFilter(isActive ? 'todos' : step.key)}
                title={`${step.label}: ${count} lote${count !== 1 ? 's' : ''}`}
              >
                <div style={S.trackCircle(nodeState)}>
                  <span style={{ color: iconColor, display: 'flex', alignItems: 'center' }}>
                    {ICONS[step.icon]}
                  </span>
                </div>
                <span style={S.trackLabel(nodeState)}>{step.label}</span>
                <span style={S.trackCount(nodeState)}>{count || '·'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ================================================================ */
/* MAIN PAGE                                                         */
/* ================================================================ */
export default function TrazabilidadPage() {
  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [filter, setFilter] = useState('todos');
  const { data: trazData, loading, reload } = useApiData(() => api.getTrazabilidad(), [], 8000);

  /* FIX jun 2026 (K1): trazabilidad es la fuente de verdad cross-rol —
     toda transición de lote/sublote debe reflejarse al instante. */
  useRealtimeSync({
    onTrazabilidad: () => reload(),
  });

  const lotes = useMemo(() => {
    const arr = trazData?.data || (Array.isArray(trazData) ? trazData : []);
    /* Filtrar lotes con soft-delete (eliminado:true del script de limpieza
       o del admin). El backend los mantiene para auditoría, el frontend no. */
    return (Array.isArray(arr) ? arr : []).filter(l => l && !l.eliminado);
  }, [trazData]);

  /* Estado counts for pipeline — "orden" counts any lote with ordenCodigo */
  const estadoCounts = useMemo(() => {
    const c = {};
    let ordenCount = 0;
    lotes.forEach(l => {
      const st = l.estado || 'producido';
      c[st] = (c[st] || 0) + 1;
      if (l.ordenCodigo) ordenCount++;
    });
    c.orden = ordenCount;
    return c;
  }, [lotes]);

  /* Filters */
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
      if (filter === 'orden') {
        // Show all lotes that have an ordenCodigo
        arr = arr.filter(l => !!l.ordenCodigo);
      } else if (filter === 'en_envasado') {
        // "en_envasado" filter also shows "envasado" state
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
      <div style={S.wrap}>
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
          <div style={S.kpi('#7C3AED')}>
            <div style={S.kpiLabel}>Envasados</div>
            <div style={S.kpiValue}>{kpis.envasados}</div>
          </div>
        </div>

        {/* FIX jun 2026 (Sprint S): se eliminó el PipelineTrack general que
            agregaba contadores de todos los lotes. La trazabilidad ahora vive
            DENTRO de cada card individual (LoteHistorialTimeline), porque
            cada lote tiene su propio rastro y mezclarlos confundía al
            usuario sobre el avance real de un pedido específico. */}

        {/* Toolbar */}
        <div style={S.toolbar}>
          <input
            type="text"
            style={S.search}
            placeholder="Buscar lote, producto, orden..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {filters.map(f => (
            <button key={f.id} style={S.filterPill(f.id === filter)} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Lote cards */}
        {filtered.length === 0 ? (
          <div style={S.empty}>
            {debouncedQuery ? `Sin resultados para "${debouncedQuery}"` : 'Sin lotes registrados.'}
          </div>
        ) : (
          filtered.map(lote => <LoteCard key={lote.id || lote.codigoLote} lote={lote} />)
        )}
      </div>
    </>
  );
}
