/**
 * Bridge structured schema → legacy facts[] for admin UI (schema v1 path).
 * Anti-hallucination: populated facts require source_url; no "source: n/a" excerpts.
 */

import { CONFIDENCE_TO_LEGACY } from './schema.mjs'

function legacyConfidence(label) {
  return CONFIDENCE_TO_LEGACY[label] ?? 'unknown'
}

function sourceIndex(urlIndex, sourceUrl) {
  if (sourceUrl && urlIndex.has(sourceUrl)) return urlIndex.get(sourceUrl)
  return null
}

function excerptForSource(sourceUrl, sources) {
  if (!sourceUrl) return null
  const match = sources.find((s) => s.url === sourceUrl)
  if (match?.page_excerpt) {
    const t = match.page_excerpt.trim()
    return t.length > 200 ? `${t.slice(0, 197)}…` : t
  }
  if (match?.title) return match.title
  return sourceUrl
}

/**
 * @param {import('./types.mjs').EvidenceFact[]} facts
 * @param {object} params
 */
function pushFact(facts, urlIndex, sources, params) {
  const { fact_key, fact_value, confidence, source_url, fact_type = 'material' } = params
  if (fact_value == null || fact_value === '') return
  if (!source_url) return

  facts.push({
    fact_type,
    fact_key,
    fact_value,
    confidence: legacyConfidence(confidence),
    source_index: sourceIndex(urlIndex, source_url),
    excerpt: excerptForSource(source_url, sources),
    source_url,
  })
}

/**
 * @param {import('./schema.mjs').StructuredEvidenceSchema} structured
 * @param {{ url: string }[]} sources
 */
export function bridgeLegacyFacts(structured, sources) {
  const facts = []
  const urlIndex = new Map(sources.map((s, i) => [s.url, i]))
  const amazon = structured.retailer_links?.amazon_url
  const mfr = structured.retailer_links?.manufacturer_direct_url

  const pcm = structured.primary_contact_material
  pushFact(facts, urlIndex, sources, {
    fact_key: 'primary_material',
    fact_value: pcm.undisclosed_code ?? pcm.material_identity,
    confidence: pcm.confidence_label,
    source_url: pcm.source_url,
  })
  pushFact(facts, urlIndex, sources, {
    fact_key: 'primary_contact_surface',
    fact_value: pcm.undisclosed_code ?? pcm.material_identity,
    confidence: pcm.confidence_label,
    source_url: pcm.source_url,
  })

  for (const c of structured.secondary_components ?? []) {
    const mat = c.material_identity ?? c.null_code ?? c.undisclosed_code
    if (!mat || !c.source_url) continue
    pushFact(facts, urlIndex, sources, {
      fact_key: `secondary_component_${c.component_role}`,
      fact_value: `${c.component_role}: ${mat}`,
      confidence: c.confidence_label,
      source_url: c.source_url,
    })
  }

  for (const c of structured.coatings_and_finishes ?? []) {
    if (!c.source_url) continue
    pushFact(facts, urlIndex, sources, {
      fact_key: `coating_${c.coating_type}`,
      fact_value: `${c.coating_name} (${c.coating_type})`,
      confidence: 'manufacturer_confirmed',
      source_url: c.source_url,
    })
  }

  const verified = structured.certifications?.verified_certifications ?? []
  if (verified.length > 0) {
    pushFact(facts, urlIndex, sources, {
      fact_key: 'verified_certifications',
      fact_value: verified
        .map((v) => {
          const url = v.source_url ?? v.registry_url
          return url ? `${v.cert_name} (${url})` : v.cert_name
        })
        .join('; '),
      confidence: 'certification verified',
      source_url: verified[0].source_url ?? verified[0].registry_url,
      fact_type: 'certification',
    })
  }

  const notVerified = structured.certifications?.claimed_but_not_verified ?? []
  if (notVerified.length > 0) {
    pushFact(facts, urlIndex, sources, {
      fact_key: 'claimed_but_not_verified',
      fact_value: JSON.stringify(
        notVerified.map((r) => ({
          cert_name: r.cert_name,
          registry_check_result: r.registry_check_result,
          claim_source_url: r.claim_source_url,
        })),
      ),
      confidence: 'claim not independently verified',
      source_url: notVerified[0].claim_source_url ?? amazon,
      fact_type: 'certification',
    })
  }

  const sc = structured.safety_claims
  const marketingParts = []
  if (sc.pfas_free_claim.claimed && sc.pfas_free_claim.source_url) {
    marketingParts.push('PFAS-Free')
    pushFact(facts, urlIndex, sources, {
      fact_key: 'safety_claim_pfas_free',
      fact_value: sc.pfas_free_claim.structural_guarantee
        ? 'PFAS-Free (structural guarantee)'
        : 'PFAS-Free',
      confidence: sc.pfas_free_claim.structural_guarantee
        ? 'manufacturer_confirmed'
        : 'retailer_confirmed',
      source_url: sc.pfas_free_claim.source_url,
      fact_type: 'claim',
    })
  }
  if (sc.bpa_free_claim.claimed && sc.bpa_free_claim.source_url) {
    marketingParts.push('BPA-free')
    pushFact(facts, urlIndex, sources, {
      fact_key: 'safety_claim_bpa_free',
      fact_value: 'BPA-free',
      confidence: 'retailer_confirmed',
      source_url: sc.bpa_free_claim.source_url,
      fact_type: 'claim',
    })
  }
  if (sc.non_toxic_claim.claimed && sc.non_toxic_claim.source_url) {
    marketingParts.push('Non-toxic')
    pushFact(facts, urlIndex, sources, {
      fact_key: 'safety_claim_non_toxic',
      fact_value: sc.non_toxic_claim.structural_guarantee
        ? 'Non-toxic (structural guarantee)'
        : 'Non-toxic',
      confidence: 'manufacturer_confirmed',
      source_url: sc.non_toxic_claim.source_url,
      fact_type: 'claim',
    })
  }
  if (marketingParts.length > 0) {
    pushFact(facts, urlIndex, sources, {
      fact_key: 'marketing_claims_found',
      fact_value: marketingParts.join('; '),
      confidence: 'retailer_confirmed',
      source_url:
        sc.pfas_free_claim.source_url ??
        sc.non_toxic_claim.source_url ??
        sc.bpa_free_claim.source_url,
      fact_type: 'claim',
    })
  }

  if (structured.ingredient_list?.ingredients?.length && structured.ingredient_list.source_url) {
    pushFact(facts, urlIndex, sources, {
      fact_key: 'ingredient_list',
      fact_value: structured.ingredient_list.ingredients.join(', '),
      confidence: 'fully_disclosed_by_manufacturer',
      source_url: structured.ingredient_list.source_url,
      fact_type: 'formulation',
    })
  }

  if (structured.product_use_case && amazon) {
    pushFact(facts, urlIndex, sources, {
      fact_key: 'product_use_case',
      fact_value: structured.product_use_case,
      confidence: 'retailer_confirmed',
      source_url: amazon,
      fact_type: 'usage',
    })
  }

  if (structured.care_and_use_instructions && (mfr || amazon)) {
    pushFact(facts, urlIndex, sources, {
      fact_key: 'care_and_use_instructions',
      fact_value: structured.care_and_use_instructions,
      confidence: 'manufacturer_confirmed',
      source_url: mfr ?? amazon,
      fact_type: 'usage',
    })
  }

  const gaps = []
  if (structured.primary_contact_material.undisclosed_code === 'UNKNOWN') {
    gaps.push('Primary contact material not fully identified.')
  }
  if (structured.conflict_and_review.class_action_history) {
    gaps.push('Class action history flagged.')
  }
  if (notVerified.length) {
    gaps.push(
      `${notVerified.length} certifying-body claim(s) not verified in retrieved page content.`,
    )
  }
  if (gaps.length) {
    facts.push({
      fact_type: 'gap',
      fact_key: 'information_gaps',
      fact_value: gaps.join(' '),
      confidence: 'unknown',
      source_index: null,
      excerpt: 'Pipeline flags only — not sourced from a URL.',
      source_url: null,
    })
  }

  return facts
}

/** certifications_verified rows for Agent 2 Layer 4A */
export function bridgeCertificationsVerified(structured) {
  return (structured.certifications.verified_certifications ?? []).map((v) => ({
    certification_name: v.cert_name,
    source_url: v.source_url ?? v.registry_url,
    found_in_page_content: true,
    action_taken: 'kept — registry verified',
  }))
}
