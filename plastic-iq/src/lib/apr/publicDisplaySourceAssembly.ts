/**
 * Map approved Gate 1 evidence to frozen display.sources (Agent 2 display namespace).
 */

import type { ProductEvidence } from '../../types/agent'
import type { Product } from '../../types'
import type { AprDisplaySource, DisplaySourceGroup } from '../../types/apr'
import { buildPublicDisplayContract } from '../publicProductDisplayContract'
import { buildPublicSourcesFromEvidence } from '../publicSourceDisplay'
import { polishDisplaySourceLabel } from './publicSourceDisplayLabel'

function sourceFootnote(source: {
  public_label: string
  public_status: string
}): string | null {
  if (source.public_label === 'Retailer' && source.public_status === 'primary') return null
  if (source.public_label === 'Retailer' && source.public_status === 'supporting') {
    return 'Retailer listing — supporting source for this product.'
  }
  if (source.public_label === 'Context') {
    return 'Third-party or background context — not manufacturer product confirmation.'
  }
  return null
}

export function formatDisplaySourcesIntro(groups: DisplaySourceGroup[]): string {
  const labels = groups.map((g) => g.toLowerCase())
  if (labels.length === 0) {
    return 'Sources used for this score, including manufacturer, retailer, regulatory, and context sources where applicable.'
  }
  if (labels.length === 1) {
    return `Sources used for this score, including ${labels[0]} sources where applicable.`
  }
  const last = labels[labels.length - 1]
  const rest = labels.slice(0, -1).join(', ')
  return `Sources used for this score, including ${rest}, and ${last} sources where applicable.`
}

export function buildAprDisplaySourcesFromApprovedEvidence(
  evidence: ProductEvidence,
  product: Product,
): AprDisplaySource[] {
  const contract = buildPublicDisplayContract(product, evidence)
  const publicSources = buildPublicSourcesFromEvidence(evidence, contract)

  return publicSources
    .filter((s) => s.public_source_eligible !== false)
    .map((s) => {
      const draft: AprDisplaySource = {
        url: s.url,
        group: s.public_label as DisplaySourceGroup,
        label: s.title,
        public_source_eligible: true,
        source_role:
          s.public_label === 'Retailer' && s.public_status === 'primary'
            ? 'retailer_primary'
            : s.public_label === 'Retailer'
              ? 'retailer_supporting'
              : s.public_label === 'Manufacturer'
                ? 'manufacturer'
                : 'context',
        variant_mismatch: false,
        footnote: sourceFootnote(s),
      }
      return { ...draft, label: polishDisplaySourceLabel(draft) }
    })
}

export function displaySourcesFingerprint(sources: AprDisplaySource[]): string {
  return JSON.stringify(
    sources
      .filter((s) => s.public_source_eligible !== false)
      .map((s) => ({ url: s.url, group: s.group, label: s.label, role: s.source_role }))
      .sort((a, b) => a.url.localeCompare(b.url)),
  )
}
