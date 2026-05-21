import { loadEnv } from '../lib/env.mjs'
import {
  AGENT2_MODEL_DEFAULT,
  AGENT2_SYSTEM_PROMPT,
  AGENT_VERSION,
  ALGORITHM_VERSION,
  buildUserPrompt,
} from './prompt.mjs'
import { enforceLayer4a } from './layer4a-enforce.mjs'
import { validateNormalizationOutput } from './validate.mjs'

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

async function callClaude(product, evidence, env, options = {}) {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const model = env.AGENT2_ANTHROPIC_MODEL || AGENT2_MODEL_DEFAULT

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(env.AGENT2_MAX_TOKENS || 8192),
      system: [
        {
          type: 'text',
          text: AGENT2_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(product, evidence, {
            rejectionNotes: options.rejectionNotes,
          }),
        },
      ],
    }),
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(
      `Anthropic API error (${response.status}): ${body.error?.message ?? JSON.stringify(body)}`,
    )
  }

  const text = collectAnthropicText(body)
  if (!text) throw new Error('Empty response from Claude')

  return { text, model }
}

export async function normalizeEvidence(product, evidence, options = {}) {
  const env = loadEnv()
  let lastErr

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, model } = await callClaude(product, evidence, env, options)
      const parsed = extractJsonObject(text)
      const runTimestamp = new Date().toISOString()
      parsed.normalization_metadata = {
        agent_version: AGENT_VERSION,
        algorithm_version: ALGORITHM_VERSION,
        run_timestamp: runTimestamp,
        model,
        ...(parsed.normalization_metadata ?? {}),
      }
      const validated = validateNormalizationOutput(
        parsed,
        product.product_id,
        evidence.evidence_id,
      )
      return enforceLayer4a(validated)
    } catch (err) {
      lastErr = err
      if (attempt === 0) {
        console.log('  JSON parse/validation failed — retrying once…')
      }
    }
  }

  throw lastErr
}
