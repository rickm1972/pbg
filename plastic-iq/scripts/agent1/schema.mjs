/**
 * Agent 1 structured evidence schema (contract with Agent 2 V3.0).
 */
import { z } from 'zod'

export const SCHEMA_VERSION = '1.0'
export const AGENT_VERSION = '2.0'

export const NULL_CODES = [
  'MFR_NOT_DISCLOSED',
  'RETAILER_NOT_DISCLOSED',
  'INFERRED_FROM_CATEGORY_PATTERN',
  'NOT_LISTED',
  'NOT_DISCLOSED',
]

export const PRIMARY_UNDISCLOSED_CODES = ['PROPRIETARY_NAMED', 'UNKNOWN', 'CONFLICTING']

export const CONFIDENCE_LABELS_SCHEMA = z.enum([
  'manufacturer_confirmed',
  'retailer_confirmed',
  'fully_disclosed_by_manufacturer',
  'third_party_review_citing_manufacturer',
  'third_party_context_source',
  'manufacturer_claim_via_secondary_source',
  'inferred_from_description',
  'inferred_from_category_pattern',
  'unknown',
  'proprietary_or_undisclosed',
])

/** Maps schema confidence → legacy Agent 2 labels */
export const CONFIDENCE_TO_LEGACY = {
  manufacturer_confirmed: 'manufacturer confirmed',
  retailer_confirmed: 'retailer confirmed',
  fully_disclosed_by_manufacturer: 'fully disclosed by manufacturer',
  inferred_from_description: 'inferred from description',
  inferred_from_category_pattern: 'inferred from category pattern',
  unknown: 'unknown',
  proprietary_or_undisclosed: 'proprietary or undisclosed',
  third_party_review_citing_manufacturer: 'third-party review citing manufacturer',
  third_party_context_source: 'third-party context source',
  manufacturer_claim_via_secondary_source: 'manufacturer claim via secondary source',
}

export const COMPONENT_ROLES = z.enum([
  'handle',
  'lid',
  'gasket',
  'rivet',
  'knob',
  'strap',
  'base',
  'refill_bottle',
  'cap',
  'straw',
  'brush_bristle',
  'magnetic_base',
  'structural',
  'other',
])

export const COATING_TYPES = z.enum([
  'ceramic_nonstick_verified',
  'ceramic_nonstick_unverified',
  'ptfe_nonstick',
  'proprietary_undisclosed',
  'natural_oil_seasoning',
  'vitreous_enamel',
  'powder_coat_exterior',
  'laser_etched_finish',
  'hard_anodized_finish',
  'thermolon_ceramic',
  'other',
])

const urlOrNull = z.union([z.string().url(), z.null()])

/** LLM often returns string booleans — coerce before Zod rejects the packet. */
function preprocessBoolean(value) {
  if (typeof value === 'boolean') return value
  if (value == null || value === '') return false
  const s = String(value).trim().toLowerCase()
  if (s === 'true' || s === 'yes' || s === '1') return true
  if (s === 'false' || s === 'no' || s === '0') return false
  return false
}

/** LLM invents sku null labels — only NOT_LISTED is valid when SKU is absent. */
function preprocessSkuNullCode(value) {
  if (value === 'NOT_LISTED') return value
  if (value == null || value === '') return undefined
  return 'NOT_LISTED'
}

export const ProductIdentitySchema = z.object({
  product_name: z.string().min(1),
  brand: z.string().min(1),
  subcategory: z.string().min(1),
  sku_or_model: z.string().nullable(),
  manufacturer_context_sku: z.string().nullable().optional(),
  manufacturer_context_sku_source_url: urlOrNull.optional(),
  sku_null_code: z.preprocess(
    preprocessSkuNullCode,
    z.enum(['NOT_LISTED']).nullable().optional(),
  ),
  country_of_origin: z.string().nullable(),
  country_null_code: z.enum(['MFR_NOT_DISCLOSED', 'NOT_DISCLOSED']).nullable().optional(),
})

export const PrimaryContactMaterialSchema = z.object({
  material_identity: z.string().min(1),
  undisclosed_code: z.enum(PRIMARY_UNDISCLOSED_CODES).nullable().optional(),
  source_url: urlOrNull,
  confidence_label: CONFIDENCE_LABELS_SCHEMA,
  material_specs_disclosed: z.preprocess(preprocessBoolean, z.boolean()),
})

export const SecondaryComponentSchema = z.object({
  component_role: COMPONENT_ROLES,
  material_identity: z.string().nullable(),
  undisclosed_code: z
    .enum([...NULL_CODES, 'PROPRIETARY_NAMED'])
    .nullable()
    .optional(),
  source_url: urlOrNull,
  confidence_label: CONFIDENCE_LABELS_SCHEMA,
  null_code: z.enum(NULL_CODES).nullable().optional(),
})

export const CoatingFinishSchema = z.object({
  coating_name: z.string().min(1),
  coating_type: COATING_TYPES,
  composition_disclosed: z.boolean(),
  source_url: urlOrNull,
  third_party_verified: z.boolean(),
})

export const VerifiedCertificationSchema = z.object({
  cert_name: z.string().min(1),
  /** Certifying-body registry URL (required for verified — never manufacturer marketing URL). */
  source_url: z.string().url(),
  registry_url: z.string().url(),
  retrieved_date: z.string().min(1),
  page_source_url: z.string().url().nullable().optional(),
})

export const ClaimedNotVerifiedSchema = z.object({
  cert_name: z.string().min(1),
  claim_source_url: z.string().url().nullable(),
  registry_check_result: z.string().min(1),
})

export const CertificationsSchema = z.object({
  claimed_certifications: z.array(z.string()),
  verified_certifications: z.array(VerifiedCertificationSchema),
  claimed_but_not_verified: z.array(ClaimedNotVerifiedSchema),
})

export const SafetyClaimFieldSchema = z.object({
  claimed: z.boolean(),
  source_url: urlOrNull,
  structural_guarantee: z.boolean(),
  structural_basis: z.string().nullable(),
})

export const SafetyClaimsSchema = z.object({
  pfas_free_claim: SafetyClaimFieldSchema,
  bpa_free_claim: SafetyClaimFieldSchema,
  phthalate_free_claim: SafetyClaimFieldSchema,
  lead_free_claim: SafetyClaimFieldSchema,
  non_toxic_claim: SafetyClaimFieldSchema,
  independent_testing_documented: z.boolean(),
  testing_source_url: urlOrNull,
})

export const IngredientListSchema = z
  .object({
    ingredients: z.array(z.string()),
    source: z.enum(['manufacturer_label', 'amazon_listing', 'sds_pdf']),
    source_url: urlOrNull,
    fragrance_disclosure: z.enum([
      'synthetic_undisclosed',
      'natural_disclosed',
      'fragrance_free',
      'no_fragrance_data',
    ]),
    null_code: z.enum(['NOT_DISCLOSED']).nullable().optional(),
  })
  .nullable()

export const ConflictEntrySchema = z.object({
  claim_topic: z.string().min(1),
  source_a_url: z.string().url(),
  source_a_says: z.string().min(1),
  source_b_url: z.string().url(),
  source_b_says: z.string().min(1),
})

export const ConflictAndReviewSchema = z.object({
  class_action_history: z.boolean(),
  class_action_sources: z.array(z.string().url()),
  conflicting_evidence: z.array(ConflictEntrySchema),
  requires_human_review: z.boolean(),
})

export const RetailerLinksSchema = z.object({
  amazon_url: z.string().url(),
  walmart_url: urlOrNull,
  target_url: urlOrNull,
  manufacturer_direct_url: z.string().url(),
})

export const StructuredEvidenceSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  product_identity: ProductIdentitySchema,
  primary_contact_material: PrimaryContactMaterialSchema,
  secondary_components: z.array(SecondaryComponentSchema),
  coatings_and_finishes: z.array(CoatingFinishSchema),
  certifications: CertificationsSchema,
  safety_claims: SafetyClaimsSchema,
  ingredient_list: IngredientListSchema,
  conflict_and_review: ConflictAndReviewSchema,
  retailer_links: RetailerLinksSchema,
  product_use_case: z.string().min(1),
  care_and_use_instructions: z.string().nullable(),
  out_of_scope_safety_signals: z
    .array(
      z.object({
        signal_id: z.string(),
        category: z.string(),
        summary: z.string(),
        source_url: z.string().url().nullable().optional(),
        source_quote: z.string().nullable().optional(),
        pac_score_relevant: z.literal(false).optional(),
        display_label: z.string().optional(),
        scope_note: z.string().optional(),
      }),
    )
    .optional(),
  transparency_assessment: z
    .object({
      transparency_badge: z.string(),
      badge_justification: z.string(),
      fully_disclosed_eligible: z.boolean(),
      score_driving_via_third_party: z.boolean(),
      proprietary_coating_composition: z.boolean(),
      evaluated_at: z.string(),
    })
    .optional(),
  canonical_mappings: z.any().optional(),
  required_evidence_validation: z.any().optional(),
  required_check_results: z.array(z.any()).optional(),
})

export const StructuredPacketSchema = z.object({
  structured_evidence: StructuredEvidenceSchema,
  sources: z
    .array(
      z.object({
        source_type: z.string(),
        url: z.string().url(),
        title: z.string(),
        fetched_at: z.string(),
        page_excerpt: z.string().optional(),
      }),
    )
    .min(1),
  agent_metadata: z.object({
    warnings: z.array(z.string()).default([]),
    model: z.string().optional(),
    agent_version: z.string().optional(),
    run_timestamp: z.string().optional(),
    provider: z.string().optional(),
  }),
})

export function isUndisclosedMaterialId(materialIdentity) {
  return PRIMARY_UNDISCLOSED_CODES.includes(materialIdentity)
}
