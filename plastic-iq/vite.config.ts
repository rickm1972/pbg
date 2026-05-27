/// <reference path="./vite-agents-api.d.ts" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error - Vite plugin is JS-only; typed via runtime.
import { agentsApiPlugin } from './scripts/vite-agents-api.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), agentsApiPlugin()],
})
