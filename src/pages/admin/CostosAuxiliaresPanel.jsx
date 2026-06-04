import { useEffect, useState } from 'react';
import api from '../../services/api';

const S = {
  card: {
    background: 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)',
    padding: 16, marginBottom: 14,
    fontFamily: 'var(--lp-font-sans)',
  },
  header: { fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)', marginBottom: 4 },
  desc: { fontSize: 11, color: 'var(--lp-text-secondary)', marginBottom: 14 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '.04em',
    padding: '6px 8px', textAlign: 'left',
    borderBottom: '1.5px solid var(--lp-border-subtle)',
  },
  td: { padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', verticalAlign: 'middle' },
  tdR: { padding: '6px 8px', borderBottom: '1px solid var(--lp-border-subtle)', textAlign: 'right' },
  input: {
    width: 80, padding: '5px 8px', fontSize: 12,
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 5,
    background: 'var(--lp-bg-base)', textAlign: 'right',
    fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)',
  },
  textInput: {
    padding: '5px 8px', fontSize: 12,
    border: '1.5px solid var(--lp-border-subtle)', borderRadius: 5,
    background: 'var(--lp-bg-base)', color: 'var(--lp-text-primary)',
    fontFamily: 'inherit',
  },
  swatch: (color) => ({
    display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
    background: color, border: '1px solid rgba(0,0,0,.15)', marginRight: 6, verticalAlign: 'middle',
  }),
  saveBar: {
    position: 'sticky', bottom: 0, background: 'var(--lp-bg-raised)',
    padding: '10px 14px', borderTop: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 14, borderRadius: 'var(--lp-radius)',
    boxShadow: '0 -4px 14px rgba(26,24,21,.04)',
  },
  saveBtn: (state) => ({
    padding: '9px 18px', fontSize: 13, fontWeight: 700,
    border: 'none', borderRadius: 'var(--lp-radius-sm)', cursor: 'pointer',
    background: state === 'saving' ? 'var(--lp-bg-sunken)' :
                state === 'saved'  ? 'var(--lp-success-600)' :
                state === 'err'    ? 'var(--lp-danger-600)' : 'var(--lp-brand-600)',
    color: '#fff', fontFamily: 'inherit',
  }),
  loading: { textAlign: 'center', padding: 32, color: 'var(--lp-text-tertiary)' },
  err: { background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)', padding: 10, borderRadius: 6, fontSize: 12 },
  hint: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 8, lineHeight: 1.5 },
};

const PRESENTACIONES = [
  { key: 'cubeta', label: 'Cubeta 19L' },
  { key: 'galon',  label: 'Galón 3.78L' },
  { key: 'litro',  label: 'Litro' },
];

export default function CostosAuxiliaresPanel() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saveState, setSaveState] = useState(null);

  useEffect(() => {
    api.getCostosPTConfig()
      .then(r => setCfg(r.data || r))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const updateNested = (path, value) => {
    setCfg(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
    setSaveState(null);
  };

  const guardar = async () => {
    setSaveState('saving');
    try {
      await api.setCostosPTConfig(cfg);
      setSaveState('saved');
      setTimeout(() => setSaveState(null), 2000);
    } catch (e) {
      setSaveState('err');
      setErr(e.message);
    }
  };

  if (loading) return <div style={S.loading}>Cargando configuración…</div>;
  if (err && !cfg) return <div style={S.err}>{err}</div>;
  if (!cfg) return null;

  const marcas = Object.keys(cfg.envasesByMarca || {});

  return (
    <div>
      {/* Envases por marca y presentación */}
      <div style={S.card}>
        <div style={S.header}>Envases por marca y presentación (MXN)</div>
        <div style={S.desc}>
          Cada producto terminado se envasa en una marca de cubeta. Edita el costo por unidad
          (cubeta 19L, galón 3.78L, litro). El cálculo de margen usa estos valores.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Marca</th>
                {PRESENTACIONES.map(p => (
                  <th key={p.key} style={{ ...S.th, textAlign: 'right' }}>{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {marcas.map(marca => (
                <tr key={marca}>
                  <td style={S.td}>
                    <strong>{marca}</strong>
                    {marca === 'DEFAULT' && (
                      <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginLeft: 6 }}>(fallback)</span>
                    )}
                  </td>
                  {PRESENTACIONES.map(p => (
                    <td key={p.key} style={S.tdR}>
                      <input
                        type="number" step="0.5" min="0"
                        style={S.input}
                        value={cfg.envasesByMarca[marca]?.[p.key] ?? ''}
                        onChange={(e) => updateNested(`envasesByMarca.${marca}.${p.key}`, parseFloat(e.target.value) || 0)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tapas por color */}
      <div style={S.card}>
        <div style={S.header}>Tapas por color (MXN)</div>
        <div style={S.desc}>
          Cada marca de cubeta usa una tapa por default. El costo de la tapa se suma al envase.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Tapa</th>
                <th style={S.th}>Descripción</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Costo</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(cfg.tapasByColor || {}).map(([key, t]) => (
                <tr key={key}>
                  <td style={S.td}>
                    <span style={S.swatch(t.color || '#9CA3AF')}></span>
                    <code style={{ fontSize: 11 }}>{key}</code>
                  </td>
                  <td style={S.td}>
                    <input
                      type="text"
                      style={{ ...S.textInput, width: '100%' }}
                      value={t.label || ''}
                      onChange={(e) => updateNested(`tapasByColor.${key}.label`, e.target.value)}
                    />
                  </td>
                  <td style={S.tdR}>
                    <input
                      type="number" step="0.5" min="0"
                      style={S.input}
                      value={t.costo ?? ''}
                      onChange={(e) => updateNested(`tapasByColor.${key}.costo`, parseFloat(e.target.value) || 0)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tapa default por marca */}
      <div style={S.card}>
        <div style={S.header}>Tapa default por marca</div>
        <div style={S.desc}>
          Mapeo: cuando una fórmula se envasa en cierta marca, ¿qué tapa lleva?
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Marca</th>
                <th style={S.th}>Tapa</th>
              </tr>
            </thead>
            <tbody>
              {marcas.filter(m => m !== 'DEFAULT').map(marca => (
                <tr key={marca}>
                  <td style={S.td}><strong>{marca}</strong></td>
                  <td style={S.td}>
                    <select
                      style={{ ...S.textInput, width: '100%' }}
                      value={cfg.tapaDefaultByMarca?.[marca] || ''}
                      onChange={(e) => updateNested(`tapaDefaultByMarca.${marca}`, e.target.value)}
                    >
                      <option value="">— sin asignar —</option>
                      {Object.entries(cfg.tapasByColor || {}).map(([k, t]) => (
                        <option key={k} value={k}>{t.label} (${t.costo})</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mano de obra */}
      <div style={S.card}>
        <div style={S.header}>Mano de obra por presentación (MXN)</div>
        <div style={S.desc}>
          Costo de mano de obra por unidad envasada (incluye dispenser, sellado, etiquetado).
        </div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Presentación</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Costo MO</th>
            </tr>
          </thead>
          <tbody>
            {PRESENTACIONES.map(p => (
              <tr key={p.key}>
                <td style={S.td}>{p.label}</td>
                <td style={S.tdR}>
                  <input
                    type="number" step="0.5" min="0"
                    style={S.input}
                    value={cfg.manoObra?.[p.key] ?? ''}
                    onChange={(e) => updateNested(`manoObra.${p.key}`, parseFloat(e.target.value) || 0)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Merma */}
      <div style={S.card}>
        <div style={S.header}>Merma global (%)</div>
        <div style={S.desc}>
          Porcentaje aplicado al costo MP para cubrir merma de producción (residuos en mezcla, salpicado, etc.).
        </div>
        <input
          type="number" step="0.001" min="0" max="0.20"
          style={{ ...S.input, width: 110 }}
          value={cfg.mermaPct ?? 0.015}
          onChange={(e) => updateNested('mermaPct', parseFloat(e.target.value) || 0)}
        />
        <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--lp-text-secondary)' }}>
          = {((cfg.mermaPct || 0) * 100).toFixed(2)}%
        </span>
        <div style={S.hint}>
          Default 0.015 (1.5%). Aplicado como: <code>costoMP × mermaPct = costoMerma</code>
        </div>
      </div>

      {/* Botón guardar */}
      <div style={S.saveBar}>
        <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
          Última actualización: {cfg._meta?.ultimaActualizacion || '—'}
          {cfg._meta?.actualizadoPor && ` · ${cfg._meta.actualizadoPor}`}
        </div>
        <button style={S.saveBtn(saveState)} onClick={guardar}>
          {saveState === 'saving' ? 'Guardando…' :
           saveState === 'saved' ? '✓ Guardado' :
           saveState === 'err' ? 'Error · reintentar' :
           'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
