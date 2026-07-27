import { money } from './importesOC';

/* ImportesOCFields — los campos de importes reales de una OC. El estado vive en
   useImportesOC (importesOC.js); aquí solo el render, compartido por
   RegistrarPagoModal (crédito, al pagar) y CorregirImportesModal (contado o ya
   pagada).

   Editable: **Producto** (total de la mercancía) y **Flete**. Nada más. Las
   partidas se listan como referencia de cómo quedó repartido el total — el
   descuadre viene del tipo de cambio, que mueve toda la compra, no un renglón. */

const S = {
  lbl: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', margin: '16px 2px 6px' },
  hint: { fontSize: 11, color: 'var(--lp-text-tertiary)', margin: '4px 2px 0' },
  input: { width: '100%', height: 46, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 15, color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box' },
  box: { background: 'var(--lp-bg-sunken)', borderRadius: 14, padding: '12px 12px 14px', marginTop: 6 },
  /* Partida: dato puro (nombre · kg · importe repartido). */
  linea: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', padding: '5px 0' },
  mp: { fontSize: 13.5, fontWeight: 600, color: 'var(--lp-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  sub: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 1 },
  lineaImp: { fontSize: 13, color: 'var(--lp-text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  row: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 132px', gap: 10, alignItems: 'center', padding: '7px 0' },
  campo: { fontSize: 13.5, fontWeight: 600, color: 'var(--lp-text-primary)' },
  priceWrap: { position: 'relative' },
  price: { width: '100%', height: 44, padding: '0 10px 0 20px', borderRadius: 10, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 14.5, textAlign: 'right', color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box' },
  pesos: { position: 'absolute', left: 9, top: 13, fontSize: 12.5, color: 'var(--lp-text-tertiary)', pointerEvents: 'none' },
  sep: { borderTop: '1px solid var(--lp-border-subtle)', marginTop: 6, paddingTop: 4 },
  totStrong: { display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--lp-border-subtle)' },
  chip: { height: 46, padding: '0 12px', borderRadius: 10, border: '1.5px solid var(--lp-border-subtle)', background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' },
  check: { display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, padding: '11px 12px', borderRadius: 12, background: 'var(--lp-bg-sunken)', cursor: 'pointer' },
};

export default function ImportesOCFields({ ctl, titulo = 'Importes de la factura · corrige si cambiaron' }) {
  const {
    oc, partidas, importeDe, producto, setProducto, puedeRepartir, totalKg,
    flete, setFlete, totalIva, setTotalIva, recostear, setRecostear,
    totalProducto, subtotal, preciosCambiados, yaRecibida,
  } = ctl;

  return (
    <>
      <label style={S.lbl}>{titulo}</label>
      <div style={S.box} data-id="compras.pago.importes">
        {partidas.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)' }}>Esta OC no tiene partidas capturadas.</div>
        )}
        {/* Partidas: referencia de cómo quedó repartido el total (no se editan). */}
        {partidas.map((p, i) => (
          <div key={p.mp + i} style={S.linea}>
            <div style={{ minWidth: 0 }}>
              <div style={S.mp} title={p.mp}>{p.mp}</div>
              <div style={S.sub}>{p.kg.toLocaleString('es-MX')} kg{p.recibido ? ' recibidos' : ''}</div>
            </div>
            <div style={S.lineaImp} data-id="compras.pago.importe-partida">{money(importeDe(i))}</div>
          </div>
        ))}

        <div style={S.sep} />

        {/* Producto: el total de la mercancía. Es lo que se mueve cuando cambia
            el dólar — se reparte solo entre las partidas de arriba. */}
        <div style={S.row}>
          <div style={{ minWidth: 0 }}>
            <div style={S.campo}>Producto</div>
            <div style={S.sub}>
              {partidas.length} {partidas.length === 1 ? 'partida' : 'partidas'}
              {totalKg > 0 ? ' · ' + totalKg.toLocaleString('es-MX') + ' kg' : ''}
            </div>
          </div>
          <div style={S.priceWrap}>
            <input
              data-id="compras.pago.producto"
              style={{ ...S.price, opacity: puedeRepartir ? 1 : 0.5 }}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={producto}
              onChange={(e) => setProducto(e.target.value)}
              placeholder="0.00"
              disabled={!puedeRepartir}
              title={puedeRepartir ? 'Total de la mercancía según la factura' : 'Sin kg en las partidas no hay cómo repartir el total'}
              aria-label="Total de producto en pesos"
            />
            <span style={S.pesos}>$</span>
          </div>
        </div>

        <div style={S.row}>
          <div style={{ minWidth: 0 }}>
            <div style={S.campo}>Flete</div>
            <div style={S.sub}>
              {Number(oc.fleteAutoMxn) > 0 ? 'Auto: ' + money(oc.fleteAutoMxn) : 'Costo del envío'}
            </div>
          </div>
          <div style={S.priceWrap}>
            <input
              data-id="compras.pago.flete"
              style={S.price}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={flete}
              onChange={(e) => setFlete(e.target.value)}
              placeholder="0.00"
              aria-label="Flete en pesos"
            />
            <span style={S.pesos}>$</span>
          </div>
        </div>

        <div style={S.totStrong}><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {Math.abs(totalProducto - (Number(producto) || 0)) >= 0.01 && (
          <div style={S.hint}>Producto repartido: {money(totalProducto)}</div>
        )}
      </div>

      <label style={S.lbl}>Total facturado c/IVA · opcional</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          data-id="compras.pago.total-factura"
          style={{ ...S.input, flex: 1 }}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={totalIva}
          onChange={(e) => setTotalIva(e.target.value)}
          placeholder={money(subtotal * 1.16).replace('$', '')}
        />
        <button
          style={S.chip}
          onClick={() => setTotalIva(String(Math.round(subtotal * 1.16 * 100) / 100))}
          title="Llenar con el subtotal + 16% de IVA"
        >+ IVA 16%</button>
      </div>
      <div style={S.hint}>Es el monto que se muestra en la card y el que empata el CFDI en SAT (±2%).</div>

      {preciosCambiados.length > 0 && yaRecibida && (
        <label style={S.check} data-id="compras.pago.recostear">
          <input
            type="checkbox"
            checked={recostear}
            onChange={(e) => setRecostear(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--lp-brand-600)', flex: '0 0 auto' }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--lp-text-secondary)', lineHeight: 1.45 }}>
            <b style={{ color: 'var(--lp-text-primary)' }}>Actualizar el costo/kg del sistema</b> con estos importes
            (promedio ponderado — mueve fórmulas, márgenes y valuación).
            <span style={{ display: 'block', marginTop: 3, color: 'var(--lp-text-tertiary)' }}>
              {preciosCambiados.map(c => `${c.mp} $${c.antes || 0}→$${Math.round(c.ahora * 100) / 100}/kg`).join(' · ')}
            </span>
          </span>
        </label>
      )}
      {preciosCambiados.length > 0 && !yaRecibida && (
        <div style={S.hint}>La MP aún no entra al inventario: el costo/kg del sistema se fijará al recibirla.</div>
      )}
    </>
  );
}
