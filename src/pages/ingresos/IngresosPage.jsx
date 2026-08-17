/* ═══════════════════════════════════════════════════════════════════════════
   IngresosPage — Ingresos de pedidos del proveedor (recepción ligera con foto).

   Flujo PROPUESTA → REVISIÓN → ALTA DE STOCK:
   - Técnico/almacén: "Nuevo ingreso" — proveedor + FOTO de la factura (cámara,
     obligatoria) + líneas de lo que llegó (MP/envase/tapa) + nota. Queda
     'por_revisar' SIN tocar inventario.
   - Admin (Emmanuel): bandeja con todos los casos; ve la factura, ajusta las
     líneas y al APROBAR el sistema suma al stock (auditado). O rechaza.

   Backend: routes/ingresos.js. Realtime: canal 'ingresos' (+ 'inventario' al
   aprobar). Tema verde var(--lp-*).
   ═══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import useIsDesktop from '../../hooks/useIsDesktop';

const TIPO_LABEL = { mp: 'MP', envase: 'Envase', tapa: 'Tapa' };

/* Iconos SVG line (regla del proyecto: sin emojis) */
const IconCam = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px', marginRight: 7 }}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconDoc = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);
const IconDots = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" />
  </svg>
);
const IconDotsH = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" />
  </svg>
);
const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const IconInbox = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--lp-text-tertiary,#8a948f)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

/* "30 jun" en vez de "2026-06-30" — el año solo si es distinto al actual. */
const fechaHumana = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  const conAnio = d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' } : {}) });
};
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const ESTADO_META = {
  por_revisar: { label: 'Por revisar', color: '#92610A', bg: '#FEF3C7' },
  recibido:    { label: 'Recibido',    color: '#0F6E56', bg: 'rgba(15,122,90,.12)' },
  rechazado:   { label: 'Rechazado',   color: '#B91C1C', bg: '#FEE2E2' },
  cancelado:   { label: 'Cancelado',   color: '#6B7280', bg: '#F3F4F6' },
};

/* Lotes visibles de la tarjeta: los de trazabilidad (ya aprobados, con
   etiqueta imprimible) o, si aún está por revisar, los capturados a mano en
   las líneas (etiqueta disponible al aprobar). */
function lotesDeIngreso(ing) {
  if (Array.isArray(ing.lotesTrazabilidad) && ing.lotesTrazabilidad.length) return ing.lotesTrazabilidad;
  const out = [];
  (ing.lineas || []).forEach(l => (l.lotes || []).forEach(lt => out.push({
    codigoLote: lt.codigoLote, cantidad: lt.cantidad, producto: l.nombre,
    unidad: l.unidad,
    presentacion: /tote/i.test(String(l.unidad || '') + String(l.nombre || '')) ? 'tote' : null,
    pendiente: true,
  })));
  return out;
}
const unidadLote = (lt) => (lt.presentacion === 'tote' ? 'tote(s)' : (lt.unidad || 'u'));

/* Reduce una imagen a JPEG ≤maxDim px (la factura solo necesita ser legible).
   Los PDF se mandan tal cual. Mantiene el body bajo el límite de 5 MB. */
function fileToFacturaBase64(file, maxDim = 1600, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.type === 'application/pdf') {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const fmt = (n) => (Number(n) || 0).toLocaleString('es-MX');

/* ─── Editor de líneas (lo que llegó) — compartido crear/revisar ───────────── */
function LineasEditor({ lineas, setLineas, mpNames, envaseOpts, tapaOpts, readOnly }) {
  const [tipo, setTipo] = useState('mp');
  const [sel, setSel] = useState('');
  const [cant, setCant] = useState('');
  const [uni, setUni] = useState('kg');
  /* Lotes MANUALES por línea (pedido dueño ago 2026): el # de lote lo pone el
     usuario; la suma de los lotes debe cuadrar con la cantidad de la línea. */
  const [loteEdit, setLoteEdit] = useState(null);
  const [loteCod, setLoteCod] = useState('');
  const [loteCant, setLoteCant] = useState('');
  const sumaLotes = (l) => (l.lotes || []).reduce((sum, x) => sum + (Number(x.cantidad) || 0), 0);
  const agregarLote = (i) => {
    const cod = loteCod.trim(); const c = Number(loteCant);
    if (!cod || !(c > 0)) return;
    setLineas(lineas.map((l, idx) => idx !== i ? l : { ...l, lotes: [...(l.lotes || []), { codigoLote: cod, cantidad: c }] }));
    setLoteCod(''); setLoteCant('');
  };
  const quitarLote = (i, j) =>
    setLineas(lineas.map((l, idx) => idx !== i ? l : { ...l, lotes: (l.lotes || []).filter((_, jj) => jj !== j) }));

  const opts = tipo === 'mp' ? mpNames.map(n => ({ value: n, label: n }))
    : tipo === 'envase' ? envaseOpts
    : tapaOpts;

  const agregar = () => {
    const c = Number(cant);
    if (!sel || !(c > 0)) return;
    let linea;
    if (tipo === 'mp') linea = { tipo: 'mp', mp: sel, nombre: sel, cantidad: c, unidad: uni || 'kg' };
    else if (tipo === 'envase') {
      const o = envaseOpts.find(x => x.value === sel);
      if (!o) return;
      linea = { tipo: 'envase', catKey: o.catKey, subKey: o.subKey, nombre: o.nombre, cantidad: c, unidad: uni || 'pz' };
    } else {
      const o = tapaOpts.find(x => x.value === sel);
      if (!o) return;
      linea = { tipo: 'tapa', tapaKey: o.tapaKey, nombre: o.nombre, cantidad: c, unidad: uni || 'pz' };
    }
    setLineas([...(lineas || []), linea]);
    setSel(''); setCant('');
  };

  const quitar = (i) => setLineas(lineas.filter((_, idx) => idx !== i));

  return (
    <div>
      {(lineas || []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {lineas.map((l, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={S.lineChip}>
                <span style={S.lineTipo}>{TIPO_LABEL[l.tipo] || l.tipo}</span>
                <span style={{ flex: 1, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</span>
                <span style={{ fontWeight: 600 }}>{fmt(l.cantidad)} {l.unidad}</span>
                {l.tipo === 'mp' && !readOnly && (
                  <button onClick={() => setLoteEdit(loteEdit === i ? null : i)} style={S.chipLotesBtn}>
                    Lotes{(l.lotes || []).length ? ` (${l.lotes.length})` : ''}
                  </button>
                )}
                {!readOnly && (
                  <button onClick={() => quitar(i)} aria-label="Quitar" style={S.chipDel}>✕</button>
                )}
              </div>
              {(l.lotes || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, paddingLeft: 8 }}>
                  {l.lotes.map((lt, j) => (
                    <span key={j} style={S.loteChip}>
                      <span style={{ fontFamily: MONO, fontWeight: 700 }}>{lt.codigoLote}</span>
                      <span>· {fmt(lt.cantidad)}</span>
                      {!readOnly && <button onClick={() => quitarLote(i, j)} aria-label="Quitar lote" style={S.chipDel}>✕</button>}
                    </span>
                  ))}
                  {Math.abs(sumaLotes(l) - Number(l.cantidad)) > 0.01 && (
                    <span style={S.loteWarn}>los lotes suman {fmt(sumaLotes(l))} de {fmt(l.cantidad)}</span>
                  )}
                </div>
              )}
              {loteEdit === i && !readOnly && (
                <div style={S.loteForm}>
                  <input value={loteCod} onChange={e => setLoteCod(e.target.value)} placeholder="# de lote (manual)" style={{ ...S.input, flex: 2 }} />
                  <input type="number" inputMode="decimal" min="0" value={loteCant} onChange={e => setLoteCant(e.target.value)} placeholder="Cantidad" style={{ ...S.input, flex: 1 }} />
                  <button onClick={() => agregarLote(i)} disabled={!loteCod.trim() || !(Number(loteCant) > 0)}
                    style={{ ...S.addBtn, opacity: (!loteCod.trim() || !(Number(loteCant) > 0)) ? 0.5 : 1 }}>+ Lote</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <div style={S.lineForm}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['mp', 'envase', 'tapa'].map(t => (
              <button key={t} onClick={() => { setTipo(t); setSel(''); setUni(t === 'mp' ? 'kg' : 'pz'); }}
                style={{ ...S.seg, ...(tipo === t ? S.segActive : {}) }}>{TIPO_LABEL[t]}</button>
            ))}
          </div>
          <input list="ing-opts" value={sel} onChange={e => setSel(e.target.value)}
            placeholder={tipo === 'mp' ? 'Materia prima…' : tipo === 'envase' ? 'Envase…' : 'Tapa…'} style={S.input} />
          <datalist id="ing-opts">
            {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </datalist>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" inputMode="decimal" min="0" value={cant} onChange={e => setCant(e.target.value)}
              placeholder="Cantidad" style={{ ...S.input, flex: 2 }} />
            <input value={uni} onChange={e => setUni(e.target.value)} placeholder="Unidad" style={{ ...S.input, flex: 1 }} />
            <button onClick={agregar} disabled={!sel || !(Number(cant) > 0)} style={{ ...S.addBtn, opacity: (!sel || !(Number(cant) > 0)) ? 0.5 : 1 }}>+ Agregar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sheet: nuevo ingreso (técnico/almacén/admin) ─────────────────────────── */
function CrearSheet({ catalogs, onClose, onSaved, isDesktop }) {
  const [proveedor, setProveedor] = useState('');
  const [numFactura, setNumFactura] = useState('');
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');
  const [facturaData, setFacturaData] = useState(null);
  const [facturaPreview, setFacturaPreview] = useState(null);
  const [esPdf, setEsPdf] = useState(false);
  const [lineas, setLineas] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr('');
    try {
      const b64 = await fileToFacturaBase64(file);
      setFacturaData(b64);
      setEsPdf(file.type === 'application/pdf');
      setFacturaPreview(file.type === 'application/pdf' ? null : b64);
    } catch (e2) { setErr('No se pudo procesar la foto: ' + (e2?.message || '')); }
  };

  const guardar = async () => {
    setErr('');
    if (!proveedor.trim()) return setErr('Escribe el proveedor');
    if (!facturaData) return setErr('Toma o adjunta la foto de la factura');
    setSaving(true);
    try {
      const r = await api.crearIngreso({
        proveedor: proveedor.trim(), numFactura: numFactura.trim(),
        monto: Number(monto) > 0 ? Number(monto) : null,
        nota: nota.trim(), lineas, facturaBase64: facturaData,
      });
      if (r && r.ok) onSaved(r.ingreso);
      else setErr((r && r.error) || 'No se pudo crear');
    } catch (e2) {
      setErr(e2?.data?.error || e2?.message || 'No se pudo crear el ingreso');
    } finally { setSaving(false); }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.sheetHead}>
          <div style={{ fontSize: 17, fontWeight: 650 }}>Nuevo ingreso</div>
          <button onClick={onClose} style={S.x}>✕</button>
        </div>
        <div style={S.sheetBody}>
          <label style={S.lbl}>Proveedor *</label>
          <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Ej. Limplast, NRW Chemie…" style={S.input} />

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={S.lbl}># Factura</label>
              <input value={numFactura} onChange={e => setNumFactura(e.target.value)} placeholder="Opcional" style={S.input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.lbl}>Monto</label>
              <input type="number" inputMode="decimal" min="0" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Opcional" style={S.input} />
            </div>
          </div>

          <label style={S.lbl}>Foto de la factura *</label>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" onChange={onFile} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current && fileRef.current.click()} style={S.fotoBtn}>
            <IconCam />{facturaData ? 'Cambiar foto' : 'Tomar / adjuntar factura'}
          </button>
          {facturaPreview && <img src={facturaPreview} alt="Factura" style={S.preview} />}
          {esPdf && <div style={S.pdfOk}>PDF adjunto ✓</div>}

          <label style={S.lbl}>¿Qué llegó? <span style={{ color: 'var(--lp-text-tertiary,#8a948f)', fontWeight: 400 }}>(opcional — el admin lo confirma al revisar)</span></label>
          <LineasEditor lineas={lineas} setLineas={setLineas} {...catalogs} />

          <label style={S.lbl}>Nota</label>
          <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Observaciones…" style={{ ...S.input, resize: 'vertical' }} />

          {err && <div style={S.err}>{err}</div>}
        </div>
        <div style={{ ...S.sheetFoot, ...(isDesktop ? {} : S.sheetFootMobile) }}>
          <button onClick={onClose} disabled={saving} style={{ ...S.btnGhost, ...(isDesktop ? {} : S.btnMobileGhost) }}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, ...(isDesktop ? {} : S.btnMobilePrimary), opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Guardando…' : 'Registrar ingreso'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sheet: revisar (admin) → aprobar (suma stock) / rechazar ─────────────── */
function RevisarSheet({ ing, catalogs, onClose, onDone, isDesktop }) {
  const [lineas, setLineas] = useState(() => (ing.lineas || []).map(l => ({ ...l })));
  const [notaRevision, setNotaRevision] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const revisar = async (decision) => {
    setErr('');
    if (decision === 'aprobar' && lineas.length === 0) return setErr('Agrega al menos una línea para sumar al inventario');
    setBusy(decision);
    try {
      const r = await api.revisarIngreso(ing.id, { decision, lineasFinales: lineas, notaRevision: notaRevision.trim() });
      if (r && r.ok) onDone(r.ingreso, decision, r.mutaciones || []);
      else setErr((r && r.error) || 'No se pudo revisar');
    } catch (e) {
      setErr(e?.data?.error || e?.message || 'No se pudo revisar');
    } finally { setBusy(''); }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.sheetHead}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 650 }}>Revisar <span style={{ fontFamily: MONO, fontSize: 15 }}>{ing.folio}</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary,#5a6b63)', marginTop: 2 }}>{ing.proveedor} · subió {ing.usuario}</div>
          </div>
          <button onClick={onClose} style={S.x}>✕</button>
        </div>
        <div style={S.sheetBody}>
          <label style={S.lbl}>Factura</label>
          <a href={api.ingresoFacturaUrl(ing.id)} target="_blank" rel="noreferrer">
            <img src={api.ingresoFacturaUrl(ing.id)} alt="Factura" style={S.preview}
              onError={(e) => { e.target.style.display = 'none'; }} />
          </a>
          <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary,#8a948f)', marginTop: -4, marginBottom: 6 }}>
            Toca la imagen para verla en grande{ing.numFactura ? ` · # ${ing.numFactura}` : ''}{ing.monto ? ` · $${fmt(ing.monto)}` : ''}
          </div>
          {ing.nota && <div style={S.notaBox}>“{ing.nota}”</div>}

          <label style={S.lbl}>Líneas a sumar al inventario</label>
          <LineasEditor lineas={lineas} setLineas={setLineas} {...catalogs} />

          <label style={S.lbl}>Nota de revisión</label>
          <textarea value={notaRevision} onChange={e => setNotaRevision(e.target.value)} rows={2} placeholder="Opcional…" style={{ ...S.input, resize: 'vertical' }} />

          {err && <div style={S.err}>{err}</div>}
        </div>
        <div style={{ ...S.sheetFoot, ...(isDesktop ? {} : S.sheetFootMobile) }}>
          <button onClick={() => revisar('rechazar')} disabled={!!busy} style={{ ...S.btnDanger, ...(isDesktop ? {} : S.btnMobileGhost) }}>
            {busy === 'rechazar' ? '…' : 'Rechazar'}
          </button>
          <button onClick={() => revisar('aprobar')} disabled={!!busy} style={{ ...S.btnPrimary, ...(isDesktop ? {} : S.btnMobilePrimary), opacity: busy ? 0.6 : 1 }}>
            {busy === 'aprobar' ? 'Sumando…' : 'Aprobar y sumar al stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Menú kebab (⋮ tarjeta / … lote) — cierra al tocar fuera ─────────────── */
function KebabMenu({ horizontal, label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('touchstart', cerrar);
    return () => { document.removeEventListener('mousedown', cerrar); document.removeEventListener('touchstart', cerrar); };
  }, [open]);
  const visibles = (items || []).filter(Boolean);
  if (visibles.length === 0) return null;
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} aria-label={label || 'Opciones'} aria-expanded={open} style={S.kebabBtn}>
        {horizontal ? <IconDotsH /> : <IconDots />}
      </button>
      {open && (
        <div style={S.menu} role="menu">
          {visibles.map((it, i) => (
            <button key={i} role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}
              style={{ ...S.menuItem, ...(it.danger ? S.menuItemDanger : {}) }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Sheet: cancelar ingreso (admin) — con reversa si ya sumó stock ───────── */
function CancelarSheet({ ing, onClose, onDone, isDesktop }) {
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const habiaSumado = ing.estado === 'recibido';

  const confirmar = async () => {
    setErr('');
    if (motivo.trim().length < 10) return setErr('Escribe el motivo (mínimo 10 caracteres — queda en auditoría)');
    setBusy(true);
    try {
      const r = await api.cancelarIngreso(ing.id, { motivo: motivo.trim() });
      if (r && r.ok) onDone(r);
      else setErr((r && r.error) || 'No se pudo cancelar');
    } catch (e) {
      setErr(e?.data?.error || e?.message || 'No se pudo cancelar el ingreso');
    } finally { setBusy(false); }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.sheetHead}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 650 }}>Cancelar <span style={{ fontFamily: MONO, fontSize: 15 }}>{ing.folio}</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--lp-text-secondary,#5a6b63)', marginTop: 2 }}>{ing.proveedor} · subió {ing.usuario}</div>
          </div>
          <button onClick={onClose} style={S.x}>✕</button>
        </div>
        <div style={S.sheetBody}>
          <div style={S.notaBox}>
            {habiaSumado
              ? 'Este ingreso YA sumó al inventario. Al cancelarlo se revierte exactamente lo que sumó (MP, envases, tapas) y sus lotes quedan cancelados.'
              : `Este ingreso está "${(ESTADO_META[ing.estado] || { label: ing.estado }).label}" — nunca sumó inventario; solo quedará marcado como cancelado.`}
          </div>
          <label style={S.lbl}>Motivo *</label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2}
            placeholder="Ej. Fue una prueba del sistema" style={{ ...S.input, resize: 'vertical' }} />
          {err && <div style={S.err}>{err}</div>}
        </div>
        <div style={{ ...S.sheetFoot, ...(isDesktop ? {} : S.sheetFootMobile) }}>
          <button onClick={onClose} disabled={busy} style={{ ...S.btnGhost, ...(isDesktop ? {} : S.btnMobileGhost) }}>Volver</button>
          <button onClick={confirmar} disabled={busy} style={{ ...S.btnDanger, ...(isDesktop ? {} : S.btnMobilePrimary), opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Cancelando…' : (habiaSumado ? 'Cancelar y revertir stock' : 'Cancelar ingreso')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Página ───────────────────────────────────────────────────────────────── */
export default function IngresosPage() {
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const isAdmin = user?.rol === 'admin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('por_revisar');
  const [crear, setCrear] = useState(false);
  const [revisar, setRevisar] = useState(null);
  const [cancelar, setCancelar] = useState(null);
  const [lotesAbiertos, setLotesAbiertos] = useState({});
  const [toast, setToast] = useState(null);
  const [catalogs, setCatalogs] = useState({ mpNames: [], envaseOpts: [], tapaOpts: [] });

  const showToast = useCallback((msg, isErr = false) => {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.getIngresos();
      const list = Array.isArray(r) ? r : (r.data || []);
      list.sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));
      setItems(list);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  /* eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial async; el setState ocurre tras el await, no sincrónico */
  useEffect(() => { load(); }, [load]);
  useRealtimeSync({ onIngresos: () => load(), onInventario: () => load() });

  /* Catálogos (MP / envases / tapas) para el autocompletar de líneas */
  useEffect(() => {
    (async () => {
      try {
        const [mr, er] = await Promise.all([api.getMaestroMP(), api.getEnvases()]);
        const maestro = (mr && mr.data) || mr || {};
        const mpNames = Object.keys(maestro.mps || {}).sort();
        const env = (er && er.data) || er || {};
        const envaseOpts = [];
        Object.entries(env.categorias || {}).forEach(([catKey, cat]) => {
          Object.entries((cat && cat.subcategorias) || {}).forEach(([subKey, sub]) => {
            envaseOpts.push({
              value: catKey + '|||' + subKey,
              label: `${cat.nombre || catKey} · ${sub.nombre || sub.marca || subKey}`,
              catKey, subKey, nombre: sub.nombre || subKey, unidad: sub.unidad || 'pz',
            });
          });
        });
        const tapaOpts = Object.entries(env.tapas || {}).map(([tapaKey, t]) => ({
          value: tapaKey, label: t.nombre || tapaKey, tapaKey, nombre: t.nombre || tapaKey, unidad: t.unidad || 'pz',
        }));
        setCatalogs({ mpNames, envaseOpts, tapaOpts });
      } catch { /* noop */ }
    })();
  }, []);

  const filtrados = useMemo(() => {
    if (isAdmin && tab !== 'todos') return items.filter(x => x.estado === tab);
    return items;
  }, [items, tab, isAdmin]);

  const conteo = useMemo(() => {
    const c = { por_revisar: 0, recibido: 0, rechazado: 0, cancelado: 0 };
    items.forEach(x => { if (c[x.estado] != null) c[x.estado]++; });
    return c;
  }, [items]);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: isDesktop ? '4px 2px 80px' : '4px 2px 150px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: isDesktop ? 22 : 20, fontWeight: 650, margin: 0, letterSpacing: '-0.3px', color: 'var(--lp-text-primary,#16201c)' }}>Ingresos de proveedor</h1>
          <div style={{ fontSize: 14, color: 'var(--lp-text-secondary,#5a6b63)', marginTop: 3, lineHeight: 1.45, maxWidth: 520 }}>
            {isAdmin ? 'Revisa lo que llegó y súmalo al stock.' : 'Cuando llegue material, regístralo con la foto de la factura.'}
          </div>
        </div>
        {/* En móvil la acción principal vive ABAJO (FAB al alcance del pulgar);
            arriba solo estorbaba y casi no se podía tocar. */}
        {isDesktop && <button onClick={() => setCrear(true)} style={S.btnPrimary}>+ Nuevo ingreso</button>}
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 6, margin: '14px 0 10px', flexWrap: 'wrap' }}>
          {[
            ['por_revisar', `Por revisar${conteo.por_revisar ? ` (${conteo.por_revisar})` : ''}`],
            ['recibido', 'Recibidos'],
            ['rechazado', 'Rechazados'],
            ['cancelado', 'Cancelados'],
            ['todos', 'Todos'],
          ].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} style={{ ...S.tab, ...(isDesktop ? {} : { minHeight: 38, padding: '8px 16px' }), ...(tab === k ? S.tabActive : {}) }}>{lbl}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={S.empty}>Cargando…</div>
      ) : filtrados.length === 0 ? (
        <div style={S.empty}>
          <IconInbox />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--lp-text-primary,#16201c)' }}>
            {isAdmin ? 'No hay ingresos en esta vista' : 'Aún no has registrado ingresos'}
          </div>
          <div style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.5, maxWidth: 320 }}>
            {isAdmin
              ? 'Cuando alguien registre lo que llegó del proveedor, aparecerá aquí para revisarlo.'
              : `Cuando llegue material del proveedor, toca "Nuevo ingreso" ${isDesktop ? 'arriba' : 'aquí abajo'}.`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(ing => {
            const em = ESTADO_META[ing.estado] || { label: ing.estado, color: '#555', bg: '#eee' };
            const nL = Array.isArray(ing.lineas) ? ing.lineas.length : 0;
            return (
              <div key={ing.id} style={{ ...S.card, padding: isDesktop ? '16px 20px' : '14px 16px' }}>
                {/* El PROVEEDOR manda (es lo que se busca al escanear la lista);
                    folio y estado son secundarios. Fecha humana, sin jerga. */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: isDesktop ? 15.5 : 16, fontWeight: 650, color: 'var(--lp-text-primary,#16201c)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ing.proveedor}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={S.folio}>{ing.folio}</span>
                      <span style={{ ...S.badge, color: em.color, background: em.bg }}>{em.label}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {Number(ing.monto) > 0 && <div style={S.monto}>${fmt(ing.monto)}</div>}
                    {/* Kebab ⋮ (pedido dueño ago 2026): las opciones de la
                        tarjeta viven aquí — Ver factura, Imprimir etiqueta de
                        tote, Revisar y Cancelar (con reversa). */}
                    <KebabMenu label={'Opciones de ' + ing.folio} items={[
                      { label: <span style={{ display: 'inline-flex', alignItems: 'center' }}><IconDoc />&nbsp;Ver factura</span>, onClick: () => window.open(api.ingresoFacturaUrl(ing.id), '_blank') },
                      (Array.isArray(ing.lotesTrazabilidad) && ing.lotesTrazabilidad.length > 0) && {
                        label: 'Imprimir etiqueta de tote',
                        onClick: () => {
                          const ls = ing.lotesTrazabilidad;
                          if (ls.length === 1) window.open(api.etiquetaToteUrl(ls[0].codigoLote), '_blank');
                          else setLotesAbiertos(prev => ({ ...prev, [ing.id]: true }));
                        },
                      },
                      (isAdmin && ing.estado === 'por_revisar') && { label: 'Revisar y sumar al stock', onClick: () => setRevisar(ing) },
                      (isAdmin && ing.estado !== 'cancelado') && { label: 'Cancelar ingreso', danger: true, onClick: () => setCancelar(ing) },
                    ]} />
                  </div>
                </div>

                <div style={S.meta}>
                  {fechaHumana(ing.fechaCreacion)} · {ing.usuario}
                  {ing.numFactura ? ` · Factura #${ing.numFactura}` : ''}
                  {nL === 0 ? ' · sin partidas aún' : ''}
                </div>

                {nL > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
                    {ing.lineas.map((l, i) => (
                      <span key={i} style={S.miniLine}>{l.nombre} · <span style={{ fontWeight: 650 }}>{fmt(l.cantidad)} {l.unidad}</span></span>
                    ))}
                  </div>
                )}

                {/* # de lote VISIBLES + desplegable (pedido dueño ago 2026):
                    cada lote es una sub-tarjeta con su menú … (etiqueta/QR),
                    sin ocupar una tarjeta principal por lote. */}
                {(() => {
                  const lts = lotesDeIngreso(ing);
                  if (lts.length === 0) return null;
                  const abierto = !!lotesAbiertos[ing.id];
                  const totalU = lts.reduce((sum, l) => sum + (Number(l.cantidad) || 0), 0);
                  return (
                    <div style={{ marginTop: 10 }}>
                      <button onClick={() => setLotesAbiertos(prev => ({ ...prev, [ing.id]: !abierto }))}
                        aria-expanded={abierto} style={S.lotesToggle}>
                        <span style={{ display: 'inline-flex', transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><IconChevron /></span>
                        <span style={{ fontWeight: 650, whiteSpace: 'nowrap' }}>{lts.length} lote{lts.length === 1 ? '' : 's'}</span>
                        <span style={{ color: 'var(--lp-text-secondary,#5a6b63)', whiteSpace: 'nowrap' }}>· {fmt(totalU)} {unidadLote(lts[0])}</span>
                        <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--lp-text-tertiary,#8a948f)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1, textAlign: 'right' }}>
                          {lts.map(l => l.codigoLote).join(' · ')}
                        </span>
                      </button>
                      {abierto && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                          {lts.map((lt) => (
                            <div key={lt.codigoLote} style={S.loteCard}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={S.loteCod}>{lt.codigoLote}</div>
                                <div style={S.loteMeta}>
                                  {fmt(lt.cantidad)} {unidadLote(lt)}
                                  {lt.producto ? ` · ${lt.producto}` : ''}
                                  {lt.pendiente ? ' · etiqueta disponible al aprobar' : ''}
                                </div>
                              </div>
                              {!lt.pendiente && (
                                <KebabMenu horizontal label={'Opciones del lote ' + lt.codigoLote} items={[
                                  { label: 'Imprimir etiqueta', onClick: () => window.open(api.etiquetaToteUrl(lt.codigoLote), '_blank') },
                                  { label: 'Ver QR / trazabilidad', onClick: () => window.open(api.qrLoteUrl(lt.codigoLote), '_blank') },
                                ]} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {ing.estado === 'recibido' && ing.revisadoPor && (
                  <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary,#8a948f)', marginTop: 9 }}>Sumado al stock por {ing.revisadoPor}</div>
                )}
                {ing.estado === 'rechazado' && (
                  <div style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 9 }}>Rechazado{ing.notaRevision ? `: ${ing.notaRevision}` : ''}</div>
                )}
                {ing.estado === 'cancelado' && (
                  <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 9 }}>
                    Cancelado por {ing.canceladoPor || '?'}{ing.motivoCancelacion ? `: ${ing.motivoCancelacion}` : ''}
                    {ing.reversa && ing.reversa.aplicada ? ' · inventario revertido' : ''}
                  </div>
                )}

                {/* "Ver factura" y demás opciones viven en el kebab ⋮; el CTA
                    visible queda solo para la acción principal del admin. */}
                {isAdmin && ing.estado === 'por_revisar' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 11 }}>
                    <button onClick={() => setRevisar(ing)} style={{ ...S.btnPrimary, ...(isDesktop ? {} : { minHeight: 44, padding: '10px 20px' }) }}>Revisar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FAB móvil: la acción principal SIEMPRE al alcance del pulgar, arriba
          del bottom-nav (misma convención de offset que Compras/Forecast). */}
      {!isDesktop && !crear && !revisar && !cancelar && (
        <button onClick={() => setCrear(true)} style={S.fab} aria-label="Nuevo ingreso">
          <IconPlus /> Nuevo ingreso
        </button>
      )}

      {crear && (
        <CrearSheet catalogs={catalogs} isDesktop={isDesktop} onClose={() => setCrear(false)}
          onSaved={(ing) => { setCrear(false); showToast(`Ingreso ${ing.folio} registrado · queda por revisar`); load(); }} />
      )}
      {cancelar && (
        <CancelarSheet ing={cancelar} isDesktop={isDesktop} onClose={() => setCancelar(null)}
          onDone={(r) => {
            setCancelar(null);
            showToast(r.mensaje || `${(r.ingreso && r.ingreso.folio) || ''}: cancelado`);
            load();
          }} />
      )}
      {revisar && (
        <RevisarSheet ing={revisar} catalogs={catalogs} isDesktop={isDesktop} onClose={() => setRevisar(null)}
          onDone={(ing, decision, muts) => {
            setRevisar(null);
            showToast(decision === 'aprobar'
              ? `${ing.folio}: sumado al stock (${muts.length} ítem(s)) ✓`
              : `${ing.folio}: rechazado`);
            load();
          }} />
      )}

      {toast && (
        <div style={{ ...S.toast, ...(toast.isErr ? { background: '#B91C1C' } : {}) }}>{toast.msg}</div>
      )}
    </div>
  );
}

/* ─── estilos ────────────────────────────────────────────────────────────── */
const BRAND = 'var(--lp-brand-700,#0f7a5a)';
const S = {
  card: { background: 'var(--lp-surface,#fff)', border: '1px solid var(--lp-border,rgba(0,0,0,.1))', borderRadius: 16, padding: '14px 16px' },
  badge: { fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  miniLine: { fontSize: 12, background: 'var(--lp-bg-base,#f5f6f4)', border: '1px solid var(--lp-border,rgba(0,0,0,.08))', borderRadius: 7, padding: '3px 9px' },
  /* Jerarquía de card: proveedor manda; folio en mono (código), monto en mono. */
  folio: { fontFamily: MONO, fontSize: 12, color: 'var(--lp-text-secondary,#5a6b63)', letterSpacing: '0.2px' },
  monto: { fontFamily: MONO, fontSize: 14, fontWeight: 600, color: 'var(--lp-text-primary,#16201c)', whiteSpace: 'nowrap' },
  meta: { fontSize: 13, color: 'var(--lp-text-secondary,#5a6b63)', marginTop: 8, lineHeight: 1.45 },
  /* "Ver factura" con área táctil real (antes era una liga de 12px) */
  verFacturaBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: BRAND, padding: '9px 14px', minHeight: 40, borderRadius: 9, border: '1px solid rgba(15,122,90,.28)', background: 'rgba(15,122,90,.06)', textDecoration: 'none', whiteSpace: 'nowrap', boxSizing: 'border-box' },
  /* Kebab ⋮/… + menú de opciones (tarjeta y sub-tarjeta de lote) */
  kebabBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 9, border: '1px solid var(--lp-border,rgba(0,0,0,.12))', background: 'transparent', color: 'var(--lp-text-secondary,#5a6b63)', cursor: 'pointer', flexShrink: 0 },
  menu: { position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 60, minWidth: 224, background: 'var(--lp-surface,#fff)', border: '1px solid var(--lp-border,rgba(0,0,0,.12))', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,.14)', padding: 6, display: 'flex', flexDirection: 'column' },
  menuItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 550, textAlign: 'left', padding: '10px 12px', minHeight: 42, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--lp-text-primary,#16201c)', cursor: 'pointer', width: '100%' },
  menuItemDanger: { color: '#B91C1C' },
  /* Lotes desplegables de la tarjeta (# de lote visible + sub-tarjetas) */
  lotesToggle: { display: 'flex', alignItems: 'center', gap: 7, width: '100%', minHeight: 42, padding: '8px 10px', fontSize: 12.5, borderRadius: 9, border: '1px dashed var(--lp-border,rgba(0,0,0,.16))', background: 'var(--lp-bg-base,#f7f8f6)', color: 'var(--lp-text-primary,#16201c)', cursor: 'pointer', textAlign: 'left', minWidth: 0, boxSizing: 'border-box' },
  loteCard: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 8px 9px 12px', borderRadius: 10, border: '1px solid var(--lp-border,rgba(0,0,0,.1))', background: 'var(--lp-surface,#fff)', marginLeft: 14 },
  loteCod: { fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.2px' },
  loteMeta: { fontSize: 12, color: 'var(--lp-text-secondary,#5a6b63)', marginTop: 2 },
  /* Editor de lotes manuales por línea (crear/revisar) */
  chipLotesBtn: { fontSize: 11, fontWeight: 700, color: BRAND, background: 'rgba(15,122,90,.08)', border: '1px solid rgba(15,122,90,.25)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap' },
  loteChip: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, background: 'var(--lp-surface,#fff)', border: '1px solid var(--lp-border,rgba(0,0,0,.12))', borderRadius: 6, padding: '3px 8px' },
  loteWarn: { fontSize: 11, color: '#92610A', background: '#FEF3C7', borderRadius: 6, padding: '3px 8px' },
  loteForm: { display: 'flex', gap: 6, paddingLeft: 8 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: 'var(--lp-text-secondary,#5a6b63)', padding: '52px 16px', fontSize: 14 },
  tab: { fontSize: 13, fontWeight: 500, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--lp-border,rgba(0,0,0,.12))', background: 'transparent', color: 'var(--lp-text-secondary,#5a6b63)', cursor: 'pointer' },
  tabActive: { background: BRAND, color: '#fff', borderColor: BRAND },
  btnPrimary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: 'none', background: BRAND, color: '#fff', cursor: 'pointer' },
  btnGhost: { fontSize: 14, fontWeight: 500, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--lp-border,rgba(0,0,0,.15))', background: 'transparent', color: 'var(--lp-text-primary,#16201c)', cursor: 'pointer' },
  btnDanger: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 10, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet: { background: 'var(--lp-surface,#fff)', width: '100%', maxWidth: 560, maxHeight: '92vh', borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column' },
  sheetHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--lp-border,rgba(0,0,0,.08))' },
  sheetBody: { padding: '14px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  sheetFoot: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 18px', borderTop: '1px solid var(--lp-border,rgba(0,0,0,.08))' },
  x: { border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: 'var(--lp-text-secondary,#5a6b63)' },
  lbl: { fontSize: 12.5, fontWeight: 600, color: 'var(--lp-text-secondary,#5a6b63)', margin: '12px 0 5px' },
  /* 16px EXACTOS: con menos, iOS hace zoom automático al enfocar el input
     (una de las quejas de legibilidad en móvil). También se lee mejor en PC. */
  input: { width: '100%', fontSize: 16, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--lp-border,rgba(0,0,0,.15))', background: 'var(--lp-surface,#fff)', color: 'var(--lp-text-primary,#16201c)', boxSizing: 'border-box' },
  fotoBtn: { fontSize: 14, fontWeight: 600, padding: '12px', borderRadius: 10, border: '1.5px dashed ' + BRAND, background: 'rgba(15,122,90,.05)', color: BRAND, cursor: 'pointer', width: '100%' },
  preview: { width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--lp-border,rgba(0,0,0,.1))', marginTop: 8, background: '#fafafa', display: 'block' },
  pdfOk: { fontSize: 13, color: BRAND, fontWeight: 600, marginTop: 8 },
  notaBox: { fontSize: 13, fontStyle: 'italic', color: 'var(--lp-text-secondary,#5a6b63)', background: 'var(--lp-bg-base,#f5f6f4)', borderRadius: 8, padding: '8px 10px', margin: '4px 0 2px' },
  err: { fontSize: 13.5, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '9px 11px', marginTop: 10, lineHeight: 1.4 },
  lineChip: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, padding: '8px 11px', borderRadius: 8, border: '1px solid var(--lp-border,rgba(0,0,0,.1))', background: 'var(--lp-bg-base,#f7f8f6)' },
  lineTipo: { fontSize: 10, fontWeight: 700, color: BRAND, background: 'rgba(15,122,90,.1)', borderRadius: 5, padding: '1px 6px' },
  chipDel: { border: 'none', background: 'transparent', color: '#B91C1C', cursor: 'pointer', fontSize: 13 },
  lineForm: { display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 10, border: '1px dashed var(--lp-border,rgba(0,0,0,.15))' },
  seg: { flex: 1, fontSize: 12.5, fontWeight: 600, padding: '6px', minHeight: 36, borderRadius: 7, border: '1px solid var(--lp-border,rgba(0,0,0,.12))', background: 'transparent', color: 'var(--lp-text-secondary,#5a6b63)', cursor: 'pointer' },
  segActive: { background: BRAND, color: '#fff', borderColor: BRAND },
  addBtn: { fontSize: 13, fontWeight: 600, padding: '10px 12px', minHeight: 40, borderRadius: 8, border: 'none', background: BRAND, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' },
  toast: { position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#16201c', color: '#fff', fontSize: 14, padding: '11px 18px', borderRadius: 10, zIndex: 1200, maxWidth: '90vw', textAlign: 'center' },
  /* FAB móvil (pill extendida): arriba del bottom-nav, zIndex < overlay (1100)
     para que los sheets lo cubran. Offset = convención de la app. */
  fab: { position: 'fixed', right: 16, bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))', zIndex: 45, display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 52, padding: '0 22px', borderRadius: 28, border: 'none', background: BRAND, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px rgba(15,122,90,.35)' },
  /* Footer de sheet en móvil: botones grandes (≥48px) + safe-area inferior */
  sheetFootMobile: { paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' },
  btnMobilePrimary: { flex: 1, minHeight: 48, fontSize: 15 },
  btnMobileGhost: { minHeight: 48, padding: '9px 18px' },
};
