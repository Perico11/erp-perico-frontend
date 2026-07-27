import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

/* ── Nota de mantenimiento (26-jul-2026) ────────────────────────────────────
   El lint tenía 325 problemas, y de esos ~77 eran huecos de ESTA configuración,
   no defectos del código: `global` sin declarar en los tests, `__BUILD_TIME__`
   (que inyecta Vite) y los `catch {}` vacíos que el proyecto usa a propósito.

   Eso importa: un lint que grita por cosas que no son errores entrena a
   ignorarlo, y ahí es donde se esconden los que sí lo son. Hoy había cuatro
   violaciones de las reglas de los hooks y dos claves duplicadas enterradas
   entre ese ruido.
   ─────────────────────────────────────────────────────────────────────────── */
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        /* Lo define Vite en tiempo de build (ver vite.config.js). */
        __BUILD_TIME__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      /* `catch {}` vacío es una decisión del proyecto, no un descuido: hay
         decenas de operaciones de mejor esfuerzo (localStorage, notificaciones,
         cerrar un socket ya cerrado) donde fallar no debe interrumpir nada.
         Los demás bloques vacíos SÍ se siguen señalando. */
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    /* Los tests corren en Node con los globales de Vitest. */
    files: ['src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
  },
])
