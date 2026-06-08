#!/usr/bin/env node
import { createServiceClient, fetchProductById, fetchApprovedEvidence } from './agent2/supabase.mjs'
import { normalizeProductRow } from '../src/lib/retailerLinksSidecar.ts'
import { explainPublicRetailerCtas } from '../src/lib/publicRetailerLinks.ts'
import { orderedRetailerLinks } from '../src/lib/retailerLinks.ts'

const LODGE_ID = '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8'

const supabase = createServiceClient()
const raw = await fetchProductById(supabase, LODGE_ID)
const evidence = await fetchApprovedEvidence(supabase, LODGE_ID)
const pack = evidence
  ? { sources: evidence.sources, agent_metadata: evidence.agent_metadata }
  : null

const { data: row } = await supabase
  .from('products')
  .select('*, score_details ( data_sources )')
  .eq('product_id', LODGE_ID)
  .maybeSingle()

console.log('=== RAW DB products row ===')
console.log({
  walmart_url: raw.walmart_url,
  target_url: raw.target_url,
  amazon_url: raw.amazon_url,
  affiliate_link: raw.affiliate_link,
})
console.log('score_details.data_sources:', row?.score_details?.[0]?.data_sources?.slice(0, 200))

const normalized = normalizeProductRow(row)
console.log('\n=== AFTER normalizeProductRow (public path) ===')
console.log({
  walmart_url: normalized.walmart_url,
  target_url: normalized.target_url,
})

console.log('\n=== PUBLIC normalizeProductRow CTAs ===')
console.log('links', orderedRetailerLinks(normalized).map((l) => l.id))
console.log('CTAs', explainPublicRetailerCtas(normalized, pack))
