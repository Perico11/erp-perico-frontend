import { useState, useEffect, useCallback, useMemo } from 'react';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import SegmentedControl from '../../components/ui/SegmentedControl';
import useConfirm from '../../hooks/useConfirm';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import ImportExportPrint from '../../components/ui/ImportExportPrint';
import humanizeError from '../../utils/humanizeError'; /* AUDIT UX 16-jul (U4) */

/* ════════════════════════════════════════════════════════════════════════════
   Conteo / Cycle Count — reskin Claude Design (verde).
   · Escritorio (ERP Escritorio.html · SCREENS.conteo): tabla Material/Tipo/
     Ubicación/Sistema/Estado/Acción con botón "Contar".
   · Móvil (ERP Móvil.html · S.conteo + Conteo.html §7): cards limpias (badge +
     nombre + ubicación + botón "Contar") → bottom-sheet de conteo con firma PIN.
   · Tokens SOLO var(--lp-*). Sin emojis (iconos line SVG). Touch ≥44px.
   · LÓGICA INTACTA: handlers, endpoints cycle-count/*, useRealtimeSync,
     useConfirm, firma PIN al abrir/cerrar, causa raíz obligatoria, modales.
     Gating: contar/finalizar = inventario; aprobar varianza = admin.
   ════════════════════════════════════════════════════════════════════════════ */

/* AUDIT UX 16-jul (U14): autoFocus solo en dispositivos con puntero fino
   (mouse/trackpad). En móvil el foco automático abre el teclado encima del
   sheet y tapa los botones — regla del proyecto. */
const FINE_POINTER = typeof window !== 'undefined' && window.matchMedia
  && window.matchMedia('(pointer: fine)').matches;

/* ── Iconos line SVG (sin emojis) ── */
const Icon = {
  check: (sz = 18) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  plus: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  search: (sz = 18) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  shield: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
    </svg>
  ),
  flag: (sz = 14) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
};

/* ── Estilos (LP design system · espejo del patrón validado en InventarioPage) ── */
const S = {
  wrap: { padding: '0 20px 100px' },
  h1: { fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--lp-text-primary)' },
  psub: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3, marginBottom: 16 },
  /* Tabs pill del mockup Conteo.html (.tab): radio 999, activo = acento sólido.
     En móvil cada pill estira (flex:1) igual que el mockup; escritorio = auto. */
  pillTabs: { display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' },
  pillTab: (on, grow) => ({
    flex: grow ? 1 : '0 0 auto', padding: '9px 14px', minHeight: 40, borderRadius: 999,
    border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    fontSize: 12.5, fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
    background: on ? 'var(--lp-brand-600)' : 'transparent',
    color: on ? '#fff' : 'var(--lp-text-secondary)', transition: 'all .15s',
  }),
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 200, maxWidth: 440,
    height: 44, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)', color: 'var(--lp-text-tertiary)',
  },
  searchInput: {
    flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none',
    fontFamily: 'var(--lp-font-sans)', fontSize: 14.5, color: 'var(--lp-text-primary)',
  },
  /* Botones — NUNCA 100% width en escritorio. Touch ≥44px. */
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: 44, padding: '0 18px', fontSize: 13, fontWeight: 600,
    borderRadius: 12, border: 'none',
    background: 'var(--lp-brand-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 40, padding: '0 15px', fontSize: 13, fontWeight: 600,
    borderRadius: 10, border: '1px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-raised)', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-secondary)', whiteSpace: 'nowrap',
  },
  btnSuccess: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: 40, padding: '0 16px', fontSize: 13, fontWeight: 700,
    borderRadius: 10, border: 'none', background: 'var(--lp-success-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap',
  },
  btnWarning: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 44, padding: '0 18px', fontSize: 13, fontWeight: 700,
    borderRadius: 12, border: 'none', background: 'var(--lp-warning-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', whiteSpace: 'nowrap',
  },
  /* KPI metric cards */
  metric: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 },
  metricCard: { background: 'var(--lp-bg-sunken)', borderRadius: 14, padding: 14, textAlign: 'center' },
  metricVal: { fontSize: 24, fontWeight: 800, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  metricLabel: { fontSize: 11, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, fontWeight: 600 },
  /* Card genérica (histórico, sesión activa, pendientes) */
  card: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 18, padding: 16, marginBottom: 12, position: 'relative', overflow: 'hidden' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  badge: (bg, fg) => ({
    display: 'inline-flex', padding: '3px 9px', fontSize: 10.5, fontWeight: 700,
    borderRadius: 999, background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  estChip: (c) => ({
    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
    background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, whiteSpace: 'nowrap',
  }),
  /* ── Tabla escritorio (1:1 ERP Escritorio.html) ── */
  tablewrap: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
    color: 'var(--lp-text-tertiary)', padding: '12px 16px', borderBottom: '1px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-sunken)', whiteSpace: 'nowrap',
  },
  thR: { textAlign: 'right' },
  thC: { textAlign: 'center' },
  td: { padding: '11px 16px', borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 13.5, color: 'var(--lp-text-primary)' },
  tdMut: { padding: '11px 16px', borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 12, color: 'var(--lp-text-tertiary)' },
  tdMono: { fontFamily: 'var(--lp-font-mono)', fontWeight: 600 },
  /* Input físico inline (tabla escritorio) */
  inputCount: {
    width: 96, padding: '7px 10px', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 10, fontSize: 13, fontFamily: 'var(--lp-font-mono)',
    textAlign: 'right', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    boxSizing: 'border-box', outline: 'none',
  },
  /* ── Card móvil de item (1:1 ERP Móvil.html · Conteo.html) ── */
  mCard: (venc) => ({
    background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
    borderRadius: 18, padding: '15px 16px', marginBottom: 11, position: 'relative', overflow: 'hidden',
    ...(venc ? { boxShadow: 'inset 4px 0 0 var(--lp-danger-600)' } : {}),
  }),
  mTipo: { fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-tertiary)' },
  mItem: { fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--lp-text-primary)' },
  mMeta: { fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 2 },
  mRows: { margin: '11px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  mSis: { fontSize: 12, color: 'var(--lp-text-tertiary)' },
  mSisB: { color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)', fontSize: 14, fontWeight: 700 },
  mVchip: (c) => ({ fontSize: 12, fontWeight: 600, fontFamily: 'var(--lp-font-mono)', padding: '3px 9px', borderRadius: 999, background: `color-mix(in srgb, ${c} 15%, transparent)`, color: c }),
  /* Botón ancho en card móvil (full width SOLO en móvil) */
  actMobile: {
    width: '100%', minHeight: 46, borderRadius: 12, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 14, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'var(--lp-brand-600)', color: '#fff',
  },
  actMobileDone: {
    width: '100%', minHeight: 46, borderRadius: 12, cursor: 'default',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13.5, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-tertiary)', border: '1px solid var(--lp-border-subtle)',
  },
  /* ── Bottom-sheet de conteo móvil (Conteo.html §7) ── */
  sheetOverlay: (desktop) => ({
    position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 9999,
    display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', padding: desktop ? 16 : 0,
  }),
  sheet: (desktop) => ({
    background: 'var(--lp-bg-base)', width: '100%', maxWidth: 460,
    borderRadius: desktop ? 20 : '24px 24px 0 0', padding: '20px 20px 28px',
    boxShadow: '0 -8px 40px rgba(0,0,0,.22)', boxSizing: 'border-box',
    /* MÓVIL: el sheet es el scroller — sin esto un formulario alto (input +
       varianza + PIN + acciones) se sale de pantalla y los botones quedan
       detrás del teclado. --pp-vvh (visualViewport, lo publica useBodyScrollLock)
       sigue al teclado; fallback a 100dvh. El fondo queda congelado por el lock. */
    maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)', overflowY: 'auto',
  }),
  shH: { fontSize: 18, fontWeight: 600, color: 'var(--lp-text-primary)' },
  shS: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2, marginBottom: 16 },
  bigsis: { textAlign: 'center', padding: 14, borderRadius: 14, background: 'var(--lp-bg-sunken)', marginBottom: 14 },
  bigK: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--lp-text-tertiary)' },
  bigV: { fontFamily: 'var(--lp-font-mono)', fontSize: 26, fontWeight: 700, color: 'var(--lp-text-primary)', marginTop: 3 },
  flbl: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', margin: '0 2px 6px' },
  finQty: {
    width: '100%', height: 54, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-mono)', fontSize: 22,
    fontWeight: 700, color: 'var(--lp-text-primary)', outline: 'none', textAlign: 'center', boxSizing: 'border-box',
  },
  finPin: {
    width: '100%', height: 54, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-mono)', fontSize: 22,
    fontWeight: 700, color: 'var(--lp-text-primary)', outline: 'none', textAlign: 'center',
    letterSpacing: '.3em', boxSizing: 'border-box',
  },
  varbox: (c) => ({
    marginTop: 14, padding: '12px 14px', borderRadius: 12, fontSize: 13,
    background: `color-mix(in srgb, ${c} 10%, var(--lp-bg-raised))`,
    border: `1px solid color-mix(in srgb, ${c} 26%, transparent)`,
  }),
  shActs: { display: 'flex', gap: 10, marginTop: 18 },
  act2: (primary) => ({
    flex: 1, minHeight: 50, borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    fontSize: 14.5, fontWeight: 600, border: primary ? 'none' : '1px solid var(--lp-border-subtle)',
    background: primary ? 'var(--lp-brand-600)' : 'transparent',
    color: primary ? '#fff' : 'var(--lp-text-secondary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  }),
  /* genéricos */
  itemRow: { display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 60px', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 10, fontSize: 12 },
  itemRowFlagged: { background: 'var(--lp-danger-50)' },
  loading: { textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 10, fontSize: 12, marginBottom: 12 },
  empty: { textAlign: 'center', padding: '54px 20px', fontSize: 13.5, color: 'var(--lp-text-tertiary)', lineHeight: 1.5 },
  noteCard: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, padding: '13px 16px', marginTop: 14, color: 'var(--lp-text-tertiary)', fontSize: 13, lineHeight: 1.5 },
};

const CATEGORIAS = [
  { v: 'mp', label: 'Materia Prima' },
  { v: 'pt', label: 'Producto Terminado' },
  { v: 'envases', label: 'Envases / Tapas' },
];
const TIPOS = [
  { v: 'completo', label: 'Completo (todos)' },
  { v: 'aleatorio', label: 'Aleatorio (~30%)' },
  /* `base` (ago-2026): solo MP. Al firmar FIJA la existencia contada como la
     nueva base de la que producción descuenta — sin pasar por aprobación. */
  { v: 'base', label: 'Inventario base' },
];

/* Umbral de varianza que dispara aprobación admin (espejo del backend). */
const UMBRAL = 5;

function StartModal({ onStart, onClose, loading, isDesktop }) {
  const [categoria, setCategoria] = useState('mp');
  const [tipo, setTipo] = useState('completo');
  /* MÓVIL: este componente sólo se monta cuando está abierto → lock siempre activo
     mientras vive. Congela el fondo (anti scroll-chaining) y publica --pp-vvh. */
  useBodyScrollLock(true);
  return (
    <div style={S.sheetOverlay(isDesktop)}>
      <div style={S.sheet(isDesktop)} onClick={(e) => e.stopPropagation()}>
        <div style={S.shH}>Iniciar sesión de conteo</div>
        <div style={S.shS}>Elige qué contar y el alcance. Firmarás con tu PIN para abrir.</div>
        <div style={{ marginBottom: 14 }}>
          <label style={S.flbl}>Categoría</label>
          <SegmentedControl value={categoria} onChange={setCategoria}
            options={CATEGORIAS.map(c => ({ value: c.v, label: c.label }))} color="brand" />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={S.flbl}>Tipo de conteo</label>
          <SegmentedControl value={tipo} onChange={setTipo}
            options={TIPOS.map(t => ({ value: t.v, label: t.label }))} color="brand" />
        </div>
        {/* El conteo base cambia las reglas del juego: fija en vez de ajustar y
            no pasa por aprobación. Decirlo ANTES de abrir la sesión, no después. */}
        {tipo === 'base' && (
          <div style={{ background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)', padding: 12, borderRadius: 10, fontSize: 12.5, lineHeight: 1.55, marginBottom: 8 }}>
            <strong>Inventario base — solo materia prima.</strong> Al cerrar y firmar,
            la cantidad que captures <strong>sustituye</strong> la existencia del sistema
            (no se suma ni se resta), y de ahí en adelante producción descuenta sobre
            esa base. Se aplica al instante, sin aprobación.
            <div style={{ marginTop: 6 }}>
              Las materias primas que no cuentes <strong>se quedan como están</strong>.
            </div>
          </div>
        )}
        <div style={S.shActs}>
          <button style={S.act2(false)} onClick={onClose} disabled={loading}
            data-id="conteo.btn.cancelar-iniciar" data-rol="inventario,admin">Cancelar</button>
          <button style={S.act2(true)} onClick={() => onStart(categoria, tipo === 'base' ? 'base' : tipo)} disabled={loading || (tipo === 'base' && categoria !== 'mp')}
            data-id="conteo.btn.iniciar-sesion" data-rol="inventario,admin">
            {loading ? 'Iniciando…' : (tipo === 'base' && categoria !== 'mp') ? 'Base solo aplica a MP' : 'Iniciar conteo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CountSheet — bottom-sheet de conteo de un item (Conteo.html §7).
   Patrón MÓVIL: card "Contar" → sheet con Sistema grande, input físico,
   preview de varianza en vivo, y FIRMA DEL CONTADOR (PIN) antes de registrar.
   El PIN se valida server-side al finalizar la sesión; aquí se captura igual
   que el mockup y se registra el conteo del item. Si varianza > umbral, el
   item queda flagged y la sesión irá a aprobación de admin al finalizar.
   ════════════════════════════════════════════════════════════════════════════ */
function CountSheet({ item, isDesktop, onClose, onRegistrar }) {
  const [val, setVal] = useState(
    item.stockFisico !== null && item.stockFisico !== undefined ? String(item.stockFisico) : ''
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  /* MÓVIL: sólo se monta cuando está abierto → lock siempre activo mientras vive.
     Congela el fondo y publica --pp-vvh (el sheet la usa en su maxHeight). */
  useBodyScrollLock(true);

  const f = parseFloat(val);
  const showVar = !isNaN(f);
  const sis = Number(item.stockSistema) || 0;
  const diff = showVar ? f - sis : 0;
  const vp = showVar ? (sis === 0 ? (f === 0 ? 0 : 100) : ((f - sis) / sis) * 100) : 0;
  const alta = Math.abs(vp) > UMBRAL;
  const vColor = vp === 0 ? 'var(--lp-success-600)' : alta ? 'var(--lp-danger-600)' : 'var(--lp-warning-600)';

  const guardar = async () => {
    if (val === '' || isNaN(f) || f < 0) { setErr('Ingresa un físico válido'); return; }
    setErr('');
    setSaving(true);
    try {
      /* AUDIT UX 16-jul (U11): el padre decide qué sigue (auto-avanza al
         siguiente pendiente o cierra si ya no hay) — antes onClose() aquí
         obligaba a Burgos a buscar el siguiente ítem a mano ~66 veces. */
      await onRegistrar(item.key, f);
    } catch (e) {
      setErr(humanizeError(e)); /* AUDIT UX 16-jul (U4) */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.sheetOverlay(isDesktop)}>
      <div style={S.sheet(isDesktop)} onClick={(e) => e.stopPropagation()}>
        <div style={S.shH}>Conteo físico</div>
        <div style={S.shS}>{item.nombre}{item.ubicacion ? ' · ' + item.ubicacion : ''}</div>

        <div style={S.bigsis}>
          <div style={S.bigK}>Sistema</div>
          <div style={S.bigV}>{item.stockSistema} {item.unidad}</div>
        </div>

        <label style={S.flbl}>¿Cuánto contaste físicamente?</label>
        {/* AUDIT UX 16-jul (U14): autoFocus solo con puntero fino (mouse) —
            en el teléfono el teclado brincaba y tapaba los botones del sheet. */}
        <input style={S.finQty} type="number" inputMode="decimal" min="0" step="0.01"
          value={val} autoFocus={FINE_POINTER} placeholder="0"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
          data-id="conteo.input.fisico" data-rol="inventario,admin" />

        {showVar && (
          <div style={S.varbox(vColor)}>
            <div style={{ fontWeight: 600, color: vColor }}>
              Varianza {(vp > 0 ? '+' : '') + (Math.round(vp * 10) / 10)}% ({diff > 0 ? '+' : ''}{Math.round(diff * 100) / 100} {item.unidad})
            </div>
            <div style={{ fontSize: 12, marginTop: 3, color: 'var(--lp-text-secondary)' }}>
              {vp === 0 ? 'Coincide con el sistema.'
                : alta ? `Supera el umbral de ${UMBRAL}% — se enviará a aprobación de admin.`
                : 'Dentro de tolerancia.'}
            </div>
          </div>
        )}

        {/* AUDIT UX 16-jul (U3): campo "Firma del contador (PIN)" ELIMINADO —
            era decorativo: guardar() nunca lo enviaba y Burgos lo tecleaba ~66
            veces por sesión. La firma REAL es el PIN al abrir y al finalizar. */}

        {err && <div style={{ ...S.err, marginTop: 12, marginBottom: 0 }}>{err}</div>}

        <div style={S.shActs}>
          <button style={S.act2(false)} onClick={onClose} disabled={saving}
            data-id="conteo.btn.cancelar-conteo" data-rol="inventario,admin">Cancelar</button>
          <button style={S.act2(true)} onClick={guardar} disabled={saving}
            data-id="conteo.btn.registrar-conteo" data-rol="inventario,admin">
            {saving ? 'Registrando…' : 'Registrar y firmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CausasRaizModal — bloquea la aprobación hasta que cada item flagged tenga
   una causa raíz asignada. Punto de control de calidad: sin causa no
   aprendemos por qué hay varianza. SOLO admin aprueba (Burgos NO).
   ════════════════════════════════════════════════════════════════════════════ */
function CausasRaizModal({ sesion, onAprobar, onClose, loading, isDesktop }) {
  const [causas, setCausas] = useState([]);
  const [asignaciones, setAsignaciones] = useState({});
  const [err, setErr] = useState('');
  const [loadingCat, setLoadingCat] = useState(true);
  /* MÓVIL: sólo se monta cuando está abierto → lock siempre activo mientras vive. */
  useBodyScrollLock(true);

  useEffect(() => {
    api.getCausasVarianza()
      .then(r => setCausas((r.data?.causas || []).filter(c => c.activo)))
      .catch(e => setErr('Error catálogo: ' + humanizeError(e))) /* AUDIT UX 16-jul (U4) */
      .finally(() => setLoadingCat(false));
  }, []);

  const flagged = useMemo(
    () => (sesion?.items || []).filter(i => i.flagged && i.stockFisico != null),
    [sesion]
  );
  const todasAsignadas = flagged.every(i => asignaciones[i.key]);

  const handleConfirmar = async () => {
    if (!todasAsignadas) { setErr('Asigna causa a TODOS los items'); return; }
    setErr('');
    try { await onAprobar(asignaciones); }
    catch (e) { setErr(humanizeError(e)); } /* AUDIT UX 16-jul (U4) */
  };

  return (
    <div style={S.sheetOverlay(isDesktop)}>
      <div style={{ ...S.sheet(isDesktop), maxWidth: 720, maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={S.shH}>Asignar causa raíz</div>
        <div style={{ ...S.shS, marginBottom: 14 }}>
          La sesión <strong>{sesion?.id}</strong> tiene <strong>{flagged.length}</strong> item(s) con varianza significativa. Asigna una causa a cada uno antes de aprobar — esto alimenta el análisis Pareto trimestral.
        </div>

        {loadingCat ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--lp-text-tertiary)' }}>Cargando catálogo…</div> : (
          <div style={S.tablewrap}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Item</th>
                <th style={{ ...S.th, ...S.thR }}>Sistema</th>
                <th style={{ ...S.th, ...S.thR }}>Físico</th>
                <th style={{ ...S.th, ...S.thR }}>Δ</th>
                <th style={S.th}>Causa raíz *</th>
              </tr></thead>
              <tbody>
                {flagged.map(it => (
                  <tr key={it.key}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{it.nombre}</td>
                    <td style={{ ...S.td, ...S.tdMono, ...S.thR }}>{it.stockSistema}</td>
                    <td style={{ ...S.td, ...S.tdMono, ...S.thR }}>{it.stockFisico}</td>
                    <td style={{ ...S.td, ...S.tdMono, ...S.thR, color: 'var(--lp-danger-600)', fontWeight: 700 }}>
                      {it.varianza > 0 ? '+' : ''}{it.varianza} ({it.pctVarianza?.toFixed(1)}%)
                    </td>
                    <td style={{ ...S.td, padding: '7px 16px' }}>
                      <select value={asignaciones[it.key] || ''}
                        onChange={e => setAsignaciones(prev => ({ ...prev, [it.key]: e.target.value }))}
                        data-id="conteo.input.causa-raiz" data-rol="admin"
                        style={{ width: '100%', padding: '7px 10px', fontSize: 12.5, fontFamily: 'var(--lp-font-sans)', borderRadius: 10, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', outline: 'none', border: '1.5px solid ' + (asignaciones[it.key] ? 'var(--lp-success-300)' : 'var(--lp-danger-300)') }}>
                        <option value="">— Selecciona —</option>
                        {causas.map(c => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {err && <div style={{ ...S.err, marginTop: 12, marginBottom: 0 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
            {Object.keys(asignaciones).filter(k => asignaciones[k]).length} de {flagged.length} asignadas
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.btnGhost} onClick={onClose} disabled={loading}
              data-id="conteo.btn.cancelar-causas" data-rol="admin">Cancelar</button>
            <button style={{ ...S.btnSuccess, opacity: todasAsignadas ? 1 : 0.5, cursor: todasAsignadas ? 'pointer' : 'not-allowed' }}
              onClick={handleConfirmar} disabled={!todasAsignadas || loading}
              data-id="conteo.btn.aprobar-con-causas" data-rol="admin">
              {Icon.check(16)}{loading ? 'Aprobando…' : 'Aprobar con causas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PendientesTab — Calendario de conteos pendientes (Fase 3).
   Vencidos (rojo), esta semana (ámbar), próximos (verde) según cadencia ABC.
   ════════════════════════════════════════════════════════════════════════════ */
const fmtPesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
const claseColor = (clase) => clase === 'A' ? 'var(--lp-danger-600)' : clase === 'B' ? 'var(--lp-warning-600)' : 'var(--lp-text-secondary)';

/* Bloque del calendario (vencidos/esta semana/próximos). Declarado a nivel de
   módulo para no recrearse en cada render (react-hooks/static-components). */
function PendienteBloque({ titulo, color, badge, items, vacio, isDesktop }) {
  return (
    <div style={{ ...S.card, boxShadow: `inset 3px 0 0 ${color}` }}>
      <div style={{ ...S.cardHeader, marginBottom: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{titulo}</div>
        <span style={S.badge(`color-mix(in srgb, ${color} 16%, transparent)`, color)}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '12px 4px', fontSize: 12.5, color: 'var(--lp-text-tertiary)' }}>{vacio}</div>
      ) : isDesktop ? (
        <div style={S.tablewrap}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>MP</th>
              <th style={S.th}>Clase</th>
              <th style={{ ...S.th, ...S.thR }}>Stock</th>
              <th style={{ ...S.th, ...S.thR }}>Valor</th>
              <th style={{ ...S.th, ...S.thR }}>Último conteo</th>
              <th style={{ ...S.th, ...S.thR }}>Cadencia</th>
              <th style={{ ...S.th, ...S.thR }}>{badge}</th>
            </tr></thead>
            <tbody>
              {items.slice(0, 50).map(it => (
                <tr key={it.mp}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{it.mp}</td>
                  <td style={S.td}><span style={S.estChip(claseColor(it.claseABC))}>{it.claseABC}</span></td>
                  <td style={{ ...S.td, ...S.tdMono, ...S.thR }}>{Number(it.qty).toFixed(1)}</td>
                  <td style={{ ...S.td, ...S.tdMono, ...S.thR }}>{fmtPesos(it.valor)}</td>
                  <td style={{ ...S.tdMut, ...S.thR }}>
                    {it.ultimoConteo ? new Date(it.ultimoConteo).toLocaleDateString('es-MX') + ` (${it.diasDesde}d)` : 'Nunca'}
                  </td>
                  <td style={{ ...S.td, ...S.tdMono, ...S.thR, fontSize: 12 }}>{it.cadenciaDias}d</td>
                  <td style={{ ...S.td, ...S.tdMono, ...S.thR, fontWeight: 700, color }}>
                    {it.diasParaVencer < 0 ? `+${Math.abs(it.diasParaVencer)}d vencido` : `${it.diasParaVencer}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 50 && (
            <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
              Mostrando 50 de {items.length}
            </div>
          )}
        </div>
      ) : (
        <div>
          {items.slice(0, 50).map(it => (
            <div key={it.mp} style={{ ...S.mCard(false), marginBottom: 9, padding: '12px 14px', borderRadius: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={S.estChip(claseColor(it.claseABC))}>{it.claseABC}</span>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--lp-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.mp}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 12.5, color }}>
                  {it.diasParaVencer < 0 ? `+${Math.abs(it.diasParaVencer)}d` : `${it.diasParaVencer}d`}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
                Stock <span style={S.mSisB}>{Number(it.qty).toFixed(1)}</span> · {fmtPesos(it.valor)} · {it.ultimoConteo ? `${it.diasDesde}d` : 'Nunca'} · cad. {it.cadenciaDias}d
              </div>
            </div>
          ))}
          {items.length > 50 && (
            <div style={{ padding: '6px 0', textAlign: 'center', fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
              Mostrando 50 de {items.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* El fetch del calendario vive en la page (se comparte con el contador
   "Vencidos · N" de la tab y el subtítulo "Hola X · N vencidos" del mockup). */
function PendientesTab({ isDesktop, data, loading, err }) {
  if (loading) return <div style={S.loading}>Cargando calendario…</div>;
  if (err) return <div style={S.err}>{err}</div>;
  if (!data) return <div style={S.empty}>Sin datos</div>;

  return (
    <>
      <div style={{ background: 'var(--lp-brand-50)', border: '1px solid var(--lp-brand-200)', color: 'var(--lp-brand-700)', padding: '10px 12px', borderRadius: 10, fontSize: 12.5, marginBottom: 14 }}>
        <strong>Cadencia recomendada:</strong> Clase A cada {data.cadencia.A} días · Clase B cada {data.cadencia.B} días · Clase C cada {data.cadencia.C} días.
      </div>
      <PendienteBloque titulo="Vencidos — atender ya" color="var(--lp-danger-600)" badge="Atrasado"
        items={data.vencidos} vacio="Sin conteos vencidos." isDesktop={isDesktop} />
      <PendienteBloque titulo="Esta semana" color="var(--lp-warning-600)" badge="Vence en"
        items={data.estaSemana} vacio="Sin pendientes esta semana." isDesktop={isDesktop} />
      <PendienteBloque titulo="Próximos" color="var(--lp-success-600)" badge="Vence en"
        items={data.proximos} vacio="Sin próximos en el horizonte." isDesktop={isDesktop} />
    </>
  );
}

function AddMPModal({ onAdd, onClose, loading, isDesktop }) {
  const [nombre, setNombre] = useState('');
  const [stockFisico, setStockFisico] = useState('');
  const [unidad, setUnidad] = useState('kg');
  const [err, setErr] = useState('');
  /* MÓVIL: sólo se monta cuando está abierto → lock siempre activo mientras vive. */
  useBodyScrollLock(true);

  const guardar = async () => {
    const n = nombre.trim();
    if (!n) { setErr('Ingresa el nombre de la MP'); return; }
    const sf = Number(stockFisico);
    if (stockFisico === '' || isNaN(sf) || sf < 0) { setErr('Stock físico inválido'); return; }
    setErr('');
    try { await onAdd(n, sf, unidad); }
    catch (e) { setErr(humanizeError(e)); } /* AUDIT UX 16-jul (U4) */
  };

  const inp = {
    width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 14,
    border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={S.sheetOverlay(isDesktop)}>
      <div style={S.sheet(isDesktop)} onClick={(e) => e.stopPropagation()}>
        <div style={S.shH}>Agregar MP nueva al conteo</div>
        <div style={S.shS}>La MP se creará en el inventario sólo cuando admin apruebe la sesión.</div>

        <div style={{ marginBottom: 12 }}>
          <label style={S.flbl}>Nombre</label>
          <input style={inp} type="text" value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: RESINA ABC-123" autoFocus
            data-id="conteo.input.mp-nombre" data-rol="inventario,admin"
            onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('cc-add-fisico')?.focus(); }} />
          <div style={{ fontSize: 10.5, color: 'var(--lp-text-tertiary)', marginTop: 4 }}>Se guarda en MAYÚSCULAS</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 8 }}>
          <div>
            <label style={S.flbl}>Stock físico</label>
            <input id="cc-add-fisico" style={{ ...inp, fontFamily: 'var(--lp-font-mono)', textAlign: 'right' }}
              type="number" min="0" step="0.01" value={stockFisico}
              onChange={(e) => setStockFisico(e.target.value)} placeholder="0.00"
              data-id="conteo.input.mp-fisico" data-rol="inventario,admin"
              onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }} />
          </div>
          <div>
            <label style={S.flbl}>Unidad</label>
            <select style={inp} value={unidad} onChange={(e) => setUnidad(e.target.value)}
              data-id="conteo.input.mp-unidad" data-rol="inventario,admin">
              <option value="kg">kg</option>
              <option value="lt">lt</option>
              <option value="pz">pz</option>
            </select>
          </div>
        </div>

        {err && <div style={{ ...S.err, marginTop: 8, marginBottom: 0 }}>{err}</div>}

        <div style={S.shActs}>
          <button style={S.act2(false)} onClick={onClose} disabled={loading}
            data-id="conteo.btn.cancelar-mp" data-rol="inventario,admin">Cancelar</button>
          <button style={S.act2(true)} onClick={guardar} disabled={loading}
            data-id="conteo.btn.agregar-mp" data-rol="inventario,admin">
            {loading ? 'Agregando…' : 'Agregar al conteo'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers de presentación de item ── */
function varianzaColor(item) {
  if (item.varianza == null) return 'var(--lp-text-tertiary)';
  if (item.varianza === 0) return 'var(--lp-success-600)';
  return item.flagged ? 'var(--lp-danger-600)' : 'var(--lp-warning-600)';
}
function estadoDeItem(item) {
  const contado = item.stockFisico !== null && item.stockFisico !== undefined;
  if (!contado) return { key: 'pendiente', label: 'Por contar', color: 'var(--lp-warning-600)' };
  if (item.flagged) return { key: 'flagged', label: 'A aprobación admin', color: 'var(--lp-danger-600)' };
  return { key: 'contado', label: 'Contado', color: 'var(--lp-success-600)' };
}

/* ── Fila de tabla escritorio (input físico inline + acción Contar) ── */
function ItemRowDesktop({ item, onRegistrar, onContar }) {
  const [val, setVal] = useState(
    item.stockFisico !== null && item.stockFisico !== undefined ? String(item.stockFisico) : ''
  );
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if (val === '') return;
    const num = Number(val);
    if (isNaN(num) || num < 0) return;
    setSaving(true);
    try { await onRegistrar(item.key, num); } finally { setSaving(false); }
  };
  const est = estadoDeItem(item);
  return (
    <tr style={item.flagged ? { background: 'var(--lp-danger-50)' } : undefined}>
      <td style={{ ...S.td, fontWeight: 600 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {item.nombre}
          {item.esNueva && <span style={S.badge('var(--lp-brand-100)', 'var(--lp-brand-700)')}>Nueva</span>}
        </span>
      </td>
      <td style={S.tdMut}>{item.unidad}</td>
      <td style={{ ...S.tdMut, color: 'var(--lp-text-tertiary)' }}>{item.ubicacion || '—'}</td>
      <td style={{ ...S.td, ...S.tdMono, ...S.thR, color: 'var(--lp-text-secondary)' }}>{item.stockSistema}</td>
      <td style={{ ...S.td, ...S.thR }}>
        <input style={S.inputCount} type="number" inputMode="decimal" min="0" step="0.01"
          value={val} onChange={(e) => setVal(e.target.value)} onBlur={guardar}
          onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }} placeholder="—" disabled={saving}
          data-id="conteo.input.fisico-inline" data-rol="inventario,admin" />
      </td>
      <td style={{ ...S.td, ...S.thR, ...S.tdMono, fontWeight: 700, color: varianzaColor(item) }}>
        {item.varianza == null ? '—'
          : (item.varianza > 0 ? '+' : '') + item.varianza.toFixed(2)
            + (item.pctVarianza != null ? ` (${item.pctVarianza.toFixed(1)}%)` : '')}
      </td>
      <td style={{ ...S.td, ...S.thC }}><span style={S.estChip(est.color)}>{est.label}</span></td>
      <td style={{ ...S.td, ...S.thR }}>
        <button style={S.btnGhost} onClick={() => onContar(item)}
          data-id="conteo.btn.contar" data-rol="inventario,admin">
          {Icon.check(15)}Contar
        </button>
      </td>
    </tr>
  );
}

/* ── Card móvil de item (1:1 Conteo.html): badge tipo MP/PT + estado pill ── */
function ItemCardMobile({ item, tipo, onContar }) {
  const est = estadoDeItem(item);
  const contado = item.stockFisico !== null && item.stockFisico !== undefined;
  return (
    <div style={S.mCard(false)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span style={S.mTipo}>{tipo || item.unidad}</span>
        {item.esNueva && <span style={S.badge('var(--lp-brand-100)', 'var(--lp-brand-700)')}>Nueva</span>}
        <span style={{ ...S.estChip(est.color), marginLeft: 'auto' }}>{est.label}</span>
      </div>
      <div style={S.mItem}>{item.nombre}</div>
      {item.ubicacion && <div style={S.mMeta}>{item.ubicacion}</div>}
      <div style={S.mRows}>
        <span style={S.mSis}>Sistema <span style={S.mSisB}>{item.stockSistema} {item.unidad}</span>
          {contado && <> · Físico <span style={S.mSisB}>{item.stockFisico} {item.unidad}</span></>}
        </span>
        {item.pctVarianza != null && (
          <span style={S.mVchip(varianzaColor(item))}>
            {(item.varianza > 0 ? '+' : '')}{item.pctVarianza.toFixed(1)}%
          </span>
        )}
      </div>
      {contado ? (
        <div style={S.actMobileDone}>{Icon.check(16)}{item.flagged ? 'Enviado a aprobación de admin' : 'Conteo registrado'}</div>
      ) : (
        <button style={S.actMobile} onClick={() => onContar(item)}
          data-id="conteo.btn.contar" data-rol="inventario,admin">
          {Icon.check(18)}Contar
        </button>
      )}
    </div>
  );
}

function SesionActiva({ sesion, isDesktop, onRegistrar, onFinalizar, onAgregarMP, onContar }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const items = useMemo(() => {
    let arr = [...(sesion.items || [])];
    if (filter === 'pendientes') arr = arr.filter(i => i.stockFisico === null || i.stockFisico === undefined);
    else if (filter === 'contados') arr = arr.filter(i => i.stockFisico !== null && i.stockFisico !== undefined);
    else if (filter === 'flaggeados') arr = arr.filter(i => i.flagged);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(i => (i.nombre || '').toLowerCase().includes(q));
    }
    return arr;
  }, [sesion.items, filter, search]);

  /* Conteos por estado — espejo de las tabs del mockup (Programados · Contados) */
  const nProg = (sesion.items || []).filter(i => i.stockFisico === null || i.stockFisico === undefined).length;
  const nCont = (sesion.items || []).length - nProg;
  const nFlag = (sesion.items || []).filter(i => i.flagged).length;
  /* Badge de tipo para las cards móvil (mockup .tipo: MP / PT) */
  const tipoBadge = sesion.categoria === 'mp' ? 'MP' : sesion.categoria === 'pt' ? 'PT' : 'ENV';

  const tituloAmigable = `Conteo de ${CATEGORIAS.find(c => c.v === sesion.categoria)?.label || sesion.categoria}`;
  const tipoLabel = TIPOS.find(t => t.v === sesion.tipo)?.label || sesion.tipo;

  return (
    <div style={S.card}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--lp-text-primary)' }}>{tituloAmigable}</span>
          <span style={S.estChip('var(--lp-brand-600)')}>Activo</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)', lineHeight: 1.5 }}>
          {tipoLabel}
          {sesion.folio && (
            <>{' · '}
              <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-brand-700)', background: 'var(--lp-brand-100)', padding: '1px 8px', borderRadius: 6, fontSize: 11 }}
                title="Folio consecutivo del año — para citar en papel o auditoría">{sesion.folio}</span>
            </>
          )}
          {' · '}<span style={{ fontFamily: 'var(--lp-font-mono)', opacity: 0.55, fontSize: 10 }} title="ID técnico interno">{sesion.id}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <ImportExportPrint
          exportUrl={() => api.urlExportCycleCount(sesion.id)}
          printUrl={() => api.urlPrintCycleCount(sesion.id)}
          permisos={{ import: false }}
        />
        <button style={S.btnWarning} onClick={() => onFinalizar(sesion.id)}
          data-id="conteo.btn.finalizar-firma" data-rol="inventario,admin">
          {Icon.shield(16)}Finalizar conteo (firma PIN)
        </button>
      </div>

      <div style={S.metric}>
        <div style={S.metricCard}>
          <div style={S.metricVal}>{sesion.totalItems || 0}</div>
          <div style={S.metricLabel}>Total items</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: 'var(--lp-success-600)' }}>{sesion.contados || 0}</div>
          <div style={S.metricLabel}>Contados</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: 'var(--lp-danger-600)' }}>{sesion.varianzas || 0}</div>
          <div style={S.metricLabel}>Varianzas {'>'}{UMBRAL}%</div>
        </div>
      </div>

      <div style={S.toolbar}>
        <div style={S.searchBox}>
          {Icon.search(18)}
          <input style={S.searchInput} type="text" placeholder="Buscar item…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            data-id="conteo.input.buscar" data-rol="inventario,admin" />
        </div>
        {/* Estados del mockup: Programados / Contados (+ Flaggeados, función previa) */}
        <SegmentedControl value={filter} onChange={setFilter}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'pendientes', label: `Por contar · ${nProg}` },
            { value: 'contados', label: `Contados · ${nCont}` },
            { value: 'flaggeados', label: `Con varianza · ${nFlag}` },
          ]} color="brand" />
        {sesion.categoria === 'mp' && onAgregarMP && (
          <button style={S.btnPrimary} onClick={onAgregarMP} title="Agregar una MP que no está en el inventario"
            data-id="conteo.btn.agregar-mp-nueva" data-rol="inventario,admin">
            {Icon.plus(16)}Agregar MP nueva
          </button>
        )}
      </div>

      {/* Lista de items — tabla escritorio / cards móvil */}
      {items.length === 0 ? (
        <div style={S.empty}>
          {(!search && filter === 'todos')
            ? 'Nada por contar aquí. Respira tranquilo.'
            : 'Sin items que coincidan'}
        </div>
      ) : isDesktop ? (
        <div style={S.tablewrap}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Material</th>
              <th style={S.th}>U.</th>
              <th style={S.th}>Ubicación</th>
              <th style={{ ...S.th, ...S.thR }}>Sistema</th>
              <th style={{ ...S.th, ...S.thR }}>Físico</th>
              <th style={{ ...S.th, ...S.thR }}>Varianza</th>
              <th style={{ ...S.th, ...S.thC }}>Estado</th>
              <th style={{ ...S.th, ...S.thR }}>Acción</th>
            </tr></thead>
            <tbody>
              {items.map(item => (
                <ItemRowDesktop key={item.key} item={item} onRegistrar={onRegistrar} onContar={onContar} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {items.map(item => (
            <ItemCardMobile key={item.key} item={item} tipo={tipoBadge} onContar={onContar} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistorialCard({ sesion, onAprobar, canAprobar, isDesktop }) {
  const [expanded, setExpanded] = useState(false);
  const fecha = new Date(sesion.fecha).toLocaleString('es-MX');
  const estadoChip = {
    activo: 'var(--lp-brand-600)',
    finalizado: 'var(--lp-warning-600)',
    aprobado: 'var(--lp-success-600)',
  }[sesion.estado] || 'var(--lp-text-secondary)';
  const flaggedItems = (sesion.items || []).filter(i => i.flagged);

  return (
    <div style={S.card}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {sesion.folio ? (
            <>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--lp-brand-700)', background: 'var(--lp-brand-100)', padding: '2px 10px', borderRadius: 6, fontFamily: 'var(--lp-font-mono)' }}
                title="Folio consecutivo del año">{sesion.folio}</span>
              <span style={{ fontSize: 10, color: 'var(--lp-text-tertiary)', fontFamily: 'var(--lp-font-mono)' }}>({sesion.id})</span>
            </>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)' }}>{sesion.id}</span>
          )}
          <span style={S.estChip(estadoChip)}>{sesion.estado}</span>
          <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginLeft: 'auto' }}>{fecha}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
          {CATEGORIAS.find(c => c.v === sesion.categoria)?.label || sesion.categoria}
          {' · '}{sesion.usuario}
          {' · '}<strong>{sesion.contados}/{sesion.totalItems}</strong> contados
          {sesion.varianzas > 0 && (
            <span style={{ color: 'var(--lp-danger-700)', fontWeight: 600 }}> · {sesion.varianzas} varianzas</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Aprobar ajuste — SOLO admin (Burgos no ve este botón). Varianza >5% → causas. */}
        {sesion.estado === 'finalizado' && canAprobar && (
          <button style={S.btnSuccess} onClick={() => onAprobar(sesion.id)}
            data-id="conteo.btn.aprobar-ajuste" data-rol="admin">
            {Icon.shield(16)}Aprobar ajuste
          </button>
        )}
        <ImportExportPrint
          exportUrl={() => api.urlExportCycleCount(sesion.id)}
          printUrl={() => api.urlPrintCycleCount(sesion.id)}
          permisos={{ import: false }}
        />
        <button style={S.btnGhost} onClick={() => setExpanded(!expanded)}
          data-id="conteo.btn.ver-detalle" data-rol="inventario,admin">
          {expanded ? 'Cerrar' : 'Ver detalle'}
        </button>
      </div>

      {expanded && flaggedItems.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--lp-danger-700)', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {Icon.flag(14)}Items con varianza significativa ({flaggedItems.length}):
          </div>
          {isDesktop ? (
            <div style={S.tablewrap}>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Item</th>
                  <th style={{ ...S.th, ...S.thR }}>Sistema</th>
                  <th style={{ ...S.th, ...S.thR }}>Físico</th>
                  <th style={{ ...S.th, ...S.thR }}>Δ</th>
                  <th style={{ ...S.th, ...S.thC }}>%</th>
                </tr></thead>
                <tbody>
                  {flaggedItems.map(item => (
                    <tr key={item.key} style={{ background: 'var(--lp-danger-50)' }}>
                      <td style={{ ...S.td, fontWeight: 600 }}>{item.nombre}</td>
                      <td style={{ ...S.td, ...S.tdMono, ...S.thR }}>{item.stockSistema}</td>
                      <td style={{ ...S.td, ...S.tdMono, ...S.thR }}>{item.stockFisico}</td>
                      <td style={{ ...S.td, ...S.tdMono, ...S.thR, color: 'var(--lp-danger-600)', fontWeight: 700 }}>
                        {item.varianza > 0 ? '+' : ''}{item.varianza}
                      </td>
                      <td style={{ ...S.td, ...S.thC }}>
                        <span style={S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)')}>{item.pctVarianza?.toFixed(1)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            flaggedItems.map(item => (
              <div key={item.key} style={{ ...S.itemRow, ...S.itemRowFlagged, marginBottom: 5 }}>
                <div style={{ fontWeight: 600 }}>{item.nombre}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{item.stockSistema}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{item.stockFisico}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-danger-600)', fontWeight: 700 }}>
                  {item.varianza > 0 ? '+' : ''}{item.varianza}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={S.badge('var(--lp-danger-100)', 'var(--lp-danger-700)')}>{item.pctVarianza?.toFixed(1)}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* JUL 2026: `embedded` — la pantalla también vive como vista del hub /inventario
   del admin (patrón AlmacenPage). Solo suprime su TopBar propio. */
export default function CycleCountPage({ embedded = false }) {
  const { can, user } = useAuth();
  const isDesktop = useIsDesktop();
  const [confirm, ConfirmEl] = useConfirm();
  const [activeTab, setActiveTab] = useState('actual');
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  /* Defense-in-depth: si un rol sin permiso llega aquí (cache de menú, deep
     link, cambio de rol mid-sesión), le bloqueamos con un mensaje claro.
     App.jsx RoleRoute es la primera capa; confiar solo en routing-guards es frágil.
     El cálculo es un boolean (no early-return antes de hooks) — el bloqueo se
     renderiza en el JSX, después de declarar todos los hooks. */
  const ROLES_PERMITIDOS = ['admin', 'inventario'];
  const sinAcceso = !!(user && user.rol && !ROLES_PERMITIDOS.includes(user.rol));

  const [showStart, setShowStart] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showAddMP, setShowAddMP] = useState(false);
  const [addingMP, setAddingMP] = useState(false);
  const [sesionParaAprobar, setSesionParaAprobar] = useState(null);
  const [aprobandoConCausas, setAprobandoConCausas] = useState(false);
  const [itemParaContar, setItemParaContar] = useState(null);
  const [toast, setToast] = useState('');

  /* Calendario de conteos (vencidos/esta semana/próximos) — vive a nivel page
     para alimentar la tab "Vencidos · N" y el subtítulo del mockup
     ("Hola Burgos · 2 vencidos"). PendientesTab lo recibe por props.
     Guard `?.` : tolera mocks de api sin el método (tests). */
  const [calData, setCalData] = useState(null);
  const [calLoading, setCalLoading] = useState(true);
  const [calErr, setCalErr] = useState('');

  const cargarCal = useCallback(() => {
    const p = api.getCalendarioConteos?.();
    if (!p || typeof p.then !== 'function') { setCalLoading(false); return; }
    p.then(r => { setCalData(r.data); setCalErr(''); })
      .catch(e => setCalErr(humanizeError(e))) /* AUDIT UX 16-jul (U4) */
      .finally(() => setCalLoading(false));
  }, []);

  const cargar = useCallback(() => {
    setLoading(true);
    api.getCycleCounts()
      .then(r => {
        const arr = Array.isArray(r) ? r : (r.data || []);
        setSesiones(arr);
      })
      .catch(e => setErr(humanizeError(e))) /* AUDIT UX 16-jul (U4) */
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); cargarCal(); }, [cargar, cargarCal]);

  /* Realtime: canal 'cycleCount' (filtro ['admin','inventario']) + inventario.
     Aprobar/finalizar mueve "último conteo" → también refresca el calendario. */
  useRealtimeSync({
    onCycleCount: () => { cargar(); cargarCal(); },
    onInventario: () => cargar(),
  });

  const sesionActiva = useMemo(
    () => sesiones.find(s => s.estado === 'activo' && s.usuario === user?.nombre),
    [sesiones, user]
  );
  const historial = useMemo(
    () => [...sesiones].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    [sesiones]
  );

  const handleStart = async (categoria, tipo) => {
    /* CANDADO: PIN del contador al ABRIR la sesión (firma de apertura). */
    const pin = await confirm(
      'Vas a iniciar una sesión de conteo. Esta acción es tu firma como contador — quedará registrado que TÚ abriste estos números. Ingresa tu PIN para confirmar.',
      {
        title: 'Firmar apertura de sesión',
        confirmText: 'Firmar y abrir sesión',
        danger: false,
        prompt: { label: 'Tu PIN', placeholder: '0000', required: true, minLength: 4, maxLength: 6, rows: 1, numeric: true, password: true },
      }
    );
    if (!pin) return;
    setStarting(true);
    setErr('');
    try {
      await api.cycleCountIniciar(categoria, tipo, pin);
      setShowStart(false);
      cargar();
    } catch (e) {
      setErr(humanizeError(e)); /* AUDIT UX 16-jul (U4) */
    } finally {
      setStarting(false);
    }
  };

  const handleRegistrar = async (sesionId, itemKey, stockFisico) => {
    try {
      const r = await api.cycleCountRegistrar(sesionId, itemKey, stockFisico);
      setSesiones(prev => prev.map(s => {
        if (s.id !== sesionId) return s;
        const items = s.items.map(i => i.key === itemKey ? r.item : i);
        const contados = items.filter(i => i.stockFisico !== null && i.stockFisico !== undefined).length;
        const varianzas = items.filter(i => i.flagged).length;
        return { ...s, items, contados, varianzas };
      }));
      /* Feedback del mockup tras registrar (varianza alta → aviso de aprobación) */
      setToast(r?.item?.flagged
        ? 'Conteo registrado · se enviará a aprobación de admin'
        : 'Conteo registrado');
      setTimeout(() => setToast(''), 3000);
    } catch (e) {
      setToast(humanizeError(e)); /* AUDIT UX 16-jul (U4) */
      setTimeout(() => setToast(''), 3000);
      throw e;
    }
  };

  const handleFinalizar = async (sesionId) => {
    /* El conteo BASE no va a aprobación: al firmar FIJA el inventario. El aviso
       tiene que decir exactamente eso, con los números de esta sesión, porque
       después ya no hay vuelta atrás desde la UI. */
    const ses = sesiones.find(s => s.id === sesionId) || sesionActiva;
    const esBase = ses?.tipo === 'base';
    const contados = (ses?.items || []).filter(i => i.stockFisico !== null && i.stockFisico !== undefined).length;
    const sinContar = (ses?.items || []).length - contados;

    const pin = await confirm(
      esBase
        ? `Vas a FIJAR el inventario base de materia prima.\n\n`
          + `· ${contados} materia(s) prima(s) quedarán con la cantidad que capturaste.\n`
          + `· ${sinContar} sin contar: conservan su existencia actual.\n\n`
          + `Producción empezará a descontar desde estos números. Se aplica de inmediato, sin aprobación. Ingresa tu PIN para firmar.`
        : 'Vas a finalizar la sesión de conteo. Esta acción es tu firma como contador — quedará registrado que TÚ cerraste estos números. Ingresa tu PIN para confirmar.',
      {
        title: esBase ? 'Firmar y fijar inventario base' : 'Firmar y finalizar sesión',
        confirmText: esBase ? 'Firmar y fijar' : 'Firmar y finalizar',
        danger: !!esBase,
        prompt: { label: 'Tu PIN', placeholder: '0000', required: true, minLength: 4, maxLength: 6, rows: 1, numeric: true, password: true },
      }
    );
    if (!pin) return;
    try {
      if (esBase) {
        const r = await api.cycleCountFinalizarBase(sesionId, pin);
        setToast(`Inventario base fijado · ${r.fijadas} MP` + (r.sinContar ? ` · ${r.sinContar} sin contar` : ''));
        setTimeout(() => setToast(''), 5000);
      } else {
        await api.cycleCountFinalizar(sesionId, pin);
      }
      cargar();
    } catch (e) {
      setErr(humanizeError(e)); /* AUDIT UX 16-jul (U4) */
    }
  };

  const handleAgregarMP = async (nombre, stockFisico, unidad) => {
    if (!sesionActiva) throw new Error('Sin sesión activa');
    setAddingMP(true);
    /* El error se propaga al AddMPModal (que lo muestra inline); el finally
       limpia el flag de carga pase lo que pase. */
    try {
      const r = await api.cycleCountAgregarItem(sesionActiva.id, nombre, stockFisico, unidad);
      setSesiones(prev => prev.map(s => s.id === sesionActiva.id ? r.sesion : s));
      setShowAddMP(false);
    } finally {
      setAddingMP(false);
    }
  };

  const handleAprobar = async (sesionId) => {
    const sesion = sesiones.find(s => s.id === sesionId);
    if (!sesion) return;
    const flagged = (sesion.items || []).filter(i => i.flagged && i.stockFisico != null);

    if (flagged.length === 0) {
      const ok = await confirm('¿Aprobar los ajustes de inventario? Esta acción aplica las diferencias al inventario y es irreversible.', { danger: true, confirmText: 'Aprobar' });
      if (!ok) return;
      try {
        await api.cycleCountAprobar(sesionId, {});
        cargar();
      } catch (e) {
        setErr(humanizeError(e)); /* AUDIT UX 16-jul (U4) */
      }
    } else {
      /* Hay varianzas >umbral — abrir modal de causas obligatorio (admin). */
      setSesionParaAprobar(sesion);
    }
  };

  const handleAprobarConCausas = async (causasPorItem) => {
    if (!sesionParaAprobar) return;
    setAprobandoConCausas(true);
    try {
      await api.cycleCountAprobar(sesionParaAprobar.id, causasPorItem);
      setSesionParaAprobar(null);
      cargar();
    } catch (e) {
      const msg = humanizeError(e); /* AUDIT UX 16-jul (U4) */
      throw new Error(msg, { cause: e });
    } finally {
      setAprobandoConCausas(false);
    }
  };

  /* Tabs pill del mockup con contadores: Vencidos · N (calendario) /
     Conteo actual · pendientes de la sesión / Historial · sesiones. */
  const nVencidos = calData ? (calData.vencidos || []).length : null;
  const nPorContar = sesionActiva
    ? (sesionActiva.items || []).filter(i => i.stockFisico === null || i.stockFisico === undefined).length
    : null;
  const tabs = [
    { id: 'pendientes', label: `Vencidos${nVencidos != null ? ' · ' + nVencidos : ''}` },
    { id: 'actual', label: `Conteo actual${nPorContar != null ? ' · ' + nPorContar : ''}` },
    { id: 'historial', label: `Historial${sesiones.length ? ' · ' + sesiones.length : ''}` },
  ];

  /* Bloqueo por rol — renderizado tras declarar todos los hooks. */
  if (sinAcceso) {
    return (
      <div>
        {!embedded && <TopBar title="Conteo" />}
        <div style={{ maxWidth: 480, margin: '40px auto', padding: 24, background: 'var(--lp-bg-raised)', borderRadius: 18, border: '1px solid var(--lp-border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Sin acceso</div>
          <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)', lineHeight: 1.5 }}>
            Esta pantalla está reservada para usuarios con rol <strong>inventario</strong> o <strong>admin</strong>.
            Tu rol actual es <strong>{user.rol}</strong>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!embedded && <TopBar title="Conteo" />}
      <div style={S.wrap}>
        <div style={S.h1}>Conteo</div>
        {/* Subtítulo del mockup: "Hola Burgos · 2 vencidos" */}
        <div style={S.psub}>
          {user?.nombre ? `Hola ${user.nombre}` : 'Conteo físico'}
          {nVencidos != null ? ` · ${nVencidos} vencido${nVencidos === 1 ? '' : 's'}` : ''}
        </div>

        <div style={S.pillTabs}>
          {tabs.map(t => (
            <button key={t.id} type="button" style={S.pillTab(t.id === activeTab, !isDesktop)}
              data-id={`conteo.tab.${t.id}`} data-rol="inventario,admin"
              onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {err && <div style={S.err}>{err}</div>}
        {toast && (
          <div style={{
            ...S.err,
            ...(toast.startsWith('Error')
              ? { background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)' }
              : { background: 'var(--lp-success-100)', color: 'var(--lp-success-700)' }),
          }}>{toast}</div>
        )}

        {activeTab === 'pendientes' && (
          <PendientesTab isDesktop={isDesktop} data={calData} loading={calLoading} err={calErr} />
        )}

        {activeTab === 'actual' && (
          <>
            {!sesionActiva && can('conteoFisico') && (
              <div style={{ marginBottom: 16 }}>
                <button style={S.btnPrimary} onClick={() => setShowStart(true)}
                  data-id="conteo.btn.nueva-sesion" data-rol="inventario,admin">
                  {Icon.plus(16)}Iniciar nueva sesión de conteo
                </button>
              </div>
            )}

            {loading ? (
              <div style={S.loading}>Cargando…</div>
            ) : sesionActiva ? (
              <SesionActiva
                sesion={sesionActiva}
                isDesktop={isDesktop}
                onRegistrar={(itemKey, stockFisico) => handleRegistrar(sesionActiva.id, itemKey, stockFisico)}
                onFinalizar={handleFinalizar}
                onAgregarMP={() => setShowAddMP(true)}
                onContar={(item) => setItemParaContar(item)}
              />
            ) : (
              <div style={S.empty}>
                Sin sesión activa.
                {can('conteoFisico') && ' Inicia una nueva con el botón de arriba.'}
              </div>
            )}

            {/* Nota informativa §9: varianza >umbral → aprobación admin. */}
            {sesionActiva && (
              <div style={S.noteCard}>
                Si la varianza supera el <b style={{ color: 'var(--lp-text-primary)' }}>umbral ({UMBRAL}%)</b> se envía a aprobación de admin. {user?.rol === 'inventario' ? 'No ajustas inventario directo.' : 'El conteo no aplica el ajuste hasta que admin lo aprueba.'}
              </div>
            )}
          </>
        )}

        {activeTab === 'historial' && (
          loading ? <div style={S.loading}>Cargando…</div> :
          historial.length === 0 ? (
            <div style={S.empty}>Sin historial de conteos</div>
          ) : (
            historial.map(s => (
              <HistorialCard key={s.id} sesion={s} onAprobar={handleAprobar}
                canAprobar={can('admin') || user?.rol === 'admin'} isDesktop={isDesktop} />
            ))
          )
        )}

        {showStart && <StartModal onStart={handleStart} onClose={() => setShowStart(false)} loading={starting} isDesktop={isDesktop} />}
        {showAddMP && <AddMPModal onAdd={handleAgregarMP} onClose={() => setShowAddMP(false)} loading={addingMP} isDesktop={isDesktop} />}
        {itemParaContar && sesionActiva && (
          <CountSheet
            key={itemParaContar.key}
            item={itemParaContar}
            isDesktop={isDesktop}
            onClose={() => setItemParaContar(null)}
            onRegistrar={async (itemKey, stockFisico) => {
              await handleRegistrar(sesionActiva.id, itemKey, stockFisico);
              /* AUDIT UX 16-jul (U11): auto-avanzar al siguiente ítem SIN contar
                 — antes volvía a la lista y Burgos buscaba el siguiente a mano. */
              const next = (sesionActiva.items || []).find(i => i && i.stockFisico == null && i.key !== itemKey);
              setItemParaContar(next || null);
            }}
          />
        )}
        {sesionParaAprobar && (
          <CausasRaizModal
            sesion={sesionParaAprobar}
            onAprobar={handleAprobarConCausas}
            onClose={() => setSesionParaAprobar(null)}
            loading={aprobandoConCausas}
            isDesktop={isDesktop}
          />
        )}
      </div>
      {ConfirmEl}
    </div>
  );
}
