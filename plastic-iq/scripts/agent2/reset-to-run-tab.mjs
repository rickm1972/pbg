#!/usr/bin/env node
/**
 * Testing reset — move a product back to Agent 2 Run tab only.
 * Sets agent_status → evidence_approved. Rejects latest pending_review scoring_inputs.
 * Clears Agent 3 queue state (archives pending/approved scores, clears catalog score fields).
 * Does not modify Gate 1 evidence.
 *
 *   node scripts/agent2/reset-to-run-tab.mjs --id <product_id>
 */
import { createServiceClient } from './supabase.mjs'

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

const now = new Date().toISOString()
const resetNotes = 'Testing reset — cleared for Agent 2 re-run from Run tab.'

if (latest?.review_status === 'pending_review') {
  const { error: rejectErr } = await sb
    .from('scoring_inputs')
    .update({
      review_status: 'rejected',
      review_timestamp: now,
      review_notes: resetNotes,
      human_reviewer: 'system:reset-to-run-tab',
    })
    .eq('input_id', latest.input_id)
  if (rejectErr) throw rejectErr
  console.log(`  rejected pending_review scoring_inputs ${latest.input_id}`)
}

const { data: activeScores, error: scoresErr } = await sb
  .from('product_scores')
  .select('score_id, review_status')
  .eq('product_id', productId)
  .in('review_status', ['pending_review', 'approved'])

if (scoresErr) throw scoresErr

for (const score of activeScores ?? []) {
  const { error: archiveErr } = await sb
    .from('product_scores')
    .update({
      review_status: 'superseded',
      review_notes: resetNotes,
      review_timestamp: now,
    })
    .eq('score_id', score.score_id)
  if (archiveErr) throw archiveErr
  console.log(`  archived ${score.review_status} product_scores ${score.score_id}`)
}

const agent3Statuses = new Set([
  'normalization_approved',
  'scoring_review_pending',
  'scoring_approved',
])
const needsStatusReset =
  product.agent_status !== 'evidence_approved' || agent3Statuses.has(product.agent_status)

if (needsStatusReset) {
  const { error: clearErr } = await sb
    .from('products')
    .update({
      agent_status: 'evidence_approved',
      pac_safety_score: null,
      tier: null,
      score_basis: null,
    })
    .eq('product_id', productId)
  if (clearErr) throw clearErr
  if (product.agent_status !== 'evidence_approved') {
    console.log(`${product.product_name}: ${product.agent_status} → evidence_approved`)
  } else {
    console.log(`${product.product_name}: cleared Agent 3 catalog score fields`)
  }
} else {
  const { error: clearErr } = await sb
    .from('products')
    .update({
      pac_safety_score: null,
      tier: null,
      score_basis: null,
    })
    .eq('product_id', productId)
  if (clearErr) throw clearErr
  console.log(`${product.product_name}: already evidence_approved (Agent 3 catalog fields cleared)`)
}

console.log('Ready on Agent 2 Run tab only. Agent 3 queues cleared. Run Agent 2 → Awaiting review.')
