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
const IconInbox = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--lp-text-tertiary,#8a948f)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const IconDots = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" />
  </svg>
);
const IconEdit = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
  </svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

/* "hoy 9:12" / "ayer 16:40" / "28 jun" — como pide el handoff 1c. */
const fechaRelativa = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  const hh = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const mismo = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismo(d, hoy)) return 'hoy ' + hh;
  if (mismo(d, ayer)) return 'ayer ' + hh;
  return fechaHumana(iso);
};

/* Avatar de proveedor: iniciales + tinte determinístico (paleta del handoff). */
const iniciales = (n) => {
  const w = String(n || '?').trim().split(/\s+/).filter(Boolean);
  return (w.length >= 2 ? w[0][0] + w[1][0] : String(w[0] || '?').slice(0, 2)).toUpperCase();
};
const TINTES = [
  { bg: 'rgba(29,158,117,0.15)', fg: '#0F6E56' },
  { bg: 'rgba(83,74,183,0.12)', fg: '#534AB7' },
  { bg: 'rgba(239,159,39,0.15)', fg: '#854F0B' },
  { bg: 'rgba(29,86,216,0.10)', fg: '#1e3a8a' },
];
const tinte = (n) => { let h = 0; const s = String(n || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return TINTES[h % TINTES.length]; };

const Vacio = ({ isAdmin, isDesktop }) => (
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
);
const ESTADO_META = {
  por_revisar: { label: 'Por revisar', color: '#92610A', bg: '#FEF3C7' },
  recibido:    { label: 'Recibido',    color: '#0F6E56', bg: 'rgba(15,122,90,.12)' },
  rechazado:   { label: 'Rechazado',   color: '#B91C1C', bg: '#FEE2E2' },
};

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
  /* Borrador POR PESTAÑA (fix crítico jul 2026): cada tipo (mp/envase/tapa) recuerda
     lo que estabas escribiendo → cambiar de sub-pestaña YA NO borra la info del
     anterior. Antes era un solo estado compartido que se reseteaba al cambiar. */
  const [draft, setDraft] = useState({
    mp:     { sel: '', cant: '', uni: 'kg', lote: '', costoKg: '' },
    envase: { sel: '', cant: '', uni: 'pz' },
    tapa:   { sel: '', cant: '', uni: 'pz' },
  });
  const d = draft[tipo];
  const setD = (patch) => setDraft(prev => ({ ...prev, [tipo]: { ...prev[tipo], ...patch } }));

  const opts = tipo === 'mp' ? mpNames.map(n => ({ value: n, label: n }))
    : tipo === 'envase' ? envaseOpts
    : tapaOpts;

  const agregar = () => {
    const c = Number(d.cant);
    if (!d.sel || !(c > 0)) return;
    let linea;
    if (tipo === 'mp') {
      const lt = (d.lote || '').trim();
      const ck = Number(d.costoKg) > 0 ? +Number(d.costoKg).toFixed(4) : null;
      const nombre = `${d.sel}${lt ? ` · Lote ${lt}` : ''}${ck ? ` · $${ck}/kg` : ''}`;
      linea = { tipo: 'mp', mp: d.sel, nombre, cantidad: c, unidad: d.uni || 'kg', ...(lt ? { lote: lt } : {}), ...(ck ? { costoKg: ck } : {}) };
    } else if (tipo === 'envase') {
      const o = envaseOpts.find(x => x.value === d.sel);
      if (!o) return;
      linea = { tipo: 'envase', catKey: o.catKey, subKey: o.subKey, nombre: o.nombre, cantidad: c, unidad: d.uni || 'pz' };
    } else {
      const o = tapaOpts.find(x => x.value === d.sel);
      if (!o) return;
      linea = { tipo: 'tapa', tapaKey: o.tapaKey, nombre: o.nombre, cantidad: c, unidad: d.uni || 'pz' };
    }
    setLineas([...(lineas || []), linea]);
    setD({ sel: '', cant: '', lote: '', costoKg: '' }); /* limpia SOLO esta pestaña tras agregar */
  };

  const quitar = (i) => setLineas(lineas.filter((_, idx) => idx !== i));

  return (
    <div>
      {(lineas || []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {lineas.map((l, i) => (
            <div key={i} style={S.lineChip}>
              <span style={S.lineTipo}>{TIPO_LABEL[l.tipo] || l.tipo}</span>
              <span style={{ flex: 1, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</span>
              <span style={{ fontWeight: 600 }}>{fmt(l.cantidad)} {l.unidad}</span>
              {!readOnly && (
                <button onClick={() => quitar(i)} aria-label="Quitar" style={S.chipDel}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <div style={S.lineForm}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['mp', 'envase', 'tapa'].map(t => (
              <button key={t} onClick={() => setTipo(t)} /* solo cambia de pestaña; el borrador se conserva */
                style={{ ...S.seg, ...(tipo === t ? S.segActive : {}) }}>{TIPO_LABEL[t]}</button>
            ))}
          </div>
          <input list="ing-opts" value={d.sel} onChange={e => setD({ sel: e.target.value })}
            placeholder={tipo === 'mp' ? 'Materia prima…' : tipo === 'envase' ? 'Envase…' : 'Tapa…'} style={S.input} />
          {/* Lote + costo/kg OPCIONALES de la MP (jul 2026, pedido dueño). Solo MP.
              El costo/kg alimenta el promedio ponderado del costo del sistema. */}
          {tipo === 'mp' && (
            <input value={d.lote || ''} onChange={e => setD({ lote: e.target.value })} placeholder="Lote de la MP (opcional)" style={{ ...S.input, marginTop: 6 }} />
          )}
          {tipo === 'mp' && (
            <input type="number" inputMode="decimal" min="0" value={d.costoKg || ''} onChange={e => setD({ costoKg: e.target.value })} placeholder="Costo por kg de esta factura (opcional)" style={{ ...S.input, marginTop: 6 }} />
          )}
          <datalist id="ing-opts">
            {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </datalist>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" inputMode="decimal" min="0" value={d.cant} onChange={e => setD({ cant: e.target.value })}
              placeholder="Cantidad" style={{ ...S.input, flex: 2 }} />
            <input value={d.uni} onChange={e => setD({ uni: e.target.value })} placeholder="Unidad" style={{ ...S.input, flex: 1 }} />
            <button onClick={agregar} disabled={!d.sel || !(Number(d.cant) > 0)} style={{ ...S.addBtn, opacity: (!d.sel || !(Number(d.cant) > 0)) ? 0.5 : 1 }}>+ Agregar</button>
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
    /* Renglón OBLIGATORIO (pedido dueño jul 2026): quien registra captura QUÉ y
       CUÁNTO llegó → al revisar ya viene cargado y el admin SOLO aprueba (no
       recaptura). Sin línea el admin veía el editor vacío = confusión. */
    if (!lineas.length) return setErr('Agrega al menos un producto: qué llegó y cuánto (el admin solo lo aprueba)');
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

          <label style={S.lbl}>¿Qué llegó? * <span style={{ color: 'var(--lp-text-tertiary,#8a948f)', fontWeight: 400 }}>(producto y cantidad — así el admin solo aprueba)</span></label>
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

/* ─── Sheet: editar (admin) — corrige un ingreso ya registrado ─────────────────
   Pedido dueño (jul 2026): Emmanuel edita proveedor / # factura / monto / nota /
   PARTIDAS y —opcional— reemplaza la foto. Si el ingreso ya sumó al stock
   ('recibido'), el backend revierte lo anterior y aplica lo nuevo (ajuste neto). */
function EditSheet({ ing, catalogs, onClose, onSaved, isDesktop }) {
  const [proveedor, setProveedor] = useState(ing.proveedor || '');
  const [numFactura, setNumFactura] = useState(ing.numFactura || '');
  const [monto, setMonto] = useState(ing.monto != null ? String(ing.monto) : '');
  const [nota, setNota] = useState(ing.nota || '');
  const [facturaData, setFacturaData] = useState(null);   /* solo si SE CAMBIA */
  const [facturaPreview, setFacturaPreview] = useState(null);
  const [esPdf, setEsPdf] = useState(false);
  /* Pre-llena las partidas SIN el costo/kg previo: el promedio ponderado es
     forward-only, así que re-guardar una edición NO debe re-mezclar el costo.
     El costo solo se (re)aplica si el admin teclea uno nuevo en una partida. */
  const [lineas, setLineas] = useState(() => (ing.lineas || []).map(l => {
    const { costoKg, ...rest } = l;
    if (rest.nombre) rest.nombre = String(rest.nombre).replace(/\s·\s\$[\d.]+\/kg$/, '');
    return rest;
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const eraRecibido = ing.estado === 'recibido';

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
    if (!lineas.length) return setErr('Agrega al menos una partida (MP, envase o tapa)');
    setSaving(true);
    try {
      const payload = {
        proveedor: proveedor.trim(), numFactura: numFactura.trim(),
        monto: Number(monto) > 0 ? Number(monto) : null,
        nota: nota.trim(), lineas,
      };
      if (facturaData) payload.facturaBase64 = facturaData; /* solo si cambió la foto */
      const r = await api.editarIngreso(ing.id, payload);
      if (r && r.ok) onSaved(r.ingreso, r);
      else setErr((r && r.error) || 'No se pudo guardar');
    } catch (e2) {
      setErr(e2?.data?.error || e2?.message || 'No se pudo guardar los cambios');
    } finally { setSaving(false); }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.sheetHead}>
          <div style={{ fontSize: 17, fontWeight: 650 }}>Editar <span style={{ fontFamily: MONO, fontSize: 15 }}>{ing.folio}</span></div>
          <button onClick={onClose} style={S.x}>✕</button>
        </div>
        <div style={S.sheetBody}>
          {eraRecibido && (
            <div style={{ fontSize: 12.5, color: '#92610A', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '9px 11px', marginBottom: 4, lineHeight: 1.45 }}>
              Este ingreso ya sumó al stock. Si cambias las partidas, el inventario se
              ajusta solo: se revierte lo anterior y se aplica lo nuevo.
            </div>
          )}
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

          <label style={S.lbl}>Foto de la factura</label>
          {!facturaPreview && !esPdf && ing.facturaArchivo && (
            <a href={api.ingresoFacturaUrl(ing.id)} target="_blank" rel="noreferrer">
              <img src={api.ingresoFacturaUrl(ing.id)} alt="Factura actual" style={S.preview}
                onError={(e) => { e.target.style.display = 'none'; }} />
            </a>
          )}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" onChange={onFile} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current && fileRef.current.click()} style={S.fotoBtn}>
            <IconCam />{facturaData ? 'Cambiar foto' : 'Reemplazar factura (opcional)'}
          </button>
          {facturaPreview && <img src={facturaPreview} alt="Factura nueva" style={S.preview} />}
          {esPdf && <div style={S.pdfOk}>PDF nuevo adjunto ✓</div>}

          <label style={S.lbl}>¿Qué llegó? *</label>
          <LineasEditor lineas={lineas} setLineas={setLineas} {...catalogs} />

          <label style={S.lbl}>Nota</label>
          <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Observaciones…" style={{ ...S.input, resize: 'vertical' }} />

          {err && <div style={S.err}>{err}</div>}
        </div>
        <div style={{ ...S.sheetFoot, ...(isDesktop ? {} : S.sheetFootMobile) }}>
          <button onClick={onClose} disabled={saving} style={{ ...S.btnGhost, ...(isDesktop ? {} : S.btnMobileGhost) }}>Cancelar</button>
          <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, ...(isDesktop ? {} : S.btnMobilePrimary), opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Menú "⋯" de acciones de la tarjeta (admin): Ver factura · Editar · Eliminar
   ── Reemplaza los botones sueltos por un kebab que agrupa las 3 acciones. */
function AccionesMenu({ ing, onEditar, onEliminar, eliminando, isDesktop }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('touchstart', cerrar);
    return () => { document.removeEventListener('mousedown', cerrar); document.removeEventListener('touchstart', cerrar); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Más acciones" aria-haspopup="true" aria-expanded={open}
        style={{ ...S.kebabBtn, ...(isDesktop ? {} : { minHeight: 44, minWidth: 44 }) }}>
        <IconDots />
      </button>
      {open && (
        <div style={S.menu} role="menu">
          <a href={api.ingresoFacturaUrl(ing.id)} target="_blank" rel="noreferrer" role="menuitem"
            style={{ ...S.menuItem, color: BRAND }} onClick={() => setOpen(false)}>
            <IconDoc /> Ver factura
          </a>
          <button role="menuitem" style={S.menuItem} onClick={() => { setOpen(false); onEditar(); }}>
            <IconEdit /> Editar
          </button>
          <button role="menuitem" disabled={eliminando} style={{ ...S.menuItem, color: '#B91C1C', opacity: eliminando ? 0.6 : 1 }}
            onClick={() => { setOpen(false); onEliminar(); }}>
            <IconTrash /> {eliminando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      )}
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
  const [editar, setEditar] = useState(null); /* ingreso en edición (admin) */
  const [eliminando, setEliminando] = useState(null); /* id del ingreso que se está borrando */
  const [toast, setToast] = useState(null);
  const [catalogs, setCatalogs] = useState({ mpNames: [], envaseOpts: [], tapaOpts: [] });
  /* Handoff 1c: vista segmentada + acordeón por proveedor + filtro de historial */
  const [vista, setVista] = useState('recientes');       /* 'recientes' | 'proveedor' */
  const [expandido, setExpandido] = useState(null);      /* key del grupo abierto */
  const [filtroProveedor, setFiltroProveedor] = useState(null);

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
    let arr = items;
    if (filtroProveedor) arr = arr.filter(x => String(x.proveedor || '').trim().toLowerCase() === filtroProveedor.trim().toLowerCase());
    if (isAdmin && tab !== 'todos') arr = arr.filter(x => x.estado === tab);
    return arr;
  }, [items, tab, isAdmin, filtroProveedor]);

  const conteo = useMemo(() => {
    const c = { por_revisar: 0, recibido: 0, rechazado: 0 };
    items.forEach(x => { if (c[x.estado] != null) c[x.estado]++; });
    return c;
  }, [items]);

  /* Hero del handoff: cifras del MES en curso, derivadas de los ingresos reales. */
  const kpis = useMemo(() => {
    const hoy = new Date(); const y = hoy.getFullYear(), m = hoy.getMonth();
    const delMes = items.filter(x => { const d = new Date(x.fechaCreacion || ''); return !isNaN(d) && d.getFullYear() === y && d.getMonth() === m; });
    let materiales = 0;
    delMes.forEach(x => (Array.isArray(x.lineas) ? x.lineas : []).forEach(l => { materiales += Number(l.cantidad) || 0; }));
    return {
      ingresos: delMes.length,
      materiales: Math.round(materiales),
      proveedores: new Set(delMes.map(x => String(x.proveedor || '').trim().toLowerCase()).filter(Boolean)).size,
      mes: hoy.toLocaleDateString('es-MX', { month: 'long' }),
    };
  }, [items]);

  /* Agrupado por proveedor: total de ingresos + el ÚLTIMO (sus partidas y factura). */
  const grupos = useMemo(() => {
    const map = new Map();
    items.forEach(x => {
      const key = String(x.proveedor || '').trim().toLowerCase();
      if (!key) return;
      const g = map.get(key) || { key, nombre: String(x.proveedor).trim(), count: 0, ultimo: null, fechaUltima: '' };
      g.count++;
      const f = x.fechaCreacion || '';
      if (!g.ultimo || f > g.fechaUltima) { g.ultimo = x; g.fechaUltima = f; }
      map.set(key, g);
    });
    return [...map.values()].sort((a, b) => (b.fechaUltima || '').localeCompare(a.fechaUltima || ''));
  }, [items]);

  /* Eliminar ingreso (admin): confirma, avisa si REVIERTE inventario (estado
     'recibido'), llama el endpoint y recarga. Borra registro + foto + movimientos. */
  const eliminarIngreso = async (ing) => {
    const revierte = ing.estado === 'recibido';
    const msg = `¿Eliminar el ingreso ${ing.folio} de "${ing.proveedor}"?\n\n`
      + (revierte
        ? 'Ya fue aprobado: se RESTARÁ del inventario lo que sumó y se borrará todo rastro (registro, foto, movimientos). No se puede deshacer.'
        : 'Se borrará el registro y su foto. No se puede deshacer.');
    if (!window.confirm(msg)) return;
    setEliminando(ing.id);
    try {
      const r = await api.eliminarIngreso(ing.id);
      showToast(`${ing.folio} eliminado` + (r && r.reverts && r.reverts.length ? ` · revertido del stock (${r.reverts.length})` : ''));
      load();
    } catch (e) {
      showToast('No se pudo eliminar: ' + (e?.data?.error || e?.message || 'error'), true);
    } finally { setEliminando(null); }
  };

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

      {/* Hero del mes (handoff 1c). KPIs ACCIONABLES, no números muertos:
          ingresos → Recientes · materiales → Recientes · proveedores → Por proveedor */}
      <div style={S.hero}>
        <button onClick={() => { setVista('recientes'); setFiltroProveedor(null); }} style={S.kpiCell}>
          <div style={{ ...S.kpiNum, color: '#0F6E56' }}>{kpis.ingresos}</div>
          <div style={S.kpiLbl}>ingresos en {kpis.mes}</div>
        </button>
        <button onClick={() => { setVista('recientes'); setFiltroProveedor(null); }} style={{ ...S.kpiCell, borderLeft: '1px solid rgba(0,0,0,0.06)', borderRight: '1px solid rgba(0,0,0,0.06)', borderRadius: 0 }}>
          <div style={S.kpiNum}>{kpis.materiales}</div>
          <div style={S.kpiLbl}>materiales</div>
        </button>
        <button onClick={() => { setVista('proveedor'); setFiltroProveedor(null); }} style={S.kpiCell}>
          <div style={S.kpiNum}>{kpis.proveedores}</div>
          <div style={S.kpiLbl}>proveedores</div>
        </button>
      </div>

      {/* Segmentado Recientes | Por proveedor (handoff 1c) */}
      <div style={S.segmented}>
        {[['recientes', 'Recientes'], ['proveedor', 'Por proveedor']].map(([k, lbl]) => (
          <button key={k} onClick={() => setVista(k)} style={{ ...S.segmentedBtn, ...(vista === k ? S.segmentedActive : {}) }}>{lbl}</button>
        ))}
      </div>

      {isAdmin && vista === 'recientes' && (
        <div style={{ display: 'flex', gap: 6, margin: '12px 0 0', flexWrap: 'wrap' }}>
          {[
            ['por_revisar', `Por revisar${conteo.por_revisar ? ` (${conteo.por_revisar})` : ''}`],
            ['recibido', 'Recibidos'],
            ['rechazado', 'Rechazados'],
            ['todos', 'Todos'],
          ].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} style={{ ...S.tab, ...(isDesktop ? {} : { minHeight: 38, padding: '8px 16px' }), ...(tab === k ? S.tabActive : {}) }}>{lbl}</button>
          ))}
        </div>
      )}

      {/* Chip de filtro que deja "Historial completo": todos los ingresos de UN proveedor */}
      {vista === 'recientes' && filtroProveedor && (
        <div style={{ margin: '12px 0 0' }}>
          <button onClick={() => setFiltroProveedor(null)} style={S.filtroChip} aria-label={`Quitar filtro de ${filtroProveedor}`}>
            Proveedor: {filtroProveedor} <span aria-hidden="true" style={{ fontWeight: 500 }}>✕</span>
          </button>
        </div>
      )}

      {loading ? (
        <div style={S.empty}>Cargando…</div>
      ) : vista === 'proveedor' ? (
        grupos.length === 0 ? <Vacio isAdmin={isAdmin} isDesktop={isDesktop} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {grupos.map(g => {
              const t = tinte(g.nombre);
              const abierto = expandido === g.key;
              const ult = g.ultimo;
              const lineasUlt = ult && Array.isArray(ult.lineas) ? ult.lineas : [];
              return (
                <div key={g.key} style={S.grupoCard}>
                  {/* Header = acordeón (un grupo abierto a la vez, chevron 260ms) */}
                  <button onClick={() => setExpandido(abierto ? null : g.key)} style={S.grupoHead} aria-expanded={abierto}>
                    <span style={{ ...S.avatar, background: t.bg, color: t.fg }}>{iniciales(g.nombre)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.grupoNombre}>{g.nombre}</div>
                      <div style={S.grupoMeta}>{g.count} ingreso{g.count === 1 ? '' : 's'} · último {fechaRelativa(g.fechaUltima)}</div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b8a78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 260ms cubic-bezier(.22,1,.36,1)', flexShrink: 0 }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {abierto && (
                    <div style={S.grupoBody}>
                      {lineasUlt.length > 0 ? lineasUlt.map((l, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, color: 'var(--lp-text-secondary,#3d5a4a)' }}>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</span>
                          <span style={{ fontWeight: 500, color: 'var(--lp-text-primary,#0d2320)', whiteSpace: 'nowrap' }}>× {fmt(l.cantidad)}{l.unidad && l.unidad !== 'pz' ? ` ${l.unidad}` : ''}</span>
                        </div>
                      )) : (
                        <div style={{ fontSize: 13, color: 'var(--lp-text-tertiary,#6b8a78)' }}>El último ingreso no trae partidas registradas.</div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        {ult && (
                          <a href={api.ingresoFacturaUrl(ult.id)} target="_blank" rel="noreferrer" style={S.facturaPill}>
                            <IconDoc /> Ver factura
                          </a>
                        )}
                        <button onClick={() => { setFiltroProveedor(g.nombre); setVista('recientes'); }} style={S.histBtn}>
                          Historial completo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : filtrados.length === 0 ? (
        <Vacio isAdmin={isAdmin} isDesktop={isDesktop} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
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
                  {Number(ing.monto) > 0 && <div style={S.monto}>${fmt(ing.monto)}</div>}
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

                {ing.estado === 'recibido' && ing.revisadoPor && (
                  <div style={{ fontSize: 12.5, color: 'var(--lp-text-tertiary,#8a948f)', marginTop: 9 }}>Sumado al stock por {ing.revisadoPor}</div>
                )}
                {ing.estado === 'rechazado' && (
                  <div style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 9 }}>Rechazado{ing.notaRevision ? `: ${ing.notaRevision}` : ''}</div>
                )}

                {/* Acciones. Admin: la principal (Revisar, si aplica) queda visible y
                    Ver factura · Editar · Eliminar se agrupan en el menú "⋯".
                    No-admin (ve solo lo suyo): la liga simple a la factura. */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 11 }}>
                  {isAdmin ? (
                    <>
                      {ing.estado === 'por_revisar' && (
                        <button onClick={() => setRevisar(ing)} style={{ ...S.btnPrimary, ...(isDesktop ? {} : { minHeight: 44, padding: '10px 20px' }) }}>Revisar</button>
                      )}
                      <AccionesMenu ing={ing} isDesktop={isDesktop} eliminando={eliminando === ing.id}
                        onEditar={() => setEditar(ing)} onEliminar={() => eliminarIngreso(ing)} />
                    </>
                  ) : (
                    <a href={api.ingresoFacturaUrl(ing.id)} target="_blank" rel="noreferrer" style={S.verFacturaBtn}>
                      <IconDoc /> Ver factura
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB móvil: la acción principal SIEMPRE al alcance del pulgar, arriba
          del bottom-nav (misma convención de offset que Compras/Forecast). */}
      {!isDesktop && !crear && !revisar && (
        <button onClick={() => setCrear(true)} style={S.fab} aria-label="Nuevo ingreso">
          <IconPlus /> Nuevo ingreso
        </button>
      )}

      {crear && (
        <CrearSheet catalogs={catalogs} isDesktop={isDesktop} onClose={() => setCrear(false)}
          onSaved={(ing) => { setCrear(false); showToast(`Ingreso ${ing.folio} registrado · queda por revisar`); load(); }} />
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
      {editar && (
        <EditSheet ing={editar} catalogs={catalogs} isDesktop={isDesktop} onClose={() => setEditar(null)}
          onSaved={(ing, r) => {
            setEditar(null);
            const ajuste = r && ((r.reverts && r.reverts.length) || (r.mutaciones && r.mutaciones.length));
            showToast(`${ing.folio} actualizado` + (ajuste ? ' · stock ajustado' : ''));
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
  /* ── Handoff 1c: hero, segmentado y grupos por proveedor ────────────────── */
  hero: { margin: '14px 0 0', background: 'rgba(252,254,253,0.82)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.55)', borderRadius: 24, padding: '16px 6px', boxShadow: '0 8px 24px rgba(80,140,110,0.14)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center' },
  kpiCell: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit', color: 'inherit', minHeight: 56 },
  kpiNum: { fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--lp-text-primary,#0d2320)', lineHeight: 1.15 },
  kpiLbl: { fontSize: 11.5, color: 'var(--lp-text-tertiary,#6b8a78)', marginTop: 2 },
  segmented: { margin: '14px 0 0', background: 'rgba(0,0,0,0.04)', borderRadius: 99, padding: 4, display: 'grid', gridTemplateColumns: '1fr 1fr' },
  segmentedBtn: { textAlign: 'center', fontSize: 13, color: 'var(--lp-text-secondary,#3d5a4a)', padding: '8px 0', minHeight: 36, background: 'none', border: 'none', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 260ms cubic-bezier(.22,1,.36,1)' },
  segmentedActive: { fontWeight: 500, color: 'var(--lp-text-primary,#0d2320)', background: 'var(--lp-surface,#FEFEFE)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  grupoCard: { background: 'var(--lp-surface,#FEFEFE)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' },
  grupoHead: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', minHeight: 62, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'inherit' },
  avatar: { width: 34, height: 34, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, flexShrink: 0 },
  grupoNombre: { fontSize: 14.5, fontWeight: 500, color: 'var(--lp-text-primary,#0d2320)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  grupoMeta: { fontSize: 11.5, color: 'var(--lp-text-tertiary,#6b8a78)', marginTop: 1 },
  grupoBody: { borderTop: '1px solid rgba(0,0,0,0.04)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(29,158,117,0.04)' },
  facturaPill: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--lp-surface,#FEFEFE)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 99, padding: '8px 14px', minHeight: 36, fontSize: 12, fontWeight: 500, color: '#0F6E56', textDecoration: 'none', boxSizing: 'border-box' },
  histBtn: { background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, color: 'var(--lp-text-secondary,#3d5a4a)', cursor: 'pointer', padding: '8px 10px', minHeight: 36 },
  filtroChip: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(15,122,90,.08)', border: '1px solid rgba(15,122,90,.25)', borderRadius: 99, padding: '7px 14px', minHeight: 36, fontSize: 13, fontWeight: 500, color: BRAND, cursor: 'pointer', fontFamily: 'inherit' },
  /* Menú "⋯" de la tarjeta (admin): botón kebab + dropdown con las 3 acciones */
  kebabBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, border: '1px solid var(--lp-border,rgba(0,0,0,.12))', background: 'var(--lp-surface,#fff)', color: 'var(--lp-text-secondary,#5a6b63)', cursor: 'pointer', boxSizing: 'border-box' },
  menu: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 172, background: 'var(--lp-surface,#fff)', border: '1px solid var(--lp-border,rgba(0,0,0,.1))', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,.16)', padding: 6, zIndex: 60, display: 'flex', flexDirection: 'column', gap: 2 },
  menuItem: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', fontSize: 14, fontWeight: 500, color: 'var(--lp-text-primary,#16201c)', background: 'none', border: 'none', borderRadius: 8, padding: '10px 12px', minHeight: 42, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', boxSizing: 'border-box' },
};
