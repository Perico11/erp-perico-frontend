/* ════════════════════════════════════════════════════════════════════════════
   EntregasPage — ENTREGAS A TIENDAS (jul 2026, pedido dueño).

   Somos un CEDIS: la BAJA del inventario ocurre aquí, al entregar a una tienda
   (envasar solo cambia la forma). Una entrega (folio ENT-*) mezcla líneas de
   Americano 1/2 (cubetas/galones del color) y PT nacional de Terán (pool +
   espejo FEFO a sublotes → estado terminal 'entregado_tienda').

   Captura: manual (fuente → producto → presentación → cantidad) y/o ESCANEO del
   QR de las etiquetas (cada escaneo suma 1 unidad de esa línea). Un paso:
   confirmar descuenta e imprime la remisión. Tienda = texto libre con
   sugerencias de tiendas ya usadas. Roles: admin + almacén (Josué).
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useMemo, useCallback } from 'react';
import TopBar from '../../components/layout/TopBar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { QRScanner } from '../../components/QRModal';
import humanizeError from '../../utils/humanizeError';

const LBL_PRES = { cubeta: 'Cubeta', galon: 'Galón', litro: 'Litro', atomizador750: 'Atomizador' };
const PRES_PT = ['cubeta', 'galon', 'litro', 'atomizador750'];
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
  act: (primary, dis) => ({ flex: 1, height: 46, borderRadius: 10, border: primary ? 'none' : '1.5px solid var(--lp-border-subtle)', cursor: dis ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', opacity: dis ? 0.55 : 1, background: primary ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)', color: primary ? '#fff' : 'var(--lp-text-secondary)' }),
  toast: { position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 1300, background: 'var(--lp-text-primary)', color: 'var(--lp-bg-raised)', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.2)' },
};

/* ── Remisión imprimible (patrón PrintOCOverlay: siempre claro, aislada en print) ── */
function RemisionOverlay({ entrega, onClose }) {
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
        <div className="lp-ent-row"><span className="k">Entregó (CEDIS)</span><span className="v">{entrega.usuario}</span></div>
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
                  <td>{l.producto}{l.fuente === 'americano' ? ` (Americano ${l.almacen})` : ''}</td>
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
        <div className="lp-ent-firma">
          <div>Entregó — CEDIS Terán<br />{entrega.usuario} · nombre y firma</div>
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
function NuevaEntregaSheet({ isDesktop, tiendasPrev, onClose, onDone }) {
  useBodyScrollLock(true);
  const [tienda, setTienda] = useState('');
  const [lineas, setLineas] = useState([]);
  const [fuente, setFuente] = useState('americano1'); /* americano1 | americano2 | pt */
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

  const catalogo = useMemo(() => {
    if (fuente === 'pt') {
      const teran = ptUbi?.teran || ptUbi?.data?.teran || {};
      return Object.entries(teran)
        .map(([nombre, d]) => ({
          nombre,
          disp: {
            cubeta: Math.floor(Number(d.cubeta) || 0), galon: Math.floor(Number(d.galon) || 0),
            litro: Math.floor(Number(d.litro) || 0), atomizador750: Math.floor(Number(d.atm) || 0),
          },
        }))
        .filter(p => PRES_PT.some(x => p.disp[x] > 0))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    const src = fuente === 'americano2' ? am2 : am1;
    const colores = src?.data?.colores || src?.colores || [];
    return colores
      .map(c => ({ nombre: c.nombre, key: c.key, disp: { cubeta: Number(c.cubetas) || 0, galon: Number(c.galones) || 0 } }))
      .filter(c => c.disp.cubeta > 0 || c.disp.galon > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [fuente, am1, am2, ptUbi]);

  const sel = catalogo.find(c => c.nombre === producto);
  const presOpts = fuente === 'pt' ? PRES_PT : ['cubeta', 'galon'];
  const disp = sel ? (Number(sel.disp[presentacion]) || 0) : 0;
  const n = parseInt(cantidad, 10) || 0;

  const addLinea = () => {
    setErr('');
    if (!sel) { setErr('Elige un producto'); return; }
    if (n <= 0) { setErr('Indica la cantidad'); return; }
    if (n > disp) { setErr(`Solo hay ${nf(disp)} ${LBL_PRES[presentacion]?.toLowerCase() || presentacion}(s) disponibles`); return; }
    const nueva = fuente === 'pt'
      ? { fuente: 'pt', producto: sel.nombre, presentacion, cantidad: n }
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
      const r = await api.crearEntrega({ tienda: tienda.trim(), lineas });
      onDone(r?.entrega || null);
    } catch (e) { setErr(humanizeError(e)); setSaving(false); }
  };

  return (
    <div style={{ ...S.overlay, ...(isDesktop ? S.overlayDesk : {}) }}>
      <div style={S.sheet(isDesktop)} onClick={e => e.stopPropagation()}>
        <div style={S.shHead}>
          <div style={S.shTitle}>Nueva entrega a tienda</div>
          <button style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--lp-text-tertiary)', padding: 4, lineHeight: 1 }} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.shBody}>
          <label style={S.lbl}>Tienda destino</label>
          <input style={S.input} list="entregas-tiendas" value={tienda} onChange={e => setTienda(e.target.value)}
            placeholder="Ej: Suc. Palaco" data-id="entregas.input.tienda" />
          <datalist id="entregas-tiendas">{tiendasPrev.map(t => <option key={t} value={t} />)}</datalist>

          <label style={S.lbl}>Agregar producto</label>
          <div style={S.seg}>
            {[['americano1', 'Americano 1'], ['americano2', 'Americano 2'], ['pt', 'PT Terán']].map(([v, l]) => (
              <button key={v} type="button" style={S.segBtn(fuente === v)} onClick={() => { setFuente(v); setProducto(''); setPresentacion('cubeta'); }} data-id={`entregas.fuente.${v}`}>{l}</button>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            <select style={S.input} value={producto} onChange={e => setProducto(e.target.value)} data-id="entregas.select.producto">
              <option value="">— elige producto ({catalogo.length} con stock) —</option>
              {catalogo.map(c => (
                <option key={c.nombre} value={c.nombre}>
                  {c.nombre} · {presOpts.filter(p => c.disp[p] > 0).map(p => `${nf(c.disp[p])} ${LBL_PRES[p].toLowerCase()}${c.disp[p] === 1 ? '' : 's'}`).join(' · ')}
                </option>
              ))}
            </select>
          </div>

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
                      {l.fuente === 'americano' ? `Americano ${l.almacen}` : 'PT Terán'} · {LBL_PRES[l.presentacion]}
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
            {saving ? 'Registrando…' : `Entregar ${totalU > 0 ? totalU + ' u.' : ''} → descuenta`}
          </button>
        </div>
      </div>
      {scanning && <QRScanner onResult={handleScan} onClose={() => setScanning(false)} />}
    </div>
  );
}

export default function EntregasPage() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const canCrear = !!user && ['admin', 'almacen'].includes(user.rol);
  const [sheet, setSheet] = useState(false);
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
      <TopBar title="Entregas a tiendas" />
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
            <button style={S.btnAdd} onClick={() => setSheet(true)} data-id="entregas.btn.nueva" data-rol="admin,almacen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Nueva entrega
            </button>
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
                <div style={S.meta}>{fmtFecha(e.fecha)} · {e.usuario}</div>
              </div>
              <button type="button" style={S.btnGhost} onClick={() => setRemision(e)} data-id="entregas.btn.remision">Remisión</button>
            </div>
            <div style={S.lineas}>
              {(e.lineas || []).map((l, i) => (
                <div key={i} style={S.linea}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.producto}</span>
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}>
                    <span style={S.badge(l.fuente === 'americano')}>{l.fuente === 'americano' ? `AM ${l.almacen}` : 'PT'}</span>
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
      {remision && <RemisionOverlay entrega={remision} onClose={() => setRemision(null)} />}
      {toast && <div style={S.toast}>{toast}</div>}
    </>
  );
}
