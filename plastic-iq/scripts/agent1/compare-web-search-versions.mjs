/**
 * One-shot comparison: web_search_20250305 vs web_search_20260209
 * Single search on lodgecastiron.com — reports usage.input_tokens.
 *
 * Usage: node scripts/agent1/compare-web-search-versions.mjs
 */
import { loadEnv } from '../lib/env.mjs'

const MODEL = 'claude-sonnet-4-6'
const DOMAIN = 'lodgecastiron.com'
const USER_PROMPT = `Use the web_search tool exactly once (no second search).

Search only on ${DOMAIN} for the official Lodge 10.25 inch cast iron skillet product page.

Reply with ONLY this JSON (no markdown):
{"url_found":"...","one_fact":"primary material or main product material if stated"}`

async function callAnthropic(apiKey, { label, tools }) {
  const payload = {
    model: MODEL,
    max_tokens: 800,
    tools,
    messages: [{ role: 'user', content: USER_PROMPT }],
  }

  const started = Date.now()
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const body = await response.json()
  const elapsedMs = Date.now() - started

  if (!response.ok) {
    return {
      label,
      ok: false,
      status: response.status,
      error: body.error?.message ?? JSON.stringify(body),
      elapsedMs,
    }
  }

  const webSearches = body.usage?.server_tool_use?.web_search_requests ?? 0
  const blockTypes = (body.content ?? []).map((b) => b.type)

  return {
    label,
    ok: true,
    elapsedMs,
    stop_reason: body.stop_reason,
    web_search_requests: webSearches,
    usage: body.usage ?? {},
    block_types: blockTypes,
    text_preview: (body.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .slice(0, 200),
  }
}

function buildTools(webSearchType, { withCodeExecution = false, directOnly = false } = {}) {
  const webSearch = {
    type: webSearchType,
    name: 'web_search',
    max_uses: 1,
    allowed_domains: [DOMAIN],
  }
  if (directOnly) webSearch.allowed_callers = ['direct']

  const tools = [webSearch]
  if (withCodeExecution) {
    tools.push({ type: 'code_execution_20260120', name: 'code_execution' })
    webSearch.allowed_callers = ['direct', 'code_execution_20260120']
  }
  return tools
}

async function main() {
  const env = loadEnv()
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const runs = [
    {
      label: 'web_search_20250305',
      tools: buildTools('web_search_20250305'),
    },
    {
      label: 'web_search_20260209 (default / dynamic filtering)',
      tools: buildTools('web_search_20260209'),
    },
    {
      label: 'web_search_20260209 + code_execution (explicit)',
      tools: buildTools('web_search_20260209', { withCodeExecution: true }),
    },
    {
      label: 'web_search_20260209 allowed_callers=direct only',
      tools: buildTools('web_search_20260209', { directOnly: true }),
    },
  ]

  console.log(`Model: ${MODEL}`)
  console.log(`Domain: ${DOMAIN}, max_uses: 1\n`)

  const results = []
  for (const run of runs) {
    console.log(`Running: ${run.label}…`)
    const result = await callAnthropic(apiKey, run)
    results.push(result)
    if (!result.ok) {
      console.log(`  ERROR ${result.status}: ${result.error}\n`)
      continue
    }
    const u = result.usage
    console.log(
      `  input_tokens=${u.input_tokens} output_tokens=${u.output_tokens} web_searches=${result.web_search_requests} stop=${result.stop_reason} (${result.elapsedMs}ms)`,
    )
    console.log(`  blocks: ${result.block_types.join(', ')}\n`)
    await new Promise((r) => setTimeout(r, 3000))
  }

  const ok = results.filter((r) => r.ok)
  const base = ok.find((r) => r.label.startsWith('web_search_20250305'))
  const dyn = ok.find((r) => r.label.includes('default'))
  if (base && dyn) {
    const diff = (dyn.usage.input_tokens ?? 0) - (base.usage.input_tokens ?? 0)
    const pct =
      base.usage.input_tokens > 0
        ? ((diff / base.usage.input_tokens) * 100).toFixed(1)
        : 'n/a'
    console.log('--- Summary (50305 vs 60209 default) ---')
    console.log(`  20250305 input_tokens: ${base.usage.input_tokens}`)
    console.log(`  20260209 input_tokens: ${dyn.usage.input_tokens}`)
    console.log(`  difference: ${diff >= 0 ? '+' : ''}${diff} (${pct}%)`)
  }

  console.log('\nFull JSON:')
  console.log(JSON.stringify(results, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
