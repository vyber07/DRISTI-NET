import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The browser only ever talks to the FastAPI server. Never to the graph store or object store.
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 3000, proxy: { '/api': 'http://3.7.46.50:8000' } },
})
