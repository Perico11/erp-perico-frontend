# BRIEF DE IDENTIDAD — Pinturas El Perico ERP
**Sistema de Diseño Light Premium (LP) · v1.0 · Mayo 2026**

Documento maestro. Todo cambio visual del ERP debe consultarse aquí antes de
implementarse. Si una pantalla no respeta este brief, está rota.

---

## 1. Principios

1. **Consistencia sobre creatividad.** Si el sistema ya tiene un patrón, úsalo.
2. **Jerarquía visual clara.** Una sola acción primaria por pantalla.
3. **Densidad técnica.** El usuario es operador, no consumidor — datos visibles.
4. **Mobile-first táctil.** Touch targets ≥44px en móvil, hover en desktop.
5. **Estados explícitos.** Loading, vacío, error, éxito — todos con UI definida.

---

## 2. Paleta de color (CSS variables)

Definidas en `light-premium.css`. NUNCA hardcodear hex que no sea referencia
a una variable.

### Marca
| Token | Valor | Uso |
|---|---|---|
| `--lp-brand-50` | #EFF5FF | Hover sutil, fondo de selección |
| `--lp-brand-100` | #DBEAFE | Badge informativo |
| `--lp-brand-500` | #3B7BF6 | Acentos secundarios |
| `--lp-brand-600` | #2563EB | **Acción primaria** (botones, links) |
| `--lp-brand-700` | #1E40AF | Texto sobre fondo brand-100 |

### Semánticos
| Estado | 50 | 100 | 500 | 600 | 700 | Uso |
|---|---|---|---|---|---|---|
| **Success** | #ECFDF5 | #D1FAE5 | #10B981 | #059669 | #047857 | Producir, Aprobar, OK |
| **Warning** | #FFFBEB | #FEF3C7 | #F59E0B | #D97706 | #B45309 | Modo prueba, En proceso, Alertas |
| **Danger** | #FEF2F2 | #FEE2E2 | #EF4444 | #DC2626 | #B91C1C | Eliminar, Errores, Stock crítico |
| **Info/Purple** | #FAF5FF | #EDE9FE | #A855F7 | #7C3AED | #6D28D9 | QC, Lab |

### Neutros
| Token | Valor | Uso |
|---|---|---|
| `--lp-bg-base` | #FAFAF8 | Fondo de página |
| `--lp-bg-raised` | #FFFFFF | Tarjetas, modales |
| `--lp-bg-sunken` | #F5F4F0 | Inputs, áreas pasivas, headers de tabla |
| `--lp-border-subtle` | #E8E6DE | Bordes de tarjeta, separadores |
| `--lp-border-strong` | #D6D3CA | Bordes activos, focus |
| `--lp-text-primary` | #1A1815 | Títulos, valores |
| `--lp-text-secondary` | #6B6560 | Descripciones, meta |
| `--lp-text-tertiary` | #9C9589 | Placeholders, hints |

---

## 3. Tipografía

```
Sans:  DM Sans (UI, texto)
Mono:  JetBrains Mono (códigos, IDs, números técnicos, kg, ml, tiempos)
```

### Escala
| Uso | Tamaño | Peso | Familia |
|---|---|---|---|
| Display (KPI valor grande) | 24-28px | 800 | mono |
| Heading 1 (título de página) | 18px | 800 | sans |
| Heading 2 (sección) | 15px | 700 | sans |
| Body normal | 13-14px | 500 | sans |
| Caption / meta | 12px | 500 | sans |
| Microcopy / hint | 10-11px | 600 mayúsculas letter-spacing .04em | sans |
| Código / ID | 12-14px | 700 | mono |

**Regla:** códigos como `OP-260508-001`, kg, litros, montos siempre en mono.

---

## 4. Spacing & Radios

### Spacing scale (px)
```
4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32 · 40 · 60
```
Usar incrementos de la escala. Nunca `padding: 7px 11px`.

### Radios
| Token | Valor | Uso |
|---|---|---|
| `--lp-radius-sm` | 6px | Inputs, badges, botones secundarios |
| `--lp-radius` | 10px | Tarjetas, modales, paneles |
| `--lp-radius-lg` | 14px | Modal grande, hero |
| `--lp-radius-pill` | 999px | Chips, pills, segmented control |

---

## 5. Componentes

### 5.1 Botón
**Tamaño base:** padding `10px 18px`, fontSize `13px`, fontWeight `600`,
borderRadius `8px`, minHeight `44px` en móvil / `40px` en desktop.

| Variante | Background | Texto | Borde | Uso |
|---|---|---|---|---|
| `primary` | brand-600 | #fff | none | Acción principal |
| `success` | success-600 | #fff | none | **Producir**, Aprobar |
| `warning` | warning-600 | #fff | none | Modo prueba, Iniciar |
| `danger` | danger-600 | #fff | none | Eliminar, Cancelar |
| `secondary` | bg-raised | text-primary | 1.5px border-subtle | Cerrar, Cancelar acción |
| `ghost` | transparent | text-secondary | 1.5px border-subtle | Acciones terciarias |
| `link` | none | brand-600 | none | Navegación inline |

**Reglas:**
- NUNCA `width: 100%` en desktop. En móvil sí cuando hay un solo botón.
- UN solo botón primario por pantalla / por sección.
- Las transiciones de estado en cards (→ Pendiente, → Cancelada) usan variante `secondary` con tinte del estado.

### 5.2 Tarjeta (Card)
```
fondo:       var(--lp-bg-raised)
borde:       1.5px solid var(--lp-border-subtle)
radio:       var(--lp-radius)
padding:     16px
margin-bot:  12px (en grid)
sombra:      ninguna por default
```

**Estados:**
- **Normal:** como arriba.
- **Prueba (`esPrueba`):** fondo `var(--lp-warning-50)`, borde `2px dashed var(--lp-warning-600)`. NO usar fondo amarillo encendido.
- **Highlight (selección):** fondo `var(--lp-brand-50)`, borde `2px solid var(--lp-brand-200)`.
- **Hover** (clickeable): borde se intensifica a `border-strong`, sin sombra.

**Layout interno (orden vertical):**
1. **Header:** código mono + estado badge + prioridad badge (flex wrap)
2. **Title:** nombre del producto/orden (15px / 700)
3. **Meta:** cantidad · fecha · notas (12px / text-secondary)
4. **Timeline / progreso** (opcional)
5. **QC summary** (solo si hay datos válidos — nunca un "QC:" vacío)
6. **Acciones:** primario primero, transiciones después, eliminar al final

**Lista de tarjetas:** SIEMPRE en grid responsivo:
```css
display: grid;
grid-template-columns: repeat(auto-fill, minmax(320-360px, 1fr));
gap: 12px;
```
NUNCA tarjetas full-width apiladas verticalmente en desktop.

### 5.3 Badge / Chip
```
padding:    3px 8px
fontSize:   10px
fontWeight: 700
radius:     6px
text:       UPPERCASE letter-spacing .04em
```
Combinaciones: `{bg, fg}` siempre del mismo escalón semántico:
- `success-100 / success-600`
- `warning-100 / warning-600`
- `danger-100 / danger-600`
- `brand-100 / brand-700`
- `purple-100 / purple-600` (QC, Lab)

**Modo prueba:** badge con `🧪 PRUEBA` usando warning-600 sobre warning-100.

### 5.4 Input / Select
```
padding:    10px 12px
fontSize:   13px
border:     1.5px solid var(--lp-border-subtle)
radius:     8px
background: var(--lp-bg-raised) / #fff
```
**Focus:** borde a `--lp-brand-500`, sin shadow.
**Error:** borde a `--lp-danger-500`, mensaje debajo en rojo 11px.
**Disabled:** fondo `--lp-bg-sunken`, opacity 0.6.

### 5.5 SegmentedControl (toolbars)
Pill flotante con opciones. Es el patrón canónico para tabs/filtros cortos.
- Container: `bg-sunken`, radio pill, padding 4px.
- Opción activa: `bg-raised`, text-primary, sombra sutil.
- Opción inactiva: text-tertiary.
NUNCA tres botones sueltos como tabs.

### 5.6 KPI Card
```
fondo:    bg-raised
borde:    1.5px solid border-subtle
borderTop: 3px solid <accent del KPI>
padding:  14px 16px
align:    center
```
- Label: 10px / 700 / uppercase / letter-spacing .06em / text-tertiary
- Valor: 24px / 700 / mono / text-primary

Grid: `repeat(auto-fill, minmax(130px, 1fr))`, gap 10px.

### 5.7 Cronómetro (timer)
- Live: 64px / 800 / mono / centrado
- Color: success <1h, warning 1-3h, danger >3h
- Compact (badge): 12px / 700 / mono con ⏱ prefix

### 5.8 Modal
```
overlay:   rgba(0,0,0,.45) con z-index 1000
modal:     bg-raised, radius 14px, max-width 480-720px
header:    16px 20px, border-bot subtle
body:      16px 20px
footer:    12px 20px, border-top subtle, botones derecha
```

### 5.9 Toast
- Posición: `bottom: 90px` (encima del bottom-nav móvil), centrado horizontal
- Variantes: success (verde), error (rojo), info (brand). NUNCA verde para error.
- Duración: 4-5 seg. Auto-dismiss.

---

## 6. Layout

### Sidebar (desktop ≥1024px)
- Ancho: **240px** fijo
- Items: padding `11px 14px`, gap `12px`, fontSize `14px`
- Iconos: **22×22** stroke 2
- Activo: `bg-brand-50`, fontWeight 600, color `brand-700`

### Bottom-nav (móvil <1024px)
- Altura: 72px
- 5 grupos máximo, scroll horizontal si más
- Iconos: 22×22, label 10px

### Topbar
- Altura: 56px
- Título: 18px / 800
- Right: avatar + notificaciones + logout (gap 12px)

### Página
- Padding lateral: 20px (móvil) / 24px (desktop)
- Padding-bottom móvil: 80px (espacio para bottom-nav)

---

## 7. Iconografía

- Lucide / Feather como base. Stroke 2, line-cap round.
- Tamaños canónicos: **22px** (sidebar/nav), **18px** (botones), **14px** (inline en texto).
- NUNCA emojis decorativos en botones de producción (`▶`, `✓`). Texto plano.
- Emojis permitidos: estados especiales (🧪 PRUEBA, ⚠ Alerta, 🔒 Confidencial).

---

## 8. Estados de pantalla

### Loading
Spinner LP centrado en `min-height: 40vh`. NO skeleton screens.

### Empty
- Icono grande 48px (emoji o lucide)
- Heading 16px / 600 / text-secondary
- Descripción 12px / text-tertiary con call-to-action en negrita

### Error
- Banner rojo con `danger-100 / danger-700`, padding 10-16px, radio 8px
- Mensaje en 12-13px, primera palabra "Error:" en negrita

---

## 9. Reglas de comportamiento

1. **Modo prueba:** todo registro creado con `esPrueba=true` muestra badge `🧪 PRUEBA` en CADA card que aparece (pedido, orden, lote, sublote). El borde dashed warning aplica.
2. **Permisos:** botones que requieren rol mayor (eliminar, cambiar precios) NO se muestran al usuario sin ese rol. No se ocultan con disabled.
3. **Confirmaciones:** acciones destructivas (eliminar, cancelar) usan `ConfirmModal` con tinte danger.
4. **Datos vacíos:** si un campo no tiene datos, se omite del render. NUNCA mostrar "QC:" sin valores.
5. **Realtime:** WebSocket actualiza vistas activas. No mostrar estados "stale".

---

## 10. Don'ts

- ❌ Hardcodear color hex que no esté en la paleta.
- ❌ Mezclar tipografías fuera de DM Sans / JetBrains Mono.
- ❌ Tarjetas full-width en desktop.
- ❌ Botones con `width: 100%` en desktop.
- ❌ Iconos play/check decorativos en botones de acción crítica.
- ❌ Mostrar campos vacíos como `Etiqueta: ` (sin valor).
- ❌ Toasts verdes para mensajes de error.
- ❌ Modales encadenados (modal abre modal abre modal).
- ❌ Más de un botón primario por pantalla/sección.
- ❌ Inventar variantes de color nuevas — pedir token al brief.

---

## 11. Pantallas que ya cumplen el brief
- ✅ Pedidos (grid responsivo, cards LP, segmentedControl, cronómetro)
- ✅ Producción → Lanzar lote (grid, KPIs, badges)
- ✅ Producción → ProduccionFlow (timer, dual cards, QC inline)
- ✅ Compras → MRP / Pronóstico (segmentedControl, KPIs)
- ✅ Margenes (segmentedControl + dropdown)

## 12. Pantallas pendientes de auditoría
- ⚠ Órdenes (cards desordenadas, QC: vacío, badges mezclados)
- ⚠ StockFábrica / Envasado
- ⚠ Recolección
- ⚠ Almacén Recepción
- ⚠ Trazabilidad
- ⚠ Devoluciones
- ⚠ Notificaciones
- ⚠ Admin → CycleCount

---

## 13. Cómo introducir un cambio

1. Lee este documento.
2. Si tu cambio NO está cubierto, abre issue y propón patch al brief antes de codear.
3. Usa los componentes reusables: `Button`, `Card`, `Badge`, `SegmentedControl`, `Cronometro`, `KPI`. Si no existe, créalo aquí — no en la pantalla.
4. Antes de mergear, captura comparativa: pantalla anterior vs. nueva.
