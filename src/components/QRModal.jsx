import { useState, useRef, useEffect } from 'react';
import { qrDataUrl } from '../lib/qrGenerator';

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(26,24,21,.5)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'auto', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)',
    maxWidth: 520, width: '100%',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 14, fontWeight: 700 },
  close: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: 22, color: 'var(--lp-text-tertiary)', padding: 4, lineHeight: 1,
  },
  body: { padding: 20 },
  qrPreview: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
    padding: 16, marginBottom: 16,
  },
  qrImg: {
    width: 200, height: 200,
    background: '#fff',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 6,
  },
  codigo: {
    fontFamily: 'var(--lp-font-mono)', fontSize: 13, fontWeight: 700,
    marginTop: 10, color: 'var(--lp-text-primary)',
    wordBreak: 'break-all', textAlign: 'center',
  },
  meta: {
    fontSize: 11, color: 'var(--lp-text-tertiary)',
    marginTop: 4, lineHeight: 1.5, textAlign: 'center',
  },
  field: { marginBottom: 12 },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--lp-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6,
  },
  rowControls: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12,
  },
  input: {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 13, fontFamily: 'var(--lp-font-mono)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    boxSizing: 'border-box', textAlign: 'right',
  },
  select: {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 13, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    boxSizing: 'border-box',
  },
  presetBar: {
    display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8,
  },
  preset: (active) => ({
    padding: '5px 10px', fontSize: 10, fontWeight: 600,
    borderRadius: 14, border: 'none', cursor: 'pointer',
    background: active ? 'var(--lp-brand-600)' : 'var(--lp-bg-sunken)',
    color: active ? '#fff' : 'var(--lp-text-secondary)',
    fontFamily: 'var(--lp-font-sans)',
  }),
  hint: {
    fontSize: 11, color: 'var(--lp-text-tertiary)', lineHeight: 1.6,
    padding: '8px 10px', background: 'var(--lp-info-50)',
    borderRadius: 'var(--lp-radius-sm)',
  },
  footer: {
    padding: '12px 16px', borderTop: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', gap: 8, justifyContent: 'flex-end',
  },
  btnPrimary: {
    padding: '8px 14px', fontSize: 12, fontWeight: 700,
    borderRadius: 'var(--lp-radius-sm)', border: 'none',
    background: 'var(--lp-brand-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
  },
  btnGhost: {
    padding: '8px 14px', fontSize: 12, fontWeight: 600,
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-raised)', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)',
  },
};

/* Tamaños comunes de etiquetas térmicas */
const FORMATOS = [
  { v: '50x40', label: '50×40 mm', wMm: 50, hMm: 40, qrMm: 22 },
  { v: '60x40', label: '60×40 mm', wMm: 60, hMm: 40, qrMm: 24 },
  { v: '80x50', label: '80×50 mm', wMm: 80, hMm: 50, qrMm: 30 },
  { v: '100x70', label: '100×70 mm', wMm: 100, hMm: 70, qrMm: 40 },
  { v: 'A4-21', label: 'Hoja A4 · 21 etiquetas (3×7)', wMm: 70, hMm: 42.3, qrMm: 22, isSheet: true, cols: 3, rows: 7 },
  { v: 'A4-24', label: 'Hoja A4 · 24 etiquetas (3×8)', wMm: 70, hMm: 37, qrMm: 20, isSheet: true, cols: 3, rows: 8 },
];

export default function QRModal({ lote, onClose }) {
  /* BUG FIX React #310: los useState DEBEN llamarse antes de cualquier early return.
     Si lote pasaba de null→objeto, React veía hooks nuevos → crash. */
  const cantidadDefault = Number(lote?.cantidad) || 1;
  const [copias, setCopias] = useState(cantidadDefault);
  const [formato, setFormato] = useState('50x40');
  if (!lote) return null;
  const codigo = lote.codigo || lote.codigoLote || lote.id;

  const fmt = FORMATOS.find(f => f.v === formato) || FORMATOS[0];

  const payload = JSON.stringify({
    t: 'perico-lote', cod: codigo,
    p: lote.producto || lote.nombre,
    cant: lote.cantidad, f: lote.fecha,
  });
  /* QR generado LOCAL (sin quickchart.io). Funciona offline, sin latencia,
     sin riesgo de CSP/bloqueo. */
  const qrUrlPreview = qrDataUrl(payload, { scale: 8, margin: 2, ecLevel: 'M' });
  const qrUrlPrint = qrDataUrl(payload, { scale: 10, margin: 2, ecLevel: 'M' });

  const imprimir = () => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) { alert('Habilita popups para imprimir'); return; }

    const producto = (lote.producto || lote.nombre || '').replace(/</g, '&lt;');
    const fecha = (lote.fecha || '').slice(0, 10);
    const n = Math.max(1, Math.min(999, parseInt(copias) || 1));

    /* Generar HTML según formato */
    let html = '';
    if (fmt.isSheet) {
      /* Hoja A4 con grid */
      const total = fmt.cols * fmt.rows;
      const totalPages = Math.ceil(n / total);
      let labels = '';
      for (let i = 0; i < n; i++) {
        labels += `<div class="cell">
          <img src="${qrUrlPrint}" />
          <div class="info">
            <div class="prod">${producto}</div>
            <div class="cod">${codigo}</div>
            <div class="meta">${fecha} · ${i + 1}/${n}</div>
          </div>
        </div>`;
        /* Filler para que el grid termine la página */
        if ((i + 1) % total === 0 && i + 1 < n) {
          labels += '<div class="page-break"></div>';
        }
      }
      html = `<!DOCTYPE html><html><head><title>QR ${codigo} (${n})</title>
        <style>
          @page { size: A4; margin: 5mm; }
          body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
          .grid {
            display: grid;
            grid-template-columns: repeat(${fmt.cols}, 1fr);
            gap: 0;
          }
          .cell {
            width: ${fmt.wMm}mm; height: ${fmt.hMm}mm;
            border: 0.3mm dashed #ccc;
            box-sizing: border-box; padding: 2mm;
            display: flex; align-items: center; gap: 2mm;
            page-break-inside: avoid;
          }
          .cell img { width: ${fmt.qrMm}mm; height: ${fmt.qrMm}mm; }
          .info { flex: 1; min-width: 0; font-size: 7pt; line-height: 1.2; }
          .prod { font-weight: bold; font-size: 8pt; margin-bottom: 1mm;
                  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .cod { font-family: monospace; font-weight: bold; font-size: 7pt; }
          .meta { color: #666; font-size: 6pt; margin-top: 1mm; }
          .page-break { break-after: page; flex-basis: 100%; }
          @media print { .cell { border: none; } }
        </style></head><body>
        <div class="grid">${labels}</div>
        <script>setTimeout(() => window.print(), 400);</script>
        </body></html>`;
    } else {
      /* Etiqueta individual (rollo térmico) */
      let labels = '';
      for (let i = 0; i < n; i++) {
        labels += `<div class="ticket">
          <img src="${qrUrlPrint}" />
          <div class="info">
            <div class="prod">${producto}</div>
            <div class="cod">${codigo}</div>
            <div class="meta">${fecha}${n > 1 ? ' · ' + (i + 1) + '/' + n : ''}</div>
          </div>
        </div>`;
      }
      html = `<!DOCTYPE html><html><head><title>QR ${codigo} (${n} ticket${n > 1 ? 's' : ''})</title>
        <style>
          @page { size: ${fmt.wMm}mm ${fmt.hMm}mm; margin: 0; }
          body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
          .ticket {
            width: ${fmt.wMm}mm; height: ${fmt.hMm}mm;
            box-sizing: border-box; padding: 2mm;
            display: flex; align-items: center; gap: 2mm;
            page-break-after: always;
          }
          .ticket:last-child { page-break-after: auto; }
          .ticket img { width: ${fmt.qrMm}mm; height: ${fmt.qrMm}mm; }
          .info { flex: 1; min-width: 0; line-height: 1.3; }
          .prod {
            font-weight: bold; font-size: 9pt;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            margin-bottom: 1mm;
          }
          .cod { font-family: monospace; font-weight: bold; font-size: 8pt; }
          .meta { color: #666; font-size: 6pt; margin-top: 1mm; }
        </style></head><body>
        ${labels}
        <script>setTimeout(() => window.print(), 400);</script>
        </body></html>`;
    }
    w.document.write(html);
    w.document.close();
  };

  const setPreset = (n) => setCopias(n);

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.header}>
          <div style={S.title}>QR de lote · imprimir tickets</div>
          <button style={S.close} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.body}>
          <div style={S.qrPreview}>
            <img src={qrUrlPreview} alt={`QR ${codigo}`} style={S.qrImg} />
            <div style={S.codigo}>{codigo}</div>
            <div style={S.meta}>
              {lote.producto || lote.nombre}<br/>
              {lote.cantidad ? lote.cantidad + ' cubetas · ' : ''}{(lote.fecha || '').slice(0, 10)}
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>Cantidad de tickets a imprimir</label>
            <div style={S.presetBar}>
              {[1, cantidadDefault, 10, 50, 100].filter((n, i, a) => n > 0 && a.indexOf(n) === i).map(n => (
                <button key={n} type="button" style={S.preset(copias === n)} onClick={() => setPreset(n)}>
                  {n === cantidadDefault ? `${n} (lote)` : n}
                </button>
              ))}
            </div>
            <input
              style={S.input}
              type="number"
              min="1"
              max="999"
              value={copias}
              onChange={(e) => setCopias(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))}
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Formato de etiqueta</label>
            <select style={S.select} value={formato} onChange={(e) => setFormato(e.target.value)}>
              <optgroup label="Rollo térmico (impresora etiquetas)">
                {FORMATOS.filter(f => !f.isSheet).map(f => (
                  <option key={f.v} value={f.v}>{f.label}</option>
                ))}
              </optgroup>
              <optgroup label="Hoja A4 (impresora oficina)">
                {FORMATOS.filter(f => f.isSheet).map(f => (
                  <option key={f.v} value={f.v}>{f.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div style={S.hint}>
            Es <strong>un solo QR</strong> que identifica este lote. Imprimes {copias} tickets idénticos para etiquetar las {copias} unidades del lote. Al escanear cualquier ticket, se identifica el lote completo.
          </div>
        </div>
        <div style={S.footer}>
          <button style={S.btnGhost} onClick={onClose}>Cerrar</button>
          <button style={S.btnPrimary} onClick={imprimir}>
            Imprimir {copias} ticket{copias > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────── QR SCANNER (cámara o entrada manual) ────── */

const SS = {
  overlay: S.overlay,
  modal: { ...S.modal, maxWidth: 460 },
  header: S.header,
  title: S.title,
  close: S.close,
  body: { padding: 20, textAlign: 'center' },
  video: {
    width: '100%', maxWidth: 380, height: 280,
    background: '#000', borderRadius: 'var(--lp-radius-sm)',
    objectFit: 'cover',
  },
  err: {
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    padding: 10, borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12, marginTop: 12, textAlign: 'left',
  },
  manualLabel: {
    fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 14, textAlign: 'left',
  },
  manual: {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 13, fontFamily: 'var(--lp-font-mono)',
    background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)',
    boxSizing: 'border-box', marginTop: 6,
  },
  footer: S.footer,
  btnPrimary: S.btnPrimary,
  btnGhost: S.btnGhost,
};

/* ══════════════════════════════════════════════════════════════════
   QRScanner — escáner con detección automática del path óptimo:
     1) BarcodeDetector nativo (Chrome/Edge/Android, performance ideal)
     2) jsQR sobre canvas + getUserMedia (Safari iOS/macOS, Firefox)
     3) Entrada manual (último recurso, en cualquier navegador)
   El usuario no ve la diferencia — el componente elige el path por sí solo.
   ══════════════════════════════════════════════════════════════════ */
export function QRScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const jsqrModuleRef = useRef(null);
  const animFrameRef = useRef(null);
  const cancelledRef = useRef(false);
  const [err, setErr] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [pathLabel, setPathLabel] = useState(''); /* 'nativo' | 'jsQR' */
  const [manual, setManual] = useState('');

  const handleResult = (raw) => {
    let parsed;
    try {
      const obj = JSON.parse(raw);
      if (obj && obj.t === 'perico-lote') parsed = obj;
    } catch {
      parsed = { cod: raw };
    }
    onResult && onResult(parsed || { cod: raw, raw });
  };

  useEffect(() => {
    cancelledRef.current = false;

    function cleanup() {
      cancelledRef.current = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (streamRef.current) {
        try { streamRef.current.getTracks().forEach(t => t.stop()); } catch {}
        streamRef.current = null;
      }
    }

    async function abrirCamara() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelledRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return null;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          /* iOS Safari NECESITA estos atributos para reproducir inline + autoplay */
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          videoRef.current.muted = true;
          await videoRef.current.play();
        }
        setCameraActive(true);
        return stream;
      } catch (e) {
        setErr('No se pudo abrir cámara: ' + (e?.message || 'permiso denegado'));
        return null;
      }
    }

    /* Path 1: BarcodeDetector nativo */
    function startNativeLoop() {
      function tick() {
        if (cancelledRef.current || !videoRef.current || !detectorRef.current) return;
        detectorRef.current.detect(videoRef.current)
          .then(barcodes => {
            if (cancelledRef.current) return;
            if (barcodes && barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              cleanup();
              handleResult(code);
              return;
            }
            animFrameRef.current = requestAnimationFrame(tick);
          })
          .catch(() => {
            if (!cancelledRef.current) animFrameRef.current = requestAnimationFrame(tick);
          });
      }
      tick();
    }

    /* Path 2: jsQR sobre canvas (Safari/Firefox) */
    function startJsqrLoop() {
      const jsQR = jsqrModuleRef.current;
      if (!jsQR) return;
      /* Throttle: jsQR procesa frames pesados, 4 fps es suficiente */
      let lastTs = 0;
      const THROTTLE_MS = 240;
      function tick(ts) {
        if (cancelledRef.current) return;
        if (!ts || ts - lastTs >= THROTTLE_MS) {
          lastTs = ts || performance.now();
          try {
            const v = videoRef.current;
            const c = canvasRef.current;
            if (v && c && v.readyState >= 2 /* HAVE_CURRENT_DATA */ && v.videoWidth > 0) {
              const W = v.videoWidth;
              const H = v.videoHeight;
              /* Reducir tamaño del canvas si el video es muy grande — más rápido */
              const SCALE = W > 640 ? 640 / W : 1;
              const cw = Math.round(W * SCALE);
              const ch = Math.round(H * SCALE);
              if (c.width !== cw) c.width = cw;
              if (c.height !== ch) c.height = ch;
              const ctx = c.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(v, 0, 0, cw, ch);
              const img = ctx.getImageData(0, 0, cw, ch);
              const result = jsQR(img.data, img.width, img.height, {
                inversionAttempts: 'dontInvert',
              });
              if (result && result.data) {
                cleanup();
                handleResult(result.data);
                return;
              }
            }
          } catch {
            /* ignorar errores transitorios y seguir scanneando */
          }
        }
        animFrameRef.current = requestAnimationFrame(tick);
      }
      animFrameRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      /* ¿Hay BarcodeDetector? Algunos Chrome/Edge en escritorio lo exponen
         pero fallan con QR — confirmamos que soporta 'qr_code' antes. */
      let usarNativo = false;
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const formatos = await window.BarcodeDetector.getSupportedFormats?.();
          if (!formatos || formatos.includes('qr_code')) {
            detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
            usarNativo = true;
          }
        } catch {}
      }

      if (usarNativo) {
        setPathLabel('nativo');
        const stream = await abrirCamara();
        if (!stream) return;
        startNativeLoop();
        return;
      }

      /* Path 2: cargar jsQR dinámicamente (queda en chunk separado) */
      try {
        const mod = await import('jsqr');
        jsqrModuleRef.current = mod.default || mod;
      } catch (e) {
        setErr('No se pudo cargar el lector de QR. Ingresa el código manualmente abajo.');
        return;
      }
      setPathLabel('jsQR');
      const stream = await abrirCamara();
      if (!stream) return;
      startJsqrLoop();
    }

    start();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitManual = () => {
    if (!manual.trim()) return;
    handleResult(manual.trim());
  };

  return (
    <div style={SS.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={SS.modal}>
        <div style={SS.header}>
          <div style={SS.title}>Escanear QR de lote</div>
          <button style={SS.close} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={SS.body}>
          {/* Video siempre montado para que el ref esté listo cuando arranque el path */}
          <video
            ref={videoRef}
            style={{ ...SS.video, display: cameraActive ? 'block' : 'none' }}
            playsInline
            muted
            autoPlay
          />
          {/* Canvas oculto solo para path jsQR */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {!cameraActive && !err && (
            <div style={{ padding: 20, color: 'var(--lp-text-tertiary)', fontSize: 12 }}>
              Solicitando acceso a la cámara…
            </div>
          )}
          {err && <div style={SS.err}>{err}</div>}
          {cameraActive && pathLabel && (
            <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 8, textAlign: 'center' }}>
              Apunta el QR dentro del recuadro · motor: {pathLabel}
            </div>
          )}
          <div style={SS.manualLabel}>O ingresa el código manualmente:</div>
          <input
            style={SS.manual}
            placeholder="Ej: LP-2026-001-A"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitManual(); }}
          />
        </div>
        <div style={SS.footer}>
          <button style={SS.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={SS.btnPrimary} onClick={submitManual} disabled={!manual.trim()}>
            Usar código manual
          </button>
        </div>
      </div>
    </div>
  );
}
