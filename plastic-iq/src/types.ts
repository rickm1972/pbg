export type ProductTier = 'Excellent' | 'Good' | 'Caution' | 'Concern' | 'High Risk'
export type ScoreBasis =
  | 'Lab Verified'
  | 'Based on Materials Science'
  | 'AI Estimated'
  | 'In Testing Queue'

export type Product = {
  product_id: string
  product_name: string
  brand: string | null
  category: string | null
  subcategory: string | null
  description: string | null
  pac_safety_score: number | null
  tier: ProductTier | null
  score_basis: ScoreBasis | null
  primary_material: string | null
  secondary_material: string | null
  bpa_free: 'Yes' | 'No' | 'Unknown' | null
  phthalate_free_claim: 'Yes' | 'No' | 'Unknown' | null
  amazon_asin: string | null
  amazon_url: string | null
  affiliate_link: string | null
  target_url: string | null
  walmart_url: string | null
  /** e.g. "Williams Sonoma" — shown on buy buttons with `other_retailer_url`. */
  other_retailer_label: string | null
  other_retailer_url: string | null
  /** Verified primary retailer evidence URL for Agent 1 (falls back to amazon_url). Not buy CTA. */
  primary_retailer_evidence_url: string | null
  /** Verified manufacturer product detail page for Agent 1 (exact PDP). */
  manufacturer_product_url: string | null
  manufacturer_lab_results_url: string | null
  manufacturer_materials_faq_url: string | null
  /** Optional hints for Agent 1 synthesis. */
  agent1_source_notes: string | null
  image_url: string | null
  date_added: string
  date_last_updated: string
  active: boolean
}

export type CategoryRow = {
  category_id: string
  category_name: string | null
  subcategory_name: string | null
  description: string | null
  display_order: number | null
}

