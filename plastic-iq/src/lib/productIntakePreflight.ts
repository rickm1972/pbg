import {
  evaluateSubcategoryScoringReadiness,
  type SubcategoryReadinessBlocker,
} from './managedTaxonomy/readiness'
import type { ProductSubcategoryRow } from './managedTaxonomy/types'

export type ProductIntakePreflightInput = {
  category_id: string | null
  subcategory_id: string | null
  subcategory?: ProductSubcategoryRow | null
}

export type ProductIntakePreflightResult = {
  intake_ready: boolean
  scoring_ready: boolean
  blockers: SubcategoryReadinessBlocker[]
  notices: SubcategoryReadinessBlocker[]
}

export function evaluateProductIntakePreflight(
  input: ProductIntakePreflightInput,
): ProductIntakePreflightResult {
  const blockers: SubcategoryReadinessBlocker[] = []
  const notices: SubcategoryReadinessBlocker[] = []

  if (!input.category_id) {
    blockers.push({
      code: 'SUBCATEGORY_NOT_SELECTED',
      message: 'Select a managed category from the taxonomy dropdown.',
      severity: 'blocker',
    })
  }

  if (!input.subcategory_id) {
    blockers.push({
      code: 'SUBCATEGORY_NOT_SELECTED',
      message: 'Select a managed subcategory from the taxonomy dropdown.',
      severity: 'blocker',
    })
  }

  const readiness = evaluateSubcategoryScoringReadiness(input.subcategory ?? null)
  blockers.push(...readiness.blockers)
  notices.push(...readiness.notices)

  const intake_ready = blockers.length === 0
  return {
    intake_ready,
    scoring_ready: readiness.scoring_ready && intake_ready,
    blockers,
    notices,
  }
}
