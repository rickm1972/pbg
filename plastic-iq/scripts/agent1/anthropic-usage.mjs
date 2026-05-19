/**
 * Anthropic usage helpers — Sonnet 4.6 list pricing (API, May 2026).
 * @see https://docs.anthropic.com/en/docs/about-claude/pricing
 */

/** USD per token (≤200k context). Ephemeral cache write = 5-minute TTL. */
export const CLAUDE_SONNET_46_PRICING = {
  inputPerToken: 3 / 1_000_000,
  outputPerToken: 15 / 1_000_000,
  cacheWrite5mPerToken: 3.75 / 1_000_000,
  cacheReadPerToken: 0.3 / 1_000_000,
  webSearchPerRequest: 10 / 1_000,
}

/**
 * @param {object} usage - Anthropic usage object from /v1/messages response
 * @param {number} [webSearchRequests]
 */
export function estimateAnthropicCostUsd(usage, webSearchRequests = 0) {
  const input = Number(usage?.input_tokens) || 0
  const output = Number(usage?.output_tokens) || 0
  const cacheRead = Number(usage?.cache_read_input_tokens) || 0
  const cacheCreate = Number(usage?.cache_creation_input_tokens) || 0
  const searches = Number(webSearchRequests) || 0
  const p = CLAUDE_SONNET_46_PRICING

  return (
    input * p.inputPerToken +
    output * p.outputPerToken +
    cacheRead * p.cacheReadPerToken +
    cacheCreate * p.cacheWrite5mPerToken +
    searches * p.webSearchPerRequest
  )
}

/** @type {{ label: string, productId?: string, calls: object[], startedAt: number } | null} */
let activeRun = null

export function beginAnthropicApiCallLog({ label, productId } = {}) {
  activeRun = {
    label: label ?? 'agent1',
    productId: productId ?? null,
    calls: [],
    startedAt: Date.now(),
  }
  console.log(
    `[anthropic-api] BEGIN run="${activeRun.label}" product_id=${activeRun.productId ?? 'n/a'}`,
  )
  return activeRun
}

export function recordAnthropicApiCall({
  attempt = 1,
  status,
  ok,
  model,
  stopReason,
  error,
}) {
  if (!activeRun) {
    activeRun = { label: 'unscoped', productId: null, calls: [], startedAt: Date.now() }
  }
  const n = activeRun.calls.length + 1
  const entry = {
    call_number: n,
    attempt,
    http_status: status,
    ok: Boolean(ok),
    model: model ?? null,
    stop_reason: stopReason ?? null,
    error: error ?? null,
    at: new Date().toISOString(),
  }
  activeRun.calls.push(entry)
  console.log(
    `[anthropic-api] POST /v1/messages #${n} attempt=${attempt} status=${status} ok=${ok}${stopReason ? ` stop=${stopReason}` : ''}`,
  )
  return entry
}

export function finishAnthropicApiCallLog() {
  const count = activeRun?.calls.length ?? 0
  const label = activeRun?.label ?? 'unknown'
  const log = activeRun?.calls ?? []
  console.log(`[anthropic-api] END run="${label}" anthropic_api_calls=${count}`)
  activeRun = null
  return { anthropic_api_calls: count, anthropic_api_call_log: log }
}
