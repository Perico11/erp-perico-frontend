import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopBar from '../../components/layout/TopBar';
import PageTabs from '../../components/ui/PageTabs';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import SesionesPanel from './SesionesPanel';
import UsuariosPanel from './UsuariosPanel';
import MargenesDashboard from './MargenesDashboard';
import CanonicoPanel from './CanonicoPanel';
import TOTPSetupPanel from './TOTPSetupPanel';
import SATPanel from './SATPanel';
import CostosMPPanel from './CostosMPPanel';
import CostosAuxiliaresPanel from './CostosAuxiliaresPanel';
import BrandingPanel from './BrandingPanel';
import PushSettings from '../../components/PushSettings';
import { ResetAllHints } from '../../components/HelpHint';

const S = {
  wrap: { padding: '0 20px 100px' },
  tabs: {
    display: 'flex',
    gap: 0,
    borderBottom: '1.5px solid var(--lp-border-subtle)',
    marginBottom: 16,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  tab: (active) => ({
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--lp-font-sans)',
    marginBottom: -1.5,
    transition: 'color .15s, border-color .15s',
    flexShrink: 0,
  }),
  card: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    padding: 16,
    cursor: 'pointer',
    transition: 'transform .12s, box-shadow .12s, border-color .12s',
    textAlign: 'left',
    width: '100%',
    fontFamily: 'var(--lp-font-sans)',
    color: 'var(--lp-text-primary)',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--lp-text-primary)',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 12,
    color: 'var(--lp-text-secondary)',
    lineHeight: 1.5,
  },
  cardBadge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    marginTop: 10,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 'var(--lp-radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    fontSize: 22,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1.5px solid var(--lp-border-subtle)',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 600,
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    background: 'var(--lp-bg-raised)',
    cursor: 'pointer',
    color: 'var(--lp-text-primary)',
    fontFamily: 'var(--lp-font-sans)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--lp-text-primary)',
  },
  panel: {
    background: 'var(--lp-bg-raised)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius)',
    padding: 16,
  },
  metric: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    background: 'var(--lp-bg-sunken)',
    borderRadius: 'var(--lp-radius-sm)',
    padding: 14,
    textAlign: 'center',
  },
  metricVal: {
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--lp-text-primary)',
    fontFamily: 'var(--lp-font-mono)',
  },
  metricLabel: {
    fontSize: 11,
    color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    marginTop: 4,
    fontWeight: 600,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '36px 1fr auto',
    gap: 12,
    alignItems: 'center',
    padding: '10px 12px',
    background: 'var(--lp-bg-sunken)',
    borderRadius: 'var(--lp-radius-sm)',
  },
  avatar: (color) => ({
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: color,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
  }),
  info: { minWidth: 0 },
  name: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--lp-text-primary)',
  },
  meta: {
    fontSize: 11,
    color: 'var(--lp-text-tertiary)',
    marginTop: 2,
  },
  badge: (bg, fg) => ({
    display: 'inline-flex',
    padding: '2px 8px',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 4,
    background: bg,
    color: fg,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    fontFamily: 'var(--lp-font-sans)',
  }),
  loading: {
    textAlign: 'center',
    padding: '32px 0',
    fontSize: 13,
    color: 'var(--lp-text-tertiary)',
  },
  err: {
    background: 'var(--lp-danger-100)',
    color: 'var(--lp-danger-700)',
    padding: 10,
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12,
  },
  link: {
    color: 'var(--lp-brand-600)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 12,
  },
  hint: {
    fontSize: 11,
    color: 'var(--lp-text-tertiary)',
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 1.6,
  },
};

const ROL_BADGES = {
  admin:       { bg: 'var(--lp-brand-100)',   fg: 'var(--lp-brand-700)',   avatar: 'var(--lp-brand-600)' },
  compras:     { bg: 'var(--lp-info-50)',     fg: 'var(--lp-info-600)',    avatar: 'var(--lp-info-600)' },
  almacen:     { bg: 'var(--lp-success-50)',  fg: 'var(--lp-success-700)', avatar: 'var(--lp-success-600)' },
  inventario:  { bg: 'var(--lp-success-50)',  fg: 'var(--lp-success-700)', avatar: 'var(--lp-success-500)' },
  tecnico:     { bg: 'var(--lp-warning-50)',  fg: 'var(--lp-warning-700)', avatar: 'var(--lp-warning-600)' },
  recolector:  { bg: 'var(--lp-bg-sunken)',   fg: 'var(--lp-text-secondary)', avatar: 'var(--lp-text-secondary)' },
};
const rolStyle = (rol) => ROL_BADGES[rol] || { bg: 'var(--lp-bg-sunken)', fg: 'var(--lp-text-secondary)', avatar: 'var(--lp-text-secondary)' };

/* Iconos SVG line-style minimalistas (estilo Lucide), igual que sidebar */
const ICONS = {
  usuarios: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  sesiones: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  margenes: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  devoluciones: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
  ),
  sat: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  'maestro-mp': (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  'costos-mp': (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  'costos-aux': (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  formulas: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/>
      <path d="M14 9.3a6.5 6.5 0 1 1-4 0"/>
    </svg>
  ),
  configuracion: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  auditoria: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"/>
      <rect x="9" y="2" width="6" height="4" rx="1" ry="1"/><path d="M9 14h6"/><path d="M9 18h6"/>
    </svg>
  ),
  reportes: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  notificaciones: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
};

/* Opción 1 — Outline tinted: cada sección tiene su propio acento.
   bg = tono pastel del color, fg = tono oscuro del mismo color para contraste.
   Stroke width 1.5 ya aplicado en los SVG. */
const ADMIN_SECTIONS = [
  { id: 'totp',           title: 'Google Authenticator',  desc: 'Configurar / regenerar el código de 6 dígitos que protege canónico y ajustes de stock.',     fg: 'var(--lp-qc-600)',                bg: 'var(--lp-qc-50)' },
  { id: 'canonico',       title: 'Inventario Canónico',   desc: 'Fuente de verdad inicial protegida por Google Authenticator. Solo admin.',                  fg: '#5A1EAF',                bg: 'var(--lp-qc-50)' },
  { id: 'usuarios',       title: 'Usuarios',              desc: 'Gestionar usuarios, PINs y permisos por rol.',                                              fg: '#2563EB',                bg: '#EFF5FF' },
  { id: 'sesiones',       title: 'Sesiones',              desc: 'Ver sesiones activas y log de acceso con mapa GPS.',                                        fg: 'var(--lp-qc-600)',                bg: 'var(--lp-qc-50)' },
  { id: 'margenes',       title: 'Precios y Margenes PT', desc: 'Cargar precio de venta de cada producto terminado y ver margen calculado en vivo.',         fg: '#059669',                bg: '#ECFDF5' },
  { id: 'costos-aux',     title: 'Costos Auxiliares',     desc: 'Editar costo de envases por marca, tapas, mano de obra y merma — afecta el calculo de margen PT.', fg: '#D97706',                bg: '#FFFBEB' },
  { id: 'branding',       title: 'Apariencia / Branding', desc: 'Personalizar colores, fuente, tamaños, logos y nombre del sistema. Cambios en vivo.',       fg: '#DB2777',                bg: '#FDF2F8' },
  { id: 'reportes',       title: 'Reportes',              desc: 'Rentabilidad, valoracion de inventario, produccion mensual.',                               fg: '#0F6E56',                bg: '#E1F5EE' },
  { id: 'auditoria',      title: 'Auditoria',             desc: 'Log de eventos: cambios de inventario, eliminaciones, alertas.',                            fg: '#993C1D',                bg: '#FAECE7' },
  { id: 'configuracion',  title: 'Configuracion',         desc: 'Tipo de cambio, flete por kg, parametros generales.',                                       fg: '#5F5E5A',                bg: '#F1EFE8' },
];

/* UsuariosPanel ahora vive en archivo separado UsuariosPanel.jsx */

function MaestroMPPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.getMaestroMP()
      .then(r => setData(r.data || r))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <div style={S.loading}>Cargando maestro MP...</div>;
  if (err) return <div style={S.err}>{err}</div>;
  const mps = data?.mps || {};
  const mpList = Object.entries(mps);
  const activos = mpList.filter(([, m]) => m.estado === 'activo').length;
  const ocultos = mpList.filter(([, m]) => m.estado === 'oculto').length;
  const eliminados = mpList.filter(([, m]) => m.estado === 'eliminado').length;
  return (
    <div style={S.panel}>
      <div style={S.metric}>
        <div style={S.metricCard}>
          <div style={S.metricVal}>{mpList.length}</div>
          <div style={S.metricLabel}>Total MPs</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: 'var(--lp-success-600)' }}>{activos}</div>
          <div style={S.metricLabel}>Activos</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: 'var(--lp-warning-600)' }}>{ocultos}</div>
          <div style={S.metricLabel}>Ocultos</div>
        </div>
        <div style={S.metricCard}>
          <div style={{ ...S.metricVal, color: 'var(--lp-danger-600)' }}>{eliminados}</div>
          <div style={S.metricLabel}>Eliminados</div>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lp-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        Top 20 activas por uso en formulas
      </div>
      <div style={S.list}>
        {mpList
          .filter(([, m]) => m.estado === 'activo')
          .sort((a, b) => (b[1].en_formulas?.length || 0) - (a[1].en_formulas?.length || 0))
          .slice(0, 20)
          .map(([nombre, m]) => (
            <div key={nombre} style={S.row}>
              <div style={S.avatar('var(--lp-warning-600)')}>{nombre.charAt(0)}</div>
              <div style={S.info}>
                <div style={S.name}>{nombre}</div>
                <div style={S.meta}>
                  {m.categoria || 'sin categoria'}
                  {m.stock?.qty != null && ' · stock ' + m.stock.qty}
                </div>
              </div>
              <span style={S.badge('var(--lp-bg-raised)', 'var(--lp-text-secondary)')}>
                {(m.en_formulas || []).length} formulas
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function ConfiguracionPanel() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState({});
  const [saveState, setSaveState] = useState(null);

  useEffect(() => {
    api.get('/api/costos-config')
      .then(r => setConfig(r.data || { tipoCambio: 17.5, fletePorKg: 5.0 }))
      .catch(() => setConfig({ tipoCambio: 17.5, fletePorKg: 5.0 }))
      .finally(() => setLoading(false));
  }, []);

  const guardar = async () => {
    setSaveState('saving');
    const next = {
      tipoCambio: parseFloat(edits.tipoCambio !== undefined ? edits.tipoCambio : config?.tipoCambio) || 17.5,
      fletePorKg: parseFloat(edits.fletePorKg !== undefined ? edits.fletePorKg : config?.fletePorKg) || 5,
    };
    try {
      const r = await api.post('/api/costos-config', next);
      if (r?.ok === false) throw new Error(r.error || 'Error');
      setConfig(next);
      setEdits({});
      setSaveState('saved');
      setTimeout(() => setSaveState(null), 2000);
    } catch (e) {
      setSaveState('err');
    }
  };

  if (loading) return <div style={S.loading}>Cargando configuracion...</div>;
  const tc = edits.tipoCambio !== undefined ? edits.tipoCambio : (config?.tipoCambio || 17.5);
  const flete = edits.fletePorKg !== undefined ? edits.fletePorKg : (config?.fletePorKg || 5);
  const dirty = Object.keys(edits).length > 0;

  const inputStyle = {
    width: 110, padding: '8px 10px', fontSize: 14, fontFamily: 'var(--lp-font-mono)',
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-sm)',
    background: 'var(--lp-bg-base)', color: 'var(--lp-text-primary)', textAlign: 'right',
  };
  const rowStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 0', borderBottom: '1px solid var(--lp-border-subtle)',
  };
  const labelStyle = { flex: 1 };
  const labelTitle = { fontSize: 13, fontWeight: 600, color: 'var(--lp-text-primary)' };
  const labelSub = { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 };

  return (
    <div style={S.panel}>
      <div style={rowStyle}>
        <div style={labelStyle}>
          <div style={labelTitle}>Tipo de cambio USD → MXN</div>
          <div style={labelSub}>Aplicado al recalcular costos de MP en USD.</div>
        </div>
        <input
          type="number" step="0.01" min="0"
          style={inputStyle}
          value={tc}
          onChange={(e) => setEdits(p => ({ ...p, tipoCambio: parseFloat(e.target.value) || 0 }))}
        />
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>
          <div style={labelTitle}>Flete por kg (MXN)</div>
          <div style={labelSub}>Default al crear OC. Cada OC puede sobrescribir manualmente.</div>
        </div>
        <input
          type="number" step="0.01" min="0"
          style={inputStyle}
          value={flete}
          onChange={(e) => setEdits(p => ({ ...p, fletePorKg: parseFloat(e.target.value) || 0 }))}
        />
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>
          <div style={labelTitle}>IVA global</div>
          <div style={labelSub}>Aplicado a todas las MPs en el módulo de fórmulas. Tasa fija México.</div>
        </div>
        <span style={{ fontSize: 14, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)' }}>16%</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, gap: 10 }}>
        {dirty && (
          <button
            onClick={() => setEdits({})}
            style={{
              padding: '9px 16px', fontSize: 13, fontWeight: 600,
              background: 'var(--lp-bg-base)', color: 'var(--lp-text-secondary)',
              border: '1.5px solid var(--lp-border-subtle)', borderRadius: 'var(--lp-radius-sm)', cursor: 'pointer',
            }}
          >Cancelar</button>
        )}
        <button
          onClick={guardar}
          disabled={!dirty}
          style={{
            padding: '9px 18px', fontSize: 13, fontWeight: 700,
            background: !dirty ? 'var(--lp-bg-sunken)' :
                        saveState === 'saved' ? 'var(--lp-success-600)' :
                        saveState === 'err' ? 'var(--lp-danger-600)' :
                        'var(--lp-brand-600)',
            color: !dirty ? 'var(--lp-text-tertiary)' : '#fff',
            border: 'none', borderRadius: 'var(--lp-radius-sm)',
            cursor: !dirty ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {saveState === 'saving' ? 'Guardando...' :
           saveState === 'saved' ? '✓ Guardado' :
           saveState === 'err' ? 'Error · reintentar' : 'Guardar'}
        </button>
      </div>

      <div style={{ marginTop: 22, padding: 12, background: 'var(--lp-info-50)', border: '1px solid var(--lp-info-200)', borderRadius: 'var(--lp-radius-sm)', fontSize: 12, color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--lp-info-700)' }}>Nota:</strong> Los costos auxiliares (envases, tapas, mano de obra, merma) se editan desde la sección
        {' '}<strong>Costos Auxiliares</strong>. Los costos de MP individuales se editan desde <strong>Costos MP</strong>.
      </div>

      {/* Reset onboarding tips */}
      <div style={{ marginTop: 16, padding: 12, background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lp-text-primary)' }}>Tips de onboarding</div>
          <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>Vuelve a mostrar las pistas que ya cerraste.</div>
        </div>
        <ResetAllHints />
      </div>
    </div>
  );
}

/* FIX jun 2026 (Sprint K - K6): rewrite del panel para consumir el hashchain
   SHA256 del Sprint E (`/api/audit/log` + `/api/audit/verify`). Antes leía
   `/api/audit` legacy sin verificación de integridad ni paginación —
   convertía la feature crítica del Sprint E en cosmética. */
/* ── Registro de acciones: categorías + labels legibles (rediseño jul 2026,
   pedido dueño: "quién dio de alta qué, quién canceló, quién hizo un pedido —
   no todo revuelto"). Se filtra CLIENT-SIDE sobre un lote grande (el filtro
   `usuario` del server usaba el param equivocado y nunca funcionó). ── */
const AUDIT_CATEGORIAS = [
  { key: 'todas',    label: 'Todas',            match: () => true },
  { key: 'altas',    label: 'Altas',            match: a => /^(maestro_alta_mp|ingreso_crear|ingreso_aprobar|ot_crear|oc_solicitud_creada|usuario_creado|produccion_registrada)$/.test(a) },
  { key: 'bajas',    label: 'Cancelaciones y eliminaciones', match: a => /(_eliminad|_eliminar|_rechazad|_rechazar|_cancelar|cancelad|^maestro_estado$)/.test(a) },
  { key: 'pedidos',  label: 'Pedidos y órdenes', match: a => /^(pedido_|orden_)/.test(a) },
  { key: 'prod',     label: 'Producción',       match: a => /^(produccion_|sublote_|lote_|trazabilidad_)/.test(a) },
  { key: 'inv',      label: 'Inventario',       match: a => /^(ajuste_|inventario_|envase_|tapa_|edicion_pt|transferencia_pt|reenvase_|maestro_campo|maestro_alta_mp|mp_precio)/.test(a) },
  { key: 'ot',       label: 'Transferencias',   match: a => /^ot_/.test(a) },
  { key: 'compras',  label: 'Compras e ingresos', match: a => /^(oc_|ingreso_)/.test(a) },
  { key: 'usuarios', label: 'Usuarios y seguridad', match: a => /^(usuario_|pin_|cambio_pin|permiso_|security_|rate_limit|audit_|test_mode)/.test(a) },
];

const AUDIT_ACCION_LABEL = {
  maestro_alta_mp: 'Dio de alta materia prima',
  maestro_campo: 'Editó el maestro de MP',
  maestro_estado: 'Cambió estado de una MP',
  ingreso_crear: 'Registró un ingreso de proveedor',
  ingreso_aprobar: 'Aprobó un ingreso (sumó al stock)',
  ingreso_rechazar: 'Rechazó un ingreso',
  ot_crear: 'Creó una transferencia',
  ot_editar: 'Editó una transferencia',
  ot_eliminar: 'Eliminó una transferencia',
  ot_surtir: 'Surtió una transferencia',
  ot_recibir: 'Recibió una transferencia en Terán',
  ot_cancelar: 'Canceló una transferencia',
  orden_eliminada: 'Eliminó una orden',
  pedido_rechazado: 'Rechazó un pedido',
  produccion_registrada: 'Registró una producción',
  sublote_transicion: 'Movió un sublote',
  lote_estado_forzado: 'Forzó el estado de un lote',
  ajuste_mp: 'Ajustó stock de MP',
  ajuste_pt: 'Ajustó stock de PT',
  inventario_movimientos: 'Registró movimientos de inventario',
  envase_stock: 'Ajustó stock de envases',
  tapa_stock: 'Ajustó stock de tapas',
  envase_transferir_teran: 'Transfirió envases a Terán',
  transferencia_pt_teran: 'Transfirió PT a Terán',
  reenvase_pt_teran: 'Re-envasó PT en Terán',
  edicion_pt_meta: 'Editó datos de un PT',
  mp_precio_base: 'Cambió precio base de MP',
  oc_solicitud_creada: 'Creó solicitud de compra (OC)',
  oc_aprobada: 'Aprobó una OC',
  oc_editada: 'Editó una OC',
  oc_pago_registrado: 'Registró pago de una OC',
  usuario_creado: 'Creó un usuario',
  usuario_editado: 'Editó un usuario',
  usuario_eliminado: 'Eliminó un usuario',
  pin_cambiado: 'Cambió el PIN de un usuario',
  cambio_pin_propio: 'Cambió su propio PIN',
  cambio_pin_intento_fallido: 'Intento fallido de cambio de PIN',
  permiso_denegado: 'Intentó una acción sin permiso',
  audit_chain_verified: 'Verificó la cadena de auditoría',
  rate_limit_endpoint: 'Límite de peticiones alcanzado',
  test_mode_bypass: 'Bypass de modo prueba',
};
function _auditLabel(accion) {
  if (AUDIT_ACCION_LABEL[accion]) return AUDIT_ACCION_LABEL[accion];
  if (accion.startsWith('security_')) return 'Evento de seguridad: ' + accion.slice(9).replace(/_/g, ' ');
  return accion.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}
/* Resume el target (objeto libre) a lo que importa al dueño: QUÉ cosa fue. */
function _auditTarget(t) {
  if (!t) return '';
  if (typeof t !== 'object') return String(t).slice(0, 110);
  const partes = [];
  const pick = (k, pre = '') => { if (t[k] != null && t[k] !== '') partes.push(pre + String(typeof t[k] === 'object' ? JSON.stringify(t[k]) : t[k]).slice(0, 60)); };
  pick('mp'); pick('producto'); pick('folio'); pick('codigo'); pick('nombre');
  pick('estado', 'estado: '); pick('cantidad', 'cant: '); pick('qty', 'cant: ');
  pick('lineas', 'líneas: '); pick('mutaciones', 'mutaciones: ');
  if (partes.length === 0) return JSON.stringify(t).slice(0, 110);
  return partes.slice(0, 4).join(' · ');
}

function AuditoriaPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [cat, setCat] = useState('todas');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(500);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setErr('');
    /* Traemos un lote grande y filtramos client-side (categorías + usuario +
       búsqueda) — así los chips muestran conteos reales del periodo cargado. */
    api.get('/api/audit/log?limit=' + limite)
      .then(r => {
        const arr = Array.isArray(r) ? r : (r.data || r.logs || r.entries || []);
        setLogs(arr);
      })
      .catch(e => {
        api.get('/api/audit').then(r => {
          const arr = Array.isArray(r) ? r : (r.data || r.logs || r.audit || []);
          setLogs(arr);
        }).catch(e2 => setErr(e2.message || e.message));
      })
      .finally(() => setLoading(false));
  }, [limite]);

  useEffect(() => { cargar(); }, [cargar]);

  const verificarCadena = useCallback(async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const r = await api.get('/api/audit/verify');
      setVerifyResult(r);
    } catch (e) {
      setVerifyResult({ ok: false, valid: false, error: e.message });
    } finally {
      setVerifying(false);
    }
  }, []);

  /* Normaliza cada entrada UNA vez (usuario/acción/fecha) para filtros y render */
  const eventos = useMemo(() => logs.map((l, i) => {
    const accion = String(l.action || l.accion || l.tipo || 'evento');
    return {
      key: l.hash || i,
      usuario: l.userNombre || l.usuario || l.user || 'sistema',
      rol: l.userRol || '',
      accion,
      label: _auditLabel(accion),
      fecha: l.timestamp || l.fecha || l.ts || '',
      target: _auditTarget(l.target),
      detail: l.detail || '',
      ip: l.ip || '',
      isOk: (l.result || 'ok') === 'ok',
    };
  }).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))), [logs]);

  const usuarios = useMemo(() => [...new Set(eventos.map(e => e.usuario))].sort(), [eventos]);

  const conteoPorCat = useMemo(() => {
    const c = {};
    AUDIT_CATEGORIAS.forEach(k => { c[k.key] = k.key === 'todas' ? eventos.length : eventos.filter(e => k.match(e.accion)).length; });
    return c;
  }, [eventos]);

  const visibles = useMemo(() => {
    const catDef = AUDIT_CATEGORIAS.find(c => c.key === cat) || AUDIT_CATEGORIAS[0];
    const q = busca.trim().toLowerCase();
    return eventos.filter(e =>
      (cat === 'todas' || catDef.match(e.accion))
      && (!filtroUsuario || e.usuario === filtroUsuario)
      && (!q || e.label.toLowerCase().includes(q) || e.target.toLowerCase().includes(q) || e.usuario.toLowerCase().includes(q))
    );
  }, [eventos, cat, filtroUsuario, busca]);

  /* Agrupar por día → separadores ("no todo revuelto") */
  const porDia = useMemo(() => {
    const grupos = [];
    let diaActual = null;
    visibles.forEach(e => {
      const d = e.fecha ? new Date(e.fecha) : null;
      const dia = d && !Number.isNaN(d.getTime())
        ? d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
        : 'Sin fecha';
      if (dia !== diaActual) { grupos.push({ dia, items: [] }); diaActual = dia; }
      grupos[grupos.length - 1].items.push(e);
    });
    return grupos;
  }, [visibles]);

  const chipStyle = (on) => ({
    padding: '7px 13px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
    border: '1.5px solid ' + (on ? 'var(--lp-brand-600)' : 'var(--lp-border-subtle)'),
    background: on ? 'var(--lp-brand-600)' : 'transparent',
    color: on ? '#fff' : 'var(--lp-text-secondary)',
    fontSize: 12, fontWeight: on ? 700 : 500, fontFamily: 'var(--lp-font-sans)',
  });

  return (
    <div style={S.panel}>
      {/* Chips de categoría — el "no lo quiero ver todo revuelto" */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {AUDIT_CATEGORIAS.map(c => (
          <button key={c.key} onClick={() => setCat(c.key)} style={chipStyle(cat === c.key)}>
            {c.label}{conteoPorCat[c.key] ? ` · ${conteoPorCat[c.key]}` : ''}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <div style={{ minWidth: 170 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Usuario</label>
          <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--lp-radius-sm)', border: '1.5px solid var(--lp-border-subtle)', fontSize: 12, fontFamily: 'var(--lp-font-sans)' }}>
            <option value="">Todos</option>
            {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Buscar</label>
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Producto, folio, acción…"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--lp-radius-sm)', border: '1.5px solid var(--lp-border-subtle)', fontSize: 12, fontFamily: 'var(--lp-font-sans)' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Cargar</label>
          <select value={limite} onChange={e => setLimite(Number(e.target.value))} style={{ padding: '8px 10px', borderRadius: 'var(--lp-radius-sm)', border: '1.5px solid var(--lp-border-subtle)', fontSize: 12 }}>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={2000}>2000</option>
          </select>
        </div>
        <button onClick={verificarCadena} disabled={verifying}
          style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, background: 'var(--lp-brand-600)', color: '#fff', border: 'none', borderRadius: 'var(--lp-radius-sm)', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)' }}>
          {verifying ? 'Verificando…' : 'Verificar cadena'}
        </button>
      </div>

      {verifyResult && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--lp-radius-sm)',
          background: verifyResult.valid ? 'var(--lp-success-50)' : 'var(--lp-danger-50)',
          border: '1.5px solid ' + (verifyResult.valid ? 'var(--lp-success-300)' : 'var(--lp-danger-300)'),
          marginBottom: 12, fontSize: 12,
        }}>
          <strong>{verifyResult.valid ? 'Cadena íntegra' : 'CADENA ROTA'}</strong>
          {verifyResult.totalEntries !== undefined && ` · ${verifyResult.totalEntries} entradas verificadas`}
          {verifyResult.lastHash && ` · último hash ${String(verifyResult.lastHash).slice(0, 12)}…`}
          {verifyResult.error && ` · ${verifyResult.error}`}
        </div>
      )}

      {loading && <div style={S.loading}>Cargando auditoría...</div>}
      {err && <div style={S.err}>{err}</div>}
      {!loading && visibles.length === 0 ? (
        <div style={S.loading}>Sin eventos con esos filtros</div>
      ) : (
        <div style={S.list}>
          {porDia.map(g => (
            <div key={g.dia}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '12px 2px 6px' }}>{g.dia}</div>
              {g.items.map(e => (
                <div key={e.key} style={S.row}>
                  <div style={S.avatar(e.isOk ? 'var(--lp-success-600)' : 'var(--lp-danger-600)')}>
                    {e.usuario.charAt(0).toUpperCase()}
                  </div>
                  <div style={S.info}>
                    <div style={S.name}>
                      <span style={{ color: 'var(--lp-brand-700)' }}>{e.usuario}</span> — {e.label}
                    </div>
                    {(e.target || e.detail) && (
                      <div style={{ ...S.meta, marginTop: 2 }}>{e.target}{e.detail ? ` · ${e.detail}` : ''}</div>
                    )}
                    <div style={{ ...S.meta, fontSize: 10.5, color: 'var(--lp-text-tertiary)', marginTop: 2 }}>
                      {e.fecha && new Date(e.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      {e.rol && ' · ' + e.rol}
                      {e.ip && ' · IP ' + e.ip}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportesPanel() {
  /* Sub-sub-pestaña deep-linkeable vía ?sub= (nivel 2 bajo ?section=reportes).
     Ej: /admin?section=reportes&sub=valoracion abre Valuación. */
  const [searchParams] = useSearchParams();
  const SUB_VALIDOS = ['rentabilidad', 'valoracion', 'produccion', 'tiempos'];
  const [tab, setTab] = useState(() => {
    const t = searchParams.get('sub');
    return (t && SUB_VALIDOS.includes(t)) ? t : 'rentabilidad';
  }); /* rentabilidad | valoracion | produccion | tiempos */
  useEffect(() => {
    const t = searchParams.get('sub');
    if (t && SUB_VALIDOS.includes(t)) setTab(t);
  }, [searchParams]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    setErr('');
    let url;
    if (tab === 'rentabilidad') url = '/api/reports/margenes';
    else if (tab === 'valoracion') url = '/api/reports/inventory-valuation';
    else if (tab === 'tiempos')    url = '/api/reports/tiempos-produccion';
    else url = '/api/reports/production-monthly?year=' + year;
    api.get(url)
      .then(r => setData(r.data ? r : r))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [tab, year]);

  const fmt$ = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
  const fmtN = (n) => Number(n || 0).toLocaleString('es-MX');

  const tabBtnStyle = (active) => ({
    padding: '8px 16px', fontSize: 12,
    fontWeight: active ? 700 : 500,
    color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-tertiary)',
    background: 'none', border: 'none',
    borderBottom: active ? '2px solid var(--lp-brand-600)' : '2px solid transparent',
    cursor: 'pointer', whiteSpace: 'nowrap',
    fontFamily: 'var(--lp-font-sans)', marginBottom: -1.5, flexShrink: 0,
  });

  return (
    <div>
      <PageTabs
        tabs={[
          { id: 'rentabilidad', label: 'Rentabilidad', style: (a) => tabBtnStyle(a) },
          { id: 'valoracion', label: 'Valuación de inventario', style: (a) => tabBtnStyle(a) },
          { id: 'produccion', label: 'Producción mensual', style: (a) => tabBtnStyle(a) },
          { id: 'tiempos', label: 'Tiempos por lote', style: (a) => tabBtnStyle(a) },
        ]}
        activeTab={tab}
        onChange={setTab}
        style={{
          display: 'flex', gap: 0,
          borderBottom: '1.5px solid var(--lp-border-subtle)',
          marginBottom: 16,
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}
      />

      {loading && <div style={S.loading}>Cargando reporte…</div>}
      {err && <div style={S.err}>{err}</div>}

      {/* ═══════════ RENTABILIDAD ═══════════ */}
      {!loading && !err && tab === 'rentabilidad' && data && (() => {
        const productos = data.productos || data.formulas || (Array.isArray(data) ? data : []);
        const conPrecio = productos.filter(p => (p.precioVenta || p.precioCubeta || 0) > 0);
        const totalIngresos = conPrecio.reduce((s, p) => s + ((p.precioVenta || p.precioCubeta || 0) * (p.prodMensual || 0)), 0);
        const totalCosto = conPrecio.reduce((s, p) => s + ((p.costoTotal || 0) * (p.prodMensual || 0)), 0);
        const totalUtilidad = totalIngresos - totalCosto;
        const margenProm = totalIngresos > 0 ? (totalUtilidad / totalIngresos * 100) : 0;

        const sorted = [...conPrecio].sort((a, b) => {
          const um = ((b.precioVenta || b.precioCubeta || 0) - (b.costoTotal || 0)) * (b.prodMensual || 0);
          const ua = ((a.precioVenta || a.precioCubeta || 0) - (a.costoTotal || 0)) * (a.prodMensual || 0);
          return um - ua;
        });

        return (
          <div style={S.panel}>
            <div style={S.metric}>
              <div style={S.metricCard}>
                <div style={{ ...S.metricVal, color: 'var(--lp-success-600)' }}>{fmt$(totalUtilidad)}</div>
                <div style={S.metricLabel}>Utilidad mensual</div>
              </div>
              <div style={S.metricCard}>
                <div style={S.metricVal}>{fmt$(totalIngresos)}</div>
                <div style={S.metricLabel}>Ingresos mensuales</div>
              </div>
              <div style={S.metricCard}>
                <div style={{ ...S.metricVal, color: 'var(--lp-warning-700)' }}>{fmt$(totalCosto)}</div>
                <div style={S.metricLabel}>Costo mensual</div>
              </div>
              <div style={S.metricCard}>
                <div style={{ ...S.metricVal, color: 'var(--lp-brand-700)' }}>{margenProm.toFixed(1)}%</div>
                <div style={S.metricLabel}>Margen promedio</div>
              </div>
              <div style={S.metricCard}>
                <div style={S.metricVal}>{conPrecio.length}<span style={{ fontSize: 14, opacity: .5 }}> / {productos.length}</span></div>
                <div style={S.metricLabel}>Con precio</div>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '6px 0 10px' }}>
              Top 15 productos por utilidad mensual
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Producto</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Cub/mes</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Costo</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Precio</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Margen</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Utilidad/mes</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 15).map((p) => {
                  const precio = p.precioVenta || p.precioCubeta || 0;
                  const margenAbs = precio - (p.costoTotal || 0);
                  const margenPct = precio > 0 ? (margenAbs / precio * 100) : 0;
                  const utilMes = margenAbs * (p.prodMensual || 0);
                  return (
                    <tr key={p.nombre}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', fontWeight: 500 }}>{p.nombre}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{p.prodMensual || 0}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{fmt$(p.costoTotal || 0)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{fmt$(precio)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: margenPct >= 30 ? 'var(--lp-success-700)' : margenPct >= 15 ? 'var(--lp-warning-700)' : 'var(--lp-danger-700)', fontWeight: 700 }}>
                        {margenPct.toFixed(1)}%
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: utilMes > 0 ? 'var(--lp-success-700)' : 'var(--lp-text-tertiary)' }}>{fmt$(utilMes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ═══════════ VALUACIÓN DE INVENTARIO ═══════════ */}
      {!loading && !err && tab === 'valoracion' && data && (() => {
        const v = data;
        const total = v.valorTotal || v.totalGeneral || v.total || ((v.valorMP || 0) + (v.valorPT || 0) + (v.valorEnvases || 0));
        const topMP = v.topMP || v.detalleMP || [];
        const topEnvases = v.topEnvases || [];
        return (
          <div style={S.panel}>
            <div style={S.metric}>
              <div style={{ ...S.metricCard, borderTop: '3px solid var(--lp-success-600)' }}>
                <div style={{ ...S.metricVal, color: 'var(--lp-success-700)' }}>{fmt$(total)}</div>
                <div style={S.metricLabel}>Valor total inventario</div>
              </div>
              <div style={S.metricCard}>
                <div style={{ ...S.metricVal, color: 'var(--lp-brand-700)' }}>{fmt$(v.valorMP || 0)}</div>
                <div style={S.metricLabel}>Materia prima</div>
              </div>
              <div style={S.metricCard}>
                <div style={{ ...S.metricVal, color: 'var(--lp-warning-700)' }}>{fmt$(v.valorPT || 0)}</div>
                <div style={S.metricLabel}>Producto terminado</div>
              </div>
              <div style={S.metricCard}>
                <div style={S.metricVal}>{fmt$(v.valorEnvases || 0)}</div>
                <div style={S.metricLabel}>Envases</div>
              </div>
            </div>

            {topMP.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '6px 0 10px' }}>
                  Top 15 MPs por valor en stock
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 18 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Materia prima</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Stock</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>$/kg</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...topMP].sort((a, b) => (b.valor || 0) - (a.valor || 0)).slice(0, 15).map(item => (
                      <tr key={item.mp || item.nombre}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', fontWeight: 500 }}>{item.mp || item.nombre}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{fmtN(item.stock || item.qty || 0)} kg</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{fmt$(item.costoKg || item.costo || 0)}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700 }}>{fmt$(item.valor || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {topEnvases.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '6px 0 10px' }}>
                  Envases por valor
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Envase</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Stock</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>$/u</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...topEnvases].sort((a, b) => (b.valor || 0) - (a.valor || 0)).map(item => (
                      <tr key={item.nombre}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', fontWeight: 500 }}>{item.nombre}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{fmtN(item.qty || 0)} pz</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{fmt$(item.costo || 0)}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700 }}>{fmt$(item.valor || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        );
      })()}

      {/* ═══════════ PRODUCCIÓN MENSUAL ═══════════ */}
      {!loading && !err && tab === 'produccion' && data && (() => {
        const meses = data.meses || {};
        const mesEntries = Object.entries(meses).sort((a, b) => a[0].localeCompare(b[0]));
        const totalAnual = mesEntries.reduce((s, [, m]) => s + (m.total || 0), 0);
        const promMensual = mesEntries.length > 0 ? totalAnual / mesEntries.length : 0;
        const maxMes = mesEntries.reduce((max, [, m]) => Math.max(max, m.total || 0), 0);

        return (
          <div style={S.panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--lp-text-secondary)' }}>Año:</label>
              <select
                style={{
                  padding: '6px 10px', fontSize: 12,
                  border: '1.5px solid var(--lp-border-subtle)',
                  borderRadius: 'var(--lp-radius-sm)',
                  background: 'var(--lp-bg-base)',
                }}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
              >
                {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div style={S.metric}>
              <div style={{ ...S.metricCard, borderTop: '3px solid var(--lp-brand-600)' }}>
                <div style={S.metricVal}>{fmtN(totalAnual)}</div>
                <div style={S.metricLabel}>Cubetas {year}</div>
              </div>
              <div style={S.metricCard}>
                <div style={S.metricVal}>{Math.round(promMensual).toLocaleString()}</div>
                <div style={S.metricLabel}>Promedio mensual</div>
              </div>
              <div style={S.metricCard}>
                <div style={S.metricVal}>{mesEntries.length}</div>
                <div style={S.metricLabel}>Meses con datos</div>
              </div>
            </div>

            {/* Mini bar chart */}
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '10px 0' }}>
              Producción por mes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {mesEntries.map(([mes, m]) => {
                const total = m.total || 0;
                const pct = maxMes > 0 ? (total / maxMes) * 100 : 0;
                return (
                  <div key={mes} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <span style={{ width: 70, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-tertiary)' }}>{mes}</span>
                    <div style={{ flex: 1, height: 18, background: 'var(--lp-bg-sunken)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: pct + '%',
                        height: '100%',
                        background: total >= promMensual ? 'var(--lp-success-500)' : 'var(--lp-brand-500)',
                        transition: 'width .3s',
                      }} />
                    </div>
                    <span style={{ width: 70, textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-text-primary)' }}>
                      {fmtN(total)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ═══════════ TIEMPOS POR LOTE ═══════════ */}
      {!loading && !err && tab === 'tiempos' && data && (() => {
        const d = data.data || data;
        const k = d.kpis || {};
        const resumen = d.resumenFormula || [];
        const detalle = d.detalle || [];
        const fmtMin = (ms) => Math.round((ms || 0) / 60000);
        const fmtHM = (ms) => {
          const m = Math.round((ms || 0) / 60000);
          if (m < 60) return m + ' min';
          return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
        };
        return (
          <div style={S.panel}>
            <div style={S.metric}>
              <div style={{ ...S.metricCard, borderTop: '3px solid var(--lp-brand-600)' }}>
                <div style={S.metricVal}>{k.totalLotes || 0}</div>
                <div style={S.metricLabel}>Lotes con tiempo</div>
              </div>
              <div style={S.metricCard}>
                <div style={S.metricVal}>{k.tiempoActivoHoras || 0}h</div>
                <div style={S.metricLabel}>Tiempo activo total</div>
              </div>
              <div style={S.metricCard}>
                <div style={{ ...S.metricVal, color: 'var(--lp-warning-700)' }}>{k.tiempoPausadoHoras || 0}h</div>
                <div style={S.metricLabel}>Tiempo pausado</div>
              </div>
              <div style={S.metricCard}>
                <div style={{ ...S.metricVal, color: k.pctPausa > 15 ? 'var(--lp-danger-600)' : 'var(--lp-text-primary)' }}>{k.pctPausa || 0}%</div>
                <div style={S.metricLabel}>% del total en pausa</div>
              </div>
              <div style={S.metricCard}>
                <div style={S.metricVal}>{k.promPausasPorLote || 0}</div>
                <div style={S.metricLabel}>Pausas /lote (avg)</div>
              </div>
            </div>

            {/* Promedios por fórmula */}
            {resumen.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '14px 0 8px' }}>
                  Promedios por fórmula
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 18 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left',  padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Fórmula</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Lotes</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Promedio activo</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Promedio pausa</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Pausas /lote</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Min/cubeta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.map(r => (
                      <tr key={r.formula}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', fontWeight: 600 }}>{r.formula}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{r.lotes}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700 }}>{r.promedioActivoMin} min</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: r.promedioPausadoMin > 30 ? 'var(--lp-warning-700)' : 'var(--lp-text-tertiary)' }}>{r.promedioPausadoMin} min</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{r.promedioPausas}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-secondary)' }}>{r.promedioMinPorCubeta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Detalle lote por lote */}
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '6px 0 8px' }}>
              Detalle de lotes ({detalle.length})
            </div>
            {detalle.length === 0 ? (
              <div style={S.loading}>
                Aún no hay lotes producidos con el flujo paso-a-paso. Los tiempos se registran a partir del próximo lote.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left',  padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Lote</th>
                    <th style={{ textAlign: 'left',  padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Producto</th>
                    <th style={{ textAlign: 'left',  padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Operador</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Cubetas</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Total</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Activo</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Pausa</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Pausas</th>
                    <th style={{ textAlign: 'left',  padding: '6px 8px', borderBottom: '1.5px solid var(--lp-border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' }}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.map(l => (
                    <tr key={l.codigo} style={l.esPrueba ? { background: 'var(--lp-warning-50)' } : {}}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-brand-600)' }}>
                        {l.codigo}
                        {l.esPrueba && <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 6px', background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)', borderRadius: 3, fontWeight: 700, letterSpacing: '0.04em' }}>PRUEBA</span>}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', fontWeight: 600 }}>{l.producto}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', color: 'var(--lp-text-secondary)' }}>{l.usuario}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)' }}>{l.cantidad}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', fontWeight: 700 }}>{fmtHM(l.duracionTotalMs)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-success-700)' }}>{fmtHM(l.tiempoActivoMs)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: l.tiempoPausadoMs > 0 ? 'var(--lp-warning-700)' : 'var(--lp-text-tertiary)' }}>{l.tiempoPausadoMs > 0 ? fmtHM(l.tiempoPausadoMs) : '—'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right', fontFamily: 'var(--lp-font-mono)', color: l.numPausas > 0 ? 'var(--lp-warning-700)' : 'var(--lp-text-tertiary)' }}>{l.numPausas || '—'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                        {l.fechaFin ? new Date(l.fechaFin).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}
    </div>
  );
}

const SECTION_PANELS = {
  'totp':          TOTPSetupPanel,
  'canonico':      CanonicoPanel,
  'usuarios':      UsuariosPanel,
  'margenes':      MargenesDashboard,
  'sat':           SATPanel,
  'maestro-mp':    MaestroMPPanel,
  'costos-mp':     CostosMPPanel,
  'costos-aux':    CostosAuxiliaresPanel,
  'branding':      BrandingPanel,
  'configuracion': ConfiguracionPanel,
  'auditoria':     AuditoriaPanel,
  'reportes':      ReportesPanel,
  'notificaciones': PushSettings,
};

export default function AdminPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState(() => {
    const sec = searchParams.get('section');
    if (sec && SECTION_PANELS[sec]) return sec;
    return null;
  });

  /* Sync URL → estado en vivo: si ?section= cambia estando YA en /admin
     (react-router no remonta), aplica la sección. Permite al asistente
     deep-linkear a otra sección sin recargar. setear al mismo valor = no-op. */
  useEffect(() => {
    const s = searchParams.get('section');
    if (s && SECTION_PANELS[s]) setActiveSection(s);
  }, [searchParams]);

  /* Unificación Devoluciones (jul 2026): el panel embebido DevolucionesPanel
     duplicaba a la pantalla canónica /devoluciones (sheets nuevas + data-id) y
     se eliminó. Deep-links viejos ?section=devoluciones redirigen allá — antes
     ni siquiera renderizaban (la sección no estaba en ADMIN_SECTIONS → blanco). */
  useEffect(() => {
    if (searchParams.get('section') === 'devoluciones') {
      navigate('/devoluciones', { replace: true });
    }
  }, [searchParams, navigate]);

  const currentSection = activeSection
    ? ADMIN_SECTIONS.find(s => s.id === activeSection)
    : null;

  const PanelComponent = activeSection === 'sesiones'
    ? SesionesPanel
    : (activeSection ? SECTION_PANELS[activeSection] : null);

  return (
    <div>
      <TopBar title="Administracion" />
      <div style={S.wrap}>
        {!activeSection && (
          <div style={S.grid}>
            {ADMIN_SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                style={S.card}
                onClick={() => {
                  /* Editar Fórmulas navega directo al módulo principal */
                  if (s.id === 'formulas') return navigate('/formulas');
                  setActiveSection(s.id);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(26,24,21,.06)';
                  e.currentTarget.style.borderColor = 'var(--lp-border-strong)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '';
                  e.currentTarget.style.borderColor = 'var(--lp-border-subtle)';
                }}
              >
                <div style={{ ...S.iconWrap, background: s.bg, color: s.fg }}>
                  {ICONS[s.id]}
                </div>
                <div style={S.cardTitle}>{s.title}</div>
                <div style={S.cardDesc}>{s.desc}</div>
              </button>
            ))}
          </div>
        )}

        {currentSection && PanelComponent && (
          <div>
            <div style={S.sectionHeader}>
              <button style={S.backBtn} onClick={() => setActiveSection(null)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Volver
              </button>
              <div style={{ ...S.iconWrap, marginBottom: 0, width: 32, height: 32, background: currentSection.bg, color: currentSection.fg }}>
                {ICONS[currentSection.id]}
              </div>
              <div style={S.sectionTitle}>{currentSection.title}</div>
            </div>
            <PanelComponent />
          </div>
        )}
      </div>
    </div>
  );
}
