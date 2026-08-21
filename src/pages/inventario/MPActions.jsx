import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(26,24,21,.5)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'auto', padding: 16,
  },
  modal: {
    background: 'var(--lp-bg-raised)', borderRadius: 'var(--lp-radius)',
    border: '1.5px solid var(--lp-border-subtle)',
    maxWidth: 480, width: '100%',
    maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    padding: '14px 18px', borderBottom: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 14, fontWeight: 700 },
  close: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: 22, color: 'var(--lp-text-tertiary)', padding: 4, lineHeight: 1,
  },
  body: { padding: 16, overflowY: 'auto', flex: 1 },
  footer: {
    padding: '12px 16px', borderTop: '1.5px solid var(--lp-border-subtle)',
    display: 'flex', gap: 8, justifyContent: 'flex-end',
  },
  btnGhost: {
    padding: '8px 14px', fontSize: 12, fontWeight: 600,
    borderRadius: 'var(--lp-radius-sm)',
    border: '1.5px solid var(--lp-border-subtle)',
    background: 'var(--lp-bg-raised)', cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)',
  },
  btnDanger: {
    padding: '8px 14px', fontSize: 12, fontWeight: 700,
    borderRadius: 'var(--lp-radius-sm)', border: 'none',
    background: 'var(--lp-danger-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
  },
  btnPrimary: {
    padding: '8px 14px', fontSize: 12, fontWeight: 700,
    borderRadius: 'var(--lp-radius-sm)', border: 'none',
    background: 'var(--lp-brand-600)', color: '#fff',
    cursor: 'pointer', fontFamily: 'var(--lp-font-sans)',
  },
  warn: {
    background: 'var(--lp-warning-100)', color: 'var(--lp-warning-700)',
    padding: 10, borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12, lineHeight: 1.6, marginBottom: 12,
  },
  err: {
    background: 'var(--lp-danger-100)', color: 'var(--lp-danger-700)',
    padding: 10, borderRadius: 'var(--lp-radius-sm)',
    fontSize: 12, marginBottom: 12,
  },
  formulasList: {
    background: 'var(--lp-bg-sunken)', borderRadius: 'var(--lp-radius-sm)',
    padding: 10, fontSize: 11, fontFamily: 'var(--lp-font-mono)',
    maxHeight: 180, overflowY: 'auto',
  },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--lp-text-secondary)',
    textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6,
  },
  input: {
    width: '100%', padding: '10px 12px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 'var(--lp-radius-sm)',
    fontSize: 13, fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)',
    boxSizing: 'border-box',
  },
};

/* ────────── ELIMINAR MP MODAL ────────── */
export function EliminarMPModal({ mp, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [check, setCheck] = useState(null);
  const [forzar, setForzar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  /* MÓVIL: este modal sólo se monta cuando está abierto, así que bloqueamos el
     scroll del fondo siempre que esté en el árbol. El hook publica --pp-vvh que
     usa S.modal en su maxHeight para que S.body tenga overflow interno. */
  useBodyScrollLock(true);

  useEffect(() => {
    api.checkMPFormulas(mp)
      .then(r => setCheck(r))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [mp]);

  const eliminar = async () => {
    setSaving(true);
    setErr('');
    try {
      const r = await api.eliminarMP(mp, forzar);
      if (r.bloqueado) {
        setErr('La MP está vinculada a fórmulas. Marca "Forzar eliminación" o usa Sustituir.');
        setSaving(false);
        return;
      }
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e.message || 'Error');
      setSaving(false);
    }
  };

  const formulasVinculadas = check?.formulasVinculadas || check?.formulas || [];
  const tieneFormulas = formulasVinculadas.length > 0;

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.header}>
          <div style={S.title}>Eliminar MP — {mp}</div>
          <button style={S.close} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.body}>
          {loading && <div style={{ textAlign: 'center', padding: 20, color: 'var(--lp-text-tertiary)' }}>Verificando vínculos...</div>}
          {err && <div style={S.err}>{err}</div>}
          {!loading && tieneFormulas && (
            <>
              <div style={S.warn}>
                Esta MP está vinculada a <strong>{formulasVinculadas.length} fórmula(s)</strong>.
                Eliminarla las dejará incompletas. Considera usar <strong>Sustituir</strong> en su lugar.
              </div>
              <div style={{ ...S.label, marginBottom: 6 }}>Fórmulas vinculadas</div>
              <div style={S.formulasList}>
                {formulasVinculadas.map((f, i) => <div key={i}>· {f}</div>)}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={forzar}
                  onChange={(e) => setForzar(e.target.checked)}
                  style={{ accentColor: 'var(--lp-danger-600)', width: 14, height: 14 }}
                />
                <span style={{ color: 'var(--lp-danger-700)', fontWeight: 600 }}>
                  Forzar eliminación (las fórmulas quedarán incompletas)
                </span>
              </label>
            </>
          )}
          {!loading && !tieneFormulas && (
            <div style={{ fontSize: 13, color: 'var(--lp-text-secondary)', lineHeight: 1.6 }}>
              No hay fórmulas vinculadas a esta MP. Se puede eliminar de forma segura.
              Se conservará el historial para auditoría.
            </div>
          )}
        </div>
        <div style={S.footer}>
          <button style={S.btnGhost} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btnDanger}
            onClick={eliminar}
            disabled={saving || loading || (tieneFormulas && !forzar)}
          >
            {saving ? 'Eliminando...' : 'Eliminar permanentemente'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────── SUSTITUIR MP MODAL ────────── */
export function SustituirMPModal({ mp, mpsDisponibles, onClose, onSaved }) {
  const [sustituta, setSustituta] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  /* MÓVIL: este modal sólo se monta cuando está abierto, así que bloqueamos el
     scroll del fondo siempre que esté en el árbol. El hook publica --pp-vvh que
     usa S.modal en su maxHeight para que S.body tenga overflow interno. */
  useBodyScrollLock(true);

  const sustituir = async () => {
    setErr('');
    if (!sustituta) return setErr('Selecciona la MP sustituta');
    if (sustituta === mp) return setErr('La MP sustituta debe ser diferente');
    setSaving(true);
    try {
      await api.sustituirMP(mp, sustituta);
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setErr(e.message || 'Error al sustituir');
      setSaving(false);
    }
  };

  const opciones = (mpsDisponibles || []).filter(m => m !== mp);

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.header}>
          <div style={S.title}>Sustituir MP — {mp}</div>
          <button style={S.close} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.body}>
          <div style={S.warn}>
            Sustituir actualizará todas las fórmulas que usan <strong>{mp}</strong> con la nueva MP,
            transferirá el stock existente y marcará <strong>{mp}</strong> como eliminada.
          </div>
          {err && <div style={S.err}>{err}</div>}
          <div style={{ marginBottom: 12 }}>
            <div style={S.label}>MP sustituta</div>
            <input
              style={S.input}
              type="text"
              list="mps-disponibles"
              value={sustituta}
              onChange={(e) => setSustituta(e.target.value)}
              placeholder="Buscar MP..."
            />
            <datalist id="mps-disponibles">
              {opciones.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>
          <div style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
            La MP sustituta debe existir ya en el inventario. Hay {opciones.length} disponibles.
          </div>
        </div>
        <div style={S.footer}>
          <button style={S.btnGhost} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={S.btnPrimary} onClick={sustituir} disabled={saving || !sustituta}>
            {saving ? 'Sustituyendo...' : 'Sustituir y eliminar original'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────── MP ACTIONS DROPDOWN ────────── */
/* extraItems (jul 2026): items adicionales [{label, color, onClick}] — usado por
   la tabla PT para "Ocultar/Mostrar" (PT ocultos). Si no hay onAction, solo se
   pintan los extraItems (el menú deja de ser exclusivo de MP). */
export function MPActionsMenu({ mp, mpsDisponibles, canEdit, onAction, extraItems }) {
  const [open, setOpen] = useState(false);
  /* FIX jun 2026: el desplegable era position:absolute y lo recortaba el
     overflow:hidden de la tabla (más visible ahora con las secciones por
     categoría). Se ancla con position:fixed a las coordenadas del botón para
     que escape de cualquier contenedor con overflow. */
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  if (!canEdit) return null;

  const toggle = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen(!open);
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          background: 'transparent', border: 'none',
          cursor: 'pointer', padding: '4px 8px',
          fontSize: 16, color: 'var(--lp-text-tertiary)',
          fontWeight: 700, lineHeight: 1,
        }}
        title="Acciones"
        aria-label={`Acciones para ${mp}`}
      >⋯</button>
      {open && pos && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'fixed', top: pos.top, right: pos.right,
            background: 'var(--lp-bg-raised)',
            border: '1.5px solid var(--lp-border-subtle)',
            borderRadius: 'var(--lp-radius-sm)',
            boxShadow: '0 8px 24px rgba(26,24,21,.16)',
            zIndex: 9999, minWidth: 160,
          }}>
            {onAction && (
              <button
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', fontSize: 12, border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-text-primary)',
                }}
                onClick={() => { setOpen(false); onAction('sustituir', mp, mpsDisponibles); }}
              >
                Sustituir...
              </button>
            )}
            {onAction && (
              <button
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', fontSize: 12, border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  fontFamily: 'var(--lp-font-sans)', color: 'var(--lp-danger-600)',
                  borderTop: '0.5px solid var(--lp-border-subtle)', fontWeight: 600,
                }}
                onClick={() => { setOpen(false); onAction('eliminar', mp); }}
              >
                Eliminar...
              </button>
            )}
            {(extraItems || []).map((item, i) => (
              <button
                key={item.label + i}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 14px', fontSize: 12, border: 'none',
                  background: 'transparent', cursor: 'pointer', fontWeight: 600,
                  fontFamily: 'var(--lp-font-sans)', color: item.color || 'var(--lp-text-primary)',
                  borderTop: (onAction || i > 0) ? '0.5px solid var(--lp-border-subtle)' : 'none',
                }}
                onClick={() => { setOpen(false); item.onClick && item.onClick(); }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
