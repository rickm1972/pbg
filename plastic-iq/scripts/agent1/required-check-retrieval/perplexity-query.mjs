import { PERPLEXITY_SEARCH_COST_PER_REQUEST_USD } from '../perplexity-search.mjs'

const DEFAULT_MAX_RESULTS = 5
const DEFAULT_MAX_TOKENS_PER_PAGE = 800

/**
 * @param {{ apiKey: string, query: string, maxResults?: number, maxTokensPerPage?: number }} params
 */
export async function runPerplexityQuery(params) {
  const { apiKey, query, maxResults = DEFAULT_MAX_RESULTS, maxTokensPerPage = DEFAULT_MAX_TOKENS_PER_PAGE } =
    params
  const response = await fetch('https://api.perplexity.ai/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      max_tokens_per_page: maxTokensPerPage,
    }),
  })
  const body = await response.json()
  if (!response.ok) {
    throw new Error(
      `Perplexity Search (${response.status}): ${body?.error?.message ?? JSON.stringify(body)}`,
    )
  }
  const results = (body.results ?? []).map((p) => ({
    title: p.title ?? '',
    url: p.url ?? '',
    snippet: p.snippet ?? '',
  }))
  return {
    query,
    result_count: results.length,
    results,
    estimated_cost_usd: PERPLEXITY_SEARCH_COST_PER_REQUEST_USD,
  }
}

/**
 * @param {string} template
 * @param {{ brand?: string, product_name?: string }} product
 */
export function fillQueryTemplate(template, product) {
  return template
    .replace(/\{\{brand\}\}/g, product.brand ?? '')
    .replace(/\{\{product_name\}\}/g, product.product_name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}
