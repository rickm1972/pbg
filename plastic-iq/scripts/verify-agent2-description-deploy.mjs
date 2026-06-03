#!/usr/bin/env node
/**
 * Prove Agent 2 API is serving the current description generator (no admin UI).
 * Usage: node scripts/verify-agent2-description-deploy.mjs [baseUrl]
 */
import { loadEnv } from './lib/env.mjs'

const EXPECTED = '2026-06-01-hazard-sort-acronym'
const base = process.argv[2] || 'http://localhost:5173'

async function main() {
  const env = loadEnv()
  const secret = env.VITE_ADMIN_PASSWORD
  if (!secret) {
    console.error('VITE_ADMIN_PASSWORD missing in .env')
    process.exit(1)
  }

  const healthUrl = `${base}/api/agent2/health`
  const healthRes = await fetch(healthUrl)
  const health = await healthRes.json().catch(() => ({}))
  console.log('GET', healthUrl)
  console.log('  status:', healthRes.status)
  console.log('  description_generator_version:', health.description_generator_version ?? 'MISSING')

  if (health.description_generator_version !== EXPECTED) {
    console.error('\nFAIL — health endpoint is not on the new generator.')
    process.exit(1)
  }

  const hexId = 'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5'
  const runUrl = `${base}/api/agent2/run`
  console.log('\nPOST', runUrl, '(HexClad — writes scoring_inputs)')
  const runRes = await fetch(runUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': secret,
    },
    body: JSON.stringify({ product_id: hexId }),
  })
  const run = await runRes.json().catch(() => ({}))
  console.log('  status:', runRes.status)
  console.log('  description_generator_version:', run.description_generator_version ?? 'MISSING')
  console.log('  preview:', run.product_description_preview ?? run.inputs?.product_description?.slice(0, 120))

  if (run.description_generator_version !== EXPECTED) {
    console.error('\nFAIL — run response missing new generator stamp.')
    process.exit(1)
  }

  const s1 = String(run.product_description_preview ?? run.inputs?.product_description ?? '').split('.')[0]
  if (!/proprietary ceramic coating \(undisclosed\)/i.test(s1)) {
    console.error('\nFAIL — HexClad sentence 1 order still wrong:', s1)
    process.exit(1)
  }
  if (s1.indexOf('proprietary') > s1.indexOf('laser-etched')) {
    console.error('\nFAIL — ceramic must appear before laser-etched:', s1)
    process.exit(1)
  }

  console.log('\nPASS — Agent 2 API on', base, 'is executing', EXPECTED)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
