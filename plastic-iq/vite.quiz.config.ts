import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Quiz build: standalone entry + dist folder for quiz.plasticbegone.com
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-quiz',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        quiz: 'index.quiz.html',
      },
    },
  },
})

