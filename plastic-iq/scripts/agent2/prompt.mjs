/**
 * @deprecated Agent 2 V3.0 uses deterministic normalization only.
 */
export { AGENT_VERSION, ALGORITHM_VERSION } from './version.mjs'

export const AGENT2_MODEL_DEFAULT = 'claude-sonnet-4-6'

export const AGENT2_SYSTEM_PROMPT =
  'DEPRECATED: Agent 2 V3.0 does not call the LLM. Use scripts/agent2/deterministic/normalize.mjs.'

export function buildUserPrompt() {
  throw new Error('Agent 2 LLM prompt is deprecated in V3.0. Normalization is fully deterministic.')
}
