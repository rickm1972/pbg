#!/usr/bin/env node
/**
 * Backfill frozen published display snapshots from approved DB/Gate truth.
 * Does NOT run agents, publish, or mutate gate records — writes JSON baselines only.
 *
 * Run: npm run backfill:published-snapshots
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServiceClient, fetchProductById } from './agent1/supabase.mjs'
import {
  buildPublishedSnapshotFromApprovedTruth,
  loadApprovedPublishedScoreTruth,
  PUBLISHED_BASELINE_SPECS,
} from '../src/lib/apr/approvedPublishedTruth.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'src/lib/apr/published-baselines')
const PUBLISHED_AT = '2026-06-02T00:00:00.000Z'

mkdirSync(outDir, { recursive: true })

const sb = createServiceClient()
const manifest = []
const beforeAfter = []

for (const spec of PUBLISHED_BASELINE_SPECS) {
  const jsonPath = join(outDir, `${spec.slug}.json`)
  let before = null
  if (existsSync(jsonPath)) {
    before = JSON.parse(readFileSync(jsonPath, 'utf8'))
  }

  const product = await fetchProductById(sb, spec.product_id)
  if (!product) {
    throw new Error(`Product not found for baseline ${spec.slug}: ${spec.product_id}`)
  }

  const approved = await loadApprovedPublishedScoreTruth(sb, spec.product_id)
  const record = await buildPublishedSnapshotFromApprovedTruth(sb, product, approved, {
    published_at: PUBLISHED_AT,
    snapshot_id: `baseline-${spec.slug}`,
  })

  writeFileSync(jsonPath, JSON.stringify(record, null, 2) + '\n')
  manifest.push({
    product_id: spec.product_id,
    slug: spec.slug,
    snapshot_id: record.snapshot_id,
    content_hash: record.content_hash,
    file: `published-baselines/${spec.slug}.json`,
    approved_score_source: approved.source,
  })

  beforeAfter.push({
    slug: spec.slug,
    before: before
      ? {
          score: before.score?.pac_safety_score,
          tier: before.score?.tier,
          range: before.score?.displayed_confidence_range,
          badge: before.score?.transparency_badge,
          content_hash: before.content_hash,
          risk_bars: before.display?.risk_bars,
        }
      : null,
    after: {
      score: record.score.pac_safety_score,
      tier: record.score.tier,
      range: record.score.displayed_confidence_range,
      badge: record.score.transparency_badge,
      content_hash: record.content_hash,
      risk_bars: record.display.risk_bars,
    },
    approved_source: approved.source,
  })

  console.log(
    `✓ ${spec.slug} → score ${record.score.pac_safety_score} (${approved.source}) hash ${record.content_hash.slice(0, 16)}…`,
  )
}

writeFileSync(
  join(outDir, 'manifest.json'),
  JSON.stringify({ version: '0.25.0', published_at: PUBLISHED_AT, baselines: manifest }, null, 2) +
    '\n',
)

console.log('\nBackfilled 4 published display baseline snapshots from approved DB truth.')
console.log(JSON.stringify(beforeAfter, null, 2))
