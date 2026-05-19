import type { Product } from '../types'
import { mergeCatalogRetailerLinks } from './retailerLinksCatalog'

/** Stored in score_details.data_sources when products.* URL columns are missing. */
export const RETAIL_LINKS_SIDECAR_PREFIX = 'PACSCORE_LINKS_JSON:'

export type RetailLinksSidecar = {
  target_url?: string | null
  walmart_url?: string | null
  other_retailer_label?: string | null
  other_retailer_url?: string | null
  /**
   * On product **updates**, empty Target/Walmart fields mean "do not refill from catalog"
   * (see mergeCatalogRetailerLinks). Omitted on initial create so catalog defaults still apply.
   */
  retail_cleared?: ('target' | 'walmart')[]
}

export function hasRetailUrl(v: string | null | undefined): boolean {
  return Boolean(v && String(v).trim().length)
}

export function parseRetailLinksSidecar(
  data_sources: string | null | undefined,
): RetailLinksSidecar | null {
  const raw = (data_sources ?? '').trim()
  if (!raw.startsWith(RETAIL_LINKS_SIDECAR_PREFIX)) return null
  try {
    const parsed = JSON.parse(raw.slice(RETAIL_LINKS_SIDECAR_PREFIX.length)) as RetailLinksSidecar
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function stringifyRetailLinksSidecar(data: RetailLinksSidecar): string {
  return RETAIL_LINKS_SIDECAR_PREFIX + JSON.stringify(data)
}

function applyRetailClearFlags(product: Product, sidecar: RetailLinksSidecar | null): Product {
  if (!sidecar?.retail_cleared?.length) return product
  const p = { ...product }
  if (sidecar.retail_cleared.includes('target')) p.target_url = null
  if (sidecar.retail_cleared.includes('walmart')) p.walmart_url = null
  return p
}

/** Overlay sidecar URLs only where the product row has no value; respect retail_cleared. */
export function applyRetailLinksSidecar(product: Product, sidecar: RetailLinksSidecar | null): Product {
  if (!sidecar) return product
  const p = { ...product }
  const blockT = sidecar.retail_cleared?.includes('target')
  const blockW = sidecar.retail_cleared?.includes('walmart')
  if (!blockT && !hasRetailUrl(p.target_url) && hasRetailUrl(sidecar.target_url))
    p.target_url = String(sidecar.target_url).trim()
  if (!blockW && !hasRetailUrl(p.walmart_url) && hasRetailUrl(sidecar.walmart_url))
    p.walmart_url = String(sidecar.walmart_url).trim()
  if (!hasRetailUrl(p.other_retailer_label) && hasRetailUrl(sidecar.other_retailer_label))
    p.other_retailer_label = String(sidecar.other_retailer_label).trim()
  if (!hasRetailUrl(p.other_retailer_url) && hasRetailUrl(sidecar.other_retailer_url))
    p.other_retailer_url = String(sidecar.other_retailer_url).trim()
  return p
}

export type ProductRowWithScoreDetails = Product & {
  score_details?: { data_sources: string | null }[] | null
}

export function normalizeProductRow(row: ProductRowWithScoreDetails): Product {
  const { score_details: sd, ...rest } = row
  const sidecar = parseRetailLinksSidecar(sd?.[0]?.data_sources ?? null)
  // Sidecar (and DB) URLs must apply before catalog defaults; otherwise catalog fills empty
  // slots and applyRetailLinksSidecar would skip overlaying an already-non-empty field.
  const withSidecar = applyRetailLinksSidecar(rest as Product, sidecar)
  const merged = mergeCatalogRetailerLinks(withSidecar)
  return applyRetailClearFlags(merged, sidecar)
}

export const PRODUCT_SELECT_WITH_SCORE = '*, score_details ( data_sources )' as const
