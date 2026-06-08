#!/usr/bin/env node
/**
 * Supersede stale Gate 2 (Agent 2) pending_review scoring_inputs.
 * Does not run Agent 3. Sets agent_status → evidence_approved for manual rerun.
 *
 * Usage:
 *   node scripts/supersede-pending-gate2-normalization.mjs --id <product_uuid> --apply
 */
import { createServiceClient, fetchProductById } from './agent1/supabase.mjs'

function parseArgs(argv) {
  let productId
  let apply = false
  let notes = 'Stale Gate 2 normalization superseded; rerun Agent 2 manually.'
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--id' && argv[i + 1]) productId = argv[++i]
    else if (argv[i] === '--apply') apply = true
    else if (argv[i] === '--notes' && argv[i + 1]) notes = argv[++i]
  }
  return { productId, apply, notes }
}

async function main() {
  const { productId, apply, notes } = parseArgs(process.argv)
  if (!productId) {
    console.error('Usage: node scripts/supersede-pending-gate2-normalization.mjs --id <uuid> [--apply]')
    process.exit(1)
  }

  const sb = createServiceClient()
  const product = await fetchProductById(sb, productId)

  const { data: pending, error } = await sb
    .from('scoring_inputs')
    .select('input_id, review_status, algorithm_version')
    .eq('product_id', productId)
    .in('review_status', ['pending_review', 'draft'])
    .order('run_timestamp', { ascending: false })

  if (error) throw error

  console.log(apply ? 'APPLYING Gate 2 supersede…\n' : 'DRY RUN\n')
  console.log(`${product.product_name} (${productId})`)
  console.log(`  agent_status: ${product.agent_status}`)
  for (const row of pending ?? []) {
    console.log(`    - ${row.input_id} ${row.review_status} ${row.algorithm_version ?? ''}`)
  }
  console.log('  after: scoring_inputs → superseded, agent_status → evidence_approved\n')

  if (!apply || !pending?.length) return

  const now = new Date().toISOString()
  for (const row of pending) {
    const { error: updErr } = await sb
      .from('scoring_inputs')
      .update({ review_status: 'superseded', review_notes: notes, review_timestamp: now })
      .eq('input_id', row.input_id)
    if (updErr) throw updErr
    console.log(`Superseded ${row.input_id}`)
  }

  const { error: pErr } = await sb
    .from('products')
    .update({ agent_status: 'evidence_approved' })
    .eq('product_id', productId)
  if (pErr) throw pErr

  console.log('Done. Rerun Agent 2 from admin.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
