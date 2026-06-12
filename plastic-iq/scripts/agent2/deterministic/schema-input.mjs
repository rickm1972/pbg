/**
 * Agent 2 reads Agent 1 structured_evidence (schema v1) with legacy facts fallback.
 */

import { CONFIDENCE_TO_LEGACY } from '../../agent1/schema.mjs'
import { isExpansionRequired } from '../../../src/shared/canonical-taxonomy/constants.mjs'
import { detectMaterialId, getMaterial } from './material-taxonomy.mjs'
import { resolvePrimaryContactDisplayIdentity } from './coating-substrate-handoff.mjs'

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

/**
 * Phase 3.5: prefer Gate 1 canonical primary_contact_material_id → Agent 2 material_id.
 * @param {object} pcm
 * @param {object | null} canonicalRow
 */
function resolvePrimaryMaterialId(pcm, canonicalRow) {
  if (canonicalRow?.canonical_id && !isExpansionRequired(canonicalRow.canonical_id)) {
    if (canonicalRow.agent2_material_id && getMaterial(canonicalRow.agent2_material_id)) {
      return canonicalRow.agent2_material_id
    }
    if (getMaterial(canonicalRow.canonical_id)) return canonicalRow.canonical_id
  }
  return mapMaterialId(pcm)
}

export function getCanonicalMappings(evidence) {
  return getStructuredEvidence(evidence)?.canonical_mappings ?? null
}

/** True when Gate 1 canonical primary is resolved and maps to a valid Agent 2 material. */
export function hasValidCanonicalPrimaryContact(evidence) {
  if (!hasStructuredEvidence(evidence)) return false
  const canonical = getStructuredEvidence(evidence)?.canonical_mappings?.primary_contact_material_id
  if (!canonical?.canonical_id || isExpansionRequired(canonical.canonical_id)) return false
  const matId =
    canonical.agent2_material_id && getMaterial(canonical.agent2_material_id)
      ? canonical.agent2_material_id
      : canonical.canonical_id
  return Boolean(matId && getMaterial(matId))
}

export function getPrimaryContact(evidence) {
  const s = getStructuredEvidence(evidence)
  if (!s) return null
  const pcm = s.primary_contact_material
  const canonical = s.canonical_mappings?.primary_contact_material_id
  const material_id = resolvePrimaryMaterialId(pcm, canonical)
  if (canonical?.canonical_id && isExpansionRequired(canonical.canonical_id)) {
    throw new Error(
      `primary_contact_material_id is ${canonical.canonical_id}; Gate 1 must resolve taxonomy before Agent 2.`,
    )
  }
  if (!material_id || !getMaterial(material_id)) {
    throw new Error(
      `Invalid or missing canonical primary_contact_material_id for Agent 2 (got ${material_id ?? 'null'}).`,
    )
  }
  const mappingConfidence = canonical?.confidence_label ?? pcm.confidence_label
  const substrate = s.canonical_mappings?.substrate_material_id ?? null
  const material_identity = resolvePrimaryContactDisplayIdentity(
    pcm,
    canonical,
    substrate,
    s.coatings_and_finishes ?? [],
  )
  return {
    material_identity,
    undisclosed_code: pcm.undisclosed_code ?? null,
    material_id,
    canonical_id: canonical?.canonical_id ?? null,
    mapping_rule_id: canonical?.mapping_rule_id ?? null,
    source_url: canonical?.source_url ?? pcm.source_url,
    confidence: legacyConfidence(mappingConfidence),
    specs_disclosed: pcm.material_specs_disclosed,
    excerpt: pcm.source_url ? `Primary contact per ${pcm.source_url}` : '',
  }
}

/** Substrate canonical row for logging / description (not a separate component by default). */
export function getSubstrateCanonical(evidence) {
  return getStructuredEvidence(evidence)?.canonical_mappings?.substrate_material_id ?? null
}

export function getSecondaryComponentsFromSchema(evidence) {
  const s = getStructuredEvidence(evidence)
  if (!s) return null
  return (s.secondary_components ?? []).map((c) => {
    const material_identity = c.material_identity ?? c.null_code ?? 'undisclosed'
    const mapped = mapSecondaryMaterialId({ ...c, material_identity })
    const resolved = getMaterial(mapped) ? mapped : getMaterial(material_identity) ? material_identity : null
    const material_id = resolved ?? material_identity
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
  const id = String(pcm.material_identity ?? '').trim()
  if (pcm.undisclosed_code === 'PROPRIETARY_NAMED') {
    return id === 'terrabond_proprietary' ? 'terrabond_proprietary' : 'proprietary_named_food_contact'
  }
  if (id === 'PROPRIETARY_NAMED') return 'proprietary_named_food_contact'
  if (id === 'terrabond_proprietary') return 'terrabond_proprietary'
  if (/^cast_iron/.test(id)) return /season/.test(id) ? 'cast_iron_seasoned' : 'cast_iron'
  if (id === 'UNKNOWN' || id === 'CONFLICTING') return 'cast_iron'
  if (/stainless_steel_interior|graphite_aluminum_core|_5ply|5-ply/i.test(id)) {
    return 'stainless_steel_unspecified'
  }
  if (id === 'ptfe') return 'ptfe_nonstick'
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
