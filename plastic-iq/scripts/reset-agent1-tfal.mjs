#!/usr/bin/env node
/**
 * Reset T-Fal for Agent 1 re-test (Run tab). Does not touch Agents 2–4 artifacts.
 * Usage: node scripts/reset-agent1-tfal.mjs [--apply]
 */
import { createServiceClient } from './agent1/supabase.mjs'
import { resetAgent1ForRetest } from './agent1/reset-for-retest.mjs'

const TFAL_ID = '7a457a86-ab62-4cbf-90b9-ccaeafe06896'
const apply = process.argv.includes('--apply')

const sb = createServiceClient()
const { data: p } = await sb.from('products').select('product_name, agent_status').eq('product_id', TFAL_ID).single()

console.log(apply ? 'APPLYING Agent 1 reset for T-Fal…\n' : 'DRY RUN (pass --apply)\n')
console.log(`${p?.product_name ?? 'T-Fal'} — current status: ${p?.agent_status ?? '?'}`)
console.log('Will: delete all product_evidence, set agent_status → unscored\n')

if (!apply) {
  console.log('Then: Agent 1 → Run Agent 1 → run T-Fal. After success → Awaiting review.')
  process.exit(0)
}

const result = await resetAgent1ForRetest(sb, TFAL_ID)
console.log(JSON.stringify(result, null, 2))
