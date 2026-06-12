/* ═══════════════════════════════════════════════════════════════════
   PRODUCCION FLOW — Motor de pasos paso-a-paso con timer regresivo.
   Fielmente migrado del SPA legacy formulario_v2.html#scr-prod
   - Pasos generados en backend (/api/produccion/steps)
   - Tipos: prep, dual (add+disp), wait, qc
   - Timer regresivo por paso, autoguardado de checkpoint cada 15s
   - Reanuda desde checkpoint si la sesión se interrumpió
   - Al terminar, descuenta MP, suma PT, crea lote, marca pedido/orden
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import api from '../../services/api';
import SecureView from '../../components/SecureView';
import PruebaBadge from '../../components/ui/PruebaBadge';
/* Checkpoint A (handoff Claude Design jun 2026): riel horizontal con icono
   por type + píldora del paso activo con "✓ guardado". Solo visual — el
   estado (curStep/savedAt/autosave/reanudar) se mantiene intacto. */
import { CkStripStepper, CkPill } from '../../components/pipeline/Checkpoint';

const fmtTimer = (s) => {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
};

const TYPE_COLOR = {
  prep:  'var(--lp-brand-500)',
  dual:  'var(--lp-success-700)',
  wait:  'var(--lp-warning-600)',
  eval:  'var(--lp-brand-700)',
  qc:    'var(--lp-qc-600)',
};

/* Label de categoría cuando el paso no trae mpCat (mockup .scat) */
const CAT_FALLBACK = {
  prep: 'Preparación', dual: 'Materia prima', wait: 'Reposo',
  eval: 'Evaluación', qc: 'Control de calidad', ajustes: 'Ajustes',
};

/* CSS inyectado UNA vez — cosas que inline-styles no cubren:
   - focus verde de inputs QC (mockup .qci:focus → border acc)
   - texto oscuro de botones de acento en dark (mockup .dark .tbtn.start)
   - pop del ring de éxito (mockup @keyframes pop) + reduced-motion */
const FLOW_CSS = `
  .lp-qci:focus{ border-color: var(--lp-brand-600) !important; box-shadow: var(--lp-focus-ring); }
  [data-theme="dark"] .lp-btn-acc, .dark .lp-btn-acc{ color:#0E1413 !important; }
  [data-theme="dark"] .lp-ring svg, .dark .lp-ring svg{ stroke:#0E1413; }
  @keyframes lpRingPop{ from{ transform:scale(0) } to{ transform:scale(1) } }
  @media (prefers-reduced-motion:reduce){ .lp-ring{ animation:none !important } }
`;
function injectFlowCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lp-prodflow-css')) return;
  const st = document.createElement('style');
  st.id = 'lp-prodflow-css';
  st.textContent = FLOW_CSS;
  document.head.appendChild(st);
}

/* Palomita mini para el chip de fase completada (dual add→disp) */
const CheckMini = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
);

const S = {
  wrap: { padding: '16px 16px 0', maxHeight: '90vh', overflowY: 'auto' },
  header: { marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  title: { fontSize: 18, fontWeight: 800, color: 'var(--lp-text-primary)' },
  meta: { fontSize: 12, color: 'var(--lp-text-secondary)' },
  /* (jun 2026, handoff Claude Design) El stepper de puntos Z5 y la barra de
     progreso fallback se sustituyeron por el riel de checkpoint compartido
     components/pipeline/Checkpoint.jsx (CkStripStepper + CkPill). */

  /* Card del paso — mockup Producción.html (.stepcard): radio 20, badge de
     categoría pill tintado con el color del type + kg mono grande a la derecha,
     título 24px en texto primario, texto de acción 14px secundario. */
  card: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
          borderRadius: 20, padding: '20px 18px', marginBottom: 12 },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  scat: (color) => ({
    display: 'inline-block', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em',
    textTransform: 'uppercase', padding: '4px 11px', borderRadius: 999,
    background: `color-mix(in srgb, ${color} 14%, transparent)`, color,
  }),
  skg: { fontFamily: 'var(--lp-font-mono)', fontSize: 18, fontWeight: 700,
         color: 'var(--lp-text-primary)', whiteSpace: 'nowrap' },
  stepTitle: { fontSize: 24, fontWeight: 600, letterSpacing: '-.02em',
               color: 'var(--lp-text-primary)', margin: '12px 0 8px', lineHeight: 1.15 },
  saction: { fontSize: 14, color: 'var(--lp-text-secondary)', lineHeight: 1.55 },
  alerta: { background: 'var(--lp-warning-100)', border: '1px solid var(--lp-warning-600)',
            borderRadius: 10, padding: '10px 13px', margin: '12px 0',
            display: 'flex', gap: 8, alignItems: 'flex-start',
            fontSize: 12, color: 'var(--lp-warning-700)', lineHeight: 1.4 },

  /* Timerbox — mockup .timerbox/.timerlbl/.timer/.tbtn: caja centrada con
     label uppercase, dígitos mono 52px tabulares y botón Iniciar/Pausar. */
  timerbox: { marginTop: 18, padding: 18, borderRadius: 16, background: 'var(--lp-bg-sunken)', textAlign: 'center' },
  timerlbl: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--lp-text-tertiary)' },
  timer: (state) => ({
    fontFamily: 'var(--lp-font-mono)', fontSize: 52, fontWeight: 700, lineHeight: 1.05,
    margin: '6px 0 12px', fontVariantNumeric: 'tabular-nums',
    color: state === 'done' ? 'var(--lp-brand-600)'
         : state === 'danger' ? 'var(--lp-danger-600)'
         : 'var(--lp-text-primary)',
  }),
  tbtn: (kind) => ({
    height: 46, padding: '0 24px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8,
    ...(kind === 'start'
      ? { border: 'none', background: 'var(--lp-brand-600)', color: '#fff' }
      : { border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)' }),
  }),
  tdone: { display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--lp-brand-600)', fontWeight: 600, fontSize: 14 },
  faseChip: (active, color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
    padding: '3px 10px', borderRadius: 999,
    background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
    color: active ? color : 'var(--lp-text-tertiary)',
    border: active ? '1px solid transparent' : '1px solid var(--lp-border-subtle)',
  }),

  btn: (kind) => {
    const map = {
      primary: { bg: 'var(--lp-brand-600)', fg: '#fff', bd: 'var(--lp-brand-600)' },
      success: { bg: 'var(--lp-success-600)', fg: '#fff', bd: 'var(--lp-success-600)' },
      warn:    { bg: 'var(--lp-warning-600)', fg: '#fff', bd: 'var(--lp-warning-600)' },
      danger:  { bg: 'var(--lp-danger-600)', fg: '#fff', bd: 'var(--lp-danger-600)' },
      ghost:   { bg: 'var(--lp-bg-raised)', fg: 'var(--lp-text-secondary)', bd: 'var(--lp-border-subtle)' },
    };
    const c = map[kind] || map.primary;
    return {
      padding: '12px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700,
      cursor: 'pointer', border: '1.5px solid ' + c.bd, background: c.bg, color: c.fg,
      fontFamily: 'inherit', minHeight: 44,
    };
  },

  accion: { fontSize: 13, color: 'var(--lp-text-primary)', lineHeight: 1.5,
            padding: 12, background: 'var(--lp-bg-sunken)', borderRadius: 8, marginBottom: 12 },

  /* QC — mockup .qcgrid/.qcf/.qci/.qcr: 2 columnas, tile suave, input mono
     con focus verde (clase .lp-qci) y rango como hint. */
  qcGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16, marginBottom: 12 },
  qcField: { padding: 12, borderRadius: 14, background: 'var(--lp-bg-sunken)' },
  qcLbl: { fontSize: 11, fontWeight: 600, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' },
  qcInput: { width: '100%', height: 42, marginTop: 6, padding: '0 10px', fontSize: 16,
             fontFamily: 'var(--lp-font-mono)', border: '1.5px solid var(--lp-border-subtle)',
             borderRadius: 10, boxSizing: 'border-box', background: 'var(--lp-bg-raised)',
             color: 'var(--lp-text-primary)', outline: 'none' },
  qcRange: { fontSize: 10.5, color: 'var(--lp-text-tertiary)', marginTop: 5 },

  /* Footer de navegación — mockup .foot: Anterior ghost / Completar primary,
     pegado abajo del modal con hairline arriba. */
  foot: { position: 'sticky', bottom: 0, display: 'flex', gap: 10, padding: '14px 16px',
          margin: '16px -16px 0', borderTop: '1px solid var(--lp-border-subtle)',
          background: 'var(--lp-bg-raised)', zIndex: 2 },
  footGhost: (disabled) => ({
    height: 50, padding: '0 18px', borderRadius: 14, cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600, background: 'transparent',
    border: '1px solid var(--lp-border-subtle)', color: 'var(--lp-text-secondary)',
    flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, opacity: disabled ? .4 : 1,
  }),
  footPrimary: (disabled) => ({
    height: 50, padding: '0 18px', borderRadius: 14, border: 'none',
    cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14.5,
    fontWeight: 600, background: 'var(--lp-brand-600)', color: '#fff', flex: 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    opacity: disabled ? .4 : 1,
  }),
};

export default function ProduccionFlow({ item, userName, onClose, onSuccess }) {
  /* item: { _tipo:'orden'|'pedido', _raw, id, codigo, formula, cantidad, esPrueba, fechaInicioProduccion } */
  const tipo = item._tipo || 'orden';
  const productoNombre = item.formula || item.producto || '';

  const [steps, setSteps] = useState([]);
  const [curStep, setCurStep] = useState(0);
  const [timerSec, setTimerSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [dualPhase, setDualPhase] = useState('add'); /* 'add' | 'disp' */
  const [qcReadings, setQcReadings] = useState({}); /* { pasoIdx: { fieldId: value } } */
  /* Sprint D (C3/R5): ajustes MP registrados durante producción.
     Array de { mp, kgAdicional, motivo }. Se SUMAN al descuento de MP al
     finalizar y se persisten en lote.ajustesMP[] para auditoría. */
  const [ajustesMP, setAjustesMP] = useState([]);
  const [stepDone, setStepDone] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null); /* timestamp ultimo checkpoint */
  /* Pantalla de éxito (mockup .success): al finalizar mostramos ring verde +
     folio mono; "Continuar" dispara el onSuccess original (cierra + recarga). */
  const [successInfo, setSuccessInfo] = useState(null);
  /* Marca visual "ya se corrió el timer de este paso" (mockup s._started) —
     SOLO presentación: decide Iniciar/Reanudar y el estado "Tiempo cumplido".
     No se persiste en el checkpoint (payload de autoguardado intocable). */
  const [startedSteps, setStartedSteps] = useState({});

  useEffect(() => { injectFlowCSS(); }, []);

  /* === Registro de tiempos: cada evento queda timestampeado para reporte ===
     events = [{ tipo, ts, paso }]
     Tipos: 'inicio', 'pausa', 'reanudacion', 'paso_completado', 'fin'
     Al finalizar se calculan totales: duracionTotalMs, tiempoPausadoMs, tiempoActivoMs */
  const [events, setEvents] = useState(() => {
    /* Si ya había checkpoint con events, los restauramos en el load. Aquí inicio vacío. */
    return [{ tipo: 'inicio', ts: new Date().toISOString(), paso: 0 }];
  });
  /* Marca de cuándo arrancó la pausa actual (null = no pausado) */
  const pauseStartRef = useRef(null);

  const tickRef = useRef(null);
  const ckRef = useRef(null);

  /* Carga pasos + restaura checkpoint si existe */
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await api.getProduccionSteps(productoNombre, item.cantidad || 1, 19);
        if (cancel) return;
        if (!r?.ok || !Array.isArray(r.steps) || r.steps.length === 0) {
          setError(`No se pudieron generar los pasos para "${productoNombre}".`);
          setLoading(false);
          return;
        }
        setSteps(r.steps);

        /* Intentar restaurar checkpoint */
        try {
          const ck = await api.getProduccionCheckpoint(item.id);
          if (ck?.checkpoint?.state && !cancel) {
            const st = ck.checkpoint.state;
            if (typeof st.curStep === 'number') setCurStep(Math.max(0, Math.min(st.curStep, r.steps.length - 1)));
            if (typeof st.timerSec === 'number') setTimerSec(st.timerSec);
            if (st.dualPhase) setDualPhase(st.dualPhase);
            if (st.qcReadings && typeof st.qcReadings === 'object') setQcReadings(st.qcReadings);
            if (Array.isArray(st.ajustesMP)) setAjustesMP(st.ajustesMP);
            if (st.stepDone && typeof st.stepDone === 'object') setStepDone(st.stepDone);
          }
        } catch { /* sin checkpoint */ }
      } catch (e) {
        if (!cancel) setError(e.message || 'Error al cargar pasos');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [item.id, productoNombre, item.cantidad]);

  /* Auto-guardar checkpoint cada 15 segundos */
  useEffect(() => {
    if (loading || error) return;
    if (ckRef.current) clearInterval(ckRef.current);
    ckRef.current = setInterval(() => {
      api.saveProduccionCheckpoint(item.id, {
        nombre: productoNombre, curStep, timerSec, dualPhase, qcReadings, ajustesMP, stepDone,
      }, userName).then(() => setSavedAt(Date.now())).catch(() => {});
    }, 15000);
    return () => { if (ckRef.current) clearInterval(ckRef.current); };
  }, [item.id, productoNombre, curStep, timerSec, dualPhase, qcReadings, stepDone, loading, error, userName]);

  /* Timer regresivo */
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (running && timerSec > 0) {
      tickRef.current = setInterval(() => {
        setTimerSec(t => {
          if (t <= 1) {
            setRunning(false);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running]);

  /* Cuando timer llega a 0 en fase 'add' de dual → cambiar a 'disp' automáticamente */
  useEffect(() => {
    if (timerSec !== 0 || running) return;
    const step = steps[curStep];
    if (!step) return;
    if (step.type === 'dual' && dualPhase === 'add') {
      setDualPhase('disp');
      setTimerSec(step.tiempoDisp || 0);
    }
  }, [timerSec, running, steps, curStep, dualPhase]);

  const step = steps[curStep];
  const total = steps.length;
  const stepColor = step ? (TYPE_COLOR[step.type] || TYPE_COLOR.prep) : TYPE_COLOR.prep;

  /* Helper: agrega un evento al timeline */
  const logEvent = useCallback((tipo, extra = {}) => {
    setEvents(prev => [...prev, {
      tipo,
      ts: new Date().toISOString(),
      paso: curStep,
      ...extra,
    }]);
  }, [curStep]);

  const handleStart = useCallback(() => {
    if (!step) return;
    /* Si veníamos de pausa, cierra la pausa con timestamp + duración */
    if (pauseStartRef.current) {
      const inicioPausa = pauseStartRef.current;
      const finPausa = new Date();
      const duracionMs = finPausa.getTime() - new Date(inicioPausa).getTime();
      setEvents(prev => [...prev, {
        tipo: 'reanudacion',
        ts: finPausa.toISOString(),
        paso: curStep,
        pausaInicio: inicioPausa,
        pausaDuracionMs: duracionMs,
      }]);
      pauseStartRef.current = null;
    } else {
      logEvent('inicio_paso', { tipoStep: step.type });
    }
    if (step.type === 'dual') {
      setDualPhase('add');
      setTimerSec(step.tiempo || 0);
    } else {
      setTimerSec(step.tiempo || 0);
    }
    /* marca visual para el timerbox (Iniciar vs Reanudar / Tiempo cumplido) */
    setStartedSteps(p => (p[curStep] ? p : { ...p, [curStep]: true }));
    setRunning(true);
  }, [step, curStep, logEvent]);

  const handlePause = useCallback(() => {
    setRunning(false);
    /* Marca el inicio de la pausa para calcular duración cuando reanude */
    pauseStartRef.current = new Date().toISOString();
    setEvents(prev => [...prev, {
      tipo: 'pausa',
      ts: pauseStartRef.current,
      paso: curStep,
      tiempoRestante: timerSec,
    }]);
  }, [curStep, timerSec]);

  const handleNext = useCallback(() => {
    setRunning(false);
    /* Si estaba pausado al avanzar, cierra la pausa */
    if (pauseStartRef.current) {
      const duracionMs = Date.now() - new Date(pauseStartRef.current).getTime();
      setEvents(prev => [...prev, {
        tipo: 'reanudacion',
        ts: new Date().toISOString(),
        paso: curStep,
        pausaInicio: pauseStartRef.current,
        pausaDuracionMs: duracionMs,
      }]);
      pauseStartRef.current = null;
    }
    logEvent('paso_completado');
    setStepDone(d => ({ ...d, [curStep]: true }));
    if (curStep < total - 1) {
      setCurStep(c => c + 1);
      setTimerSec(0);
      setDualPhase('add');
    }
  }, [curStep, total, logEvent]);

  const handlePrev = useCallback(() => {
    setRunning(false);
    if (pauseStartRef.current) {
      pauseStartRef.current = null;
    }
    logEvent('retroceso');
    setCurStep(c => Math.max(0, c - 1));
    setTimerSec(0);
    setDualPhase('add');
  }, [logEvent]);

  /* Click en un nodo done del riel → regresar a ESE paso (handoff §8.4).
     Misma semántica que "Anterior": corta el timer y deja rastro. */
  const handleJump = useCallback((i) => {
    setCurStep(c => {
      if (i >= c) return c; /* solo hacia atrás — adelante es con Completar */
      setRunning(false);
      if (pauseStartRef.current) pauseStartRef.current = null;
      logEvent('retroceso');
      setTimerSec(0);
      setDualPhase('add');
      return i;
    });
  }, [logEvent]);

  /* QC validation: todos los campos obligatorios deben estar dentro de rango */
  const qcEnRango = useMemo(() => {
    if (!step || step.type !== 'qc') return true;
    const readings = qcReadings[curStep] || {};
    return (step.pruebas || []).every(p => {
      const v = readings[p.id];
      if (v == null || v === '') return false;
      if (p.tipo === 'select') return (p.aprobados || []).includes(v);
      const num = parseFloat(v);
      if (isNaN(num)) return false;
      if (p.min != null && num < p.min) return false;
      if (p.max != null && num > p.max) return false;
      return true;
    });
  }, [step, qcReadings, curStep]);

  /* Finalizar producción: descuenta MP, suma PT, crea lote, actualiza pedido/orden */
  const handleFinalize = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      /* 1. Calcular descuentos desde la fórmula original */
      const formulasRes = await api.getFormulas();
      const formulasMap = formulasRes?.formulas || formulasRes?.data?.formulas || formulasRes || {};
      const formula = formulasMap[productoNombre];
      if (!formula?.ingredientes) throw new Error(`Fórmula "${productoNombre}" no encontrada`);
      const lotes = item.cantidad || 1;
      const descuentos = formula.ingredientes.map(ing => ({
        mp: ing.nombre,
        cantidad: +((ing.kg19 || 0) * lotes).toFixed(3),
      }));

      /* FIX D-C3/R5: SUMAR ajustes MP registrados en el wizard a los descuentos.
         Si Enrique agregó 2 kg de espesante post-molienda, deben descontarse.
         Si la MP ya está en `descuentos`, sumamos al existente. Si es nueva,
         agregamos una entrada. Si kgAdicional<=0 o mp vacío, ignorar. */
      const ajustesLimpios = (ajustesMP || [])
        .map(a => ({
          mp: String(a.mp || '').trim(),
          kg: Number(a.kgAdicional) || 0,
          motivo: String(a.motivo || '').trim(),
        }))
        .filter(a => a.mp && a.kg > 0);
      ajustesLimpios.forEach(aj => {
        const idx = descuentos.findIndex(d => d.mp === aj.mp);
        if (idx >= 0) {
          descuentos[idx].cantidad = +(descuentos[idx].cantidad + aj.kg).toFixed(3);
        } else {
          descuentos.push({ mp: aj.mp, cantidad: aj.kg, _ajuste: true });
        }
      });

      await api.registrarProduccion({
        descuentos, producto: productoNombre, lotes,
        ajustesMP: ajustesLimpios, /* enviar para que server lo persista en el historial */
        esPrueba: item.esPrueba || false,
        ordenId: tipo === 'orden' ? item.id : '',
        pedidoId: tipo === 'pedido' ? item.id : (item.pedidoId || ''),
        usuario: userName,
      });

      const ahora = new Date().toISOString();

      /* 2. Cambiar estado de la fuente a 'producido'.
         FIX FLUJO LINEAL: NO marcamos qcResultados.aprobado=true automáticamente.
         Las lecturas técnicas (qcReadings) son del wizard de producción y son
         valores tomados DURANTE el proceso, NO la aprobación formal de QC.
         La aprobación formal la hace un humano explícitamente desde
         ProduccionPage → Calidad o desde la card del pedido, ejecutando
         api.transicionLote(loteId, 'aprobarQC'). Sin ese paso, el lote queda
         en 'producido' y NO se puede envasar (gate en /api/envasado/registrar). */
      if (tipo === 'orden') {
        await api.upsertOrden({
          ...item._raw,
          estado: 'producido',
          fechaFinProduccion: ahora,
          qcReadings, /* lecturas técnicas tomadas durante producción */
          historial: [
            ...(item._raw?.historial || []),
            { estado:'producido', fecha:ahora, usuario:userName,
              nota:`Producción completada (${lotes} cubetas) — pendiente de QC` },
          ],
        });
      } else {
        await api.upsertPedido({
          ...item._raw,
          estado: 'producido',
          fechaFinProduccion: ahora,
          qcReadings,
          historial: [
            ...(item._raw?.historial || []),
            { estado:'producido', fecha:ahora, usuario:userName,
              nota:`Producción completada (${lotes} cubetas) — pendiente de QC` },
          ],
        });
      }

      /* === Calcular tiempos finales para reporte === */
      /* Cierra pausa abierta si la había */
      const eventsFinal = [...events];
      if (pauseStartRef.current) {
        const dur = Date.now() - new Date(pauseStartRef.current).getTime();
        eventsFinal.push({
          tipo: 'reanudacion', ts: ahora, paso: curStep,
          pausaInicio: pauseStartRef.current, pausaDuracionMs: dur,
        });
      }
      eventsFinal.push({ tipo: 'fin', ts: ahora, paso: total - 1 });
      /* Total: desde el primer evento de inicio hasta ahora */
      const tInicio = new Date(eventsFinal[0]?.ts || item.fechaInicioProduccion || ahora).getTime();
      const tFin    = new Date(ahora).getTime();
      const duracionTotalMs = tFin - tInicio;
      /* Suma de todas las pausas registradas */
      const tiempoPausadoMs = eventsFinal
        .filter(e => e.tipo === 'reanudacion' && e.pausaDuracionMs)
        .reduce((s, e) => s + e.pausaDuracionMs, 0);
      const tiempoActivoMs = Math.max(0, duracionTotalMs - tiempoPausadoMs);
      const numPausas = eventsFinal.filter(e => e.tipo === 'pausa').length;

      /* 3. Crear lote en trazabilidad.
         FIX C2 (auditoría 2026-06): el código del lote y la unicidad los asigna
         el SERVIDOR vía POST /api/trazabilidad/lote. Antes lo generaba el cliente
         con Math.random()*999 → ~3% colisión con 8 lotes/día.
         FIX HIGH litrosTotal: usar item.litPerUnit (no hardcoded 19) — sistema
         maneja cubetas/galones/litros con presentaciones distintas. */
      const litPerUnit = Number(item.litPerUnit) || Number(item._raw?.litPerUnit) || 19;
      const lotePayload = {
        ordenId: tipo === 'orden' ? item.id : '',
        ordenCodigo: tipo === 'orden' ? item.codigo : '',
        pedidoId: tipo === 'pedido' ? item.id : (item.pedidoId || ''),
        producto: productoNombre, nombre: productoNombre,
        cantidad: lotes,
        litPerUnit,
        litrosTotal: lotes * litPerUnit,
        estado: 'producido',
        esPrueba: item.esPrueba || false,
        fecha: ahora, usuario: userName,
        sublotes: [],
        qcReadings,
        ajustesMP: ajustesLimpios, /* persistencia para auditoría: qué MPs se agregaron post-molienda */
        /* Tiempos para reporte */
        duracionProduccionMs: duracionTotalMs,
        tiempoActivoMs,
        tiempoPausadoMs,
        numPausas,
        eventos: eventsFinal,
        fechaInicio: new Date(tInicio).toISOString(),
        fechaFin: ahora,
        historial: [{ estado:'producido', fecha:ahora, usuario:userName,
          nota:`Producción flujo paso-a-paso: ${lotes} ${litPerUnit === 19 ? 'cubetas' : 'unidades'} · activo ${Math.round(tiempoActivoMs/60000)}min · pausa ${Math.round(tiempoPausadoMs/60000)}min · ${numPausas} pausas` }],
      };
      const loteRes = await api.crearLote(lotePayload);
      if (!loteRes?.ok || !loteRes?.lote) {
        throw new Error(loteRes?.error || 'No se pudo crear lote en trazabilidad');
      }
      const loteCreado = loteRes.lote;

      /* FIX D-C4 (auditoría 2026-06): auto-aprobar QC si las lecturas del
         wizard están todas en rango.
         Antes el wizard salía con `estado='producido'` aunque Enrique hubiera
         completado todas las mediciones QC. Esto obligaba a ir al QCModal y
         re-ingresar los datos. Los lotes se quedaban en cola de QC sin que
         nadie lo notara → cuello de botella permanente.
         Ahora: si TODOS los steps de tipo 'qc' tienen sus lecturas dentro
         de rango, disparamos `aprobarQC` con las lecturas y el lote queda en
         `qc_aprobado` listo para envasar. Si alguna falla, queda en `qc_hold`. */
      let estadoFinal = 'producido';
      try {
        const qcSteps = (steps || []).filter(s => s && s.type === 'qc');
        if (qcSteps.length > 0) {
          /* Evaluar TODOS los steps QC del wizard contra qcReadings */
          let todosEnRango = true;
          const qcConsolidado = {};
          for (let i = 0; i < steps.length; i++) {
            const s = steps[i];
            if (!s || s.type !== 'qc') continue;
            const readings = qcReadings[i] || {};
            for (const p of (s.pruebas || [])) {
              const v = readings[p.id];
              qcConsolidado[p.id] = v;
              if (v == null || v === '') { todosEnRango = false; continue; }
              if (p.tipo === 'select') {
                if (!(p.aprobados || []).includes(v)) { todosEnRango = false; continue; }
              } else {
                const num = parseFloat(v);
                if (isNaN(num)) { todosEnRango = false; continue; }
                if (p.min != null && num < p.min) { todosEnRango = false; }
                if (p.max != null && num > p.max) { todosEnRango = false; }
              }
            }
          }
          const accion = todosEnRango ? 'aprobarQC' : 'rechazarQC';
          try {
            const trans = await api.transicionLote(loteCreado.id, accion, {
              qc: qcConsolidado,
              nota: todosEnRango
                ? 'Auto-aprobado al cerrar wizard de producción (todas las lecturas en rango)'
                : 'Auto-rechazado al cerrar wizard — alguna lectura fuera de rango',
            });
            if (trans?.ok) {
              estadoFinal = todosEnRango ? 'qc_aprobado' : 'qc_hold';
            }
          } catch (eTrans) {
            console.warn('[WIZARD] auto-aprobación QC falló (no es crítico, lote sigue en producido):', eTrans.message);
          }
        }
      } catch (eQc) {
        console.warn('[WIZARD] error evaluando auto-QC:', eQc.message);
      }

      /* 4. Limpiar checkpoint */
      try { await api.clearProduccionCheckpoint(item.id); } catch {}

      const sufijoMsg = estadoFinal === 'qc_aprobado'
        ? ' · QC aprobado automáticamente — listo para envasar'
        : estadoFinal === 'qc_hold'
          ? ' · QC en HOLD (lecturas fuera de rango) — revisa en Calidad'
          : '';
      /* Pantalla de éxito (mockup): ring + "¡Lote completado!" + folio mono.
         El onSuccess original (cerrar modal + reload + toast) se dispara con
         "Continuar" — toda la persistencia de arriba ya quedó hecha. */
      setSuccessInfo({
        codigo: loteCreado.codigoLote,
        cantidad: lotes,
        estadoFinal,
        msg: `Lote ${loteCreado.codigoLote} producido: ${productoNombre} x${lotes}${sufijoMsg}`,
      });
    } catch (e) {
      setError(e.message || 'Error al finalizar producción');
    } finally {
      setSaving(false);
    }
  }, [item, productoNombre, qcReadings, ajustesMP, total, tipo, userName, saving, events, curStep, steps]);

  if (loading) {
    return (
      <div style={S.wrap}>
        <div style={{ textAlign:'center', padding:60 }}>
          <div className="lp-spinner" style={{ margin:'0 auto' }} />
          <div style={{ marginTop:14, fontSize:13, color:'var(--lp-text-secondary)' }}>
            Cargando flujo de producción…
          </div>
        </div>
      </div>
    );
  }

  if (error && !steps.length) {
    return (
      <div style={{ ...S.wrap, padding: 16 }}>
        <div style={{ background:'var(--lp-danger-100)', color:'var(--lp-danger-700)', padding:16, borderRadius:10, fontSize:13 }}>
          <strong>Error:</strong> {error}
        </div>
        <div style={{ textAlign:'right', marginTop:14 }}>
          <button style={S.btn('ghost')} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    );
  }

  /* ── Pantalla de éxito (mockup .success): ring verde con palomita,
        "¡Lote completado!", folio mono en acento. ── */
  if (successInfo) {
    const okQC = successInfo.estadoFinal === 'qc_aprobado';
    const hold = successInfo.estadoFinal === 'qc_hold';
    return (
      <SecureView context="produccion" productoNombre={productoNombre}>
        <div style={{ ...S.wrap, padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        textAlign: 'center', gap: 16, padding: '48px 24px' }}>
            <div className="lp-ring" style={{
              width: 80, height: 80, borderRadius: '50%', background: 'var(--lp-brand-600)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'lpRingPop .45s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--lp-text-primary)' }}>¡Lote completado!</div>
            <div style={{ fontSize: 14, color: 'var(--lp-text-secondary)', marginTop: -8, lineHeight: 1.55, maxWidth: 420 }}>
              Lote <b style={{ fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-brand-600)' }}>{successInfo.codigo}</b>
              {' '}producido · {productoNombre} × {successInfo.cantidad}.
              {okQC && ' QC aprobado — listo para envasar. El equipo se la rifó.'}
              {hold && ' QC en HOLD: alguna lectura salió de rango — revísalo en Calidad.'}
              {!okQC && !hold && ' Pendiente de QC.'}
            </div>
            <button className="lp-btn-acc" style={{ ...S.footPrimary(false), flex: '0 0 auto', padding: '0 28px' }}
              onClick={() => onSuccess(successInfo.msg)}>
              Continuar
            </button>
          </div>
        </div>
      </SecureView>
    );
  }

  if (!step) return null;

  const isLast = curStep === total - 1;
  const isQC = step.type === 'qc';
  const isDual = step.type === 'dual';
  const isWait = step.type === 'wait';
  const isPrep = step.type === 'prep';
  const isAjustes = step.type === 'ajustes';

  const danger = timerSec > 0 && timerSec <= 30 && running;
  /* ── Derivados SOLO de presentación del timerbox (mockup) ──
     started=false en dual presenta la fase "add" aunque el efecto auto-switch
     ya haya precargado disp — handleStart resetea a add de todas formas, así
     que lo que se muestra es exactamente lo que va a pasar al presionar. */
  const started = !!startedSteps[curStep];
  const phaseShow = (isDual && !started) ? 'add' : dualPhase;
  const phaseTotalShow = isDual
    ? (phaseShow === 'add' ? (step.tiempo || 0) : (step.tiempoDisp || 0))
    : (step.tiempo || 0);
  const displaySec = (isDual && !started) ? (step.tiempo || 0) : (timerSec > 0 ? timerSec : phaseTotalShow);
  const timerDone = started && !running && timerSec === 0 && (isWait || (isDual && dualPhase === 'disp'));
  const catLabel = step.mpCat || CAT_FALLBACK[step.type] || step.type;

  return (
    <SecureView context="produccion" productoNombre={productoNombre}>
    <div style={S.wrap}>
      {/* HEADER */}
      <div style={S.header}>
        <div>
          <div style={{ ...S.title, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>{productoNombre}</span>
            {item.esPrueba && <PruebaBadge size="sm" />}
          </div>
          <div style={{ ...S.meta, display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* El "✓ guardado" del autosave ahora vive en la píldora del paso
                activo (CkPill), como en el mockup — no se duplica aquí. */}
            <span>{tipo === 'pedido' ? 'Pedido' : 'Orden'} {item.codigo} · {item.cantidad} cubetas</span>
          </div>
        </div>
        <button style={S.btn('ghost')} onClick={onClose}>Cerrar</button>
      </div>

      {/* Checkpoint A (handoff Claude Design): riel horizontal con icono por
          type, done=✓ relleno, current con halo+pulso, conectores que se
          llenan, auto-centrado y click en done para regresar (misma
          semántica que "Anterior": corta timer y loggea retroceso). La
          píldora muestra el paso activo + "✓ guardado" del autosave.
          El riel scrollea, así que ya no hace falta el fallback a barra
          para >10 pasos. */}
      {total > 0 && (
        <>
          <CkStripStepper
            steps={steps}
            curStep={curStep}
            typeColor={TYPE_COLOR}
            onJump={handleJump}
          />
          <CkPill step={step} curStep={curStep} total={total} typeColor={TYPE_COLOR} savedAt={savedAt} />
        </>
      )}

      {/* ERROR INLINE */}
      {error && (
        <div style={{ background:'var(--lp-danger-100)', color:'var(--lp-danger-700)', padding:10, borderRadius:8, fontSize:12, marginBottom:12 }}>
          {error}
        </div>
      )}

      {/* CARD PRINCIPAL — mockup .stepcard */}
      <div style={S.card}>
        {/* Badge categoría (pill tintado con color del type) + kg mono grande */}
        <div style={S.cardTop}>
          <span style={S.scat(stepColor)}>{catLabel}</span>
          {step.kg && <span style={S.skg}>{step.kg}</span>}
        </div>

        {/* Título 24px texto primario (mockup .stitle) */}
        <div style={S.stepTitle}>{step.titulo}</div>

        {/* Texto de acción (mockup .saction). En dual cambia con la fase. */}
        {isDual ? (
          <div style={S.saction}>
            <strong style={{ color: 'var(--lp-text-primary)' }}>{phaseShow === 'add' ? 'Agregar: ' : 'Dispersar: '}</strong>
            {phaseShow === 'add' ? step.accion : step.accionDisp}
          </div>
        ) : (!isPrep && !isQC && !isAjustes && (step.accion || step.desc)) ? (
          <div style={S.saction}>{step.accion || step.desc}</div>
        ) : null}

        {/* Alerta */}
        {step.alerta && (
          <div style={S.alerta}>
            <span style={{ display: 'inline-flex', flexShrink: 0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
            <span>{step.alerta}</span>
          </div>
        )}

        {/* PREP — lista de ingredientes */}
        {isPrep && step.grupos && (
          <div>
            <div style={{ ...S.saction, marginBottom: 14 }}>
              {step.desc}
            </div>
            {Object.entries(step.grupos).map(([cat, ings]) => ings.length > 0 && (
              <div key={cat} style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', color:'var(--lp-text-tertiary)', marginBottom:4 }}>
                  {cat} ({ings.length})
                </div>
                {ings.map((ing, i) => (
                  <div key={i} style={{ padding:'6px 10px', borderBottom:'1px solid var(--lp-border-subtle)', fontSize:12, display:'flex', justifyContent:'space-between' }}>
                    <span>{ing.nombre}</span>
                    <span style={{ fontFamily:'var(--lp-font-mono)', color:'var(--lp-text-secondary)' }}>{(ing.kg19 || 0).toFixed(2)} kg/cub</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* TIMERBOX (dual + wait) — mockup .timerbox: label uppercase, dígitos
            mono 52px tabulares, Iniciar/Pausar dentro de la caja. El flujo dual
            CONSERVA sus dos fases (add→disp automático): los chips de fase
            muestran en cuál vas; la lógica del timer no cambió. */}
        {(isDual || isWait) && (
          <div style={S.timerbox}>
            {isDual && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
                <span style={S.faseChip(phaseShow === 'add', 'var(--lp-success-700)')}>
                  {phaseShow === 'disp' && <CheckMini />} Agregar
                </span>
                <span style={S.faseChip(phaseShow === 'disp', 'var(--lp-brand-600)')}>Dispersar</span>
              </div>
            )}
            <div style={S.timerlbl}>
              {isWait ? 'Tiempo de reposo' : phaseShow === 'add' ? 'Tiempo sugerido' : 'Tiempo de dispersión'}
            </div>
            <div style={S.timer(timerDone ? 'done' : danger ? 'danger' : 'norm')}>
              {fmtTimer(displaySec)}
            </div>
            {timerDone ? (
              <span style={S.tdone}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                Tiempo cumplido
              </span>
            ) : running ? (
              <button style={S.tbtn('pause')} onClick={handlePause}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                Pausar
              </button>
            ) : (
              <button className="lp-btn-acc" style={S.tbtn('start')} onClick={handleStart}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg>
                {started && timerSec > 0 ? 'Reanudar' : 'Iniciar'}
              </button>
            )}
          </div>
        )}

        {/* AJUSTES MP — registro de agregados post-molienda
            FIX D-C3/R5 (auditoría 2026-06). Sin esto el inventario MP se desfasa
            progresivamente porque el descuento usa el teórico de la fórmula, no
            lo que físicamente entró al batch. */}
        {isAjustes && (
          <>
            <div style={{ ...S.saction, marginBottom: 14 }}>
              {step.desc}
            </div>
            {ajustesMP.length === 0 && (
              <div style={{
                padding: 14, background: 'var(--lp-bg-base)', borderRadius: 8,
                fontSize: 12, color: 'var(--lp-text-tertiary)', textAlign: 'center',
                marginBottom: 12,
              }}>
                Sin ajustes registrados. Si no hubo agregados durante producción, avanza al siguiente paso.
              </div>
            )}
            {ajustesMP.map((aj, idx) => (
              <div key={idx} style={{
                display: 'grid', gridTemplateColumns: '1fr 90px 1fr auto', gap: 6,
                alignItems: 'center', marginBottom: 8,
                padding: 8, background: 'var(--lp-bg-raised)', borderRadius: 8,
                border: '1px solid var(--lp-border-subtle)',
              }}>
                <input
                  type="text"
                  placeholder="Nombre MP"
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--lp-border-subtle)', fontSize: 13 }}
                  value={aj.mp || ''}
                  onChange={e => setAjustesMP(prev => prev.map((a,i) => i===idx ? {...a, mp: e.target.value} : a))}
                />
                <input
                  type="number" step="0.01" inputMode="decimal"
                  placeholder="kg"
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--lp-border-subtle)', fontSize: 13 }}
                  value={aj.kgAdicional ?? ''}
                  onChange={e => setAjustesMP(prev => prev.map((a,i) => i===idx ? {...a, kgAdicional: e.target.value} : a))}
                />
                <input
                  type="text"
                  placeholder="Motivo (viscosidad baja, color, etc.)"
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--lp-border-subtle)', fontSize: 13 }}
                  value={aj.motivo || ''}
                  onChange={e => setAjustesMP(prev => prev.map((a,i) => i===idx ? {...a, motivo: e.target.value} : a))}
                />
                <button
                  onClick={() => setAjustesMP(prev => prev.filter((_,i) => i !== idx))}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', cursor: 'pointer', fontSize: 16 }}
                  title="Quitar ajuste"
                ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            ))}
            <button
              onClick={() => setAjustesMP(prev => [...prev, { mp: '', kgAdicional: '', motivo: '' }])}
              style={{ ...S.btn('ghost'), marginBottom: 12 }}
            >+ Agregar ajuste</button>
            {ajustesMP.length > 0 && (
              <div style={{
                padding: 10, background: 'var(--lp-warning-100)',
                color: 'var(--lp-warning-700)', borderRadius: 8, fontSize: 11,
              }}>
                Total a descontar: <strong>{ajustesMP.reduce((s,a) => s + (Number(a.kgAdicional) || 0), 0).toFixed(2)} kg</strong>
                {' '}adicionales sobre el teórico de la fórmula.
              </div>
            )}
            <div style={S.accion}>{step.accion}</div>
          </>
        )}

        {/* QC — campos de prueba (mockup .qcgrid: 2 col, input mono, focus
            verde vía .lp-qci, rango como hint). El borde verde/rojo por
            validez se conserva — es señal operativa, el focus lo pisa. */}
        {isQC && (
          <>
            <div style={S.saction}>
              {step.desc}
            </div>
            <div style={S.qcGrid}>
              {(step.pruebas || []).map(p => {
                const val = (qcReadings[curStep] || {})[p.id] ?? '';
                const num = parseFloat(val);
                const inRange = p.tipo === 'select'
                  ? (p.aprobados || []).includes(val)
                  : (val !== '' && !isNaN(num) && (p.min == null || num >= p.min) && (p.max == null || num <= p.max));
                return (
                  <div key={p.id} style={S.qcField}>
                    <div style={S.qcLbl}>{p.lbl}{p.unidad ? ` (${p.unidad})` : ''}</div>
                    {p.tipo === 'select' ? (
                      <select
                        className="lp-qci"
                        style={{ ...S.qcInput, borderColor: val ? (inRange ? 'var(--lp-success-500)' : 'var(--lp-danger-500)') : 'var(--lp-border-subtle)' }}
                        value={val}
                        onChange={e => setQcReadings(r => ({ ...r, [curStep]: { ...(r[curStep] || {}), [p.id]: e.target.value } }))}
                      >
                        <option value="">— seleccionar —</option>
                        {(p.opciones || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        className="lp-qci"
                        type="number" step={p.step || 0.1} inputMode="decimal" placeholder={p.rango || ''}
                        style={{ ...S.qcInput, borderColor: val ? (inRange ? 'var(--lp-success-500)' : 'var(--lp-danger-500)') : 'var(--lp-border-subtle)' }}
                        value={val}
                        onChange={e => setQcReadings(r => ({ ...r, [curStep]: { ...(r[curStep] || {}), [p.id]: e.target.value } }))}
                      />
                    )}
                    {p.rango && <div style={S.qcRange}>Rango {p.rango}{p.equipo ? ` · ${p.equipo}` : ''}</div>}
                  </div>
                );
              })}
            </div>
            {!qcEnRango && (
              <div style={S.alerta}>
                <span style={{ display: 'inline-flex', flexShrink: 0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                <span>Completa todas las mediciones dentro de rango antes de avanzar.</span>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', lineHeight: 1.5 }}>{step.accion}</div>
          </>
        )}
      </div>

      {/* FOOTER DE NAVEGACIÓN — mockup .foot: Anterior ghost / Completar paso
          primary flex:1. Iniciar/Pausar viven en el timerbox (arriba).
          Último paso = "Terminar lote" (mockup type finish). */}
      <div style={S.foot}>
        <button style={S.footGhost(curStep === 0)} onClick={handlePrev} disabled={curStep === 0}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Anterior
        </button>

        {!isLast ? (
          <button
            className="lp-btn-acc"
            style={S.footPrimary(isQC && !qcEnRango)}
            onClick={handleNext}
            disabled={isQC && !qcEnRango}
          >
            Completar paso
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        ) : (
          <button
            className="lp-btn-acc"
            style={S.footPrimary(saving || (isQC && !qcEnRango))}
            onClick={handleFinalize}
            disabled={saving || (isQC && !qcEnRango)}
          >
            {saving ? 'Finalizando…' : 'Terminar lote'}
          </button>
        )}
      </div>
    </div>
    </SecureView>
  );
}
