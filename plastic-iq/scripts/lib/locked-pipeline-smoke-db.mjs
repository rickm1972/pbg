/**
 * Isolated smoke-test product IDs — not live catalog IDs.
 * Used only inside rolled-back DB smoke tests; never canonical Lodge/HexClad.
 */
export const SMOKE_TEST_LODGE_PRODUCT = {
  product_id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
  product_name: '[SMOKE] Lodge locked-pipeline test product',
  brand: 'Lodge',
  category: 'Kitchen',
  subcategory: 'Cookware',
}

export const SMOKE_TEST_HEXCLAD_PRODUCT = {
  product_id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002',
  product_name: '[SMOKE] HexClad locked-pipeline test product',
  brand: 'HexClad',
  category: 'Kitchen',
  subcategory: 'Cookware',
}

/** Live published catalog IDs — locked-pipeline dashboards prefer these. */
export const LIVE_LODGE_PRODUCT_ID = '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8'
export const LIVE_HEXCLAD_PRODUCT_ID = 'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5'

export const LEGACY_FIXTURE_LODGE_PRODUCT_ID = '00000000-0000-4000-8000-000000000001'
export const LEGACY_FIXTURE_HEXCLAD_PRODUCT_ID = '00000000-0000-4000-8000-000000000002'

/**
 * @param {import('pg').PoolClient} client
 * @param {{ product_id: string; product_name: string; brand: string; category: string; subcategory: string }} product
 */
export async function ensureSmokeTestProduct(client, product) {
  await client.query(
    `insert into public.products (product_id, product_name, brand, category, subcategory, active)
     values ($1, $2, $3, $4, $5, true)
     on conflict (product_id) do nothing`,
    [product.product_id, product.product_name, product.brand, product.category, product.subcategory],
  )
}

/**
 * Count non-archived Lodge/HexClad-like catalog rows (admin-visible pollution metric).
 * @param {import('pg').PoolClient} client
 */
export async function countVisibleLodgeHexcladCatalogProducts(client) {
  const sqlWithArchive = `select count(*)::int as n
     from public.products p
     where lower(coalesce(p.brand, '')) in ('lodge', 'hexclad')
       and coalesce(p.is_archived, false) = false
       and p.product_name not like '[SMOKE]%'`
  const sqlLegacy = `select count(*)::int as n
     from public.products p
     where lower(coalesce(p.brand, '')) in ('lodge', 'hexclad')
       and p.product_name not like '[SMOKE]%'`
  try {
    const res = await client.query(sqlWithArchive)
    return res.rows[0].n
  } catch (e) {
    if (e?.code === '42703') {
      const res = await client.query(sqlLegacy)
      return res.rows[0].n
    }
    throw e
  }
}

/**
 * @param {import('pg').PoolClient} client
 */
export async function countVisible42CautionProducts(client) {
  const sqlWithArchive = `select count(*)::int as n
     from public.products
     where pac_safety_score = 42 and tier = 'Caution' and coalesce(is_archived, false) = false`
  const sqlLegacy = `select count(*)::int as n
     from public.products
     where pac_safety_score = 42 and tier = 'Caution'`
  try {
    const res = await client.query(sqlWithArchive)
    return res.rows[0].n
  } catch (e) {
    if (e?.code === '42703') {
      const res = await client.query(sqlLegacy)
      return res.rows[0].n
    }
    throw e
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} productId
 */
export async function snapshotCanonicalProductRow(client, productId) {
  const res = await client.query(
    `select product_id, pac_safety_score, tier, publish_status, product_name, brand, amazon_url
     from public.products where product_id = $1`,
    [productId],
  )
  return res.rows[0] ?? null
}
