import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['logo/favicon-32.png', 'logo/apple-touch-icon-180.png', 'logo/lumen-symbol.svg'],
      manifest: {
        name: 'Lumen',
        short_name: 'Lumen',
        description: 'Iluminando a gestão, impulsionando o seu talento.',
        theme_color: '#8B2655',
        background_color: '#180712',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/logo/lumen-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/logo/lumen-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/logo/lumen-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})