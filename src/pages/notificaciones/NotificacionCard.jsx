/**
 * NotificacionCard — ERP Pinturas El Perico
 * Card de notificación (diseño "MOCKUP NOTIFICACIONES" jun 2026): ícono-app del
 * perico sobre cuadro verde + título + tiempo relativo + subtítulo + área con
 * color semántico. Reemplaza las cards inline de NotificacionesPage.
 *
 * Props:
 *   notif  {object}   — objeto de la API (id, titulo, mensaje, area, severidad, fecha, ruta)
 *   onClick {fn}      — callback al hacer click (recibe notif)
 *   humanizar {fn}    — función humanizar() del módulo existente (opcional)
 */

// ── Colores semánticos por área (tokens LP) ──────────────────────────────────
const AREA_COLOR = {
  inventario: 'var(--lp-danger-600)',
  compras:    'var(--lp-brand-600)',
  costos:     'var(--lp-warning-600)',
  produccion: 'var(--lp-success-600)',
  laboratorio:'#7C3AED',
  ventas:     'var(--lp-success-600)',
  operaciones:'var(--lp-warning-600)',
};

// ── Humaniza fecha a relativo (ahora, hace X min, hace X h) ─────────────────
function tiempoRelativo(fechaISO) {
  if (!fechaISO) return '';
  const diff = Math.floor((Date.now() - new Date(fechaISO)) / 1000);
  if (Number.isNaN(diff)) return '';
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(fechaISO).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

// ── Path del logo (servido estático por nginx en /assets) ───────────────────
const LOGO_PATH = '/assets/logo-perico.svg';

// ── Estilos (variables LP del proyecto) ─────────────────────────────────────
const S = {
  card: (clickeable, sev) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: sev === 'critica' ? 'var(--lp-danger-50)' : 'var(--lp-bg-raised)',
    border: `1.5px solid ${sev === 'critica' ? 'var(--lp-danger-200, #FCA5A5)' : 'var(--lp-border-subtle)'}`,
    borderRadius: 'var(--lp-radius-sm)',
    padding: '10px 12px',
    marginBottom: 8,
    cursor: clickeable ? 'pointer' : 'default',
    transition: 'transform .12s ease, box-shadow .12s ease',
    fontFamily: 'var(--lp-font-sans)',
  }),
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: '#1D9E75',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 7,
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  },
  iconImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    filter: 'brightness(0) invert(1)',
  },
  content: {
    flex: 1,
    minWidth: 0,
    display: 'grid',
    gridTemplateAreas: '"title ago" "sub sub" "area area"',
    gridTemplateColumns: '1fr auto',
    rowGap: 2,
  },
  title: {
    gridArea: 'title',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--lp-text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    paddingRight: 4,
  },
  ago: {
    gridArea: 'ago',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--lp-text-tertiary)',
    whiteSpace: 'nowrap',
  },
  sub: {
    gridArea: 'sub',
    fontSize: 12,
    color: 'var(--lp-text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.4,
  },
  area: (color) => ({
    gridArea: 'area',
    fontSize: 11,
    fontWeight: 600,
    color,
    letterSpacing: '0.02em',
    textTransform: 'capitalize',
  }),
  chevron: {
    fontSize: 14,
    color: 'var(--lp-text-tertiary)',
    flexShrink: 0,
    marginLeft: 4,
  },
};

export default function NotificacionCard({ notif, onClick, humanizar }) {
  const h = humanizar || ((t) => t || '');
  const color = AREA_COLOR[notif.area] || 'var(--lp-brand-600)';
  const clickeable = !!onClick;
  const ago = tiempoRelativo(notif.fecha);

  const handleClick = () => { if (clickeable) onClick(notif); };
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleClick(); };

  return (
    <div
      style={S.card(clickeable, notif.severidad)}
      role={clickeable ? 'button' : undefined}
      tabIndex={clickeable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={clickeable && notif.ruta ? 'Ir a ' + notif.ruta : undefined}
      onMouseEnter={clickeable ? (e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.06)';
      } : undefined}
      onMouseLeave={clickeable ? (e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      } : undefined}
    >
      {/* Ícono app */}
      <div style={S.icon}>
        <img src={LOGO_PATH} alt="ERP Perico" style={S.iconImg} />
      </div>

      {/* Contenido */}
      <div style={S.content}>
        <div style={S.title}>{h(notif.titulo)}</div>
        <div style={S.ago}>{ago}</div>
        {notif.mensaje && (
          <div style={S.sub}>{h(notif.mensaje)}</div>
        )}
        <div style={S.area(color)}>{notif.area || 'general'}</div>
      </div>

      {/* Chevron si es clickeable */}
      {clickeable && <span style={S.chevron} aria-hidden>→</span>}
    </div>
  );
}
