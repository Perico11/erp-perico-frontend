export default function Card({ accent, className = '', children, onClick, ...props }) {
  return (
    <div
      className={`bg-raised rounded-lg border border-border-subtle overflow-hidden
        ${accent ? 'border-t-3 border-t-' + accent : ''}
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
        ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={`px-4 py-3 border-b border-border-subtle ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }) {
  return <div className={`px-4 py-4 ${className}`}>{children}</div>;
}

export function KPICard({ label, value, sub, accent = 'brand-600', icon }) {
  return (
    <Card className={`border-t-3 border-t-${accent}`}>
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</span>
          {icon && <span className="text-text-tertiary">{icon}</span>}
        </div>
        <div className="text-2xl font-bold font-mono text-text-primary">{value}</div>
        {sub && <div className="text-xs text-text-secondary mt-1">{sub}</div>}
      </div>
    </Card>
  );
}
