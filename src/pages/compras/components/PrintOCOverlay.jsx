/* PrintOCOverlay — documento imprimible de la OC, 1:1 con el mockup
   `integracion/Compras.html` (printov/pdoc): membrete con marca, folio mono,
   sección proveedor, TABLA DE PARTIDAS (Descripción · Cantidad · Importe),
   total, condiciones (pago/entrega) y firmas.
   El documento se imprime SIEMPRE en claro (papel) — colores fijos del mockup,
   independientes del tema. `@media print` aísla #lp-printdoc.
   La versión generada por el servidor (/api/compras/oc/:id/print) sigue
   disponible con el enlace "Abrir versión del servidor" (acción conservada). */

const BRAND_INK = '#0F6E56';
const INK = '#16241F';
const MUT = '#6b6560';
const SEC = '#9c9589';

const fmt$ = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num === 0) return null;
  return '$' + num.toLocaleString('es-MX', { maximumFractionDigits: 2 });
};

const fmtKg = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return '—';
  return num.toLocaleString('es-MX') + ' kg';
};

function fechaLarga(iso) {
  try {
    const d = iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00') : new Date();
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return '—'; }
}

/* Etiqueta de condiciones de pago del documento */
function pagoLabel(oc) {
  if (oc.pago === 'contado') {
    return 'Contado' + (oc.referencia ? ' · ' + oc.referencia : (oc.comprobanteNombre ? ' · ' + oc.comprobanteNombre : ''));
  }
  if (oc.pago === 'credito') {
    let s = 'Crédito 30 días';
    if (oc.pagada) s += ' · pagado';
    else if (oc.fechaVencimiento) s += ' · vence ' + fechaLarga(oc.fechaVencimiento);
    return s;
  }
  return 'Por definir al aprobar';
}

const IPrint = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>
);

export default function PrintOCOverlay({ oc, onClose }) {
  if (!oc) return null;

  const items = Array.isArray(oc.items) ? oc.items : [];
  const flete = Number(oc.fleteEstimadoMxn) || 0;
  const estimado = items.reduce((s, it) => s + (Number(it.kg) || 0) * (Number(it.precioUnitario) || 0), 0);
  const total = Number(oc.totalFacturaConIva) > 0 ? Number(oc.totalFacturaConIva) : (estimado + flete);
  const autorizo = oc.aprobadaPor || oc.aprobadoPor || 'Compras';

  return (
    <div className="lp-printov" onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      {/* CSS del documento + aislamiento @media print (scoped a esta clase) */}
      <style>{`
        .lp-printov{ position:fixed; inset:0; background:rgba(10,16,14,.55); display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:12px; padding:22px; z-index:9999; }
        .lp-pdoc{ background:#fff; color:${INK}; width:100%; max-width:560px; max-height:70vh; overflow-y:auto;
          border-radius:14px; padding:24px 22px; font-family:var(--lp-font-sans); box-shadow:0 20px 50px rgba(0,0,0,.3); box-sizing:border-box; }
        .lp-pd-h{ display:flex; align-items:flex-start; justify-content:space-between; border-bottom:2px solid ${INK}; padding-bottom:12px; margin-bottom:14px; }
        .lp-pd-brand{ font-size:16px; font-weight:600; color:${BRAND_INK}; letter-spacing:-.01em; }
        .lp-pd-brand small{ display:block; font-size:10px; font-weight:500; color:${MUT}; letter-spacing:.06em; text-transform:uppercase; }
        .lp-pd-doc{ text-align:right; }
        .lp-pd-doc .t{ font-size:13px; font-weight:600; }
        .lp-pd-doc .f{ font-family:var(--lp-font-mono); font-size:14px; font-weight:700; color:${BRAND_INK}; }
        .lp-pd-doc .d{ font-size:11px; color:${MUT}; margin-top:2px; }
        .lp-pd-sec{ font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:${SEC}; margin:14px 0 6px; }
        .lp-pd-row{ display:flex; justify-content:space-between; font-size:13px; padding:3px 0; }
        .lp-pd-row .k{ color:${MUT}; } .lp-pd-row .v{ font-weight:600; }
        .lp-pd-tbl{ width:100%; border-collapse:collapse; margin-top:4px; font-size:13px; }
        .lp-pd-tbl th{ text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:${SEC}; border-bottom:1px solid #E8E6DE; padding:6px 0; }
        .lp-pd-tbl td{ padding:8px 0; border-bottom:1px solid #F0EEE8; }
        .lp-pd-tbl td.r, .lp-pd-tbl th.r{ text-align:right; font-family:var(--lp-font-mono); }
        .lp-pd-total{ display:flex; justify-content:space-between; margin-top:12px; padding-top:10px; border-top:2px solid ${INK}; font-size:15px; font-weight:700; }
        .lp-pd-total .mono{ font-family:var(--lp-font-mono); color:${BRAND_INK}; }
        .lp-pd-firma{ margin-top:34px; display:flex; justify-content:space-between; gap:20px; }
        .lp-pd-firma div{ flex:1; border-top:1px solid ${INK}; padding-top:6px; font-size:11px; color:${MUT}; text-align:center; }
        .lp-pbtns{ display:flex; gap:10px; width:100%; max-width:560px; }
        .lp-pbtn{ flex:1; height:46px; border-radius:12px; border:none; cursor:pointer; font-family:var(--lp-font-sans);
          font-size:13.5px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:7px; }
        .lp-pbtn.ghost{ background:#fff; color:${MUT}; border:1px solid rgba(0,0,0,.12); }
        .lp-pbtn.primary{ background:var(--lp-brand-600); color:#fff; }
        .lp-psrv{ background:none; border:none; cursor:pointer; font-family:var(--lp-font-sans); font-size:12px; font-weight:600;
          color:rgba(255,255,255,.85); text-decoration:underline; padding:4px 8px; }
        @media print{
          body *{ visibility:hidden !important; }
          #lp-printdoc, #lp-printdoc *{ visibility:visible !important; }
          #lp-printdoc{ position:fixed; inset:0; width:auto; max-width:none; max-height:none; border-radius:0; box-shadow:none; padding:40px; overflow:visible; }
        }
        @media (prefers-reduced-motion:reduce){ .lp-printov *{ transition:none !important; } }
      `}</style>

      <div className="lp-pdoc" id="lp-printdoc">
        <div className="lp-pd-h">
          <div className="lp-pd-brand">Pinturas El Perico<small>ERP Producción</small></div>
          <div className="lp-pd-doc">
            <div className="t">Orden de compra</div>
            <div className="f">{oc.codigo || oc.id}</div>
            <div className="d">{fechaLarga()}</div>
          </div>
        </div>

        <div className="lp-pd-sec">Proveedor</div>
        <div className="lp-pd-row"><span className="k">Nombre</span><span className="v">{oc.proveedor || '—'}</span></div>
        <div className="lp-pd-row"><span className="k">Fecha de entrega</span><span className="v">{oc.fechaEntrega ? fechaLarga(oc.fechaEntrega) : '—'}</span></div>

        <div className="lp-pd-sec">Materia prima</div>
        <table className="lp-pd-tbl">
          <thead>
            <tr><th>Descripción</th><th className="r">Cantidad</th><th className="r">Importe</th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td>Materia prima</td><td className="r">—</td><td className="r">—</td></tr>
            ) : items.map((it, i) => {
              const importe = (Number(it.kg) || 0) * (Number(it.precioUnitario) || 0);
              return (
                <tr key={i}>
                  <td>{it.mp || 'MP'}{it.presentacionOtro ? ` · ${it.presentacionOtro}` : (it.presentacion && it.presentacion !== 'otro' ? ` · ${String(it.presentacion).replace('_', ' ')}` : '')}</td>
                  <td className="r">{fmtKg(it.kg)}</td>
                  <td className="r">{fmt$(importe) || '—'}</td>
                </tr>
              );
            })}
            {flete > 0 && (
              <tr>
                <td style={{ color: MUT }}>Flete estimado</td>
                <td className="r">—</td>
                <td className="r">{fmt$(flete)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="lp-pd-total"><span>Total</span><span className="mono">{fmt$(total) || '—'}</span></div>

        <div className="lp-pd-sec">Condiciones</div>
        <div className="lp-pd-row"><span className="k">Pago</span><span className="v">{pagoLabel(oc)}</span></div>
        <div className="lp-pd-row"><span className="k">Entrega en</span><span className="v">Planta El Perico · Terán</span></div>

        <div className="lp-pd-firma">
          <div>Autorizó — {autorizo}</div>
          <div>Recibió — Proveedor</div>
        </div>
      </div>

      <div className="lp-pbtns">
        <button type="button" className="lp-pbtn ghost" data-id="compras.btn.cerrar-print" onClick={onClose}>Cerrar</button>
        <button type="button" className="lp-pbtn primary" data-id="compras.btn.imprimir-oc" data-rol="compras,admin"
          onClick={() => window.print()}>
          {IPrint}Imprimir
        </button>
      </div>
      {/* Acción existente conservada: documento formal generado por el backend */}
      <button type="button" className="lp-psrv" data-id="compras.btn.imprimir-oc-servidor" data-rol="compras,admin"
        onClick={() => window.open(`/api/compras/oc/${oc.id}/print`, '_blank')}>
        Abrir versión del servidor
      </button>
    </div>
  );
}
