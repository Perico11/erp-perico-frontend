/* TotesColorModal — los TOTES FÍSICOS de un color, uno por renglón (10-ago-2026,
   pedido dueño: "si un color tiene 10 totes, al darle click debe salir la lista
   con opción a reimprimir etiqueta, eliminar o transferir").

   Cada tote muestra su folio (base del color + nº: USA-0050-03), litros
   restantes, lote del fabricante y tandas envasadas. Acciones por tote:
     · Reimprimir etiqueta — SIN QR: banda TOTE + color y el folio en grande.
     · Transferir al otro almacén — viaja la pieza entera con su folio.
     · Eliminar — baja confirmada (descuenta sus litros; queda en el kardex).
   Regla UX 18-jul: el click FUERA no cierra (solo X / Cerrar). */
import { useState } from 'react';
import api from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useConfirm from '../../hooks/useConfirm';
import humanizeError from '../../utils/humanizeError';
import imprimirEtiquetasTotes from './imprimirEtiquetasTotes';

const S = {
  overlay: { position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,12,8,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: 'calc(var(--pp-vvh, 100dvh) - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.35)' },
  header: { background: 'var(--lp-brand-700)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: 700, margin: 0 },
  closeBtn: { width: 30, height: 30, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 18, lineHeight: 1, cursor: 'pointer' },
  body: { padding: '14px 20px 18px', overflowY: 'auto', flex: 1 },
  intro: { padding: '10px 14px', borderRadius: 8, background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)', fontSize: 12.5, color: 'var(--lp-text-secondary)', lineHeight: 1.5, marginBottom: 12 },
  row: { border: '1px solid var(--lp-border-subtle)', borderRadius: 10, padding: '10px 12px', marginBottom: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  /* El folio y el nivel llevan ANCHO FIJO para que las barras queden todas del
     mismo largo y una debajo de otra: comparar de reojo es justamente para lo
     que están, y dos barras de distinto largo no se comparan. */
  folio: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, fontSize: 14.5, flex: '0 0 auto', minWidth: 132 },
  nivel: { display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 auto', width: 124 },
  litros: { fontSize: 12.5, fontWeight: 600, color: 'var(--lp-text-secondary)' },
  barra: { height: 5, borderRadius: 3, background: 'var(--lp-bg-sunken)', border: '1px solid var(--lp-border-subtle)', overflow: 'hidden' },
  /* Un mínimo visible: un tote con 8 L no es lo mismo que uno vacío, y a esa
     escala el porcentaje solo no pinta ni un píxel. */
  barraLleno: (pct) => ({ height: '100%', width: pct > 0 ? `max(3px, ${pct}%)` : 0, background: 'var(--lp-brand-600)', borderRadius: 2 }),
  sinAbrir: { fontSize: 10.5, fontWeight: 700, letterSpacing: .3, color: 'var(--lp-text-tertiary)', textTransform: 'uppercase' },
  meta: { fontSize: 11.5, color: 'var(--lp-text-tertiary)', width: '100%' },
  acts: { display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' },
  btn: (color, border) => ({ padding: '7px 11px', minHeight: 36, fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${border || 'var(--lp-border-subtle)'}`, background: 'var(--lp-bg-raised)', color }),
  footer: { padding: '12px 20px', borderTop: '1px solid var(--lp-border-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--lp-bg-sunken)' },
  cerrar: { padding: '10px 18px', fontSize: 13, fontWeight: 700, border: '1.5px solid var(--lp-border-subtle)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--lp-bg-raised)', color: 'var(--lp-text-secondary)' },
  err: { background: 'var(--lp-danger-50, #FEE2E2)', color: 'var(--lp-danger-700, #991B1B)', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginBottom: 10 },
};

const nf = (n) => (Number(n) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
const fFecha = (iso) => { try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }); } catch { return (iso || '').slice(0, 10); } };

/* ── Cuánto le queda al tote, de lo que traía ──
   Pedido del dueño (18-sep-2026): "si un tote está a menos capacidad de otro
   deberíamos encontrar la forma de distinguirlo". El dato ya existía —cada tote
   guarda sus litros de ahora y los que traía al entrar— pero el "original"
   estaba en la línea chica de abajo: había que leer dos veces para saber cuál
   está empezado. Aquí van juntos, con la barra para compararlos de reojo.

   Sin `litrosOriginal` NO se dibuja barra ni denominador: los totes anteriores
   al registro con lote (18-jul) no lo traen, e inventarles un 1000 sería
   pintar una mentira con precisión de dos decimales. */
function Nivel({ litros, original }) {
  const queda = Number(litros) || 0;
  const traia = Number(original) || 0;
  if (!(traia > 0)) {
    return (
      <div style={S.nivel}>
        <span style={S.litros} data-id="stkAmericano.tote.litros">{nf(queda)} L</span>
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, (queda / traia) * 100));
  const intacto = queda >= traia;
  return (
    <div style={S.nivel} data-id="stkAmericano.tote.nivel">
      <span style={S.litros} data-id="stkAmericano.tote.litros">{nf(queda)} / {nf(traia)} L</span>
      <div style={S.barra} role="img" aria-label={`${Math.round(pct)}% del tote`}>
        <div style={S.barraLleno(pct)} />
      </div>
      {intacto && <span style={S.sinAbrir}>sin abrir</span>}
    </div>
  );
}

export default function TotesColorModal({ color, almacen = '1', onClose, onChanged }) {
  useBodyScrollLock(true);
  const [confirm, ConfirmEl] = useConfirm();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  if (!color) return null;

  /* FEFO: el más viejo primero — mismo orden en que se deben consumir. */
  const totes = (color.totes || []).slice().sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
  const otroAlm = almacen === '2' ? '1' : '2';
  const otroLabel = almacen === '2' ? 'Americano Terán (Alm. 1)' : 'Almacén 2';

  const transferir = async (t) => {
    const ok = await confirm(
      `El tote ${t.codigoLote} (${nf(t.litros)} L de ${color.nombre}) se moverá completo al ${otroLabel}. Conserva su folio: la etiqueta pegada sigue valiendo.`,
      { title: 'Transferir tote', confirmText: 'Transferir' },
    );
    if (!ok) return;
    setBusy(t.codigoLote); setErr('');
    try {
      await api.transferirToteAmericano({ de: almacen, a: otroAlm, key: color.key, nombre: color.nombre, codigoLote: t.codigoLote });
      onChanged && onChanged(`Tote ${t.codigoLote} transferido al ${otroLabel}`);
    } catch (e) { setErr(humanizeError(e)); }
    setBusy('');
  };

  const eliminar = async (t) => {
    const motivo = await confirm(
      `Se dará de BAJA el tote ${t.codigoLote} y sus ${nf(t.litros)} L saldrán del stock de ${color.nombre}. El folio no se reutiliza.`,
      { title: 'Eliminar tote', confirmText: 'Dar de baja', danger: true, prompt: { label: 'Motivo', placeholder: 'Ej: se capturó por error / ya no existe físico', required: true, rows: 2 } },
    );
    if (!motivo) return;
    setBusy(t.codigoLote); setErr('');
    try {
      await api.eliminarToteAmericano({ almacen, key: color.key, nombre: color.nombre, codigoLote: t.codigoLote, confirmar: true, nota: String(motivo) });
      onChanged && onChanged(`Tote ${t.codigoLote} dado de baja`);
    } catch (e) { setErr(humanizeError(e)); }
    setBusy('');
  };

  return (
    <div style={S.overlay}>
      {ConfirmEl}
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <h3 style={S.title}>Totes de {color.nombre} · {totes.length}</h3>
          <button style={S.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div style={S.body}>
          <div style={S.intro}>
            La etiqueta del tote va <strong>sin QR</strong>: folio en grande + color, para leerla de lejos.
            Al envasar se elige el tote de la lista — por eso cada uno lleva su número.
          </div>
          {err && <div style={S.err}>{err}</div>}
          {totes.length === 0 && <div style={{ ...S.intro, textAlign: 'center' }}>Este color no tiene totes registrados.</div>}
          {totes.map(t => (
            <div key={t.codigoLote} style={S.row} data-id="stkAmericano.tote.row">
              <span style={S.folio}>{t.codigoLote}</span>
              <Nivel litros={t.litros} original={t.litrosOriginal} />
              <div style={S.acts}>
                <button style={S.btn('var(--lp-brand-700)', 'var(--lp-brand-600)')} disabled={!!busy}
                  onClick={() => imprimirEtiquetasTotes([{ cod: t.codigoLote, producto: color.nombre }])}
                  data-id="stkAmericano.tote.reimprimir" data-rol="admin,almacen">
                  Reimprimir etiqueta
                </button>
                <button style={S.btn('var(--lp-info-700, var(--lp-info-600))')} disabled={!!busy}
                  onClick={() => transferir(t)}
                  data-id="stkAmericano.tote.transferir" data-rol="admin,almacen">
                  {busy === t.codigoLote ? '…' : `Transferir a ${almacen === '2' ? 'Americano 1' : 'Alm. 2'}`}
                </button>
                <button style={S.btn('var(--lp-danger-600)', 'var(--lp-danger-600)')} disabled={!!busy}
                  onClick={() => eliminar(t)}
                  data-id="stkAmericano.tote.eliminar" data-rol="admin,almacen">
                  Eliminar
                </button>
              </div>
              <div style={S.meta}>
                Ingresó {fFecha(t.fecha)}
                {t.loteProveedor ? ` · lote fabricante ${t.loteProveedor}` : ''}
                {Number(t.tandas) > 0 ? ` · ${t.tandas} tanda${t.tandas === 1 ? '' : 's'} envasada${t.tandas === 1 ? '' : 's'} (la próxima es -${String(t.tandas + 1).padStart(2, '0')})` : ''}
              </div>
            </div>
          ))}
        </div>
        <div style={S.footer}>
          <button style={S.cerrar} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
