import TopBar from '../components/layout/TopBar';

export default function Placeholder({ title }) {
  return (
    <>
      <TopBar title={title} />
      <div className="px-4 lg:px-6 py-16 text-center">
        <div className="w-16 h-16 bg-sunken rounded-xl mx-auto mb-4 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-tertiary">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-text-primary mb-1">{title}</h2>
        <p className="text-sm text-text-tertiary">Este módulo se está migrando a React. Próximamente disponible.</p>
      </div>
    </>
  );
}
