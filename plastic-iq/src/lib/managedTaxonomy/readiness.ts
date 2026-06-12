import type { ProductSubcategoryRow, SubcategoryDefaultsStatus } from './types'

export type SubcategoryReadinessBlockerCode =
  | 'SUBCATEGORY_DEFAULTS_UNSET'
  | 'SUBCATEGORY_ROLE_SPLIT_REQUIRES_MATERIAL'
  | 'SUBCATEGORY_NOT_SELECTED'
  | 'SUBCATEGORY_ARCHIVED'

export type SubcategoryReadinessBlocker = {
  code: SubcategoryReadinessBlockerCode
  message: string
  severity: 'blocker' | 'notice'
}

export const SUBCATEGORY_DEFAULTS_STATUS_LABELS: Record<SubcategoryDefaultsStatus, string> = {
  complete: 'Complete',
  unset: 'Unset',
  role_split: 'Role split',
}

export function subcategoryDefaultsWarning(
  status: SubcategoryDefaultsStatus | null | undefined,
): string | null {
  if (status === 'unset') {
    return 'Subcategory defaults are unset. Set severity/duration in Taxonomy before scoring.'
  }
  if (status === 'role_split') {
    return 'This subcategory uses material/role-specific defaults. Agent 1 review must resolve the material path before scoring.'
  }
  return null
}

export function evaluateSubcategoryScoringReadiness(
  subcategory: Pick<
    ProductSubcategoryRow,
    'defaults_status' | 'default_severity' | 'default_duration' | 'name' | 'is_archived'
  > | null | undefined,
): {
  scoring_ready: boolean
  blockers: SubcategoryReadinessBlocker[]
  notices: SubcategoryReadinessBlocker[]
} {
  const blockers: SubcategoryReadinessBlocker[] = []
  const notices: SubcategoryReadinessBlocker[] = []

  if (!subcategory) {
    blockers.push({
      code: 'SUBCATEGORY_NOT_SELECTED',
      message: 'Select a managed subcategory before scoring readiness.',
      severity: 'blocker',
    })
    return { scoring_ready: false, blockers, notices }
  }

  if (subcategory.is_archived) {
    blockers.push({
      code: 'SUBCATEGORY_ARCHIVED',
      message: `Subcategory "${subcategory.name}" is archived. Choose an active subcategory.`,
      severity: 'blocker',
    })
    return { scoring_ready: false, blockers, notices }
  }

  if (subcategory.defaults_status === 'unset') {
    blockers.push({
      code: 'SUBCATEGORY_DEFAULTS_UNSET',
      message:
        'Subcategory defaults are unset. Set severity/duration in Taxonomy before scoring.',
      severity: 'blocker',
    })
    return { scoring_ready: false, blockers, notices }
  }

  if (subcategory.defaults_status === 'role_split') {
    notices.push({
      code: 'SUBCATEGORY_ROLE_SPLIT_REQUIRES_MATERIAL',
      message:
        'This subcategory uses material/role-specific defaults. Agent 1 review must resolve the material path before scoring.',
      severity: 'notice',
    })
    return { scoring_ready: false, blockers, notices }
  }

  if (
    subcategory.default_severity == null ||
    subcategory.default_duration == null ||
    !Number.isFinite(Number(subcategory.default_severity)) ||
    !Number.isFinite(Number(subcategory.default_duration))
  ) {
    blockers.push({
      code: 'SUBCATEGORY_DEFAULTS_UNSET',
      message:
        'Subcategory defaults are incomplete. Set severity/duration in Taxonomy before scoring.',
      severity: 'blocker',
    })
    return { scoring_ready: false, blockers, notices }
  }

  return { scoring_ready: true, blockers, notices }
}

/** Resolve scalar defaults for complete subcategories only — no fallback across categories. */
export function resolveManagedSubcategoryScalarDefaults(
  subcategory: Pick<
    ProductSubcategoryRow,
    'defaults_status' | 'default_severity' | 'default_duration' | 'slug'
  > | null | undefined,
): { severity: number; duration: number } | null {
  if (!subcategory || subcategory.defaults_status !== 'complete') return null
  const severity = Number(subcategory.default_severity)
  const duration = Number(subcategory.default_duration)
  if (!Number.isFinite(severity) || !Number.isFinite(duration)) return null
  return { severity, duration }
}
