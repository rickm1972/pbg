#!/usr/bin/env node
/**
 * Fail when category/product-type rules are defined outside the product-type registry.
 * Run: npm run lint:registry-single-owner
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(import.meta.url), '..', '..')
const registryRoot = join(root, 'src/shared/product-type-registry')

const SCAN_DIRS = [
  join(root, 'scripts/agent1'),
  join(root, 'scripts/agent2'),
  join(root, 'scripts/agent3'),
  join(root, 'scripts/agent4'),
  join(root, 'src/shared/required-evidence-matrix'),
  join(root, 'src/lib/apr'),
]

const FORBIDDEN_PATTERNS = [
  { id: 'subcategory_category_map', re: /SUBCATEGORY_CATEGORY\s*=\s*\{/ },
  { id: 'cookware_matrix_fallback', re: /\?\?\s*COOKWARE_MATRIX/ },
  { id: 'resolve_subcategory_cookware_default', re: /return\s+'cookware'/ },
  { id: 'exposure_defaults_outside_registry', re: /EXPOSURE_DEFAULTS_BY_KEY/ },
  { id: 'use_condition_templates_outside_registry', re: /USE_CONDITION_TEMPLATES_BY_KEY/ },
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) {
      if (name === 'node_modules') continue
      walk(path, out)
    } else if (/\.(mjs|ts|tsx)$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

const violations = []

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    if (file.startsWith(registryRoot)) continue
    const rel = file.slice(root.length + 1)
    const content = readFileSync(file, 'utf8')
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.re.test(content)) {
        violations.push({ file: rel, pattern: pattern.id })
      }
    }
  }
}

if (violations.length) {
  console.error('Registry single-owner lint failed:\n')
  for (const v of violations) {
    console.error(`  ${v.file}: forbidden ${v.pattern}`)
  }
  process.exit(1)
}

console.log('✓ no category/product-type rules defined outside product-type registry')
