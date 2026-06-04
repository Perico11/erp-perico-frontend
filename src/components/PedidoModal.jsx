/* ═══════════════════════════════════════════════════════════════════════
   PedidoModal — Sprint P (jun 2026, Mockup A del handoff).
   U7 (Sprint U): badge PRUEBA si el pedido es de prueba.

   Modal central bloqueante que avisa al técnico cuando entra un pedido.
   Apariencia y comportamiento documentados en el handoff. Espera:
     - pedido: { codigo, producto, cantidad, presentacion, solicitante,
                 fecha|creado_en, prioridad? }
     - onResolve: ('accept'|'reject'|'cola'|'detail') => void

   No conoce nada de backend ni cola; eso lo maneja PedidoIncomingManager.
   ═══════════════════════════════════════════════════════════════════════ */
import { useEffect, useRef } from 'react';
import PruebaBadge, { esPrueba as esPruebaItem } from './ui/PruebaBadge';

/* ── Iconos (stroke 2, currentColor) ── */
function Bell({ size = 18, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function Check({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function XIco({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function Cola({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="3.6" cy="6" r="1.1"/>
      <circle cx="3.6" cy="12" r="1.1"/>
      <circle cx="3.6" cy="18" r="1.1"/>
    </svg>
  );
}

/* Inyectar keyframes + reglas responsive una sola vez (patrón consistente
   con InboundAlertManager). Las reglas de fila de botones viven aquí para
   poder usar @media queries (no se pueden hacer con style inline). */
function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lp-pedido-modal-css')) return;
  const style = document.createElement('style');
  style.id = 'lp-pedido-modal-css';
  style.textContent = `
    @keyframes lp-modal-in    { from{transform:translateY(12px) scale(.97);opacity:0} to{transform:none;opacity:1} }
    @keyframes lp-backdrop-in { from{opacity:0} to{opacity:1} }
    @keyframes lp-ring        { 0%,100%{transform:rotate(0)} 10%,30%{transform:rotate(-9deg)} 20%,40%{transform:rotate(9deg)} 50%{transform:rotate(0)} }
    @keyframes lp-badge-pulse { 0%{box-shadow:0 0 0 0 rgba(220,38,38,.45)} 70%{box-shadow:0 0 0 7px rgba(220,38,38,0)} 100%{box-shadow:0 0 0 0 rgba(220,38,38,0)} }

    /* FIX jun 2026: fila de botones del PedidoModal.
       Desktop (≥640): horizontal, Rechazar/En cola tamaño contenido,
       Aceptar flex:1 para llenar lo restante.
       Móvil (<640): vertical apilado, cada botón width:100%. */
    .lp-pedido-actions {
      display: flex;
      flex-direction: row;
      gap: 10px;
      padding: 0 26px;
      align-items: stretch;
    }
    .lp-pedido-actions > .lp-acc-grow {
      flex: 1;
      min-width: 0;
    }
    .lp-pedido-actions > .lp-acc-grow > button { width: 100%; }

    @media (max-width: 640px) {
      .lp-pedido-actions { flex-direction: column; gap: 8px; }
      .lp-pedido-actions > button,
      .lp-pedido-actions > .lp-acc-grow,
      .lp-pedido-actions > .lp-acc-grow > button {
        width: 100% !important;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .lp-no-motion { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

/* Helper "hace X" en español */
function formatHace(fecha) {
  if (!fecha) return 'recién';
  const t = new Date(fecha).getTime();
  if (!t) return 'recién';
  const diff = Math.max(0, Date.now() - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s} segundo${s === 1 ? '' : 's'}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minuto${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hora${h === 1 ? '' : 's'}`;
  const d = Math.floor(h / 24);
  return `${d} día${d === 1 ? '' : 's'}`;
}

const btnBase = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  fontFamily: 'var(--lp-font-sans)', fontWeight: 600, cursor: 'pointer',
  border: '1px solid transparent', borderRadius: 'var(--lp-radius-md)',
  minHeight: 44, padding: '0 16px', fontSize: 14, lineHeight: 1,
  transition: 'filter .15s, transform .1s',
};
const btn = {
  accept:  { ...btnBase, background: 'var(--lp-success-600)', color: '#fff', borderColor: 'var(--lp-success-700)', width: '100%' },
  reject:  { ...btnBase, background: 'var(--lp-danger-600)',  color: '#fff', borderColor: '#b91c1c' },
  neutral: { ...btnBase, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', borderColor: 'var(--lp-border-default)' },
};

export default function PedidoModal({ pedido, onResolve }) {
  const acceptBtnRef = useRef(null);
  useEffect(() => { injectKeyframes(); }, []);

  /* Focus inicial en Aceptar (handoff §9 — accesibilidad) */
  useEffect(() => {
    if (acceptBtnRef.current) {
      try { acceptBtnRef.current.focus(); } catch {}
    }
  }, [pedido?.id, pedido?.codigo]);

  /* Esc => "En cola" (NO resuelve aceptar/rechazar). Handoff §6. */
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onResolve('cola'); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onResolve]);

  if (!pedido) return null;
  const urgente = pedido.prioridad === 'urgente';
  const reduce = typeof window !== 'undefined' &&
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hace = formatHace(pedido.fecha || pedido.creado_en);
  const codigo = pedido.codigo || pedido.id || '—';
  const producto = pedido.producto || pedido.nombre || pedido.formula || '—';
  const cantidad = pedido.cantidad ?? 0;
  const presentacion = pedido.presentacion || (pedido.litPerUnit === 19 ? 'cubetas' : 'unidades');
  const solicitante = pedido.solicitante || 'Almacén Terán';

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="pedido-modal-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        className={reduce ? 'lp-no-motion' : ''}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(26,24,21,0.42)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'lp-backdrop-in .3s ease',
        }}
        /* Backdrop NO cierra (handoff §6). Solo capturamos para no propagar. */
        onClick={e => e.stopPropagation()}
      />
      <div
        className={reduce ? 'lp-no-motion' : ''}
        style={{
          position: 'relative', width: 440, maxWidth: '100%',
          background: 'var(--lp-bg-raised)',
          borderRadius: 'var(--lp-radius-xl)',
          boxShadow: 'var(--lp-shadow-lg)',
          overflow: 'hidden',
          animation: 'lp-modal-in .32s cubic-bezier(.34,1.56,.64,1)',
        }}
      >
        {/* Header con campana */}
        <div style={{ padding: '26px 26px 0', textAlign: 'center' }}>
          <div style={{
            width: 58, height: 58, margin: '0 auto', borderRadius: 99,
            background: 'var(--lp-brand-50)',
            border: '1px solid var(--lp-brand-100)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--lp-brand-600)',
          }}>
            <span
              className={reduce ? 'lp-no-motion' : ''}
              style={{ animation: 'lp-ring 1.6s ease-in-out infinite', transformOrigin: '50% 10%' }}
            >
              <Bell size={26} />
            </span>
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
              padding: '4px 9px', borderRadius: 99,
              color: urgente ? 'var(--lp-danger-600)' : 'var(--lp-brand-700)',
              background: urgente ? 'var(--lp-danger-50)' : 'var(--lp-brand-50)',
              border: `1px solid ${urgente ? 'var(--lp-danger-100)' : 'var(--lp-brand-100)'}`,
            }}>
              {urgente ? 'Urgente' : 'Pedido nuevo'}
            </span>
            {/* FIX jun 2026 (U7): badge PRUEBA visible para que Enrique sepa
                que el pedido es de prueba antes de aceptarlo. Sin esto el
                técnico aceptaba pedidos prueba como si fueran reales. */}
            {esPruebaItem(pedido) && <PruebaBadge size="md" />}
          </div>
          <h2 id="pedido-modal-title" style={{
            margin: '12px 0 2px', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em',
            color: 'var(--lp-text-primary)',
          }}>
            Nuevo pedido de producción
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--lp-text-tertiary)' }}>
            Requiere tu confirmación para iniciar
          </p>
        </div>

        {/* Caja resumen */}
        <div style={{
          margin: '20px 26px', padding: 18,
          background: 'var(--lp-bg-sunken)',
          borderRadius: 'var(--lp-radius-lg)',
          border: '1px solid var(--lp-border-subtle)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--lp-text-primary)' }}>
              {producto}
            </span>
            <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 600, fontSize: 13, color: 'var(--lp-brand-700)' }}>
              {codigo}
            </span>
          </div>
          <div style={{ height: 1, background: 'var(--lp-border-subtle)', margin: '13px 0' }} />
          {[
            ['Cantidad',    `${cantidad} ${presentacion}`],
            ['Solicitante', solicitante],
            ['Recibido',    `hace ${hace}`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13.5 }}>
              <span style={{ color: 'var(--lp-text-tertiary)' }}>{k}</span>
              <span style={{ fontWeight: 600, color: 'var(--lp-text-primary)' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Acciones — Rechazar · En cola · Aceptar.
            Layout responsive vía clase CSS (ver injectKeyframes):
              · ≥640px: una sola fila, Aceptar ocupa el resto (flex:1)
              · <640px: vertical apilado, los 3 al 100% width */}
        <div className="lp-pedido-actions">
          <button
            type="button"
            style={btn.reject}
            onClick={() => onResolve('reject')}
            aria-label="Rechazar pedido"
          >
            <XIco />Rechazar
          </button>
          <button
            type="button"
            style={btn.neutral}
            onClick={() => onResolve('cola')}
            aria-label="Posponer (dejar en cola)"
          >
            <Cola />En cola
          </button>
          <div className="lp-acc-grow">
            <button
              ref={acceptBtnRef}
              type="button"
              style={btn.accept}
              onClick={() => onResolve('accept')}
              aria-label="Aceptar pedido"
            >
              <Check />Aceptar
            </button>
          </div>
        </div>

        {/* Link "Ver detalle" */}
        <div style={{ textAlign: 'center', padding: '16px 0 22px' }}>
          <a
            onClick={(e) => { e.preventDefault(); onResolve('detail'); }}
            href="#"
            style={{
              fontSize: 13, color: 'var(--lp-brand-600)', fontWeight: 600,
              cursor: 'pointer', textDecoration: 'none',
            }}
          >
            Ver detalle del pedido →
          </a>
        </div>
      </div>
    </div>
  );
}
