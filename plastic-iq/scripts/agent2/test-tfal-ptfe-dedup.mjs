#!/usr/bin/env node
/**
 * Regression: T-Fal PTFE over hard-anodized aluminum must not double-count legacy primary_material.
 * Usage: node scripts/agent2/test-tfal-ptfe-dedup.mjs
 */
import { runAgent2NormalizationPipeline } from './deterministic/pipeline.mjs'
import { COMPONENT_EXTRACT_VERSION } from './deterministic/component-extract.mjs'
import { buildWhyThisScoreOptions } from './why-this-score-map.mjs'

const TFAL_PRODUCT = {
  product_id: '7a457a86-ab62-4cbf-90b9-ccaeafe06896',
  product_name: 'T-Fal Ultimate Hard Anodized Nonstick Fry Pan Set 3 Piece',
  brand: 'T-Fal',
  subcategory: 'Cookware',
}

/** Minimal approved evidence mirroring T-Fal Gate 1 + bridged legacy facts. */
const TFAL_EVIDENCE = {
  facts: [
    {
      fact_key: 'primary_material',
      fact_value: 'hard_anodized_aluminum_with_ptfe_nonstick',
      confidence: 'manufacturer confirmed',
      excerpt: 'Hard anodized aluminum with PTFE nonstick interior',
      source_url: 'https://www.t-fal.ca/en/pfoas/',
    },
    {
      fact_key: 'product_use_case',
      fact_value: 'Stovetop frying and sautéing with fat exposure',
      confidence: 'manufacturer confirmed',
      excerpt: 'Cookware for stovetop use',
      source_url: 'https://www.t-fal.ca/en/pfoas/',
    },
  ],
  agent_metadata: {
    structured_evidence: {
      product_identity: {
        subcategory: 'Cookware',
        brand: 'T-Fal',
        product_name: TFAL_PRODUCT.product_name,
      },
      product_use_case: 'Stovetop frying and sautéing with fat exposure',
      primary_contact_material: {
        material_identity: 'hard_anodized_aluminum_with_ptfe_nonstick',
        source_url: 'https://www.t-fal.ca/en/pfoas/',
        confidence_label: 'manufacturer_confirmed',
      },
      coatings_and_finishes: [
        {
          coating_name: 'Titanium PTFE Nonstick Interior',
          coating_type: 'ptfe_nonstick',
          composition_disclosed: true,
          source_url: 'https://www.t-fal.ca/en/pfoas/',
        },
        {
          coating_name: 'Hard Anodized Exterior',
          coating_type: 'hard_anodized',
          composition_disclosed: true,
          source_url: 'https://www.t-fal.ca/en/pfoas/',
        },
      ],
      canonical_mappings: {
        schema_version: '1.0',
        primary_contact_material_id: {
          canonical_id: 'ptfe_nonstick_titanium_reinforced',
          agent2_material_id: 'ptfe_nonstick_titanium_reinforced',
          mapping_rule_id: 'cookware_titanium_ptfe_interior_v1',
          confidence_label: 'manufacturer_confirmed',
        },
        substrate_material_id: {
          canonical_id: 'hard_anodized_aluminum',
          agent2_material_id: 'hard_anodized_aluminum',
          mapping_rule_id: 'cookware_hard_anodized_substrate_v1',
          confidence_label: 'manufacturer_confirmed',
        },
        coating_modifier_id: {
          canonical_id: 'titanium_reinforced',
          mapping_rule_id: 'cookware_titanium_modifier_v1',
          confidence_label: 'manufacturer_confirmed',
        },
        pfas_status_id: {
          canonical_id: 'pfas_present_disclosed',
          mapping_rule_id: 'cookware_ptfe_pfas_disclosed_v1',
          confidence_label: 'manufacturer_confirmed',
        },
        safety_claim_ids: {},
        regulatory_flag_ids: [],
        blockers: [],
      },
    },
  },
}

let failed = false

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    failed = true
  } else {
    console.log(`✓ ${msg}`)
  }
}

const { inputs } = runAgent2NormalizationPipeline(TFAL_PRODUCT, TFAL_EVIDENCE)
const why = buildWhyThisScoreOptions(TFAL_EVIDENCE, inputs)

const primaries = inputs.components.filter(
  (c) => (c.component_role ?? c.role) === 'primary_food_contact',
)
const ptfeCoatingDup = primaries.find((c) => c.material_id === 'ptfe_coating')
const canonicalPrimary = primaries.find((c) => c.material_id === 'ptfe_nonstick_titanium_reinforced')

assert(primaries.length === 1, `exactly one primary_food_contact component (got ${primaries.length})`)
assert(Boolean(canonicalPrimary), 'canonical primary ptfe_nonstick_titanium_reinforced present')
assert(!ptfeCoatingDup, 'no generic ptfe_coating duplicate')
assert(
  canonicalPrimary?.material_hazard === 0.85,
  `hazard 0.85 (got ${canonicalPrimary?.material_hazard})`,
)
assert(
  canonicalPrimary?.adjusted_migration_potential === 0.75,
  `migration 0.75 (got ${canonicalPrimary?.adjusted_migration_potential})`,
)
assert(
  canonicalPrimary?.contact_intimacy === 1,
  `contact intimacy 1 (got ${canonicalPrimary?.contact_intimacy})`,
)
assert(
  /hard anodized aluminum body/i.test(canonicalPrimary?.component_name ?? ''),
  'component name includes hard-anodized aluminum body context',
)
assert(
  why.secondary_materials_options.includes('Hard anodized aluminum'),
  'Why This Score shows hard-anodized aluminum as body/substrate context',
)
assert(
  !why.secondary_materials_options.includes('None'),
  'Why This Score secondary_materials is not None when substrate canonical exists',
)
assert(
  why.primary_material_options.includes('PTFE nonstick coating, titanium reinforced'),
  'Why This Score primary material is titanium-reinforced PTFE label',
)
assert(
  why.coatings_finishes_options.includes('PTFE nonstick coating'),
  'Why This Score coatings includes PTFE nonstick coating',
)
assert(
  inputs.component_extraction_log?.some(
    (e) => e.step === 'component_extract_version' && e.version === COMPONENT_EXTRACT_VERSION,
  ),
  `extraction log includes ${COMPONENT_EXTRACT_VERSION}`,
)

if (failed) {
  console.error('\nT-Fal PTFE dedup test FAILED')
  process.exit(1)
}

console.log('\nT-Fal PTFE dedup test PASSED')
console.log(`  primary: ${canonicalPrimary.component_name}`)
console.log(`  secondary options: ${why.secondary_materials_options.join(', ')}`)
process.exit(0)
