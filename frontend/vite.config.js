import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendConfigDir = path.resolve(__dirname, '../backend/config')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@backend-config': backendConfigDir,
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    fs: {
      // Allow importing the shared classification JSON from backend/config
      allow: [path.resolve(__dirname, '..')],
    },
  },
})
