/* ═══════════════════════════════════════════════════════════════════
   PosAliasesTab — Gestión de aliases POS (productos Terán → fórmulas)
   Reemplaza el mapping hardcoded por un sistema editable y auditable.
   Diseño LP estricto (BRIEF_IDENTIDAD.md §5).
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useMemo, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import SegmentedControl from '../../components/ui/SegmentedControl';

const TIPO_INFO = {
  propio:     { label: 'Propio',     bg: 'var(--lp-success-100)', fg: 'var(--lp-success-700)', border: 'var(--lp-success-500)' },
  huerfano:   { label: 'Huérfano',   bg: 'var(--lp-warning-100)', fg: 'var(--lp-warning-700)', border: 'var(--lp-warning-500)' },
  reventa:    { label: 'Reventa',    bg: 'var(--lp-brand-100)',   fg: 'var(--lp-brand-700)',   border: 'var(--lp-brand-500)' },
  no_pintura: { label: 'No pintura', bg: 'var(--lp-bg-sunken)',   fg: 'var(--lp-text-secondary)', border: 'var(--lp-border-subtle)' },
};

const S = {
  wrap: { padding: '0 0 80px' },
  header: { marginBottom: 14 },
  title: { fontSize: 18, fontWeight: 800, color: 'var(--lp-text-primary)' },
  meta:  { fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 4 },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 16 },
  kpi: (accent) => ({
    background: 'var(--lp-bg-raised)', border: '1.5px solid var(--lp-border-subtle)',
    borderTop: `3px solid ${accent}`, borderRadius: 'var(--lp-radius-sm, 6px)',
    padding: '14px 16px', textAlign: 'center',
  }),
  kpiLabel: { fontSize: 11, fontWeight: 700, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em' },
  kpiValue: { fontSize: 22, fontWeight: 800, fontFamily: 'var(--lp-font-mono)', color: 'var(--lp-text-primary)', marginTop: 4 },
  kpiSub: { fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 2, fontFamily: 'var(--lp-font-mono)' },

  toolbar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  search: {
    flex: 1, minWidth: 220, padding: '10px 14px', borderRadius: 8,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: '#fff', boxSizing: 'border-box',
  },

  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 },
  card: (tipo) => {
    const c = TIPO_INFO[tipo] || TIPO_INFO.huerfano;
    return {
      background: 'var(--lp-bg-raised)',
      border: '1.5px solid var(--lp-border-subtle)',
      borderLeft: `4px solid ${c.border}`,
      borderRadius: 'var(--lp-radius, 10px)',
      padding: 12,
    };
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  posName: { fontSize: 13, fontWeight: 700, color: 'var(--lp-text-primary)', wordBreak: 'break-word' },
  formulaActual: { fontSize: 11, color: 'var(--lp-text-secondary)', marginTop: 2 },
  badge: (tipo) => {
    const c = TIPO_INFO[tipo] || TIPO_INFO.huerfano;
    return {
      display: 'inline-flex', padding: '3px 8px', fontSize: 10, fontWeight: 700,
      background: c.bg, color: c.fg, borderRadius: 6,
      textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap',
    };
  },

  metrics: { display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--lp-text-secondary)' },
  metricVal: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-text-primary)' },

  actions: { display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  btn: (kind) => {
    const map = {
      primary: { bg: 'var(--lp-brand-600)', fg: '#fff', bd: 'var(--lp-brand-600)' },
      ghost:   { bg: 'var(--lp-bg-raised)', fg: 'var(--lp-text-secondary)', bd: 'var(--lp-border-subtle)' },
    };
    const c = map[kind] || map.ghost;
    return {
      padding: '7px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6,
      background: c.bg, color: c.fg, border: '1.5px solid ' + c.bd,
      cursor: 'pointer', fontFamily: 'inherit',
    };
  },

  empty: { textAlign: 'center', padding: '60px 20px', color: 'var(--lp-text-tertiary)' },

  /* Modal */
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000,
             display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--lp-bg-raised)', borderRadius: 14, width: '100%', maxWidth: 440,
           maxHeight: '90vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.18)' },
  modalHead: { padding: '16px 20px', borderBottom: '1px solid var(--lp-border-subtle)' },
  modalTitle: { fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)' },
  modalSub: { fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 4 },
  modalBody: { padding: '16px 20px' },
  modalFoot: { padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)',
               display: 'flex', justifyContent: 'flex-end', gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)',
                textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6, display: 'block' },
  select: { width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
            border: '1.5px solid var(--lp-border-subtle)', background: '#fff',
            boxSizing: 'border-box', marginBottom: 12, fontFamily: 'inherit' },
};

export default function PosAliasesTab() {
  const [filtro, setFiltro] = useState('huerfano');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const [errorBackend, setErrorBackend] = useState(null);
  const { data: stats, reload: reloadStats } = useApiData(async () => {
    try { return await api.getPosAliasesStats(); }
    catch (e) {
      const msg = e?.message || String(e);
      if (msg.includes('404') || msg.includes('Not Found') || msg.includes('Endpoint no encontrado')) {
        setErrorBackend('endpoint-no-existe');
      }
      return null;
    }
  }, [], 30000);
  const { data, loading, reload: reloadList } = useApiData(
    async () => {
      try { return await api.getPosAliases(filtro === 'todos' ? null : filtro); }
      catch (e) {
        const msg = e?.message || String(e);
        if (msg.includes('404') || msg.includes('Not Found') || msg.includes('Endpoint no encontrado')) {
          setErrorBackend('endpoint-no-existe');
        }
        return null;
      }
    },
    [filtro],
    30000,
  );
  /* Recargar AMBOS — stats (KPIs de arriba) y lista (cards de abajo) — al editar */
  const reload = useCallback(() => { reloadList(); reloadStats(); }, [reloadList, reloadStats]);

  /* Catálogo de fórmulas para el dropdown */
  const [formulas, setFormulas] = useState([]);
  useEffect(() => {
    api.getFormulasSummary().then(r => {
      const arr = r?.data?.summary || r?.summary || [];
      setFormulas(arr.map(f => f.nombre).sort());
    }).catch(() => {});
  }, []);

  const items = useMemo(() => {
    const arr = data?.items || [];
    let out = arr;
    if (search.trim()) {
      const q = search.toLowerCase();
      out = arr.filter(it =>
        (it.nombre_pos || '').toLowerCase().includes(q) ||
        (it.formula || '').toLowerCase().includes(q) ||
        (it.reventa_marca || '').toLowerCase().includes(q)
      );
    }
    /* Ordenar por monto descendente — los de mayor valor primero */
    out = [...out].sort((a, b) => (b.monto || 0) - (a.monto || 0));
    return out;
  }, [data, search]);

  const sStats = stats?.stats || {};
  const totalMonto = ['propio','huerfano','reventa','no_pintura']
    .reduce((s, k) => s + (sStats[k]?.monto || 0), 0);

  const handleAsignar = useCallback(async (nombre_pos, body) => {
    try {
      await api.asignarPosAlias({ nombre_pos, ...body });
      setEditing(null);
      reload();
    } catch (e) {
      alert('Error al guardar: ' + (e.message || 'desconocido'));
    }
  }, [reload]);

  const fmt = (n) => Math.round(n).toLocaleString();

  /* Server viejo sin los endpoints /api/pos/aliases — aviso accionable */
  if (errorBackend === 'endpoint-no-existe') {
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          background: 'var(--lp-warning-50, #FFFBEB)',
          border: '2px solid var(--lp-warning-500)',
          borderRadius: 'var(--lp-radius)',
          padding: 20, maxWidth: 560, margin: '40px auto', textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>⚠</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--lp-warning-700)' }}>
            Server desactualizado
          </div>
          <div style={{ fontSize: 13, color: 'var(--lp-text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
            El sistema de aliases POS está listo (5,263 productos clasificados),
            pero el backend que está corriendo aún no tiene los endpoints
            <code style={{ background: 'var(--lp-bg-sunken)', padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>/api/pos/aliases/*</code>.
            <br /><br />
            <strong>Para activarla:</strong>
          </div>
          <ol style={{ textAlign: 'left', fontSize: 13, color: 'var(--lp-text-primary)', lineHeight: 1.8, paddingLeft: 24, margin: '0 0 14px' }}>
            <li>Cierra todas las ventanas del backend (puerto 3000)</li>
            <li>Doble click en <code style={{ background: 'var(--lp-bg-sunken)', padding: '2px 6px', borderRadius: 4 }}>reiniciar.bat</code></li>
            <li>Hard refresh (<code>Ctrl+Shift+R</code>)</li>
          </ol>
          <button
            style={{
              padding: '10px 20px', borderRadius: 8,
              background: 'var(--lp-brand-600)', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
            onClick={() => window.location.reload()}
          >
            Recargar pantalla
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={S.title}>Aliases POS — Mapeo de productos Terán a fórmulas</div>
        <div style={S.meta}>
          {data?.meta?.productos_unicos || 0} productos únicos · mapeados vía <code>pos_aliases.json</code> ·
          editable por admin/compras
        </div>
      </div>

      {/* KPIs por tipo */}
      <div style={S.kpiGrid}>
        {['propio', 'huerfano', 'reventa', 'no_pintura'].map(tipo => {
          const t = sStats[tipo] || { n:0, cubeq:0, monto:0 };
          const c = TIPO_INFO[tipo];
          const pct = totalMonto > 0 ? (t.monto / totalMonto * 100).toFixed(1) : '0.0';
          return (
            <div key={tipo} style={S.kpi(c.border)}>
              <div style={S.kpiLabel}>{c.label}</div>
              <div style={S.kpiValue}>{t.n}</div>
              <div style={S.kpiSub}>${fmt(t.monto)} · {pct}%</div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input type="search" placeholder="Buscar producto, fórmula o marca..." style={S.search}
          value={search} onChange={e => setSearch(e.target.value)} />
        <SegmentedControl
          value={filtro}
          onChange={setFiltro}
          color="brand"
          options={[
            { value: 'huerfano',   label: `Huérfanos (${sStats.huerfano?.n || 0})` },
            { value: 'propio',     label: `Propio (${sStats.propio?.n || 0})` },
            { value: 'reventa',    label: `Reventa (${sStats.reventa?.n || 0})` },
            { value: 'no_pintura', label: `No pintura (${sStats.no_pintura?.n || 0})` },
            { value: 'todos',      label: 'Todos' },
          ]}
        />
      </div>

      {/* Lista */}
      {loading && !data ? (
        <div style={S.empty}>
          <div className="lp-spinner" style={{ margin: '0 auto' }} />
          <div style={{ marginTop: 12 }}>Cargando aliases…</div>
        </div>
      ) : items.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{filtro === 'huerfano' ? '🎉' : '∅'}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lp-text-secondary)' }}>
            {filtro === 'huerfano' ? 'Todos los productos están mapeados' : 'Sin resultados'}
          </div>
        </div>
      ) : (
        <div style={S.cardGrid}>
          {items.slice(0, 200).map(it => (
            <AliasCard key={it.nombre_pos} it={it} onEdit={() => setEditing(it)} />
          ))}
          {items.length > 200 && (
            <div style={S.empty}>
              … y {items.length - 200} más. Refina con el buscador.
            </div>
          )}
        </div>
      )}

      {/* Modal de edición */}
      {editing && (
        <EditModal
          item={editing}
          formulas={formulas}
          onClose={() => setEditing(null)}
          onSave={(body) => handleAsignar(editing.nombre_pos, body)}
        />
      )}
    </div>
  );
}

function AliasCard({ it, onEdit }) {
  const fmt = (n) => Math.round(n).toLocaleString();
  /* Precio promedio por cubeta-equivalente (19L). Sirve para detectar
     productos premium vs económicos rápidamente. Si cubeq=0 mostramos —. */
  const cubeq = parseFloat(it.cubetas_equiv) || 0;
  const monto = parseFloat(it.monto) || 0;
  const precioUnit = cubeq > 0 ? monto / cubeq : 0;
  /* Color del precio según escala — solo informativo */
  const precioColor =
      precioUnit >= 1500 ? 'var(--lp-brand-700)'   /* premium */
    : precioUnit >= 800  ? 'var(--lp-text-primary)'  /* normal */
    : precioUnit > 0     ? 'var(--lp-text-secondary)' /* económico */
                         : 'var(--lp-text-tertiary)';

  return (
    <div style={S.card(it.tipo)}>
      <div style={S.cardHead}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.posName}>{it.nombre_pos}</div>
          {it.formula && (
            <div style={S.formulaActual}>→ <strong>{it.formula}</strong></div>
          )}
          {it.reventa_marca && (
            <div style={S.formulaActual}>{it.reventa_marca}</div>
          )}
          {it._editado_manual && (
            <div style={{ fontSize: 11, color: 'var(--lp-brand-600)', marginTop: 2 }}>
              ✎ {it._editado_por}
            </div>
          )}
        </div>
        <span style={S.badge(it.tipo)}>{TIPO_INFO[it.tipo]?.label}</span>
      </div>

      <div style={S.metrics}>
        <span>Cubeq <span style={S.metricVal}>{fmt(cubeq)}</span></span>
        <span>Monto <span style={S.metricVal}>${fmt(monto)}</span></span>
        <span title="Precio promedio por cubeta equivalente (19L)">
          Precio unit. <span style={{ ...S.metricVal, color: precioColor }}>
            {precioUnit > 0 ? `$${fmt(precioUnit)}` : '—'}
          </span>
        </span>
      </div>

      <div style={S.actions}>
        <button style={S.btn('primary')} onClick={onEdit}>Reasignar</button>
      </div>
    </div>
  );
}

function EditModal({ item, formulas, onClose, onSave }) {
  const [tipo, setTipo] = useState(item.tipo || 'huerfano');
  const [formula, setFormula] = useState(item.formula || '');
  const [reventaMarca, setReventaMarca] = useState(item.reventa_marca || '');
  const [razonNoPintura, setRazonNoPintura] = useState(item.razon_no_pintura || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        tipo,
        formula: tipo === 'propio' ? formula : null,
        reventa_marca: tipo === 'reventa' ? reventaMarca : null,
        razon_no_pintura: tipo === 'no_pintura' ? razonNoPintura : null,
      });
    } finally {
      setSaving(false);
    }
  };

  const valid = tipo === 'huerfano'
              || (tipo === 'propio' && formula)
              || (tipo === 'reventa' && reventaMarca.trim())
              || (tipo === 'no_pintura' && razonNoPintura.trim());

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHead}>
          <div style={S.modalTitle}>Reasignar alias</div>
          <div style={S.modalSub}>{item.nombre_pos}</div>
        </div>

        <div style={S.modalBody}>
          <label style={S.fieldLabel}>Tipo</label>
          <select style={S.select} value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="propio">Propio (mapear a fórmula)</option>
            <option value="reventa">Reventa (producto de tercero)</option>
            <option value="no_pintura">No pintura (excluir)</option>
            <option value="huerfano">Huérfano (sin asignar)</option>
          </select>

          {tipo === 'propio' && (
            <>
              <label style={S.fieldLabel}>Fórmula propia</label>
              <select style={S.select} value={formula} onChange={e => setFormula(e.target.value)}>
                <option value="">— selecciona —</option>
                {formulas.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </>
          )}

          {tipo === 'reventa' && (
            <>
              <label style={S.fieldLabel}>Marca de reventa</label>
              <select style={S.select} value={reventaMarca} onChange={e => setReventaMarca(e.target.value)}>
                <option value="">— selecciona —</option>
                <option value="reventa_sayer">Sayer</option>
                <option value="reventa_sayer_facilita">Sayer Facilita</option>
                <option value="reventa_atlas">Atlas / Atlas Forte</option>
                <option value="reventa_comex">Comex</option>
                <option value="reventa_berel">Berel</option>
                <option value="reventa_sherwin">Sherwin Williams</option>
                <option value="reventa_km">KM</option>
                <option value="reventa_otro">Otro</option>
              </select>
            </>
          )}

          {tipo === 'no_pintura' && (
            <>
              <label style={S.fieldLabel}>Razón</label>
              <select style={S.select} value={razonNoPintura} onChange={e => setRazonNoPintura(e.target.value)}>
                <option value="">— selecciona —</option>
                <option value="no_pintura_solvente">Solvente (thinner, aguarrás)</option>
                <option value="no_pintura_imper">Impermeabilizante</option>
                <option value="no_pintura_sellador">Sellador (no 5x1)</option>
                <option value="no_pintura_acabado_madera">Barniz / laca</option>
                <option value="no_pintura_pasta">Pasta / sanitario</option>
                <option value="no_pintura_otro">Otro</option>
              </select>
            </>
          )}

          {(() => {
            const cubeq = parseFloat(item.cubetas_equiv) || 0;
            const monto = parseFloat(item.monto) || 0;
            const precioUnit = cubeq > 0 ? monto / cubeq : 0;
            return (
              <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)', marginTop: 4, lineHeight: 1.6 }}>
                Cubeq histórico: <strong>{Math.round(cubeq).toLocaleString()}</strong> ·
                Monto: <strong>${Math.round(monto).toLocaleString()}</strong>
                {precioUnit > 0 && (
                  <> · Precio prom: <strong>${Math.round(precioUnit).toLocaleString()}</strong>/cubeq</>
                )}
              </div>
            );
          })()}
        </div>

        <div style={S.modalFoot}>
          <button style={S.btn('ghost')} onClick={onClose}>Cancelar</button>
          <button style={S.btn('primary')} disabled={!valid || saving} onClick={handleSave}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
