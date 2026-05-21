#!/usr/bin/env node
/**
 * Full pipeline validation for three products only (V2.3.4 build).
 * Lodge, Branch Basics, HexClad — does not touch other catalog items.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from './lib/env.mjs'
import { runAgent1 } from './agent1/runner.mjs'
import { formatCertificationsVerified } from './agent1/certification-verify.mjs'
import { runAgent2 } from './agent2/runner.mjs'
import { runAgent3 } from './agent3/runner.mjs'
import { runAgent4 } from './agent4/runner.mjs'
import { formatQaReport } from './agent4/run-checks.mjs'
import { createServiceClient } from './agent1/supabase.mjs'

const VALIDATION_PRODUCTS = [
  'Lodge 10.25 Inch Cast Iron Skillet',
  'Branch Basics Multi Purpose Concentrate for Dish Washing',
  'HexClad Hybrid Nonstick 10 Inch Frying Pan',
]

const REVIEWED_BY = 'pipeline-validate-v2.3.4'

async function approveLatestEvidence(supabase, productId) {
  const { data: row, error: fetchErr } = await supabase
    .from('product_evidence')
    .select('evidence_id, bundle_version')
    .eq('product_id', productId)
    .eq('review_status', 'submitted')
    .order('bundle_version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (!row) throw new Error(`No submitted evidence to approve for ${productId}`)

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('product_evidence')
    .update({
      review_status: 'approved',
      reviewed_at: now,
      approved_at: now,
      reviewed_by: REVIEWED_BY,
      reviewer_notes: 'Pipeline validation V2.3.4 — auto-approved',
    })
    .eq('evidence_id', row.evidence_id)
  if (error) throw error

  await supabase
    .from('products')
    .update({ agent_status: 'evidence_approved' })
    .eq('product_id', productId)

  return row
}

async function approveLatestScoringInputs(supabase, productId) {
  const { data: row, error: fetchErr } = await supabase
    .from('scoring_inputs')
    .select('input_id')
    .eq('product_id', productId)
    .eq('review_status', 'submitted')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (!row) throw new Error(`No submitted scoring_inputs to approve for ${productId}`)

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('scoring_inputs')
    .update({
      review_status: 'approved',
      reviewed_at: now,
      approved_at: now,
      reviewed_by: REVIEWED_BY,
      reviewer_notes: 'Pipeline validation V2.3.4 — auto-approved',
    })
    .eq('input_id', row.input_id)
  if (error) throw error

  await supabase
    .from('products')
    .update({ agent_status: 'normalization_approved' })
    .eq('product_id', productId)

  return row
}

function formatValidationReport(result) {
  const lines = [
    '',
    '═'.repeat(72),
    `VALIDATION: ${result.product_name}`,
    '═'.repeat(72),
    '',
    '--- Agent 1: certifications_verified ---',
  ]

  const certs = result.agent1?.packet?.agent_metadata?.certifications_verified ?? []
  if (!certs.length) {
    lines.push('(none)')
  } else {
    lines.push(formatCertificationsVerified(certs))
  }

  lines.push('', '--- Agent 2: layer_4a_verified + layer_4b ---')
  const inputs = result.agent2?.inputs
  if (inputs?.layer_4a_verified?.length) {
    for (const row of inputs.layer_4a_verified) {
      lines.push(
        `  · ${row.adjustment ?? row.certification_found ?? '—'} [${row.matched ? 'MATCH' : 'NO'}] ${row.action_taken ?? ''} → ${row.value ?? row.awarded_value ?? 0}`,
      )
    }
  } else {
    lines.push('  (no layer_4a_verified rows)')
  }
  lines.push(`  net_adjustment: ${inputs?.layer_4a?.net_adjustment ?? 0}`)
  lines.push(`  unknown_coating_cap: ${inputs?.layer_4a?.unknown_coating_cap_applies ?? false}`)
  lines.push(
    `  layer_4b (model): ${inputs?.layer_4b?.transparency_badge ?? '—'} CI ${inputs?.layer_4b?.confidence_interval ?? '—'}`,
  )

  lines.push('', '--- Agent 3: V2.3.4 score + badge + CI ---')
  const score = result.agent3?.result
  if (score) {
    lines.push(`  PAC Safety Score: ${score.pac_safety_score} (${score.tier})`)
    lines.push(`  transparency_badge: ${score.transparency_badge}`)
    lines.push(`  confidence_interval: ${score.confidence_interval}`)
    lines.push(`  displayed_confidence_range: ${score.displayed_confidence_range ?? '(none — Full Disclosed)'}`)
    if (score.layer_4b?.badge_justification) {
      lines.push(`  badge_justification: ${score.layer_4b.badge_justification}`)
    }
    lines.push('', '  explanation_draft (first 400 chars):')
    lines.push(`  ${String(score.explanation_draft ?? '').slice(0, 400)}…`)
  } else {
    lines.push(`  FAILED: ${result.agent3?.reason ?? 'unknown'}`)
  }

  lines.push('', '--- Agent 4: QA report ---')
  if (result.agent4?.report) {
    lines.push(formatQaReport(result.agent4.report))
  } else {
    lines.push(`  FAILED: ${result.agent4?.reason ?? 'unknown'}`)
  }

  return lines.join('\n')
}

async function runPipelineForProduct(productName) {
  const supabase = createServiceClient()
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('product_name', productName)
    .single()
  if (error) throw error

  console.log(`\n${'▓'.repeat(60)}\n  PIPELINE: ${productName}\n${'▓'.repeat(60)}`)

  const result = { product_name: productName, product_id: product.product_id }

  console.log('\n[1/4] Agent 1 — evidence research…')
  result.agent1 = await runAgent1({ productId: product.product_id })
  if (!result.agent1.ok) {
    result.error = 'Agent 1 failed threshold or API error'
    return result
  }

  await approveLatestEvidence(supabase, product.product_id)
  console.log('  → evidence approved, agent_status evidence_approved')

  console.log('\n[2/4] Agent 2 — normalization…')
  result.agent2 = await runAgent2({ productId: product.product_id })
  if (!result.agent2.ok) {
    result.error = result.agent2.reason ?? 'Agent 2 failed'
    return result
  }

  await approveLatestScoringInputs(supabase, product.product_id)
  console.log('  → scoring_inputs approved, agent_status normalization_approved')

  console.log('\n[3/4] Agent 3 — scoring…')
  result.agent3 = await runAgent3({ productId: product.product_id })
  if (!result.agent3.ok) {
    result.error = result.agent3.reason ?? 'Agent 3 failed'
    return result
  }

  await supabase
    .from('products')
    .update({ agent_status: 'scoring_review_pending' })
    .eq('product_id', product.product_id)

  console.log('\n[4/4] Agent 4 — QA…')
  result.agent4 = await runAgent4({
    productId: product.product_id,
    replaceExisting: true,
  })
  if (!result.agent4.ok) {
    result.error = result.agent4.reason ?? 'Agent 4 failed'
    return result
  }

  result.reportText = formatValidationReport(result)
  return result
}

async function main() {
  const allResults = []
  const reports = []

  for (const name of VALIDATION_PRODUCTS) {
    try {
      const result = await runPipelineForProduct(name)
      allResults.push(result)
      reports.push(formatValidationReport(result))
    } catch (err) {
      allResults.push({ product_name: name, error: err.message })
      reports.push(`\nFAILED ${name}: ${err.message}\n`)
    }
  }

  const combined = reports.join('\n\n')
  console.log('\n\n' + combined)

  const outDir = join(projectRoot, 'scripts/output')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'pipeline-validate-three.json')
  writeFileSync(outPath, JSON.stringify(allResults, null, 2), 'utf8')
  const txtPath = join(outDir, 'pipeline-validate-three.txt')
  writeFileSync(txtPath, combined, 'utf8')
  console.log(`\nWrote ${outPath}`)
  console.log(`Wrote ${txtPath}`)

  const failed = allResults.filter((r) => r.error)
  if (failed.length) process.exit(2)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
