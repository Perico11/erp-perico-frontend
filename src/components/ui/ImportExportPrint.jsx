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
      setMsg('✓ Importado: ' + (data.cambios || data.total || 'OK'));
      if (onImported) onImported(data);
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
            <span aria-hidden="true">📥</span> {busy ? 'Subiendo…' : importLabel}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                 onChange={handleFileChange} style={S.hidden} />
        </>
      )}
      {canExport && (
        <button type="button" style={S.btn('ghost')} onClick={handleExport}
                title="Descargar Excel">
          <span aria-hidden="true">📤</span> Exportar
        </button>
      )}
      {canPrint && (
        <button type="button" style={S.btn('ghost')} onClick={handlePrint}
                title="Abrir hoja imprimible">
          <span aria-hidden="true">🖨️</span> Imprimir
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
