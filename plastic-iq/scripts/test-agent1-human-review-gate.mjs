#!/usr/bin/env node
/**
 * Phase 3 — Agent 1 Human Review Gate contract tests (fixtures only; no live agents).
 * Run: npm run test:agent1-human-review-gate
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildProposedInputPayload } from '../scripts/agent1/build-proposed-inputs.mjs'
import {
  FIXTURE_LODGE_PRODUCT,
  buildLodgeProposedInputEvidenceRow,
} from '../src/shared/agent1/fixtures/lodgeProposedInput.fixture.mjs'
import {
  buildGate1ApprovalEligibilityHexCladV7Structured,
  buildGate1ApprovalEligibilityHexCladV7Sources,
} from '../src/shared/agent1/fixtures/gate1ApprovalEligibilityHexCladV7.fixture.mjs'
import {
  initializeReviewDraftFromProposed,
  computeReviewChangeSummary,
} from '../src/lib/lockedInput/reviewGateDraft.ts'
import {
  assertReviewedPayloadHasNoLockedFields,
  validateReviewedPayloadShape,
  ReviewedPayloadValidationError,
} from '../src/lib/lockedInput/reviewPayloadValidation.ts'
import { REVIEWED_PAYLOAD_SCHEMA_VERSION } from '../src/types/lockedInput.ts'

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

function assertReviewedComponentShape(component, label) {
  assert.ok(component.reviewed_component_role?.trim(), `${label}: role required`)
  assert.ok(component.reviewed_component_structure?.trim(), `${label}: structure required`)
  assert.ok(component.reviewed_contact_pathway?.trim(), `${label}: contact pathway required`)
  assert.equal(typeof component.reviewed_is_primary_contact, 'boolean', `${label}: primary contact`)
  assert.equal(typeof component.reviewed_is_score_driving, 'boolean', `${label}: score driving`)
  const canonical =
    component.confirmed_canonical_material_id ?? component.reviewed_canonical_material_id
  assert.ok(canonical?.trim(), `${label}: canonical material confirmation required`)
}

// --- Lodge simple inert review ---
const lodgeEvidence = buildLodgeProposedInputEvidenceRow()
const lodgeProposed = buildProposedInputPayload({
  product: FIXTURE_LODGE_PRODUCT,
  evidence: lodgeEvidence,
})
const lodgeReviewDraft = initializeReviewDraftFromProposed(lodgeProposed, null)

assert.equal(lodgeReviewDraft.schema_version, REVIEWED_PAYLOAD_SCHEMA_VERSION)
assert.equal(lodgeReviewDraft.not_validated, true)
assert.equal(lodgeReviewDraft.not_locked, true)
assert.ok(lodgeReviewDraft.reviewed_components.length >= 2)
const lodgePrimary = lodgeReviewDraft.reviewed_components.find(
  (c) => c.reviewed_component_role === 'primary_food_contact',
)
assert.equal(lodgePrimary?.confirmed_canonical_material_id, 'cast_iron')
assertReviewedComponentShape(lodgePrimary, 'Lodge primary')
assertNoLockedFieldsDeep(lodgeReviewDraft)
validateReviewedPayloadShape(lodgeReviewDraft)
console.log('✓ Lodge fixture → reviewed draft with cast_iron confirmation')

// --- HexClad complex hybrid/proprietary/lab review ---
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
const hexProposed = buildProposedInputPayload({ product: hexProduct, evidence: hexEvidence })
const hexReviewDraft = initializeReviewDraftFromProposed(hexProposed, null)

assert.equal(hexReviewDraft.reviewed_lab_evidence_status, 'third_party_non_detect')
assert.equal(hexReviewDraft.reviewed_non_detect_mitigation_candidate, true)
assert.equal(hexReviewDraft.reviewed_proprietary_status, 'known_category_proprietary')
assert.ok(hexReviewDraft.reviewed_layer_4a_credit_candidates?.length >= 1)
assert.ok(hexReviewDraft.reviewed_layer_4a_deduction_candidates?.length >= 1)
validateReviewedPayloadShape(hexReviewDraft)
console.log('✓ HexClad fixture → lab, Layer 4A, proprietary review fields')

// --- Correct proposed canonical material ID ---
const correctedDraft = structuredClone(lodgeReviewDraft)
const correctedPrimaryIdx = correctedDraft.reviewed_components.findIndex(
  (c) => c.reviewed_component_role === 'primary_food_contact',
)
correctedDraft.reviewed_components[correctedPrimaryIdx] = {
  ...correctedDraft.reviewed_components[correctedPrimaryIdx],
  confirmed_canonical_material_id: 'carbon_steel',
}
const changeSummary = computeReviewChangeSummary(lodgeProposed, correctedDraft)
assert.match(changeSummary, /cast_iron/)
assert.match(changeSummary, /carbon_steel/)
validateReviewedPayloadShape(correctedDraft)
assert.equal(correctedDraft.reviewed_components[correctedPrimaryIdx].confirmed_canonical_material_id, 'carbon_steel')
console.log('✓ reviewed_payload can correct proposed_canonical_material_id')

// --- Use-condition override false (category defaults) ---
const useConditionDraft = {
  ...lodgeReviewDraft,
  reviewed_use_condition_override: false,
  reviewed_use_condition_override_reason:
    'No evidence-backed override approved; category defaults should apply.',
}
validateReviewedPayloadShape(useConditionDraft)
assert.equal(useConditionDraft.reviewed_use_condition_override, false)
console.log('✓ reviewed use-condition override false saves with category-default reason')

// --- Cap/escalator/badge candidates ---
const candidateDraft = {
  ...hexReviewDraft,
  reviewed_cap_flag: true,
  reviewed_cap_reason: 'unknown coating family',
  reviewed_escalator_candidate: 'proprietary_formula',
  reviewed_escalator_reason: 'undisclosed ceramic coating',
  reviewed_transparency_badge: 'Material Uncertain',
  reviewed_badge_basis: 'proprietary coating disclosure gap',
}
validateReviewedPayloadShape(candidateDraft)
console.log('✓ reviewed Layer 4A/cap/escalator/badge candidate fields validate')

// --- Reject locked_* keys ---
assert.throws(
  () =>
    assertReviewedPayloadHasNoLockedFields({
      reviewed_components: [{ locked_canonical_material_id: 'cast_iron' }],
    }),
  ReviewedPayloadValidationError,
)
assert.throws(
  () =>
    validateReviewedPayloadShape({
      schema_version: REVIEWED_PAYLOAD_SCHEMA_VERSION,
      reviewed_components: [
        {
          reviewed_component_id: 'x',
          reviewed_component_role: 'primary_food_contact',
          reviewed_component_structure: 'single_material',
          reviewed_contact_pathway: 'food',
          reviewed_is_primary_contact: true,
          reviewed_is_score_driving: true,
          locked_canonical_material_id: 'cast_iron',
        },
      ],
    }),
  ReviewedPayloadValidationError,
)
console.log('✓ reviewed_payload rejects locked_* keys including locked_canonical_material_id')

// --- Service exports ---
const storeSource = readFileSync(join(root, 'src/lib/lockedInput/lockedInputStore.ts'), 'utf8')
for (const fn of ['saveAgent1ReviewedInput', 'getAgent1ReviewDraft']) {
  assert.ok(storeSource.includes(`export async function ${fn}`), `missing ${fn}`)
}
const indexSource = readFileSync(join(root, 'src/lib/lockedInput/index.ts'), 'utf8')
assert.ok(indexSource.includes('saveAgent1ReviewedInput'))
assert.ok(indexSource.includes('assertReviewedPayloadHasNoLockedFields'))
console.log('✓ review save/get service functions exported')

// --- UI component exists ---
const panelSource = readFileSync(
  join(root, 'src/components/admin/Gate1HumanReviewGatePanel.tsx'),
  'utf8',
)
assert.ok(panelSource.includes('export function Gate1HumanReviewGatePanel'))
const evidencePanel = readFileSync(
  join(root, 'src/components/admin/Gate1EvidenceReviewPanel.tsx'),
  'utf8',
)
assert.ok(evidencePanel.includes('Gate1HumanReviewGatePanel'))
console.log('✓ Gate1HumanReviewGatePanel wired into Agent 1 review area')

// --- Agent 3/4 must not import review-gate services ---
const reviewGateMarkers = [
  'reviewGateDraft',
  'reviewPayloadValidation',
  'saveAgent1ReviewedInput',
  'Gate1HumanReviewGatePanel',
]
for (const rel of ['scripts/agent3/runner.mjs', 'scripts/agent4/runner.mjs']) {
  const src = readFileSync(join(root, rel), 'utf8')
  for (const marker of reviewGateMarkers) {
    assert.ok(!src.includes(marker), `${rel} must not import ${marker}`)
  }
}
console.log('✓ Agent 3/4 runners do not import review-gate services')

// --- Old Agent 1 → Agent 2 path unchanged ---
const agent2Runner = readFileSync(join(root, 'scripts/agent2/runner.mjs'), 'utf8')
assert.ok(agent2Runner.includes('canonical_mappings') || agent2Runner.includes('scoring_inputs'))
const agent1Runner = readFileSync(join(root, 'scripts/agent1/runner.mjs'), 'utf8')
assert.ok(agent1Runner.includes('tryPersistProposedInputDraft'))
assert.ok(!agent1Runner.includes('saveAgent1ReviewedInput'))
console.log('✓ old Agent 1 → Agent 2 path unchanged; runner does not call review save')

// --- Optional DB save smoke (rolled back) ---
async function tryReviewSaveSmoke() {
  let connectPgClient
  let loadEnv
  try {
    ;({ connectPgClient } = await import('./lib/pg-connect.mjs'))
    ;({ loadEnv } = await import('./lib/env.mjs'))
  } catch {
    console.log('⊘ DB review save smoke skipped (pg-connect unavailable)')
    return
  }

  let client
  try {
    client = await connectPgClient(loadEnv())
  } catch (err) {
    console.log(`⊘ DB review save smoke skipped (${err instanceof Error ? err.message : err})`)
    return
  }

  try {
    await client.query('begin')

    const productRes = await client.query(
      `select product_id from public.products where active is distinct from false limit 1`,
    )
    if (!productRes.rows.length) {
      await client.query('rollback')
      console.log('⊘ DB review save smoke skipped (no product row)')
      return
    }
    const productId = productRes.rows[0].product_id

    const evidenceRes = await client.query(
      `select evidence_id from public.product_evidence where product_id = $1 limit 1`,
      [productId],
    )
    if (!evidenceRes.rows.length) {
      await client.query('rollback')
      console.log('⊘ DB review save smoke skipped (no evidence row)')
      return
    }
    const evidenceId = evidenceRes.rows[0].evidence_id

    const proposedPayloadJson = JSON.stringify(lodgeProposed)
    const insertRes = await client.query(
      `
      insert into public.agent1_proposed_inputs (
        product_id, evidence_id, proposed_payload, proposal_status
      ) values ($1, $2, $3::jsonb, 'draft')
      returning proposed_input_id, proposed_payload
      `,
      [productId, evidenceId, proposedPayloadJson],
    )
    const proposedInputId = insertRes.rows[0].proposed_input_id
    const originalProposed = insertRes.rows[0].proposed_payload

    const reviewedPayload = {
      ...lodgeReviewDraft,
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'test-reviewer@fixture.local',
      review_notes: 'Fixture review save',
      review_change_summary: 'Confirmed proposed values without material changes',
    }
    validateReviewedPayloadShape(reviewedPayload)
    assertNoLockedFieldsDeep(reviewedPayload)

    const reviewedAt = new Date().toISOString()
    await client.query(
      `
      update public.agent1_proposed_inputs
      set reviewed_payload = $1::jsonb,
          reviewed_at = $2,
          reviewed_by = $3,
          proposal_status = 'reviewed',
          updated_at = $2
      where proposed_input_id = $4
      `,
      [JSON.stringify(reviewedPayload), reviewedAt, 'test-reviewer@fixture.local', proposedInputId],
    )

    const rowRes = await client.query(
      `select * from public.agent1_proposed_inputs where proposed_input_id = $1`,
      [proposedInputId],
    )
    const row = rowRes.rows[0]
    assert.equal(row.proposal_status, 'reviewed')
    assert.ok(row.reviewed_payload)
    assert.equal(row.reviewed_by, 'test-reviewer@fixture.local')
    assert.deepEqual(row.proposed_payload, originalProposed, 'proposed_payload must remain unchanged')
    assert.equal(
      row.reviewed_payload.reviewed_components[0].confirmed_canonical_material_id ??
        row.reviewed_payload.reviewed_components[0].reviewed_canonical_material_id,
      lodgePrimary?.confirmed_canonical_material_id,
    )
    assertNoLockedFieldsDeep(row.reviewed_payload)

    const sysValRes = await client.query(
      `select count(*)::int as n from public.agent1_system_validations where proposed_input_id = $1`,
      [proposedInputId],
    )
    assert.equal(sysValRes.rows[0].n, 0)

    const lockedRes = await client.query(
      `select count(*)::int as n from public.agent1_locked_inputs where proposed_input_id = $1`,
      [proposedInputId],
    )
    assert.equal(lockedRes.rows[0].n, 0)

    await client.query('rollback')
    console.log('✓ reviewed_payload saved on agent1_proposed_inputs (transaction rolled back)')
    console.log('✓ proposal_status → reviewed; no system_validations or locked_inputs rows')
  } catch (err) {
    await client.query('rollback').catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

await tryReviewSaveSmoke()

console.log('\nAll Agent 1 Human Review Gate Phase 3 tests passed.')
