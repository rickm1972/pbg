/**
 * Phase 4.5 — publish readiness chains APR contract preflight + negative-score gate.
 */

import type { ApprovedProductRecord } from '../../types/apr'
import { runAprContractPreflight } from './contractPreflight'
import {
  runNegativeScorePublicationGate,
  type NegativeScoreGateOptions,
  type NegativeScoreGateResult,
} from './negativeScoreGate'

export type PublishReadinessResult = {
  ready: boolean
  contract_preflight_passed: boolean
  negative_score_gate: NegativeScoreGateResult
  violations: Array<{ source: 'contract' | 'negative_score'; message: string; path: string }>
}

/** After standard APR preflight; negative-score gate runs before publish readiness. */
export function assertPublishReadiness(
  record: ApprovedProductRecord,
  options: NegativeScoreGateOptions = {},
): PublishReadinessResult {
  const contract = runAprContractPreflight(record)
  const negative = runNegativeScorePublicationGate(record, options)

  const violations: PublishReadinessResult['violations'] = []

  for (const v of contract.violations) {
    violations.push({ source: 'contract', message: v.message, path: v.path })
  }
  for (const f of negative.failures) {
    violations.push({ source: 'negative_score', message: f.message, path: f.path })
  }

  const ready = contract.passed && negative.ok

  return {
    ready,
    contract_preflight_passed: contract.passed,
    negative_score_gate: negative,
    violations,
  }
}
