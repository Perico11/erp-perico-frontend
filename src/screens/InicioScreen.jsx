// InicioScreen.jsx — Inicio/Resumen (presentacional). 1:1 con Inicio Resumen.html
// (lista de pendientes en UNA tarjeta + hero con verbo + stats "Tu día").
// Solo contenido (sin topbar/sidebar/bottom-nav). Tokens --lp-*.
// Props: data{ saludo, fecha, hero{titulo,desc,sev,icon,ruta,accion?}|null,
//   pendientes[{id,icon,sev,titulo,desc,folios?,count,ruta}], stats[{label,value,sub?,trend?,up?,accent?}] },
//   onAtenderHero(ruta), onAbrirPendiente(id,ruta), onAbrirStat(label), can, role, isDesktop.
const DEMO = {
  saludo: 'Hola, Enrique',
  fecha: 'sábado, 6 de junio',
  hero: { titulo: '4 lotes esperan tu QC', desc: 'Producidos y listos para revisión de calidad', sev: 'warning', icon: 'qc', ruta: '/produccion', accion: 'Revisar' },
  pendientes: [
    { id: 'ord', icon: 'ordenes', sev: 'warning', titulo: 'Órdenes en proceso', desc: 'OP-330 · +4', count: 5, ruta: '/ordenes' },
    { id: 'env', icon: 'stock', sev: 'ok', titulo: 'Por envasar', desc: 'Aprobados de QC · VIN-0890 +2', count: 3, ruta: '/stock-fabrica' },
    { id: 'qch', icon: 'alert', sev: 'danger', titulo: 'QC retenidos', desc: 'Requieren retrabajo · VIN-0876', count: 1, ruta: '/trazabilidad' },
    { id: 'dev', icon: 'devoluciones', sev: 'mut', titulo: 'Devoluciones por recibir', desc: 'Producto del cliente por inspeccionar', count: 2, ruta: '/devoluciones' },
  ],
  stats: [
    { label: 'Cubetas / mes', value: '4,820', sub: 'Prom. 6 meses', trend: '+8%', up: true },
    { label: 'Lotes en flujo', value: '7', sub: '4 envasando · 3 en camino' },
  ],
};

const SEV = {
  danger: 'var(--lp-danger-600)', warning: 'var(--lp-warning-600)',
  info: 'var(--lp-info-600)', ok: 'var(--lp-brand-600)', brand: 'var(--lp-brand-600)',
  mut: 'var(--lp-text-tertiary)',
};
const tint = (c) => `color-mix(in srgb, ${c} 13%, transparent)`;

const PATHS = {
  qc: 'M9 3h6|M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.3h12.4a1.5 1.5 0 0 0 1.3-2.3L14 9.5V3|M7.5 15h9',
  ordenes: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M16 13H8|M16 17H8',
  stock: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M9 22V12h6v10',
  alert: 'M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z|M12 9v4|M12 17h.01',
  devoluciones: 'M3 12a9 9 0 1 0 3-6.7L3 8|M3 3v5h5',
  inventario: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z|M3.3 7 12 12l8.7-5',
  compras: 'M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z|M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z|M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 1.9-1.6L22 7H5',
  chevron: 'M9 6l6 6-6 6',
};
function Icon({ name, size = 19, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(PATHS[name] || PATHS.inventario).split('|').map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

export default function InicioScreen({
  data = DEMO, onAtenderHero, onAbrirPendiente, onAbrirStat,
  can = () => true, role, isDesktop = false,
}) {
  const d = { ...DEMO, ...(data || {}) };

  const Label = ({ children }) => (
    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--lp-text-tertiary)', margin: '18px 2px 10px' }}>{children}</div>
  );

  return (
    <div style={{ padding: isDesktop ? '20px 28px 32px' : '8px 18px 24px', maxWidth: isDesktop ? 980 : 'none', margin: '0 auto', fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)' }}>
      {/* saludo */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.01em' }}>{d.saludo}</div>
        <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2, textTransform: 'capitalize' }}>{d.fecha}</div>
      </div>

      {/* requiere tu atención — hero */}
      {d.hero && (
        <>
          <Label>Requiere tu atención</Label>
          <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 14, background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 18, padding: 16 }}>
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: SEV[d.hero.sev] || SEV.warning }} />
            <span style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tint(SEV[d.hero.sev] || SEV.warning), color: SEV[d.hero.sev] || SEV.warning }}>
              <Icon name={d.hero.icon} size={24} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em' }}>{d.hero.titulo}</div>
              <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2 }}>{d.hero.desc}</div>
            </div>
            <button data-id="inicio.btn.atender-hero" data-rol={role} onClick={() => onAtenderHero?.(d.hero.ruta)}
              style={{ flexShrink: 0, alignSelf: 'stretch', padding: '0 18px', minHeight: 46, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'var(--lp-brand-600)', color: '#fff', fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: 600 }}>
              {d.hero.accion || 'Atender'}
            </button>
          </div>
        </>
      )}

      {/* pendientes — LISTA en una sola tarjeta (1:1 Inicio Resumen.html) */}
      {d.pendientes?.length > 0 && (
        <>
          <Label>Pendientes</Label>
          <div style={{ background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 18, overflow: 'hidden' }}>
            {d.pendientes.map((p, i) => (
              <button key={p.id} data-id={`inicio.row.pendiente.${p.id}`} data-rol={role}
                onClick={() => onAbrirPendiente?.(p.id, p.ruta)}
                style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)', background: 'none', border: 'none', borderBottom: i < d.pendientes.length - 1 ? '1px solid var(--lp-border-subtle)' : 'none' }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tint(SEV[p.sev] || SEV.mut), color: SEV[p.sev] || SEV.mut }}>
                  <Icon name={p.icon} size={18} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{p.titulo}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.folios || p.desc}</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--lp-text-primary)', minWidth: 22, textAlign: 'center' }}>{p.count}</span>
                <Icon name="chevron" size={17} color="var(--lp-text-tertiary)" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* tu día — stats 2-col */}
      {d.stats?.length > 0 && (
        <>
          <Label>Tu día</Label>
          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : '1fr 1fr', gap: 10 }}>
            {d.stats.map((k, i) => (
              <button key={i} data-id={`inicio.stat.${i}`} onClick={() => onAbrirStat?.(k.label)}
                style={{ textAlign: 'left', cursor: onAbrirStat ? 'pointer' : 'default', fontFamily: 'var(--lp-font-sans)', background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--lp-text-tertiary)' }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.01em', marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 7, color: k.valueColor || 'var(--lp-text-primary)' }}>
                  {k.value}
                  {k.trend && <span style={{ fontSize: 11, fontWeight: 600, color: k.up === false ? 'var(--lp-danger-600)' : 'var(--lp-brand-600)' }}>{k.trend}</span>}
                </div>
                {k.sub && <div style={{ fontSize: 11, color: 'var(--lp-text-secondary)', marginTop: 3 }}>{k.sub}</div>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
