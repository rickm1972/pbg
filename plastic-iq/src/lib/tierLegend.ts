/** V2.3.4 PAC Safety Score tier breakpoints (display ranges). */
export const PAC_TIER_LEGEND = [
  {
    label: 'Excellent',
    range: '90–99',
    tone: 'excellent' as const,
    description: 'Minimal PAC exposure pathways.',
  },
  {
    label: 'Good',
    range: '75–89',
    tone: 'good' as const,
    description: 'Generally low risk with some exposure considerations.',
  },
  {
    label: 'Caution',
    range: '55–74',
    tone: 'caution' as const,
    description: 'Meaningful exposure pathways; consider alternatives.',
  },
  {
    label: 'Concern',
    range: '30–54',
    tone: 'concern' as const,
    description: 'Significant exposure pathways or insufficient evidence.',
  },
  {
    label: 'High Risk',
    range: '0–29',
    tone: 'highrisk' as const,
    description: 'High likelihood of PAC exposure under normal use.',
  },
] as const

export type PacTierLegendTone = (typeof PAC_TIER_LEGEND)[number]['tone']
