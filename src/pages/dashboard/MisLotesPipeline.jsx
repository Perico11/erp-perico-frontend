/* MisLotesPipeline — Sprint H (jun 2026, decisión owner).

   Card que se monta en el Dashboard de los roles ALMACEN (Josué) y RECOLECTOR
   (Luis) para que vean los lotes activos con su status timeline desde que
   Enrique los acepta. Antes solo se enteraban cuando el lote ya estaba en
   recolección o entregado — invisibilidad operativa.

   Filtros por rol:
   - almacen (Josué): TODOS los lotes activos vinculados a pedidos (suyos o
     genéricos). Ve el pipeline desde 'aceptado' hasta 'entregado'.
   - recolector (Luis): lotes en estados envasado→en_camino. Lo importante
     para él es "listo para recolección".

   Status timeline visual: 7 puntos representando los estados clave.
   Click en una card → navega a la pantalla correspondiente del rol.
*/
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import PruebaBadge from '../../components/ui/PruebaBadge';
/* Checkpoint B (handoff Claude Design jun 2026): el timeline horizontal de
   puntos se sustituye por el riel VERTICAL canónico con icono + responsable
   + hora por etapa. Las etapas y el mapeo de estados viven en el módulo
   compartido (espejo de los PASOS que antes estaban aquí + 'pedido'). */
import { RutaPedidoRail, ETAPAS_PEDIDO, idxEtapaLote, CK_COLOR } from '../../components/pipeline/Checkpoint';

const S = {
  card: {
    background: 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)',
    padding: 14, marginBottom: 16,
  },
  title: {
    fontSize: 13, fontWeight: 700, color: 'var(--lp-brand-700)',
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.04em',
  },
  empty: {
    padding: 16, textAlign: 'center', fontSize: 12,
    color: 'var(--lp-text-tertiary)',
  },
  loteRow: {
    padding: '10px 0', borderBottom: '1px solid var(--lp-border-subtle)',
    cursor: 'pointer',
  },
  loteHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6, gap: 8,
  },
  loteCodigo: {
    fontFamily: 'var(--lp-font-mono)', fontSize: 11, fontWeight: 600,
    color: 'var(--lp-text-primary)',
  },
  loteProducto: {
    fontSize: 13, fontWeight: 600, color: 'var(--lp-text-primary)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    flex: 1, minWidth: 0,
  },
  loteCantidad: {
    fontSize: 11, color: 'var(--lp-text-tertiary)',
  },
  badge: (color) => ({
    display: 'inline-block', padding: '2px 8px',
    borderRadius: 10, fontSize: 10, fontWeight: 600,
    background: color, color: '#fff', whiteSpace: 'nowrap',
  }),
  /* (jun 2026, handoff Claude Design) Los estilos del timeline horizontal de
     puntos se sustituyeron por el riel de components/pipeline/Checkpoint.jsx. */
};

function LoteCard({ lote, onClick }) {
  const esHold = lote.estado === 'qc_hold';
  const idxActual = idxEtapaLote(lote.estado);
  const etapaActual = ETAPAS_PEDIDO[idxActual];
  const labelEstado = esHold ? 'QC retenido' : etapaActual.label;
  const colorEstado = esHold ? CK_COLOR.danger : CK_COLOR[etapaActual.color];

  return (
    <div style={S.loteRow}>
      {/* Header clickeable → navega a la pantalla del rol (el riel no navega
          para permitir scroll/lectura sin brincos). */}
      <div style={{ ...S.loteHeader, cursor: 'pointer' }} onClick={onClick} role="button">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={S.loteCodigo}>{lote.codigoLote || lote.codigo || lote.id}</span>
          {lote.esPrueba && <PruebaBadge size="sm" />}
          <span style={S.loteProducto}>{lote.producto || lote.nombre || lote.formula || '-'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={S.loteCantidad}>{lote.cantidad || '?'} {lote.litPerUnit === 19 ? 'cub' : 'u'}</span>
          <span style={S.badge(colorEstado)}>{labelEstado}</span>
        </div>
      </div>
      {/* Checkpoint B: riel vertical con responsable + hora por etapa */}
      <div style={{ marginTop: 10 }}>
        <RutaPedidoRail lote={lote} />
      </div>
    </div>
  );
}

export default function MisLotesPipeline({ rol }) {
  const navigate = useNavigate();
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = () => {
    api.getTrazabilidad().then(r => {
      const arr = r?.data || (Array.isArray(r) ? r : []);
      setLotes(Array.isArray(arr) ? arr : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  /* Sync en tiempo real con eventos del state machine */
  useRealtimeSync({
    onTrazabilidad: () => cargar(),
  });

  const lotesFiltrados = useMemo(() => {
    /* X4 (jun 2026): YA NO excluimos pruebas — la regla canónica del owner es
       que las pruebas se comportan IDÉNTICAS al flujo real y deben mostrarse
       en TODA la UI, solo que con el badge visible. Excluirlas silenciaba el
       hecho de que un lote de prueba estaba en el pipeline (operario perdido
       buscando dónde fue). El badge en LoteCard las hace inconfundibles. */
    let activos = lotes.filter(l => l && !l.eliminado);
    /* Excluir terminales */
    activos = activos.filter(l => !['entregado', 'cancelado', 'rechazado'].includes(l.estado));

    if (rol === 'recolector') {
      /* Luis: solo lo que está listo o en camino.
         FIX jun 2026 (K10): incluir 'en_proceso' — calcularEstadoLote() hace
         roll-up a 'en_proceso' cuando algunos sublotes están en_camino y otros
         siguen en envasado. Sin este estado, en cuanto Luis recoge UN sublote
         de un lote multi-sublote, el lote DESAPARECÍA de su pipeline aunque
         quedaran sublotes por recoger. Bug operativo grave en recolección parcial. */
      activos = activos.filter(l => ['envasado', 'en_recoleccion', 'en_camino', 'en_proceso'].includes(l.estado));
    }
    /* almacen (Josué): ve TODOS los activos */
    /* Ordenar por estado más avanzado primero */
    activos.sort((a, b) => idxEtapaLote(b.estado) - idxEtapaLote(a.estado));
    return activos;
  }, [lotes, rol]);

  if (loading) return null; /* no mostrar nada mientras carga */

  const titulo = rol === 'recolector'
    ? `Lotes listos para recolectar (${lotesFiltrados.length})`
    : `Mis lotes activos (${lotesFiltrados.length})`;

  const navTarget = rol === 'recolector' ? '/recoleccion' : '/almacen';

  return (
    <div style={S.card}>
      <div style={S.title}>{titulo}</div>
      {lotesFiltrados.length === 0 ? (
        <div style={S.empty}>
          {rol === 'recolector'
            ? 'No hay lotes listos para recoger en este momento.'
            : 'No hay lotes activos. Cuando Enrique acepte un pedido, aparecerá aquí con su status en tiempo real.'}
        </div>
      ) : (
        lotesFiltrados.slice(0, 8).map(lote => (
          <LoteCard
            key={lote.id || lote.codigoLote}
            lote={lote}
            onClick={() => navigate(navTarget)}
          />
        ))
      )}
      {lotesFiltrados.length > 8 && (
        <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
          +{lotesFiltrados.length - 8} más en <span onClick={() => navigate(navTarget)} style={{ color: 'var(--lp-brand-600)', cursor: 'pointer', textDecoration: 'underline' }}>{navTarget}</span>
        </div>
      )}
    </div>
  );
}
