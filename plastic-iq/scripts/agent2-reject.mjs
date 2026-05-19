#!/usr/bin/env node
/**
 * Reject a submitted normalization (service role).
 *
 * Usage:
 *   node scripts/agent2-reject.mjs --id <product_id> --notes "..."
 *   node scripts/agent2-reject.mjs --name "Hydro Flask" --notes-file notes.txt
 */
import { readFileSync } from 'node:fs'
import { createServiceClient } from './agent2/supabase.mjs'
import { fetchProductById, fetchProductByName } from './agent1/supabase.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productId
  let productName
  let notes
  let notesFile

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && args[i + 1]) productId = args[++i]
    else if (args[i] === '--name' && args[i + 1]) productName = args[++i]
    else if (args[i] === '--notes' && args[i + 1]) notes = args[++i]
    else if (args[i] === '--notes-file' && args[i + 1]) {
      notesFile = args[++i]
    }
  }

  if (notesFile) notes = readFileSync(notesFile, 'utf8')
  return { productId, productName, notes }
}

async function main() {
  const { productId, productName, notes } = parseArgs(process.argv)
  if ((!productId && !productName) || !notes?.trim()) {
    console.error('Usage: node scripts/agent2-reject.mjs --id <uuid> --notes "..."')
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
  if (!row) {
    console.error(`No submitted scoring_inputs for ${product.product_name}`)
    process.exit(2)
  }

  const now = new Date().toISOString()
  const { error: inputError } = await supabase
    .from('scoring_inputs')
    .update({
      review_status: 'rejected',
      review_timestamp: now,
      review_notes: notes.trim(),
      human_reviewer: 'script:agent2-reject',
    })
    .eq('input_id', row.input_id)

  if (inputError) throw inputError

  const { error: productError } = await supabase
    .from('products')
    .update({ agent_status: 'normalization_rejected' })
    .eq('product_id', product.product_id)

  if (productError) throw productError

  console.log(`Rejected ${product.product_name} (${row.input_id})`)
  console.log(`agent_status → normalization_rejected`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
