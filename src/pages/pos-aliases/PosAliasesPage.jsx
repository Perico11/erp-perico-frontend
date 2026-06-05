/* ═══════════════════════════════════════════════════════════════════
   PosAliasesPage — /pos-aliases (decisión LOCKED del dueño §9)
   POS Aliases sale a pantalla propia de configuración (antes era una tab
   dentro de Compras).
   REUSO TOTAL: monta <PosAliasesTab /> (todo el mapeo de productos POS Terán →
   fórmulas, con KPIs por tipo, filtros y edición). El tab ya trae toda su
   lógica y su propio encabezado descriptivo + padding vertical; esta página
   solo le da el SHELL coherente: un único TopBar verde y el padding horizontal
   estándar del ERP. Tokens var(--lp-*), sin emojis, responsive.
   ═══════════════════════════════════════════════════════════════════ */
import TopBar from '../../components/layout/TopBar';
import useIsDesktop from '../../hooks/useIsDesktop';
import PosAliasesTab from '../compras/PosAliasesTab';

const S = {
  /* PosAliasesTab ya trae padding vertical (0 0 80px); aquí solo damos el
     padding horizontal estándar para que no quede pegado a los bordes. */
  wrap: { padding: '8px 20px 0' },
};

export default function PosAliasesPage() {
  const isDesktop = useIsDesktop();
  return (
    <>
      <TopBar title="POS Aliases" />
      <div style={{ ...S.wrap, maxWidth: isDesktop ? 1280 : '100%' }}>
        <PosAliasesTab />
      </div>
    </>
  );
}
