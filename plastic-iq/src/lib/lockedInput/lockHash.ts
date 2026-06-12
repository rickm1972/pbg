import { contentHash } from '../apr/contentHash'
import type { LockedInputPayload } from '../../types/lockedInput'

/** SHA-256 hex digest of canonical locked payload JSON. */
export function hashLockedInputPayload(payload: LockedInputPayload): string {
  return contentHash(payload)
}
