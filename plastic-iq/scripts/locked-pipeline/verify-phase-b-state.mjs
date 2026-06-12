#!/usr/bin/env node
import { connectPgClient } from '../lib/pg-connect.mjs'
import { loadEnv } from '../lib/env.mjs'
import {
  countVisible42CautionProducts,
  countVisibleLodgeHexcladCatalogProducts,
  LIVE_HEXCLAD_PRODUCT_ID,
  LIVE_LODGE_PRODUCT_ID,
  snapshotCanonicalProductRow,
} from '../lib/locked-pipeline-smoke-db.mjs'

const client = await connectPgClient(loadEnv())
try {
  const lodge = await snapshotCanonicalProductRow(client, LIVE_LODGE_PRODUCT_ID)
  const hex = await snapshotCanonicalProductRow(client, LIVE_HEXCLAD_PRODUCT_ID)
  const visible = await countVisibleLodgeHexcladCatalogProducts(client)
  const caution = await countVisible42CautionProducts(client)
  const archived = await client.query(
    `select count(*)::int as n from public.products
     where coalesce(is_archived, false) = true
       and lower(coalesce(brand, '')) in ('lodge', 'hexclad')`,
  )
  const scores = await client.query(
    `select product_id, count(*)::int as n from public.product_scores
     where product_id = any($1::uuid[]) group by product_id`,
    [[LIVE_LODGE_PRODUCT_ID, LIVE_HEXCLAD_PRODUCT_ID]],
  )
  const inputs = await client.query(
    `select product_id, count(*)::int as n from public.scoring_inputs
     where product_id = any($1::uuid[]) group by product_id`,
    [[LIVE_LODGE_PRODUCT_ID, LIVE_HEXCLAD_PRODUCT_ID]],
  )
  const activeLodge = await client.query(
    `select distinct o.product_id
     from public.agent3_locked_outputs o
     join public.products p on p.product_id = o.product_id
     where lower(p.brand) = 'lodge' and o.review_status <> 'superseded'`,
  )
  const activeHex = await client.query(
    `select distinct o.product_id
     from public.agent3_locked_outputs o
     join public.products p on p.product_id = o.product_id
     where lower(p.brand) = 'hexclad' and o.review_status <> 'superseded'`,
  )
  console.log(
    JSON.stringify(
      {
        visible_lodge_hexclad_catalog: visible,
        visible_42_caution: caution,
        archived_lodge_hexclad_debris: archived.rows[0].n,
        canonical_lodge: lodge,
        canonical_hexclad: hex,
        product_scores_counts: scores.rows,
        scoring_inputs_counts: inputs.rows,
        active_agent3_locked_outputs: {
          lodge: activeLodge.rows.map((r) => r.product_id),
          hexclad: activeHex.rows.map((r) => r.product_id),
        },
      },
      null,
      2,
    ),
  )
} finally {
  await client.end()
}
