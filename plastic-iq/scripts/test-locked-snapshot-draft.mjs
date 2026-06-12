#!/usr/bin/env node
/**
 * Phase 8 — locked snapshot draft creation (isolated, unpublished).
 * Run: npm run test:locked-snapshot-draft
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
  LIVE_HEXCLAD_PRODUCT_ID,
  LIVE_LODGE_PRODUCT_ID,
  snapshotCanonicalProductRow,
  SMOKE_TEST_HEXCLAD_PRODUCT,
  SMOKE_TEST_LODGE_PRODUCT,
} from './lib/locked-pipeline-smoke-db.mjs'
import { runAgent3FromLockedInputPackage } from './agent3/run-locked-input.mjs'
import { buildAgent4LockedAudit } from './agent4/build-locked-audit.mjs'
import { lockedOutputRowFromAgent3Run } from './agent4/run-locked-audit.mjs'
import {
  buildLockedSnapshotDraftPayload,
  validateLockedSnapshotDraftGates,
} from './locked-pipeline/build-locked-snapshot-draft.mjs'
import { runLockedSnapshotDraftFromChain } from './locked-pipeline/run-locked-snapshot-draft.mjs'
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
  'lodge-sd',
)
const hexLocked = buildLockedFixture(buildHexCladReviewedPayloadFixture(), hexProduct, 'hex-sd')

const lodgeRun = runAgent3FromLockedInputPackage({
  lockedPayload: lodgeLocked,
  lockedInputId: 'lodge-li-sd',
  lockHash: 'hash-lodge-sd',
})
const hexRun = runAgent3FromLockedInputPackage({
  lockedPayload: hexLocked,
  lockedInputId: 'hex-li-sd',
  lockHash: 'hash-hex-sd',
})

const lodgeOutput = lockedOutputRowFromAgent3Run(lodgeRun, {
  product_id: FIXTURE_LODGE_PRODUCT.product_id,
  locked_input_id: 'lodge-li-sd',
  lock_hash: 'hash-lodge-sd',
})
const hexOutput = lockedOutputRowFromAgent3Run(hexRun, {
  product_id: hexProduct.product_id,
  locked_input_id: 'hex-li-sd',
  lock_hash: 'hash-hex-sd',
})

const lodgeAudit = buildAgent4LockedAudit(lodgeOutput)
lodgeAudit.locked_audit_id = 'lodge-audit-sd'
const hexAudit = buildAgent4LockedAudit(hexOutput, { lockedPayload: hexLocked, lockHashFromInput: 'hash-hex-sd' })
hexAudit.locked_audit_id = 'hex-audit-sd'

assert.equal(lodgeAudit.audit_status, 'passed')
assert.equal(hexAudit.audit_status, 'passed')
assert.equal(lodgeAudit.blockers.length, 0)
assert.equal(hexAudit.blockers.length, 0)

// --- Dry-run default ---
const dryLodge = runLockedSnapshotDraftFromChain({
  audit: lodgeAudit,
  lockedOutput: lodgeOutput,
  lockedInput: lodgeLocked,
  persist: false,
})
assert.equal(dryLodge.dry_run, true)
assert.equal(dryLodge.wrote_locked_snapshot_drafts, false)
assert.equal(dryLodge.wrote_published_snapshots, false)
assert.equal(dryLodge.updated_products, false)
assert.equal(dryLodge.wrote_product_scores, false)
assert.equal(dryLodge.wrote_scoring_inputs, false)
console.log('✓ Dry-run default creates no DB output flags')

// --- Gating: audit_status = passed ---
const failedAudit = { ...lodgeAudit, audit_status: 'failed' }
const gateFailed = validateLockedSnapshotDraftGates({
  audit: failedAudit,
  lockedOutput: lodgeOutput,
  lockedInput: lodgeLocked,
})
assert.equal(gateFailed.ok, false)
assert.ok(gateFailed.blockers.some((b) => b.code === 'audit.status'))
console.log('✓ Draft creation blocks when audit_status is not passed')

// --- Gating: blockers ---
const blockedAudit = { ...lodgeAudit, blockers: [{ code: 'test', message: 'blocked' }] }
const gateBlocked = validateLockedSnapshotDraftGates({
  audit: blockedAudit,
  lockedOutput: lodgeOutput,
  lockedInput: lodgeLocked,
})
assert.equal(gateBlocked.ok, false)
assert.ok(gateBlocked.blockers.some((b) => b.code === 'audit.blockers'))
console.log('✓ Draft creation blocks when audit has blockers')

// --- Gating: missing linked rows ---
const gateMissing = validateLockedSnapshotDraftGates({ audit: null, lockedOutput: null, lockedInput: null })
assert.equal(gateMissing.ok, false)
assert.ok(gateMissing.blockers.some((b) => b.code === 'audit.missing'))
assert.ok(gateMissing.blockers.some((b) => b.code === 'output.missing'))
assert.ok(gateMissing.blockers.some((b) => b.code === 'input.missing'))
console.log('✓ Draft creation blocks when linked rows missing')

// --- Gating: lock_hash / version consistency ---
const badHashOutput = { ...lodgeOutput, lock_hash: 'wrong-hash' }
const gateHash = validateLockedSnapshotDraftGates({
  audit: lodgeAudit,
  lockedOutput: badHashOutput,
  lockedInput: lodgeLocked,
})
assert.equal(gateHash.ok, false)
assert.ok(gateHash.blockers.some((b) => b.code === 'lock_hash.mismatch'))
console.log('✓ Draft creation verifies lock_hash consistency')

const badVersionOutput = { ...lodgeOutput, methodology_version: 'v0.0.0' }
const gateVersion = validateLockedSnapshotDraftGates({
  audit: lodgeAudit,
  lockedOutput: badVersionOutput,
  lockedInput: lodgeLocked,
})
assert.equal(gateVersion.ok, false)
assert.ok(gateVersion.blockers.some((b) => b.code.includes('methodology_version')))
console.log('✓ Draft creation verifies methodology_version consistency')

const badLookupOutput = { ...lodgeOutput, material_lookup_version: 'wrong_lookup' }
const gateLookup = validateLockedSnapshotDraftGates({
  audit: lodgeAudit,
  lockedOutput: badLookupOutput,
  lockedInput: lodgeLocked,
})
assert.equal(gateLookup.ok, false)
assert.ok(gateLookup.blockers.some((b) => b.code.includes('material_lookup_version')))
console.log('✓ Draft creation verifies material_lookup_version consistency')

// --- Lodge draft payload ---
const lodgeBuilt = buildLockedSnapshotDraftPayload({
  audit: lodgeAudit,
  lockedOutput: lodgeOutput,
  lockedInput: lodgeLocked,
  productMeta: FIXTURE_LODGE_PRODUCT,
})
assert.equal(lodgeBuilt.ok, true)
assert.equal(lodgeBuilt.payloads.input_source, 'agent4_locked_audit')
assert.equal(lodgeBuilt.payloads.snapshot_payload.pac_safety_score, 99)
assert.equal(lodgeBuilt.payloads.snapshot_payload.tier, 'Excellent')
assert.equal(lodgeBuilt.payloads.snapshot_payload.transparency_badge, 'Fully Disclosed')
assert.equal(lodgeBuilt.payloads.snapshot_payload.publish_enabled, false)
assert.equal(lodgeBuilt.payloads.snapshot_payload.public_visible, false)
assert.equal(lodgeBuilt.payloads.snapshot_payload.source_chain, 'locked_pipeline_draft')
assert.equal(lodgeBuilt.payloads.audit_summary.audit_status, 'passed')
assert.equal(lodgeBuilt.payloads.audit_summary.blocker_count, 0)
console.log('✓ Lodge draft: 99 / Excellent / Fully Disclosed with publish disabled markers')

// --- HexClad draft payload ---
const hexBuilt = buildLockedSnapshotDraftPayload({
  audit: hexAudit,
  lockedOutput: hexOutput,
  lockedInput: hexLocked,
  productMeta: hexProduct,
})
assert.equal(hexBuilt.ok, true)
assert.equal(hexBuilt.payloads.snapshot_payload.pac_safety_score, 78)
assert.equal(hexBuilt.payloads.snapshot_payload.tier, 'Good')
assert.equal(hexBuilt.payloads.snapshot_payload.transparency_badge, 'Documentation Incomplete')
assert.equal(hexBuilt.payloads.snapshot_payload.publish_enabled, false)
assert.equal(hexBuilt.payloads.snapshot_payload.public_visible, false)
const wnpr = hexBuilt.payloads.score_payload.weighted_npr
const raw = hexBuilt.payloads.score_payload.raw_score_before_layer_4a
assert.ok(wnpr >= 14.0 && wnpr <= 14.5)
assert.ok(raw >= 80.9 && raw <= 81.3)
assert.equal(hexBuilt.payloads.score_payload.layer_4a_total_applied, -3)
assert.equal(hexBuilt.payloads.score_payload.cap_triggered, false)
const hybridComp = hexBuilt.payloads.math_breakdown.component_nprs?.find?.(
  (c) => c.locked_canonical_material_id === 'hybrid_stainless_nonstick_food_contact',
) ?? hexOutput.math_breakdown.components.find(
  (c) => c.locked_canonical_material_id === 'hybrid_stainless_nonstick_food_contact',
)
assert.equal(hybridComp?.mitigation_factor, 0.58)
console.log('✓ HexClad draft: 78 / Good / Documentation Incomplete with diagnostic ranges')

// --- Migration 0044 ---
const mig = readFileSync(join(root, 'supabase/migrations/0044_locked_snapshot_drafts.sql'), 'utf8')
assert.ok(mig.includes('locked_snapshot_drafts'))
assert.equal(mig.includes('alter table public.published_display_snapshots'), false)
assert.equal(mig.includes('alter table public.products'), false)
assert.ok(mig.includes("input_source = 'agent4_locked_audit'"))
console.log('✓ Migration 0044 defines isolated locked_snapshot_drafts table')

// --- Old publish path unchanged ---
const publishApi = readFileSync(join(root, 'src/lib/publishApi.ts'), 'utf8')
assert.ok(publishApi.includes('publishProduct'))
assert.ok(publishApi.includes('published_display_snapshots') || publishApi.includes('publish-with-snapshot'))
assert.ok(!publishApi.includes('locked_snapshot_drafts'))
const oldRunner = readFileSync(join(root, 'scripts/agent4/runner.mjs'), 'utf8')
assert.ok(oldRunner.includes('insertProductQa'))
assert.ok(!oldRunner.includes('locked_snapshot_drafts'))
console.log('✓ Old publish path and Agent 4 runner unchanged')

// --- UI wiring ---
const panelSrc = readFileSync(join(root, 'src/components/admin/LockedSnapshotDraftReviewPanel.tsx'), 'utf8')
for (const needle of [
  'Locked snapshot draft',
  'Unpublished preview',
  'publish_disabled_notice',
  'locked_input_id',
  'locked_output_id',
  'locked_audit_id',
  'lock_hash',
  'publish_enabled',
  'public_visible',
  'Why this score',
]) {
  assert.ok(panelSrc.includes(needle), `LockedSnapshotDraftReviewPanel missing: ${needle}`)
}
const dashSrc = readFileSync(join(root, 'src/components/admin/LockedSnapshotDraftDashboard.tsx'), 'utf8')
assert.ok(dashSrc.includes('LockedSnapshotDraftReviewPanel'))
assert.ok(dashSrc.includes('Locked snapshot drafts'))
assert.ok(!dashSrc.includes('publishProduct'))
const adminSrc = readFileSync(join(root, 'src/pages/AdminPage.tsx'), 'utf8')
assert.ok(adminSrc.includes('LockedSnapshotDraftDashboard'))
console.log('✓ Locked snapshot draft UI wired on Admin publish tab')

// --- DB persist smoke ---
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

  try {
    const canonicalBefore = {
      lodge: await snapshotCanonicalProductRow(client, LIVE_LODGE_PRODUCT_ID),
      hex: await snapshotCanonicalProductRow(client, LIVE_HEXCLAD_PRODUCT_ID),
    }
    const scoresBefore = await client.query(`select count(*)::int as n from public.product_scores`)
    const inputsBefore = await client.query(`select count(*)::int as n from public.scoring_inputs`)
    let snapsBefore = null
    try {
      snapsBefore = (await client.query(`select count(*)::int as n from public.published_display_snapshots`)).rows[0].n
    } catch (e) {
      if (e.code !== '42P01') throw e
    }

    await beginTestTransaction(client)
    await applyTestMigrationsIfNeeded(client, [
      join(root, 'supabase/migrations/0041_agent1_locked_inputs.sql'),
      join(root, 'supabase/migrations/0042_agent3_locked_outputs.sql'),
      join(root, 'supabase/migrations/0043_agent4_locked_audits.sql'),
      join(root, 'supabase/migrations/0044_locked_snapshot_drafts.sql'),
    ], 'locked_snapshot_drafts')
    await assertTestTransactionActive(client)

    async function ensureFixtureProduct(product) {
      await ensureSmokeTestProduct(client, product)
    }

    async function insertLockedPackage(locked, productId, lockHash) {
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
        [lockedInputId, productId, proposedId, validationId, JSON.stringify(locked), lockHash],
      )
      return lockedInputId
    }

    const smokeLodge = SMOKE_TEST_LODGE_PRODUCT
    const smokeHex = SMOKE_TEST_HEXCLAD_PRODUCT
    await ensureFixtureProduct(smokeLodge)
    await ensureFixtureProduct(smokeHex)

    const { persistAgent3LockedOutputPg } = await import('./agent3/agent3-locked-output-pg.mjs')
    const { persistAgent4LockedAuditPg } = await import('./agent4/agent4-locked-audit-pg.mjs')
    const { persistLockedSnapshotDraftPg } = await import('./locked-pipeline/locked-snapshot-draft-pg.mjs')

    const lodgeLi = await insertLockedPackage(lodgeLocked, smokeLodge.product_id, 'hash-lodge-db-sd')
    const lodgeRunDb = runAgent3FromLockedInputPackage({
      lockedPayload: lodgeLocked,
      lockedInputId: lodgeLi,
      lockHash: 'hash-lodge-db-sd',
      persist: false,
    })
    const lodgeOut = await persistAgent3LockedOutputPg(
      {
        product_id: smokeLodge.product_id,
        locked_input_id: lodgeLi,
        lock_hash: 'hash-lodge-db-sd',
        score_payload: lodgeRunDb.output_payloads.score_payload,
        math_breakdown: lodgeRunDb.output_payloads.math_breakdown,
        display_payload: lodgeRunDb.output_payloads.display_payload,
      },
      client,
    )
    const lodgeAuditDb = buildAgent4LockedAudit(lodgeOut)
    lodgeAuditDb.locked_output_id = lodgeOut.locked_output_id
    lodgeAuditDb.locked_input_id = lodgeLi
    lodgeAuditDb.product_id = smokeLodge.product_id
    const lodgeAuditRow = await persistAgent4LockedAuditPg(lodgeAuditDb, client)
    const lodgeDraftBuilt = buildLockedSnapshotDraftPayload({
      audit: lodgeAuditRow,
      lockedOutput: lodgeOut,
      lockedInput: lodgeLocked,
      productMeta: smokeLodge,
    })
    const lodgeDraftRow = await persistLockedSnapshotDraftPg(lodgeDraftBuilt.payloads, client)
    assert.equal(lodgeDraftRow.input_source, 'agent4_locked_audit')
    assert.equal(lodgeDraftRow.snapshot_payload.pac_safety_score, 99)
    assert.equal(lodgeDraftRow.snapshot_payload.publish_enabled, false)
    assert.equal(lodgeDraftRow.snapshot_payload.public_visible, false)

    const hexLi = await insertLockedPackage(hexLocked, smokeHex.product_id, 'hash-hex-db-sd')
    const hexRunDb = runAgent3FromLockedInputPackage({
      lockedPayload: hexLocked,
      lockedInputId: hexLi,
      lockHash: 'hash-hex-db-sd',
      persist: false,
    })
    const hexOut = await persistAgent3LockedOutputPg(
      {
        product_id: smokeHex.product_id,
        locked_input_id: hexLi,
        lock_hash: 'hash-hex-db-sd',
        score_payload: hexRunDb.output_payloads.score_payload,
        math_breakdown: hexRunDb.output_payloads.math_breakdown,
        display_payload: hexRunDb.output_payloads.display_payload,
      },
      client,
    )
    const hexAuditDb = buildAgent4LockedAudit(hexOut, { lockedPayload: hexLocked, lockHashFromInput: 'hash-hex-db-sd' })
    hexAuditDb.locked_output_id = hexOut.locked_output_id
    hexAuditDb.locked_input_id = hexLi
    hexAuditDb.product_id = smokeHex.product_id
    const hexAuditRow = await persistAgent4LockedAuditPg(hexAuditDb, client)
    const hexDraftBuilt = buildLockedSnapshotDraftPayload({
      audit: hexAuditRow,
      lockedOutput: hexOut,
      lockedInput: hexLocked,
      productMeta: smokeHex,
    })
    const hexDraftRow = await persistLockedSnapshotDraftPg(hexDraftBuilt.payloads, client)
    assert.equal(hexDraftRow.snapshot_payload.pac_safety_score, 78)
    assert.equal(hexDraftRow.snapshot_payload.tier, 'Good')
    assert.equal(hexDraftRow.snapshot_payload.transparency_badge, 'Documentation Incomplete')

    const scoresAfter = await client.query(`select count(*)::int as n from public.product_scores`)
    const inputsAfter = await client.query(`select count(*)::int as n from public.scoring_inputs`)
    assert.equal(scoresAfter.rows[0].n, scoresBefore.rows[0].n)
    assert.equal(inputsAfter.rows[0].n, inputsBefore.rows[0].n)
    if (snapsBefore !== null) {
      const snapsAfter = (await client.query(`select count(*)::int as n from public.published_display_snapshots`)).rows[0].n
      assert.equal(snapsAfter, snapsBefore)
    }

    const lodgeProductAfter = await client.query(
      `select pac_safety_score, tier from public.products where product_id = $1`,
      [smokeLodge.product_id],
    )
    assert.equal(lodgeProductAfter.rows[0].pac_safety_score, null)
    assert.equal(lodgeProductAfter.rows[0].tier, null)

    const canonicalAfter = {
      lodge: await snapshotCanonicalProductRow(client, LIVE_LODGE_PRODUCT_ID),
      hex: await snapshotCanonicalProductRow(client, LIVE_HEXCLAD_PRODUCT_ID),
    }
    assert.deepEqual(canonicalAfter.lodge, canonicalBefore.lodge)
    assert.deepEqual(canonicalAfter.hex, canonicalBefore.hex)

    const draftCount = await client.query(
      `select count(*)::int as n from public.locked_snapshot_drafts where product_id = any($1::uuid[])`,
      [[smokeLodge.product_id, smokeHex.product_id]],
    )
    assert.equal(draftCount.rows[0].n, 2)

    // Repeated draft persist supersedes
    const lodgeDraft2 = await persistLockedSnapshotDraftPg(lodgeDraftBuilt.payloads, client)
    const visibleDrafts = await client.query(
      `select draft_status from public.locked_snapshot_drafts where locked_audit_id = $1`,
      [lodgeAuditRow.locked_audit_id],
    )
    const active = visibleDrafts.rows.filter((r) => r.draft_status !== 'superseded')
    assert.equal(active.length, 1)
    assert.notEqual(lodgeDraftRow.locked_snapshot_draft_id, lodgeDraft2.locked_snapshot_draft_id)

    console.log('✓ DB persist smoke: locked_snapshot_drafts only; no public snapshots or product mutation')

    await rollbackTestTransaction(client)
  } catch (err) {
    await rollbackTestTransaction(client).catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

await tryDbPersistSmoke()

console.log('\nAll Phase 8 locked snapshot draft tests passed.')
