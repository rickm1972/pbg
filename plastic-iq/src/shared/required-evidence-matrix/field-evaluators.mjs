import { isExpansionRequired } from '../canonical-taxonomy/constants.mjs'
import { resolvePrimaryContactEntry } from '../canonical-taxonomy/map-structured-evidence.mjs'
import {
  isInertFoodContactPrimary,
  requiresCoatingModifier,
  UNCOATED_COATING_MODIFIER_IDS,
} from '../canonical-taxonomy/inert-cookware-structural.mjs'

/**
 * @param {object} structured
 */
function effectivePrimaryContactCanonicalId(structured) {
  const mappings = structured?.canonical_mappings
  let primaryId = mappings?.primary_contact_material_id?.canonical_id ?? ''
  if (!isExpansionRequired(primaryId)) return primaryId
  const raw =
    mappings?.primary_contact_material_id?.raw_value ??
    structured?.primary_contact_material?.material_identity ??
    ''
  return resolvePrimaryContactEntry(raw)?.canonical_id ?? primaryId
}

/**
 * @param {object} obj
 * @param {string} path
 */
export function getPathValue(obj, path) {
  if (!obj || !path) return undefined
  const parts = path.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

/**
 * @param {object} structured
 * @param {import('./types.mjs').MatrixFieldRequirement} req
 */
export function evaluateFieldRequirement(structured, req) {
  const val = getPathValue(structured, req.field_path)
  const required = req.required !== false

  if (req.field_path.startsWith('canonical_mappings.')) {
    const key = req.field_path.replace('canonical_mappings.', '')
    const row = structured?.canonical_mappings?.[key]
    if (!row) {
      return required
        ? { status: 'missing', detail: 'Canonical mapping row missing' }
        : { status: 'not_applicable', detail: null }
    }
    if (isExpansionRequired(row.canonical_id)) {
      return { status: 'missing', detail: 'TAXONOMY_EXPANSION_REQUIRED' }
    }
    return { status: 'passed', detail: row.canonical_id, source_url: row.source_url, source_quote: row.source_quote }
  }

  if (req.field_path === 'secondary_components') {
    const arr = structured?.secondary_components
    if (!Array.isArray(arr) || arr.length === 0) {
      return required ? { status: 'missing', detail: 'No secondary components listed' } : { status: 'not_applicable', detail: null }
    }
    const withMaterial = arr.filter((c) => c.material_identity?.trim() || c.undisclosed_code || c.null_code)
    if (withMaterial.length === 0) {
      return required ? { status: 'missing', detail: 'Secondary components lack material identity' } : { status: 'review_required', detail: 'Partial disclosure' }
    }
    return { status: 'passed', detail: `${withMaterial.length} component(s)` }
  }

  if (req.field_path === 'coatings_and_finishes') {
    const mappings = structured?.canonical_mappings
    const primaryId = effectivePrimaryContactCanonicalId(structured)
    const coatingMod = mappings?.coating_modifier_id?.canonical_id ?? ''
    const uncoatedInert =
      isInertFoodContactPrimary(primaryId) &&
      !requiresCoatingModifier(primaryId) &&
      (UNCOATED_COATING_MODIFIER_IDS.has(coatingMod) || coatingMod === 'no_coating_modifier')
    if (uncoatedInert) {
      return {
        status: 'passed',
        detail: 'No applied coating — uncoated/all-metal food-contact construction',
      }
    }
    const arr = structured?.coatings_and_finishes
    if (!Array.isArray(arr) || arr.length === 0) {
      return required ? { status: 'missing', detail: 'No coatings/finishes listed' } : { status: 'not_applicable', detail: null }
    }
    return { status: 'passed', detail: `${arr.length} coating(s)` }
  }

  if (req.field_path === 'safety_claims') {
    if (!structured?.safety_claims || typeof structured.safety_claims !== 'object') {
      return { status: 'missing', detail: 'safety_claims object missing' }
    }
    return { status: 'passed', detail: 'populated' }
  }

  if (req.field_path === 'primary_contact_material.source_url') {
    const pcm = structured?.primary_contact_material
    const hasSource =
      Boolean(pcm?.source_url?.trim()) ||
      ['PROPRIETARY_NAMED', 'UNKNOWN', 'CONFLICTING'].includes(pcm?.undisclosed_code ?? '')
    return hasSource
      ? { status: 'passed', detail: pcm.source_url ?? pcm.undisclosed_code, source_url: pcm.source_url }
      : { status: 'missing', detail: 'No source URL or undisclosed code' }
  }

  if (typeof val === 'string') {
    const ok = Boolean(val.trim())
    return ok
      ? { status: 'passed', detail: val.trim().slice(0, 120) }
      : required
        ? { status: 'missing', detail: 'Empty value' }
        : { status: 'not_applicable', detail: null }
  }

  if (val == null || val === '') {
    return required ? { status: 'missing', detail: 'Empty value' } : { status: 'not_applicable', detail: null }
  }

  return { status: 'passed', detail: String(val).slice(0, 120) }
}
