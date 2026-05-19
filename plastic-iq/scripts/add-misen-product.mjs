#!/usr/bin/env node
/**
 * Insert Misen frying pan for Agent 1 (admin Run tab). Does not call Anthropic.
 *
 * Usage: node scripts/add-misen-product.mjs
 */
import { createServiceClient } from './agent1/supabase.mjs'

const PRODUCT = {
  product_name: 'Misen 5-Ply Stainless Steel 10" Frying Pan',
  brand: 'Misen',
  category: 'Kitchen',
  subcategory: 'Cookware',
  amazon_url: 'https://www.amazon.com/Misen-Stainless-Steel-Frying-Pan/dp/B08WRWNGZQ',
  agent_status: 'unscored',
  active: false,
}

const supabase = createServiceClient()

const { data: existing } = await supabase
  .from('products')
  .select('product_id, product_name, agent_status')
  .ilike('product_name', '%Misen%Stainless%')

if (existing?.length) {
  console.log('Product already exists:')
  for (const p of existing) console.log(`  ${p.product_id}  ${p.product_name}  (${p.agent_status})`)
  process.exit(0)
}

const { data, error } = await supabase
  .from('products')
  .insert({
    product_name: PRODUCT.product_name,
    brand: PRODUCT.brand,
    category: PRODUCT.category,
    subcategory: PRODUCT.subcategory,
    amazon_url: PRODUCT.amazon_url,
    affiliate_link: PRODUCT.amazon_url,
    agent_status: PRODUCT.agent_status,
    active: PRODUCT.active,
  })
  .select('product_id, product_name, brand, agent_status, amazon_url')
  .single()

if (error) {
  console.error('Insert failed:', error.message)
  process.exit(1)
}

console.log('\nInserted product for Agent 1:\n')
console.log(JSON.stringify(data, null, 2))
console.log(`
Next steps:
  1. npm run dev   (if not already running)
  2. Admin → Agent 1 review → Run Agent 1 tab
  3. Select "${PRODUCT.product_name}" → Run Agent 1
`)
