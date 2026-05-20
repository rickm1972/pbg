/**
 * Check 1 — Certification audit (excerpt match + product-level scope).
 */
import {
  buildSourceCorpusTexts,
  certificationAppearsInText,
  collectCertificationClaims,
} from '../../agent1/certification-verify.mjs'

const COMPANY_LEVEL_URL_PATTERNS = [
  /\/about\/?$/i,
  /\/about-us\/?$/i,
  /\/sustainability\/?$/i,
  /\/our-story\/?$/i,
  /\/pages\/chemical-disclosure/i,
  /\/pages\/transparency/i,
  /\/corporate\//i,
  /\/company\//i,
]

const COMPANY_LEVEL_EXCERPT_PATTERNS = [
  /all our products/i,
  /all of our products/i,
  /every product we make/i,
  /company is certified/i,
  /brand[- ]wide/i,
  /across our (entire )?line/i,
  /our entire (product )?line/i,
  /company-level certification/i,
]

function normalizeUrl(url) {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/\/$/, '') || '/'
    return `${u.hostname}${path}`.toLowerCase()
  } catch {
    return String(url ?? '').toLowerCase()
  }
}

function isCompanyLevelSource(url, excerpt) {
  if (!url) return false
  const path = normalizeUrl(url)
  if (COMPANY_LEVEL_URL_PATTERNS.some((p) => p.test(path))) return true
  if (/\/products?\//i.test(path) || /\/dp\//i.test(path) || /\/p\//i.test(path)) {
    return false
  }
  const depth = path.split('/').filter(Boolean).length
  if (depth <= 1 && !/\/product/i.test(path)) return true
  const text = String(excerpt ?? '')
  return COMPANY_LEVEL_EXCERPT_PATTERNS.some((p) => p.test(text))
}

function isNegativeCertStatement(name) {
  return /^no third.party|^none found|^no .*certif|^not listed/i.test(String(name).trim())
}

/**
 * @param {{ sources: object[], facts: object[] }} evidence
 */
export function runCertificationAudit(evidence) {
  const sources = evidence.sources ?? []
  const facts = evidence.facts ?? []
  const claims = collectCertificationClaims(facts)
  const corpusTexts = buildSourceCorpusTexts(sources, facts)

  const flags = []
  const verifiedPasses = []
  let auditedClaimCount = 0

  for (const claim of claims) {
    auditedClaimCount++
    const name = claim.name

    if (isNegativeCertStatement(name)) {
      flags.push({
        code: 'CERT_NEGATIVE_ASSERTION',
        certification_name: name,
        message: 'Negative or “none listed” certification statement (informational)',
        severity: 'info',
      })
      continue
    }

    const sourceIndex = claim.sourceIndex
    const citedSource = sourceIndex != null ? sources[sourceIndex] : null
    const citedUrl = citedSource?.url ?? null
    const citedText = sourceIndex != null ? corpusTexts[sourceIndex] ?? '' : ''
    const fact = facts[claim.factIndex]
    const excerpt = fact?.excerpt ?? citedText

    const onCited = citedText && certificationAppearsInText(name, citedText)
    let foundInPage = onCited
    let matchedUrl = citedUrl

    if (!foundInPage) {
      for (let i = 0; i < corpusTexts.length; i++) {
        if (certificationAppearsInText(name, corpusTexts[i] ?? '')) {
          foundInPage = true
          matchedUrl = sources[i]?.url ?? matchedUrl
          break
        }
      }
    }

    if (!foundInPage) {
      flags.push({
        code: 'CERT_NOT_IN_EXCERPT',
        certification_name: name,
        source_url: citedUrl,
        message: 'Claimed certification not found in cited source excerpt or returned page text',
        severity: 'critical',
      })
      continue
    }

    const productLevel = !isCompanyLevelSource(matchedUrl ?? citedUrl, excerpt)
    if (!productLevel) {
      flags.push({
        code: 'CERT_COMPANY_LEVEL_ONLY',
        certification_name: name,
        source_url: matchedUrl ?? citedUrl,
        message: 'Certification appears company- or brand-wide, not stated for this specific product',
        severity: 'critical',
      })
      continue
    }

    verifiedPasses.push({
      certification_name: name,
      source_url: matchedUrl ?? citedUrl,
      source_index: sourceIndex,
      found_in_page_content: true,
      product_level: true,
      action_taken: 'pass',
      flags: [],
    })
  }

  const criticalFlags = flags.filter((f) => f.severity !== 'info')
  const status = criticalFlags.length > 0 ? 'flag' : 'pass'

  return {
    status,
    flags,
    certifications_verified: verifiedPasses,
    audited_claim_count: auditedClaimCount,
  }
}
