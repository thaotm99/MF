import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { exnessDevProxy } from './exness-dev-proxy'

export default defineConfig({
  plugins: [vue(), exnessDevProxy()],
})
