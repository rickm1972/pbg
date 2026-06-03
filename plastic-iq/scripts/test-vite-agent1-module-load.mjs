#!/usr/bin/env node
/**
 * Same module load sequence as vite-agents-api POST /api/agent1/run (no Anthropic).
 */
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))

function importFresh(relativeFromScripts) {
  const href = pathToFileURL(join(scriptsDir, relativeFromScripts)).href
  return import(`${href}?t=${Date.now()}`)
}

process.env.AGENT1_RELOAD_MODULES = '1'
await importFresh('agent1/required-check-retrieval/task-runners.mjs')
const execMod = await importFresh('agent1/required-check-retrieval/execute-required-retrieval.mjs')
const { TASK_RUNNERS } = await importFresh('agent1/required-check-retrieval/task-runners.mjs')

const keys = Object.keys(TASK_RUNNERS)
const pfoa = Boolean(TASK_RUNNERS['external.pfoa_vs_pfas_free_distinction'])
console.log('vite-path runner_keys:', keys.join(', '))
console.log('pfoa_runner:', pfoa)
console.log('execute_module_id:', execMod.RETRIEVAL_EXECUTE_MODULE_ID ?? 'n/a')

if (!pfoa) {
  console.error('FAIL: PFOA runner missing after vite-path load')
  process.exit(1)
}
console.log('OK: vite Agent 1 module load path has PFOA runner')
