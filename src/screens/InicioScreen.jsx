// InicioScreen.jsx — Pantalla de Inicio/Resumen (presentacional).
// Solo contenido (sin topbar/sidebar/bottom-nav). Estilo con tokens --lp-*.
// Props: data, onAtenderHero, onAbrirPendiente, onAbrirStat, can, role, isDesktop.
// ── Entregado por Claude Design (entrega_react). NO modificar la UI: solo se
//    monta y se le pasan datos reales + callbacks desde DashboardPage. ──
import { useState } from 'react';

const DEMO = {
  saludo: 'Buenas tardes, Enrique',
  fecha: 'jueves, 5 de junio',
  hero: { titulo: '4 lotes esperan tu QC', desc: 'Producidos y listos para revisión de calidad', sev: 'warning', icon: 'qc', ruta: '/produccion' },
  pendientes: [
    { id: 'ord', icon: 'ordenes', sev: 'warning', titulo: 'Órdenes en proceso', desc: 'Producción asignada sin cerrar', folios: 'OP-330 · +4', count: 5, ruta: '/ordenes' },
    { id: 'env', icon: 'stock', sev: 'ok', titulo: 'Por envasar', desc: 'Aprobados de QC, listos para envasar', folios: 'VIN-0890 · +2', count: 3, ruta: '/stock-fabrica' },
    { id: 'qch', icon: 'alert', sev: 'danger', titulo: 'QC retenidos', desc: 'Requieren retrabajo', folios: 'VIN-0876', count: 1, ruta: '/trazabilidad' },
    { id: 'dev', icon: 'devoluciones', sev: 'info', titulo: 'Devoluciones por recibir', desc: 'Producto del cliente por inspeccionar', count: 2, ruta: '/devoluciones' },
  ],
  stats: [
    { label: 'Cubetas / mes', value: '4,820', sub: 'Prom. 6 meses', trend: '+8%', up: true, accent: 'brand', mono: true },
    { label: 'Lotes en flujo', value: '7', sub: '4 envasando · 3 en camino', accent: 'brand', mono: true },
  ],
};

const SEV = {
  danger: 'var(--lp-danger-600)', warning: 'var(--lp-warning-600)',
  info: 'var(--lp-info-600)', ok: 'var(--lp-brand-600)', brand: 'var(--lp-brand-600)',
};
const tint = (c) => `color-mix(in srgb, ${c} 13%, transparent)`;

const PATHS = {
  qc: 'M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.3h12.4a1.5 1.5 0 0 0 1.3-2.3L14 9.5V3M7.5 15h9',
  ordenes: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6M16 13H8M16 17H8',
  stock: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  alert: 'M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z M12 9v4M12 17h.01',
  devoluciones: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5',
  inventario: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.3 7 12 12l8.7-5',
  compras: 'M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 1.9-1.6L22 7H5',
  arrow: 'M5 12h14M13 5l7 7-7 7', chevron: 'M9 6l6 6-6 6',
};
function Icon({ name, size = 20, color = 'currentColor', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      {(PATHS[name] || PATHS.inventario).split(' M').map((d, i) => <path key={i} d={i ? 'M' + d : d} />)}
    </svg>
  );
}

export default function InicioScreen({
  data = DEMO, onAtenderHero, onAbrirPendiente, onAbrirStat,
  can = () => true, role, isDesktop = false,
}) {
  const d = { ...DEMO, ...(data || {}) };
  const pad = isDesktop ? '24px 28px 32px' : '8px 18px 24px';

  const label = (txt, color) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '18px 2px 10px', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: color || 'var(--lp-text-tertiary)' }}>{txt}</div>
  );

  return (
    <div style={{ padding: pad, maxWidth: isDesktop ? 980 : 'none', margin: '0 auto', fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)' }}>
      {/* saludo */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: isDesktop ? 24 : 22, fontWeight: 600, letterSpacing: '-.02em' }}>{d.saludo}</div>
        <div style={{ fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 2, textTransform: 'capitalize' }}>{d.fecha}</div>
      </div>

      {/* hero */}
      {d.hero && (
        <>
          {label('Requiere tu atención', SEV[d.hero.sev])}
          <div data-id="inicio.card.hero" style={{
            position: 'relative', display: 'flex', alignItems: 'center', gap: 14, overflow: 'hidden',
            background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
            borderRadius: 'var(--lp-radius-lg)', padding: '16px 18px',
          }}>
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: SEV[d.hero.sev] }} />
            <div style={{ width: 46, height: 46, borderRadius: 'var(--lp-radius-md)', background: tint(SEV[d.hero.sev]), color: SEV[d.hero.sev], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={d.hero.icon} size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{d.hero.titulo}</div>
              <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2 }}>{d.hero.desc}</div>
            </div>
            <button data-id="inicio.btn.atender-hero" data-rol={role} onClick={() => onAtenderHero?.(d.hero.ruta)} style={{
              flexShrink: 0, height: 44, padding: '0 18px', borderRadius: 'var(--lp-radius-md)', border: 'none', cursor: 'pointer',
              background: 'var(--lp-brand-600)', color: '#fff', fontFamily: 'var(--lp-font-sans)', fontSize: 14, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}>Atender <Icon name="arrow" size={16} color="#fff" /></button>
          </div>
        </>
      )}

      {/* pendientes */}
      {d.pendientes?.length > 0 && (
        <>
          {label('Pendientes')}
          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(2,minmax(0,1fr))' : '1fr', gap: 10 }}>
            {d.pendientes.map((p) => (
              <button key={p.id} data-id={`inicio.card.pendiente.${p.id}`} data-rol={role}
                onClick={() => onAbrirPendiente?.(p.id, p.ruta)} style={{
                  position: 'relative', overflow: 'hidden', textAlign: 'left', cursor: 'pointer', width: '100%',
                  background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)',
                  borderRadius: 'var(--lp-radius-lg)', padding: '14px 15px 14px 17px', fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)',
                }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: SEV[p.sev] }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 'var(--lp-radius-md)', background: tint(SEV[p.sev]), color: SEV[p.sev], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={p.icon} size={18} />
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, lineHeight: 1.25 }}>{p.titulo}</span>
                  <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 13, fontWeight: 700, color: '#fff', background: SEV[p.sev], minWidth: 24, height: 22, padding: '0 7px', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.count}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--lp-text-secondary)', lineHeight: 1.4 }}>{p.desc}</div>
                {p.folios && <div style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 11.5, color: 'var(--lp-brand-700)', marginTop: 6 }}>{p.folios}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--lp-text-tertiary)' }}>
                  Ir al detalle <Icon name="chevron" size={14} color="var(--lp-text-tertiary)" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* stats */}
      {d.stats?.length > 0 && (
        <>
          {label('Tu día')}
          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(4,1fr)' : 'repeat(2,1fr)', gap: 10 }}>
            {d.stats.map((k, i) => (
              <button key={i} data-id={`inicio.stat.${i}`} onClick={() => onAbrirStat?.(k.label)} style={{
                textAlign: 'left', cursor: onAbrirStat ? 'pointer' : 'default', fontFamily: 'var(--lp-font-sans)',
                background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-md)', padding: '13px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: SEV[k.accent || 'brand'] }} />
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--lp-text-tertiary)' }}>{k.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontFamily: k.mono ? 'var(--lp-font-mono)' : 'inherit', fontSize: 21, fontWeight: 700, color: 'var(--lp-text-primary)' }}>{k.value}</span>
                  {k.trend && <span style={{ fontSize: 11, fontWeight: 700, color: k.up ? 'var(--lp-brand-600)' : 'var(--lp-danger-600)' }}>{k.trend}</span>}
                </div>
                {k.sub && <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 3 }}>{k.sub}</div>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
