import type { ProductTier, ScoreBasis } from '../types'

/** Minimum PAC score for Good tier (75–89). Below this: Caution, Concern, or High Risk. */
export const GOOD_TIER_MIN_SCORE = 75

export function tierForScore(score: number): ProductTier {
  if (score >= 90) return 'Excellent'
  if (score >= GOOD_TIER_MIN_SCORE) return 'Good'
  if (score >= 55) return 'Caution'
  if (score >= 30) return 'Concern'
  return 'High Risk'
}

/** Product pages: Safer alternatives + muted retailer CTAs when score is under Good tier. */
export function isBelowGoodTier(score: number): boolean {
  return Number.isFinite(score) && score < GOOD_TIER_MIN_SCORE
}

export function showsSaferAlternatives(score: number): boolean {
  return isBelowGoodTier(score)
}

const EXCELLENT_MIN_SCORE = 90

/** True when product is Good (75+) or Excellent (90+) tier by score or stored tier. */
export function isGoodOrExcellentProduct(score: number, tier?: string | null): boolean {
  const resolved = (tier as ProductTier | null) ?? tierForScore(score)
  if (resolved === 'Excellent' || resolved === 'Good') return true
  return score >= GOOD_TIER_MIN_SCORE
}

export function isExcellentProduct(score: number, tier?: string | null): boolean {
  const resolved = (tier as ProductTier | null) ?? tierForScore(score)
  return resolved === 'Excellent' || score >= EXCELLENT_MIN_SCORE
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

