#!/usr/bin/env node
import { connectPgClient } from './lib/pg-connect.mjs'
import { runAgent1, formatPacketSummary } from './agent1/runner.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from './lib/env.mjs'

const PRODUCT = {
  product_name: 'Le Creuset Signature Cast Iron Skillet 10.25 Inch',
  brand: 'Le Creuset',
  category: 'Kitchen',
  subcategory: 'Cookware',
  amazon_url:
    'https://www.amazon.com/Creuset-Signature-Handle-Skillet-4-Inch/dp/B00B4UOKM4',
  agent_status: 'unscored',
  active: false,
}

const client = await connectPgClient()
let productId
try {
  const { rows } = await client.query(
    `
    insert into public.products (
      product_name,
      brand,
      category,
      subcategory,
      description,
      pac_safety_score,
      tier,
      score_basis,
      primary_material,
      secondary_material,
      bpa_free,
      phthalate_free_claim,
      amazon_url,
      affiliate_link,
      agent_status,
      active
    ) values (
      $1, $2, $3, $4,
      null,
      null, null, null, null, null, null, null,
      $5, $5,
      $6, $7
    )
    returning product_id, product_name, agent_status, active
    `,
    [
      PRODUCT.product_name,
      PRODUCT.brand,
      PRODUCT.category,
      PRODUCT.subcategory,
      PRODUCT.amazon_url,
      PRODUCT.agent_status,
      PRODUCT.active,
    ],
  )
  productId = rows[0].product_id
  console.log('Inserted product:', rows[0])
} finally {
  await client.end()
}

console.log('\nRunning Agent 1 (production)…\n')
const result = await runAgent1({ productId })

const outDir = join(projectRoot, 'scripts', 'output')
mkdirSync(outDir, { recursive: true })
const outFile = join(outDir, `agent1-${productId}.json`)
writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf8')

console.log(formatPacketSummary(result))
console.log(`\nFull packet: ${outFile}`)
console.log(`\nProduct ID: ${productId}`)
console.log(`Status: ${result.ok ? 'evidence_awaiting_review' : 'evidence_pending (threshold or error)'}`)
if (!result.ok) process.exit(2)
