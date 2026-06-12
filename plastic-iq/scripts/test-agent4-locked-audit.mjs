#!/usr/bin/env node
/**
 * Phase 7 — Agent 4 locked-output audit (fixtures + optional DB rollback smoke).
 * Run: npm run test:agent4-locked-audit
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
import { runAgent3FromLockedInputPackage } from '../scripts/agent3/run-locked-input.mjs'
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
import { buildAgent4LockedAudit, checkHybridDuplicateExposure } from '../scripts/agent4/build-locked-audit.mjs'
import {
  runAgent4LockedAuditForOutput,
  runAgent4LockedAuditFromOutput,
  lockedOutputRowFromAgent3Run,
} from '../scripts/agent4/run-locked-audit.mjs'

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
  'lodge-lock-7',
)
const hexLocked = buildLockedFixture(buildHexCladReviewedPayloadFixture(), hexProduct, 'hex-lock-7')

const lodgeRun = runAgent3FromLockedInputPackage({
  lockedPayload: lodgeLocked,
  lockedInputId: 'lodge-li-7',
  lockHash: 'hash-lodge-7',
})
const hexRun = runAgent3FromLockedInputPackage({
  lockedPayload: hexLocked,
  lockedInputId: 'hex-li-7',
  lockHash: 'hash-hex-7',
})

const lodgeOutput = lockedOutputRowFromAgent3Run(lodgeRun, {
  product_id: FIXTURE_LODGE_PRODUCT.product_id,
  locked_input_id: 'lodge-li-7',
  lock_hash: 'hash-lodge-7',
})
const hexOutput = lockedOutputRowFromAgent3Run(hexRun, {
  product_id: hexProduct.product_id,
  locked_input_id: 'hex-li-7',
  lock_hash: 'hash-hex-7',
})

// --- Dry-run default ---
const dryLodge = runAgent4LockedAuditFromOutput({ lockedOutput: lodgeOutput, persist: false })
assert.equal(dryLodge.dry_run, true)
assert.equal(dryLodge.wrote_agent4_locked_audits, false)
assert.equal(dryLodge.wrote_product_scores, false)
assert.equal(dryLodge.wrote_scoring_inputs, false)
assert.equal(dryLodge.wrote_snapshots, false)
assert.equal(dryLodge.updated_products, false)
console.log('✓ Dry-run default creates no DB output flags')

// --- Input source distinction ---
assert.equal(lodgeOutput.input_source, 'locked_input_package')
assert.equal(dryLodge.input_source, 'agent3_locked_output')
assert.equal(dryLodge.audit.input_source, 'agent3_locked_output')
console.log('✓ Agent 4 input_source = agent3_locked_output; verifies agent3 input_source = locked_input_package')

// --- Lodge audit passes ---
assert.equal(dryLodge.audit.audit_status, 'passed')
assert.equal(dryLodge.audit.blockers.length, 0)
assert.equal(dryLodge.audit.audit_payload.score_summary.pac_safety_score, 99)
assert.equal(dryLodge.audit.audit_payload.score_summary.tier, 'Excellent')
assert.equal(dryLodge.audit.audit_payload.score_summary.transparency_badge, 'Fully Disclosed')
assert.ok(dryLodge.audit.consistency_checks.length > 0)
console.log('✓ Lodge locked audit passed: 99 / Excellent / Fully Disclosed')

// --- HexClad audit passes ---
const dryHex = runAgent4LockedAuditFromOutput({
  lockedOutput: hexOutput,
  lockedPayload: hexLocked,
  lockHashFromInput: 'hash-hex-7',
})
assert.equal(dryHex.audit.audit_status, 'passed')
assert.equal(dryHex.audit.blockers.length, 0)
assert.equal(dryHex.audit.audit_payload.score_summary.pac_safety_score, 78)
assert.equal(dryHex.audit.audit_payload.score_summary.tier, 'Good')
assert.equal(dryHex.audit.audit_payload.score_summary.transparency_badge, 'Documentation Incomplete')
const wnpr = dryHex.audit.audit_payload.score_summary.weighted_npr
const raw = dryHex.audit.audit_payload.score_summary.raw_score_before_layer_4a
assert.ok(wnpr >= 14.0 && wnpr <= 14.5)
assert.ok(raw >= 80.9 && raw <= 81.3)
assert.equal(dryHex.audit.audit_payload.score_summary.layer_4a_total_applied, -3)
assert.equal(dryHex.audit.audit_payload.score_summary.cap_triggered, false)
const hybridComp = hexOutput.math_breakdown.components.find(
  (c) => c.locked_canonical_material_id === 'hybrid_stainless_nonstick_food_contact',
)
assert.equal(hybridComp?.mitigation_factor, 0.58)
assert.ok(!hexOutput.math_breakdown.components.some((c) => c.locked_canonical_material_id === 'ceramic_nonstick_sol_gel_coating'))
console.log('✓ HexClad locked audit passed with diagnostic ranges and hybrid ND 0.58')

// --- Auto failed when blockers ---
const badOutput = structuredClone(hexOutput)
badOutput.input_source = 'wrong_source'
const failedAudit = buildAgent4LockedAudit(badOutput)
assert.equal(failedAudit.audit_status, 'failed')
assert.ok(failedAudit.blockers.some((b) => b.code === 'provenance.agent3_input_source'))
console.log('✓ audit_status = failed when blockers exist')

const passedAudit = buildAgent4LockedAudit(lodgeOutput)
assert.equal(passedAudit.audit_status, 'passed')
console.log('✓ audit_status = passed when no blockers')

// --- Hybrid duplicate-exposure (general, not product-specific) ---
const hybridPass = checkHybridDuplicateExposure(hexOutput.math_breakdown.components, hexLocked)
assert.equal(hybridPass.pass, true)

const badHybridComponents = [
  ...hexOutput.math_breakdown.components,
  {
    component_name: 'Synthetic coating duplicate',
    component_role: 'coating',
    score_driving: true,
    locked_canonical_material_id: 'ceramic_nonstick_sol_gel_coating',
    contact_intimacy: 1,
  },
]
const hybridFail = checkHybridDuplicateExposure(badHybridComponents)
assert.equal(hybridFail.pass, false)

const supportOnlyLocked = {
  locked_components: [
    {
      locked_component_role: 'coating',
      locked_is_score_driving: false,
      locked_canonical_material_id: 'ceramic_nonstick_sol_gel_coating',
      locked_contact_intimacy: 0,
    },
    {
      locked_component_role: 'primary_food_contact',
      locked_is_score_driving: true,
      locked_canonical_material_id: 'hybrid_stainless_nonstick_food_contact',
      locked_contact_intimacy: 1,
    },
  ],
}
const supportPass = checkHybridDuplicateExposure(hexOutput.math_breakdown.components, supportOnlyLocked)
assert.equal(supportPass.pass, true)
console.log('✓ General hybrid duplicate-exposure check (not HexClad-specific)')

// --- Provenance versions ---
assert.equal(dryLodge.audit.methodology_version, METHODOLOGY_VERSION)
assert.equal(dryLodge.audit.material_lookup_version, MATERIAL_LOOKUP_VERSION)
console.log('✓ methodology_version and material_lookup_version stamped')

// --- Old Agent 4 path unchanged ---
const oldRunner = readFileSync(join(root, 'scripts/agent4/runner.mjs'), 'utf8')
assert.ok(oldRunner.includes('insertProductQa'))
assert.ok(!oldRunner.includes('agent4_locked_audits'))
assert.ok(!oldRunner.includes('agent3_locked_outputs'))
console.log('✓ Old Agent 4 runner unchanged; locked path isolated')

// --- Migration ---
const mig = readFileSync(join(root, 'supabase/migrations/0043_agent4_locked_audits.sql'), 'utf8')
assert.ok(mig.includes('agent4_locked_audits'))
assert.equal(mig.includes('alter table public.product_scores'), false)
assert.ok(mig.includes("input_source = 'agent3_locked_output'"))
console.log('✓ Migration 0043 defines agent4_locked_audits')

// --- UI ---
const panelSrc = readFileSync(join(root, 'src/components/admin/Gate4LockedOutputAuditPanel.tsx'), 'utf8')
for (const needle of [
  'Agent 4 locked-output audit',
  'Input source: Agent 3 locked-output record',
  'locked_output_id',
  'lock_hash',
  'audit_status',
  'Blockers',
  'Consistency checks',
  'Publishing is not enabled',
  'Gate4LockedOutputAuditPanel',
]) {
  assert.ok(panelSrc.includes(needle), `Gate4 locked panel missing: ${needle}`)
}
const dashSrc = readFileSync(join(root, 'src/components/admin/Agent4ReviewDashboard.tsx'), 'utf8')
assert.ok(dashSrc.includes('Gate4LockedOutputAuditPanel'))
assert.ok(dashSrc.includes('Locked output'))
console.log('✓ Gate 4 locked-output audit UI wired into Agent4ReviewDashboard')

const dedupeSrc = readFileSync(join(root, 'src/lib/lockedPipeline/displayDedupe.ts'), 'utf8')
assert.ok(dedupeSrc.includes('pickLatestPerCatalogDisplay'))
assert.ok(dedupeSrc.includes('CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS'))
const reviewSrc = readFileSync(join(root, 'src/lib/agent4LockedAuditReview.ts'), 'utf8')
assert.ok(reviewSrc.includes('pickLatestPerCatalogDisplay'))
console.log('✓ Locked audit dashboard dedupes by catalog display name (not raw product_id only)')

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
    await beginTestTransaction(client)
    await applyTestMigrationsIfNeeded(client, [
      join(root, 'supabase/migrations/0041_agent1_locked_inputs.sql'),
      join(root, 'supabase/migrations/0042_agent3_locked_outputs.sql'),
      join(root, 'supabase/migrations/0043_agent4_locked_audits.sql'),
    ], 'agent4_locked_audits')
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
      const bundleVersion = bvRes.rows[0].bv
      await client.query(
        `insert into public.product_evidence (evidence_id, product_id, review_status, bundle_version)
         values ($1, $2, 'draft', $3)`,
        [proposedId, productId, bundleVersion],
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

    const smokeLodgeProduct = SMOKE_TEST_LODGE_PRODUCT
    const smokeHexProduct = SMOKE_TEST_HEXCLAD_PRODUCT
    await ensureFixtureProduct(smokeLodgeProduct)
    await ensureFixtureProduct(smokeHexProduct)

    const scoresBefore = await client.query(`select count(*)::int as n from public.product_scores`)
    const inputsBefore = await client.query(`select count(*)::int as n from public.scoring_inputs`)
    const qaBefore = await client.query(`select count(*)::int as n from public.product_qa`)

    const { persistAgent3LockedOutputPg } = await import('../scripts/agent3/agent3-locked-output-pg.mjs')
    const { persistAgent4LockedAuditPg } = await import('../scripts/agent4/agent4-locked-audit-pg.mjs')

    const lodgeLi = await insertLockedPackage(lodgeLocked, smokeLodgeProduct.product_id)
    const lodgeAudit = buildAgent4LockedAudit(lodgeOutput)
    lodgeAudit.product_id = smokeLodgeProduct.product_id
    const lodgeOutRow = await persistAgent3LockedOutputPg(
      {
        product_id: smokeLodgeProduct.product_id,
        locked_input_id: lodgeLi,
        lock_hash: 'hash-lodge-db',
        score_payload: lodgeOutput.score_payload,
        math_breakdown: lodgeOutput.math_breakdown,
        display_payload: lodgeOutput.display_payload,
      },
      client,
    )
    lodgeAudit.locked_output_id = lodgeOutRow.locked_output_id
    lodgeAudit.locked_input_id = lodgeLi
    const lodgeAuditRow = await persistAgent4LockedAuditPg(lodgeAudit, client)
    assert.equal(lodgeAuditRow.input_source, 'agent3_locked_output')
    assert.equal(lodgeAuditRow.audit_status, 'passed')

    const hexLi = await insertLockedPackage(hexLocked, smokeHexProduct.product_id)
    const hexAudit = buildAgent4LockedAudit(hexOutput)
    hexAudit.product_id = smokeHexProduct.product_id
    const hexOutRow = await persistAgent3LockedOutputPg(
      {
        product_id: smokeHexProduct.product_id,
        locked_input_id: hexLi,
        lock_hash: 'hash-hex-db',
        score_payload: hexOutput.score_payload,
        math_breakdown: hexOutput.math_breakdown,
        display_payload: hexOutput.display_payload,
      },
      client,
    )
    hexAudit.locked_output_id = hexOutRow.locked_output_id
    hexAudit.locked_input_id = hexLi
    const hexAuditRow = await persistAgent4LockedAuditPg(hexAudit, client)
    assert.equal(hexAuditRow.audit_status, 'passed')

    const scoresAfter = await client.query(`select count(*)::int as n from public.product_scores`)
    const inputsAfter = await client.query(`select count(*)::int as n from public.scoring_inputs`)
    const qaAfter = await client.query(`select count(*)::int as n from public.product_qa`)
    assert.equal(scoresAfter.rows[0].n, scoresBefore.rows[0].n)
    assert.equal(inputsAfter.rows[0].n, inputsBefore.rows[0].n)
    assert.equal(qaAfter.rows[0].n, qaBefore.rows[0].n)

    const auditCount = await client.query(
      `select count(*)::int as n from public.agent4_locked_audits
       where product_id = any($1::uuid[])`,
      [[smokeLodgeProduct.product_id, smokeHexProduct.product_id]],
    )
    assert.equal(auditCount.rows[0].n, 2)

    console.log('✓ DB persist smoke: agent4_locked_audits only; product_scores/scoring_inputs/product_qa unchanged')
    await rollbackTestTransaction(client)
  } catch (err) {
    await rollbackTestTransaction(client).catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

await tryDbPersistSmoke()

console.log('\nAll Phase 7 Agent 4 locked-output audit tests passed.')
