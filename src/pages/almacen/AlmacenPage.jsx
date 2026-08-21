/* ════════════════════════════════════════════════════════════════════════════
   AlmacenPage — Pantalla ÚNICA "Almacén" (P2 auditoría, 21-jul-2026).

   Fusión Stock Fábrica + Recepción Terán en una sola entrada de menú con dos
   vistas que siguen el orden físico de la mercancía:
     · "En fábrica"      → StockFabricaPage completa (envasado, QR, enviar a
                            recolectar, re-envasar, pruebas, rechazados…)
     · "Recepción Terán" → AlmacenRecepcionPage completa (escanear QR, OTs
                            surtidas, buffer de TOTEs, recibidos hoy…)

   CERO acciones perdidas: las dos pantallas existentes se montan COMPLETAS
   (prop `embedded` solo suprime su TopBar propio). Sus estados internos,
   permisos, realtime y deep-links siguen intactos.

   URL: /almacen?vista=fabrica|recepcion
     - `vista` es del CONTENEDOR. El `?tab=` interno de Stock Fábrica
       (enFabrica/transferidos/pruebas/rechazados) NO se toca — conviven:
       /almacen?vista=fabrica&tab=transferidos
     - /stock-fabrica redirige aquí con vista=fabrica preservando el resto del
       query (App.jsx). Los deep-links viejos a /almacen (p.ej. ?reenvasar=COD
       del atajo "Re-envasar TOTE") caen a la vista recepción.

   Roles: fabrica = admin/tecnico/almacen (mismo RoleRoute que tenía
   /stock-fabrica); recepción = admin/almacen (tecnico no la ve — Enrique está
   en fábrica). Con una sola vista visible no se pinta el selector.
   ════════════════════════════════════════════════════════════════════════════ */
import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import StockFabricaPage from '../stock-fabrica/StockFabricaPage';
import AlmacenRecepcionPage from '../almacen-recepcion/AlmacenRecepcionPage';

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

const IcoFabrica = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
);
const IcoRecepcion = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);

export default function AlmacenPage() {
  const { user } = useAuth();
  const rol = user?.rol;
  const [searchParams, setSearchParams] = useSearchParams();

  const puedeFabrica = ['admin', 'tecnico', 'almacen'].includes(rol);
  const puedeRecepcion = ['admin', 'almacen'].includes(rol);

  /* Vista activa: 1) ?vista= explícito; 2) deep-links heredados — ?reenvasar
     (atajo de card de pedido) era de Recepción, ?tab/?lote eran los internos de
     Stock Fábrica; 3) default por rol: técnico → fábrica; Josué/admin →
     recepción (su pantalla principal histórica en /almacen). */
  const vista = useMemo(() => {
    const v = searchParams.get('vista');
    if (v === 'fabrica' && puedeFabrica) return 'fabrica';
    if (v === 'recepcion' && puedeRecepcion) return 'recepcion';
    if (searchParams.has('reenvasar') && puedeRecepcion) return 'recepcion';
    if ((searchParams.has('tab') || searchParams.has('lote')) && puedeFabrica) return 'fabrica';
    if (!puedeRecepcion) return 'fabrica';
    if (!puedeFabrica) return 'recepcion';
    return rol === 'tecnico' ? 'fabrica' : 'recepcion';
  }, [searchParams, rol, puedeFabrica, puedeRecepcion]);

  const setVista = useCallback((v) => {
    /* Cambiar de vista limpia los params de la otra pantalla (tab/lote son de
       fábrica; reenvasar es de recepción) para no arrastrar deep-links stale. */
    const next = new URLSearchParams(searchParams);
    next.set('vista', v);
    if (v === 'recepcion') { next.delete('tab'); next.delete('lote'); }
    else next.delete('reenvasar');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const ambas = puedeFabrica && puedeRecepcion;

  return (
    <div>
      <TopBar title="Almacén" />
      {ambas && (
        <div style={S.segWrap}>
          <div style={S.seg} role="tablist" aria-label="Vista de almacén">
            <button type="button" role="tab" aria-selected={vista === 'fabrica'} data-id="almacen.vista.fabrica"
              style={S.segBtn(vista === 'fabrica')} onClick={() => setVista('fabrica')}>
              {IcoFabrica} En fábrica
            </button>
            <button type="button" role="tab" aria-selected={vista === 'recepcion'} data-id="almacen.vista.recepcion"
              style={S.segBtn(vista === 'recepcion')} onClick={() => setVista('recepcion')}>
              {IcoRecepcion} Recepción Terán
            </button>
          </div>
        </div>
      )}
      {vista === 'fabrica'
        ? <StockFabricaPage embedded />
        : <AlmacenRecepcionPage embedded />}
    </div>
  );
}
