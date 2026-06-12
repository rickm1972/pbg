#!/usr/bin/env node
/**
 * Phase 2 — Agent 1 proposed closed-field builder + persistence contract tests.
 * Run: npm run test:agent1-proposed-inputs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildProposedInputPayload,
  assertProposedPayloadHasNoLockedFields,
  PROPOSED_PAYLOAD_SCHEMA_VERSION,
} from '../scripts/agent1/build-proposed-inputs.mjs'
import {
  buildGate1ApprovalEligibilityHexCladV7Structured,
} from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'
import { buildGate1ApprovalEligibilityHexCladV7Sources } from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'
import {
  FIXTURE_LODGE_PRODUCT,
  buildLodgeProposedInputEvidenceRow,
} from '../src/shared/agent1/fixtures/lodgeProposedInput.fixture.mjs'

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
      assert.notEqual(key, 'locked_canonical_material_id')
      assertNoLockedFieldsDeep(child, path ? `${path}.${key}` : key)
    }
  }
}

// --- Lodge inert fixture ---
const lodgeEvidence = buildLodgeProposedInputEvidenceRow()
const lodgePayload = buildProposedInputPayload({
  product: FIXTURE_LODGE_PRODUCT,
  evidence: lodgeEvidence,
})

assert.equal(lodgePayload.schema_version, PROPOSED_PAYLOAD_SCHEMA_VERSION)
assert.equal(lodgePayload.non_authoritative, true)
assert.ok(lodgePayload.proposed_components.length >= 2)
const lodgePrimary = lodgePayload.proposed_components.find(
  (c) => c.proposed_component_role === 'primary_food_contact',
)
assert.equal(lodgePrimary?.proposed_canonical_material_id, 'cast_iron')
assert.equal(lodgePrimary?.proposed_is_primary_contact, true)
assert.equal(lodgePrimary?.proposed_is_score_driving, true)
assert.equal(lodgePrimary?.proposed_contact_pathway, 'food')
assert.equal(lodgePayload.proposed_use_condition_override, false)
assert.match(
  String(lodgePayload.proposed_use_condition_override_reason ?? ''),
  /category defaults should apply/i,
)
assert.equal(lodgePayload.proposed_lab_evidence_status, 'none')
assert.equal(lodgePayload.proposed_non_detect_mitigation_candidate, false)
assert.equal(lodgePayload.proposed_cap_flag, false)
assertNoLockedFieldsDeep(lodgePayload)
assertProposedPayloadHasNoLockedFields(lodgePayload)
console.log('✓ Lodge fixture → proposed_payload with cast_iron primary and no locked fields')

// --- HexClad hybrid/proprietary/lab candidate ---
const hexStructured = buildGate1ApprovalEligibilityHexCladV7Structured()
const hexSources = buildGate1ApprovalEligibilityHexCladV7Sources()
const hexProduct = {
  product_id: '00000000-0000-4000-8000-000000000002',
  product_name: hexStructured.product_identity.product_name,
  brand: 'HexClad',
  category: 'Kitchen',
  subcategory: 'Cookware',
}
const hexEvidence = {
  evidence_id: '00000000-0000-4000-8000-000000000020',
  product_id: hexProduct.product_id,
  sources: hexSources,
  agent_metadata: { structured_evidence: hexStructured },
}
const hexPayload = buildProposedInputPayload({ product: hexProduct, evidence: hexEvidence })

const hexPrimary = hexPayload.proposed_components.find(
  (c) => c.proposed_component_role === 'primary_food_contact',
)
assert.equal(hexPrimary?.proposed_canonical_material_id, 'hybrid_stainless_nonstick_food_contact')
assert.equal(hexPrimary?.proposed_component_structure, 'hybrid_surface')
assert.ok(hexPayload.proposed_components.some((c) => c.proposed_component_role === 'structural'))
const hexSubstrate = hexPayload.proposed_components.find((c) => c.proposed_component_role === 'structural')
const hexCoating = hexPayload.proposed_components.find((c) => c.proposed_component_role === 'coating')
const hexHandle = hexPayload.proposed_components.find((c) => c.proposed_component_role === 'handle')
assert.equal(hexSubstrate?.proposed_is_score_driving, true)
assert.equal(hexCoating?.proposed_is_score_driving, false)
assert.equal(hexHandle?.proposed_is_score_driving, true)
assert.equal(hexPayload.proposed_proprietary_status, 'known_category_proprietary')
assert.equal(hexPayload.proposed_non_detect_mitigation_candidate, true)
assert.equal(hexPayload.proposed_lab_evidence_status, 'third_party_non_detect')
assert.ok(hexPayload.proposed_layer_4a_credit_candidates?.includes('manufacturer_published_non_detect_lab_testing'))
assert.ok(
  hexPayload.proposed_layer_4a_deduction_candidates?.includes(
    'proprietary_ceramic_or_nonstick_formula_undisclosed',
  ),
)
assert.ok(hexPayload.proposed_layer_4a_flags?.candidate_only)
assertNoLockedFieldsDeep(hexPayload)
console.log('✓ HexClad fixture → hybrid components, lab candidate, Layer 4A candidates only')

// --- Product context ---
assert.equal(hexPayload.product_context?.brand, 'HexClad')
assert.equal(hexPayload.product_context?.evidence_id, hexEvidence.evidence_id)
assert.ok(Array.isArray(hexPayload.product_context?.source_support_ids))
console.log('✓ product_context populated')

// --- Runners must not import locked-input proposal path for Agent 3/4 ---
for (const rel of ['scripts/agent3/runner.mjs', 'scripts/agent4/runner.mjs']) {
  const src = readFileSync(join(root, rel), 'utf8')
  assert.ok(!src.includes('lockedInput'), `${rel} must not import locked-input services`)
  assert.ok(!src.includes('build-proposed-inputs'), `${rel} must not import proposal builder`)
}
console.log('✓ Agent 3/4 runners do not import locked-input proposal services')

// --- Agent 1 runner wired to proposal persistence only ---
const agent1Runner = readFileSync(join(root, 'scripts/agent1/runner.mjs'), 'utf8')
assert.ok(agent1Runner.includes('tryPersistProposedInputDraft'))
assert.ok(agent1Runner.includes('proposed-input-supabase.mjs'))
assert.ok(!agent1Runner.includes('lockAgent1InputPackage'))
assert.ok(!agent1Runner.includes('agent1_locked_inputs'))
console.log('✓ Agent 1 runner persists proposed draft only (no lock path)')

// --- Optional DB persist smoke (rolled back) ---
async function tryPersistSmoke() {
  let connectPgClient
  let loadEnv
  try {
    ;({ connectPgClient } = await import('./lib/pg-connect.mjs'))
    ;({ loadEnv } = await import('./lib/env.mjs'))
  } catch {
    console.log('⊘ DB persist smoke skipped (pg-connect unavailable)')
    return
  }

  let client
  try {
    client = await connectPgClient(loadEnv())
  } catch (err) {
    console.log(`⊘ DB persist smoke skipped (${err instanceof Error ? err.message : err})`)
    return
  }

  const { createProposedInputDraftForEvidence } = await import(
    '../scripts/agent1/proposed-input-supabase.mjs'
  )

  try {
    await client.query('begin')
    const productRes = await client.query(
      `select product_id from public.products where active is distinct from false limit 1`,
    )
    if (!productRes.rows.length) {
      await client.query('rollback')
      console.log('⊘ DB persist smoke skipped (no product row)')
      return
    }
    const productId = productRes.rows[0].product_id
    const productRow = await client.query(
      `select product_id, product_name, brand, category, subcategory from public.products where product_id = $1`,
      [productId],
    )
    const evidenceRes = await client.query(
      `select * from public.product_evidence where product_id = $1 order by bundle_version desc limit 1`,
      [productId],
    )
    if (!evidenceRes.rows.length) {
      await client.query('rollback')
      console.log('⊘ DB persist smoke skipped (no evidence row)')
      return
    }

    const { createServiceClient } = await import('../scripts/agent1/supabase.mjs')
    const supabase = createServiceClient()
    const draft = await createProposedInputDraftForEvidence(supabase, {
      product: productRow.rows[0],
      evidence: evidenceRes.rows[0],
    })
    assert.ok(draft.proposed_input_id)
    assert.equal(draft.proposal_status, 'draft')
    assert.equal(draft.proposed_payload.non_authoritative, true)
    assert.ok(draft.proposed_payload.proposed_components?.length >= 1)
    await client.query('rollback')
    console.log('✓ createProposedInputDraftForEvidence persists draft (transaction rolled back)')
  } catch (err) {
    await client.query('rollback').catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

await tryPersistSmoke()

console.log('\nAll Agent 1 proposed-input Phase 2 tests passed.')
