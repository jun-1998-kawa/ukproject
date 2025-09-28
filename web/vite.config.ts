import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 5173, host: true },
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})
