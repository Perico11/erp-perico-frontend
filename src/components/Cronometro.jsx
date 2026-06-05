import { useState, useEffect } from 'react';

/* Ícono SVG line de reloj (reemplaza el emoji ⏱ por defecto).
   stroke="currentColor" → hereda el color del cronómetro. */
function IconoReloj({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2" />
      <path d="M9 2h6" />
    </svg>
  );
}

/**
 * Cronómetro vivo: muestra tiempo transcurrido desde `desde` (ISO string).
 * Se actualiza cada segundo. Si `desde` no es válida, muestra "—".
 *
 * Props:
 *  - desde: string ISO (ej: "2026-05-08T10:30:00Z")
 *  - compact: bool — formato compacto "HH:MM" en vez de "HH:MM:SS"
 *  - color: bg color override
 *  - prefix: nodo antes del cronómetro (default: ícono SVG de reloj)
 */
export default function Cronometro({ desde, compact = false, color, prefix }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!desde) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [desde]);

  if (!desde) return null;

  const start = new Date(desde).getTime();
  if (isNaN(start)) return null;

  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  const label = compact
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  /* Color según duración: verde <1h, ámbar 1-3h, rojo >3h */
  const auto = elapsed < 3600
    ? 'var(--lp-success-600)'
    : elapsed < 10800
      ? 'var(--lp-warning-600)'
      : 'var(--lp-danger-600)';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px',
      background: (color || auto) + '22',
      color: color || auto,
      borderRadius: 6,
      fontSize: 11, fontWeight: 700,
      fontFamily: 'var(--lp-font-mono)',
      letterSpacing: '.04em',
      whiteSpace: 'nowrap',
    }} title={`Iniciado: ${new Date(desde).toLocaleString('es-MX')}`}>
      <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11 }}>
        {prefix == null ? <IconoReloj size={13} /> : prefix}
      </span>
      {label}
    </span>
  );
}
