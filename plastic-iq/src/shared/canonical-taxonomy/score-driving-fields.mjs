import { isExpansionRequired } from './constants.mjs'

/** Cookware Gate 1 required canonical fields (Phase 3.5). */
export const COOKWARE_SCORE_DRIVING_FIELDS = [
  { field_key: 'primary_contact_material_id', label: 'Primary contact material', taxonomy_file: 'primary-contact-material-taxonomy.mjs', required: true },
  { field_key: 'substrate_material_id', label: 'Substrate material', taxonomy_file: 'substrate-material-taxonomy.mjs', required: true },
  { field_key: 'coating_modifier_id', label: 'Coating modifier', taxonomy_file: 'coating-modifier-taxonomy.mjs', required: true },
  { field_key: 'pfas_status_id', label: 'PFAS status', taxonomy_file: 'pfas-status-taxonomy.mjs', required: true },
]

export const SAFETY_CLAIM_FIELD_KEYS = [
  'pfoa_free_claim',
  'pfas_free_marketing_claim',
  'non_toxic_marketing_claim',
  'bpa_free_claim',
  'lead_free_claim',
  'phthalate_free_claim',
]

/**
 * @param {import('./types.mjs').CanonicalMappingsPayload | null | undefined} mappings
 * @param {{ subcategory?: string }} [ctx]
 */
export function getCanonicalApprovalBlockers(mappings, ctx = {}) {
  const blockers = []
  const sub = String(ctx.subcategory ?? '').toLowerCase()
  const isCookware =
    sub.includes('cookware') ||
    sub.includes('cooking') ||
    sub.includes('utensil') ||
    sub.includes('food storage') === false

  if (!mappings) {
    blockers.push('Canonical mappings missing — apply Phase 3.5 mapping before approval.')
    return blockers
  }

  if (!isCookware && !sub) {
    // Default pipeline catalog is cookware-heavy; still enforce when mappings present.
  }

  for (const req of COOKWARE_SCORE_DRIVING_FIELDS) {
    const row = mappings[req.field_key]
    if (!row) {
      blockers.push(`${req.label}: canonical mapping missing.`)
      continue
    }
    if (isExpansionRequired(row.canonical_id)) {
      blockers.push(
        `${req.label}: TAXONOMY_EXPANSION_REQUIRED (raw: ${row.raw_value ?? '—'}). Update ${req.taxonomy_file}.`,
      )
    }
  }

  const primary = mappings.primary_contact_material_id
  const substrate = mappings.substrate_material_id
  if (
    primary &&
    substrate &&
    !isExpansionRequired(primary.canonical_id) &&
    !isExpansionRequired(substrate.canonical_id) &&
    primary.canonical_id === substrate.canonical_id
  ) {
    blockers.push('Primary contact and substrate canonical IDs must not be identical.')
  }

  if (
    primary &&
    !isExpansionRequired(primary.canonical_id) &&
    /substrate|hard_anodized_aluminum|aluminum_core|cast_iron_body/.test(primary.canonical_id) &&
    !/coating|ptfe|ceramic|nonstick/.test(primary.canonical_id)
  ) {
    blockers.push('Primary contact canonical ID must be the food-contact coating/surface, not substrate only.')
  }

  for (const flag of mappings.regulatory_flag_ids ?? []) {
    if (isExpansionRequired(flag.canonical_id)) {
      blockers.push(
        `Regulatory flag: TAXONOMY_EXPANSION_REQUIRED (raw: ${flag.raw_value ?? '—'}). Update regulatory-flag-taxonomy.mjs.`,
      )
    }
  }

  for (const [key, row] of Object.entries(mappings.safety_claim_ids ?? {})) {
    if (row?.claimed && isExpansionRequired(row.canonical_id)) {
      blockers.push(
        `Safety claim ${key}: TAXONOMY_EXPANSION_REQUIRED (raw: ${row.raw_value ?? '—'}). Update safety-claim-taxonomy.mjs.`,
      )
    }
  }

  for (const b of mappings.blockers ?? []) {
    if (b && !blockers.includes(b)) blockers.push(b)
  }

  return blockers
}
