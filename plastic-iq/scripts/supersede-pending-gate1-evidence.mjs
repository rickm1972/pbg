#!/usr/bin/env node
/**
 * Supersede stale Gate 1 (Agent 1) pending_review evidence so a fresh run can start.
 * Does not invoke Agent 1. Leaves later pipeline rows untouched unless --full-agent1-wipe.
 *
 * Usage:
 *   node scripts/supersede-pending-gate1-evidence.mjs --name "Lodge 10.25 Inch Cast Iron Skillet"
 *   node scripts/supersede-pending-gate1-evidence.mjs --id <product_uuid> --apply
 */
import { createServiceClient } from './agent1/supabase.mjs'
import { fetchProductById, fetchProductByName } from './agent1/supabase.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productId
  let productName
  let apply = false
  let notes = 'Stale Gate 1 bundle superseded after canonical mapping fixes; rerun Agent 1 manually.'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && args[i + 1]) productId = args[++i]
    else if (args[i] === '--name' && args[i + 1]) productName = args[++i]
    else if (args[i] === '--apply') apply = true
    else if (args[i] === '--notes' && args[i + 1]) notes = args[++i]
  }

  return { productId, productName, apply, notes }
}

async function main() {
  const { productId, productName, apply, notes } = parseArgs(process.argv)
  if (!productId && !productName) {
    console.error('Usage: node scripts/supersede-pending-gate1-evidence.mjs --id <uuid> | --name "..." [--apply]')
    process.exit(1)
  }

  const sb = createServiceClient()
  const product = productId
    ? await fetchProductById(sb, productId)
    : await fetchProductByName(sb, productName)

  const { data: pending, error: listErr } = await sb
    .from('product_evidence')
    .select('evidence_id, review_status, algorithm_version, bundle_version')
    .eq('product_id', product.product_id)
    .in('review_status', ['pending_review', 'draft'])
    .order('bundle_version', { ascending: false })

  if (listErr) throw listErr

  console.log(apply ? 'APPLYING supersede…\n' : 'DRY RUN (pass --apply to execute)\n')
  console.log(`${product.product_name} (${product.product_id})`)
  console.log(`  agent_status: ${product.agent_status}`)
  console.log(`  pending/draft evidence rows: ${pending?.length ?? 0}`)
  for (const row of pending ?? []) {
    console.log(`    - ${row.evidence_id} ${row.review_status} ${row.algorithm_version ?? ''}`)
  }
  console.log('  after apply: review_status → superseded, agent_status → unscored, active_evidence_id → null\n')

  if (!apply) return
  if (!pending?.length) {
    console.log('No pending Gate 1 bundle to supersede.')
    return
  }

  const now = new Date().toISOString()
  for (const row of pending) {
    const { error: updErr } = await sb
      .from('product_evidence')
      .update({
        review_status: 'superseded',
        reviewer_notes: notes.trim(),
        reviewed_at: now,
      })
      .eq('evidence_id', row.evidence_id)
    if (updErr) throw updErr
    console.log(`Superseded ${row.evidence_id} (${row.review_status})`)
  }

  const { error: pErr } = await sb
    .from('products')
    .update({
      agent_status: 'unscored',
      active_evidence_id: null,
    })
    .eq('product_id', product.product_id)
  if (pErr) throw pErr

  console.log('Done. Rerun Agent 1 from admin when ready.')
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
