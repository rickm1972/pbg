/**
 * Browser-safe durable writer facade (in-memory). Node scripts import durableSnapshotWriter.node.ts.
 */

export {
  configureDurableStore,
  findDescriptionOverrideDurable,
  getDurableStoreRootForTests,
  listDescriptionOverridesDurable,
  resetDurableStoreForTests,
  saveApprovedSnapshotVersionDurable,
  saveDescriptionOverrideDurable,
} from './durableSnapshotWriter.browser'
