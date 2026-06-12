/**
 * Phase 6 — opt-in Agent 3 runner for locked_input_package (parallel to scripts/agent3/runner.mjs).
 * Default: dry-run only; does not write product_scores or mutate scoring_inputs.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from '../lib/env.mjs'
import {
  adaptLockedPayloadToScoringInputs,
  validateLockedPayloadForScoring,
} from './locked-input-adapter.mjs'
import {
  scoreLockedInputPackage,
  formatLockedInputMathBreakdownTables,
  formatCalculationTrace,
} from './score-locked-input.mjs'
import { buildLockedOutputPayloads } from './build-locked-output-payload.mjs'

/**
 * Score from an in-memory locked package (fixtures/tests). Never calls prepareAgent3ScoringInputs.
 * @param {object} params
 * @param {import('../../src/types/lockedInput.ts').LockedInputPayload} params.lockedPayload
 * @param {string} [params.lockedInputId]
 * @param {string} [params.lockHash]
 * @param {boolean} [params.dryRun=true]
 * @param {boolean} [params.persist=false] — Phase 6.7: write to agent3_locked_outputs only when true
 * @param {string} [params.productLabel]
 */
export function runAgent3FromLockedInputPackage({
  lockedPayload,
  lockedInputId = null,
  lockHash = null,
  dryRun = true,
  persist = false,
  productLabel = null,
  writeOutput = false,
}) {
  if (persist && dryRun === false) {
    // persist implies scored run; dryRun flag tracks whether DB write occurred
  }
  const effectiveDryRun = persist ? false : dryRun

  validateLockedPayloadForScoring(lockedPayload)

  const adaptedBefore = adaptLockedPayloadToScoringInputs(lockedPayload)
  const adaptedSnapshot = structuredClone(adaptedBefore)

  const result = scoreLockedInputPackage(adaptedBefore, {
    lockedInputId,
    lockHash,
    lockedPayload,
    dryRun: effectiveDryRun,
  })
  if (productLabel) result.product_label = productLabel

  const adaptedAfter = adaptLockedPayloadToScoringInputs(lockedPayload)
  const inputsUnchanged = JSON.stringify(adaptedSnapshot) === JSON.stringify(adaptedAfter)

  const outputPayloads = buildLockedOutputPayloads(lockedPayload, result)

  const payload = {
    ok: true,
    dry_run: !persist,
    persist_requested: persist,
    input_source: 'locked_input_package',
    locked_input_id: lockedInputId ?? lockedPayload.locked_input_package_id ?? null,
    lock_hash: lockHash,
    adapted_inputs: adaptedBefore,
    result,
    output_payloads: outputPayloads,
    math_breakdown_tables: formatLockedInputMathBreakdownTables(result),
    calculation_trace: formatCalculationTrace({
      calculation: result.calculation,
      tier: result.tier,
    }),
    inputs_unchanged_by_scoring: inputsUnchanged,
    wrote_product_scores: false,
    wrote_scoring_inputs: false,
    wrote_agent3_locked_outputs: false,
    locked_output_id: null,
  }

  if (writeOutput && !persist) {
    const outDir = join(projectRoot, 'scripts/output')
    mkdirSync(outDir, { recursive: true })
    const outPath = join(outDir, `agent3-locked-dry-run-${lockedPayload.locked_product_id ?? 'fixture'}.json`)
    writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')
    payload.output_path = outPath
  }

  return payload
}

/**
 * Score locked package and optionally persist to agent3_locked_outputs (explicit opt-in).
 * Never writes product_scores or scoring_inputs.
 * @param {object} params
 * @param {import('../../src/types/lockedInput.ts').LockedInputPayload} params.lockedPayload
 * @param {string} params.productId
 * @param {string} params.lockedInputId
 * @param {string} params.lockHash
 * @param {boolean} [params.persist=false]
 * @param {string} [params.productLabel]
 */
export async function runAgent3LockedInputAndPersist({
  lockedPayload,
  productId,
  lockedInputId,
  lockHash,
  persist = false,
  productLabel = null,
}) {
  const run = runAgent3FromLockedInputPackage({
    lockedPayload,
    lockedInputId,
    lockHash,
    dryRun: !persist,
    persist,
    productLabel,
  })

  if (!persist) {
    return run
  }

  const { score_payload, math_breakdown, display_payload } = run.output_payloads

  try {
    const { persistAgent3LockedOutputPg } = await import('./agent3-locked-output-pg.mjs')
    const row = await persistAgent3LockedOutputPg({
      product_id: productId,
      locked_input_id: lockedInputId,
      lock_hash: lockHash,
      score_payload,
      math_breakdown,
      display_payload,
      review_status: 'pending_review',
    })

    return {
      ...run,
      ok: true,
      dry_run: false,
      wrote_agent3_locked_outputs: true,
      locked_output_id: row.locked_output_id,
      locked_output: row,
    }
  } catch (pgErr) {
    try {
      const { createAgent3LockedOutput, getLatestAgent3LockedOutputForLockedInput } =
        await import('../../src/lib/agent3LockedOutput/agent3LockedOutputStore.ts')

      const prior = await getLatestAgent3LockedOutputForLockedInput(lockedInputId)
      const row = await createAgent3LockedOutput({
        product_id: productId,
        locked_input_id: lockedInputId,
        lock_hash: lockHash,
        score_payload,
        math_breakdown,
        display_payload,
        review_status: 'pending_review',
        supersedes_output_id: prior?.locked_output_id ?? null,
      })

      return {
        ...run,
        ok: true,
        dry_run: false,
        wrote_agent3_locked_outputs: true,
        locked_output_id: row.locked_output_id,
        locked_output: row,
      }
    } catch (storeErr) {
      return {
        ...run,
        ok: false,
        persist_error: `PG: ${pgErr instanceof Error ? pgErr.message : pgErr}; Supabase: ${storeErr instanceof Error ? storeErr.message : storeErr}`,
      }
    }
  }
}

/**
 * Load active locked package from DB and dry-run score (optional; requires Supabase).
 * persistLockedOutput=true writes agent3_locked_outputs only (Phase 6.7 opt-in).
 */
export async function runAgent3LockedInputForProduct({
  productId,
  dryRun = true,
  persistLockedOutput = false,
  writeScores = false,
}) {
  if (writeScores) {
    throw new Error('Phase 6.7: product_scores writes are disabled; use persistLockedOutput for agent3_locked_outputs')
  }

  let getActiveLockedInputForProduct
  try {
    ;({ getActiveLockedInputForProduct } = await import(
      '../../src/lib/lockedInput/lockedInputStore.ts'
    ))
  } catch (err) {
    return {
      ok: false,
      reason: `locked input store unavailable: ${err instanceof Error ? err.message : err}`,
    }
  }

  const row = await getActiveLockedInputForProduct(productId)
  if (!row) {
    return { ok: false, reason: `no active locked_for_agent_3 package for product ${productId}` }
  }

  if (persistLockedOutput) {
    return runAgent3LockedInputAndPersist({
      lockedPayload: row.locked_payload,
      productId,
      lockedInputId: row.locked_input_id,
      lockHash: row.lock_hash,
      persist: true,
    })
  }

  return runAgent3FromLockedInputPackage({
    lockedPayload: row.locked_payload,
    lockedInputId: row.locked_input_id,
    lockHash: row.lock_hash,
    dryRun,
  })
}
