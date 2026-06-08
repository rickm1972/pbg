export const AGENT_VERSION = '4.0.0'
export const ALGORITHM_VERSION = '2.3.4'

export const LAYER_4A_NEGATIVE_LOOKUP = [
  {
    reason: 'BPA-free claim only, no BPS/BPF testing',
    value: -1,
    pattern: /bpa-free claim only,\s*no bps\/bpf/i,
  },
  {
    reason: 'Unknown proprietary food-contact coating',
    value: -3,
    pattern: /unknown proprietary food-contact coating/i,
  },
  {
    reason: 'Marketing language only, no verifiable claims',
    value: -2,
    pattern: /marketing language only,\s*no verifiable/i,
  },
  {
    reason: 'Undisclosed dye chemistry in textiles',
    value: -1,
    pattern: /undisclosed dye chemistry/i,
  },
]

export const INFERRED_MATERIAL_CONFIDENCES = new Set([
  'inferred from description',
  'inferred from category pattern',
  'unknown',
  'proprietary or undisclosed',
])

export const TRUSTED_MATERIAL_CONFIDENCES = new Set([
  'manufacturer confirmed',
  'retailer confirmed',
  'certification verified',
  'fully disclosed by manufacturer',
])

export const SCORE_SANITY_DELTA_THRESHOLD = 15
/** Minimum valid subcategory peers (current active pipeline) before median outlier pass/fail. */
export const SCORE_SANITY_MIN_PEERS = 5
/** Minimum peers sharing product material family for family-scoped comparison (optional path). */
export const SCORE_SANITY_MIN_FAMILY_PEERS = 3
export const PRIMARY_CONTACT_CI_THRESHOLD = 0.7
