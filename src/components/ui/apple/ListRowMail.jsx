/**
 * ListRowMail — fila de lista estilo Apple Mail.
 *
 * Avatar circular con iniciales tinted del color de la categoría,
 * título grande, meta gris debajo, fecha derecha discreta, badge pill
 * del estado abajo. Inspiración: Apple Mail, Messages.
 *
 * Uso:
 *   <ListRowMail
 *     initials="BM"
 *     category="calidad"
 *     title="BLANCO MATE 4.0"
 *     meta="PED-2026-0123 · 8 cubetas · Enrique"
 *     date="hace 2h"
 *     badge={{ label: 'En producción', tone: 'calidad' }}
 *     onClick={() => verPedido()}
 *   />
 *
 * Props:
 *   - initials:  2 letras (ej: "BM" para BLANCO MATE)
 *   - category:  color del avatar — 'inventario' | 'produccion' | 'compras' | 'alertas' | 'calidad' | 'admin' | 'neutro'
 *   - title:     texto principal (1 línea)
 *   - meta:      texto secundario (1 línea, gris)
 *   - date:      fecha/timestamp derecha (gris)
 *   - badge:     { label, tone } — pill colored opcional debajo del meta
 *   - onClick:   click en la row entera
 *   - isLast:    si true, no muestra divisor inferior
 *
 * IMPORTANTE: Usar dentro de un contenedor con borde
 * (ej: <ListGroupMail>) que define el "marco" de la lista.
 */

const CATEGORIES = {
  inventario: { bg: 'var(--lp-cat-inventario-bg)', fg: 'var(--lp-cat-inventario-fg)' },
  produccion: { bg: 'var(--lp-cat-produccion-bg)', fg: 'var(--lp-cat-produccion-fg)' },
  compras:    { bg: 'var(--lp-cat-compras-bg)',    fg: 'var(--lp-cat-compras-fg)' },
  alertas:    { bg: 'var(--lp-cat-alertas-bg)',    fg: 'var(--lp-cat-alertas-fg)' },
  calidad:    { bg: 'var(--lp-cat-calidad-bg)',    fg: 'var(--lp-cat-calidad-fg)' },
  admin:      { bg: 'var(--lp-cat-admin-bg)',      fg: 'var(--lp-cat-admin-fg)' },
  neutro:     { bg: 'var(--lp-cat-neutro-bg)',     fg: 'var(--lp-cat-neutro-fg)' },
};

export default function ListRowMail({
  initials,
  category = 'neutro',
  title,
  meta,
  date,
  badge,
  onClick,
  isLast = false,
  style,
}) {
  const cat = CATEGORIES[category] || CATEGORIES.neutro;
  const badgeCat = badge ? (CATEGORIES[badge.tone] || CATEGORIES.neutro) : null;
  const clickable = typeof onClick === 'function';
  const Wrap = clickable ? 'button' : 'div';

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderBottom: isLast ? 'none' : '0.5px solid var(--lp-border-subtle)',
    background: 'transparent',
    border: 'none',
    width: '100%',
    cursor: clickable ? 'pointer' : 'default',
    fontFamily: 'var(--lp-font-sans)',
    textAlign: 'left',
    ...style,
  };

  return (
    <Wrap {...(clickable ? { type: 'button', onClick } : {})} style={rowStyle}>
      {initials && (
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: cat.bg, color: cat.fg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          {title && (
            <div style={{
              fontSize: 14, fontWeight: 600, color: 'var(--lp-text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{title}</div>
          )}
          {date && (
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', flexShrink: 0 }}>{date}</div>
          )}
        </div>
        {meta && (
          <div style={{
            fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{meta}</div>
        )}
        {badge && badgeCat && (
          <div style={{
            display: 'inline-flex',
            padding: '2px 9px',
            background: badgeCat.bg, color: badgeCat.fg,
            fontSize: 10, fontWeight: 600,
            borderRadius: 'var(--lp-radius-pill)',
            marginTop: 6,
          }}>{badge.label}</div>
        )}
      </div>
    </Wrap>
  );
}

/** Contenedor para varios ListRowMail. Define el marco con border + radius. */
export function ListGroupMail({ children, style }) {
  return (
    <div style={{
      background: 'var(--lp-bg-raised)',
      borderRadius: 'var(--lp-radius-lg)',
      border: '0.5px solid var(--lp-border-subtle)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}
