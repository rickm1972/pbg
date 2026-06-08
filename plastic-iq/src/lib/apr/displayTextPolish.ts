/**
 * Render-time display text polish — capitalization only; does not rewrite descriptions.
 */

/** Capitalize the first letter after sentence boundaries (. ! ? + space). */
export function capitalizeDescriptionSentenceInitials(text: string): string {
  if (!text?.trim()) return text
  return text.replace(/([.!?]\s+)([a-z])/g, (_match, boundary: string, letter: string) => {
    return boundary + letter.toUpperCase()
  })
}
