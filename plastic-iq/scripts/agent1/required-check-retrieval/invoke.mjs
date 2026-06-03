import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PTFE_REQUIRED_EXTERNAL_CHECK_IDS } from '../../../src/shared/required-evidence-retrieval/retrieval-task-registry.mjs'

const RETRIEVAL_DIR = dirname(fileURLToPath(import.meta.url))
const EXECUTE_HREF = pathToFileURL(join(RETRIEVAL_DIR, 'execute-required-retrieval.mjs')).href

const STALE_RUNNER_STUB_RE = /No retrieval runner registered/i

function shouldBustModuleCache() {
  return process.env.AGENT1_RELOAD_MODULES === '1'
}

/**
 * Load execute-required-retrieval.mjs (cache-busted in dev so Vite admin runs pick up runner changes).
 */
export async function loadExecuteRequiredCheckRetrievalModule() {
  const url = shouldBustModuleCache() ? `${EXECUTE_HREF}?t=${Date.now()}` : EXECUTE_HREF
  return import(url)
}

/**
 * @param {Parameters<import('./execute-required-retrieval.mjs').executeRequiredCheckRetrieval>[0]} params
 */
export async function invokeRequiredCheckRetrieval(params) {
  if (shouldBustModuleCache()) {
    await import(
      `${pathToFileURL(join(RETRIEVAL_DIR, 'task-runners.mjs')).href}?t=${Date.now()}`,
    )
  }
  const mod = await loadExecuteRequiredCheckRetrievalModule()
  return mod.executeRequiredCheckRetrieval(params)
}

/**
 * Fail before pending_review if PTFE required external retrieval did not pass.
 * @param {object} structured
 * @param {Set<string>} triggers
 */
export function assertRequiredExternalRetrievalComplete(structured, triggers) {
  const ptfeContext =
    triggers.has('ptfe_primary_contact') || triggers.has('pfoa_pfas_distinction')
  if (!ptfeContext) return

  const blockers = []

  for (const checkId of PTFE_REQUIRED_EXTERNAL_CHECK_IDS) {
    const row = structured.required_check_results?.find((r) => r.check_id === checkId)
    if (row && STALE_RUNNER_STUB_RE.test(row.detail ?? '')) {
      blockers.push(
        `${checkId}: stale "not registered" stub — dev server is running cached Agent 1 modules; restart \`npm run dev\` once.`,
      )
      continue
    }
    if (!row || row.status !== 'passed') {
      blockers.push(
        `${checkId}: ${row?.status ?? 'missing'} — ${row?.detail ?? 'no retrieval result'}`,
      )
    }
  }

  const checklist = structured.required_evidence_validation?.checklist_items ?? []
  for (const checkId of PTFE_REQUIRED_EXTERNAL_CHECK_IDS) {
    const item = checklist.find((i) => i.id === checkId)
    if (item?.score_driving && item.status !== 'passed' && item.status !== 'not_applicable') {
      blockers.push(`${checkId} checklist: ${item.status} — ${item.detail ?? ''}`)
    }
  }

  if (blockers.length) {
    throw new Error(
      `Agent 1 retrieval pipeline error (PTFE required checks). ${blockers.join(' | ')}`,
    )
  }
}
