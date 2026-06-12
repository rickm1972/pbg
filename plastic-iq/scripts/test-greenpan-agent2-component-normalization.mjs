#!/usr/bin/env node
/**
 * GreenPan Gate 2 — ceramic-over-hard-anodized component split without duplicate coating.
 * Run: npm run test:greenpan-agent2-component-normalization
 */
import assert from 'node:assert/strict'
import { createServiceClient } from './agent1/supabase.mjs'
import { extractComponents } from './agent2/deterministic/component-extract.mjs'
import { runAgent2NormalizationPipeline } from './agent2/deterministic/pipeline.mjs'
import { extractManufacturerPublishedLabTesting } from '../src/shared/agent2/manufacturer-lab-testing-evidence.mjs'

const GREENPAN_ID = '860b2128-015b-4d8d-8710-7ad7751ec7c5'

const sb = createServiceClient()
const { data: ev } = await sb
  .from('product_evidence')
  .select('*')
  .eq('product_id', GREENPAN_ID)
  .eq('bundle_version', 7)
  .maybeSingle()
assert.ok(ev, 'GreenPan v7 approved evidence required')

const product = {
  product_id: GREENPAN_ID,
  product_name: 'GreenPan Valencia Pro Ceramic Nonstick 10” Frying Pan Skillet with Lid',
  brand: 'GreenPan',
  subcategory: 'Frying Pan / Skillet',
  category: 'Kitchen',
}

const { components: extracted } = extractComponents(ev, product)
const primary = extracted.find((c) => c.role === 'primary_food_contact')
assert.ok(primary, 'primary cooking surface required')
assert.equal(primary.material_id, 'ceramic_nonstick_sol_gel')
assert.match(primary.material, /Thermolon|diamond-infused ceramic/i)
assert.ok(!/hard_anodized_aluminum/i.test(primary.material), 'primary material text must not be substrate')
console.log('✓ primary cooking surface uses ceramic_nonstick_sol_gel with coating identity text')

const bodies = extracted.filter((c) => c.material_id === 'hard_anodized_aluminum')
assert.equal(bodies.length, 1, `expected one hard_anodized body, got ${bodies.length}`)
assert.equal(bodies[0].role, 'structural')
console.log('✓ hard_anodized_aluminum appears once as structural body/substrate')

const dupCeramic = extracted.filter(
  (c) =>
    c.role !== 'primary_food_contact' &&
    (c.material_id === 'ceramic_nonstick_sol_gel' || /diamond_infused_ceramic/i.test(c.material)),
)
assert.equal(dupCeramic.length, 0, `duplicate ceramic secondary forbidden: ${dupCeramic.map((c) => c.component_name).join(', ')}`)
console.log('✓ no duplicate other/diamond_infused ceramic coating component')

assert.ok(extracted.some((c) => c.role === 'lid' && c.material_id === 'tempered_glass_lid'))
assert.ok(extracted.some((c) => c.role === 'handle'))
assert.ok(extracted.some((c) => c.material_id === 'magnetic_stainless_base'))
console.log('✓ lid, handle, and magnetic base remain')

const { inputs } = runAgent2NormalizationPipeline(product, ev)
assert.equal(
  inputs.layer_4a?.negative_adjustments?.find((a) => /proprietary food-contact coating/i.test(a.reason))
    ?.value,
  -3,
)
assert.equal(inputs.testing_evidence?.testing_evidence_present, false)
const gate2Lab = extractManufacturerPublishedLabTesting(ev)
assert.equal(gate2Lab.testing_evidence_present, false)
console.log('✓ Layer 4A -3 proprietary undisclosed; no lab mitigation')

console.log('\nGreenPan Agent 2 component normalization tests passed.')
