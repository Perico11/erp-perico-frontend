import { money } from './importesOC';

/* ImportesOCFields — los campos de importes reales de una OC. El estado vive en
   useImportesOC (importesOC.js); aquí solo el render, compartido por
   RegistrarPagoModal (crédito, al pagar) y CorregirImportesModal (contado o ya
   pagada). Solo dinero: precio/kg, flete y total facturado — los kg no. */

const S = {
  lbl: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', margin: '16px 2px 6px' },
  hint: { fontSize: 11, color: 'var(--lp-text-tertiary)', margin: '4px 2px 0' },
  input: { width: '100%', height: 46, padding: '0 14px', borderRadius: 12, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 15, color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box' },
  box: { background: 'var(--lp-bg-sunken)', borderRadius: 14, padding: '12px 12px 14px', marginTop: 6 },
  row: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 118px', gap: 10, alignItems: 'center', padding: '7px 0' },
  mp: { fontSize: 13.5, fontWeight: 600, color: 'var(--lp-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sub: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', marginTop: 1 },
  /* Partida en bloque (nombre arriba, dos campos abajo): con dos inputs en la
     misma fila que el nombre, en móvil el nombre de la MP quedaba en 70 px. */
  partida: { padding: '9px 0', borderBottom: '1px solid var(--lp-border-subtle)' },
  dosCampos: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 7 },
  mini: { fontSize: 10.5, fontWeight: 600, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 3 },
  pesos: { position: 'absolute', left: 9, top: 14, fontSize: 12, color: 'var(--lp-text-tertiary)', pointerEvents: 'none' },
  priceWrap: { position: 'relative' },
  price: { width: '100%', height: 44, padding: '0 34px 0 10px', borderRadius: 10, background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)', fontFamily: 'inherit', fontSize: 14, textAlign: 'right', color: 'var(--lp-text-primary)', outline: 'none', boxSizing: 'border-box' },
  unit: { position: 'absolute', right: 9, top: 14, fontSize: 11, color: 'var(--lp-text-tertiary)', pointerEvents: 'none' },
  tot: { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--lp-text-secondary)', marginTop: 6 },
  totStrong: { display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--lp-border-subtle)' },
  chip: { height: 46, padding: '0 12px', borderRadius: 10, border: '1.5px solid var(--lp-border-subtle)', background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' },
  check: { display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, padding: '11px 12px', borderRadius: 12, background: 'var(--lp-bg-sunken)', cursor: 'pointer' },
};

export default function ImportesOCFields({ ctl, titulo = 'Importes de la factura · corrige si cambiaron' }) {
  const {
    oc, partidas, precios, setPrecio, importes, setImporte, flete, setFlete,
    totalIva, setTotalIva, recostear, setRecostear, totalProducto, fleteNum, subtotal,
    preciosCambiados, yaRecibida,
  } = ctl;

  return (
    <>
      <label style={S.lbl}>{titulo}</label>
      <div style={S.box} data-id="compras.pago.importes">
        {partidas.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary)' }}>Esta OC no tiene partidas capturadas.</div>
        )}
        {/* Partida: la factura a veces trae el $/kg y a veces solo el total del
            renglón. Los dos campos se editan y se derivan entre sí, así Arely
            teclea lo que tenga enfrente sin sacar la calculadora. */}
        {partidas.map((p, i) => (
          <div key={p.mp + i} style={S.partida}>
            <div style={S.mp} title={p.mp}>{p.mp}</div>
            <div style={S.sub}>{p.kg.toLocaleString('es-MX')} kg{p.recibido ? ' recibidos' : ''}</div>
            <div style={S.dosCampos}>
              <div>
                <div style={S.mini}>Precio</div>
                <div style={S.priceWrap}>
                  <input
                    data-id="compras.pago.precio-mp"
                    style={S.price}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={precios[i]}
                    onChange={(e) => setPrecio(i, e.target.value)}
                    placeholder="0.00"
                    aria-label={'Precio por kg de ' + p.mp}
                  />
                  <span style={S.unit}>/kg</span>
                </div>
              </div>
              <div>
                <div style={S.mini}>Importe del renglón</div>
                <div style={S.priceWrap}>
                  <input
                    data-id="compras.pago.importe-mp"
                    style={{ ...S.price, padding: '0 10px 0 18px', opacity: p.kg > 0 ? 1 : 0.5 }}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={importes[i]}
                    onChange={(e) => setImporte(i, e.target.value)}
                    placeholder="0.00"
                    disabled={!(p.kg > 0)}
                    title={p.kg > 0 ? '' : 'Sin kg no se puede derivar el precio'}
                    aria-label={'Importe total de ' + p.mp}
                  />
                  <span style={S.pesos}>$</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Sin borderTop: cada partida ya cierra con su propia línea. */}
        <div style={{ ...S.row, paddingTop: 11 }}>
          <div style={{ minWidth: 0 }}>
            <div style={S.mp}>Flete</div>
            <div style={S.sub}>
              {Number(oc.fleteAutoMxn) > 0 ? 'Auto: ' + money(oc.fleteAutoMxn) : 'Costo del envío'}
            </div>
          </div>
          <div style={S.priceWrap}>
            <input
              data-id="compras.pago.flete"
              style={{ ...S.price, padding: '0 10px' }}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={flete}
              onChange={(e) => setFlete(e.target.value)}
              placeholder="0.00"
              aria-label="Flete en pesos"
            />
          </div>
        </div>

        <div style={S.tot}><span>Producto</span><span>{money(totalProducto)}</span></div>
        <div style={S.tot}><span>Flete</span><span>{money(fleteNum)}</span></div>
        <div style={S.totStrong}><span>Subtotal</span><span>{money(subtotal)}</span></div>
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
            <b style={{ color: 'var(--lp-text-primary)' }}>Actualizar el costo/kg del sistema</b> con estos precios
            (promedio ponderado — mueve fórmulas, márgenes y valuación).
            <span style={{ display: 'block', marginTop: 3, color: 'var(--lp-text-tertiary)' }}>
              {preciosCambiados.map(c => `${c.mp} $${c.antes || 0}→$${c.ahora}`).join(' · ')}
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
