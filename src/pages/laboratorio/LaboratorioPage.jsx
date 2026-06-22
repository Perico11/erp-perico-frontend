import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { useApiData } from '../../hooks/useApi';
import TopBar from '../../components/layout/TopBar';
import PruebasTab from './PruebasTab';
import MateriasTab from './MateriasTab';

const TABS = [
  { key: 'pruebas',  label: 'Pruebas' },
  { key: 'materias', label: 'Materias Primas' },
];

const S = {
  page: { padding: '16px 20px 100px', maxWidth: 1200, margin: '0 auto', fontFamily: 'var(--lp-font-sans)' },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 700, color: 'var(--lp-text-primary)', margin: 0 },
  subtitle: { fontSize: 13, color: 'var(--lp-text-tertiary)', margin: 0, lineHeight: 1.5 },
  tabs: { display: 'flex', gap: 0, borderBottom: '1.5px solid var(--lp-border-subtle)', marginBottom: 20 },
  tab: (active) => ({
    padding: '10px 20px', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? 'var(--lp-brand-700)' : 'var(--lp-text-secondary)',
    background: 'none', border: 'none', cursor: 'pointer',
    borderBottom: active ? '2.5px solid var(--lp-brand-600)' : '2.5px solid transparent',
    marginBottom: -1.5, fontFamily: 'inherit', transition: 'all .15s',
  }),
};

const TABS_VALIDOS = ['pruebas', 'materias'];

export default function LaboratorioPage() {
  /* Deep-linking por ?tab= (replica patrón InventarioPage): el bot puede abrir
     /laboratorio?tab=materias directo en Materias Primas. ?tab= inválido → default. */
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const t = searchParams.get('tab');
    return (t && TABS_VALIDOS.includes(t)) ? t : 'pruebas';
  });
  /* Sync URL → estado en vivo: si navegas a /laboratorio?tab=materias estando YA
     en la pantalla, react-router no remonta; este efecto aplica la pestaña del query. */
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TABS_VALIDOS.includes(t)) setTab(t);
  }, [searchParams]);

  const fetchMaterias = useCallback(() => api.getLabMaterias(), []);
  const fetchPruebas  = useCallback(() => api.getLabPruebas(),  []);

  const { data: materiasData, loading: matLoading, reload: reloadMaterias } = useApiData(fetchMaterias, [], 0);
  const { data: pruebasData,  loading: prLoading,  reload: reloadPruebas }  = useApiData(fetchPruebas,  [], 0);

  const maestro = materiasData?.data?.maestro || [];
  const labMPs  = materiasData?.data?.lab || [];
  const pruebas = pruebasData?.data || [];

  return (
    <>
      <TopBar title="Laboratorio" />
      <div style={S.page}>
      <div style={S.header}>
        <p style={S.subtitle}>Pruebas de reformulación y nuevas materias primas — datos aislados del sistema principal.</p>
      </div>

      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.key} style={S.tab(tab === t.key)} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'pruebas' && pruebas.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--lp-brand-100)', color: 'var(--lp-brand-700)', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>
                {pruebas.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pruebas' && (
        <PruebasTab
          pruebas={pruebas}
          loading={prLoading}
          maestro={maestro}
          labMPs={labMPs}
          reload={reloadPruebas}
          reloadMaterias={reloadMaterias}
        />
      )}
      {tab === 'materias' && (
        <MateriasTab
          maestro={maestro}
          labMPs={labMPs}
          loading={matLoading}
          reload={reloadMaterias}
        />
      )}
    </div>
    </>
  );
}
