#!/usr/bin/env node
/**
 * Normalize Why This Score option columns to canonical vocabulary strings (no score math).
 * Approved rows are immutable — those rely on legacy aliases at validation time until Agent 2 re-run.
 *
 * Usage:
 *   node scripts/migrate-canonical-why-options.mjs --name "Lodge 10.25 Inch Cast Iron Skillet"
 *   node scripts/migrate-canonical-why-options.mjs --name "..." --apply
 */
import { createServiceClient, fetchProductByName } from './agent1/supabase.mjs'
import {
  CERT_VERIFICATION_ABSENT,
  normalizeDisclosureBadge,
  normalizeWhyThisScoreOption,
} from '../src/shared/why-this-score-vocabulary.mjs'

const apply = process.argv.includes('--apply')

function parseArgs(argv) {
  let productName
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--name' && argv[i + 1]) productName = argv[++i]
  }
  return { productName }
}

function normalizeOptionArray(fieldKey, arr) {
  if (!Array.isArray(arr)) return arr
  const out = []
  for (const item of arr) {
    const n = normalizeWhyThisScoreOption(fieldKey, item)
    if (n && !out.includes(n)) out.push(n)
  }
  return out
}

async function main() {
  const { productName } = parseArgs(process.argv)
  if (!productName) {
    console.error('Usage: node scripts/migrate-canonical-why-options.mjs --name "..." [--apply]')
    process.exit(1)
  }

  const sb = createServiceClient()
  const product = await fetchProductByName(sb, productName)

  const { data: rows, error } = await sb
    .from('scoring_inputs')
    .select(
      'input_id, review_status, disclosure_quality_options, certifications_options, inputs',
    )
    .eq('product_id', product.product_id)
    .in('review_status', ['approved', 'pending_review', 'draft'])
    .order('run_timestamp', { ascending: false })

  if (error) throw error
  if (!rows?.length) {
    console.log('No scoring_inputs rows to migrate.')
    return
  }

  for (const row of rows) {
    const nextDisclosure = normalizeOptionArray(
      'disclosure_quality_options',
      row.disclosure_quality_options,
    ).map((o) => normalizeDisclosureBadge(o))
    const nextCerts = normalizeOptionArray('certifications_options', row.certifications_options)
    const inputs = row.inputs && typeof row.inputs === 'object' ? { ...row.inputs } : {}
    if (inputs.layer_4b?.transparency_badge) {
      inputs.layer_4b = {
        ...inputs.layer_4b,
        transparency_badge: normalizeDisclosureBadge(inputs.layer_4b.transparency_badge),
      }
    }

    const changed =
      JSON.stringify(nextDisclosure) !== JSON.stringify(row.disclosure_quality_options) ||
      JSON.stringify(nextCerts) !== JSON.stringify(row.certifications_options) ||
      JSON.stringify(inputs.layer_4b) !== JSON.stringify(row.inputs?.layer_4b)

    console.log(`\n${row.input_id} (${row.review_status})`)
    if (!changed) {
      console.log('  already canonical')
      continue
    }
    console.log('  disclosure:', row.disclosure_quality_options, '→', nextDisclosure)
    console.log('  certifications:', row.certifications_options, '→', nextCerts)
    if (inputs.layer_4b?.transparency_badge) {
      console.log('  layer_4b badge →', inputs.layer_4b.transparency_badge)
    }

    if (!apply) continue

    const { error: updErr } = await sb
      .from('scoring_inputs')
      .update({
        disclosure_quality_options: nextDisclosure,
        certifications_options: nextCerts.length ? nextCerts : [CERT_VERIFICATION_ABSENT],
        inputs,
      })
      .eq('input_id', row.input_id)

    if (updErr) {
      console.log(`  skip (immutable?): ${updErr.message}`)
    } else {
      console.log('  updated')
    }
  }

  if (!apply) console.log('\nPass --apply to write changes.')
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
