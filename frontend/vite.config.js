import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['app.floriankoehl.com'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',  // ← Ändere zu 127.0.0.1!
        changeOrigin: true,
        secure: false,
      }
    }
  },
})