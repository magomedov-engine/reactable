import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base: './' — сайт работает из любой подпапки (https://<user>.github.io/<repo>/)
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    // схемы всегда отдельными файлами, а не data:URI
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
})
