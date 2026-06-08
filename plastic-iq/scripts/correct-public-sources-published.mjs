#!/usr/bin/env node
/**
 * Restore full Gate-1 public-eligible sources into latest-approved snapshots (versioned).
 * Run: npm run correct:public-sources-published
 */
import { execSync } from 'node:child_process'
import { createServiceClient, fetchProductById } from './agent1/supabase.mjs'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../src/lib/apr/publishedBaselineIds.ts'
import { approveDisplaySourceCorrection } from '../src/lib/apr/displaySourceCorrection.ts'
import { loadApprovedPublishedScoreTruth } from '../src/lib/apr/approvedPublishedTruth.ts'

const REVIEWER = 'Rick'
const PRODUCTS = [
  { name: 'Lodge', id: PUBLISHED_BASELINE_PRODUCT_IDS.lodge, addDisclaimer: true },
  { name: 'All-Clad', id: PUBLISHED_BASELINE_PRODUCT_IDS.allClad, addDisclaimer: true },
  { name: 'Caraway', id: PUBLISHED_BASELINE_PRODUCT_IDS.caraway, addDisclaimer: false },
  { name: 'T-Fal', id: PUBLISHED_BASELINE_PRODUCT_IDS.tfal, addDisclaimer: false },
]

const sb = createServiceClient()
const results = []

for (const spec of PRODUCTS) {
  const product = await fetchProductById(sb, spec.id)
  if (!product) throw new Error(`Product not found: ${spec.name}`)

  const { data: peRow, error } = await sb
    .from('product_evidence')
    .select('evidence_id, review_status, sources, agent_metadata')
    .eq('product_id', spec.id)
    .eq('review_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!peRow?.sources?.length) {
    throw new Error(`${spec.name}: no approved product_evidence sources`)
  }

  const approved = await loadApprovedPublishedScoreTruth(sb, spec.id)
  const lastReviewedAt = approved.run_timestamp?.split('T')[0] ?? null

  const result = approveDisplaySourceCorrection({
    product,
    evidence: peRow,
    reviewer_id: REVIEWER,
    add_global_disclaimer: spec.addDisclaimer,
    last_reviewed_at: lastReviewedAt,
  })

  results.push({ name: spec.name, ...result })
  console.log(
    `${spec.name}: ${result.skipped ? 'skipped (already correct)' : 'corrected'} ` +
      `${result.previous_source_count} → ${result.corrected_source_count} sources ` +
      `(snapshot ${result.previous_snapshot_id} → ${result.new_snapshot_id})`,
  )
}

execSync('node scripts/sync-bundled-durable-snapshots.mjs', { stdio: 'inherit', cwd: process.cwd() })
console.log(JSON.stringify(results, null, 2))
