import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const normalized = id.replace(/\\/g, '/')
            if (
              normalized.includes('/react/') ||
              normalized.includes('/react-dom/') ||
              normalized.includes('/react-router/') ||
              normalized.includes('/react-router-dom/')
            ) {
              return 'vendor-react'
            }
            if (
              normalized.includes('/firebase/') ||
              normalized.includes('/@firebase/')
            ) {
              return 'vendor-firebase'
            }
            if (
              normalized.includes('/@radix-ui/') ||
              normalized.includes('/lucide-react/') ||
              normalized.includes('/vaul/') ||
              normalized.includes('/recharts/')
            ) {
              return 'vendor-ui'
            }
          }
        },
      },
    },
  },
})
