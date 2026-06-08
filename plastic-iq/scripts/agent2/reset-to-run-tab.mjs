#!/usr/bin/env node
/**
 * Testing reset — move a product back to Agent 2 Run tab only.
 * Sets agent_status → evidence_approved. Rejects latest pending_review scoring_inputs.
 * Does not modify Gate 1 evidence.
 *
 *   node scripts/agent2/reset-to-run-tab.mjs --id <product_id>
 */
import { createServiceClient, updateAgentStatus } from './supabase.mjs'

const productId = process.argv.includes('--id')
  ? process.argv[process.argv.indexOf('--id') + 1]
  : null

if (!productId) {
  console.error('Usage: node scripts/agent2/reset-to-run-tab.mjs --id <product_id>')
  process.exit(1)
}

const sb = createServiceClient()
const { data: product, error } = await sb
  .from('products')
  .select('product_id, product_name, agent_status')
  .eq('product_id', productId)
  .maybeSingle()

if (error) throw error
if (!product) {
  console.error(`Product not found: ${productId}`)
  process.exit(1)
}

const { data: latest } = await sb
  .from('scoring_inputs')
  .select('input_id, review_status')
  .eq('product_id', productId)
  .order('run_timestamp', { ascending: false })
  .limit(1)
  .maybeSingle()

if (latest?.review_status === 'pending_review') {
  const now = new Date().toISOString()
  const { error: rejectErr } = await sb
    .from('scoring_inputs')
    .update({
      review_status: 'rejected',
      review_timestamp: now,
      review_notes: 'Testing reset — cleared for Agent 2 re-run from Run tab.',
      human_reviewer: 'system:reset-to-run-tab',
    })
    .eq('input_id', latest.input_id)
  if (rejectErr) throw rejectErr
  console.log(`  superseded pending_review input ${latest.input_id}`)
}

if (product.agent_status !== 'evidence_approved') {
  await updateAgentStatus(sb, productId, 'evidence_approved')
  console.log(`${product.product_name}: ${product.agent_status} → evidence_approved`)
} else {
  console.log(`${product.product_name}: already evidence_approved`)
}

console.log('Ready on Agent 2 Run tab only. Run Agent 2 → Awaiting review.')
