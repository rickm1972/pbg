import { Bot, Clock, Microscope, Shield } from 'lucide-react'
import type { ScoreBasis } from '../types'
import { cn } from '../lib/cn'

export function ScoreBasisBadge({ basis, className }: { basis: ScoreBasis; className?: string }) {
  const icon =
    basis === 'Lab Verified' ? (
      <Microscope className="h-4 w-4" />
    ) : basis === 'Based on Materials Science' ? (
      <Shield className="h-4 w-4" />
    ) : basis === 'AI Estimated' ? (
      <Bot className="h-4 w-4" />
    ) : (
      <Clock className="h-4 w-4" />
    )

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700',
        className,
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{basis}</span>
    </span>
  )
}

