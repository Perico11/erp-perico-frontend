const baseStyle = {
  display: 'inline-flex', alignItems: 'center',
  padding: '2px 8px', fontSize: 10, fontWeight: 600,
  borderRadius: 6, lineHeight: 1.4, whiteSpace: 'nowrap',
};

export default function StatusBadge({ bg, fg, children, style }) {
  return (
    <span style={{ ...baseStyle, background: bg, color: fg, ...style }}>
      {children}
    </span>
  );
}

const PRESETS = {
  prueba:   { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
  success:  { bg: '#D1FAE5', fg: '#065F46' },
  danger:   { bg: 'var(--lp-danger-100)', fg: 'var(--lp-danger-700)' },
  info:     { bg: '#DBEAFE', fg: '#1E40AF' },
  warning:  { bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-600)' },
  neutral:  { bg: 'var(--lp-bg-subtle)', fg: 'var(--lp-text-secondary)' },
  purple:   { bg: 'var(--lp-qc-50)', fg: 'var(--lp-qc-600)' },
};

export function PresetBadge({ preset = 'neutral', children, style }) {
  const p = PRESETS[preset] || PRESETS.neutral;
  return <StatusBadge bg={p.bg} fg={p.fg} style={style}>{children}</StatusBadge>;
}
