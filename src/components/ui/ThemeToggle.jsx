import { useEffect, useState } from 'react';
import { getActiveTheme, toggleTheme } from '../../utils/theme';

/* ThemeToggle — botón sol/luna para alternar claro/oscuro (HANDOFF jun 2026).
   Refleja el tema activo y escucha cambios de otros tabs vía 'pp-theme-change'. */
export default function ThemeToggle({ style }) {
  const [theme, setThemeState] = useState(() => getActiveTheme());

  useEffect(() => {
    const onChange = (e) => setThemeState(e?.detail || getActiveTheme());
    window.addEventListener('pp-theme-change', onChange);
    return () => window.removeEventListener('pp-theme-change', onChange);
  }, []);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setThemeState(toggleTheme())}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{
        background: 'none', border: 'none', padding: 12,
        minWidth: 44, minHeight: 44, borderRadius: 'var(--lp-radius-sm)',
        cursor: 'pointer', color: 'var(--lp-text-tertiary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      {isDark ? (
        /* Sol — está oscuro, ofrecer claro */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : (
        /* Luna — está claro, ofrecer oscuro */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}
