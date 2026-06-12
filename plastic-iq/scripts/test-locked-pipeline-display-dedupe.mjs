#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  pickLatestPerCatalogDisplay,
  CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS,
} from '../src/lib/lockedPipeline/displayDedupe.ts'

const lodgeCanonical = [...CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS][0]
const hexCanonical = [...CANONICAL_LOCKED_PIPELINE_PRODUCT_IDS][1]

const items = [
  {
    product_id: 'smoke-1',
    created_at: '2026-06-11T12:00:00Z',
    product_name: 'Lodge Cast Iron Skillet 10.25 inch',
    brand: 'Lodge',
  },
  {
    product_id: lodgeCanonical,
    created_at: '2026-06-10T12:00:00Z',
    product_name: 'Lodge Cast Iron Skillet 10.25 inch',
    brand: 'Lodge',
  },
  {
    product_id: 'smoke-2',
    created_at: '2026-06-11T12:00:00Z',
    product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
    brand: 'HexClad',
  },
  {
    product_id: hexCanonical,
    created_at: '2026-06-10T12:00:00Z',
    product_name: 'HexClad Hybrid Nonstick 10 Inch Frying Pan',
    brand: 'HexClad',
  },
]

const deduped = pickLatestPerCatalogDisplay(items)
assert.equal(deduped.length, 2)
assert.equal(deduped.find((r) => r.brand === 'Lodge')?.product_id, lodgeCanonical)
assert.equal(deduped.find((r) => r.brand === 'HexClad')?.product_id, hexCanonical)
console.log('✓ pickLatestPerCatalogDisplay keeps canonical catalog row when names collide')
