import { z } from 'zod'

export const PersonaContentSchema = z
  .object({
    persona_name: z.string().optional(),
    persona_nickname: z.string().optional(),
    segment: z.string().optional(),
    summary_one_liner: z.string().optional(),
    summary: z.string().optional(),
    demographics: z.string().optional(),
    role_lifestyle_context: z.string().optional(),
    main_goal: z.string().optional(),
    main_pain_point: z.string().optional(),
    buying_trigger: z.string().optional(),
    barriers: z.string().optional(),
    decision_criteria: z.string().optional(),
    information_needs: z.string().optional(),
    trusted_sources: z.string().optional(),
    channels: z.string().optional(),
    messaging_angle: z.string().optional(),
    objections: z.string().optional(),
    proof_needed: z.string().optional(),
    cta: z.string().optional(),
    voice_of_customer_quote: z.string().optional(),
    data_sources: z.string().optional(),
    pac_awareness_level: z.string().optional(),
    overwhelm_risk: z.string().optional(),
    safety_motivation: z.string().optional(),
    replacement_readiness: z.string().optional(),
    trust_threshold: z.string().optional(),
    eighty_twenty_mindset_fit: z.string().optional(),
    product_category_priority: z.string().optional(),
    risk_communication_sensitivity: z.string().optional(),
    preferred_safer_alternative_type: z.string().optional(),
    certification_literacy: z.string().optional(),
  })
  .strict()

export const PersonaSourceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  excerpt: z.string().optional(),
  angle_id: z.string().optional(),
  source_type: z.enum(['authoritative', 'voc', 'unknown']).optional(),
})

export const RetrievalExcerptSchema = z.object({
  claim: z.string(),
  url: z.string().url(),
  source_title: z.string().optional(),
  source_type: z.enum(['authoritative', 'voc']).optional(),
})

export const AngleRetrievalSchema = z.object({
  angle_id: z.string(),
  label: z.string(),
  excerpts: z.array(RetrievalExcerptSchema),
  citations: z.array(z.string()).optional(),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
  estimated_cost_usd: z.number().optional(),
  error: z.string().optional(),
})

export const PERSONA_CONTENT_FIELD_KEYS = [
  'persona_name',
  'persona_nickname',
  'segment',
  'summary_one_liner',
  'summary',
  'demographics',
  'role_lifestyle_context',
  'main_goal',
  'main_pain_point',
  'buying_trigger',
  'barriers',
  'decision_criteria',
  'information_needs',
  'trusted_sources',
  'channels',
  'messaging_angle',
  'objections',
  'proof_needed',
  'cta',
  'voice_of_customer_quote',
  'data_sources',
  'pac_awareness_level',
  'overwhelm_risk',
  'safety_motivation',
  'replacement_readiness',
  'trust_threshold',
  'eighty_twenty_mindset_fit',
  'product_category_priority',
  'risk_communication_sensitivity',
  'preferred_safer_alternative_type',
  'certification_literacy',
]
