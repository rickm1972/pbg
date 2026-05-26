/**
 * Split LLM claimed_certifications into certifying-body credentials vs marketing safety claims.
 * Marketing claims never enter certification verification — they route to safety_claims.
 */

const CERTIFYING_BODY_PATTERNS = [
  /\bmade\s*safe\b/i,
  /\bleaping\s*bunny\b/i,
  /\bewg\s*verified\b/i,
  /\bnsf\b/i,
  /\busda\s*organic\b/i,
  /\bgots\b/i,
  /\boeko[\s-]?tex\b/i,
  /\bbluesign\b/i,
  /\bgreen\s*guard\b/i,
  /\bcradle\s*to\s*cradle\b/i,
  /\bforest\s*stewardship\b/i,
  /\bfair\s*trade\s*certified\b/i,
  /\bnon[\s-]?gmo\s*project\b/i,
  /\bcertified\s*organic\b/i,
  /\bsafer\s*choice\b/i,
  /\bepa\s*safer\b/i,
]

/** Not issued by a certifying body — structural / marketing language only. */
const MARKETING_CLAIM_PATTERNS = [
  /\bpf[\s-]?as[\s-]?free\b/i,
  /\bpfoa[\s-]?free\b/i,
  /\bptfe[\s-]?free\b/i,
  /\bnon[\s-]?toxic\b/i,
  /\bbpa[\s-]?free\b/i,
  /\bphthalate[\s-]?free\b/i,
  /\blead[\s-]?free\b/i,
  /\bchemical[\s-]?free\b/i,
  /\bno\s+harsh\s+chemicals\b/i,
  /\bfood[\s-]?safe\b/i,
  /\bnon[\s-]?stick\b/i,
]

export function isCertifyingBodyCredential(name) {
  const s = String(name ?? '').trim()
  if (!s || isNegativeInventoryRow(s)) return false
  if (MARKETING_CLAIM_PATTERNS.some((p) => p.test(s))) return false
  return CERTIFYING_BODY_PATTERNS.some((p) => p.test(s))
}

export function isMarketingSafetyClaim(name) {
  const s = String(name ?? '').trim()
  if (!s) return false
  return MARKETING_CLAIM_PATTERNS.some((p) => p.test(s))
}

function isNegativeInventoryRow(name) {
  return /no third.party|not found|e\.g\.\s*,\s*made safe|none found/i.test(name)
}

function defaultSourceUrl(structured) {
  return (
    structured.retailer_links?.manufacturer_direct_url ??
    structured.retailer_links?.amazon_url ??
    null
  )
}

function applyMarketingClaim(safetyClaims, claimName, sourceUrl, primaryMaterialId) {
  const url = sourceUrl ?? null
  const isCastIron = /cast_iron/.test(primaryMaterialId ?? '')
  const isStainless = /stainless/.test(primaryMaterialId ?? '')
  const isGlass = /glass/.test(primaryMaterialId ?? '')

  const setClaim = (key, structural = false, basis = null) => {
    const field = safetyClaims[key]
    field.claimed = true
    if (url) field.source_url = url
    if (structural) {
      field.structural_guarantee = true
      field.structural_basis = basis
    }
  }

  if (/\bpf[\s-]?as[\s-]?free|\bpfoa[\s-]?free|\bptfe[\s-]?free/i.test(claimName)) {
    setClaim(
      'pfas_free_claim',
      isCastIron,
      isCastIron ? 'Cast iron contains no fluoropolymer coatings; PFAS-free is structurally guaranteed.' : null,
    )
  }
  if (/\bbpa[\s-]?free/i.test(claimName)) {
    setClaim(
      'bpa_free_claim',
      isGlass,
      isGlass ? 'Glass primary contact contains no bisphenols.' : null,
    )
  }
  if (/\bnon[\s-]?toxic/i.test(claimName)) {
    setClaim(
      'non_toxic_claim',
      isCastIron || isStainless,
      isCastIron
        ? 'Unseasoned cast iron is inert iron; non-toxic at food contact.'
        : isStainless
          ? 'Stainless steel food-contact surface is inert alloy.'
          : null,
    )
  }
  if (/\bphthalate[\s-]?free/i.test(claimName)) {
    setClaim('phthalate_free_claim')
  }
  if (/\blead[\s-]?free/i.test(claimName)) {
    setClaim('lead_free_claim')
  }
}

/**
 * @param {import('./schema.mjs').StructuredEvidenceSchema} structured
 * @param {{ url: string, page_excerpt?: string, title?: string }[]} sources
 */
export function partitionCertificationsAndSafetyClaims(structured, sources = []) {
  const claimed = [...(structured.certifications?.claimed_certifications ?? [])]
  const certBody = []
  const routedMarketing = []
  const primaryId =
    structured.primary_contact_material?.material_identity ??
    structured.primary_contact_material?.undisclosed_code ??
    ''

  for (const name of claimed) {
    if (!name || isNegativeInventoryRow(name)) continue
    if (isMarketingSafetyClaim(name) && !isCertifyingBodyCredential(name)) {
      const url =
        findMentionUrl(name, sources) ?? defaultSourceUrl(structured)
      applyMarketingClaim(structured.safety_claims, name, url, primaryId)
      routedMarketing.push(name)
    } else if (isCertifyingBodyCredential(name)) {
      certBody.push(name)
    } else {
      certBody.push(name)
    }
  }

  structured.certifications.claimed_certifications = certBody

  return {
    routed_marketing: routedMarketing,
    certifying_body_claimed: certBody,
  }
}

function findMentionUrl(needle, sources) {
  const n = String(needle).toLowerCase()
  for (const s of sources ?? []) {
    const blob = [s.page_excerpt, s.title, s.url].filter(Boolean).join('\n').toLowerCase()
    if (blob.includes(n.slice(0, Math.min(24, n.length)))) return s.url
  }
  return null
}
