/* ════════════════════════════════════════════════════════════════════════════
   EntregasPage — ENTREGAS A TIENDAS (jul 2026, pedido dueño).

   Somos un CEDIS: la BAJA del inventario ocurre aquí, al entregar a una tienda
   (envasar solo cambia la forma). Una entrega (folio ENT-*) mezcla líneas de
   Americano 1/2 (cubetas/galones del color) y PT nacional de Terán (pool +
   espejo FEFO a sublotes → estado terminal 'entregado_tienda').

   Captura: manual (fuente → producto → presentación → cantidad) y/o ESCANEO del
   QR de las etiquetas (cada escaneo suma 1 unidad de esa línea). Un paso:
   confirmar descuenta e imprime la remisión. Tienda = SELECT del catálogo de
   sucursales (ago 2026; el alta es el botón "Agregar sucursal" — con texto
   libre, "PALACO" y "palaco" eran dos tiendas). Roles: admin + almacén (Josué).
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { QRScanner } from '../../components/QRModal';
import humanizeError from '../../utils/humanizeError';

const LBL_PRES = { cubeta: 'Cubeta', galon: 'Galón', litro: 'Litro', atomizador750: 'Atomizador', pieza: 'Pieza' };
/* Quien TRANSPORTA y entrega en la sucursal (rol 'recolector'). Se resuelve del
   padrón de usuarios para que el documento siga bien si cambia la persona; el
   respaldo es el titular actual. */
const RECOLECTOR_FALLBACK = 'Luis Lara';
function useRecolector() {
  const { data } = useApiData(() => api.getUsuarios(), null, 0);
  /* El admin puede fijar quién firma la entrega desde Usuarios ▸ Firmas de
     documentos. Si lo deja vacío, se usa quien tenga el rol de recolector —
     así el papel sigue solo al personal sin que nadie configure nada. */
  const { data: firmData } = useApiData(() => api.getFirmantes(), null, 0);
  return useMemo(() => {
    const conf = ((firmData?.data || firmData || {}).remisionEntrega || {}).nombre;
    if (conf && conf.trim()) return conf.trim();
    const arr = Array.isArray(data) ? data : (data?.data || data?.usuarios || []);
    const u = (arr || []).find(x => x && x.rol === 'recolector' && !x.eliminado);
    return (u && (u.nombre || '').trim()) || RECOLECTOR_FALLBACK;
  }, [data, firmData]);
}
const PRES_PT = ['cubeta', 'galon', 'litro', 'atomizador750'];

/* Catálogo de PT entregable desde el desglose de Terán (/api/inventario/pt-por-ubicacion).
   A una tienda se le entregan ENVASES: un tote sin abrir (52 cub-eq) o el
   granel de un tote ya abierto no se pueden entregar hasta re-envasarlos.

   BUG QUE RESUELVE (reporte del dueño, 27-jul-2026): antes se filtraba
   `PRES_PT.some(x => disp[x] > 0)` y el producto DESAPARECÍA de la lista.
   Josué veía 52 cubetas de VERDE BOSQUE en Inventario y en Entregas el
   producto no existía — sin ninguna explicación. Eran 4 productos invisibles
   (208 cub-eq, todos con su stock en un tote) más los que mostraban menos de
   lo que el inventario decía porque el resto estaba en granel.

   Ahora se conservan, marcados con `envasado:false` y el detalle de cuánto
   falta por envasar, para que la pantalla lo explique en vez de esconderlo. */
export function catalogoPT(teran) {
  return Object.entries(teran || {})
    .map(([nombre, d]) => {
      const disp = {
        cubeta: Math.floor(Number(d.cubeta) || 0), galon: Math.floor(Number(d.galon) || 0),
        litro: Math.floor(Number(d.litro) || 0), atomizador750: Math.floor(Number(d.atm) || 0),
      };
      const totes = Math.floor(Number(d.tote) || 0);
      const granel = +(Number(d.granel) || 0).toFixed(2);
      return {
        nombre, disp, totes, granel,
        sinEnvasar: +(totes * 52 + granel).toFixed(2),
        envasado: PRES_PT.some(x => disp[x] > 0),
      };
    })
    .filter(p => p.envasado || p.sinEnvasar > 0)
    /* lo entregable primero; lo que hay que re-envasar, después */
    .sort((a, b) => (b.envasado - a.envasado) || a.nombre.localeCompare(b.nombre));
}
/* Envases vacíos (2-sep-2026, pedido dueño): a la tienda también viajan
   envases, en PIEZAS y SIEMPRE del stock de Terán — las entregas salen del
   CEDIS. Subcategorías de envases.json y tapas (marcadas) en una lista. */
function catalogoEnvases(envData) {
  const out = [];
  const cats = envData?.categorias || {};
  Object.keys(cats).forEach(ck => {
    const subs = cats[ck]?.subcategorias || {};
    Object.keys(subs).forEach(sk => {
      const sub = subs[sk] || {};
      const teran = Math.floor(Number(sub.teran) || 0);
      if (teran > 0) out.push({ nombre: sub.nombre || sk, key: sk, disp: { pieza: teran } });
    });
  });
  const tapas = envData?.tapas || {};
  Object.keys(tapas).forEach(tk => {
    const t = tapas[tk] || {};
    const teran = Math.floor(Number(t.teran) || 0);
    if (teran > 0) out.push({ nombre: `${t.nombre || tk} — tapa`, key: tk, tapa: true, disp: { pieza: teran } });
  });
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}
const nf = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 });
const fmtFecha = (iso) => { try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return (iso || '').slice(0, 16); } };
const fechaLarga = (iso) => { try { return new Date(iso || Date.now()).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return (iso || '').slice(0, 10); } };

const S = {
  wrap: { padding: '6px 20px 110px', fontFamily: 'var(--lp-font-sans)' },
  kpis: { display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0 14px' },
  kpi: { flex: '1 1 130px', minWidth: 120, background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid var(--lp-brand-600)' },
  kpiLbl: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)' },
  kpiVal: { fontSize: 22, fontWeight: 700, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)', marginTop: 2 },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  btnAdd: { height: 42, padding: '0 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, background: 'var(--lp-brand-600)', color: '#fff', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 },
  card: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderLeft: '4px solid var(--lp-brand-600)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 },
  folio: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 13.5, color: 'var(--lp-brand-700)' },
  meta: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 2 },
  lineas: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 },
  linea: { fontSize: 12.5, color: 'var(--lp-text-secondary)', display: 'flex', justifyContent: 'space-between', gap: 8 },
  badge: (am) => ({ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: am ? 'var(--lp-info-50)' : 'var(--lp-brand-100)', color: am ? 'var(--lp-info-700, var(--lp-info-600))' : 'var(--lp-brand-700)', whiteSpace: 'nowrap' }),
  empty: { textAlign: 'center', padding: '44px 20px', color: 'var(--lp-text-tertiary)', fontSize: 14, border: '1.5px dashed var(--lp-border-subtle)', borderRadius: 12 },
  /* sheet nueva entrega */
  overlay: { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,12,8,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  overlayDesk: { alignItems: 'center', padding: 16 },
  sheet: (desk) => ({ background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', borderRadius: desk ? 14 : '24px 24px 0 0', width: '100%', maxWidth: desk ? 560 : '100%', maxHeight: 'calc(var(--pp-vvh, 100dvh) - 24px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }),
  shHead: { padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  shTitle: { fontSize: 16, fontWeight: 700 },
  shBody: { padding: '4px 20px 16px', overflowY: 'auto', flex: 1, minHeight: 0 },
  shFoot: { padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', gap: 8, background: 'var(--lp-bg-sunken)' },
  lbl: { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)', margin: '14px 0 6px' },
  input: { width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 8, background: 'var(--lp-bg-base)', color: 'var(--lp-text-primary)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
  seg: { display: 'flex', gap: 4, background: 'var(--lp-bg-sunken)', borderRadius: 999, padding: 3, flexWrap: 'wrap' },
  segBtn: (on) => ({ flex: 1, minWidth: 90, padding: '8px 10px', minHeight: 38, borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, background: on ? 'var(--lp-brand-600)' : 'transparent', color: on ? '#fff' : 'var(--lp-text-secondary)' }),
  addRow: { display: 'grid', gridTemplateColumns: '1fr 88px', gap: 8, alignItems: 'end' },
  btnGhost: { height: 40, padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnLine: { width: '100%', marginTop: 10, height: 42, borderRadius: 8, border: '1.5px dashed var(--lp-brand-600)', background: 'transparent', color: 'var(--lp-brand-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  cart: { marginTop: 14, border: '1px solid var(--lp-border-subtle)', borderRadius: 10, overflow: 'hidden' },
  cartHead: { padding: '8px 12px', background: 'var(--lp-bg-sunken)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)' },
  cartRow: { padding: '9px 12px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13 },
  del: { width: 28, height: 28, borderRadius: 6, border: 'none', background: 'var(--lp-danger-50, #FEE2E2)', color: 'var(--lp-danger-700, #991B1B)', cursor: 'pointer', fontSize: 14, lineHeight: 1 },
  err: { background: 'var(--lp-danger-50, #FEE2E2)', color: 'var(--lp-danger-700, #991B1B)', padding: '10px 12px', borderRadius: 8, fontSize: 12.5, marginTop: 12 },
  hintVacio: { background: 'var(--lp-bg-sunken)', border: '1.5px dashed var(--lp-border-subtle)', color: 'var(--lp-text-secondary)', padding: '12px 14px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5 },
  kebab: { width: 34, height: 34, borderRadius: 8, border: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  menu: { position: 'absolute', top: 38, right: 0, zIndex: 40, minWidth: 190, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 10, boxShadow: '0 10px 28px rgba(0,0,0,.16)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  menuItem: { padding: '11px 14px', minHeight: 44, background: 'transparent', border: 'none', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--lp-text-primary)', cursor: 'pointer', fontFamily: 'inherit' },
  btnSec: { height: 42, padding: '0 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', border: '1.5px solid var(--lp-brand-600)', background: 'transparent', color: 'var(--lp-brand-700)', display: 'inline-flex', alignItems: 'center', gap: 7 },
  act: (primary, dis) => ({ flex: 1, height: 46, borderRadius: 10, border: primary ? 'none' : '1.5px solid var(--lp-border-subtle)', cursor: dis ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', opacity: dis ? 0.55 : 1, background: primary ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)', color: primary ? '#fff' : 'var(--lp-text-secondary)' }),
  toast: { position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 1300, background: 'var(--lp-text-primary)', color: 'var(--lp-bg-raised)', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.2)' },
};

/* ── Remisión imprimible (patrón PrintOCOverlay: siempre claro, aislada en print) ── */
export function RemisionOverlay({ entrega, onClose }) {
  /* Hook ANTES del early-return (regla de hooks). */
  const recolector = useRecolector();
  if (!entrega) return null;
  const INK = '#16241F', MUT = '#6b6560', BRAND = '#0F6E56';
  return (
    <div className="lp-entov">
      <style>{`
        .lp-entov{ position:fixed; inset:0; background:rgba(10,16,14,.55); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:22px; z-index:9999; }
        .lp-entdoc{ background:#fff; color:${INK}; width:100%; max-width:560px; max-height:72vh; overflow-y:auto; border-radius:14px; padding:24px 22px; font-family:var(--lp-font-sans); box-shadow:0 20px 50px rgba(0,0,0,.3); box-sizing:border-box; }
        .lp-ent-h{ display:flex; align-items:flex-start; justify-content:space-between; border-bottom:2px solid ${INK}; padding-bottom:12px; margin-bottom:14px; }
        .lp-ent-brand{ font-size:16px; font-weight:600; color:${BRAND}; }
        .lp-ent-brand small{ display:block; font-size:10px; font-weight:500; color:${MUT}; letter-spacing:.06em; text-transform:uppercase; }
        .lp-ent-doc{ text-align:right; }
        .lp-ent-doc .t{ font-size:13px; font-weight:600; }
        .lp-ent-doc .f{ font-family:var(--lp-font-mono); font-size:14px; font-weight:700; color:${BRAND}; }
        .lp-ent-doc .d{ font-size:11px; color:${MUT}; margin-top:2px; }
        .lp-ent-row{ display:flex; justify-content:space-between; font-size:13px; padding:3px 0; }
        .lp-ent-row .k{ color:${MUT}; } .lp-ent-row .v{ font-weight:600; }
        .lp-ent-tbl{ width:100%; border-collapse:collapse; margin-top:10px; font-size:13px; }
        .lp-ent-tbl th{ text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:#9c9589; border-bottom:1px solid #E8E6DE; padding:6px 0; }
        .lp-ent-tbl td{ padding:8px 0; border-bottom:1px solid #F0EEE8; }
        .lp-ent-tbl td.r, .lp-ent-tbl th.r{ text-align:right; font-family:var(--lp-font-mono); }
        .lp-ent-tbl td.lote{ font-family:var(--lp-font-mono); font-size:10px; color:#444; word-break:break-word; padding-right:8px; line-height:1.5; }
        .lp-ent-firma{ margin-top:72px; display:flex; justify-content:space-between; gap:28px; }
        .lp-ent-firma div{ flex:1; border-top:1px solid ${INK}; padding-top:6px; font-size:11px; color:${MUT}; text-align:center; line-height:1.7; }
        /* Recepción del material: firma CENTRADA debajo de las dos de salida
           (pedido dueño 26-jul). Mismo alto de aire para firmar a mano. */
        .lp-ent-firma2{ margin-top:60px; display:flex; justify-content:center; }
        .lp-ent-firma2 div{ width:46%; border-top:1px solid ${INK}; padding-top:6px; font-size:11px; color:${MUT}; text-align:center; line-height:1.7; }
        .lp-ent-btns{ display:flex; gap:10px; width:100%; max-width:560px; }
        .lp-ent-btn{ flex:1; height:46px; border-radius:12px; border:none; cursor:pointer; font-family:var(--lp-font-sans); font-size:13.5px; font-weight:600; }
        .lp-ent-btn.ghost{ background:#fff; color:${MUT}; border:1px solid rgba(0,0,0,.12); }
        .lp-ent-btn.primary{ background:var(--lp-brand-600); color:#fff; }
        @page{ size: letter portrait; margin: 16mm; }
        @media print{
          body *{ visibility:hidden !important; }
          #lp-entdoc, #lp-entdoc *{ visibility:visible !important; }
          #lp-entdoc{ position:fixed; inset:0; width:auto; max-width:none; max-height:none; border-radius:0; box-shadow:none; padding:24px 10px; overflow:visible; font-size:13px; }
          .lp-ent-firma{ margin-top:90px; }
        }
      `}</style>
      <div className="lp-entdoc" id="lp-entdoc">
        <div className="lp-ent-h">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logos/app-icon.svg" alt="" style={{ width: 42, height: 42, borderRadius: 9, flexShrink: 0 }} />
            <div className="lp-ent-brand">Pinturas El Perico<small>CEDIS Terán · Remisión de entrega</small></div>
          </div>
          <div className="lp-ent-doc">
            <div className="t">Remisión de entrega</div>
            <div className="f">{entrega.folio}</div>
            <div className="d">{fechaLarga(entrega.fecha)}</div>
          </div>
        </div>
        <div className="lp-ent-row"><span className="k">Tienda destino</span><span className="v">{entrega.tienda}</span></div>
        <div className="lp-ent-row"><span className="k">Salida (CEDIS)</span><span className="v">{entrega.usuario}</span></div>
        <div className="lp-ent-row"><span className="k">Entregó en sucursal</span><span className="v">{recolector}</span></div>
        <table className="lp-ent-tbl">
          <thead><tr><th style={{ width: 26 }}>#</th><th>Producto</th><th>Lote</th><th>Presentación</th><th className="r">Cantidad</th></tr></thead>
          <tbody>
            {(entrega.lineas || []).map((l, i) => {
              const lotes = [...new Set((l.fuente === 'americano'
                ? (l.lotes || []).map(x => (x && x.codigoLote) || x)
                : (l.sublotes || []).map(s => (s && (s.codigoLote || s.cod)) || s)
              ).filter(Boolean))];
              return (
                <tr key={i}>
                  <td style={{ color: '#9c9589' }}>{i + 1}</td>
                  <td>{l.producto}{l.fuente === 'americano' ? ` (Americano ${l.almacen})` : l.fuente === 'envases' ? ' (envase vacío)' : ''}</td>
                  <td className="lote">{lotes.length ? lotes.join(', ') : '—'}</td>
                  <td>{LBL_PRES[l.presentacion] || l.presentacion}</td>
                  <td className="r">{l.cantidad}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="lp-ent-row" style={{ marginTop: 10 }}>
          <span className="k">Total unidades</span>
          <span className="v" style={{ fontFamily: 'var(--lp-font-mono)' }}>{(entrega.lineas || []).reduce((a, l) => a + (Number(l.cantidad) || 0), 0)}</span>
        </div>
        {entrega.nota ? <div className="lp-ent-row"><span className="k">Nota</span><span className="v">{entrega.nota}</span></div> : null}
        {/* Firmas (pedido dueño 26-jul): arriba SALIDA del CEDIS (Josué) y
            ENTREGÓ A la sucursal (Luis, quien transporta); abajo centrada la
            RECEPCIÓN del material en la tienda. */}
        <div className="lp-ent-firma">
          <div>Salida — CEDIS Terán<br />{entrega.usuario} · nombre y firma</div>
          <div>Entregó a {entrega.tienda}<br />{recolector} · nombre y firma</div>
        </div>
        <div className="lp-ent-firma2">
          <div>Recibió — {entrega.tienda}<br />nombre, firma y fecha</div>
        </div>
      </div>
      <div className="lp-ent-btns">
        <button type="button" className="lp-ent-btn ghost" onClick={onClose}>Cerrar</button>
        <button type="button" className="lp-ent-btn primary" data-id="entregas.btn.imprimir-remision" onClick={() => window.print()}>Imprimir remisión</button>
      </div>
    </div>
  );
}

/* ── Sheet Nueva Entrega ── */
/* Líneas guardadas → forma que edita la hoja. El americano guarda el NOMBRE
   del color y el backend lo normaliza a su clave (mayúsculas, espacios
   colapsados), así que mandar el nombre es equivalente a mandar la clave. */
function lineasAEditor(entrega) {
  return (entrega?.lineas || []).map(l => (l.fuente === 'americano'
    ? { fuente: 'americano', almacen: String(l.almacen || '1'), producto: l.key || l.producto, nombre: l.producto, presentacion: l.presentacion, cantidad: Number(l.cantidad) || 0 }
    : l.fuente === 'envases'
      ? { fuente: 'envases', key: l.key || l.producto, ...(l.tapa ? { tapa: true } : {}), producto: l.producto, presentacion: 'pieza', cantidad: Number(l.cantidad) || 0 }
      : { fuente: 'pt', producto: l.producto, presentacion: l.presentacion, cantidad: Number(l.cantidad) || 0 }
  )).filter(l => l.cantidad > 0);
}

export function NuevaEntregaSheet({ isDesktop, tiendasPrev, entrega, onClose, onDone }) {
  useBodyScrollLock(true);
  /* MODO EDICIoN (ago 2026): la misma hoja corrige una entrega ya registrada
     -- cantidades, producto y fuente (PT / Americano 1 / 2). El backend la
     rehace de raiz: devuelve lo que salio y vuelve a sacar lo nuevo. */
  const editando = !!entrega;
  const [tienda, setTienda] = useState(entrega ? (entrega.tienda || '') : '');
  const [lineas, setLineas] = useState(() => (entrega ? lineasAEditor(entrega) : []));
  const [fuente, setFuente] = useState('americano1'); /* americano1 | americano2 | pt | envases */
  const [producto, setProducto] = useState('');
  const [presentacion, setPresentacion] = useState('cubeta');
  const [cantidad, setCantidad] = useState('');
  const [scanning, setScanning] = useState(false);
  /* Escaneo (decisión dueño 18-jul): el QR IDENTIFICA el producto/lote; la
     CANTIDAD se captura a mano después (no +1 por escaneo). */
  const [scanPending, setScanPending] = useState(null);
  const [scanQty, setScanQty] = useState('');
  const [scanMedida, setScanMedida] = useState('cubeta');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  /* catálogos por fuente (con stock por presentación) */
  const { data: am1 } = useApiData(() => api.getStkAmericano('1'), null, 0);
  const { data: am2 } = useApiData(() => api.getStkAmericano('2'), null, 0);
  const { data: ptUbi } = useApiData(() => api.getPTPorUbicacion(), null, 0);
  const { data: envResp } = useApiData(() => api.getEnvases(), null, 0);

  const catalogo = useMemo(() => {
    if (fuente === 'envases') return catalogoEnvases(envResp?.data || envResp || {});
    if (fuente === 'pt') return catalogoPT(ptUbi?.teran || ptUbi?.data?.teran || {});
    const src = fuente === 'americano2' ? am2 : am1;
    const colores = src?.data?.colores || src?.colores || [];
    return colores
      .map(c => ({ nombre: c.nombre, key: c.key, disp: { cubeta: Number(c.cubetas) || 0, galon: Number(c.galones) || 0 } }))
      .filter(c => c.disp.cubeta > 0 || c.disp.galon > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [fuente, am1, am2, ptUbi, envResp]);

  const sel = catalogo.find(c => c.nombre === producto);
  const presOpts = fuente === 'pt' ? PRES_PT : fuente === 'envases' ? ['pieza'] : ['cubeta', 'galon'];
  /* Al EDITAR, lo que esta entrega ya descontó vuelve a estar disponible: el
     backend devuelve todo antes de aplicar lo nuevo. Sin esto la pantalla
     diría "solo hay 0" para una entrega que se acaba de llevar las 10. */
  const yaEnEstaEntrega = useMemo(() => {
    const m = {};
    (entrega?.lineas || []).forEach(l => {
      const k = l.fuente === 'envases'
        ? ['envases', l.tapa ? 'tapa' : 'sub', String(l.key || l.producto || '').toUpperCase()].join('|')
        : [l.fuente, l.almacen || '-', String(l.producto || '').toUpperCase(), l.presentacion].join('|');
      m[k] = (m[k] || 0) + (Number(l.cantidad) || 0);
    });
    return m;
  }, [entrega]);
  const dispBase = sel ? (Number(sel.disp[presentacion]) || 0) : 0;
  const devuelto = sel
    ? (yaEnEstaEntrega[fuente === 'envases'
        ? ['envases', sel.tapa ? 'tapa' : 'sub', String(sel.key || '').toUpperCase()].join('|')
        : [fuente === 'pt' ? 'pt' : 'americano', fuente === 'pt' ? '-' : (fuente === 'americano2' ? '2' : '1'), String(sel.nombre || '').toUpperCase(), presentacion].join('|')] || 0)
    : 0;
  const disp = dispBase + devuelto;
  const n = parseInt(cantidad, 10) || 0;

  const addLinea = () => {
    setErr('');
    if (!sel) { setErr('Elige un producto'); return; }
    if (n <= 0) { setErr('Indica la cantidad'); return; }
    if (n > disp) {
      /* Explicar DÓNDE está el resto. "Solo hay 10 disponibles" cuando el
         inventario muestra 52 en Terán parece un error del sistema; la
         diferencia suele estar en un tote sin abrir o en granel, que no se
         entrega hasta re-envasarlo. */
      const base = fuente === 'envases'
        ? `Solo hay ${nf(disp)} pieza(s) de ese envase en Terán`
        : `Solo hay ${nf(disp)} ${LBL_PRES[presentacion]?.toLowerCase() || presentacion}(s) envasado(s)`;
      setErr(sel?.sinEnvasar > 0
        ? `${base}. Hay ${nf(sel.sinEnvasar)} cub más en Terán${sel.totes ? ` (${sel.totes} tote${sel.totes === 1 ? '' : 's'} sin abrir)` : ' a granel'}: re-envásalas desde Inventario ▸ PT para poder entregarlas.`
        : base);
      return;
    }
    const nueva = fuente === 'pt'
      ? { fuente: 'pt', producto: sel.nombre, presentacion, cantidad: n }
      : fuente === 'envases'
        ? { fuente: 'envases', key: sel.key, ...(sel.tapa ? { tapa: true } : {}), producto: sel.nombre, presentacion: 'pieza', cantidad: n }
        : { fuente: 'americano', almacen: fuente === 'americano2' ? '2' : '1', producto: sel.key || sel.nombre, nombre: sel.nombre, presentacion, cantidad: n };
    setLineas(ls => {
      const i = ls.findIndex(l => l.fuente === nueva.fuente && l.almacen === nueva.almacen && l.producto === nueva.producto && l.presentacion === nueva.presentacion);
      if (i >= 0) { const cp = [...ls]; cp[i] = { ...cp[i], cantidad: cp[i].cantidad + n }; return cp; }
      return [...ls, nueva];
    });
    setCantidad('');
  };

  /* Escaneo: el QR IDENTIFICA el producto (lote americano o sublote PT); después
     el operador captura A MANO cuántas unidades van (decisión dueño 18-jul). */
  const handleScan = useCallback(async (parsed) => {
    setScanning(false);
    const cod = (parsed && (parsed.cod || parsed.raw)) || '';
    if (!cod) return;
    try {
      const r = await api.resolverEntregaQR(cod);
      const d = r?.data || r;
      setScanPending(d);
      setScanMedida(d.fuente === 'americano'
        ? ((Number(d.disponibles?.cubetas) || 0) > 0 ? 'cubeta' : 'galon')
        : (d.tipo || 'cubeta'));
      setScanQty('');
      setErr('');
    } catch (e) { setErr(humanizeError(e)); }
  }, []);

  const confirmScan = () => {
    const d = scanPending;
    const n = parseInt(scanQty, 10) || 0;
    if (!d || n <= 0) return;
    if (d.fuente === 'americano') {
      const disp = scanMedida === 'galon' ? (Number(d.disponibles?.galones) || 0) : (Number(d.disponibles?.cubetas) || 0);
      if (n > disp) { setErr(`Solo hay ${nf(disp)} ${LBL_PRES[scanMedida]?.toLowerCase() || scanMedida}(s) de "${d.nombre}"`); return; }
      const loteCod = d.lote?.codigoLote;
      setLineas(ls => {
        const i = ls.findIndex(l => l.fuente === 'americano' && l.almacen === d.almacen && l.producto === d.key && l.presentacion === scanMedida);
        if (i >= 0) { const cp = [...ls]; cp[i] = { ...cp[i], cantidad: cp[i].cantidad + n, lotes: [...new Set([...(cp[i].lotes || []), ...(loteCod ? [loteCod] : [])])] }; return cp; }
        return [...ls, { fuente: 'americano', almacen: d.almacen, producto: d.key, nombre: d.nombre, presentacion: scanMedida, cantidad: n, ...(loteCod ? { lotes: [loteCod] } : {}) }];
      });
    } else {
      setLineas(ls => {
        const i = ls.findIndex(l => l.fuente === 'pt' && l.producto === d.producto && l.presentacion === d.tipo);
        if (i >= 0) { const cp = [...ls]; cp[i] = { ...cp[i], cantidad: cp[i].cantidad + n, sublotes: [...new Set([...(cp[i].sublotes || []), d.cod])] }; return cp; }
        return [...ls, { fuente: 'pt', producto: d.producto, presentacion: d.tipo, cantidad: n, sublotes: [d.cod] }];
      });
    }
    setErr('');
    setScanPending(null); setScanQty('');
  };

  const totalU = lineas.reduce((a, l) => a + l.cantidad, 0);
  const puede = tienda.trim().length > 0 && lineas.length > 0 && !saving;

  const confirmar = async () => {
    if (!puede) return;
    setSaving(true); setErr('');
    try {
      const r = editando
        ? await api.editarEntrega(entrega.id || entrega.folio, { tienda: tienda.trim(), lineas })
        : await api.crearEntrega({ tienda: tienda.trim(), lineas });
      onDone(r?.entrega || null, editando);
    } catch (e) { setErr(humanizeError(e)); setSaving(false); }
  };

  return (
    <div style={{ ...S.overlay, ...(isDesktop ? S.overlayDesk : {}) }}>
      <div style={S.sheet(isDesktop)} onClick={e => e.stopPropagation()}>
        <div style={S.shHead}>
          <div style={S.shTitle}>{editando ? `Editar entrega · ${entrega.folio}` : 'Nueva entrega a tienda'}</div>
          <button style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--lp-text-tertiary)', padding: 4, lineHeight: 1 }} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.shBody}>
          {editando && (
            <div style={{ ...S.hintVacio, marginTop: 8 }}>
              Corregir la entrega <strong>rehace el movimiento</strong>: se devuelve al inventario lo que salió y se descuenta lo que dejes aquí. El folio y la fecha no cambian; vuelve a imprimir la remisión.
            </div>
          )}
          {/* Ago 2026: la tienda se ELIGE, ya no se escribe. Con texto libre la
              misma sucursal capturada distinto ("PALACO"/"palaco") partía el
              historial en dos. Alta de sucursales: botón de la pantalla. */}
          <label style={S.lbl}>Tienda destino</label>
          {tiendasPrev.length === 0 ? (
            <div style={S.hintVacio}>
              No hay sucursales dadas de alta. Cierra y usa <strong>Agregar sucursal</strong> para registrar la primera.
            </div>
          ) : (
            <select style={S.input} value={tienda} onChange={e => setTienda(e.target.value)} data-id="entregas.select.tienda">
              <option value="">— elige la sucursal —</option>
              {tiendasPrev.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          <label style={S.lbl}>Agregar producto</label>
          <div style={S.seg}>
            {[['americano1', 'Americano 1'], ['americano2', 'Americano 2'], ['pt', 'PT Terán'], ['envases', 'Envases']].map(([v, l]) => (
              <button key={v} type="button" style={S.segBtn(fuente === v)} onClick={() => { setFuente(v); setProducto(''); setPresentacion(v === 'envases' ? 'pieza' : 'cubeta'); }} data-id={`entregas.fuente.${v}`}>{l}</button>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            <select style={S.input} value={producto} onChange={e => setProducto(e.target.value)} data-id="entregas.select.producto">
              <option value="">— elige producto ({catalogo.length} con stock) —</option>
              {catalogo.map(c => (
                <option key={c.nombre} value={c.nombre} disabled={fuente === 'pt' && !c.envasado}>
                  {c.nombre}
                  {presOpts.some(p => c.disp[p] > 0)
                    ? ' · ' + presOpts.filter(p => c.disp[p] > 0).map(p => `${nf(c.disp[p])} ${LBL_PRES[p].toLowerCase()}${c.disp[p] === 1 ? '' : 's'}`).join(' · ')
                    : ''}
                  {fuente === 'pt' && c.sinEnvasar > 0
                    ? ` — ${nf(c.sinEnvasar)} cub sin envasar${c.totes ? ` (${c.totes} tote${c.totes === 1 ? '' : 's'})` : ''}`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Stock que existe en Terán pero todavía no se puede entregar. Sin
              este aviso el producto o desaparecía de la lista, o decía "solo
              hay 10" con 52 cubetas en el inventario — y parecía un error. */}
          {fuente === 'pt' && sel?.sinEnvasar > 0 && (
            <div style={{
              marginTop: 10, padding: '9px 11px', borderRadius: 8, fontSize: 12, lineHeight: 1.55,
              background: 'var(--lp-warning-bg, #FEF3C7)', color: 'var(--lp-warning-text, #92400E)',
              border: '1px solid var(--lp-warning-border, #FCD34D)',
            }}>
              <strong>{nf(sel.sinEnvasar)} cubetas sin envasar</strong>
              {sel.totes ? ` (${sel.totes} tote${sel.totes === 1 ? '' : 's'} sin abrir)` : ' a granel'}.
              {' '}Están en Terán pero no se pueden entregar así: re-envásalas desde
              Inventario ▸ PT ▸ Terán y aparecerán aquí.
            </div>
          )}

          <div style={{ ...S.seg, marginTop: 10 }}>
            {presOpts.map(p => (
              <button key={p} type="button" style={S.segBtn(presentacion === p)} onClick={() => setPresentacion(p)}
                disabled={sel ? !(sel.disp[p] > 0) : false}>
                {LBL_PRES[p]}{sel ? ` (${nf(sel.disp[p] || 0)})` : ''}
              </button>
            ))}
          </div>

          <div style={{ ...S.addRow, marginTop: 10 }}>
            <input style={S.input} type="number" inputMode="numeric" min="1" step="1" placeholder="Cantidad"
              value={cantidad} onChange={e => setCantidad(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addLinea(); }} data-id="entregas.input.cantidad" />
            <button type="button" style={{ ...S.btnGhost, height: 42, fontWeight: 700, color: 'var(--lp-brand-700)' }} onClick={addLinea} data-id="entregas.btn.agregar-linea">Agregar</button>
          </div>

          <button type="button" style={S.btnLine} onClick={() => setScanning(true)} data-id="entregas.btn.escanear" data-rol="admin,almacen">
            Escanear QR de etiqueta
          </button>

          {scanPending && (
            <div style={{ marginTop: 10, border: '1.5px solid var(--lp-brand-600)', borderRadius: 10, padding: '10px 12px', background: 'color-mix(in srgb, var(--lp-brand-600) 6%, transparent)' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{scanPending.fuente === 'americano' ? scanPending.nombre : scanPending.producto}</div>
              <div style={{ fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                {scanPending.fuente === 'americano'
                  ? `Lote ${scanPending.lote?.codigoLote} · Americano ${scanPending.almacen} · disponible: ${nf(scanPending.disponibles?.cubetas || 0)} cub · ${nf(scanPending.disponibles?.galones || 0)} gal`
                  : `Sublote ${scanPending.cod} · ${LBL_PRES[scanPending.tipo] || scanPending.tipo} · en este lote: ${nf(scanPending.qty)}`}
              </div>
              {scanPending.fuente === 'americano' && (Number(scanPending.disponibles?.cubetas) || 0) > 0 && (Number(scanPending.disponibles?.galones) || 0) > 0 && (
                <div style={{ ...S.seg, marginTop: 8 }}>
                  {['cubeta', 'galon'].map(m => (
                    <button key={m} type="button" style={S.segBtn(scanMedida === m)} onClick={() => setScanMedida(m)}>{LBL_PRES[m]}</button>
                  ))}
                </div>
              )}
              <div style={{ ...S.addRow, marginTop: 8 }}>
                <input style={S.input} type="number" inputMode="numeric" min="1" step="1" placeholder="¿Cuántas van?"
                  value={scanQty} onChange={e => setScanQty(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') confirmScan(); }} data-id="entregas.input.scan-cantidad" />
                <button type="button" style={{ ...S.btnGhost, height: 42, fontWeight: 700, color: 'var(--lp-brand-700)' }} onClick={confirmScan} data-id="entregas.btn.scan-agregar">Agregar</button>
              </div>
              <button type="button" style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--lp-text-tertiary)', fontSize: 11.5, cursor: 'pointer', padding: 0 }} onClick={() => { setScanPending(null); setScanQty(''); }}>Cancelar escaneo</button>
            </div>
          )}

          {lineas.length > 0 && (
            <div style={S.cart}>
              <div style={S.cartHead}>Se entregará · {totalU} unidad{totalU === 1 ? '' : 'es'}</div>
              {lineas.map((l, i) => (
                <div key={i} style={S.cartRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre || l.producto}</div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                      {l.fuente === 'americano' ? `Americano ${l.almacen}` : l.fuente === 'envases' ? 'Envases · Terán' : 'PT Terán'} · {LBL_PRES[l.presentacion]}
                      {l.sublotes?.length ? ` · ${l.sublotes.length} QR` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong style={{ fontFamily: 'var(--lp-font-mono)', fontSize: 15 }}>{l.cantidad}</strong>
                    <button type="button" style={S.del} onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))} aria-label="Quitar">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {err && <div style={S.err}>{err}</div>}
        </div>
        <div style={S.shFoot}>
          <button style={S.act(false, saving)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.act(true, !puede)} onClick={confirmar} disabled={!puede} data-id="entregas.btn.confirmar" data-rol="admin,almacen">
            {saving
              ? (editando ? 'Corrigiendo…' : 'Registrando…')
              : (editando ? `Guardar cambios (${totalU} u.)` : `Entregar ${totalU > 0 ? totalU + ' u.' : ''} → descuenta`)}
          </button>
        </div>
      </div>
      {scanning && <QRScanner onResult={handleScan} onClose={() => setScanning(false)} />}
    </div>
  );
}

/* ── Alta de sucursal (ago 2026) ───────────────────────────────────────────
   Dar de alta una tienda es un acto EXPLÍCITO y aparte de registrar la entrega:
   así nadie crea una sucursal nueva por una errata al capturar. El duplicado
   por mayúsculas lo rechaza el backend (409) y el mensaje se muestra tal cual. */
export function NuevaSucursalSheet({ isDesktop, tiendas, onClose, onDone }) {
  useBodyScrollLock(true);
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const limpio = nombre.replace(/\s+/g, ' ').trim();
  const yaExiste = tiendas.some(t => t.toUpperCase() === limpio.toUpperCase());

  const guardar = async () => {
    if (limpio.length < 2 || saving || yaExiste) return;
    setSaving(true); setErr('');
    try {
      const r = await api.crearSucursal(limpio);
      onDone((r?.tienda && r.tienda.nombre) || limpio);
    } catch (e) { setErr(humanizeError(e)); setSaving(false); }
  };

  return (
    <div style={{ ...S.overlay, ...(isDesktop ? S.overlayDesk : {}) }}>
      <div style={S.sheet(isDesktop)} onClick={e => e.stopPropagation()}>
        <div style={S.shHead}>
          <div style={S.shTitle}>Agregar sucursal</div>
          <button style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--lp-text-tertiary)', padding: 4, lineHeight: 1 }} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.shBody}>
          <label style={S.lbl}>Nombre de la sucursal</label>
          <input style={S.input} value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
            placeholder="Ej: PALACO" maxLength={120} data-id="entregas.input.sucursal"
            onKeyDown={e => { if (e.key === 'Enter') guardar(); }} />
          <div style={{ fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 8, lineHeight: 1.5 }}>
            Quedará disponible en <strong>Tienda destino</strong> para todas las entregas.
          </div>
          {yaExiste && <div style={{ ...S.err, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)' }}>Esa sucursal ya está dada de alta.</div>}
          {err && <div style={S.err}>{err}</div>}
        </div>
        <div style={S.shFoot}>
          <button style={S.act(false)} onClick={onClose} data-id="entregas.btn.cancelar-sucursal">Cancelar</button>
          <button style={S.act(true, limpio.length < 2 || saving || yaExiste)} disabled={limpio.length < 2 || saving || yaExiste}
            onClick={guardar} data-id="entregas.btn.guardar-sucursal">
            {saving ? 'Guardando…' : 'Guardar sucursal'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Corregir la sucursal de una entrega ya registrada (ago 2026) ──────────
   Equivocarse de tienda al capturar es un error de DESTINO: la mercancía que
   salió es la misma, cambia a nombre de quién quedó. No devuelve ni descuenta
   nada; el backend arrastra el cambio a los rastros y lo deja anotado en la
   entrega. */
export function CorregirTiendaSheet({ isDesktop, entrega, tiendas, onClose, onDone }) {
  useBodyScrollLock(true);
  const [tienda, setTienda] = useState(entrega.tienda || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const puede = !!tienda && tienda !== entrega.tienda && !saving;

  const guardar = async () => {
    if (!puede) return;
    setSaving(true); setErr('');
    try {
      const r = await api.corregirTiendaEntrega(entrega.id || entrega.folio, tienda);
      onDone((r?.entrega && r.entrega.tienda) || tienda);
    } catch (e) { setErr(humanizeError(e)); setSaving(false); }
  };

  return (
    <div style={{ ...S.overlay, ...(isDesktop ? S.overlayDesk : {}) }}>
      <div style={S.sheet(isDesktop)} onClick={e => e.stopPropagation()}>
        <div style={S.shHead}>
          <div style={S.shTitle}>Corregir sucursal · {entrega.folio}</div>
          <button style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--lp-text-tertiary)', padding: 4, lineHeight: 1 }} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.shBody}>
          <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)', lineHeight: 1.5, marginTop: 6 }}>
            Registrada a nombre de <strong style={{ color: 'var(--lp-text-primary)' }}>{entrega.tienda}</strong>. Cambiar la sucursal <strong>no mueve inventario</strong>: lo entregado es lo mismo, solo se corrige el destino. Vuelve a imprimir la remisión si ya la habías sacado.
          </div>
          <label style={S.lbl}>Sucursal correcta</label>
          {/* La actual va SIEMPRE en la lista aunque ya no esté en el catálogo:
              si no, el select arrancaría en otra tienda y un guardado
              distraído cambiaría el destino sin que nadie lo eligiera. */}
          <select style={S.input} value={tienda} onChange={e => setTienda(e.target.value)} data-id="entregas.select.corregir-tienda">
            {[...new Set([entrega.tienda, ...tiendas].filter(Boolean))].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {err && <div style={S.err}>{err}</div>}
        </div>
        <div style={S.shFoot}>
          <button style={S.act(false)} onClick={onClose} data-id="entregas.btn.cancelar-correccion">Cancelar</button>
          <button style={S.act(true, !puede)} disabled={!puede} onClick={guardar} data-id="entregas.btn.guardar-correccion">
            {saving ? 'Corrigiendo…' : 'Corregir sucursal'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Menú ⋮ de la entrega (ago 2026) ───────────────────────────────────────
   Las acciones de una entrega ya hecha viven aquí en vez de llenar la tarjeta
   de botones. Cierra al hacer click fuera o con Escape — es un desplegable, no
   un modal (esos solo cierran con su X). */
function MenuEntrega({ acciones }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" style={S.kebab} onClick={() => setAbierto(v => !v)}
        aria-label="Opciones de la entrega" aria-haspopup="menu" aria-expanded={abierto}
        data-id="entregas.btn.menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" />
        </svg>
      </button>
      {abierto && (
        <div role="menu" style={S.menu}>
          {acciones.map(a => (
            <button key={a.label} type="button" role="menuitem" style={S.menuItem}
              onClick={() => { setAbierto(false); a.onClick(); }} data-id={a.dataId}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* JUL 2026: `embedded` — la pantalla también vive como vista del hub "Logística"
   (/transferencias) del admin (patrón AlmacenPage). Solo suprime su TopBar. */
export default function EntregasPage({ embedded = false }) {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const canCrear = !!user && ['admin', 'almacen'].includes(user.rol);
  const [sheet, setSheet] = useState(false);
  const [sheetSucursal, setSheetSucursal] = useState(false);
  const [corregir, setCorregir] = useState(null);
  const [editar, setEditar] = useState(null);
  const [remision, setRemision] = useState(null);
  const [toast, setToast] = useState('');

  const { data, reload } = useApiData(() => api.getEntregas(), null, 60000);
  /* 'entregas' → onEntregas (kebab→camel automático del hook). */
  useRealtimeSync({ onEntregas: () => reload(), onInventario: () => reload(), onStkAmericano: () => reload() });

  const entregas = data?.data?.entregas || [];
  const tiendas = data?.data?.tiendas || [];
  const hoyStr = new Date().toISOString().slice(0, 10);
  const deHoy = entregas.filter(e => (e.fecha || '').slice(0, 10) === hoyStr);
  const unidadesHoy = deHoy.reduce((a, e) => a + (e.lineas || []).reduce((x, l) => x + (Number(l.cantidad) || 0), 0), 0);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  return (
    <>
      {!embedded && <TopBar title="Entregas a tiendas" />}
      <div style={S.wrap}>
        <div style={S.kpis}>
          <div style={S.kpi}><div style={S.kpiLbl}>Entregas hoy</div><div style={S.kpiVal}>{deHoy.length}</div></div>
          <div style={S.kpi}><div style={S.kpiLbl}>Unidades hoy</div><div style={S.kpiVal}>{nf(unidadesHoy)}</div></div>
          <div style={S.kpi}><div style={S.kpiLbl}>Entregas totales</div><div style={S.kpiVal}>{data?.data?.total ?? entregas.length}</div></div>
        </div>

        <div style={S.topRow}>
          <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)', lineHeight: 1.5, flex: '1 1 260px' }}>
            La <strong>baja del CEDIS</strong> ocurre aquí: cada entrega descuenta cubetas/galones (Americano y PT Terán) y deja remisión con folio.
          </div>
          {canCrear && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={S.btnAdd} onClick={() => setSheet(true)} data-id="entregas.btn.nueva" data-rol="admin,almacen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                Nueva entrega
              </button>
              <button style={S.btnSec} onClick={() => setSheetSucursal(true)} data-id="entregas.btn.nueva-sucursal" data-rol="admin,almacen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></svg>
                Agregar sucursal
              </button>
            </div>
          )}
        </div>

        {entregas.length === 0 ? (
          <div style={S.empty}>Aún no hay entregas registradas. Con "Nueva entrega" descuentas del inventario lo que se va a cada tienda.</div>
        ) : entregas.map(e => (
          <div key={e.id} style={S.card} data-id="entregas.card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <span style={S.folio}>{e.folio}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, marginLeft: 10 }}>{e.tienda}</span>
                <div style={S.meta}>
                  {fmtFecha(e.fecha)} · {e.usuario}
                  {/* Una corrección de destino se DECLARA: quien lea la entrega
                      tiene que saber que antes decía otra sucursal. */}
                  {(e.correcciones || []).filter(c => c.campo === 'tienda').slice(-1).map((c, i) => (
                    <span key={i}> · <span style={{ color: 'var(--lp-warning-700, #92400E)' }}>corregida: antes {c.de}</span></span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button type="button" style={S.btnGhost} onClick={() => setRemision(e)} data-id="entregas.btn.remision">Remisión</button>
                {canCrear && (
                  /* La remisión ya tiene su botón a la vista (es lo que más se
                     usa): en el menú van solo las correcciones. */
                  <MenuEntrega acciones={[
                    { label: 'Editar entrega', dataId: 'entregas.menu.editar', onClick: () => setEditar(e) },
                    { label: 'Cambiar sucursal', dataId: 'entregas.menu.corregir-tienda', onClick: () => setCorregir(e) },
                  ]} />
                )}
              </div>
            </div>
            <div style={S.lineas}>
              {(e.lineas || []).map((l, i) => (
                <div key={i} style={S.linea}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.producto}</span>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                    <span style={S.badge(l.fuente === 'americano')}>{l.fuente === 'americano' ? `AM ${l.almacen}` : l.fuente === 'envases' ? 'ENV' : 'PT'}</span>
                    <strong style={{ fontFamily: 'var(--lp-font-mono)' }}>{l.cantidad}</strong> {LBL_PRES[l.presentacion]?.toLowerCase() || l.presentacion}{l.cantidad === 1 ? '' : (l.presentacion === 'atomizador750' ? 'es' : 's')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {sheet && (
        <NuevaEntregaSheet
          isDesktop={isDesktop}
          tiendasPrev={tiendas}
          onClose={() => setSheet(false)}
          onDone={(entrega) => {
            setSheet(false);
            reload();
            showToast(entrega ? `Entrega ${entrega.folio} registrada — inventario descontado` : 'Entrega registrada');
            if (entrega) setRemision(entrega);
          }}
        />
      )}
      {sheetSucursal && (
        <NuevaSucursalSheet
          isDesktop={isDesktop}
          tiendas={tiendas}
          onClose={() => setSheetSucursal(false)}
          onDone={(nombre) => {
            setSheetSucursal(false);
            reload();
            showToast(`Sucursal "${nombre}" dada de alta`);
          }}
        />
      )}
      {editar && (
        <NuevaEntregaSheet
          isDesktop={isDesktop}
          tiendasPrev={tiendas}
          entrega={editar}
          onClose={() => setEditar(null)}
          onDone={(e2) => {
            setEditar(null);
            reload();
            showToast(`${editar.folio} corregida — inventario ajustado`);
            if (e2) setRemision(e2);
          }}
        />
      )}
      {corregir && (
        <CorregirTiendaSheet
          isDesktop={isDesktop}
          entrega={corregir}
          tiendas={tiendas}
          onClose={() => setCorregir(null)}
          onDone={(nombre) => {
            setCorregir(null);
            reload();
            showToast(`${corregir.folio} quedó a nombre de ${nombre}`);
          }}
        />
      )}
      {remision && <RemisionOverlay entrega={remision} onClose={() => setRemision(null)} />}
      {toast && <div style={S.toast}>{toast}</div>}
    </>
  );
}
