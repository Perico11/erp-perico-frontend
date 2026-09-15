/* ════════════════════════════════════════════════════════════════════════════
   EficaciaPage — E3 (15-sep-2026): los CUATRO números del dueño, en una
   pestaña propia y solo para admin (el backend también lo exige con 403).

     1. Días de pedido → Terán   (bajar es bueno)  + los 5 más lentos
     2. % de merma               (bajar es bueno)  + top por producto
     3. Rotación por tienda      (subir es bueno)  + piezas/litros/semanas
     4. Conteos cíclicos         (subir es bueno)  vs meta de 1 por semana

   Cada número trae su comparación contra las 4 semanas ANTERIORES, con la
   dirección buena de cada uno ya resuelta (verde = mejora, rojo = empeora).

   HONESTIDAD EN PANTALLA (regla ASTRA): si hubo pedidos con fechas
   incompletas (`sinFechas`) o presentaciones sin equivalencia a litros
   (`litrosParciales`), aquí SE DICE — no se rellena con ceros inventados.

   Design System verde: tokens var(--lp-*), cifras mono, sin emojis (SVG),
   móvil = 1 columna / escritorio = 2.
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import TopBar from '../../components/layout/TopBar';
import api from '../../services/api';
import humanizeError from '../../utils/humanizeError';
import useIsDesktop from '../../hooks/useIsDesktop';

const S = {
  wrap: { padding: '0 20px 100px' },
  wrapDesk: { padding: '0 24px 60px', maxWidth: 1060 },
  h1: { fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--lp-text-primary)' },
  psub: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 3, marginBottom: 4 },
  ventana: { fontSize: 12, color: 'var(--lp-text-tertiary)', marginBottom: 16, fontFamily: 'var(--lp-font-mono)' },

  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 'var(--lp-radius-sm)', fontSize: 12, marginBottom: 12 },
  loading: { textAlign: 'center', padding: 40, color: 'var(--lp-text-tertiary)', fontSize: 13 },

  grid: (desktop) => ({ display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr' : '1fr', gap: 14 }),
  card: {
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 8, minHeight: 170,
  },
  cardHead: { display: 'flex', alignItems: 'center', gap: 7 },
  dot: (c) => ({ width: 8, height: 8, borderRadius: 999, background: c, flexShrink: 0 }),
  cardLabel: { fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' },
  big: { fontSize: 30, fontWeight: 800, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)', lineHeight: 1.05 },
  bigNota: { fontSize: 12, color: 'var(--lp-text-tertiary)' },
  sub: { fontSize: 12.5, color: 'var(--lp-text-secondary)' },

  tend: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600 },
  tendNeutra: { fontSize: 12, color: 'var(--lp-text-tertiary)' },
  ritmo: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, fontFamily: 'var(--lp-font-mono)', flexShrink: 0 },
  ritmoNeutro: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', flexShrink: 0 },
  leyenda: { fontSize: 11, color: 'var(--lp-text-tertiary)', lineHeight: 1.35 },

  honesto: {
    fontSize: 11.5, color: 'var(--lp-warning-700)', background: 'var(--lp-warning-100)',
    padding: '5px 8px', borderRadius: 'var(--lp-radius-sm)', lineHeight: 1.35,
  },

  lista: { margin: 0, padding: 0, listStyle: 'none', borderTop: '1px solid var(--lp-border-subtle)', marginTop: 2 },
  fila: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 12.5 },
  filaNombre: { color: 'var(--lp-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  filaDetalle: { color: 'var(--lp-text-tertiary)', fontSize: 11.5 },
  filaNum: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-text-primary)', flexShrink: 0 },

  refresh: {
    background: 'none', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-sm)',
    padding: '7px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--lp-text-secondary)',
    cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
  },

  barraMeta: { height: 6, borderRadius: 999, background: 'var(--lp-bg-sunken, var(--lp-border-subtle))', overflow: 'hidden' },
  barraMetaFill: (pct) => ({ height: '100%', width: `${Math.min(100, pct || 0)}%`, borderRadius: 999, background: (pct || 0) >= 100 ? 'var(--lp-success-600)' : 'var(--lp-brand-600)' }),
};

const flechaArriba = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15" /></svg>
);
const flechaAbajo = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
);

/* Comparación contra las 4 semanas previas, con la dirección buena resuelta.
   Sin dato previo (o actual) no se inventa flecha: "sin comparativa". */
function Tendencia({ actual, previo, bajarEsBueno, unidad = '', etiqueta = 'vs 4 sem. previas' }) {
  if (actual == null || previo == null) {
    return <div style={S.tendNeutra}>sin comparativa con las 4 semanas previas</div>;
  }
  const delta = +(actual - previo).toFixed(1);
  if (delta === 0) return <div style={S.tendNeutra}>igual que las 4 semanas previas</div>;
  const mejora = bajarEsBueno ? delta < 0 : delta > 0;
  return (
    <div style={{ ...S.tend, color: mejora ? 'var(--lp-success-600)' : 'var(--lp-danger-600)' }}>
      {delta > 0 ? flechaArriba : flechaAbajo}
      <span>{delta > 0 ? '+' : ''}{delta}{unidad} {etiqueta} ({previo}{unidad})</span>
    </div>
  );
}

/* RITMO POR TIENDA (elige el dueño, 15-sep-2026): las mini-barras con escala
   por fila engañaban — Ruby (la más chica) pintaba barra llena y Lázaro (la
   #1) un guión, porque cada fila se medía contra su propia mejor semana. En
   su lugar: flecha con % comparando las últimas 2 semanas de ESA tienda
   contra sus 2 anteriores. Verde acelera, rojo frena, sin trampas de escala.
   Sin volumen previo no se inventa % — se muestra el delta en litros. */
function RitmoTienda({ ritmo }) {
  if (!ritmo) return null;
  const delta = Number(ritmo.deltaLitros) || 0;
  if (delta === 0) return <span style={S.ritmoNeutro} title="mismas ventas que las 2 semanas anteriores">igual</span>;
  const sube = delta > 0;
  const texto = ritmo.pct != null
    ? `${sube ? '+' : ''}${ritmo.pct}%`
    : `${sube ? '+' : ''}${ritmo.deltaLitros} L`;
  return (
    <span
      style={{ ...S.ritmo, color: sube ? 'var(--lp-success-600)' : 'var(--lp-danger-600)' }}
      title={`últimas 2 semanas: ${ritmo.reciente} L · las 2 anteriores: ${ritmo.anterior} L`}
    >
      {sube ? flechaArriba : flechaAbajo}
      {texto}
    </span>
  );
}

const fmtDia = (iso) => {
  try { return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); } catch { return '?'; }
};

export default function EficaciaPage() {
  const isDesktop = useIsDesktop();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [cargando, setCargando] = useState(true);

  /* El efecto solo DISPARA el fetch; todo setState vive en los callbacks del
     promise (asíncronos) — así lo pide react-hooks/set-state-in-effect. El
     botón Actualizar prende `cargando` en su handler y mueve el tick. */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let vivo = true;
    api.getEficaciaTablero()
      .then((r) => { if (vivo) { setData(r.data); setErr(''); } })
      .catch((e) => { if (vivo) setErr(humanizeError(e)); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [tick]);
  const refrescar = () => { setCargando(true); setErr(''); setTick(t => t + 1); };

  const d = data || {};
  const dias = d.diasPedido || {};
  const merma = d.merma || {};
  const rot = d.rotacion || { tiendas: [] };
  const cc = d.conteos || {};
  /* La comparación también se ensucia si la ventana PREVIA traía líneas sin
     equivalencia — por eso entran los tres orígenes de la bandera. */
  const hayLitrosParciales = (rot.tiendas || []).some(t => t.litrosParciales)
    || !!rot.litrosParciales || !!(rot.prev && rot.prev.litrosParciales);

  return (
    <>
      <TopBar title="Eficacia" />
      <div style={{ ...S.wrap, ...(isDesktop ? S.wrapDesk : {}) }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={S.h1}>Eficacia</div>
            <div style={S.psub}>Los 4 números del negocio: últimas 4 semanas contra las 4 anteriores.</div>
          </div>
          <button type="button" style={S.refresh} onClick={refrescar} disabled={cargando}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
            Actualizar
          </button>
        </div>
        {d.ventana && (
          <div style={S.ventana}>ventana: {fmtDia(d.ventana.desde)} → {fmtDia(d.ventana.hasta)} · {d.ventana.dias} días</div>
        )}

        {err && <div style={S.err}>{err}</div>}
        {cargando && !data && <div style={S.loading}>Calculando el tablero…</div>}

        {data && (
          <div style={S.grid(isDesktop)}>

            {/* ── 1. Días de pedido → Terán ─────────────────────────────── */}
            <section style={S.card} aria-label="Días de pedido a Terán">
              <div style={S.cardHead}>
                <span style={S.dot('var(--lp-info-600)')} />
                <div style={S.cardLabel}>Días de pedido → Terán</div>
              </div>
              <div style={S.big}>
                {dias.promedio != null ? `${dias.promedio} días` : '—'}
              </div>
              <Tendencia actual={dias.promedio} previo={dias.prev?.promedio} bajarEsBueno unidad=" días" />
              <div style={S.sub}>
                {dias.entregados || 0} pedido{(dias.entregados || 0) === 1 ? '' : 's'} entregado{(dias.entregados || 0) === 1 ? '' : 's'} en la ventana
                {dias.prev?.entregados != null ? ` · ${dias.prev.entregados} en la previa` : ''}
              </div>
              {(dias.sinFechas || 0) > 0 && (
                <div style={S.honesto}>
                  {dias.sinFechas} pedido{dias.sinFechas === 1 ? '' : 's'} con fechas incompletas no entra{dias.sinFechas === 1 ? '' : 'n'} al promedio (no se adivina).
                </div>
              )}
              {(dias.masLentos || []).length > 0 && (
                <ul style={S.lista}>
                  {dias.masLentos.map((m, i) => (
                    <li key={i} style={S.fila}>
                      <span style={S.filaNombre}>
                        {m.codigo}
                        {m.producto ? <span style={S.filaDetalle}> · {m.producto}</span> : null}
                      </span>
                      <span style={S.filaNum}>{m.dias} d</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── 2. % de merma ─────────────────────────────────────────── */}
            <section style={S.card} aria-label="Porcentaje de merma">
              <div style={S.cardHead}>
                <span style={S.dot('var(--lp-danger-600)')} />
                <div style={S.cardLabel}>% de merma</div>
              </div>
              <div style={S.big}>{merma.pct != null ? `${merma.pct}%` : '—'}</div>
              {merma.pct == null && (
                <div style={S.bigNota}>sin producción en el periodo — no hay porcentaje honesto que dar</div>
              )}
              <Tendencia actual={merma.pct} previo={merma.prev?.pct} bajarEsBueno unidad="%" />
              <div style={S.sub}>
                {merma.mermaCub || 0} cub de merma · {merma.producidoCub || 0} cub producidas en la ventana
              </div>
              {(merma.porProducto || []).length > 0 && (
                <ul style={S.lista}>
                  {merma.porProducto.map((p, i) => (
                    <li key={i} style={S.fila}>
                      <span style={S.filaNombre}>{p.producto}</span>
                      <span style={S.filaNum}>{p.mermaCub} cub</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── 3. Rotación por tienda ────────────────────────────────── */}
            <section style={S.card} aria-label="Rotación por tienda">
              <div style={S.cardHead}>
                <span style={S.dot('var(--lp-brand-600)')} />
                <div style={S.cardLabel}>Rotación por tienda</div>
              </div>
              {/* LITROS MANDAN (pide el dueño, 15-sep-2026): "piezas" mezclaba
                  galones con cubetas. El litro es el número grande, el orden y
                  el ritmo; las piezas quedan de dato secundario. El fallback a
                  piezas cubre un backend viejo sin totalLitros. */}
              <div style={S.big}>
                {rot.totalLitros != null ? `${rot.totalLitros} L` : `${rot.totalPiezas || 0} piezas`}
              </div>
              <Tendencia actual={rot.totalLitros} previo={rot.prev?.totalLitros} bajarEsBueno={false} unidad=" L" />
              <div style={S.sub}>{rot.totalPiezas || 0} piezas en total (cubetas, galones y demás)</div>
              {(rot.tiendas || []).length === 0 ? (
                <div style={S.sub}>Sin entregas a tiendas en la ventana.</div>
              ) : (
                <ul style={S.lista}>
                  {rot.tiendas.map((t, i) => (
                    <li key={i} style={S.fila}>
                      <span style={S.filaNombre}>
                        {t.tienda}
                        <span style={S.filaDetalle}>
                          {' '}· {t.piezas} pzas{t.litrosParciales ? ' · ≈ incompleto' : ''}
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <RitmoTienda ritmo={t.ritmo} />
                        <span style={S.filaNum}>{t.litros} L</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {(rot.tiendas || []).length > 0 && (
                <div style={S.leyenda}>
                  Flecha: las últimas 2 semanas de cada tienda contra sus 2 anteriores — verde acelera, rojo frena.
                </div>
              )}
              {hayLitrosParciales && (
                <div style={S.honesto}>
                  ≈ incompleto: hubo presentaciones sin equivalencia a litros — las piezas cuentan, los litros de esas líneas no se inventan.
                </div>
              )}
            </section>

            {/* ── 4. Conteos cíclicos ───────────────────────────────────── */}
            <section style={S.card} aria-label="Conteos cíclicos">
              <div style={S.cardHead}>
                <span style={S.dot('var(--lp-warning-600)')} />
                <div style={S.cardLabel}>Conteos cíclicos</div>
              </div>
              <div style={S.big}>
                {cc.finalizados != null ? `${cc.finalizados} de ${cc.meta}` : '—'}
              </div>
              <div style={S.barraMeta} role="progressbar" aria-valuenow={cc.cumplimientoPct || 0} aria-valuemin={0} aria-valuemax={100}>
                <div style={S.barraMetaFill(cc.cumplimientoPct)} />
              </div>
              <Tendencia actual={cc.finalizados} previo={cc.prev?.finalizados} bajarEsBueno={false} etiqueta="conteos vs 4 sem. previas" />
              <div style={S.sub}>
                Meta: {cc.metaNota || '1 por semana'} · cumplimiento {cc.cumplimientoPct != null ? `${cc.cumplimientoPct}%` : '—'}
                {cc.diasDesdeUltimo != null
                  ? ` · último hace ${cc.diasDesdeUltimo} día${cc.diasDesdeUltimo === 1 ? '' : 's'}`
                  : ' · sin conteos cerrados registrados'}
              </div>
            </section>

          </div>
        )}
      </div>
    </>
  );
}
