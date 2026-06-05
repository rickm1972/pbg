import type { AgentMetadata, StructuredEvidencePayload } from '../types/agent'

export function getWarnings(metadata: AgentMetadata): string[] {
  return metadata.warnings ?? []
}

export function getStructuredEvidence(
  metadata: AgentMetadata,
): StructuredEvidencePayload | null {
  return metadata.structured_evidence ?? null
}
