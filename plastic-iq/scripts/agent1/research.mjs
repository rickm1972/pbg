import { loadEnv } from '../lib/env.mjs'
import {
  AGENT_VERSION,
  AgentMetadataSchema,
  CONFIDENCE_LABELS,
  EvidencePacketSchema,
} from './types.mjs'
import {
  SYSTEM_PROMPT,
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisUserPrompt,
  buildUserPrompt,
} from './prompt.mjs'
import {
  beginAnthropicApiCallLog,
  estimateAnthropicCostUsd,
  finishAnthropicApiCallLog,
  recordAnthropicApiCall,
} from './anthropic-usage.mjs'
import { fetchAmazonProductPage } from './amazon-fetch.mjs'
import { runPerplexityRetrieval } from './perplexity-search.mjs'

const DEFAULT_MAX_WEB_SEARCH_USES = 12
const DEFAULT_MAX_TOKENS = 12000

function normalizeConfidence(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (CONFIDENCE_LABELS.includes(s)) return s
  if (s.includes('certif')) return 'certification verified'
  if (s.includes('manufacturer') || s.includes('brand confirmed')) return 'manufacturer confirmed'
  if (s.includes('retailer') || s.includes('amazon')) return 'retailer confirmed'
  if (s.includes('proprietary') || s.includes('undisclosed')) return 'proprietary or undisclosed'
  if (s.includes('not verified') || s.includes('unverified') || s.includes('claim'))
    return 'claim not independently verified'
  if (s.includes('category')) return 'inferred from category pattern'
  if (s.includes('inferred') || s.includes('description')) return 'inferred from description'
  return 'unknown'
}

function normalizeFactValue(value) {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return JSON.stringify(value)
}

function extractJsonObject(text) {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed)
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) return JSON.parse(fence[1].trim())
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1))
  }
  throw new Error('Model response did not contain JSON object')
}

function collectAnthropicText(body) {
  const parts = []
  for (const block of body.content ?? []) {
    if (block.type === 'text' && block.text) parts.push(block.text)
  }
  return parts.join('\n')
}

function extractWebSearchCount(body) {
  return body?.usage?.server_tool_use?.web_search_requests ?? 0
}

function buildClaudeUsageRecord(body, callMeta) {
  const usage = body?.usage
  if (!usage) return null
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const cacheCreate = usage.cache_creation_input_tokens ?? 0
  const est = estimateAnthropicCostUsd(usage, 0)
  return {
    input_tokens: input,
    output_tokens: output,
    web_search_requests: 0,
    estimated_cost_usd: est,
    cache_read_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheCreate,
    anthropic_api_calls: callMeta?.anthropic_api_calls ?? 1,
    anthropic_api_call_log: callMeta?.anthropic_api_call_log ?? [],
  }
}

function logClaudeUsage(body, callMeta) {
  const record = buildClaudeUsageRecord(body, callMeta)
  if (!record) return null
  console.log(
    `  Claude: input=${record.input_tokens} output=${record.output_tokens} cache_read=${record.cache_read_input_tokens} cache_create=${record.cache_creation_input_tokens} est_cost=$${record.estimated_cost_usd.toFixed(4)}`,
  )
  return record
}

function combineApiUsage(perplexityUsage, claudeUsage) {
  const perplexityCost = perplexityUsage?.estimated_cost_usd ?? 0
  const claudeCost = claudeUsage?.estimated_cost_usd ?? 0
  const total = perplexityCost + claudeCost
  return {
    input_tokens: claudeUsage?.input_tokens ?? 0,
    output_tokens: claudeUsage?.output_tokens ?? 0,
    web_search_requests: 0,
    estimated_cost_usd: total,
    total_estimated_cost_usd: total,
    cache_read_input_tokens: claudeUsage?.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: claudeUsage?.cache_creation_input_tokens ?? 0,
    anthropic_api_calls: claudeUsage?.anthropic_api_calls ?? 0,
    anthropic_api_call_log: claudeUsage?.anthropic_api_call_log ?? [],
    perplexity_search_requests: perplexityUsage?.search_requests ?? 0,
    perplexity_estimated_cost_usd: perplexityCost,
    claude_estimated_cost_usd: claudeCost,
  }
}

async function synthesizeWithClaude(product, retrieval, env) {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const model = env.AGENT1_ANTHROPIC_MODEL || 'claude-sonnet-4-6'
  const maxTokens = Number(env.AGENT1_MAX_TOKENS || DEFAULT_MAX_TOKENS)

  beginAnthropicApiCallLog({
    label: 'agent1ClaudeSynthesis',
    productId: product.product_id,
  })

  console.log('\n[agent1] Stage 2: Claude synthesis (no web search tool)…')

  const payload = {
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: SYNTHESIS_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildSynthesisUserPrompt(product, retrieval) }],
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
      `Anthropic API error (${response.status}): ${body.error?.message ?? JSON.stringify(body)}`,
    )
  }

  const text = collectAnthropicText(body)
  if (!text) throw new Error('Anthropic returned no text content')

  const callMeta = finishAnthropicApiCallLog()
  const claudeUsage = logClaudeUsage(body, callMeta)

  return { rawText: text, model, claudeUsage }
}

/** Default path: Amazon direct fetch + Perplexity Search + Claude synthesis. */
async function researchWithPerplexitySearchAndClaude(product, env) {
  const amazonDirectFetch = await fetchAmazonProductPage(product, env)
  const retrieval = await runPerplexityRetrieval(product, env)
  retrieval.amazon_direct_fetch = amazonDirectFetch
  const synth = await synthesizeWithClaude(product, retrieval, env)
  const apiUsage = combineApiUsage(
    {
      search_requests: retrieval.search_requests,
      estimated_cost_usd: retrieval.estimated_cost_usd,
    },
    synth.claudeUsage,
  )
  console.log(
    `\n[agent1] Total est. cost: $${apiUsage.total_estimated_cost_usd.toFixed(4)} (Perplexity $${apiUsage.perplexity_estimated_cost_usd.toFixed(4)} + Claude $${apiUsage.claude_estimated_cost_usd.toFixed(4)})`,
  )
  return {
    rawText: synth.rawText,
    provider: 'perplexity_search',
    model: synth.model,
    usage: apiUsage,
    retrieval,
  }
}

/** Legacy: single-call Anthropic with web_search tool. */
async function researchWithAnthropicWebSearch(product, env) {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  beginAnthropicApiCallLog({
    label: 'researchProduct',
    productId: product.product_id,
  })

  const model = env.AGENT1_ANTHROPIC_MODEL || 'claude-sonnet-4-6'
  const webSearchType = env.AGENT1_WEB_SEARCH_TYPE || 'web_search_20250305'
  const maxTokens = Number(env.AGENT1_MAX_TOKENS || DEFAULT_MAX_TOKENS)
  const maxUses = Number(env.AGENT1_MAX_WEB_SEARCH_USES || DEFAULT_MAX_WEB_SEARCH_USES)

  const payload = {
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [{ type: webSearchType, name: 'web_search', max_uses: maxUses }],
    messages: [{ role: 'user', content: buildUserPrompt(product) }],
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
      `Anthropic API error (${response.status}): ${body.error?.message ?? JSON.stringify(body)}`,
    )
  }

  const text = collectAnthropicText(body)
  if (!text) throw new Error('Anthropic returned no text content')

  const callMeta = finishAnthropicApiCallLog()
  const webSearch = extractWebSearchCount(body)
  const claudeRecord = buildClaudeUsageRecord(body, callMeta)
  const usage = claudeRecord
    ? {
        ...claudeRecord,
        web_search_requests: webSearch,
        estimated_cost_usd: estimateAnthropicCostUsd(body.usage, webSearch),
        total_estimated_cost_usd: estimateAnthropicCostUsd(body.usage, webSearch),
        claude_estimated_cost_usd: estimateAnthropicCostUsd(body.usage, webSearch),
        perplexity_search_requests: 0,
        perplexity_estimated_cost_usd: 0,
      }
    : null

  if (usage) {
    console.log(
      `  API usage: input=${usage.input_tokens} output=${usage.output_tokens} web_searches=${webSearch} cache_read=${usage.cache_read_input_tokens} cache_create=${usage.cache_creation_input_tokens} est_cost=$${usage.estimated_cost_usd.toFixed(4)}`,
    )
  }

  return { rawText: text, provider: 'anthropic', model, usage }
}

export async function researchProduct(product) {
  const env = loadEnv()
  const prefer = (env.AGENT1_PROVIDER || 'perplexity_search').toLowerCase()

  let result
  try {
    if (prefer === 'anthropic') {
      result = await researchWithAnthropicWebSearch(product, env)
    } else if (prefer === 'perplexity_search' || prefer === 'perplexity-search') {
      if (!env.PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY is not set')
      if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set (required for synthesis)')
      result = await researchWithPerplexitySearchAndClaude(product, env)
    } else if (prefer === 'perplexity') {
      throw new Error(
        'AGENT1_PROVIDER=perplexity (Sonar chat) is deprecated. Use perplexity_search (default) or anthropic.',
      )
    } else {
      throw new Error(
        `Unknown AGENT1_PROVIDER="${prefer}". Use perplexity_search (default) or anthropic.`,
      )
    }
  } catch (err) {
    finishAnthropicApiCallLog()
    throw err
  }

  const parsed = extractJsonObject(result.rawText)
  const runTimestamp = new Date().toISOString()

  const sources = (parsed.sources ?? []).map(({ page_excerpt: _pe, ...source }) => source)

  const facts = (parsed.facts ?? []).map((fact) => ({
    ...fact,
    fact_value: normalizeFactValue(fact.fact_value),
    confidence: normalizeConfidence(fact.confidence),
  }))

  const apiUsage = result.usage ?? {
    input_tokens: 0,
    output_tokens: 0,
    web_search_requests: 0,
    estimated_cost_usd: 0,
    total_estimated_cost_usd: 0,
    perplexity_search_requests: 0,
    perplexity_estimated_cost_usd: 0,
    claude_estimated_cost_usd: 0,
  }

  const packet = EvidencePacketSchema.parse({
    sources,
    facts,
    agent_metadata: {
      model: result.model,
      agent_version: AGENT_VERSION,
      run_timestamp: runTimestamp,
      provider: result.provider,
      warnings: parsed.agent_metadata?.warnings ?? [],
      api_usage: apiUsage,
    },
  })

  AgentMetadataSchema.parse(packet.agent_metadata)
  return packet
}
