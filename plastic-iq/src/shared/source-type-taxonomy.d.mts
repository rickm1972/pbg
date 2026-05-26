export type SourceTypeLabels = {
  groupLabel: string
  badgeLabel: string
}

export const SOURCE_TYPE_GROUP_ORDER: string[]
export const SOURCE_TYPE_LABELS: Record<string, SourceTypeLabels>

export function normalizeSourceType(sourceType: string): string
export function humanizeSourceType(sourceType: string): string
export function resolveSourceTypeLabels(sourceType: string): SourceTypeLabels
export function sourceTypeGroupSortKey(sourceType: string): number
export function compareSourceGroupTypes(a: string, b: string): number

export function groupSourcesByType<T extends { source_type?: string }>(
  sources: T[],
): Array<{ sourceType: string; sources: T[] }>
