import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26, 24, 21, 0.5)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'auto',
    padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius)',
    padding: 0,
    maxWidth: 720,
    width: '100%',
    maxHeight: 'calc(var(--pp-vvh, 100dvh) - 16px)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    border: '1.5px solid var(--lp-border-subtle)',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1.5px solid var(--lp-border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--lp-text-primary)',
  },
  close: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 22,
    color: 'var(--lp-text-tertiary)',
    padding: 4,
    lineHeight: 1,
  },
  banner: (color) => ({
    padding: '8px 16px',
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    background: color,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  }),
  iframe: {
    width: '100%',
    height: 380,
    border: 'none',
    display: 'block',
  },
  body: {
    padding: 14,
    fontSize: 12,
    color: 'var(--lp-text-secondary)',
    lineHeight: 1.7,
    fontFamily: 'var(--lp-font-mono)',
  },
  links: {
    display: 'flex',
    gap: 12,
    padding: '0 14px 14px',
    fontSize: 12,
    fontFamily: 'var(--lp-font-sans)',
  },
  link: {
    color: 'var(--lp-brand-600)',
    textDecoration: 'none',
    fontWeight: 600,
  },
  noData: {
    padding: 24,
    fontSize: 13,
    color: 'var(--lp-text-secondary)',
    fontFamily: 'var(--lp-font-sans)',
    lineHeight: 1.6,
  },
};

function precisionInfo(accMeters) {
  if (!accMeters || accMeters >= 10000) return { label: 'IP rough — kilómetros', color: 'var(--lp-danger-600)', span: 22000, warning: true };
  if (accMeters >= 2000) return { label: 'Red celular', color: 'var(--lp-warning-600)', span: 9000, warning: false };
  if (accMeters >= 500) return { label: `WiFi (~${Math.round(accMeters)} m)`, color: 'var(--lp-info-600)', span: 2700, warning: false };
  if (accMeters >= 100) return { label: `WiFi preciso (${Math.round(accMeters)} m)`, color: 'var(--lp-info-600)', span: 900, warning: false };
  return { label: `GPS preciso (${Math.round(accMeters)} m)`, color: 'var(--lp-success-600)', span: 330, warning: false };
}

export default function SesionMapaModal({ sesion, onClose }) {
  /* MÓVIL: bloquea el scroll del fondo y publica --pp-vvh (alto visible real,
     sigue al teclado) que el modal usa en su maxHeight. El componente solo se
     monta cuando hay sesión, así que el lock está activo mientras es visible. */
  useBodyScrollLock(true);
  if (!sesion) return null;
  const lat = sesion.geoLatitud;
  const lng = sesion.geoLongitud;

  if (lat == null || lng == null) {
    return (
      <div style={S.overlay}>
        <div style={S.modal}>
          <div style={S.header}>
            <div style={S.title}>Sin coordenadas GPS</div>
            <button style={S.close} onClick={onClose} aria-label="Cerrar">×</button>
          </div>
          <div style={S.noData}>
            La sesion de <strong>{sesion.usuario}</strong> no registro coordenadas GPS
            {sesion.geoError ? ` (${sesion.geoError})` : ''}.
          </div>
        </div>
      </div>
    );
  }

  const acc = sesion.geoAccuracy || 10000;
  const info = precisionInfo(acc);
  const span = info.span;
  const dLat = (span / 2) / 111000;
  const dLng = (span / 2) / (111000 * Math.cos(lat * Math.PI / 180));
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].join('%2C');
  const osmEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  const gmapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.header}>
          <div style={S.title}>Ubicacion · {sesion.usuario}</div>
          <button style={S.close} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.banner(info.color)}>
          {info.label}
          {info.warning && ' — el punto puede estar a kilometros del lugar real'}
        </div>
        <iframe src={osmEmbed} style={S.iframe} title="Mapa OSM" />
        <div style={S.body}>
          <div>Lat {lat.toFixed(6)} · Lng {lng.toFixed(6)}</div>
          {sesion.geoFuente && <div>Fuente: {sesion.geoFuente}</div>}
          <div>Fecha: {new Date(sesion.fecha).toLocaleString('es-MX')}</div>
          {sesion.ipServidor && <div>IP servidor: {sesion.ipServidor}</div>}
        </div>
        <div style={S.links}>
          <a href={osmLink} target="_blank" rel="noreferrer" style={S.link}>Abrir en OpenStreetMap →</a>
          <a href={gmapsLink} target="_blank" rel="noreferrer" style={S.link}>Abrir en Google Maps →</a>
        </div>
      </div>
    </div>
  );
}
