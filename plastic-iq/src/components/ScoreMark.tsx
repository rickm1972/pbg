import type { ProductTier } from '../types'
import { cn } from '../lib/cn'
import { colorForTier } from '../lib/score'

export function ScoreMark({
  score,
  tier,
  size = 'md',
  scoreLabel = 'PAC Safety Score',
}: {
  score: number
  tier: ProductTier
  size?: 'sm' | 'md' | 'lg'
  /** Accessible label prefix, e.g. "Materials Safety" */
  scoreLabel?: string
}) {
  const c = colorForTier(tier)

  const dims = size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-14 w-14' : 'h-14 w-14'
  const num = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-xl' : 'text-2xl'
  const lbl = size === 'lg' ? 'text-[10px]' : 'text-[10px]'

  return (
    <div
      className={cn(
        'grid place-items-center rounded-2xl bg-white ring-1 shadow-sm',
        dims,
        c.ring,
      )}
      aria-label={`${scoreLabel} ${score} (${tier})`}
      title={`${scoreLabel} ${score} (${tier})`}
    >
      <div className="flex flex-col items-center justify-center text-center">
        <div className={cn('font-bold tabular-nums leading-none', num, c.text)}>{score}</div>
        <div className={cn('mt-1 font-bold leading-none', lbl, c.text)}>{tier}</div>
      </div>
    </div>
  )
}

