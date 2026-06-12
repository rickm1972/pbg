#!/usr/bin/env node
/**
 * Phase 5 — Agent 1 Locked Input Package contract tests (fixtures only; no live agents).
 * Run: npm run test:agent1-locked-input-package
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildLockedInputPackage,
  checkLockEligibility,
  LockEligibilityError,
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from '../src/lib/lockedInput/buildLockedInputPackage.ts'
import { buildSystemValidation } from '../src/lib/lockedInput/buildSystemValidation.ts'
import { hashLockedInputPayload } from '../src/lib/lockedInput/lockHash.ts'
import {
  buildLodgeReviewedPayloadFixture,
  buildHexCladReviewedPayloadFixture,
  buildUnknownCanonicalReviewedFixture,
  buildKnownCategoryCapConflictFixture,
} from '../src/shared/agent1/fixtures/systemValidation.fixture.mjs'
import { FIXTURE_LODGE_PRODUCT } from '../src/shared/agent1/fixtures/lodgeProposedInput.fixture.mjs'
import { LOCKED_INPUT_SCHEMA_VERSION, LOCKED_PAYLOAD_SCHEMA_VERSION } from '../src/types/lockedInput.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function assertNoForbiddenFields(payload) {
  const walk = (value, path = '') => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) walk(value[i], `${path}[${i}]`)
      return
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        assert.notEqual(key, 'proposed_canonical_material_id', path)
        assert.notEqual(key, 'confirmed_canonical_material_id', path)
        walk(child, path ? `${path}.${key}` : key)
      }
    }
  }
  walk(payload)
}

function buildFixtureContext(reviewed, product = FIXTURE_LODGE_PRODUCT) {
  const proposedInputId = `fixture-proposed-${product.product_id.slice(-4)}`
  const evidenceId = `00000000-0000-4000-8000-0000000000${product.product_id.slice(-2)}`
  const validationResult = buildSystemValidation({
    reviewed_payload: reviewed,
    product,
    proposed_input_id: proposedInputId,
    evidence_id: evidenceId,
  })
  const proposed = {
    proposed_input_id: proposedInputId,
    product_id: product.product_id,
    evidence_id: evidenceId,
    proposal_status: 'reviewed',
    reviewed_payload: reviewed,
    reviewed_at: reviewed.reviewed_at ?? new Date().toISOString(),
    reviewed_by: reviewed.reviewed_by ?? 'fixture-reviewer',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const validation = {
    validation_id: `fixture-validation-${product.product_id.slice(-4)}`,
    product_id: product.product_id,
    proposed_input_id: proposedInputId,
    validation_status: validationResult.validation_status,
    validation_payload: validationResult.validation_payload,
    blockers: validationResult.blockers,
    warnings: validationResult.warnings,
    validated_at: validationResult.validated_at,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  return { proposed, validation, validationResult }
}

function assertLockedFieldPresence(locked, primary) {
  assert.ok(primary.locked_canonical_material_id)
  assert.ok(primary.locked_resolved_material_taxonomy_id)
  assert.equal(typeof primary.locked_material_hazard_value, 'number')
  assert.equal(typeof primary.locked_base_migration_value, 'number')
  assert.equal(typeof primary.locked_adjusted_migration_value, 'number')
  assert.equal(typeof primary.locked_contact_intimacy, 'number')
  assert.equal(typeof primary.locked_exposure_severity, 'number')
  assert.equal(typeof primary.locked_exposure_duration, 'number')
  assert.equal(typeof locked.locked_layer_4a_total, 'number')
  assert.equal(typeof locked.locked_cap_triggered, 'boolean')
  assert.equal(typeof locked.locked_escalator_multiplier, 'number')
  assert.equal(locked.methodology_version, METHODOLOGY_VERSION)
  assert.equal(locked.material_lookup_version, MATERIAL_LOOKUP_VERSION)
}

// --- Lodge passed validation → lock ---
const lodgeCtx = buildFixtureContext(buildLodgeReviewedPayloadFixture())
assert.equal(lodgeCtx.validation.validation_status, 'passed')
const lodgeEligibility = checkLockEligibility(lodgeCtx)
assert.equal(lodgeEligibility.eligible, true)
const lodgeLocked = buildLockedInputPackage({
  proposed: lodgeCtx.proposed,
  validation: lodgeCtx.validation,
})
assert.equal(lodgeLocked.schema_version, LOCKED_PAYLOAD_SCHEMA_VERSION)
assertNoForbiddenFields(lodgeLocked)
const lodgePrimary = lodgeLocked.locked_components.find(
  (c) => c.locked_component_role === 'primary_food_contact',
)
assertLockedFieldPresence(lodgeLocked, lodgePrimary)
assert.equal(lodgePrimary.locked_resolved_material_taxonomy_id, 'cast_iron')
console.log('✓ Lodge reviewed + passed validation → locked package')

// --- HexClad passed validation → lock (real fixture, no synthetic patch) ---
const hexReviewed = buildHexCladReviewedPayloadFixture()
const hexProduct = {
  product_id: '00000000-0000-4000-8000-000000000002',
  category: 'Kitchen',
  subcategory: 'Cookware',
  product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  brand: 'HexClad',
}
const hexCtx = buildFixtureContext(hexReviewed, hexProduct)
assert.equal(hexCtx.validation.validation_status, 'passed')
assert.equal(hexCtx.validation.blockers.length, 0)
const hexLocked = buildLockedInputPackage({ proposed: hexCtx.proposed, validation: hexCtx.validation })
const hexPrimary = hexLocked.locked_components.find(
  (c) => c.locked_component_role === 'primary_food_contact',
)
assert.ok(hexPrimary?.locked_non_detect_mitigation_applied)
assert.equal(hexPrimary?.locked_non_detect_mitigation_factor, 0.58)
assert.equal(hexPrimary?.locked_material_hazard_value, 0.35)
assert.equal(hexLocked.locked_cap_triggered, false)
console.log('✓ HexClad reviewed + passed validation → locked package (real fixture)')

// --- Block cases ---
assert.throws(
  () =>
    buildLockedInputPackage({
      proposed: { ...lodgeCtx.proposed, reviewed_payload: null },
      validation: lodgeCtx.validation,
    }),
  LockEligibilityError,
)
console.log('✓ Lock blocked when reviewed_payload missing')

assert.throws(
  () =>
    buildLockedInputPackage({
      proposed: lodgeCtx.proposed,
      validation: { ...lodgeCtx.validation, validation_payload: null },
    }),
  LockEligibilityError,
)
console.log('✓ Lock blocked when validation_payload missing')

assert.throws(
  () =>
    buildLockedInputPackage({
      proposed: lodgeCtx.proposed,
      validation: { ...lodgeCtx.validation, validation_status: 'failed' },
    }),
  LockEligibilityError,
)
console.log('✓ Lock blocked when validation_status is not passed')

const capCtx = buildFixtureContext(buildKnownCategoryCapConflictFixture())
assert.throws(
  () => buildLockedInputPackage({ proposed: capCtx.proposed, validation: capCtx.validation }),
  LockEligibilityError,
)
console.log('✓ Lock blocked when validation blockers present')

const unknownCtx = buildFixtureContext(buildUnknownCanonicalReviewedFixture())
assert.throws(
  () => buildLockedInputPackage({ proposed: unknownCtx.proposed, validation: unknownCtx.validation }),
  LockEligibilityError,
)
console.log('✓ Lock blocked when unresolved canonical IDs remain')

const badMethodology = {
  ...lodgeCtx.validation,
  validation_payload: {
    ...lodgeCtx.validation.validation_payload,
    methodology_version: 'v2.3.4',
  },
}
assert.throws(
  () => buildLockedInputPackage({ proposed: lodgeCtx.proposed, validation: badMethodology }),
  (err) => err instanceof LockEligibilityError && err.blockers.some((b) => b.includes('methodology_version')),
)
const missingLookup = {
  ...lodgeCtx.validation,
  validation_payload: {
    ...lodgeCtx.validation.validation_payload,
    material_lookup_version: undefined,
  },
}
assert.throws(
  () => buildLockedInputPackage({ proposed: lodgeCtx.proposed, validation: missingLookup }),
  LockEligibilityError,
)
console.log('✓ Lock blocked when methodology_version or material_lookup_version wrong/missing')

const lockHash = hashLockedInputPayload(lodgeLocked)
assert.match(lockHash, /^[a-f0-9]{64}$/)
console.log('✓ lock_hash is created from locked_payload')

// --- Agent 3/4 isolation ---
const agent3Src = readFileSync(join(root, 'scripts/agent3/runner.mjs'), 'utf8')
const agent4Src = readFileSync(join(root, 'scripts/agent4/constants.mjs'), 'utf8')
const agent3Algo = readFileSync(join(root, 'scripts/agent3/algorithm.mjs'), 'utf8')
for (const [label, src] of [
  ['agent3/runner', agent3Src],
  ['agent3/algorithm', agent3Algo],
  ['agent4/constants', agent4Src],
]) {
  assert.ok(!src.includes('buildLockedInputPackage'), `${label} must not import lock builder`)
  assert.ok(!src.includes('createLockedInputPackageFromValidation'), `${label} must not import lock service`)
  assert.ok(!src.includes('agent1_locked_inputs'), `${label} must not reference agent1_locked_inputs`)
}
console.log('✓ Agent 3/4 do not import locked package services')

const agent1Runner = readFileSync(join(root, 'scripts/agent1/runner.mjs'), 'utf8')
assert.ok(!agent1Runner.includes('createLockedInputPackageFromValidation'), 'agent1 runner does not auto-lock')
console.log('✓ Old Agent 1 → Agent 2 path remains unchanged in runner')

assert.ok(readFileSync(join(root, 'src/lib/lockedInput/buildLockedInputPackage.ts'), 'utf8').includes('export function buildLockedInputPackage'))
assert.ok(readFileSync(join(root, 'scripts/agent1/build-locked-input-package.mjs'), 'utf8').includes('buildLockedInputPackage'))
console.log('✓ Lock builder module and CLI shim present')

const panelSrc = readFileSync(join(root, 'src/components/admin/Gate1LockedInputPackagePanel.tsx'), 'utf8')
assert.ok(panelSrc.includes('Gate1LockedInputPackagePanel'))
assert.ok(panelSrc.includes('Agent 3 is not wired yet'))
console.log('✓ Gate1LockedInputPackagePanel UI present')

async function tryDbLockSmoke() {
  let connectPgClient
  let loadEnv
  try {
    ;({ connectPgClient } = await import('./lib/pg-connect.mjs'))
    ;({ loadEnv } = await import('./lib/env.mjs'))
  } catch {
    console.log('⊘ DB lock smoke skipped (pg-connect unavailable)')
    return
  }

  let client
  try {
    client = await connectPgClient(loadEnv())
  } catch (err) {
    console.log(`⊘ DB lock smoke skipped (${err instanceof Error ? err.message : err})`)
    return
  }

  try {
    const migrationSql = readFileSync(
      join(root, 'supabase/migrations/0041_agent1_locked_inputs.sql'),
      'utf8',
    )
    await client.query('begin')
    await client.query(migrationSql)

    const productRes = await client.query(
      `
      select p.product_id
      from public.products p
      where p.active is distinct from false
        and not exists (
          select 1
          from public.agent1_locked_inputs li
          where li.product_id = p.product_id
            and li.locked_input_status = 'locked_for_agent_3'
        )
      limit 1
      `,
    )
    if (!productRes.rows.length) {
      await client.query('rollback')
      console.log('⊘ DB lock smoke skipped (no products row)')
      return
    }
    const productId = productRes.rows[0].product_id

    const evidenceRes = await client.query(
      `select evidence_id from public.product_evidence where product_id = $1 limit 1`,
      [productId],
    )
    if (!evidenceRes.rows.length) {
      await client.query('rollback')
      console.log('⊘ DB lock smoke skipped (no evidence row)')
      return
    }
    const evidenceId = evidenceRes.rows[0].evidence_id

    const proposedRes = await client.query(
      `
      insert into public.agent1_proposed_inputs (
        product_id, evidence_id, proposal_status, proposed_payload, reviewed_payload
      ) values (
        $1, $2, 'reviewed', $3::jsonb, $4::jsonb
      ) returning proposed_input_id
      `,
      [
        productId,
        evidenceId,
        JSON.stringify({ schema_version: LOCKED_INPUT_SCHEMA_VERSION, proposed_components: [] }),
        JSON.stringify(lodgeCtx.proposed.reviewed_payload),
      ],
    )
    const proposedInputId = proposedRes.rows[0].proposed_input_id

    const validationRes = await client.query(
      `
      insert into public.agent1_system_validations (
        product_id, proposed_input_id, validation_status, validation_payload, blockers
      ) values ($1, $2, 'passed', $3::jsonb, '[]'::jsonb)
      returning validation_id
      `,
      [productId, proposedInputId, JSON.stringify(lodgeLocked)],
    )
    const validationId = validationRes.rows[0].validation_id

    const scoringBefore = await client.query(
      `select count(*)::int as n from public.scoring_inputs where product_id = $1`,
      [productId],
    )
    const scoresBefore = await client.query(
      `select count(*)::int as n from public.product_scores where product_id = $1`,
      [productId],
    )

    const lockedRes = await client.query(
      `
      insert into public.agent1_locked_inputs (
        product_id, proposed_input_id, validation_id, locked_payload, locked_input_status, lock_hash, locked_at
      ) values ($1, $2, $3, $4::jsonb, 'locked_for_agent_3', $5, now())
      returning locked_input_id
      `,
      [productId, proposedInputId, validationId, JSON.stringify(lodgeLocked), lockHash],
    )
    const lockedInputId = lockedRes.rows[0].locked_input_id

    const scoringAfter = await client.query(
      `select count(*)::int as n from public.scoring_inputs where product_id = $1`,
      [productId],
    )
    const scoresAfter = await client.query(
      `select count(*)::int as n from public.product_scores where product_id = $1`,
      [productId],
    )
    assert.equal(scoringBefore.rows[0].n, scoringAfter.rows[0].n)
    assert.equal(scoresBefore.rows[0].n, scoresAfter.rows[0].n)
    console.log('✓ No scoring_inputs or product_scores rows created on lock insert')

    let updateBlocked = false
    try {
      await client.query(
        `update public.agent1_locked_inputs set locked_payload = $1::jsonb where locked_input_id = $2`,
        [JSON.stringify({ ...lodgeLocked, locked_input_notes: 'mutated' }), lockedInputId],
      )
    } catch (err) {
      updateBlocked = /immutable/i.test(String(err))
    }
    assert.equal(updateBlocked, true)
    console.log('✓ locked_payload cannot be updated after locked_for_agent_3')

    let deleteBlocked = false
    try {
      await client.query(`delete from public.agent1_locked_inputs where locked_input_id = $1`, [
        lockedInputId,
      ])
    } catch (err) {
      deleteBlocked = /Cannot delete|immutable/i.test(String(err))
    }
    assert.equal(deleteBlocked, true)
    console.log('✓ locked_for_agent_3 row cannot be deleted')

    let uniqueBlocked = false
    try {
      await client.query(
        `
        insert into public.agent1_locked_inputs (
          product_id, proposed_input_id, validation_id, locked_payload, locked_input_status
        ) values ($1, $2, $3, $4::jsonb, 'locked_for_agent_3')
        `,
        [productId, proposedInputId, validationId, JSON.stringify(lodgeLocked)],
      )
    } catch (err) {
      uniqueBlocked = /unique|duplicate/i.test(String(err))
    }
    assert.equal(uniqueBlocked, true, 'second active lock blocked while first remains active')
    console.log('✓ Active lock uniqueness per product enforced')

    const secondLockRes = await client.query(
      `
      insert into public.agent1_locked_inputs (
        product_id, proposed_input_id, validation_id, locked_payload, locked_input_status
      ) values ($1, $2, $3, $4::jsonb, 'draft')
      returning locked_input_id
      `,
      [productId, proposedInputId, validationId, JSON.stringify(lodgeLocked)],
    )
    const secondLockId = secondLockRes.rows[0].locked_input_id

    await client.query(
      `
      update public.agent1_locked_inputs
      set locked_input_status = 'superseded', superseded_by = $1, updated_at = now()
      where locked_input_id = $2
      `,
      [secondLockId, lockedInputId],
    )

    await client.query(
      `
      update public.agent1_locked_inputs
      set locked_input_status = 'locked_for_agent_3', lock_hash = $1, locked_at = now(), updated_at = now()
      where locked_input_id = $2
      `,
      [lockHash, secondLockId],
    )
    console.log('✓ Supersede allows new locked_for_agent_3 package for same product')

    await client.query('rollback')
  } finally {
    await client.end()
  }
}

await tryDbLockSmoke()

console.log('\nAll Agent 1 locked input package Phase 5 tests passed.')
