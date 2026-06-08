/* ════════════════════════════════════════════════════════════════════════════
   ImportExportPrint — Toolbar reusable para Importar / Exportar / Imprimir.
   Usado en Inventario (MP / PT / Envases) y Conteo Físico (sesión + historial).

   Props:
     - exportUrl: string | () => string   URL del backend para descargar Excel
     - printUrl:  string | () => string   URL del backend para abrir hoja imprimible
     - importEndpoint: string             POST endpoint para subir Excel (opcional)
     - importLabel: string                Label opcional del botón importar
     - onImported: () => void             Callback tras importar exitosamente
     - permisos: { import?:bool, export?:bool, print?:bool }
     - size: 'sm' | 'md'                  Default 'md'
   ════════════════════════════════════════════════════════════════════════════ */
import { useState, useRef } from 'react';

/* Íconos SVG line (reemplazan 📥 / 📤 / 🖨️). stroke="currentColor" → heredan el color del botón. */
const ICON_BASE = {
  width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true, style: { flexShrink: 0 },
};
function IconDownload() {
  return (
    <svg {...ICON_BASE}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg {...ICON_BASE}>
      <path d="M12 17V5" />
      <path d="M7 10l5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}
function IconPrinter() {
  return (
    <svg {...ICON_BASE}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </svg>
  );
}

const S = {
  bar: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  btn: (variant) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', fontSize: 12, fontWeight: 600,
    borderRadius: 'var(--lp-radius-sm)',
    border: variant === 'ghost' ? '1.5px solid var(--lp-border-subtle)' : 'none',
    background: variant === 'primary' ? 'var(--lp-brand-600)' : 'var(--lp-bg-raised)',
    color: variant === 'primary' ? '#fff' : 'var(--lp-text-primary)',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
    transition: 'background .12s, transform .12s',
    minHeight: 36, whiteSpace: 'nowrap',
  }),
  hidden: { display: 'none' },
};

export default function ImportExportPrint({
  exportUrl, printUrl, importEndpoint, importLabel = 'Importar Excel',
  onImported, permisos = {}, size = 'md',
}) {
  const canImport = permisos.import !== false && !!importEndpoint;
  const canExport = permisos.export !== false && !!exportUrl;
  const canPrint = permisos.print !== false && !!printUrl;
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const resolveUrl = (u) => (typeof u === 'function' ? u() : u);

  const handleExport = () => {
    const url = resolveUrl(exportUrl);
    if (!url) return;
    /* Descarga en mismo tab para no perder permisos del navegador.
       El backend marca Content-Disposition: attachment → browser descarga. */
    window.location.href = url;
  };

  const handlePrint = () => {
    const url = resolveUrl(printUrl);
    if (!url) return;
    /* Abre en pestaña nueva — el HTML servidor incluye botón Imprimir + window.print() */
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleImportClick = () => {
    if (fileRef.current) fileRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!importEndpoint) return;
    setBusy(true);
    setMsg('');
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const token = sessionStorage.getItem('pp_token') || '';
      const res = await fetch(importEndpoint, {
        method: 'POST',
        headers: token ? { 'x-session-token': token } : {},
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (data.importId && onImported) {
        /* Flujo 2 pasos: NO aplicar todavía. El padre abre el modal de revisión
           (válidos / advertencias / errores) y confirma. Sin mensaje de éxito aquí. */
        onImported(data);
      } else {
        setMsg('✓ Importado: ' + (data.cambios || data.total || 'OK'));
        if (onImported) onImported(data);
      }
    } catch (err) {
      setMsg('✕ ' + (err.message || 'Error al importar'));
    } finally {
      setBusy(false);
      e.target.value = '';
      setTimeout(() => setMsg(''), 4000);
    }
  };

  if (!canImport && !canExport && !canPrint) return null;

  return (
    <div style={S.bar} role="toolbar" aria-label="Importar exportar imprimir">
      {canImport && (
        <>
          <button type="button" style={S.btn('ghost')} onClick={handleImportClick} disabled={busy}
                  title="Subir archivo Excel">
            <IconUpload /> {busy ? 'Subiendo…' : importLabel}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                 onChange={handleFileChange} style={S.hidden} />
        </>
      )}
      {canExport && (
        <button type="button" style={S.btn('ghost')} onClick={handleExport}
                title="Descargar Excel">
          <IconDownload /> Exportar
        </button>
      )}
      {canPrint && (
        <button type="button" style={S.btn('ghost')} onClick={handlePrint}
                title="Abrir hoja imprimible">
          <IconPrinter /> Imprimir
        </button>
      )}
      {msg && (
        <span style={{ fontSize: 11, color: msg.startsWith('✓') ? 'var(--lp-success-700)' : 'var(--lp-danger-700)', marginLeft: 6 }}>
          {msg}
        </span>
      )}
    </div>
  );
}
