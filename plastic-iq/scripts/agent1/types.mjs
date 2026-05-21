import { z } from 'zod'

export const AGENT_VERSION = '1.0.0'
export const ALGORITHM_VERSION = 'v2.3.3'

/** Lodge / May 15 batch cap — enforced after the model returns. */
export const MAX_SOURCES = 14

export const CONFIDENCE_LABELS = /** @type {const} */ ([
  'manufacturer confirmed',
  'retailer confirmed',
  'certification verified',
  'fully disclosed by manufacturer',
  'inferred from description',
  'inferred from category pattern',
  'proprietary or undisclosed',
  'claim not independently verified',
  'unknown',
])

const strongConfidence = new Set([
  'manufacturer confirmed',
  'retailer confirmed',
  'certification verified',
  'fully disclosed by manufacturer',
])

export function isStrongConfidence(label) {
  return strongConfidence.has(label)
}

export const SourceSchema = z.object({
  source_type: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  fetched_at: z.string().min(1),
  page_excerpt: z.string().optional(),
})

export const FactSchema = z.object({
  fact_type: z.string().min(1),
  fact_key: z.string().min(1),
  fact_value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  confidence: z.enum(CONFIDENCE_LABELS),
  source_index: z.number().int().nonnegative().nullable(),
  excerpt: z.string(),
})

export const CertificationVerifiedRowSchema = z.object({
  certification_name: z.string().min(1),
  source_url: z.string().nullable(),
  found_in_page_content: z.boolean(),
  action_taken: z.string().min(1),
})

export const AgentMetadataSchema = z.object({
  model: z.string().min(1),
  agent_version: z.string().min(1),
  run_timestamp: z.string().min(1),
  provider: z.enum(['anthropic', 'perplexity', 'perplexity_search']),
  warnings: z.array(z.string()).default([]),
  api_usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    web_search_requests: z.number(),
    estimated_cost_usd: z.number(),
    total_estimated_cost_usd: z.number().optional(),
    perplexity_search_requests: z.number().optional(),
    perplexity_estimated_cost_usd: z.number().optional(),
    amazon_anthropic_estimated_cost_usd: z.number().optional(),
    claude_estimated_cost_usd: z.number().optional(),
    cache_read_input_tokens: z.number().optional(),
    cache_creation_input_tokens: z.number().optional(),
    anthropic_api_calls: z.number().optional(),
    anthropic_api_call_log: z
      .array(
        z.object({
          call_number: z.number(),
          attempt: z.number(),
          http_status: z.number(),
          ok: z.boolean(),
          model: z.string().nullable().optional(),
          stop_reason: z.string().nullable().optional(),
          error: z.string().nullable().optional(),
          at: z.string(),
        }),
      )
      .optional(),
  }),
  certifications_verified: z.array(CertificationVerifiedRowSchema).optional(),
  in_testing_queue: z.boolean().optional(),
  minimum_threshold: z
    .object({
      met: z.boolean(),
      checks: z.record(z.string(), z.boolean()),
      failures: z.array(z.string()).optional(),
    })
    .optional(),
})

export const EvidencePacketSchema = z.object({
  sources: z.array(SourceSchema).min(1).max(MAX_SOURCES),
  facts: z.array(FactSchema),
  agent_metadata: AgentMetadataSchema,
})

export const ProductInputSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  subcategory: z.string().nullable(),
  amazon_url: z.string().nullable(),
  target_url: z.string().nullable(),
  walmart_url: z.string().nullable(),
  other_retailer_label: z.string().nullable(),
  other_retailer_url: z.string().nullable(),
  image_url: z.string().nullable(),
})
