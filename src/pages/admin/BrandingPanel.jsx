/* ═══════════════════════════════════════════════════════════════════════
   BrandingPanel — Configuración visual del ERP (estilo Notion)
   Sidebar de categorías + main con controles + preview vivo + autoguardado.
   ═══════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import useConfirm from '../../hooks/useConfirm';

const FONTS = [
  { v: 'DM Sans',     lbl: 'DM Sans',     sample: 'Aa' },
  { v: 'Inter',       lbl: 'Inter',       sample: 'Aa' },
  { v: 'Roboto',      lbl: 'Roboto',      sample: 'Aa' },
  { v: 'Lato',        lbl: 'Lato',        sample: 'Aa' },
  { v: 'Open Sans',   lbl: 'Open Sans',   sample: 'Aa' },
  { v: 'Poppins',     lbl: 'Poppins',     sample: 'Aa' },
  { v: 'Nunito',      lbl: 'Nunito',      sample: 'Aa' },
  { v: 'Montserrat',  lbl: 'Montserrat',  sample: 'Aa' },
  { v: 'system-ui',   lbl: 'Sistema',     sample: 'Aa' },
];

const LOGOS_DISPONIBLES = [
  { key: '/logos/el-perico-horizontal.png',  label: 'Horizontal' },
  { key: '/logos/el-perico-icono.png',       label: 'Ícono PNG' },
  { key: '/logos/el-perico-icono.svg',       label: 'Ícono SVG' },
  { key: '/logos/el-perico.png',             label: 'Full' },
  { key: '/logos/astra-cover.png',           label: 'Astra Cover' },
  { key: '/logos/Logo blanco.png',           label: 'Logo Blanco' },
  { key: '/logos/Logo negro.png',            label: 'Logo Negro' },
];

const COLORES_RAPIDOS = [
  { v: '#1D9E75', n: 'Verde Perico' },
  { v: '#2563EB', n: 'Azul' },
  { v: '#DC2626', n: 'Rojo' },
  { v: '#059669', n: 'Verde' },
  { v: '#D97706', n: 'Ámbar' },
  { v: '#7C3AED', n: 'Morado' },
  { v: '#DB2777', n: 'Rosa' },
  { v: '#0EA5E9', n: 'Cian' },
  { v: '#1F2937', n: 'Negro' },
];

const SECTIONS = [
  { id: 'colores',    label: 'Colores',    icon: '●' },
  { id: 'tipografia', label: 'Tipografía', icon: 'Aa' },
  { id: 'forma',      label: 'Forma',      icon: '◆' },
  { id: 'logos',      label: 'Logos',      icon: '▣' },
  { id: 'identidad',  label: 'Identidad',  icon: '✦' },
];

/* === Aplica los tokens al :root (preview en vivo) === */
function applyTokens(data) {
  if (!data) return;
  const root = document.documentElement;
  if (data.brandColor)     root.style.setProperty('--lp-brand-600', data.brandColor);
  if (data.brandColorDark) root.style.setProperty('--lp-brand-700', data.brandColorDark);
  if (data.fontFamily) {
    const stack = `'${data.fontFamily}', system-ui, -apple-system, sans-serif`;
    root.style.setProperty('--lp-font-sans', stack);
  }
  if (data.fontSizeBase) root.style.fontSize = `${data.fontSizeBase}px`;
  if (data.radiusBase !== undefined) {
    root.style.setProperty('--lp-radius', `${data.radiusBase + 4}px`);
    root.style.setProperty('--lp-radius-sm', `${Math.max(2, data.radiusBase - 2)}px`);
  }
}

/* === Auto-calcular color "dark" (10% más oscuro) === */
function darken(hex, amount = 0.12) {
  try {
    const h = hex.replace('#', '');
    const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
    r = Math.max(0, Math.floor(r * (1 - amount)));
    g = Math.max(0, Math.floor(g * (1 - amount)));
    b = Math.max(0, Math.floor(b * (1 - amount)));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
  } catch { return hex; }
}

/* === Estilos === */
const S = {
  wrap: { padding: '8px 0' },

  /* Estado de guardado (arriba) */
  saveBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', marginBottom: 16,
    background: 'var(--lp-bg-sunken)',
    borderRadius: 'var(--lp-radius-sm)',
    border: '1px solid var(--lp-border-subtle)',
  },
  saveText: { fontSize: 12, color: 'var(--lp-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 },
  resetBtn: {
    background: 'transparent', border: '1px solid var(--lp-border-subtle)',
    color: 'var(--lp-text-secondary)', padding: '5px 10px', borderRadius: 6,
    fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
  },

  /* Layout 2 columnas */
  layout: {
    display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16,
    alignItems: 'start',
  },

  /* Sidebar */
  sidebar: {
    display: 'flex', flexDirection: 'column', gap: 2,
    position: 'sticky', top: 0,
  },
  navItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 8,
    background: active ? 'var(--lp-brand-50, #EFF6FF)' : 'transparent',
    color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-primary)',
    border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
    fontSize: 13, fontWeight: active ? 600 : 500,
    fontFamily: 'inherit',
    transition: 'background .12s ease',
  }),
  navIcon: {
    width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700,
  },

  /* Main area */
  main: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    padding: 18,
    minHeight: 480,
  },
  sectionTitle: {
    fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12, color: 'var(--lp-text-tertiary)', marginBottom: 18,
  },

  /* Controles */
  field: { marginBottom: 18 },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
  },
  input: {
    width: '100%', padding: '9px 12px', fontSize: 13,
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)',
    fontFamily: 'inherit', background: 'var(--lp-bg-raised)',
    boxSizing: 'border-box', minHeight: 38,
  },
  colorChips: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  colorChip: (color, selected) => ({
    width: 36, height: 36, borderRadius: '50%',
    background: color, cursor: 'pointer',
    border: selected ? '2.5px solid #fff' : '2px solid transparent',
    boxShadow: selected ? `0 0 0 2.5px ${color}` : 'inset 0 0 0 1px rgba(0,0,0,.1)',
    transition: 'transform .1s ease',
  }),
  customColor: {
    display: 'flex', alignItems: 'center', gap: 10, marginTop: 4,
  },
  picker: {
    width: 40, height: 38, border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)', cursor: 'pointer', padding: 0,
  },
  hexInput: {
    flex: 1, maxWidth: 130, padding: '8px 10px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontFamily: 'monospace', fontSize: 13, textTransform: 'uppercase',
    minHeight: 38, boxSizing: 'border-box',
  },

  /* Fuente: grid de cards */
  fontGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 },
  fontCard: (active) => ({
    background: 'var(--lp-bg-raised)',
    border: active ? '2px solid var(--lp-brand-600)' : '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)', padding: '12px 10px',
    cursor: 'pointer', textAlign: 'center',
  }),
  fontSample: { fontSize: 26, fontWeight: 700, marginBottom: 4, color: 'var(--lp-text-primary)' },
  fontName: { fontSize: 11, color: 'var(--lp-text-secondary)', fontWeight: 500 },

  /* Slider con valor inline */
  sliderRow: { display: 'flex', alignItems: 'center', gap: 12 },
  sliderValue: {
    minWidth: 50, padding: '4px 8px',
    background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
    fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
    color: 'var(--lp-brand-700)', textAlign: 'center',
  },

  /* Logos grid */
  logoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 },
  logoCard: (active) => ({
    background: 'var(--lp-bg-raised)',
    border: active ? '2px solid var(--lp-brand-600)' : '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)', padding: 8, cursor: 'pointer',
    textAlign: 'center',
  }),
  logoImg: { width: '100%', height: 50, objectFit: 'contain', marginBottom: 4 },
  logoLabel: { fontSize: 10, color: 'var(--lp-text-tertiary)', fontWeight: 500 },

  /* Preview vivo (bottom de main) */
  preview: {
    marginTop: 22, padding: 16,
    background: 'var(--lp-bg-sunken)',
    borderRadius: 'var(--lp-radius)',
    border: '1.5px dashed var(--lp-border-subtle)',
  },
  previewLabel: {
    fontSize: 10, color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700,
    marginBottom: 10,
  },
  previewTopbar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: 10, background: 'var(--lp-bg-raised)', borderRadius: 6,
    border: '1.5px solid var(--lp-border-subtle)', marginBottom: 10,
  },
  previewKPI: (color) => ({
    background: 'var(--lp-bg-raised)', borderTop: `3px solid ${color}`,
    borderRadius: 6, padding: '10px 12px',
    border: '1.5px solid var(--lp-border-subtle)', borderTopWidth: 3,
    marginBottom: 10,
  }),
  previewBtnPrimary: (color) => ({
    background: color, color: '#fff', border: 'none',
    padding: '9px 18px', borderRadius: 'var(--lp-radius-sm)',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  }),
  previewBtnSecondary: {
    background: 'transparent', color: 'var(--lp-text-primary)',
    border: '1.5px solid var(--lp-border-subtle)',
    padding: '9px 18px', borderRadius: 'var(--lp-radius-sm)',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};

export default function BrandingPanel() {
  const [activeSection, setActiveSection] = useState('colores');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle'); /* idle | typing | saving | saved | error */
  const saveTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const [confirmFn, ConfirmEl] = useConfirm();

  /* Cargar config inicial */
  useEffect(() => {
    api.get('/api/branding').then(r => {
      if (r?.data) {
        setConfig(r.data);
        setLoading(false);
      }
    }).catch(() => setLoading(false));
    return () => { mountedRef.current = false; };
  }, []);

  /* Autoguardar con debounce de 700ms */
  const scheduleAutoSave = useCallback((nextConfig) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('typing');
    saveTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      setSaveStatus('saving');
      try {
        const r = await api.post('/api/branding', nextConfig);
        if (!mountedRef.current) return;
        if (r?.ok) {
          setSaveStatus('saved');
          window.dispatchEvent(new CustomEvent('branding-updated', { detail: nextConfig }));
          setTimeout(() => mountedRef.current && setSaveStatus('idle'), 1800);
        } else {
          setSaveStatus('error');
        }
      } catch {
        if (mountedRef.current) setSaveStatus('error');
      }
    }, 700);
  }, []);

  const updateField = useCallback((field, value) => {
    setConfig(prev => {
      const next = { ...prev, [field]: value };
      /* Si cambia el color primario, autocalcula el dark */
      if (field === 'brandColor') {
        next.brandColorDark = darken(value, 0.12);
      }
      applyTokens(next);
      scheduleAutoSave(next);
      return next;
    });
  }, [scheduleAutoSave]);

  const handleReset = async () => {
    const ok = await confirmFn('¿Restaurar todos los valores predeterminados? Se perderán los logos y colores personalizados.', {
      title: 'Restaurar branding',
      confirmText: 'Restaurar',
      danger: true,
    });
    if (!ok) return;
    setSaveStatus('saving');
    try {
      const r = await api.post('/api/branding/reset', {});
      if (r?.ok && r.data) {
        setConfig(r.data);
        applyTokens(r.data);
        setSaveStatus('saved');
        window.dispatchEvent(new CustomEvent('branding-updated', { detail: r.data }));
        setTimeout(() => mountedRef.current && setSaveStatus('idle'), 1800);
      }
    } catch { setSaveStatus('error'); }
  };

  /* Cleanup timer al desmontar */
  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  if (loading || !config) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div className="lp-spinner" />
      </div>
    );
  }

  const statusText = {
    idle:   { txt: 'Tus cambios se guardan automáticamente.', color: 'var(--lp-text-tertiary)' },
    typing: { txt: 'Escribiendo…', color: 'var(--lp-text-tertiary)' },
    saving: { txt: 'Guardando…', color: 'var(--lp-warning-600)' },
    saved:  { txt: '✓ Cambios guardados', color: 'var(--lp-success-600)' },
    error:  { txt: '✕ Error al guardar — verifica conexión', color: 'var(--lp-danger-600)' },
  }[saveStatus];

  return (
    <div style={S.wrap}>
      {/* === Estado de guardado === */}
      <div style={S.saveBar}>
        <div style={{ ...S.saveText, color: statusText.color }}>
          {statusText.txt}
        </div>
        <button onClick={handleReset} style={S.resetBtn}>
          Restaurar predeterminados
        </button>
      </div>

      {/* === Layout 2 columnas === */}
      <div style={S.layout} className="branding-layout">
        {/* === Sidebar === */}
        <nav style={S.sidebar}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              style={S.navItem(s.id === activeSection)}
              onClick={() => setActiveSection(s.id)}
            >
              <span style={S.navIcon}>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        {/* === Main === */}
        <div style={S.main}>
          {/* COLORES */}
          {activeSection === 'colores' && (
            <>
              <div style={S.sectionTitle}>Colores</div>
              <div style={S.sectionDesc}>Marca y acento principal del sistema.</div>

              <div style={S.field}>
                <label style={S.label}>Color rápido</label>
                <div style={S.colorChips}>
                  {COLORES_RAPIDOS.map(c => (
                    <div
                      key={c.v}
                      title={c.n}
                      style={S.colorChip(c.v, config.brandColor?.toUpperCase() === c.v)}
                      onClick={() => updateField('brandColor', c.v)}
                    />
                  ))}
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>O elige uno exacto</label>
                <div style={S.customColor}>
                  <input
                    type="color"
                    style={S.picker}
                    value={config.brandColor || '#1D9E75'}
                    onChange={e => updateField('brandColor', e.target.value.toUpperCase())}
                  />
                  <input
                    type="text"
                    style={S.hexInput}
                    value={config.brandColor || ''}
                    onChange={e => updateField('brandColor', e.target.value)}
                    placeholder="#1D9E75"
                  />
                  <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                    Dark auto: <code style={{ color: 'var(--lp-text-secondary)' }}>{config.brandColorDark}</code>
                  </span>
                </div>
              </div>
            </>
          )}

          {/* TIPOGRAFÍA */}
          {activeSection === 'tipografia' && (
            <>
              <div style={S.sectionTitle}>Tipografía</div>
              <div style={S.sectionDesc}>Familia y tamaño base de texto.</div>

              <div style={S.field}>
                <label style={S.label}>Fuente</label>
                <div style={S.fontGrid}>
                  {FONTS.map(f => (
                    <div
                      key={f.v}
                      style={S.fontCard(f.v === config.fontFamily)}
                      onClick={() => updateField('fontFamily', f.v)}
                    >
                      <div style={{ ...S.fontSample, fontFamily: `'${f.v}', system-ui, sans-serif` }}>
                        {f.sample}
                      </div>
                      <div style={S.fontName}>{f.lbl}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Tamaño base</label>
                <div style={S.sliderRow}>
                  <input
                    type="range" min="11" max="18" step="1"
                    value={config.fontSizeBase || 14}
                    onChange={e => updateField('fontSizeBase', Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={S.sliderValue}>{config.fontSizeBase || 14}px</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 6 }}>
                  Afecta todo el texto. Usuarios mayores o pantallas pequeñas: 15-16px. Pantallas grandes: 13-14px.
                </p>
              </div>
            </>
          )}

          {/* FORMA */}
          {activeSection === 'forma' && (
            <>
              <div style={S.sectionTitle}>Forma</div>
              <div style={S.sectionDesc}>Bordes redondeados de tarjetas, botones e inputs.</div>

              <div style={S.field}>
                <label style={S.label}>Radio de bordes</label>
                <div style={S.sliderRow}>
                  <input
                    type="range" min="0" max="22" step="1"
                    value={config.radiusBase ?? 10}
                    onChange={e => updateField('radiusBase', Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={S.sliderValue}>{config.radiusBase ?? 10}px</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 6 }}>
                  0px = corners cuadrados (estilo industrial). 14-22px = look moderno tipo iOS.
                </p>
              </div>
            </>
          )}

          {/* LOGOS */}
          {activeSection === 'logos' && (
            <>
              <div style={S.sectionTitle}>Logos</div>
              <div style={S.sectionDesc}>Imagen que aparece en el header y el favicon.</div>

              <div style={S.field}>
                <label style={S.label}>Logo principal (Topbar)</label>
                <div style={S.logoGrid}>
                  {LOGOS_DISPONIBLES.map(l => (
                    <div
                      key={l.key + '_main'}
                      style={S.logoCard(config.logoMain === l.key)}
                      onClick={() => updateField('logoMain', l.key)}
                    >
                      <img src={l.key} alt="" style={S.logoImg} onError={e => { e.target.style.display = 'none'; }} />
                      <div style={S.logoLabel}>{l.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Ícono (favicon y PWA)</label>
                <div style={S.logoGrid}>
                  {LOGOS_DISPONIBLES.map(l => (
                    <div
                      key={l.key + '_icon'}
                      style={S.logoCard(config.logoIcon === l.key)}
                      onClick={() => updateField('logoIcon', l.key)}
                    >
                      <img src={l.key} alt="" style={S.logoImg} onError={e => { e.target.style.display = 'none'; }} />
                      <div style={S.logoLabel}>{l.label}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 8 }}>
                  Para subir un logo nuevo: colócalo en <code>frontend/public/logos/</code> y aparecerá aquí tras el siguiente deploy.
                </p>
              </div>
            </>
          )}

          {/* IDENTIDAD */}
          {activeSection === 'identidad' && (
            <>
              <div style={S.sectionTitle}>Identidad</div>
              <div style={S.sectionDesc}>Nombre que aparece en el navegador y al instalar la PWA.</div>

              <div style={S.field}>
                <label style={S.label}>Nombre del sistema</label>
                <input
                  type="text"
                  style={S.input}
                  value={config.appName || ''}
                  onChange={e => updateField('appName', e.target.value)}
                  placeholder="Pinturas El Perico"
                />
              </div>
            </>
          )}

          {/* === Preview vivo === */}
          <div style={S.preview}>
            <div style={S.previewLabel}>Vista previa en vivo</div>

            <div style={S.previewTopbar}>
              <img src={config.logoMain} alt="" style={{ height: 28, width: 'auto', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
              <span style={{ fontWeight: 700, fontSize: 14, fontFamily: `'${config.fontFamily}', sans-serif`, color: 'var(--lp-text-primary)' }}>
                {config.appName}
              </span>
            </div>

            <div style={S.previewKPI(config.brandColor)}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Ventas de hoy
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: 'var(--lp-text-primary)', marginTop: 2 }}>
                $24,580
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={S.previewBtnPrimary(config.brandColor)}>Botón primario</button>
              <button style={{ ...S.previewBtnPrimary(config.brandColorDark) }}>Estado hover</button>
              <button style={S.previewBtnSecondary}>Secundario</button>
            </div>
          </div>
        </div>
      </div>

      {/* === CSS responsive: en móvil, sidebar se vuelve scroll horizontal arriba === */}
      <style>{`
        @media (max-width: 720px) {
          .branding-layout {
            grid-template-columns: 1fr !important;
          }
          .branding-layout > nav {
            position: static !important;
            flex-direction: row !important;
            overflow-x: auto;
            padding-bottom: 8px;
            margin-bottom: -8px;
            gap: 4px !important;
            -webkit-overflow-scrolling: touch;
          }
          .branding-layout > nav button {
            flex-shrink: 0;
          }
        }
      `}</style>
      {ConfirmEl}
    </div>
  );
}
