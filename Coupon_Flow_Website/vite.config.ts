import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Public site lives at the domain root (real paths like /stores/nike, good for SEO).
export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    const env = loadEnv(mode, '.', 'VITE_')
    for (const key of ['VITE_API_URL', 'VITE_SITE_URL']) {
      // A production build without these would call the wrong API or publish a broken sitemap.
      if (!env[key]) throw new Error(`Set ${key} before building for production (see .env.example).`)
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 5173 },
  }
})
