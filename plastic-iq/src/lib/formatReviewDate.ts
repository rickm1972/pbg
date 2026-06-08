/** Format frozen snapshot review date for public display. */
export function formatReviewDate(isoOrDate: string): string {
  const date = isoOrDate.includes('T') ? isoOrDate.split('T')[0] : isoOrDate
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoOrDate
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
