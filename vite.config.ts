import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Don't watch the Electron build output: hundreds of files land there at
    // once and the watcher holds handles that block electron-builder renames.
    watch: {
      ignored: ['**/release/**'],
    },
    proxy: {
      '/card-images': 'http://localhost:3001',
      '/api': 'http://localhost:3001',
    },
  },
})
