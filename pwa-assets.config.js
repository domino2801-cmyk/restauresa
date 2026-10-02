import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Génère les icônes PWA à partir de l'emblème fourni :
//   npm run generate-pwa-assets
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/logo.png'],
})
