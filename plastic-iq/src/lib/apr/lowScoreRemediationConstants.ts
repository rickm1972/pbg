/**
 * Phase 4.5 remediation constants — T-Fal + Caraway only.
 */

import { PUBLISHED_BASELINE_PRODUCT_IDS } from './publishedBaselineIds'

import { GLOBAL_METHODOLOGY_DISCLAIMER } from './publicReviewStamp'

export const STANDARD_METHODOLOGY_DISCLAIMER = GLOBAL_METHODOLOGY_DISCLAIMER

export const TFAL_NEUTRAL_DESCRIPTION_OVERRIDE =
  'Reviewed product materials identify PTFE nonstick coating in the food-contact layer. This product scores lower under the PAC Safety Score methodology because the score reflects food-contact coating material, use conditions, and disclosure quality.'

export const REMEDIATION_REVIEWER_ID = 'Rick'

export const REMEDIATION_TARGETS = {
  tfal: {
    product_id: PUBLISHED_BASELINE_PRODUCT_IDS.tfal,
    slug: 't-fal',
    expected_score: 2,
    expected_tier: 'High Risk' as const,
    description_override: TFAL_NEUTRAL_DESCRIPTION_OVERRIDE,
    primary_score_driving_concern: 'PTFE nonstick coating in food-contact layer',
    reviewer_notes:
      'neutral methodology-only PTFE wording approved; no brand/marketing characterization',
  },
  caraway: {
    product_id: PUBLISHED_BASELINE_PRODUCT_IDS.caraway,
    slug: 'caraway',
    expected_score: 66,
    expected_tier: 'Caution' as const,
    description_override: null as string | null,
    primary_score_driving_concern:
      'disclosure/material uncertainty under PAC Safety Score methodology',
    reviewer_notes:
      'uncertainty-safe methodology wording approved; no confirmed-hazard claim',
  },
} as const
