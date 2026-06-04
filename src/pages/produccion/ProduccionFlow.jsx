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
  qc:    '#7C3AED',
};

const S = {
  wrap: { padding: 16, maxHeight: '90vh', overflowY: 'auto' },
  header: { marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  title: { fontSize: 18, fontWeight: 800, color: 'var(--lp-text-primary)' },
  meta: { fontSize: 12, color: 'var(--lp-text-secondary)' },
  prog: { background: 'var(--lp-bg-sunken)', borderRadius: 8, height: 8, overflow: 'hidden', marginBottom: 6 },
  progBar: (pct, color) => ({ height: '100%', width: pct + '%', background: color, borderRadius: 8, transition: 'width .4s' }),
  pasoLbl: { fontSize: 11, color: 'var(--lp-text-tertiary)', textAlign: 'right', marginBottom: 12 },

  card: { background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
          borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 12 },
  badgeCat: { background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)',
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              textTransform: 'uppercase', letterSpacing: '.05em', display: 'inline-block', marginRight: 8 },
  badgeKg: { fontSize: 13, fontWeight: 600, color: 'var(--lp-brand-500)' },
  stepTitle: (color) => ({ fontSize: 22, fontWeight: 800, color, marginTop: 8, marginBottom: 12, lineHeight: 1.2 }),
  alerta: { background: 'var(--lp-warning-100)', border: '1px solid var(--lp-warning-600)',
            borderRadius: 10, padding: '10px 13px', marginBottom: 12,
            display: 'flex', gap: 8, alignItems: 'flex-start',
            fontSize: 12, color: 'var(--lp-warning-700)', lineHeight: 1.4 },

  dualGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 },
  panel: (active, color) => ({
    border: '2px solid ' + (active ? color : 'var(--lp-border-subtle)'),
    background: active ? color + '0F' : 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius)', padding: 14, textAlign: 'center',
    transition: 'border-color .2s',
  }),
  panelLabel: (color, active) => ({
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
    color: active ? color : 'var(--lp-text-tertiary)', marginBottom: 6,
  }),
  bigTimer: (color, danger) => ({
    fontSize: 36, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
    color: danger ? 'var(--lp-danger-600)' : color, lineHeight: 1, fontFamily: 'var(--lp-font-mono)',
  }),

  bigTimerStandalone: (color, danger) => ({
    fontSize: 64, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
    color: danger ? 'var(--lp-danger-600)' : color, textAlign: 'center',
    margin: '20px 0', fontFamily: 'var(--lp-font-mono)',
  }),

  accion: { fontSize: 13, color: 'var(--lp-text-primary)', lineHeight: 1.5,
            padding: 12, background: 'var(--lp-bg-sunken)', borderRadius: 8, marginBottom: 12 },

  btnRow: { display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 16 },
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

  qcGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 12 },
  qcField: { padding: 12, background: 'var(--lp-bg-sunken)', borderRadius: 10, border: '1.5px solid var(--lp-border-subtle)' },
  qcLbl: { fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 },
  qcInput: { width: '100%', padding: '10px 12px', fontSize: 14, fontFamily: 'var(--lp-font-mono)',
             border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, boxSizing: 'border-box' },
  qcRange: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4 },
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
  const pct = total > 1 ? Math.round((curStep / (total - 1)) * 100) : 0;
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
      onSuccess(`✓ Lote ${loteCreado.codigoLote} producido: ${productoNombre} x${lotes}${sufijoMsg}`);
    } catch (e) {
      setError(e.message || 'Error al finalizar producción');
    } finally {
      setSaving(false);
    }
  }, [item, productoNombre, qcReadings, ajustesMP, total, tipo, userName, onSuccess, saving, events, curStep, steps]);

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
      <div style={S.wrap}>
        <div style={{ background:'var(--lp-danger-100)', color:'var(--lp-danger-700)', padding:16, borderRadius:10, fontSize:13 }}>
          <strong>Error:</strong> {error}
        </div>
        <div style={{ textAlign:'right', marginTop:14 }}>
          <button style={S.btn('ghost')} onClick={onClose}>Cerrar</button>
        </div>
      </div>
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

  return (
    <SecureView context="produccion" productoNombre={productoNombre}>
    <div style={S.wrap}>
      {/* HEADER */}
      <div style={S.header}>
        <div>
          <div style={S.title}>
            {productoNombre}
            {item.esPrueba && <span style={{ marginLeft:10, fontSize:11, color:'var(--lp-warning-600)', fontWeight:700 }}>🧪 PRUEBA</span>}
          </div>
          <div style={S.meta}>
            {tipo === 'pedido' ? 'Pedido' : 'Orden'} {item.codigo} · {item.cantidad} cubetas
            {savedAt && <span style={{ marginLeft:10, color:'var(--lp-success-600)' }}>✓ guardado</span>}
          </div>
        </div>
        <button style={S.btn('ghost')} onClick={onClose}>Cerrar</button>
      </div>

      {/* PROGRESS BAR */}
      <div style={S.prog}><div style={S.progBar(pct, stepColor)} /></div>
      <div style={S.pasoLbl}>Paso {curStep + 1} de {total}</div>

      {/* ERROR INLINE */}
      {error && (
        <div style={{ background:'var(--lp-danger-100)', color:'var(--lp-danger-700)', padding:10, borderRadius:8, fontSize:12, marginBottom:12 }}>
          {error}
        </div>
      )}

      {/* CARD PRINCIPAL */}
      <div style={S.card}>
        {/* Cat + kg */}
        {(step.mpCat || step.kg) && (
          <div style={{ marginBottom:8 }}>
            {step.mpCat && <span style={S.badgeCat}>{step.mpCat}</span>}
            {step.kg && <span style={S.badgeKg}>{step.kg}</span>}
          </div>
        )}

        {/* Título */}
        <div style={S.stepTitle(stepColor)}>{step.titulo}</div>

        {/* Alerta */}
        {step.alerta && (
          <div style={S.alerta}>
            <span style={{ fontSize:16 }}>⚠</span>
            <span>{step.alerta}</span>
          </div>
        )}

        {/* PREP — lista de ingredientes */}
        {isPrep && step.grupos && (
          <div>
            <div style={{ fontSize:13, color:'var(--lp-text-secondary)', marginBottom:14, lineHeight:1.5 }}>
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

        {/* DUAL — agregar + dispersar */}
        {isDual && (
          <>
            <div style={S.dualGrid}>
              <div style={S.panel(dualPhase === 'add', 'var(--lp-success-700)')}>
                <div style={S.panelLabel('var(--lp-success-700)', dualPhase === 'add')}>Agregar</div>
                {dualPhase === 'add' ? (
                  <div style={S.bigTimer('var(--lp-success-700)', danger)}>{fmtTimer(timerSec)}</div>
                ) : (
                  <div style={{ fontSize:36, color:'var(--lp-success-600)' }}>✓</div>
                )}
                <div style={{ fontSize:11, color:'var(--lp-text-tertiary)', marginTop:6 }}>{fmtTimer(step.tiempo || 0)}</div>
              </div>
              <div style={S.panel(dualPhase === 'disp', 'var(--lp-brand-600)')}>
                <div style={S.panelLabel('var(--lp-brand-600)', dualPhase === 'disp')}>Dispersar</div>
                <div style={S.bigTimer('var(--lp-brand-600)', danger && dualPhase === 'disp')}>
                  {fmtTimer(dualPhase === 'disp' ? timerSec : (step.tiempoDisp || 0))}
                </div>
                <div style={{ fontSize:11, color:'var(--lp-text-tertiary)', marginTop:6 }}>{fmtTimer(step.tiempoDisp || 0)}</div>
              </div>
            </div>
            <div style={S.accion}>
              <strong>{dualPhase === 'add' ? 'Agregar:' : 'Dispersar:'}</strong>{' '}
              {dualPhase === 'add' ? step.accion : step.accionDisp}
            </div>
          </>
        )}

        {/* WAIT — solo timer grande */}
        {isWait && (
          <>
            <div style={S.bigTimerStandalone(stepColor, danger)}>{fmtTimer(timerSec || step.tiempo || 0)}</div>
            <div style={S.accion}>{step.accion}</div>
          </>
        )}

        {/* AJUSTES MP — registro de agregados post-molienda
            FIX D-C3/R5 (auditoría 2026-06). Sin esto el inventario MP se desfasa
            progresivamente porque el descuento usa el teórico de la fórmula, no
            lo que físicamente entró al batch. */}
        {isAjustes && (
          <>
            <div style={{ fontSize:13, color:'var(--lp-text-secondary)', marginBottom:14, lineHeight:1.5 }}>
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
                >×</button>
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

        {/* QC — campos de prueba */}
        {isQC && (
          <>
            <div style={{ fontSize:13, color:'var(--lp-text-secondary)', marginBottom:14, lineHeight:1.5 }}>
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
                        style={{ ...S.qcInput, borderColor: val ? (inRange ? 'var(--lp-success-500)' : 'var(--lp-danger-500)') : 'var(--lp-border-subtle)' }}
                        value={val}
                        onChange={e => setQcReadings(r => ({ ...r, [curStep]: { ...(r[curStep] || {}), [p.id]: e.target.value } }))}
                      >
                        <option value="">— seleccionar —</option>
                        {(p.opciones || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type="number" step={p.step || 0.1}
                        style={{ ...S.qcInput, borderColor: val ? (inRange ? 'var(--lp-success-500)' : 'var(--lp-danger-500)') : 'var(--lp-border-subtle)' }}
                        value={val}
                        onChange={e => setQcReadings(r => ({ ...r, [curStep]: { ...(r[curStep] || {}), [p.id]: e.target.value } }))}
                      />
                    )}
                    {p.rango && <div style={S.qcRange}>Rango: {p.rango} · {p.equipo}</div>}
                  </div>
                );
              })}
            </div>
            {!qcEnRango && (
              <div style={S.alerta}>
                <span>⚠</span>
                <span>Completa todas las mediciones dentro de rango antes de avanzar.</span>
              </div>
            )}
            <div style={S.accion}>{step.accion}</div>
          </>
        )}
      </div>

      {/* BOTONES */}
      <div style={S.btnRow}>
        <div style={{ display:'flex', gap:8 }}>
          <button style={S.btn('ghost')} onClick={handlePrev} disabled={curStep === 0}>← Anterior</button>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {(isDual || isWait) && (
            running
              ? <button style={S.btn('warn')} onClick={handlePause}>⏸ Pausar</button>
              : <button style={S.btn('success')} onClick={handleStart}>▶ {timerSec === 0 ? 'Iniciar timer' : 'Reanudar'}</button>
          )}

          {!isLast && (
            <button
              style={S.btn('primary')}
              onClick={handleNext}
              disabled={isQC && !qcEnRango}
            >
              Siguiente →
            </button>
          )}

          {isLast && (
            <button
              style={S.btn('success')}
              onClick={handleFinalize}
              disabled={saving || (isQC && !qcEnRango)}
            >
              {saving ? 'Finalizando...' : 'Finalizar produccion'}
            </button>
          )}
        </div>
      </div>
    </div>
    </SecureView>
  );
}
