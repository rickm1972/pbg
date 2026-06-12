#!/usr/bin/env node
/**
 * Regression: locked-pipeline smoke tests must not leak Lodge/HexClad catalog product rows.
 * Run: npm run test:locked-pipeline-product-leak
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripMigrationTransactionControl } from './lib/test-migration-sql.mjs'
import {
  countVisible42CautionProducts,
  countVisibleLodgeHexcladCatalogProducts,
  LIVE_HEXCLAD_PRODUCT_ID,
  LIVE_LODGE_PRODUCT_ID,
  snapshotCanonicalProductRow,
} from './lib/locked-pipeline-smoke-db.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// --- Unit: migration strip removes COMMIT ---
const sample = 'begin;\ncreate table foo(id int);\ncommit;\n'
const stripped = stripMigrationTransactionControl(sample)
assert.equal(/\bcommit\s*;/i.test(stripped), false)
assert.equal(/\bbegin\s*;/i.test(stripped), false)
assert.ok(stripped.includes('create table foo'))
console.log('✓ stripMigrationTransactionControl removes BEGIN/COMMIT')

const mig41 = readFileSync(join(root, 'supabase/migrations/0041_agent1_locked_inputs.sql'), 'utf8')
const stripped41 = stripMigrationTransactionControl(mig41)
assert.equal(/\bcommit\b/i.test(stripped41), false)
assert.ok(stripped41.includes('begin\n  if tg_op'))
console.log('✓ migration 0041 stripped of COMMIT for test transactions')

async function tryDbLeakRegression() {
  let connectPgClient
  let loadEnv
  try {
    ;({ connectPgClient } = await import('./lib/pg-connect.mjs'))
    ;({ loadEnv } = await import('./lib/env.mjs'))
  } catch {
    console.log('⊘ DB leak regression skipped (pg-connect unavailable)')
    return
  }

  let client
  try {
    client = await connectPgClient(loadEnv())
  } catch (err) {
    console.log(`⊘ DB leak regression skipped (${err instanceof Error ? err.message : err})`)
    return
  }

  try {
    const canonicalBefore = {
      lodge: await snapshotCanonicalProductRow(client, LIVE_LODGE_PRODUCT_ID),
      hex: await snapshotCanonicalProductRow(client, LIVE_HEXCLAD_PRODUCT_ID),
    }
    const countBefore = await countVisibleLodgeHexcladCatalogProducts(client)
    const cautionBefore = await countVisible42CautionProducts(client)

    // Invoke smoke helpers directly (same path as test files)
    const { beginTestTransaction, applyTestMigrationsIfNeeded, assertTestTransactionActive, rollbackTestTransaction } =
      await import('./lib/test-migration-sql.mjs')
    const { ensureSmokeTestProduct, SMOKE_TEST_LODGE_PRODUCT, SMOKE_TEST_HEXCLAD_PRODUCT } = await import(
      './lib/locked-pipeline-smoke-db.mjs'
    )
    const { runAgent3FromLockedInputPackage } = await import('./agent3/run-locked-input.mjs')
    const { buildSystemValidation } = await import('../src/lib/lockedInput/buildSystemValidation.ts')
    const { buildLockedInputPackage } = await import('../src/lib/lockedInput/buildLockedInputPackage.ts')
    const {
      buildLodgeReviewedPayloadFixture,
      buildHexCladReviewedPayloadFixture,
    } = await import('../src/shared/agent1/fixtures/systemValidation.fixture.mjs')
    const { FIXTURE_LODGE_PRODUCT } = await import('../src/shared/agent1/fixtures/lodgeProposedInput.fixture.mjs')
    const { randomUUID } = await import('node:crypto')

    const hexProduct = {
      product_id: '00000000-0000-4000-8000-000000000002',
      product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
      brand: 'HexClad',
      category: 'Kitchen',
      subcategory: 'Cookware',
    }

    function buildLocked(reviewed, product, lockId) {
      const v = buildSystemValidation({
        reviewed_payload: reviewed,
        product,
        proposed_input_id: lockId,
        evidence_id: lockId,
      })
      return buildLockedInputPackage({
        proposed: {
          proposed_input_id: lockId,
          product_id: product.product_id,
          evidence_id: lockId,
          reviewed_payload: reviewed,
        },
        validation: {
          validation_id: `${lockId}-v`,
          validation_status: v.validation_status,
          validation_payload: v.validation_payload,
          blockers: v.blockers,
        },
      })
    }

    const lodgeLocked = buildLocked(buildLodgeReviewedPayloadFixture(), FIXTURE_LODGE_PRODUCT, 'leak-lodge')
    const hexLocked = buildLocked(buildHexCladReviewedPayloadFixture(), hexProduct, 'leak-hex')

    async function runOneSmokeCycle() {
      await beginTestTransaction(client)
      try {
        await applyTestMigrationsIfNeeded(client, [
          join(root, 'supabase/migrations/0041_agent1_locked_inputs.sql'),
          join(root, 'supabase/migrations/0042_agent3_locked_outputs.sql'),
        ], 'agent3_locked_outputs')
        await assertTestTransactionActive(client)
        await ensureSmokeTestProduct(client, SMOKE_TEST_LODGE_PRODUCT)
        await ensureSmokeTestProduct(client, SMOKE_TEST_HEXCLAD_PRODUCT)
        const proposedId = randomUUID()
        const validationId = randomUUID()
        const li = randomUUID()
        const productId = SMOKE_TEST_LODGE_PRODUCT.product_id
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
            locked_payload, locked_input_status, lock_hash, locked_at
          ) values ($1, $2, $3, $4, $5::jsonb, 'locked_for_agent_3', 'hash-leak', now())`,
          [li, productId, proposedId, validationId, JSON.stringify(lodgeLocked)],
        )
        const run = runAgent3FromLockedInputPackage({
          lockedPayload: lodgeLocked,
          lockedInputId: li,
          lockHash: 'hash-leak',
          persist: false,
        })
        const { persistAgent3LockedOutputPg } = await import('./agent3/agent3-locked-output-pg.mjs')
        await persistAgent3LockedOutputPg(
          {
            product_id: SMOKE_TEST_LODGE_PRODUCT.product_id,
            locked_input_id: li,
            lock_hash: 'hash-leak',
            score_payload: run.output_payloads.score_payload,
            math_breakdown: run.output_payloads.math_breakdown,
            display_payload: run.output_payloads.display_payload,
          },
          client,
        )
      } finally {
        await rollbackTestTransaction(client)
      }
    }

    await runOneSmokeCycle()
    await runOneSmokeCycle()

    const countAfter = await countVisibleLodgeHexcladCatalogProducts(client)
    const cautionAfter = await countVisible42CautionProducts(client)
    assert.equal(countAfter, countBefore, 'visible Lodge/HexClad catalog product count must not increase')
    assert.equal(cautionAfter, cautionBefore, 'visible 42/Caution product count must not increase')

    const canonicalAfter = {
      lodge: await snapshotCanonicalProductRow(client, LIVE_LODGE_PRODUCT_ID),
      hex: await snapshotCanonicalProductRow(client, LIVE_HEXCLAD_PRODUCT_ID),
    }
    assert.deepEqual(canonicalAfter.lodge, canonicalBefore.lodge)
    assert.deepEqual(canonicalAfter.hex, canonicalBefore.hex)

    console.log('✓ Repeated smoke cycles do not leak catalog product rows or mutate canonical products')
  } finally {
    await client.end()
  }
}

await tryDbLeakRegression()

console.log('\nAll locked-pipeline product leak regression tests passed.')
