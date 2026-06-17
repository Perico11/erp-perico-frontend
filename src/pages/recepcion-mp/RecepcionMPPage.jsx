import { useMemo } from 'react';
import TopBar from '../../components/layout/TopBar';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import OCCard from '../compras/components/OCCard';

/* ════════════════════════════════════════════════════════════════════════
   Recepción de MP (Enrique / técnico) — pedido dueño jun 2026.

   El botón y el flujo de "Recibir MP" vivían SOLO en la pantalla de Compras
   (ruta admin+compras), a la que el técnico no entra. El backend SÍ permite a
   Enrique leer OCs (GET /api/compras/oc admite tecnico) y recibir
   (POST /api/compras/oc/recibir = "Solo Enrique o Admin"), sin exigir el pago.

   Esta pantalla le da a Enrique SU superficie: lista las OCs aprobadas con
   destino Fábrica y reusa OCCard, que gatea sus botones por can() →
   para el técnico solo queda "Recibir MP" (aprobar/editar/pagar/eliminar
   requieren can('compras')/can('configuracion')). Los badges de crédito
   (días / vencimiento) se muestran sin gate, sólo informativos.

   NO se requiere que la OC esté pagada para recibir (filtro = aprobada, no
   pagada): la recepción física no depende del pago a crédito.
   ════════════════════════════════════════════════════════════════════════ */

const S = {
  wrap: { padding: '0 20px 100px' },
  intro: {
    fontSize: 12.5, color: 'var(--lp-text-secondary)', background: 'var(--lp-bg-raised)',
    border: '1px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-sm)',
    padding: '10px 13px', marginBottom: 14, lineHeight: 1.5,
  },
  empty: { textAlign: 'center', padding: '48px 0', fontSize: 13, color: 'var(--lp-text-tertiary)' },
  spinner: { display: 'flex', justifyContent: 'center', padding: '48px 0' },
  count: { fontSize: 12, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 10px' },
};

export default function RecepcionMPPage() {
  const { data, loading, reload } = useApiData(() => api.getOCs(), null, 30000);

  /* Realtime: cuando Arely aprueba/edita una OC o entra MP, refrescamos. */
  useRealtimeSync({
    onOc: () => reload(),
    onInventario: () => reload(),
  });

  /* OCs por recibir EN FÁBRICA: aprobadas, no recibidas/eliminadas y destino
     Fábrica (las de Terán las recibe Josué en /almacen). El pago NO entra en el
     filtro — se puede recibir una OC a crédito aún sin liquidar. */
  const ocs = useMemo(() => {
    const arr = Array.isArray(data) ? data : (data?.data || []);
    return arr
      .filter((oc) => {
        const activa = oc.estado !== 'recibida' && oc.estado !== 'eliminada' && !oc.eliminada;
        const destinoFabrica = (oc.almacenDestino || 'Fabrica') !== 'Teran';
        return activa && oc.aprobada && destinoFabrica;
      })
      .sort((a, b) => {
        const fa = new Date(a.fechaEntregaEstimada || a.fechaCreacion || 0).getTime();
        const fb = new Date(b.fechaEntregaEstimada || b.fechaCreacion || 0).getTime();
        return fa - fb;
      });
  }, [data]);

  return (
    <div>
      <TopBar title="Recepción de MP" />
      <div style={S.wrap}>
        <div style={S.intro}>
          Órdenes de compra aprobadas que llegan a <strong>Fábrica</strong>. Cuando recibas el
          material, abre la OC y pulsa <strong>Recibir MP</strong>: captura los kg recibidos, firma y
          el mini-QC. No necesitas esperar a que esté pagada.
        </div>

        {loading ? (
          <div style={S.spinner}><div className="lp-spinner" /></div>
        ) : ocs.length === 0 ? (
          <div style={S.empty}>No hay materia prima por recibir en Fábrica.</div>
        ) : (
          <>
            <div style={S.count}>{ocs.length} OC{ocs.length === 1 ? '' : 's'} por recibir</div>
            {ocs.map((oc) => (
              <OCCard key={oc.id} oc={oc} onRefresh={reload} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
