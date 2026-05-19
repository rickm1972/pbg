/** V2.3.3 PAC Safety Score tier breakpoints (display ranges). */
export const PAC_TIER_LEGEND = [
  { label: 'Excellent', range: '90–99', tone: 'excellent' as const },
  { label: 'Good', range: '75–89', tone: 'good' as const },
  { label: 'Caution', range: '55–74', tone: 'caution' as const },
  { label: 'Concern', range: '30–54', tone: 'concern' as const },
  { label: 'High Risk', range: '0–29', tone: 'highrisk' as const },
] as const

export type PacTierLegendTone = (typeof PAC_TIER_LEGEND)[number]['tone']
