import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import SesionMapaModal from './SesionMapaModal';
import SegmentedControl from '../../components/ui/SegmentedControl';

const S = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  search: {
    flex: 1,
    minWidth: 200,
    padding: '10px 14px',
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)',
    fontSize: 13,
    fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)',
    color: 'var(--lp-text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  reloadBtn: {
    padding: '8px 14px',
    fontSize: 11,
    fontWeight: 600,
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    background: 'var(--lp-bg-raised)',
    cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)',
    color: 'var(--lp-text-primary)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  card: (alerta) => ({
    background: alerta ? 'var(--lp-danger-50)' : 'var(--lp-bg-raised)',
    border: alerta ? '1.5px solid var(--lp-danger-500)' : '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    padding: 12,
    display: 'grid',
    gridTemplateColumns: '40px 1fr auto',
    gap: 12,
    alignItems: 'center',
  }),
  avatar: (alerta) => ({
    width: 40,
    height: 40,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: alerta ? 'var(--lp-danger-600)' : 'var(--lp-brand-600)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
  }),
  info: { minWidth: 0 },
  line1: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--lp-text-primary)',
    marginBottom: 3,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  rolPill: {
    fontSize: 11,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 4,
    background: 'var(--lp-bg-sunken)',
    color: 'var(--lp-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  alertPill: {
    fontSize: 11,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 4,
    background: 'var(--lp-danger-600)',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  line2: {
    fontSize: 11,
    color: 'var(--lp-text-tertiary)',
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  meta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: '7px 12px',
    fontSize: 11,
    fontWeight: 600,
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    background: 'var(--lp-bg-raised)',
    cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)',
    color: 'var(--lp-text-primary)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  iconBtnDisabled: {
    color: 'var(--lp-text-tertiary)',
    cursor: 'default',
    background: 'var(--lp-bg-sunken)',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--lp-text-tertiary)',
    padding: '40px 0',
    fontSize: 13,
  },
  loading: {
    textAlign: 'center',
    padding: '40px 0',
    fontSize: 13,
    color: 'var(--lp-text-tertiary)',
  },
  errBox: {
    background: 'var(--lp-danger-100)',
    color: 'var(--lp-danger-700)',
    padding: 10,
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12,
  },
};

function fmtFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMin = (now - d) / 60000;
  if (diffMin < 1) return 'hace seg.';
  if (diffMin < 60) return `hace ${Math.round(diffMin)} min`;
  if (diffMin < 60 * 24) return `hace ${Math.round(diffMin / 60)} h`;
  if (diffMin < 60 * 24 * 7) return `hace ${Math.round(diffMin / (60 * 24))} d`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SesionesPanel() {
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('todas');
  const [search, setSearch] = useState('');
  const [mapaSesion, setMapaSesion] = useState(null);

  const cargar = () => {
    setLoading(true);
    api.get('/api/sesiones-log')
      .then(data => {
        const arr = Array.isArray(data) ? data : (data.data || data.sesiones || []);
        setSesiones(arr);
      })
      .catch(e => setErr(e.message || 'Error al cargar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const filtradas = useMemo(() => {
    let arr = [...sesiones].reverse();
    if (filter === 'normales') arr = arr.filter(s => !s.alerta && !(s.tipo || '').includes('alerta'));
    else if (filter === 'alertas') arr = arr.filter(s => s.alerta || (s.tipo || '').includes('alerta'));
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(s =>
        (s.usuario || '').toLowerCase().includes(q) ||
        (s.rol || '').toLowerCase().includes(q) ||
        (s.navegador || '').toLowerCase().includes(q) ||
        (s.ipServidor || '').includes(q)
      );
    }
    return arr;
  }, [sesiones, filter, search]);

  const totales = useMemo(() => ({
    total: sesiones.length,
    alertas: sesiones.filter(s => s.alerta || (s.tipo || '').includes('alerta')).length,
  }), [sesiones]);

  return (
    <div>
      <div style={S.toolbar}>
        <input
          style={S.search}
          type="text"
          placeholder="Buscar por usuario, rol, navegador o IP..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todas', label: `Todas (${totales.total})` },
            { value: 'normales', label: 'Normales' },
            { value: 'alertas', label: `Alertas (${totales.alertas})` },
          ]}
          color="brand"
        />
        <button style={S.reloadBtn} onClick={cargar} title="Recargar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
          Recargar
        </button>
      </div>

      {loading && <div style={S.loading}>Cargando sesiones...</div>}
      {err && !loading && <div style={S.errBox}>{err}</div>}

      {!loading && !err && (
        <div style={S.list}>
          {filtradas.length === 0 ? (
            <div style={S.empty}>Sin sesiones que coincidan con el filtro</div>
          ) : (
            filtradas.map((s, idx) => {
              const alerta = !!s.alerta || (s.tipo || '').includes('alerta');
              const tieneGPS = s.geoLatitud != null && s.geoLongitud != null;
              return (
                <div key={idx} style={S.card(alerta)}>
                  <div style={S.avatar(alerta)}>
                    {(s.usuario || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={S.info}>
                    <div style={S.line1}>
                      <span>{s.usuario || '?'}</span>
                      {s.rol && <span style={S.rolPill}>{s.rol}</span>}
                      {alerta && <span style={S.alertPill}>{s.tipo || 'alerta'}</span>}
                    </div>
                    <div style={S.line2}>
                      <span style={S.meta}>{fmtFecha(s.fecha)}</span>
                      {s.navegador && <span style={S.meta}>· {s.navegador}</span>}
                      {s.sistemaOperativo && <span style={S.meta}>· {s.sistemaOperativo}</span>}
                      {s.ipServidor && <span style={S.meta}>· IP {s.ipServidor}</span>}
                      {tieneGPS && (
                        <span style={S.meta} title={`Lat ${s.geoLatitud.toFixed(4)}, Lng ${s.geoLongitud.toFixed(4)}`}>
                          · {s.geoLatitud.toFixed(3)}, {s.geoLongitud.toFixed(3)}
                          {s.geoAccuracy && ` (±${Math.round(s.geoAccuracy)}m)`}
                        </span>
                      )}
                      {s.geoError && (
                        <span style={{ ...S.meta, color: 'var(--lp-danger-600)' }}>
                          · {s.geoError}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    style={tieneGPS ? S.iconBtn : { ...S.iconBtn, ...S.iconBtnDisabled }}
                    onClick={tieneGPS ? () => setMapaSesion(s) : undefined}
                    disabled={!tieneGPS}
                    title={tieneGPS ? 'Ver ubicacion en mapa' : 'Sin coordenadas GPS'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {tieneGPS ? 'Mapa' : 'sin GPS'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {mapaSesion && (
        <SesionMapaModal sesion={mapaSesion} onClose={() => setMapaSesion(null)} />
      )}
    </div>
  );
}
