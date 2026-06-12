#!/usr/bin/env node
/**
 * Truly unknown proprietary coating still uses conservative unknown patch.
 * Run: npm run test:unknown-proprietary-coating-band
 */
import assert from 'node:assert/strict'
import { applyServerInferenceRules } from './agent2/normalize-enforce.mjs'
import { buildLayer4a } from './agent2/deterministic/layer4a-applicability.mjs'
import {
  isKnownProprietaryCeramicNonstickMaterial,
  isTrulyUnknownProprietaryCoatingMaterial,
} from '../src/shared/agent2/proprietary-ceramic-nonstick.mjs'

const mysteryEvidence = {
  facts: [],
  agent_metadata: {
    structured_evidence: {
      coatings_and_finishes: [
        {
          coating_name: 'Proprietary coating',
          coating_type: 'proprietary_undisclosed',
          composition_disclosed: false,
        },
      ],
      canonical_mappings: {
        coating_modifier_id: { canonical_id: 'proprietary_nonstick_coating_undisclosed' },
      },
    },
  },
}

const mysteryComponent = {
  component_name: 'Cooking Surface — proprietary coating',
  component_role: 'primary_food_contact',
  role: 'primary_food_contact',
  material_id: 'proprietary_named_food_contact',
  material: 'Unknown proprietary food-contact coating (PROPRIETARY_NAMED)',
}

assert.equal(
  isKnownProprietaryCeramicNonstickMaterial(
    mysteryComponent.material_id,
    mysteryComponent,
    mysteryEvidence,
  ),
  false,
)
assert.equal(
  isTrulyUnknownProprietaryCoatingMaterial(
    mysteryComponent.material_id,
    mysteryComponent,
    mysteryEvidence,
  ),
  true,
)

const { components } = applyServerInferenceRules([mysteryComponent], {
  product_category_default: 'cookware',
}, { evidence: mysteryEvidence })
assert.equal(components[0].material_hazard, 0.8)
assert.equal(components[0].adjusted_migration_potential, 0.875)
console.log('✓ truly unknown proprietary still gets 0.80 / 0.875 patch')

const layer4a = buildLayer4a(mysteryEvidence, components, 'cookware')
assert.equal(layer4a.layer_4a.unknown_coating_cap_applies, true)
assert.ok(
  layer4a.layer_4a.negative_adjustments.some((n) =>
    /unknown proprietary food-contact coating/i.test(n.reason),
  ),
)
console.log('✓ truly unknown proprietary keeps unknown coating cap + Layer 4A label')

console.log('\nAll unknown proprietary coating band tests passed.')
