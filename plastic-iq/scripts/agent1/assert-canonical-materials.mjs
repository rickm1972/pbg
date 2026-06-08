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

const KNOWN_COOKWARE_MATERIAL_TOKEN =
  /stainless|cast_iron|carbon_steel|graphite|aluminum|aluminium|ptfe|teflon|ceramic_nonstick|sol_gel|glass|borosilicate|enameled/i

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
}
