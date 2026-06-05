#!/usr/bin/env node
/**
 * Report public retailer CTA eligibility for calibration products.
 * Run: npx tsx scripts/explain-public-retailer-ctas.mjs
 */
import { createServiceClient, fetchProductById } from './agent2/supabase.mjs'
import { fetchApprovedEvidence } from './agent2/supabase.mjs'
import { explainPublicRetailerCtas } from '../src/lib/publicRetailerLinks.ts'

const PRODUCTS = [
  { label: 'Lodge', id: '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8' },
  { label: 'T-Fal', id: '7a457a86-ab62-4cbf-90b9-ccaeafe06896' },
  { label: 'Caraway', id: 'e451b158-6094-44f9-9628-a2a25974482e' },
]

const supabase = createServiceClient()

for (const { label, id } of PRODUCTS) {
  const product = await fetchProductById(supabase, id)
  const evidence = await fetchApprovedEvidence(supabase, id)
  const pack = evidence
    ? {
        sources: evidence.sources ?? [],
        agent_metadata: evidence.agent_metadata ?? {},
      }
    : null

  console.log(`\n=== ${label} — ${product.product_name} ===`)
  const rl = pack?.agent_metadata?.structured_evidence?.retailer_links ?? {}
  if (Object.keys(rl).length) console.log('approved retailer_links:', rl)
  const rows = explainPublicRetailerCtas(product, pack)
  for (const row of rows) {
    console.log(
      `${row.allowed ? 'SHOW' : 'HIDE'} [${row.retailer}] (${row.source}) ${row.reason}\n  ${row.url}`,
    )
  }
}
