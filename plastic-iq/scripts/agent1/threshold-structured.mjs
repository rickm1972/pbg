import { isUndisclosedMaterialId } from './schema.mjs'

/**
 * @param {import('./schema.mjs').StructuredEvidenceSchema} structured
 * @param {{ url: string }[]} sources
 */
export function evaluateStructuredThreshold(structured, sources) {
  if (!structured?.primary_contact_material) {
    return {
      met: false,
      checks: { structured_evidence_present: false },
      failures: ['structured_evidence_missing'],
    }
  }

  const pcm = structured.primary_contact_material
  const hasPrimary =
    Boolean(pcm.material_identity) &&
    (!isUndisclosedMaterialId(pcm.material_identity) || Boolean(pcm.undisclosed_code))

  const hasPrimarySource =
    Boolean(pcm.source_url) ||
    ['PROPRIETARY_NAMED', 'UNKNOWN', 'CONFLICTING'].includes(pcm.undisclosed_code ?? '')

  const hasUseCase = Boolean(structured.product_use_case?.trim())
  const hasAmazon = Boolean(structured.retailer_links?.amazon_url)
  const hasMfr = Boolean(structured.retailer_links?.manufacturer_direct_url)

  const checks = {
    primary_contact_populated: hasPrimary,
    primary_contact_source_or_code: hasPrimarySource,
    product_use_case_assigned: hasUseCase,
    amazon_url_recorded: hasAmazon,
    manufacturer_url_recorded: hasMfr,
    sources_non_empty: sources.length > 0,
  }

  const failures = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k)

  return { met: failures.length === 0, checks, failures }
}
