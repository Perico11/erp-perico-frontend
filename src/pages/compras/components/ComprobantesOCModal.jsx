import { getToken } from '../../../services/api';

/* ComprobantesOCModal — detalle de una OC recibida (jun 2026).
   Reemplaza el botón "Comprobante" que solo abría un PDF (y a veces nada):
   ahora muestra en un solo lugar QUIÉN recibió + su FIRMA, el PDF de la
   FACTURA (comprobante de compra) y el PDF del PAGO. Toda la data ya vive en
   la OC (recibidoPor / firmaRecepcion / comprobantePdf / comprobantePagoPdf);
   los PDFs se sirven por GET /api/compras/oc/comprobante/<id>(_pago). */

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(10,16,14,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 16 },
  sheet: { background: 'var(--lp-bg-base)', borderRadius: 20, padding: '20px 20px 24px', maxWidth: 480, width: '100%', maxHeight: '92vh', overflowY: 'auto' },
  h: { fontSize: 18, fontWeight: 700, color: 'var(--lp-text-primary)' },
  sub: { fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 2, marginBottom: 14 },
  sec: { background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 14, padding: '13px 14px', marginBottom: 10 },
  secTit: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--lp-text-tertiary)', marginBottom: 8 },
  row: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '3px 0' },
  k: { color: 'var(--lp-text-secondary)', flexShrink: 0 },
  v: { fontWeight: 600, color: 'var(--lp-text-primary)', textAlign: 'right', wordBreak: 'break-word' },
  firmaBox: { marginTop: 8, border: '1px solid var(--lp-border-subtle)', borderRadius: 10, background: '#fff', padding: 6, display: 'flex', justifyContent: 'center' },
  firmaImg: { maxWidth: '100%', maxHeight: 120, objectFit: 'contain' },
  muted: { fontSize: 12.5, color: 'var(--lp-text-tertiary)', fontStyle: 'italic' },
  pdfBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', height: 44, borderRadius: 12, border: '1.5px solid var(--lp-brand-600)', background: 'var(--lp-brand-50)', color: 'var(--lp-brand-700)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
  ref: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 6, textAlign: 'center' },
  close: { height: 48, width: '100%', borderRadius: 12, border: 'none', background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-secondary)', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
};

const IDoc = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
);

function fechaFmt(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return ''; }
}

export default function ComprobantesOCModal({ oc, onClose }) {
  if (!oc) return null;
  /* ?token=: el endpoint es GET con auth por header x-session-token, pero
     window.open NO manda headers → el server acepta el token por query SOLO en
     GET (mismo patrón que export-xlsx / hojas de impresión). Sin esto el PDF
     respondía "Sesión requerida". */
  const tk = encodeURIComponent(getToken() || '');
  const facturaUrl = oc.comprobantePdf ? `/api/compras/oc/comprobante/${oc.id}?token=${tk}` : null;
  const pagoUrl = oc.comprobantePagoPdf ? `/api/compras/oc/comprobante/${oc.id}_pago?token=${tk}` : null;
  const recep = oc.recibidoPor || oc.firmaRecepcion;
  const qc = oc.qcRecepcion;

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div style={S.sheet}>
        <div style={S.h}>Detalle de la orden</div>
        <div style={S.sub}>{oc.codigo || oc.id} · {oc.proveedor || '—'}</div>

        {/* ── Recepción: quién recibió + firma ── */}
        <div style={S.sec}>
          <div style={S.secTit}>Recepción</div>
          {recep ? (
            <>
              <div style={S.row}><span style={S.k}>Recibió</span><span style={S.v}>{oc.recibidoPor || '—'}</span></div>
              {oc.fechaRecepcion && <div style={S.row}><span style={S.k}>Fecha</span><span style={S.v}>{fechaFmt(oc.fechaRecepcion)}</span></div>}
              {qc && <div style={S.row}><span style={S.k}>Calidad</span><span style={{ ...S.v, color: qc.calidadOk ? 'var(--lp-success-700)' : 'var(--lp-warning-700)' }}>{qc.calidadOk ? 'OK' : 'Con observaciones'}</span></div>}
              {qc && qc.notas && <div style={S.row}><span style={S.k}>Notas</span><span style={S.v}>{qc.notas}</span></div>}
              {oc.firmaRecepcion
                ? <div style={S.firmaBox}><img src={oc.firmaRecepcion} alt="Firma de recepción" style={S.firmaImg} /></div>
                : <div style={{ ...S.muted, marginTop: 6 }}>Sin firma registrada.</div>}
            </>
          ) : <div style={S.muted}>Aún no se registra la recepción.</div>}
        </div>

        {/* ── Factura / comprobante de compra ── */}
        <div style={S.sec}>
          <div style={S.secTit}>Factura · comprobante de compra</div>
          {facturaUrl ? (
            <>
              <button style={S.pdfBtn} onClick={() => window.open(facturaUrl, '_blank')}>{IDoc} Ver factura (PDF)</button>
              {oc.referenciaPago && <div style={S.ref}>Ref: {oc.referenciaPago}</div>}
            </>
          ) : <div style={S.muted}>Sin factura adjunta.</div>}
        </div>

        {/* ── Pago (lo que NOSOTROS pagamos) ── */}
        <div style={S.sec}>
          <div style={S.secTit}>Comprobante de pago</div>
          {pagoUrl ? (
            <>
              <button style={S.pdfBtn} onClick={() => window.open(pagoUrl, '_blank')}>{IDoc} Ver pago (PDF)</button>
              {(oc.referenciaPagoReal || oc.fechaPago) && <div style={S.ref}>{oc.referenciaPagoReal ? `Ref: ${oc.referenciaPagoReal}` : ''}{oc.referenciaPagoReal && oc.fechaPago ? ' · ' : ''}{oc.fechaPago ? fechaFmt(oc.fechaPago) : ''}</div>}
            </>
          ) : oc.pago === 'contado'
            ? <div style={S.muted}>Pago de contado — el comprobante es la factura de arriba.</div>
            : <div style={S.muted}>Pago aún no registrado. Usa "Registrar pago" para subir el comprobante.</div>}
        </div>

        <button style={S.close} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
