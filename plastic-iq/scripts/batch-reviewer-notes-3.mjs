#!/usr/bin/env node
import { connectPgClient } from './lib/pg-connect.mjs'

/** @type {{ match: string; notes: string }[]} */
const BATCH = [
  {
    match: 'T-Fal Ultimate Hard Anodized',
    notes:
      'Agent 2: T-Fal Cookware Commitments page confirms PTFE, PFA, and FEP (PFAS under AB 1200 / CO HB 1345). Amazon toxin-free marketing contradicts manufacturer disclosure — flag on product page. Expect very low cookware score (High Risk / low Concern). Target/Walmart URL pack-size mismatches are data errors only.',
  },
  {
    match: 'Viking 8 Piece Stainless',
    notes:
      'Agent 2: 304 stainless primary contact confirmed; AB 1200 composition disclosed (Fe, Cr, Ni, Mn). No coatings or plastic. PFAS disclosure on Viking site applies to nonstick cookware only, not this set. Among cleanest utensil scores (with Berglander).',
  },
  {
    match: 'YETI Rambler 26oz',
    notes:
      'Agent 2: 18/8 stainless food contact confirmed. Lead vacuum sealing bead disclosed but encapsulated — do not penalize as food-contact material; YETI cites non-detect at food-contact surface. DuraCoat exterior proprietary; PFAS status unknown but low contact intimacy (~0.10). Cap polymers and gasket undisclosed.',
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
      returning p.product_name
      `,
      [match, notes],
    )
    if (!rows.length) console.error('SKIP:', match)
    else console.log('Notes set:', rows[0].product_name)
  }
} finally {
  await client.end()
}
