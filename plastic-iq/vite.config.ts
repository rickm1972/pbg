import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { agentsApiPlugin } from './scripts/vite-agents-api.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), agentsApiPlugin()],
})
