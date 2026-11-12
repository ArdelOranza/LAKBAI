import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The APK ships the same bundle, but a service worker inside the native shell
// only caches a second copy of assets Capacitor already ships locally.
const pwa = VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['hero.svg'],
    manifest: {
      id: '/',
      name: 'LakbAI', short_name: 'LakbAI',
      description: 'Lakbai, smarter, not harder. AI travel guide for Pangasinan.',
      lang: 'en', dir: 'ltr', categories: ['travel', 'navigation', 'lifestyle'],
      theme_color: '#0B3E8F', background_color: '#FFFFFF', display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'portrait',
      start_url: '/', scope: '/',
      // Reuse the already-open window instead of stacking a new one, and let
      // in-scope links open inside the installed app rather than the browser.
      launch_handler: { client_mode: 'navigate-existing' },
      handle_links: 'preferred',
      prefer_related_applications: false,
      // Long-press the icon / right-click for these (targets the deep-link router).
      shortcuts: [
        { name: 'Home', short_name: 'Home', url: '/?tab=home', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        { name: 'Map', short_name: 'Map', url: '/?tab=map', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        { name: 'AI Chat', short_name: 'Chat', url: '/?tab=chat', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        { name: 'Saved', short_name: 'Saved', url: '/?tab=saved', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] }
      ],
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
  });

// The shell is installed as an APK; shipping the download copy inside it would
// add ~5 MB of dead weight (Profile hides the row natively), so drop it from the
// mobile bundle before Capacitor copies dist into the Android assets.
const omitDownloadedApk = {
  name: 'lakbai-omit-downloaded-apk',
  apply: 'build',
  closeBundle() {
    if (process.env.MOBILE_BUILD !== '1') return;
    const apk = path.resolve(__dirname, 'dist/LakbAI.apk');
    if (fs.existsSync(apk)) fs.rmSync(apk);
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), omitDownloadedApk, ...(process.env.MOBILE_BUILD === '1' ? [] : [pwa])],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // SECURITY: envDir loads server secrets into the client build context, but only
  // variables prefixed with VITE_ are inlined into the browser bundle — everything
  // else stays server-side. Never prefix a secret with VITE_ (see client/.env.example).
  envDir: '../',
  server: { proxy: { '/api': `http://localhost:${process.env.PORT || 3001}` } },
  preview: { allowedHosts: true },
})
