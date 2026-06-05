/* ═══════════════════════════════════════════════════════════════════
   SATPage — /sat (decisión LOCKED del dueño §9)
   SAT/CFDI sale a pantalla propia (antes era una tab dentro de Compras).
   REUSO TOTAL: monta <SATPanel /> (el panel completo de SAT/CFDI: subir XML,
   parsear CFDI, cruzar con OCs por monto, registrar factura). El panel ya trae
   toda su lógica — esta página solo le da el SHELL coherente con el resto del
   ERP: un único TopBar verde + encabezado con subtítulo. Tokens var(--lp-*),
   sin emojis, responsive.
   ═══════════════════════════════════════════════════════════════════ */
import TopBar from '../../components/layout/TopBar';
import useIsDesktop from '../../hooks/useIsDesktop';
import SATPanel from '../admin/SATPanel';

const S = {
  wrap: { padding: '0 20px 100px' },
  header: { margin: '4px 0 16px' },
  title: { fontSize: 18, fontWeight: 800, color: 'var(--lp-text-primary)', margin: 0, fontFamily: 'var(--lp-font-sans)' },
  subtitle: { fontSize: 13, color: 'var(--lp-text-tertiary)', marginTop: 4, fontFamily: 'var(--lp-font-sans)' },
};

export default function SATPage() {
  const isDesktop = useIsDesktop();
  return (
    <>
      <TopBar title="SAT / CFDI" />
      <div style={{ ...S.wrap, maxWidth: isDesktop ? 1100 : '100%' }}>
        <div style={S.header}>
          <h1 style={S.title}>SAT / CFDI</h1>
          <p style={S.subtitle}>
            Sube el XML de una factura, parsea el CFDI y crúzalo con la orden de compra correspondiente por monto.
          </p>
        </div>
        <SATPanel />
      </div>
    </>
  );
}
