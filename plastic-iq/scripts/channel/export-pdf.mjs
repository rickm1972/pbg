import { loadEnv } from '../lib/env.mjs'
import { createChannelExportToken, revokeChannelExportToken } from './export-tokens.mjs'

let viteDevBaseUrl = null

export function setChannelViteDevBaseUrl(url) {
  viteDevBaseUrl = url ? String(url).replace(/\/$/, '') : null
}

/**
 * @param {import('http').IncomingMessage} [req]
 */
export function resolveChannelExportBaseUrl(req) {
  const env = loadEnv()
  if (env.CHANNEL_EXPORT_BASE_URL) {
    return String(env.CHANNEL_EXPORT_BASE_URL).replace(/\/$/, '')
  }
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
 * @param {{ channelMapId: string, req?: import('http').IncomingMessage }} input
 */
export async function captureChannelMapPdf({ channelMapId, req }) {
  const baseUrl = resolveChannelExportBaseUrl(req)
  const token = createChannelExportToken(channelMapId)
  const url = `${baseUrl}/admin/channel-map/${channelMapId}/export?token=${encodeURIComponent(token)}`

  let browser
  try {
    const { chromium } = await import('playwright')
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    })

    await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.waitForSelector('[data-channel-map-pdf-ready="true"]', {
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
        `PDF export could not reach the app at ${baseUrl}. Keep "npm run dev" running in plastic-iq (same host/port as this admin tab), or set CHANNEL_EXPORT_BASE_URL in .env.`,
      )
    }
    throw err
  } finally {
    revokeChannelExportToken(token)
    if (browser) await browser.close().catch(() => {})
  }
}
