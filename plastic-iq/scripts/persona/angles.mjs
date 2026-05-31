/**
 * Research angles for Stage 1 (Perplexity Sonar Pro).
 * Each angle returns compact source-backed excerpts with URLs.
 */

export const PERSONA_RESEARCH_ANGLES = [
  {
    id: 'demographic_market',
    label: 'Demographics & market',
    sourceGuidance:
      'Authoritative: census summaries, market research firms, Pew, Nielsen-style reports, government stats.',
    focus: `Demographic and market data for this buyer segment: age range, gender skew, location type (urban/suburban/rural), household income bands, family/household composition, segment size signals, and category spend.`,
  },
  {
    id: 'health_nontoxic',
    label: 'Health & non-toxic behavior',
    sourceGuidance:
      'Authoritative: CDC, NIH, EWG-style guides, peer-reviewed summaries, reputable health orgs.',
    focus: `Health and non-toxic consumer behavior: what they worry about, how they research product safety, typical behaviors (avoiding plastic, reading labels), and motivations around chemicals in household products.`,
  },
  {
    id: 'category_buying',
    label: 'Category buying (kitchen / household)',
    sourceGuidance:
      'Authoritative: retail/category reports, consumer surveys, trade press; include kitchen/household product purchase patterns.',
    focus: `Category buying behavior for kitchen and household products: what they buy, when they replace items, price sensitivity, brands they consider, and purchase triggers in this category.`,
  },
  {
    id: 'pac_awareness',
    label: 'PAC / plastic-chemical awareness',
    sourceGuidance:
      'Authoritative: EPA, FDA consumer pages, scientific outreach, reputable NGOs on plastics/BPA/PFAS/phthalates.',
    focus: `Awareness of plastic-associated chemicals (phthalates, BPA, PFAS, microplastics): what they already know, common misconceptions, and how literacy varies in this segment.`,
  },
  {
    id: 'voice_of_customer',
    label: 'Voice of customer',
    sourceGuidance:
      'Real-talk only: Reddit, parenting forums, Amazon reviews, Facebook groups, Quora — prioritize authentic quotes and recurring themes.',
    focus: `Voice of customer from forums, Reddit, reviews, and social: how they talk about kitchen safety, plastics, swaps, overwhelm, and brands. Include paraphrased or quoted language patterns.`,
  },
  {
    id: 'objections_trust',
    label: 'Objections, barriers & trust',
    sourceGuidance: `REAL CUSTOMER VOICE ONLY — no exceptions:
- Reddit (parenting, non-toxic, zero-waste, BuyItForLife, etc.), BabyCenter, What to Expect, Amazon verified reviews, Facebook parenting groups, Quora threads from actual buyers.
- Every excerpt must reflect how real buyers in this demographic/category express objections, barriers, trust concerns, or confusion about certifications — in their own words or clear paraphrase.
- EXPLICITLY EXCLUDE: generic sales training, sales coaching, "how to handle objections," B2B sales blogs, real-estate sales tips, CRM/vendor sales content, and any material not specific to this target segment and kitchen/non-toxic household buying.
- If you cannot find segment-specific buyer voice, return fewer excerpts — do not pad with sales-technique articles.`,
    focus: `Objections, barriers, trust, and certification literacy as expressed by actual buyers (forums, reviews, social): price/skepticism, greenwashing fatigue, "BPA-free" distrust, proof needed, certification confusion, and what stops them from switching kitchen/household products.`,
  },
]

export function buildAngleUserPrompt(angle, targetSegment) {
  const vocOnly =
    angle.id === 'objections_trust'
      ? '\nIMPORTANT: Every excerpt MUST use source_type "voc". Do not cite sales-training or B2B sales websites.\n'
      : ''
  return `Target buyer segment to research:
"${targetSegment}"

Research angle: ${angle.label}
${angle.focus}

Source rules: ${angle.sourceGuidance}
${vocOnly}
Return ONLY valid JSON (no markdown fences) with this shape:
{
  "excerpts": [
    {
      "claim": "compact factual or VOC paraphrase grounded in a source",
      "url": "https://...",
      "source_title": "short label for the page or thread",
      "source_type": "authoritative" | "voc"
    }
  ]
}

Rules:
- 4–12 excerpts maximum; each must have a real URL you used.
- Do not invent statistics, quotes, or URLs.
- If evidence is thin for this angle, return fewer excerpts rather than guessing.`
}

export const RETRIEVAL_SYSTEM_PROMPT = `You are a research assistant for PlasticBegone buyer persona development.
Search the web and return compact, source-backed excerpts only.
Never fabricate URLs, quotes, or statistics.
Prefer recent, credible sources for factual claims; use forums/reviews/social only when the angle calls for voice-of-customer.`
