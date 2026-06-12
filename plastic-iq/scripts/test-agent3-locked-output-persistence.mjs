#!/usr/bin/env node
/**
 * Phase 6.7 — Agent 3 locked-output persistence (fixtures + optional DB rollback smoke).
 * Run: npm run test:agent3-locked-output-persistence
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyTestMigrationsIfNeeded,
  assertTestTransactionActive,
  beginTestTransaction,
  rollbackTestTransaction,
} from './lib/test-migration-sql.mjs'
import {
  ensureSmokeTestProduct,
  SMOKE_TEST_HEXCLAD_PRODUCT,
  SMOKE_TEST_LODGE_PRODUCT,
} from './lib/locked-pipeline-smoke-db.mjs'
import {
  runAgent3FromLockedInputPackage,
  runAgent3LockedInputAndPersist,
} from '../scripts/agent3/run-locked-input.mjs'
import { buildSystemValidation } from '../src/lib/lockedInput/buildSystemValidation.ts'
import { buildLockedInputPackage } from '../src/lib/lockedInput/buildLockedInputPackage.ts'
import {
  buildLodgeReviewedPayloadFixture,
  buildHexCladReviewedPayloadFixture,
} from '../src/shared/agent1/fixtures/systemValidation.fixture.mjs'
import { FIXTURE_LODGE_PRODUCT } from '../src/shared/agent1/fixtures/lodgeProposedInput.fixture.mjs'
import {
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from '../src/lib/lockedInput/buildLockedInputPackage.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const hexProduct = {
  product_id: '00000000-0000-4000-8000-000000000002',
  product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
  brand: 'HexClad',
  category: 'Kitchen',
  subcategory: 'Cookware',
}

function buildLockedFixture(reviewed, product, lockId) {
  const validationResult = buildSystemValidation({
    reviewed_payload: reviewed,
    product,
    proposed_input_id: lockId,
    evidence_id: lockId,
  })
  assert.equal(validationResult.validation_status, 'passed')
  return buildLockedInputPackage({
    proposed: {
      proposed_input_id: lockId,
      product_id: product.product_id,
      evidence_id: lockId,
      reviewed_payload: reviewed,
    },
    validation: {
      validation_id: `${lockId}-v`,
      validation_status: validationResult.validation_status,
      validation_payload: validationResult.validation_payload,
      blockers: validationResult.blockers,
    },
  })
}

const lodgeLocked = buildLockedFixture(
  buildLodgeReviewedPayloadFixture(),
  FIXTURE_LODGE_PRODUCT,
  'lodge-lock-67',
)
const hexLocked = buildLockedFixture(buildHexCladReviewedPayloadFixture(), hexProduct, 'hex-lock-67')

// --- Opt-in required ---
const dryLodge = runAgent3FromLockedInputPackage({
  lockedPayload: lodgeLocked,
  lockedInputId: 'lodge-li',
  lockHash: 'abc',
  dryRun: true,
  persist: false,
})
assert.equal(dryLodge.dry_run, true)
assert.equal(dryLodge.wrote_product_scores, false)
assert.equal(dryLodge.wrote_scoring_inputs, false)
assert.equal(dryLodge.wrote_agent3_locked_outputs, false)
console.log('✓ Dry-run default creates no DB output flags')

const dryHex = runAgent3FromLockedInputPackage({
  lockedPayload: hexLocked,
  lockedInputId: 'hex-li',
  lockHash: 'def',
})
assert.equal(dryHex.persist_requested, false)
assert.equal(dryHex.wrote_agent3_locked_outputs, false)
console.log('✓ Persistence requires explicit persist: true')

// --- Lodge fixture score ---
assert.equal(dryLodge.result.pac_safety_score, 99)
assert.equal(dryLodge.result.tier, 'Excellent')
assert.equal(dryLodge.result.transparency_badge, 'Fully Disclosed')
console.log('✓ Lodge fixture scores 99 / Excellent / Fully Disclosed')

// --- HexClad fixture score + diagnostics ---
assert.equal(dryHex.result.pac_safety_score, 78)
assert.equal(dryHex.result.tier, 'Good')
assert.equal(dryHex.result.transparency_badge, 'Documentation Incomplete')
assert.ok(dryHex.result.weighted_npr >= 14.0 && dryHex.result.weighted_npr <= 14.5)
assert.ok(dryHex.result.raw_score_before_layer_4a >= 80.9 && dryHex.result.raw_score_before_layer_4a <= 81.3)
assert.equal(dryHex.result.layer_4a_total_applied, -3)
assert.equal(dryHex.result.cap_triggered, false)
const hybridRow = dryHex.result.component_math_breakdown.find(
  (c) => c.locked_canonical_material_id === 'hybrid_stainless_nonstick_food_contact',
)
assert.equal(hybridRow.mitigation_factor, 0.58)
assert.ok(!dryHex.result.component_math_breakdown.some((c) => c.locked_canonical_material_id === 'ceramic_nonstick_sol_gel_coating'))
console.log('✓ HexClad fixture 78 / Good / Documentation Incomplete with diagnostic NPR ranges')

// --- Payload builder stores provenance fields ---
assert.equal(dryHex.output_payloads.score_payload.input_source, 'locked_input_package')
assert.ok(Array.isArray(dryHex.output_payloads.math_breakdown.components))
assert.ok(dryHex.output_payloads.math_breakdown.components.length >= 4)
console.log('✓ Output payloads include score, math breakdown, display draft')

// --- Old path unchanged ---
const oldRunner = readFileSync(join(root, 'scripts/agent3/runner.mjs'), 'utf8')
assert.ok(oldRunner.includes('prepareAgent3ScoringInputs'))
assert.ok(!oldRunner.includes('agent3_locked_outputs'))
const agent4 = readFileSync(join(root, 'scripts/agent4/runner.mjs'), 'utf8')
assert.ok(!agent4.includes('agent3_locked_outputs'))
console.log('✓ Old Agent 3 runner unchanged; Agent 4 isolated')

// --- Migration exists ---
const mig = readFileSync(join(root, 'supabase/migrations/0042_agent3_locked_outputs.sql'), 'utf8')
assert.ok(mig.includes('agent3_locked_outputs'))
assert.equal(mig.includes('alter table public.product_scores'), false)
console.log('✓ Migration 0042 defines agent3_locked_outputs without product_scores changes')

// --- UI component ---
const panelSrc = readFileSync(join(root, 'src/components/admin/Gate3LockedInputScoreReviewPanel.tsx'), 'utf8')
for (const needle of [
  'Input source: locked Agent 1 package',
  'lock_hash',
  'methodology_version',
  'Component math breakdown',
  'Publishing is not enabled',
  'Gate3LockedInputScoreReviewPanel',
]) {
  assert.ok(panelSrc.includes(needle), `Gate3 locked panel missing: ${needle}`)
}
const dashSrc = readFileSync(join(root, 'src/components/admin/Agent3ReviewDashboard.tsx'), 'utf8')
assert.ok(dashSrc.includes('Gate3LockedInputScoreReviewPanel'))
assert.ok(dashSrc.includes('Locked input'))
console.log('✓ Gate 3 locked-output UI wired into Agent3ReviewDashboard')

async function tryDbPersistSmoke() {
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

  const smokeLodgeProduct = SMOKE_TEST_LODGE_PRODUCT
  const smokeHexProduct = SMOKE_TEST_HEXCLAD_PRODUCT
  const lodgeProductId = smokeLodgeProduct.product_id
  const hexProductId = smokeHexProduct.product_id

  try {
    await beginTestTransaction(client)
    await applyTestMigrationsIfNeeded(client, [
      join(root, 'supabase/migrations/0041_agent1_locked_inputs.sql'),
      join(root, 'supabase/migrations/0042_agent3_locked_outputs.sql'),
    ], 'agent3_locked_outputs')
    await assertTestTransactionActive(client)

    async function ensureFixtureProduct(product) {
      await ensureSmokeTestProduct(client, product)
    }

    async function insertLockedPackage(locked, productId) {
      const proposedId = randomUUID()
      const validationId = randomUUID()
      const lockedInputId = randomUUID()
      const bvRes = await client.query(
        `select coalesce(max(bundle_version), 0) + 1 as bv from public.product_evidence where product_id = $1`,
        [productId],
      )
      await client.query(
        `insert into public.product_evidence (evidence_id, product_id, review_status, bundle_version)
         values ($1, $2, 'draft', $3)`,
        [proposedId, productId, bvRes.rows[0].bv],
      )
      await client.query(
        `insert into public.agent1_proposed_inputs (proposed_input_id, product_id, evidence_id, proposed_payload, proposal_status)
         values ($1, $2, $3, '{}'::jsonb, 'reviewed')`,
        [proposedId, productId, proposedId],
      )
      await client.query(
        `insert into public.agent1_system_validations (validation_id, product_id, proposed_input_id, validation_status, validation_payload)
         values ($1, $2, $3, 'passed', '{}'::jsonb)`,
        [validationId, productId, proposedId],
      )
      await client.query(
        `insert into public.agent1_locked_inputs (
          locked_input_id, product_id, proposed_input_id, validation_id,
          locked_input_status, locked_payload, lock_hash, locked_at
        ) values ($1, $2, $3, $4, 'locked_for_agent_3', $5::jsonb, $6, now())`,
        [lockedInputId, productId, proposedId, validationId, JSON.stringify(locked), `hash-${randomUUID()}`],
      )
      return lockedInputId
    }

    const scoresBefore = await client.query(`select count(*)::int as n from public.product_scores`)
    const inputsBefore = await client.query(`select count(*)::int as n from public.scoring_inputs`)

    const { persistAgent3LockedOutputPg } = await import('../scripts/agent3/agent3-locked-output-pg.mjs')

    await ensureFixtureProduct(smokeLodgeProduct)
    await ensureFixtureProduct(smokeHexProduct)

    const lodgeLi = await insertLockedPackage(lodgeLocked, lodgeProductId)
    const lodgeRun = runAgent3FromLockedInputPackage({
      lockedPayload: lodgeLocked,
      lockedInputId: lodgeLi,
      lockHash: 'hash-lodge',
      persist: false,
    })
    const lodgeRow = await persistAgent3LockedOutputPg(
      {
        product_id: lodgeProductId,
        locked_input_id: lodgeLi,
        lock_hash: 'hash-lodge',
        score_payload: lodgeRun.output_payloads.score_payload,
        math_breakdown: lodgeRun.output_payloads.math_breakdown,
        display_payload: lodgeRun.output_payloads.display_payload,
      },
      client,
    )
    assert.equal(lodgeRow.score_payload.pac_safety_score, 99)

    const hexLi = await insertLockedPackage(hexLocked, hexProductId)
    const hexRun = runAgent3FromLockedInputPackage({
      lockedPayload: hexLocked,
      lockedInputId: hexLi,
      lockHash: 'hash-hex',
      persist: false,
    })
    const hexRow = await persistAgent3LockedOutputPg(
      {
        product_id: hexProductId,
        locked_input_id: hexLi,
        lock_hash: 'hash-hex',
        score_payload: hexRun.output_payloads.score_payload,
        math_breakdown: hexRun.output_payloads.math_breakdown,
        display_payload: hexRun.output_payloads.display_payload,
      },
      client,
    )
    assert.equal(hexRow.score_payload.pac_safety_score, 78)
    assert.ok(hexRow.score_payload.weighted_npr >= 14.0 && hexRow.score_payload.weighted_npr <= 14.5)

    const scoresAfter = await client.query(`select count(*)::int as n from public.product_scores`)
    const inputsAfter = await client.query(`select count(*)::int as n from public.scoring_inputs`)
    assert.equal(scoresAfter.rows[0].n, scoresBefore.rows[0].n)
    assert.equal(inputsAfter.rows[0].n, inputsBefore.rows[0].n)

    const outCount = await client.query(
      `select count(*)::int as n from public.agent3_locked_outputs
       where product_id = any($1::uuid[])`,
      [[lodgeProductId, hexProductId]],
    )
    assert.equal(outCount.rows[0].n, 2)

    const hexDbRow = await client.query(
      `select methodology_version, material_lookup_version, input_source, lock_hash, score_payload, math_breakdown
       from public.agent3_locked_outputs where locked_input_id = $1`,
      [hexLi],
    )
    assert.equal(hexDbRow.rows[0].methodology_version, METHODOLOGY_VERSION)
    assert.equal(hexDbRow.rows[0].material_lookup_version, MATERIAL_LOOKUP_VERSION)
    assert.equal(hexDbRow.rows[0].input_source, 'locked_input_package')
    assert.equal(hexDbRow.rows[0].lock_hash, 'hash-hex')
    assert.equal(hexDbRow.rows[0].score_payload.pac_safety_score, 78)
    assert.ok(Array.isArray(hexDbRow.rows[0].math_breakdown.components))

    console.log('✓ DB persist smoke: agent3_locked_outputs only; product_scores/scoring_inputs unchanged')
    await rollbackTestTransaction(client)
  } catch (err) {
    await rollbackTestTransaction(client).catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

await tryDbPersistSmoke()

console.log('\nAll Phase 6.7 Agent 3 locked-output persistence tests passed.')
