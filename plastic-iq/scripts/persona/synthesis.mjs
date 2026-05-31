import { jsonrepair } from 'jsonrepair'
import { loadEnv } from '../lib/env.mjs'
import {
  defaultPersonaAnthropicModel,
  estimateAnthropicCostUsd,
} from './pricing.mjs'
import { PersonaContentSchema, PERSONA_CONTENT_FIELD_KEYS } from './schema.mjs'
import { extractSynthesisPayload } from './sources-from-synthesis.mjs'
import { ensurePersonaLabels, PERSONA_LABEL_EXEMPT_KEYS } from './persona-labels.mjs'

const SYNTHESIS_SYSTEM = `You are a buyer persona writer for PlasticBegone (non-toxic kitchen / household products).

You receive research excerpts from web retrieval. Write a buyer persona from those excerpts.

Rules:
- Return ONLY valid JSON (no markdown fences).
- Use the exact field keys provided.
- Each field value is a concise paragraph or short bullet-style string (plain text), except labeling fields noted below.
- For all fields EXCEPT persona_name and persona_nickname: fill ONLY when retrieved excerpts clearly support it. Otherwise use "".
- persona_name and persona_nickname are REQUIRED labeling exceptions — they are NOT source-grounded. Always invent a vivid, descriptive pair (e.g. persona_name "Maya", persona_nickname "the Health-First Home Keeper"). Never leave either blank.
- Never invent statistics, quotes, URLs, or claims in sourced fields.
- voice_of_customer_quote must be grounded in VOC excerpts; paraphrase if needed, do not fabricate.
- summary_one_liner: exactly one short sentence (max ~25 words) for the page header — not the full summary.
- summary: one full paragraph expanding on who they are; must not duplicate summary_one_liner verbatim.
- data_sources should summarize source types used (not duplicate the sources list).

You must also cite sources: include only source_id values from the catalog that materially support fields you filled. For each, write a short statement of what you drew from that source.`

function collectAnthropicText(body) {
  const blocks = body?.content ?? []
  return blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

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

function formatCatalogForPrompt(catalog) {
  if (!catalog?.list?.length) return '(no cataloged sources)'
  return catalog.list
    .map(
      (e) =>
        `- ${e.source_id}: ${e.claim ?? e.retrieval_excerpt}\n  URL: ${e.url}${e.source_title ? `\n  Title: ${e.source_title}` : ''}`,
    )
    .join('\n')
}

export function buildSynthesisUserPrompt(targetSegment, catalog) {
  const fieldList = PERSONA_CONTENT_FIELD_KEYS.map((k) => `    "${k}": ""`).join(',\n')
  return `Target segment: "${targetSegment}"

Source catalog (use source_id values in citations_used):
${formatCatalogForPrompt(catalog)}

Return JSON with this exact shape:
{
  "persona": {
${fieldList}
  },
  "citations_used": [
    { "source_id": "src_001", "statement": "One sentence: what you used from this source for the persona" }
  ]
}

Rules for citations_used:
- Include ONLY source_id entries you actually relied on for sourced persona fields (not persona_name or persona_nickname).
- Each statement must describe the supporting fact (not "referenced in retrieval").
- Omit every unused source_id — do not list sources you did not use.

Labeling (required, not cited):
- persona_name: short first name or label (e.g. "Maya", "Jordan")
- persona_nickname: memorable descriptor phrase (e.g. "the Health-First Home Keeper")`
}

/**
 * @param {{ targetSegment: string, catalog: object, log?: (msg: string) => void }}
 */
export async function synthesizePersona({ targetSegment, catalog, log = () => {} }) {
  const env = loadEnv()
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const model = defaultPersonaAnthropicModel()
  const maxTokens = Number(env.PERSONA_MAX_TOKENS ?? 8000)

  log('\n[persona] Stage 2: Claude synthesis (no web search)…')

  const payload = {
    model,
    max_tokens: maxTokens,
    system: SYNTHESIS_SYSTEM,
    messages: [
      {
        role: 'user',
        content: buildSynthesisUserPrompt(targetSegment, catalog),
      },
    ],
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
    if (response.ok) break
    if (response.status === 429 && attempt < 4) {
      const waitMs = 30_000 * (attempt + 1)
      log(`  Rate limited — retrying in ${waitMs / 1000}s…`)
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }
    throw new Error(
      `Anthropic API error (${response.status}): ${body?.error?.message ?? JSON.stringify(body)}`,
    )
  }

  const text = collectAnthropicText(body)
  if (!text) throw new Error('Anthropic returned no text content')

  const usage = body.usage ?? {}
  const estimated_cost_usd = estimateAnthropicCostUsd(usage, 0)

  let parsed
  try {
    parsed = parseJsonLoose(text)
  } catch (err) {
    throw new Error(`Synthesis JSON parse failed: ${err.message}`)
  }

  const { persona: personaRaw } = extractSynthesisPayload(parsed)
  const contentResult = PersonaContentSchema.safeParse(personaRaw)
  let persona_content = contentResult.success
    ? contentResult.data
    : Object.fromEntries(
        PERSONA_CONTENT_FIELD_KEYS.map((k) => [
          k,
          typeof personaRaw?.[k] === 'string' ? personaRaw[k] : '',
        ]),
      )

  persona_content = ensurePersonaLabels(persona_content, targetSegment)
  for (const key of PERSONA_LABEL_EXEMPT_KEYS) {
    if (!persona_content[key]?.trim()) {
      log(`  Warning: ${key} was blank after synthesis — applied fallback label`)
      persona_content = ensurePersonaLabels(persona_content, targetSegment)
      break
    }
  }

  return {
    persona_content,
    parsed,
    model,
    rawText: text,
    usage: {
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      estimated_cost_usd,
    },
  }
}
