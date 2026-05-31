import { jsonrepair } from 'jsonrepair'
import { loadEnv } from '../lib/env.mjs'
import {
  PERSONA_RESEARCH_ANGLES,
  RETRIEVAL_SYSTEM_PROMPT,
  buildAngleUserPrompt,
} from './angles.mjs'
import { AngleRetrievalSchema, RetrievalExcerptSchema } from './schema.mjs'
import { defaultPersonaPerplexityModel, estimatePerplexityCostUsd } from './pricing.mjs'
import { filterExcerptsForAngle } from './source-filter.mjs'
import { isMalformedOrSpamUrl, isPlaceholderClaim } from './url-guard.mjs'

function parseJsonLoose(text) {
  const trimmed = String(text ?? '').trim()
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  const raw = fence ? fence[1].trim() : trimmed
  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(jsonrepair(raw))
  }
}

function sanitizeExcerpt(ex, log) {
  if (!ex?.url || isMalformedOrSpamUrl(ex.url)) {
    if (ex?.url) log?.(`  Discarded malformed/spam URL: ${String(ex.url).slice(0, 80)}…`)
    return null
  }
  if (isPlaceholderClaim(ex.claim)) return null
  return ex
}

function normalizeExcerpts(parsed, log = () => {}) {
  const excerpts = Array.isArray(parsed?.excerpts) ? parsed.excerpts : []
  const out = []
  for (const item of excerpts) {
    let candidate = null
    const parsedExcerpt = RetrievalExcerptSchema.safeParse(item)
    if (parsedExcerpt.success) {
      candidate = parsedExcerpt.data
    } else if (item?.claim && item?.url) {
      candidate = {
        claim: String(item.claim),
        url: String(item.url),
        source_title: item.source_title ? String(item.source_title) : undefined,
        source_type: item.source_type === 'voc' ? 'voc' : 'authoritative',
      }
    }
    const clean = candidate ? sanitizeExcerpt(candidate, log) : null
    if (clean) out.push(clean)
  }
  return out
}

/**
 * @param {{ apiKey: string, model: string, angle: object, targetSegment: string, log?: (msg: string) => void }}
 */
export async function runAngleRetrieval({ apiKey, model, angle, targetSegment, log = () => {} }) {
  log(`[persona] Retrieval: ${angle.label}…`)

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: RETRIEVAL_SYSTEM_PROMPT },
        { role: 'user', content: buildAngleUserPrompt(angle, targetSegment) },
      ],
    }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = body?.error?.message ?? body?.message ?? JSON.stringify(body)
    throw new Error(`Perplexity API error (${response.status}): ${msg}`)
  }

  const content = body?.choices?.[0]?.message?.content ?? ''
  const citations = Array.isArray(body?.citations) ? body.citations : []
  const usage = body?.usage ?? {}
  const estimated_cost_usd = estimatePerplexityCostUsd(usage, 1)

  let excerpts = []
  try {
    const parsed = parseJsonLoose(content)
    excerpts = normalizeExcerpts(parsed, log)
  } catch (err) {
    log(`  Warning: could not parse JSON for ${angle.id}: ${err.message}`)
    excerpts = normalizeExcerpts({}, log)
  }

  excerpts = filterExcerptsForAngle(excerpts, { angleId: angle.id, log })

  return AngleRetrievalSchema.parse({
    angle_id: angle.id,
    label: angle.label,
    excerpts,
    citations,
    usage,
    estimated_cost_usd,
  })
}

/**
 * Run all angles; failures are recorded per-angle without aborting the batch.
 * @param {{ targetSegment: string, onAngleComplete?: (result: object) => Promise<void> | void, log?: (msg: string) => void }}
 */
export async function runAllAngleRetrievals({ targetSegment, onAngleComplete, log = () => {} }) {
  const env = loadEnv()
  const apiKey = env.PERPLEXITY_API_KEY
  if (!apiKey) throw new Error('PERPLEXITY_API_KEY is not set')

  const model = defaultPersonaPerplexityModel()
  const results = []
  const failed = []

  let totalInput = 0
  let totalOutput = 0
  let totalCost = 0

  for (const angle of PERSONA_RESEARCH_ANGLES) {
    try {
      const result = await runAngleRetrieval({
        apiKey,
        model,
        angle,
        targetSegment,
        log,
      })
      results.push(result)
      totalInput += Number(result.usage?.prompt_tokens) || 0
      totalOutput += Number(result.usage?.completion_tokens) || 0
      totalCost += result.estimated_cost_usd ?? 0
      if (onAngleComplete) await onAngleComplete(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log(`  Angle failed (${angle.id}): ${message}`)
      const failure = {
        angle_id: angle.id,
        label: angle.label,
        excerpts: [],
        citations: [],
        error: message,
      }
      results.push(failure)
      failed.push({ angle_id: angle.id, error: message })
      if (onAngleComplete) await onAngleComplete(failure)
    }
  }

  return {
    model,
    angles: results,
    angles_failed: failed,
    usage: {
      perplexity_requests: PERSONA_RESEARCH_ANGLES.length,
      perplexity_input_tokens: totalInput,
      perplexity_output_tokens: totalOutput,
      perplexity_estimated_cost_usd: totalCost,
    },
  }
}
