/* ═══════════════════════════════════════════════════════════════════════
   useVaciadores — catálogo de envasadores para los sheets de envasado.

   Jul 2026 (pedido dueño): cada sublote guarda QUIÉN lo envasó, no solo
   quién lo registró. El catálogo lo mantiene admin en Usuarios ▸ Vaciadores
   (routes/vaciadores.js); aquí solo se lee.

   Recuerda el último elegido en localStorage por dispositivo: en una tanda,
   el mismo vaciador envasa varios sublotes seguidos y re-elegirlo cada vez
   era fricción pura. Realtime: si admin da de alta a alguien mientras el
   sheet está abierto, la lista se refresca sola.
   ═══════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useRealtimeSync } from './useRealtimeSync';

const LAST_KEY = 'pp_ultimo_vaciador_v1';

export default function useVaciadores() {
  const [vaciadores, setVaciadores] = useState([]);
  const [envasadorId, setEnvasadorId] = useState(() => {
    try { return localStorage.getItem(LAST_KEY) || ''; } catch { return ''; }
  });

  const cargar = useCallback(() => {
    api.getVaciadores()
      .then(r => setVaciadores(Array.isArray(r?.data) ? r.data : []))
      .catch(() => { /* sin catálogo el select queda vacío; no rompe el envasado */ });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useRealtimeSync({ onVaciadores: () => cargar() });

  /* `elegir` va ANTES del efecto que la usa. Estaba declarada después: funciona
     porque los efectos corren tras el render, pero es una referencia a una
     `const` en zona muerta temporal — si ese código llegara a ejecutarse durante
     el render, sería un ReferenceError. */
  const elegir = useCallback((id) => {
    setEnvasadorId(id);
    try { id ? localStorage.setItem(LAST_KEY, id) : localStorage.removeItem(LAST_KEY); } catch {}
  }, []);

  /* Si el recordado ya no existe (admin lo dio de baja), limpiar. */
  useEffect(() => {
    if (!envasadorId || vaciadores.length === 0) return;
    if (!vaciadores.some(v => v && v.id === envasadorId)) elegir('');
  }, [vaciadores]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegido = vaciadores.find(v => v && v.id === envasadorId) || null;

  /* Campos que se anexan al sublote (nombre COPIADO: si luego borran al
     vaciador del catálogo, la historia del lote no se altera). */
  const camposSublote = elegido
    ? { envasadoPor: elegido.nombre, envasadorId: elegido.id }
    : {};

  return { vaciadores, envasadorId, elegir, elegido, camposSublote, recargar: cargar };
}
