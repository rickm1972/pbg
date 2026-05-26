import { ALGORITHM_VERSION, MAX_SOURCES } from './types.mjs'
import { CONFIDENCE_LABELS_SCHEMA, SCHEMA_VERSION } from './schema.mjs'

const CONFIDENCE_ENUM = CONFIDENCE_LABELS_SCHEMA.options.join(' | ')

export const STRUCTURED_SYNTHESIS_SYSTEM_PROMPT = `You are Agent 1 (Product Evidence Agent) for PlasticBegone Algorithm ${ALGORITHM_VERSION}.
Output ONE valid JSON object matching structured_evidence schema version ${SCHEMA_VERSION}. No markdown. No prose outside JSON.

SOURCE RULES (strict):
- Product identity, primary/secondary materials, coatings, claimed certifications, safety claims: Amazon OR manufacturer page URL only.
- Claimed certifications: list certifying-body credentials seen on Amazon/manufacturer only (e.g. MADE SAFE, EWG Verified). Do not mark them verified — the server queries each certifying body's registry after your response.
- Ingredient list: manufacturer OR Amazon OR SDS PDF URL only.
- Class action: legal/news URLs only.
- Conflicting evidence: any allowed source URLs. conflicting_evidence MUST be a JSON array ([] if none; wrap a single conflict in one array element — never a bare object).
- Every non-null field with a real value MUST include a source_url from snippets. If no URL, set value null and use null_code.

PRIMARY CONTACT (required):
- material_identity: taxonomy id (cast_iron, stainless_steel_304, plant_mineral_formulation, terrabond_proprietary, etc.) OR undisclosed_code: PROPRIETARY_NAMED | UNKNOWN | CONFLICTING.

SECONDARY COMPONENTS (affirmative only):
- Create a row ONLY when the part exists. "No lid" means NO lid row. Negative claims never create components.

COATINGS:
- Empty array if bare metal only (cast iron, stainless) with only seasoning/oil as coating_type natural_oil_seasoning when explicitly stated.
- No phantom PTFE/ceramic entries without affirmative evidence.

CERTIFICATIONS (certifying bodies ONLY):
- claimed_certifications: ONLY third-party credentials (MADE SAFE, Leaping Bunny, EWG Verified, NSF, USDA Organic, GOTS, OEKO-TEX, Bluesign, etc.).
- NEVER put marketing language here: PFAS-Free, PFOA-free, PTFE-free, Non-Toxic, BPA-Free, Phthalate-free, Lead-free, Chemical-free — those are NOT certifications.
- verified_certifications / claimed_but_not_verified: leave empty []; server partitions marketing vs certifying-body claims, then verifies each cert via live registry search (madesafe.org, ewg.org/ewgverified, leapingbunny.org, USDA Organic Integrity Database, oeko-tex.com, nsf.org, global-standard.org, bluesign.com). Only registry URLs may appear in verified_certifications.

SAFETY CLAIMS (marketing / structural):
- PFAS-Free, BPA-free, Non-toxic, etc. go in safety_claims objects with source_url — NOT in claimed_certifications.
- structural_guarantee true when structurally implied (cast iron→pfas_free; cast iron/stainless→non_toxic; glass→bpa_free).

JSON shape:
{
  "structured_evidence": {
    "schema_version": "${SCHEMA_VERSION}",
    "product_identity": { "product_name", "brand", "subcategory", "sku_or_model", "sku_null_code", "country_of_origin", "country_null_code" },
    "primary_contact_material": { "material_identity", "undisclosed_code", "source_url", "confidence_label": ${CONFIDENCE_ENUM}, "material_specs_disclosed" },
    "secondary_components": [{ "component_role", "material_identity", "source_url", "confidence_label", "null_code" }],
    "coatings_and_finishes": [{ "coating_name", "coating_type", "composition_disclosed", "source_url", "third_party_verified" }],
    "certifications": { "claimed_certifications": [], "verified_certifications": [], "claimed_but_not_verified": [] },
    "safety_claims": { "pfas_free_claim", "bpa_free_claim", "phthalate_free_claim", "lead_free_claim", "non_toxic_claim", "independent_testing_documented", "testing_source_url" },
    "ingredient_list": null | { "ingredients", "source", "source_url", "fragrance_disclosure", "null_code" },
    "conflict_and_review": { "class_action_history", "class_action_sources", "conflicting_evidence", "requires_human_review" },
    "retailer_links": { "amazon_url", "walmart_url", "target_url", "manufacturer_direct_url" },
    "product_use_case": string,
    "care_and_use_instructions": string | null
  },
  "sources": [{ "source_type", "url", "title", "fetched_at", "page_excerpt?" }],
  "agent_metadata": { "warnings": [] }
}

confidence_label uses snake_case only. Max ${MAX_SOURCES} sources.`

export function buildStructuredSynthesisUserPrompt(product, retrieval) {
  const amazon = retrieval.amazon_anthropic_web_search
  const amazonSection = amazon
    ? `AMAZON (primary retailer):\n${JSON.stringify(amazon, null, 2)}`
    : 'AMAZON: not available.'

  return `Populate structured_evidence from retrieval only.

Product:
- product_id: ${product.product_id}
- product_name: ${product.product_name}
- brand: ${product.brand ?? 'unknown'}
- category: ${product.category ?? 'unknown'}
- subcategory: ${product.subcategory ?? 'unknown'}

Catalog URLs:
- amazon_url: ${product.amazon_url || product.affiliate_link || 'none'}
- target_url: ${product.target_url ?? 'none'}
- walmart_url: ${product.walmart_url ?? 'none'}

${amazonSection}

Perplexity (${retrieval.search_requests} searches):
${JSON.stringify(retrieval.searches, null, 2)}

Instructions:
1. retailer_links.amazon_url and manufacturer_direct_url are required (from snippets).
2. primary_contact_material must be populated (material or undisclosed_code).
3. No secondary component for parts explicitly absent.
4. claimed_certifications = certifying-body names only; marketing claims in safety_claims with source_url.
5. Set requires_human_review true if class_action_history or conflicting_evidence or primary is PROPRIETARY_NAMED.
6. fetched_at on each source = current UTC ISO.`
}
