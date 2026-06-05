import { ExternalLink } from 'lucide-react'
import {
  publicRetailerCtaLabel,
  usePublicRetailerMutedStyle,
  type RetailerId,
  type RetailerLink,
} from '../lib/retailerLinks'
import type { ProductTier } from '../types'

export type { RetailerId, RetailerLink }
export { orderedRetailerLinks } from '../lib/retailerLinks'

const solidByRetailer: Record<RetailerId, string> = {
  amazon: 'bg-[#232F3E] text-white hover:bg-[#131921]',
  target: 'bg-[#CC0000] text-white hover:bg-[#b00000]',
  walmart: 'bg-[#0071CE] text-white hover:bg-[#005aad]',
  other: 'bg-slate-800 text-white hover:bg-slate-900',
}

const mutedByRetailer: Record<RetailerId, string> = {
  amazon: 'border border-slate-200 bg-slate-100 text-[#232F3E] hover:bg-slate-200',
  target: 'border border-slate-200 bg-slate-100 text-[#CC0000] hover:bg-slate-200',
  walmart: 'border border-slate-200 bg-slate-100 text-[#0071CE] hover:bg-slate-200',
  other: 'border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200',
}

export function RetailerBuyButtons({
  tier,
  pacScore,
  links,
  className,
  size = 'default',
}: {
  tier: ProductTier
  pacScore?: number
  links: RetailerLink[]
  className?: string
  size?: 'default' | 'compact'
}) {
  if (links.length === 0) return null
  const muted = usePublicRetailerMutedStyle(tier, pacScore)
  const btnPad =
    size === 'compact'
      ? 'rounded-2xl px-3 py-2 text-xs font-semibold'
      : 'rounded-2xl px-4 py-3 text-sm font-semibold'
  const icon = size === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <ul className={`flex list-none flex-col gap-2.5 p-0 ${className ?? ''}`}>
      {links.map((link) => {
        const tone = muted ? mutedByRetailer[link.id] : solidByRetailer[link.id]
        const label = publicRetailerCtaLabel(link, tier, muted)
        return (
          <li key={link.id} className="min-w-0">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className={`flex w-full items-center justify-center gap-2 ${btnPad} ${tone}`}
          >
            {label}
            <ExternalLink className={`${icon} shrink-0 opacity-90`} />
          </a>
          </li>
        )
      })}
    </ul>
  )
}
