#!/usr/bin/env node
/**
 * Read-only source completeness investigation for published baseline products.
 * Run: npx tsx scripts/investigate-public-sources.mjs
 */
import { createServiceClient, fetchProductById } from './agent1/supabase.mjs'
import { PUBLISHED_BASELINE_PRODUCT_IDS } from '../src/lib/apr/publishedBaselineIds.ts'
import { loadPublishedDisplaySnapshot } from '../src/lib/apr/publishedBaselineRegistry.ts'
import { buildGate1SourcesReview } from '../src/lib/gate1SourcesReview.ts'
import {
  buildPublicSourcesFromEvidence,
  resolvePublicSourceEligibility,
} from '../src/lib/publicSourceDisplay.ts'
import { buildPublicDisplayContract } from '../src/lib/publicProductDisplayContract.ts'

const PRODUCTS = [
  ['Lodge', PUBLISHED_BASELINE_PRODUCT_IDS.lodge],
  ['All-Clad', PUBLISHED_BASELINE_PRODUCT_IDS.allClad],
  ['Caraway', PUBLISHED_BASELINE_PRODUCT_IDS.caraway],
  ['T-Fal', PUBLISHED_BASELINE_PRODUCT_IDS.tfal],
]

async function rpcEvidencePack(sb, productId) {
  const { data, error } = await sb.rpc('get_product_evidence_display_pack', {
    p_product_id: productId,
  })
  if (error) {
    if (error.code === 'PGRST202' || /does not exist/i.test(error.message ?? '')) return null
    throw error
  }
  return data && typeof data === 'object' ? data : null
}

const sb = createServiceClient()

for (const [name, productId] of PRODUCTS) {
  const snapshot = loadPublishedDisplaySnapshot(productId)
  const product = await fetchProductById(sb, productId)
  const evidence = await rpcEvidencePack(sb, productId)

  const { data: peRow } = await sb
    .from('product_evidence')
    .select('evidence_id, review_status, sources, agent_metadata')
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: productRow } = await sb
    .from('products')
    .select('active_evidence_id, publish_status')
    .eq('product_id', productId)
    .maybeSingle()

  const gate1 = evidence ? buildGate1SourcesReview(evidence) : null
  const gate1FromDb = peRow ? buildGate1SourcesReview(peRow) : null
  const contract = product ? buildPublicDisplayContract(product, evidence) : null
  const agent2Public = evidence ? buildPublicSourcesFromEvidence(evidence, contract) : []

  const gate1RawCount = evidence?.sources?.length ?? 0
  const gate1RowCount = gate1?.allRows.length ?? 0
  const gate1PublicEligible = gate1
    ? gate1.allRows.filter((row) => {
        const e = resolvePublicSourceEligibility(row)
        return e.public_display && e.public_label && e.public_status
      })
    : []

  const snapshotSources = snapshot?.display.sources ?? []
  const snapshotEligible = snapshotSources.filter((s) => s.public_source_eligible !== false)

  console.log(`\n=== ${name} ===`)
  console.log(`product_id: ${productId}`)
  console.log(`latest-approved snapshot_id: ${snapshot?.snapshot_id ?? 'null'}`)
  console.log(`snapshot display.sources count: ${snapshotSources.length}`)
  console.log(`snapshot public-eligible count: ${snapshotEligible.length}`)
  console.log(
    `snapshot sources: ${snapshotEligible.map((s) => `${s.group}|${s.label}|${s.url}`).join(' ;; ') || '(none)'}`,
  )
  console.log(`products.active_evidence_id: ${productRow?.active_evidence_id ?? 'null'}`)
  console.log(`approved product_evidence row: ${peRow?.evidence_id ?? 'null'}`)
  console.log(`DB product_evidence.sources raw count: ${peRow?.sources?.length ?? 0}`)
  if (peRow?.sources?.length) {
    for (const s of peRow.sources) {
      console.log(`  - raw: type=${s.source_type} | ${s.title ?? s.url} | ${s.url}`)
    }
  }
  if (gate1FromDb) {
    const dbPublic = gate1FromDb.allRows.filter((row) => {
      const e = resolvePublicSourceEligibility(row)
      return e.public_display && e.public_label && e.public_status
    })
    console.log(`DB Gate1 public-eligible from approved evidence: ${dbPublic.length}`)
    for (const row of dbPublic) {
      const e = resolvePublicSourceEligibility(row)
      console.log(`  - ${e.public_label}: ${row.reviewerLabel} | ${row.url}`)
    }
    const dbHidden = gate1FromDb.allRows.filter((row) => {
      const e = resolvePublicSourceEligibility(row)
      return !(e.public_display && e.public_label && e.public_status)
    })
    console.log(`DB Gate1 hidden rows: ${dbHidden.length}`)
    for (const row of dbHidden) {
      const e = resolvePublicSourceEligibility(row)
      console.log(`  - hidden (${e.hide_reason ?? 'ineligible'}): ${row.reviewerLabel} | ${row.url}`)
    }
  }
  console.log(`RPC evidence pack present: ${evidence ? 'yes' : 'no'}`)
  console.log(`Gate 1 evidence.sources raw count: ${gate1RawCount}`)
  console.log(`Gate 1 review allRows count: ${gate1RowCount}`)
  console.log(`Gate 1 public-eligible rows: ${gate1PublicEligible.length}`)
  for (const row of gate1PublicEligible) {
    const e = resolvePublicSourceEligibility(row)
    console.log(
      `  - ${e.public_label}/${e.public_status}: ${row.reviewerLabel} | ${row.url} | section=${row.section}`,
    )
  }
  const gate1Ineligible = gate1
    ? gate1.allRows.filter((row) => {
        const e = resolvePublicSourceEligibility(row)
        return !(e.public_display && e.public_label && e.public_status)
      })
    : []
  console.log(`Gate 1 ineligible/hidden rows: ${gate1Ineligible.length}`)
  for (const row of gate1Ineligible) {
    const e = resolvePublicSourceEligibility(row)
    console.log(
      `  - hidden: ${row.reviewerLabel} | ${row.url} | reason=${e.hide_reason ?? 'not public_display'}`,
    )
  }
  console.log(`Agent 2/public assembly source count: ${agent2Public.length}`)
  for (const s of agent2Public) {
    console.log(`  - ${s.public_label}/${s.public_status}: ${s.title} | ${s.url}`)
  }
  console.log(
    `mismatch snapshot vs agent2 public: ${snapshotEligible.length} vs ${agent2Public.length}`,
  )
}
