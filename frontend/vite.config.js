import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ],
  server: {
    host: '0.0.0.0',   // This binds the server to all network interfaces
    port: 5173,         // You can specify the port, default is 5173
  },
})
