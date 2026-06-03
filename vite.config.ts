/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import checker from 'vite-plugin-checker'
import { resolve } from 'path'

const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://*.tile.openstreetmap.org https://*.googleapis.com https://*.gstatic.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:"
].join('; ')

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://*.tile.openstreetmap.org https://*.googleapis.com https://*.gstatic.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:"
].join('; ')

function cspPlugin(): Plugin {
  return {
    name: 'csp-inject',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const isBuild = Boolean(ctx.bundle)
        const csp = isBuild ? PROD_CSP : DEV_CSP
        const tag = `<meta http-equiv="Content-Security-Policy" content="${csp}">`
        if (/<meta http-equiv="Content-Security-Policy"[^>]*>/.test(html)) {
          return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, tag)
        }
        return html.replace(/<head>/, `<head>\n    ${tag}`)
      }
    }
  }
}

export default defineConfig({
  base: '/marauder-ui/',
  plugins: [
    vue(),
    cspPlugin(),
    checker({ typescript: true }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'ESP32 Marauder UI',
        short_name: 'Marauder',
        description: 'Web-based UI for ESP32 Marauder WiFi/BLE security testing',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
})
