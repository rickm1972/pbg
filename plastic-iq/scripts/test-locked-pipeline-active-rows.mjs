#!/usr/bin/env node
/**
 * Locked pipeline active-row / supersede regression tests.
 * Run: npm run test:locked-pipeline-active-rows
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAgent3FromLockedInputPackage } from './agent3/run-locked-input.mjs'
import { buildAgent4LockedAudit } from './agent4/build-locked-audit.mjs'
import { buildSystemValidation } from '../src/lib/lockedInput/buildSystemValidation.ts'
import { buildLockedInputPackage } from '../src/lib/lockedInput/buildLockedInputPackage.ts'
import {
  buildLodgeReviewedPayloadFixture,
  buildHexCladReviewedPayloadFixture,
} from '../src/shared/agent1/fixtures/systemValidation.fixture.mjs'
import { FIXTURE_LODGE_PRODUCT } from '../src/shared/agent1/fixtures/lodgeProposedInput.fixture.mjs'
import {
  pickLatestAgent3OutputPerLockedInput,
  pickLatestAgent4AuditPerLockedOutput,
} from '../src/lib/lockedPipeline/activeRowSemantics.ts'
import { pickLatestDraftPerLockedAudit } from '../src/lib/lockedPipeline/activeRowSemantics.ts'
import {
  applyTestMigrationsIfNeeded,
  assertTestTransactionActive,
  beginTestTransaction,
  rollbackTestTransaction,
} from './lib/test-migration-sql.mjs'
import { ensureSmokeTestProduct, SMOKE_TEST_LODGE_PRODUCT } from './lib/locked-pipeline-smoke-db.mjs'

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
  'lodge-ar',
)
const hexLocked = buildLockedFixture(buildHexCladReviewedPayloadFixture(), hexProduct, 'hex-ar')

// --- Unit: pickLatestAgent3OutputPerLockedInput ---
const li1 = randomUUID()
const outRows = [
  {
    locked_output_id: 'o1',
    locked_input_id: li1,
    product_id: FIXTURE_LODGE_PRODUCT.product_id,
    review_status: 'pending_review',
    created_at: '2026-01-01T00:00:00Z',
    input_source: 'locked_input_package',
  },
  {
    locked_output_id: 'o2',
    locked_input_id: li1,
    product_id: randomUUID(),
    review_status: 'pending_review',
    created_at: '2026-01-02T00:00:00Z',
    input_source: 'locked_input_package',
  },
  {
    locked_output_id: 'o3',
    locked_input_id: li1,
    product_id: randomUUID(),
    review_status: 'superseded',
    created_at: '2026-01-03T00:00:00Z',
    input_source: 'locked_input_package',
  },
]
const picked3 = pickLatestAgent3OutputPerLockedInput(outRows)
assert.equal(picked3.length, 1)
assert.equal(picked3[0].locked_output_id, 'o2')
console.log('✓ pickLatestAgent3OutputPerLockedInput keeps one active row per locked_input_id')

// --- Unit: pickLatestAgent4AuditPerLockedOutput ---
const lo1 = randomUUID()
const auditRows = [
  {
    locked_audit_id: 'a1',
    locked_output_id: lo1,
    product_id: hexProduct.product_id,
    audit_status: 'passed',
    created_at: '2026-01-01T00:00:00Z',
    input_source: 'agent3_locked_output',
  },
  {
    locked_audit_id: 'a2',
    locked_output_id: lo1,
    product_id: randomUUID(),
    audit_status: 'passed',
    created_at: '2026-01-02T00:00:00Z',
    input_source: 'agent3_locked_output',
  },
  {
    locked_audit_id: 'a3',
    locked_output_id: lo1,
    product_id: randomUUID(),
    audit_status: 'superseded',
    created_at: '2026-01-03T00:00:00Z',
    input_source: 'agent3_locked_output',
  },
]
const picked4 = pickLatestAgent4AuditPerLockedOutput(auditRows)
assert.equal(picked4.length, 1)
assert.equal(picked4[0].locked_audit_id, 'a2')
console.log('✓ pickLatestAgent4AuditPerLockedOutput keeps one active row per locked_output_id')

// --- Unit: pickLatestDraftPerLockedAudit ---
const la1 = randomUUID()
const draftRows = [
  {
    locked_snapshot_draft_id: 'd1',
    locked_audit_id: la1,
    draft_status: 'draft',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    locked_snapshot_draft_id: 'd2',
    locked_audit_id: la1,
    draft_status: 'draft',
    created_at: '2026-01-02T00:00:00Z',
  },
  {
    locked_snapshot_draft_id: 'd3',
    locked_audit_id: la1,
    draft_status: 'superseded',
    created_at: '2026-01-03T00:00:00Z',
  },
]
const pickedDrafts = pickLatestDraftPerLockedAudit(draftRows)
assert.equal(pickedDrafts.length, 1)
assert.equal(pickedDrafts[0].locked_snapshot_draft_id, 'd2')
console.log('✓ pickLatestDraftPerLockedAudit keeps one active draft per locked_audit_id')

// --- PG persist: repeated Agent 3 / Agent 4 / draft runs do not accumulate active rows ---
async function tryDbActiveRowSmoke() {
  let connectPgClient
  let loadEnv
  try {
    ;({ connectPgClient } = await import('./lib/pg-connect.mjs'))
    ;({ loadEnv } = await import('./lib/env.mjs'))
  } catch {
    console.log('⊘ DB active-row smoke skipped (pg-connect unavailable)')
    return
  }

  let client
  try {
    client = await connectPgClient(loadEnv())
  } catch (err) {
    console.log(`⊘ DB active-row smoke skipped (${err instanceof Error ? err.message : err})`)
    return
  }

  try {
    await beginTestTransaction(client)
    await applyTestMigrationsIfNeeded(client, [
      join(root, 'supabase/migrations/0041_agent1_locked_inputs.sql'),
      join(root, 'supabase/migrations/0042_agent3_locked_outputs.sql'),
      join(root, 'supabase/migrations/0043_agent4_locked_audits.sql'),
      join(root, 'supabase/migrations/0044_locked_snapshot_drafts.sql'),
    ], 'locked_snapshot_drafts')
    await assertTestTransactionActive(client)

    const productId = SMOKE_TEST_LODGE_PRODUCT.product_id
    await ensureSmokeTestProduct(client, SMOKE_TEST_LODGE_PRODUCT)

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
      [lockedInputId, productId, proposedId, validationId, JSON.stringify(lodgeLocked), 'hash-ar'],
    )

    const lodgeRun = runAgent3FromLockedInputPackage({
      lockedPayload: lodgeLocked,
      lockedInputId,
      lockHash: 'hash-ar',
      persist: false,
    })

    const { persistAgent3LockedOutputPg } = await import('./agent3/agent3-locked-output-pg.mjs')
    const { persistAgent4LockedAuditPg } = await import('./agent4/agent4-locked-audit-pg.mjs')
    const { persistLockedSnapshotDraftPg } = await import('./locked-pipeline/locked-snapshot-draft-pg.mjs')
    const { buildLockedSnapshotDraftPayload } = await import('./locked-pipeline/build-locked-snapshot-draft.mjs')

    const out1 = await persistAgent3LockedOutputPg(
      {
        product_id: productId,
        locked_input_id: lockedInputId,
        lock_hash: 'hash-ar',
        score_payload: lodgeRun.output_payloads.score_payload,
        math_breakdown: lodgeRun.output_payloads.math_breakdown,
        display_payload: lodgeRun.output_payloads.display_payload,
      },
      client,
    )
    const out2 = await persistAgent3LockedOutputPg(
      {
        product_id: productId,
        locked_input_id: lockedInputId,
        lock_hash: 'hash-ar',
        score_payload: lodgeRun.output_payloads.score_payload,
        math_breakdown: lodgeRun.output_payloads.math_breakdown,
        display_payload: lodgeRun.output_payloads.display_payload,
      },
      client,
    )
    assert.notEqual(out1.locked_output_id, out2.locked_output_id)

    const active3 = await client.query(
      `select locked_output_id, review_status from public.agent3_locked_outputs
       where locked_input_id = $1`,
      [lockedInputId],
    )
    const visible3 = active3.rows.filter((r) => r.review_status !== 'superseded')
    assert.equal(visible3.length, 1)
    assert.equal(visible3[0].locked_output_id, out2.locked_output_id)
    console.log('✓ Repeated Agent 3 persist supersedes prior active output for same locked_input_id')

    const auditBuilt = buildAgent4LockedAudit({
      ...out2,
      locked_output_id: out2.locked_output_id,
      locked_input_id: lockedInputId,
      product_id: productId,
      lock_hash: 'hash-ar',
      input_source: 'locked_input_package',
    })
    const audit1 = await persistAgent4LockedAuditPg(auditBuilt, client)
    const audit2 = await persistAgent4LockedAuditPg(auditBuilt, client)
    assert.notEqual(audit1.locked_audit_id, audit2.locked_audit_id)

    const active4 = await client.query(
      `select locked_audit_id, audit_status from public.agent4_locked_audits
       where locked_output_id = $1`,
      [out2.locked_output_id],
    )
    const visible4 = active4.rows.filter((r) => r.audit_status !== 'superseded')
    assert.equal(visible4.length, 1)
    assert.equal(visible4[0].locked_audit_id, audit2.locked_audit_id)
    console.log('✓ Repeated Agent 4 persist supersedes prior active audit for same locked_output_id')

    const draftBuilt = buildLockedSnapshotDraftPayload({
      audit: audit2,
      lockedOutput: out2,
      lockedInput: lodgeLocked,
    })
    assert.equal(draftBuilt.ok, true)
    const draft1 = await persistLockedSnapshotDraftPg(draftBuilt.payloads, client)
    const draft2 = await persistLockedSnapshotDraftPg(draftBuilt.payloads, client)
    assert.notEqual(draft1.locked_snapshot_draft_id, draft2.locked_snapshot_draft_id)

    const activeDrafts = await client.query(
      `select locked_snapshot_draft_id, draft_status from public.locked_snapshot_drafts
       where locked_audit_id = $1`,
      [audit2.locked_audit_id],
    )
    const visibleDrafts = activeDrafts.rows.filter((r) => r.draft_status !== 'superseded')
    assert.equal(visibleDrafts.length, 1)
    assert.equal(visibleDrafts[0].locked_snapshot_draft_id, draft2.locked_snapshot_draft_id)
    console.log('✓ Repeated draft persist supersedes prior active draft for same locked_audit_id')

    await rollbackTestTransaction(client)
  } catch (err) {
    await rollbackTestTransaction(client).catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

await tryDbActiveRowSmoke()

// --- PG cleanup script smoke (duplicate display names) ---
async function tryCleanupScriptSmoke() {
  let connectPgClient
  let loadEnv
  try {
    ;({ connectPgClient } = await import('./lib/pg-connect.mjs'))
    ;({ loadEnv } = await import('./lib/env.mjs'))
  } catch {
    console.log('⊘ Cleanup script smoke skipped (pg-connect unavailable)')
    return
  }

  let client
  try {
    client = await connectPgClient(loadEnv())
  } catch (err) {
    console.log(`⊘ Cleanup script smoke skipped (${err instanceof Error ? err.message : err})`)
    return
  }

  try {
    await beginTestTransaction(client)
    await applyTestMigrationsIfNeeded(client, [
      join(root, 'supabase/migrations/0041_agent1_locked_inputs.sql'),
      join(root, 'supabase/migrations/0042_agent3_locked_outputs.sql'),
      join(root, 'supabase/migrations/0043_agent4_locked_audits.sql'),
    ], 'agent4_locked_audits')
    await assertTestTransactionActive(client)

    const pidA = SMOKE_TEST_LODGE_PRODUCT.product_id
    const pidB = 'bbbbbbbb-bbbb-4bbb-8bbb-000000000099'
    const liA = randomUUID()
    const liB = randomUUID()

    await ensureSmokeTestProduct(client, SMOKE_TEST_LODGE_PRODUCT)
    await client.query(
      `insert into public.products (product_id, product_name, brand, category, subcategory, active)
       values ($1, $2, $3, $4, $5, true) on conflict (product_id) do nothing`,
      [pidB, FIXTURE_LODGE_PRODUCT.product_name, FIXTURE_LODGE_PRODUCT.brand, 'Kitchen', 'Cookware'],
    )

    for (const [pid, li] of [
      [pidA, liA],
      [pidB, liB],
    ]) {
      const proposedId = randomUUID()
      const validationId = randomUUID()
      await client.query(
        `insert into public.product_evidence (evidence_id, product_id, review_status, bundle_version) values ($1, $2, 'draft', 1)`,
        [proposedId, pid],
      )
      await client.query(
        `insert into public.agent1_proposed_inputs (proposed_input_id, product_id, evidence_id, proposed_payload, proposal_status)
         values ($1, $2, $3, '{}'::jsonb, 'reviewed')`,
        [proposedId, pid, proposedId],
      )
      await client.query(
        `insert into public.agent1_system_validations (validation_id, product_id, proposed_input_id, validation_status, validation_payload)
         values ($1, $2, $3, 'passed', '{}'::jsonb)`,
        [validationId, pid, proposedId],
      )
      await client.query(
        `insert into public.agent1_locked_inputs (
          locked_input_id, product_id, proposed_input_id, validation_id,
          locked_input_status, locked_payload, lock_hash, locked_at
        ) values ($1, $2, $3, $4, 'locked_for_agent_3', '{}'::jsonb, $5, now())`,
        [li, pid, proposedId, validationId, `hash-${li}`],
      )
    }

    const { persistAgent3LockedOutputPg } = await import('./agent3/agent3-locked-output-pg.mjs')
    const lodgeRun = runAgent3FromLockedInputPackage({
      lockedPayload: lodgeLocked,
      lockedInputId: liA,
      lockHash: 'hash-a',
      persist: false,
    })
    const score = lodgeRun.output_payloads.score_payload
    const math = lodgeRun.output_payloads.math_breakdown
    const display = lodgeRun.output_payloads.display_payload

    await persistAgent3LockedOutputPg(
      { product_id: pidA, locked_input_id: liA, lock_hash: 'hash-a', score_payload: score, math_breakdown: math, display_payload: display },
      client,
    )
    await new Promise((r) => setTimeout(r, 5))
    await persistAgent3LockedOutputPg(
      { product_id: pidB, locked_input_id: liB, lock_hash: 'hash-b', score_payload: score, math_breakdown: math, display_payload: display },
      client,
    )

    const before = await client.query(
      `select count(*)::int as n from public.agent3_locked_outputs where review_status <> 'superseded'`,
    )
    assert.ok(before.rows[0].n >= 2)

    const { supersedeDuplicateActiveRows } = await import('./locked-pipeline/supersede-duplicate-active-rows.mjs')
    await supersedeDuplicateActiveRows(client, { dryRun: false })

    const after = await client.query(
      `select o.locked_output_id, o.review_status, p.product_name
       from public.agent3_locked_outputs o
       join public.products p on p.product_id = o.product_id
       where p.product_name = $1 and p.brand = $2`,
      [FIXTURE_LODGE_PRODUCT.product_name, FIXTURE_LODGE_PRODUCT.brand],
    )
    const visible = after.rows.filter((r) => r.review_status !== 'superseded')
    assert.equal(visible.length, 1)
    console.log('✓ supersede-duplicate-active-rows collapses duplicate Lodge display rows to one visible winner')

    await rollbackTestTransaction(client)
  } catch (err) {
    await rollbackTestTransaction(client).catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

await tryCleanupScriptSmoke()

console.log('\nAll locked-pipeline active-row regression tests passed.')
