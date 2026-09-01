import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const collectSecret = (env.COLLECT_SECRET || env.VITE_QUERY_SECRET || '').trim()

  return {
  base: command === 'build' ? '/pharmsville_dashboard/' : '/',
  plugins: [react()],
  optimizeDeps: {
    include: ['exceljs'],
  },
  server: {
    watch: {
      ignored: ['**/aws/**'],
    },
    proxy: {
      '/functions': {
        target: 'http://13.124.12.249',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const path = req.url ?? ''
            if (!collectSecret || !path.includes('/collect-')) return
            proxyReq.setHeader('x-collect-secret', collectSecret)
          })
        },
      },
      '/pluscl-api': {
        target: 'https://service.pluscl.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pluscl-api/, ''),
      },
    },
  },
}})
