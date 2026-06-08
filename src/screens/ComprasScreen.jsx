// ComprasScreen.jsx — Compras / OCs de materia prima (presentacional). 1:1 con el mockup
// Claude Design (cards en grid) + adiciones críticas (Editar/Eliminar en Activas, Ver
// comprobante, badge Solicitud, buscador). SOLO contenido + estado de UI; cero fetch/lógica.
// Props: data{ocs:[{cod,mp,qty,sol?,prov,monto,entrega,estado,vencida?,porVencer?,pago?,comp?,solicitud?}]},
//   onNuevaOC, onAprobarOC(cod), onEditarOC(cod), onEliminarOC(cod), onRecibirMP(cod),
//   onRegistrarPago(cod), onImprimirOC(cod), onVerComprobante(cod), can, role, isDesktop.
// "Aprobar OC" llama onAprobarOC(cod) → abre el modal REAL (pago + comprobante + vencimiento).
import { useState } from 'react';

const DEMO = { ocs: [
  { cod:'OC-2050', mp:'Dióxido de titanio', qty:'500 kg', sol:'Enrique', prov:'Química Tlaloc', monto:'$185,000', entrega:'10 jun', estado:'porAprobar', solicitud:true },
  { cod:'OC-2041', mp:'Resina acrílica', qty:'800 kg', prov:'Químicos del Bajío', monto:'$112,000', entrega:'31 may', estado:'activa', vencida:'4d', pago:'credito', comp:'factura.pdf' },
  { cod:'OC-2038', mp:'Carbonato de calcio', qty:'1,200 kg', prov:'Minerales del Centro', monto:'$31,500', entrega:'02 jun', estado:'recibida', comp:'factura.pdf' },
] };

const C = { ok:'var(--lp-brand-600)', amber:'var(--lp-warning-600)', danger:'var(--lp-danger-600)', info:'var(--lp-info-600)' };
const tint = (c) => `color-mix(in srgb, ${c} 14%, transparent)`;
const TABS = [['porAprobar','Por aprobar'],['activa','Activas'],['recibida','Recibidas']];

function Ico({ d, s = 18 }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d.split('|').map((p,i)=><path key={i} d={p}/>)}</svg>;
}
const I_CHECK = 'M9 11l3 3L22 4|M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11';
const I_PRINT = 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2|M6 14h12v8H6z';
const I_PLUS = 'M12 5v14|M5 12h14';
const I_DOC = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M9 15h6|M9 11h2';
const I_SEARCH = 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|M21 21l-4.3-4.3';

function btn(kind) {
  const base = { height: 44, borderRadius: 'var(--lp-radius-md)', border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 13.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, whiteSpace: 'nowrap' };
  /* primary nunca se encoge bajo su texto (evita que "Recibir MP" se recorte
     cuando hay muchos botones en una card angosta); crece si hay espacio. */
  if (kind === 'primary') return { ...base, flex: '1 1 auto', minWidth: 'max-content', padding: '0 16px', background: 'var(--lp-brand-600)', color: '#fff' };
  if (kind === 'ghost') return { ...base, flex: '0 0 auto', padding: '0 14px', background: 'transparent', border: '1px solid var(--lp-border-default)', color: 'var(--lp-text-secondary)' };
  if (kind === 'danger') return { ...base, flex: '0 0 auto', padding: '0 14px', background: 'transparent', border: '1px solid color-mix(in srgb,var(--lp-danger-600) 30%,transparent)', color: 'var(--lp-danger-600)' };
  if (kind === 'done') return { ...base, flex: 1, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', border: '1px solid var(--lp-border-subtle)', cursor: 'default' };
  return base;
}

export default function ComprasScreen({
  data = DEMO, onNuevaOC, onAprobarOC, onEditarOC, onEliminarOC, onRecibirMP, onRegistrarPago, onImprimirOC, onVerComprobante,
  can = () => true, role, isDesktop = false,
}) {
  const ocs = (data && data.ocs) || DEMO.ocs;
  const [tab, setTab] = useState('porAprobar');
  const [q, setQ] = useState('');

  const cnt = (k) => ocs.filter(o => o.estado === k).length;
  const list = ocs.filter(o => o.estado === tab).filter(o => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [o.cod, o.mp, o.prov].some(x => String(x || '').toLowerCase().includes(s));
  });
  const pad = isDesktop ? '20px 28px 30px' : '8px 18px 24px';

  const estadoOf = (o) => o.eliminada ? { l: 'Eliminada', c: C.danger }
    : o.estado === 'porAprobar' ? { l: 'Por aprobar', c: C.amber }
    : o.vencida ? { l: 'Vencida', c: C.danger } : o.porVencer ? { l: 'Por vencer', c: C.amber }
    : o.estado === 'activa' ? { l: 'En tránsito', c: C.info } : { l: 'Recibida', c: C.ok };

  const Row = ({ k, v, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--lp-text-secondary)' }}>{k}</span>
      <span style={{ color: color || 'var(--lp-text-primary)', fontWeight: 500, fontFamily: /\$|kg|L|jun|may|día|d$/.test(String(v)) ? 'var(--lp-font-mono)' : 'inherit' }}>{v}</span>
    </div>
  );

  return (
    <div style={{ padding: pad, fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)', maxWidth: isDesktop ? 1000 : 'none', margin: '0 auto' }}>
      {/* toolbar: tabs + nueva OC */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(([k, l]) => (
            <button key={k} data-id={`compras.tab.${k}`} onClick={() => setTab(k)} style={{
              padding: '8px 13px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
              fontSize: 12.5, fontWeight: k === tab ? 600 : 500,
              background: k === tab ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)', color: k === tab ? '#fff' : 'var(--lp-text-secondary)',
            }}>{l} · {cnt(k)}</button>
          ))}
        </div>
        {can('compras') && (
          <button data-id="compras.btn.levantar-oc" data-rol={role} onClick={() => onNuevaOC?.()} style={{ ...btn('primary'), flex: '0 0 auto', height: 40, padding: '0 15px', marginLeft: isDesktop ? 'auto' : 0 }}>
            <Ico d={I_PLUS} s={16} /> Levantar OC
          </button>
        )}
      </div>

      {/* #4 buscador */}
      <div style={{ position: 'relative', maxWidth: isDesktop ? 380 : 'none', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--lp-text-tertiary)', pointerEvents: 'none' }}><Ico d={I_SEARCH} s={17} /></span>
        <input data-id="compras.search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código, proveedor o materia prima…"
          style={{ width: '100%', height: 42, padding: '0 14px 0 38px', borderRadius: 'var(--lp-radius-md)', background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', outline: 'none', fontFamily: 'var(--lp-font-sans)', fontSize: 14, color: 'var(--lp-text-primary)' }} />
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--lp-text-tertiary)', fontSize: 13.5, padding: '56px 20px' }}>
          {q.trim() ? 'Sin resultados para tu búsqueda.' : 'Sin órdenes de compra aquí.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(2,minmax(0,1fr))' : '1fr', gap: 12 }}>
          {list.map((o) => {
            const e = estadoOf(o);
            return (
              <div key={o.cod} data-id="compras.card.oc" style={{ position: 'relative', overflow: 'hidden', background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-lg)', padding: '15px 16px' }}>
                {o.vencida && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: C.danger }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-700)' }}>{o.cod}</span>
                  {/* #3 badge solicitud del técnico */}
                  {o.solicitud && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: tint(C.amber), color: C.amber, letterSpacing: '.03em' }}>SOLICITUD</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: tint(e.c), color: e.c }}>{e.l}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{o.mp}</div>
                {o.qty && <div style={{ fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 2 }}>{o.qty}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, margin: '12px 0' }}>
                  {o.estado === 'porAprobar' && o.sol && <Row k="Solicitó" v={o.sol} />}
                  <Row k="Proveedor" v={o.prov} />
                  {o.monto && <Row k="Monto" v={o.monto} />}
                  {o.entrega && <Row k="Entrega" v={o.vencida ? `${o.entrega} · ${o.vencida} tarde` : o.entrega} color={o.vencida ? C.danger : undefined} />}
                  {o.pago === 'contado' && <Row k="Pago" v={`Contado${o.comp ? ' · ' + o.comp : ''}`} color={C.ok} />}
                  {o.vencida && <div style={{ fontSize: 13, fontWeight: 600, color: C.danger }}>Crédito vencido · {o.vencida} de retraso</div>}
                  {o.porVencer && <div style={{ fontSize: 13, fontWeight: 600, color: C.amber }}>Crédito por vencer · en {o.porVencer}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {o.estado === 'porAprobar' && <>
                    {can('compras') && <button data-id="compras.btn.aprobar-oc" data-rol={role} onClick={() => onAprobarOC?.(o.cod)} style={btn('primary')}>Aprobar OC</button>}
                    {can('compras') && <button data-id="compras.btn.editar-oc" data-rol={role} onClick={() => onEditarOC?.(o.cod)} style={btn('ghost')}>Editar</button>}
                    {can('eliminarOC') && <button data-id="compras.btn.eliminar-oc" data-rol="admin" title="Solo admin" onClick={() => onEliminarOC?.(o.cod)} style={btn('danger')}>Eliminar</button>}
                  </>}
                  {o.estado === 'activa' && <>
                    {can('recibirMP') && <button data-id="compras.btn.recibir-mp" data-rol={role} onClick={() => onRecibirMP?.(o.cod)} style={btn('primary')}><Ico d={I_CHECK} /> Recibir MP</button>}
                    {o.pago !== 'contado' && o.pago !== 'credito-pagado' && can('compras') && <button data-id="compras.btn.registrar-pago" data-rol={role} onClick={() => onRegistrarPago?.(o.cod)} style={btn('ghost')}>Registrar pago</button>}
                    {/* #1 editar OC activa (corregir tras aprobar) */}
                    {can('compras') && <button data-id="compras.btn.editar-oc" data-rol={role} onClick={() => onEditarOC?.(o.cod)} style={btn('ghost')}>Editar</button>}
                    {/* #2 ver comprobante adjunto */}
                    {o.comp && <button data-id="compras.btn.ver-comprobante" data-rol={role} title="Ver comprobante adjunto" onClick={() => onVerComprobante?.(o.cod)} style={btn('ghost')}><Ico d={I_DOC} s={16} /> Comprobante</button>}
                    {can('compras') && <button data-id="compras.btn.imprimir-oc" data-rol={role} title="Imprimir OC" onClick={() => onImprimirOC?.(o.cod)} style={btn('ghost')}><Ico d={I_PRINT} s={17} /></button>}
                    {/* #1 cancelar/eliminar OC activa (admin) */}
                    {can('eliminarOC') && <button data-id="compras.btn.eliminar-oc" data-rol="admin" title="Cancelar OC (solo admin)" onClick={() => onEliminarOC?.(o.cod)} style={btn('danger')}>Eliminar</button>}
                  </>}
                  {o.estado === 'recibida' && <>
                    {o.eliminada
                      ? <span style={{ ...btn('done'), color: C.danger }}>Eliminada</span>
                      : <span style={btn('done')}><Ico d={I_CHECK} s={16} /> En inventario</span>}
                    {o.comp && <button data-id="compras.btn.ver-comprobante" data-rol={role} title="Ver comprobante adjunto" onClick={() => onVerComprobante?.(o.cod)} style={btn('ghost')}><Ico d={I_DOC} s={16} /> Comprobante</button>}
                    {!o.eliminada && can('compras') && <button data-id="compras.btn.imprimir-oc" data-rol={role} onClick={() => onImprimirOC?.(o.cod)} style={btn('ghost')}>Imprimir OC</button>}
                  </>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
