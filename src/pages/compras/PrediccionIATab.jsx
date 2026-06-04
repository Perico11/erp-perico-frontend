import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import HelpHint from '../../components/HelpHint';
import SegmentedControl from '../../components/ui/SegmentedControl';

const S = {
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 200, padding: '10px 14px',
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 13, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    outline: 'none', boxSizing: 'border-box',
  },
  metric: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12, marginBottom: 16,
  },
  metricCard: (accent) => ({
    background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
    padding: 14, textAlign: 'center',
    borderTop: accent ? `3px solid ${accent}` : 'none',
  }),
  metricVal: { fontSize: 22, fontWeight: 800, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)' },
  metricLabel: { fontSize: 11, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4, fontWeight: 600 },
  card: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', padding: 14, marginBottom: 10,
  },
  cardCritica: {
    background: 'var(--lp-danger-50)',
    border: '1.5px solid var(--lp-danger-500)',
  },
  cardMedia: {
    background: 'var(--lp-warning-50)',
    border: '1.5px solid var(--lp-warning-500)',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: 12,
    marginBottom: 10, flexWrap: 'wrap',
  },
  badge: (bg, fg) => ({
    display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 700,
    borderRadius: 4, background: bg, color: fg,
    textTransform: 'uppercase', letterSpacing: '.04em',
  }),
  miniChart: {
    display: 'flex', alignItems: 'flex-end', gap: 2, height: 40,
    marginTop: 8, padding: '4px 0',
  },
  bar: (color, h) => ({
    flex: 1, background: color, height: `${h}%`, minHeight: 2,
    borderRadius: 1,
  }),
  forecastRow: {
    display: 'grid', gridTemplateColumns: '1fr auto auto auto',
    gap: 12, fontSize: 12, padding: '6px 0',
    borderBottom: '0.5px solid var(--lp-border-subtle)',
    alignItems: 'center',
  },
  loading: { textAlign: 'center', padding: '40px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
  err: {
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    padding: 10, borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 12,
  },
  hint: {
    fontSize: 11, color: 'var(--lp-text-tertiary)',
    padding: '10px 12px', background: 'var(--lp-info-50)',
    borderRadius: 'var(--lp-radius-sm)', lineHeight: 1.6, marginBottom: 12,
  },
};

const fmt = (n) => {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 });
};

function MiniChart({ historico, forecast }) {
  const all = [...(historico || []), ...(forecast || [])];
  if (all.length === 0) return null;
  const max = Math.max(...all, 1);
  const histLen = (historico || []).length;
  return (
    <div style={S.miniChart}>
      {(historico || []).map((v, i) => (
        <div key={'h' + i} style={S.bar('var(--lp-brand-400, var(--lp-brand-500))', (v / max) * 100)}
             title={`Histórico: ${fmt(v)}`} />
      ))}
      {(forecast || []).map((v, i) => (
        <div key={'f' + i} style={S.bar('var(--lp-warning-500)', (v / max) * 100)}
             title={`Predicción +${i + 1}: ${fmt(v)}`} />
      ))}
    </div>
  );
}

export default function PrediccionIATab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  /* Default 'todos' — con umbral dinámico 2σ las alertas son escasas (sano).
     Mostrar siempre algo útil al entrar, no pantalla vacía. */
  const [filter, setFilter] = useState('todos');
  const [horizonte, setHorizonte] = useState(3);

  const cargar = useCallback(() => {
    setLoading(true);
    api.getForecastAI(horizonte)
      .then(r => setData(r))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [horizonte]);

  useEffect(() => { cargar(); }, [cargar]);

  const items = useMemo(() => {
    if (!data?.predicciones) return [];
    const list = Object.entries(data.predicciones).map(([mp, p]) => ({ mp, ...p }));
    let arr = list;
    if (filter === 'alertas') arr = arr.filter(x => x.alerta);
    else if (filter === 'criticas') arr = arr.filter(x => x.alerta?.nivel === 'critica');
    else if (filter === 'aumento') arr = arr.filter(x => x.alerta?.tipo === 'aumento');
    else if (filter === 'reduccion') arr = arr.filter(x => x.alerta?.tipo === 'reduccion');
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(x => x.mp.toLowerCase().includes(q));
    }
    arr.sort((a, b) => (b.alerta?.pct || 0) - (a.alerta?.pct || 0));
    return arr;
  }, [data, filter, search]);

  if (loading) return <div style={S.loading}>Calculando predicción IA...</div>;
  if (err) return <div style={S.err}>{err}</div>;
  if (!data) return null;

  const k = data.resumen;

  return (
    <div>
      <HelpHint id="prediccion-ia-criterios" title="Cómo funciona Predicción IA — Holt + 2σ dinámico">
        <p style={{ margin: '0 0 6px' }}>
          Forecast por MP en 3 capas:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><strong>Holt's exponential smoothing</strong> — suaviza nivel + tendencia sobre los últimos 24 meses (override con <code>?ventana=N</code>). Grid search de α/β minimizando MSE.</li>
          <li><strong>Cap sanity ±100%</strong> — ninguna predicción puede ser &lt;0.5× ni &gt;2× el promedio histórico. Evita explosiones de Holt en series volátiles.</li>
          <li><strong>Umbral DINÁMICO de alerta por MP</strong> — cada MP usa su propio σ histórico: alerta cuando la predicción sale de <strong>2σ</strong> (~95% cobertura). Crítica al doble. Piso mínimo 15% para MPs casi constantes.</li>
        </ul>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
          Por qué pocas alertas: el umbral 2σ se ajusta a la volatilidad natural de cada MP (NATROSOL volátil = umbral 70%, AGUA estable = umbral 15%). Un mes "raro" debe estar realmente fuera de rango para alertar — alertas son acción real, no ruido.
        </p>
      </HelpHint>
      <div style={S.metric}>
        <div style={S.metricCard('var(--lp-brand-600)')}>
          <div style={S.metricVal}>{k.totalMPs}</div>
          <div style={S.metricLabel}>MPs analizadas</div>
        </div>
        <div style={S.metricCard('var(--lp-warning-600)')}>
          <div style={{ ...S.metricVal, color: 'var(--lp-warning-700)' }}>{k.alertas}</div>
          <div style={S.metricLabel}>Alertas</div>
        </div>
        <div style={S.metricCard('var(--lp-danger-600)')}>
          <div style={{ ...S.metricVal, color: 'var(--lp-danger-600)' }}>{k.criticas}</div>
          <div style={S.metricLabel}>Críticas</div>
        </div>
        <div style={S.metricCard('var(--lp-brand-600)')}>
          <div style={S.metricVal}>{horizonte}</div>
          <div style={S.metricLabel}>Meses adelante</div>
        </div>
      </div>

      <div style={S.hint}>
        <strong>Holt's exponential smoothing</strong> — predicción con tendencia, intervalo 95% confianza, cap ±100% sobre promedio. Alertas cuando la predicción se desvía más de <strong>2σ</strong> del promedio histórico de cada MP. {data.metodologia}
      </div>

      <div style={S.toolbar}>
        <input style={S.search} type="text" placeholder="Buscar MP..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'alertas', label: `Con alerta (${k.alertas})` },
            { value: 'criticas', label: `Críticas (${k.criticas})` },
            { value: 'aumento', label: 'Aumento' },
            { value: 'reduccion', label: 'Reducción' },
            { value: 'todos', label: 'Todos' },
          ]}
          color="brand"
        />
        <select
          style={{ ...S.search, maxWidth: 130, flex: 'none' }}
          value={horizonte}
          onChange={(e) => setHorizonte(parseInt(e.target.value))}
        >
          <option value={1}>1 mes</option>
          <option value={3}>3 meses</option>
          <option value={6}>6 meses</option>
        </select>
      </div>

      <div>
        {items.length === 0 ? (
          <div style={{ ...S.loading, padding: '40px 20px', lineHeight: 1.7 }}>
            {filter === 'alertas' || filter === 'criticas' ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lp-text-primary)', marginBottom: 6 }}>
                  Sin alertas activas
                </div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)' }}>
                  Todas las MPs están dentro de su umbral natural (2σ histórico). Cambia el filtro a <strong>Todos</strong> para ver las {data?.resumen?.totalMPs || k.totalMPs} MPs analizadas y sus proyecciones.
                </div>
                <button
                  onClick={() => setFilter('todos')}
                  style={{
                    marginTop: 12, padding: '8px 16px', borderRadius: 8,
                    background: 'var(--lp-brand-600)', color: '#fff', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Ver todas las MPs
                </button>
              </>
            ) : 'Sin resultados con esos filtros'}
          </div>
        ) : (
          items.map(item => {
            const cardStyle = item.alerta?.nivel === 'critica' ? S.cardCritica
              : item.alerta ? S.cardMedia : null;
            return (
              <div key={item.mp} style={{ ...S.card, ...(cardStyle || {}) }}>
                <div style={S.cardHeader}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{item.mp}</div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                      Promedio: {fmt(item.promedio)} kg/mes · RMSE ±{fmt(item.rmse)} kg
                      {item.tendencia !== 0 && (
                        <span style={{ marginLeft: 8, color: item.tendencia > 0 ? 'var(--lp-success-700)' : 'var(--lp-danger-700)' }}>
                          tendencia {item.tendencia > 0 ? '+' : ''}{item.tendencia.toFixed(1)} kg/mes
                        </span>
                      )}
                    </div>
                  </div>
                  {item.alerta && (
                    <span style={S.badge(
                      item.alerta.nivel === 'critica' ? 'var(--lp-danger-600)' : 'var(--lp-warning-600)',
                      '#fff'
                    )}>
                      {item.alerta.tipo} {item.alerta.pct}%
                    </span>
                  )}
                </div>

                <MiniChart historico={item.serieHistorica} forecast={item.forecast} />

                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--lp-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Predicción próximos {item.forecast.length} meses
                </div>
                <div style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12 }}>
                  {item.forecast.map((v, i) => (
                    <div key={i} style={S.forecastRow}>
                      <div style={{ color: 'var(--lp-text-secondary)' }}>+{i + 1} mes</div>
                      <div style={{ color: 'var(--lp-text-tertiary)', textAlign: 'right' }}>
                        {fmt(item.forecastLow[i])}
                      </div>
                      <div style={{ fontWeight: 700, textAlign: 'right' }}>
                        {fmt(v)} kg
                      </div>
                      <div style={{ color: 'var(--lp-text-tertiary)', textAlign: 'right' }}>
                        {fmt(item.forecastHigh[i])}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4, textAlign: 'right' }}>
                  Bajo · <strong>Predicción</strong> · Alto (intervalo 95%)
                </div>

                {item.alerta && (
                  <div style={{
                    marginTop: 10, padding: '8px 10px',
                    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius-sm)',
                    fontSize: 11, fontWeight: 600,
                    color: item.alerta.nivel === 'critica' ? 'var(--lp-danger-700)' : 'var(--lp-warning-700)',
                  }}>
                    {item.alerta.mensaje}
                  </div>
                )}

                {item.outliers && item.outliers.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                    {item.outliers.length} outlier(s) detectado(s) en histórico (Z ≥ 2.5)
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
