import type { AgentMetadata, StructuredEvidencePayload } from '../types/agent'
import { collectGate1AcknowledgmentWarnings } from '../shared/agent1/approval-gating-contract.mjs'

export function getWarnings(metadata: AgentMetadata): string[] {
  return collectGate1AcknowledgmentWarnings(metadata)
}

export function getStructuredEvidence(
  metadata: AgentMetadata,
): StructuredEvidencePayload | null {
  return metadata.structured_evidence ?? null
}
