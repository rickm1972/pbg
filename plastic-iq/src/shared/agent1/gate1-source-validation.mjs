/**
 * Agent 1 / Gate 1 source validation orchestration (global, not product-specific).
 */

import {
  requiresManufacturerMaterialEvidence,
  suggestManufacturerPdpSearchTargets,
  validateManufacturerPdpSet,
} from './manufacturer-pdp-validation.mjs'
import { analyzeLabResultRetrieval } from './lab-result-retrieval.mjs'
import { enforceFactSourceAuthority, isOutdatedThirdPartyPtfeContext, isThirdPartySource } from './source-authority.mjs'
import { resolveSourceTier } from '../canonical-taxonomy/confidence-label-consistency.mjs'
import { retailerVariantMismatchWarnings } from './retailer-variant-guard.mjs'
import { ACKNOWLEDGMENT_WARNING_CODES } from './approval-gating-contract.mjs'

const BLOCKER_CODES = {
  MANUFACTURER_PDP_NOT_VALIDATED: 'MANUFACTURER_PDP_NOT_VALIDATED',
  MANUFACTURER_MATERIAL_EVIDENCE_MISSING: 'MANUFACTURER_MATERIAL_EVIDENCE_MISSING',
  LAB_RESULTS_LINK_NOT_RETRIEVED: 'LAB_RESULTS_LINK_NOT_RETRIEVED',
  NO_THIRD_PARTY_TESTING_FOUND: 'NO_THIRD_PARTY_TESTING_FOUND',
}

/**
 * @param {object} structured
 * @param {object[]} sources
 * @param {{ product_name?: string, brand?: string }} product
 * @param {object[]} [facts]
 */
/**
 * @param {object} [options]
 * @param {object | null | undefined} [options.providedSourceIntake]
 */
export function applyAgent1SourceValidation(structured, sources, product, facts = [], options = {}) {
  const mappings = structured?.canonical_mappings ?? {}
  const pdp = validateManufacturerPdpSet(sources, product, structured)
  const lab = analyzeLabResultRetrieval(sources, structured)
  const needsMaterial = requiresManufacturerMaterialEvidence(mappings)

  const officialSources = (sources ?? []).filter((s) => !isThirdPartySource(s, s.url))
  const outdatedPtfeContext = (sources ?? []).filter((s) =>
    isOutdatedThirdPartyPtfeContext(s, product, officialSources),
  )

  /** @type {string[]} */
  const blockers = []
  /** @type {string[]} */
  const warnings = []

  if (needsMaterial && !pdp.has_validated_pdp) {
    if (pdp.any_identity_only) {
      warnings.push(
        `${BLOCKER_CODES.MANUFACTURER_PDP_NOT_VALIDATED}: Manufacturer source supports brand/identity only and does not validate product-specific material/coating evidence. Find the manufacturer product detail page or proceed with Documentation Incomplete after explicit human acknowledgment.`,
      )
    }
    blockers.push(
      `${BLOCKER_CODES.MANUFACTURER_MATERIAL_EVIDENCE_MISSING}: Manufacturer source does not validate product-specific material/coating/PFAS evidence. Retrieved source may be homepage, collection, wrong region, or identity-only.`,
    )
  }

  for (const v of pdp.manufacturer_sources) {
    if (v.region_mismatch) {
      warnings.push(`Manufacturer source region_mismatch: ${v.url}`)
    }
    if (v.url_kind === 'homepage') {
      warnings.push(`Manufacturer homepage used as evidence (not a product PDP): ${v.url}`)
    }
    if (v.url_kind === 'collection' && !v.supports_material_evidence) {
      warnings.push(`Manufacturer collection page without product-specific materials: ${v.url}`)
    }
  }

  if (lab.codes.includes('LAB_RESULTS_LINK_NOT_RETRIEVED')) {
    warnings.push(
      `${BLOCKER_CODES.LAB_RESULTS_LINK_NOT_RETRIEVED}: PFAS/PTFE-free claim references lab results but linked test report was not retrieved.`,
    )
  }
  if (lab.codes.includes('NO_THIRD_PARTY_TESTING_FOUND') && needsMaterial) {
    warnings.push(
      `${BLOCKER_CODES.NO_THIRD_PARTY_TESTING_FOUND}: No third-party lab/testing evidence retrieved after targeted search for coated product claims.`,
    )
  }

  for (const s of outdatedPtfeContext) {
    warnings.push(
      `Outdated/context third-party PTFE/PFOA language retained as context only (not current-SKU primary truth): ${s.url ?? s.title}`,
    )
  }

  for (const variantWarning of retailerVariantMismatchWarnings(sources, product)) {
    warnings.push(variantWarning)
  }

  const searchSuggestions = suggestManufacturerPdpSearchTargets(product, structured)

  structured.agent1_source_validation = {
    schema_version: '1.0',
    evaluated_at: new Date().toISOString(),
    manufacturer_pdp: pdp,
    lab_result_retrieval: lab,
    provided_source_intake: options.providedSourceIntake ?? null,
    outdated_third_party_ptfe_context_urls: outdatedPtfeContext.map((s) => s.url).filter(Boolean),
    blockers,
    warnings,
    search_suggestions: searchSuggestions,
  }

  return {
    blockers,
    warnings,
    facts: enforceFactSourceAuthority(sources, facts),
    search_suggestions: searchSuggestions,
  }
}

/**
 * @param {object | null | undefined} structured
 */
export function getAgent1SourceValidationBlockers(structured) {
  const fromValidation = structured?.agent1_source_validation?.blockers ?? []
  /** @type {string[]} */
  const out = []
  for (const b of fromValidation) {
    if (ACKNOWLEDGMENT_WARNING_CODES.has(String(b).split(':')[0]?.trim())) continue
    if (!out.includes(b)) out.push(b)
  }
  return out
}

/**
 * Score-driving blob must not treat third-party-only PTFE mentions as primary truth.
 * @param {string} blob
 * @param {object[]} sources
 */
export function scoreDrivingBlobExcludesOutdatedThirdPartyPtfe(blob, sources) {
  const thirdPartyPtfe = (sources ?? []).filter((s) => {
    if (!isThirdPartySource(s, s.url)) return false
    const text = `${s.page_excerpt ?? ''} ${s.title ?? ''}`
    return /\bptfe\b/i.test(text) && !/\bptfe[-\s]?free\b/i.test(text)
  })
  if (!thirdPartyPtfe.length) return blob

  const officialPtfeFree = (sources ?? []).some((s) => {
    if (isThirdPartySource(s, s.url)) return false
    const tier = resolveSourceTier(s, s.url)
    if (tier !== 'manufacturer' && tier !== 'amazon' && tier !== 'retailer') return false
    return /\bptfe[-\s]?free\b|\bpfas[-\s]?free\b/i.test(`${s.page_excerpt ?? ''} ${s.title ?? ''}`)
  })
  if (!officialPtfeFree) return blob

  let cleaned = blob
  for (const s of thirdPartyPtfe) {
    const excerpt = String(s.page_excerpt ?? '').trim()
    if (excerpt) cleaned = cleaned.replace(excerpt, '')
  }
  return cleaned
}

export { BLOCKER_CODES }
