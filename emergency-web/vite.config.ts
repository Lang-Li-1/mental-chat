import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/emergency/',
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
  },
})
