import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/* Base path configurable por env. Para producción bajo subruta:
   VITE_BASE_PATH=/sistema/ npm run build
   Para dev local sigue siendo "/" */
const BASE_PATH = process.env.VITE_BASE_PATH || '/'

/* Backend del proxy dev configurable: en máquinas donde Windows reserva el
   puerto 3000 (rango excluido del OS) el backend local corre en 3100 —
   VITE_API_TARGET=http://localhost:3100 npm run dev. Solo afecta dev. */
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3000'
const WS_TARGET = API_TARGET.replace(/^http/, 'ws')

/* Inyectar fecha-hora del build como variable global accesible desde JS.
   Permite verificar en consola del navegador qué versión se está sirviendo. */
const BUILD_TIME = new Date().toISOString();

export default defineConfig({
  base: BASE_PATH,
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  /* JSX runtime automático también para el transform de esbuild que usa Vitest.
     Sin esto, los .test.jsx se compilaban con runtime CLÁSICO (React.createElement)
     y fallaban con "React is not defined" porque no importan React. (Regresión
     tras el bump a Vite 8 / plugin-react 6.) */
  esbuild: {
    jsx: 'automatic',
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true
      },
      /* WebSocket realtime: useRealtimeSync conecta a ws://<host>/ws con
         host = location.host (5173 en dev). Sin este proxy el WS de dev
         moría y nada realtime (banners inbound, sync cruzado) era
         verificable en preview — solo en producción. */
      '/ws': {
        target: WS_TARGET,
        ws: true
      },
      '/static': {
        target: API_TARGET,
        changeOrigin: true
      },
      '/logo.png': {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
  },
})
