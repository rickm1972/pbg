/**
 * Why This Score option vocabularies — single source of truth for Agent 2 + Agent 4.
 * Edit options here only; generator and explanation-accuracy must import from this module.
 */

export const NONE = 'None'

/** Canonical absent-cert tag (short controlled vocabulary). */
export const CERT_VERIFICATION_ABSENT = 'No third-party certification'

/** Legacy stored values → canonical (validation only; generator must emit canonical). */
export const WHY_OPTION_LEGACY_ALIASES = {
  disclosure_quality_options: {
    'Full Disclosed': 'Fully Disclosed',
  },
  certifications_options: {
    'Third-party verification absent': CERT_VERIFICATION_ABSENT,
    'No third-party certification found; material identity is clearly disclosed.':
      CERT_VERIFICATION_ABSENT,
  },
}

export const VOCABULARY = {
  primary_material: [
    'Cast iron',
    'Stainless steel 304',
    'Stainless steel 316',
    'Stainless steel grade unspecified',
    '18/8 stainless steel',
    '18/10 stainless steel',
    'Tempered glass',
    'Borosilicate glass',
    'Soda-lime glass',
    'Glass type unspecified',
    'Vitreous enamel over cast iron',
    'Tritan plastic',
    'BPA-free plastic resin unspecified',
    'HDPE',
    'LDPE',
    'PP5',
    'PET',
    'Recycled PCR plastic',
    'Nylon food-contact',
    'Natural teak wood',
    'Natural bamboo',
    'Plant-based formulation',
    'Plant- and mineral-based formulation',
    'Synthetic surfactant formulation',
    'Proprietary ceramic coating (undisclosed)',
    'Ceramic nonstick sol-gel coating',
    'Thermolon ceramic coating',
    'Laser-etched stainless steel surface',
    'PTFE coating',
    'PTFE nonstick coating, titanium reinforced',
    'Thermolon ceramic coating',
    'Hard anodized aluminum',
    'Aluminum core',
  ],
  secondary_materials: [
    NONE,
    'BPA-free plastic lid',
    'Plastic lid resin unspecified',
    'Silicone gasket food-grade verified',
    'Silicone gasket unverified',
    'Tempered glass lid',
    'Stainless steel handle',
    'TPR soft grip handle',
    'Bamboo lid with silicone seal',
    'Stay-cool handle material unspecified',
    'Silicone-coated handle',
    'Magnetic stainless steel base',
    'Stainless steel grade unspecified',
    'Aluminum core',
    'Hard anodized aluminum',
    'Stainless steel rivets',
    'Refill container (non-product-contact)',
    'Recyclable plastic packaging',
  ],
  coatings_finishes: [
    NONE,
    'Natural vegetable oil seasoning',
    'Vitreous enamel glaze',
    'Proprietary ceramic nonstick (undisclosed)',
    'PTFE nonstick coating',
    'Thermolon ceramic nonstick coating',
    'Ceramic nonstick sol-gel coating',
    'Ceramic sol-gel nonstick coating',
    'Powder coat exterior',
    'Hard anodized finish',
    'Polished stainless finish',
    'Wood finishing oil',
    'Wood finishing unspecified',
  ],
  use_conditions: [
    'Stovetop heat with fat exposure',
    'Stovetop heat with acid exposure',
    'Oven heat with fat exposure',
    'Direct oral contact during drinking',
    'Brief beverage contact',
    'Cold food storage',
    'Hot food storage',
    'Brief rinse-off contact',
    'Skin contact leave-on',
    'Direct food handling (utensils)',
    'Hand contact only',
  ],
  disclosure_quality: [
    'Fully Disclosed',
    'Documentation Incomplete',
    'Material Uncertain',
    'Opaque',
  ],
  certifications: [
    'MADE SAFE',
    'Leaping Bunny',
    'EWG Verified',
    'EPA Safer Choice',
    'USDA Biobased',
    'B Corp',
    'Climate Neutral',
    'IFRA Allergen',
    'NSF',
    'FDA Food Contact',
    'Independent BPS BPF tested',
    CERT_VERIFICATION_ABSENT,
  ],
}

/** Fields that may use NONE as an approved absent token. */
const FIELDS_ALLOWING_NONE = new Set([
  'secondary_materials_options',
  'coatings_finishes_options',
])

const FIELD_VOCAB_KEY = {
  primary_material_options: 'primary_material',
  secondary_materials_options: 'secondary_materials',
  coatings_finishes_options: 'coatings_finishes',
  use_conditions_options: 'use_conditions',
  disclosure_quality_options: 'disclosure_quality',
  certifications_options: 'certifications',
}

/** @param {string} fieldKey — scoring_inputs column name */
export function allowedOptionsForField(fieldKey) {
  const vocabKey = FIELD_VOCAB_KEY[fieldKey]
  return vocabKey ? VOCABULARY[vocabKey] : []
}

/**
 * Map legacy/stored option strings to canonical vocabulary values.
 * @param {string} fieldKey
 * @param {string} value
 */
export function normalizeWhyThisScoreOption(fieldKey, value) {
  const s = String(value ?? '').trim()
  if (!s) return s
  const aliases = WHY_OPTION_LEGACY_ALIASES[fieldKey]
  if (aliases && aliases[s]) return aliases[s]
  if (fieldKey === 'disclosure_quality_options' && /^full\s+disclosed$/i.test(s)) {
    return 'Fully Disclosed'
  }
  return s
}

/** Closed-vocabulary check (canonical + legacy aliases). */
export function isAllowedWhyOption(fieldKey, value) {
  const normalized = normalizeWhyThisScoreOption(fieldKey, value)
  return allowedOptionsForField(fieldKey).includes(normalized)
}

/** Normalize Layer 4B / disclosure_quality badge strings for comparison. */
export function normalizeDisclosureBadge(badge) {
  const s = String(badge ?? '').trim()
  if (!s) return s
  if (/^full\s+disclosed$/i.test(s)) return 'Fully Disclosed'
  return s
}

/**
 * @param {string[]} selected
 * @param {string} fieldKey
 */
const MANUFACTURER_LAB_TESTING_OPTION_RE =
  /^Manufacturer-published third-party lab testing/i

export function sanitizeOptions(selected, fieldKey) {
  const allowed = new Set(allowedOptionsForField(fieldKey))
  const out = []
  for (const item of selected ?? []) {
    const s = normalizeWhyThisScoreOption(fieldKey, String(item ?? '').trim())
    if (!s || s === NONE) continue
    const labTestingOption =
      fieldKey === 'certifications_options' && MANUFACTURER_LAB_TESTING_OPTION_RE.test(s)
    if (!allowed.has(s) && !labTestingOption) continue
    if (!out.includes(s)) out.push(s)
  }
  out.sort((a, b) => {
    if (a === NONE) return 1
    if (b === NONE) return -1
    return a.localeCompare(b)
  })
  if (out.length) return out
  if (FIELDS_ALLOWING_NONE.has(fieldKey)) return [NONE]
  return []
}

export function finalizeOptions(selected, fieldKey) {
  return sanitizeOptions(selected, fieldKey)
}
