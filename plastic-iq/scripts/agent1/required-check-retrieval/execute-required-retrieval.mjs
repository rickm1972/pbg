import { loadEnv } from '../../lib/env.mjs'
import { detectPatternTriggers } from '../../../src/shared/required-evidence-matrix/pattern-triggers.mjs'
import {
  getRetrievalTaskForCheck,
  isRetrievalTaskTriggered,
  listPendingRetrievalTasks,
  PTFE_REQUIRED_EXTERNAL_CHECK_IDS,
} from '../../../src/shared/required-evidence-retrieval/retrieval-task-registry.mjs'
import {
  assertPtfeExternalRunnersRegistered,
  hasRetrievalRunner,
  TASK_RUNNERS,
} from './task-runners.mjs'
import {
  mergeRetrievalSources,
  refreshEvidenceAfterRetrieval,
  storeRequiredCheckResults,
} from './apply-results.mjs'

/**
 * @typedef {object} RequiredCheckResultRecord
 * @property {string} check_id
 * @property {'passed' | 'missing' | 'not_applicable' | 'failed'} status
 * @property {string | null} source_url
 * @property {string | null} source_quote
 * @property {string[]} canonical_ids_added
 * @property {object[]} retrieval_attempts
 * @property {string} timestamp
 * @property {string | null} [detail]
 */

const STALE_RUNNER_STUB_RE = /No retrieval runner registered/i
const RETRIEVAL_EXECUTE_MODULE_ID = 'execute-required-retrieval/task-runners-v3'

/**
 * @param {{
 *   structured: object
 *   sources: object[]
 *   facts?: object[]
 *   product: { brand?: string; product_name?: string; subcategory?: string }
 *   env?: Record<string, string>
 *   checkIds?: string[]
 *   forceCheckIds?: string[] — run even when matrix check already passed (refresh wording/sources)
 * }} params
 */
export async function executeRequiredCheckRetrieval(params) {
  assertPtfeExternalRunnersRegistered()

  const runnerKeys = Object.keys(TASK_RUNNERS)
  console.log(`[required-check-retrieval] module=${RETRIEVAL_EXECUTE_MODULE_ID} runner_keys=${runnerKeys.join(', ')}`)

  const env = params.env ?? loadEnv()
  const structured = params.structured
  let sources = [...(params.sources ?? [])]
  const facts = params.facts ?? []

  refreshEvidenceAfterRetrieval(structured, sources, { facts })

  const triggers = detectPatternTriggers(structured, structured.canonical_mappings, sources)
  const validation = structured.required_evidence_validation
  const primaryId = structured?.canonical_mappings?.primary_contact_material_id?.canonical_id ?? ''

  if (primaryId === 'ptfe_nonstick_titanium_reinforced' || primaryId === 'ptfe_nonstick_coating') {
    const available = PTFE_REQUIRED_EXTERNAL_CHECK_IDS.filter((id) => hasRetrievalRunner(id))
    console.log(
      `[required-check-retrieval] PTFE product (${primaryId}); registered runners: ${available.join(', ')}`,
    )
    const missing = PTFE_REQUIRED_EXTERNAL_CHECK_IDS.filter((id) => !hasRetrievalRunner(id))
    if (missing.length) {
      throw new Error(
        `PTFE cookware missing required-check runners: ${missing.join(', ')}`,
      )
    }
  }

  const pending = listPendingRetrievalTasks(validation, triggers).filter((task) =>
    params.checkIds?.length ? params.checkIds.includes(task.check_id) : true,
  )

  const forced = (params.forceCheckIds ?? [])
    .map((id) => getRetrievalTaskForCheck(id))
    .filter(Boolean)
    .filter((task) => !pending.some((p) => p.check_id === task.check_id))

  const tasksToRun = [...pending, ...forced]
  const seen = new Set(tasksToRun.map((t) => t.check_id))

  for (const item of validation?.checklist_items ?? []) {
    if (item.category !== 'external_check') continue
    if (item.status === 'passed' || item.status === 'not_applicable') continue
    const task = getRetrievalTaskForCheck(item.id)
    if (!task || !hasRetrievalRunner(task.check_id)) continue
    if (!isRetrievalTaskTriggered(task, triggers)) continue
    if (!seen.has(task.check_id)) {
      tasksToRun.push(task)
      seen.add(task.check_id)
    }
  }

  for (const checkId of PTFE_REQUIRED_EXTERNAL_CHECK_IDS) {
    if (!triggers.has('ptfe_primary_contact') && !triggers.has('pfoa_pfas_distinction')) continue
    const task = getRetrievalTaskForCheck(checkId)
    if (!task || !hasRetrievalRunner(checkId) || seen.has(checkId)) continue
    tasksToRun.push(task)
    seen.add(checkId)
  }

  /** Drop stale “not registered” stubs; they will be replaced when runners execute. */
  /** @type {RequiredCheckResultRecord[]} */
  let results = (structured.required_check_results ?? []).filter(
    (r) => !(r.status === 'failed' && STALE_RUNNER_STUB_RE.test(r.detail ?? '')),
  )

  for (const r of structured.required_check_results ?? []) {
    if (r.status !== 'failed') continue
    if (!STALE_RUNNER_STUB_RE.test(r.detail ?? '')) continue
    const task = getRetrievalTaskForCheck(r.check_id)
    if (!task || !hasRetrievalRunner(task.check_id) || seen.has(task.check_id)) continue
    tasksToRun.push(task)
    seen.add(task.check_id)
  }

  console.log(
    `[required-check-retrieval] triggers=${[...triggers].join(',')} pending=${pending.map((t) => t.check_id).join(',')} tasksToRun=${tasksToRun.map((t) => t.check_id).join(',')}`,
  )
  console.log(
    `[required-check-retrieval] pfoa_runner=${Boolean(TASK_RUNNERS['external.pfoa_vs_pfas_free_distinction'])} queued=${tasksToRun.some((t) => t.check_id === 'external.pfoa_vs_pfas_free_distinction')}`,
  )

  for (const task of tasksToRun) {
    const runner = TASK_RUNNERS[task.check_id]
    if (!runner) {
      const msg =
        `No retrieval runner registered for ${task.check_id}. ` +
        `Registered keys: ${runnerKeys.join(', ') || '(none)'}. ` +
        `Module ${RETRIEVAL_EXECUTE_MODULE_ID}.`
      if (PTFE_REQUIRED_EXTERNAL_CHECK_IDS.includes(task.check_id)) {
        throw new Error(msg)
      }
      console.error(`[required-check-retrieval] SKIP ${task.check_id}: ${msg}`)
      continue
    }

    console.log(`[required-check-retrieval] Running ${task.task_key} (${task.check_id})`)
    const outcome = await runner({ product: params.product, structured, sources, env, task })
    if (outcome.newSources?.length) {
      sources = mergeRetrievalSources(sources, outcome.newSources)
    }

    results = results.filter((r) => r.check_id !== outcome.check_id)
    results.push({
      check_id: outcome.check_id,
      status: outcome.status,
      source_url: outcome.source_url,
      source_quote: outcome.source_quote,
      canonical_ids_added: outcome.canonical_ids_added ?? [],
      retrieval_attempts: outcome.retrieval_attempts ?? [],
      timestamp: outcome.timestamp,
      detail: outcome.detail ?? null,
    })
  }

  storeRequiredCheckResults(structured, dedupeResults(results))
  refreshEvidenceAfterRetrieval(structured, sources, { facts })

  for (const checkId of PTFE_REQUIRED_EXTERNAL_CHECK_IDS) {
    if (!triggers.has('ptfe_primary_contact') && !triggers.has('pfoa_pfas_distinction')) continue
    const row = structured.required_check_results?.find((r) => r.check_id === checkId)
    if (row && STALE_RUNNER_STUB_RE.test(row.detail ?? '')) {
      throw new Error(
        `Retrieval left stale stub for ${checkId} after execute — reload Agent 1 modules (AGENT1_RELOAD_MODULES).`,
      )
    }
  }

  return {
    sources,
    results: structured.required_check_results,
    validation: structured.required_evidence_validation,
    pending_count: tasksToRun.length,
    runner_keys: runnerKeys,
    module_id: RETRIEVAL_EXECUTE_MODULE_ID,
    tasks_executed: tasksToRun.map((t) => t.check_id),
  }
}

/**
 * @param {RequiredCheckResultRecord[]} results
 */
function dedupeResults(results) {
  const byId = new Map()
  for (const r of results) {
    const prev = byId.get(r.check_id)
    if (!prev || r.timestamp > prev.timestamp) byId.set(r.check_id, r)
  }
  return [...byId.values()]
}
