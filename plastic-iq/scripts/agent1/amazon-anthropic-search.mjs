import {
  AMAZON_WEB_SEARCH_SYSTEM_PROMPT,
  buildAmazonWebSearchUserPrompt,
} from './prompt.mjs'
import { extractAmazonAsin } from './perplexity-search.mjs'
import {
  beginAnthropicApiCallLog,
  estimateAnthropicCostUsd,
  finishAnthropicApiCallLog,
  recordAnthropicApiCall,
} from './anthropic-usage.mjs'

const DEFAULT_AMAZON_MAX_TOKENS = 4096
const DEFAULT_AMAZON_WEB_SEARCH_USES = 1

function collectAnthropicText(body) {
  const parts = []
  for (const block of body.content ?? []) {
    if (block.type === 'text' && block.text) parts.push(block.text)
  }
  return parts.join('\n')
}

/**
 * One Anthropic API call with web_search (max_uses=1) to retrieve the Amazon listing by ASIN/URL.
 */
export async function retrieveAmazonViaAnthropicWebSearch(product, env) {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const url = product.amazon_url || product.affiliate_link
  const asin = extractAmazonAsin(url)
  const fetchedAt = new Date().toISOString()

  if (!url) {
    return {
      ok: false,
      url: null,
      asin,
      excerpt: '',
      web_search_requests: 0,
      error: 'No amazon_url on product record',
      fetched_at: fetchedAt,
      usage: null,
    }
  }

  const model = env.AGENT1_ANTHROPIC_MODEL || 'claude-sonnet-4-6'
  const webSearchType = env.AGENT1_WEB_SEARCH_TYPE || 'web_search_20250305'
  const maxUses = Number(env.AGENT1_AMAZON_WEB_SEARCH_MAX_USES || DEFAULT_AMAZON_WEB_SEARCH_USES)
  const maxTokens = Number(env.AGENT1_AMAZON_MAX_TOKENS || DEFAULT_AMAZON_MAX_TOKENS)

  console.log(`\n[amazon-anthropic] Stage 1a: Anthropic web_search (max_uses=${maxUses}) for ASIN ${asin ?? 'n/a'}`)
  console.log(`  URL: ${url}`)

  beginAnthropicApiCallLog({
    label: 'agent1AmazonWebSearch',
    productId: product.product_id,
  })

  const payload = {
    model,
    max_tokens: maxTokens,
    system: AMAZON_WEB_SEARCH_SYSTEM_PROMPT,
    tools: [{ type: webSearchType, name: 'web_search', max_uses: maxUses }],
    messages: [{ role: 'user', content: buildAmazonWebSearchUserPrompt(product) }],
  }

  let body
  let response
  for (let attempt = 0; attempt < 5; attempt++) {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    body = await response.json()
    recordAnthropicApiCall({
      attempt: attempt + 1,
      status: response.status,
      ok: response.ok,
      model: body?.model ?? model,
      stopReason: body?.stop_reason ?? null,
      error: response.ok ? null : (body?.error?.message ?? null),
    })
    if (response.ok) break
    if (response.status === 429 && attempt < 4) {
      const waitMs = 30_000 * (attempt + 1)
      console.log(`  Rate limited — retrying in ${waitMs / 1000}s…`)
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }
    throw new Error(
      `Anthropic Amazon web_search error (${response.status}): ${body.error?.message ?? JSON.stringify(body)}`,
    )
  }

  const text = collectAnthropicText(body)
  const callMeta = finishAnthropicApiCallLog()
  const webSearch = body?.usage?.server_tool_use?.web_search_requests ?? 0
  const usage = body?.usage
    ? {
        input_tokens: body.usage.input_tokens ?? 0,
        output_tokens: body.usage.output_tokens ?? 0,
        web_search_requests: webSearch,
        estimated_cost_usd: estimateAnthropicCostUsd(body.usage, webSearch),
        cache_read_input_tokens: body.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: body.usage.cache_creation_input_tokens ?? 0,
        anthropic_api_calls: callMeta?.anthropic_api_calls ?? 1,
        anthropic_api_call_log: callMeta?.anthropic_api_call_log ?? [],
      }
    : null

  const ok = Boolean(text?.trim())

  console.log(
    `[amazon-anthropic] web_searches=${webSearch} excerpt_chars=${text.length} est_cost=$${(usage?.estimated_cost_usd ?? 0).toFixed(4)}`,
  )

  return {
    ok,
    url,
    asin,
    excerpt: text,
    web_search_requests: webSearch,
    error: ok ? null : 'Anthropic returned no text for Amazon retrieval',
    fetched_at: fetchedAt,
    usage,
  }
}
