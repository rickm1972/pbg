#!/usr/bin/env node
/**
 * Phase A — read-only duplicate Lodge/HexClad product diagnosis.
 * No mutations. Run: npx tsx scripts/locked-pipeline/report-duplicate-product-records.mjs
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectPgClient } from '../lib/pg-connect.mjs'
import { loadEnv } from '../lib/env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../..')

const CANONICAL_LIVE = {
  lodge: '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8',
  hexclad: 'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5',
}
const LOCKED_FIXTURE_IDS = new Set([
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
])

const REF_TABLES = [
  { table: 'published_display_snapshots', col: 'product_id', live: true },
  { table: 'product_evidence', col: 'product_id', live: false },
  { table: 'scoring_inputs', col: 'product_id', live: false },
  { table: 'product_scores', col: 'product_id', live: false },
  { table: 'product_qa', col: 'product_id', live: false },
  { table: 'agent1_proposed_inputs', col: 'product_id', live: false },
  { table: 'agent1_system_validations', col: 'product_id', live: false },
  { table: 'agent1_locked_inputs', col: 'product_id', live: false },
  { table: 'agent3_locked_outputs', col: 'product_id', live: false },
  { table: 'agent4_locked_audits', col: 'product_id', live: false },
  { table: 'locked_snapshot_drafts', col: 'product_id', live: false },
  { table: 'product_commerce_links', col: 'product_id', live: true },
  { table: 'score_details', col: 'product_id', live: false },
]

function loadDurablePublishedIds() {
  const ids = new Set()
  try {
    const manifest = JSON.parse(
      readFileSync(join(root, 'src/lib/apr/durable-approved/manifest.json'), 'utf8'),
    )
    for (const pid of Object.keys(manifest.latest_by_product ?? {})) ids.add(pid)
    for (const v of manifest.versions ?? []) {
      if (v.product_id) ids.add(v.product_id)
    }
  } catch {
    /* optional */
  }
  return ids
}

function likelyOrigin(row) {
  if (row.product_id === CANONICAL_LIVE.lodge || row.product_id === CANONICAL_LIVE.hexclad) {
    return 'canonical live catalog product'
  }
  if (LOCKED_FIXTURE_IDS.has(row.product_id)) {
    return 'locked-pipeline deterministic fixture ID (code constant)'
  }
  if (row.pac_safety_score === 42 && row.tier === 'Caution') {
    return 'Phase 8 test-locked-snapshot-draft.mjs smoke product (explicit 42/Caution sentinel)'
  }
  if (
    row.pac_safety_score == null &&
    row.tier == null &&
    row.publish_status === 'draft' &&
    !row.amazon_url &&
    !row.manufacturer_product_url
  ) {
    return 'Phase 6.7–8 DB smoke test (randomUUID product insert; likely leaked via migration COMMIT in test txn)'
  }
  return 'unknown — review manually'
}

function sourceMarker(row) {
  const parts = []
  if (LOCKED_FIXTURE_IDS.has(row.product_id)) parts.push('fixture_uuid_constant')
  if (row.product_id === CANONICAL_LIVE.lodge) parts.push('live_lodge')
  if (row.product_id === CANONICAL_LIVE.hexclad) parts.push('live_hexclad')
  if (row.pac_safety_score === 42) parts.push('score_42_sentinel')
  if (row.agent1_source_notes) parts.push(`agent1_source_notes:${row.agent1_source_notes}`)
  return parts.length ? parts.join('; ') : '—'
}

async function tableExists(db, table) {
  const r = await db.query(`select to_regclass($1) as t`, [`public.${table}`])
  return Boolean(r.rows[0]?.t)
}

async function countRefs(db, table, col, productId) {
  if (!(await tableExists(db, table))) return null
  const r = await db.query(
    `select count(*)::int as n from public.${table} where ${col} = $1`,
    [productId],
  )
  return r.rows[0].n
}

const client = await connectPgClient(loadEnv())
const durableIds = loadDurablePublishedIds()

try {
  const cols = await client.query(`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'products'
    order by ordinal_position
  `)
  const productCols = new Set(cols.rows.map((r) => r.column_name))
  const hasAgentStatus = productCols.has('agent_status')
  const hasPublishStatus = productCols.has('publish_status')
  const hasMfrUrl = productCols.has('manufacturer_product_url')
  const hasAgent1Notes = productCols.has('agent1_source_notes')

  const products = await client.query(`
    select
      product_id,
      product_name,
      brand,
      category,
      subcategory,
      pac_safety_score,
      tier,
      ${hasPublishStatus ? 'publish_status' : 'null::text as publish_status'},
      ${hasAgentStatus ? 'agent_status' : 'null::text as agent_status'},
      date_added as created_at,
      date_last_updated as updated_at,
      amazon_url,
      ${hasMfrUrl ? 'manufacturer_product_url' : 'null::text as manufacturer_product_url'},
      ${hasAgent1Notes ? 'agent1_source_notes' : 'null::text as agent1_source_notes'},
      ${productCols.has('is_archived') ? 'is_archived' : 'false as is_archived'},
      active
    from public.products
    where (
      lower(coalesce(brand, '')) in ('lodge', 'hexclad')
      or lower(product_name) like '%lodge%cast iron%'
      or lower(product_name) like '%hexclad%hybrid%'
      or lower(product_name) like '%hexclad%nonstick%'
      or product_id = any($1::uuid[])
    )
    order by brand, date_added desc
  `, [[CANONICAL_LIVE.lodge, CANONICAL_LIVE.hexclad, ...LOCKED_FIXTURE_IDS]])

  const rows = products.rows
  const hasIsArchived = productCols.has('is_archived')
  const lodgeRows = rows.filter((r) => (r.brand ?? '').toLowerCase() === 'lodge')
  const hexRows = rows.filter((r) => (r.brand ?? '').toLowerCase() === 'hexclad')
  const visibleLodge = hasIsArchived ? lodgeRows.filter((r) => !r.is_archived) : lodgeRows
  const visibleHex = hasIsArchived ? hexRows.filter((r) => !r.is_archived) : hexRows

  console.log('=== DUPLICATE PRODUCT REPORT ===\n')
  console.log('Duplicate counts by product family (all rows in DB):')
  console.log(JSON.stringify({ lodge: lodgeRows.length, hexclad: hexRows.length, total: rows.length }, null, 2))
  if (hasIsArchived) {
    console.log('Admin-visible (non-archived) counts:')
    console.log(JSON.stringify({ lodge: visibleLodge.length, hexclad: visibleHex.length, total: visibleLodge.length + visibleHex.length }, null, 2))
  }
  console.log('')

  console.log('--- Part 1: All matching product rows ---')
  for (const row of rows) {
    console.log(
      JSON.stringify({
        product_id: row.product_id,
        name: row.product_name,
        brand: row.brand,
        score: row.pac_safety_score,
        tier: row.tier,
        publish_status: row.publish_status,
        agent_status: row.agent_status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        source_marker: sourceMarker(row),
        likely_origin: likelyOrigin(row),
        amazon_url: row.amazon_url ?? null,
        manufacturer_product_url: row.manufacturer_product_url ?? null,
      }),
    )
  }
  console.log('')

  // Part 2 — canonical
  async function canonicalReport(label, canonicalId) {
    const refs = {}
    for (const { table, col } of REF_TABLES) {
      refs[table] = await countRefs(client, table, col, canonicalId)
    }
    const pubActive = await tableExists(client, 'published_display_snapshots')
      ? (
          await client.query(
            `select count(*)::int as n from public.published_display_snapshots
             where product_id = $1 and is_active = true`,
            [canonicalId],
          )
        ).rows[0].n
      : null
    const product = rows.find((r) => r.product_id === canonicalId) ??
      (await client.query(`select * from public.products where product_id = $1`, [canonicalId])).rows[0]
    return {
      product: label,
      canonical_live_product_id: canonicalId,
      product_name: product?.product_name,
      pac_safety_score: product?.pac_safety_score,
      tier: product?.tier,
      publish_status: product?.publish_status,
      evidence_refs: refs.product_evidence,
      scoring_input_refs: refs.scoring_inputs,
      product_score_refs: refs.product_scores,
      qa_refs: refs.product_qa,
      published_snapshot_refs: refs.published_display_snapshots,
      published_snapshot_active: pubActive,
      commerce_link_refs: refs.product_commerce_links,
      durable_manifest: durableIds.has(canonicalId),
      locked_fixture_id: LOCKED_FIXTURE_IDS.has(canonicalId),
      why_canonical:
        label === 'Lodge'
          ? 'Active published_display_snapshots + durable lodge-approved.json + manifest latest_by_product'
          : 'Active published_display_snapshots + durable hexclad-approved.json + manifest latest_by_product',
    }
  }

  console.log('--- Part 2: Canonical / live product IDs ---')
  console.log(JSON.stringify(await canonicalReport('Lodge', CANONICAL_LIVE.lodge), null, 2))
  console.log(JSON.stringify(await canonicalReport('HexClad', CANONICAL_LIVE.hexclad), null, 2))
  console.log('')
  console.log(
    'Note: locked-pipeline code constants 000…001 (Lodge) and 000…002 (HexClad) are NOT live catalog IDs.',
  )
  console.log('')

  // Part 3 — reference map
  console.log('--- Part 3: Reference map per duplicate row ---')
  for (const row of rows) {
    const referencedBy = []
    let refCount = 0
    let liveRef = false

    for (const { table, col, live } of REF_TABLES) {
      const n = await countRefs(client, table, col, row.product_id)
      if (n == null) continue
      if (n > 0) {
        referencedBy.push(`${table}(${n})`)
        refCount += n
        if (live) liveRef = true
      }
    }
    if (durableIds.has(row.product_id)) {
      referencedBy.push('durable_published_manifest')
      liveRef = true
    }
    if (row.product_id === CANONICAL_LIVE.lodge || row.product_id === CANONICAL_LIVE.hexclad) {
      liveRef = true
    }

    const isCanonical =
      row.product_id === CANONICAL_LIVE.lodge || row.product_id === CANONICAL_LIVE.hexclad
    const safeCandidate =
      !liveRef &&
      !isCanonical &&
      refCount > 0 &&
      referencedBy.every(
        (r) =>
          r.startsWith('agent1_') ||
          r.startsWith('agent3_') ||
          r.startsWith('agent4_') ||
          r.startsWith('locked_snapshot') ||
          r.startsWith('product_evidence'),
      )
        ? 'maybe'
        : !liveRef && !isCanonical && refCount === 0
          ? 'maybe'
          : 'no'

    console.log(
      JSON.stringify({
        product_id: row.product_id,
        name: row.product_name,
        score: row.pac_safety_score,
        tier: row.tier,
        referenced_by: referencedBy.length ? referencedBy.join(', ') : 'none',
        reference_count: refCount,
        live_public_reference: liveRef ? 'yes' : 'no',
        safe_to_archive_candidate: safeCandidate,
        notes: isCanonical ? 'CANONICAL — do not archive' : likelyOrigin(row),
      }),
    )
  }
  console.log('')

  // Part 4 — 42/Caution
  console.log('--- Part 4: 42 / Caution rows ---')
  const cautionRows = rows.filter((r) => r.pac_safety_score === 42 && r.tier === 'Caution')
  for (const row of cautionRows) {
    const ps = await countRefs(client, 'product_scores', 'product_id', row.product_id)
    const a3 = await countRefs(client, 'agent3_locked_outputs', 'product_id', row.product_id)
    const pub = await countRefs(client, 'published_display_snapshots', 'product_id', row.product_id)
    console.log(
      JSON.stringify({
        product_id: row.product_id,
        name: row.product_name,
        score_tier: '42 / Caution',
        created_at: row.created_at,
        updated_at: row.updated_at,
        likely_origin_script: 'scripts/test-locked-snapshot-draft.mjs (smokeLodge/smokeHex with pac_safety_score:42)',
        product_scores_rows: ps,
        agent3_locked_outputs_rows: a3,
        published_snapshot_refs: pub,
        referenced_publicly: pub > 0 ? 'yes' : 'no',
        explanation:
          'Score/tier copied from products row at insert time (test sentinel), not from Agent 3 scoring or product_scores table',
      }),
    )
  }
  if (!cautionRows.length) console.log('(none found in matched set)')
  console.log('')

  console.log('--- Summary flags ---')
  console.log(
    JSON.stringify(
      {
        read_only: true,
        mutations: false,
        agents_run: false,
        canonical_lodge: CANONICAL_LIVE.lodge,
        canonical_hexclad: CANONICAL_LIVE.hexclad,
        lodge_duplicate_count: lodgeRows.length,
        hexclad_duplicate_count: hexRows.length,
        admin_visible_lodge: visibleLodge.length,
        admin_visible_hexclad: visibleHex.length,
        archived_debris_count: hasIsArchived ? rows.filter((r) => r.is_archived).length : null,
        rows_with_42_caution: cautionRows.length,
        rows_null_score: rows.filter((r) => r.pac_safety_score == null).length,
      },
      null,
      2,
    ),
  )
} finally {
  await client.end()
}
