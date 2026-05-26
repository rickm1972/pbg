/** Thin TS re-export — taxonomy data lives only in src/shared/source-type-taxonomy.mjs */
export type { SourceTypeLabels } from '../shared/source-type-taxonomy.d.mts'
export {
  SOURCE_TYPE_GROUP_ORDER,
  SOURCE_TYPE_LABELS,
  compareSourceGroupTypes,
  groupSourcesByType,
  humanizeSourceType,
  normalizeSourceType,
  resolveSourceTypeLabels,
  sourceTypeGroupSortKey,
} from '../shared/source-type-taxonomy.mjs'
