import type { EvidenceSource } from '../types/agent'

export function sourceLabelForUrl(url: string, sources: EvidenceSource[]): string {
  const match = sources.find((s) => s.url === url)
  if (!match) return url
  const type = match.source_type?.replace(/_/g, ' ') ?? 'source'
  return match.title?.trim() ? `${match.title.trim()} (${type})` : `${type} page`
}
