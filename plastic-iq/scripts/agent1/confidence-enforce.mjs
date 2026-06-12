/**
 * Server-side confidence + excerpt policy (post-synthesis, pre-save).
 */

import {
  enforceFactSourceAuthority,
  isThirdPartySource,
} from '../../src/shared/agent1/source-authority.mjs'

export const MAX_PAGE_EXCERPT_CHARS = 400
export const MAX_FACT_EXCERPT_CHARS = 200

const MANUFACTURER_SOURCE_TYPES = new Set([
  'manufacturer',
  'spec_sheet',
  'sds',
  'ingredient_page',
  'faq',
  'certification',
  'smartlabel',
])

const RETAILER_WEAKER_LABELS = new Set([
  'retailer confirmed',
  'inferred from description',
  'inferred from category pattern',
])

const MATERIAL_DISCLOSURE_KEYS = new Set([
  'primary_material',
  'primary_contact_surface',
  'finishing_treatments',
  'ingredient_list',
  'secondary_components',
])

const CERT_TEXT_PATTERN =
  /made safe|madesafe|nsf\s|oeko-tex|leaping bunny|usda organic|epa safer choice|safer choice|b corp|certified|certification/i

export function isManufacturerTierSource(source) {
  const type = String(source?.source_type ?? '').toLowerCase()
  return MANUFACTURER_SOURCE_TYPES.has(type)
}

function certSourceIndices(sources, facts) {
  const indices = new Set()
  for (const fact of facts ?? []) {
    if (fact.fact_key === 'certifications_found' && fact.source_index != null) {
      indices.add(fact.source_index)
    }
  }
  for (let i = 0; i < (sources ?? []).length; i++) {
    const blob = `${sources[i]?.page_excerpt ?? ''} ${sources[i]?.title ?? ''} ${sources[i]?.url ?? ''}`
    if (CERT_TEXT_PATTERN.test(blob)) indices.add(i)
  }
  return indices
}

/** page_excerpt only on certification-bearing sources; cap at 400 chars. */
export function applySourceExcerptPolicy(sources, facts) {
  const certIndices = certSourceIndices(sources, facts)
  return (sources ?? []).map((source, index) => {
    const base = { ...source }
    if (!certIndices.has(index)) {
      delete base.page_excerpt
      return base
    }
    if (typeof base.page_excerpt === 'string' && base.page_excerpt.trim()) {
      base.page_excerpt = base.page_excerpt.trim().slice(0, MAX_PAGE_EXCERPT_CHARS)
    } else {
      delete base.page_excerpt
    }
    return base
  })
}

function looksFullyDisclosedOnManufacturer(fact) {
  const v = String(fact.fact_value ?? '').trim()
  if (!v || /^unknown$/i.test(v)) return false
  if (/inferred|unspecified|undisclosed|proprietary|not confirmed|unverified/i.test(v)) {
    return false
  }
  return MATERIAL_DISCLOSURE_KEYS.has(fact.fact_key)
}

/**
 * Upgrade confidence when a higher tier source supports the fact.
 */
export function applyConfidenceUpgrades(sources, facts) {
  const upgrades = []
  const out = (facts ?? []).map((fact) => {
    const idx = fact.source_index
    if (idx == null || !Number.isInteger(idx) || idx < 0 || idx >= sources.length) {
      return fact
    }

    const source = sources[idx]
    const before = fact.confidence

    if (fact.fact_key === 'certifications_found' && isManufacturerTierSource(source)) {
      if (before !== 'certification verified') {
        upgrades.push({ fact_key: fact.fact_key, from: before, to: 'certification verified' })
        return { ...fact, confidence: 'certification verified' }
      }
      return fact
    }

    if (isThirdPartySource(source, source?.url)) {
      const downgraded = enforceFactSourceAuthority(sources, [fact])[0]
      if (downgraded.confidence !== before) {
        upgrades.push({
          fact_key: fact.fact_key,
          from: before,
          to: downgraded.confidence,
          source_type: source.source_type,
        })
        return downgraded
      }
      return fact
    }

    if (!isManufacturerTierSource(source)) return fact

    if (RETAILER_WEAKER_LABELS.has(before)) {
      const to = looksFullyDisclosedOnManufacturer(fact)
        ? 'fully disclosed by manufacturer'
        : 'manufacturer confirmed'
      upgrades.push({ fact_key: fact.fact_key, from: before, to, source_type: source.source_type })
      return { ...fact, confidence: to }
    }

    if (before === 'manufacturer confirmed' && looksFullyDisclosedOnManufacturer(fact)) {
      upgrades.push({
        fact_key: fact.fact_key,
        from: before,
        to: 'fully disclosed by manufacturer',
        source_type: source.source_type,
      })
      return { ...fact, confidence: 'fully disclosed by manufacturer' }
    }

    return fact
  })

  return { facts: out, upgrades }
}

export function applyFactExcerptCaps(facts) {
  return (facts ?? []).map((fact) => ({
    ...fact,
    excerpt:
      typeof fact.excerpt === 'string'
        ? fact.excerpt.trim().slice(0, MAX_FACT_EXCERPT_CHARS)
        : fact.excerpt,
  }))
}
