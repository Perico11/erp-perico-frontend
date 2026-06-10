/* ═══════════════════════════════════════════════════════════════════════
   Checkpoint — lenguaje visual compartido de los DOS checkpoints del ERP
   (handoff Claude Design "MOCKUP NOTIFICACIONES (7)" / HANDOFF_CHECKPOINT.md):

   A) <CkStripStepper>  — stepper HORIZONTAL de pasos de fabricación
      (wizard ProduccionFlow): nodo con icono por type, done=relleno+✓,
      current=grande con halo+pulso, conectores que se llenan, auto-centrado,
      click en done regresa. + <CkPill> del paso activo con "✓ guardado".

   B) <RutaPedidoRail>  — riel VERTICAL del ciclo de vida del pedido
      (MisLotesPipeline / detalle de pedido): etapa con icono+color por fase
      (solicitud=info, fabricación=verde, QC=morado, logística=ámbar,
      cierre=verde oscuro), responsable + hora por etapa hecha, "ahora" en la
      actual, "Pendiente · rol" en futuras. qc_hold = nodo rojo "QC retenido"
      sin avanzar progreso.

   REGLAS DURAS del handoff: SVG line stroke=currentColor sw=2 (✓ sw=3),
   motion solo transform (nunca opacity desde 0 como reposo), ease/spring
   exactos, prefers-reduced-motion respetado. CSS inyectado una vez
   (pseudo-elementos y keyframes no se pueden inline) con tokens --lp-*.
   ═══════════════════════════════════════════════════════════════════════ */
import { Fragment, useEffect, useRef } from 'react';

/* ── Colores por fase (mapa de tokens del handoff §2) ── */
export const CK_COLOR = {
  info:   'var(--lp-info-600)',
  brand:  'var(--lp-brand-600)',
  brandd: 'var(--lp-brand-700)',
  purple: '#8C5BC9',
  amber:  'var(--lp-warning-600)',
  danger: 'var(--lp-danger-600)',
};

/* ── Iconos (paths EXACTOS de los mockups; viewBox 24, line, currentColor) ── */
const Svg = ({ d, sw = 2, children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children || (Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />)}
  </svg>
);
export const CkCheck = () => <Svg sw={3}><polyline points="20 6 9 17 4 12" /></Svg>;

/* Ruta del pedido (B) — icono por etapa */
const IcoPedido     = () => <Svg d="M9 3h6a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a1 1 0 0 1 1-1z" />;
const IcoAceptado   = () => <Svg><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></Svg>;
const IcoProduccion = () => <Svg><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1 2 2 0 1 1-4 0 1.6 1.6 0 0 0-2.7-1.1 2 2 0 1 1-2.8-2.8 1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1 2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8 2 2 0 1 1 2.8-2.8 1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5 2 2 0 1 1 4 0 1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3 2 2 0 1 1 2.8 2.8 1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1 2 2 0 1 1 0 4 1.6 1.6 0 0 0-1.5 1z" /></Svg>;
const IcoProducido  = () => <Svg d={['M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.3 7 12 12l8.7-5M12 22V12']} />;
const IcoQC         = () => <Svg d={['M9 3h6a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a1 1 0 0 1 1-1z', 'M9 13l2 2 4-4']} />;
const IcoEnvasando  = () => <Svg d="M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3z" />;
const IcoEnvasado   = () => <Svg d={['M5 8h14l-1 11a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8z', 'M9 8V6a3 3 0 0 1 6 0v2', 'M9.5 14l2 2 3.5-3.5']} />;
const IcoCamino     = () => <Svg><path d="M1 4h13v10H1z" /><path d="M14 8h4l3 3v3h-7" /><circle cx="5.5" cy="17.5" r="2" /><circle cx="17.5" cy="17.5" r="2" /></Svg>;
const IcoTeran      = () => <Svg d={['M3 21V9l9-5 9 5v12', 'M3 21h18M9 21v-6h6v6']} />;
const IcoEntregado  = () => <Svg d={['M20 6 9 17l-5-5', 'M14 12l4-4']} />;

/* Stepper de producción (A) — icono por type de paso del wizard real
   (types reales del backend: prep | dual | wait | eval | qc | ajustes). */
const IcoPrep  = () => <Svg d={['M9 3h6M10 3v5L5.6 17A1.6 1.6 0 0 0 7 19.4h10A1.6 1.6 0 0 0 18.4 17L14 8V3', 'M8 14h8']} />;
const IcoGota  = () => <Svg d="M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3z" />;
const IcoReloj = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></Svg>;
const IcoOjo   = () => <Svg><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></Svg>;
const IcoAjuste = () => <Svg d={['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6']} />;

export const CK_TYPE_ICON = {
  prep: IcoPrep, dual: IcoGota, add: IcoGota, wait: IcoReloj,
  eval: IcoOjo, qc: IcoQC, ajustes: IcoAjuste, finish: IcoEnvasado,
};

/* ── Etapas canónicas del ciclo de vida (handoff §3 — espejo de PASOS de
      MisLotesPipeline + 'pedido' al inicio). NO inventar estados. ── */
export const ETAPAS_PEDIDO = [
  { key: 'pedido',        label: 'Pedido recibido',       Icon: IcoPedido,     color: 'info',   rol: 'Almacén' },
  { key: 'aceptado',      label: 'Aceptado',              Icon: IcoAceptado,   color: 'info',   rol: 'Técnico' },
  { key: 'en_produccion', label: 'En producción',         Icon: IcoProduccion, color: 'brand',  rol: 'Técnico' },
  { key: 'producido',     label: 'Terminado',             Icon: IcoProducido,  color: 'brand',  rol: 'Técnico' },
  { key: 'qc_aprobado',   label: 'QC aprobado',           Icon: IcoQC,         color: 'purple', rol: 'Técnico' },
  { key: 'en_envasado',   label: 'Envasando',             Icon: IcoEnvasando,  color: 'brand',  rol: 'Técnico' },
  { key: 'envasado',      label: 'Listo para recolectar', Icon: IcoEnvasado,   color: 'brand',  rol: 'Técnico' },
  { key: 'en_camino',     label: 'En camino',             Icon: IcoCamino,     color: 'amber',  rol: 'Recolector' },
  { key: 'en_almacen',    label: 'Recibido en Terán',     Icon: IcoTeran,      color: 'info',   rol: 'Recolector' },
  { key: 'entregado',     label: 'Entregado',             Icon: IcoEntregado,  color: 'brandd', rol: 'Almacén' },
];

/* estado crudo del lote → índice de etapa (espejo del alias del handoff;
   qc_hold se UBICA en QC pero se pinta rojo aparte, sin avanzar). */
export function idxEtapaLote(estado) {
  const alias = {
    qc_hold: 'qc_aprobado',
    en_recoleccion: 'envasado',
    en_proceso: 'en_camino',
  };
  const k = alias[estado] || estado;
  const i = ETAPAS_PEDIDO.findIndex(e => e.key === k);
  return i >= 0 ? i : 0;
}

/* ── CSS inyectado una vez (pulso/pseudo-elementos no van inline) ── */
const CK_CSS = `
  .ckstrip{ display:flex; align-items:center; gap:0; overflow-x:auto; scroll-behavior:smooth;
    padding:8px 2px 10px; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
  .ckstrip::-webkit-scrollbar{ display:none; }
  .ckstrip .cknode{ flex:0 0 auto; position:relative; }
  .ckstrip .cknode[data-go]{ cursor:pointer; }
  .ckdot{ width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center;
    position:relative; transition:width .3s cubic-bezier(.34,1.56,.64,1), height .3s cubic-bezier(.34,1.56,.64,1),
    background .25s cubic-bezier(.22,1,.36,1), color .25s cubic-bezier(.22,1,.36,1),
    border-color .25s cubic-bezier(.22,1,.36,1), box-shadow .3s cubic-bezier(.22,1,.36,1); }
  .ckdot svg{ width:17px; height:17px; }
  .cknode.pending .ckdot{ background:var(--lp-bg-sunken); border:1.5px solid var(--lp-border-subtle); color:var(--lp-text-tertiary); }
  .cknode.done .ckdot{ background:var(--cc); color:#fff;
    box-shadow:0 3px 10px -3px color-mix(in srgb, var(--cc) 60%, transparent); }
  [data-theme="dark"] .cknode.done .ckdot, .dark .cknode.done .ckdot{ color:#0E1413; }
  .cknode.current .ckdot{ width:46px; height:46px; background:var(--lp-bg-raised); border:2.5px solid var(--cc); color:var(--cc);
    box-shadow:0 0 0 6px color-mix(in srgb, var(--cc) 15%, transparent), 0 8px 18px -5px color-mix(in srgb, var(--cc) 50%, transparent); }
  .cknode.current .ckdot svg{ width:22px; height:22px; }
  .cknode.current .ckdot::after{ content:''; position:absolute; inset:-2.5px; border-radius:50%; border:2.5px solid var(--cc);
    pointer-events:none; animation:ckpulse 1.9s cubic-bezier(.22,1,.36,1) infinite; }
  @keyframes ckpulse{ 0%{ transform:scale(1); opacity:.5 } 70%,100%{ transform:scale(1.5); opacity:0 } }
  .ckstrip .ckline{ flex:0 0 auto; width:28px; height:3px; border-radius:99px; background:var(--lp-border-subtle);
    transition:background .35s cubic-bezier(.22,1,.36,1); }
  .ckline.fill{ background:var(--lp-brand-600); }

  .ckpillrow{ display:flex; justify-content:center; padding:2px 0 10px; }
  .ckpill{ display:inline-flex; align-items:center; gap:10px; padding:7px 14px 7px 8px; border-radius:999px;
    background:var(--lp-bg-raised); border:1px solid var(--lp-border-subtle); box-shadow:0 5px 16px -10px rgba(20,40,30,.45);
    animation:ckpillin .3s cubic-bezier(.22,1,.36,1); }
  @keyframes ckpillin{ from{ transform:translateY(5px) } to{ transform:none } }
  .ckpill-ic{ width:30px; height:30px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center;
    background:color-mix(in srgb, var(--cc) 14%, transparent); color:var(--cc); }
  .ckpill-ic svg{ width:16px; height:16px; }
  .ckpill-tx{ display:flex; flex-direction:column; line-height:1.18; text-align:left; }
  .ckpill-tx b{ font-size:13px; font-weight:600; color:var(--lp-text-primary); }
  .ckpill-tx i{ font-size:11px; font-style:normal; color:var(--lp-text-secondary); font-family:var(--lp-font-mono); }
  .cksaved{ display:inline-flex; align-items:center; gap:4px; margin-left:4px; padding-left:11px; border-left:1px solid var(--lp-border-subtle);
    font-size:11px; font-weight:600; color:var(--lp-brand-600); white-space:nowrap; }
  .cksaved svg{ width:12px; height:12px; }

  .ckrail{ position:relative; padding-left:2px; }
  .ckrail .cknode{ display:flex; gap:14px; position:relative; padding-bottom:4px; }
  .ckrail .cknode:last-child{ padding-bottom:0; }
  .ckcol{ display:flex; flex-direction:column; align-items:center; flex:0 0 auto; }
  .ckrail .ckdot{ width:38px; height:38px; flex-shrink:0; z-index:2; }
  .ckrail .ckdot svg{ width:18px; height:18px; }
  .ckrail .ckline{ width:3px; flex:1; min-height:20px; border-radius:99px; background:var(--lp-border-subtle);
    margin:2px 0; transition:background .35s cubic-bezier(.22,1,.36,1); }
  .cktx{ flex:1; min-width:0; padding-top:7px; padding-bottom:6px; }
  .ckrail .cknode.current .cktx{ padding-top:11px; }
  .ckname{ font-size:14px; font-weight:600; letter-spacing:-.01em; color:var(--lp-text-primary);
    display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .ckrail .cknode.pending .ckname{ color:var(--lp-text-tertiary); font-weight:500; }
  .ckwho{ font-size:11.5px; color:var(--lp-text-secondary); margin-top:2px; display:flex; align-items:center; gap:6px; }
  .ckav{ width:17px; height:17px; border-radius:50%; background:color-mix(in srgb, var(--lp-brand-600) 16%, transparent);
    color:var(--lp-brand-700); display:inline-flex; align-items:center; justify-content:center;
    font-size:9px; font-weight:700; flex-shrink:0; }
  .cktime{ font-family:var(--lp-font-mono); font-size:11px; color:var(--lp-text-tertiary); }
  .cknow{ font-size:10px; font-weight:700; color:var(--cc); background:color-mix(in srgb, var(--cc) 13%, transparent);
    padding:2px 8px; border-radius:999px; }
  .cketa{ font-size:11px; color:var(--lp-text-tertiary); font-style:italic; margin-top:3px; }
  .ckhead{ display:flex; align-items:center; justify-content:space-between; margin:2px 2px 10px; }
  .ckhead .lbl{ font-size:11px; font-weight:600; letter-spacing:.05em; text-transform:uppercase; color:var(--lp-text-tertiary); }
  .ckhead .pct{ font-family:var(--lp-font-mono); font-size:12px; font-weight:700; color:var(--lp-brand-600); }

  @media (prefers-reduced-motion:reduce){
    .ckdot, .ckline, .ckpill{ transition:none !important; animation:none !important; }
    .cknode.current .ckdot::after{ animation:none !important; }
  }
`;

export function injectCkCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lp-ck-css')) return;
  const style = document.createElement('style');
  style.id = 'lp-ck-css';
  style.textContent = CK_CSS;
  document.head.appendChild(style);
}

/* ════════════════ A) Stepper horizontal de producción ════════════════ */
/* steps = los del wizard (type por paso); typeColor = TYPE_COLOR existente
   del caller (se mantiene intacto, decisión del handoff). Click en nodo
   done → onJump(i) (el caller decide la semántica de regresar). */
export function CkStripStepper({ steps, curStep, typeColor, onJump }) {
  const ref = useRef(null);
  useEffect(() => { injectCkCSS(); }, []);
  /* Auto-centrar el nodo actual (handoff §8.3) */
  useEffect(() => {
    const cn = ref.current?.querySelector('[data-current]');
    if (cn && ref.current) {
      ref.current.scrollTo({
        left: cn.offsetLeft + cn.offsetWidth / 2 - ref.current.clientWidth / 2,
        behavior: 'smooth',
      });
    }
  }, [curStep]);
  return (
    <div ref={ref} className="ckstrip" role="progressbar"
      aria-valuenow={curStep + 1} aria-valuemin={1} aria-valuemax={steps.length}>
      {steps.map((sp, i) => {
        const st = i < curStep ? 'done' : i === curStep ? 'current' : 'pending';
        const cc = typeColor[sp.type] || typeColor.prep || CK_COLOR.brand;
        const Icon = CK_TYPE_ICON[sp.type] || IcoGota;
        return (
          <Fragment key={sp.id ?? i}>
            {i > 0 && <div className={'ckline' + (i <= curStep ? ' fill' : '')} />}
            <div className={`cknode ${st}`} style={{ '--cc': cc }} title={sp.titulo || sp.cat || ''}
              {...(st === 'current' ? { 'data-current': '' } : {})}
              {...(st === 'done' && onJump ? { 'data-go': '1', onClick: () => onJump(i) } : {})}>
              <div className="ckdot">{st === 'done' ? <CkCheck /> : <Icon />}</div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/* Píldora del paso activo (debajo del riel): categoría + Paso N de M + ✓guardado */
export function CkPill({ step, curStep, total, typeColor, savedAt }) {
  useEffect(() => { injectCkCSS(); }, []);
  if (!step) return null;
  const cc = typeColor[step.type] || typeColor.prep || CK_COLOR.brand;
  const Icon = CK_TYPE_ICON[step.type] || IcoGota;
  return (
    <div className="ckpillrow">
      <span className="ckpill" style={{ '--cc': cc }}>
        <span className="ckpill-ic"><Icon /></span>
        <span className="ckpill-tx">
          <b>{step.mpCat || step.cat || step.titulo || 'Paso'}</b>
          <i>Paso {curStep + 1} de {total}</i>
        </span>
        {savedAt && <span className="cksaved"><CkCheck /> guardado</span>}
      </span>
    </div>
  );
}

/* ════════════════ B) Riel vertical — ruta del pedido ════════════════ */
/* lote = objeto canónico de trazabilidad. Quién/hora por etapa se toman del
   historial REAL del lote (primer evento que llegó a ese estado); para la
   etapa 'pedido' se usan los datos del lote (fechaPedido/solicitadoPor) si
   existen. Pendientes muestran solo el ROL responsable (sin inventar
   nombres). qc_hold: nodo rojo "QC retenido" sin avanzar el progreso. */
const fmtHora = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const hoy = new Date();
    const esHoy = d.toDateString() === hoy.toDateString();
    const hm = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (esHoy) return `hoy ${hm}`;
    const ayer = new Date(hoy.getTime() - 86400000);
    if (d.toDateString() === ayer.toDateString()) return `ayer ${hm}`;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }) + ` ${hm}`;
  } catch { return ''; }
};

/* alias inversos: qué estados del historial "cuentan" para cada etapa */
const HIST_KEYS = {
  pedido:        ['pedido', 'pendiente'],
  aceptado:      ['aceptado'],
  en_produccion: ['en_produccion'],
  producido:     ['producido'],
  qc_aprobado:   ['qc_aprobado', 'qc_hold'],
  en_envasado:   ['en_envasado'],
  envasado:      ['envasado', 'en_recoleccion'],
  en_camino:     ['en_camino', 'en_proceso'],
  en_almacen:    ['en_almacen', 'en_stock_teran'],
  entregado:     ['entregado'],
};

export function RutaPedidoRail({ lote, conHeader = true }) {
  useEffect(() => { injectCkCSS(); }, []);
  if (!lote) return null;
  const esHold = lote.estado === 'qc_hold';
  const cur = idxEtapaLote(lote.estado);
  const pct = Math.round((cur / (ETAPAS_PEDIDO.length - 1)) * 100);
  const hist = Array.isArray(lote.historial) ? lote.historial : [];

  const infoEtapa = (key) => {
    const keys = HIST_KEYS[key] || [key];
    const h = hist.find(x => x && keys.includes(x.estado));
    if (h) return { who: h.usuario || null, time: fmtHora(h.fecha) };
    if (key === 'pedido') {
      return { who: lote.solicitadoPor || lote.creadoPor || null, time: fmtHora(lote.fechaPedido || lote.fecha || lote.fechaCreacion) };
    }
    return { who: null, time: '' };
  };

  return (
    <div>
      {conHeader && (
        <div className="ckhead">
          <span className="lbl">Ruta del pedido</span>
          <span className="pct">{pct}%</span>
        </div>
      )}
      <div className="ckrail">
        {ETAPAS_PEDIDO.map((et, i) => {
          const st = i < cur ? 'done' : i === cur ? 'current' : 'pending';
          const last = i === ETAPAS_PEDIDO.length - 1;
          /* qc_hold: la etapa QC se pinta en danger con label "QC retenido" */
          const holdAqui = esHold && et.key === 'qc_aprobado';
          const cc = holdAqui ? CK_COLOR.danger : CK_COLOR[et.color];
          const label = holdAqui ? 'QC retenido' : et.label;
          const { who, time } = infoEtapa(et.key);
          const Icon = et.Icon;
          return (
            <div key={et.key} className={`cknode ${st}`} style={{ '--cc': cc }}>
              <div className="ckcol">
                <div className="ckdot">{st === 'done' ? <CkCheck /> : <Icon />}</div>
                {!last && <div className={'ckline' + (i < cur ? ' fill' : '')} />}
              </div>
              <div className="cktx">
                <div className="ckname">
                  {label}
                  {st === 'current' && <span className="cknow">ahora</span>}
                </div>
                {st === 'pending' ? (
                  <div className="cketa">Pendiente · {et.rol}</div>
                ) : (
                  <div className="ckwho">
                    {who && <span className="ckav">{String(who).charAt(0).toUpperCase()}</span>}
                    {who ? `${who} · ${et.rol}` : et.rol}
                    {time && <span className="cktime"> · {time}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
