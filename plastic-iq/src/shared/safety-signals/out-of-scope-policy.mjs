/**
 * Out-of-scope safety signals — not PAC score math, not Layer 4A PAC penalties.
 * Global for cookware and other categories (Prop 65 metals, heavy-metal allegations, etc.).
 */

const PROP_65_RE =
  /\bprop(?:osition)?\s*65\b|california\s+prop(?:osition)?\s*65\b|p65\s+warning\b/i
const HEAVY_METAL_RE =
  /\bheavy[-\s]?metal\b|\blead\s+safe\s+mama\b|\blsm\b.*lead\b|\btoxic\s+metals?\b/i
const PROP_65_METAL_RE =
  /\b(iron|chromium|manganese|phosphorus|nickel|cadmium|lead)\b.*\b(prop\s*65|p65|warning)\b|\b(prop\s*65|p65).*\b(iron|chromium|manganese|phosphorus)\b/i

/**
 * @param {string} text
 */
export function isOutOfScopeSafetySignalText(text) {
  const t = String(text ?? '').trim()
  if (!t) return false
  if (PROP_65_RE.test(t) || PROP_65_METAL_RE.test(t)) return true
  if (HEAVY_METAL_RE.test(t)) return true
  if (/\blead\s+safe\s+mama\b/i.test(t)) return true
  return false
}

/**
 * @param {string} text
 * @returns {'prop_65' | 'heavy_metals' | 'third_party_allegation' | 'other_non_pac'}
 */
export function categorizeOutOfScopeSignal(text) {
  const t = String(text ?? '')
  if (PROP_65_RE.test(t) || PROP_65_METAL_RE.test(t)) return 'prop_65'
  if (HEAVY_METAL_RE.test(t) || /\blead\s+safe\s+mama\b/i.test(t)) return 'heavy_metals'
  if (/third.party|review|blog|allegation/i.test(t)) return 'third_party_allegation'
  return 'other_non_pac'
}

/**
 * @param {string} text
 * @param {{ source_url?: string | null, source_quote?: string | null }} [meta]
 */
function buildSignal(text, meta = {}) {
  const summary = String(text).trim().slice(0, 500)
  return {
    signal_id: `oos_${categorizeOutOfScopeSignal(summary)}_${hashSnippet(summary)}`,
    category: categorizeOutOfScopeSignal(summary),
    summary,
    source_url: meta.source_url ?? null,
    source_quote: meta.source_quote ?? null,
    pac_score_relevant: false,
    display_label: 'Out-of-scope safety signal',
    scope_note:
      'Outside PAC Safety Score methodology (plastic-associated chemicals). Does not change PAC score or Layer 4A PAC penalties.',
  }
}

/**
 * @param {string} s
 */
function hashSnippet(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h.toString(36).slice(0, 8)
}

/**
 * @param {string[]} warnings
 * @param {object[]} existing
 */
function mergeSignals(warnings, existing = []) {
  const seen = new Set(existing.map((s) => s.summary))
  const out = [...existing]
  for (const w of warnings) {
    if (!isOutOfScopeSafetySignalText(w)) continue
    const summary = String(w).trim()
    if (seen.has(summary)) continue
    seen.add(summary)
    out.push(buildSignal(summary))
  }
  return out
}

/**
 * @param {object} structured
 */
export function derivePacHumanReviewRequired(structured) {
  const flags = structured?.conflict_and_review ?? {}
  if (flags.class_action_history) return true
  if ((flags.conflicting_evidence ?? []).length > 0) return true
  if (structured?.primary_contact_material?.undisclosed_code === 'PROPRIETARY_NAMED') return true
  return false
}

/**
 * Strip out-of-scope fragments from information_gaps fact text (PAC gaps only).
 * @param {string} gapText
 */
export function filterPacInformationGapsText(gapText) {
  const parts = String(gapText ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const kept = parts.filter((p) => !isOutOfScopeSafetySignalText(p))
  return kept.join(' ')
}

/**
 * @param {object[]} facts
 */
export function filterOutOfScopeFromFacts(facts) {
  return (facts ?? []).map((fact) => {
    if (fact.fact_key !== 'information_gaps') return fact
    const filtered = filterPacInformationGapsText(String(fact.fact_value ?? ''))
    if (!filtered.trim()) return null
    return { ...fact, fact_value: filtered }
  }).filter(Boolean)
}

/**
 * Mutates structured + agent_metadata. Call after canonical mapping / validation.
 * @param {object} structured
 * @param {{ warnings?: string[] }} [agentMetadata]
 * @param {object[]} [sources]
 */
export function applyOutOfScopeSafetySignalPolicy(structured, agentMetadata = {}, sources = []) {
  if (!structured || typeof structured !== 'object') return { signals: [], warnings: [] }

  const fromWarnings = agentMetadata.warnings ?? []
  const fromGaps = []
  for (const s of sources ?? []) {
    const blob = `${s.title ?? ''} ${s.page_excerpt ?? ''}`
    if (isOutOfScopeSafetySignalText(blob)) {
      fromGaps.push(
        buildSignal(blob.slice(0, 400), { source_url: s.url ?? null, source_quote: s.page_excerpt ?? null }),
      )
    }
  }

  let signals = mergeSignals(fromWarnings, structured.out_of_scope_safety_signals ?? [])
  for (const sig of fromGaps) {
    if (!signals.some((x) => x.summary === sig.summary)) signals.push(sig)
  }

  structured.out_of_scope_safety_signals = signals

  const pacWarnings = (fromWarnings ?? []).filter((w) => !isOutOfScopeSafetySignalText(w))
  if (agentMetadata && typeof agentMetadata === 'object') {
    agentMetadata.warnings = pacWarnings
  }

  if (structured.conflict_and_review) {
    structured.conflict_and_review.requires_human_review = derivePacHumanReviewRequired(structured)
  }

  return { signals, warnings: pacWarnings }
}
