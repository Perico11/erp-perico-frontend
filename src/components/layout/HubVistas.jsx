/* ════════════════════════════════════════════════════════════════════════════
   HubVistas — contenedor genérico "una entrada de menú, N vistas internas"
   (jul 2026, simplificación de menús del dueño).

   Generaliza el patrón AlmacenPage / DevolucionesHubPage: un TopBar del hub +
   segmented de vistas + la página EXISTENTE montada COMPLETA adentro (los hijos
   reciben `embedded` para suprimir su TopBar propio — nada más). Cero acciones
   perdidas: estados internos, permisos, realtime y deep-links intactos.

   URL: ?vista=<id>. Al cambiar de vista se LIMPIAN los demás query params
   (?tab, ?lote, …) para no arrastrar deep-links stale de la vista anterior;
   al ENTRAR con un deep-link (p.ej. /inventario?tab=stkAmericano) la vista
   default se monta con esos params vivos.

   Con una sola vista no se pinta el selector (mismo criterio que AlmacenPage).
   ════════════════════════════════════════════════════════════════════════════ */
import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from './TopBar';

const S = {
  segWrap: {
    display: 'flex', justifyContent: 'flex-start', padding: '10px 16px 0',
    overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
  },
  seg: { display: 'inline-flex', gap: 4, background: 'var(--lp-bg-sunken)', borderRadius: 999, padding: 3, flex: '0 0 auto' },
  segBtn: (on) => ({
    padding: '9px 16px', minHeight: 40, borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: on ? 700 : 500,
    background: on ? 'var(--lp-brand-600)' : 'transparent', color: on ? '#fff' : 'var(--lp-text-secondary)',
    display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
  }),
};

/**
 * @param {string}  title   Título del TopBar del hub.
 * @param {string}  hubId   Prefijo para data-id de los tabs (p.ej. 'compras').
 * @param {Array}   vistas  [{ id, label, icon?, render: () => JSX }]
 */
export default function HubVistas({ title, hubId, vistas }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const vistaActiva = useMemo(() => {
    const v = searchParams.get('vista');
    return vistas.some(x => x.id === v) ? v : vistas[0].id;
  }, [searchParams, vistas]);

  const setVista = useCallback((id) => {
    setSearchParams(new URLSearchParams({ vista: id }), { replace: true });
  }, [setSearchParams]);

  const activa = vistas.find(v => v.id === vistaActiva) || vistas[0];

  return (
    <div>
      <TopBar title={title} />
      {vistas.length > 1 && (
        <div style={S.segWrap}>
          <div style={S.seg} role="tablist" aria-label={title}>
            {vistas.map(v => (
              <button key={v.id} type="button" role="tab" aria-selected={v.id === vistaActiva}
                data-id={`${hubId || 'hub'}.vista.${v.id}`}
                style={S.segBtn(v.id === vistaActiva)} onClick={() => setVista(v.id)}>
                {v.icon}{v.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {activa.render()}
    </div>
  );
}
