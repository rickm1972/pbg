#!/usr/bin/env node
/**
 * Caraway-style ceramic sol-gel — must not map to PTFE or inert ceramic.
 */
import assert from 'node:assert/strict'
import { applyCanonicalMappings } from '../src/shared/canonical-taxonomy/map-structured-evidence.mjs'
import { getCanonicalApprovalBlockers } from '../src/shared/canonical-taxonomy/score-driving-fields.mjs'
import { detectPatternTriggers } from '../src/shared/required-evidence-matrix/pattern-triggers.mjs'
import { TAXONOMY_EXPANSION_REQUIRED } from '../src/shared/canonical-taxonomy/constants.mjs'
import { isCeramicNonstickMaterialText } from '../src/shared/canonical-taxonomy/ceramic-nonstick-structural.mjs'
import { isStructurallyPfasFreePrimary } from '../src/shared/canonical-taxonomy/inert-cookware-structural.mjs'

const structured = {
  product_identity: { subcategory: 'cookware' },
  primary_contact_material: {
    material_identity: 'ceramic_nonstick_sol_gel',
    source_url: 'https://www.amazon.com/dp/B09SS34H3K',
    confidence_label: 'manufacturer_confirmed',
  },
  coatings_and_finishes: [
    {
      coating_name: 'Ceramic Nonstick Sol-Gel Coating',
      coating_type: 'ceramic_nonstick_sol_gel',
      composition_disclosed: true,
      source_url: 'https://www.amazon.com/dp/B09SS34H3K',
    },
  ],
  secondary_components: [],
  safety_claims: {
    non_toxic_claim: {
      claimed: true,
      source_url: 'https://www.amazon.com/dp/B09SS34H3K',
      source_quote: 'Non Toxic, PTFE & PFOA Free',
    },
  },
  ingredient_list: { ingredients: [] },
}

const sources = [
  {
    url: 'https://www.amazon.com/dp/B09SS34H3K',
    title: 'Caraway Nonstick Ceramic Frying Pan',
    page_excerpt: 'Non Toxic, PTFE & PFOA Free. Ceramic nonstick. Aluminum core.',
    source_type: 'amazon',
  },
]

const mappings = applyCanonicalMappings(structured, sources)
const triggers = detectPatternTriggers(structured, mappings, sources)
const blockers = getCanonicalApprovalBlockers(mappings, { subcategory: 'cookware' })

assert.equal(mappings.primary_contact_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
assert.notEqual(mappings.primary_contact_material_id?.canonical_id, 'ptfe_nonstick_coating')
assert.equal(mappings.coating_modifier_id?.canonical_id, 'ceramic_sol_gel_nonstick_coating')
assert.notEqual(mappings.coating_modifier_id?.canonical_id, TAXONOMY_EXPANSION_REQUIRED)
assert.equal(mappings.substrate_material_id?.canonical_id, 'aluminum_core')
assert.notEqual(mappings.substrate_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
assert.equal(mappings.pfas_status_id?.canonical_id, 'pfas_not_disclosed')
assert.notEqual(mappings.pfas_status_id?.canonical_id, 'pfas_present_disclosed')
assert.equal(mappings.safety_claim_ids?.ptfe_free_claim?.canonical_id, 'ptfe_free_claim')
assert.equal(mappings.safety_claim_ids?.pfoa_free_claim?.canonical_id, 'pfoa_free_claim')
assert.equal(mappings.safety_claim_ids?.non_toxic_marketing_claim?.canonical_id, 'non_toxic_marketing_claim')
assert.equal(triggers.has('ptfe_primary_contact'), false)
assert.equal(triggers.has('ceramic_nonstick_coating'), true)
assert.equal(triggers.has('pfoa_pfas_distinction'), true)
assert.equal(mappings.regulatory_flag_ids?.length ?? 0, 0)
assert.equal(isStructurallyPfasFreePrimary(mappings.primary_contact_material_id?.canonical_id), false)

console.log('✓ ceramic nonstick canonical mapping (Caraway-style fixture)')
console.log('  primary:', mappings.primary_contact_material_id?.canonical_id)
console.log('  substrate:', mappings.substrate_material_id?.canonical_id)
console.log('  coating_modifier:', mappings.coating_modifier_id?.canonical_id)
console.log('  pfas:', mappings.pfas_status_id?.canonical_id)
console.log('  triggers:', [...triggers].join(', '))
if (blockers.length) console.log('  blockers:', blockers)

// Agent 1 snake_case ID order (Caraway v2 rerun failure mode)
const carawayV2 = {
  product_identity: { subcategory: 'cookware' },
  primary_contact_material: {
    material_identity: 'sol_gel_ceramic_nonstick_coating',
    source_url: 'https://www.amazon.com/dp/B09SS34H3K',
    confidence_label: 'manufacturer_confirmed',
  },
  coatings_and_finishes: [
    {
      coating_name: 'Ceramic Nonstick Sol-Gel Coating',
      coating_type: 'sol_gel_ceramic_nonstick_coating',
      composition_disclosed: true,
      source_url: 'https://www.amazon.com/dp/B09SS34H3K',
    },
  ],
  secondary_components: [],
  safety_claims: {
    non_toxic_claim: {
      claimed: true,
      source_url: 'https://www.amazon.com/dp/B09SS34H3K',
      source_quote: 'Non Toxic, PTFE & PFOA Free',
    },
  },
  ingredient_list: { ingredients: [] },
}
const m2 = applyCanonicalMappings(carawayV2, sources)
const t2 = detectPatternTriggers(carawayV2, m2, sources)
assert.equal(m2.primary_contact_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
assert.equal(m2.coating_modifier_id?.canonical_id, 'ceramic_sol_gel_nonstick_coating')
assert.notEqual(m2.coating_modifier_id?.canonical_id, 'no_coating_modifier')
assert.equal(m2.pfas_status_id?.canonical_id, 'pfas_not_disclosed')
assert.equal(isCeramicNonstickMaterialText(m2.substrate_material_id?.raw_value ?? ''), false)
assert.equal(t2.has('proprietary_coating'), false)
console.log('✓ sol_gel_ceramic_nonstick_coating raw id (Caraway v2)')

// Compound coating-on-substrate string (Caraway v3) — aluminum from material_identity, not blob alone
const carawayV3 = {
  product_identity: { subcategory: 'cookware' },
  primary_contact_material: {
    material_identity: 'sol_gel_ceramic_coating_on_aluminum_core',
    source_url: 'https://www.amazon.com/dp/B09SS34H3K',
    confidence_label: 'manufacturer_confirmed',
  },
  coatings_and_finishes: [
    {
      coating_name: 'Sol-Gel Ceramic Nonstick Coating',
      coating_type: 'sol_gel_ceramic_nonstick_coating',
      composition_disclosed: true,
      source_url: 'https://www.amazon.com/dp/B09SS34H3K',
    },
  ],
  secondary_components: [],
  safety_claims: {
    non_toxic_claim: {
      claimed: true,
      source_url: 'https://www.amazon.com/dp/B09SS34H3K',
      source_quote: 'Non Toxic, PTFE & PFOA Free',
    },
  },
  ingredient_list: { ingredients: [] },
}
const m3 = applyCanonicalMappings(carawayV3, [])
const b3 = getCanonicalApprovalBlockers(m3, { subcategory: 'cookware' })
assert.equal(m3.primary_contact_material_id?.canonical_id, 'ceramic_nonstick_sol_gel_coating')
assert.equal(m3.coating_modifier_id?.canonical_id, 'ceramic_sol_gel_nonstick_coating')
assert.equal(m3.substrate_material_id?.canonical_id, 'aluminum_core')
assert.notEqual(m3.substrate_material_id?.canonical_id, TAXONOMY_EXPANSION_REQUIRED)
assert.equal(b3.some((b) => /substrate/i.test(b)), false)
console.log('✓ sol_gel_ceramic_coating_on_aluminum_core compound substrate (Caraway v3)')
