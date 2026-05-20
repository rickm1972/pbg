/**
 * Post-model certification enforcement for Agent 1 evidence packets.
 * In-memory only: matches against page_excerpt + fact excerpts from the single API call.
 * No HTTP requests after the main research call.
 */

function normalizeForMatch(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\u2013|\u2014|–|—/g, '-')
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseCertificationList(factValue) {
  if (factValue == null) return []
  if (Array.isArray(factValue)) {
    return factValue.map((x) => String(x).trim()).filter(Boolean)
  }
  const s = String(factValue).trim()
  if (!s) return []
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean)
      }
    } catch {
      /* fall through */
    }
  }
  if (/^no third.party|^none found|^no .*certif/i.test(s)) return []
  return [s]
}

function isNegativeCertificationStatement(name) {
  return /^no third.party|^none found|^no .*certif/i.test(name.trim())
}

const CERT_ALIASES = [
  [/cradle\s*to\s*cradle|c2c\s*platinum/i, ['cradle to cradle', 'c2c', 'material health']],
  [/leaping\s*bunny/i, ['leaping bunny', 'cruelty-free', 'cruelty free']],
  [/b\s*corp/i, ['b corp', 'b corporation', 'certified b corporation']],
  [/epa\s*safer\s*choice/i, ['epa safer choice', 'safer choice']],
  [/usda\s*biopreferred|biopreferred/i, ['usda biopreferred', 'biopreferred']],
  [/made\s*safe/i, ['made safe', 'madesafe']],
  [/climate\s*neutral/i, ['climate neutral', 'climate label']],
]

/** @returns {'verified' | 'low_hazard' | null} */
function ewgClaimKind(certName) {
  const n = normalizeForMatch(certName)
  if (!/\bewg\b/.test(n)) return null
  if (/ewg\s*verified|ewg-verified/.test(n)) return 'verified'
  if (/ewg\s*low\s*hazard|low\s*hazard\s*rating/.test(n)) return 'low_hazard'
  return null
}

function pageContainsEwgVerified(pageText) {
  const page = normalizeForMatch(pageText)
  return /\bewg[\s-]*verified\b/.test(page) || page.includes('ewg verified®')
}

function pageContainsEwgLowHazard(pageText) {
  const page = normalizeForMatch(pageText)
  if (pageContainsEwgVerified(pageText) && !/\bewg\s*low\s*hazard\b/.test(page)) {
    return false
  }
  return (
    /\bewg\s*low\s*hazard\b/.test(page) ||
    (/\bguide to healthy cleaning\b/.test(page) && /\blow\s*hazard\b/.test(page))
  )
}

function matchEwgClaim(certName, pageText) {
  const kind = ewgClaimKind(certName)
  if (kind === 'verified') {
    return pageContainsEwgVerified(pageText)
  }
  if (kind === 'low_hazard') {
    return pageContainsEwgLowHazard(pageText)
  }
  return false
}

function matchAliases(certName, pageText) {
  if (ewgClaimKind(certName)) return false
  const page = normalizeForMatch(pageText)
  for (const [pattern, phrases] of CERT_ALIASES) {
    if (!pattern.test(certName)) continue
    if (phrases.some((p) => page.includes(normalizeForMatch(p)))) return true
  }
  return false
}

function isDeniedOrNegatedCertClaim(name, fact) {
  const combined = normalizeForMatch(`${name} ${fact?.fact_value ?? ''} ${fact?.excerpt ?? ''}`)
  if (/^found /.test(normalizeForMatch(fact?.fact_value))) return true
  if (
    /not confirmed|not .* for (this|powder|the) product|does not have|is not|isn't|not ewg verified|not the ewg verified|only for (laundry|dishwasher)|not for powder/i.test(
      combined,
    )
  ) {
    return true
  }
  if (ewgClaimKind(name) === 'verified' && /not ewg verified|not confirmed|low hazard only|rated product only/i.test(combined)) {
    return true
  }
  return false
}

/**
 * @param {string} certName
 * @param {string} pageText
 */
export function certificationAppearsInText(certName, pageText) {
  const page = normalizeForMatch(pageText)
  const full = normalizeForMatch(certName)
  if (!full || full.length < 3) return false

  const ewgKind = ewgClaimKind(certName)
  if (ewgKind) {
    return matchEwgClaim(certName, pageText)
  }

  if (page.includes(full)) return true

  const beforeParen = certName.split('(')[0]?.trim()
  if (beforeParen && beforeParen.length >= 4) {
    if (page.includes(normalizeForMatch(beforeParen))) return true
  }

  if (matchAliases(certName, pageText)) return true

  return false
}

function deriveCertNameFromAuxFact(fact) {
  const value = String(fact.fact_value ?? '').trim()
  if (!value || /^no |^not |^none /i.test(value)) return null
  if (fact.fact_key === 'certifications_cradle_to_cradle') {
    return 'Cradle to Cradle Platinum Material Health Certificate'
  }
  const fromKey = fact.fact_key
    .replace(/^certifications_/, '')
    .replace(/_/g, ' ')
    .trim()
  if (fromKey.length >= 3) {
    return value.length <= 120 ? value : fromKey
  }
  return value.length <= 120 ? value : null
}

export function collectCertificationClaims(facts) {
  /** @type {{ name: string, factIndex: number, sourceIndex: number|null, fromList: boolean, auxFact?: boolean }[]} */
  const claims = []

  facts.forEach((fact, factIndex) => {
    if (fact.fact_key === 'certifications_found') {
      const names = parseCertificationList(fact.fact_value)
      for (const name of names) {
        if (isNegativeCertificationStatement(name)) continue
        claims.push({
          name,
          factIndex,
          sourceIndex: fact.source_index ?? null,
          fromList: true,
        })
      }
      return
    }

    if (
      fact.fact_key.startsWith('certifications_') &&
      fact.fact_key !== 'certifications_found'
    ) {
      const name = deriveCertNameFromAuxFact(fact)
      if (name && !isDeniedOrNegatedCertClaim(name, fact)) {
        claims.push({
          name,
          factIndex,
          sourceIndex: fact.source_index ?? null,
          fromList: false,
          auxFact: true,
        })
      }
      return
    }

    if (
      fact.confidence === 'certification verified' &&
      fact.fact_type === 'certification' &&
      typeof fact.fact_value === 'string' &&
      fact.fact_value.trim() &&
      !/^no third.party|^none found/i.test(fact.fact_value)
    ) {
      const name = fact.fact_value.trim()
      if (!isDeniedOrNegatedCertClaim(name, fact)) {
        claims.push({
          name,
          factIndex,
          sourceIndex: fact.source_index ?? null,
          fromList: false,
        })
      }
    }
  })

  return claims
}

/**
 * Build searchable text per source index from page_excerpt + fact excerpts.
 * @param {{ page_excerpt?: string, title?: string, url?: string }[]} sources
 * @param {object[]} facts
 * @returns {string[]}
 */
export function buildSourceCorpusTexts(sources, facts) {
  const corpus = sources.map((source) => {
    const parts = []
    if (source.page_excerpt?.trim()) parts.push(source.page_excerpt.trim())
    if (source.title?.trim()) parts.push(source.title.trim())
    return parts.join('\n')
  })

  for (const fact of facts) {
    const idx = fact.source_index
    if (idx == null || idx < 0 || idx >= corpus.length) continue
    if (fact.excerpt?.trim()) {
      corpus[idx] = corpus[idx] ? `${corpus[idx]}\n${fact.excerpt.trim()}` : fact.excerpt.trim()
    }
  }

  return corpus
}

/**
 * @param {string} certName
 * @param {string[]} corpusTexts
 * @param {{ url: string }[]} sources
 * @returns {string|null} matched source url
 */
function findCertificationInCorpus(certName, corpusTexts, sources) {
  for (let i = 0; i < corpusTexts.length; i++) {
    const text = corpusTexts[i]
    if (!text?.trim()) continue
    if (certificationAppearsInText(certName, text)) {
      return sources[i]?.url ?? null
    }
  }
  return null
}

/** @typedef {{ certification_name: string, source_url: string|null, found_in_page_content: boolean, action_taken: string }} CertVerificationRow */

/**
 * @param {{ sources: object[], facts: object[], agent_metadata?: object }} packet
 */
export function enforceCertificationVerification(packet) {
  const sources = packet.sources ?? []
  const facts = [...(packet.facts ?? [])]
  const claims = collectCertificationClaims(facts)
  const corpusTexts = buildSourceCorpusTexts(sources, facts)

  /** @type {CertVerificationRow[]} */
  const certificationsVerified = []
  const verifiedNames = new Set()
  const removedNames = new Set()

  for (const claim of claims) {
    const citedUrl =
      claim.sourceIndex != null && sources[claim.sourceIndex]
        ? sources[claim.sourceIndex].url
        : null

    const citedText =
      claim.sourceIndex != null ? corpusTexts[claim.sourceIndex] ?? '' : ''
    const onCited = citedText && certificationAppearsInText(claim.name, citedText)
    const matchedUrl = onCited ? citedUrl : findCertificationInCorpus(claim.name, corpusTexts, sources)

    if (matchedUrl) {
      certificationsVerified.push({
        certification_name: claim.name,
        source_url: citedUrl ?? matchedUrl,
        found_in_page_content: true,
        action_taken:
          onCited || !citedUrl
            ? 'kept'
            : `kept — found in returned content for ${matchedUrl} (not on cited excerpt)`,
      })
      verifiedNames.add(claim.name)
    } else {
      certificationsVerified.push({
        certification_name: claim.name,
        source_url: citedUrl,
        found_in_page_content: false,
        action_taken:
          citedUrl == null
            ? 'removed_from_evidence — no source_index on claim'
            : 'removed_from_evidence — not found in returned page excerpts',
      })
      removedNames.add(claim.name)
    }
  }

  const updatedFacts = facts.map((fact, factIndex) => {
    const auxClaim = claims.find((c) => c.factIndex === factIndex && c.auxFact)
    if (auxClaim && removedNames.has(auxClaim.name)) {
      return {
        ...fact,
        fact_value: `Not verified in returned content (removed by server verification): ${String(fact.fact_value).slice(0, 200)}`,
        confidence: 'claim not independently verified',
        excerpt: `${fact.excerpt ?? ''} [Certification removed — not found in returned excerpts]`.trim(),
      }
    }

    if (fact.fact_key !== 'certifications_found') {
      if (
        fact.confidence === 'certification verified' &&
        removedNames.has(String(fact.fact_value).trim())
      ) {
        return {
          ...fact,
          confidence: 'claim not independently verified',
          excerpt: `${fact.excerpt ?? ''} [Certification removed by server verification — not found in returned excerpts]`.trim(),
        }
      }
      return fact
    }

    const claimIndices = claims
      .filter((c) => c.factIndex === factIndex && c.fromList)
      .map((c) => c.name)
    if (!claimIndices.length) return fact

    const kept = claimIndices.filter((name) => verifiedNames.has(name))
    const removed = claimIndices.filter((name) => removedNames.has(name))

    let fact_value
    if (kept.length === 0) {
      fact_value =
        removed.length > 0
          ? 'No third-party certifications verified in returned content (claims removed by server verification)'
          : fact.fact_value
    } else {
      fact_value = JSON.stringify(kept)
    }

    const confidence =
      kept.length > 0 && kept.length === claimIndices.length
        ? 'certification verified'
        : kept.length > 0
          ? 'manufacturer confirmed'
          : 'claim not independently verified'

    return {
      ...fact,
      fact_value,
      confidence,
      excerpt:
        removed.length > 0
          ? `${fact.excerpt ?? ''} [Server removed ${removed.length} certification(s) not found in returned excerpts]`.trim()
          : fact.excerpt,
    }
  })

  const removedCount = certificationsVerified.filter((r) => !r.found_in_page_content).length
  const warnings = [...(packet.agent_metadata?.warnings ?? [])]
  if (removedCount > 0) {
    warnings.push(
      `Server certification verification removed ${removedCount} claim(s) not found in returned excerpts (${sources.length} sources, in-memory only)`,
    )
  }

  return {
    sources,
    facts: updatedFacts,
    agent_metadata: {
      ...packet.agent_metadata,
      certifications_verified: certificationsVerified,
      warnings,
    },
    certifications_verified: certificationsVerified,
    removed_count: removedCount,
    verified_count: certificationsVerified.filter((r) => r.found_in_page_content).length,
  }
}

export function formatCertificationsVerified(certificationsVerified) {
  if (!certificationsVerified?.length) {
    return 'certifications_verified: (none)'
  }
  const lines = ['certifications_verified:']
  for (const row of certificationsVerified) {
    lines.push(`  - ${row.certification_name}`)
    lines.push(`      source_url: ${row.source_url ?? '(none)'}`)
    lines.push(`      found_in_page_content: ${row.found_in_page_content}`)
    lines.push(`      action_taken: ${row.action_taken}`)
  }
  return lines.join('\n')
}

/** Extract certification names from an evidence packet or facts array (post-enforcement list). */
export function extractCertificationNamesFromPacket(packetOrFacts) {
  const facts = Array.isArray(packetOrFacts) ? packetOrFacts : packetOrFacts?.facts ?? []
  const found = facts.find((f) => f.fact_key === 'certifications_found')
  if (!found) return []
  return parseCertificationList(found.fact_value).filter((n) => !isNegativeCertificationStatement(n))
}
