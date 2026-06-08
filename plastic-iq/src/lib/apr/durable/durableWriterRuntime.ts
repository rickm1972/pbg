/**
 * Select Node fs writer vs browser in-memory writer at module load.
 */

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'

export const durableWriter = isBrowser
  ? await import('./durableSnapshotWriter.browser')
  : await import('./durableSnapshotWriter.node')

export const {
  configureDurableStore,
  findDescriptionOverrideDurable,
  getDurableStoreRootForTests,
  listDescriptionOverridesDurable,
  resetDurableStoreForTests,
  saveApprovedSnapshotVersionDurable,
  saveDescriptionOverrideDurable,
} = durableWriter
