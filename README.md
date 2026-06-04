# ERP Pinturas El Perico — Frontend

Sistema ERP para fábrica de pinturas (producción + envasado + recolección +
almacén Terán + compras + devoluciones + cycle count).

Este repo contiene **solo la capa visual** (React 19 + Vite). El backend
(Express + JSON files) vive en otro lugar y se conecta vía REST + WebSocket.

---

## Stack

- **React 19** con `react-router-dom`
- **Vite** (build + dev server)
- **Estilos inline** + tokens CSS (no Tailwind, no styled-components)
- **WebSocket** en `/ws` para sync en tiempo real (push de eventos por canal y rol)
- **Vitest** para tests unitarios
- Service Worker propio en `public/sw.js` (cache-control)
- PWA habilitada vía `manifest.webmanifest`

## Estructura

```
src/
├── App.jsx                 # Router + ProtectedRoute + RoleRoute
├── main.jsx                # Entry, registra/desregistra SW
├── index.css               # Reset + safe-area + spinner global
├── components/             # Componentes compartidos
│   ├── layout/             # Sidebar (desktop) + BottomNav (móvil) + TopBar + AppLayout
│   ├── ui/                 # Botones, badges, cards, modal, toast, segmented control...
│   ├── InboundAlertManager # Banners cross-rol (envasado/recolección/recepción)
│   ├── PedidoModal         # Modal central bloqueante de nuevo pedido (técnico)
│   ├── PedidoIncomingManager # Orquesta la cola de pedidos pendientes
│   ├── PedidoLoteActions   # Panel de acciones del lote dentro de card de pedido
│   ├── QRModal             # Scanner QR (BarcodeDetector + fallback manual)
│   ├── NDAModal            # Cláusula de confidencialidad (1 vez por sesión)
│   └── SecureView          # Wrapper para vistas con datos sensibles
├── context/
│   ├── AuthContext         # Sesión + permisos del rol (fallback offline)
│   └── PedidosNotifContext # Cola global de pedidos pendientes (solo técnico)
├── hooks/
│   ├── useApi              # Wrapper fetch con AbortController
│   ├── useApiData          # Polling + reload manual
│   ├── useConfirm          # Modal confirm/prompt accesible
│   ├── useRealtimeSync     # WebSocket dispatcher por canal
│   └── useLocalToast
├── lib/
│   ├── estados.js          # Estados canónicos del flujo (espejo backend)
│   ├── loteTransiciones.js # State machine de lote/sublote (espejo backend)
│   └── qrGenerator.js      # SVG QR
├── pages/                  # Una carpeta por sección de la app
│   ├── login/
│   ├── dashboard/          # Cards de pendientes + Mis lotes pipeline
│   ├── pedidos/            # Crear/aceptar/rechazar pedidos del cliente
│   ├── ordenes/            # Órdenes de producción + tab OC MP de compras
│   ├── produccion/         # Wizard paso-a-paso + QC + Mis activos
│   ├── stock-fabrica/      # Envasado de lotes producidos + transferencia
│   ├── recoleccion/        # Luis recoge sublotes → en camino
│   ├── almacen-recepcion/  # Josué recibe sublotes en Terán
│   ├── inventario/         # MP + PT + envases
│   ├── trazabilidad/       # Historial individual de cada lote
│   ├── compras/            # OCs MP + Forecast IA + MRP
│   ├── devoluciones/       # Cliente devuelve → técnico decide → arely reembolsa
│   ├── cycle-count/        # Conteo físico Burgos
│   ├── reportes/           # Snapshot mensual + análisis Pareto + estratégico
│   ├── laboratorio/        # Pruebas de calidad
│   ├── formulas/           # Editor de fórmulas (admin/técnico)
│   ├── admin/              # Panel: usuarios, permisos, SAT, devoluciones, sesiones
│   ├── notificaciones/
│   └── seguridad/
├── services/api.js         # Cliente REST único
├── utils/                  # humanizeError + pushNotifications (browser API)
└── test/                   # Vitest
```

## Design system — Light Premium

**Tokens vivos en `:root`** (definidos en `index.css` y consumidos vía `var(--lp-*)`).

```css
:root {
  /* Fondos */
  --lp-bg-base:#FAFAF8; --lp-bg-raised:#FFFFFF; --lp-bg-sunken:#F5F4F0;

  /* Bordes */
  --lp-border-subtle:#E8E6DE; --lp-border-default:#DDD9CE;

  /* Texto */
  --lp-text-primary:#1A1815; --lp-text-secondary:#6B6560; --lp-text-tertiary:#9C9589;

  /* Marca (azul) */
  --lp-brand-50:#EFF5FF; --lp-brand-100:#DBEAFE; --lp-brand-500:#3B7BF6;
  --lp-brand-600:#2563EB; --lp-brand-700:#1D4ED8;

  /* Estados */
  --lp-success-600:#16A34A; --lp-warning-600:#D97706; --lp-danger-600:#DC2626;

  /* Radios */
  --lp-radius-sm:6px; --lp-radius-md:10px; --lp-radius-lg:14px; --lp-radius-xl:20px;

  /* Tipografía */
  --lp-font-sans: 'DM Sans', -apple-system, sans-serif;
  --lp-font-mono: 'JetBrains Mono', monospace;
}
```

**Reglas no negociables:**
- Botones NUNCA al 100% width arbitrario (usar `flex:1` o tamaño contenido)
- Touch targets ≥ 44px en móvil
- Cero emojis decorativos en UI (excepto 🧪 reservado para badge "PRUEBA" y campana 🔔 para notif)
- Iconos en SVG inline, stroke 2, `currentColor`
- Responsive obligatorio: `@media (max-width: 640px)` para móvil
- Respetar `@media (prefers-reduced-motion: reduce)`

## Roles del sistema

| Rol | Usuario | Pantallas principales |
|---|---|---|
| `admin` | Emmanuel (PIN 1106) | Todo |
| `tecnico` | Enrique (PIN 1122) | Pedidos, Órdenes, Producción, Stock Fábrica, QC |
| `almacen` | Josué (PIN 3300) | Pedidos, Recepción Terán, Stock Fábrica |
| `recolector` | Luis Lara (PIN 4400) | Recolección (móvil) |
| `compras` | Arely | Compras OCs + MRP + Forecast + Devoluciones reembolso |
| `inventario` | Burgos (PIN 0980) | Cycle Count + Inventario read-only |

## Flujo principal end-to-end

```
Josué crea pedido → Enrique acepta + produce → QC opcional
  → Enrique envasa (cubeta/galón/litro/TOTE)
  → Josué marca "Enviar a recolectar"
  → Luis recibe push "Voy por él" → escanea QR
  → Luis llega a Terán
  → Josué escanea/confirma recepción → sublote en stock Terán
  → Lote pasa a "entregado"
```

Cualquier devolución del cliente:

```
Josué/admin registra devolución
  → Enrique recibe físicamente
  → Enrique decide: regresar / reprocesar / descartar
  → Si "regresar": Arely emite nota de crédito
```

## Sistema de notificaciones (Sprint P-U)

- **Modal central bloqueante** para Enrique cuando entra pedido nuevo
- **Banners emergentes** (`InboundAlertManager`) para Luis y Josué en flujo de recolección/recepción
- **Badge rojo circular** (`CountBadge`) en sidebar/bottom-nav con # de pendientes
- **Push notifications** del navegador (con dedupe en localStorage)
- WebSocket en `/ws` filtrado por rol vía matriz `NOTIF_TARGETS_POR_EVENTO`

## Modo prueba

Flag `esPrueba` por entidad (pedido → orden → lote → sublote → devolución) que:
- Hace que el flujo se comporte IDÉNTICO al real
- Pero NO descuenta MP, envases, tapas, ni PT
- Muestra badge `🧪 PRUEBA` en TODAS las pantallas downstream
- **Es inmutable post-creación** (no se puede flipear con upsert)

## Scripts

```bash
npm install
npm run dev      # Vite dev server (localhost:5173, proxy /api → :3000)
npm run build    # Build a dist/
npm test         # Vitest
```

## Para Claude Design

El brief de identidad visual está en `BRIEF_IDENTIDAD.md`. Las pantallas que
más necesitan rediseño según última auditoría:

1. **DashboardPage** — KPIs por rol (los cards genéricos no escalan)
2. **PedidosPage / OrdenesPage** — cards de pedidos muy densos, pipeline poco visual
3. **TrazabilidadPage** — timeline individual recién mejorado, podría ser más visual
4. **StockFabricaPage** — el wizard de envasado es complejo
5. **AlmacenRecepcionPage** — escaneo QR + acciones de sublote

El componente `mockups_selector.html` en la raíz tiene mockups previos para
referencia de estilo. La línea visual final debe ser **calmada, profesional,
sin emojis decorativos**.
