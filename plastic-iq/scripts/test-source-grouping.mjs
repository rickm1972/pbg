#!/usr/bin/env node
/**
 * Public source grouping — manufacturer vs context vs retailer.
 * Run: npm run test:source-grouping
 */
import assert from 'node:assert/strict'
import { buildPublicSourcesFromEvidence } from '../src/lib/publicSourceDisplay.ts'
import { buildPublicDisplayContract } from '../src/lib/publicProductDisplayContract.ts'
import {
  buildGreenPanMisclassifiedSourcesEvidence,
  GREENPAN_PUBLIC_PRODUCT,
} from '../src/lib/fixtures/greenpanPublicPageSources.fixture.ts'
import { buildGate1ApprovalEligibilityHexCladV7Sources } from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function sourcesByLabel(sources) {
  const out = { Manufacturer: [], Retailer: [], Context: [], Regulatory: [] }
  for (const s of sources) {
    if (s.public_source_eligible === false) continue
    out[s.public_label]?.push(s)
  }
  return out
}

function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// --- GreenPan ---
const gpEvidence = buildGreenPanMisclassifiedSourcesEvidence()
const gpContract = buildPublicDisplayContract(GREENPAN_PUBLIC_PRODUCT, gpEvidence)
const gpSources = buildPublicSourcesFromEvidence(gpEvidence, gpContract)
const gpGrouped = sourcesByLabel(gpSources)

for (const s of gpGrouped.Manufacturer) {
  assert.ok(
    host(s.url).includes('greenpan'),
    `third-party source must not render as Manufacturer: ${s.url}`,
  )
}

assert.ok(
  !gpGrouped.Manufacturer.some((s) => /hexclad/i.test(`${s.url} ${s.title}`)),
  'HexClad article must not appear under Manufacturer on GreenPan page',
)
assert.ok(
  !gpGrouped.Manufacturer.some((s) => /consumerreports|youtube|leafscore|nytimes|wirecutter/i.test(s.url)),
  'review/context hosts must not appear under Manufacturer',
)
assert.ok(
  gpGrouped.Manufacturer.some((s) => s.url.includes('greenpan.us')),
  'legitimate GreenPan manufacturer PDP should remain',
)
assert.ok(
  gpGrouped.Context.some((s) => /leafscore|consumerreports|youtube|nytimes/i.test(s.url)) ||
    gpSources.filter((s) => /leafscore|consumerreports|youtube|nytimes/i.test(s.url)).length === 0,
  'context sources stay in Context or are suppressed — never Manufacturer',
)

// --- HexClad fixture ---
const hexEvidence = {
  sources: buildGate1ApprovalEligibilityHexCladV7Sources(),
  agent_metadata: {
    structured_evidence: {
      product_identity: {
        product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
        brand: 'HexClad',
      },
      retailer_links: {
        amazon_url: 'https://www.amazon.com/dp/B000HEXCLAD',
        manufacturer_direct_url: 'https://hexclad.com/collections/fry-pans-deep-sautes/products/10-hexclad-pan',
      },
    },
    canonical_mappings: {
      provenance: {
        primary_contact_material: [
          'https://hexclad.com/collections/fry-pans-deep-sautes/products/10-hexclad-pan',
        ],
      },
    },
  },
}
const hexContract = buildPublicDisplayContract(
  { product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan', brand: 'HexClad' },
  hexEvidence,
)
const hexSources = buildPublicSourcesFromEvidence(hexEvidence, hexContract)
const hexMfr = sourcesByLabel(hexSources).Manufacturer
assert.ok(
  hexMfr.some((s) => host(s.url).includes('hexclad.com')),
  'HexClad manufacturer PDP should remain under Manufacturer',
)
assert.ok(
  !hexMfr.some((s) => /greenpan|caraway/i.test(`${s.url} ${s.title}`)),
  'cross-brand sources must not appear under HexClad Manufacturer',
)

// --- Published Caraway + T-Fal durable snapshots (read-only regression) ---
for (const slug of ['caraway-approved', 't-fal-approved']) {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'src/lib/apr/durable-approved', `${slug}.json`), 'utf8'))
  const displaySources = raw.display?.sources ?? []
  const mfr = displaySources.filter((s) => s.group === 'Manufacturer')
  for (const s of mfr) {
    assert.ok(
      !/consumerreports|youtube\.com|leafscore.*hexclad/i.test(`${s.url} ${s.label}`),
      `${slug}: third-party must not be frozen as Manufacturer`,
    )
  }
}

console.log('✓ public source grouping (GreenPan, HexClad, published Caraway/T-Fal)')
