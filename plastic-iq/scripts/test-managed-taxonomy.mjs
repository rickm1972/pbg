#!/usr/bin/env node
/**
 * Managed taxonomy schema, seed, readiness, and product-form integration tests.
 * Run: npm run test:managed-taxonomy
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  evaluateSubcategoryScoringReadiness,
  resolveManagedSubcategoryScalarDefaults,
} from '../src/lib/managedTaxonomy/readiness.ts'
import { KITCHEN_CATEGORY_ID, KITCHEN_SUBCATEGORY_IDS } from '../src/lib/managedTaxonomy/seedIds.ts'
import { evaluateProductIntakePreflight } from '../src/lib/productIntakePreflight.ts'
import { productMatchesPublicSubcategory } from '../src/lib/publicTaxonomyBrowse.ts'
import { EXPOSURE_DEFAULTS_BY_KEY } from '../src/shared/product-type-registry/scoring-assumptions.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const migration46 = readFileSync(join(root, 'supabase/migrations/0046_managed_taxonomy.sql'), 'utf8')
const migration47 = readFileSync(join(root, 'supabase/migrations/0047_seed_kitchen_taxonomy.sql'), 'utf8')
const adminPage = readFileSync(join(root, 'src/pages/AdminPage.tsx'), 'utf8')

// 1–2 tables exist
assert.ok(migration46.includes('create table if not exists public.product_categories'))
assert.ok(migration46.includes('create table if not exists public.product_subcategories'))
console.log('✓ product_categories and product_subcategories tables defined')

// products FK columns
assert.ok(migration46.includes('category_id uuid references public.product_categories'))
assert.ok(migration46.includes('subcategory_id uuid references public.product_subcategories'))
console.log('✓ products.category_id and products.subcategory_id FK columns defined')

// CHECK constraint relaxed
assert.ok(migration46.includes('drop constraint if exists products_category_allowed'))
console.log('✓ products_category_allowed CHECK dropped for FK-backed taxonomy')

// 3–9 seed rows
assert.ok(migration47.includes(KITCHEN_CATEGORY_ID))
assert.ok(migration47.includes("'Kitchen'"))
assert.ok(migration47.includes("'Cookware'"))
assert.ok(migration47.includes('0.96'))
assert.ok(migration47.includes('0.50'))
assert.ok(migration47.includes("'complete'"))
assert.ok(migration47.includes("'Food Storage'"))
assert.ok(migration47.includes('0.83'))
assert.ok(migration47.includes('0.75'))
assert.ok(migration47.includes("'Water Bottles'"))
assert.ok(migration47.includes(KITCHEN_SUBCATEGORY_IDS.water_bottles))
assert.ok(migration47.includes("'Drinkware'"))
assert.ok(migration47.includes(KITCHEN_SUBCATEGORY_IDS.drinkware))
assert.ok(migration47.includes("'Cooking Utensils'"))
assert.ok(migration47.includes("'role_split'"))
console.log('✓ Kitchen + five subcategories seeded with v2.3.5 defaults')

// 9 water bottles and drinkware separate
const wbPos = migration47.indexOf(KITCHEN_SUBCATEGORY_IDS.water_bottles)
const dwPos = migration47.indexOf(KITCHEN_SUBCATEGORY_IDS.drinkware)
assert.ok(wbPos > 0 && dwPos > 0 && wbPos !== dwPos)
console.log('✓ Water Bottles and Drinkware are separate seed rows')

// 10–17 readiness behavior
const cookwareReady = evaluateSubcategoryScoringReadiness({
  name: 'Cookware',
  defaults_status: 'complete',
  default_severity: 0.96,
  default_duration: 0.5,
  is_archived: false,
})
assert.equal(cookwareReady.scoring_ready, true)

const foodStorageReady = evaluateSubcategoryScoringReadiness({
  name: 'Food Storage',
  defaults_status: 'complete',
  default_severity: 0.83,
  default_duration: 0.75,
  is_archived: false,
})
assert.equal(foodStorageReady.scoring_ready, true)

const waterBottlesReady = evaluateSubcategoryScoringReadiness({
  name: 'Water Bottles',
  defaults_status: 'complete',
  default_severity: 0.6,
  default_duration: 0.8,
  is_archived: false,
})
assert.equal(waterBottlesReady.scoring_ready, true)

const drinkwareReady = evaluateSubcategoryScoringReadiness({
  name: 'Drinkware',
  defaults_status: 'complete',
  default_severity: 0.6,
  default_duration: 0.8,
  is_archived: false,
})
assert.equal(drinkwareReady.scoring_ready, true)

const unsetBlocked = evaluateSubcategoryScoringReadiness({
  name: 'New Subcategory',
  defaults_status: 'unset',
  default_severity: null,
  default_duration: null,
  is_archived: false,
})
assert.equal(unsetBlocked.scoring_ready, false)
assert.ok(unsetBlocked.blockers.some((b) => b.code === 'SUBCATEGORY_DEFAULTS_UNSET'))

const utensilsRoleSplit = evaluateSubcategoryScoringReadiness({
  name: 'Cooking Utensils',
  defaults_status: 'role_split',
  default_severity: null,
  default_duration: null,
  is_archived: false,
})
assert.equal(utensilsRoleSplit.scoring_ready, false)
assert.ok(
  utensilsRoleSplit.notices.some((b) => b.code === 'SUBCATEGORY_ROLE_SPLIT_REQUIRES_MATERIAL'),
)
assert.equal(
  resolveManagedSubcategoryScalarDefaults({
    slug: 'cooking_utensils',
    defaults_status: 'role_split',
    default_severity: null,
    default_duration: null,
  }),
  null,
)
console.log('✓ readiness blocks unset/role_split; complete subcategories pass')

// 18–20 product form integration (static)
assert.ok(adminPage.includes('ProductTaxonomyFields'))
assert.ok(adminPage.includes("tab === 'taxonomy'"))
assert.ok(adminPage.includes('TaxonomyDashboard'))
assert.ok(!adminPage.includes('<option value="Personal Care">'))
assert.ok(adminPage.includes('Managed category is required'))
assert.ok(adminPage.includes('Managed subcategory is required'))
console.log('✓ admin product form uses managed taxonomy dropdowns (no free-text category)')

// 21–24 active default paths from code registry (source sync guard)
const cookwareDefaults = resolveManagedSubcategoryScalarDefaults({
  slug: 'cookware',
  defaults_status: 'complete',
  default_severity: 0.96,
  default_duration: 0.5,
})
assert.deepEqual(cookwareDefaults, { severity: 0.96, duration: 0.5 })

const foodStorageCode = EXPOSURE_DEFAULTS_BY_KEY.food_storage.roles.primary_food_contact
assert.equal(foodStorageCode.severity, 0.83)
assert.equal(foodStorageCode.duration.duration, 0.75)

const waterBottlesCode = EXPOSURE_DEFAULTS_BY_KEY.water_bottles.roles.primary_food_contact
assert.equal(waterBottlesCode.severity, 0.6)
assert.equal(waterBottlesCode.duration.duration, 0.8)

const drinkwareCode = EXPOSURE_DEFAULTS_BY_KEY.drinkware.roles.primary_food_contact
assert.equal(drinkwareCode.severity, 0.6)
assert.equal(drinkwareCode.duration.duration, 0.8)

const cookwareCode = EXPOSURE_DEFAULTS_BY_KEY.cookware.roles.primary_food_contact
const cookwareSeverity =
  Number(cookwareCode.severity.severity_base) +
  cookwareCode.severity.additions.reduce((s, a) => s + Number(a.value), 0)
assert.equal(cookwareSeverity, 0.96)
assert.equal(cookwareCode.duration.duration, 0.5)
console.log('✓ active default paths remain 0.96/0.50 cookware, 0.83/0.75 food storage, 0.60/0.80 bottles/drinkware')

// Archive hides from dropdown (store loads is_archived=false by default)
assert.ok(migration46.includes('using (is_archived = false)'))
console.log('✓ archived taxonomy hidden from public read policies')

// Renaming does not orphan — FK on products references IDs
assert.ok(migration47.includes('on conflict (subcategory_id) do update'))
console.log('✓ taxonomy rename uses ID FK — products not orphaned by name change')

// Preflight integration
const preflightBlocked = evaluateProductIntakePreflight({
  category_id: KITCHEN_CATEGORY_ID,
  subcategory_id: KITCHEN_SUBCATEGORY_IDS.cooking_utensils,
  subcategory: {
    subcategory_id: KITCHEN_SUBCATEGORY_IDS.cooking_utensils,
    category_id: KITCHEN_CATEGORY_ID,
    name: 'Cooking Utensils',
    slug: 'cooking_utensils',
    display_order: 2,
    default_severity: null,
    default_duration: null,
    defaults_status: 'role_split',
    defaults_source: 'v2.3.5_role_split',
    registry_key: 'kitchen.utensils.spatula_or_cutting_board',
    matrix_key: 'cooking_utensils',
    scoring_assumption_ref: 'v2.3.5.utensils',
    is_archived: false,
    archived_at: null,
    archive_reason: null,
    created_at: '',
    updated_at: '',
  },
})
assert.equal(preflightBlocked.scoring_ready, false)

// Legacy public browse maps lumped drinkware under Water Bottles filter
assert.equal(
  productMatchesPublicSubcategory({ subcategory: 'Water Bottles and Drinkware' }, 'Water Bottles'),
  true,
)
assert.equal(productMatchesPublicSubcategory({ subcategory: 'Drinkware' }, 'Water Bottles'), false)

// Regression guards — migrations must not mutate published/scoring tables
assert.equal(migration46.includes('published_display_snapshots'), false)
assert.equal(migration46.includes('product_scores'), false)
assert.equal(migration46.includes('scoring_inputs'), false)
assert.equal(migration46.includes('pac_safety_score'), false)
assert.equal(migration47.includes('pac_safety_score'), false)
assert.equal(migration47.includes('publish_status'), false)
console.log('✓ migrations avoid published/scoring table mutations')

console.log('✓ managed taxonomy tests passed')
