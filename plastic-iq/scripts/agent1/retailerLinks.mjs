/** Mirrors src/lib/retailerLinksSidecar.ts + retailerLinksCatalog merge for Agent 1 (Node). */

const SIDECAR_PREFIX = 'PACSCORE_LINKS_JSON:'

export const RETAILER_LINKS_BY_PRODUCT_NAME = {
  'Lodge 10.25 Inch Cast Iron Skillet': {
    target_url: 'https://www.target.com/p/lodge-10-25-cast-iron-skillet/-/A-10291925',
    walmart_url: 'https://www.walmart.com/ip/Lodge-Cast-Iron-Seasoned-12-Skillet/5969628',
  },
}

function hasUrl(v) {
  return Boolean(v && String(v).trim().length)
}

function parseSidecar(dataSources) {
  const raw = (dataSources ?? '').trim()
  if (!raw.startsWith(SIDECAR_PREFIX)) return null
  try {
    return JSON.parse(raw.slice(SIDECAR_PREFIX.length))
  } catch {
    return null
  }
}

function mergeCatalog(product) {
  const cat = RETAILER_LINKS_BY_PRODUCT_NAME[product.product_name]
  if (!cat) return product
  return {
    ...product,
    target_url: hasUrl(product.target_url) ? product.target_url : cat.target_url,
    walmart_url: hasUrl(product.walmart_url) ? product.walmart_url : cat.walmart_url,
  }
}

export function enrichProductRow(row) {
  const { score_details: sd, ...rest } = row
  const sidecar = parseSidecar(sd?.[0]?.data_sources ?? null)
  let p = {
    ...rest,
    target_url: rest.target_url ?? null,
    walmart_url: rest.walmart_url ?? null,
    other_retailer_label: rest.other_retailer_label ?? null,
    other_retailer_url: rest.other_retailer_url ?? null,
  }
  if (sidecar) {
    if (!hasUrl(p.target_url) && hasUrl(sidecar.target_url)) p.target_url = sidecar.target_url
    if (!hasUrl(p.walmart_url) && hasUrl(sidecar.walmart_url))
      p.walmart_url = sidecar.walmart_url
    if (!hasUrl(p.other_retailer_label) && hasUrl(sidecar.other_retailer_label))
      p.other_retailer_label = sidecar.other_retailer_label
    if (!hasUrl(p.other_retailer_url) && hasUrl(sidecar.other_retailer_url))
      p.other_retailer_url = sidecar.other_retailer_url
  }
  p = mergeCatalog(p)
  if (!hasUrl(p.amazon_url) && hasUrl(p.affiliate_link)) p.amazon_url = p.affiliate_link
  return p
}
