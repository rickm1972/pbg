/**
 * Persona agent cost estimates — configurable via env; defaults from vendor list pricing (May 2026).
 *
 * Perplexity Sonar Pro: https://docs.perplexity.ai/guides/pricing
 * Claude Sonnet 4.6: https://docs.anthropic.com/en/docs/about-claude/pricing
 */

import { loadEnv } from '../lib/env.mjs'
import { CLAUDE_SONNET_46_PRICING, estimateAnthropicCostUsd } from '../agent1/anthropic-usage.mjs'

const env = () => loadEnv()

/** USD per token — Sonar Pro chat (override with PERSONA_PERPLEXITY_INPUT_PER_M / OUTPUT_PER_M). */
export function perplexitySonarProPricing() {
  const inputPerM = Number(env().PERSONA_PERPLEXITY_INPUT_PER_M ?? 3)
  const outputPerM = Number(env().PERSONA_PERPLEXITY_OUTPUT_PER_M ?? 15)
  const requestFeeUsd = Number(env().PERSONA_PERPLEXITY_REQUEST_FEE_USD ?? 0)
  return {
    inputPerToken: inputPerM / 1_000_000,
    outputPerToken: outputPerM / 1_000_000,
    requestFeeUsd,
  }
}

/**
 * @param {{ prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }} usage
 * @param {number} [requestCount]
 */
export function estimatePerplexityCostUsd(usage, requestCount = 1) {
  const input = Number(usage?.prompt_tokens ?? usage?.input_tokens) || 0
  const output = Number(usage?.completion_tokens ?? usage?.output_tokens) || 0
  const p = perplexitySonarProPricing()
  return (
    input * p.inputPerToken + output * p.outputPerToken + requestCount * p.requestFeeUsd
  )
}

export { CLAUDE_SONNET_46_PRICING, estimateAnthropicCostUsd }

export function defaultPersonaAnthropicModel() {
  return env().PERSONA_ANTHROPIC_MODEL || env().AGENT1_ANTHROPIC_MODEL || 'claude-sonnet-4-6'
}

export function defaultPersonaPerplexityModel() {
  return env().PERSONA_PERPLEXITY_MODEL || 'sonar-pro'
}
