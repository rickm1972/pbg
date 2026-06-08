import { ExternalLink } from 'lucide-react'
import type { AprDisplayBuyCta } from '../types/apr'
import type { ProductTier } from '../types'
import { buyButtonsUseMutedStyle } from '../lib/apr/pageChrome'
import {
  mutedByRetailer,
  retailerButtonStyleFromBuyCta,
  solidByRetailer,
} from '../lib/apr/retailerButtonStyle'

type Props = {
  tier: ProductTier
  buyCta: AprDisplayBuyCta[]
  className?: string
  size?: 'default' | 'compact'
}

export { retailerButtonStyleFromBuyCta, retailerIdFromBuyCta } from '../lib/apr/retailerButtonStyle'

export function RetailerBuyButtons({
  tier,
  buyCta,
  className,
  size = 'default',
}: Props) {
  if (buyCta.length === 0) return null
  const muted = buyButtonsUseMutedStyle(tier)
  const btnPad =
    size === 'compact'
      ? 'rounded-2xl px-3 py-2 text-xs font-semibold'
      : 'rounded-2xl px-4 py-3 text-sm font-semibold'
  const icon = size === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <ul className={`flex list-none flex-col gap-2.5 p-0 ${className ?? ''}`}>
      {buyCta.map((cta) => {
        const styleKey = retailerButtonStyleFromBuyCta(cta)
        const tone = muted ? mutedByRetailer[styleKey] : solidByRetailer[styleKey]
        return (
          <li key={cta.url} className="min-w-0">
            <a
              href={cta.url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className={`flex w-full items-center justify-center gap-2 ${btnPad} ${tone}`}
            >
              {cta.label}
              <ExternalLink className={`${icon} shrink-0 opacity-90`} />
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/** @deprecated Safer-alternative rows use alternativeProductBuyCtas from lib/apr. */
export function alternativeListingUrl(product: {
  affiliate_link?: string | null
  amazon_url?: string | null
  target_url?: string | null
  walmart_url?: string | null
  other_retailer_url?: string | null
}): string | null {
  for (const url of [
    product.affiliate_link,
    product.amazon_url,
    product.target_url,
    product.walmart_url,
    product.other_retailer_url,
  ]) {
    if (typeof url === 'string' && url.trim()) return url.trim()
  }
  return null
}
