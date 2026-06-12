#!/usr/bin/env node
/**
 * Post-migration DB verification for managed taxonomy (read-only).
 */
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv } from './lib/env.mjs'
const KITCHEN_CATEGORY_ID = 'a1111111-1111-4111-8111-111111111101'
const KITCHEN_SUBCATEGORY_IDS = {
  water_bottles: 'a1111111-1111-4111-8111-111111111204',
  drinkware: 'a1111111-1111-4111-8111-111111111205',
}

async function main() {
  const client = await connectPgClient(loadEnv())
  try {
    const tables = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('product_categories', 'product_subcategories', 'product_claim_intake')
      order by table_name
    `)
    console.log('=== Tables ===')
    console.log(tables.rows.map((r) => r.table_name).join(', '))

    const productCols = await client.query(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products'
        and column_name in ('category', 'subcategory', 'category_id', 'subcategory_id', 'pac_safety_score', 'tier')
      order by column_name
    `)
    console.log('\n=== products columns ===')
    console.log(productCols.rows.map((r) => r.column_name).join(', '))

    const checkGone = await client.query(`
      select conname
      from pg_constraint
      where conrelid = 'public.products'::regclass
        and conname = 'products_category_allowed'
    `)
    console.log('\n=== products_category_allowed CHECK ===')
    console.log(checkGone.rows.length === 0 ? 'removed (OK)' : 'still present (unexpected)')

    const categories = await client.query(
      `select category_id, name, slug, is_archived from public.product_categories order by display_order`,
    )
    console.log('\n=== product_categories ===')
    console.log(JSON.stringify(categories.rows, null, 2))

    const subcategories = await client.query(
      `select subcategory_id, name, slug, default_severity, default_duration, defaults_status, defaults_source
       from public.product_subcategories
       where category_id = $1
       order by display_order`,
      [KITCHEN_CATEGORY_ID],
    )
    console.log('\n=== Kitchen subcategories ===')
    console.log(JSON.stringify(subcategories.rows, null, 2))

    const wbDw = await client.query(
      `select subcategory_id, name from public.product_subcategories
       where subcategory_id in ($1, $2)`,
      [KITCHEN_SUBCATEGORY_IDS.water_bottles, KITCHEN_SUBCATEGORY_IDS.drinkware],
    )
    console.log('\n=== Water Bottles vs Drinkware (separate rows) ===')
    console.log(JSON.stringify(wbDw.rows, null, 2))

    const backfill = await client.query(`
      select
        count(*) filter (where category_id is not null) as with_category_fk,
        count(*) filter (where subcategory_id is not null) as with_subcategory_fk,
        count(*) as total_products
      from public.products
    `)
    console.log('\n=== FK backfill counts ===')
    console.log(JSON.stringify(backfill.rows[0], null, 2))

    const publishedBefore = await client.query(`
      select product_id, product_name, brand, category, subcategory,
             category_id, subcategory_id, pac_safety_score, tier, publish_status, is_archived
      from public.products
      where publish_status = 'published'
      order by product_name
    `)
    console.log('\n=== Published products (score/tier/publish/FK) ===')
    console.log(JSON.stringify(publishedBefore.rows, null, 2))

    const canonical = await client.query(`
      select product_id, product_name, pac_safety_score, tier, publish_status,
             category, subcategory, category_id, subcategory_id, is_archived
      from public.products
      where product_id in (
        '1cf2fa4e-5cdd-4798-8f3c-6c273ae69fa8',
        'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5',
        '7a457a86-ab62-4cbf-90b9-ccaeafe06896'
      )
      order by product_name
    `)
    console.log('\n=== Canonical published cookware (Lodge/HexClad/All-Clad) ===')
    console.log(JSON.stringify(canonical.rows, null, 2))

    const archivedVisible = await client.query(`
      select count(*) as archived_count,
             count(*) filter (where is_archived = true) as is_archived_true
      from public.products
      where is_archived = true
    `)
    console.log('\n=== Archived rows ===')
    console.log(JSON.stringify(archivedVisible.rows[0], null, 2))

    const adminVisible = await client.query(`
      select count(*) as admin_visible
      from public.products
      where is_archived is null or is_archived = false
    `)
    console.log('\n=== Admin-visible (non-archived) product count ===')
    console.log(JSON.stringify(adminVisible.rows[0], null, 2))

    const scoringUnchanged = await client.query(`
      select count(*) as product_scores_rows from public.product_scores
    `)
    const scoringInputs = await client.query(`
      select count(*) as scoring_inputs_rows from public.scoring_inputs
    `)
    console.log('\n=== scoring_inputs / product_scores row counts (unchanged check) ===')
    console.log(
      JSON.stringify(
        { product_scores: scoringUnchanged.rows[0].product_scores_rows, scoring_inputs: scoringInputs.rows[0].scoring_inputs_rows },
        null,
        2,
      ),
    )

    const lockedCounts = await client.query(`
      select
        (select count(*) from public.agent1_locked_inputs) as agent1_locked_inputs,
        (select count(*) from public.agent3_locked_outputs) as agent3_locked_outputs,
        (select count(*) from public.agent4_locked_audits) as agent4_locked_audits,
        (select count(*) from public.locked_snapshot_drafts) as locked_snapshot_drafts
    `)
    console.log('\n=== Locked pipeline row counts ===')
    console.log(JSON.stringify(lockedCounts.rows[0], null, 2))
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
