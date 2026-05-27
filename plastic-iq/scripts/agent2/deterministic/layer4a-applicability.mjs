/**
 * Layer 4A — explicit applicability rules only (no LLM, no fuzzy matching).
 * Positive credits: certifications_verified ONLY, exact list match, deduped by adjustment type.
 */

import { LAYER_4A_POSITIVE_MAX, lookupLayer4aPositive } from '../layer4a-positive.mjs'
import { isUnknownFoodContactCoatingMaterial } from './material-taxonomy.mjs'
import { factByKey, factValue } from './evidence-facts.mjs'
import {
  safetyClaimContradictsMaterials,
  isStructuralSafetyClaimValid,
} from '../safety-claim-contradiction.mjs'
import {
  getConflictReview,
  getSafetyClaims,
  tokensFromStructuredVerifiedCerts,
} from './schema-input.mjs'

const NEG_BPA_ONLY = {
  reason: 'BPA-free claim only, no BPS/BPF testing',
  value: -1,
}
const NEG_UNKNOWN_COATING = {
  reason: 'Unknown proprietary food-contact coating',
  value: -3,
}
const NEG_MARKETING = {
  reason: 'Marketing language only, no verifiable claims',
  value: -2,
}
const NEG_TEXTILE_DYE = {
  reason: 'Undisclosed dye chemistry in textiles',
  value: -1,
}

/**
 * Tokens from agent_metadata.certifications_verified only (never certifications_found fact).
 * @param {object} evidence
 */
export function tokensFromCertificationsVerified(evidence) {
  const rows = evidence?.agent_metadata?.certifications_verified ?? []
  const tokens = []
  for (const row of rows) {
    if (!/verified|kept|confirmed|valid/i.test(String(row.action_taken ?? ''))) continue
    if (isNegativeVerifiedRow(row)) continue
    const raw = String(row.certification_name ?? '').trim()
    if (!raw) continue
    for (const part of raw.split(/[;,]/)) {
      const text = part.trim()
      if (text && !isNegativeCertToken(text)) tokens.push({ text, source_row: row })
    }
  }
  return tokens
}

/** Entire certifications_verified row is a negative inventory (not an awarded cert). */
function isNegativeVerifiedRow(row) {
  const name = String(row?.certification_name ?? '')
  return (
    /no third.party|not found in retrieved|none found in retrieved|e\.g\.\s*,\s*made safe|certifications\s*\(e\.g\./i.test(
      name,
    ) || (/e\.g\./i.test(name) && /not found|none found/i.test(name))
  )
}

/** Token-level negative (split fragment from inventory prose). */
function isNegativeCertToken(text) {
  const t = String(text ?? '')
  return (
    /no third.party|not found|none found|not retrieved|absent in/i.test(t) ||
    (/^made\s*safe\b/i.test(t) && /,\s*nsf|leaping bunny\)\s*found/i.test(t))
  )
}

/**
 * Map a single verified certification token to Layer 4A positive lookup (exact only).
 * @param {string} tokenText
 */
export function matchVerifiedTokenToPositive(tokenText) {
  const t = String(tokenText ?? '').trim()
  if (!t || isNegativeCertToken(t)) return null

  if (/\bmade\s*safe\b/i.test(t)) {
    return lookupLayer4aPositive('Made Safe certified')
  }
  if (/\bnsf\b/i.test(t) && /food safe/i.test(t)) {
    return lookupLayer4aPositive('NSF certified food safe')
  }
  if (/pfas\s*free.*independent|independent.*pfas/i.test(t)) {
    return lookupLayer4aPositive('PFAS free independently verified')
  }
  if (/phthalate\s*free.*independent|independent.*phthalate/i.test(t)) {
    return lookupLayer4aPositive('Phthalate free independently tested')
  }
  if (/^oeko-tex\s*standard\s*100$/i.test(t)) {
    return lookupLayer4aPositive('OEKO-TEX Standard 100')
  }
  if (/^gots\b/i.test(t)) {
    return lookupLayer4aPositive('GOTS certified organic textile')
  }
  if (/^usda\s*organic/i.test(t)) {
    return lookupLayer4aPositive('USDA organic certified material')
  }
  if (/^bluesign/i.test(t)) {
    return lookupLayer4aPositive('Bluesign certified textile')
  }

  return null
}

/**
 * Build deduplicated positive adjustments from certifications_verified only.
 * @param {object} evidence
 */
export function buildLayer4aPositives(evidence) {
  const structuredTokens = tokensFromStructuredVerifiedCerts(evidence)
  const tokens = structuredTokens ?? tokensFromCertificationsVerified(evidence)
  const positive_reasoning = []
  const positive_adjustments = []
  const seenCanonical = new Set()
  let positiveSum = 0

  for (const { text } of tokens) {
    const lookup = matchVerifiedTokenToPositive(text)
    const exact = lookup?.exact_label ?? ''
    const matched = Boolean(lookup && exact)

    positive_reasoning.push({
      certification_found: text,
      testing_scope: 'certification_program',
      exact_list_match: exact,
      matched,
      awarded_value: matched ? lookup.points : 0,
      ...(matched ? { matched_canonical_label: exact } : {}),
      source: 'certifications_verified',
    })

    if (!matched || !exact || seenCanonical.has(exact)) continue
    const remaining = LAYER_4A_POSITIVE_MAX - positiveSum
    const applied = Math.min(lookup.points, remaining)
    if (applied <= 0) continue

    seenCanonical.add(exact)
    positive_adjustments.push({ reason: exact, value: applied })
    positiveSum += applied
  }

  if (!positive_reasoning.length) {
    positive_reasoning.push({
      certification_found: '(none in certifications_verified)',
      testing_scope: 'certification_program',
      exact_list_match: '',
      matched: false,
      awarded_value: 0,
      source: 'certifications_verified',
    })
  }

  return { positive_reasoning, positive_adjustments, positiveSum }
}

function appliesBpaFreeOnlyNegative(evidence, components) {
  const marketing = factValue(evidence, 'marketing_claims_found').toLowerCase()
  const claimsBpaFree = /\bbpa[- ]?free\b/i.test(marketing)
  if (!claimsBpaFree) return false
  const hasBpsBpfTest = /bps|bpf|bisphenol s|bisphenol f/i.test(
    `${marketing} ${factValue(evidence, 'certifications_found')}`,
  )
  if (hasBpsBpfTest) return false
  const allDisclosed = components.every((c) =>
    /fully disclosed|manufacturer confirmed|retailer confirmed|certification verified/i.test(
      c.data_confidence,
    ),
  )
  if (allDisclosed && !/plastic|resin unspecified/i.test(components.map((c) => c.material).join(' '))) {
    return false
  }
  return true
}

function appliesUnknownCoatingNegative(components) {
  return components.some(
    (c) =>
      (c.role === 'primary_food_contact' || c.role === 'coating') &&
      isUnknownFoodContactCoatingMaterial(c.material_id),
  )
}

function appliesMarketingLanguageNegative(evidence, components, unknownCoating) {
  if (unknownCoating) return true

  const safety = getSafetyClaims(evidence)
  if (safety) {
    const claimedPfasFree = Boolean(safety.pfas_free_claim?.claimed)
    const claimedBpaFree = Boolean(safety.bpa_free_claim?.claimed)
    const claimedNonToxic = Boolean(safety.non_toxic_claim?.claimed)
    const claimed = claimedPfasFree || claimedBpaFree || claimedNonToxic
    if (!claimed) return false

    const contradiction = safetyClaimContradictsMaterials(evidence, components)
    if (contradiction) return true

    if (isStructuralSafetyClaimValid(evidence, components)) {
      return false
    }

    return true
  }

  const marketing = factValue(evidence, 'marketing_claims_found').toLowerCase()
  const hasSafetyClaims = /pfas.free|non.toxic|non-toxic|pfoa.free|ptfe.free|safe for/i.test(marketing)
  if (!hasSafetyClaims) return false
  const structurallyVerified = components
    .filter((c) => c.role === 'primary_food_contact' || c.role === 'formulation')
    .every((c) =>
      /fully disclosed|manufacturer confirmed|cast_iron|glass|stainless/i.test(
        `${c.data_confidence} ${c.material_id} ${c.material}`,
      ),
    )
  return hasSafetyClaims && !structurallyVerified
}

function appliesTextileDyeNegative(category, evidence) {
  if (category !== 'textiles') return false
  const finishing = factValue(evidence, 'finishing_treatments').toLowerCase()
  const gaps = factValue(evidence, 'information_gaps').toLowerCase()
  return (
    /dye|color treatment|pigment/i.test(finishing) &&
    /dye chemistry|dye not documented|undisclosed dye/i.test(gaps + finishing)
  )
}

/**
 * @param {object} evidence
 * @param {object[]} components
 * @param {string} category
 */
export function buildLayer4a(evidence, components, category) {
  const { positive_reasoning, positive_adjustments, positiveSum } =
    buildLayer4aPositives(evidence)

  const negative_candidates = []
  if (appliesBpaFreeOnlyNegative(evidence, components)) {
    negative_candidates.push(NEG_BPA_ONLY)
  }
  const unknownCoating = appliesUnknownCoatingNegative(components)
  if (unknownCoating) {
    negative_candidates.push(NEG_UNKNOWN_COATING)
  }
  if (appliesMarketingLanguageNegative(evidence, components, unknownCoating)) {
    negative_candidates.push(NEG_MARKETING)
  }
  if (appliesTextileDyeNegative(category, evidence)) {
    negative_candidates.push(NEG_TEXTILE_DYE)
  }

  const negativeSum = negative_candidates.reduce((s, n) => s + n.value, 0)

  return {
    layer_4a_positive_reasoning: positive_reasoning,
    layer_4a: {
      positive_adjustments,
      negative_adjustments: negative_candidates,
      net_adjustment: Math.max(-5, Math.min(5, positiveSum + negativeSum)),
      unknown_coating_cap_applies: unknownCoating,
    },
  }
}

export function requiresHumanReview(evidence, components, category) {
  const conflict = getConflictReview(evidence)
  if (conflict?.requires_human_review) {
    return {
      human_review_required: true,
      human_review_reason:
        conflict.class_action_history
          ? 'Class action history flagged in structured evidence.'
          : 'Structured conflict_and_review.requires_human_review is true.',
    }
  }

  const gaps = factValue(evidence, 'information_gaps').toLowerCase()
  const reasons = []
  if (/class action|lawsuit/i.test(gaps)) {
    reasons.push('Class action or materials litigation noted in evidence gaps.')
  }
  if (components.some((c) => isUnknownFoodContactCoatingMaterial(c.material_id))) {
    if (/conflicting|third.party.*ptfe|cannot be resolved/i.test(gaps)) {
      reasons.push('Conflicting PTFE/PFAS claims with undisclosed TerraBond chemistry.')
    }
  }
  const hist = factByKey(evidence, 'ptfe_status_historical')
  if (hist && /prior.*ptfe|used ptfe/i.test(String(hist.fact_value ?? ''))) {
    reasons.push('Historical PTFE formulation noted; current SKU chemistry requires human review.')
  }
  return {
    human_review_required: reasons.length > 0,
    human_review_reason: reasons.length ? reasons.join(' ') : null,
  }
}
