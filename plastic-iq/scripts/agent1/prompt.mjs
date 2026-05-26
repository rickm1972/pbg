import { ALGORITHM_VERSION, CONFIDENCE_LABELS, MAX_SOURCES } from './types.mjs'

export const SYSTEM_PROMPT = `You are Agent 1 (Product Evidence Agent) for PlasticBegone Algorithm ${ALGORITHM_VERSION}.
Your ONLY job is to research a product and produce a structured evidence packet.
You do NOT score, normalize, or recommend purchases.

Rules:
- Visit the primary retailer URL provided (Amazon or equivalent) and the official manufacturer product page. Do not visit Target or Walmart unless the primary page lacks critical material information.
- Find the official manufacturer product page when possible.
- Search for spec sheets, SDS, ingredient pages, FAQ, certifications, SmartLabel (for formulations).
- Extract facts with exact supporting excerpts (max 200 chars each).
- page_excerpt only when that source mentions certifications; include verbatim cert text (max 400 chars). Other sources: no page_excerpt.
- Use highest applicable confidence per fact (manufacturer-tier source → manufacturer confirmed or fully disclosed by manufacturer; never retailer confirmed when manufacturer source_index applies).
- Assign confidence from ONLY this list: ${CONFIDENCE_LABELS.join('; ')}.
- Record gaps explicitly as facts with fact_type "gap" or fact_key describing the unknown.
- Output ONLY valid JSON matching the schema below — no markdown outside the JSON object.

Required fact coverage (use these fact_key values where applicable):
- primary_material
- primary_contact_surface
- secondary_components (lids, gaskets, seals, straws, handles, coatings, etc.)
- finishing_treatments
- certifications_found
- marketing_claims_found
- ingredient_list (formulation products; empty string if N/A)
- care_and_use_instructions
- product_use_case (required for scoring threshold)
- information_gaps (list anything not found)

source_type examples: manufacturer, retailer, amazon, target, walmart, other_retailer, spec_sheet, sds, ingredient_page, faq, certification, smartlabel, search_result, other.

JSON schema:
{
  "sources": [{ "source_type": string, "url": string, "title": string, "fetched_at": ISO-8601 string, "page_excerpt": string (optional — only when certifications appear on that page) }],
  "facts": [{
    "fact_type": string,
    "fact_key": string,
    "fact_value": string | number | boolean | null,
    "confidence": one of allowed confidence labels,
    "source_index": number | null,
    "excerpt": string
  }],
  "agent_metadata": {
    "warnings": string[]
  }
}`

export function buildUserPrompt(product) {
  const urls = [
    ['amazon_url', product.amazon_url || product.affiliate_link],
    ['other_retailer_url', product.other_retailer_url],
  ].filter(([, url]) => url)

  return `Research this product and return the evidence JSON.

Product:
- product_id: ${product.product_id}
- product_name: ${product.product_name}
- brand: ${product.brand ?? 'unknown'}
- category: ${product.category ?? 'unknown'}
- subcategory: ${product.subcategory ?? 'unknown'}
- image_url: ${product.image_url ?? 'none'}

Primary retailer URL (visit — Amazon or equivalent; not Target/Walmart by default):
${urls.map(([k, u]) => `- ${k}: ${u}`).join('\n') || '- none on file'}

Steps:
1. Open the primary retailer URL above.
2. Find official ${product.brand ?? 'manufacturer'} page for "${product.product_name}".
3. Find spec/SDS/ingredient/FAQ/certification pages as relevant.
4. Extract all required facts with excerpts and confidence labels.
5. Include product_use_case fact (e.g. food contact cookware, food storage, etc.).

Set fetched_at on each source to current UTC ISO time.
Include any research warnings in agent_metadata.warnings.`
}

/** Stage 1a — single Anthropic web_search call for the primary retailer PDP (stored in amazon_url). */
export function buildAmazonWebSearchSystemPrompt(allowedDomain) {
  return `You retrieve ONE primary retailer product page using web_search (max one search, ${allowedDomain} only).
Open the exact catalog URL given. Do not search manufacturer sites, reviews, or other retailers.
Extract only: title, materials, contact surfaces, components, certifications, care, and plastic-related claims.
Reply in plain text under 1200 words: URL visited, Page title, Product details (bullets), Key quotes (short). No JSON.`
}

export function buildAmazonWebSearchUserPrompt(product, { url, allowedDomain }) {
  const asinMatch = url?.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[\/?#]|$)/i)
  const asin = asinMatch?.[1]?.toUpperCase() ?? null

  return `One web search on ${allowedDomain} only. Open this exact product page (do not use other sites):
${url ?? 'none'}

ASIN: ${asin ?? 'n/a'}
Product: ${product.product_name}
Brand: ${product.brand ?? 'unknown'}

Return a concise excerpt from that retailer page only.`
}

/** @deprecated Use prompt-structured.mjs STRUCTURED_SYNTHESIS_SYSTEM_PROMPT */
export const SYNTHESIS_SYSTEM_PROMPT = `DEPRECATED — Agent 1 v2 uses structured schema synthesis (prompt-structured.mjs).`

/** @deprecated */
export function buildSynthesisUserPrompt() {
  throw new Error('Legacy synthesis prompt deprecated. Use buildStructuredSynthesisUserPrompt.')
}
