import { useState, useMemo, useEffect } from 'react';
import { useSearch } from '../../hooks/useApi';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import OCList from './components/OCList';
import NewOCModal from './components/NewOCModal';
import SegmentedControl from '../../components/ui/SegmentedControl';

const S = {
  toolbar: {
    /* BUG FIX altura: alignItems stretch + minHeight uniforme en todos los hijos
       para que input, SegmentedControl y botón compartan la misma altura visual.
       Antes: el botón Crear OC quedaba 2-4px más alto que el SegmentedControl. */
    display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 16, flexWrap: 'wrap',
  },
  search: {
    flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--lp-border-subtle)', fontSize: 13,
    fontFamily: 'var(--lp-font-sans)', background: '#fff', outline: 'none',
    color: 'var(--lp-text-primary)', boxSizing: 'border-box',
    minHeight: 40, height: 40,
  },
  button: {
    padding: '0 16px', fontSize: 12, fontWeight: 600,
    borderRadius: 8, border: 'none', cursor: 'pointer',
    background: 'var(--lp-brand-600)', color: '#fff',
    fontFamily: 'var(--lp-font-sans)',
    minHeight: 40, height: 40,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    whiteSpace: 'nowrap',
  },
  empty: { textAlign: 'center', color: 'var(--lp-text-tertiary)', padding: '40px 0', fontSize: 13 },
};

export default function OCsTab({ ocsData, onRefresh, prefillNewOC, onPrefillConsumed, onCreated }) {
  const { can } = useAuth();
  const { query, debouncedQuery, setQuery } = useSearch(200);
  const [filterState, setFilterState] = useState('activas'); /* activas | recibidas | todas */
  const [showNewOCModal, setShowNewOCModal] = useState(false);

  /* Si llega prefill desde MRP, abrir el modal automáticamente */
  useEffect(() => {
    if (prefillNewOC) setShowNewOCModal(true);
  }, [prefillNewOC]);

  const ocs = useMemo(() => {
    const raw = Array.isArray(ocsData) ? ocsData : ocsData?.data || [];
    return raw;
  }, [ocsData]);

  const filteredOCs = useMemo(() => {
    let items = [...ocs];

    /* Filter by state */
    if (filterState === 'activas') {
      items = items.filter(o => o.estado !== 'recibida' && o.estado !== 'eliminada' && !o.eliminada);
    } else if (filterState === 'recibidas') {
      items = items.filter(o => o.estado === 'recibida' || o.estado === 'eliminada' || o.eliminada);
    }
    /* todos: no filter */

    /* Filter by search */
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      items = items.filter(o =>
        (o.codigo || '').toLowerCase().includes(q) ||
        (o.proveedor || '').toLowerCase().includes(q)
      );
    }

    return items;
  }, [ocs, filterState, debouncedQuery]);

  const handleOCCreated = async () => {
    setShowNewOCModal(false);
    if (onPrefillConsumed) onPrefillConsumed();
    if (onCreated) onCreated();
    else await onRefresh();
  };

  const handleCloseNewOC = () => {
    setShowNewOCModal(false);
    if (onPrefillConsumed) onPrefillConsumed();
  };

  return (
    <>
      <div style={S.toolbar}>
        <input
          type="text"
          style={{ ...S.search, maxWidth: 260 }}
          placeholder="Buscar por código o proveedor..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <SegmentedControl
          value={filterState}
          onChange={setFilterState}
          options={[
            { value: 'activas', label: 'Activas' },
            { value: 'recibidas', label: 'Recibidas' },
            { value: 'todas', label: 'Todas' },
          ]}
          color="brand"
        />
        {can('compras') && (
          <button style={S.button} onClick={() => setShowNewOCModal(true)}>
            + Nueva OC
          </button>
        )}
      </div>

      {filteredOCs.length === 0 ? (
        <div style={S.empty}>
          {ocs.length === 0 ? 'Sin órdenes de compra' : 'Sin resultados que coincidan'}
        </div>
      ) : (
        <OCList ocs={filteredOCs} onRefresh={onRefresh} />
      )}

      {showNewOCModal && (
        <NewOCModal
          onClose={handleCloseNewOC}
          onCreated={handleOCCreated}
          prefillMP={prefillNewOC}
        />
      )}
    </>
  );
}
