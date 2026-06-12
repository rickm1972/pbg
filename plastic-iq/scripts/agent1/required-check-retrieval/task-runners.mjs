import { runCookwarePfasRegulatoryRetrieval } from './tasks/cookware-pfas-regulatory.mjs'
import { runCookwarePfoaPfasDistinctionRetrieval } from './tasks/cookware-pfoa-pfas-distinction.mjs'
import { runCoatedProductLabResultsRetrieval } from './tasks/cookware-lab-results.mjs'

/** check_id → runner (must match retrieval-task-registry.mjs check_id exactly). */
export const TASK_RUNNERS = {
  'external.regulatory_pfas_minnesota_review': runCookwarePfasRegulatoryRetrieval,
  'external.pfoa_vs_pfas_free_distinction': runCookwarePfoaPfasDistinctionRetrieval,
  'external.coated_product_lab_results': runCoatedProductLabResultsRetrieval,
}

/** PTFE / PFAS cookware — both runners must exist before catalog or validation runs. */
export const PTFE_REQUIRED_EXTERNAL_CHECK_IDS = [
  'external.regulatory_pfas_minnesota_review',
  'external.pfoa_vs_pfas_free_distinction',
] 

export function assertPtfeExternalRunnersRegistered() {
  const missing = PTFE_REQUIRED_EXTERNAL_CHECK_IDS.filter((id) => !TASK_RUNNERS[id])
  if (missing.length) {
    throw new Error(
      `PTFE cookware required-check runners missing: ${missing.join(', ')}. ` +
        `Registered: ${Object.keys(TASK_RUNNERS).join(', ')}`,
    )
  }
  return PTFE_REQUIRED_EXTERNAL_CHECK_IDS
}

export function hasRetrievalRunner(checkId) {
  return typeof TASK_RUNNERS[checkId] === 'function'
}
