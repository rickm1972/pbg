/**
 * Server-side normalization of structured Agent 1 output.
 */

import { StructuredPacketSchema } from './schema.mjs'

const INGREDIENT_SOURCES = new Set(['manufacturer_label', 'amazon_listing', 'sds_pdf'])
const FRAGRANCE_VALUES = new Set([
  'synthetic_undisclosed',
  'natural_disclosed',
  'fragrance_free',
  'no_fragrance_data',
])
const COMPONENT_ROLES = new Set([
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
const COATING_TYPES = new Set([
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
const COUNTRY_NULL_CODES = new Set(['MFR_NOT_DISCLOSED', 'NOT_DISCLOSED'])

function coerceUrlOrNull(value) {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (/^https?:\/\//i.test(s)) return s
  return null
}

/** LLM often returns a single object instead of a one-element array. */
function coerceToArray(value, objectKeys = []) {
  if (value == null) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return value.trim() ? [value] : []
  if (typeof value === 'object') {
    if (objectKeys.some((k) => k in value)) return [value]
    const vals = Object.values(value).filter((v) => v != null && typeof v === 'object')
    if (vals.length > 0) return vals
  }
  return []
}

function pickEnum(value, allowed, fallback) {
  if (value != null && allowed.has(value)) return value
  return fallback
}

function mapComponentRole(raw) {
  const s = String(raw ?? '')
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (COMPONENT_ROLES.has(s)) return s
  if (/handle|grip|stay.cool/.test(s)) return 'handle'
  if (/lid|cover/.test(s)) return 'lid'
  if (/rivet/.test(s)) return 'rivet'
  if (/knob/.test(s)) return 'knob'
  if (/base|bottom/.test(s)) return 'base'
  if (/refill|bottle/.test(s)) return 'refill_bottle'
  return 'other'
}

function mapCoatingType(raw) {
  const s = String(raw ?? '')
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (COATING_TYPES.has(s)) return s
  if (/terrabond|hexclad|proprietary/.test(s)) return 'proprietary_undisclosed'
  if (/ptfe|teflon/.test(s)) return 'ptfe_nonstick'
  if (/season|oil|vegetable/.test(s)) return 'natural_oil_seasoning'
  if (/enamel/.test(s)) return 'vitreous_enamel'
  if (/ceramic/.test(s)) return 'ceramic_nonstick_unverified'
  if (/anod/.test(s)) return 'hard_anodized_finish'
  if (/thermolon/.test(s)) return 'thermolon_ceramic'
  return 'other'
}

function normalizeSafetyClaimField(field) {
  const f = field && typeof field === 'object' ? { ...field } : { claimed: false }
  return {
    claimed: Boolean(f.claimed),
    source_url: coerceUrlOrNull(f.source_url),
    structural_guarantee: Boolean(f.structural_guarantee),
    structural_basis: f.structural_basis != null ? String(f.structural_basis) : null,
  }
}

function normalizeSafetyClaims(safetyClaims) {
  const sc = safetyClaims && typeof safetyClaims === 'object' ? safetyClaims : {}
  return {
    pfas_free_claim: normalizeSafetyClaimField(sc.pfas_free_claim),
    bpa_free_claim: normalizeSafetyClaimField(sc.bpa_free_claim),
    phthalate_free_claim: normalizeSafetyClaimField(sc.phthalate_free_claim),
    lead_free_claim: normalizeSafetyClaimField(sc.lead_free_claim),
    non_toxic_claim: normalizeSafetyClaimField(sc.non_toxic_claim),
    independent_testing_documented: Boolean(sc.independent_testing_documented),
    testing_source_url: coerceUrlOrNull(sc.testing_source_url),
  }
}

function normalizeIngredientList(raw, product) {
  if (raw == null) return null
  if (typeof raw !== 'object') return null

  let ingredients = raw.ingredients
  if (typeof ingredients === 'string') {
    ingredients = ingredients
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (!Array.isArray(ingredients)) ingredients = []
  ingredients = ingredients.map((x) => String(x).trim()).filter(Boolean)

  const isCleaner =
    /clean|soap|detergent|concentrate|laundry|dish/i.test(product.category ?? '') ||
    /clean|soap|detergent|concentrate/i.test(product.subcategory ?? '') ||
    /clean|soap|detergent|concentrate/i.test(product.product_name ?? '')

  if (!isCleaner && ingredients.length === 0) return null

  let source = String(raw.source ?? '')
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (source.includes('amazon')) source = 'amazon_listing'
  else if (source.includes('sds') || source.includes('safety')) source = 'sds_pdf'
  else if (!INGREDIENT_SOURCES.has(source)) source = 'manufacturer_label'

  let fragrance = raw.fragrance_disclosure
  if (!FRAGRANCE_VALUES.has(fragrance)) {
    if (/free|none|no.fragrance/i.test(String(fragrance ?? ''))) fragrance = 'fragrance_free'
    else if (/natural/i.test(String(fragrance ?? ''))) fragrance = 'natural_disclosed'
    else if (/synthetic|undisclosed/i.test(String(fragrance ?? ''))) {
      fragrance = 'synthetic_undisclosed'
    } else {
      fragrance = 'no_fragrance_data'
    }
  }

  return {
    ingredients,
    source,
    source_url: coerceUrlOrNull(raw.source_url),
    fragrance_disclosure: fragrance,
    null_code: raw.null_code === 'NOT_DISCLOSED' ? 'NOT_DISCLOSED' : null,
  }
}

function normalizeConflicts(car) {
  const out = car && typeof car === 'object' ? { ...car } : {}
  out.class_action_history = Boolean(out.class_action_history)
  out.class_action_sources = coerceToArray(out.class_action_sources)
    .map((u) => coerceUrlOrNull(u))
    .filter(Boolean)
  out.conflicting_evidence = coerceToArray(out.conflicting_evidence, [
    'claim_topic',
    'source_a_url',
    'source_b_says',
  ]).filter(
      (e) =>
        e &&
        typeof e === 'object' &&
        e.claim_topic &&
        coerceUrlOrNull(e.source_a_url) &&
        coerceUrlOrNull(e.source_b_url),
    )
    .map((e) => ({
      claim_topic: String(e.claim_topic).trim(),
      source_a_url: coerceUrlOrNull(e.source_a_url),
      source_a_says: String(e.source_a_says ?? '').trim() || '—',
      source_b_url: coerceUrlOrNull(e.source_b_url),
      source_b_says: String(e.source_b_says ?? '').trim() || '—',
    }))
  out.requires_human_review = Boolean(out.requires_human_review)
  return out
}

function enrichRetailerLinks(links, product) {
  const l = links && typeof links === 'object' ? { ...links } : {}
  const amazon = coerceUrlOrNull(l.amazon_url) ?? coerceUrlOrNull(product.amazon_url)
  const mfr =
    coerceUrlOrNull(l.manufacturer_direct_url) ??
    coerceUrlOrNull(product.manufacturer_url) ??
    coerceUrlOrNull(product.other_retailer_url) ??
    amazon

  if (!amazon && !mfr) {
    throw new Error(
      `Missing retailer URLs for ${product.product_name} — add amazon_url on the product row`,
    )
  }

  return {
    amazon_url: amazon ?? mfr,
    walmart_url: coerceUrlOrNull(l.walmart_url) ?? coerceUrlOrNull(product.walmart_url),
    target_url: coerceUrlOrNull(l.target_url) ?? coerceUrlOrNull(product.target_url),
    manufacturer_direct_url: mfr ?? amazon,
  }
}

function deriveHumanReview(structured) {
  const flags = structured.conflict_and_review
  if (flags.requires_human_review) return true
  if (flags.class_action_history) return true
  if (flags.conflicting_evidence?.length > 0) return true
  if (structured.primary_contact_material.undisclosed_code === 'PROPRIETARY_NAMED') return true
  return false
}

function filterAffirmativeSecondaries(components) {
  return (components ?? []).filter((c) => {
    const id = String(c.material_identity ?? '').toLowerCase()
    if (/^no |without |not included|not applicable/.test(id)) return false
    return true
  })
}

function filterPhantomCoatings(structured) {
  const primary = structured.primary_contact_material.material_identity
  const isBareMetal = /^(cast_iron|stainless_steel|carbon_steel)/.test(primary)
  if (!isBareMetal) return structured.coatings_and_finishes ?? []
  return (structured.coatings_and_finishes ?? []).filter((c) => {
    if (/ptfe|terrabond|proprietary_undisclosed|ceramic_nonstick/.test(c.coating_type)) {
      return false
    }
    return true
  })
}

function coerceStructuredEvidence(se, product) {
  if (!se.schema_version) se.schema_version = '1.0'

  se.product_identity = se.product_identity ?? {}
  se.product_identity.product_name = se.product_identity.product_name || product.product_name
  se.product_identity.brand = se.product_identity.brand || product.brand || 'unknown'
  se.product_identity.subcategory =
    se.product_identity.subcategory || product.subcategory || product.category || 'general'
  if (se.product_identity.sku_or_model == null && !se.product_identity.sku_null_code) {
    se.product_identity.sku_null_code = 'NOT_LISTED'
  }
  if (se.product_identity.country_of_origin == null && !se.product_identity.country_null_code) {
    se.product_identity.country_null_code = 'NOT_DISCLOSED'
  }
  if (
    se.product_identity.country_null_code != null &&
    !COUNTRY_NULL_CODES.has(se.product_identity.country_null_code)
  ) {
    se.product_identity.country_null_code = 'NOT_DISCLOSED'
  }

  se.primary_contact_material = se.primary_contact_material ?? {}
  if (!se.primary_contact_material.material_identity && !se.primary_contact_material.undisclosed_code) {
    se.primary_contact_material.undisclosed_code = 'UNKNOWN'
    se.primary_contact_material.material_identity = 'UNKNOWN'
  }
  se.primary_contact_material.source_url = coerceUrlOrNull(se.primary_contact_material.source_url)

  se.certifications = se.certifications ?? {}
  se.certifications.claimed_certifications = coerceToArray(
    se.certifications.claimed_certifications,
  ).map((c) => String(c).trim()).filter(Boolean)
  se.certifications.verified_certifications = coerceToArray(
    se.certifications.verified_certifications,
  )
    .map((v) => {
      const registryUrl = coerceUrlOrNull(v.registry_url ?? v.source_url ?? v.page_source_url)
      const sourceUrl = coerceUrlOrNull(v.source_url ?? v.registry_url)
      return {
        ...v,
        cert_name: String(v.cert_name ?? '').trim(),
        source_url: sourceUrl,
        registry_url: registryUrl ?? sourceUrl,
        retrieved_date: v.retrieved_date ?? new Date().toISOString().slice(0, 10),
      }
    })
    .filter((v) => v.cert_name && v.source_url)
  se.certifications.claimed_but_not_verified = coerceToArray(
    se.certifications.claimed_but_not_verified,
    ['cert_name'],
  )

  se.secondary_components = filterAffirmativeSecondaries(
    coerceToArray(se.secondary_components, ['component_role']),
  ).map((c) => ({
    ...c,
    component_role: mapComponentRole(c.component_role),
    source_url: coerceUrlOrNull(c.source_url),
  }))

  const coatingsInput = {
    ...se,
    coatings_and_finishes: coerceToArray(se.coatings_and_finishes, ['coating_type', 'coating_name']),
  }
  se.coatings_and_finishes = filterPhantomCoatings(coatingsInput).map((c) => ({
    ...c,
    coating_type: mapCoatingType(c.coating_type),
    source_url: coerceUrlOrNull(c.source_url),
  }))

  se.safety_claims = normalizeSafetyClaims(se.safety_claims)
  se.ingredient_list = normalizeIngredientList(se.ingredient_list, product)
  se.conflict_and_review = normalizeConflicts(se.conflict_and_review)
  se.retailer_links = enrichRetailerLinks(se.retailer_links, product)
  se.product_use_case = String(se.product_use_case ?? product.category ?? 'general').trim() || 'general'
  se.care_and_use_instructions =
    se.care_and_use_instructions != null ? String(se.care_and_use_instructions) : null

  se.conflict_and_review.requires_human_review = deriveHumanReview(se)
  return se
}

/**
 * @param {object} parsed — raw LLM JSON
 * @param {object} product
 */
export function normalizeStructuredPacket(parsed, product) {
  const se = parsed.structured_evidence ?? parsed
  coerceStructuredEvidence(se, product)

  const packet = StructuredPacketSchema.parse({
    structured_evidence: se,
    sources: parsed.sources ?? [],
    agent_metadata: parsed.agent_metadata ?? { warnings: [] },
  })

  return packet
}
