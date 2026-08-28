/* MezclarAmericanoModal — fusionar orígenes en un color nuevo (28-ago-2026,
   pedido dueño: "hay totes que se fusionan físicamente para crear un color
   nuevo… usamos el blanco y un beige para crear el blanco off white").

   Ingredientes: colores del stock americano (tote elegido o granel) y, en
   Terán, pintura de FÁBRICA del pool (inv.pt[X].teran, mostrado en litros).
   El resultado nace como tote(s) del color destino —existente o NUEVO— con UN
   lote de mezcla: el manual manda (una fecha lleva secuencia), sin manual sale
   folio del sistema. El backend guarda la COMPOSICIÓN en cada tambo; por eso
   el resultado NO hereda el lote del fabricante — ya no es su pintura.

   Permisos backend: admin + almacen. POST /api/stk-americano/mezclar. */
import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useVaciadores from '../../hooks/useVaciadores';
import humanizeError from '../../utils/humanizeError';

const CUB_L = 19;           /* litros por cubeta — espejo del backend */
const LITROS_TAMBO = 1000;  /* el resultado se parte en tambos de hasta 1000 L */

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,12,8,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: 'calc(100vh - 32px)', maxBlockSize: 'calc(var(--pp-vvh, 100dvh) - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.35)' },
  header: { background: 'var(--lp-brand-700)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: 700, margin: 0 },
  closeBtn: { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer' },
  body: { padding: '18px 20px', overflowY: 'auto', flex: 1 },
  footer: { padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--lp-bg-sunken)' },
  label: { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)', marginBottom: 6, marginTop: 14 },
  select: { width: '100%', padding: '9px 10px', fontSize: 13, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
  input: { width: '100%', padding: '9px 10px', fontSize: 13, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', boxSizing: 'border-box', outline: 'none' },
  ing: { border: '1px solid var(--lp-border-subtle)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, background: 'var(--lp-bg-sunken)' },
  ingHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  ingTitle: { fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)' },
  quitar: { border: 'none', background: 'transparent', color: 'var(--lp-danger-700, #991B1B)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '2px 6px' },
  seg: { display: 'flex', gap: 4, background: 'var(--lp-bg-raised)', borderRadius: 999, padding: 3, border: '1px solid var(--lp-border-subtle)' },
  segBtn: (on, disabled) => ({ flex: 1, padding: '6px 10px', minHeight: 32, borderRadius: 999, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 12, fontWeight: on ? 700 : 500, background: on ? 'var(--lp-brand-600)' : 'transparent', color: on ? '#fff' : 'var(--lp-text-secondary)', opacity: disabled ? 0.5 : 1 }),
  fila: { display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8, marginTop: 8 },
  agregarBtn: { width: '100%', padding: '9px 0', borderRadius: 8, border: '1.5px dashed var(--lp-border-subtle)', background: 'transparent', color: 'var(--lp-text-secondary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  resumen: (bad) => ({ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: bad ? 'var(--lp-danger-50, #FEE2E2)' : 'color-mix(in srgb, var(--lp-info-600) 10%, transparent)', border: '1px solid ' + (bad ? 'color-mix(in srgb, var(--lp-danger-600) 40%, transparent)' : 'color-mix(in srgb, var(--lp-info-600) 28%, transparent)'), fontSize: 13, color: bad ? 'var(--lp-danger-700, #991B1B)' : 'var(--lp-text-secondary)', lineHeight: 1.6 }),
  hint: { fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 6, lineHeight: 1.5 },
  alertErr: { background: 'var(--lp-danger-50, #FEE2E2)', color: 'var(--lp-danger-700, #991B1B)', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginTop: 12 },
  btn: (primary, disabled) => ({ padding: '10px 18px', fontSize: 13, fontWeight: 700, border: primary ? 'none' : '1.5px solid var(--lp-border-subtle)', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.55 : 1, background: primary ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)', color: primary ? '#fff' : 'var(--lp-text-secondary)' }),
  nuevoBadge: { display: 'inline-block', marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--lp-brand-600) 14%, transparent)', color: 'var(--lp-brand-700)' },
};

const nf = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 });
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();
const GRANEL = '__granel__';

const filaVacia = () => ({ fuente: 'americano', key: '', codigoLote: GRANEL, producto: '', litros: '' });

export default function MezclarAmericanoModal({ colores = [], almacen = '1', onClose, onSaved }) {
  useBodyScrollLock(true);
  const [ings, setIngs] = useState([filaVacia(), filaVacia()]);
  const [destino, setDestino] = useState('');
  const [loteManual, setLoteManual] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const { vaciadores, envasadorId, elegir: elegirVaciador, elegido: vaciadorElegido } = useVaciadores();

  /* Pintura de FÁBRICA disponible: el pool de Terán (inv.pt[X].teran, en
     cub-equiv) mostrado en litros. Sólo existe en el almacén 1. */
  const [ptPool, setPtPool] = useState([]);
  useEffect(() => {
    if (almacen !== '1') return;
    let alive = true;
    api.getInventario().then(r => {
      if (!alive) return;
      const pt = (r && (r.data || r) && ((r.data || r).pt)) || {};
      const lista = Object.entries(pt)
        .filter(([, v]) => v && Number(v.teran) > 0)
        .map(([nombre, v]) => ({ nombre, litros: +(Number(v.teran) * CUB_L).toFixed(1) }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      setPtPool(lista);
    }).catch(() => {});
    return () => { alive = false; };
  }, [almacen]);

  const conLitros = useMemo(() => colores.filter(c => Number(c.totesLitros) > 0), [colores]);
  const colorDe = (key) => conLitros.find(c => c.key === key);
  const dispDe = (f) => {
    if (f.fuente === 'pt') { const p = ptPool.find(x => x.nombre === f.producto); return p ? p.litros : 0; }
    const c = colorDe(f.key);
    if (!c) return 0;
    if (f.codigoLote && f.codigoLote !== GRANEL) { const t = (c.totes || []).find(x => x.codigoLote === f.codigoLote); return t ? t.litros : 0; }
    return Number(c.totesLitros) || 0;
  };

  const setIng = (i, cambio) => setIngs(prev => prev.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  const quitarIng = (i) => setIngs(prev => prev.filter((_, j) => j !== i));

  const totalL = ings.reduce((a, f) => a + (Number(f.litros) > 0 ? Number(f.litros) : 0), 0);
  const nTambos = totalL > 0 ? Math.ceil((totalL - 0.001) / LITROS_TAMBO) : 0;
  const excedidos = ings.filter(f => Number(f.litros) > 0 && Number(f.litros) > dispDe(f) + 0.05);
  const completos = ings.filter(f => Number(f.litros) > 0 && (f.fuente === 'pt' ? f.producto : f.key));
  const destinoExiste = useMemo(() => colores.some(c => norm(c.nombre) === norm(destino)), [colores, destino]);
  const listo = completos.length >= 2 && completos.length === ings.length && !excedidos.length && norm(destino) && !saving;

  const mezclar = async () => {
    if (!listo) return;
    setSaving(true); setErr('');
    try {
      const payload = {
        almacen,
        ingredientes: ings.map(f => (f.fuente === 'pt'
          ? { fuente: 'pt', producto: f.producto, litros: Number(f.litros) }
          : { fuente: 'americano', key: f.key, nombre: (colorDe(f.key) || {}).nombre, litros: Number(f.litros), ...(f.codigoLote && f.codigoLote !== GRANEL ? { codigoLote: f.codigoLote } : {}) })),
        destino: { nombre: destino.trim() },
        ...(loteManual.trim() ? { loteManual: loteManual.trim() } : {}),
        ...(nota.trim() ? { nota: nota.trim() } : {}),
        ...(vaciadorElegido?.nombre ? { mezcladoPor: vaciadorElegido.nombre } : {}),
      };
      const r = await api.mezclarStkAmericano(payload);
      onSaved && onSaved(r);
      onClose && onClose();
    } catch (e) { setErr(humanizeError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget && !saving) onClose && onClose(); }}>
      <div style={S.modal} role="dialog" aria-modal="true" aria-label="Mezclar colores">
        <div style={S.header}>
          <h3 style={S.title}>Mezclar colores {almacen === '2' ? '· Almacén 2' : '· Terán'}</h3>
          <button style={S.closeBtn} onClick={onClose} aria-label="Cerrar" disabled={saving}>×</button>
        </div>
        <div style={S.body}>
          {ings.map((f, i) => (
            <div key={i} style={S.ing} data-id={`stkAmericano.mezclar.ing${i}`}>
              <div style={S.ingHead}>
                <span style={S.ingTitle}>Ingrediente {i + 1}</span>
                {ings.length > 2 && <button style={S.quitar} onClick={() => quitarIng(i)} data-id={`stkAmericano.mezclar.quitar${i}`}>Quitar</button>}
              </div>
              <div style={S.seg}>
                <button style={S.segBtn(f.fuente === 'americano')} onClick={() => setIng(i, { fuente: 'americano', producto: '' })} data-id={`stkAmericano.mezclar.fuenteAm${i}`}>Color americano</button>
                <button
                  style={S.segBtn(f.fuente === 'pt', almacen !== '1')}
                  disabled={almacen !== '1'}
                  title={almacen !== '1' ? 'La pintura de fábrica vive en el pool de Terán' : undefined}
                  onClick={() => almacen === '1' && setIng(i, { fuente: 'pt', key: '', codigoLote: GRANEL })}
                  data-id={`stkAmericano.mezclar.fuentePt${i}`}
                >Pintura de fábrica</button>
              </div>
              {f.fuente === 'americano' ? (
                <>
                  <div style={S.fila}>
                    <select style={S.select} value={f.key} onChange={e => setIng(i, { key: e.target.value, codigoLote: GRANEL })} data-id={`stkAmericano.mezclar.color${i}`}>
                      <option value="">— color —</option>
                      {conLitros.map(c => <option key={c.key} value={c.key}>{c.nombre} · {nf(c.totesLitros)} L</option>)}
                    </select>
                    <input style={S.input} type="number" min="1" inputMode="decimal" placeholder="Litros" value={f.litros}
                      onChange={e => setIng(i, { litros: e.target.value })} data-id={`stkAmericano.mezclar.litros${i}`} />
                  </div>
                  {!!(colorDe(f.key) && (colorDe(f.key).totes || []).length) && (
                    <select style={{ ...S.select, marginTop: 8 }} value={f.codigoLote} onChange={e => setIng(i, { codigoLote: e.target.value })} data-id={`stkAmericano.mezclar.tote${i}`}>
                      <option value={GRANEL}>Granel (juntar sobrantes)</option>
                      {(colorDe(f.key).totes || []).filter(t => t.litros > 0).map(t => (
                        <option key={t.codigoLote} value={t.codigoLote}>
                          Tambo {t.codigoLote} · {nf(t.litros)} L{t.loteProveedor ? ` · lote ${t.loteProveedor}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              ) : (
                <div style={S.fila}>
                  <select style={S.select} value={f.producto} onChange={e => setIng(i, { producto: e.target.value })} data-id={`stkAmericano.mezclar.pt${i}`}>
                    <option value="">— producto de fábrica (pool Terán) —</option>
                    {ptPool.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre} · {nf(p.litros)} L</option>)}
                  </select>
                  <input style={S.input} type="number" min="1" inputMode="decimal" placeholder="Litros" value={f.litros}
                    onChange={e => setIng(i, { litros: e.target.value })} data-id={`stkAmericano.mezclar.litros${i}`} />
                </div>
              )}
              {Number(f.litros) > 0 && Number(f.litros) > dispDe(f) + 0.05 && (
                <div style={{ ...S.hint, color: 'var(--lp-danger-700, #991B1B)' }}>Sólo hay {nf(dispDe(f))} L disponibles.</div>
              )}
            </div>
          ))}
          {ings.length < 6 && (
            <button style={S.agregarBtn} onClick={() => setIngs(prev => [...prev, filaVacia()])} data-id="stkAmericano.mezclar.agregar">+ Otro ingrediente</button>
          )}

          <label style={S.label}>Color resultado</label>
          <input style={S.input} list="mezcla-colores" placeholder="Ej: BLANCO OFF WHITE" value={destino}
            onChange={e => setDestino(e.target.value)} data-id="stkAmericano.mezclar.destino" />
          <datalist id="mezcla-colores">{colores.map(c => <option key={c.key} value={c.nombre} />)}</datalist>
          {norm(destino) && !destinoExiste && <span style={S.nuevoBadge} data-id="stkAmericano.mezclar.badgeNuevo">color NUEVO — se crea en automático</span>}

          <label style={S.label}>Lote de la mezcla (opcional)</label>
          <input style={S.input} placeholder="Vacío = folio del sistema" value={loteManual}
            onChange={e => setLoteManual(e.target.value)} data-id="stkAmericano.mezclar.lote" />
          <div style={S.hint}>El lote escrito manda. Si es sólo una fecha, el sistema le pone su secuencia (-001, -002…). La mezcla no hereda el lote del fabricante: guarda su composición para el rastreo.</div>

          {!!vaciadores.length && (
            <>
              <label style={S.label}>¿Quién mezcló?</label>
              <select style={S.select} value={envasadorId} onChange={e => elegirVaciador(e.target.value)} data-id="stkAmericano.mezclar.quien">
                <option value="">— sin registrar —</option>
                {vaciadores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </>
          )}

          <label style={S.label}>Nota (opcional)</label>
          <input style={S.input} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: ajuste de tono para pedido X" data-id="stkAmericano.mezclar.nota" />

          {totalL > 0 && (
            <div style={S.resumen(!!excedidos.length)} data-id="stkAmericano.mezclar.resumen">
              <strong>{nf(totalL)} L</strong> en {nTambos} tambo{nTambos === 1 ? '' : 's'}
              {norm(destino) ? <> → <strong>{destino.trim().toUpperCase()}</strong>{!destinoExiste && ' (nuevo)'}</> : null}
              {excedidos.length ? <><br />Hay ingredientes con más litros de los disponibles.</> : null}
            </div>
          )}
          {err && <div style={S.alertErr}>{err}</div>}
        </div>
        <div style={S.footer}>
          <button style={S.btn(false, saving)} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btn(true, !listo)} onClick={mezclar} disabled={!listo} data-id="stkAmericano.mezclar.confirmar">
            {saving ? 'Mezclando…' : 'Mezclar'}
          </button>
        </div>
      </div>
    </div>
  );
}
