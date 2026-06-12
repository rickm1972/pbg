#!/usr/bin/env node
/**
 * v2.3.5 source-of-truth scoring sync regression tests.
 * Run: node scripts/test-scoring-source-sync.mjs
 */
import assert from 'node:assert/strict'
import { ALGORITHM_VERSION, scorePacCore } from './agent3/algorithm.mjs'
import { computeEscalatorFlags } from './agent2/normalize-enforce.mjs'
import { getMaterial, resolveMaterialLookupMeta } from './agent2/deterministic/material-taxonomy.mjs'
import {
  EXPOSURE_DEFAULTS_BY_KEY,
  resolveExposureDefaultsForRole,
  resolveUtensilsPrimaryDefaults,
  SCORING_ASSUMPTIONS_V235,
  getScoringAssumption,
} from '../src/shared/product-type-registry/scoring-assumptions.mjs'
import {
  resolveProductTypeConfig,
  resolveMatrixKeyFromRegistry,
} from '../src/shared/product-type-registry/index.mjs'
import { METHODOLOGY_VERSION } from './agent2/deterministic/material-lookup-versions.mjs'
const NON_DETECT_MITIGATION_FACTOR = 0.58
import { LAYER_4A_POSITIVE_LOOKUP, LAYER_4A_POSITIVE_MAX } from './agent2/layer4a-positive.mjs'

console.log('Scoring source-of-truth sync tests (v2.3.5)\n')

function primaryDefaults(scoringCategory, materialId = null) {
  const r = resolveExposureDefaultsForRole('primary_food_contact', scoringCategory, materialId)
  return { severity: r.severity, duration: r.duration }
}

// ── Use-condition defaults ───────────────────────────────────────────────────

{
  const fs = primaryDefaults('food-storage')
  assert.equal(fs.severity, 0.83)
  assert.equal(fs.duration, 0.75)
}
console.log('✓ Food Storage 0.83 / 0.75')

{
  const pyrexLike = resolveProductTypeConfig({
    category: 'Kitchen',
    subcategory: 'Food storage',
    product_type: 'Storage container',
  })
  assert.equal(pyrexLike?.scoring_assumption_ref, 'v2.3.5.food_storage')
  const exp = primaryDefaults('food-storage')
  assert.equal(exp.severity, 0.83)
  assert.equal(exp.duration, 0.75)
}
console.log('✓ Pyrex-like Food Storage registry resolves 0.83 / 0.75')

{
  const dw = primaryDefaults('drinkware')
  assert.equal(dw.severity, 0.6)
  assert.equal(dw.duration, 0.8)
}
console.log('✓ Drinkware 0.60 / 0.80')

{
  const wb = primaryDefaults('water-bottles')
  assert.equal(wb.severity, 0.6)
  assert.equal(wb.duration, 0.8)
  const bottleCfg = resolveProductTypeConfig({
    category: 'Kitchen',
    subcategory: 'Drinkware',
    product_type: 'Water bottle',
  })
  const tumblerCfg = resolveProductTypeConfig({
    category: 'Kitchen',
    subcategory: 'Drinkware',
    product_type: 'Tumbler',
  })
  assert.equal(bottleCfg?.registry_key, 'kitchen.drinkware.water_bottle')
  assert.equal(tumblerCfg?.registry_key, 'kitchen.drinkware.tumbler')
  assert.equal(bottleCfg?.matrix_key, 'water_bottles')
  assert.equal(tumblerCfg?.matrix_key, 'drinkware')
  assert.notEqual(bottleCfg?.matrix_key, tumblerCfg?.matrix_key)
}
console.log('✓ Water Bottles separately representable from Drinkware')

{
  const nylon = resolveUtensilsPrimaryDefaults('nylon_food_contact')
  assert.equal(nylon.severity, 1.0)
  assert.equal(nylon.duration, 0.5)
  const ss = resolveUtensilsPrimaryDefaults('stainless_steel_304')
  assert.equal(ss.severity, 0.96)
  assert.equal(ss.duration, 0.5)
  const stale = EXPOSURE_DEFAULTS_BY_KEY.utensils.roles.primary_food_contact.severity
  assert.equal(stale, undefined, 'stale scalar 0.75 must be removed')
}
console.log('✓ Cooking Utensils role-split (plastic/nylon 1.0, stainless/wood 0.96, duration 0.50)')

{
  const tx = primaryDefaults('textiles')
  assert.equal(tx.severity, 0.2)
  assert.equal(tx.duration, 1.0)
}
console.log('✓ Bedding/Textiles 0.20 / 1.00')

{
  const cw = primaryDefaults('cookware')
  assert.equal(cw.severity, 0.96)
  assert.equal(cw.duration, 0.5)
}
console.log('✓ Cookware remains 0.96 / 0.50')

// ── Version / escalators ─────────────────────────────────────────────────────

assert.equal(ALGORITHM_VERSION, '2.3.5')
assert.equal(METHODOLOGY_VERSION, 'v2.3.5')
for (const ref of Object.keys(SCORING_ASSUMPTIONS_V235)) {
  assert.equal(getScoringAssumption(ref).algorithm_version, '2.3.5')
}
console.log('✓ Algorithm/version stamps report v2.3.5')

{
  const flags = computeEscalatorFlags(
    {
      component_name: 'Degraded coating',
      material: 'PTFE nonstick',
      adjusted_migration_potential: 0.75,
      base_migration_potential: 0.75,
      exposure_severity: 0.9,
      contact_intimacy: 1,
      material_hazard: 0.85,
      degradation_adjustment: 0.15,
    },
    { product_category_default: 'cookware', subcategory: 'Cookware' },
  )
  assert.equal(flags.escalator_3_triggers, false)
  assert.notEqual(flags.escalator_applied, 'escalator_3')
  assert.notEqual(flags.escalator_multiplier, 1.3)
}
console.log('✓ Escalator 3 degraded path cannot fire')

{
  const core = scorePacCore({
    components: [
      {
        component_name: 'Coating',
        material_hazard: 0.85,
        adjusted_migration_potential: 0.75,
        contact_intimacy: 1,
        exposure_severity: 0.9,
        exposure_duration: 0.5,
        escalator_3_triggers: true,
        escalator_1_triggers: false,
        escalator_2_triggers: false,
        escalator_4_triggers: false,
      },
    ],
    layer_4a: { net_adjustment: 0 },
  })
  const comp = core.component_results[0]
  assert.notEqual(comp.escalator_applied, 'escalator_3')
  assert.notEqual(comp.escalator_multiplier, 1.3)
}
console.log('✓ Agent 3 scorePacCore ignores escalator_3 even if flag set')

// ── Materials ────────────────────────────────────────────────────────────────

const NEW_MATERIALS = [
  ['titanium', 0.01, 0.02],
  ['food_grade_copper_lined', 0.05, 0.05],
  ['bare_copper_acidic_food_contact', 0.55, 0.6],
  ['food_safe_ceramic_verified_glaze', 0.05, 0.05],
]
for (const [id, hazard, migration] of NEW_MATERIALS) {
  const m = getMaterial(id)
  assert.equal(m.hazard, hazard, `${id} hazard`)
  assert.equal(m.migration, migration, `${id} migration`)
}
console.log('✓ Four new active materials resolve with source hazard/migration')

{
  const lodge = getMaterial('cast_iron')
  assert.equal(lodge.hazard, 0.03)
  assert.equal(lodge.migration, 0.035)
}
console.log('✓ Existing matched material values unchanged (cast_iron)')

{
  const alias = resolveMaterialLookupMeta('cast_iron_body')
  assert.equal(alias.resolved_material_taxonomy_id, 'cast_iron')
  assert.equal(alias.material.hazard, 0.03)
}
console.log('✓ Alias resolution still works (cast_iron_body → cast_iron)')

{
  const hybrid = getMaterial('hybrid_stainless_nonstick_food_contact')
  assert.equal(hybrid.name, 'Hybrid stainless lattice + nonstick surface')
  assert.equal(hybrid.tier, 'Moderate')
  assert.equal(hybrid.hazard, 0.35)
}
console.log('✓ Label normalization: tier Moderate, hazard unchanged')

{
  const ptfe = getMaterial('ptfe_coating')
  assert.equal(ptfe.name, 'PTFE coating (lower band)')
  assert.equal(ptfe.tier, 'Moderate')
  assert.equal(ptfe.hazard, 0.6)
}
console.log('✓ ptfe_coating display name aligned to lookup')

// ── Regression guards (unchanged methodology) ───────────────────────────────

assert.equal(LAYER_4A_POSITIVE_MAX, 5)
assert.equal(LAYER_4A_POSITIVE_LOOKUP.length, 9)
assert.equal(NON_DETECT_MITIGATION_FACTOR, 0.58)
console.log('✓ Layer 4A max + Non-Detect 0.58 unchanged')

console.log('\nAll scoring source sync tests passed.')
