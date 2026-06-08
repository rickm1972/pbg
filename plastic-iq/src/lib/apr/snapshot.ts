/**
 * APR snapshot assembly, hash-chain validation, and immutability helpers.
 */

import type {
  AprDisplaySnapshot,
  AprEvidenceSnapshot,
  AprGate,
  AprGateSnapshot,
  AprNormalizationSnapshot,
  AprParentHashes,
  AprQaSnapshot,
  AprScoreSnapshot,
  ApprovedProductRecord,
} from '../../types/apr'
import { APR_SCHEMA_VERSION } from '../../types/apr'
import { contentHash, hashAssembledApr, hashGatePayload } from './contentHash'

export type CreateGateSnapshotInput<TPayload> = {
  snapshot_id: string
  product_id: string
  gate: AprGate
  approved_at: string
  parent_hashes?: AprParentHashes
  payload: TPayload
}

/** Build an immutable gate snapshot with content hash over payload only. */
export function createGateSnapshot<TPayload>(
  input: CreateGateSnapshotInput<TPayload>,
): AprGateSnapshot<TPayload> {
  const payloadHash = hashGatePayload(input.payload)
  return {
    snapshot_id: input.snapshot_id,
    product_id: input.product_id,
    gate: input.gate,
    schema_version: APR_SCHEMA_VERSION,
    content_hash: payloadHash,
    approved_at: input.approved_at,
    parent_hashes: input.parent_hashes ?? {},
    payload: Object.freeze(structuredClone(input.payload)) as TPayload,
  }
}

/** Assert snapshot content_hash matches recomputed hash — detects in-place mutation. */
export function assertSnapshotIntegrity<TPayload>(
  snapshot: AprGateSnapshot<TPayload>,
): { valid: boolean; expected_hash: string; reason?: string } {
  const expected = hashGatePayload(snapshot.payload)
  if (snapshot.content_hash !== expected) {
    return {
      valid: false,
      expected_hash: expected,
      reason: `Snapshot ${snapshot.gate} content_hash mismatch — record may have been mutated in place.`,
    }
  }
  return { valid: true, expected_hash: expected }
}

export type HashChainValidation = {
  valid: boolean
  stale_gates: AprGate[]
  errors: string[]
}

/** Verify downstream snapshots reference correct upstream content hashes. */
export function validateAprHashChain(record: ApprovedProductRecord): HashChainValidation {
  const errors: string[] = []
  const stale_gates: AprGate[] = []

  const evidenceHash = record.evidence.content_hash
  const normalizationHash = record.normalization.content_hash
  const displayHash = record.display.content_hash
  const scoreHash = record.score.content_hash

  const checkParent = (
    gate: AprGate,
    snapshot: AprGateSnapshot<unknown>,
    expectedParents: Partial<Record<AprGate, string>>,
  ) => {
    for (const [parentGate, expectedHash] of Object.entries(expectedParents) as [AprGate, string][]) {
      const actual = snapshot.parent_hashes[parentGate]
      if (!actual) {
        errors.push(`${gate} snapshot missing parent_hashes.${parentGate}`)
        stale_gates.push(gate)
      } else if (actual !== expectedHash) {
        errors.push(
          `${gate} parent_hashes.${parentGate} stale: expected ${expectedHash}, got ${actual}`,
        )
        stale_gates.push(gate)
      }
    }
  }

  checkParent('normalization', record.normalization, { evidence: evidenceHash })
  checkParent('display', record.display, {
    evidence: evidenceHash,
    normalization: normalizationHash,
  })
  checkParent('score', record.score, {
    normalization: normalizationHash,
    display: displayHash,
  })
  checkParent('qa', record.qa, {
    score: scoreHash,
    display: displayHash,
  })

  for (const gate of ['evidence', 'normalization', 'display', 'score', 'qa'] as const) {
    const snapshot = record[gate] as AprGateSnapshot<unknown>
    const integrity = assertSnapshotIntegrity(snapshot)
    if (!integrity.valid) {
      errors.push(integrity.reason ?? `${gate} integrity failed`)
      stale_gates.push(gate)
    }
  }

  const expectedAssembled = hashAssembledApr(record)
  if (record.assembled_content_hash !== expectedAssembled) {
    errors.push(
      `assembled_content_hash stale: expected ${expectedAssembled}, got ${record.assembled_content_hash}`,
    )
  }

  return {
    valid: errors.length === 0,
    stale_gates: [...new Set(stale_gates)],
    errors,
  }
}

export type AssembleAprInput = {
  apr_id: string
  product_id: string
  assembled_at: string
  evidence: AprEvidenceSnapshot
  normalization: AprNormalizationSnapshot
  display: AprDisplaySnapshot
  score: AprScoreSnapshot
  qa: AprQaSnapshot
}

/** Assemble a fully-approved APR from four gate snapshots. */
export function assembleApprovedProductRecord(input: AssembleAprInput): ApprovedProductRecord {
  const partial = {
    schema_version: APR_SCHEMA_VERSION,
    product_id: input.product_id,
    evidence: input.evidence,
    normalization: input.normalization,
    display: input.display,
    score: input.score,
    qa: input.qa,
  }
  return {
    apr_id: input.apr_id,
    product_id: input.product_id,
    schema_version: APR_SCHEMA_VERSION,
    assembled_at: input.assembled_at,
    assembled_content_hash: hashAssembledApr(partial),
    evidence: input.evidence,
    normalization: input.normalization,
    display: input.display,
    score: input.score,
    qa: input.qa,
  }
}

/** Detect whether a downstream gate must be re-approved after upstream change. */
export function gatesStaleAfterUpstreamChange(
  oldRecord: ApprovedProductRecord,
  newUpstream: Partial<Pick<ApprovedProductRecord, 'evidence' | 'normalization' | 'display' | 'score'>>,
): AprGate[] {
  const stale: AprGate[] = []
  if (
    newUpstream.evidence &&
    newUpstream.evidence.content_hash !== oldRecord.evidence.content_hash
  ) {
    stale.push('normalization', 'display', 'score', 'qa')
  }
  if (
    newUpstream.normalization &&
    newUpstream.normalization.content_hash !== oldRecord.normalization.content_hash
  ) {
    stale.push('display', 'score', 'qa')
  }
  if (newUpstream.display && newUpstream.display.content_hash !== oldRecord.display.content_hash) {
    stale.push('score', 'qa')
  }
  if (newUpstream.score && newUpstream.score.content_hash !== oldRecord.score.content_hash) {
    stale.push('qa')
  }
  return [...new Set(stale)]
}

/** Immutability guard — throw if attempting to mutate a frozen snapshot payload. */
export function freezeGateSnapshot<TPayload>(
  snapshot: AprGateSnapshot<TPayload>,
): AprGateSnapshot<TPayload> {
  Object.freeze(snapshot.payload as object)
  Object.freeze(snapshot.parent_hashes)
  return Object.freeze(snapshot) as AprGateSnapshot<TPayload>
}

/** Verify display snapshot does not embed scoring component rows (namespace split). */
export function assertDisplayNamespaceSeparation(
  normalization: AprNormalizationSnapshot,
  display: AprDisplaySnapshot,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const displayJson = JSON.stringify(display.payload)

  for (const component of normalization.payload.components) {
    const materialId = component.material_id ?? component.material
    if (materialId && displayJson.includes(String(materialId))) {
      errors.push(
        `display payload contains scoring material_id "${materialId}" — canonical IDs must not appear in display.* strings`,
      )
    }
    if (component.material_hazard_table_entry && displayJson.includes(component.material_hazard_table_entry)) {
      errors.push(
        `display payload contains hazard table entry "${component.material_hazard_table_entry}" from components[]`,
      )
    }
  }

  const forbiddenKeys = ['components', 'material_hazard', 'adjusted_migration_potential', 'contact_intimacy']
  for (const key of forbiddenKeys) {
    if (key in (display.payload as Record<string, unknown>)) {
      errors.push(`display payload must not contain scoring key "${key}"`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/** Recompute hash for display-only correction workflow (new snapshot, same evidence/score). */
export function displayCorrectionRequiresScoreRerun(
  prior: AprDisplaySnapshot,
  next: AprDisplaySnapshot,
  normalization: AprNormalizationSnapshot,
): boolean {
  if (next.payload.normalization_content_hash !== normalization.content_hash) return true
  if (next.payload.evidence_content_hash !== prior.payload.evidence_content_hash) return true
  return false
}

/** Stable id for persistence layer rows. */
export function snapshotRowId(productId: string, gate: AprGate, contentHashValue: string): string {
  return contentHash({ productId, gate, contentHashValue }).slice(0, 32)
}
