import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import api from '../services/api';
import PruebaBadge from './ui/PruebaBadge';
import { QRScanner } from './QRModal';

/* ──────────────────────────────────────────────────────────────────── */
/* InboundAlertManager                                                  */
/* ──────────────────────────────────────────────────────────────────── */
/* Componente GLOBAL (montado en App.jsx). Escucha eventos WS de la     */
/* state machine y muestra banners emergentes para que Luis (recolector)*/
/* y Josué (almacén) compitan por tomar un sublote.                     */
/*                                                                      */
/* Comportamiento clave:                                                */
/*  - El claim del banner ABRE LA CÁMARA — la transición solo viaja con */
/*    el código físicamente escaneado (decisión owner jun 2026:         */
/*    "obligalo a scanear"). No hay camino sin QR.                      */
/*  - El primero en escanear gana — la state machine garantiza que el   */
/*    segundo intento devuelve 409 (estado cambió).                     */
/*  - Cuando alguien acepta, el WS broadcast de la transición elimina   */
/*    el banner del otro cliente.                                       */
/*  - Push notification del navegador en paralelo (si está habilitada). */
/* ──────────────────────────────────────────────────────────────────── */

const ROLES_INBOUND = ['recolector', 'almacen', 'admin'];

/* TTL del banner si nadie lo toma (segundos) */
const ALERT_TTL_S = 600; /* 10 minutos */

/* Push notification del navegador — usa la API nativa */
function tryShowPushNotif(title, body) {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/el-perico-icono.svg',
      tag: 'inbound-' + title.slice(0, 20), /* misma notif sobrescribe */
      requireInteraction: false,
    });
    setTimeout(() => { try { n.close(); } catch {} }, 12000);
  } catch {}
}

const S = {
  container: {
    position: 'fixed', top: 64, right: 16, zIndex: 9999,
    display: 'flex', flexDirection: 'column', gap: 10,
    maxWidth: 380, width: 'calc(100vw - 32px)',
    pointerEvents: 'none',
  },
  card: {
    /* Fondo y sombra en tokens (antes: gradiente blanco + sombra marrón del
       skin viejo, que rompía el tema verde y el modo oscuro). El borde verde
       de marca ya es suficiente acento de atención. */
    background: 'var(--lp-bg-raised)',
    border: '2px solid var(--lp-brand-600)',
    borderRadius: 14,
    padding: 14,
    boxShadow: 'var(--lp-shadow-lg)',
    pointerEvents: 'auto',
    animation: 'inbound-slide-in 0.3s ease-out',
    fontFamily: 'var(--lp-font-sans)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginBottom: 8,
  },
  icon: { fontSize: 18 },
  title: {
    fontSize: 12, fontWeight: 700, color: 'var(--lp-brand-700)',
    textTransform: 'uppercase', letterSpacing: '.05em',
    flex: 1, minWidth: 0,
  },
  close: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 18, color: 'var(--lp-text-tertiary)',
    padding: 0, lineHeight: 1, width: 22, height: 22,
  },
  producto: {
    fontSize: 15, fontWeight: 700, color: 'var(--lp-text-primary)',
    marginBottom: 4,
  },
  meta: {
    fontSize: 12, color: 'var(--lp-text-secondary)',
    marginBottom: 10, lineHeight: 1.5,
  },
  cod: { fontFamily: 'var(--lp-font-mono)', fontWeight: 700, color: 'var(--lp-brand-700)' },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  btn: (variant) => ({
    flex: 1, minWidth: 100,
    padding: '10px 12px', borderRadius: 8, border: 'none',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'var(--lp-font-sans)',
    background: variant === 'primary' ? 'var(--lp-brand-600)'
              : variant === 'success' ? 'var(--lp-success-600)'
              : 'var(--lp-bg-raised)',
    color: variant === 'ghost' ? 'var(--lp-text-secondary)' : '#fff',
    border: variant === 'ghost' ? '1.5px solid var(--lp-border-subtle)' : 'none',
    /* Luis/Josué tocan este banner en el celular en campo → touch target ≥44px. */
    minHeight: 44,
  }),
  taken: {
    fontSize: 11, color: 'var(--lp-text-tertiary)',
    fontStyle: 'italic', marginTop: 6,
  },
};

/* Inyectar keyframes una sola vez */
function injectAnimCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('inbound-anim-css')) return;
  const style = document.createElement('style');
  style.id = 'inbound-anim-css';
  style.textContent = `
    @keyframes inbound-slide-in {
      from { transform: translateX(120%); opacity: 0; }
      to   { transform: translateX(0); opacity: 1; }
    }
    @keyframes inbound-fade-out {
      to { opacity: 0; transform: translateX(120%); }
    }
  `;
  document.head.appendChild(style);
}

export default function InboundAlertManager() {
  const { user } = useAuth();
  const rol = user?.rol || '';
  const [alerts, setAlerts] = useState([]);
  const [taking, setTaking] = useState(null); /* cod actualmente en POST */

  useEffect(() => { injectAnimCSS(); }, []);

  /* Aplicar TTL — purgar banners que llevan más de N minutos sin tomarse */
  useEffect(() => {
    if (alerts.length === 0) return;
    const t = setInterval(() => {
      const ahora = Date.now();
      setAlerts(prev => prev.filter(a => (ahora - a.ts) < ALERT_TTL_S * 1000));
    }, 30000);
    return () => clearInterval(t);
  }, [alerts.length]);

  /* FIX jun 2026 (Sprint R): el flujo Luis → Josué es OBLIGATORIO.
     Antes ambos roles veían el banner "envasado" y el primero en aceptar
     ganaba — eso permitía a Josué saltarse a Luis y romper la trazabilidad.
     Ahora:
       - evento 'envasado' (o marcarRecoleccion): SOLO Luis (recolector) ve
         banner "Voy por él". Josué espera.
       - evento 'sublote.escanearRecoger' (Luis ya recogió, sublote en_camino):
         AHORA Josué (almacen) ve banner "Recibir en Terán".
     Admin siempre recibe ambos por auditoría. */
  const shouldShowToRole = useCallback((evento) => {
    if (!rol) return false;
    if (!ROLES_INBOUND.includes(rol)) return false;
    if (evento === 'envasado' || evento === 'sublote.marcarRecoleccion') {
      return rol === 'recolector' || rol === 'admin';
    }
    if (evento === 'sublote.escanearRecoger') {
      return rol === 'almacen' || rol === 'admin';
    }
    return false;
  }, [rol]);

  const addAlerts = useCallback((data) => {
    if (!data) return;
    if (!shouldShowToRole(data.evento)) return;

    /* Construir lista de candidatos según el evento */
    let candidatos = [];
    if (data.evento === 'envasado' && Array.isArray(data.inboundAlert)) {
      /* Sublotes envasados listos para que Luis los recoja */
      candidatos = data.inboundAlert.filter(s => s.estado === 'envasado' && s.claseSublote === 'envasado_final');
    } else if (data.evento === 'sublote.escanearRecoger') {
      /* Luis ya recogió: notificar a Josué para que reciba al llegar */
      candidatos = [{
        cod: data.subloteCod,
        estado: 'en_camino',
        qty: data.qty || data.cantidad,
        lit: data.lit || data.litros,
        tipo: data.tipo || 'sublote',
        marca: data.marca,
      }];
    }
    if (candidatos.length === 0) return;

    /* FIX jun 2026 (U2): id compuesto = `${cod}:${etapa}`. Antes el filtro
       de "ya existe" usaba solo cod, lo que bloqueaba el banner de Josué
       ("Recibir en Terán") justo después que Luis aceptó "Voy por él"
       (mismo cod, etapa diferente). Como removeAlertByCod marca tomadoPor
       pero deja el alert 1.5s más en la lista, el addAlerts subsecuente
       veía el cod existente y descartaba el banner nuevo del otro rol. */
    const etapa = data.evento === 'sublote.escanearRecoger' ? 'enCamino' : 'envasado';
    const nuevos = candidatos.map(s => ({
      id: `${s.cod}:${etapa}`,
      cod: s.cod,
      loteId: data.loteId,
      codigoLote: data.codigoLote,
      producto: data.producto || '?',
      qty: s.qty,
      lit: s.lit,
      tipo: s.tipo,
      marca: s.marca,
      esPrueba: !!data.esPrueba, /* U6/U8: badge prueba en banner */
      origen: data.evento,
      origenUsuario: data.usuario,
      etapa,
      ts: Date.now(),
      tomadoPor: null,
    }));

    setAlerts(prev => {
      const existingIds = new Set(prev.map(a => a.id));
      const realmenteNuevos = nuevos.filter(n => !existingIds.has(n.id));
      if (realmenteNuevos.length > 0) {
        const n0 = realmenteNuevos[0];
        const titulo = n0.etapa === 'enCamino'
          ? `Sublote en camino: ${n0.producto}`
          : `Lote listo: ${n0.producto}`;
        tryShowPushNotif(titulo, `${n0.qty || ''} ${n0.tipo || ''} · ${n0.cod}`);
      }
      return [...prev, ...realmenteNuevos];
    });
  }, [shouldShowToRole]);

  /* FIX jun 2026 (U2): purga selectiva por (cod, etapa) opcional.
     Cuando Luis recoge (escanearRecoger), borramos solo banners de etapa
     'envasado' del mismo cod — pero PRESERVAMOS el banner 'enCamino' que
     se acaba de crear para Josué. Antes el filtro borraba ambos por cod. */
  const removeAlertByCod = useCallback((cod, takenBy, etapaToRemove = null) => {
    setAlerts(prev => prev.map(a => {
      if (a.cod !== cod) return a;
      if (etapaToRemove && a.etapa !== etapaToRemove) return a;
      return { ...a, tomadoPor: takenBy || 'otro usuario' };
    }));
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => {
        if (a.cod !== cod) return true;
        if (etapaToRemove && a.etapa !== etapaToRemove) return true;
        return false;
      }));
    }, 1500);
  }, []);

  useRealtimeSync({
    /* El hook invoca handler(payload, fullMsg). payload tiene los datos del
       broadcast; fullMsg incluye 'usuario' (quien disparó la acción). */
    onTrazabilidad: (payload, fullMsg) => {
      const data = payload || {};
      const evento = data.evento;
      const remoteUser = fullMsg?.usuario || data.usuario;

      /* FIX jun 2026 (R): nuevo sublote envasado disponible → SOLO Luis
         ve banner "Voy por él" (filtro en shouldShowToRole). */
      if (evento === 'envasado' && Array.isArray(data.inboundAlert)) {
        addAlerts({ ...data, usuario: remoteUser });
        return;
      }
      /* FIX jun 2026 (R + U2): Luis acaba de recoger →
           1) quitar SOLO el banner de etapa 'envasado' (el de Luis)
           2) disparar banner nuevo de etapa 'enCamino' para Josué
         Si pasamos etapaToRemove='envasado', el banner 'enCamino' que
         creamos a continuación NO entra en conflicto con el filtro
         existingIds (los ids ahora son cod:etapa). */
      if (evento === 'sublote.escanearRecoger') {
        const cod = data.subloteCod;
        if (cod) {
          removeAlertByCod(cod, remoteUser, 'envasado');
          /* Disparar nuevo banner si soy almacen/admin (shouldShowToRole filtra) */
          addAlerts({ ...data, usuario: remoteUser });
        }
        return;
      }
      /* Recepción en Terán → quitar TODOS los banners de ese cod */
      if (evento === 'sublote.escanearRecibirTeran') {
        const cod = data.subloteCod;
        if (cod) removeAlertByCod(cod, remoteUser);
        return;
      }
      /* Sublote cancelado → quitar TODOS los banners de ese cod */
      if (evento === 'sublote.cancelarSublote' && data.subloteCod) {
        removeAlertByCod(data.subloteCod, remoteUser);
      }
    },
  });

  /* DECISIÓN OWNER jun 2026 ("obligalo a scanear"): el claim del banner YA NO
     ejecuta la transición con scanCod auto-rellenado (alert.cod) — eso era el
     único camino que se saltaba el escaneo físico del QR. Ahora el botón abre
     la CÁMARA (mismo patrón scanIntent de RecoleccionPage) y la transición
     viaja con el código realmente escaneado. El guard `scanCod===sublote.cod`
     del state machine se satisface solo si el QR físico coincide. */
  const [scanFor, setScanFor] = useState(null); /* alert que abrió el escáner */

  /* Acción según la ETAPA del banner (no el rol): un banner 'envasado' se
     recoge, un banner 'enCamino' se recibe en Terán. Antes se derivaba del
     rol, lo que hacía que admin en etapa 'envasado' disparara
     escanearRecibirTeran sobre un sublote aún envasado (guard inválido). */
  const accionDeAlert = (alert) =>
    alert.etapa === 'enCamino' ? 'escanearRecibirTeran' : 'escanearRecoger';

  const handleClaim = useCallback((alert) => {
    if (taking || scanFor) return;
    setScanFor(alert);
  }, [taking, scanFor]);

  const handleScanResult = useCallback(async (result) => {
    const alert = scanFor;
    setScanFor(null);
    if (!alert) return;
    const code = result?.cod || result?.raw || '';
    if (!code) { window.alert('QR no reconocido. Intenta de nuevo.'); return; }

    const accion = accionDeAlert(alert);
    setTaking(alert.cod);
    try {
      /* /api/sublotes/scan resuelve el sublote POR el código escaneado — la
         verdad física manda. Si escanean otro envase, la acción aplica a ese
         (igual que el escáner hero de Recolección). */
      const r = await api.escanearSublote(code, accion);
      const codReal = r?.sublote?.cod || code;
      /* La transición exitosa dispara su propio WS que removerá el banner.
         FIX U2: removemos por id (cod+etapa) para no purgar OTRO banner del
         mismo cod en etapa distinta (ej: Luis recoge → su banner envasado
         desaparece, pero el banner enCamino para Josué debe quedar). */
      setAlerts(prev => prev.filter(a => !(a.cod === codReal && a.etapa === alert.etapa)));
    } catch (e) {
      const msg = e?.message || '';
      const data = e?.data;
      /* Escanearon el QR del LOTE completo → ofrecer bulk (mismo flujo que
         RecoleccionPage). El guard anti-robo del backend exige el scanCod. */
      if (data && data.matchTipo === 'lote_no_sublote' && data.loteId) {
        const ok = window.confirm(
          `Escaneaste el QR del LOTE ${data.codigoLote}. ¿Tomar TODOS los sublotes elegibles del lote en una sola acción?`
        );
        if (ok) {
          try {
            await api.escanearLoteBulk({ loteId: data.loteId, codigoLote: data.codigoLote, accion, scanCod: code });
            setAlerts(prev => prev.filter(a => a.etapa !== alert.etapa || a.loteId !== data.loteId));
          } catch (e2) {
            console.warn('[Inbound] Error bulk claim:', e2?.message, e2?.data);
            window.alert(`No se pudo tomar el lote: ${e2?.message || 'error'}`);
          }
        }
      } else if (msg.includes('estado') || e?.status === 409) {
        /* 409 = ya fue tomado por otro entre que vi el banner y escaneé.
           FIX U2: filtros por id (cod+etapa) */
        setAlerts(prev => prev.map(a => a.id === alert.id
          ? { ...a, tomadoPor: 'otro usuario' }
          : a
        ));
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== alert.id));
        }, 1500);
      } else {
        console.warn('[Inbound] Error claim:', msg, e?.data);
        window.alert(`No se pudo tomar el sublote: ${msg}`);
      }
    } finally {
      setTaking(null);
    }
  }, [scanFor]);

  /* FIX U2: dismiss por id, no por cod — cada banner es independiente */
  const handleDismiss = useCallback((alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  /* No renderizar si el rol no recibe inbounds.
     OJO: si el escáner está abierto, NO desmontar aunque los banners se
     vacíen (un WS pudo remover el alert mientras el usuario apunta la
     cámara) — el dispatch del scan decide qué pasa. */
  if (!ROLES_INBOUND.includes(rol)) return null;
  if (alerts.length === 0 && !scanFor) return null;

  return (
    <>
    <div style={S.container} aria-live="polite">
      {alerts.map(a => {
        const yaTomado = !!a.tomadoPor;
        const isBusy = taking === a.cod || scanFor?.id === a.id;
        /* Label por ETAPA (quien puede actuar va a escanear):
           - etapa envasado → "Escanear y recoger" (Luis o admin)
           - etapa enCamino → "Escanear y recibir" (Josué o admin)
           El botón abre la CÁMARA — ya no despacha a ciegas. */
        const labelAccion = a.etapa === 'enCamino'
          ? 'Escanear y recibir'
          : 'Escanear y recoger';
        const labelTitulo = rol === 'recolector'
          ? 'Lote listo para recoger'
          : (a.etapa === 'enCamino'
              ? 'Sublote en camino a Terán'
              : 'Lote listo en fábrica');
        const puedeActuar = rol === 'recolector' || a.etapa === 'enCamino' || rol === 'admin';
        return (
          <div
            key={a.id}
            style={{
              ...S.card,
              opacity: yaTomado ? 0.6 : 1,
              borderColor: yaTomado ? 'var(--lp-text-tertiary)' : 'var(--lp-brand-600)',
            }}
            role="alert"
          >
            <div style={S.header}>
              <span style={{ ...S.icon, display: 'inline-flex', alignItems: 'center' }}>{yaTomado
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : (rol === 'recolector'
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>)}</span>
              <span style={S.title}>{labelTitulo}</span>
              {/* FIX jun 2026 (U8): badge PRUEBA en banner para que Luis/Josué
                  no recolecten/reciban físicamente sublotes de prueba. */}
              {a.esPrueba && <PruebaBadge size="sm" />}
              <button
                style={S.close}
                onClick={() => handleDismiss(a.id)}
                aria-label="Cerrar"
                title="Ignorar"
              >×</button>
            </div>
            <div style={S.producto}>{a.producto}</div>
            <div style={S.meta}>
              <span style={S.cod}>{a.cod}</span>
              {' · '}{a.qty} {a.tipo} · {a.lit}L
              {a.marca && <> · {a.marca}</>}
              <br />
              <span style={{ fontSize: 11, color: 'var(--lp-text-tertiary)' }}>
                Envasado por {a.origenUsuario || '—'}
              </span>
            </div>
            {yaTomado ? (
              <div style={S.taken}>
                Tomado por <strong>{a.tomadoPor}</strong>
              </div>
            ) : (
              <div style={S.actions}>
                {/* FIX R: solo renderizar botón de claim si el rol puede
                    actuar AHORA. Almacen viendo etapa 'envasado' no debería
                    poder tomar acción (Luis debe ir primero); el shouldShow
                    ya lo filtra, pero esta segunda capa es defensa. */}
                {puedeActuar ? (
                  <button
                    style={S.btn(rol === 'recolector' ? 'primary' : 'success')}
                    disabled={isBusy}
                    onClick={() => handleClaim(a)}
                  >
                    {isBusy ? 'Tomando...' : labelAccion}
                  </button>
                ) : (
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--lp-text-tertiary)', alignSelf: 'center' }}>
                    Esperando que Luis recoja…
                  </div>
                )}
                <button
                  style={S.btn('ghost')}
                  onClick={() => handleDismiss(a.id)}
                >
                  Ahora no
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
    {/* Escáner físico OBLIGATORIO para tomar el sublote del banner (decisión
        owner jun 2026). Mismo componente que Recolección/Recepción. */}
    {scanFor && (
      <QRScanner
        onResult={handleScanResult}
        onClose={() => setScanFor(null)}
      />
    )}
    </>
  );
}
