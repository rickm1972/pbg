import { isExpansionRequired } from '../../src/shared/canonical-taxonomy/constants.mjs'
import {
  isCompoundCookwareMaterialString,
  normalizeCompoundMaterialRaw,
  parseCompoundCookwareMaterial,
} from '../../src/shared/canonical-taxonomy/compound-cookware-material.mjs'
import {
  resolvePrimaryContactEntry,
  resolveSubstrateEntry,
} from '../../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import {
  detectHybridCookwareEvidenceSignals,
} from '../../src/shared/canonical-taxonomy/hybrid-cookware-structural.mjs'
import {
  INERT_UNCOATED_PRIMARY_IDS,
  UNCOATED_COATING_MODIFIER_IDS,
} from '../../src/shared/canonical-taxonomy/inert-cookware-structural.mjs'

const KNOWN_COOKWARE_MATERIAL_TOKEN =
  /stainless|cast_iron|carbon_steel|graphite|aluminum|aluminium|ptfe|teflon|ceramic_nonstick|sol_gel|glass|borosilicate|enameled|hybrid|terrabond/i

/**
 * Fail before persisting Gate 1 when common cookware tokens still map to TAXONOMY_EXPANSION_REQUIRED.
 * @param {object} structured
 * @param {{ product_name?: string }} [product]
 */
export function assertCookwareMaterialsResolved(structured, product = {}) {
  const sub = String(structured?.product_identity?.subcategory ?? '').toLowerCase()
  if (sub && sub !== 'cookware') return

  const pcmRaw = String(structured?.primary_contact_material?.material_identity ?? '').trim()
  if (!pcmRaw || !KNOWN_COOKWARE_MATERIAL_TOKEN.test(pcmRaw)) return

  const mappings = structured?.canonical_mappings ?? {}
  const primary = mappings.primary_contact_material_id
  const substrate = mappings.substrate_material_id
  const name = product.product_name ?? 'product'

  if (isExpansionRequired(primary?.canonical_id)) {
    const normalized = normalizeCompoundMaterialRaw(pcmRaw)
    const compound = parseCompoundCookwareMaterial(pcmRaw)
    const resolvedPrimary = resolvePrimaryContactEntry(pcmRaw)?.canonical_id ?? 'null'
    throw new Error(
      `Agent 1 pre-save guard: primary_contact TAXONOMY_EXPANSION_REQUIRED for "${name}". raw=${pcmRaw} compound=${compound.isCompound} normalized=${normalized} resolvePrimaryContactEntry=${resolvedPrimary} path=mapCookwareTfalStyle→resolvePrimaryContactEntry`,
    )
  }

  if (isExpansionRequired(substrate?.canonical_id)) {
    const compound = parseCompoundCookwareMaterial(pcmRaw)
    const resolvedSubstrate = resolveSubstrateEntry(pcmRaw)?.canonical_id ?? 'null'
    throw new Error(
      `Agent 1 pre-save guard: substrate_material TAXONOMY_EXPANSION_REQUIRED for "${name}". raw=${pcmRaw} compound=${compound.isCompound} substrateFromCompound=${compound.substrateCanonicalId ?? 'null'} resolveSubstrateEntry=${resolvedSubstrate} path=mapCookwareTfalStyle→resolveSubstrateEntry`,
    )
  }

  if (isCompoundCookwareMaterialString(normalizeCompoundMaterialRaw(pcmRaw))) {
    const compound = parseCompoundCookwareMaterial(pcmRaw)
    if (!compound.primaryContactCanonicalId) {
      throw new Error(
        `Agent 1 pre-save guard: compound cookware material failed primary role extraction for "${name}". raw=${pcmRaw} path=compound-cookware-material.mjs`,
      )
    }
    if (!compound.substrateCanonicalId && /graphite|aluminum|aluminium|core|ply/.test(pcmRaw)) {
      throw new Error(
        `Agent 1 pre-save guard: compound cookware material failed substrate/core extraction for "${name}". raw=${pcmRaw} path=compound-cookware-material.mjs→pickSubstrateCanonicalId`,
      )
    }
  }

  if (detectHybridCookwareEvidenceSignals(structured, [])) {
    const primaryId = primary?.canonical_id ?? ''
    const coatingId = mappings.coating_modifier_id?.canonical_id ?? ''
    if (
      INERT_UNCOATED_PRIMARY_IDS.has(primaryId) &&
      UNCOATED_COATING_MODIFIER_IDS.has(coatingId)
    ) {
      throw new Error(
        `Agent 1 pre-save guard: hybrid/coated cookware evidence collapsed to inert stainless (${primaryId} + ${coatingId}) for "${name}". Map to hybrid_stainless_nonstick_food_contact or return TAXONOMY_EXPANSION_REQUIRED — never route coated hybrid pans down the inert-metal path.`,
      )
    }
  }
}
