/**
 * Check 5 — Explanation accuracy (no NPR leaks, correct primary material).
 */
import {
  consumerComponentLabel,
  consumerPrimaryMaterialLabel,
} from '../../agent3/explanation-labels.mjs'

const NPR_LEAK_PATTERNS = [
  /\bNPR\b/i,
  /normalized plastic risk/i,
  /\bLayer 4\b/i,
  /contact intimacy/i,
  /\bCI\s*[=:]/i,
  /weighted\s*NPR/i,
  /highest-NPR/i,
  /final_npr/i,
  /material_hazard/i,
]

const NPR_DECIMAL_IN_PARENS = /\(\s*NPR\s+[\d.]+\s*\)/i
const SUSPICIOUS_DECIMAL = /\(\s*[\d.]{3,}\s*\)/

function pickHighestRiskComponent(componentResults) {
  if (!componentResults?.length) return null
  return componentResults.reduce((best, c) => {
    const contrib = Number(c.final_npr) * Number(c.contact_intimacy)
    const bestContrib = best ? Number(best.final_npr) * Number(best.contact_intimacy) : -1
    return contrib > bestContrib ? c : best
  }, null)
}

function pickDominantSafeComponent(componentResults) {
  if (!componentResults?.length) return null
  return componentResults.reduce((best, c) => {
    const safe = Number(c.final_npr) < 0.25
    if (!safe) return best
    const ci = Number(c.contact_intimacy)
    const bestCi = best ? Number(best.contact_intimacy) : -1
    return ci > bestCi ? c : best
  }, null)
}

function materialFamilyTokens(text) {
  const t = String(text ?? '').toLowerCase()
  const families = []
  if (/cast iron/.test(t)) families.push('cast iron')
  if (/glass/.test(t)) families.push('glass')
  if (/stainless/.test(t)) families.push('stainless')
  if (/soap|saponified|coconut oil.*soap/.test(t)) families.push('soap')
  if (/nylon/.test(t)) families.push('nylon')
  if (/ptfe|teflon/.test(t)) families.push('ptfe')
  if (/tritan|plastic/.test(t)) families.push('plastic')
  if (/ceramic|terrabond|thermolon/.test(t)) families.push('ceramic')
  if (/silicone/.test(t)) families.push('silicone')
  return families
}

function familiesOverlap(a, b) {
  return a.some((f) => b.includes(f))
}

function extractPrimarilyPhrase(draft) {
  const m = draft.match(/primarily\s+([^.;]+)/i)
  return m?.[1]?.trim() ?? null
}

/**
 * @param {object} score — product_scores row
 * @param {object} inputs
 */
export function runExplanationAccuracy(score, inputs) {
  const draft = String(score.explanation_draft ?? '')
  const flags = []
  const issues = []

  if (!draft.trim()) {
    return {
      status: 'flag',
      flags: [{ code: 'EXPLANATION_MISSING', message: 'explanation_draft is empty' }],
      issues: ['missing draft'],
    }
  }

  for (const pattern of NPR_LEAK_PATTERNS) {
    if (pattern.test(draft)) {
      flags.push({
        code: 'EXPLANATION_NPR_LEAK',
        message: `Explanation contains internal algorithm term matching ${pattern}`,
      })
      issues.push('npr or internal term')
      break
    }
  }

  if (NPR_DECIMAL_IN_PARENS.test(draft) || (/\bNPR\b/i.test(draft) && SUSPICIOUS_DECIMAL.test(draft))) {
    if (!flags.some((f) => f.code === 'EXPLANATION_NPR_LEAK')) {
      flags.push({
        code: 'EXPLANATION_NPR_LEAK',
        message: 'Explanation contains NPR numeric values in parentheses',
      })
      issues.push('npr numeric')
    }
  }

  const componentResults = score.component_nprs?.components ?? []
  const highest = pickHighestRiskComponent(componentResults)
  const highestLabel = consumerComponentLabel(highest)

  if (/highest-NPR|single highest/i.test(draft)) {
    flags.push({
      code: 'EXPLANATION_HIGHEST_NPR_COMPONENT',
      message: 'Explanation references highest-NPR component wording',
    })
    issues.push('highest-npr wording')
  }

  const mainConcernMatch = draft.match(/main concern is ([^,]+),/i)
  if (mainConcernMatch && highestLabel) {
    const mentioned = mainConcernMatch[1].trim().toLowerCase()
    const expected = highestLabel.toLowerCase()
    if (
      mentioned &&
      expected &&
      !mentioned.includes(expected.slice(4, 40)) &&
      !expected.includes(mentioned.slice(0, 20))
    ) {
      const mentionedFamilies = materialFamilyTokens(mentioned)
      const expectedFamilies = materialFamilyTokens(expected)
      if (!familiesOverlap(mentionedFamilies, expectedFamilies)) {
        flags.push({
          code: 'EXPLANATION_WRONG_PRIMARY_MATERIAL',
          message: `Main concern text "${mainConcernMatch[1].trim()}" does not match dominant risk component (${highestLabel})`,
          context: { expected: highestLabel, mentioned: mainConcernMatch[1].trim() },
        })
        issues.push('wrong main concern')
      }
    }
  }

  const primarily = extractPrimarilyPhrase(draft)
  if (primarily && Number(score.pac_safety_score) >= 90) {
    const safeComponent = pickDominantSafeComponent(componentResults)
    const expectedMaterial = consumerPrimaryMaterialLabel(safeComponent)
    const primarilyFamilies = materialFamilyTokens(primarily)
    const expectedFamilies = materialFamilyTokens(expectedMaterial)
    if (
      primarilyFamilies.length &&
      expectedFamilies.length &&
      !familiesOverlap(primarilyFamilies, expectedFamilies)
    ) {
      flags.push({
        code: 'EXPLANATION_WRONG_PRIMARY_MATERIAL',
        message: `"primarily ${primarily}" does not align with dominant safe material (${expectedMaterial})`,
        context: { primarily, expectedMaterial },
      })
      issues.push('wrong primarily')
    }
  }

  return {
    status: flags.length ? 'flag' : 'pass',
    flags,
    issues,
  }
}
