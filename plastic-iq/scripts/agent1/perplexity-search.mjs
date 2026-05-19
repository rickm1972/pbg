/**
 * Perplexity Search API — Stage 1 retrieval for Agent 1.
 * @see https://docs.perplexity.ai/api-reference/search-post
 */

/** $5 / 1,000 requests (Search API — per request, no token surcharge). */
export const PERPLEXITY_SEARCH_COST_PER_REQUEST_USD = 5 / 1_000

const DEFAULT_MAX_RESULTS = 5
const DEFAULT_MAX_TOKENS_PER_PAGE = 1000

export function isFormulationProduct(product) {
  const hay = `${product.category ?? ''} ${product.subcategory ?? ''} ${product.product_name ?? ''}`.toLowerCase()
  return /formulation|dish soap|dishwashing|dish washing|laundry|detergent|cleaner|shampoo|body wash|hand soap|concentrate|refill|cleaning liquid|surface cleaner/i.test(
    hay,
  )
}

/** Extract Amazon ASIN from /dp/ASIN or /gp/product/ASIN paths. */
export function extractAmazonAsin(url) {
  if (!url) return null
  const match = String(url).match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[\/?#]|$)/i)
  return match?.[1]?.toUpperCase() ?? null
}

function buildAmazonSearchQuery(product) {
  const brand = product.brand ?? ''
  const name = product.product_name ?? ''
  const amazonUrl = product.amazon_url || product.affiliate_link
  const asin = extractAmazonAsin(amazonUrl)
  const parts = [brand, name, 'Amazon'].filter(Boolean)
  if (asin) parts.push(`ASIN ${asin}`)
  parts.push('materials specifications product details')
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/** @returns {{ goal: string, query: string, domainFilter?: string[] }[]} */
export function planPerplexitySearches(product) {
  const brand = product.brand ?? 'manufacturer'
  const name = product.product_name

  const searches = [
    {
      goal: 'amazon_retailer',
      // General web search — no domain filter; Amazon listings rank naturally.
      query: buildAmazonSearchQuery(product),
    },
    {
      goal: 'manufacturer',
      query: `${brand} ${name} official product page materials specifications certifications`,
    },
    {
      goal: 'materials_certifications',
      query: `${brand} ${name} primary material contact surface PFAS BPA certifications food contact`,
    },
  ]

  if (isFormulationProduct(product)) {
    searches.push({
      goal: 'sds_ingredients',
      query: `${brand} ${name} SDS safety data sheet ingredients SmartLabel formulation INCI`,
    })
  }

  return searches
}

async function perplexitySearchRequest({ apiKey, query, maxResults, maxTokensPerPage, domainFilter }) {
  const payload = {
    query,
    max_results: maxResults,
    max_tokens_per_page: maxTokensPerPage,
  }
  if (domainFilter?.length) {
    payload.search_domain_filter = domainFilter.slice(0, 20)
  }

  const response = await fetch('https://api.perplexity.ai/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(
      `Perplexity Search API error (${response.status}): ${body?.error?.message ?? JSON.stringify(body)}`,
    )
  }

  return body
}

function compactResult(page) {
  return {
    title: page.title ?? '',
    url: page.url ?? '',
    snippet: page.snippet ?? '',
    date: page.date ?? null,
    last_updated: page.last_updated ?? null,
  }
}

/**
 * Stage 1: run planned Perplexity Search API queries and return compact snippets.
 */
export async function runPerplexityRetrieval(product, env) {
  const apiKey = env.PERPLEXITY_API_KEY
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY is not set')

  const maxResults = Number(env.AGENT1_PERPLEXITY_MAX_RESULTS || DEFAULT_MAX_RESULTS)
  const maxTokensPerPage = Number(
    env.AGENT1_PERPLEXITY_MAX_TOKENS_PER_PAGE || DEFAULT_MAX_TOKENS_PER_PAGE,
  )

  const plan = planPerplexitySearches(product)
  const searches = []

  console.log(`\n[perplexity-search] Stage 1: ${plan.length} search request(s) for ${product.product_name}`)

  for (const item of plan) {
    console.log(`  → ${item.goal}: ${item.query.slice(0, 100)}${item.query.length > 100 ? '…' : ''}`)
    const body = await perplexitySearchRequest({
      apiKey,
      query: item.query,
      maxResults,
      maxTokensPerPage,
      domainFilter: item.domainFilter,
    })
    const results = (body.results ?? []).map(compactResult)
    searches.push({
      goal: item.goal,
      query: item.query,
      domain_filter: item.domainFilter ?? null,
      result_count: results.length,
      results,
    })
    console.log(`    ${results.length} result(s)`)
  }

  const searchRequests = searches.length
  const perplexityCost = searchRequests * PERPLEXITY_SEARCH_COST_PER_REQUEST_USD
  console.log(
    `[perplexity-search] requests=${searchRequests} est_cost=$${perplexityCost.toFixed(4)} ($${PERPLEXITY_SEARCH_COST_PER_REQUEST_USD}/req)`,
  )

  return {
    searches,
    search_requests: searchRequests,
    estimated_cost_usd: perplexityCost,
    retrieved_at: new Date().toISOString(),
  }
}
