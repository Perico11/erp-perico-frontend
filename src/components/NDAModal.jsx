import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

const COMPANY_NAME = 'PINTURAS EL PERICO S.A. DE C.V.';
/* Duración del NDA: 7 días desde aceptación. Antes era diario (caducaba cada
   medianoche) y forzaba a Arely/compras a re-aceptar cada día — fricción
   innecesaria. Mantiene el cumplimiento legal (auditoría queda registrada en
   /api/audit/security al aceptar) y reduce frustración operativa. */
const NDA_VALIDEZ_DIAS = 7;
const NDA_KEY = (user, ctx) => 'nda_aceptado_v2_' + user.id + '_' + (ctx || 'session');

export function ndaYaAceptado(user, context) {
  if (!user) return false;
  try {
    const raw = localStorage.getItem(NDA_KEY(user, context));
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!ts || isNaN(ts)) return false;
    const diasTranscurridos = (Date.now() - ts) / (24 * 60 * 60 * 1000);
    return diasTranscurridos < NDA_VALIDEZ_DIAS;
  } catch { return false; }
}

const S = {
  overlay: { position:'fixed', inset:0, background:'rgba(15,12,8,.92)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99998, padding:16 },
  modal: { background:'var(--lp-bg-raised)', borderRadius:14, maxWidth:680, width:'100%', maxHeight:'calc(var(--pp-vvh, 100dvh) - 32px)', display:'flex', flexDirection:'column', boxShadow:'0 30px 60px rgba(0,0,0,.5)', overflow:'hidden', fontFamily:'var(--lp-font-sans)' },
  header: { background:'linear-gradient(135deg, #7c1d1d 0%, #b91c1c 100%)', padding:'20px 24px', color:'#fff' },
  iconLine: { display:'flex', alignItems:'center', gap:12 },
  iconBox: { width:44, height:44, borderRadius:12, background:'rgba(255,255,255,.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 },
  title: { fontSize:17, fontWeight:800, letterSpacing:'.02em' },
  subtitle: { fontSize:12, opacity:.9, marginTop:2, fontWeight:500 },
  body: { padding:'20px 24px', overflow:'auto', flex:1, fontSize:13, lineHeight:1.6, color:'var(--lp-text-primary)' },
  intro: { marginBottom:14 },
  numberedList: { paddingLeft:18, margin:'8px 0 14px' },
  numberedItem: { marginBottom:6 },
  legalSection: { marginTop:14, padding:12, background:'var(--lp-bg-base)', border:'1px solid var(--lp-border-subtle)', borderRadius:8, fontSize:12, lineHeight:1.55 },
  legalTitle: { fontSize:11, fontWeight:800, letterSpacing:'.08em', color:'var(--lp-text-primary)', textTransform:'uppercase', marginBottom:8 },
  legalItem: { marginBottom:6, paddingLeft:12, position:'relative' },
  legalDot: { position:'absolute', left:0, color:'#b91c1c', fontWeight:700 },
  warning: { marginTop:14, padding:12, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, fontSize:12, color:'#7c1d1d', fontWeight:600, lineHeight:1.5 },
  finalDecl: { marginTop:14, padding:12, background:'var(--lp-brand-50, #f0f9ff)', border:'1px solid var(--lp-brand-200, #bae6fd)', borderRadius:8, fontSize:12, lineHeight:1.5 },
  meta: { marginTop:12, padding:10, background:'var(--lp-bg-sunken)', borderRadius:6, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8, fontSize:11, color:'var(--lp-text-tertiary)' },
  metaItem: { display:'flex', flexDirection:'column', gap:2 },
  metaLabel: { fontSize:11, textTransform:'uppercase', fontWeight:700, letterSpacing:'.06em' },
  metaValue: { fontWeight:600, color:'var(--lp-text-primary)', fontSize:12 },
  footer: { padding:'14px 24px', borderTop:'1px solid var(--lp-border-subtle)', background:'var(--lp-bg-base)', display:'flex', gap:10 },
  btnReject: { flex:'0 0 auto', padding:'11px 18px', background:'var(--lp-bg-raised)', color:'#7c1d1d', border:'1.5px solid #fecaca', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnAccept: { flex:1, padding:'11px 18px', background:'linear-gradient(135deg, #15803d, #16a34a)', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(21,128,61,.3)' },
};

export default function NDAModal({ user, onAccept, onReject, context, productoNombre }) {
  const [ip, setIp] = useState('-');
  const userName = user && user.nombre ? user.nombre : 'Usuario';
  const userRol = user && user.rol ? user.rol : '-';
  const sessionDate = new Date().toLocaleString('es-MX', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const isProduccion = context === 'produccion';
  const modalRef = useRef(null);

  /* MÓVIL: bloquea el scroll del FONDO (html+body+#root, el scroller real) y
     publica --pp-vvh para que el body del modal siempre tenga overflow interno
     scrolleable. El componente solo se monta cuando debe mostrarse → true. */
  useBodyScrollLock(true);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); };
  }, []);

  useEffect(() => {
    fetch('/api/session').then(r => r.json()).then(d => { if (d && d.ip) setIp(d.ip); }).catch(() => {});
  }, []);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) { e.preventDefault(); e.stopPropagation(); }
  };

  const sendAudit = (tipo, detalle) => {
    try {
      api.post('/api/audit/security', {
        tipo: tipo, detalle: detalle, usuario: userName, rol: userRol,
        contexto: context || 'session', producto: productoNombre || null,
        userAgent: navigator.userAgent, ts: new Date().toISOString(),
      }).catch(() => {});
    } catch {}
  };

  const handleAccept = () => {
    try {
      /* Persistimos timestamp en ms; ndaYaAceptado() valida que no haya
         pasado de NDA_VALIDEZ_DIAS. */
      localStorage.setItem(NDA_KEY(user, context), String(Date.now()));
    } catch {}
    sendAudit('NDA_ACEPTADO', isProduccion ? 'Produccion: ' + (productoNombre || '?') : 'Sesion');
    if (onAccept) onAccept();
  };

  const handleReject = () => {
    sendAudit('NDA_RECHAZADO', isProduccion ? 'Produccion: ' + (productoNombre || '?') : 'Sesion');
    if (onReject) onReject();
  };

  return (
    <div style={S.overlay} onClick={handleOverlayClick} onMouseDown={handleOverlayClick}>
      <div style={S.modal} ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <div style={S.iconLine}>
            <div style={S.iconBox}>!</div>
            <div>
              <div style={S.title}>AVISO DE CONFIDENCIALIDAD Y RESPONSABILIDAD LEGAL</div>
              <div style={S.subtitle}>{isProduccion ? 'Vas a acceder a una formula protegida' : 'Informacion protegida por secreto industrial'}</div>
            </div>
          </div>
        </div>

        <div style={S.body}>
          <div style={S.intro}>
            La informacion, formulas, procesos, metodos de calculo y datos contenidos
            en este sistema constituyen <strong>SECRETOS INDUSTRIALES Y COMERCIALES</strong> propiedad
            exclusiva de <strong>{COMPANY_NAME}</strong>, protegidos conforme a la legislacion mexicana vigente.
            {isProduccion && productoNombre ? <span> Estas por iniciar la produccion de <strong>{productoNombre}</strong>. Cada acceso queda auditado.</span> : null}
          </div>

          <div style={{ fontWeight:700, marginTop:6 }}>Al ingresar a este modulo, usted reconoce y acepta que:</div>
          <ol style={S.numberedList}>
            <li style={S.numberedItem}>Tiene acceso autorizado <strong>unica y exclusivamente</strong> para los fines productivos de su puesto.</li>
            <li style={S.numberedItem}>Esta estrictamente prohibido <strong>copiar, reproducir, fotografiar, capturar pantalla, transcribir, divulgar, transmitir, compartir o extraer</strong> por cualquier medio (fisico, digital o verbal) la informacion aqui contenida.</li>
            <li style={S.numberedItem}>Toda actividad realizada en este modulo es <strong>monitoreada y registrada</strong> (usuario, IP, fecha, hora, acciones).</li>
          </ol>

          <div style={S.legalSection}>
            <div style={S.legalTitle}>Fundamento Legal Aplicable</div>
            <div style={S.legalItem}><span style={S.legalDot}>&gt;</span><strong>Ley Federal de Proteccion a la Propiedad Industrial (LFPPI)</strong>, Titulo Cuarto, Capitulo Unico, <strong>articulos 163 a 179</strong>: define secreto industrial, prohibe su apropiacion indebida, uso o divulgacion, e impone sanciones civiles, administrativas y economicas (multas hasta <strong>250,000 UMA</strong>, indemnizacion por danos y perjuicios y embargo de bienes).</div>
            <div style={S.legalItem}><span style={S.legalDot}>&gt;</span><strong>Codigo Penal Federal, articulo 210</strong>: sanciona a quien sin justa causa y sin consentimiento revele algun secreto o comunicacion reservada que conozca con motivo de su empleo, cargo o puesto.</div>
            <div style={S.legalItem}><span style={S.legalDot}>&gt;</span><strong>Codigo Penal Federal, articulo 211</strong>: establece <strong>prision de uno a cinco anos</strong>, multa y suspension profesional cuando la revelacion sea hecha por quien presta servicios tecnicos o cuando el secreto revelado sea de caracter industrial.</div>
            <div style={S.legalItem}><span style={S.legalDot}>&gt;</span><strong>Codigo Penal Federal, articulos 211 Bis 1 al 211 Bis 7</strong>: sancionan con prision y multa el acceso, copia, modificacion o destruccion ilicita de informacion en sistemas informaticos protegidos.</div>
            <div style={S.legalItem}><span style={S.legalDot}>&gt;</span><strong>Ley Federal del Trabajo, articulo 47, fraccion IX</strong>: causal de <strong>rescision de contrato sin responsabilidad para el patron</strong> por revelar secretos de fabricacion o asuntos reservados.</div>
          </div>

          <div style={S.warning}>El incumplimiento generara <strong>rescision inmediata</strong> de la relacion laboral o contractual, asi como las acciones civiles y penales correspondientes, incluyendo reclamacion de danos y perjuicios.</div>
          <div style={S.finalDecl}>Al presionar <strong>"Acepto y entiendo"</strong> usted manifiesta <strong>bajo protesta de decir verdad</strong> que ha leido, comprendido y aceptado los terminos anteriores.</div>

          <div style={S.meta}>
            <div style={S.metaItem}><span style={S.metaLabel}>Usuario</span><span style={S.metaValue}>{userName}</span></div>
            <div style={S.metaItem}><span style={S.metaLabel}>Rol</span><span style={S.metaValue}>{userRol}</span></div>
            <div style={S.metaItem}><span style={S.metaLabel}>IP</span><span style={S.metaValue}>{ip}</span></div>
            <div style={S.metaItem}><span style={S.metaLabel}>Fecha y hora</span><span style={S.metaValue}>{sessionDate}</span></div>
            {isProduccion && productoNombre ? <div style={S.metaItem}><span style={S.metaLabel}>Formula</span><span style={S.metaValue}>{productoNombre}</span></div> : null}
          </div>
        </div>

        <div style={S.footer}>
          <button style={S.btnReject} onClick={handleReject}>Cancelar y salir</button>
          <button style={S.btnAccept} onClick={handleAccept}>Acepto y entiendo</button>
        </div>
      </div>
    </div>
  );
}
