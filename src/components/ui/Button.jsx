const variants = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-raised text-text-primary border border-border-subtle hover:bg-sunken',
  danger:    'bg-danger-600 text-white hover:bg-danger-700',
  ghost:     'text-text-secondary hover:bg-sunken hover:text-text-primary',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-sm
        transition-colors duration-150 cursor-pointer min-h-[44px]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
