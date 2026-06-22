import { useState, useMemo, useEffect } from 'react';
import api from '../../../services/api';
import useIsDesktop from '../../../hooks/useIsDesktop';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import { presEnvases } from '../presentaciones';

const PRESENTACIONES = [
  { v: 'cubeta_20', lbl: 'CUBETA / 20 kg' },
  { v: 'cubeta_50', lbl: 'CUBETA / 50 kg' },
  { v: 'saco_25', lbl: 'SACO / 25 kg' },
  { v: 'saco_50', lbl: 'SACO / 50 kg' },
  { v: 'tambor_200', lbl: 'TAMBOR / 200 kg' },
  { v: 'tambor_220', lbl: 'TAMBOR / 220 kg' },
  { v: 'tote_1000', lbl: 'TOTE / 1,000 kg' },
  { v: 'otro', lbl: 'Otro (especificar)' },
];

const PRIORIDADES = [
  { v: 'urgente', lbl: 'Urgente (10-15 días)' },
  { v: 'media', lbl: 'Media (15-20 días)' },
  { v: 'baja', lbl: 'Baja (20-30 días)' },
];

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26, 24, 21, 0.6)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'auto',
  },
  modal: {
    background: 'var(--lp-bg-raised)',
    borderRadius: 'var(--lp-radius)',
    maxWidth: 560,
    width: '92%',
    maxHeight: '90vh',
    /* v4 (jun 2026): footer PEGAJOSO (igual que OrdenesPage). El modal es columna
       flex y NO scrollea él mismo (overflow hidden); el BODY scrollea y el footer
       queda FIJO abajo → los botones Cancelar/Levantar OC siempre visibles, nunca
       cortados bajo el viewport en móvil aunque el formulario sea largo. El padding
       24 que tenía aquí pasó al header/body/footer. */
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  /* Header: título fijo arriba (no scrollea). Hereda el padding lateral 24 que
     tenía el modal + un padding-top para separar del borde superior del sheet. */
  header: {
    flexShrink: 0,
    padding: '20px 24px 0',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--lp-brand-600)',
    marginBottom: 16,
  },
  /* Body: ÚNICA área scrolleable (el modal padre es overflow:hidden + flex column).
     flex:1 + minHeight:0 deja que encoja y scrollee DENTRO del sheet; overscroll
     contain corta el encadenamiento del scroll al fondo en móvil. */
  body: {
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    padding: '8px 24px',
  },
  /* Footer pegajoso: borde superior + safe-area abajo (home-indicator/gesture bar). */
  footer: {
    flexShrink: 0,
    borderTop: '1px solid var(--lp-border-subtle)',
    padding: '12px 24px calc(12px + env(safe-area-inset-bottom, 0px))',
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--lp-text-secondary)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'var(--lp-font-sans)',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'var(--lp-font-sans)',
    background: 'var(--lp-bg-raised)',
    boxSizing: 'border-box',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 14,
  },
  itemsList: {
    background: 'var(--lp-bg-sunken)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px dashed var(--lp-border-subtle)',
    fontSize: 12,
  },
  fleteBox: {
    background: 'var(--lp-bg-sunken)',
    border: '1.5px solid var(--lp-border-subtle)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  fleteInputGroup: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 6,
  },
  fleteHint: {
    fontSize: 11,
    color: 'var(--lp-text-tertiary)',
  },
  buttons: {
    display: 'flex',
    gap: 10,
  },
  btn: {
    flex: 1,
    padding: '12px',
    fontSize: 13,
    fontWeight: 700,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)',
  },
  btnPrimary: {
    background: 'var(--lp-brand-600)',
    color: '#fff',
  },
  btnSecondary: {
    background: 'var(--lp-bg-sunken)',
    color: 'var(--lp-text-primary)',
  },
  btnSmall: {
    padding: '8px 12px',
    fontSize: 11,
    flex: 'initial',
  },
  btnRemove: {
    /* Botón × de tamaño FIJO (cuadrito 22px): anula el flex:1 + padding '12px'
       de S.btn que lo estiraban como barra roja. Solo la × centrada. */
    flex: '0 0 auto',
    width: 22,
    height: 22,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--lp-danger-100)',
    color: 'var(--lp-danger-700)',
    fontSize: 14,
    lineHeight: 1,
    borderRadius: 6,
  },
  btnAdd: {
    background: 'var(--lp-success-100)',
    color: 'var(--lp-success-700)',
    width: '100%',
    marginBottom: 14,
  },
};

export default function NewOCModal({ onClose, onCreated, prefillMP }) {
  /* Mockup integracion/Compras.html: en móvil el alta de OC es un bottom-sheet
     (radio 24 arriba, pegado abajo); en escritorio queda el modal centrado. */
  const isDesktop = useIsDesktop();
  /* MÓVIL: congela el scroll del FONDO mientras el sheet/modal está montado
     (este componente sólo se monta cuando está abierto, por eso `true`). El
     hook también publica --pp-vvh que el contenedor usa en su maxHeight. */
  useBodyScrollLock(true);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [proveedor, setProveedor] = useState('');
  const [mp, setMp] = useState(prefillMP?.mp || '');
  const [kg, setKg] = useState(prefillMP?.kg ? String(prefillMP.kg) : '');
  const [presentacion, setPresentacion] = useState('');
  const [presentacionOtro, setPresentacionOtro] = useState('');
  const [items, setItems] = useState(() => {
    /* Si hay prefillMP con mp+kg válidos, arrancar con ese item ya en la lista */
    if (prefillMP?.mp && prefillMP?.kg > 0) {
      return [{
        mp: prefillMP.mp,
        kg: Number(prefillMP.kg),
        presentacion: prefillMP.presentacion || 'saco_25',
        presentacionOtro: null,
      }];
    }
    return [];
  });
  const [prioridad, setPrioridad] = useState('media');
  const [notas, setNotas] = useState('');
  const [fleteEstimado, setFleteEstimado] = useState('');
  const [fleteOverride, setFleteOverride] = useState(false);
  const [creating, setCreating] = useState(false);

  /* Load catalog y enriquecer items con proveedor + último precio + lead time */
  useEffect(() => {
    api.get('/api/compras/catalogo')
      .then(r => {
        if (r.ok) {
          setCatalog(r.data);
          /* Resolver proveedor — prioridad:
             1) prefillMP.proveedor (lo que pasó MRP)
             2) catalog.mp_proveedor_principal[mp]
             3) vacío */
          let provName = prefillMP?.proveedor || null;
          let provInfo = null;
          if (prefillMP?.mp && r.data?.mp_proveedor_principal) {
            provInfo = r.data.mp_proveedor_principal[prefillMP.mp];
            if (!provName) {
              provName = (provInfo && typeof provInfo === 'object')
                ? provInfo.proveedor_principal
                : (typeof provInfo === 'string' ? provInfo : null);
            }
          }
          if (provName) setProveedor(provName);

          /* Enriquecer el primer item con último precio + lead time del catálogo */
          if (prefillMP?.mp && provInfo && typeof provInfo === 'object') {
            const ultPrecio = provInfo.ultimo_precio || provInfo.precio || null;
            const leadTime = provInfo.lead_time_dias || null;
            setItems(prev => prev.map((it, i) => i === 0 ? {
              ...it,
              precioUnitario: ultPrecio,
              leadTimeDias: leadTime,
              moneda: provInfo.moneda || 'MXN',
            } : it));
          }
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proveedores = useMemo(() => {
    if (!catalog?.proveedores) return [];
    return Object.keys(catalog.proveedores).sort();
  }, [catalog]);

  const mpsForProveedor = useMemo(() => {
    if (!proveedor || !catalog?.proveedores) return [];
    const provObj = catalog.proveedores[proveedor];
    return Array.isArray(provObj) ? provObj : (provObj?.mps || []);
  }, [proveedor, catalog]);

  const totalKg = useMemo(() => {
    return items.reduce((s, it) => s + (Number(it.kg) || 0), 0);
  }, [items]);

  const sugeridoFlete = useMemo(() => {
    return Math.round(totalKg * 5 * 100) / 100;
  }, [totalKg]);

  /* Auto-update flete if not overridden */
  useEffect(() => {
    if (!fleteOverride) {
      setFleteEstimado(sugeridoFlete.toFixed(2));
    }
  }, [sugeridoFlete, fleteOverride]);

  const handleAddItem = () => {
    if (!mp) {
      alert('Selecciona materia prima');
      return;
    }
    if (!kg || Number(kg) <= 0) {
      alert('Ingresa kilos válidos');
      return;
    }
    if (!presentacion) {
      alert('Selecciona presentación');
      return;
    }
    if (presentacion === 'otro' && !presentacionOtro) {
      alert('Especifica la presentación');
      return;
    }

    setItems([...items, {
      mp,
      kg: Number(kg),
      presentacion,
      presentacionOtro: presentacion === 'otro' ? presentacionOtro : null,
    }]);

    setMp('');
    setKg('');
    setPresentacion('');
    setPresentacionOtro('');
  };

  const handleRemoveItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    if (!proveedor) {
      alert('Selecciona proveedor');
      return;
    }
    /* Si no se pulsó "+ Agregar al pedido", incluir la MP que está cargada en el
       formulario — un solo insumo no debería exigir el paso extra de "agregar".
       (Notas es OPCIONAL: nunca bloquea; lo que bloqueaba era items vacío.) */
    let itemsFinal = items;
    if (itemsFinal.length === 0) {
      const formularioValido = mp && Number(kg) > 0 && presentacion
        && !(presentacion === 'otro' && !presentacionOtro);
      if (formularioValido) {
        itemsFinal = [{
          mp,
          kg: Number(kg),
          presentacion,
          presentacionOtro: presentacion === 'otro' ? presentacionOtro : null,
          kg_recibidos: null,
        }];
      } else {
        alert('Agrega al menos un item');
        return;
      }
    }

    setCreating(true);
    try {
      const res = await api.post('/api/compras/oc', {
        proveedor,
        items: itemsFinal,
        prioridad,
        notas,
        fleteEstimadoMxn: Number(fleteEstimado) || 0,
      });

      if (res.ok) {
        onCreated();
        if (onClose) onClose(); /* garantizar cierre del modal en éxito */
      } else {
        alert(`Error: ${res.error || 'desconocido'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  /* ⚠️ BUG FIX React #310 (pantalla blanca al abrir "Crear OC"):
     El useMemo de `prefillContext` DEBE declararse ANTES de los early returns
     `if (loading) return ...` / `if (error) return ...`. Antes estaba después:
     el primer render con loading=true NO ejecutaba el useMemo (porque retornaba
     antes), y el segundo render con loading=false sí lo ejecutaba → React veía
     un hook nuevo → "Rendered more hooks than during the previous render".
     Mantenemos el bail-out condicional DENTRO del hook (retorna null si no hay
     datos), y los early returns AHORA van DESPUÉS de todos los hooks. */
  const prefillContext = useMemo(() => {
    if (!prefillMP?.mp || !catalog) return null;
    const provInfo = catalog?.mp_proveedor_principal?.[prefillMP.mp];
    const provObj = (provInfo && typeof provInfo === 'object') ? provInfo : null;
    return {
      mp: prefillMP.mp,
      kg: prefillMP.kg,
      proveedor: prefillMP.proveedor || provObj?.proveedor_principal || 'Sin proveedor',
      ultimoPrecio: provObj?.ultimo_precio || provObj?.precio || null,
      moneda: provObj?.moneda || 'MXN',
      leadTime: provObj?.lead_time_dias || null,
      todosProveedores: provObj?.todos_proveedores || [],
    };
  }, [prefillMP, catalog]);

  /* Bottom-sheet en móvil / modal centrado en escritorio (no son hooks) */
  const ovl = { ...S.overlay, alignItems: isDesktop ? 'center' : 'flex-end', padding: isDesktop ? 16 : 0 };
  const box = {
    ...S.modal,
    width: isDesktop ? '92%' : '100%',
    borderRadius: isDesktop ? 'var(--lp-radius)' : '24px 24px 0 0',
    /* --pp-vvh (publicado por useBodyScrollLock) sigue al teclado virtual en
       iOS/Android; fallback a 100dvh. El contenedor es flex column overflow:hidden;
       el BODY interno (S.body) scrollea y nada queda detrás del teclado. */
    maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)',
  };

  if (loading) {
    return (
      <div style={ovl} onClick={onClose}>
        <div style={box} onClick={e => e.stopPropagation()}>
          <div style={{ textAlign: 'center', padding: '40px' }}>Cargando catálogo...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={ovl} onClick={onClose}>
        {/* Early-return corto: el box es flex column (overflow hidden). Damos su
            propio padding (el modal ya no lo trae) y fijamos el botón para que el
            flex:1 de S.btn no lo estire verticalmente. */}
        <div style={box} onClick={e => e.stopPropagation()}>
          <div style={{ padding: 24 }}>
            <div style={{ color: 'var(--lp-danger-600)', marginBottom: 16 }}>Error: {error}</div>
            <button style={{ ...S.btn, ...S.btnSecondary, flex: '0 0 auto', alignSelf: 'flex-start' }} onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={ovl} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        {/* Header fijo (no scrollea) */}
        <div style={S.header}>
          <div style={S.title}>Nueva orden de compra</div>
        </div>

        {/* Body scrolleable: desde el banner hasta Notas */}
        <div style={S.body}>
        {/* Banner contextual cuando viene de MRP */}
        {prefillContext && (
          <div style={{
            background: 'var(--lp-info-50)',
            border: '1.5px solid var(--lp-info-200, var(--lp-border-subtle))',
            borderRadius: 'var(--lp-radius)',
            padding: '12px 14px',
            marginBottom: 14,
            fontSize: 12, fontFamily: 'var(--lp-font-sans)',
          }}>
            <div style={{ fontWeight: 700, color: 'var(--lp-info-700)', marginBottom: 6, fontSize: 13 }}>
              Pre-llenado desde MRP
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, color: 'var(--lp-text-secondary)' }}>
              <div><strong style={{ color: 'var(--lp-text-primary)' }}>MP:</strong> {prefillContext.mp}</div>
              <div><strong style={{ color: 'var(--lp-text-primary)' }}>Cantidad sugerida:</strong> {prefillContext.kg} kg</div>
              <div><strong style={{ color: 'var(--lp-text-primary)' }}>Proveedor:</strong> {prefillContext.proveedor}</div>
              {/* BUG FIX pantalla blanca: ultimoPrecio puede llegar como string desde JSON
                  ("125.50") y .toFixed() solo existe en Number. Coercemos y validamos. */}
              {(() => {
                const precioNum = Number(prefillContext.ultimoPrecio);
                if (!Number.isFinite(precioNum) || precioNum <= 0) return null;
                return (
                  <div><strong style={{ color: 'var(--lp-text-primary)' }}>Último precio:</strong> ${precioNum.toFixed(2)} {prefillContext.moneda || 'MXN'}/kg</div>
                );
              })()}
              {(() => {
                const leadNum = Number(prefillContext.leadTime);
                if (!Number.isFinite(leadNum) || leadNum <= 0) return null;
                return (
                  <div><strong style={{ color: 'var(--lp-text-primary)' }}>Lead time:</strong> {leadNum} días</div>
                );
              })()}
              {Array.isArray(prefillContext.todosProveedores) && prefillContext.todosProveedores.length > 1 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong style={{ color: 'var(--lp-text-primary)' }}>Otros proveedores:</strong>{' '}
                  {prefillContext.todosProveedores.filter(p => p !== prefillContext.proveedor).join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Proveedor */}
        <div style={S.fieldGroup}>
          <label style={S.label}>Proveedor *</label>
          <select
            style={S.select}
            value={proveedor}
            onChange={e => {
              setProveedor(e.target.value);
              setMp('');
            }}
          >
            <option value="">-- Selecciona proveedor --</option>
            {proveedores.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* MP */}
        <div style={S.fieldGroup}>
          <label style={S.label}>Materia Prima *</label>
          <select
            style={S.select}
            value={mp}
            onChange={e => setMp(e.target.value)}
            disabled={!proveedor}
          >
            <option value="">-- Selecciona MP --</option>
            {mpsForProveedor.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Kg + Presentacion */}
        <div style={S.grid2}>
          <div>
            <label style={S.label}>Kilos *</label>
            <input
              type="number"
              style={S.input}
              value={kg}
              onChange={e => setKg(e.target.value)}
              min="0"
              step="any"
              placeholder="0"
            />
          </div>
          <div>
            <label style={S.label}>Presentación *</label>
            <select
              style={S.select}
              value={presentacion}
              onChange={e => setPresentacion(e.target.value)}
            >
              <option value="">-- Selecciona --</option>
              {PRESENTACIONES.map(p => (
                <option key={p.v} value={p.v}>{p.lbl}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Presentacion Otro */}
        {presentacion === 'otro' && (
          <div style={S.fieldGroup}>
            <label style={S.label}>Especifica presentación</label>
            <input
              type="text"
              style={S.input}
              value={presentacionOtro}
              onChange={e => setPresentacionOtro(e.target.value)}
              placeholder="ej. saco 25 kg"
            />
          </div>
        )}

        {/* Agregar item */}
        <button
          style={{ ...S.btn, ...S.btnAdd }}
          onClick={handleAddItem}
          disabled={creating}
        >
          + Agregar al pedido
        </button>

        {/* Items list */}
        {items.length > 0 && (
          <div style={S.itemsList}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text-secondary)', marginBottom: 8 }}>
              ITEMS DEL PEDIDO ({items.length})
            </div>
            {items.map((it, idx) => {
              const presLabel = PRESENTACIONES.find(p => p.v === it.presentacion)?.lbl || it.presentacion;
              const envInfo = presEnvases(it.presentacion, it.kg); /* ej: "40 sacos" */
              return (
                <div key={idx} style={S.itemRow}>
                  <span>
                    <strong>{it.mp}</strong> · {it.kg} kg · {it.presentacion === 'otro' && it.presentacionOtro ? `Otro: ${it.presentacionOtro}` : presLabel}{envInfo ? ` · ${envInfo}` : ''}
                  </span>
                  <button
                    style={{ ...S.btn, ...S.btnRemove }}
                    onClick={() => handleRemoveItem(idx)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Prioridad */}
        <div style={S.fieldGroup}>
          <label style={S.label}>Prioridad *</label>
          <select
            style={S.select}
            value={prioridad}
            onChange={e => setPrioridad(e.target.value)}
          >
            {PRIORIDADES.map(p => (
              <option key={p.v} value={p.v}>{p.lbl}</option>
            ))}
          </select>
        </div>

        {/* Flete */}
        <div style={S.fleteBox}>
          <label style={S.label}>Flete estimado total (MXN)</label>
          <div style={S.fleteInputGroup}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>$</span>
            <input
              type="number"
              style={S.input}
              value={fleteEstimado}
              onChange={e => {
                /* Mantener el texto crudo mientras se escribe (NO toFixed por
                   tecla — eso reescribía a "0.00" y hacía imposible teclear).
                   Se parsea a número solo al levantar la OC. */
                const raw = e.target.value;
                setFleteEstimado(raw);
                setFleteOverride(Number(raw) !== sugeridoFlete);
              }}
              min="0"
              step="any"
              placeholder="0.00"
            />
            <button
              style={{ ...S.btn, ...S.btnSmall, ...S.btnSecondary }}
              onClick={() => {
                setFleteOverride(false);
                setFleteEstimado(sugeridoFlete.toFixed(2));
              }}
              title="Restaurar al cálculo automático"
            >
              Auto
            </button>
          </div>
          <div style={S.fleteHint}>
            Sugerido: ${(sugeridoFlete).toFixed(2)} ({totalKg} kg × $5 MXN/kg)
            {fleteOverride && ' · ajuste manual activo'}
          </div>
        </div>

        {/* Notas */}
        <div style={S.fieldGroup}>
          <label style={S.label}>Notas</label>
          <textarea
            style={{ ...S.input, resize: 'vertical' }}
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows="2"
            placeholder="Notas opcionales..."
          />
        </div>
        </div>{/* /body scrolleable */}

        {/* Footer PEGAJOSO — botones fijos abajo. Orden del mockup: Cancelar
            discreto, primario dominante. */}
        <div style={S.footer}>
          <div style={S.buttons}>
            <button
              style={{ ...S.btn, ...S.btnSecondary, flex: '0 0 auto', padding: '12px 18px' }}
              onClick={onClose}
              disabled={creating}
            >
              Cancelar
            </button>
            <button
              style={{ ...S.btn, ...S.btnPrimary }}
              onClick={handleCreate}
              /* Habilitado si hay items O un insumo válido en el formulario.
                 Notas NO entra aquí (es opcional, nunca bloquea). */
              disabled={creating || (items.length === 0 && !(mp && Number(kg) > 0 && presentacion))}
            >
              {creating ? 'Creando...' : 'Levantar OC'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
