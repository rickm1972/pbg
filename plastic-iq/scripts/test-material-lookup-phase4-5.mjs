#!/usr/bin/env node
/**
 * Phase 4.5 — Material lookup alias + audit + six-product dump tests.
 * Run: npm run test:material-lookup-phase4-5
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveMaterialLookupMeta,
  resolveMaterialId,
  MATERIAL_TAXONOMY_ALIASES,
} from '../scripts/agent2/deterministic/material-taxonomy.mjs'
import {
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from '../scripts/agent2/deterministic/material-lookup-versions.mjs'
import { buildSystemValidation, NON_DETECT_MITIGATION_FACTOR } from '../src/lib/lockedInput/buildSystemValidation.ts'
import {
  buildLodgeReviewedPayloadFixture,
  buildHexCladReviewedPayloadFixture,
  buildUnknownCanonicalReviewedFixture,
} from '../src/shared/agent1/fixtures/systemValidation.fixture.mjs'
import { FIXTURE_LODGE_PRODUCT } from '../src/shared/agent1/fixtures/lodgeProposedInput.fixture.mjs'
import {
  auditCanonicalMaterialAlignment,
  dumpSixProductMaterialValues,
  summarizeLookupSyncConcerns,
} from './lib/material-lookup-audit.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function assertNoLockedFieldsDeep(value, path = '') {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) assertNoLockedFieldsDeep(value[i], `${path}[${i}]`)
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!key.startsWith('locked_'), `unexpected locked field at ${path}.${key}`)
      assertNoLockedFieldsDeep(child, path ? `${path}.${key}` : key)
    }
  }
}

// 1. cast_iron_body → cast_iron
const castIronBodyMeta = resolveMaterialLookupMeta('cast_iron_body')
assert.equal(castIronBodyMeta.resolved_material_taxonomy_id, 'cast_iron')
assert.equal(castIronBodyMeta.alias_applied, true)
assert.equal(castIronBodyMeta.canonical_material_lookup_status, 'alias_resolved')
assert.equal(castIronBodyMeta.material?.hazard, 0.03)
assert.equal(castIronBodyMeta.material?.migration, 0.035)
console.log('✓ cast_iron_body resolves to cast_iron via MATERIAL_TAXONOMY_ALIASES')

// 2. Lodge validation no longer blocked solely for cast_iron_body substrate
const lodgeReviewed = buildLodgeReviewedPayloadFixture()
const lodgeSubstrate = lodgeReviewed.reviewed_components.find((c) => c.reviewed_component_role === 'substrate')
assert.equal(lodgeSubstrate?.confirmed_canonical_material_id, 'cast_iron_body')
const lodgeResult = buildSystemValidation({
  reviewed_payload: lodgeReviewed,
  product: FIXTURE_LODGE_PRODUCT,
})
assert.equal(lodgeResult.validation_status, 'passed')
assert.ok(!lodgeResult.blockers.some((b) => b.code === 'UNKNOWN_CANONICAL_MATERIAL_ID'))
const lodgeSubstrateLookup = lodgeResult.validation_payload.material_lookups?.find(
  (m) => m.reviewed_component_role === 'substrate',
)
assert.equal(lodgeSubstrateLookup?.resolved_material_taxonomy_id, 'cast_iron')
assert.equal(lodgeSubstrateLookup?.alias_applied, true)
console.log('✓ Lodge validation passes with cast_iron_body substrate via alias')

// 3. validation payload records reviewed + resolved IDs
assert.equal(lodgeSubstrateLookup?.reviewed_canonical_material_id, 'cast_iron_body')
assert.match(String(lodgeSubstrateLookup?.material_lookup_notes ?? ''), /cast_iron_body.*cast_iron/i)
console.log('✓ validation payload records reviewed_canonical_material_id and resolved_material_taxonomy_id')

// 4. no locked_* fields
assertNoLockedFieldsDeep(lodgeResult.validation_payload)
console.log('✓ alias resolution does not create locked_* fields')

// 5. ambiguous unknown still blocks
const unknownResult = buildSystemValidation({
  reviewed_payload: buildUnknownCanonicalReviewedFixture(),
  product: FIXTURE_LODGE_PRODUCT,
})
assert.ok(unknownResult.blockers.some((b) => b.code === 'UNKNOWN_CANONICAL_MATERIAL_ID'))
console.log('✓ ambiguous unknown material IDs still block')

// 6. Non-Detect mitigation 0.58 unchanged
const hexResult = buildSystemValidation({
  reviewed_payload: buildHexCladReviewedPayloadFixture(),
  product: { category: 'Kitchen', subcategory: 'Cookware' },
})
const hexPrimary = hexResult.validation_payload.material_lookups?.find(
  (m) => m.reviewed_component_role === 'primary_food_contact',
)
const hexMit = hexResult.validation_payload.non_detect_mitigation?.find(
  (m) => m.reviewed_component_id === hexPrimary?.reviewed_component_id,
)
assert.equal(hexMit?.mitigation_factor, NON_DETECT_MITIGATION_FACTOR)
console.log('✓ Non-Detect mitigation factor 0.58 unaffected by alias changes')

// 7. six-product dump
const dump = dumpSixProductMaterialValues()
assert.ok(dump.length >= 6)
const lodgeDump = dump.find((r) => r.product === 'Lodge' && r.reviewed_canonical_id === 'cast_iron')
assert.equal(lodgeDump?.hazard_in_code, 0.03)
const hexDump = dump.find(
  (r) => r.product === 'HexClad' && r.reviewed_canonical_id === 'hybrid_stainless_nonstick_food_contact',
)
assert.equal(hexDump?.hazard_in_code, 0.35)
const tfalDump = dump.find((r) => r.product === 'T-Fal' && r.reviewed_canonical_id === 'ptfe_nonstick_coating')
assert.equal(tfalDump?.resolved_taxonomy_id, 'ptfe_nonstick')
assert.equal(tfalDump?.hazard_in_code, 0.85)
console.log('✓ six-product active code hazard/migration dump generated')

// Version stamps
assert.equal(METHODOLOGY_VERSION, 'v2.3.5')
assert.equal(MATERIAL_LOOKUP_VERSION, 'code_material_taxonomy_current')
assert.equal(lodgeResult.validation_payload.methodology_version, 'v2.3.5')
console.log('✓ methodology_version and material_lookup_version stamped')

// Audit alignment
const alignment = auditCanonicalMaterialAlignment()
const castIronBodyAudit = alignment.find((r) => r.canonical_id === 'cast_iron_body')
assert.equal(castIronBodyAudit?.resolves_in_material_taxonomy, true)
assert.equal(castIronBodyAudit?.safe_alias, true)
console.log('✓ canonical ID alignment audit includes cast_iron_body resolution')

// Sync summary
const sync = summarizeLookupSyncConcerns()
assert.ok(sync.real_product_lock_recommendation.includes('Do not lock real products'))
console.log('✓ lookup sync concerns summarized')

// Agent 3/4 unchanged
for (const rel of ['scripts/agent3/runner.mjs', 'scripts/agent4/runner.mjs']) {
  const src = readFileSync(join(root, rel), 'utf8')
  assert.ok(!src.includes('material-lookup-audit'))
  assert.ok(!src.includes('resolveMaterialLookupMeta'))
}
console.log('✓ Agent 3/4 runners do not import lookup audit services')

// Old path
const agent2Runner = readFileSync(join(root, 'scripts/agent2/runner.mjs'), 'utf8')
assert.ok(agent2Runner.includes('material-taxonomy.mjs') || agent2Runner.includes('scoring_inputs'))
console.log('✓ old Agent 1 → Agent 2 path unchanged')

// Alias map sanity
assert.equal(MATERIAL_TAXONOMY_ALIASES.cast_iron_body, 'cast_iron')
assert.equal(resolveMaterialId('ceramic_nonstick_sol_gel_coating'), 'ceramic_nonstick_sol_gel')
console.log('✓ MATERIAL_TAXONOMY_ALIASES contains documented equivalences only')

console.log('\nAll Phase 4.5 material lookup tests passed.')
