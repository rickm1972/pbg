import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {
  QUIZ_OG_DESCRIPTION,
  QUIZ_SHARE_TITLE,
} from './src/quiz/quizShareMeta.ts'

/** Set at build time (Netlify: DEPLOY_PRIME_URL or VITE_QUIZ_PUBLIC_URL). */
function quizPublicOrigin(): string {
  const raw =
    process.env.VITE_QUIZ_PUBLIC_URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.URL ||
    ''
  return raw.replace(/\/$/, '')
}

function escapeMetaContent(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;')
}

function quizOgMetaTags(origin: string): string {
  const ogImage = origin ? `${origin}/og-quiz-share.png` : '/og-quiz-share.png'
  const ogUrl = origin ? `${origin}/` : '/'
  const ogDescription = escapeMetaContent(QUIZ_OG_DESCRIPTION)
  const ogTitle = escapeMetaContent(QUIZ_SHARE_TITLE)
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: QUIZ_SHARE_TITLE,
    description: QUIZ_OG_DESCRIPTION,
    url: ogUrl,
  }).replace(/</g, '\\u003c')
  return `
    <meta name="description" content="${ogDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="PlasticBegone" />
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDescription}" />
    <meta property="og:url" content="${ogUrl}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:secure_url" content="${ogImage}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${ogTitle}" />
    <meta name="twitter:description" content="${ogDescription}" />
    <meta name="twitter:image" content="${ogImage}" />
    <script type="application/ld+json">${jsonLd}</script>
`
}

// Quiz build: standalone entry + dist folder for quiz.plasticbegone.com
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'quiz-og-meta',
      transformIndexHtml(html) {
        const origin = quizPublicOrigin()
        return html.replace('</head>', `${quizOgMetaTags(origin)}  </head>`)
      },
    },
    {
      name: 'quiz-netlify-index',
      closeBundle() {
        const out = join(process.cwd(), 'dist-quiz')
        copyFileSync(join(out, 'index.quiz.html'), join(out, 'index.html'))
      },
    },
  ],
  server: {
    port: 5174,
    open: '/index.quiz.html',
  },
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
