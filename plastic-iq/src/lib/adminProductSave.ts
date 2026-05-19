import type { Product } from '../types'
import { supabase, formatSupabaseUnknownError } from './supabaseClient'
import {
  normalizeProductRow,
  PRODUCT_SELECT_WITH_SCORE,
  stringifyRetailLinksSidecar,
  RETAIL_LINKS_SIDECAR_PREFIX,
  hasRetailUrl,
  type ProductRowWithScoreDetails,
  type RetailLinksSidecar,
} from './retailerLinksSidecar'

type PayloadMode = 'full' | 'no_other' | 'no_retailer_urls'

function productWritePayload(p: Product, mode: PayloadMode): Record<string, unknown> {
  const core = {
    product_name: p.product_name,
    brand: p.brand,
    category: p.category,
    subcategory: p.subcategory,
    description: p.description,
    pac_safety_score: p.pac_safety_score,
    tier: p.tier,
    score_basis: p.score_basis,
    primary_material: p.primary_material,
    secondary_material: p.secondary_material,
    bpa_free: p.bpa_free,
    phthalate_free_claim: p.phthalate_free_claim,
    amazon_url: p.amazon_url,
    affiliate_link: p.affiliate_link,
    image_url: p.image_url,
    active: p.active,
  }
  const out: Record<string, unknown> = { ...core }
  if (mode !== 'no_retailer_urls') {
    out.target_url = p.target_url
    out.walmart_url = p.walmart_url
  }
  if (mode === 'full') {
    out.other_retailer_label = p.other_retailer_label
    out.other_retailer_url = p.other_retailer_url
  }
  return out
}

function isRetailerColumnSchemaCacheError(error: unknown): boolean {
  const msg = formatSupabaseUnknownError(error, '')
  if (!msg) return false
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : ''
  if (code === 'PGRST204' && /target_url|walmart_url|other_retailer/i.test(msg)) return true
  if (/schema cache/i.test(msg) && /target_url|walmart_url|other_retailer/i.test(msg)) return true
  if (/could not find the '/i.test(msg) && /target_url|walmart_url|other_retailer/i.test(msg))
    return true
  return false
}

/**
 * Sidecar state: URL snapshot when columns are missing, plus retail_cleared on updates so
 * mergeCatalogRetailerLinks does not refill fields the admin cleared.
 */
function buildRetailSidecarState(
  p: Product,
  isCreate: boolean,
  mode: PayloadMode,
): RetailLinksSidecar | null {
  const retail_cleared: ('target' | 'walmart')[] = []
  if (!isCreate) {
    if (!hasRetailUrl(p.target_url)) retail_cleared.push('target')
    if (!hasRetailUrl(p.walmart_url)) retail_cleared.push('walmart')
  }
  const urlsInSidecar = mode === 'no_retailer_urls'
  const hasCleared = retail_cleared.length > 0

  if (urlsInSidecar) {
    if (
      isCreate &&
      !hasCleared &&
      !hasRetailUrl(p.target_url) &&
      !hasRetailUrl(p.walmart_url) &&
      !hasRetailUrl(p.other_retailer_label) &&
      !hasRetailUrl(p.other_retailer_url)
    ) {
      return null
    }
    const out: RetailLinksSidecar = {
      target_url: p.target_url,
      walmart_url: p.walmart_url,
      other_retailer_label: p.other_retailer_label,
      other_retailer_url: p.other_retailer_url,
    }
    if (hasCleared) out.retail_cleared = retail_cleared
    return out
  }

  if (hasCleared) return { retail_cleared }
  return null
}

async function clearRetailLinksSidecar(productId: string) {
  const { data: rows, error: e1 } = await supabase
    .from('score_details')
    .select('score_id, data_sources')
    .eq('product_id', productId)
    .limit(1)
  if (e1) throw e1
  const row = rows?.[0]
  if (!row?.data_sources?.startsWith(RETAIL_LINKS_SIDECAR_PREFIX)) return
  const { error } = await supabase
    .from('score_details')
    .update({ data_sources: null })
    .eq('score_id', row.score_id)
  if (error) throw error
}

async function syncRetailLinksSidecarAfterSave(
  productId: string,
  p: Product,
  isCreate: boolean,
  mode: PayloadMode,
) {
  const state = buildRetailSidecarState(p, isCreate, mode)
  if (!state) {
    await clearRetailLinksSidecar(productId)
    return
  }
  const json = stringifyRetailLinksSidecar(state)
  const { data: rows, error: e1 } = await supabase
    .from('score_details')
    .select('score_id')
    .eq('product_id', productId)
    .limit(1)
  if (e1) throw e1
  if (rows?.[0]) {
    const { error } = await supabase
      .from('score_details')
      .update({ data_sources: json })
      .eq('score_id', rows[0].score_id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('score_details').insert({
      product_id: productId,
      data_sources: json,
    })
    if (error) throw error
  }
}

export type SaveAdminProductResult = {
  product: Product
  message: string | null
}

/**
 * Persists a product row, falling back to score_details.data_sources JSON when
 * target_url / walmart_url / other_retailer_* columns are missing on `products`.
 */
export async function saveAdminProduct(p: Product): Promise<SaveAdminProductResult> {
  const modes: PayloadMode[] = ['full', 'no_other', 'no_retailer_urls']
  let lastErr: unknown = null
  const isUpdate = Boolean(p.product_id)

  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i]
    const payload = productWritePayload(p, mode)
    const res = !isUpdate
      ? await supabase.from('products').insert(payload).select(PRODUCT_SELECT_WITH_SCORE).single()
      : await supabase
          .from('products')
          .update(payload)
          .eq('product_id', p.product_id)
          .select(PRODUCT_SELECT_WITH_SCORE)
          .single()

    if (!res.error && res.data) {
      const row = res.data as ProductRowWithScoreDetails
      const productId = row.product_id

      await syncRetailLinksSidecarAfterSave(productId, p, !isUpdate, mode)

      const stateAfter = buildRetailSidecarState(p, !isUpdate, mode)
      const patched: ProductRowWithScoreDetails = {
        ...(row as ProductRowWithScoreDetails),
        score_details:
          stateAfter !== null
            ? [{ data_sources: stringifyRetailLinksSidecar(stateAfter) }]
            : [{ data_sources: null }],
      }

      const sidecarMsg =
        mode === 'no_retailer_urls'
          ? isUpdate
            ? 'Saved. Retailer links are stored in score_details until you add URL columns (run npm run db:repair).'
            : 'Created. Retailer links are stored in score_details until you add URL columns (run npm run db:repair).'
          : isUpdate
            ? 'Saved'
            : 'Created'

      return {
        product: normalizeProductRow(patched),
        message: sidecarMsg,
      }
    }

    lastErr = res.error
    if (res.error && !isRetailerColumnSchemaCacheError(res.error)) {
      throw res.error
    }
    if (i === modes.length - 1) break
  }

  throw lastErr ?? new Error('Save failed')
}
