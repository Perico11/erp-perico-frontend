import { useEffect, useMemo, useState } from 'react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import api from '../../services/api';

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(26,24,21,.5)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    overflow: 'auto',
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)',
    maxWidth: 880, width: '100%', maxHeight: 'calc(var(--pp-vvh, 94vh) - 32px)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    padding: '14px 18px', borderBottom: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 14, fontWeight: 700 },
  close: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--lp-text-tertiary)', padding: 4, lineHeight: 1 },
  body: { padding: 18, overflowY: 'auto', flex: 1 },
  selectorRow: {
    display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 10,
    alignItems: 'center', marginBottom: 16,
  },
  select: {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 13, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    boxSizing: 'border-box',
  },
  vs: {
    textAlign: 'center', fontSize: 13, fontWeight: 700,
    color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.1em',
  },
  comparisonGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
  },
  card: (highlight) => ({
    background: highlight ? 'var(--lp-success-50)' : 'var(--lp-bg-sunken)',
    border: '1.5px solid ' + (highlight ? 'var(--lp-success-500)' : 'var(--lp-border-subtle)'),
    borderRadius: 'var(--lp-radius-sm)', padding: 14,
  }),
  cardName: { fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--lp-text-primary)', textTransform: 'uppercase', letterSpacing: '.06em' },
  /* Grid de 3 columnas (etiqueta · valor A · valor B) para que los encabezados
     de columna queden EXACTAMENTE encima de sus números. Con el flex anterior
     no había forma de rotularlos y las dos cifras de cada renglón no decían a
     qué fórmula pertenecían. */
  metricRow: {
    display: 'grid', gridTemplateColumns: '1fr 76px 76px', gap: 8, alignItems: 'baseline',
    padding: '4px 0', fontSize: 12,
    borderBottom: '0.5px solid var(--lp-border-subtle)',
  },
  colHead: {
    display: 'grid', gridTemplateColumns: '1fr 76px 76px', gap: 8,
    fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
    color: 'var(--lp-text-tertiary)', paddingBottom: 4, marginBottom: 4,
    borderBottom: '1px solid var(--lp-border-subtle)',
  },
  colHeadVal: { textAlign: 'right' },
  leyenda: {
    display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
    fontSize: 11.5, color: 'var(--lp-text-secondary)', marginBottom: 10,
  },
  leyendaPill: (esA) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontWeight: 600, color: esA ? 'var(--lp-text-primary)' : 'var(--lp-text-secondary)',
  }),
  leyendaTag: (esA) => ({
    display: 'inline-flex', width: 18, height: 18, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 700,
    background: esA ? 'var(--lp-brand-50)' : 'var(--lp-bg-sunken)',
    color: esA ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
    border: '1px solid ' + (esA ? 'var(--lp-brand-100)' : 'var(--lp-border-subtle)'),
  }),
  aviso: {
    fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 10, lineHeight: 1.5,
  },
  metricLabel: { color: 'var(--lp-text-tertiary)', fontWeight: 500 },
  metricVal: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-text-primary)', textAlign: 'right' },
  diffMejor: { color: 'var(--lp-success-700)' },
  diffPeor: { color: 'var(--lp-danger-700)' },
  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
  },
  ingTable: {
    width: '100%', borderCollapse: 'collapse', fontSize: 11,
  },
  ingTh: {
    textAlign: 'left', padding: '6px 8px', fontWeight: 700,
    color: 'var(--lp-text-secondary)', fontSize: 11, textTransform: 'uppercase',
    background: 'var(--lp-bg-sunken)',
  },
  ingTd: {
    padding: '6px 8px', borderBottom: '0.5px solid var(--lp-border-subtle)',
    fontFamily: 'var(--lp-font-mono)',
  },
  diffBadge: (tipo) => ({
    display: 'inline-flex', padding: '1px 6px', fontSize: 11, fontWeight: 700,
    borderRadius: 3,
    background: tipo === 'soloA' ? 'var(--lp-info-50)' : tipo === 'soloB' ? 'var(--lp-warning-50)' : 'var(--lp-bg-sunken)',
    color: tipo === 'soloA' ? 'var(--lp-info-600)' : tipo === 'soloB' ? 'var(--lp-warning-700)' : 'var(--lp-text-tertiary)',
  }),
};

const fmt$ = (n) => n != null ? '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const fmt = (n) => n != null && !isNaN(n) ? Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 }) : '—';

function diffArrow(a, b, mejorMenor = true) {
  if (a == null || b == null) return null;
  if (a === b) return null;
  const aMejor = mejorMenor ? a < b : a > b;
  return aMejor ? 'a' : 'b';
}

function MetricRow({ label, valA, valB, fmtFn = fmt, mejorMenor = true }) {
  const winner = diffArrow(valA, valB, mejorMenor);
  return (
    <div style={S.metricRow}>
      <span style={S.metricLabel}>{label}</span>
      <span style={{ ...S.metricVal, ...(winner === 'a' ? S.diffMejor : winner === 'b' ? S.diffPeor : {}) }}>
        {fmtFn(valA)}
      </span>
      <span style={{ ...S.metricVal, ...(winner === 'b' ? S.diffMejor : winner === 'a' ? S.diffPeor : {}) }}>
        {fmtFn(valB)}
      </span>
    </div>
  );
}

/* ── De dónde sale cada dato (25-ago-2026) ────────────────────────────────────
   Antes TODAS las métricas salían "–" y parecía que el comparador estaba roto.
   No lo estaba: pedía los datos donde no viven.

   · ECONÓMICOS (costo MP, costo total, precio, margen, producción/mes): NO
     viajan en /api/formulas/todas — ese endpoint dice en su propio comentario
     "NO incluye datos de costo". Se piden a /api/reports/margenes, que ya los
     calcula por fórmula con los costos auxiliares CONFIGURABLES (envase, tapa,
     mano de obra, merma de costos_pt_config). Se consume esa fuente en vez de
     recalcular aquí para que el comparador no invente un margen distinto al
     del resto del sistema.
   · TÉCNICOS (PVC, densidad, viscosidad, sólidos, finish): en formulas_custom
     viven ANIDADOS bajo `tecnico`, y el modal los leía al nivel superior — por
     eso salían vacíos incluso cuando estaban capturados. Se leen de los dos
     sitios (`tecnico.x` y, por compatibilidad con formulas_v2, `x`).
   ──────────────────────────────────────────────────────────────────────────── */
const CAMPOS_TEC = ['pvc', 'densidad', 'solidosPeso', 'solidosVolumen', 'finish'];
/* Nombre del campo en summary[] — lo escribe
   scripts/propagar_propiedades_correctas.js con el motor de cálculo validado. */
const EN_SUMMARY = {
  pvc: 'pvc',
  densidad: 'densidad',
  solidosPeso: 'nv_peso',        /* no-volátiles en peso */
  solidosVolumen: 'nv_vol',      /* no-volátiles en volumen */
  finish: 'acabado_texto',
};
/* Orden de búsqueda: summary (fuente real del ERP) → tecnico.x → x plano
   (compat con formulas_v2, que sí los guarda al nivel superior). */
function tec(f, campo, sum) {
  const enSum = sum ? sum[EN_SUMMARY[campo]] : null;
  const anidado = f && f.tecnico ? f.tecnico[campo] : null;
  const plano = f ? f[campo] : null;
  const primero = [enSum, anidado, plano].find(v => v != null && v !== '');
  if (primero == null) return null;
  if (campo === 'finish') return String(primero);
  const n = Number(primero);
  return Number.isFinite(n) ? +n.toFixed(2) : null;
}

export default function CompararFormulasModal({ formulas, summary, onClose }) {
  /* formulas: array de objetos formula con { nombre, ingredientes, tecnico?, ... } */
  const lista = formulas || [];
  const [selAName, setSelAName] = useState(lista[0]?.nombre || '');
  const [selBName, setSelBName] = useState(lista[1]?.nombre || '');
  const fmA = lista.find(f => f.nombre === selAName) || lista[0];
  const fmB = lista.find(f => f.nombre === selBName) || lista[1];

  /* Económicos por fórmula — una sola carga al abrir el comparador. */
  const [eco, setEco] = useState(null);      /* { [nombre]: producto } */
  const [ecoErr, setEcoErr] = useState('');
  useEffect(() => {
    let vivo = true;
    api.getMargenes()
      .then(r => {
        if (!vivo) return;
        const idx = {};
        (r?.productos || []).forEach(p => { if (p && p.nombre) idx[p.nombre] = p; });
        setEco(idx);
      })
      .catch(e => { if (vivo) { setEco({}); setEcoErr(e?.message || 'no se pudieron cargar'); } });
    return () => { vivo = false; };
  }, []);
  const ecoDe = (f) => (f && eco ? eco[f.nombre] : null) || null;
  const ecoA = ecoDe(fmA);
  const ecoB = ecoDe(fmB);

  /* Propiedades físico-químicas: summary[] indexado por nombre de fórmula. */
  const sumIdx = useMemo(() => {
    const idx = {};
    (summary || []).forEach(x => { if (x && x.nombre) idx[x.nombre] = x; });
    return idx;
  }, [summary]);
  const sumA = fmA ? sumIdx[fmA.nombre] : null;
  const sumB = fmB ? sumIdx[fmB.nombre] : null;

  /* Comparación de ingredientes */
  const ingDiff = useMemo(() => {
    if (!fmA || !fmB) return [];
    const ingsA = (fmA.ingredientes || []).reduce((acc, i) => { acc[i.nombre || i.mp] = i; return acc; }, {});
    const ingsB = (fmB.ingredientes || []).reduce((acc, i) => { acc[i.nombre || i.mp] = i; return acc; }, {});
    const todos = new Set([...Object.keys(ingsA), ...Object.keys(ingsB)]);
    return Array.from(todos).map(mp => ({
      mp,
      kgA: ingsA[mp]?.kg19 != null ? Number(ingsA[mp].kg19) : null,
      kgB: ingsB[mp]?.kg19 != null ? Number(ingsB[mp].kg19) : null,
      tipo: !ingsA[mp] ? 'soloB' : !ingsB[mp] ? 'soloA' : 'comun',
    })).sort((a, b) => {
      const orden = { comun: 0, soloA: 1, soloB: 2 };
      if (orden[a.tipo] !== orden[b.tipo]) return orden[a.tipo] - orden[b.tipo];
      return (a.mp || '').localeCompare(b.mp || '');
    });
  }, [fmA, fmB]);

  /* MÓVIL: bloquea scroll del fondo + publica --pp-vvh (alto visible real, sigue
     al teclado) que S.modal usa en su maxHeight para que S.body siempre tenga
     overflow interno scrolleable. El componente sólo se monta cuando está abierto. */
  useBodyScrollLock(true);

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.header}>
          <div style={S.title}>Comparar fórmulas</div>
          <button style={S.close} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.body}>
          <div style={S.selectorRow}>
            <select style={S.select} value={selAName} onChange={(e) => setSelAName(e.target.value)}>
              {lista.map(f => <option key={f.nombre} value={f.nombre}>{f.nombre}</option>)}
            </select>
            <div style={S.vs}>vs</div>
            <select style={S.select} value={selBName} onChange={(e) => setSelBName(e.target.value)}>
              {lista.map(f => <option key={f.nombre} value={f.nombre}>{f.nombre}</option>)}
            </select>
          </div>

          {fmA && fmB && (
            <>
              {/* Leyenda: las tarjetas agrupan MÉTRICAS, no fórmulas — cada
                  renglón trae los dos valores. Antes las tarjetas se titulaban
                  con el nombre de cada fórmula y parecía que a la izquierda le
                  faltaban los datos técnicos, cuando estaban del otro lado. */}
              <div style={S.leyenda}>
                <span style={S.leyendaPill(true)}>
                  <span style={S.leyendaTag(true)}>A</span>{fmA.nombre}
                </span>
                <span style={S.leyendaPill(false)}>
                  <span style={S.leyendaTag(false)}>B</span>{fmB.nombre}
                </span>
              </div>

              <div style={S.comparisonGrid}>
                <div style={S.card(false)}>
                  <div style={S.cardName}>Económicos <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--lp-text-tertiary)' }}>· por cubeta</span></div>
                  <div style={S.colHead}>
                    <span />
                    <span style={S.colHeadVal}>A</span>
                    <span style={S.colHeadVal}>B</span>
                  </div>
                  <MetricRow label="Costo MP" valA={ecoA?.costoMP} valB={ecoB?.costoMP} fmtFn={fmt$} mejorMenor />
                  <MetricRow label="Costo total" valA={ecoA?.costoTotal} valB={ecoB?.costoTotal} fmtFn={fmt$} mejorMenor />
                  <MetricRow label="Precio venta" valA={ecoA?.precioVenta || null} valB={ecoB?.precioVenta || null} fmtFn={fmt$} mejorMenor={false} />
                  <MetricRow label="Margen %" valA={ecoA?.margenPct} valB={ecoB?.margenPct} fmtFn={(n) => n != null ? n + '%' : '—'} mejorMenor={false} />
                  <MetricRow label="Producción/mes" valA={ecoA?.prodMensual} valB={ecoB?.prodMensual} mejorMenor={false} />
                  <MetricRow label="# Ingredientes" valA={(fmA.ingredientes || []).length} valB={(fmB.ingredientes || []).length} />
                </div>
                <div style={S.card(false)}>
                  <div style={S.cardName}>Técnicos</div>
                  <div style={S.colHead}>
                    <span />
                    <span style={S.colHeadVal}>A</span>
                    <span style={S.colHeadVal}>B</span>
                  </div>
                  {/* "Viscosidad KU" se retiró: no existe en summary ni en el
                      recetario ni en el Sheet — era un renglón condenado a "–".
                      Cuando se capture, vuelve con una línea. */}
                  <MetricRow label="PVC %" valA={tec(fmA, 'pvc', sumA)} valB={tec(fmB, 'pvc', sumB)} mejorMenor />
                  <MetricRow label="Densidad" valA={tec(fmA, 'densidad', sumA)} valB={tec(fmB, 'densidad', sumB)} />
                  <MetricRow label="Sólidos w/w" valA={tec(fmA, 'solidosPeso', sumA)} valB={tec(fmB, 'solidosPeso', sumB)} mejorMenor={false} />
                  <MetricRow label="Sólidos v/v" valA={tec(fmA, 'solidosVolumen', sumA)} valB={tec(fmB, 'solidosVolumen', sumB)} mejorMenor={false} />
                  <MetricRow label="Acabado" valA={tec(fmA, 'finish', sumA)} valB={tec(fmB, 'finish', sumB)} fmtFn={(x) => x || '—'} />
                  <MetricRow label="Rendimiento m²/L" valA={sumA?.rendimiento_m2_L != null ? +Number(sumA.rendimiento_m2_L).toFixed(2) : null} valB={sumB?.rendimiento_m2_L != null ? +Number(sumB.rendimiento_m2_L).toFixed(2) : null} mejorMenor={false} />
                </div>
              </div>

              {/* Un guion no dice si el dato falta o si falló la carga. */}
              {eco === null && !ecoErr && (
                <div style={S.aviso}>Cargando costos y precios…</div>
              )}
              {ecoErr && (
                <div style={S.aviso}>
                  No se pudieron cargar los costos y precios ({ecoErr}). Los datos técnicos y
                  los ingredientes sí son correctos.
                </div>
              )}
              {eco && !ecoErr && (!ecoA?.precioVenta || !ecoB?.precioVenta) && (
                <div style={S.aviso}>
                  Sin precio de venta capturado en {!ecoA?.precioVenta && !ecoB?.precioVenta ? 'ninguna de las dos fórmulas' : (!ecoA?.precioVenta ? fmA.nombre : fmB.nombre)} —
                  por eso el margen sale vacío. Se captura en Precios de venta.
                </div>
              )}
              {eco && !ecoErr && CAMPOS_TEC.every(c => tec(fmA, c, sumA) == null && tec(fmB, c, sumB) == null) && (
                <div style={S.aviso}>
                  Ninguna de las dos fórmulas tiene propiedades calculadas (PVC, densidad,
                  sólidos, acabado). Se generan al recalcular las fórmulas en el ERP.
                </div>
              )}

              <div style={S.section}>
                <div style={S.sectionTitle}>
                  Ingredientes comparados ({ingDiff.length} totales · {ingDiff.filter(d => d.tipo === 'comun').length} comunes · {ingDiff.filter(d => d.tipo !== 'comun').length} diferentes)
                </div>
                <table style={S.ingTable}>
                  <thead>
                    <tr>
                      <th style={S.ingTh}>Materia Prima</th>
                      <th style={{ ...S.ingTh, textAlign: 'right' }}>kg/cub A</th>
                      <th style={{ ...S.ingTh, textAlign: 'right' }}>kg/cub B</th>
                      <th style={{ ...S.ingTh, textAlign: 'right' }}>Δ</th>
                      <th style={S.ingTh}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingDiff.map(d => {
                      const delta = d.kgA != null && d.kgB != null ? d.kgB - d.kgA : null;
                      return (
                        <tr key={d.mp}>
                          <td style={{ ...S.ingTd, fontFamily: 'var(--lp-font-sans)', fontWeight: 600 }}>
                            {d.mp}
                          </td>
                          <td style={{ ...S.ingTd, textAlign: 'right', color: d.kgA == null ? 'var(--lp-text-tertiary)' : 'var(--lp-text-primary)' }}>
                            {d.kgA != null ? d.kgA.toFixed(3) : '—'}
                          </td>
                          <td style={{ ...S.ingTd, textAlign: 'right', color: d.kgB == null ? 'var(--lp-text-tertiary)' : 'var(--lp-text-primary)' }}>
                            {d.kgB != null ? d.kgB.toFixed(3) : '—'}
                          </td>
                          <td style={{ ...S.ingTd, textAlign: 'right', color: delta == null ? 'var(--lp-text-tertiary)' : delta > 0 ? 'var(--lp-warning-700)' : delta < 0 ? 'var(--lp-success-700)' : 'var(--lp-text-tertiary)' }}>
                            {delta != null ? (delta > 0 ? '+' : '') + delta.toFixed(3) : '—'}
                          </td>
                          <td style={S.ingTd}>
                            <span style={S.diffBadge(d.tipo)}>
                              {d.tipo === 'soloA' ? 'solo A' : d.tipo === 'soloB' ? 'solo B' : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
