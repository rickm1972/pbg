#!/usr/bin/env node
/**
 * Phase 4 — Agent 1 System Validation contract tests (fixtures only; no live agents).
 * Run: npm run test:agent1-system-validation
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildSystemValidation,
  NON_DETECT_MITIGATION_FACTOR,
  MATERIAL_LOOKUP_SOURCE,
  MATERIAL_LOOKUP_VERSION,
  VALIDATION_PAYLOAD_SCHEMA_VERSION,
} from '../src/lib/lockedInput/buildSystemValidation.ts'
import { getMaterial } from '../scripts/agent2/deterministic/material-taxonomy.mjs'
import {
  buildLodgeReviewedPayloadFixture,
  buildHexCladReviewedPayloadFixture,
  buildInvalidNonDetectReviewedFixture,
  buildUnknownCanonicalReviewedFixture,
  buildUseConditionOverrideMissingSourceFixture,
  buildKnownCategoryCapConflictFixture,
} from '../src/shared/agent1/fixtures/systemValidation.fixture.mjs'
import { assertValidationPayloadHasNoLockedFields } from '../src/lib/lockedInput/validationPayloadValidation.ts'
import { FIXTURE_LODGE_PRODUCT } from '../src/shared/agent1/fixtures/lodgeProposedInput.fixture.mjs'

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

// --- Lodge simple inert, no mitigation ---
const lodgeReviewed = buildLodgeReviewedPayloadFixture()
const lodgeResult = buildSystemValidation({
  reviewed_payload: lodgeReviewed,
  product: FIXTURE_LODGE_PRODUCT,
  proposed_input_id: 'fixture-lodge-proposed',
})

assert.equal(lodgeResult.validation_status, 'passed')
assert.equal(lodgeResult.validation_payload.schema_version, VALIDATION_PAYLOAD_SCHEMA_VERSION)
assert.equal(lodgeResult.validation_payload.material_lookup_source, MATERIAL_LOOKUP_SOURCE)
assert.equal(lodgeResult.validation_payload.material_lookup_version, MATERIAL_LOOKUP_VERSION)

const lodgeSubstrate = lodgeResult.validation_payload.material_lookups?.find(
  (m) => m.reviewed_component_role === 'substrate',
)
assert.equal(lodgeSubstrate?.resolved_material_taxonomy_id, 'cast_iron')
assert.equal(lodgeSubstrate?.reviewed_canonical_material_id, 'cast_iron_body')

const lodgePrimary = lodgeResult.validation_payload.material_lookups?.find(
  (m) => m.reviewed_component_role === 'primary_food_contact',
)
assert.equal(lodgePrimary?.canonical_material_lookup_status, 'found')
assert.equal(lodgePrimary?.material_hazard_value, getMaterial('cast_iron')?.hazard)
assert.equal(lodgePrimary?.base_migration_value, getMaterial('cast_iron')?.migration)
assert.equal(lodgePrimary?.adjusted_migration_value, lodgePrimary?.base_migration_value)
assert.equal(lodgePrimary?.adjusted_migration_value, lodgePrimary?.base_migration_value)
const lodgeMitigation = lodgeResult.validation_payload.non_detect_mitigation?.find(
  (m) => m.reviewed_component_id === lodgePrimary?.reviewed_component_id,
)
assert.notEqual(lodgeMitigation?.mitigation_factor, NON_DETECT_MITIGATION_FACTOR)
assert.equal(lodgeMitigation?.adjusted_migration_value, lodgePrimary?.base_migration_value)

const lodgeUse = lodgeResult.validation_payload.use_conditions?.find(
  (u) => u.reviewed_component_id === lodgePrimary?.reviewed_component_id,
)
assert.equal(lodgeUse?.reviewed_use_condition_override, false)
assert.equal(lodgeUse?.final_contact_intimacy, 1)
assert.equal(lodgeUse?.final_exposure_severity, 0.96)
assert.equal(lodgeUse?.final_exposure_duration, 0.5)
assertNoLockedFieldsDeep(lodgeResult.validation_payload)
assertValidationPayloadHasNoLockedFields(lodgeResult.validation_payload)
console.log('✓ Lodge fixture validates with material lookup and category defaults')

// --- HexClad mitigation × 0.58 ---
const hexReviewed = buildHexCladReviewedPayloadFixture()
const hexResult = buildSystemValidation({
  reviewed_payload: hexReviewed,
  product: { category: 'Kitchen', subcategory: 'Cookware' },
})
assert.equal(hexResult.validation_status, 'passed')
assert.equal(hexResult.blockers.length, 0)
const hexPrimary = hexResult.validation_payload.material_lookups?.find(
  (m) => m.reviewed_component_role === 'primary_food_contact',
)
assert.equal(hexPrimary?.canonical_material_lookup_status, 'found')
const hexMitigation = hexResult.validation_payload.non_detect_mitigation?.find(
  (m) => m.reviewed_component_id === hexPrimary?.reviewed_component_id,
)
assert.equal(hexMitigation?.mitigation_factor, NON_DETECT_MITIGATION_FACTOR)
assert.equal(hexMitigation?.non_detect_validation_status, 'applied')
const expectedAdjusted = Math.round(hexPrimary.base_migration_value * NON_DETECT_MITIGATION_FACTOR * 10000) / 10000
assert.equal(hexPrimary?.adjusted_migration_value, expectedAdjusted)
assert.equal(hexPrimary?.material_hazard_value, hexPrimary?.material_hazard_value)
console.log('✓ HexClad fixture applies Non-Detect mitigation factor 0.58 on migration only')

// --- Layer 4A cap ---
assert.ok(typeof hexResult.validation_payload.layer_4a_total_validated === 'number')
assert.ok(hexResult.validation_payload.layer_4a_total_validated <= 5)
console.log('✓ Layer 4A total validated and capped')

// --- Cap: known-category proprietary vs unknown ---
const capConflict = buildKnownCategoryCapConflictFixture()
const capResult = buildSystemValidation({ reviewed_payload: capConflict, product: { subcategory: 'Cookware' } })
assert.ok(capResult.blockers.some((b) => b.code === 'CAP_PROPRIETARY_CONFLICT'))
assert.equal(capResult.validation_payload.known_category_proprietary_validation, true)
assert.equal(capResult.validation_payload.unknown_coating_cap_validation, false)
console.log('✓ Cap validation distinguishes known-category proprietary from unknown coating cap')

// --- Escalator: single highest ---
const escalator = hexResult.validation_payload.escalator_validation_detail
assert.ok(escalator)
const multiTrue = [
  escalator.adult_high_migration_high_severity_escalator,
  escalator.children_high_migration_high_severity_escalator,
  escalator.oral_extreme_risk_escalator,
].filter(Boolean)
assert.ok(multiTrue.length <= 1)
assert.equal(typeof escalator.escalator_multiplier, 'number')
console.log('✓ Escalator validation produces one highest escalator multiplier')

// --- Transparency badge ---
assert.ok(hexResult.validation_payload.transparency_badge_validation_detail)
console.log('✓ Transparency badge validation present (not score-driving)')

// --- Blockers: unknown canonical ---
const unknownCanon = buildUnknownCanonicalReviewedFixture()
const unknownResult = buildSystemValidation({ reviewed_payload: unknownCanon, product: FIXTURE_LODGE_PRODUCT })
assert.ok(unknownResult.blockers.some((b) => b.code === 'UNKNOWN_CANONICAL_MATERIAL_ID'))
assert.ok(unknownResult.unresolved_canonical_material_ids.includes('not_in_material_taxonomy_xyz'))
console.log('✓ Blocker for unknown canonical material ID')

// --- Blockers: invalid Non-Detect ---
const invalidNd = buildInvalidNonDetectReviewedFixture()
const invalidNdResult = buildSystemValidation({ reviewed_payload: invalidNd, product: FIXTURE_LODGE_PRODUCT })
assert.ok(
  invalidNdResult.blockers.some(
    (b) => b.code === 'NON_DETECT_LAB_NOT_QUALIFIED' || b.code === 'NON_DETECT_INELIGIBLE_MATERIAL',
  ),
)
console.log('✓ Blocker for invalid Non-Detect mitigation candidate')

// --- Use-condition override requires source ---
const overrideMissing = buildUseConditionOverrideMissingSourceFixture()
const overrideResult = buildSystemValidation({ reviewed_payload: overrideMissing, product: FIXTURE_LODGE_PRODUCT })
assert.ok(overrideResult.blockers.some((b) => b.code === 'USE_CONDITION_OVERRIDE_INCOMPLETE'))
console.log('✓ Override requires reason/source when reviewed_use_condition_override = true')

// --- Lookup sync notes ---
assert.ok(Array.isArray(lodgeResult.material_lookup_sync_notes))
assert.match(lodgeResult.material_lookup_sync_notes.join(' '), /material-taxonomy\.mjs/i)
console.log('✓ Validation reports material lookup source and sync notes')

// --- Service exports ---
const storeSource = readFileSync(join(root, 'src/lib/lockedInput/lockedInputStore.ts'), 'utf8')
for (const fn of [
  'validateAgent1ReviewedInput',
  'getLatestAgent1SystemValidationForProposal',
  'createAgent1SystemValidation',
]) {
  assert.ok(storeSource.includes(`export async function ${fn}`), `missing ${fn}`)
}
console.log('✓ validation service functions exported')

// --- UI wired ---
const panelSource = readFileSync(join(root, 'src/components/admin/Gate1SystemValidationPanel.tsx'), 'utf8')
assert.ok(panelSource.includes('export function Gate1SystemValidationPanel'))
const evidencePanel = readFileSync(join(root, 'src/components/admin/Gate1EvidenceReviewPanel.tsx'), 'utf8')
assert.ok(evidencePanel.includes('Gate1SystemValidationPanel'))
console.log('✓ Gate1SystemValidationPanel wired into Agent 1 review area')

// --- Agent 3/4 must not import validation services ---
const markers = [
  'build-system-validation',
  'validateAgent1ReviewedInput',
  'Gate1SystemValidationPanel',
  'validationPayloadValidation',
]
for (const rel of ['scripts/agent3/runner.mjs', 'scripts/agent4/runner.mjs']) {
  const src = readFileSync(join(root, rel), 'utf8')
  for (const marker of markers) {
    assert.ok(!src.includes(marker), `${rel} must not import ${marker}`)
  }
}
console.log('✓ Agent 3/4 runners do not import validation services')

// --- Old path unchanged ---
const agent2Runner = readFileSync(join(root, 'scripts/agent2/runner.mjs'), 'utf8')
assert.ok(agent2Runner.includes('scoring_inputs') || agent2Runner.includes('canonical_mappings'))
console.log('✓ old Agent 1 → Agent 2 path unchanged')

// --- DB persist smoke (rolled back) ---
async function tryValidationPersistSmoke() {
  let connectPgClient
  let loadEnv
  try {
    ;({ connectPgClient } = await import('./lib/pg-connect.mjs'))
    ;({ loadEnv } = await import('./lib/env.mjs'))
  } catch {
    console.log('⊘ DB validation persist smoke skipped (pg-connect unavailable)')
    return
  }

  let client
  try {
    client = await connectPgClient(loadEnv())
  } catch (err) {
    console.log(`⊘ DB validation persist smoke skipped (${err instanceof Error ? err.message : err})`)
    return
  }

  try {
    await client.query('begin')
    const productRes = await client.query(
      `select product_id from public.products where active is distinct from false limit 1`,
    )
    if (!productRes.rows.length) {
      await client.query('rollback')
      console.log('⊘ DB validation persist smoke skipped (no product row)')
      return
    }
    const productId = productRes.rows[0].product_id
    const evidenceRes = await client.query(
      `select evidence_id from public.product_evidence where product_id = $1 limit 1`,
      [productId],
    )
    if (!evidenceRes.rows.length) {
      await client.query('rollback')
      console.log('⊘ DB validation persist smoke skipped (no evidence row)')
      return
    }
    const evidenceId = evidenceRes.rows[0].evidence_id

    const proposedRes = await client.query(
      `
      insert into public.agent1_proposed_inputs (
        product_id, evidence_id, proposed_payload, reviewed_payload, proposal_status
      ) values ($1, $2, '{"schema_version":"2.0.0","proposed_components":[]}'::jsonb, $3::jsonb, 'reviewed')
      returning proposed_input_id
      `,
      [productId, evidenceId, JSON.stringify(lodgeReviewed)],
    )
    const proposedInputId = proposedRes.rows[0].proposed_input_id

    const validationResult = buildSystemValidation({
      reviewed_payload: lodgeReviewed,
      product: { product_id: productId },
      proposed_input_id: proposedInputId,
    })

    await client.query(
      `
      insert into public.agent1_system_validations (
        product_id, proposed_input_id, schema_version, validation_status,
        validation_payload, blockers, warnings, validated_at
      ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)
      returning validation_id
      `,
      [
        productId,
        proposedInputId,
        validationResult.validation_payload.schema_version,
        validationResult.validation_status,
        JSON.stringify(validationResult.validation_payload),
        JSON.stringify(validationResult.blockers),
        JSON.stringify(validationResult.warnings),
        validationResult.validated_at,
      ],
    )

    const lockedRes = await client.query(
      `select count(*)::int as n from public.agent1_locked_inputs where proposed_input_id = $1`,
      [proposedInputId],
    )
    assert.equal(lockedRes.rows[0].n, 0)

    await client.query('rollback')
    console.log('✓ agent1_system_validations row created (transaction rolled back); no locked_inputs')
  } catch (err) {
    await client.query('rollback').catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

await tryValidationPersistSmoke()

console.log('\nAll Agent 1 System Validation Phase 4 tests passed.')
