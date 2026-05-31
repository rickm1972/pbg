/** Reuse Persona agent pricing constants for Channel Discovery. */
export {
  estimatePerplexityCostUsd,
  estimateAnthropicCostUsd,
  CLAUDE_SONNET_46_PRICING,
} from '../persona/pricing.mjs'

import { loadEnv } from '../lib/env.mjs'

const env = () => loadEnv()

export function defaultChannelPerplexityModel() {
  return env().CHANNEL_PERPLEXITY_MODEL || env().PERSONA_PERPLEXITY_MODEL || 'sonar-pro'
}

export function defaultChannelAnthropicModel() {
  return env().CHANNEL_ANTHROPIC_MODEL || env().PERSONA_ANTHROPIC_MODEL || 'claude-sonnet-4-6'
}
