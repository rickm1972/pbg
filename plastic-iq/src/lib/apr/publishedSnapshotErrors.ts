export class PublishedSnapshotMissingError extends Error {
  readonly product_id: string

  constructor(productId: string, message?: string) {
    super(
      message ??
        `Published product ${productId} has no frozen display snapshot. Republish or run snapshot backfill.`,
    )
    this.name = 'PublishedSnapshotMissingError'
    this.product_id = productId
  }
}

export class PublishSnapshotCreationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublishSnapshotCreationError'
  }
}
