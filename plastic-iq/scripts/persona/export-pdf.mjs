import { loadEnv } from '../lib/env.mjs'
import { createExportToken, revokeExportToken } from './export-tokens.mjs'

/** Set by Vite configureServer when the dev server starts listening. */
let viteDevBaseUrl = null

export function setViteDevBaseUrl(url) {
  viteDevBaseUrl = url ? String(url).replace(/\/$/, '') : null
}

/**
 * Prefer the URL the admin UI actually used, then env override, then Vite's resolved URL.
 * @param {import('http').IncomingMessage} [req]
 */
export function resolveExportBaseUrl(req) {
  const env = loadEnv()
  if (env.PERSONA_EXPORT_BASE_URL) {
    return String(env.PERSONA_EXPORT_BASE_URL).replace(/\/$/, '')
  }

  const host = req?.headers?.host
  if (host) {
    const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
    return `${proto}://${host}`.replace(/\/$/, '')
  }

  if (viteDevBaseUrl) return viteDevBaseUrl

  if (env.VITE_DEV_SERVER_URL) {
    return String(env.VITE_DEV_SERVER_URL).replace(/\/$/, '')
  }

  return 'http://localhost:5173'
}

/**
 * Render the live persona export route in headless Chromium and return PDF bytes.
 * @param {{ personaId: string, req?: import('http').IncomingMessage }} input
 */
export async function capturePersonaPdf({ personaId, req }) {
  const baseUrl = resolveExportBaseUrl(req)
  const token = createExportToken(personaId)
  const url = `${baseUrl}/admin/persona/${personaId}/export?token=${encodeURIComponent(token)}`

  let browser
  try {
    const { chromium } = await import('playwright')
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    })

    await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.waitForSelector('[data-persona-pdf-ready="true"]', {
      state: 'attached',
      timeout: 60_000,
    })
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    await page.waitForTimeout(400)

    await page.emulateMedia({ media: 'screen' })

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
    })

    return pdf
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/Cannot find module 'playwright'|playwright.*not found/i.test(message)) {
      throw new Error(
        'Playwright is not installed. Run: npm install && npx playwright install chromium',
      )
    }
    if (/Executable doesn't exist|browserType.launch/i.test(message)) {
      throw new Error(
        'Chromium for Playwright is missing. Run: npx playwright install chromium',
      )
    }
    if (/ERR_CONNECTION_REFUSED|ECONNREFUSED/i.test(message)) {
      throw new Error(
        `PDF export could not reach the app at ${baseUrl}. Keep "npm run dev" running in plastic-iq (same host/port as this admin tab), or set PERSONA_EXPORT_BASE_URL in .env.`,
      )
    }
    throw err
  } finally {
    revokeExportToken(token)
    if (browser) await browser.close().catch(() => {})
  }
}
