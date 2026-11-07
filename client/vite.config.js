import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['hero.svg'],
    manifest: {
      id: '/',
      name: 'LakbAI', short_name: 'LakbAI',
      description: 'Lakbai, smarter, not harder. AI travel guide for Pangasinan.',
      theme_color: '#0B3E8F', background_color: '#FFFFFF', display: 'standalone',
      start_url: '/', scope: '/',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2,mjs}'], // includes self-hosted maplibre worker files
      runtimeCaching: [{
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//i,
        handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60*60*24*365 } }
      }]
    }
  })],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // SECURITY: envDir loads server secrets into the client build context, but only
  // variables prefixed with VITE_ are inlined into the browser bundle — everything
  // else stays server-side. Never prefix a secret with VITE_ (see client/.env.example).
  envDir: '../',
  server: { proxy: { '/api': `http://localhost:${process.env.PORT || 3001}` } },
  preview: { allowedHosts: true },
})
