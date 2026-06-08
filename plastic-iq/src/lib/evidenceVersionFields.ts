import type {
  AgentMetadata,
  EvidenceFact,
  EvidenceFieldProvenanceEntry,
  EvidenceSource,
  ProductEvidence,
  StructuredEvidencePayload,
} from '../types/agent'
import {
  getCanonicalApprovalBlockers,
  getRequiredEvidenceApprovalBlockers,
} from './canonicalEvidenceMapping'
import { getGate1ContradictionBlockers } from './gate1ContradictionBlockers'
import { isFormulationSubcategory } from './requiredEvidenceValidation'
import { getDisplayFacts } from './agent1Review'
import { getStructuredEvidence, getWarnings } from './evidenceMetadata'
import { buildFieldProvenance } from './evidenceFieldProvenance'

export type FieldEditAuditEntry = {
  path: string
  prior_value: string | null
  new_value: string
  edited_by: string
  edited_at: string
}

export type ReviewFieldRow = {
  path: string
  label: string
  value: string
  sourceUrl: string | null
  quote: string | null
  confidence: string | null
  editable: boolean
}

export type SourceFieldGroup = {
  sourceUrl: string
  sourceTitle: string
  sourceType: string | null
  fields: ReviewFieldRow[]
}

export function isLegacyEvidenceBundle(evidence: ProductEvidence): boolean {
  const structured = getStructuredEvidence(evidence.agent_metadata ?? {})
  const prov = evidence.field_provenance ?? {}
  const hasProvenance = Object.keys(prov).length > 0
  return !structured || !hasProvenance
}

export function canEditEvidenceVersion(evidence: ProductEvidence): boolean {
  return evidence.review_status === 'draft' || evidence.review_status === 'pending_review'
}

const PATH_LABELS: Record<string, string> = {
  'primary_contact_material.material_identity': 'Primary contact material',
  product_use_case: 'Product use case',
  'product_identity.product_name': 'Product name',
  'product_identity.brand': 'Brand',
  'product_identity.sku_or_model': 'SKU / model',
  'product_identity.subcategory': 'Subcategory',
}

function humanizePath(path: string): string {
  if (PATH_LABELS[path]) return PATH_LABELS[path]
  const sec = path.match(/^secondary_components\.(\d+)\.material_identity$/)
  if (sec) return `Secondary component (${Number(sec[1]) + 1})`
  const coat = path.match(/^coatings_and_finishes\.(\d+)\.coating_name$/)
  if (coat) return `Coating / finish (${Number(coat[1]) + 1})`
  const cert = path.match(/^certifications\.verified\.(\d+)\.cert_name$/)
  if (cert) return `Verified certification (${Number(cert[1]) + 1})`
  const claim = path.match(/^safety_claims\.(.+)$/)
  if (claim) return claim[1].replace(/_/g, ' ')
  return path.replace(/[._]/g, ' ')
}

function rowsFromProvenance(
  provenance: Record<string, EvidenceFieldProvenanceEntry>,
  editable: boolean,
): ReviewFieldRow[] {
  return Object.entries(provenance).map(([path, entry]) => ({
    path,
    label: humanizePath(path),
    value: entry.value ?? '',
    sourceUrl: entry.source_url ?? null,
    quote: entry.source_quote ?? null,
    confidence: entry.confidence_label ?? null,
    editable,
  }))
}

function rowsFromLegacyFacts(facts: EvidenceFact[]): ReviewFieldRow[] {
  return getDisplayFacts(facts).map((f) => ({
    path: `legacy.fact.${f.fact_key}`,
    label: f.fact_key.replace(/_/g, ' '),
    value: formatFactValueForRow(f.fact_value),
    sourceUrl: f.source_url ?? null,
    quote: f.excerpt ?? null,
    confidence: f.confidence ?? null,
    editable: false,
  }))
}

function formatFactValueForRow(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function extractReviewFieldRows(evidence: ProductEvidence): ReviewFieldRow[] {
  const editable = canEditEvidenceVersion(evidence)
  const provenance = evidence.field_provenance ?? {}
  if (Object.keys(provenance).length > 0) {
    return rowsFromProvenance(provenance, editable)
  }

  const structured = getStructuredEvidence(evidence.agent_metadata ?? {})
  if (structured) {
    const rebuilt = buildFieldProvenance(structured, evidence.sources ?? [])
    if (Object.keys(rebuilt).length > 0) {
      return rowsFromProvenance(rebuilt, editable)
    }
  }

  return rowsFromLegacyFacts(evidence.facts ?? [])
}

export function groupFieldsBySource(
  rows: ReviewFieldRow[],
  sources: EvidenceSource[],
): SourceFieldGroup[] {
  const byUrl = new Map<string, ReviewFieldRow[]>()
  const unattributed: ReviewFieldRow[] = []

  for (const row of rows) {
    const url = row.sourceUrl?.trim()
    if (!url) {
      unattributed.push(row)
      continue
    }
    const list = byUrl.get(url) ?? []
    list.push(row)
    byUrl.set(url, list)
  }

  const sourceMeta = new Map(sources.map((s) => [s.url, s]))
  const groups: SourceFieldGroup[] = []

  for (const [url, fields] of byUrl) {
    const src = sourceMeta.get(url)
    groups.push({
      sourceUrl: url,
      sourceTitle: src?.title?.trim() || url,
      sourceType: src?.source_type ?? null,
      fields: fields.sort((a, b) => a.label.localeCompare(b.label)),
    })
  }

  groups.sort((a, b) => a.sourceTitle.localeCompare(b.sourceTitle))

  if (unattributed.length > 0) {
    groups.push({
      sourceUrl: '',
      sourceTitle: 'No source URL on record',
      sourceType: null,
      fields: unattributed,
    })
  }

  return groups
}

/** Apply a single field edit to structured_evidence (draft / pending_review only). */
export function applyFieldValueEdit(
  structured: StructuredEvidencePayload,
  path: string,
  newValue: string,
): StructuredEvidencePayload {
  const clone = structuredDeepClone(structured)
  const v = newValue.trim()

  if (path === 'primary_contact_material.material_identity') {
    if (!clone.primary_contact_material) return clone
    clone.primary_contact_material.material_identity = v
    clone.primary_contact_material.undisclosed_code = null
    return clone
  }

  if (path === 'product_use_case') {
    clone.product_use_case = v
    return clone
  }

  const piMatch = path.match(/^product_identity\.(product_name|brand|subcategory|sku_or_model)$/)
  if (piMatch && clone.product_identity) {
    const key = piMatch[1] as keyof import('../types/agent').StructuredProductIdentity
    clone.product_identity[key] = v
    return clone
  }

  const secMatch = path.match(/^secondary_components\.(\d+)\.material_identity$/)
  if (secMatch) {
    const i = Number(secMatch[1])
    if (clone.secondary_components?.[i]) {
      clone.secondary_components[i].material_identity = v
    }
    return clone
  }

  const coatMatch = path.match(/^coatings_and_finishes\.(\d+)\.coating_name$/)
  if (coatMatch) {
    const i = Number(coatMatch[1])
    const row = clone.coatings_and_finishes?.[i]
    if (row) {
      const paren = v.match(/^(.+?)\s+\(([^)]+)\)\s*$/)
      if (paren) {
        row.coating_name = paren[1].trim()
        row.coating_type = paren[2].trim() as typeof row.coating_type
      } else {
        row.coating_name = v
      }
    }
    return clone
  }

  const certMatch = path.match(/^certifications\.verified\.(\d+)\.cert_name$/)
  if (certMatch) {
    const i = Number(certMatch[1])
    const row = clone.certifications?.verified_certifications?.[i]
    if (row) row.cert_name = v
    return clone
  }

  const claimMatch = path.match(/^safety_claims\.(.+)$/)
  if (claimMatch && clone.safety_claims) {
    const key = claimMatch[1] as keyof typeof clone.safety_claims
    const claim = clone.safety_claims[key]
    if (claim && typeof claim === 'object' && 'claimed' in claim) {
      claim.claimed = v === 'true' || v === 'yes' || v === '1'
    }
    return clone
  }

  return clone
}

function structuredDeepClone(structured: StructuredEvidencePayload): StructuredEvidencePayload {
  return JSON.parse(JSON.stringify(structured)) as StructuredEvidencePayload
}

export function getFieldEditAudit(metadata: AgentMetadata): FieldEditAuditEntry[] {
  const raw = (metadata as AgentMetadata & { field_edit_audit?: FieldEditAuditEntry[] })
    .field_edit_audit
  return Array.isArray(raw) ? raw : []
}

export function appendFieldEditAudit(
  metadata: AgentMetadata,
  entry: FieldEditAuditEntry,
): AgentMetadata {
  const prior = getFieldEditAudit(metadata)
  return { ...metadata, field_edit_audit: [...prior, entry] }
}

export type ApprovalBlockers = {
  canApprove: boolean
  reasons: string[]
}

export function getApprovalBlockers(params: {
  evidence: ProductEvidence
  warningsAcknowledged: boolean
  allFieldsConfirmed: boolean
  /** All score-driving canonical rows confirmed in Gate 1 taxonomy table */
  canonicalReviewConfirmed?: boolean
}): ApprovalBlockers {
  const { evidence, warningsAcknowledged, allFieldsConfirmed, canonicalReviewConfirmed } = params
  const reasons: string[] = []
  const warnings = getWarnings(evidence.agent_metadata ?? {})
  const threshold = evidence.agent_metadata?.minimum_threshold

  if (isLegacyEvidenceBundle(evidence)) {
    reasons.push('Legacy bundle — re-run Agent 1 for structured provenance before approval.')
  }

  if (!canEditEvidenceVersion(evidence)) {
    reasons.push('This evidence version is not editable.')
  }

  if (warnings.length > 0 && !warningsAcknowledged) {
    reasons.push('Acknowledge validation warnings before approving.')
  }

  const structured = getStructuredEvidence(evidence.agent_metadata ?? {})
  const subcategory = structured?.product_identity?.subcategory ?? ''
  const usesRequiredEvidenceMatrix =
    structured?.required_evidence_validation?.schema_version === '3.6' &&
    !isFormulationSubcategory(subcategory)

  if (
    !allFieldsConfirmed &&
    !isLegacyEvidenceBundle(evidence) &&
    !usesRequiredEvidenceMatrix
  ) {
    reasons.push('Confirm each extracted field (or edit and confirm) before approving.')
  }

  if (threshold && !threshold.met && !usesRequiredEvidenceMatrix && !isFormulationSubcategory(subcategory)) {
    reasons.push('Minimum threshold checks have not all passed.')
  }

  if (usesRequiredEvidenceMatrix) {
    for (const b of getRequiredEvidenceApprovalBlockers(structured)) {
      reasons.push(b)
    }
    if (canonicalReviewConfirmed === false) {
      reasons.push('Confirm each canonical score-driving field in the taxonomy table before approving.')
    }
  }

  for (const b of getGate1ContradictionBlockers(structured)) {
    if (!reasons.includes(b)) reasons.push(b)
  }
  if (structured && !structured.primary_contact_material?.material_identity?.trim()) {
    reasons.push('Primary contact material is required.')
  }

  if (structured && !isLegacyEvidenceBundle(evidence) && !usesRequiredEvidenceMatrix) {
    const canonicalBlockers = getCanonicalApprovalBlockers(structured.canonical_mappings, {
      subcategory: structured.product_identity?.subcategory,
    })
    for (const b of canonicalBlockers) {
      reasons.push(b)
    }
  }

  return { canApprove: reasons.length === 0, reasons }
}

export { sourceLabelForUrl } from './evidenceSourceLabels'
