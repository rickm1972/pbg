/**
 * Agent 2 display assembly — authors all display.* strings from approved gate records.
 * The public renderer must not import this module; use fetchAprPublicRenderInput instead.
 */

import type { NormalizationComponent, ProductEvidence } from '../../types/agent'
import type { Product } from '../../types'
import type {
  AprDisplayPayload,
  AprDisplayRiskBar,
  AprDisplaySource,
  AprDisplayWhyThisScoreSection,
  AprPublicRenderInput,
  DisplaySourceGroup,
} from '../../types/apr'
import type { ProductPageScore } from '../productScoresApi'
import type { WhyThisScoreFields } from '../whyThisScoreApi'
import { capitalizeDescriptionSentenceInitials } from './displayTextPolish'
import { buildPublicSourcesFromEvidence, filterSourcesHeuristic } from '../publicSourceDisplay'
import {
  buildPublicDisplayContract,
  applyPublicSecondaryMaterialsToFields,
} from '../publicProductDisplayContract'
import { applyHazardSortToWhyThisScoreFields, primaryMaterialLabelsFromComponents } from '../whyThisScoreSort'
import { rewritePublicDescriptionDisclosureGap, publicCertificationAbsenceCopy, publicCertificationsForDisplay, primaryMaterialIndicatesCoatingDisclosureGap, isManufacturerLabTestingCertOption } from '../publicDisclosureGapCopy'
import {
  applyPublicMaterialLabelsToWhyThisScore,
  humanizePublicContactMaterialDisplay,
  humanizePublicMaterialProse,
} from '../publicMaterialProse'
import { softenPublicDescription, publicRetailerSectionTitle, publicRetailerCautionNote } from '../publicProductDisplay'
import { publicRetailerLinks, evaluatePublicRetailerCtaEligibility } from '../publicRetailerLinks'
import { publicRetailerCtaLabel } from '../retailerLinks'
import { transparencyBadgeSummary } from '../transparencyBadge'
import { computeRiskDashboardMetrics, type RiskIndicatorTone } from '../riskDashboard'
import { hasApprovedPageScore } from '../publicProductDisplay'
import { retailerListingHasConfirmedVariantMismatch } from '../retailerVariantMatch'
import { normalizeDisclosureBadge } from '../whyThisScoreVocabulary'

const GRAPHITE_CORE_NOTE = 'Internal bonded core — not a food-contact surface.'
const NONE_DISTINCT_SECONDARY = 'None distinct from primary material'
const USE_CONDITIONS_CLAUSE =
  'It is used with oven and stovetop heat, including fat exposure'
const USE_CONDITIONS_SENTENCE = `${USE_CONDITIONS_CLAUSE}.`
const USE_HEAT_PHRASE = 'oven and stovetop heat, including fat exposure'
const FINITE_VERB_RE =
  /\b(?:is|are|was|were|am|be|been|being|has|have|had|do|does|did|can|could|should|would|will|may|might|must|uses|use|used|confirms|confirm|reflects|reflect|includes|include|included|remains|remain|discloses|disclose|disclosed|contradicts|contradict|characterized|characterizes|characterize|expected|means|shows|indicates|represents|requires|applies|accounts|rated|scores|score)\b/i

/** Split assembled description into period-delimited sentences (test + validation). */
export function splitAssembledDescriptionSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** True when a sentence contains a finite verb (guards against noun-phrase fragments). */
export function assembledSentenceHasVerb(sentence: string): boolean {
  const s = sentence.trim()
  if (!s) return true
  return FINITE_VERB_RE.test(s)
}

function joinFragmentToPrevious(previous: string, fragment: string): string {
  const prev = previous.replace(/[.!?]$/, '').trim()
  const frag = fragment.replace(/[.!?]$/, '').trim()
  const lowerFrag = frag.charAt(0).toLowerCase() + frag.slice(1)
  return `${prev}, ${lowerFrag}.`
}

/** Merge period-separated fragments into the sentence they modify (comma-joined). */
function mergeFragmentSentences(text: string): string {
  const sentences = splitAssembledDescriptionSentences(text)
  if (sentences.length <= 1) return text.trim()

  const merged: string[] = []
  for (const raw of sentences) {
    const sentence =
      raw.endsWith('.') || raw.endsWith('!') || raw.endsWith('?') ? raw : `${raw}.`

    if (!assembledSentenceHasVerb(sentence) && merged.length > 0) {
      merged[merged.length - 1] = joinFragmentToPrevious(merged[merged.length - 1], sentence)
    } else {
      merged.push(sentence)
    }
  }
  return merged.join(' ')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeUseConditionsInDescription(text: string): string {
  let out = text
  const heat = escapeRegExp(USE_HEAT_PHRASE)
  const boundary = `(?<=[.!?]\\s+|^)`

  // Complete use sentence + period + trailing descriptive clause → comma-join (never two sentences).
  out = out.replace(
    new RegExp(
      `(${escapeRegExp(USE_CONDITIONS_CLAUSE)})\\.\\s*(Conditions associated[^.;]+)\\.?`,
      'gi',
    ),
    (_m, useClause: string, trailing: string) =>
      `${useClause}, ${trailing.charAt(0).toLowerCase()}${trailing.slice(1)}.`,
  )

  // Orphan use phrase + comma + trailing descriptive clause → one complete sentence.
  out = out.replace(
    new RegExp(`${boundary}${heat},\\s*(conditions associated[^.;]+)\\.?`, 'gi'),
    `${USE_CONDITIONS_CLAUSE}, $1.`,
  )

  // Orphan use phrase (+ optional trailing clause) before Because.
  out = out.replace(
    new RegExp(
      `${boundary}${heat}(?:,\\s*conditions associated[^.;]+)?;\\s*(Because\\b)`,
      'gi',
    ),
    (_full, because: string) => {
      const trailing = _full.match(/conditions associated[^.;]+/i)
      if (trailing) {
        return `${USE_CONDITIONS_CLAUSE}, ${trailing[0]}. ${because}`
      }
      return `${USE_CONDITIONS_SENTENCE} ${because}`
    },
  )

  // Standalone orphan use phrase → complete sentence (preserve preceding period).
  out = out.replace(
    new RegExp(`${boundary}${heat}(?=\\s*[.;]|\\s*$)`, 'gi'),
    USE_CONDITIONS_SENTENCE,
  )

  out = out.replace(/\.{2,}/g, '.')

  return out
}

function assertCompleteAssembledSentences(text: string): void {
  for (const sentence of splitAssembledDescriptionSentences(text)) {
    if (!assembledSentenceHasVerb(sentence)) {
      throw new Error(`Display assembly produced sentence fragment: ${sentence}`)
    }
  }
}

/**
 * Repair use-condition fragments left by legacy description soften passes —
 * complete sentences only; never emit period-delimited fragments without a verb.
 */
export function finalizeAssembledProductDescription(text: string): string {
  if (!text?.trim()) return text

  let out = normalizeUseConditionsInDescription(text.trim())

  out = out.replace(/;\s*(Because\b)/g, '. $1')
  out = out.replace(/,\s*;\s*/g, '. ')
  out = out.replace(/\s{2,}/g, ' ')

  out = mergeFragmentSentences(out.trim())
  assertCompleteAssembledSentences(out)

  return capitalizeDescriptionSentenceInitials(out.trim())
}
const SAFER_ALTERNATIVES_SUBHEAD = 'Higher PAC Safety Scores in this category.'
const SAFER_ALTERNATIVES_FOOTER = 'These alternatives have higher PAC Safety Scores.'
const ABSOLUTE_EXPOSURE_CLAIM_RE =
  /lower expected PAC exposure|expected PAC exposure|plastic-associated chemical migration under typical kitchen use/i

const WTS_SECTIONS: Array<{ key: keyof WhyThisScoreFields; title: string }> = [
  { key: 'primary_material_options', title: 'Primary material' },
  { key: 'secondary_materials_options', title: 'Secondary materials' },
  { key: 'coatings_finishes_options', title: 'Coatings & finishes' },
  { key: 'use_conditions_options', title: 'Use conditions' },
  { key: 'disclosure_quality_options', title: 'Disclosure quality' },
  { key: 'certifications_options', title: 'Certifications & testing' },
]

function displayOptions(options: string[]): string[] {
  if (!options.length) return []
  if (options.length === 1 && options[0] === 'None') return []
  return options.filter((o) => o !== 'None')
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase()
}

function primaryMaterialNameFromAssembly(
  components: NormalizationComponent[] | null | undefined,
  fallbackOptions: string[] | undefined,
): string | null {
  const labels = primaryMaterialLabelsFromComponents(components)
  if (labels.length) return labels.join(', ')
  const opts = displayOptions(fallbackOptions ?? [])
  return opts.length ? opts.join(', ') : null
}

/** Public WTS shaping for assembly — avoids pulling supabase-backed whyThisScoreApi at import time. */
function shapePublicWhyThisScoreFieldsForAssembly(
  fields: WhyThisScoreFields,
): WhyThisScoreFields {
  const primary = fields.primary_material_options
  let secondary = fields.secondary_materials_options
  if (secondaryEchoesPrimary(primary, secondary)) {
    secondary = [NONE_DISTINCT_SECONDARY]
  }

  const disclosureBadge = normalizeDisclosureBadge(fields.disclosure_quality_options[0] ?? '')

  return {
    ...fields,
    secondary_materials_options: secondary,
    disclosure_quality_options: fields.disclosure_quality_options.map((o) =>
      normalizeDisclosureBadge(o),
    ),
    certifications_options: publicCertificationsForDisplay(
      fields.certifications_options,
      disclosureBadge,
      primary,
      fields.coatings_finishes_options,
    ),
  }
}

/** Secondary list must not echo primary (e.g. Lodge cast iron only). */
function secondaryEchoesPrimary(primary: string[], secondary: string[]): boolean {
  const p = displayOptions(primary)
  const s = displayOptions(secondary)
  if (!p.length || !s.length) return false
  return s.every((sec) => p.some((pr) => normalizeLabel(pr) === normalizeLabel(sec)))
}

function publicSecondaryMaterialLabels(fields: WhyThisScoreFields): string[] {
  const raw = fields.secondary_materials_options.filter((o) => o !== 'None')
  if (secondaryEchoesPrimary(fields.primary_material_options, fields.secondary_materials_options)) {
    return [NONE_DISTINCT_SECONDARY]
  }
  return raw
}

function approvedTransparencyBadge(
  pageScore: ProductPageScore,
  whyThisScore: WhyThisScoreFields | null,
): string {
  const fromNormalization = normalizeDisclosureBadge(
    whyThisScore?.disclosure_quality_options?.[0] ?? '',
  )
  if (fromNormalization) return fromNormalization
  return normalizeDisclosureBadge(pageScore.transparency_badge ?? '')
}

const UNCERTAINTY_DISCLOSURE_LANGUAGE_RE =
  /not fully disclosed|not fully characterized|uncertainty is reflected in the score/i

const UNCERTAINTY_SENTENCE_RES = [
  /\s*Because key food-contact chemistry is not fully disclosed[^.!?]*[.!?]/gi,
  /\s*Because the exact coating formulation is not fully disclosed[^.!?]*[.!?]/gi,
  /\s*Because key food-contact material details are not fully disclosed[^.!?]*[.!?]/gi,
  /\s*The disclosed food-contact chemistry is not fully characterized\.?/gi,
  /\s*Some materials are disclosed but key components[^.!?]*[.!?]/gi,
]

const SELF_REFERENTIAL_CLAUSE_RES = [
  /\s*Marketing claims contradict that marketing claim\.?/gi,
]

/** True when approved transparency tier permits uncertainty / disclosure-gap copy. */
export function transparencyTierAllowsUncertaintyCopy(badge: string): boolean {
  const b = normalizeDisclosureBadge(badge)
  return b === 'Material Uncertain' || b === 'Documentation Incomplete' || b === 'Opaque'
}

export function assembledDescriptionContainsUncertaintyLanguage(text: string): boolean {
  return UNCERTAINTY_DISCLOSURE_LANGUAGE_RE.test(text)
}

function stripSelfReferentialBrokenClauses(text: string): string {
  let out = text
  for (const re of SELF_REFERENTIAL_CLAUSE_RES) {
    out = out.replace(re, '')
  }
  return out.replace(/\s{2,}/g, ' ').trim()
}

function stripUncertaintyCopyForFullyDisclosed(text: string): string {
  let out = text
  for (const re of UNCERTAINTY_SENTENCE_RES) {
    out = out.replace(re, '')
  }
  return out.replace(/\s{2,}/g, ' ').trim()
}

/** Remove disclosure-gap / uncertainty copy when tier is Fully Disclosed. Grammar-only otherwise. */
function applyTransparencyTierToDescription(text: string, transparencyBadge: string): string {
  let out = stripSelfReferentialBrokenClauses(text)
  if (!transparencyTierAllowsUncertaintyCopy(transparencyBadge)) {
    out = stripUncertaintyCopyForFullyDisclosed(out)
  }
  return out.replace(/\s{2,}/g, ' ').trim()
}

function assembleProductDescription(
  productDescription: string | null,
  primaryMaterialOptions: string[] | undefined,
  coatingsFinishesOptions: string[] | undefined,
  transparencyBadge: string,
): string {
  if (!productDescription) return ''
  const softened = humanizePublicMaterialProse(
    rewritePublicDescriptionDisclosureGap(
      softenPublicDescription(productDescription),
      primaryMaterialOptions,
      coatingsFinishesOptions,
    ),
  )
  const tierAligned = applyTransparencyTierToDescription(softened, transparencyBadge)
  return finalizeAssembledProductDescription(tierAligned)
}

function toneToColorToken(tone: RiskIndicatorTone): string {
  if (tone === 'safe') return 'emerald'
  if (tone === 'moderate') return 'amber'
  return 'red'
}

function buildRiskBars(
  components: NormalizationComponent[],
  primaryMaterialName: string | null,
  transparencyBadge: string,
): AprDisplayRiskBar[] {
  const metrics = computeRiskDashboardMetrics(components, { transparencyBadge })
  if (!metrics) return []

  const contactLabel = primaryMaterialName
    ? `Contact material: ${primaryMaterialName}`
    : 'Contact material'

  return [
    {
      id: 'material',
      label: contactLabel,
      fill_percent: Math.round(metrics.material.fillPercent),
      color_token: toneToColorToken(metrics.material.tone),
      status_label: metrics.material.statusLabel,
    },
    {
      id: 'migration',
      label: 'Migration',
      fill_percent: Math.round(metrics.migration.fillPercent),
      color_token: toneToColorToken(metrics.migration.tone),
      status_label: metrics.migration.statusLabel,
    },
    {
      id: 'use_conditions',
      label: 'Use conditions',
      fill_percent: Math.round(metrics.useConditions.fillPercent),
      color_token: toneToColorToken(metrics.useConditions.tone),
      status_label: metrics.useConditions.statusLabel,
    },
  ]
}

function whyThisScoreSections(fields: WhyThisScoreFields): AprDisplayWhyThisScoreSection[] {
  const secondaryLabels = publicSecondaryMaterialLabels(fields)

  return WTS_SECTIONS.map(({ key, title }) => {
    if (key === 'secondary_materials_options') {
      if (secondaryLabels.length === 1 && secondaryLabels[0] === NONE_DISTINCT_SECONDARY) {
        return { title, items: [{ text: NONE_DISTINCT_SECONDARY, note: null }] }
      }
      return {
        title,
        items: secondaryLabels.map((text) => ({
          text,
          note: /^Graphite core$/i.test(text) ? GRAPHITE_CORE_NOTE : null,
        })),
      }
    }

    const options = fields[key]
    const visible = options.filter((o) => o !== 'None')
    const isNoneOnly = options.length === 1 && options[0] === 'None'

    if (visible.length === 0 && isNoneOnly) {
      return { title, items: [{ text: 'None', note: null }] }
    }
    if (visible.length === 0) {
      return { title, items: [{ text: 'None', note: null }] }
    }

    return {
      title,
      items: visible.map((text) => ({
        text,
        note: /^Graphite core$/i.test(text) ? GRAPHITE_CORE_NOTE : null,
      })),
    }
  })
}

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

function formatSourcesIntro(groups: DisplaySourceGroup[]): string {
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

function assembleBuyCta(
  product: Product,
  evidence: ProductEvidence | null,
  reviewedTitle: string,
) {
  return publicRetailerLinks(product, evidence).filter((link) => {
    const eligibility = evaluatePublicRetailerCtaEligibility(link.url, evidence, product)
    return eligibility.allowed
  })
}

function secondaryMaterialsDisplay(fields: WhyThisScoreFields): AprDisplayPayload['secondary_materials'] {
  const labels = publicSecondaryMaterialLabels(fields)
  if (labels.length === 1 && labels[0] === NONE_DISTINCT_SECONDARY) {
    return [{ name: NONE_DISTINCT_SECONDARY, note: null }]
  }
  return labels.map((name) => ({
    name,
    note: /^Graphite core$/i.test(name) ? GRAPHITE_CORE_NOTE : null,
  }))
}

export type AssembleDisplayInput = {
  product: Product
  evidence: ProductEvidence | null
  pageScore: ProductPageScore | null
  whyThisScore: WhyThisScoreFields | null
  productDescription: string | null
  normalizationComponents: NormalizationComponent[] | null
  /** Pre-fetched raw sources when evidence pack unavailable. */
  rawSources?: Array<{ source_type: string; url: string; title: string | null }>
}

/** Build display.* and score.* for public render from approved gate data. */
export async function assembleAprPublicRenderInput(
  input: AssembleDisplayInput,
): Promise<AprPublicRenderInput | null> {
  const { product, evidence, pageScore, whyThisScore, productDescription, normalizationComponents } =
    input

  if (!hasApprovedPageScore(pageScore) || pageScore == null) return null

  const contract = buildPublicDisplayContract(product, evidence)
  const reviewedTitle = contract.reviewedProductName || product.product_name
  const approvedBadge = approvedTransparencyBadge(pageScore, whyThisScore)

  let publicSources = evidence?.sources?.length
    ? buildPublicSourcesFromEvidence(evidence, contract)
    : filterSourcesHeuristic(
        input.rawSources ??
          (await import('../productEvidenceApi')
            .then((m) => m.fetchProductSources(product.product_id))
            .catch(() => [])),
        contract,
      )

  const displaySources: AprDisplaySource[] = publicSources
    .filter((s) => s.public_source_eligible !== false)
    .map((s) => ({
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
    }))

  const sourceGroups = [...new Set(displaySources.map((s) => s.group))]

  const hazardSorted = whyThisScore
    ? applyHazardSortToWhyThisScoreFields(whyThisScore, normalizationComponents)
    : null

  const withSecondary = hazardSorted
    ? applyPublicSecondaryMaterialsToFields(hazardSorted, normalizationComponents)
    : null

  const shapedWhy = withSecondary
    ? applyPublicMaterialLabelsToWhyThisScore(shapePublicWhyThisScoreFieldsForAssembly(withSecondary))
    : null

  const primaryMaterialName = humanizePublicContactMaterialDisplay(
    primaryMaterialNameFromAssembly(
      normalizationComponents,
      shapedWhy?.primary_material_options ?? whyThisScore?.primary_material_options,
    ),
  )

  const publicDescription = assembleProductDescription(
    productDescription,
    shapedWhy?.primary_material_options ?? whyThisScore?.primary_material_options,
    shapedWhy?.coatings_finishes_options ?? whyThisScore?.coatings_finishes_options,
    approvedBadge,
  )

  const secondaryLabels = shapedWhy ? publicSecondaryMaterialLabels(shapedWhy) : []

  const publicCertRows = shapedWhy?.certifications_options.filter((o) => o !== 'None') ?? []
  const hasLabTesting = publicCertRows.some(isManufacturerLabTestingCertOption)
  const coatingFormulaUndisclosed =
    Boolean(shapedWhy) &&
    primaryMaterialIndicatesCoatingDisclosureGap(
      shapedWhy.primary_material_options,
      shapedWhy.coatings_finishes_options,
    )

  const retailerLinks = assembleBuyCta(product, evidence, reviewedTitle)
  const tier = pageScore.tier ?? 'Good'

  const display: AprDisplayPayload = {
    input_id: product.product_id,
    evidence_id: evidence?.evidence_id ?? '',
    evidence_content_hash: '',
    normalization_content_hash: '',
    product_title: reviewedTitle,
    primary_material: shapedWhy?.primary_material_options[0] ?? primaryMaterialName ?? '',
    disclosure_sentence: shapedWhy
      ? publicCertificationAbsenceCopy(
          shapedWhy.disclosure_quality_options[0],
          shapedWhy.primary_material_options,
          shapedWhy.coatings_finishes_options,
        )
      : '',
    product_description: publicDescription,
    secondary_materials: shapedWhy ? secondaryMaterialsDisplay(shapedWhy) : [],
    coatings: shapedWhy?.coatings_finishes_options.filter((o) => o !== 'None').join(', ') || 'None',
    use_conditions: shapedWhy?.use_conditions_options.filter((o) => o !== 'None') ?? [],
    disclosure_quality: approvedBadge,
    cert_line: publicCertRows[0] ?? '',
    risk_bars:
      normalizationComponents && normalizationComponents.length > 0
        ? buildRiskBars(normalizationComponents, primaryMaterialName, approvedBadge)
        : [],
    sources: displaySources,
    buy_cta: retailerLinks.map((link) => ({
      label: publicRetailerCtaLabel(link, tier),
      url: link.url,
    })),
    why_this_score: {
      primary_material: shapedWhy?.primary_material_options[0] ?? '',
      secondary_materials: secondaryLabels,
      coatings: shapedWhy?.coatings_finishes_options.filter((o) => o !== 'None').join(', ') || 'None',
      use_conditions: shapedWhy?.use_conditions_options.filter((o) => o !== 'None') ?? [],
      disclosure_quality: approvedBadge,
      cert_line: publicCertRows[0] ?? '',
      sections: shapedWhy ? whyThisScoreSections(shapedWhy) : [],
    },
    badge_summary: approvedBadge
      ? transparencyBadgeSummary(approvedBadge, {
          coatingFormulaUndisclosed,
          hasLabTesting,
        })
      : '',
    buy_section_title: publicRetailerSectionTitle(tier),
    retailer_caution_note: publicRetailerCautionNote(tier),
    sources_intro: formatSourcesIntro(sourceGroups),
    safer_alternatives_subhead: SAFER_ALTERNATIVES_SUBHEAD,
    safer_alternatives_footer: SAFER_ALTERNATIVES_FOOTER,
  }

  assertNoAbsoluteExposureClaimsInDisplay(display)

  return {
    display,
    score: {
      pac_safety_score: pageScore.pac_safety_score as number,
      tier,
      displayed_confidence_range: pageScore.displayed_confidence_range ?? '',
      transparency_badge: approvedBadge,
    },
  }
}

function assertNoAbsoluteExposureClaimsInDisplay(display: AprDisplayPayload): void {
  const blob = JSON.stringify(display)
  if (ABSOLUTE_EXPOSURE_CLAIM_RE.test(blob)) {
    throw new Error('Display assembly produced absolute exposure-outcome copy')
  }
  if (/lower expected PAC exposure/i.test(blob)) {
    throw new Error('Display assembly must not include lower expected PAC exposure phrasing')
  }
}

export {
  secondaryEchoesPrimary,
  approvedTransparencyBadge,
  SAFER_ALTERNATIVES_SUBHEAD,
  SAFER_ALTERNATIVES_FOOTER,
}
