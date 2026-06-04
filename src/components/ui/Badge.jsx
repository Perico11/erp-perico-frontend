const variants = {
  blue:   'bg-brand-50 text-brand-700 border-brand-200',
  green:  'bg-success-50 text-success-700 border-success-600/20',
  red:    'bg-danger-50 text-danger-600 border-danger-600/20',
  amber:  'bg-warning-50 text-warning-600 border-warning-600/20',
  gray:   'bg-sunken text-text-secondary border-border-subtle',
};

export default function Badge({ variant = 'blue', children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md border
      ${variants[variant] || variants.blue} ${className}`}>
      {children}
    </span>
  );
}
