/* Componente Logo reutilizable.
   Resuelve el path correcto bajo cualquier base path (/sistema o /).
   Variantes disponibles:
     - el-perico            cuadrado completo (mascota + texto)
     - el-perico-horizontal  banda horizontal (icono + texto al lado)
     - el-perico-icono       solo el circulo con la mascota
     - el-perico-blanco      version monocroma blanca (para fondos oscuros)
     - el-perico-negro       version monocroma negra (para watermark)
     - astra-cover           logo Astra Cover (Z morada sobre negro)
*/
const VARIANTS = {
  'el-perico':            'el-perico.png',
  'el-perico-horizontal': 'el-perico-horizontal.png',
  'el-perico-icono':      'el-perico-icono.png',
  'el-perico-blanco':     'Logo blanco.png',
  'el-perico-negro':      'Logo negro.png',
  'astra-cover':          'astra-cover.png',
  /* Silueta verde del perico (SVG mono #0f7a5a) — marca del Design System verde. */
  'perico-green':         'logo-perico-green.svg',
};

function getBase() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) {
      return import.meta.env.BASE_URL.replace(/\/$/, '');
    }
  } catch {}
  return '';
}

export default function Logo({ variant = 'el-perico', size, width, height, alt, style, ...rest }) {
  const file = VARIANTS[variant] || VARIANTS['el-perico'];
  /* encodeURI maneja los nombres con espacios (Logo blanco.png -> Logo%20blanco.png) */
  const src = getBase() + '/logos/' + encodeURIComponent(file);
  const finalAlt = alt || (variant.includes('astra') ? 'Astra Cover' : 'Pinturas El Perico');
  const w = width || size;
  const h = height || size;
  return (
    <img
      src={src}
      alt={finalAlt}
      draggable={false}
      style={{
        objectFit: 'contain',
        display: 'block',
        userSelect: 'none',
        WebkitUserDrag: 'none',
        ...(w ? { width: w } : {}),
        ...(h ? { height: h } : {}),
        ...style,
      }}
      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
      {...rest}
    />
  );
}
