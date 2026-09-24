import { etiquetaMedida, ptMedidaDef } from '../../utils/ptMedidas';
import { totalesPorProducto, estadoTotal } from '../../utils/seleccionLotes';

/* ¿DE QUÉ LOTES SALE? (24-sep-2026) — la alternativa sin escáner al surtir.
   Lista lo disponible en Fábrica por lote y sublote, PRELLENADO con la
   sugerencia del surtido automático (del más viejo al más nuevo). Si al camión
   subieron otras piezas, el piso cambia los números. Controlado: el estado
   (`vals` = { cod: piezas }) vive en ParcialSheet, que lo manda al backend. */
export default function SeleccionLotesSurtido({ productos, vals, onChange, onUsarSugerencia, disabled }) {
  const totales = totalesPorProducto(productos, vals);
  return (
    <div style={L.wrap} data-id="transferencias.seleccion-lotes">
      <div style={L.head}>
        <span style={L.title}>¿De qué lotes sale?</span>
        <button type="button" style={L.linkBtn} onClick={onUsarSugerencia} disabled={disabled}
          data-id="transferencias.btn.usar-sugerencia" data-rol="admin,tecnico">
          Usar sugerencia
        </button>
      </div>
      <div style={L.hint}>
        Ya viene lleno con lo más viejo primero. Si al camión subieron otras piezas, cambia los números: el sistema registra exactamente lo que marques.
      </div>

      {productos.map((p, i) => {
        const t = totales[i];
        return (
          <div key={p.producto} style={L.prod}>
            <div style={L.prodHead}>
              <span style={L.prodName}>{p.producto}</span>
              <span style={L.estado(t.ok)} aria-live="polite">
                {fmt(t.elegido)} de {fmt(t.cantidad)} cub · {estadoTotal(t)}
              </span>
            </div>
            {(p.disponibles || []).map(l => (
              <div key={l.codigoLote} style={L.lote}>
                <div style={L.loteCod}>{l.codigoLote}</div>
                {(l.sublotes || []).map(s => {
                  const v = vals[s.cod] ?? '';
                  const on = Number(v) > 0;
                  return (
                    <div key={s.cod} style={L.row}>
                      <div style={L.rowInfo}>
                        <span style={L.subCod}>{s.cod}</span>
                        <span style={L.disp}>Hay {s.tote ? '1 tote · ' + fmt(s.cubEq) + ' cub' : dispLabel(s)}</span>
                      </div>
                      {s.tote ? (
                        <button type="button" style={L.toteBtn(on)} disabled={disabled}
                          onClick={() => onChange(s.cod, on ? 0 : 1)}
                          aria-pressed={on} aria-label={`Tote ${s.cod} ${on ? 'va' : 'no va'}`}>
                          {on ? 'Va' : 'No va'}
                        </button>
                      ) : (
                        <input
                          style={L.input(on)} type="number" inputMode="numeric" min="0" max={s.qty} step="1"
                          value={v} disabled={disabled}
                          onChange={(e) => onChange(s.cod, e.target.value)}
                          aria-label={`Piezas de ${s.cod} que van`}
                          data-id="transferencias.input.lote" data-rol="admin,tecnico"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

const fmt = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
const dispLabel = (s) => (ptMedidaDef(s.tipo) ? etiquetaMedida(s.tipo, s.qty) : `${fmt(s.qty)} piezas`);

const L = {
  wrap: { marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)' },
  linkBtn: { border: 'none', background: 'none', color: 'var(--lp-brand-700)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: '6px 0' },
  hint: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 2, lineHeight: 1.45 },
  prod: { marginTop: 12 },
  prodHead: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 6 },
  prodName: { fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--lp-text-primary)' },
  estado: (ok) => ({ fontSize: 12, fontWeight: 600, color: ok ? 'var(--lp-brand-700)' : '#b3261e' }),
  lote: { padding: '8px 0', borderTop: '1px solid var(--lp-border-subtle)' },
  loteCod: { fontFamily: 'var(--lp-font-mono)', fontSize: 12.5, fontWeight: 700, color: 'var(--lp-brand-700)', marginBottom: 4, overflowWrap: 'anywhere' },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' },
  rowInfo: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  subCod: { fontFamily: 'var(--lp-font-mono)', fontSize: 11, color: 'var(--lp-text-tertiary)', overflowWrap: 'anywhere' },
  disp: { fontSize: 12.5, color: 'var(--lp-text-secondary)' },
  input: (on) => ({ width: 86, flexShrink: 0, padding: '9px 10px', borderRadius: 10, fontSize: 15, fontFamily: 'var(--lp-font-mono)', textAlign: 'right', border: on ? '1.5px solid var(--lp-brand-600)' : '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-base)', color: 'var(--lp-text-primary)', boxSizing: 'border-box' }),
  toteBtn: (on) => ({ width: 86, flexShrink: 0, minHeight: 40, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, border: on ? '1.5px solid var(--lp-brand-600)' : '1px solid var(--lp-border-subtle)', background: on ? 'var(--lp-brand-600)' : 'var(--lp-bg-base)', color: on ? '#fff' : 'var(--lp-text-secondary)' }),
};
