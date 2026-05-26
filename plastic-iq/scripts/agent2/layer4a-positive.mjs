/**
 * V2.3.3 Layer 4A positive adjustments — exhaustive exact-match lookup only.
 */

export const LAYER_4A_POSITIVE_LOOKUP = [
  { exact_label: 'Independent lab testing confirming materials', points: 2 },
  { exact_label: 'NSF certified food safe', points: 2 },
  { exact_label: 'PFAS free independently verified', points: 2 },
  { exact_label: 'Phthalate free independently tested', points: 2 },
  { exact_label: 'OEKO-TEX Standard 100', points: 2 },
  { exact_label: 'GOTS certified organic textile', points: 2 },
  { exact_label: 'Made Safe certified', points: 2 },
  { exact_label: 'USDA organic certified material', points: 1 },
  { exact_label: 'Bluesign certified textile', points: 1 },
]

export const LAYER_4A_POSITIVE_MAX = 5

const INDEPENDENT_LAB_LABEL = 'Independent lab testing confirming materials'

const PERFORMANCE_ONLY_LAB_PATTERNS = [
  /performance/i,
  /efficacy/i,
  /effective at removing/i,
  /removing baked-on/i,
  /removing burnt-on/i,
  /perform on dish/i,
  /performs on dish/i,
  /comparison to major/i,
  /vs\.? major liquid/i,
  /cleaning efficacy/i,
  /grease.?cutting/i,
  /stain removal/i,
]

const SAFETY_ONLY_LAB_PATTERNS = [
  /hypoallergenic/i,
  /non-irritating/i,
  /non-sensitizing/i,
  /sensitization/i,
  /skin patch/i,
  /dermatolog/i,
  /irritation study/i,
  /clinical test/i,
]

function inferTestingScope(certificationFound) {
  const s = String(certificationFound ?? '').toLowerCase()
  const mentionsLab =
    /third.party|independent.*lab|independent.*test|lab test|laboratory/i.test(s)
  if (!mentionsLab && !/hypoallergenic.*lab|clinically tested/i.test(s)) {
    return 'certification_program'
  }
  if (PERFORMANCE_ONLY_LAB_PATTERNS.some((p) => p.test(s))) return 'performance_only'
  if (SAFETY_ONLY_LAB_PATTERNS.some((p) => p.test(s))) return 'safety_claims_only'
  if (
    /material composition|confirms materials|confirming materials|chemistry|ingredient identity|material identity|what.*made of/i.test(
      s,
    )
  ) {
    return 'material_composition'
  }
  if (mentionsLab) return 'performance_only'
  return 'not_applicable'
}

const LABEL_BY_NORMALIZED = new Map(
  LAYER_4A_POSITIVE_LOOKUP.map((row) => [normalizeLabel(row.exact_label), row]),
)

function normalizeLabel(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function lookupLayer4aPositive(exactListMatch) {
  const key = normalizeLabel(exactListMatch)
  return LABEL_BY_NORMALIZED.get(key) ?? null
}

/**
 * Enforce positive Layer 4A from layer_4a_positive_reasoning.
 * Rebuilds positive_adjustments and updates net_adjustment (preserves negatives).
 */
export function enforceLayer4aPositive(inputs) {
  const layer4a = inputs.layer_4a ?? {}
  const reasoning = Array.isArray(inputs.layer_4a_positive_reasoning)
    ? inputs.layer_4a_positive_reasoning
    : []

  const enforcedReasoning = []
  const positiveAdjustments = []
  let positiveSum = 0

  for (const entry of reasoning) {
    const found = normalizeLabel(entry.certification_found ?? entry.certification ?? '')
    const claimedMatch = normalizeLabel(
      entry.exact_list_match ?? entry.matched_label ?? '',
    )
    const lookup = lookupLayer4aPositive(claimedMatch)
    let matched = Boolean(lookup) && claimedMatch.length > 0
    const testingScope =
      entry.testing_scope && entry.testing_scope !== 'not_applicable'
        ? entry.testing_scope
        : inferTestingScope(found)

    if (
      matched &&
      lookup.exact_label === INDEPENDENT_LAB_LABEL &&
      testingScope !== 'material_composition'
    ) {
      matched = false
    }

    const awarded = matched ? lookup.points : 0

    enforcedReasoning.push({
      certification_found: found || '(none)',
      testing_scope: testingScope,
      exact_list_match: claimedMatch || '',
      matched,
      awarded_value: awarded,
      ...(matched ? { matched_canonical_label: lookup.exact_label } : {}),
      ...(!matched &&
      lookup?.exact_label === INDEPENDENT_LAB_LABEL &&
      testingScope !== 'material_composition'
        ? {
            rejection_reason: `Lab testing is ${testingScope}; does not confirm material composition`,
          }
        : {}),
    })

    if (matched && awarded > 0) {
      const canonical = lookup.exact_label
      if (positiveAdjustments.some((adj) => adj.reason === canonical)) {
        enforcedReasoning[enforcedReasoning.length - 1].dedupe_note =
          'skipped duplicate — same adjustment type already applied'
        continue
      }
      const remaining = LAYER_4A_POSITIVE_MAX - positiveSum
      const applied = Math.min(awarded, remaining)
      if (applied > 0) {
        positiveAdjustments.push({
          reason: canonical,
          value: applied,
        })
        positiveSum += applied
      }
    }
  }

  const negatives = Array.isArray(layer4a.negative_adjustments)
    ? layer4a.negative_adjustments
    : []
  const negativeSum = negatives.reduce((sum, adj) => {
    const v = typeof adj === 'object' ? Number(adj.value ?? adj.points ?? 0) : 0
    return sum + (Number.isFinite(v) ? v : 0)
  }, 0)

  inputs.layer_4a_positive_reasoning = enforcedReasoning
  inputs.layer_4a = {
    ...layer4a,
    positive_adjustments: positiveAdjustments,
    negative_adjustments: negatives,
    net_adjustment: Math.max(-5, Math.min(5, positiveSum + negativeSum)),
  }

  return inputs
}

export function formatLayer4aPositiveReasoning(reasoning) {
  if (!reasoning?.length) return ['  (no certifications listed)']
  return reasoning.map((r) => {
    const status = r.matched ? 'MATCH' : 'NO MATCH'
    const scope = r.testing_scope ? ` [${r.testing_scope}]` : ''
    const reject = r.rejection_reason ? ` — ${r.rejection_reason}` : ''
    return `  · ${r.certification_found}${scope} → list: "${r.exact_list_match || '—'}" [${status}] → ${r.awarded_value}${reject}`
  })
}
