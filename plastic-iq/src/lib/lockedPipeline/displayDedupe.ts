/**
 * Collapse duplicate locked-path queue rows that share the same catalog display name
 * but different product_id (e.g. smoke-test UUIDs vs real catalog products).
 */

/** Live catalog product IDs — prefer these in locked-pipeline queues over fixture/debris rows. */
export const CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS = new Set([
  '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8', // Lodge (live published)
  'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5', // HexClad (live published)
])

export function catalogDisplayKey(productName: string | null, brand: string | null): string {
  const name = (productName ?? '').trim().toLowerCase()
  const b = (brand ?? '').trim().toLowerCase()
  if (!name && !b) return ''
  return `${b}::${name}`
}

function isCanonicalProductId(productId: string): boolean {
  return CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS.has(productId)
}

function isNewer(isoA: string, isoB: string): boolean {
  return new Date(isoA).getTime() > new Date(isoB).getTime()
}

export function shouldReplaceLockedQueueCandidate<T extends { product_id: string; created_at: string }>(
  current: T,
  challenger: T,
): boolean {
  const currentCanonical = isCanonicalProductId(current.product_id)
  const challengerCanonical = isCanonicalProductId(challenger.product_id)
  if (challengerCanonical && !currentCanonical) return true
  if (currentCanonical && !challengerCanonical) return false
  return isNewer(challenger.created_at, current.created_at)
}

export function pickLatestPerCatalogDisplay<
  T extends {
    product_id: string
    created_at: string
    product_name: string | null
    brand: string | null
  },
>(items: T[]): T[] {
  const byDisplay = new Map<string, T>()
  const byProductId = new Map<string, T>()

  for (const item of items) {
    const displayKey = catalogDisplayKey(item.product_name, item.brand)
    if (displayKey) {
      const existing = byDisplay.get(displayKey)
      if (!existing || shouldReplaceLockedQueueCandidate(existing, item)) {
        byDisplay.set(displayKey, item)
      }
      continue
    }
    const existing = byProductId.get(item.product_id)
    if (!existing || shouldReplaceLockedQueueCandidate(existing, item)) {
      byProductId.set(item.product_id, item)
    }
  }

  const merged = [...byDisplay.values(), ...byProductId.values()]
  return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}
