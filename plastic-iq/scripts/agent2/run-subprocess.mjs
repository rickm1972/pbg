/**
 * Spawn Agent 2 in a child process so Vite dev always loads current scripts (no ESM cache).
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))

/**
 * Parse JSON payload from subprocess stdout (single line; falls back to last line).
 * @param {string} stdout
 */
export function parseAgent2JsonStdout(stdout) {
  const text = stdout.trim()
  if (!text) throw new Error('Agent 2 subprocess returned empty stdout')

  try {
    return JSON.parse(text)
  } catch {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    const last = lines[lines.length - 1]
    if (!last?.startsWith('{')) {
      throw new Error(
        `Agent 2 subprocess stdout was not JSON (got ${text.slice(0, 200)}…)`,
      )
    }
    return JSON.parse(last)
  }
}

/**
 * @param {string} productId
 * @returns {Promise<Record<string, unknown>>}
 */
export function runAgent2JsonSubprocess(productId) {
  const cli = join(scriptsDir, 'cli-run-json.mjs')
  const projectRoot = join(scriptsDir, '..')

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, productId], {
      cwd: projectRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      try {
        const payload = parseAgent2JsonStdout(stdout)
        if (code !== 0 && code !== 2) {
          reject(
            new Error(
              stderr.trim() ||
                String(payload.reason ?? `Agent 2 subprocess exited ${code}`),
            ),
          )
          return
        }
        resolve(payload)
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        reject(new Error(stderr.trim() || detail))
      }
    })
  })
}
