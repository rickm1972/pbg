#!/usr/bin/env node
/**
 * Layer 4B transparency badge + CI contract (V2.3.4).
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from '../lib/env.mjs'
import { enforceLayer4b } from './layer4b-enforce.mjs'
import { buildWhyThisScoreOptions } from './why-this-score-map.mjs'
import { runAgent2NormalizationPipeline } from './deterministic/pipeline.mjs'
import {
  deriveLayer4bTransparencyFromContract,
  hasUndisclosedPrimaryContactMaterialSpec,
  materialIdHasUndisclosedSpec,
} from '../../src/shared/agent2/layer4b-transparency-contract.mjs'

let failed = false

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    failed = true
  } else {
    console.log(`✓ ${msg}`)
  }
}

assert(materialIdHasUndisclosedSpec('stainless_steel_unspecified'), 'stainless_steel_unspecified blocks full disclosure')
assert(!materialIdHasUndisclosedSpec('stainless_steel_304'), 'stainless_steel_304 does not block full disclosure')

const undisclosedPrimary = [
  {
    component_role: 'primary_food_contact',
    material_id: 'stainless_steel_unspecified',
    data_confidence: 'manufacturer confirmed',
    contact_intimacy: 1,
  },
]
assert(
  hasUndisclosedPrimaryContactMaterialSpec(undisclosedPrimary),
  'primary food-contact with unspecified stainless detected',
)

const derivedUnspecified = deriveLayer4bTransparencyFromContract({
  opaque: false,
  primaryInferred: false,
  negativeLayer4a: false,
  components: undisclosedPrimary,
})
assert(
  derivedUnspecified.transparency_badge === 'Documentation Incomplete',
  'unspecified stainless → Documentation Incomplete',
)
assert(
  derivedUnspecified.confidence_interval === 3,
  'unspecified stainless → ±3',
)

const derivedInferredOnly = deriveLayer4bTransparencyFromContract({
  opaque: false,
  primaryInferred: false,
  negativeLayer4a: false,
  components: [
    {
      component_role: 'primary_food_contact',
      material_id: 'cast_iron',
      data_confidence: 'manufacturer confirmed',
      contact_intimacy: 1,
    },
  ],
})
assert(
  derivedInferredOnly.transparency_badge === 'Fully Disclosed',
  'zero inferred + disclosed cast iron → Fully Disclosed',
)
assert(derivedInferredOnly.confidence_interval === 0, 'fully disclosed → ±0')

const zeroInferredNotSufficient = deriveLayer4bTransparencyFromContract({
  opaque: false,
  primaryInferred: false,
  negativeLayer4a: false,
  components: undisclosedPrimary,
})
assert(
  zeroInferredNotSufficient.transparency_badge !== 'Fully Disclosed',
  'zero inferred alone does not produce Fully Disclosed when grade/spec undisclosed',
)

const enforced = enforceLayer4b({
  components: undisclosedPrimary,
  layer_4a: { negative_adjustments: [], net_adjustment: 0 },
})
assert(
  enforced.layer_4b.transparency_badge === 'Documentation Incomplete',
  'enforceLayer4b: stainless_steel_unspecified → Documentation Incomplete',
)
assert(enforced.layer_4b.confidence_interval === 3, 'enforceLayer4b: ±3')

const why = buildWhyThisScoreOptions(
  {
    agent_metadata: {
      structured_evidence: {
        transparency_assessment: {
          transparency_badge: 'Documentation Incomplete',
          fully_disclosed_eligible: false,
        },
      },
    },
  },
  { layer_4b: enforced.layer_4b, components: undisclosedPrimary },
)
const disclosure = why.disclosure_quality_options?.[0]
assert(
  disclosure === 'Documentation Incomplete',
  'Why This Score disclosure matches Layer 4B badge',
)
assert(
  disclosure === enforced.layer_4b.transparency_badge,
  'badge/CI and Why This Score disclosure cannot disagree',
)

const ALL_CLAD_ID = 'c645ae86-0b82-429d-8f46-78b8007041b5'
const packetPath = join(projectRoot, 'scripts', 'output', `agent2-${ALL_CLAD_ID}.json`)
if (existsSync(packetPath)) {
  const packet = JSON.parse(readFileSync(packetPath, 'utf8'))
  const beforeComponents = packet.inputs?.components ?? []
  const beforeIds = beforeComponents.map((c) => ({
    role: c.component_role,
    material_id: c.material_id,
    hazard: c.material_hazard,
  }))
  const { inputs, whyThisScore } = runAgent2NormalizationPipeline(packet.product, packet.evidence)
  assert(
    JSON.stringify(beforeIds) ===
      JSON.stringify(
        inputs.components.map((c) => ({
          role: c.component_role,
          material_id: c.material_id,
          hazard: c.material_hazard,
        })),
      ),
    'score-driving normalized components unchanged (All-Clad fixture)',
  )
  assert(
    inputs.layer_4b.transparency_badge === 'Documentation Incomplete',
    'All-Clad fixture: Documentation Incomplete',
  )
  assert(inputs.layer_4b.confidence_interval === 3, 'All-Clad fixture: ±3')
  assert(
    whyThisScore.disclosure_quality_options?.[0] === 'Documentation Incomplete',
    'All-Clad fixture: disclosure quality matches badge',
  )
} else {
  console.log('(skip All-Clad pipeline fixture — no output packet on disk)')
}

if (failed) {
  console.error('\nLayer 4B transparency tests FAILED')
  process.exit(1)
}
console.log('\nLayer 4B transparency tests PASSED')
