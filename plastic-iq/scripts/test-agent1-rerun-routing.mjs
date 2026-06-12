#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mustResetAgent1BeforeRerun } from '../src/lib/agent1RunTabOnly.ts'
import { canRerunAgent1FromReviewSequential } from '../src/lib/pipelineCatalog.ts'

const hexCladId = 'fd05c5fb-19c2-4bc0-9882-ce73a7644ef5'

assert.equal(canRerunAgent1FromReviewSequential('evidence_awaiting_review'), true)
console.log('✓ awaiting review allows review-card re-run trigger')

assert.equal(mustResetAgent1BeforeRerun('evidence_awaiting_review'), true)
assert.equal(mustResetAgent1BeforeRerun('unscored'), false)
console.log('✓ awaiting review must reset before rerun')

console.log('\nAgent 1 re-run routing tests passed.')
