#!/usr/bin/env node
/**
 * GreenPan live public page — sources + commerce links (read-only DB).
 * Run: npm run test:greenpan-public-page
 */
import assert from 'node:assert/strict'
import { createServiceClient } from './agent1/supabase.mjs'
import { buildPublicSourcesFromEvidence } from '../src/lib/publicSourceDisplay.ts'
import { buildPublicDisplayContract } from '../src/lib/publicProductDisplayContract.ts'
import { publicRetailerLinks, explainPublicRetailerCtas } from '../src/lib/publicRetailerLinks.ts'

const GREENPAN_ID = '860b2128-015b-4d8d-8710-7ad7751ec7c5'

const sb = createServiceClient()
const { data: ev } = await sb
  .from('product_evidence')
  .select('*')
  .eq('product_id', GREENPAN_ID)
  .eq('bundle_version', 7)
  .maybeSingle()
assert.ok(ev, 'GreenPan v7 approved evidence required')

const { data: prod } = await sb
  .from('products')
  .select('product_name,brand,amazon_url,target_url,walmart_url,affiliate_link,product_id')
  .eq('product_id', GREENPAN_ID)
  .maybeSingle()
assert.ok(prod, 'GreenPan product row required')

const contract = buildPublicDisplayContract(prod, ev)
const sources = buildPublicSourcesFromEvidence(ev, contract).filter(
  (s) => s.public_source_eligible !== false,
)

const manufacturer = sources.filter((s) => s.public_label === 'Manufacturer')
for (const s of manufacturer) {
  const host = new URL(s.url).hostname.replace(/^www\./, '')
  assert.ok(host.includes('greenpan'), `Manufacturer must be brand-domain only: ${s.url}`)
  assert.ok(!/hexclad|consumerreports|youtube|leafscore/i.test(`${s.url} ${s.title}`))
}

assert.ok(
  !manufacturer.some((s) => /hexclad/i.test(`${s.url} ${s.title}`)),
  'HexClad must not appear as Manufacturer on GreenPan',
)

const context = sources.filter((s) => s.public_label === 'Context')
for (const s of context) {
  assert.ok(
    /context|third-party|review/i.test(s.title) || !/greenpan\.us\/products/i.test(s.url),
    'context sources must not imply manufacturer PDP confirmation',
  )
}

const ctas = explainPublicRetailerCtas(prod, ev)
const allowed = ctas.filter((c) => c.allowed).map((c) => c.retailer).sort()
assert.deepEqual(allowed, ['amazon', 'target'], `expected Amazon + Target, got ${JSON.stringify(ctas)}`)
const walmartCta = ctas.find((c) => c.retailer === 'walmart')
assert.equal(walmartCta?.allowed, false, 'Walmart 8-inch URL must stay hidden')

const links = publicRetailerLinks(prod, ev)
assert.deepEqual(links.map((l) => l.id).sort(), ['amazon', 'target'])

const { data: scoreRow } = await sb
  .from('product_scores')
  .select('pac_safety_score,tier,transparency_badge')
  .eq('product_id', GREENPAN_ID)
  .eq('review_status', 'approved')
  .order('run_timestamp', { ascending: false })
  .limit(1)
  .maybeSingle()
assert.equal(scoreRow?.pac_safety_score, 69, 'GreenPan score must remain 69')
assert.equal(scoreRow?.tier, 'Caution')
assert.match(String(scoreRow?.transparency_badge ?? ''), /Material Uncertain/i)

console.log('✓ GreenPan live public page sources + commerce links (score unchanged)')
