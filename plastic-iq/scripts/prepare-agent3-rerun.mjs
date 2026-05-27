#!/usr/bin/env node
/**
 * Archive pending Agent 3 score and reset product for a fresh Agent 3 run.
 *
 * Usage:
 *   node scripts/prepare-agent3-rerun.mjs --id <product_id>
 *   node scripts/prepare-agent3-rerun.mjs --name "T-Fal Ultimate Hard Anodized"
 */
import { createServiceClient } from './agent3/supabase.mjs'
import { fetchProductById, fetchProductByName } from './agent1/supabase.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productId
  let productName
  let notes =
    'Re-run Agent 3 after transparency badge fix. Previous pending score archived.'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && args[i + 1]) productId = args[++i]
    else if (args[i] === '--name' && args[i + 1]) productName = args[++i]
    else if (args[i] === '--notes' && args[i + 1]) notes = args[++i]
  }

  return { productId, productName, notes }
}

async function main() {
  const { productId, productName, notes } = parseArgs(process.argv)
  if (!productId && !productName) {
    console.error('Usage: node scripts/prepare-agent3-rerun.mjs --id <uuid> | --name "..."')
    process.exit(1)
  }

  const supabase = createServiceClient()
  const product = productId
    ? await fetchProductById(supabase, productId)
    : await fetchProductByName(supabase, productName)

  const { data: row, error: findErr } = await supabase
    .from('product_scores')
    .select('score_id, review_status')
    .eq('product_id', product.product_id)
    .in('review_status', ['pending_review', 'approved'])
    .order('run_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findErr) throw findErr

  const now = new Date().toISOString()

  if (row?.review_status === 'pending_review') {
    const { error: scoreErr } = await supabase
      .from('product_scores')
      .update({
        review_status: 'superseded',
        review_notes: notes.trim(),
        review_timestamp: now,
      })
      .eq('score_id', row.score_id)

    if (scoreErr) throw scoreErr
    console.log(`Archived pending score ${row.score_id}`)
  } else if (row) {
    console.log(`Latest score is ${row.review_status} (left in place).`)
  } else {
    console.log('No product_scores row to archive.')
  }

  const { error: productErr } = await supabase
    .from('products')
    .update({ agent_status: 'normalization_approved' })
    .eq('product_id', product.product_id)

  if (productErr) throw productErr

  console.log(`${product.product_name} (${product.product_id})`)
  console.log('agent_status → normalization_approved (ready for Run Agent 3 tab)')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
