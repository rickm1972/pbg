/**
 * Central Why This Score vocabularies — single source of truth.
 * Edit options here; Agent 2 may only output exact strings from these lists.
 */

export const NONE = 'None'

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
    'Laser-etched stainless steel surface',
    'PTFE coating',
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
    'Magnetic stainless steel base',
    'Stainless steel grade unspecified',
    'Aluminum core',
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
    'Full Disclosed',
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
    'Third-party verification absent',
  ],
}

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
 * Keep only vocabulary strings; dedupe; stable sort.
 * @param {string[]} selected
 * @param {string} fieldKey
 */
export function sanitizeOptions(selected, fieldKey) {
  const allowed = new Set(allowedOptionsForField(fieldKey))
  const out = []
  for (const item of selected ?? []) {
    const s = String(item ?? '').trim()
    if (!s || !allowed.has(s)) continue
    if (!out.includes(s)) out.push(s)
  }
  out.sort((a, b) => {
    if (a === NONE) return 1
    if (b === NONE) return -1
    return a.localeCompare(b)
  })
  return out.length ? out : [NONE]
}

export function finalizeOptions(selected, fieldKey) {
  return sanitizeOptions(selected, fieldKey)
}
