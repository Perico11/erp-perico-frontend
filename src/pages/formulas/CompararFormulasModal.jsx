import { useMemo, useState } from 'react';

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(26,24,21,.5)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    overflow: 'auto',
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)',
    maxWidth: 880, width: '100%', maxHeight: '94vh',
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
  cardName: { fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--lp-text-primary)' },
  metricRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '4px 0', fontSize: 12,
    borderBottom: '0.5px solid var(--lp-border-subtle)',
  },
  metricLabel: { color: 'var(--lp-text-tertiary)', fontWeight: 500 },
  metricVal: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-text-primary)' },
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
      <span style={{ display: 'flex', gap: 16 }}>
        <span style={{ ...S.metricVal, ...(winner === 'a' ? S.diffMejor : winner === 'b' ? S.diffPeor : {}) }}>
          {fmtFn(valA)}
        </span>
        <span style={{ ...S.metricVal, ...(winner === 'b' ? S.diffMejor : winner === 'a' ? S.diffPeor : {}), opacity: .6 }}>
          {fmtFn(valB)}
        </span>
      </span>
    </div>
  );
}

export default function CompararFormulasModal({ formulas, onClose }) {
  /* formulas: array de objetos formula con { nombre, ingredientes, costoCalculado?, pvc?, ... } */
  const lista = formulas || [];
  const [selAName, setSelAName] = useState(lista[0]?.nombre || '');
  const [selBName, setSelBName] = useState(lista[1]?.nombre || '');
  const fmA = lista.find(f => f.nombre === selAName) || lista[0];
  const fmB = lista.find(f => f.nombre === selBName) || lista[1];

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

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
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
              <div style={S.comparisonGrid}>
                <div style={S.card(false)}>
                  <div style={S.cardName}>{fmA.nombre}</div>
                  <MetricRow label="Costo MP" valA={fmA.costoMP} valB={fmB.costoMP} fmtFn={fmt$} mejorMenor />
                  <MetricRow label="Costo total" valA={fmA.costoTotal || fmA.costoCalculado} valB={fmB.costoTotal || fmB.costoCalculado} fmtFn={fmt$} mejorMenor />
                  <MetricRow label="Precio venta" valA={fmA.precioVenta} valB={fmB.precioVenta} fmtFn={fmt$} mejorMenor={false} />
                  <MetricRow label="Margen %" valA={fmA.margenPct} valB={fmB.margenPct} fmtFn={(n) => n != null ? n + '%' : '—'} mejorMenor={false} />
                  <MetricRow label="Producción/mes" valA={fmA.prodMensual} valB={fmB.prodMensual} mejorMenor={false} />
                  <MetricRow label="# Ingredientes" valA={(fmA.ingredientes || []).length} valB={(fmB.ingredientes || []).length} />
                </div>
                <div style={S.card(false)}>
                  <div style={S.cardName}>{fmB.nombre}</div>
                  <MetricRow label="PVC %" valA={fmA.pvc} valB={fmB.pvc} mejorMenor />
                  <MetricRow label="Densidad" valA={fmA.densidad} valB={fmB.densidad} />
                  <MetricRow label="Viscosidad KU" valA={fmA.viscosidad} valB={fmB.viscosidad} />
                  <MetricRow label="Sólidos w/w" valA={fmA.solidosPeso} valB={fmB.solidosPeso} mejorMenor={false} />
                  <MetricRow label="Sólidos v/v" valA={fmA.solidosVolumen} valB={fmB.solidosVolumen} mejorMenor={false} />
                  <MetricRow label="Finish" valA={fmA.finish} valB={fmB.finish} fmtFn={(s) => s || '—'} />
                </div>
              </div>

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
