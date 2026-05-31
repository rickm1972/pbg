import { randomUUID } from 'node:crypto'

/** @type {Map<string, { channelMapId: string, expiresAt: number }>} */
const tokens = new Map()

const TTL_MS = 120_000

export function createChannelExportToken(channelMapId) {
  const token = randomUUID()
  tokens.set(token, { channelMapId, expiresAt: Date.now() + TTL_MS })
  return token
}

export function validateChannelExportToken(token, channelMapId) {
  if (!token || !channelMapId) return false
  const entry = tokens.get(token)
  if (!entry) return false
  if (entry.channelMapId !== channelMapId) return false
  if (Date.now() > entry.expiresAt) return false
  return true
}

export function revokeChannelExportToken(token) {
  if (token) tokens.delete(token)
}
