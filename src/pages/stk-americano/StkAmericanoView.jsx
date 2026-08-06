/* StkAmericanoView — vista compartida de STOCK AMERICANO (PT importado de EE.UU.).
   MODELO v2 (jul 2026): inventario POR COLOR con 3 presentaciones:
     · cubetas (nº) · galones (nº) · totes (litros a granel; 1000 L = 1 tote lleno).
   Presentacional: recibe data + reload + permisos por props (el contenedor hace
   fetch + realtime). Escritorio = tabla estilo PT; móvil = tarjetas.

   Props: data { colores:[], catalogo:[], resumen:{}, litrosTote } · loading · reload
          · canEdit (admin/almacén) · canDelete (admin) · embedded */
import { useState, useMemo } from 'react';
import { useSearch } from '../../hooks/useApi';
import useIsDesktop from '../../hooks/useIsDesktop';
import useConfirm from '../../hooks/useConfirm';
import humanizeError from '../../utils/humanizeError'; /* AUDIT UX 16-jul (U4) */
import api from '../../services/api';
import QRModal from '../../components/QRModal';
import ImportExportPrint from '../../components/ui/ImportExportPrint';
import { MPActionsMenu } from '../inventario/MPActions';
import AmericanoBadge from './AmericanoBadge';
import AltaAmericanoModal from './AltaAmericanoModal';
import imprimirEtiquetasTotes from './imprimirEtiquetasTotes';
import SalidaAmericanoModal from './SalidaAmericanoModal';
import EnvasarAmericanoModal from './EnvasarAmericanoModal';
import TransferirAmericanoModal from './TransferirAmericanoModal';
import CensoTotesModal from './CensoTotesModal';

const S = {
  wrap: { fontFamily: 'var(--lp-font-sans)' },
  kpis: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 },
  kpi: { flex: '1 1 130px', minWidth: 120, background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 12, padding: '12px 14px', borderTop: '3px solid var(--lp-info-600)' },
  kpiLbl: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)' },
  kpiVal: { fontSize: 22, fontWeight: 700, color: 'var(--lp-text-primary)', fontFamily: 'var(--lp-font-mono)', marginTop: 2 },
  kpiSub: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1.5px solid var(--lp-border-subtle)', borderRadius: 10, background: 'var(--lp-bg-raised)', flex: '1 1 240px', maxWidth: 420, color: 'var(--lp-text-tertiary)' },
  searchInput: { border: 'none', outline: 'none', background: 'transparent', fontSize: 14, flex: 1, color: 'var(--lp-text-primary)', fontFamily: 'inherit' },
  btnAdd: { height: 40, padding: '0 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: 'var(--lp-brand-600)', color: '#fff', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
  hint: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', margin: '2px 0 12px', lineHeight: 1.5 },
  tablewrap: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderRadius: 14, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-tertiary)', padding: '11px 14px', borderBottom: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-sunken)', whiteSpace: 'nowrap' },
  td: { padding: '11px 14px', borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 13.5, color: 'var(--lp-text-primary)', verticalAlign: 'middle' },
  tdNum: { fontFamily: 'var(--lp-font-mono)', fontWeight: 600, textAlign: 'right' },
  cero: { color: 'var(--lp-text-tertiary)', fontWeight: 400 },
  btnGhostTable: { height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)', fontFamily: 'var(--lp-font-sans)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnEnvasarTable: { height: 32, padding: '0 12px', borderRadius: 8, border: 'none', background: 'var(--lp-brand-600)', color: '#fff', fontFamily: 'var(--lp-font-sans)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  totesCell: { display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' },
  totesEquiv: { fontSize: 10.5, color: 'var(--lp-text-tertiary)' },
  empty: { textAlign: 'center', padding: '40px 20px', color: 'var(--lp-text-tertiary)', fontSize: 14, border: '1.5px dashed var(--lp-border-subtle)', borderRadius: 12 },
  /* Cards móvil */
  card: { background: 'var(--lp-bg-raised)', border: '1px solid var(--lp-border-subtle)', borderLeft: '4px solid var(--lp-info-600)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  cardName: { fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  chip: { fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'var(--lp-bg-sunken)', color: 'var(--lp-text-primary)' },
  chipMono: { fontFamily: 'var(--lp-font-mono)' },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  actBtn: { height: 34, padding: '0 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lp-border-subtle)', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', fontFamily: 'inherit' },
  actBtnPrimary: { background: 'var(--lp-brand-600)', color: '#fff', border: 'none', fontWeight: 700 },
  toast: { position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 1200, background: 'var(--lp-text-primary)', color: 'var(--lp-bg-raised)', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.2)' },
};

const nf = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 });

export default function StkAmericanoView({ data, loading, reload, canEdit = false, canDelete = false, embedded = false, almacen = '1' }) {
  const isDesktop = useIsDesktop();
  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [editColor, setEditColor] = useState(undefined); /* undefined=cerrado, null=nuevo, obj=editar */
  const [salidaColor, setSalidaColor] = useState(null);
  const [envasarColor, setEnvasarColor] = useState(null);
  const [transferirColor, setTransferirColor] = useState(null);
  const [censoColor, setCensoColor] = useState(null);
  const [printLote, setPrintLote] = useState(null);
  const [toast, setToast] = useState('');
  const [confirm, ConfirmEl] = useConfirm();

  const store = data || {};
  const colores = store.colores || [];
  const catalogo = store.catalogo || [];
  const resumen = store.resumen || { cubetas: 0, galones: 0, totesLitros: 0, totesEquiv: 0, colores: 0 };

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const q = (debouncedQuery || '').trim().toLowerCase();
  const filtrados = useMemo(
    () => colores.filter(c => !q || String(c.nombre).toLowerCase().includes(q)),
    [colores, q]
  );

  const handleEliminar = async (c) => {
    const motivo = await confirm(
      `¿Eliminar "${c.nombre}" del stock americano? (${c.cubetas} cub · ${c.galones} gal · ${nf(c.totesLitros)} L)`,
      { title: 'Eliminar color', confirmText: 'Eliminar', danger: true, prompt: { label: 'Motivo', placeholder: 'Ej: error de captura', required: true, rows: 2 } }
    );
    if (!motivo) return;
    try {
      await api.eliminarStkAmericano({ almacen, key: c.key, nombre: c.nombre, motivo: String(motivo) });
      showToast('Color eliminado'); reload && reload();
    } catch (e) { showToast(humanizeError(e)); } /* AUDIT UX 16-jul (U4) */
  };

  const menuItems = (c) => {
    const items = [];
    if (canEdit) {
      /* Transferencia simple entre almacenes (Alm 2 = extensión del 1, 18-jul). */
      if (c.cubetas > 0 || c.galones > 0 || c.totesLitros > 0) {
        items.push({ label: `Transferir al ${almacen === '2' ? 'Americano Terán (Alm. 1)' : 'Almacén 2'}`, color: 'var(--lp-brand-700)', onClick: () => setTransferirColor(c) });
      }
      /* Censo (5-ago): mientras queden litros sin tote, el envasado no puede
         amarrarse a un folio. Se ofrece justo donde duele. */
      if ((c.granelSinLote || 0) > 0.01) {
        items.push({ label: `Registrar totes abiertos (${nf(c.granelSinLote)} L sin folio)`, color: 'var(--lp-warn-700, #B45309)', onClick: () => setCensoColor(c) });
      }
      if (c.cubetas > 0) items.push({ label: 'Salida de cubetas', onClick: () => setSalidaColor({ ...c, _pres: 'cubetas' }) });
      if (c.galones > 0) items.push({ label: 'Salida de galones', onClick: () => setSalidaColor({ ...c, _pres: 'galones' }) });
      if (c.totesLitros > 0) items.push({ label: 'Salida de litros (totes)', onClick: () => setSalidaColor({ ...c, _pres: 'litros' }) });
    }
    /* Una entrada POR PRESENTACIÓN (5-ago): la etiqueta ya imprime CBT/GLN en la
       banda, así que un lote con cubetas Y galones no puede salir en un solo
       trabajo — serían etiquetas mintiendo sobre la mitad del lote. */
    (c.lotes || []).slice(-6).reverse().forEach(l => {
      [['cubeta', 'CBT', Number(l.cubetas) || 0], ['galon', 'GLN', Number(l.galones) || 0]]
        .filter(([, , qty]) => qty > 0)
        .forEach(([medida, ab, qty]) => {
          items.push({
            label: `Etiquetas ${l.codigoLote} · ${ab} (${qty})`,
            color: 'var(--lp-info-700, var(--lp-info-600))',
            onClick: () => setPrintLote({ codigoLote: l.codigoLote, producto: c.nombre, unidades: qty, medida, envasadoPor: l.envasadoPor, fecha: l.actualizado || l.fecha }),
          });
        });
    });
    if (canDelete) items.push({ label: 'Eliminar color', color: 'var(--lp-danger-600)', onClick: () => handleEliminar(c) });
    return items;
  };

  return (
    <div style={S.wrap}>
      {ConfirmEl}

      {/* KPIs */}
      <div style={S.kpis}>
        <div style={S.kpi}><div style={S.kpiLbl}>Cubetas</div><div style={S.kpiVal}>{nf(resumen.cubetas)}</div><div style={S.kpiSub}>total en patio</div></div>
        <div style={S.kpi}><div style={S.kpiLbl}>Galones</div><div style={S.kpiVal}>{nf(resumen.galones)}</div><div style={S.kpiSub}>total en patio</div></div>
        <div style={S.kpi}><div style={S.kpiLbl}>Litros en totes</div><div style={S.kpiVal}>{nf(resumen.totesLitros)}</div><div style={S.kpiSub}>≈ {nf(resumen.totesEquiv)} totes (1000 L c/u)</div></div>
        <div style={S.kpi}><div style={S.kpiLbl}>Colores</div><div style={S.kpiVal}>{resumen.colores}</div><div style={S.kpiSub}>con existencia</div></div>
      </div>

      {/* Toolbar */}
      <div style={S.topRow}>
        <div style={S.searchBox}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input style={S.searchInput} type="text" placeholder="Buscar color…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={S.btnAdd} onClick={() => setEditColor(null)} data-id="stkAmericano.btn.color" data-rol="admin,almacen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Agregar color
            </button>
            {/* Etiquetas de TODOS los totes con lote asignado (18-jul): un solo
                trabajo de impresión, una etiqueta por tote, formato+rotación
                memorizados de la impresora. */}
            {(() => {
              const items = colores.flatMap(c => (c.totes || []).map(t => ({ cod: t.codigoLote, producto: c.nombre, litros: t.litros })));
              if (!items.length) return null;
              return (
                <button
                  style={{ ...S.btnAdd, background: 'var(--lp-bg-raised)', color: 'var(--lp-brand-700)', border: '1.5px solid var(--lp-brand-600)' }}
                  data-id="stkAmericano.btn.etiquetas-totes" data-rol="admin,almacen"
                  onClick={async () => {
                    const ok = await confirm(`Se imprimirán ${items.length} etiquetas (una por tote, con su lote y QR). Usa el formato y rotación ya memorizados de la impresora.`, { title: 'Etiquetas de totes', confirmText: 'Imprimir' });
                    if (ok) imprimirEtiquetasTotes(items);
                  }}>
                  Etiquetas totes ({items.length})
                </button>
              );
            })()}
            <ImportExportPrint
              importEndpoint={api.urlImportStkAmericano(almacen)}
              importLabel="Importar Excel/CSV"
              permisos={{ import: true, export: false, print: false }}
              onImported={(d) => { const n = (d && d.resumen && d.resumen.colores) || 0; const e = (d && d.errores && d.errores.length) || 0; showToast(`${n} color(es) importado(s)${e ? ' · ' + e + ' con error' : ''}`); reload && reload(); }}
            />
          </div>
        )}
      </div>
      {canEdit && (
        <div style={S.hint}>
          <strong>Importar:</strong> Excel con 3 bloques — <strong>Cubetas</strong> (color + nº), <strong>Galones</strong> (color + nº), <strong>Totes</strong> (color + litros, ej. "650 LTS"). Se fusiona por color. Un tote lleno = 1000 L.
        </div>
      )}

      {/* Lista */}
      {loading && !colores.length ? (
        <div style={S.empty}>Cargando…</div>
      ) : filtrados.length === 0 ? (
        <div style={S.empty}>{q ? `Sin resultados para "${debouncedQuery}"` : 'Aún no hay stock americano. Importa tu Excel del patio o agrega un color.'}</div>
      ) : isDesktop ? (
        <div style={S.tablewrap}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Color</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Cubetas</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Galones</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Totes (litros)</th>
              {canEdit && <th style={{ ...S.th, textAlign: 'right' }}>Acción</th>}
            </tr></thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.key} data-id="stkAmericano.row.color">
                  <td style={S.td}>
                    <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                    {c.proveedor ? <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginLeft: 8 }}>· {c.proveedor}</span> : null}
                  </td>
                  <td style={{ ...S.td, ...S.tdNum, ...(c.cubetas ? {} : S.cero) }}>{c.cubetas ? nf(c.cubetas) : '—'}</td>
                  <td style={{ ...S.td, ...S.tdNum, ...(c.galones ? {} : S.cero) }}>{c.galones ? nf(c.galones) : '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    {c.totesLitros ? (
                      <span style={S.totesCell}>
                        <span style={{ fontFamily: 'var(--lp-font-mono)', fontWeight: 600 }}>{nf(c.totesLitros)} L</span>
                        <span style={S.totesEquiv}>≈ {nf(c.totesEquiv)} tote{c.totesEquiv === 1 ? '' : 's'}</span>
                      </span>
                    ) : <span style={S.cero}>—</span>}
                  </td>
                  {canEdit && (
                    <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {c.totesLitros > 0 && (
                        <button style={S.btnEnvasarTable} data-id="stkAmericano.btn.envasar" data-rol="admin,almacen" onClick={() => setEnvasarColor(c)}>Envasar</button>
                      )}
                      <button style={{ ...S.btnGhostTable, marginLeft: 8 }} data-id="stkAmericano.btn.editar" data-rol="admin,almacen" onClick={() => setEditColor(c)}>Editar</button>
                      <span style={{ marginLeft: 8, display: 'inline-flex', verticalAlign: 'middle' }}>
                        <MPActionsMenu mp={c.nombre} canEdit={true} extraItems={menuItems(c)} />
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* MÓVIL: tarjetas por color */
        filtrados.map(c => (
          <div key={c.key} style={S.card}>
            <div style={S.cardTop}>
              <span style={S.cardName}>{c.nombre}</span>
              <AmericanoBadge size="sm" />
            </div>
            <div style={S.chips}>
              <span style={S.chip}><strong style={S.chipMono}>{nf(c.cubetas)}</strong> cub</span>
              <span style={S.chip}><strong style={S.chipMono}>{nf(c.galones)}</strong> gal</span>
              <span style={S.chip}><strong style={S.chipMono}>{nf(c.totesLitros)}</strong> L · {nf(c.totesEquiv)} tote{c.totesEquiv === 1 ? '' : 's'}</span>
            </div>
            {canEdit && (
              <div style={S.actions}>
                {c.totesLitros > 0 && <button style={{ ...S.actBtn, ...S.actBtnPrimary }} onClick={() => setEnvasarColor(c)} data-id="stkAmericano.btn.envasar">Envasar</button>}
                <button style={S.actBtn} onClick={() => setEditColor(c)} data-id="stkAmericano.btn.editar">Editar</button>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <MPActionsMenu mp={c.nombre} canEdit={true} extraItems={menuItems(c)} />
                </span>
              </div>
            )}
          </div>
        ))
      )}

      {/* Modales */}
      {editColor !== undefined && (
        <AltaAmericanoModal
          catalogo={catalogo}
          color={editColor}
          almacen={almacen}
          onClose={() => setEditColor(undefined)}
          onSaved={() => { showToast(editColor ? 'Color actualizado' : 'Color agregado'); reload && reload(); }}
        />
      )}
      {salidaColor && (
        <SalidaAmericanoModal
          color={salidaColor}
          almacen={almacen}
          presInicial={salidaColor._pres || 'cubetas'}
          onClose={() => setSalidaColor(null)}
          onSaved={() => { showToast('Salida registrada'); reload && reload(); }}
        />
      )}
      {envasarColor && (
        <EnvasarAmericanoModal
          color={envasarColor}
          almacen={almacen}
          onClose={() => setEnvasarColor(null)}
          onSaved={(lote) => { showToast(lote ? `Envasado · lote ${lote.codigoLote}` : 'Envasado registrado'); reload && reload(); if (lote) setPrintLote(lote); }}
        />
      )}
      {transferirColor && (
        <TransferirAmericanoModal
          color={transferirColor}
          deAlmacen={almacen}
          onClose={() => setTransferirColor(null)}
          onSaved={(r) => { showToast(`${nf(r.cantidad)} ${r.presentacion === 'litros' ? 'L' : r.presentacion} → Almacén ${r.aAlmacen}`); reload && reload(); }}
        />
      )}
      {censoColor && (
        <CensoTotesModal
          color={censoColor}
          almacen={almacen}
          onClose={() => setCensoColor(null)}
          onSaved={(r) => { showToast(`${r.lotes.length} tote(s) registrados · ${r.lotes.join(', ')}`); reload && reload(); }}
        />
      )}
      {printLote && (
        <QRModal
          lote={{
            codigo: printLote.codigoLote, codigoLote: printLote.codigoLote,
            /* El producto va limpio: la presentación la pinta la banda de la
               etiqueta (diseño único 5-ago), ya no se concatena al nombre. */
            producto: printLote.producto,
            presentacion: printLote.medida,
            envasadoPor: printLote.envasadoPor,
            cantidad: printLote.unidades, fecha: printLote.fecha, litros: printLote.litros,
          }}
          onClose={() => setPrintLote(null)}
        />
      )}

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
