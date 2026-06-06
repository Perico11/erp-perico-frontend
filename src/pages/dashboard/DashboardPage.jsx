import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import MisLotesPipeline from './MisLotesPipeline';
import InicioScreen from '../../screens/InicioScreen';
import {
  ESTADO_PEDIDO_PENDIENTE as PEND_PEDIDOS,
  ESTADO_ORDEN_PENDIENTE as PEND_ORDENES,
  ESTADO_LOTE_PRE_QC as PEND_PRODUCCION,
  ESTADO_LOTE_QC as PEND_QC,
  ESTADO_LOTE_ENVASANDO as PEND_ENVASADO,
  ESTADO_LOTE_RECOLECCION as PEND_RECOLECCION,
  ESTADO_LOTE_EN_CAMINO as PEND_ALMACEN,
} from '../../lib/estados';

/* ════════════════════════════════════════════════════════════════════
   Inicio / Dashboard — INTEGRACIÓN del componente de Claude Design.
   La UI la dueña `screens/InicioScreen.jsx` (entrega_react, presentacional).
   Aquí SOLO: fetch + cómputo de pendientes/KPIs por rol + realtime, y se
   mapea a la forma `data` de InicioScreen (saludo, fecha, hero, pendientes,
   stats) + se cablean los callbacks a navigate. Lógica por rol y exclusión
   esPrueba intactas.
   ════════════════════════════════════════════════════════════════════ */

const ACC = {
  brand: 'var(--lp-brand-600)', info: 'var(--lp-info-600)',
  amber: 'var(--lp-warning-600)', amberHi: 'var(--lp-warning-700)',
  crit: 'var(--lp-danger-600)', critHi: 'var(--lp-danger-700)',
  ok: 'var(--lp-success-600)', mut: 'var(--lp-border-strong)',
};
const fmt$ = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');

const S = {
  wrap: { padding: '8px 18px 24px' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 12, borderRadius: 'var(--lp-radius-sm)', fontSize: 13, margin: '12px 18px' },
  loading: { textAlign: 'center', padding: '40px 0', color: 'var(--lp-text-tertiary)', fontSize: 13 },
};

export default function DashboardPage() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [trazabilidad, setTrazabilidad] = useState([]);
  const [ocs, setOCs] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);
  const [conteosPend, setConteosPend] = useState([]);

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getDashboardExec().then(r => r.data).catch(() => null),
      api.getPedidos().then(r => r.data || []).catch(() => []),
      api.getOrdenes().then(r => r.data || []).catch(() => []),
      api.getTrazabilidad().then(r => r.data || []).catch(() => []),
      api.getOCs().then(r => r.data || r.ocs || []).catch(() => []),
      api.getDevoluciones().then(r => Array.isArray(r) ? r : (r.data || [])).catch(() => []),
      api.get('/api/reportes/calendario-conteos').then(r => r.data || r.items || []).catch(() => []),
    ]).then(([exec, peds, ords, trz, ocList, devs, conteos]) => {
      setData(exec);
      setPedidos(Array.isArray(peds) ? peds : []);
      setOrdenes(Array.isArray(ords) ? ords : []);
      setTrazabilidad(Array.isArray(trz) ? trz : []);
      setOCs(Array.isArray(ocList) ? ocList : []);
      setDevoluciones(Array.isArray(devs) ? devs : []);
      setConteosPend(Array.isArray(conteos) ? conteos : []);
    }).catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useRealtimeSync({
    onInventario: () => cargar(), onOc: () => cargar(),
    onTrazabilidad: () => cargar(), onPedidos: () => cargar(), onOrdenes: () => cargar(),
  });

  const fechaHoy = (() => {
    const f = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    return f.charAt(0).toUpperCase() + f.slice(1);
  })();

  /* Pendientes por rol — excluye esPrueba (no es operación real). */
  const tareas = useMemo(() => {
    const noEliminado = (x) => !x?.eliminado && !x?.cancelado && !x?.esPrueba;
    const peds = (pedidos || []).filter(noEliminado);
    const ords = (ordenes || []).filter(noEliminado);
    const lotes = (trazabilidad || []).filter(noEliminado);
    const ocList = (ocs || []).filter(noEliminado);
    const lc = (s) => (s || '').toLowerCase();

    const pedidosPendientes = peds.filter(p => PEND_PEDIDOS.includes(lc(p.estado)));
    const ordenesPendientes = ords.filter(o => PEND_ORDENES.includes(lc(o.estado)));
    const lotesProducidos = lotes.filter(l => PEND_PRODUCCION.includes(lc(l.estado)));
    const lotesQC = lotes.filter(l => PEND_QC.includes(lc(l.estado)));
    const lotesEnvasado = lotes.filter(l => PEND_ENVASADO.includes(lc(l.estado)));
    const lotesRecoleccion = lotes.filter(l => PEND_RECOLECCION.includes(lc(l.estado)));
    const lotesEnCamino = lotes.filter(l => PEND_ALMACEN.includes(lc(l.estado)));
    const ocsActivas = ocList.filter(oc => !oc.recibida && !['cancelada', 'eliminada'].includes(lc(oc.estado)));
    const ocsVencidas = ocsActivas.filter(oc => {
      if (!oc.fechaEntrega) return false;
      try { return new Date(oc.fechaEntrega) < new Date(); } catch { return false; }
    });
    const devsPendRecibir = (devoluciones || []).filter(d => d && d.estado === 'pendiente');
    const devsPorReembolsar = (devoluciones || []).filter(d => d && d.disposicion === 'regresar' && !d.reembolsoEmitido);
    const ocsPorAprobar = ocList.filter(oc => {
      const est = lc(oc.estado);
      return est === 'pendiente_aprobacion' || (!oc.proveedor && est !== 'recibida');
    });
    const conteosVencidos = (conteosPend || []).filter(c => c && (c.vencido || c.estado === 'vencido' || c.diasRestantes < 0));

    return {
      pedidosPendientes, ordenesPendientes, lotesProducidos, lotesQC, lotesEnvasado,
      lotesRecoleccion, lotesEnCamino, ocsActivas, ocsVencidas,
      devsPendRecibir, devsPorReembolsar, ocsPorAprobar, conteosVencidos,
    };
  }, [pedidos, ordenes, trazabilidad, ocs, devoluciones, conteosPend]);

  const muestraNombres = (arr, key = 'codigoLote', n = 3) => {
    if (!arr.length) return '';
    return arr.slice(0, n).map(x => x[key] || x.codigo || x.id || '?').join(' · ')
      + (arr.length > n ? ` · +${arr.length - n}` : '');
  };

  /* Tarjetas de pendientes por rol.
     FIX raíz (jun 2026): se gatean por el PERMISO REAL de cada pantalla — NO por
     can('tecnico')/can('almacen')/can('recolector'), que NO son permisos (no existen
     en permisos_roles) y por tanto can() siempre devolvía false → "Órdenes en proceso",
     "QC retenidos" y "Por envasar" jamás se creaban para Enrique. Donde la tarjeta es
     genuinamente específica de un rol (recepción en Terán) se usa user.rol. */
  const esRol = (...rs) => rs.includes(user?.rol);
  const cards = [
    can('crearPedidos') ? { key: 'pedidos', titulo: 'Pedidos por preparar', desc: 'Pedidos de almacén esperando crear orden', count: tareas.pedidosPendientes.length, items: muestraNombres(tareas.pedidosPendientes, 'codigo'), accent: ACC.info, ruta: '/pedidos' } : null,
    can('ordenes') ? { key: 'ordenes', titulo: 'Órdenes en proceso', desc: 'Producción asignada que aún no se cierra', count: tareas.ordenesPendientes.length, items: muestraNombres(tareas.ordenesPendientes, 'codigo'), accent: ACC.amber, ruta: '/ordenes' } : null,
    can('registrarQC') ? { key: 'qc', titulo: 'QC por hacer', desc: 'Lotes producidos esperando revisión de calidad', count: tareas.lotesProducidos.length, items: muestraNombres(tareas.lotesProducidos), accent: ACC.amberHi, ruta: '/produccion' } : null,
    can('registrarQC') ? { key: 'qc-hold', titulo: 'QC retenidos', desc: 'Lotes con problemas de calidad que requieren retrabajo', count: tareas.lotesQC.length, items: muestraNombres(tareas.lotesQC), accent: ACC.crit, ruta: '/produccion' } : null,
    can('envasado') ? { key: 'envasado', titulo: 'Por envasar', desc: 'Lotes aprobados de QC, listos para envasar', count: tareas.lotesEnvasado.length, items: muestraNombres(tareas.lotesEnvasado), accent: ACC.brand, ruta: '/stock-fabrica' } : null,
    can('recoleccion') ? { key: 'recoleccion', titulo: 'Por recolectar', desc: 'Lotes envasados esperando a Luis', count: tareas.lotesRecoleccion.length, items: muestraNombres(tareas.lotesRecoleccion), accent: ACC.ok, ruta: '/recoleccion' } : null,
    esRol('admin', 'almacen') ? { key: 'almacen', titulo: 'En camino a Almacén', desc: 'Luis ya escaneó, esperando confirmación de recepción', count: tareas.lotesEnCamino.length, items: muestraNombres(tareas.lotesEnCamino), accent: ACC.info, ruta: '/almacen' } : null,
    can('compras') ? { key: 'oc-vencidas', titulo: 'OCs vencidas', desc: 'Órdenes de compra que pasaron fecha de entrega', count: tareas.ocsVencidas.length, items: muestraNombres(tareas.ocsVencidas, 'codigo'), accent: ACC.critHi, ruta: '/compras' } : null,
    can('compras') ? { key: 'ocs-por-aprobar', titulo: 'OCs por aprobar', desc: 'Solicitudes pendientes de asignar proveedor/precio', count: tareas.ocsPorAprobar.length, items: muestraNombres(tareas.ocsPorAprobar, 'codigo'), accent: ACC.amber, ruta: '/compras' } : null,
    (can('produccion') || esRol('admin')) ? { key: 'dev-recibir', titulo: 'Devoluciones por recibir', desc: 'Producto del cliente por inspeccionar en fábrica', count: tareas.devsPendRecibir.length, items: muestraNombres(tareas.devsPendRecibir, 'id'), accent: ACC.info, ruta: '/devoluciones' } : null,
    can('compras') ? { key: 'dev-reembolsar', titulo: 'Reembolsos por emitir', desc: 'Devoluciones regresadas a stock que necesitan nota de crédito', count: tareas.devsPorReembolsar.length, items: muestraNombres(tareas.devsPorReembolsar, 'cliente'), accent: ACC.amberHi, ruta: '/devoluciones' } : null,
    can('conteoFisico') ? { key: 'conteos-vencidos', titulo: 'Conteos vencidos', desc: 'MPs/PT que el calendario indica contar ya', count: tareas.conteosVencidos.length, items: muestraNombres(tareas.conteosVencidos, 'item') || muestraNombres(tareas.conteosVencidos, 'nombre'), accent: ACC.crit, ruta: '/conteo' } : null,
  ].filter(Boolean);

  const d = data || { produccion: {}, inventario: {}, compras: {}, margenes: {}, trazabilidad: {}, devoluciones: {} };

  /* Severidad → el hero es el pendiente más urgente, no el primero del array. */
  const SEV = { [ACC.crit]: 6, [ACC.critHi]: 6, [ACC.amberHi]: 5, [ACC.amber]: 4, [ACC.brand]: 3, [ACC.info]: 2, [ACC.ok]: 1, [ACC.mut]: 0 };
  /* HERO = pendiente más urgente con count>0 (o null → "Todo al día").
     LISTA Pendientes = TODAS las categorías del rol (incluso en CERO), excepto
     la que ya ocupa el hero. Así el rol siempre ve sus categorías como el documento. */
  const allCards = cards.map((c, i) => ({ ...c, _idx: i, _sev: SEV[c.accent] ?? 0 }));
  const heroCard = allCards.filter(c => c.count > 0).sort((a, b) => (b._sev - a._sev) || (a._idx - b._idx))[0] || null;
  const pendientesCards = allCards.filter(c => !heroCard || c.key !== heroCard.key);

  /* "Tu día" — KPIs reales del rol. */
  const tuDia = (() => {
    const out = [];
    /* Gating por PERMISO REAL (no por can('tecnico')/can('almacen') que no existen). */
    const verProduccion = can('produccion');
    const verTrazab = can('trazabilidad') || can('registrarQC');
    const verInventario = can('inventario');
    const verCompras = can('compras');
    const verRentab = can('compras');
    if (verProduccion) {
      const g = d.produccion.growthPct;
      out.push({ label: 'Cubetas / mes', value: (d.produccion.promMensual || 0).toLocaleString('es-MX'), trend: (g != null && g !== 0) ? `${g > 0 ? '+' : ''}${g}%` : null, trendPos: g > 0, sub: 'Prom. 6 meses', ruta: '/produccion' });
    }
    if (verTrazab) {
      out.push({ label: 'Lotes en flujo', value: (d.trazabilidad.lotesEnEnvasado || 0) + (d.trazabilidad.lotesEnCamino || 0), sub: `${d.trazabilidad.lotesEnEnvasado || 0} envasando · ${d.trazabilidad.lotesEnCamino || 0} en camino`, ruta: '/trazabilidad' });
    }
    if (verInventario) {
      out.push({ label: 'Valor inventario MP', value: fmt$(d.inventario.valorMP || 0), sub: `${d.inventario.mpsTotales || 0} MPs · ${d.inventario.ptsTotales || 0} PTs`, ruta: '/inventario?tab=mp' });
      out.push({ label: 'Stock crítico', value: d.inventario.mpsCriticas || 0, valueColor: d.inventario.mpsCriticas > 0 ? 'var(--lp-danger-600)' : undefined, sub: 'MPs sin existencia', ruta: '/inventario?tab=mp&filter=sin' });
    }
    if (verCompras) {
      out.push({ label: 'OCs activas', value: d.compras.ocsActivas || 0, sub: `${fmt$(d.compras.montoPendiente || 0)} pendiente`, ruta: '/compras' });
    }
    if (verRentab && d.margenes && d.margenes.margenMensual != null) {
      out.push({ label: 'Margen mensual', value: fmt$(d.margenes.margenMensual), trend: d.margenes.margenPct > 0 ? `${d.margenes.margenPct}%` : null, trendPos: true, sub: `Ingresos ${fmt$(d.margenes.ingresosMensual)}`, ruta: '/admin?section=margenes' });
    }
    return out;
  })();

  /* ── Mapeo a la forma `data` de InicioScreen (componente Claude Design) ── */
  const accToSev = (accent) =>
    (accent === ACC.crit || accent === ACC.critHi) ? 'danger'
      : (accent === ACC.amber || accent === ACC.amberHi) ? 'warning'
        : (accent === ACC.info) ? 'info' : 'ok';
  const KEY_ICON = {
    pedidos: 'ordenes', ordenes: 'ordenes', qc: 'qc', 'qc-hold': 'alert',
    envasado: 'stock', recoleccion: 'stock', almacen: 'inventario',
    'oc-vencidas': 'compras', 'ocs-por-aprobar': 'compras',
    'dev-recibir': 'devoluciones', 'dev-reembolsar': 'devoluciones', 'conteos-vencidos': 'qc',
  };
  const HERO_VERB = {
    pedidos: 'Preparar', ordenes: 'Ver', qc: 'Revisar', 'qc-hold': 'Atender',
    envasado: 'Envasar', recoleccion: 'Recolectar', almacen: 'Recibir',
    'oc-vencidas': 'Atender', 'ocs-por-aprobar': 'Aprobar',
    'dev-recibir': 'Recibir', 'dev-reembolsar': 'Emitir', 'conteos-vencidos': 'Contar',
  };
  const inicioData = {
    saludo: `Hola, ${user?.nombre || ''}`,
    fecha: fechaHoy,
    hero: heroCard ? {
      titulo: `${heroCard.count} ${heroCard.titulo.toLowerCase()}`,
      desc: heroCard.desc + (heroCard.items ? ' · ' + heroCard.items : ''),
      sev: accToSev(heroCard.accent),
      icon: KEY_ICON[heroCard.key] || 'inventario',
      ruta: heroCard.ruta,
      accion: HERO_VERB[heroCard.key] || 'Atender',
    } : {
      /* Sin urgencias → el hero SIEMPRE se muestra como estado "Todo al día"
         (sin botón). Así "Requiere tu atención" nunca desaparece. */
      titulo: 'Todo al día',
      desc: 'No tienes pendientes urgentes ahora mismo',
      sev: 'ok', icon: 'check', ruta: null, accion: null,
    },
    pendientes: pendientesCards.map(c => ({
      id: c.key, icon: KEY_ICON[c.key] || 'inventario', sev: accToSev(c.accent),
      titulo: c.titulo, desc: c.desc, folios: c.items || undefined, count: c.count, ruta: c.ruta,
    })),
    stats: tuDia.map(st => ({
      label: st.label, value: String(st.value), sub: st.sub || undefined,
      trend: st.trend || undefined, up: !!st.trendPos,
      accent: st.valueColor ? 'danger' : 'brand', mono: true,
    })),
  };

  if (err && !data) {
    return (<div><TopBar title="Inicio" /><div style={S.err}>{err}</div></div>);
  }

  return (
    <div>
      <TopBar title="Inicio" />
      {loading && !data ? (
        <div style={S.loading}>Cargando…</div>
      ) : (
        <>
          <InicioScreen
            data={inicioData}
            isDesktop={isDesktop}
            can={can}
            role={user?.rol}
            onAtenderHero={(ruta) => navigate(ruta || heroCard?.ruta || '/')}
            onAbrirPendiente={(_id, ruta) => navigate(ruta)}
            onAbrirStat={(label) => { const s = tuDia.find(x => x.label === label); if (s?.ruta) navigate(s.ruta); }}
          />
          {(user?.rol === 'almacen' || user?.rol === 'recolector') && (
            <div style={{ maxWidth: isDesktop ? 980 : 'none', margin: '0 auto', padding: isDesktop ? '0 28px 32px' : '0 18px 24px' }}>
              <MisLotesPipeline rol={user.rol} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
