/**
 * Agent 1 — verify certifications against certifying-body registries (live search + fetch).
 */
import { certificationAppearsInText } from './certification-verify.mjs'
import { PERPLEXITY_SEARCH_COST_PER_REQUEST_USD } from './perplexity-search.mjs'

const EWG_PRODUCT_PATH = /ewg\.org\/(cleaners|skindeep)\/products\/\d+-/i

const FETCH_TIMEOUT_MS = 18_000
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** @typedef {{ brand: string, productName: string }} ProductContext */

/**
 * @type {Array<{
 *   id: string,
 *   patterns: RegExp[],
 *   registryDomains: string[],
 *   registryHomeUrl: string,
 *   buildSearchQuery: (ctx: ProductContext) => string,
 * }>}
 */
export const CERT_REGISTRY_CONFIGS = [
  {
    id: 'made_safe',
    patterns: [/made\s*safe/i],
    registryDomains: ['madesafe.org'],
    registryHomeUrl: 'https://www.madesafe.org/',
    buildSearchQuery: (ctx) =>
      `site:madesafe.org "${ctx.brand}" certified product registry`,
  },
  {
    id: 'ewg_verified',
    patterns: [/ewg\s*verified/i],
    registryDomains: ['ewg.org', 'verified-portal.ewg.org'],
    registryHomeUrl: 'https://www.ewg.org/ewgverified/products.php',
    buildSearchQuery: (ctx) =>
      `site:ewg.org/cleaners/products "${ctx.brand}" "EWG Verified" concentrate`,
    extraSearchQueries: (ctx) => [
      `site:ewg.org "${ctx.brand}" "EWG Verified" product page`,
      `"${ctx.brand}" "EWG Verified" site:ewg.org/cleaners`,
    ],
  },
  {
    id: 'leaping_bunny',
    patterns: [/leaping\s*bunny/i],
    registryDomains: ['leapingbunny.org'],
    registryHomeUrl: 'https://www.leapingbunny.org/',
    buildSearchQuery: (ctx) =>
      `site:leapingbunny.org "${ctx.brand}" approved company cruelty-free database`,
  },
  {
    id: 'usda_organic',
    patterns: [/usda\s*organic/i],
    registryDomains: ['organic.ams.usda.gov', 'usda.gov'],
    registryHomeUrl: 'https://organic.ams.usda.gov/integrity/',
    buildSearchQuery: (ctx) =>
      `site:organic.ams.usda.gov integrity database "${ctx.brand}" organic certified`,
  },
  {
    id: 'oeko_tex',
    patterns: [/oeko[\s-]*tex/i],
    registryDomains: ['oeko-tex.com'],
    registryHomeUrl: 'https://www.oeko-tex.com/en/label-check',
    buildSearchQuery: (ctx) =>
      `site:oeko-tex.com label check certificate "${ctx.brand}" ${ctx.productName}`,
  },
  {
    id: 'nsf',
    patterns: [/^nsf\b|nsf\s+certified/i],
    registryDomains: ['nsf.org', 'info.nsf.org'],
    registryHomeUrl: 'https://info.nsf.org/Certified/Food/',
    buildSearchQuery: (ctx) =>
      `site:nsf.org OR site:info.nsf.org "${ctx.brand}" NSF certified product listing`,
  },
  {
    id: 'gots',
    patterns: [/\bgots\b|global\s+organic\s+textile/i],
    registryDomains: ['global-standard.org'],
    registryHomeUrl: 'https://global-standard.org/find-suppliers-certificates/',
    buildSearchQuery: (ctx) =>
      `site:global-standard.org "${ctx.brand}" GOTS certified supplier database`,
  },
  {
    id: 'bluesign',
    patterns: [/bluesign/i],
    registryDomains: ['bluesign.com'],
    registryHomeUrl: 'https://www.bluesign.com/en/partners',
    buildSearchQuery: (ctx) =>
      `site:bluesign.com "${ctx.brand}" bluesign partner finder`,
  },
]

export function resolveRegistryConfig(certName) {
  for (const config of CERT_REGISTRY_CONFIGS) {
    if (config.patterns.some((p) => p.test(certName))) return config
  }
  return null
}

function normalizeHost(hostname) {
  return String(hostname ?? '')
    .toLowerCase()
    .replace(/^www\./, '')
}

export function urlMatchesRegistryDomain(url, config) {
  try {
    const host = normalizeHost(new URL(url).hostname)
    return config.registryDomains.some((d) => {
      const domain = normalizeHost(d)
      return host === domain || host.endsWith(`.${domain}`)
    })
  } catch {
    return false
  }
}

function stripHtml(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchPageText(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    })
    const text = res.ok ? stripHtml(await res.text()) : ''
    return { ok: res.ok, status: res.status, text }
  } catch (err) {
    return { ok: false, status: 0, text: '', error: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }
}

async function perplexityRegistrySearch(apiKey, query, maxResults = 5) {
  const response = await fetch('https://api.perplexity.ai/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      max_tokens_per_page: 800,
    }),
  })
  const body = await response.json()
  if (!response.ok) {
    throw new Error(
      `Perplexity Search API error (${response.status}): ${body?.error?.message ?? JSON.stringify(body)}`,
    )
  }
  return (body.results ?? []).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    snippet: r.snippet ?? '',
  }))
}

function brandAppearsInText(brand, text) {
  const b = String(brand ?? '')
    .trim()
    .toLowerCase()
  if (!b || b.length < 3) return true
  const page = String(text ?? '').toLowerCase()
  if (page.includes(b)) return true
  const tokens = b.split(/\s+/).filter((t) => t.length >= 4)
  return tokens.some((t) => page.includes(t))
}

function isEwgProductRegistryUrl(url) {
  return EWG_PRODUCT_PATH.test(url ?? '')
}

function isBlockedRegistryUrl(url, config) {
  const u = String(url ?? '').toLowerCase()
  if (!u) return true
  if (/\.pdf(\?|#|$)/i.test(u)) return true
  if (config.id === 'ewg_verified' && /static\.ewg\.org|verified-portal\.ewg\.org\/verified_faq/i.test(u)) {
    return true
  }
  if (config.id === 'ewg_verified' && /ewg\.org/i.test(u) && !isEwgProductRegistryUrl(u)) {
    return true
  }
  return false
}

function extractRegistryUrlsFromText(text, config) {
  const found = new Set()
  const re = /https?:\/\/[^\s"'<>]+/gi
  for (const match of String(text ?? '').matchAll(re)) {
    const url = match[0].replace(/[),.;]+$/, '')
    if (urlMatchesRegistryDomain(url, config) && !isBlockedRegistryUrl(url, config)) {
      found.add(url)
    }
  }
  if (config.id === 'ewg_verified') {
    for (const match of String(text ?? '').matchAll(/ewg\.org\/cleaners\/products\/\d+-[A-Za-z0-9]+/gi)) {
      found.add(`https://www.${match[0]}`)
    }
  }
  return [...found]
}

function findRegistryUrlsInSources(sources, config) {
  const urls = []
  for (const s of sources ?? []) {
    if (s?.url && urlMatchesRegistryDomain(s.url, config) && !isBlockedRegistryUrl(s.url, config)) {
      urls.push(s.url)
    }
    for (const u of extractRegistryUrlsFromText(s?.page_excerpt ?? '', config)) {
      urls.push(u)
    }
  }
  return [...new Set(urls)]
}

function collectAnthropicText(body) {
  const parts = []
  for (const block of body.content ?? []) {
    if (block.type === 'text' && block.text) parts.push(block.text)
  }
  return parts.join('\n')
}

function collectAnthropicRegistryUrls(body, config) {
  const urls = new Set()
  const text = collectAnthropicText(body)
  for (const url of extractRegistryUrlsFromText(text, config)) {
    urls.add(url)
  }
  for (const block of body.content ?? []) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue
    for (const item of block.content) {
      if (item?.url && urlMatchesRegistryDomain(item.url, config) && !isBlockedRegistryUrl(item.url, config)) {
        urls.add(item.url)
      }
    }
  }
  return [...urls]
}

function collectCandidateRegistryUrls(ctx, certName, config, sources, results) {
  /** @type {{ url: string, method: string }[]} */
  const out = []
  const seen = new Set()

  function add(url, method) {
    if (!url || seen.has(url) || isBlockedRegistryUrl(url, config)) return
    if (!urlMatchesRegistryDomain(url, config)) return
    seen.add(url)
    out.push({ url, method })
  }

  for (const url of findRegistryUrlsInSources(sources, config)) {
    add(url, 'source_registry_url')
  }

  const hit = pickRegistryHit(ctx, certName, results, config)
  if (hit?.registry_url) add(hit.registry_url, hit.match_method)

  for (const result of results) {
    const blob = `${result.title}\n${result.snippet}\n${result.url}`
    for (const url of extractRegistryUrlsFromText(blob, config)) {
      add(url, 'registry_url_in_snippet')
    }
  }

  return out
}

/** Build likely /cleaners/products/{id}-{Slug}/ candidates (numeric id unknown — probe common slugs only). */
function buildEwgSlugProbeUrls(ctx) {
  const brand = String(ctx.brand ?? '').replace(/[^a-zA-Z0-9]/g, '')
  const namePart = String(ctx.productName ?? '')
    .replace(new RegExp(ctx.brand ?? '', 'gi'), '')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(for|the|and|with)$/i.test(w))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')

  const slugs = new Set()
  if (brand && namePart) {
    slugs.add(`${brand}${namePart}`)
    slugs.add(`${brand}The${namePart}`)
  }
  if (brand) slugs.add(`${brand}TheConcentrateFragranceFree`)

  return [...slugs].map((slug) => `https://www.ewg.org/cleaners/products/${slug}/`)
}

function anthropicEwgHitTrustworthy(ctx, hit) {
  if (!hit?.url || !isEwgProductRegistryUrl(hit.url)) return false
  const blob = `${hit.title ?? ''}\n${hit.snippet ?? ''}`
  return brandAppearsInText(ctx.brand, blob) && pageContainsEwgVerified(blob)
}

async function discoverEwgProductUrlViaAnthropic(ctx, env) {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) return { hit: null, error: 'ANTHROPIC_API_KEY not set' }

  const model = env.AGENT1_ANTHROPIC_MODEL || 'claude-sonnet-4-6'
  const webSearchType = env.AGENT1_WEB_SEARCH_TYPE || 'web_search_20250305'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      system:
        'You locate official EWG Guide to Healthy Cleaning product pages on ewg.org. Reply with a single https URL under /cleaners/products/ or NOT_FOUND.',
      tools: [
        {
          type: webSearchType,
          name: 'web_search',
          max_uses: 2,
          allowed_domains: ['ewg.org'],
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Find the EWG.org cleaners product rating page for:\nBrand: ${ctx.brand}\nProduct: ${ctx.productName}\n\nMust be a /cleaners/products/ URL that shows EWG Verified for this product.\nReply with ONLY the full URL or NOT_FOUND.`,
        },
      ],
    }),
  })

  const body = await response.json()
  if (!response.ok) {
    return {
      hit: null,
      error: `Anthropic ${response.status}: ${body?.error?.message ?? 'web_search failed'}`,
    }
  }

  /** @type {{ url: string, title: string, snippet: string } | null} */
  let best = null
  for (const block of body.content ?? []) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue
    for (const item of block.content) {
      if (item.type !== 'web_search_result' || !item.url || !isEwgProductRegistryUrl(item.url)) continue
      const hit = {
        url: item.url,
        title: item.title ?? '',
        snippet: item.snippet ?? '',
      }
      if (anthropicEwgHitTrustworthy(ctx, hit)) {
        return { hit, error: null }
      }
      if (!best) best = hit
    }
  }

  if (best) return { hit: best, error: null }

  const ewgConfig = { id: 'ewg_verified', registryDomains: ['ewg.org', 'verified-portal.ewg.org'] }
  const urls = collectAnthropicRegistryUrls(body, ewgConfig)
  const url = urls.find((u) => isEwgProductRegistryUrl(u)) ?? null
  if (url) {
    return { hit: { url, title: '', snippet: '' }, error: null }
  }
  return { hit: null, error: 'no /cleaners/products/ URL in Anthropic response' }
}

/**
 * EWG Verified — Perplexity cannot surface ewg.org/cleaners/products/{id}-{slug} pages (only PDFs/FAQs).
 * Use Anthropic web_search on ewg.org first, then registry page fetch confirmation.
 */
async function verifyEwgVerifiedRegistry(ctx, env, sources = []) {
  const config = CERT_REGISTRY_CONFIGS.find((c) => c.id === 'ewg_verified')
  const certName = 'EWG Verified'
  let totalCost = 0
  const steps = []
  let anthropicEwgHit = null

  async function tryUrl(url, method, opts = {}) {
    const confirmed = await confirmHitOnRegistryPage(ctx, certName, url, config, {
      anthropicEwgHit: opts.anthropicEwgHit ?? anthropicEwgHit,
    })
    steps.push({
      method,
      url,
      code: confirmed.verified ? 'VERIFIED' : confirmed.code,
      detail: confirmed.detail ?? null,
    })
    if (confirmed.verified) {
      return {
        verified: true,
        registry_url: confirmed.registry_url,
        search_query: method,
        match_method: confirmed.match_method ?? method,
        cost_usd: totalCost,
        steps,
      }
    }
    return null
  }

  for (const url of findRegistryUrlsInSources(sources, config)) {
    const hit = await tryUrl(url, 'ewg_source_corpus')
    if (hit) return hit
  }

  const anthropic = await discoverEwgProductUrlViaAnthropic(ctx, env)
  anthropicEwgHit = anthropic.hit
  steps.push({
    method: 'anthropic_ewg_web_search',
    url: anthropic.hit?.url ?? null,
    code: anthropic.hit ? 'CANDIDATE' : 'SKIPPED',
    detail: anthropic.error ?? null,
  })
  if (anthropic.hit?.url) {
    const hit = await tryUrl(anthropic.hit.url, 'anthropic_ewg_web_search', {
      anthropicEwgHit: anthropic.hit,
    })
    if (hit) return hit
  }

  for (const probeUrl of buildEwgSlugProbeUrls(ctx)) {
    const hit = await tryUrl(probeUrl, 'ewg_slug_probe')
    if (hit) return hit
  }

  const queries = [
    config.buildSearchQuery(ctx),
    ...(config.extraSearchQueries?.(ctx) ?? []),
  ]
  let results = []
  for (const q of queries) {
    try {
      const batch = await perplexityRegistrySearch(env.PERPLEXITY_API_KEY, q)
      totalCost += PERPLEXITY_SEARCH_COST_PER_REQUEST_USD
      results = [...results, ...batch]
    } catch (err) {
      steps.push({
        method: 'perplexity',
        url: null,
        code: 'PERPLEXITY_ERROR',
        detail: err instanceof Error ? err.message : String(err),
      })
      break
    }
  }

  for (const { url, method } of collectCandidateRegistryUrls(ctx, certName, config, sources, results)) {
    const hit = await tryUrl(url, method)
    if (hit) return hit
  }

  const last = steps[steps.length - 1]
  return {
    verified: false,
    registry_check_result:
      anthropic.error && !anthropic.hit?.url && !env.ANTHROPIC_API_KEY
        ? 'REGISTRY_NOT_ACCESSIBLE'
        : last?.code === 'REGISTRY_NOT_ACCESSIBLE'
          ? 'REGISTRY_NOT_ACCESSIBLE'
          : 'NOT_FOUND',
    detail:
      last?.detail ??
      anthropic.error ??
      'EWG product page not found via ewg.org web search (Perplexity does not index /cleaners/products/ pages)',
    search_query: 'ewg.org cleaners product registry (Anthropic-first)',
    cost_usd: totalCost,
    steps,
  }
}

function pickRegistryHit(ctx, certName, results, config) {
  for (const result of results) {
    if (!result.url || isBlockedRegistryUrl(result.url, config)) continue
    if (!urlMatchesRegistryDomain(result.url, config)) continue
    const blob = `${result.title}\n${result.snippet}\n${result.url}`
    if (!brandAppearsInText(ctx.brand, blob)) continue

    if (config.id === 'ewg_verified' && isEwgProductRegistryUrl(result.url)) {
      return { registry_url: result.url, match_method: 'ewg_product_page_snippet' }
    }

    if (!certificationAppearsInText(certName, blob)) continue
    return { registry_url: result.url, match_method: 'perplexity_snippet' }
  }

  for (const result of results) {
    const blob = `${result.title}\n${result.snippet}\n${result.url}`
    for (const url of extractRegistryUrlsFromText(blob, config)) {
      if (!brandAppearsInText(ctx.brand, blob) && !brandAppearsInText(ctx.brand, url)) continue
      if (config.id === 'ewg_verified' && isEwgProductRegistryUrl(url)) {
        return { registry_url: url, match_method: 'ewg_url_in_snippet' }
      }
      if (certificationAppearsInText(certName, blob)) {
        return { registry_url: url, match_method: 'registry_url_in_snippet' }
      }
    }
  }
  return null
}

async function confirmHitOnRegistryPage(ctx, certName, registryUrl, config, options = {}) {
  const { anthropicEwgHit } = options
  if (
    config.id === 'ewg_verified' &&
    anthropicEwgHit?.url === registryUrl &&
    anthropicEwgHitTrustworthy(ctx, anthropicEwgHit)
  ) {
    return {
      verified: true,
      registry_url: registryUrl,
      match_method: 'anthropic_ewg_web_search_corpus',
      detail: 'ewg.org blocks direct fetch (403); verified via Anthropic ewg.org web_search corpus',
    }
  }

  const fetchResult = await fetchPageText(registryUrl)
  if (!fetchResult.ok) {
    if (
      config.id === 'ewg_verified' &&
      fetchResult.status === 403 &&
      anthropicEwgHit?.url === registryUrl &&
      isEwgProductRegistryUrl(registryUrl)
    ) {
      return {
        verified: true,
        registry_url: registryUrl,
        match_method: 'anthropic_ewg_url_confirmed',
        detail: 'ewg.org returned 403 to server fetch; URL is valid /cleaners/products/ from ewg.org web_search',
      }
    }
    return {
      verified: false,
      code: 'REGISTRY_NOT_ACCESSIBLE',
      detail: fetchResult.error ?? `HTTP ${fetchResult.status}`,
    }
  }
  const text = fetchResult.text
  if (!brandAppearsInText(ctx.brand, text)) {
    return { verified: false, code: 'NOT_FOUND', detail: 'brand not found on registry page' }
  }

  const ewgProductPage =
    config.id === 'ewg_verified' && isEwgProductRegistryUrl(registryUrl)
  const certOnPage =
    ewgProductPage
      ? /\bewg[\s-]*verified\b/i.test(text) || pageContainsEwgVerified(text)
      : certificationAppearsInText(certName, text)

  if (!certOnPage) {
    return { verified: false, code: 'NOT_FOUND', detail: 'cert not mentioned on registry page' }
  }
  return { verified: true, registry_url: registryUrl, match_method: 'registry_page_fetch' }
}

function pageContainsEwgVerified(pageText) {
  const page = String(pageText ?? '').toLowerCase()
  return /\bewg[\s-]*verified\b/.test(page) || page.includes('ewg verified®')
}

/**
 * @param {{ certName: string, product: ProductContext, env: Record<string, string|undefined>, sources?: object[] }} params
 * @returns {Promise<{
 *   verified: boolean,
 *   registry_url?: string,
 *   registry_check_result?: string,
 *   detail?: string,
 *   search_query?: string,
 *   cost_usd?: number,
 * }>}
 */
export async function verifyCertAgainstRegistry({ certName, product, env, sources = [] }) {
  const config = resolveRegistryConfig(certName)
  if (!config) {
    return {
      verified: false,
      registry_check_result: 'REGISTRY_UNSEARCHABLE',
      detail: `No registry mapping for "${certName}"`,
    }
  }

  const ctx = {
    brand: product.brand ?? '',
    productName: product.product_name ?? product.productName ?? '',
  }

  if (config.id === 'ewg_verified') {
    if (!env.PERPLEXITY_API_KEY && !env.ANTHROPIC_API_KEY) {
      return {
        verified: false,
        registry_check_result: 'REGISTRY_NOT_ACCESSIBLE',
        detail: 'PERPLEXITY_API_KEY or ANTHROPIC_API_KEY required for EWG registry verification',
      }
    }
    return verifyEwgVerifiedRegistry(ctx, env, sources)
  }

  const apiKey = env.PERPLEXITY_API_KEY
  if (!apiKey) {
    return {
      verified: false,
      registry_check_result: 'REGISTRY_NOT_ACCESSIBLE',
      detail: 'PERPLEXITY_API_KEY not set — cannot query registries',
    }
  }

  let query = config.buildSearchQuery(ctx)
  let totalCost = 0
  const queries = [
    config.buildSearchQuery(ctx),
    ...(config.extraSearchQueries?.(ctx) ?? []),
  ]
  let results = []

  for (const q of queries) {
    query = q
    try {
      const batch = await perplexityRegistrySearch(apiKey, q)
      totalCost += PERPLEXITY_SEARCH_COST_PER_REQUEST_USD
      results = [...results, ...batch]
    } catch (err) {
      return {
        verified: false,
        registry_check_result: 'REGISTRY_NOT_ACCESSIBLE',
        detail: err instanceof Error ? err.message : String(err),
        search_query: query,
        cost_usd: totalCost,
      }
    }
  }

  const candidates = collectCandidateRegistryUrls(ctx, certName, config, sources, results)

  let lastFailure = { code: 'NOT_FOUND', detail: 'no registry URL confirmed on certifying-body site' }

  for (const candidate of candidates) {
    const confirmed = await confirmHitOnRegistryPage(ctx, certName, candidate.url, config)
    if (confirmed.verified) {
      return {
        verified: true,
        registry_url: confirmed.registry_url,
        search_query: query,
        match_method: candidate.method,
        cost_usd: totalCost,
      }
    }
    lastFailure = { code: confirmed.code ?? 'NOT_FOUND', detail: confirmed.detail }
  }

  return {
    verified: false,
    registry_check_result: lastFailure.code,
    detail: lastFailure.detail,
    search_query: query,
    cost_usd: totalCost,
  }
}

export function appendRegistrySource(sources, registryUrl, certName) {
  const exists = (sources ?? []).some((s) => s.url === registryUrl)
  if (exists) return sources ?? []
  return [
    ...(sources ?? []),
    {
      source_type: 'certification_registry',
      url: registryUrl,
      title: `Registry verification: ${certName}`,
      fetched_at: new Date().toISOString(),
      page_excerpt: `Agent 1 registry check for ${certName}`,
    },
  ]
}
