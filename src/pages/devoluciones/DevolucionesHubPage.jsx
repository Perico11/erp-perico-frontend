/* ════════════════════════════════════════════════════════════════════════════
   DevolucionesHubPage — Pantalla ÚNICA "Devoluciones" para ADMIN (jul 2026,
   simplificación de menús — pedido del dueño).

   Antes el admin tenía DOS entradas de menú: "Devoluciones" (PT cliente→fábrica)
   y "Devol. a proveedor" (MP compras→proveedor). Mismo concepto, dos botones.
   Ahora es UNA entrada con dos vistas (patrón AlmacenPage, P2 21-jul):
     · "De clientes (PT)"   → DevolucionesPage completa
     · "A proveedor (MP)"   → DevolucionesMPPage completa

   CERO acciones perdidas: los dos componentes existentes se montan COMPLETOS
   (prop `embedded` solo suprime su TopBar propio). Estados internos, permisos,
   realtime y deep-links intactos.

   URL: /devoluciones?vista=pt|mp
     - La ruta /devoluciones-mp sigue VIVA (Arely la usa directa y las
       notificaciones `devolucion_mp_pendiente` apuntan ahí).
     - El ?tab= interno de la vista MP (por_gestionar/registrada/merma) convive:
       /devoluciones?vista=mp&tab=merma

   Roles: el selector solo aparece para admin. Técnico/almacén ven directamente
   la de PT (idéntico a antes). Compras no navega aquí (usa /devoluciones-mp).
   ════════════════════════════════════════════════════════════════════════════ */
import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import DevolucionesPage from './DevolucionesPage';
import DevolucionesMPPage from '../devoluciones-mp/DevolucionesMPPage';

const S = {
  segWrap: { display: 'flex', justifyContent: 'flex-start', padding: '10px 16px 0' },
  seg: { display: 'inline-flex', gap: 4, background: 'var(--lp-bg-sunken)', borderRadius: 999, padding: 3 },
  segBtn: (on) => ({
    padding: '9px 18px', minHeight: 40, borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: on ? 700 : 500,
    background: on ? 'var(--lp-brand-600)' : 'transparent', color: on ? '#fff' : 'var(--lp-text-secondary)',
    display: 'inline-flex', alignItems: 'center', gap: 7,
  }),
};

const IcoPT = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
);
const IcoMP = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg>
);

export default function DevolucionesHubPage() {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();

  /* Vista activa: ?vista=mp solo válida para admin (los demás roles de esta
     ruta — técnico/almacén — solo operan la de PT, como siempre). */
  const vista = useMemo(() => {
    return (esAdmin && searchParams.get('vista') === 'mp') ? 'mp' : 'pt';
  }, [searchParams, esAdmin]);

  const setVista = useCallback((v) => {
    /* Cambiar de vista limpia el ?tab= interno de la vista MP para no
       arrastrar deep-links stale. */
    const next = new URLSearchParams(searchParams);
    next.set('vista', v);
    if (v === 'pt') next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div>
      <TopBar title="Devoluciones" />
      {esAdmin && (
        <div style={S.segWrap}>
          <div style={S.seg} role="tablist" aria-label="Tipo de devolución">
            <button type="button" role="tab" aria-selected={vista === 'pt'} data-id="devoluciones.vista.pt"
              style={S.segBtn(vista === 'pt')} onClick={() => setVista('pt')}>
              {IcoPT} De clientes (PT)
            </button>
            <button type="button" role="tab" aria-selected={vista === 'mp'} data-id="devoluciones.vista.mp"
              style={S.segBtn(vista === 'mp')} onClick={() => setVista('mp')}>
              {IcoMP} A proveedor (MP)
            </button>
          </div>
        </div>
      )}
      {vista === 'mp'
        ? <DevolucionesMPPage embedded />
        : <DevolucionesPage embedded />}
    </div>
  );
}
