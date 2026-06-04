import { useState, useMemo, useRef, useEffect } from 'react';
import TopBar from '../../components/layout/TopBar';
import api from '../../services/api';
import { useApiData, useSearch } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import OCsTab from './OCsTab';
import PrediccionIATab from './PrediccionIATab';
import ForecastIATab from './ForecastIATab';
import PrediccionPedidosTab from './PrediccionPedidosTab';
import PosAliasesTab from './PosAliasesTab';
import SATPanel from '../admin/SATPanel';
import HelpHint from '../../components/HelpHint';
import SegmentedControl from '../../components/ui/SegmentedControl';
import PageTabs from '../../components/ui/PageTabs';

const S = {
  wrap: { padding: '0 20px 100px' },
  tabs: {
    display: 'flex', gap: 0, borderBottom: '2px solid var(--lp-border-subtle)',
    marginBottom: 16, overflowX: 'auto',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none',
  },
  tab: (active) => ({
    padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
    borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
    background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: 'var(--lp-font-sans)', marginBottom: -2, flexShrink: 0,
  }),
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap',
  },
  search: {
    flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: '#fff', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
  },
  table: {
    width: '100%', borderCollapse: 'separate', borderSpacing: 0,
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)', overflow: 'hidden',
  },
  th: {
    padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.04em', color: 'var(--lp-text-tertiary)',
    background: 'var(--lp-bg-sunken)', borderBottom: '1.5px solid var(--lp-border-subtle)',
    textAlign: 'left', whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 14px', fontSize: 12, borderBottom: '1px solid var(--lp-border-subtle)',
    color: 'var(--lp-text-primary)',
  },
  dot: (color) => ({
    width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
  }),
  badge: (bg, fg) => ({
    display: 'inline-flex', padding: '2px 8px', fontSize: 10, fontWeight: 600,
    borderRadius: 6, background: bg, color: fg,
  }),
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
  kpiValue: { fontSize: 22, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', marginTop: 4 },
  kpiSub: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 },
  card: {
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', padding: 16, marginBottom: 10,
  },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0', fontSize: 13 },
  spinner: { display: 'flex', justifyContent: 'center', padding: '60px 0' },
};

/* ── Months helper ── */
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function mesLabel(mesKey) {
  if (!mesKey) return '';
  const parts = mesKey.split('-');
  const m = parseInt(parts[1]) - 1;
  return (MESES_CORTO[m] || '??') + ' ' + parts[0].slice(2);
}

/* ══════════════════════════════════════════════════════════════════ */
/* BAR CHART — pure canvas, no dependencies                          */
/* ══════════════════════════════════════════════════════════════════ */
function BarChart({ historico, forecast, height = 220, onBarClick }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const allBars = useMemo(() => {
    const bars = [];
    const entries = Object.entries(historico || {}).sort(([a], [b]) => a.localeCompare(b));
    entries.forEach(([mes, val]) => bars.push({ mes, val, tipo: 'historico' }));
    (forecast || []).forEach(f => bars.push({ mes: f.mes, val: f.proyeccion_kg, tipo: 'forecast' }));
    return bars;
  }, [historico, forecast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || allBars.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const padL = 50, padR = 12, padT = 12, padB = 40;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const maxVal = Math.max(...allBars.map(b => b.val), 1);
    const barW = Math.max(4, Math.min(28, (chartW / allBars.length) - 4));
    const gap = (chartW - barW * allBars.length) / (allBars.length + 1);

    /* Grid lines */
    ctx.strokeStyle = '#e5e5e0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = '#999';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * (1 - i / 4)).toLocaleString(), padL - 6, y + 3);
    }

    /* Bars */
    allBars.forEach((bar, i) => {
      const x = padL + gap + i * (barW + gap);
      const bh = (bar.val / maxVal) * chartH;
      const y = padT + chartH - bh;

      if (bar.tipo === 'forecast') {
        ctx.fillStyle = '#AFA9EC';
        ctx.setLineDash([3, 2]);
        ctx.strokeStyle = '#534AB7';
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, barW, bh);
        ctx.strokeRect(x, y, barW, bh);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = '#534AB7';
        ctx.fillRect(x, y, barW, bh);
      }

      /* X label */
      if (allBars.length <= 18 || i % 2 === 0) {
        ctx.save();
        ctx.translate(x + barW / 2, h - padB + 12);
        ctx.rotate(-0.5);
        ctx.fillStyle = '#888';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(mesLabel(bar.mes), 0, 0);
        ctx.restore();
      }
    });

    /* Legend */
    const legY = padT + 2;
    ctx.fillStyle = '#534AB7';
    ctx.fillRect(w - padR - 160, legY, 10, 10);
    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Historico', w - padR - 146, legY + 9);

    ctx.fillStyle = '#AFA9EC';
    ctx.fillRect(w - padR - 82, legY, 10, 10);
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = '#534AB7';
    ctx.strokeRect(w - padR - 82, legY, 10, 10);
    ctx.setLineDash([]);
    ctx.fillStyle = '#666';
    ctx.fillText('Proyeccion', w - padR - 68, legY + 9);

    /* Click handler data */
    canvas._bars = allBars.map((bar, i) => ({
      x: padL + gap + i * (barW + gap),
      w: barW,
      ...bar,
    }));

  }, [allBars, height]);

  const handleClick = (e) => {
    if (!onBarClick || !canvasRef.current?._bars) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const bar = canvasRef.current._bars.find(b => x >= b.x && x <= b.x + b.w);
    if (bar) onBarClick(bar);
  };

  return (
    <div ref={containerRef} style={{ width: '100%', marginBottom: 16 }}>
      <canvas ref={canvasRef} style={{ display: 'block', cursor: 'pointer' }} onClick={handleClick} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* SEASONAL INDEX — horizontal mini bars                             */
/* ══════════════════════════════════════════════════════════════════ */
function SeasonalIndex({ indice }) {
  if (!indice || Object.keys(indice).length === 0) return null;
  const entries = Object.entries(indice).sort(([a], [b]) => a.localeCompare(b));
  const maxVal = Math.max(...entries.map(([, v]) => v), 1.3);

  return (
    <div style={S.card}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Indice estacional
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
        {entries.map(([mes, val]) => {
          const pct = (val / maxVal) * 100;
          const isHigh = val > 1.1;
          const isLow = val < 0.9;
          const color = isHigh ? 'var(--lp-success-600)' : isLow ? 'var(--lp-warning-600)' : 'var(--lp-brand-600)';
          const bgColor = isHigh ? 'var(--lp-success-100)' : isLow ? 'var(--lp-warning-100)' : 'var(--lp-brand-100)';
          return (
            <div key={mes} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lp-text-tertiary)', width: 28, flexShrink: 0 }}>
                {MESES_CORTO[parseInt(mes) - 1]}
              </span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--lp-bg-sunken)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: color, transition: 'width .3s' }} />
              </div>
              <span style={{ ...S.badge(bgColor, color), minWidth: 32, justifyContent: 'center' }}>
                {val.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 8 }}>
        {'> 1.0 = temporada alta, < 1.0 = temporada baja. Base: produccion historica real.'}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* ALERTS                                                             */
/* ══════════════════════════════════════════════════════════════════ */
function Alertas({ alertas }) {
  if (!alertas || alertas.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Alertas de consumo
      </div>
      {alertas.slice(-6).reverse().map((a, i) => {
        const isCrit = a.nivel === 'critical';
        const bg = isCrit ? 'var(--lp-danger-100)' : 'var(--lp-warning-100)';
        const fg = isCrit ? 'var(--lp-danger-600)' : 'var(--lp-warning-600)';
        const arrow = a.tipo === 'incremento' ? '+' : '';
        return (
          <div key={i} style={{ padding: '10px 14px', background: bg, borderRadius: 8, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...S.badge(isCrit ? 'var(--lp-danger-600)' : 'var(--lp-warning-600)', '#fff'), fontSize: 11 }}>
              {isCrit ? 'CRITICO' : 'AVISO'}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: fg, fontFamily: 'var(--lp-font-mono)' }}>
              {mesLabel(a.mes)}
            </span>
            <span style={{ fontSize: 12, color: fg, flex: 1 }}>{a.mensaje}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: fg, fontFamily: 'var(--lp-font-mono)' }}>
              {arrow}{a.variacion_pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* FORECAST POR MP — Top MPs con mayor consumo proyectado            */
/* ══════════════════════════════════════════════════════════════════ */
function ForecastMPTable({ forecastPorMP, consumoPorMP, inventario }) {
  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [sortBy, setSortBy] = useState('consumo');

  const items = useMemo(() => {
    if (!forecastPorMP) return [];
    let arr = Object.entries(forecastPorMP).map(([mp, data]) => {
      const stock = inventario?.[mp]?.qty ?? 0;
      const consumo = data.wma_mensual || 0;
      const mesesStock = consumo > 0 ? stock / consumo : 999;
      const deficit = consumo - stock;
      return { mp, consumo, stock, mesesStock, deficit, mesesDatos: data.meses_datos || 0 };
    });
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      arr = arr.filter(it => it.mp.toLowerCase().includes(q));
    }
    if (sortBy === 'consumo') arr.sort((a, b) => b.consumo - a.consumo);
    else if (sortBy === 'deficit') arr.sort((a, b) => b.deficit - a.deficit);
    else if (sortBy === 'meses') arr.sort((a, b) => a.mesesStock - b.mesesStock);
    return arr;
  }, [forecastPorMP, inventario, debouncedQuery, sortBy]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Proyeccion por materia prima
      </div>
      <div style={S.toolbar}>
        <input type="text" style={{ ...S.search, maxWidth: 260 }} placeholder="Buscar MP..."
          value={query} onChange={e => setQuery(e.target.value)} />
        <SegmentedControl
          value={sortBy}
          onChange={setSortBy}
          color="brand"
          options={[
            { value: 'consumo', label: 'Mayor consumo' },
            { value: 'deficit', label: 'Mayor déficit' },
            { value: 'meses',   label: 'Menos meses' },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <div style={S.empty}>Sin datos de MPs.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>MP</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Stock (kg)</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Consumo/mes</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Meses stock</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Deficit</th>
                <th style={S.th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 40).map(it => {
                const urgente = it.mesesStock < 1;
                const bajo = it.mesesStock < 2;
                const dotColor = urgente ? 'var(--lp-danger-600)' : bajo ? 'var(--lp-warning-600)' : 'var(--lp-success-600)';
                const statusBg = urgente ? 'var(--lp-danger-100)' : bajo ? 'var(--lp-warning-100)' : 'var(--lp-success-100)';
                const statusFg = urgente ? 'var(--lp-danger-600)' : bajo ? 'var(--lp-warning-600)' : 'var(--lp-success-600)';
                const statusTxt = urgente ? 'Urgente' : bajo ? 'Bajo' : 'OK';

                return (
                  <tr key={it.mp}>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={S.dot(dotColor)} />
                        <span>{it.mp}</span>
                      </div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>
                      {it.stock.toFixed(1)}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 600 }}>
                      {it.consumo.toFixed(1)}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: dotColor, fontWeight: 600 }}>
                      {it.mesesStock >= 99 ? '99+' : it.mesesStock.toFixed(1)}
                    </td>
                    <td style={{
                      ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700,
                      color: it.deficit > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)',
                    }}>
                      {it.deficit > 0 ? `-${it.deficit.toFixed(1)}` : '—'}
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(statusBg, statusFg)}>{statusTxt}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* SELECTED BAR DETAIL — top 10 MPs for a clicked month              */
/* ══════════════════════════════════════════════════════════════════ */
function BarDetail({ barData, consumoPorMP, onClose }) {
  /* BUG FIX React #310: el useMemo DEBE llamarse antes de cualquier early return.
     Antes: `if (!barData) return null` estaba ANTES de useMemo → cuando barData
     cambiaba de null a objeto, React veía un hook nuevo y crasheaba con
     "Rendered more hooks than during the previous render". */
  const topMPs = useMemo(() => {
    if (!consumoPorMP || !barData) return [];
    return Object.entries(consumoPorMP)
      .map(([mp, meses]) => ({ mp, kg: meses[barData.mes] || 0 }))
      .filter(it => it.kg > 0)
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 10);
  }, [consumoPorMP, barData?.mes]);

  if (!barData) return null;

  return (
    <div style={{ ...S.card, borderLeft: '3px solid var(--lp-brand-600)', borderRadius: '0 var(--lp-radius) var(--lp-radius) 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{mesLabel(barData.mes)}</span>
          <span style={{ ...S.badge(barData.tipo === 'forecast' ? '#EDE9FE' : 'var(--lp-brand-100)', barData.tipo === 'forecast' ? '#534AB7' : 'var(--lp-brand-700)'), marginLeft: 8 }}>
            {barData.tipo === 'forecast' ? 'Proyeccion' : 'Historico'}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--lp-text-tertiary)' }}>x</button>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-brand-600)' }}>
        {Math.round(barData.val).toLocaleString()} cubetas
      </div>
      {topMPs.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', marginTop: 12, marginBottom: 6, textTransform: 'uppercase' }}>
            Top 10 MPs consumidas
          </div>
          {topMPs.map(it => {
            const maxKg = topMPs[0].kg;
            const pct = maxKg > 0 ? (it.kg / maxKg) * 100 : 0;
            return (
              <div key={it.mp} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, minWidth: 140, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.mp}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--lp-bg-sunken)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'var(--lp-brand-500)' }} />
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--lp-font-mono)', fontWeight: 600, color: 'var(--lp-text-secondary)', minWidth: 55, textAlign: 'right' }}>
                  {it.kg.toFixed(0)} kg
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* FORECAST PT TABLE — Producto Terminado: Producción + Demanda POS + Blend */
/* ══════════════════════════════════════════════════════════════════ */
function ForecastPTTable({ forecastPorPT, consumoPorPT, forecastBlend, demandaPOS, posMeta }) {
  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [sortBy, setSortBy] = useState('blend');
  const [expanded, setExpanded] = useState(null);
  const [vista, setVista] = useState('blend'); /* blend | produccion | pos */

  const items = useMemo(() => {
    const blend = forecastBlend || {};
    const allKeys = new Set([...Object.keys(forecastPorPT || {}), ...Object.keys(blend)]);
    let arr = Array.from(allKeys).map(pt => {
      const prod = forecastPorPT?.[pt] || {};
      const b = blend[pt] || {};
      const pos = demandaPOS?.[pt] || {};
      const prodMensual = prod.wma_mensual || b.produccion_mensual || 0;
      const posMensual = pos.demanda_mensual || b.demanda_pos_mensual || 0;
      const blended = b.blended_mensual || prodMensual;
      const gap = b.gap ?? (prodMensual - posMensual);
      const gapPct = b.gapPct ?? (posMensual > 0 ? Math.round(((prodMensual / posMensual) - 1) * 100) : null);
      const fuente = b.fuente || 'produccion';
      const forecast = vista === 'blend' ? (b.forecast || prod.forecast || [])
                     : vista === 'pos' ? [] /* POS no tiene forecast mensual aún */
                     : (prod.forecast || []);
      const proxMes = forecast.length > 0 ? forecast[0].cubetas : (vista === 'pos' ? posMensual : 0);
      const yoy = prod.yoy_factor || 1;
      const trend = ((yoy - 1) * 100);
      return { pt, prodMensual, posMensual, blended, gap, gapPct, fuente, trend, proxMes,
               mesesDatos: prod.meses_datos || b.meses_datos_prod || 0, forecast, detalle: pos.detalle || b.detalle_pos || '' };
    });
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      arr = arr.filter(it => it.pt.toLowerCase().includes(q));
    }
    if (sortBy === 'blend') arr.sort((a, b) => b.blended - a.blended);
    else if (sortBy === 'produccion') arr.sort((a, b) => b.prodMensual - a.prodMensual);
    else if (sortBy === 'pos') arr.sort((a, b) => b.posMensual - a.posMensual);
    else if (sortBy === 'gap') arr.sort((a, b) => (a.gap) - (b.gap)); /* déficit primero */
    else if (sortBy === 'nombre') arr.sort((a, b) => a.pt.localeCompare(b.pt));
    return arr;
  }, [forecastPorPT, forecastBlend, demandaPOS, debouncedQuery, sortBy, vista]);

  const hasPOS = Object.keys(demandaPOS || {}).length > 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Proyeccion producto terminado
        </div>
        {hasPOS && (
          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#DBEAFE', color: '#1D4ED8', fontWeight: 600 }}>
            + Ventas POS
          </span>
        )}
      </div>
      {hasPOS && posMeta && (
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginBottom: 8, padding: '4px 8px', background: 'var(--lp-bg-sunken)', borderRadius: 4 }}>
          Fuente POS: {posMeta.tienda || 'Tienda'} ({posMeta.periodo || '28 meses'}) — {posMeta.nota || ''}
        </div>
      )}
      <div style={S.toolbar}>
        <input type="text" style={{ ...S.search, maxWidth: 220 }} placeholder="Buscar producto..."
          value={query} onChange={e => setQuery(e.target.value)} />
        <SegmentedControl
          value={sortBy}
          onChange={setSortBy}
          color="brand"
          options={[
            ...(hasPOS ? [{ value: 'blend', label: 'Combinado' }] : []),
            { value: 'produccion', label: 'Producción' },
            ...(hasPOS ? [{ value: 'pos',  label: 'Demanda POS' }] : []),
            ...(hasPOS ? [{ value: 'gap',  label: 'Déficit' }] : []),
            { value: 'nombre',     label: 'A–Z' },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <div style={S.empty}>Sin datos de productos terminados.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Producto</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Produccion</th>
                {hasPOS && <th style={{ ...S.th, textAlign: 'right' }}>Demanda POS</th>}
                {hasPOS && <th style={{ ...S.th, textAlign: 'right' }}>Combinado</th>}
                {hasPOS && <th style={{ ...S.th, textAlign: 'right' }}>Gap</th>}
                <th style={{ ...S.th, textAlign: 'right' }}>Prox. mes</th>
                <th style={S.th}>6 meses</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const isOpen = expanded === it.pt;
                const maxFc = Math.max(...(it.forecast.length > 0 ? it.forecast.map(f => f.cubetas) : [1]), 1);
                /* Gap indicator: red = underproduction, green = overproduction */
                const gapColor = it.gap < -5 ? 'var(--lp-danger-600)' : it.gap > 5 ? 'var(--lp-success-600)' : 'var(--lp-text-tertiary)';
                const gapBg = it.gap < -5 ? 'var(--lp-danger-100)' : it.gap > 5 ? 'var(--lp-success-100)' : 'var(--lp-bg-sunken)';

                return (
                  <tr key={it.pt} style={{ cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : it.pt)}>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--lp-text-disabled)', transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>&#9654;</span>
                        <div>
                          <span>{it.pt}</span>
                          {it.fuente === 'pos' && <span style={{ fontSize: 8, marginLeft: 4, color: '#1D4ED8' }}>solo POS</span>}
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ marginTop: 8, marginLeft: 16 }} onClick={e => e.stopPropagation()}>
                          {it.detalle && <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginBottom: 6 }}>{it.detalle}</div>}
                          {it.forecast.length > 0 ? it.forecast.map(f => (
                            <div key={f.mes} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lp-text-tertiary)', width: 42 }}>{mesLabel(f.mes)}</span>
                              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--lp-bg-sunken)', overflow: 'hidden', maxWidth: 120 }}>
                                <div style={{ height: '100%', width: `${(f.cubetas / maxFc) * 100}%`, borderRadius: 3, background: it.fuente === 'pos' ? '#60A5FA' : it.fuente === 'blend' ? '#818CF8' : '#AFA9EC' }} />
                              </div>
                              <span style={{ fontSize: 11, fontFamily: 'var(--lp-font-mono)', fontWeight: 600, color: 'var(--lp-text-secondary)' }}>
                                {f.cubetas}
                              </span>
                            </div>
                          )) : (
                            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>Demanda POS mensual constante: {it.posMensual} cub/mes</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', verticalAlign: 'top' }}>
                      {Math.round(it.prodMensual) || <span style={{ color: 'var(--lp-text-disabled)' }}>—</span>}
                    </td>
                    {hasPOS && (
                      <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', verticalAlign: 'top', color: '#1D4ED8' }}>
                        {it.posMensual || <span style={{ color: 'var(--lp-text-disabled)' }}>—</span>}
                      </td>
                    )}
                    {hasPOS && (
                      <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 600, verticalAlign: 'top' }}>
                        {it.blended}
                      </td>
                    )}
                    {hasPOS && (
                      <td style={{ ...S.td, textAlign: 'right', verticalAlign: 'top' }}>
                        {it.gapPct !== null ? (
                          <span style={S.badge(gapBg, gapColor)}>
                            {it.gap > 0 ? '+' : ''}{it.gap} ({it.gapPct > 0 ? '+' : ''}{it.gapPct}%)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--lp-text-disabled)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    )}
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 600, verticalAlign: 'top' }}>
                      {it.proxMes}
                    </td>
                    <td style={{ ...S.td, verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 20 }}>
                        {it.forecast.slice(0, 6).map((f, idx) => {
                          const bh = maxFc > 0 ? Math.max(2, (f.cubetas / maxFc) * 20) : 2;
                          return <div key={idx} style={{ width: 6, height: bh, borderRadius: 1, background: it.fuente === 'blend' ? '#818CF8' : '#AFA9EC' }} />;
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* PRONOSTICO TAB                                                     */
/* ══════════════════════════════════════════════════════════════════ */
function PronosticoTab({ forecastData, inventario }) {
  const [selectedBar, setSelectedBar] = useState(null);

  const d = forecastData?.data || forecastData || {};
  const forecast = d.forecast || [];
  const consumoMensual = d.consumoMensual || {};
  const indiceEstacional = d.indiceEstacional || {};
  const alertas = d.alertas || [];
  const forecastPorMP = d.forecastPorMP || {};
  const consumoPorMP = d.consumoPorMP || {};
  const forecastPorPT = d.forecastPorPT || {};
  const consumoPorPT = d.consumoPorPT || {};
  const forecastBlend = d.forecastBlend || {};
  const demandaPOS = d.demandaPOS || {};
  const posMeta = d.pos_meta || null;
  const params = d.parametros || {};

  const mesesHist = Object.keys(consumoMensual).length;
  const hasForecast = forecast.length > 0;

  /* KPIs */
  const promedioMensual = mesesHist > 0
    ? Math.round(Object.values(consumoMensual).reduce((s, v) => s + v, 0) / mesesHist)
    : 0;
  const proxMes = hasForecast ? Math.round(forecast[0].proyeccion_kg) : 0;
  const alertCount = alertas.length;

  /* PERIYOY (algoritmo propio) — combina 3 YoY independientes:
     producción, compras y ventas POS, comparando mes igual contra mes igual del año anterior. */
  const yoyProd    = params.yoy_produccion || {};
  const yoyComp    = params.yoy_compras    || {};
  const yoyVentas  = params.yoy_ventas     || {};
  const yoyPctProd = yoyProd.factor != null ? +((yoyProd.factor - 1) * 100).toFixed(1) : null;
  const yoyPctComp = yoyComp.factor != null ? +((yoyComp.factor - 1) * 100).toFixed(1) : null;
  const yoyPctVtas = yoyVentas.factor != null ? +((yoyVentas.factor - 1) * 100).toFixed(1) : null;
  /* Promedio simple de los YoY confiables = índice PERIYOY global */
  const yoyValores = [yoyPctProd, yoyPctComp, yoyPctVtas].filter(v => v != null);
  const periyoy = yoyValores.length > 0 ? +(yoyValores.reduce((s,v)=>s+v,0)/yoyValores.length).toFixed(1) : null;
  const periyoyConfiable = (yoyProd.confiable || yoyComp.confiable || yoyVentas.confiable);

  if (mesesHist === 0) {
    return <div style={S.empty}>Sin datos historicos de produccion. Se necesitan al menos 3 meses.</div>;
  }

  return (
    <>
      {/* KPIs */}
      <div style={S.kpiGrid}>
        <div style={S.kpi('var(--lp-brand-600)')}>
          <div style={S.kpiLabel}>Promedio/mes</div>
          <div style={S.kpiValue}>{promedioMensual.toLocaleString()}</div>
          <div style={S.kpiSub}>cubetas</div>
        </div>
        <div style={S.kpi('var(--lp-success-600)')}>
          <div style={S.kpiLabel}>Prox. mes</div>
          <div style={S.kpiValue}>{proxMes.toLocaleString()}</div>
          <div style={S.kpiSub}>proyeccion</div>
        </div>
        <div
          style={{ ...S.kpi(periyoy != null && periyoy >= 0 ? 'var(--lp-success-600)' : 'var(--lp-warning-600)'), cursor: 'help' }}
          title={`PERIYOY = promedio de 3 YoY (mismo mes año anterior).\nProducción: ${yoyPctProd != null ? yoyPctProd + '%' : 'sin datos'} (${yoyProd.pares || 0} pares)\nCompras:    ${yoyPctComp != null ? yoyPctComp + '%' : 'sin datos'} (${yoyComp.pares || 0} pares)\nVentas POS: ${yoyPctVtas != null ? yoyPctVtas + '%' : 'sin desglose mensual'}`}
        >
          <div style={S.kpiLabel}>PERIYOY</div>
          <div style={S.kpiValue}>
            {periyoy != null
              ? <>{periyoy >= 0 ? '+' : ''}{periyoy}<span style={{ fontSize: 16, opacity: .7 }}>%</span></>
              : '—'}
          </div>
          <div style={S.kpiSub}>
            Prod {yoyPctProd != null ? (yoyPctProd >= 0 ? '+' : '') + yoyPctProd + '%' : '—'}
            {' · '}Comp {yoyPctComp != null ? (yoyPctComp >= 0 ? '+' : '') + yoyPctComp + '%' : '—'}
            {' · '}POS {yoyPctVtas != null ? (yoyPctVtas >= 0 ? '+' : '') + yoyPctVtas + '%' : '—'}
            {!periyoyConfiable && <span style={{ color: 'var(--lp-warning-700)' }}> ~</span>}
          </div>
        </div>
        <div style={S.kpi(alertCount > 0 ? 'var(--lp-warning-600)' : 'var(--lp-text-tertiary)')}>
          <div style={S.kpiLabel}>Alertas</div>
          <div style={S.kpiValue}>{alertCount}</div>
          <div style={S.kpiSub}>{mesesHist} meses datos</div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ ...S.card, padding: '16px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Produccion mensual + proyeccion
        </div>
        <BarChart
          historico={consumoMensual}
          forecast={forecast}
          height={240}
          onBarClick={setSelectedBar}
        />
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', textAlign: 'center' }}>
          Click en una barra para ver detalle de MPs consumidas
        </div>
      </div>

      {/* Bar detail */}
      {selectedBar && (
        <BarDetail barData={selectedBar} consumoPorMP={consumoPorMP} onClose={() => setSelectedBar(null)} />
      )}

      {/* Alerts */}
      <Alertas alertas={alertas} />

      {/* Seasonal index */}
      <SeasonalIndex indice={indiceEstacional} />

      {/* Forecast per PT */}
      <ForecastPTTable forecastPorPT={forecastPorPT} consumoPorPT={consumoPorPT}
        forecastBlend={forecastBlend} demandaPOS={demandaPOS} posMeta={posMeta} />

      {/* Forecast per MP */}
      <ForecastMPTable forecastPorMP={forecastPorMP} consumoPorMP={consumoPorMP} inventario={inventario} />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* FLAG POPUP COMPONENT — Banderitas con info de gasto_local, datos_insuficientes, CV */
/* ══════════════════════════════════════════════════════════════════ */
function FlagPopup({ flags, anchorRect, onClose }) {
  const [popRect, setPopRect] = useState(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!popRef.current || !anchorRect) return;
    const rect = popRef.current.getBoundingClientRect();
    setPopRect(rect);

    const handleClickOutside = (e) => {
      if (!popRef.current?.contains(e.target) && !e.target.closest('.lp-mrp-flag-btn')) {
        onClose();
      }
    };
    const handleScroll = () => onClose();

    setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
      document.addEventListener('scroll', handleScroll, true);
    }, 50);

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [anchorRect, onClose]);

  if (!anchorRect || flags.length === 0) return null;

  // Posicionar: intentar a la derecha, si no cabe, a la izquierda
  let left = anchorRect.left + anchorRect.width + 6;
  let top = anchorRect.top;
  if (popRect && left + popRect.width > window.innerWidth - 10) {
    left = anchorRect.left - popRect.width - 6;
  }
  if (popRect && top + popRect.height > window.innerHeight - 10) {
    top = window.innerHeight - popRect.height - 10;
  }

  return (
    <div
      ref={popRef}
      style={{
        position: 'fixed',
        zIndex: 9999,
        left: `${left}px`,
        top: `${top}px`,
        background: '#fff',
        border: '1px solid var(--lp-border-default, #d4d2c8)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,.12)',
        padding: '10px 12px',
        fontSize: 11,
        lineHeight: 1.4,
        color: 'var(--lp-text-primary, #1a1815)',
        minWidth: 220,
        maxWidth: 300,
      }}
    >
      {flags.map((f, idx) => (
        <div key={idx}>
          {idx > 0 && <div style={{ borderTop: '1px solid var(--lp-border-subtle, #e8e6de)', margin: '8px 0' }} />}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: f.color, fontSize: 14, fontWeight: 900, lineHeight: 1, marginTop: 1 }}>
              {f.icon}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: f.color, marginBottom: 2 }}>
                {f.titulo}
              </div>
              <div style={{ color: 'var(--lp-text-secondary, #6B6560)' }}>
                {f.texto}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* MRP TAB                                                            */
/* ══════════════════════════════════════════════════════════════════ */
function MRPTab({ mrpData, onCrearOC }) {
  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [flagPopup, setFlagPopup] = useState(null); // { flags, anchorRect }

  const items = useMemo(() => {
    const raw = mrpData?.data?.items || mrpData?.data || mrpData?.items || [];
    if (!Array.isArray(raw)) return [];
    let arr = [...raw];
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      arr = arr.filter(it => (it.mp || it.nombre || '').toLowerCase().includes(q));
    }
    return arr;
  }, [mrpData, debouncedQuery]);

  return (
    <>
      <div style={S.toolbar}>
        <input type="text" style={S.search} placeholder="Buscar materia prima..."
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {flagPopup && (
        <FlagPopup
          flags={flagPopup.flags}
          anchorRect={flagPopup.anchorRect}
          onClose={() => setFlagPopup(null)}
        />
      )}

      {items.length === 0 ? (
        <div style={S.empty}>Sin datos de MRP disponibles.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>MP</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Tengo</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Necesito/mes</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Deficit</th>
                <th style={S.th}>Accion</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const mp = it.mp || it.nombre || `MP-${i}`;
                const stock = it.stockActual ?? it.stock ?? it.tengo ?? 0;
                const consumo = it.necesidadMes ?? it.consumo_mensual ?? it.necesito ?? 0;
                const deficit = it.deficit ?? 0;
                const priColor = deficit > 0
                  ? (stock <= 0 ? 'var(--lp-danger-600)' : 'var(--lp-warning-600)')
                  : 'var(--lp-success-600)';
                const badgeBg = deficit > 0 ? 'var(--lp-danger-100)' : 'var(--lp-success-100)';
                const badgeFg = deficit > 0 ? 'var(--lp-danger-600)' : 'var(--lp-success-600)';
                const badgeText = deficit > 0 ? 'Comprar' : 'OK';

                // Construir flags (banderitas)
                const flagsArr = [];
                if (it.gasto_local) {
                  flagsArr.push({
                    tipo: 'local',
                    icon: '★',
                    color: 'var(--lp-brand-600)',
                    titulo: 'Insumo local',
                    texto: 'Se pide localmente sin OC formal a proveedor (ej: agua de la llave). Sigue contando en el costeo.',
                  });
                }
                if (it.datos_insuficientes) {
                  flagsArr.push({
                    tipo: 'datos',
                    icon: '!',
                    color: 'var(--lp-warning-600)',
                    titulo: 'Datos insuficientes',
                    texto: 'Menos de 3 meses de consumo histórico. El pronóstico es estimación gruesa — interpretar con cautela.',
                  });
                }
                if (it.cv && it.cv > 0) {
                  const pct = Math.round((it.margen_aplicado - 1) * 100);
                  const bandaCV = it.cv < 0.20 ? 'muy estable' : it.cv < 0.50 ? 'normal' : it.cv < 1.0 ? 'volátil' : 'errático';
                  flagsArr.push({
                    tipo: 'cv',
                    icon: '~',
                    color: 'var(--lp-text-tertiary)',
                    titulo: `Margen dinámico (CV ${it.cv.toFixed(2)})`,
                    texto: `Variabilidad: ${bandaCV}. Margen aplicado: ${pct}% sobre el consumo mensual.`,
                  });
                }
                const topFlag = flagsArr.find(f => f.tipo === 'datos') || flagsArr.find(f => f.tipo === 'local') || flagsArr[0];

                return (
                  <tr key={mp}>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={S.dot(priColor)} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{mp}</span>
                          {flagsArr.length > 0 && (
                            <button
                              className="lp-mrp-flag-btn"
                              onClick={(e) => {
                                e.preventDefault();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setFlagPopup({ flags: flagsArr, anchorRect: rect });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                marginLeft: 2,
                                fontSize: 14,
                                fontWeight: 900,
                                color: topFlag.color,
                                lineHeight: 1,
                                title: 'Click para más info',
                              }}
                              title="Click para más info"
                            >
                              {topFlag.icon}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>
                      {typeof stock === 'number' ? stock.toFixed(1) : stock}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>
                      {typeof consumo === 'number' ? consumo.toFixed(1) : consumo}
                    </td>
                    <td style={{
                      ...S.td, textAlign: 'right', fontFamily: 'var(--lp-font-mono)',
                      fontWeight: 700,
                      color: deficit > 0 ? 'var(--lp-danger-600)' : 'var(--lp-text-tertiary)',
                    }}>
                      {deficit > 0 ? `-${deficit.toFixed(1)}` : '—'}
                    </td>
                    <td style={S.td}>
                      {deficit > 0 && !it.gasto_local ? (
                        <button
                          onClick={() => onCrearOC && onCrearOC({
                            mp,
                            kg: Math.ceil(deficit),
                            proveedor: it.proveedor_principal || it.proveedor || null,
                          })}
                          style={{
                            ...S.badge(badgeBg, badgeFg),
                            border: '1.5px solid ' + badgeFg,
                            cursor: 'pointer',
                            fontWeight: 700,
                            transition: 'transform .12s, box-shadow .12s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,.10)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                          title={`Crear OC para ${mp} (${Math.ceil(deficit)} kg)`}
                        >
                          + Crear OC
                        </button>
                      ) : (
                        <span style={S.badge(badgeBg, badgeFg)}>{badgeText}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                    */
/* ══════════════════════════════════════════════════════════════════ */
export default function ComprasPage() {
  const [activeTab, setActiveTab] = useState('mrp');
  const [newOCPrefill, setNewOCPrefill] = useState(null); // { mp, kg, proveedor }

  const { data: mrpData, loading: mrpLoading } = useApiData(() => api.getMRP(), [], 15000);
  const { data: forecastData, loading: fcLoading } = useApiData(() => api.getForecast(), null, 30000);
  const { data: invData } = useApiData(() => api.getInventario(), null, 30000);
  const { data: ocsData, loading: ocsLoading, reload: reloadOCs } = useApiData(() => api.get('/api/compras/oc'), [], 20000);

  /* FIX jun 2026 (K1): ComprasPage era la única pantalla pesada del ERP sin
     realtime sync — Arely solo veía OCs nuevas tras polling de 20s o refresh.
     Ahora reacciona a oc/precios/inventario en tiempo real. */
  useRealtimeSync({
    onOc:        () => reloadOCs(),
    onPrecios:   () => reloadOCs(),
    onInventario:() => reloadOCs(),
  });

  /* Callback desde MRPTab: abre el NewOCModal con los datos de la MP pre-llenados */
  const handleCrearOCFromMRP = (data) => {
    setNewOCPrefill(data);
    setActiveTab('ocs');
  };
  const handleNewOCCreated = () => {
    setNewOCPrefill(null);
    reloadOCs();
  };

  /* Build simple inv map for MP stock lookup */
  const inventario = useMemo(() => {
    const raw = invData?.data || invData || {};
    if (typeof raw !== 'object' || Array.isArray(raw)) return {};
    const map = {};
    Object.entries(raw).forEach(([key, val]) => {
      if (val && typeof val === 'object' && val.tipo === 'mp') {
        map[key] = val;
      }
    });
    return map;
  }, [invData]);

  const tabs = [
    { id: 'forecast',   label: '🤖 Forecast IA' },
    { id: 'pedidos',    label: 'Predicción' },
    { id: 'mrp',        label: 'MRP' },
    { id: 'ocs',        label: 'OCs' },
    { id: 'pronostico', label: 'Pronóstico' },
    { id: 'ia',         label: 'IA' },
    { id: 'aliases',    label: 'POS Aliases' },
    { id: 'sat',        label: 'SAT' },
  ];

  return (
    <>
      <TopBar title="Compras" />
      <div style={S.wrap}>
        <HelpHint id="compras-overview" title="Compras: 5 herramientas en uno">
          <strong>MRP</strong>: detecta MPs que faltan según producción esperada. <strong>OCs</strong>: crea, recibe y cierra órdenes de compra. <strong>Pronóstico</strong>: WMA × estacional × YoY blended con demanda POS. <strong>Predicción IA</strong>: Holt forecasting con alertas. <strong>SAT/CFDI</strong>: parsea XMLs de facturas y los cruza con OCs.
        </HelpHint>
        <PageTabs
          tabs={tabs.map(t => ({ ...t, style: (active) => S.tab(active) }))}
          activeTab={activeTab}
          onChange={setActiveTab}
          style={S.tabs}
        />

        {activeTab === 'pedidos' && (
          <PrediccionPedidosTab onCreateOC={handleCrearOCFromMRP} />
        )}

        {activeTab === 'mrp' && (
          mrpLoading
            ? <div style={S.spinner}><div className="lp-spinner" /></div>
            : <MRPTab mrpData={mrpData} onCrearOC={handleCrearOCFromMRP} />
        )}

        {activeTab === 'ocs' && (
          ocsLoading
            ? <div style={S.spinner}><div className="lp-spinner" /></div>
            : <OCsTab
                ocsData={ocsData}
                onRefresh={reloadOCs}
                prefillNewOC={newOCPrefill}
                onPrefillConsumed={() => setNewOCPrefill(null)}
                onCreated={handleNewOCCreated}
              />
        )}

        {activeTab === 'pronostico' && (
          fcLoading
            ? <div style={S.spinner}><div className="lp-spinner" /></div>
            : <PronosticoTab forecastData={forecastData} inventario={inventario} />
        )}

        {activeTab === 'forecast' && <ForecastIATab />}

        {activeTab === 'ia' && <PrediccionIATab />}

        {activeTab === 'aliases' && <PosAliasesTab />}

        {activeTab === 'sat' && <SATPanel />}
      </div>
    </>
  );
}
