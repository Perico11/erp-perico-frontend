# Logos — Pinturas El Perico

Esta carpeta es servida directamente por Vite en la URL `/logos/...`.
Por ejemplo, un archivo aquí llamado `astra-cover.png` se accede en la app
con `<img src="/logos/astra-cover.png" />` o, en producción bajo subruta,
`<img src="/sistema/logos/astra-cover.png" />`.

## Logos esperados (guarda cada uno con el nombre exacto)

| Archivo                   | Uso recomendado                                              |
|---------------------------|--------------------------------------------------------------|
| `astra-cover.png`         | Logo cuadrado Astra Cover (Z morada sobre fondo negro)       |
| `astra-cover-light.png`   | Versión sobre fondo blanco (si tienes)                       |
| `el-perico.png`           | Logo cuadrado El Perico Pinturas (perico vertical, full)     |
| `el-perico-horizontal.png`| Versión horizontal del logo de El Perico (banda alargada)    |
| `el-perico-icono.png`     | Solo el icono circular del perico (sin texto)                |
| `el-perico-mascota.png`   | Mascota del perico sin círculo de fondo                      |

## Convenciones

- Formato preferido: **PNG con fondo transparente**, 2000x2000 max para
  los cuadrados, 2000x800 para horizontales.
- Usa siempre minúsculas en el nombre, sin espacios, separa con `-`.
- Si tienes versión SVG, súbela también con el mismo nombre y `.svg`
  (Vite la servirá igual y escala perfecta para retina/4K).

## Dónde se usan en el sistema

- **Login**: `LoginPage.jsx` carga `/logo.png` por defecto. Si quieres
  cambiarlo, mueve `el-perico.png` a `/logo.png` o ajusta el componente.
- **TopBar / Sidebar**: `el-perico-horizontal.png` queda perfecto.
- **Etiquetas de lote / impresiones QR**: `el-perico-icono.png` (más
  pequeño, monocromo si es para impresora térmica).
- **Documentos generados (notas crédito, OCs, fichas técnicas)**:
  `el-perico-horizontal.png` arriba a la izquierda, `astra-cover.png`
  para fórmulas que sean de la marca Astra.
