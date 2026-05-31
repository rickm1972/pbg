import type { PersonaContent } from '../types/persona'

export function formatPersonaDisplayName(content: PersonaContent): string {
  const name = content.persona_name?.trim() ?? ''
  const nick = content.persona_nickname?.trim() ?? ''
  if (name && nick) return `${name}, ${nick}`
  return name || nick || ''
}

/** One-line header blurb — never the full summary paragraph. */
export function personaTagline(content: PersonaContent, fallbackTarget?: string): string {
  const oneLiner = content.summary_one_liner?.trim()
  if (oneLiner) return oneLiner

  const summary = content.summary?.trim()
  if (summary) {
    const firstSentence = summary.match(/^[\s\S]*?[.!?](?:\s|$)/)?.[0]?.trim()
    if (firstSentence && firstSentence.length < summary.length) return firstSentence
    if (summary.length <= 160) return summary
    return `${summary.slice(0, 157).trim()}…`
  }

  return fallbackTarget?.trim() ?? ''
}

export function personaExportFilename(name: string | null | undefined): string {
  const base = (name || 'persona')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base || 'persona'}.pdf`
}
