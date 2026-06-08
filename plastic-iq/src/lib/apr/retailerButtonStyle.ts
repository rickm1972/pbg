import type { AprDisplayBuyCta } from '../../types/apr'
import type { RetailerId } from '../retailerLinks'
import { isAmazonHost } from '../publicRetailerHostLabels'

export type RetailerButtonStyle = RetailerId | 'williams-sonoma'

export const solidByRetailer: Record<RetailerButtonStyle, string> = {
  amazon: 'bg-[#232F3E] text-white hover:bg-[#131921]',
  target: 'bg-[#CC0000] text-white hover:bg-[#b00000]',
  walmart: 'bg-[#0071CE] text-white hover:bg-[#005aad]',
  'williams-sonoma': 'bg-[#1A1A1A] text-white hover:bg-black',
  other: 'bg-slate-800 text-white hover:bg-slate-900',
}

export const mutedByRetailer: Record<RetailerButtonStyle, string> = {
  amazon: 'border border-slate-200 bg-slate-100 text-[#232F3E] hover:bg-slate-200',
  target: 'border border-slate-200 bg-slate-100 text-[#CC0000] hover:bg-slate-200',
  walmart: 'border border-slate-200 bg-slate-100 text-[#0071CE] hover:bg-slate-200',
  'williams-sonoma': 'border border-slate-200 bg-slate-100 text-[#1A1A1A] hover:bg-slate-200',
  other: 'border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200',
}

/** Map display buy CTA to retailer palette key (layout-only; label text comes from display). */
export function retailerButtonStyleFromBuyCta(cta: AprDisplayBuyCta): RetailerButtonStyle {
  try {
    const host = new URL(cta.url).hostname.toLowerCase()
    if (isAmazonHost(host)) return 'amazon'
    if (host.includes('target.com')) return 'target'
    if (host.includes('walmart.com')) return 'walmart'
    if (host.includes('williams-sonoma.com')) return 'williams-sonoma'
  } catch {
    /* fall through to label */
  }
  const label = cta.label.toLowerCase()
  if (label.includes('amazon')) return 'amazon'
  if (label.includes('target')) return 'target'
  if (label.includes('walmart')) return 'walmart'
  if (label.includes('williams sonoma')) return 'williams-sonoma'
  return 'other'
}

export function retailerIdFromBuyCta(cta: AprDisplayBuyCta): RetailerId {
  const style = retailerButtonStyleFromBuyCta(cta)
  return style === 'williams-sonoma' ? 'other' : style
}
