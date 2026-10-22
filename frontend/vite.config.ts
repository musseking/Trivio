import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const apiTarget = process.env.TRIVIO_API_PROXY_TARGET?.trim()

  if (command === 'serve' && !apiTarget) {
    throw new Error(
      'TRIVIO_API_PROXY_TARGET is required to start the frontend.'
    )
  }

  const proxy = apiTarget
    ? {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      }
    : undefined

  return {
    plugins: [react()],
    envDir: false,
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy,
    },
    preview: {
      host: 'localhost',
      port: 4173,
      strictPort: true,
      proxy,
    },
  }
})