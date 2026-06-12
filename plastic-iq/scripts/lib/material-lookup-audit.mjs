/**
 * Phase 4.5 — canonical material ID alignment audit + six-product hazard/migration dump.
 */
import { PRIMARY_CONTACT_MATERIAL_TAXONOMY } from '../../src/shared/canonical-taxonomy/primary-contact-material-taxonomy.mjs'
import { SUBSTRATE_MATERIAL_TAXONOMY } from '../../src/shared/canonical-taxonomy/substrate-material-taxonomy.mjs'
import { COATING_MODIFIER_TAXONOMY } from '../../src/shared/canonical-taxonomy/coating-modifier-taxonomy.mjs'
import {
  MATERIAL_TAXONOMY,
  MATERIAL_TAXONOMY_ALIASES,
  resolveMaterialLookupMeta,
  isUnknownFoodContactCoatingMaterial,
} from '../agent2/deterministic/material-taxonomy.mjs'
import {
  isKnownProprietaryCeramicNonstickMaterial,
} from '../../src/shared/agent2/proprietary-ceramic-nonstick.mjs'

/** Agent 1 score-driving material canonical IDs from taxonomy tables. */
export function collectAgent1MaterialCanonicalIds() {
  const rows = []
  for (const entry of PRIMARY_CONTACT_MATERIAL_TAXONOMY) {
    rows.push({
      canonical_id: entry.canonical_id,
      agent2_material_id: entry.agent2_material_id ?? null,
      source: 'primary_contact_material',
      display_label: entry.display_label,
    })
  }
  for (const entry of SUBSTRATE_MATERIAL_TAXONOMY) {
    rows.push({
      canonical_id: entry.canonical_id,
      agent2_material_id: entry.agent2_material_id ?? null,
      source: 'substrate_material',
      display_label: entry.display_label,
    })
  }
  return rows
}

function isNonDetectEligibleInCode(materialId) {
  if (!materialId) return false
  if (isUnknownFoodContactCoatingMaterial(materialId)) return false
  const mat = MATERIAL_TAXONOMY[materialId]
  if (mat?.inertProtection) return false
  if (isKnownProprietaryCeramicNonstickMaterial(materialId, { material_id: materialId }, null)) {
    return true
  }
  if (materialId === 'hybrid_stainless_nonstick_food_contact') return true
  return /nonstick|ceramic|hybrid|proprietary/i.test(materialId)
}

function recommendAction(row, meta) {
  if (meta.material) {
    if (meta.alias_applied) return 'Resolved via MATERIAL_TAXONOMY_ALIASES'
    return 'Direct MATERIAL_TAXONOMY match'
  }
  if (row.agent2_material_id && MATERIAL_TAXONOMY[row.agent2_material_id]) {
    return 'Add alias to agent2_material_id if human-approved'
  }
  if (row.canonical_id.includes('proprietary') || row.canonical_id.includes('undisclosed')) {
    return 'Ambiguous — human review; do not auto-alias'
  }
  return 'Unresolved — blocker or taxonomy expansion'
}

/** PART A alignment audit rows. */
export function auditCanonicalMaterialAlignment() {
  const agent1Ids = collectAgent1MaterialCanonicalIds()
  return agent1Ids.map((row) => {
    const meta = resolveMaterialLookupMeta(row.canonical_id)
    const safeAlias = Boolean(MATERIAL_TAXONOMY_ALIASES[row.canonical_id])
    return {
      canonical_id: row.canonical_id,
      resolves_in_material_taxonomy: Boolean(meta.material),
      lookup_status: meta.canonical_material_lookup_status,
      existing_taxonomy_id: meta.resolved_material_taxonomy_id,
      agent2_material_id: row.agent2_material_id,
      source: row.source,
      product_category_affected: 'cookware',
      safe_alias: safeAlias,
      recommended_action: recommendAction(row, meta),
    }
  })
}

/** PART C — six regression product material concepts (no agent runs). */
export const SIX_PRODUCT_MATERIAL_ROWS = [
  {
    product: 'Lodge',
    concept: 'cast iron',
    reviewed_ids: ['cast_iron', 'cast_iron_body', 'cast_iron_seasoned'],
  },
  {
    product: 'All-Clad',
    concept: 'stainless steel cooking surface',
    reviewed_ids: [
      'stainless_steel_unspecified',
      'stainless_steel_304',
      'stainless_steel_316',
      'stainless_steel_cooking_surface',
      'stainless_steel_body',
    ],
  },
  {
    product: 'HexClad',
    concept: 'hybrid stainless lattice + nonstick food contact',
    reviewed_ids: ['hybrid_stainless_nonstick_food_contact', 'terrabond_proprietary'],
  },
  {
    product: 'GreenPan',
    concept: 'ceramic nonstick sol-gel / Thermolon',
    reviewed_ids: [
      'ceramic_nonstick_sol_gel_coating',
      'ceramic_nonstick_verified',
      'thermolon_ceramic',
    ],
  },
  {
    product: 'Caraway',
    concept: 'ceramic nonstick sol-gel proprietary',
    reviewed_ids: ['ceramic_nonstick_sol_gel_coating', 'ceramic_nonstick_sol_gel'],
  },
  {
    product: 'T-Fal',
    concept: 'PTFE nonstick',
    reviewed_ids: ['ptfe_nonstick_coating', 'ptfe_nonstick', 'ptfe_nonstick_titanium_reinforced'],
  },
]

export function dumpSixProductMaterialValues() {
  const rows = []
  for (const productRow of SIX_PRODUCT_MATERIAL_ROWS) {
    for (const reviewedId of productRow.reviewed_ids) {
      const meta = resolveMaterialLookupMeta(reviewedId)
      const resolved = meta.resolved_material_taxonomy_id
      const mat = meta.material
      rows.push({
        product: productRow.product,
        expected_material_concept: productRow.concept,
        reviewed_canonical_id: reviewedId,
        resolved_taxonomy_id: resolved,
        resolves: Boolean(mat),
        hazard_in_code: mat?.hazard ?? null,
        migration_in_code: mat?.migration ?? null,
        non_detect_eligible_in_code: isNonDetectEligibleInCode(resolved),
        notes: meta.material_lookup_notes ?? (mat ? mat.tier : 'unresolved'),
      })
    }
  }
  return rows
}

export function summarizeLookupSyncConcerns() {
  const alignment = auditCanonicalMaterialAlignment()
  const unresolved = alignment.filter((r) => !r.resolves_in_material_taxonomy)
  const aliased = alignment.filter((r) => r.safe_alias)
  const coatingModifiers = COATING_MODIFIER_TAXONOMY.map((e) => e.canonical_id)
  const modifierUnresolved = coatingModifiers.filter((id) => !resolveMaterialLookupMeta(id).material)

  return {
    unresolved_agent1_material_ids: unresolved.map((r) => r.canonical_id),
    aliased_count: aliased.length,
    coating_modifier_ids_not_in_material_taxonomy: modifierUnresolved,
    value_sync_note:
      'Active code values are in material-taxonomy.mjs only; manual diff against finalized Material Lookup artifact required before Phase 5 real-product locking.',
    lodge_hexclad_mechanical:
      'Lodge and HexClad primary score-driving IDs resolve (directly or via alias) for validation; value-sync still requires human diff.',
    real_product_lock_recommendation:
      'Do not lock real products until hazard/migration values are diffed against finalized Material Lookup.',
  }
}
