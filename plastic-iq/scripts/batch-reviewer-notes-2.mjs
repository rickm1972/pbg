#!/usr/bin/env node
import { connectPgClient } from './lib/pg-connect.mjs'

/** @type {{ match: string; notes: string }[]} */
const BATCH = [
  {
    match: 'Meliora Dish Soap Bar',
    notes:
      'Agent 2: Strongest formulation product in database. MADE SAFE, B Corp, Leaping Bunny verified. Full INCI from manufacturer; fragrance/preservative/dye/palm-oil-free confirmed. SDS exists on mfr page but PDF not retrieved — minor gap only.',
  },
  {
    match: 'Nalgene Sustain',
    notes:
      'Agent 2: Tritan Renew with ISCC PLUS recycled content — certification is Eastman’s, not Nalgene’s. Tritan Renew still scores as Tritan copolyester; recycled content does not reduce material hazard. Specific Tritan grade undisclosed — cannot confirm NSF at product level. Cap dishwasher conflict US vs Canada FAQ flagged.',
  },
  {
    match: 'Owala FreeSip',
    notes:
      'Agent 2: 18/8 stainless confirmed only from B2B spec sheets (lower confidence than typical). Tritan lid/straw secondary. Gasket material unknown (inferred from reviews) — confidence penalty. Prop 65 on some reseller pages only. Reflect lower stainless confidence and gasket unknown in badge.',
  },
  {
    match: 'OXO Good Grips 6 Piece Stainless',
    notes:
      'Agent 2: Stainless primary contact confirmed. Handle material Santoprene TPE inferred from brand pattern, not confirmed for this SKU — score handle separately with inferred-from-category-pattern confidence. AB 1200 compliance confirmed.',
  },
  {
    match: 'Puracy Natural Liquid Dish Soap',
    notes:
      'Agent 2: Fresh Citrus specific full INCI not fully captured — verify before final publish. Benzisothiazolinone present (synthetic preservative, EWG concerns). Leaping Bunny and PETA verified; EWG A for line not Fresh Citrus SKU specifically.',
  },
  {
    match: 'Pyrex Simply Store',
    notes:
      'Agent 2: Tempered soda-lime glass (not borosilicate since 1998) — Hazard 0.02 similar but note material in copy. BPA-free lid claim self-declared only; lid polymer resin undisclosed. Walmart URL data error flagged.',
  },
  {
    match: 'Rubbermaid Brilliance Glass Storage',
    notes:
      'Agent 2: Soda-lime tempered glass confirmed (not borosilicate). StainShield lid plastic BPA-free but resin proprietary/undisclosed. Gasket in airtight seal undisclosed. Widen confidence interval; Unknown Coating Cap likely N/A for storage lid.',
  },
  {
    match: 'Rubbermaid Brilliance Plastic Food Storage',
    notes:
      'Agent 2: Tritan primary; Eastman EA/AA-free and bisphenol-free testing documented. Styrene-butadiene copolymer gasket from 2016 third-party analysis only — score SBC as secondary component. StainShield vs Tritan naming inconsistency across retailers flagged.',
  },
  {
    match: 'Seventh Generation Free and Clear',
    notes:
      'Agent 2: Full INCI with Benzisothiazolinone and Methylisothiazolinone (MIT/BIT) disclosed. EPA Safer Choice, Leaping Bunny, B Corp verified. PCR bottle/cap confirmed. Brand is Unilever subsidiary — note for product page copy only, not score.',
  },
  {
    match: 'AOTHOD',
    notes:
      'Agent 2: Weakest evidence in batch. Food-grade silicone from Amazon only; cure type (platinum vs peroxide) unknown. No FDA 177.2600, LFGB, NSF, or SGS. Stainless core grade unspecified. Assign Limited Disclosure badge, wide confidence interval; score as unverified food-grade silicone not verified food-grade.',
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
