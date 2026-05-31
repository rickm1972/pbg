import { z } from 'zod'

export const RetrievalExcerptSchema = z.object({
  claim: z.string(),
  url: z.string().url(),
  source_title: z.string().optional(),
  source_type: z.enum(['authoritative', 'voc']).optional(),
  channel_name_hint: z.string().optional(),
})

export const AngleRetrievalSchema = z.object({
  angle_id: z.string(),
  label: z.string(),
  coverage_note: z.string().optional(),
  excerpts: z.array(RetrievalExcerptSchema),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
    })
    .optional(),
  estimated_cost_usd: z.number().optional(),
  error: z.string().optional(),
})
