/**
 * Phase 4 — registry-driven APR contract preflight (midpoint: assertions 1–6).
 * Runs on assembled APR before human review. Fails closed on contract violations.
 */

import type { ApprovedProductRecord, AprPreflightCheck } from '../../types/apr'
import { isExpansionRequired } from '../../shared/canonical-taxonomy/constants.mjs'
import { resolveProductTypeConfig } from '../../shared/product-type-registry/index.mjs'
import { CATEGORY_CONFIG_REQUIRED } from '../../shared/product-type-registry/preflight.mjs'
import {
  getSecondaryMaterialPolicy,
  TRANSPARENCY_ROUTES,
  RISK_BAR_CONTRACT,
} from '../../shared/product-type-registry/display-policies.mjs'
import {
  findCanonicalIdsInDisplayStrings,
  assertRetailerPrimarySourceRoles,
  assertVariantMismatchEligibility,
  type OwnershipViolation,
} from './ownership'
import { assertDisplayNamespaceSeparation } from './snapshot'
import { walkDisplayStrings } from './rendererTextContract'
import { assertNegativeScorePublicationPolicy } from './negativeScoreGate'
import type { AprDisplayPayload } from '../../types/apr'

export type ContractPreflightViolation = {
  check_id: string
  rule: string
  path: string
  message: string
}

function toViolation(v: OwnershipViolation, checkId: string): ContractPreflightViolation {
  return { check_id: checkId, rule: v.rule, path: v.path, message: v.message }
}

function extractProductIdentity(record: ApprovedProductRecord): {
  category: string | null
  subcategory: string | null
  product_type: string | null
} {
  const structured = record.evidence.payload.structured_evidence as {
    product_identity?: {
      category?: string
      subcategory?: string
      product_type?: string
    }
  }
  const pi = structured?.product_identity
  return {
    category: pi?.category ?? null,
    subcategory: pi?.subcategory ?? null,
    product_type: pi?.product_type ?? null,
  }
}

/** Assertion 1 — product-type registry resolution on assembled APR identity. */
export function assertRegistryProductTypeConfigured(
  record: ApprovedProductRecord,
): ContractPreflightViolation[] {
  const identity = extractProductIdentity(record)
  const config = resolveProductTypeConfig(identity)
  if (config) return []

  const detail = `${CATEGORY_CONFIG_REQUIRED}: no registry config for category="${identity.category ?? '(unknown)'}", subcategory="${identity.subcategory ?? '(unknown)'}", product_type="${identity.product_type ?? '(unknown)'}".`
  return [
    {
      check_id: 'registry.product_type_configured',
      rule: 'category_config_required',
      path: 'evidence.structured_evidence.product_identity',
      message: detail,
    },
  ]
}

/** Assertion 2 — known/common materials must not remain TAXONOMY_EXPANSION_REQUIRED in normalization. */
export function assertNoExpansionRequiredMaterials(
  record: ApprovedProductRecord,
): ContractPreflightViolation[] {
  const violations: ContractPreflightViolation[] = []
  for (const [i, component] of record.normalization.payload.components.entries()) {
    const materialId = String(component.material_id ?? '')
    if (isExpansionRequired(materialId) || materialId === 'TAXONOMY_EXPANSION_REQUIRED') {
      violations.push({
        check_id: 'registry.material_class_resolved',
        rule: 'taxonomy_expansion_required',
        path: `normalization.components[${i}].material_id`,
        message: `Component material_id "${materialId}" is TAXONOMY_EXPANSION_REQUIRED — known product-type materials must resolve via registry fixtures.`,
      })
    }
  }

  const mappings = (
    record.evidence.payload.structured_evidence as {
      canonical_mappings?: Record<string, { canonical_id?: string }>
    }
  )?.canonical_mappings
  if (mappings) {
    for (const [key, row] of Object.entries(mappings)) {
      const id = String(row?.canonical_id ?? '')
      if (id === 'TAXONOMY_EXPANSION_REQUIRED') {
        violations.push({
          check_id: 'registry.material_class_resolved',
          rule: 'taxonomy_expansion_required',
          path: `evidence.structured_evidence.canonical_mappings.${key}`,
          message: `Canonical mapping ${key} is TAXONOMY_EXPANSION_REQUIRED.`,
        })
      }
    }
  }
  return violations
}

/** Assertion 4 — transparency badge / disclosure / CI consistency. */
export function assertTransparencyConsistency(
  record: ApprovedProductRecord,
): ContractPreflightViolation[] {
  const violations: ContractPreflightViolation[] = []
  const display = record.display.payload
  const score = record.score.payload
  const layer4b = record.normalization.payload.layer_4b as { transparency_badge?: string } | null

  if (display.disclosure_quality !== score.transparency_badge) {
    violations.push({
      check_id: 'transparency.badge_matches_disclosure',
      rule: 'transparency_consistency',
      path: 'score.transparency_badge',
      message: `score.transparency_badge "${score.transparency_badge}" must match display.disclosure_quality "${display.disclosure_quality}".`,
    })
  }

  if (layer4b?.transparency_badge && layer4b.transparency_badge !== score.transparency_badge) {
    violations.push({
      check_id: 'transparency.badge_matches_layer4b',
      rule: 'transparency_consistency',
      path: 'normalization.layer_4b.transparency_badge',
      message: `Agent 2 layer_4b transparency_badge "${layer4b.transparency_badge}" must match score.transparency_badge "${score.transparency_badge}".`,
    })
  }

  for (const route of Object.values(TRANSPARENCY_ROUTES)) {
    const matchesMaterial = record.normalization.payload.components.some((c) =>
      route.material_id_patterns.some((p) => String(c.material_id ?? '').includes(p)),
    )
    if (!matchesMaterial) continue

    for (const forbidden of route.forbidden_badges) {
      if (score.transparency_badge === forbidden) {
        violations.push({
          check_id: 'transparency.unspecified_stainless_route',
          rule: 'transparency_consistency',
          path: 'score.transparency_badge',
          message: `${route.material_id_patterns.join('/')} primary material requires "${route.required_badge}", not "${forbidden}".`,
        })
      }
    }

    if (
      score.transparency_badge !== route.required_badge ||
      display.disclosure_quality !== route.required_disclosure_quality
    ) {
      violations.push({
        check_id: 'transparency.unspecified_stainless_route',
        rule: 'transparency_consistency',
        path: 'score.transparency_badge',
        message: `${route.material_id_patterns.join('/')} primary material requires badge/disclosure "${route.required_badge}".`,
      })
    }

    if (score.displayed_confidence_range !== route.expected_ci) {
      violations.push({
        check_id: 'transparency.unspecified_stainless_ci',
        rule: 'transparency_consistency',
        path: 'score.displayed_confidence_range',
        message: `Grade-unspecified stainless route expects CI ${route.expected_ci}, got "${score.displayed_confidence_range}".`,
      })
    }
  }

  return violations
}

function componentRole(component: { component_role?: string; role?: string }): string {
  return String(component.component_role ?? component.role ?? '')
}

function isInternalCoreComponent(
  component: { component_role?: string; role?: string; material_id?: string },
  policy: ReturnType<typeof getSecondaryMaterialPolicy>,
): boolean {
  if (!policy) return false
  const role = componentRole(component)
  if (policy.internal_core_roles.includes(role)) return true
  const materialId = String(component.material_id ?? '')
  return (policy.internal_core_material_id_patterns ?? []).some((p) => materialId.includes(p))
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase()
}

/** Assertion 5 — secondary materials follow registry product-type policy. */
export function assertSecondaryMaterialsPolicy(
  record: ApprovedProductRecord,
): ContractPreflightViolation[] {
  const identity = extractProductIdentity(record)
  const config = resolveProductTypeConfig(identity)
  if (!config?.secondary_material_policy_ref) return []

  const policy = getSecondaryMaterialPolicy(config.secondary_material_policy_ref)
  if (!policy) return []

  const internalComponents = record.normalization.payload.components.filter((c) =>
    isInternalCoreComponent(c, policy),
  )
  if (!internalComponents.length) return []

  const expectedLabels = internalComponents.map((c) =>
    normalizeLabel(String(c.material ?? c.component_name ?? '')),
  )
  const displayLabels = record.display.payload.secondary_materials.map((s) => normalizeLabel(s.name))
  const shownInternal = expectedLabels.filter((label) =>
    displayLabels.some((d) => d.includes(label) || label.includes(d)),
  )

  if (policy.mode === 'suppress_internal_cores') {
    if (shownInternal.length > 0) {
      return [
        {
          check_id: 'secondary_materials.policy_suppress',
          rule: 'secondary_materials_policy',
          path: 'display.secondary_materials',
          message: `Registry policy ${policy.id} suppresses internal cores, but display shows: ${shownInternal.join(', ')}.`,
        },
      ]
    }
    return []
  }

  if (policy.mode === 'show_all_internal_cores_or_none') {
    if (shownInternal.length === 0) return []
    if (shownInternal.length !== expectedLabels.length) {
      const missing = expectedLabels.filter(
        (label) => !displayLabels.some((d) => d.includes(label) || label.includes(d)),
      )
      return [
        {
          check_id: 'secondary_materials.policy_show_all',
          rule: 'secondary_materials_policy',
          path: 'display.secondary_materials',
          message: `Registry policy ${policy.id} requires all internal cores shown or none; missing from display: ${missing.join(', ')}.`,
        },
      ]
    }
  }

  return []
}

/** Assertion 6 — source role, grouping, and buy CTA provenance. */
export function assertSourceRoleConsistency(
  record: ApprovedProductRecord,
): ContractPreflightViolation[] {
  const violations: ContractPreflightViolation[] = []
  const display = record.display.payload

  for (const [i, source] of display.sources.entries()) {
    if (!source.source_role) {
      violations.push({
        check_id: 'sources.role_required',
        rule: 'source_role_required',
        path: `display.sources[${i}].source_role`,
        message: 'Every display source must carry Gate 1 source_role.',
      })
    }
    if (source.source_role === 'retailer_primary' && source.footnote?.trim()) {
      violations.push({
        check_id: 'sources.retailer_primary_no_footnote',
        rule: 'retailer_primary_not_context',
        path: `display.sources[${i}].footnote`,
        message: 'retailer_primary must not carry third-party/background explanatory footnote copy.',
      })
    }
  }

  for (const [i, evSource] of record.evidence.payload.sources.entries()) {
    if (!evSource.source_role) {
      violations.push({
        check_id: 'sources.evidence_role_required',
        rule: 'source_role_required',
        path: `evidence.sources[${i}].source_role`,
        message: 'Every Gate 1 evidence source must have source_role.',
      })
    }
  }

  const primaryRetailers = display.sources.filter((s) => s.source_role === 'retailer_primary')
  for (const cta of display.buy_cta) {
    const matchedPrimary = primaryRetailers.some((s) => s.url === cta.url)
    if (!matchedPrimary) {
      violations.push({
        check_id: 'sources.buy_cta_from_retailer_primary',
        rule: 'retailer_primary_provenance',
        path: 'display.buy_cta',
        message: `Buy CTA url "${cta.url}" must match a retailer_primary source url.`,
      })
    }
  }

  const mfrOverride = display.sources.some(
    (s) =>
      (s.source_role === 'manufacturer' || s.source_role === 'context') &&
      s.group === 'Retailer' &&
      display.buy_cta.some((c) => c.url === s.url),
  )
  if (mfrOverride) {
    violations.push({
      check_id: 'sources.manufacturer_not_buy_cta',
      rule: 'retailer_primary_provenance',
      path: 'display.buy_cta',
      message: 'Manufacturer/context sources must not override retailer buy CTA provenance.',
    })
  }

  return violations
}

function isExactProductPageUrl(url: string): boolean {
  return /\/products?\//i.test(url) && /\d+-\d+-inch|\d+-inch/i.test(url)
}

function isNeutralCollectionOrConstructionSource(source: {
  url: string
  label: string
  source_role: string
}): boolean {
  if (source.source_role !== 'manufacturer') return false
  return /\/collections?\//i.test(source.url) || /construction|collection/i.test(source.label)
}

/** Assertion 7 — variant mismatch must not become identity, buy CTA, or primary source. */
export function assertVariantMismatchHandling(
  record: ApprovedProductRecord,
): ContractPreflightViolation[] {
  const violations: ContractPreflightViolation[] = []
  const display = record.display.payload
  const evidence = record.evidence.payload
  const reviewedUrl = evidence.reviewed_identity.primary_retailer_url
  const reviewedName = evidence.reviewed_identity.product_name

  for (const [i, source] of display.sources.entries()) {
    if (!source.variant_mismatch) continue

    if (source.source_role === 'retailer_primary') {
      violations.push({
        check_id: 'variant_mismatch.not_primary_retailer',
        rule: 'variant_mismatch_handling',
        path: `display.sources[${i}]`,
        message: 'variant_mismatch source must not carry retailer_primary role.',
      })
    }

    if (display.buy_cta.some((c) => c.url === source.url)) {
      violations.push({
        check_id: 'variant_mismatch.not_buy_cta',
        rule: 'variant_mismatch_handling',
        path: `display.sources[${i}]`,
        message: 'variant_mismatch source must not appear in display.buy_cta.',
      })
    }

    if (source.url === reviewedUrl) {
      violations.push({
        check_id: 'variant_mismatch.not_reviewed_identity_url',
        rule: 'variant_mismatch_handling',
        path: `display.sources[${i}]`,
        message: 'variant_mismatch source must not be the reviewed primary retailer URL.',
      })
    }

    if (
      source.public_source_eligible &&
      isExactProductPageUrl(source.url) &&
      !isNeutralCollectionOrConstructionSource(source)
    ) {
      violations.push({
        check_id: 'variant_mismatch.exact_page_hidden',
        rule: 'variant_mismatch_handling',
        path: `display.sources[${i}]`,
        message:
          'Variant-mismatched exact product page must default to public_source_eligible: false.',
      })
    }

    if (reviewedName && /12\.5\s*inch/i.test(source.label) && !/12\.5\s*inch/i.test(reviewedName)) {
      violations.push({
        check_id: 'variant_mismatch.not_identity_label',
        rule: 'variant_mismatch_handling',
        path: `display.sources[${i}].label`,
        message: 'variant_mismatch source label must not promote mismatched variant as identity.',
      })
    }
  }

  for (const [i, evSource] of evidence.sources.entries()) {
    if (!evSource.variant_mismatch) continue
    if (evSource.url === reviewedUrl) {
      violations.push({
        check_id: 'variant_mismatch.not_evidence_primary',
        rule: 'variant_mismatch_handling',
        path: `evidence.sources[${i}]`,
        message: 'variant_mismatch Gate 1 source must not be reviewed primary_retailer_url.',
      })
    }
  }

  if (
    display.product_title &&
    reviewedName &&
    /12\.5\s*inch/i.test(display.product_title) &&
    /12\s*inch/i.test(reviewedName) &&
    !/12\.5\s*inch/i.test(reviewedName)
  ) {
    violations.push({
      check_id: 'variant_mismatch.not_product_title',
      rule: 'variant_mismatch_handling',
      path: 'display.product_title',
      message: 'display.product_title must reflect reviewed identity, not mismatched variant.',
    })
  }

  return violations
}

const DISPLAY_ARTIFACT_PATTERNS: Array<{ id: string; re: RegExp; message: string }> = [
  { id: 'leading_punctuation', re: /^[\s,;:|.\-–—]+[^\s]/, message: 'leading punctuation artifact' },
  { id: 'trailing_punctuation', re: /[,;:|]\s*$/, message: 'trailing punctuation artifact' },
  { id: 'doubled_comma', re: /,\s*,/, message: 'doubled comma separator' },
  { id: 'doubled_separator', re: /(—\s*—|--)/, message: 'doubled separator' },
  { id: 'html_extension', re: /\.html(\b|[/?#])/i, message: 'file extension in display label' },
  { id: 'dangling_comma', re: /,\s*$/, message: 'dangling comma' },
]

/** Assertion 8 — display string artifact checks. */
export function assertDisplayArtifacts(display: AprDisplayPayload): ContractPreflightViolation[] {
  const violations: ContractPreflightViolation[] = []
  walkDisplayStrings(display, (path, value) => {
    if (!value.trim()) return
    if (path.endsWith('.url') || /^https?:\/\//i.test(value.trim())) return
    for (const pattern of DISPLAY_ARTIFACT_PATTERNS) {
      if (pattern.re.test(value)) {
        violations.push({
          check_id: `display.artifact.${pattern.id}`,
          rule: 'display_artifact',
          path,
          message: `Display string has ${pattern.message}: "${value.slice(0, 80)}"`,
        })
        break
      }
    }
  })
  return violations
}

/** Assertion 9 — risk-bar contract (Oura-style; Agent 2 authored). */
export function assertRiskBarContract(display: AprDisplayPayload): ContractPreflightViolation[] {
  const violations: ContractPreflightViolation[] = []
  const idsSeen = new Set<string>()

  for (const [i, bar] of display.risk_bars.entries()) {
    const path = `display.risk_bars[${i}]`
    if (!RISK_BAR_CONTRACT.bar_ids.includes(bar.id)) {
      violations.push({
        check_id: 'risk_bars.invalid_id',
        rule: 'risk_bar_contract',
        path: `${path}.id`,
        message: `risk bar id "${bar.id}" not in contract bar_ids.`,
      })
    }
    if (idsSeen.has(bar.id)) {
      violations.push({
        check_id: 'risk_bars.duplicate_id',
        rule: 'risk_bar_contract',
        path: `${path}.id`,
        message: `duplicate risk bar id "${bar.id}".`,
      })
    }
    idsSeen.add(bar.id)

    if (!RISK_BAR_CONTRACT.allowed_color_tokens.includes(bar.color_token)) {
      violations.push({
        check_id: 'risk_bars.invalid_color_token',
        rule: 'risk_bar_contract',
        path: `${path}.color_token`,
        message: `color_token "${bar.color_token}" not in allowed Oura-style tokens.`,
      })
    }

    const fill = Number(bar.fill_percent)
    if (
      !Number.isFinite(fill) ||
      fill < RISK_BAR_CONTRACT.min_fill_percent ||
      fill > RISK_BAR_CONTRACT.max_fill_percent
    ) {
      violations.push({
        check_id: 'risk_bars.invalid_fill',
        rule: 'risk_bar_contract',
        path: `${path}.fill_percent`,
        message: `fill_percent must be ${RISK_BAR_CONTRACT.min_fill_percent}–${RISK_BAR_CONTRACT.max_fill_percent}.`,
      })
    }

    if (!bar.label?.trim() || !bar.status_label?.trim()) {
      violations.push({
        check_id: 'risk_bars.missing_labels',
        rule: 'risk_bar_contract',
        path,
        message: 'risk bar label and status_label must be Agent 2 authored non-empty strings.',
      })
    }
  }

  return violations
}

/** Full Phase 4 contract preflight — assertions 1–11 (+ ownership precursors). */
export function runAprContractPreflight(record: ApprovedProductRecord): {
  passed: boolean
  violations: ContractPreflightViolation[]
  checks: AprPreflightCheck[]
} {
  const violations: ContractPreflightViolation[] = []

  const namespace = assertDisplayNamespaceSeparation(record.normalization, record.display)
  if (!namespace.valid) {
    for (const msg of namespace.errors) {
      violations.push({
        check_id: 'ownership.namespace_split',
        rule: 'namespace_split',
        path: 'normalization/display',
        message: msg,
      })
    }
  }

  violations.push(...assertRegistryProductTypeConfigured(record))
  violations.push(...assertNoExpansionRequiredMaterials(record))
  violations.push(
    ...findCanonicalIdsInDisplayStrings(record.display.payload).map((v) =>
      toViolation(v, 'display.canonical_id_leak'),
    ),
  )
  violations.push(...assertTransparencyConsistency(record))
  violations.push(...assertSecondaryMaterialsPolicy(record))
  violations.push(...assertSourceRoleConsistency(record))

  violations.push(
    ...assertRetailerPrimarySourceRoles(record.display.payload).violations.map((v) =>
      toViolation(v, 'sources.retailer_primary_not_context'),
    ),
  )
  violations.push(
    ...assertVariantMismatchEligibility(record.display.payload).violations.map((v) =>
      toViolation(v, 'sources.variant_mismatch'),
    ),
  )
  violations.push(...assertVariantMismatchHandling(record))
  violations.push(...assertDisplayArtifacts(record.display.payload))
  violations.push(...assertRiskBarContract(record.display.payload))
  violations.push(...assertNegativeScorePublicationPolicy(record))

  const checkIds = [
    'registry.product_type_configured',
    'registry.material_class_resolved',
    'display.canonical_id_leak',
    'transparency.badge_matches_disclosure',
    'transparency.unspecified_stainless_route',
    'secondary_materials.policy_show_all',
    'sources.retailer_primary_not_context',
    'sources.role_required',
    'ownership.namespace_split',
    'variant_mismatch.not_buy_cta',
    'variant_mismatch.exact_page_hidden',
    'display.artifact.html_extension',
    'risk_bars.invalid_id',
    'risk_bars.invalid_color_token',
    'negative_score.publication_copy_required',
  ]

  const checks: AprPreflightCheck[] = checkIds.map((check_id) => ({
    check_id,
    passed: !violations.some((v) => v.check_id === check_id),
    message: violations.find((v) => v.check_id === check_id)?.message ?? null,
  }))

  return { passed: violations.length === 0, violations, checks }
}
