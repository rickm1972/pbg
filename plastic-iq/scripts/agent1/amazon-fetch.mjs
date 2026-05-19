import { extractAmazonAsin } from './perplexity-search.mjs'

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const DEFAULT_TIMEOUT_MS = 25_000
const DEFAULT_MAX_EXCERPT_CHARS = 12_000

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
}

function stripHtml(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const m = html.match(pattern)
    if (m?.[1]) return stripHtml(m[1])
  }
  return null
}

function extractLdProduct(html) {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1].trim())
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (item?.['@type'] === 'Product' || item?.['@type']?.includes?.('Product')) {
          return item
        }
        if (item?.['@graph']) {
          const product = item['@graph'].find(
            (n) => n?.['@type'] === 'Product' || n?.['@type']?.includes?.('Product'),
          )
          if (product) return product
        }
      }
    } catch {
      /* ignore invalid JSON-LD */
    }
  }
  return null
}

function extractAmazonProductText(html, maxChars) {
  const sections = []
  const ld = extractLdProduct(html)
  if (ld) {
    if (ld.name) sections.push(`Product name (JSON-LD): ${ld.name}`)
    if (ld.description) sections.push(`Description (JSON-LD): ${stripHtml(String(ld.description))}`)
    if (ld.brand?.name) sections.push(`Brand (JSON-LD): ${ld.brand.name}`)
    if (ld.material) sections.push(`Material (JSON-LD): ${ld.material}`)
    if (ld.category) sections.push(`Category (JSON-LD): ${ld.category}`)
  }

  const title = firstMatch(html, [
    /<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i,
    /<h1[^>]*id=["']title["'][^>]*>([\s\S]*?)<\/h1>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ])
  if (title) sections.push(`Title: ${title}`)

  const bullets = firstMatch(html, [
    /id=["']feature-bullets["'][\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
    /id=["']featurebullets_feature_div["'][\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
  ])
  if (bullets) sections.push(`Feature bullets:\n${bullets}`)

  const description = firstMatch(html, [
    /id=["']productDescription["'][\s\S]*?>([\s\S]*?)<\/div>\s*<\/div>/i,
    /id=["']productDescription_feature_div["'][\s\S]*?>([\s\S]*?)<\/motion-div>/i,
  ])
  if (description) sections.push(`Product description:\n${description}`)

  const detailBullets = firstMatch(html, [
    /id=["']detailBullets_feature_div["'][\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i,
  ])
  if (detailBullets) sections.push(`Product details:\n${detailBullets}`)

  const aplus = firstMatch(html, [
    /id=["']aplus_feature_div["'][\s\S]*?>([\s\S]{0,4000})/i,
  ])
  if (aplus) sections.push(`A+ content excerpt:\n${aplus.slice(0, 2000)}`)

  if (sections.length === 0) {
    const fallback = stripHtml(html).slice(0, maxChars)
    if (fallback.length > 200) sections.push(`Page text (fallback):\n${fallback}`)
  }

  let text = sections.join('\n\n').trim()
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}\n…[truncated]`
  }
  return text
}

function looksBlocked(html, status) {
  if (status === 503 || status === 403) return true
  const lower = html.toLowerCase()
  return (
    lower.includes('robot check') ||
    lower.includes('captcha') ||
    lower.includes('sorry, something went wrong') ||
    lower.includes('to discuss automated access to amazon data')
  )
}

/**
 * Direct HTTP fetch of catalog Amazon URL (before Perplexity). Amazon blocks crawlers in search indexes.
 */
export async function fetchAmazonProductPage(product, env = {}) {
  const url = product.amazon_url || product.affiliate_link
  const asin = extractAmazonAsin(url)
  const fetchedAt = new Date().toISOString()

  if (!url) {
    return {
      ok: false,
      url: null,
      asin,
      title: null,
      excerpt: '',
      http_status: null,
      error: 'No amazon_url on product record',
      fetched_at: fetchedAt,
    }
  }

  const timeoutMs = Number(env.AGENT1_AMAZON_FETCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const maxChars = Number(env.AGENT1_AMAZON_FETCH_MAX_EXCERPT_CHARS || DEFAULT_MAX_EXCERPT_CHARS)

  console.log(`\n[amazon-fetch] GET ${url}`)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': env.AGENT1_AMAZON_FETCH_USER_AGENT || DEFAULT_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    clearTimeout(timer)

    const html = await response.text()
    const blocked = looksBlocked(html, response.status)
    const excerpt = blocked ? '' : extractAmazonProductText(html, maxChars)
    const title =
      firstMatch(html, [/<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i]) ||
      firstMatch(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]) ||
      product.product_name

    const ok = response.ok && !blocked && excerpt.length >= 100

    console.log(
      `[amazon-fetch] status=${response.status} blocked=${blocked} excerpt_chars=${excerpt.length} ok=${ok}`,
    )

    return {
      ok,
      url: response.url || url,
      asin,
      title: title || product.product_name,
      excerpt,
      http_status: response.status,
      error: ok
        ? null
        : blocked
          ? `Amazon returned bot/captcha page (HTTP ${response.status})`
          : excerpt.length < 100
            ? `Insufficient product text extracted (HTTP ${response.status})`
            : `HTTP ${response.status}`,
      fetched_at: fetchedAt,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`[amazon-fetch] failed: ${message}`)
    return {
      ok: false,
      url,
      asin,
      title: product.product_name,
      excerpt: '',
      http_status: null,
      error: message,
      fetched_at: fetchedAt,
    }
  }
}
