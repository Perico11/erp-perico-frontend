# Brief para Claude Design — ERP Pinturas El Perico

> Documento dirigido a Claude (o cualquier diseñador AI) que vaya a proponer
> rediseños visuales de las pantallas de este ERP. Léeme **antes** de generar
> mockups o componentes.

---

## Qué es este sistema

ERP interno de una fábrica de pinturas con **6 roles operativos** que se
coordinan en tiempo real durante el día. No es un SaaS multi-tenant; es una
herramienta de planta con touch targets grandes, datos densos y flujos
físicos (escanear QR, contar litros, decidir si una devolución se reprocesa).

| Rol | Lo que hace todo el día |
|---|---|
| **Admin** (Emmanuel) | Dueño — supervisa todo, decide ajustes manuales con TOTP |
| **Técnico** (Enrique) | Acepta pedidos, opera el wizard de producción, envasa, hace QC |
| **Almacén Fábrica** (Josué) | Crea pedidos del cliente, recibe sublotes en Terán, devuelve producto |
| **Recolector** (Luis) | Recoge sublotes de fábrica → Terán. Móvil 100%, una mano mientras maneja |
| **Compras** (Arely) | OCs de materia prima, forecast IA, recibe MP, emite notas de crédito |
| **Inventario** (Burgos) | Cycle counts, varianzas, sin permiso de editar inventario directo |

## Filosofía visual — "Light Premium"

Inspiración: **Linear** + **Notion** + **Apple Human Interface Guidelines**.

- Fondos blancos/cremas, no grises sucios
- Sombras suaves y radios redondeados (10-20px)
- Tipografía **DM Sans** + **JetBrains Mono** para códigos/folios
- Color de marca azul `#2563EB` reservado para acciones primarias
- Estados semánticos (success verde, warning ámbar, danger rojo, info cyan)
- Cero gradientes salvo en gráficos
- Cero emojis decorativos — solo se permiten:
  - 🧪 para badge "PRUEBA" (lote/pedido de prueba que no toca inventario)
  - 🔔 para campana de notificaciones
  - 🚚 / 📦 en banners cross-rol (legacy, considerar reemplazar por SVG)

Detalles del design system completo: ver `README.md` sección "Design system".

## Reglas no negociables del owner

1. **Botones nunca al 100% width arbitrario** — siempre tamaño contenido o `flex:1` justificado
2. **Touch targets ≥ 44px** en móvil (operarios usan celular con guantes)
3. **No introducir Tailwind ni styled-components** — el proyecto usa estilos inline + tokens CSS
4. **Responsive obligatorio**: `@media (max-width: 640px)` para móvil
5. **Respetar `prefers-reduced-motion`** — animaciones opt-out
6. **Iconos SVG inline**, stroke 2, `currentColor` (no librerías externas)
7. **Todos los colores deben venir de tokens `--lp-*`** — cero hex sueltos
8. **Códigos/folios** siempre en `font-family: var(--lp-font-mono)`, color `var(--lp-brand-700)`

## Pantallas priorizadas para rediseño

En orden de impacto operativo:

| # | Archivo | Problema actual | Lo que se necesita |
|---|---|---|---|
| 1 | `src/pages/dashboard/DashboardPage.jsx` | KPIs genéricos con cards muy densos; no escala por rol | Dashboard específico por rol con jerarquía visual clara (urgente vs informativo) |
| 2 | `src/pages/pedidos/PedidosPage.jsx` | Cards muy densas, pipeline poco visual del estado del pedido | Card de pedido con timeline horizontal + acciones contextuales claras |
| 3 | `src/pages/ordenes/OrdenesPage.jsx` | Lista de órdenes sin diferenciación visual entre etapas | Cards agrupadas por fase con badges de estado prominentes |
| 4 | `src/pages/produccion/ProduccionFlow.jsx` | Wizard paso-a-paso funcional pero visual plano | Wizard tipo "guided tour" con progreso visible, paso actual destacado |
| 5 | `src/pages/stock-fabrica/StockFabricaPage.jsx` | Modal de envasado complejo con muchos campos | Envasado guiado tipo formulario inteligente (auto-completar marca/tapa) |
| 6 | `src/pages/almacen-recepcion/AlmacenRecepcionPage.jsx` | Scanner QR + lista de sublotes mezclados | Scanner como hero + lista clara de "qué falta por recibir" |
| 7 | `src/pages/recoleccion/RecoleccionPage.jsx` (vista Luis) | Pantalla minimalista pero el botón "Voy por él" puede ser más prominente | Diseño tipo app de delivery: 1 acción dominante por estado |
| 8 | `src/pages/trazabilidad/TrazabilidadPage.jsx` | Timeline individual recién agregado | Mejorar densidad visual del pipeline + bitácora |

## Pantallas que NO necesitan rediseño urgente

- Login (LoginPage) — funciona bien, identidad clara
- Admin (todas las sub-pestañas) — uso solo de Emmanuel, complejas por necesidad
- Compras (OCs MP, MRP, Forecast IA) — operativas, mejorables pero no urgentes
- Cycle Count (Burgos) — recién mejoradas

## Contexto técnico que importa para el diseño

- **Realtime**: cualquier card que muestre estado puede cambiar en cualquier momento (WebSocket). El diseño debe tener transiciones suaves entre estados.
- **Modo prueba**: cuando `pedido.esPrueba === true` o `lote.esPrueba === true`, el diseño debe mostrar visualmente que es simulación (ya hay componente `<PruebaBadge />` en `src/components/ui/PruebaBadge.jsx`).
- **Mobile-first para 3 roles** (Luis, Josué, Burgos) — usan celular en planta. Los otros 3 (Enrique, Arely, Emmanuel) tienen tablet o PC.
- **Cargas variables**: un día Enrique tiene 2 pedidos, otro día 20. El diseño debe escalar.

## Lo que NO quiero

- Modo oscuro (proyecto está en modo claro, no es prioridad)
- Animaciones excesivas o "wow factor"
- Más opciones de configuración visibles
- Iconos genéricos (lucide, heroicons) — los iconos actuales son SVG inline custom
- Componentes que rompan con los `ui/*` ya existentes (Button, Card, Modal, Badge, etc.)

## Cómo entregar la propuesta

Para cada pantalla rediseñada:

1. **Componente completo** en React 19, estilos inline, listo para `Write` al path original
2. **Lista de tokens usados** (verificar contra los del README)
3. **Variantes responsive** explícitas (cómo se ve en 1280px y en 375px)
4. **Lista de cambios** vs versión actual (qué se eliminó, qué se agregó)
5. **Riesgos de regresión** (ej: "cambié la prop X del componente Y; verificar consumers")

Si tienes dudas sobre el flujo de datos o el modelo: pregunta antes de
proponer. El backend NO está en este repo — solo la capa visual.
