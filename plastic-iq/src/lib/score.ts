import type { ProductTier, ScoreBasis } from '../types'

export function tierForScore(score: number): ProductTier {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 55) return 'Caution'
  if (score >= 30) return 'Concern'
  return 'High Risk'
}

export function colorForTier(tier: ProductTier): {
  text: string
  bg: string
  ring: string
  border: string
} {
  switch (tier) {
    case 'Excellent':
      return {
        text: 'text-excellent',
        bg: 'bg-excellent/10',
        ring: 'ring-excellent/20',
        border: 'border-excellent/25',
      }
    case 'Good':
      return { text: 'text-good', bg: 'bg-good/10', ring: 'ring-good/20', border: 'border-good/25' }
    case 'Caution':
      return {
        text: 'text-caution',
        bg: 'bg-caution/10',
        ring: 'ring-caution/20',
        border: 'border-caution/25',
      }
    case 'Concern':
      return {
        text: 'text-concern',
        bg: 'bg-concern/10',
        ring: 'ring-concern/20',
        border: 'border-concern/25',
      }
    case 'High Risk':
      return {
        text: 'text-highrisk',
        bg: 'bg-highrisk/10',
        ring: 'ring-highrisk/20',
        border: 'border-highrisk/25',
      }
  }
}

export function iconForScoreBasis(basis: ScoreBasis) {
  switch (basis) {
    case 'Lab Verified':
      return 'microscope'
    case 'Based on Materials Science':
      return 'shield'
    case 'AI Estimated':
      return 'bot'
    case 'In Testing Queue':
      return 'clock'
  }
}

