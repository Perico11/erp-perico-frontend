import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/* Base path configurable por env. Para producción bajo subruta:
   VITE_BASE_PATH=/sistema/ npm run build
   Para dev local sigue siendo "/" */
const BASE_PATH = process.env.VITE_BASE_PATH || '/'

/* Inyectar fecha-hora del build como variable global accesible desde JS.
   Permite verificar en consola del navegador qué versión se está sirviendo. */
const BUILD_TIME = new Date().toISOString();

export default defineConfig({
  base: BASE_PATH,
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/static': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/logo.png': {
        target: 'http://localhost:3000',
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
