import { ExternalLink } from 'lucide-react'
import type { Product, ProductTier } from '../types'

export type RetailerId = 'amazon' | 'target' | 'walmart' | 'other'

export type RetailerLink = {
  id: RetailerId
  url: string
  buyLabel: string
  viewLabel: string
}

function capitalizeWord(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
}

/** Primary buy link may live in amazon_url/affiliate_link even when it is DTC (not Amazon). */
function primaryBuyLinkLabels(
  url: string,
  brand?: string | null,
): Pick<RetailerLink, 'id' | 'buyLabel' | 'viewLabel'> {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes('amazon.') || host.includes('amzn.') || host === 'a.co') {
      return { id: 'amazon', buyLabel: 'Buy on Amazon', viewLabel: 'View on Amazon' }
    }
    if (host.includes('target.com')) {
      return { id: 'target', buyLabel: 'Buy on Target', viewLabel: 'View on Target' }
    }
    if (host.includes('walmart.com')) {
      return { id: 'walmart', buyLabel: 'Buy on Walmart', viewLabel: 'View on Walmart' }
    }
    const name = (brand || '').trim() || capitalizeWord(host.replace(/^www\./, '').split('.')[0] || 'Retailer')
    return { id: 'other', buyLabel: `Buy on ${name}`, viewLabel: `View on ${name}` }
  } catch {
    const name = (brand || '').trim() || 'Retailer'
    return { id: 'other', buyLabel: `Buy on ${name}`, viewLabel: `View on ${name}` }
  }
}

export function orderedRetailerLinks(
  product: Pick<
    Product,
    | 'brand'
    | 'affiliate_link'
    | 'amazon_url'
    | 'target_url'
    | 'walmart_url'
    | 'other_retailer_label'
    | 'other_retailer_url'
  >,
): RetailerLink[] {
  const amazon = (product.affiliate_link || product.amazon_url || '').trim()
  const out: RetailerLink[] = []
  if (amazon) {
    out.push({
      url: amazon,
      ...primaryBuyLinkLabels(amazon, product.brand),
    })
  }
  const target = (product.target_url || '').trim()
  if (target) {
    out.push({
      id: 'target',
      url: target,
      buyLabel: 'Buy on Target',
      viewLabel: 'View on Target',
    })
  }
  const walmart = (product.walmart_url || '').trim()
  if (walmart) {
    out.push({
      id: 'walmart',
      url: walmart,
      buyLabel: 'Buy on Walmart',
      viewLabel: 'View on Walmart',
    })
  }
  const other = (product.other_retailer_url || '').trim()
  if (other) {
    const name = (product.other_retailer_label || '').trim() || 'Retailer'
    out.push({
      id: 'other',
      url: other,
      buyLabel: `Buy on ${name}`,
      viewLabel: `View on ${name}`,
    })
  }
  return out
}

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

function isCautionOrHighRisk(tier: ProductTier) {
  return tier === 'Caution' || tier === 'Concern' || tier === 'High Risk'
}

export function RetailerBuyButtons({
  tier,
  links,
  className,
  size = 'default',
}: {
  tier: ProductTier
  links: RetailerLink[]
  className?: string
  size?: 'default' | 'compact'
}) {
  if (links.length === 0) return null
  const muted = isCautionOrHighRisk(tier)
  const btnPad =
    size === 'compact'
      ? 'rounded-2xl px-3 py-2 text-xs font-semibold'
      : 'rounded-2xl px-4 py-3 text-sm font-semibold'
  const icon = size === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      {links.map((link) => {
        const tone = muted ? mutedByRetailer[link.id] : solidByRetailer[link.id]
        const label = muted ? link.viewLabel : link.buyLabel
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className={`inline-flex w-full items-center justify-center gap-2 ${btnPad} ${tone}`}
          >
            {label}
            <ExternalLink className={`${icon} shrink-0 opacity-90`} />
          </a>
        )
      })}
    </div>
  )
}
