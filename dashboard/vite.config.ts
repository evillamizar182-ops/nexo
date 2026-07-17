import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = {
  '/api': {
    target: 'http://localhost:3100',
    changeOrigin: true,
  }
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },   // desarrollo (npm run dev)
  preview: { port: 5173, proxy },  // build servida (npm run preview)
})
