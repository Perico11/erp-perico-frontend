/* EnvasarAmericanoModal — envasa producto A GRANEL (litros en totes) de un COLOR
   en cubetas o galones. Descuenta litros del color + envases/tapas del pool TERÁN
   de envases.json (el americano se envasa en Terán) y suma las unidades al color.
   Modelo v2. Permisos backend: admin + almacen. */
import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useVaciadores from '../../hooks/useVaciadores';
/* DISEÑO ÚNICO de envasado (jul 2026): bloques compartidos por las 4 pantallas. */
import { Contador, TopeHint } from '../../components/envasado/EnvasarUI';
import humanizeError from '../../utils/humanizeError'; /* AUDIT UX 16-jul (U4) */

/* AUDIT UX 16-jul (U14): autoFocus solo con puntero fino (mouse/trackpad) — en
   móvil abre el teclado antes de pintar el sheet y tapa los botones (regla
   documentada en components/ui/Modal.jsx; mismo patrón que CycleCountPage). */
const FINE_POINTER = typeof window !== 'undefined' && window.matchMedia
  && window.matchMedia('(pointer: fine)').matches;

/* Presentaciones envasables → categoría de envases.json. Solo la cubeta usa tapa. */
const PRESENTACIONES = [
  { medida: 'cubeta', catKey: 'cubeta', ml: 19000, label: 'Cubeta', plural: 'cubetas', usaTapa: true },
  { medida: 'galon',  catKey: 'galon',  ml: 3785,  label: 'Galón',  plural: 'galones', usaTapa: false },
];

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,12,8,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: 'calc(100vh - 32px)', maxBlockSize: 'calc(var(--pp-vvh, 100dvh) - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.35)' },
  header: { background: 'var(--lp-brand-700)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: 700, margin: 0 },
  closeBtn: { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer' },
  body: { padding: '18px 20px', overflowY: 'auto', flex: 1 },
  footer: { padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--lp-bg-sunken)' },
  colorBox: { padding: '10px 14px', borderRadius: 8, background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)', marginBottom: 4 },
  colorName: { fontSize: 14, fontWeight: 700, color: 'var(--lp-text-primary)' },
  colorNums: { fontSize: 12, color: 'var(--lp-text-secondary)', marginTop: 4 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--lp-text-secondary)', marginBottom: 6, marginTop: 14 },
  seg: { display: 'flex', gap: 4, background: 'var(--lp-bg-sunken)', borderRadius: 999, padding: 3 },
  segBtn: (on) => ({ flex: 1, padding: '8px 10px', minHeight: 38, borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 13, fontWeight: on ? 700 : 500, background: on ? 'var(--lp-brand-600)' : 'transparent', color: on ? '#fff' : 'var(--lp-text-secondary)' }),
  select: { width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
  inputSm: { width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6, background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', boxSizing: 'border-box', outline: 'none' },
  tapaRow: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: (c) => ({ width: 14, height: 14, borderRadius: '50%', background: c || '#ccc', border: '1px solid rgba(0,0,0,.15)', flexShrink: 0 }),
  resumen: (bad) => ({ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: bad ? 'var(--lp-danger-50, #FEE2E2)' : 'color-mix(in srgb, var(--lp-info-600) 10%, transparent)', border: '1px solid ' + (bad ? 'color-mix(in srgb, var(--lp-danger-600) 40%, transparent)' : 'color-mix(in srgb, var(--lp-info-600) 28%, transparent)'), fontSize: 13, color: bad ? 'var(--lp-danger-700, #991B1B)' : 'var(--lp-text-secondary)' }),
  btn: (primary, disabled) => ({ padding: '10px 18px', fontSize: 13, fontWeight: 700, border: primary ? 'none' : '1.5px solid var(--lp-border-subtle)', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.55 : 1, background: primary ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)', color: primary ? '#fff' : 'var(--lp-text-secondary)' }),
  hint: { fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 6, lineHeight: 1.5 },
  alertErr: { background: 'var(--lp-danger-50, #FEE2E2)', color: 'var(--lp-danger-700, #991B1B)', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginTop: 12 },
};

const nf = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 1 });

export default function EnvasarAmericanoModal({ color, almacen = '1', onClose, onSaved }) {
  useBodyScrollLock(true);
  const [env, setEnv] = useState(null);
  const [medida, setMedida] = useState('cubeta');
  const [subKey, setSubKey] = useState('');
  const [tapaKey, setTapaKey] = useState('');
  const [unidades, setUnidades] = useState('');
  /* Lote del tote: PRE-SELECCIONA el tote registrado más viejo (FEFO) — desde el
     18-jul los totes entran con lote asignado y ya no se adivina. '' = nuevo. */
  const [loteSel, setLoteSel] = useState(() => (color && color.totes && color.totes[0] && color.totes[0].codigoLote) || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  /* Vaciador responsable (jul 2026) — mismo desplegable que los demás sheets. */
  const { vaciadores, envasadorId, elegir: elegirVaciador, elegido: vaciadorElegido } = useVaciadores();

  useEffect(() => {
    let alive = true;
    api.getEnvases().then(r => { if (alive) setEnv(r?.data || r || {}); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const pres = PRESENTACIONES.find(p => p.medida === medida);
  const categorias = env?.categorias || {};
  const tapas = env?.tapas || {};
  const tapaDefault = env?.tapa_default || {};

  /* El americano se envasa EN TERÁN → mostrar/validar el pool `teran`. */
  const envases = useMemo(() => {
    const cat = categorias[pres.catKey];
    if (!cat || !cat.subcategorias) return [];
    return Object.entries(cat.subcategorias).map(([k, s]) => ({ key: k, nombre: s.nombre || k, marca: s.marca || '', stock: Number(s.teran) || 0 }));
  }, [categorias, pres.catKey]);
  const tapasList = useMemo(() => Object.entries(tapas).map(([k, t]) => ({ key: k, nombre: t.nombre || k, color: t.color, stock: Number(t.teran) || 0 })), [tapas]);

  useEffect(() => {
    if (!envases.length) { setSubKey(''); return; }
    const conStock = envases.find(e => e.stock > 0) || envases[0];
    setSubKey(conStock.key);
  }, [medida, envases.length]); // eslint-disable-line

  useEffect(() => {
    if (!pres.usaTapa) { setTapaKey(''); return; }
    const sub = envases.find(e => e.key === subKey);
    const sugerida = sub && tapaDefault[sub.marca];
    if (sugerida && tapas[sugerida]) setTapaKey(sugerida);
    else { const conStock = tapasList.find(t => t.stock > 0) || tapasList[0]; if (conStock) setTapaKey(conStock.key); }
  }, [subKey, medida, env]); // eslint-disable-line

  const n = parseInt(unidades, 10) || 0;
  const litros = +(n * pres.ml / 1000).toFixed(2);
  const litrosDisp = Number(color?.totesLitros) || 0;
  const subSel = envases.find(e => e.key === subKey);
  const tapaSel = tapasList.find(t => t.key === tapaKey);
  /* Tote registrado seleccionado (18-jul): su disponible manda sobre el granel. */
  const totesReg = (color && color.totes) || [];
  const toteSel = totesReg.find(t => t.codigoLote === loteSel) || null;
  /* Tope + cuello de botella (diseño único jul 2026): el menor de pintura,
     envases y tapas — y se dice cuál es. */
  const limitesAm = [
    toteSel
      ? { n: Math.floor((Number(toteSel.litros) || 0) / (pres.ml / 1000)), motivo: 'la pintura del tote elegido' }
      : { n: Math.floor(litrosDisp / (pres.ml / 1000)), motivo: 'la pintura a granel' },
    ...(subSel ? [{ n: subSel.stock, motivo: 'los envases en Terán' }] : []),
    ...(pres.usaTapa && tapaSel ? [{ n: tapaSel.stock, motivo: 'las tapas en Terán' }] : []),
  ];
  const maxUnidAm = Math.max(0, Math.min(...limitesAm.map(l => l.n)));
  const excedeLitros = litros > litrosDisp + 0.001;
  const excedeTote = toteSel && litros > (Number(toteSel.litros) || 0) + 0.001;
  const excedeEnvase = subSel && n > subSel.stock;
  const excedeTapa = pres.usaTapa && tapaSel && n > tapaSel.stock;
  const puede = n > 0 && subKey && (!pres.usaTapa || tapaKey) && !excedeLitros && !excedeTote && !excedeEnvase && !excedeTapa;

  if (!color) return null;

  const handleEnvasar = async () => {
    if (!puede) return;
    setSaving(true); setErr('');
    try {
      const r = await api.envasarStkAmericano({ almacen, key: color.key, nombre: color.nombre, medida, unidades: n, subKey, tapaKey: pres.usaTapa ? tapaKey : undefined, loteExistente: loteSel || undefined, envasadoPor: vaciadorElegido?.nombre || undefined });
      onSaved && onSaved(r && r.lote); onClose();
    } catch (e) { setErr(humanizeError(e)); setSaving(false); } /* AUDIT UX 16-jul (U4) */
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h3 style={S.title}>Envasar — {color.nombre}</h3>
          <button style={S.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.body}>
          <div style={S.colorBox}>
            <div style={S.colorName}>{color.nombre}</div>
            <div style={S.colorNums}>A granel en totes: <strong>{nf(litrosDisp)} L</strong></div>
          </div>

          {!env ? <div style={S.hint}>Cargando envases…</div> : (
            <>
              <label style={S.label}>En qué se envasa</label>
              <div style={S.seg}>
                {PRESENTACIONES.map(p => (
                  <button key={p.medida} type="button" style={S.segBtn(medida === p.medida)} onClick={() => setMedida(p.medida)} data-id={`stkAmericano.envasar.pres.${p.medida}`}>{p.label}</button>
                ))}
              </div>

              <label style={S.label}>Envase (stock de Terán)</label>
              <select style={S.select} value={subKey} onChange={e => setSubKey(e.target.value)} data-id="stkAmericano.envasar.envase">
                {envases.length === 0 && <option value="">— sin envases en esta categoría —</option>}
                {envases.map(e => <option key={e.key} value={e.key} disabled={e.stock <= 0}>{e.nombre} · {nf(e.stock)} en Terán{e.stock <= 0 ? ' (sin stock — transfiere con OT)' : ''}</option>)}
              </select>

              {pres.usaTapa && (
                <>
                  <label style={S.label}>Tapa</label>
                  <div style={S.tapaRow}>
                    {tapaSel && <span style={S.dot(tapaSel.color)} />}
                    <select style={S.select} value={tapaKey} onChange={e => setTapaKey(e.target.value)} data-id="stkAmericano.envasar.tapa">
                      {tapasList.map(t => <option key={t.key} value={t.key} disabled={t.stock <= 0}>{t.nombre} · {nf(t.stock)} en Terán{t.stock <= 0 ? ' (sin stock — transfiere con OT)' : ''}</option>)}
                    </select>
                  </div>
                </>
              )}

              <label style={S.label}>Lote del tote</label>
              <select style={S.select} value={loteSel} onChange={e => setLoteSel(e.target.value)} data-id="stkAmericano.envasar.lote">
                {totesReg.length > 0 && (
                  <optgroup label="Totes con lote asignado — elige el que abres">
                    {totesReg.map(t => (
                      <option key={t.codigoLote} value={t.codigoLote}>{t.codigoLote} · {nf(t.litros)} L disponibles</option>
                    ))}
                  </optgroup>
                )}
                <option value="">➕ Nuevo tote — el sistema genera el lote</option>
                {(color.lotes || []).filter(l => !totesReg.some(t => t.codigoLote === l.codigoLote)).length > 0 && (
                  <optgroup label="Tandas anteriores (acumular al mismo lote)">
                    {(color.lotes || []).filter(l => !totesReg.some(t => t.codigoLote === l.codigoLote)).map(l => (
                      <option key={l.codigoLote} value={l.codigoLote}>{l.codigoLote} · {(l.cubetas || 0)} cub · {(l.galones || 0)} gal</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div style={S.hint}>
                {totesReg.length > 0
                  ? 'Cada tote llegó con su lote asignado (su etiqueta ya existe): elige el tote que estás abriendo y las cubetas/galones heredan ese lote.'
                  : 'Todas las cubetas/galones de esta tanda llevan el lote del tote elegido (cubeta o galón). "Nuevo tote" genera uno.'}
              </div>

              {/* Vaciador responsable (jul 2026) — mismo desplegable que los
                  demás sheets de envasado. */}
              <label style={S.label}>Quién envasó</label>
              <select style={S.select} value={envasadorId} onChange={e => elegirVaciador(e.target.value)}
                data-id="stkAmericano.envasar.vaciador">
                <option value="">Sin especificar</option>
                {vaciadores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>

              <label style={S.label}>Cuántas {pres.plural}</label>
              {/* DISEÑO ÚNICO (jul 2026): mismo contador y aviso de tope que las
                  otras 3 pantallas — components/envasado/EnvasarUI. */}
              <Contador valor={unidades} onChange={(v) => setUnidades(String(v))} max={maxUnidAm} min={0} dataId="stkAmericano.envasar.unidades" />
              <TopeHint limites={limitesAm} />

              <div style={S.resumen(excedeLitros || excedeTote || excedeEnvase || excedeTapa)}>
                {n > 0 ? (
                  <>
                    <strong>{n} {pres.plural}</strong> = <strong>{nf(litros)} L</strong>{toteSel ? <> del tote <strong>{toteSel.codigoLote}</strong> (le quedan {nf(Math.max(0, (toteSel.litros || 0) - litros))} L)</> : <> del granel (quedan {nf(Math.max(0, litrosDisp - litros))} L)</>}.
                    {excedeTote && <div style={{ marginTop: 4 }}>Ese tote solo tiene {nf(toteSel.litros)} L.</div>}
                    {excedeLitros && <div style={{ marginTop: 4 }}>No hay tantos litros a granel.</div>}
                    {excedeEnvase && <div style={{ marginTop: 4 }}>No hay tantos envases en Terán ({subSel.stock}).</div>}
                    {excedeTapa && <div style={{ marginTop: 4 }}>No hay tantas tapas en Terán ({tapaSel.stock}).</div>}
                  </>
                ) : 'Indica cuántas unidades vas a envasar.'}
              </div>
              {err && <div style={S.alertErr}>{err}</div>}
            </>
          )}
        </div>
        <div style={S.footer}>
          <button style={S.btn(false)} onClick={onClose}>Cancelar</button>
          <button style={S.btn(true, !puede || saving)} disabled={!puede || saving} onClick={handleEnvasar} data-id="stkAmericano.envasar.guardar">
            {saving ? 'Envasando...' : 'Envasar'}
          </button>
        </div>
      </div>
    </div>
  );
}
