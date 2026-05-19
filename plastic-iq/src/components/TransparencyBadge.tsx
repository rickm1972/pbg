import { Shield } from 'lucide-react'
import { transparencyBadgeStyle } from '../lib/transparencyBadge'

type Props = {
  badge: string
  className?: string
}

export function TransparencyBadge({ badge, className = '' }: Props) {
  const style = transparencyBadgeStyle(badge)
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl px-2.5 py-1 text-xs font-semibold ring-1 ${style.bg} ${style.ring} ${style.text} ${className}`}
    >
      <Shield className={`h-3.5 w-3.5 shrink-0 ${style.icon}`} strokeWidth={2.5} />
      {badge}
    </span>
  )
}
