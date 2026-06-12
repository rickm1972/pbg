#!/usr/bin/env node
/** Scoped typecheck for locked-input + Phase 4 validation path only. */
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

execSync(`npx tsc --project ${join(root, 'tsconfig.locked-input.json')} --noEmit`, {
  stdio: 'inherit',
  cwd: root,
})

console.log('✓ locked-input scoped typecheck passed')
