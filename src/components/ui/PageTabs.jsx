/* PageTabs — fila de pestañas horizontal con scroll automático.
   En móvil los textos largos se encimaban porque los buttons recibían
   flex-shrink default (1) y se apretaban. Ahora cada button tiene
   flex-shrink:0 forzado, scroll horizontal con momentum en iOS, y la
   scrollbar oculta. Acepta el style del caller en el contenedor pero
   garantiza overflow:auto y scrollbar:hidden de fondo. */

const containerBase = {
  display: 'flex',
  gap: 0,
  overflowX: 'auto',
  overflowY: 'hidden',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

const btnBase = {
  flexShrink: 0,            /* clave: NO encogerse en móvil */
  whiteSpace: 'nowrap',     /* no romper el label en 2 líneas */
};

export default function PageTabs({ tabs, activeTab, onChange, style }) {
  return (
    <div
      role="tablist"
      aria-label="Navegación de pestañas"
      style={{ ...containerBase, ...style }}
      className="page-tabs-scroll"
    >
      {tabs.map((t) => {
        const id = typeof t === 'string' ? t : t.id;
        const label = typeof t === 'string' ? t : t.label;
        const isActive = id === activeTab;
        const userStyle = (typeof t === 'object' && t.style) ? t.style(isActive) : {};
        return (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => {
              const ids = tabs.map(x => typeof x === 'string' ? x : x.id);
              const idx = ids.indexOf(id);
              if (e.key === 'ArrowRight') { e.preventDefault(); onChange(ids[(idx + 1) % ids.length]); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(ids[(idx - 1 + ids.length) % ids.length]); }
            }}
            style={{ ...btnBase, ...userStyle }}
            className={typeof t === 'object' && t.className ? t.className(isActive) : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, activeTab, children }) {
  if (id !== activeTab) return null;
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}
