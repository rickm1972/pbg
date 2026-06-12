#!/usr/bin/env node
/**
 * Phase 1 locked-input schema + stub service tests (no agents, no live product mutation).
 * Run: npm run test:locked-input-schema
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LOCKED_INPUT_SCHEMA_VERSION,
  LOCKED_INPUT_STATUSES,
  PROPOSED_INPUT_STATUSES,
  VALIDATION_STATUSES,
} from '../src/types/lockedInput.ts'
import { hashLockedInputPayload } from '../src/lib/lockedInput/lockHash.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const migrationPath = join(root, 'supabase/migrations/0041_agent1_locked_inputs.sql')
const migrationSql = readFileSync(migrationPath, 'utf8')

assert.ok(migrationSql.includes('create table if not exists public.agent1_proposed_inputs'))
assert.ok(migrationSql.includes('create table if not exists public.agent1_system_validations'))
assert.ok(migrationSql.includes('create table if not exists public.agent1_locked_inputs'))
console.log('✓ migration defines agent1_proposed_inputs, agent1_system_validations, agent1_locked_inputs')

const migration42Path = join(root, 'supabase/migrations/0042_agent3_locked_outputs.sql')
const migration42Sql = readFileSync(migration42Path, 'utf8')
assert.ok(migration42Sql.includes('create table if not exists public.agent3_locked_outputs'))
assert.equal(migration42Sql.includes('alter table public.product_scores'), false)
console.log('✓ migration 0042 defines agent3_locked_outputs without product_scores changes')

const migration43Path = join(root, 'supabase/migrations/0043_agent4_locked_audits.sql')
const migration43Sql = readFileSync(migration43Path, 'utf8')
assert.ok(migration43Sql.includes('create table if not exists public.agent4_locked_audits'))
assert.equal(migration43Sql.includes('alter table public.product_scores'), false)
assert.ok(migration43Sql.includes("input_source = 'agent3_locked_output'"))
console.log('✓ migration 0043 defines agent4_locked_audits without product_scores changes')

const migration44Path = join(root, 'supabase/migrations/0044_locked_snapshot_drafts.sql')
const migration44Sql = readFileSync(migration44Path, 'utf8')
assert.ok(migration44Sql.includes('create table if not exists public.locked_snapshot_drafts'))
assert.equal(migration44Sql.includes('alter table public.published_display_snapshots'), false)
assert.equal(migration44Sql.includes('alter table public.product_scores'), false)
assert.ok(migration44Sql.includes("input_source = 'agent4_locked_audit'"))
assert.ok(migration44Sql.includes("'approved_for_future_publish'"))
console.log('✓ migration 0044 defines locked_snapshot_drafts without publish table changes')

for (const status of LOCKED_INPUT_STATUSES) {
  assert.ok(migrationSql.includes(`'${status}'`), `missing locked_input_status ${status}`)
}
for (const status of PROPOSED_INPUT_STATUSES) {
  assert.ok(migrationSql.includes(`'${status}'`), `missing proposal_status ${status}`)
}
for (const status of VALIDATION_STATUSES) {
  assert.ok(migrationSql.includes(`'${status}'`), `missing validation_status ${status}`)
}
console.log('✓ locked_input_status, proposal_status, validation_status values present in migration')

assert.ok(migrationSql.includes('guard_agent1_locked_inputs_immutable'))
assert.ok(migrationSql.includes('trg_agent1_locked_inputs_immutable'))
assert.ok(migrationSql.includes("old.locked_input_status = 'locked_for_agent_3'"))
assert.ok(migrationSql.includes('locked_payload is not distinct from old.locked_payload'))
console.log('✓ immutability trigger guards locked_for_agent_3 locked_payload')

const proposedFixture = {
  schema_version: LOCKED_INPUT_SCHEMA_VERSION,
  proposed_components: [
    {
      proposed_component_id: 'comp-primary-1',
      proposed_component_role: 'primary_food_contact',
      proposed_canonical_material_id: 'ceramic_nonstick_sol_gel_coating',
    },
  ],
  proposed_non_detect_mitigation_candidate: true,
  proposed_transparency_badge: 'Material Uncertain',
}
assert.ok(
  proposedFixture.proposed_components[0].proposed_canonical_material_id ===
    'ceramic_nonstick_sol_gel_coating',
)
assert.equal('locked_canonical_material_id' in proposedFixture, false)
console.log('✓ proposed_canonical_material_id stored in proposed payload shape')

const lockedFixture = {
  schema_version: LOCKED_INPUT_SCHEMA_VERSION,
  locked_product_id: '00000000-0000-4000-8000-000000000001',
  locked_category: 'Kitchen',
  locked_subcategory: 'Cookware',
  locked_components: [
    {
      locked_component_id: 'comp-primary-1',
      locked_component_name: 'Cooking Surface',
      locked_component_role: 'primary_food_contact',
      locked_is_primary_contact: true,
      locked_is_score_driving: true,
      locked_canonical_material_id: 'ceramic_nonstick_sol_gel_coating',
      locked_material_hazard_value: 0.35,
      locked_base_migration_value: 0.38,
      locked_adjusted_migration_value: 0.22,
      locked_contact_intimacy: 1,
      locked_exposure_severity: 0.96,
      locked_exposure_duration: 0.5,
    },
  ],
  locked_layer_4a_total: -3,
  locked_cap_triggered: false,
  locked_transparency_badge: 'Material Uncertain',
}
assert.equal(
  lockedFixture.locked_components[0].locked_canonical_material_id,
  'ceramic_nonstick_sol_gel_coating',
)
assert.equal('proposed_canonical_material_id' in lockedFixture, false)
const lockHash = hashLockedInputPayload(lockedFixture)
assert.match(lockHash, /^[a-f0-9]{64}$/)
console.log('✓ locked_canonical_material_id stored in locked payload shape; lock_hash computable')

assert.equal(migrationSql.includes('alter table public.scoring_inputs'), false)
assert.equal(migrationSql.includes('alter table public.product_scores'), false)
assert.equal(migrationSql.includes('alter table public.product_evidence'), false)
console.log('✓ migration does not alter scoring_inputs, product_scores, or product_evidence')

const runnerFiles = [
  'scripts/agent1/runner.mjs',
  'scripts/agent2/runner.mjs',
  'scripts/agent3/runner.mjs',
  'scripts/agent4/runner.mjs',
]
for (const rel of runnerFiles) {
  const src = readFileSync(join(root, rel), 'utf8')
  assert.ok(!src.includes('lockedInput'), `${rel} must not import locked-input services yet`)
  assert.ok(!src.includes('agent1_locked_inputs'), `${rel} must not reference agent1_locked_inputs yet`)
}
console.log('✓ agent runners do not import locked-input services')

const storeSource = readFileSync(join(root, 'src/lib/lockedInput/lockedInputStore.ts'), 'utf8')
const asyncStoreFns = [
  'createAgent1ProposedInputDraft',
  'getAgent1ProposedInput',
  'getAgent1ReviewDraft',
  'saveAgent1ReviewedInput',
  'validateAgent1ReviewedInput',
  'getLatestAgent1SystemValidationForProposal',
  'updateAgent1ProposedInputDraft',
  'createAgent1SystemValidation',
  'getAgent1SystemValidation',
  'createAgent1LockedInputDraft',
  'createLockedInputPackageFromValidation',
  'lockAgent1InputPackage',
  'getLockedInputForProduct',
  'getActiveLockedInputForProduct',
  'getLockedInputForAgent3',
  'supersedeLockedInputPackage',
]
for (const fn of asyncStoreFns) {
  assert.ok(storeSource.includes(`export async function ${fn}`), `missing stub ${fn}`)
}
const builderSource = readFileSync(join(root, 'src/lib/lockedInput/buildLockedInputPackage.ts'), 'utf8')
assert.ok(builderSource.includes('export function buildLockedInputPackage'))
assert.ok(builderSource.includes('export function checkLockEligibility'))
assert.ok(storeSource.includes('buildLockedInputPackage'))
assert.ok(storeSource.includes('checkLockEligibility'))
console.log('✓ stub service functions exported')

assert.ok(migrationSql.includes('reviewed_payload jsonb'))
assert.ok(migrationSql.includes('reviewed_at timestamptz'))
assert.ok(migrationSql.includes('reviewed_by text'))
assert.ok(!/create table if not exists public\.agent1_reviewed_inputs/i.test(migrationSql))
console.log('✓ human-reviewed inputs stored on agent1_proposed_inputs (no separate reviewed table)')

async function tryDbImmutabilitySmoke() {
  let connectPgClient
  let loadEnv
  try {
    ;({ connectPgClient } = await import('./lib/pg-connect.mjs'))
    ;({ loadEnv } = await import('./lib/env.mjs'))
  } catch {
    console.log('⊘ DB smoke skipped (pg-connect unavailable)')
    return
  }

  let client
  try {
    client = await connectPgClient(loadEnv())
  } catch (err) {
    console.log(`⊘ DB smoke skipped (${err instanceof Error ? err.message : err})`)
    return
  }

  try {
    await client.query(migrationSql)
    console.log('✓ migration applied cleanly against configured database')

    await client.query('begin')

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
      console.log('⊘ DB immutability smoke skipped (no products row)')
      return
    }
    const productId = productRes.rows[0].product_id

    const evidenceRes = await client.query(
      `select evidence_id from public.product_evidence where product_id = $1 limit 1`,
      [productId],
    )
    if (!evidenceRes.rows.length) {
      await client.query('rollback')
      console.log('⊘ DB immutability smoke skipped (no evidence row for test product)')
      return
    }
    const evidenceId = evidenceRes.rows[0].evidence_id

    const proposedRes = await client.query(
      `
      insert into public.agent1_proposed_inputs (
        product_id, evidence_id, proposed_payload
      ) values (
        $1, $2, $3::jsonb
      ) returning proposed_input_id
      `,
      [productId, evidenceId, JSON.stringify(proposedFixture)],
    )
    const proposedInputId = proposedRes.rows[0].proposed_input_id

    const lockedRes = await client.query(
      `
      insert into public.agent1_locked_inputs (
        product_id, proposed_input_id, locked_payload, locked_input_status
      ) values (
        $1, $2, $3::jsonb, 'locked_for_agent_3'
      ) returning locked_input_id
      `,
      [productId, proposedInputId, JSON.stringify(lockedFixture)],
    )
    const lockedInputId = lockedRes.rows[0].locked_input_id

    let blocked = false
    try {
      await client.query(
        `update public.agent1_locked_inputs set locked_payload = $1::jsonb where locked_input_id = $2`,
        [JSON.stringify({ ...lockedFixture, locked_input_notes: 'mutated' }), lockedInputId],
      )
    } catch (err) {
      blocked = /immutable/i.test(String(err))
    }
    assert.equal(blocked, true, 'locked_for_agent_3 payload update must be blocked by trigger')

    await client.query('rollback')
    console.log('✓ locked_for_agent_3 payload update blocked by DB trigger (transaction rolled back)')
  } finally {
    await client.end()
  }
}

await tryDbImmutabilitySmoke()

console.log('\nAll locked-input Phase 1 schema tests passed.')
