/* MezclasView — pestaña propia de Mezclar (31-ago-2026, pedido dueño:
   "una pestaña nueva para Mezclar colores"; el 28-ago salió el botón + modal y
   quedó pendiente la pestaña con su historial).

   Enseña el HISTORIAL de mezclas —qué se fusionó, cuándo, quién, lote
   resultante— desde GET /api/stk-americano/mezclas (el ledger, incluido el
   archivo frío: las mezclas viejas no desaparecen al rotar el log), y trae el
   botón Mezclar aquí mismo, con selector de almacén porque la pestaña no
   pertenece a uno solo. El modal es EL MISMO del botón original: una sola
   implementación del asistente. */
import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import MezclarAmericanoModal from './MezclarAmericanoModal';

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 14 },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  titulo: { fontSize: 14, fontWeight: 800, color: 'var(--lp-text-primary)', margin: 0 },
  sub: { fontSize: 12, color: 'var(--lp-text-tertiary)', marginTop: 2 },
  derecha: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  seg: { display: 'flex', gap: 4, background: 'var(--lp-bg-raised)', borderRadius: 999, padding: 3, border: '1px solid var(--lp-border-subtle)' },
  segBtn: (on) => ({ padding: '6px 12px', minHeight: 32, borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--lp-font-sans)', fontSize: 12, fontWeight: on ? 700 : 500, background: on ? 'var(--lp-brand-600)' : 'transparent', color: on ? '#fff' : 'var(--lp-text-secondary)' }),
  btnMezclar: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--lp-brand-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  card: { border: '1px solid var(--lp-border-subtle)', borderRadius: 10, background: 'var(--lp-bg-raised)', padding: '12px 16px' },
  cardHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  destino: { fontSize: 14, fontWeight: 800, color: 'var(--lp-text-primary)' },
  nuevoBadge: { display: 'inline-block', marginLeft: 8, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--lp-brand-600) 14%, transparent)', color: 'var(--lp-brand-700)' },
  fecha: { fontSize: 12, color: 'var(--lp-text-tertiary)' },
  compo: { fontSize: 13, color: 'var(--lp-text-secondary)', marginTop: 6, lineHeight: 1.6 },
  meta: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: 'var(--lp-text-tertiary)' },
  lote: { fontFamily: 'var(--lp-font-mono, monospace)', fontWeight: 700, color: 'var(--lp-text-primary)' },
  vacio: { padding: '36px 16px', textAlign: 'center', color: 'var(--lp-text-tertiary)', fontSize: 13, border: '1.5px dashed var(--lp-border-subtle)', borderRadius: 10 },
  err: { background: 'var(--lp-danger-50, #FEE2E2)', color: 'var(--lp-danger-700, #991B1B)', padding: '10px 12px', borderRadius: 8, fontSize: 12 },
  toast: { position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 1200, background: 'var(--lp-text-primary)', color: 'var(--lp-bg-raised)', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.2)' },
};

const UBIC = { teran: 'Terán', almacen2: 'Almacén 2' };
const fmtFecha = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function MezclasView({ colores1 = [], colores2 = [], reload1, reload2, canEdit = false }) {
  const [mezclas, setMezclas] = useState(null);   /* null = cargando */
  const [toast, setToast] = useState('');
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };
  const [error, setError] = useState('');
  const [almacenMezcla, setAlmacenMezcla] = useState('1');
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(() => {
    api.getMezclasAmericano(100)
      .then(r => { setMezclas((r && r.mezclas) || []); setError(''); })
      .catch(e => { setMezclas([]); setError(e.message || 'No se pudo cargar el historial'); });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div style={S.wrap}>
      <div style={S.topRow}>
        <div>
          <h3 style={S.titulo}>Mezclas</h3>
          <div style={S.sub}>Totes que se fusionan físicamente para crear un color nuevo — con su lote y su composición.</div>
        </div>
        {canEdit && (
          <div style={S.derecha}>
            <div style={S.seg} role="group" aria-label="Almacén de la mezcla">
              <button type="button" style={S.segBtn(almacenMezcla === '1')} data-id="mezclas.almacen.1" onClick={() => setAlmacenMezcla('1')}>Terán</button>
              <button type="button" style={S.segBtn(almacenMezcla === '2')} data-id="mezclas.almacen.2" onClick={() => setAlmacenMezcla('2')}>Alm. 2</button>
            </div>
            <button style={S.btnMezclar} data-id="mezclas.btn.mezclar" data-rol="admin,almacen" onClick={() => setAbierto(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Mezclar
            </button>
          </div>
        )}
      </div>

      {error && <div style={S.err}>{error} — reintenta recargando la página.</div>}

      {mezclas === null && <div style={S.vacio}>Cargando historial…</div>}

      {Array.isArray(mezclas) && mezclas.length === 0 && !error && (
        <div style={S.vacio} data-id="mezclas.vacio">
          Aún no hay mezclas registradas.{canEdit ? ' La primera se hace con el botón "Mezclar" de arriba.' : ''}
        </div>
      )}

      {Array.isArray(mezclas) && mezclas.map(m => (
        <div key={m.id || m.fecha} style={S.card} data-id="mezclas.card">
          <div style={S.cardHead}>
            <div style={S.destino}>
              {m.producto}
              {m.colorNuevo && <span style={S.nuevoBadge}>COLOR NUEVO</span>}
            </div>
            <div style={S.fecha}>{fmtFecha(m.fecha)} · {UBIC[m.ubicacion] || m.ubicacion || ''}</div>
          </div>
          <div style={S.compo}>
            {(Array.isArray(m.composicion) && m.composicion.length)
              ? m.composicion.map(c => `${c.color || c.producto || '?'} ${c.litros} L`).join('  +  ')
              : (m.nota || 'Sin composición registrada')}
            {' '}→ <strong>{m.cantidad} L</strong>
            {m.mermaLitros > 0 && <span> (merma {m.mermaLitros} L)</span>}
          </div>
          <div style={S.meta}>
            <span>Lote <span style={S.lote}>{m.lote || (Array.isArray(m.tambos) ? m.tambos.join(', ') : '')}</span></span>
            {Array.isArray(m.tambos) && m.tambos.length > 1 && <span>{m.tambos.length} tambos</span>}
            <span>Mezcló {m.mezcladoPor || m.usuario || '?'}</span>
            {m.mezcladoPor && m.usuario && m.mezcladoPor !== m.usuario && <span>Capturó {m.usuario}</span>}
          </div>
        </div>
      ))}

      {abierto && (
        <MezclarAmericanoModal
          colores={almacenMezcla === '2' ? colores2 : colores1}
          almacen={almacenMezcla}
          onClose={() => setAbierto(false)}
          onSaved={(r) => {
            const lote = (r && r.lote) || '';
            const nom = (r && r.color && r.color.nombre) || '';
            showToast(`Mezcla lista${nom ? `: ${nom}` : ''}${lote ? ` · lote ${lote}` : ''}`);
            setAbierto(false);
            cargar();
            const reload = almacenMezcla === '2' ? reload2 : reload1;
            reload && reload();
          }}
        />
      )}
      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
