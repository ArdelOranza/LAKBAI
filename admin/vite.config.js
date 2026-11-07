import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Separate admin app: run `npm --prefix admin run dev` → http://127.0.0.1:5174
// Proxies /api to the Lakbai server so the admin token never ships in the bundle.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: { '/api': `http://localhost:${process.env.PORT || 3001}` },
  },
  preview: { allowedHosts: true },
})
