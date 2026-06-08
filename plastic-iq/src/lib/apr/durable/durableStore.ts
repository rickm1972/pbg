/**
 * Durable persistence facade — reads via browser-safe loader; writes via Node writer.
 */

export {
  clearDurableSnapshotLoaderCache,
  loadApprovedSnapshotMetaDurable,
  loadLatestApprovedSnapshotDurable,
  loadLatestApprovedSnapshotStored,
  listApprovedSnapshotVersionsDurable,
  registerDurableFileStoreReader,
  simulateDurableStoreProcessRestart,
} from './durableSnapshotLoader'

export {
  configureDurableStore,
  findDescriptionOverrideDurable,
  getDurableStoreRootForTests,
  listDescriptionOverridesDurable,
  resetDurableStoreForTests,
  saveApprovedSnapshotVersionDurable,
  saveDescriptionOverrideDurable,
} from './durableWriterRuntime'
