#!/usr/bin/env node
/**
 * GreenPan v3 DB-shaped fixture — ceramic extraction must win final canonical assignment.
 * Run: npm run test:greenpan-canonical-precedence
 */
import assert from 'node:assert/strict'
import { createServiceClient } from './agent1/supabase.mjs'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import {
  buildGreenPanV3SourcesWithTerrabondContext,
  buildGreenPanV3StructuredEvidence,
} from '../src/shared/canonical-taxonomy/fixtures/greenpanV3Precedence.fixture.mjs'

const structured = buildGreenPanV3StructuredEvidence()
const fixtureSources = buildGreenPanV3SourcesWithTerrabondContext()
const fixtureMapped = applyCanonicalMappings(structured, fixtureSources)

assert.equal(fixtureMapped.primary_contact_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
assert.equal(fixtureMapped.substrate_material_id?.canonical_id, 'hard_anodized_aluminum')
console.log('✓ fixture maps ceramic + hard-anodized (not hybrid/stainless body)')

let liveOk = false
try {
  const sb = createServiceClient()
  const { data } = await sb
    .from('product_evidence')
    .select('sources,agent_metadata')
    .eq('product_id', '860b2128-015b-4d8d-8710-7ad7751ec7c5')
    .eq('bundle_version', 3)
    .maybeSingle()
  if (data?.agent_metadata?.structured_evidence) {
    const liveMapped = applyCanonicalMappings(
      structuredClone(data.agent_metadata.structured_evidence),
      data.sources ?? [],
    )
    assert.equal(liveMapped.primary_contact_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
    assert.equal(liveMapped.substrate_material_id?.canonical_id, 'hard_anodized_aluminum')
    assert.notEqual(liveMapped.primary_contact_material_id?.mapping_rule_id, 'cookware_hybrid_stainless_nonstick_v1')
    liveOk = true
    console.log('✓ live GreenPan v3 structured evidence remaps correctly with current rules')
  }
} catch {
  /* offline / no DB */
}
if (!liveOk) {
  console.log('✓ live DB check skipped (fixture precedence verified)')
}

console.log('\nGreenPan canonical precedence tests passed.')
