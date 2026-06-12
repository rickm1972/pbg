#!/usr/bin/env node
/**
 * Programmatic readiness/UI source verification (no agents, no new products).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectPgClient } from './lib/pg-connect.mjs'
import { loadEnv } from './lib/env.mjs'
import {
  evaluateSubcategoryScoringReadiness,
  subcategoryDefaultsWarning,
} from '../src/lib/managedTaxonomy/readiness.ts'
import { CLAIM_INTAKE_DISCLAIMER } from '../src/lib/productClaimIntake.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const adminPage = readFileSync(join(root, 'src/pages/AdminPage.tsx'), 'utf8')
const taxonomyDash = readFileSync(join(root, 'src/components/admin/TaxonomyDashboard.tsx'), 'utf8')
const taxonomyFields = readFileSync(join(root, 'src/components/admin/ProductTaxonomyFields.tsx'), 'utf8')
const claimFields = readFileSync(join(root, 'src/components/admin/ProductClaimIntakeFields.tsx'), 'utf8')
const homePage = readFileSync(join(root, 'src/pages/HomePage.tsx'), 'utf8')
const categoriesPage = readFileSync(join(root, 'src/pages/CategoriesPage.tsx'), 'utf8')

// UI source checks (Part F)
assert.ok(adminPage.includes("'taxonomy'"), 'Admin Taxonomy tab key')
assert.ok(adminPage.includes('TaxonomyDashboard'), 'Taxonomy dashboard mounted')
assert.ok(taxonomyDash.includes('Show archived'), 'Show archived toggle')
assert.ok(taxonomyDash.includes('role_split') || taxonomyDash.includes('Role split'), 'role_split label in taxonomy admin')
assert.ok(taxonomyFields.includes('<select'), 'closed category/subcategory dropdowns')
assert.ok(!adminPage.includes('<option value="Personal Care">'), 'no legacy free category enum')
assert.ok(claimFields.includes('REQUIRED_CLAIM_INTAKE_TYPES'))
assert.ok(claimFields.includes('CLAIM_INTAKE_LABELS'))
assert.ok(claimFields.includes('option value="unknown"'))
assert.ok(claimFields.includes('CLAIM_INTAKE_DISCLAIMER'))
assert.ok(homePage.includes("'Water Bottles'"))
assert.ok(homePage.includes("'Drinkware'"))
assert.ok(!homePage.includes('Water Bottles & Drinkware'))
assert.ok(categoriesPage.includes('ariaTitle="Water Bottles"'))
assert.ok(categoriesPage.includes('ariaTitle="Drinkware"'))
console.log('✓ UI source verification (Taxonomy tab, dropdowns, claims, public split)')

const client = await connectPgClient(loadEnv())
try {
  const { rows } = await client.query(`
    select name, defaults_status, default_severity, default_duration
    from public.product_subcategories
    where category_id = 'a1111111-1111-4111-8111-111111111101'
    order by display_order
  `)

  const byName = Object.fromEntries(rows.map((r) => [r.name, r]))

  for (const [name, sev, dur] of [
    ['Cookware', 0.96, 0.5],
    ['Food Storage', 0.83, 0.75],
    ['Water Bottles', 0.6, 0.8],
    ['Drinkware', 0.6, 0.8],
  ]) {
    const row = byName[name]
    assert.equal(row.defaults_status, 'complete')
    assert.equal(Number(row.default_severity), sev)
    assert.equal(Number(row.default_duration), dur)
    const ready = evaluateSubcategoryScoringReadiness({
      name,
      defaults_status: row.defaults_status,
      default_severity: Number(row.default_severity),
      default_duration: Number(row.default_duration),
      is_archived: false,
    })
    assert.equal(ready.scoring_ready, true, `${name} should be scoring-ready`)
    assert.equal(subcategoryDefaultsWarning(row.defaults_status), null)
  }

  const utensils = byName['Cooking Utensils']
  assert.equal(utensils.defaults_status, 'role_split')
  assert.equal(utensils.default_severity, null)
  const utensilsReady = evaluateSubcategoryScoringReadiness({
    name: 'Cooking Utensils',
    defaults_status: 'role_split',
    default_severity: null,
    default_duration: null,
    is_archived: false,
  })
  assert.equal(utensilsReady.scoring_ready, false)
  assert.ok(subcategoryDefaultsWarning('role_split')?.includes('material'))
  console.log('✓ DB-backed readiness: Food Storage/Water Bottles/Drinkware pass; Cooking Utensils role_split blocks')

  assert.ok(CLAIM_INTAKE_DISCLAIMER.includes('intake/evidence fields'))
  console.log('✓ claim disclaimer text present')
} finally {
  await client.end()
}

console.log('✓ programmatic visual/readiness verification complete')
