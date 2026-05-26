/**
 * Agent 2 reads Agent 1 structured_evidence (schema v1) with legacy facts fallback.
 */

import { CONFIDENCE_TO_LEGACY } from '../../agent1/schema.mjs'
import { detectMaterialId, getMaterial } from './material-taxonomy.mjs'

export function getStructuredEvidence(evidence) {
  return evidence?.agent_metadata?.structured_evidence ?? null
}

export function hasStructuredEvidence(evidence) {
  return Boolean(getStructuredEvidence(evidence))
}

function legacyConfidence(label) {
  if (!label) return 'unknown'
  return CONFIDENCE_TO_LEGACY[label] ?? String(label).replace(/_/g, ' ')
}

/** @param {object} evidence */
/** Normalized subcategory from structured packet (preferred) or product row. */
export function getStructuredSubcategory(evidence, product) {
  const s = getStructuredEvidence(evidence)
  const raw = s?.product_identity?.subcategory ?? product?.subcategory ?? ''
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

export function getProductUseCase(evidence) {
  const s = getStructuredEvidence(evidence)
  if (s?.product_use_case) return s.product_use_case
  const facts = evidence?.facts ?? []
  const row = facts.find((f) => f.fact_key === 'product_use_case')
  return row?.fact_value != null ? String(row.fact_value) : ''
}

export function getIngredientList(evidence) {
  const s = getStructuredEvidence(evidence)
  if (s?.ingredient_list?.ingredients?.length) {
    return {
      text: s.ingredient_list.ingredients.join(', '),
      source_url: s.ingredient_list.source_url,
      confidence: legacyConfidence('fully_disclosed_by_manufacturer'),
      excerpt: `Ingredient list from ${s.ingredient_list.source}`,
    }
  }
  const facts = evidence?.facts ?? []
  const row = facts.find((f) => f.fact_key === 'ingredient_list')
  if (!row || !String(row.fact_value ?? '').trim()) return null
  return {
    text: String(row.fact_value),
    source_url: row.source_url ?? null,
    confidence: row.confidence,
    excerpt: row.excerpt ?? '',
  }
}

export function getPrimaryContact(evidence) {
  const s = getStructuredEvidence(evidence)
  if (!s) return null
  const pcm = s.primary_contact_material
  return {
    material_identity: pcm.material_identity,
    undisclosed_code: pcm.undisclosed_code ?? null,
    material_id: mapMaterialId(pcm),
    source_url: pcm.source_url,
    confidence: legacyConfidence(pcm.confidence_label),
    specs_disclosed: pcm.material_specs_disclosed,
    excerpt: pcm.source_url ? `Primary contact per ${pcm.source_url}` : '',
  }
}

export function getSecondaryComponentsFromSchema(evidence) {
  const s = getStructuredEvidence(evidence)
  if (!s) return null
  return (s.secondary_components ?? []).map((c) => {
    const material_identity = c.material_identity ?? c.null_code ?? 'undisclosed'
    const mapped = mapSecondaryMaterialId({ ...c, material_identity })
    const material_id = getMaterial(mapped) ? mapped : material_identity
    return {
      component_role: c.component_role,
      material_identity,
      material_id,
      source_url: c.source_url,
      confidence: legacyConfidence(c.confidence_label),
      excerpt: c.source_url ? `Affirmative ${c.component_role} per ${c.source_url}` : '',
    }
  })
}

export function getCoatingsFromSchema(evidence) {
  const s = getStructuredEvidence(evidence)
  if (!s) return []
  return s.coatings_and_finishes ?? []
}

export function getSafetyClaims(evidence) {
  const s = getStructuredEvidence(evidence)
  if (!s) return null
  return s.safety_claims
}

export function getConflictReview(evidence) {
  const s = getStructuredEvidence(evidence)
  if (!s) return null
  return s.conflict_and_review
}

export function tokensFromStructuredVerifiedCerts(evidence) {
  const s = getStructuredEvidence(evidence)
  if (!s) return null
  return (s.certifications?.verified_certifications ?? []).map((v) => ({
    text: v.cert_name,
    source: 'verified_certifications',
  }))
}

function mapMaterialId(pcm) {
  const id = pcm.material_identity
  if (pcm.undisclosed_code === 'PROPRIETARY_NAMED') {
    return id === 'terrabond_proprietary' ? 'terrabond_proprietary' : 'proprietary_named_food_contact'
  }
  if (id === 'PROPRIETARY_NAMED') return 'proprietary_named_food_contact'
  if (id === 'terrabond_proprietary') return 'terrabond_proprietary'
  if (/^cast_iron/.test(id)) return /season/.test(id) ? 'cast_iron_seasoned' : 'cast_iron'
  if (id === 'UNKNOWN' || id === 'CONFLICTING') return 'cast_iron'
  return id
}

function mapSecondaryMaterialId(c) {
  const role = c.component_role
  const mat = String(c.material_identity ?? '').toLowerCase()
  if (role === 'refill_bottle') return 'refill_container_hdpe_unspecified'
  if (role === 'lid' && /glass/.test(mat)) return 'tempered_glass_lid'
  if (mat === 'tempered_glass' && role === 'lid') return 'tempered_glass_lid'
  if (mat === 'stainless_steel' || mat === 'stainless_steel_304' || mat === 'stainless_steel_316') {
    return mat === 'stainless_steel' ? 'stainless_steel_unspecified' : mat
  }
  if (mat === 'aluminum' || mat === 'aluminium') return 'aluminum_core'
  if (mat === 'stay_cool_handle' || (role === 'handle' && /stay_cool|stay.cool/.test(mat))) {
    return 'stay_cool_handle_undisclosed'
  }
  if (role === 'handle' && !c.material_identity) return 'stay_cool_handle_undisclosed'
  if (role === 'rivet') return 'stainless_steel_rivets'
  if (role === 'magnetic_base' || role === 'base') return 'magnetic_stainless_base'
  const detected = detectMaterialId(c.material_identity)
  if (detected) return detected
  return c.material_identity ?? 'stay_cool_handle_undisclosed'
}
