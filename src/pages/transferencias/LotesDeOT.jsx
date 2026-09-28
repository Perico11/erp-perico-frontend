import { desgloseLotesDeOT, etiquetaPiezasLote } from '../../utils/lotesOT';

/* LOTES EN ESTA OT (24-sep-2026, reporte del dueño): el surtido reparte la
   cantidad entre lotes —del más viejo al más nuevo— y Terán no sabía que de
   30 cubetas, 20 eran de un lote y 10 de otro; podía etiquetarlas todas con
   el mismo. La tarjeta muestra el reparto que guardó el backend. */
export default function LotesDeOT({ ot }) {
  const d = desgloseLotesDeOT(ot);
  if (!d) return null;
  return (
    <div style={C.lotes} data-id="transferencias.lotes">
      <div style={C.lotesHead}>
        <span style={C.lotesTitle}>Lotes en esta OT</span>
        <span style={C.lotesFuente}>{d.fuente === 'recibidos' ? 'Recibido en Terán' : d.modo === 'elegido' ? 'Elegido en Fábrica' : d.modo === 'automatico' ? 'Asignado automático' : 'Surtido en Fábrica'}</span>
      </div>
      {d.lotes.map((l, i) => (
        <div key={`${l.producto}|${l.codigoLote}|${i}`} style={C.loteRow}>
          <span style={C.loteCod}>{l.codigoLote}</span>
          <span style={C.loteQty}>{etiquetaPiezasLote(l)}</span>
          {d.variosProductos && <span style={C.loteProd}>{l.producto}</span>}
        </div>
      ))}
      {d.sinLote > 0 && (
        <div style={C.loteAviso}>
          {d.sinLote.toLocaleString('es-MX', { maximumFractionDigits: 1 })} cub viajaron sin lote registrado — confirma el lote en la etiqueta física antes de envasar o reetiquetar.
        </div>
      )}
      {d.difiere && (
        <div style={C.loteAviso}>Lo recibido no coincide con lo surtido en Fábrica — revisa las etiquetas físicas.</div>
      )}
    </div>
  );
}

/* Mismos colores "glass forest" de la tarjeta OT (TransferenciasPage). */
const C = {
  lotes: { background: '#fff', border: '1px solid rgba(0,0,0,.06)', borderRadius: 14, padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,.04)', display: 'flex', flexDirection: 'column', gap: 6 },
  lotesHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  lotesTitle: { fontSize: 11, fontWeight: 600, color: '#0f7a5a', textTransform: 'uppercase', letterSpacing: '0.05em' },
  lotesFuente: { fontSize: 11, color: '#94a39b' },
  loteRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 12.5 },
  loteCod: { fontFamily: 'var(--lp-font-mono)', fontSize: 12, fontWeight: 600, color: '#0f7a5a', background: 'rgba(15,122,90,.08)', border: '1px solid rgba(15,122,90,.18)', borderRadius: 6, padding: '2px 8px', overflowWrap: 'anywhere' },
  loteQty: { color: '#16201c', fontWeight: 500, whiteSpace: 'nowrap' },
  loteProd: { flexBasis: '100%', fontSize: 11, color: '#5a6b63', textTransform: 'uppercase' },
  loteAviso: { fontSize: 11.5, color: '#9a6a13', fontStyle: 'italic' },
};
