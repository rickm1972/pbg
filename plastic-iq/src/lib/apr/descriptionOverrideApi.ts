/**
 * Browser admin client — description overrides run on the Vite dev API (Node fs + bundled sync).
 */

import type {
  ApproveDescriptionOverrideOptions,
  DescriptionOverrideRecord,
  DescriptionOverrideState,
} from './descriptionOverride'

function apiBase(): string {
  return import.meta.env.VITE_DESCRIPTION_OVERRIDE_API_URL || '/api/description-override'
}

function adminSecret(): string {
  const secret = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is not set — restart npm run dev after updating .env')
  }
  return secret
}

function jsonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Agent-Secret': adminSecret(),
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }
  return body
}

export async function fetchDescriptionOverrideState(
  productId: string,
): Promise<DescriptionOverrideState> {
  const q = new URLSearchParams({ product_id: productId })
  const res = await fetch(`${apiBase()}/state?${q}`, { headers: jsonHeaders() })
  const body = await parseJson<{ state: DescriptionOverrideState }>(res)
  return body.state
}

export async function saveDescriptionOverrideDraftViaApi(input: {
  product_id: string
  proposed_override_text: string
  created_by?: string | null
}): Promise<DescriptionOverrideRecord> {
  const res = await fetch(`${apiBase()}/draft`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  })
  const body = await parseJson<{ record: DescriptionOverrideRecord }>(res)
  return body.record
}

export async function submitDescriptionOverrideForReviewViaApi(
  overrideId: string,
): Promise<DescriptionOverrideRecord> {
  const res = await fetch(`${apiBase()}/submit`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ override_id: overrideId }),
  })
  const body = await parseJson<{ record: DescriptionOverrideRecord }>(res)
  return body.record
}

export async function approveDescriptionOverrideViaApi(
  overrideId: string,
  options: ApproveDescriptionOverrideOptions,
): Promise<{
  override: DescriptionOverrideRecord
  new_snapshot_id: string
  bundled_synced: boolean
}> {
  const res = await fetch(`${apiBase()}/approve`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ override_id: overrideId, ...options }),
  })
  return parseJson(res)
}

export async function rejectDescriptionOverrideViaApi(
  overrideId: string,
  reviewerId: string,
  notes?: string | null,
): Promise<DescriptionOverrideRecord> {
  const res = await fetch(`${apiBase()}/reject`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ override_id: overrideId, reviewer_id: reviewerId, notes }),
  })
  const body = await parseJson<{ record: DescriptionOverrideRecord }>(res)
  return body.record
}
