#!/usr/bin/env node
import { connectPgClient } from './lib/pg-connect.mjs'

/** @type {{ match: string; notes: string }[]} */
const BATCH = [
  {
    match: 'BlenderBottle Strada',
    notes:
      'Agent 2: Lid gasket material not confirmed by manufacturer. Lid plastic resin type beyond BPA/phthalate-free not confirmed — flag and apply confidence penalty.',
  },
  {
    match: 'Blueland Powder Dish Soap',
    notes:
      'Agent 2: Strong formulation evidence. Silicone shaker confirmed BPA-free but food-grade specification not explicitly confirmed — note if scoring contact components.',
  },
  {
    match: 'Branch Basics Multi Purpose',
    notes:
      'Agent 2: Refill bottle plastic resin type not confirmed (HDPE vs PET). Ingredient list discrepancy across sources — manufacturer page is authoritative. General-purpose concentrate, not dedicated dish soap.',
  },
  {
    match: 'CamelBak Chute Mag',
    notes:
      'Agent 2: Cap/lid gasket must use Contact Intimacy 0.30 (indirect), never 1.0. Gasket material inferred as silicone from third-party sellers, not confirmed by CamelBak. CamelBak explicitly states BPS and BPF free (not only BPA) — consider partial Layer 4A positive adjustment.',
  },
  {
    match: 'Glasslock Tempered Glass',
    notes:
      'Agent 2: PP lid grade and silicone gasket grade not disclosed — confidence penalty. FDA approved claim is retailer-confirmed only, not certification verified.',
  },
  {
    match: 'GreenPan Valencia Pro',
    notes:
      'Agent 2: Do NOT assign NSF certification credit to Valencia Pro — NSF confirmed for Thermolon 9G on Reserve Pro only, NOT Thermolon Minerals Pro on Valencia Pro. Coating partially disclosed (proprietary sol-gel); careful normalization and Unknown Coating Cap assessment.',
  },
  {
    match: 'HexClad Hybrid',
    notes:
      'Agent 2: Highest complexity in catalog. PTFE-to-TerraBond (2024) transition documented; class action (2022–2024 misleading claims) relevant context. HDPE in TerraBond unconfirmed. PFAS Non-Detect testing not fully verifiable. Requires careful normalization; mandatory human review after scoring before publish.',
  },
  {
    match: 'Joseph Joseph Elevate',
    notes:
      'Agent 2: California Prop 65 warning documented — significant for nylon hot-food utensils. BPA-free claim sourced only from customer service, not official product docs. Score nylon heads + silicone handles as separate components.',
  },
  {
    match: 'Kikcoin',
    notes:
      'Agent 2: Finishing treatment unknown (bare teak vs oiled vs lacquered) — reflect in Transparency Badge and confidence interval. Facts largely from Amazon listing; no manufacturer product page.',
  },
  {
    match: 'Klean Kanteen TKWide',
    notes:
      'Agent 2: Strongest drinkware certification profile in set (B Corp, Intertek recycled steel, GreenScreen Klean Coat, no lead plug). PP #5 cap and silicone gaskets from maintenance docs confirmed. Use as positive reference where certifications apply.',
  },
]

const client = await connectPgClient()
try {
  for (const { match, notes } of BATCH) {
    const { rows } = await client.query(
      `
      update public.product_evidence pe
      set reviewer_notes = $2, updated_at = now()
      from public.products p
      where pe.product_id = p.product_id
        and p.product_name ilike '%' || $1 || '%'
        and pe.review_status = 'approved'
        and pe.bundle_version = (
          select max(pe2.bundle_version)
          from public.product_evidence pe2
          where pe2.product_id = pe.product_id
            and pe2.review_status = 'approved'
        )
      returning p.product_name, pe.bundle_version
      `,
      [match, notes],
    )
    if (!rows.length) console.error('SKIP:', match)
    else console.log('Notes set:', rows[0].product_name)
  }
} finally {
  await client.end()
}
