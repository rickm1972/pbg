#!/usr/bin/env node
/**
 * Phase 5 regression report — read-only validation metadata.
 */
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../src/lib/apr/publishedBaselineIds.ts'
import {
  loadPublishedDisplaySnapshot,
  loadPublishedBaselineSnapshotImmutable,
} from '../src/lib/apr/publishedBaselineRegistry.ts'
import { mergePublishedRenderPayload } from '../src/lib/apr/publishedRenderPayload.ts'
import { validateRemediatedSnapshot } from '../src/lib/apr/lowScoreRemediation.ts'
import { createServiceClient } from './agent1/supabase.mjs'
import {
  loadApprovedPublishedScoreTruth,
  assertPublishedSnapshotMatchesApprovedTruth,
} from '../src/lib/apr/approvedPublishedTruth.ts'
import { resolvePublicReviewDate } from '../src/lib/apr/publicReviewStamp.ts'

const PRODUCTS = [
  ['Lodge 10.25 Inch Cast Iron Skillet', PUBLISHED_BASELINE_PRODUCT_IDS.lodge],
  [
    'All-Clad G5 Graphite Core Stainless-Steel Fry Pan with Lid, 12 inch',
    PUBLISHED_BASELINE_PRODUCT_IDS.allClad,
  ],
  ['Caraway Nonstick Ceramic Frying Pan 10.5 Inch', PUBLISHED_BASELINE_PRODUCT_IDS.caraway],
  [
    'T-Fal Ultimate Hard Anodized Nonstick Fry Pan Set 3 Piece',
    PUBLISHED_BASELINE_PRODUCT_IDS.tfal,
  ],
]

function classifyDescription(name, text) {
  if (!text?.trim()) return 'needs manual copy edit'
  const lower = text.toLowerCase()
  if (name.includes('T-Fal')) {
    if (lower.includes('contradicts') || lower.includes('non-toxic')) return 'needs manual copy edit'
    if (lower.includes('ptfe') && lower.includes('methodology')) return 'strong'
    return 'acceptable'
  }
  if (name.includes('Caraway')) {
    if (/confirmed chemical hazard/i.test(text)) return 'needs manual copy edit'
    if (/disclosure gap|not fully disclosed|uncertainty/i.test(text)) return 'strong'
    return 'acceptable'
  }
  if (name.includes('Lodge') || name.includes('All-Clad')) {
    if (/cast iron|stainless steel/i.test(text) && /pac safety score|methodology/i.test(text))
      return 'strong'
    if (/food-contact|inert|no pfas/i.test(text)) return 'acceptable'
  }
  return 'acceptable'
}

const sb = createServiceClient()
const rows = []

for (const [name, id] of PRODUCTS) {
  const snap = loadPublishedDisplaySnapshot(id)
  const baseline = loadPublishedBaselineSnapshotImmutable(id)
  const render = mergePublishedRenderPayload(snap, [])
  const approved = await loadApprovedPublishedScoreTruth(sb, id)
  let truthOk = true
  try {
    assertPublishedSnapshotMatchesApprovedTruth(snap, approved)
  } catch {
    truthOk = false
  }
  const score = snap.score.pac_safety_score
  let gateStatus
  let publishReady
  if (score >= 75) {
    gateStatus = 'bypass (score >= 75)'
    publishReady = truthOk ? 'ready' : 'blocked (truth mismatch)'
  } else if (id === PUBLISHED_BASELINE_PRODUCT_IDS.tfal) {
    const gate = validateRemediatedSnapshot(snap, 'tfal')
    gateStatus = gate.applies ? (gate.ok ? 'applies — pass' : 'applies — fail') : 'bypass'
    publishReady = gate.ok && truthOk ? 'ready' : 'blocked'
  } else if (id === PUBLISHED_BASELINE_PRODUCT_IDS.caraway) {
    const gate = validateRemediatedSnapshot(snap, 'caraway')
    gateStatus = gate.applies ? (gate.ok ? 'applies — pass' : 'applies — fail') : 'bypass'
    publishReady = gate.ok && truthOk ? 'ready' : 'blocked'
  } else {
    gateStatus = 'applies — unknown low-score product'
    publishReady = 'blocked'
  }
  const sources = render.display.sources.filter((s) => s.public_source_eligible !== false)
  const groups = [...new Set(sources.map((s) => s.group))]
  const reviewDate = resolvePublicReviewDate(snap)

  rows.push({
    product: name,
    url: `http://localhost:5173/product/${id}`,
    product_id: id,
    snapshot_id: snap.snapshot_id,
    baseline_snapshot_id: baseline.snapshot_id,
    uses_durable_override: snap.snapshot_id !== baseline.snapshot_id,
    score: snap.score.pac_safety_score,
    tier: snap.score.tier,
    badge: snap.score.transparency_badge,
    approved_db_score: approved.pac_safety_score,
    approved_db_tier: approved.tier,
    listing_detail_score_match: approved.pac_safety_score === snap.score.pac_safety_score,
    truth_aligned: truthOk,
    review_date: reviewDate ?? 'unavailable',
    source_count_snapshot: sources.length,
    source_groups: groups.join(', '),
    source_labels: sources.map((s) => s.label).join(' | '),
    description_quality: classifyDescription(name, snap.display.product_description),
    low_score_gate_status: gateStatus,
    publish_readiness: publishReady,
  })
}

console.log('\n=== Phase 5 Product Regression Table ===\n')
for (const r of rows) {
  console.log(`Product: ${r.product}`)
  console.log(`  URL: ${r.url}`)
  console.log(`  product_id: ${r.product_id}`)
  console.log(`  snapshot_id: ${r.snapshot_id}`)
  console.log(`  durable override: ${r.uses_durable_override ? 'yes' : 'no (baseline or same id)'}`)
  console.log(`  score/tier: ${r.score} / ${r.tier}`)
  console.log(`  badge: ${r.badge}`)
  console.log(`  approved DB score/tier: ${r.approved_db_score} / ${r.approved_db_tier}`)
  console.log(`  listing/detail score match: ${r.listing_detail_score_match ? 'yes' : 'NO'}`)
  console.log(`  truth aligned: ${r.truth_aligned ? 'yes' : 'NO'}`)
  console.log(`  review date: ${r.review_date}`)
  console.log(`  source count: ${r.source_count_snapshot}`)
  console.log(`  source groups: ${r.source_groups}`)
  console.log(`  source labels: ${r.source_labels}`)
  console.log(`  description quality: ${r.description_quality}`)
  console.log(`  low-score gate: ${r.low_score_gate_status}`)
  console.log(`  publish-readiness: ${r.publish_readiness}`)
  console.log('')
}

const allReady = rows.every((r) => r.publish_readiness === 'ready')
const allTruth = rows.every((r) => r.truth_aligned)
const allScores = rows.every((r) => r.listing_detail_score_match)
console.log(
  `Phase 5 metadata: publish-ready=${allReady}, truth-aligned=${allTruth}, score-match=${allScores}`,
)
