/**
 * Lodge-style cast iron fixture — verifies inert cookware structural mapping (no product-specific hardcoding).
 */
import assert from 'node:assert/strict'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { getCanonicalApprovalBlockers } from '../src/shared/canonical-taxonomy/score-driving-fields.mjs'
import { detectPatternTriggers } from '../src/shared/required-evidence-matrix/pattern-triggers.mjs'
import { TAXONOMY_EXPANSION_REQUIRED } from '../src/shared/canonical-taxonomy/constants.mjs'
import { evaluateFieldRequirement } from '../src/shared/required-evidence-matrix/field-evaluators.mjs'

const structured = {
  product_identity: { subcategory: 'cookware' },
  primary_contact_material: {
    material_identity: 'Cast iron',
    source_url: 'https://www.lodgecastiron.com/example-skillet',
    confidence_label: 'manufacturer_confirmed',
  },
  coatings_and_finishes: [],
  secondary_components: [],
  safety_claims: {
    pfas_free_claim: {
      claimed: true,
      source_url: 'https://www.amazon.com/example',
      source_quote: 'PFAS-free cast iron skillet',
    },
    non_toxic_claim: {
      claimed: true,
      source_url: 'https://www.amazon.com/example',
      source_quote: 'Non-toxic cookware',
    },
  },
}

const sources = [
  {
    url: 'https://www.amazon.com/example',
    title: 'Lodge 10.25 Inch Cast Iron Skillet',
    page_excerpt: 'PFAS-free. Non-toxic. Cast iron.',
    source_type: 'amazon',
  },
]

const mappings = applyCanonicalMappings(structured, sources)
const blockers = getCanonicalApprovalBlockers(mappings, { subcategory: 'cookware' })
const triggers = detectPatternTriggers(structured, mappings, sources)

assert.equal(mappings.primary_contact_material_id?.canonical_id, 'cast_iron')
assert.equal(mappings.substrate_material_id?.canonical_id, 'cast_iron_body')
assert.equal(mappings.coating_modifier_id?.canonical_id, 'no_coating_modifier')
assert.equal(mappings.pfas_status_id?.canonical_id, 'pfas_not_present_inert_material')
assert.equal(
  mappings.safety_claim_ids?.pfas_free_claim_structurally_verified?.canonical_id,
  'pfas_free_claim_structurally_verified',
)
assert.equal(
  mappings.safety_claim_ids?.non_toxic_marketing_claim?.canonical_id,
  'non_toxic_marketing_claim',
)
assert.equal(mappings.safety_claim_ids?.pfas_free_marketing_claim, undefined)
assert.equal(mappings.regulatory_flag_ids?.length ?? 0, 0)
assert.equal(triggers.has('ptfe_primary_contact'), false)
assert.ok(!blockers.some((b) => b.includes('TAXONOMY_EXPANSION_REQUIRED')))
assert.notEqual(mappings.coating_modifier_id?.canonical_id, TAXONOMY_EXPANSION_REQUIRED)

// Agent 1 often emits snake_case material_identity; retailer copy may include "PFAS-free".
const structuredSnake = {
  ...structured,
  primary_contact_material: {
    ...structured.primary_contact_material,
    material_identity: 'cast_iron',
  },
}
const mappingsSnake = applyCanonicalMappings(structuredSnake, sources)
const blockersSnake = getCanonicalApprovalBlockers(mappingsSnake, { subcategory: 'cookware' })

assert.equal(mappingsSnake.primary_contact_material_id?.canonical_id, 'cast_iron')
assert.equal(
  mappingsSnake.primary_contact_material_id?.mapping_rule_id,
  'cookware_cast_iron_primary_contact_v1',
)
assert.equal(mappingsSnake.pfas_status_id?.canonical_id, 'pfas_not_present_inert_material')
assert.equal(
  mappingsSnake.safety_claim_ids?.pfas_free_claim_structurally_verified?.canonical_id,
  'pfas_free_claim_structurally_verified',
)
assert.ok(!blockersSnake.some((b) => b.includes('TAXONOMY_EXPANSION_REQUIRED')))

const structuredStructuralOnly = {
  ...structuredSnake,
  safety_claims: {
    pfas_free_claim: {
      claimed: true,
      source_url: 'https://www.amazon.com/example',
      structural_guarantee: true,
    },
  },
}
const mappingsStructuralOnly = applyCanonicalMappings(structuredStructuralOnly, sources)
assert.equal(
  mappingsStructuralOnly.safety_claim_ids?.pfas_free_claim_structurally_verified?.canonical_id,
  undefined,
  'structural_guarantee alone must not create PFAS-free safety claim row',
)
assert.equal(mappingsStructuralOnly.pfas_status_id?.canonical_id, 'pfas_not_present_inert_material')

// All-Clad G5–style: stainless food-contact + graphite structural core, uncoated inert PFAS.
const allCladStructured = {
  product_identity: { subcategory: 'cookware' },
  primary_contact_material: {
    material_identity: 'stainless_steel',
    source_url: 'https://www.all-clad.com/g5-graphite-core-skillet',
    confidence_label: 'manufacturer_confirmed',
  },
  coatings_and_finishes: [],
  secondary_components: [
    {
      component_role: 'structural',
      material_identity: 'graphite_core',
      source_url: 'https://www.all-clad.com/g5-graphite-core-skillet',
    },
  ],
  safety_claims: {},
  retailer_links: {
    amazon_url: 'https://www.amazon.com/dp/B00EXAMPLE',
    manufacturer_direct_url: 'https://www.all-clad.com/g5-graphite-core-skillet',
  },
}
const allCladSources = [
  {
    url: 'https://www.all-clad.com/g5-graphite-core-skillet',
    title: 'G5 Graphite Core Stainless Steel Skillet',
    page_excerpt:
      'All-metal stainless steel interior cooking surface. G5 graphite core bonded construction. No applied nonstick coating.',
    source_type: 'manufacturer',
  },
  {
    url: 'https://www.amazon.com/dp/B00EXAMPLE',
    title: 'All-Clad G5 Skillet',
    page_excerpt: 'Stainless steel cooking surface. Graphite core.',
    source_type: 'amazon',
  },
]
const allCladMappings = applyCanonicalMappings(allCladStructured, allCladSources)
const allCladBlockers = getCanonicalApprovalBlockers(allCladMappings, { subcategory: 'cookware' })

assert.equal(allCladMappings.primary_contact_material_id?.canonical_id, 'stainless_steel_unspecified')
assert.equal(allCladMappings.substrate_material_id?.canonical_id, 'stainless_steel_body')
assert.equal(allCladMappings.coating_modifier_id?.canonical_id, 'no_coating_modifier')
assert.equal(allCladMappings.pfas_status_id?.canonical_id, 'pfas_not_present_inert_material')
assert.ok(!allCladBlockers.some((b) => b.includes('TAXONOMY_EXPANSION_REQUIRED')))

const coatingsCheck = evaluateFieldRequirement(
  { ...allCladStructured, canonical_mappings: allCladMappings },
  { field_path: 'coatings_and_finishes', required: true },
)
assert.equal(coatingsCheck.status, 'passed')

console.log('inert-cookware-canonical: OK')
console.log(
  JSON.stringify(
    {
      primary: mappings.primary_contact_material_id?.canonical_id,
      substrate: mappings.substrate_material_id?.canonical_id,
      coating_modifier: mappings.coating_modifier_id?.canonical_id,
      pfas_status: mappings.pfas_status_id?.canonical_id,
      pfas_claim: mappings.safety_claim_ids?.pfas_free_claim_structurally_verified?.canonical_id,
      blockers,
      triggers: [...triggers],
      snake_primary: mappingsSnake.primary_contact_material_id?.canonical_id,
      snake_pfas_status: mappingsSnake.pfas_status_id?.canonical_id,
    },
    null,
    2,
  ),
)
