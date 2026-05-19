#!/usr/bin/env node
/**
 * Archive the latest submitted normalization and reset product for a fresh Agent 2 run.
 *
 * Usage:
 *   node scripts/prepare-agent2-rerun.mjs --id <product_id>
 *   node scripts/prepare-agent2-rerun.mjs --name "CamelBak Chute Mag"
 */
import { createServiceClient } from './agent2/supabase.mjs'
import { fetchProductById, fetchProductByName } from './agent1/supabase.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productId
  let productName
  let notes =
    'Re-run after prompt update. Previous submitted normalization archived; run Agent 2 again with current rules.'

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
    console.error('Usage: node scripts/prepare-agent2-rerun.mjs --id <uuid> | --name "..."')
    process.exit(1)
  }

  const supabase = createServiceClient()
  const product = productId
    ? await fetchProductById(supabase, productId)
    : await fetchProductByName(supabase, productName)

  const { data: row, error: findError } = await supabase
    .from('scoring_inputs')
    .select('input_id, review_status')
    .eq('product_id', product.product_id)
    .eq('review_status', 'submitted')
    .order('run_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) throw findError

  const now = new Date().toISOString()

  if (row) {
    const { error: inputError } = await supabase
      .from('scoring_inputs')
      .update({
        review_status: 'rejected',
        review_timestamp: now,
        review_notes: notes.trim(),
        human_reviewer: 'script:prepare-agent2-rerun',
      })
      .eq('input_id', row.input_id)

    if (inputError) throw inputError
    console.log(`Archived submitted input ${row.input_id}`)
  } else {
    console.log('No submitted scoring_inputs to archive (continuing).')
  }

  const productPatch = {
    agent_status: 'evidence_approved',
    score_basis: 'Based on Materials Science',
    testing_queue_reason: null,
  }

  const { error: productError } = await supabase
    .from('products')
    .update(productPatch)
    .eq('product_id', product.product_id)

  if (productError) throw productError

  console.log(`${product.product_name} (${product.product_id})`)
  console.log(`agent_status → evidence_approved (ready for Run Agent 2 tab)`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
